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

-- 6. SEED DATA (Simplified Dataset)

-- Seed Users
INSERT INTO users (sso_id, full_name, email, role, department) VALUES
('20110456', 'Nguyen Van Sinh Vien', 'student@university.edu.vn', 'STUDENT', 'Computer Science'),
('MANAGER001', 'Pham Van Quan Ly CSVC', 'manager@university.edu.vn', 'FACILITY_MANAGER', 'Facility Operation');

-- Seed Facilities (4 Facilities, 1 of each type)
INSERT INTO facilities (name, location, type, capacity, image_url, price, price_type, min_cancellation_hours, manager_id) VALUES
('Grand Hall A1', 'Block A, Floor 1', 'HALL', 500, 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&q=80', 500000, 'PER_HOUR', 24, 2),
('Interactive Classroom C202', 'Block C, Floor 2', 'CLASSROOM', 60, 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&q=80', 100000, 'PER_HOUR', 2, 2),
('AI Research Lab', 'Block B, Floor 3', 'LAB', 40, 'https://images.unsplash.com/photo-1596495578065-6e0763fa1178?w=800&q=80', 2000000, 'PER_BOOKING', 12, 2),
('Main Soccer Field', 'Sports Complex Zone', 'OUTDOOR', 22, 'https://images.unsplash.com/photo-1626245652674-8d49f697412e?w=800&q=80', 0, 'ONE_TIME', 1, 2);

-- Seed Equipments (2-3 items per facility)
INSERT INTO equipments (facility_id, name, total_quantity, available_quantity, rental_price) VALUES
(1, 'Projector Sony 4K', 2, 2, 100000),
(1, 'Wireless Mic Set', 4, 4, 50000),
(2, 'Smart Board', 1, 1, 0),
(2, 'Speaker System', 1, 1, 20000),
(2, 'Whiteboard Markers', 10, 10, 5000),
(3, 'High-Performance GPU Server', 5, 5, 0),
(3, 'VR Headset', 5, 5, 50000),
(4, 'Soccer Ball Set', 2, 2, 10000),
(4, 'Goal Net', 2, 2, 0);

-- Seed Bookings
-- 1. Completed Past Booking (Student)
INSERT INTO bookings (user_id, facility_id, purpose, booking_type, status, check_in_time, check_out_time, total_amount) 
VALUES (1, 2, $$Group Study Session$$, 'PERSONAL', 'COMPLETED', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' + INTERVAL '2 hours', 200000);

-- 2. Pending Booking (Student)
INSERT INTO bookings (user_id, facility_id, purpose, booking_type, status, check_in_time, check_out_time) 
VALUES (1, 4, $$Football Friendlies$$, 'EVENT', 'PENDING', NOW() + INTERVAL '3 days' + INTERVAL '14 hours', NOW() + INTERVAL '3 days' + INTERVAL '16 hours');

-- 3. Confirmed Future Booking (Student)
INSERT INTO bookings (user_id, facility_id, purpose, booking_type, status, check_in_time, check_out_time, total_amount) 
VALUES (1, 1, $$Class Performance Practice$$, 'ACADEMIC', 'CONFIRMED', NOW() + INTERVAL '2 days' + INTERVAL '9 hours', NOW() + INTERVAL '2 days' + INTERVAL '12 hours', 1500000);

