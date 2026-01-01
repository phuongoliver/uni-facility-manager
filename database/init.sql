-- 1. CLEANUP & SETUP
-- Xóa schema cũ nếu tồn tại để tránh conflict khi chạy lại
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Cấu hình múi giờ (quan trọng cho booking)
SET timezone = 'Asia/Ho_Chi_Minh';

-- 2. ENUM DEFINITIONS
-- Sử dụng ENUM để đảm bảo Data Integrity (chỉ chấp nhận các giá trị hợp lệ)
CREATE TYPE user_role AS ENUM ('STUDENT', 'LECTURER', 'ADMIN');
CREATE TYPE facility_type AS ENUM ('CLASSROOM', 'HALL', 'LAB');
CREATE TYPE booking_type AS ENUM ('ACADEMIC', 'EVENT', 'PERSONAL');
CREATE TYPE booking_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED');
CREATE TYPE equipment_status AS ENUM ('GOOD', 'BROKEN', 'MAINTENANCE');
CREATE TYPE transaction_type AS ENUM ('DEPOSIT', 'RENTAL_FEE', 'FINE');
CREATE TYPE payment_method AS ENUM ('MOMO', 'BANKING', 'CASH');
CREATE TYPE transaction_status AS ENUM ('PENDING', 'PAID', 'REFUNDED');

-- 3. TABLES CREATION

-- Table: Users
CREATE TABLE users (
    user_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sso_id VARCHAR(50) UNIQUE NOT NULL,
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
    -- Master Data Price
    price_per_hour DECIMAL(15, 2) DEFAULT 0 CHECK (price_per_hour >= 0)
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT chk_time_valid CHECK (check_out_time > check_in_time),
    
    -- Không cho phép cùng Facility ID mà khoảng thời gian (Time Range) đè lên nhau (Overlaps &&)
    -- Chỉ áp dụng khi booking chưa bị hủy hoặc từ chối
    CONSTRAINT no_double_booking EXCLUDE USING GIST (
        facility_id WITH =,
        tstzrange(check_in_time, check_out_time) WITH &&
    ) WHERE (status NOT IN ('CANCELLED', 'REJECTED'))
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


-- B. Function: Tính toán tổng tiền (Core Logic)
CREATE OR REPLACE FUNCTION calculate_total_amount()
RETURNS TRIGGER AS $$
DECLARE
    v_booking_id INT;
    v_facility_price DECIMAL(15, 2);
    v_equipment_total DECIMAL(15, 2);
    v_hours NUMERIC;
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

    -- Các logic tính toán giữ nguyên...
    -- 1. Tính tiền phòng
    SELECT 
        f.price_per_hour,
        EXTRACT(EPOCH FROM (b.check_out_time - b.check_in_time)) / 3600
    INTO v_facility_price, v_hours
    FROM bookings b
    JOIN facilities f ON b.facility_id = f.facility_id
    WHERE b.booking_id = v_booking_id;

    -- 2. Tính tổng tiền thiết bị
    SELECT COALESCE(SUM(quantity * booked_price), 0)
    INTO v_equipment_total
    FROM booking_details
    WHERE booking_id = v_booking_id;

    -- 3. Update ngược lại vào Booking
    UPDATE bookings
    SET total_amount = (v_facility_price * v_hours) + v_equipment_total
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

-- 6. SEED DATA (Dữ liệu mẫu chuyên nghiệp)

-- Seed Users
INSERT INTO users (sso_id, full_name, email, role, department) VALUES
('20110456', 'Nguyen Van A', 'nguyenvana@university.edu.vn', 'STUDENT', 'Computer Science'),
('T00123', 'Dr. Le Thi B', 'lethib@university.edu.vn', 'LECTURER', 'Software Engineering'),
('ADM001', 'Tran Quan Ly', 'admin@university.edu.vn', 'ADMIN', 'Facility Department');

-- Seed Facilities
INSERT INTO facilities (name, location, type, capacity, price_per_hour) VALUES
('Hall A1', 'Block A, Floor 1', 'HALL', 200, 500000), -- 500k/giờ
('Lab Network', 'Block B, Floor 3', 'LAB', 40, 200000),   -- 200k/giờ
('Room C202', 'Block C, Floor 2', 'CLASSROOM', 60, 100000); -- 100k/giờ

-- Seed Equipments
INSERT INTO equipments (facility_id, name, total_quantity, available_quantity, rental_price) VALUES
(1, 'Projector Sony 4K', 2, 2, 50000),   -- Cố định tại Hall A1, 50k/cái
(NULL, 'Portable Speaker JBL', 5, 5, 30000), -- Kho lưu động, 30k/cái
(2, 'Cisco Router Kit', 20, 20, 0);          -- Tại Lab Network, miễn phí

-- Seed Booking (Kịch bản: Book Hall A1 trong 2 tiếng + mượn thêm 2 loa)
-- Bước 1: Insert Booking Header
INSERT INTO bookings (user_id, facility_id, purpose, booking_type, check_in_time, check_out_time) 
VALUES (1, 1, 'Club Meeting', 'EVENT', NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 2 hours');
-- Lúc này Trigger `trg_update_total_on_booking_change` chạy, Total = 500k * 2h = 1,000,000

-- Bước 2: Insert Booking Detail (Mượn 2 loa)
INSERT INTO booking_details (booking_id, equipment_id, quantity) VALUES
(1, 2, 2); 
-- Trigger `trg_snapshot_price_before_insert` chạy: booked_price = 30,000
-- Trigger `trg_update_total_on_detail_change` chạy: 
-- Total cũ (1tr) + (2 loa * 30k) = 1,060,000 VND