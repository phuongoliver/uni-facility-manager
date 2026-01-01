-- 1. Nâng cấp ENUM facility_type (Thêm giá trị OUTDOOR)
-- Chạy trong block DO để tránh lỗi nếu đã tồn tại
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid  
                   WHERE t.typname = 'facility_type' AND e.enumlabel = 'OUTDOOR') THEN
        ALTER TYPE facility_type ADD VALUE 'OUTDOOR';
    END IF;
END$$;

-- 2. Insert Users (Managers)
-- Tạo 3 user: 1 Admin, 1 Manager sân bãi (Sports), 1 Manager phòng Lab (Technical)
INSERT INTO users (sso_id, full_name, email, role, department, status)
VALUES 
    -- Admin System
    ('ADM_SYS_02', 'System Administrator', 'sysadmin@uni.edu.vn', 'ADMIN', 'Facility Dept', 'ACTIVE'),
    -- Outdoor Manager (Role ADMIN để có quyền cao nhất với sân bãi, hoặc LECTURER tùy policy)
    ('MGR_SPORT', 'Nguyen Van The Thao', 'manager.sport@uni.edu.vn', 'ADMIN', 'Sports Center', 'ACTIVE'), 
    -- Lab Manager
    ('MGR_TECH', 'Tran Thi Ky Thuat', 'manager.lab@uni.edu.vn', 'LECTURER', 'Computer Science Faculty', 'ACTIVE')
ON CONFLICT (sso_id) DO NOTHING;

-- 3. Insert Facilities
-- Sử dụng CTE để lấy ID của user vừa tạo (hoặc đã có)
WITH 
    mgr_sport AS (SELECT user_id FROM users WHERE sso_id = 'MGR_SPORT'),
    mgr_tech AS (SELECT user_id FROM users WHERE sso_id = 'MGR_TECH'),
    adm_sys AS (SELECT user_id FROM users WHERE sso_id = 'ADM_SYS_02')

INSERT INTO facilities (name, location, type, capacity, image_url, price_per_hour, status, manager_id)
VALUES
    -- == OUTDOOR (Quản lý bởi MGR_SPORT) ==
    ('Sân bóng đá Mini A', 'Khu thể thao phía Tây', 'OUTDOOR', 22, 'https://picsum.photos/seed/soccer/800/600', 300000, 'AVAILABLE', (SELECT user_id FROM mgr_sport)),
    ('Sân bóng đá Mini B', 'Khu thể thao phía Tây', 'OUTDOOR', 22, 'https://picsum.photos/seed/soccer2/800/600', 300000, 'AVAILABLE', (SELECT user_id FROM mgr_sport)),
    ('Sân cầu lông C1', 'Nhà thi đấu đa năng', 'OUTDOOR', 4, 'https://picsum.photos/seed/badminton/800/600', 50000, 'AVAILABLE', (SELECT user_id FROM mgr_sport)),
    ('Hồ bơi Sinh viên', 'Khu Aquatic Center', 'OUTDOOR', 50, 'https://picsum.photos/seed/pool/800/600', 20000, 'AVAILABLE', (SELECT user_id FROM mgr_sport)),

    -- == LAB/CLASSROOM (Quản lý bởi MGR_TECH) ==
    ('Lab Máy tính H6', 'Tòa H, Tầng 6', 'LAB', 40, 'https://picsum.photos/seed/lab1/800/600', 150000, 'AVAILABLE', (SELECT user_id FROM mgr_tech)),
    ('Phòng thực hành IoT', 'Tòa I, Tầng 2', 'LAB', 25, 'https://picsum.photos/seed/iot/800/600', 200000, 'AVAILABLE', (SELECT user_id FROM mgr_tech)),
    ('AI Research Hub', 'Tòa Công nghệ cao', 'LAB', 15, 'https://picsum.photos/seed/ai/800/600', 500000, 'AVAILABLE', (SELECT user_id FROM mgr_tech)),

    -- == COMMON CLASSROOMS (Quản lý bởi Admin) ==
    ('Phòng học A101', 'Tòa A, Tầng 1', 'CLASSROOM', 60, 'https://picsum.photos/seed/class1/800/600', 0, 'AVAILABLE', (SELECT user_id FROM adm_sys)), -- Free
    ('Giảng đường Lớn Hall B', 'Tòa B', 'HALL', 300, 'https://picsum.photos/seed/hall/800/600', 1000000, 'AVAILABLE', (SELECT user_id FROM adm_sys)),
    ('Phòng Seminar Thư viện', 'Thư viện trung tâm', 'CLASSROOM', 20, 'https://picsum.photos/seed/seminar/800/600', 50000, 'AVAILABLE', (SELECT user_id FROM adm_sys));

-- 4. Test Query
-- Lấy danh sách Facility kèm tên User quản lý để kiểm tra quan hệ
SELECT 
    f.facility_id,
    f.name AS facility_name,
    f.type AS facility_type,
    f.capacity,
    f.price_per_hour,
    f.status,
    u.full_name AS manager_name,
    u.email AS manager_email,
    u.role AS manager_role
FROM facilities f
LEFT JOIN users u ON f.manager_id = u.user_id
ORDER BY f.type, f.name;
