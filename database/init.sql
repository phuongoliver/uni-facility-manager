-- 1. CLEANUP & SETUP
-- Xóa schema cũ nếu tồn tại để tránh conflict khi chạy lại
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Cấu hình múi giờ (quan trọng cho booking)
SET timezone = 'Asia/Ho_Chi_Minh';

-- 2. ENUM DEFINITIONS
-- Sử dụng ENUM để đảm bảo Data Integrity (chỉ chấp nhận các giá trị hợp lệ)
-- [UPDATED] Added FACILITY_MANAGER
CREATE TYPE user_role AS ENUM ('STUDENT', 'ADMIN', 'FACILITY_MANAGER');
CREATE TYPE facility_type AS ENUM ('CLASSROOM', 'HALL', 'LAB', 'OUTDOOR');
CREATE TYPE booking_type AS ENUM ('ACADEMIC', 'EVENT', 'PERSONAL');
CREATE TYPE booking_status AS ENUM ('PENDING', 'APPROVED', 'PENDING_PAYMENT', 'PENDING_RESCHEDULE', 'CONFIRMED', 'IN_USE', 'COMPLETED', 'CANCELLED', 'REJECTED', 'RESCHEDULED', 'ADMIN_HOLD', 'REVIEW_REQUIRED');
CREATE TYPE equipment_status AS ENUM ('GOOD', 'BROKEN', 'MAINTENANCE');
CREATE TYPE transaction_type AS ENUM ('DEPOSIT', 'RENTAL_FEE', 'FINE');
CREATE TYPE price_type AS ENUM ('PER_HOUR', 'PER_BOOKING', 'ONE_TIME');
CREATE TYPE payment_method AS ENUM ('MOMO', 'BANKING', 'CASH');
CREATE TYPE transaction_status AS ENUM ('PENDING', 'PAID', 'REFUNDED');

-- 3. TABLES CREATION

-- Table: Users
CREATE TABLE users (
    user_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sso_id VARCHAR(50) UNIQUE NOT NULL, -- Authentication managed by external SSO (Identity Provider)
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    role user_role NOT NULL,
    department VARCHAR(100),
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: Facilities
CREATE TABLE facilities (
    facility_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    manager_id INT REFERENCES users(user_id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(255),
    type facility_type NOT NULL,
    capacity INT CHECK (capacity > 0),
    image_url TEXT,
    requires_approval BOOLEAN DEFAULT TRUE,
    status VARCHAR(20) DEFAULT 'AVAILABLE',
    -- Master Data Price (supports free facilities with price = 0)
    price DECIMAL(15, 2) DEFAULT 0 CHECK (price >= 0),
    price_type price_type DEFAULT 'PER_HOUR',
    transaction_type transaction_type DEFAULT 'RENTAL_FEE',
    min_cancellation_hours INT DEFAULT 1
);

-- Table: Equipment
CREATE TABLE equipments (
    equipment_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    facility_id INT REFERENCES facilities(facility_id) ON DELETE SET NULL, -- NULL = Kho lưu động
    name VARCHAR(100) NOT NULL,
    total_quantity INT NOT NULL CHECK (total_quantity >= 0),
    available_quantity INT NOT NULL CHECK (available_quantity >= 0),
    status equipment_status DEFAULT 'GOOD',
    -- Master Data Price
    rental_price DECIMAL(15, 2) DEFAULT 0 CHECK (rental_price >= 0)
);

-- Table: Booking Groups (Master for Recurring Bookings)
CREATE TABLE booking_groups (
    group_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    facility_id INT REFERENCES facilities(facility_id),
    recurrence_pattern VARCHAR(100),
    total_amount DECIMAL(15, 2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: Booking
CREATE TABLE bookings (
    booking_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    facility_id INT REFERENCES facilities(facility_id) ON DELETE RESTRICT,
    purpose TEXT,
    booking_type booking_type NOT NULL,
    status booking_status DEFAULT 'PENDING',
    check_in_time TIMESTAMPTZ NOT NULL,
    check_out_time TIMESTAMPTZ NOT NULL,
    total_amount DECIMAL(15, 2) DEFAULT 0,
    cancellation_reason TEXT,
    cancelled_at TIMESTAMPTZ,
    recurrence_group_id UUID,
    parent_booking_id INT REFERENCES bookings(booking_id) ON DELETE SET NULL, -- For reschedule requests (fork)
    group_id INT REFERENCES booking_groups(group_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT chk_time_valid CHECK (check_out_time > check_in_time),
    
    -- Không cho phép cùng Facility ID mà khoảng thời gian (Time Range) đè lên nhau (Overlaps &&)
    -- Chỉ áp dụng khi booking chưa bị hủy, từ chối hoặc đang chờ reschedule
    CONSTRAINT no_double_booking EXCLUDE USING GIST (
        facility_id WITH =,
        tstzrange(check_in_time, check_out_time) WITH &&
    ) WHERE (status NOT IN ('CANCELLED', 'REJECTED', 'PENDING_RESCHEDULE', 'RESCHEDULED'))
);
-- Table: BookingDetail
CREATE TABLE booking_details (
    booking_id INT REFERENCES bookings(booking_id) ON DELETE CASCADE,
    equipment_id INT REFERENCES equipments(equipment_id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    note TEXT,
    -- Snapshot Price: Giá tại thời điểm book
    booked_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
    
    PRIMARY KEY (booking_id, equipment_id)
);

-- Table: Transaction
CREATE TABLE transactions (
    transaction_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id INT UNIQUE REFERENCES bookings(booking_id) ON DELETE CASCADE, -- 1-1 Relationship
    amount_vnd DECIMAL(15, 2) NOT NULL CHECK (amount_vnd >= 0),
    type transaction_type NOT NULL,
    payment_method payment_method NOT NULL,
    status transaction_status DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: ActionLog
CREATE TABLE action_logs (
    log_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id INT REFERENCES bookings(booking_id) ON DELETE SET NULL,
    actor_id INT REFERENCES users(user_id) ON DELETE SET NULL,
    action_detail TEXT NOT NULL,
    reason TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 4. INDEXING (Performance Optimization)
-- Index cho các trường thường xuyên dùng để search/filter
CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_facility ON bookings(facility_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_time ON bookings(check_in_time, check_out_time); -- Composite index cho query trùng lịch
CREATE INDEX idx_equipments_facility ON equipments(facility_id);

-- 5. ADVANCED LOGIC: TRIGGERS & FUNCTIONS

-- A. Function: Tự động snapshot giá thiết bị khi insert vào BookingDetail
CREATE OR REPLACE FUNCTION snapshot_equipment_price()
RETURNS TRIGGER AS $$
BEGIN
    -- Lấy giá hiện tại từ bảng Equipment nạp vào booked_price của BookingDetail
    SELECT rental_price INTO NEW.booked_price
    FROM equipments
    WHERE equipment_id = NEW.equipment_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_snapshot_price_before_insert
BEFORE INSERT ON booking_details
FOR EACH ROW
EXECUTE FUNCTION snapshot_equipment_price();


-- B. Function: Tính toán tổng tiền (Core Logic - supports multiple pricing types)
CREATE OR REPLACE FUNCTION calculate_total_amount()
RETURNS TRIGGER AS $$
DECLARE
    v_booking_id INT;
    v_facility_price DECIMAL(15, 2);
    v_facility_price_type price_type;
    v_equipment_total DECIMAL(15, 2);
    v_hours NUMERIC;
    v_calculated_facility_cost DECIMAL(15, 2);
BEGIN
    -- [FIX] Xác định booking_id dựa trên thao tác
    IF TG_TABLE_NAME = 'bookings' THEN
        v_booking_id := NEW.booking_id;
    ELSIF TG_TABLE_NAME = 'booking_details' THEN
        IF (TG_OP = 'DELETE') THEN
            v_booking_id := OLD.booking_id; -- Dùng OLD khi xóa
        ELSE
            v_booking_id := NEW.booking_id; -- Dùng NEW khi Insert/Update
        END IF;
    END IF;

    -- 1. Lấy thông tin giá phòng và loại giá
    SELECT 
        f.price,
        f.price_type,
        EXTRACT(EPOCH FROM (b.check_out_time - b.check_in_time)) / 3600
    INTO v_facility_price, v_facility_price_type, v_hours
    FROM bookings b
    JOIN facilities f ON b.facility_id = f.facility_id
    WHERE b.booking_id = v_booking_id;

    -- 2. Tính tiền phòng dựa trên loại giá
    CASE v_facility_price_type
        WHEN 'PER_HOUR' THEN
            v_calculated_facility_cost := v_facility_price * CEIL(v_hours);
        WHEN 'PER_BOOKING' THEN
            v_calculated_facility_cost := v_facility_price; -- Fixed price per booking
        WHEN 'ONE_TIME' THEN
            v_calculated_facility_cost := v_facility_price; -- One-time fee
        ELSE
            v_calculated_facility_cost := v_facility_price * v_hours; -- Default to per hour
    END CASE;

    -- 3. Tính tổng tiền thiết bị
    SELECT COALESCE(SUM(quantity * booked_price), 0)
    INTO v_equipment_total
    FROM booking_details
    WHERE booking_id = v_booking_id;

    -- 4. Update ngược lại vào Booking
    UPDATE bookings
    SET total_amount = v_calculated_facility_cost + v_equipment_total
    WHERE booking_id = v_booking_id;

    -- Return đúng quy tắc trigger
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger chạy khi thay đổi thời gian Booking (vì ảnh hưởng số giờ)
CREATE TRIGGER trg_update_total_on_booking_change
AFTER INSERT OR UPDATE OF check_in_time, check_out_time, facility_id ON bookings
FOR EACH ROW
EXECUTE FUNCTION calculate_total_amount();

-- Trigger chạy khi thay đổi BookingDetail (thêm/sửa/xóa thiết bị)
CREATE TRIGGER trg_update_total_on_detail_change
AFTER INSERT OR UPDATE OR DELETE ON booking_details
FOR EACH ROW
EXECUTE FUNCTION calculate_total_amount();

-- 6. SEED DATA (Rich Dataset)

-- Seed Users
INSERT INTO users (sso_id, full_name, email, role, department) VALUES
('20110456', 'Nguyen Van Sinh Vien', 'student@university.edu.vn', 'STUDENT', 'Computer Science'),
('20101234', 'Tran Thi Hanh', 'hanh.tran@university.edu.vn', 'STUDENT', 'Business Administration'),
('20109999', 'Le Van Long', 'long.le@university.edu.vn', 'STUDENT', 'Electrical Engineering'),
('T00123', 'Dr. Le Thi Giang Vien', 'lecturer@university.edu.vn', 'LECTURER', 'Software Engineering'),
('T00987', 'Prof. John Smith', 'john.smith@university.edu.vn', 'LECTURER', 'International Relations'),
('ADM001', 'Tran Quan Ly', 'admin@university.edu.vn', 'ADMIN', 'Facility Department'),
('MANAGER001', 'Pham Van Quan Ly CSVC', 'manager@university.edu.vn', 'FACILITY_MANAGER', 'Facility Operation');

-- Seed Facilities (with real Unsplash Images & Diverse Pricing)
INSERT INTO facilities (name, location, type, capacity, image_url, price, price_type, min_cancellation_hours, manager_id) VALUES
('Grand Hall A1', 'Block A, Floor 1', 'HALL', 500, 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&q=80', 500000, 'PER_HOUR', 24, 3),
('Interactive Classroom C202', 'Block C, Floor 2', 'CLASSROOM', 60, 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&q=80', 100000, 'PER_HOUR', 2, 3),
('AI Research Lab', 'Block B, Floor 3', 'LAB', 40, 'https://images.unsplash.com/photo-1596495578065-6e0763fa1178?w=800&q=80', 2000000, 'PER_BOOKING', 12, 4),
('Main Soccer Field', 'Sports Complex Zone', 'OUTDOOR', 22, 'https://images.unsplash.com/photo-1626245652674-8d49f697412e?w=800&q=80', 0, 'ONE_TIME', 1, 4),
('Conference Room B1', 'Block B, Floor 1', 'HALL', 50, 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80', 300000, 'PER_HOUR', 5, 3),
('Physics Lab 101', 'Block C, Floor 1', 'LAB', 30, 'https://images.unsplash.com/photo-1564325724739-bae0bd08762c?w=800&q=80', 150000, 'PER_HOUR', 3, 4),
('Outdoor Tennis Court', 'Sports Complex Zone', 'OUTDOOR', 4, 'https://images.unsplash.com/photo-1622279457406-8134469f6e3d?w=800&q=80', 50000, 'PER_HOUR', 2, 4);

-- Seed Equipments
INSERT INTO equipments (facility_id, name, total_quantity, available_quantity, rental_price) VALUES
(1, 'Projector Sony 4K', 4, 4, 100000),       -- At Grand Hall A1
(1, 'Wireless Mic Set', 10, 10, 50000),        -- At Grand Hall A1
(NULL, 'Portable JBL Speaking', 10, 10, 30000), -- Floating stock
(NULL, 'Whiteboard Marker Set', 50, 50, 5000),  -- Floating stock
(3, 'High-Performance GPU Server', 10, 10, 0),  -- Free for AI Lab
(6, 'Oscilloscope', 15, 15, 0),                 -- Free for Physics Lab
(NULL, 'Extension Cord (10m)', 20, 20, 10000);

-- Seed Bookings

-- 1. Completed Past Booking (Student 1)
INSERT INTO bookings (user_id, facility_id, purpose, booking_type, status, check_in_time, check_out_time, total_amount) 
VALUES (1, 2, $$Group Study Session$$, 'PERSONAL', 'COMPLETED', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' + INTERVAL '2 hours', 200000);

-- 2. Confirmed Future Booking (Lecturer)
INSERT INTO bookings (user_id, facility_id, purpose, booking_type, status, check_in_time, check_out_time) 
VALUES (4, 1, $$Guest Lecture Series$$, 'ACADEMIC', 'CONFIRMED', NOW() + INTERVAL '2 days' + INTERVAL '9 hours', NOW() + INTERVAL '2 days' + INTERVAL '12 hours');

-- 3. Pending Booking (Student 2 needs approval)
INSERT INTO bookings (user_id, facility_id, purpose, booking_type, status, check_in_time, check_out_time) 
VALUES (2, 5, $$Student Union Meeting$$, 'EVENT', 'PENDING', NOW() + INTERVAL '3 days' + INTERVAL '14 hours', NOW() + INTERVAL '3 days' + INTERVAL '16 hours');

-- 4. Waiting Payment Booking (Student 1)
INSERT INTO bookings (user_id, facility_id, purpose, booking_type, status, check_in_time, check_out_time) 
VALUES (1, 7, $$Tennis Match with friends$$, 'PERSONAL', 'PENDING_PAYMENT', NOW() + INTERVAL '1 day' + INTERVAL '17 hours', NOW() + INTERVAL '1 day' + INTERVAL '19 hours');
-- Add equipment to this one
INSERT INTO booking_details (booking_id, equipment_id, quantity) VALUES ((SELECT booking_id FROM bookings WHERE status='PENDING_PAYMENT' LIMIT 1), 3, 1);

-- 5. Rejected Booking (Student 3)
INSERT INTO bookings (user_id, facility_id, purpose, booking_type, status, check_in_time, check_out_time, cancellation_reason, cancelled_at) 
VALUES (3, 3, $$Gaming Night$$, 'PERSONAL', 'REJECTED', NOW() + INTERVAL '1 week', NOW() + INTERVAL '1 week' + INTERVAL '4 hours', $$Lab is for academic purposes only.$$, NOW());

-- 6. Recurring Bookings Pattern (Weekly Meeting for 1 month)
-- Group Header
INSERT INTO booking_groups (user_id, facility_id, recurrence_pattern, status, total_amount)
VALUES (5, 5, 'WEEKLY', 'CONFIRMED', 0);

-- Individual Bookings linked to group
INSERT INTO bookings (user_id, facility_id, purpose, booking_type, status, check_in_time, check_out_time, group_id) 
VALUES 
(5, 5, $$Weekly Department Meeting (Week 1)$$, 'EVENT', 'CONFIRMED', NOW() + INTERVAL '7 days' + INTERVAL '8 hours', NOW() + INTERVAL '7 days' + INTERVAL '10 hours', (SELECT max(group_id) FROM booking_groups)),
(5, 5, $$Weekly Department Meeting (Week 2)$$, 'EVENT', 'CONFIRMED', NOW() + INTERVAL '14 days' + INTERVAL '8 hours', NOW() + INTERVAL '14 days' + INTERVAL '10 hours', (SELECT max(group_id) FROM booking_groups)),
(5, 5, $$Weekly Department Meeting (Week 3)$$, 'EVENT', 'CONFIRMED', NOW() + INTERVAL '21 days' + INTERVAL '8 hours', NOW() + INTERVAL '21 days' + INTERVAL '10 hours', (SELECT max(group_id) FROM booking_groups));

-- Update Group Total (approximate logic for seed, in app trigger handles individual updates)
UPDATE booking_groups SET total_amount = (SELECT SUM(total_amount) FROM bookings WHERE group_id = (SELECT max(group_id) FROM booking_groups)) WHERE group_id = (SELECT max(group_id) FROM booking_groups);
