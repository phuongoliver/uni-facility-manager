# Uni Facility Manager

Project quản lý cơ sở vật chất trường đại học (University Facility Manager). Hệ thống giúp sinh viên và cán bộ quản lý, đặt lịch, và theo dõi việc sử dụng các phòng học, phòng thí nghiệm và thiết bị.

## Tech Stack

Dự án được xây dựng dựa trên kiến trúc Client-Server hiện đại, tách biệt rõ ràng giữa Frontend và Backend.

### Frontend
- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Components**: [Radix UI](https://www.radix-ui.com/) (Headless UI components)
- **Form Handling**: React Hook Form + Zod (Validation)
- **Icons**: Lucide React

### Backend
- **Framework**: [NestJS](https://nestjs.com/)
- **Language**: TypeScript
- **Database ORM**: TypeORM
- **Database System**: PostgreSQL
- **Architecture**: Modular Monolith/Layered Architecture (Modules, Controllers, Services, DTOs)

### Infrastructure & DevOps
- **Containerization**: Docker
- **Orchestration**: Docker Compose
- **Database**: PostgreSQL 16 Alpine Image

## Architecture Design

Hệ thống hoạt động theo mô hình 3 lớp (3-tier architecture):

1.  **Presentation Layer (Frontend)**: 
    - Chạy trên Next.js Server (Port 3000 trong container, Mapping ra 3001 máy host).
    - Giao tiếp với Backend thông qua RESTful API.
    - Xử lý giao diện người dùng, form validation và trạng thái ứng dụng.

2.  **Application Layer (Backend)**: 
    - Chạy trên NestJS (Port 3000).
    - Xử lý logic nghiệp vụ, xác thực (Authentication), phân quyền (Authorization).
    - Expose các API endpoint cho Frontend tiêu thụ.

3.  **Data Layer (Database)**: 
    - PostgreSQL Database (Port 5432).
    - Lưu trữ thông tin người dùng, cơ sở vật chất, lịch đặt mượn.
    - Dữ liệu được khởi tạo tự động (seed) thông qua script SQL trong thư mục `database/` khi khởi chạy container lần đầu.

## Hướng dẫn cài đặt và chạy (Development)

### Cách 1: Chạy bằng Docker (Khuyên dùng)

Đây là cách nhanh nhất để dựng toàn bộ hệ thống bao gồm Database, Backend và Frontend mà không cần cài đặt môi trường phức tạp.

**Yêu cầu:** Đã cài đặt [Docker](https://www.docker.com/) và Docker Compose.

1.  **Build và khởi chạy container:**
    ```bash
    docker-compose up -d --build
    ```

2.  **Truy cập ứng dụng:**
    - **Frontend**: [http://localhost:3001](http://localhost:3001)
    - **Backend API**: [http://localhost:3000](http://localhost:3000)
    - **Database**: Port `5432` (User: `admin`, Pass: `StrongPassword123!`, DB: `uni_facility_db`)

3.  **Dừng hệ thống:**
    ```bash
    docker-compose down
    ```

### Cách 2: Chạy thủ công (Local Environment)

Sử dụng cách này nếu bạn muốn phát triển code và chạy từng service riêng biệt trên máy host.

**Yêu cầu:** Node.js (v20+), npm, và PostgreSQL server đang chạy (hoặc dùng Docker chỉ cho container database).

#### 1. Setup Database
Nếu bạn không cài PostgreSQL local, bạn có thể chỉ chạy service database bằng Docker:
```bash
docker-compose up -d database
```
*Lưu ý: Đảm bảo database đã có sẵn hoặc import data từ `database/` nếu cần thiết.*

#### 2. Chạy Backend
Mở terminal tại thư mục gốc và di chuyển vào `backend`:

```bash
cd backend

# Cài đặt dependencies
npm install

# (Tạo file .env nếu cần thiết, mặc định NestJS module config đang hardcode hoặc đọc env hệ thống)

# Chạy server ở chế độ watch (development)
npm run start:dev
```
Backend sẽ chạy tại `http://localhost:3000`.

#### 3. Chạy Frontend
Mở một terminal mới và di chuyển vào `frontend`:

```bash
cd frontend

# Cài đặt dependencies
npm install

# Chạy Next.js dev server
npm run dev
```
Mặc định Next.js sẽ cũng thử chạy port 3000. Nếu Backend đang chiếm port 3000, Next.js thường sẽ tự động chuyển sang port 3001. Hãy kiểm tra terminal để biết port chính xác (thường là `http://localhost:3001`).

## Cấu trúc thư mục

```text
uni-facility-manager/
├── backend/                # Source code NestJS Backend
│   ├── src/
│   │   ├── modules/        # Các module nghiệp vụ (Users, Auth, Facilities...)
│   │   └── ...
│   ├── Dockerfile
│   └── ...
├── frontend/               # Source code Next.js Frontend
│   ├── src/
│   │   ├── app/            # App Router pages
│   │   ├── components/     # UI Components
│   │   └── ...
│   ├── Dockerfile
│   └── ...
├── database/               # SQL scripts khởi tạo database (seed data)
├── docker-compose.yml      # File cấu hình Docker Services
└── README.md               # Tài liệu hướng dẫn
```
