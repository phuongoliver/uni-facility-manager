# Uni Facility Manager

A comprehensive University Facility Management System. This platform empowers students and staff to seamlessly schedule, approve, and track the usage of classrooms, laboratories, and university equipment.

## 🚀 Key Features

*   **Smart Booking:** Real-time reservation of classrooms, labs, and facilities.
*   **Equipment Management:** Borrow and return equipment either independently or attached to facility bookings.
*   **Approval Workflow:** Automated workflow for request processing (Student -> Admin/Manager approval).
*   **Payments:** Integrated payment processing for paid services and facilities.
*   **Authentication:** Multi-method login support (Local, SSO/OAuth2).
*   **Schedule & Tracking:** Visual calendar views with robust conflict detection (Overbooking protection).

## 🛠 Tech Stack

Built on a modern **Modular Monolith** architecture, ensuring scalability and maintainability.

| Area | Technology |
| :--- | :--- |
| **Frontend** | [Next.js 16](https://nextjs.org/), TypeScript, Tailwind CSS, Shadcn/UI |
| **Backend** | [NestJS](https://nestjs.com/), TypeScript, TypeORM, Passport.js |
| **Database** | PostgreSQL 16 (with GIST indexing for range queries) |
| **DevOps** | Docker, Docker Compose |

## ⚙️ Installation & Running

### Prerequisites
*   [Docker Desktop](https://www.docker.com/products/docker-desktop)
*   [Node.js](https://nodejs.org/) v20+ (Only for local development)

### Method 1: Using Docker (Recommended)

Deploy the entire stack (Frontend, Backend, Database) with a single command:

```bash
docker-compose up -d --build
```

Once running successfully:
*   **Frontend Dashboard:** [http://localhost:3001](http://localhost:3001)
*   **Backend API:** [http://localhost:3500](http://localhost:3500)
*   **Database:** Port `5432`

### Method 2: Manual Local Development

<details>
<summary>View detailed local setup instructions</summary>

1.  **Initialize Database:**
    If you don't have a local PostgreSQL instance, run the database container:
    ```bash
    docker-compose up -d database
    ```

2.  **Start Backend (NestJS):**
    ```bash
    cd backend
    npm install
    npm run start:dev
    ```
    Backend will listen on `http://localhost:3500`.

3.  **Start Frontend (Next.js):**
    ```bash
    cd frontend
    npm install
    npm run dev
    ```
    App will be accessible at `http://localhost:3001`.
</details>

## 📂 Project Structure

```text
uni-facility-manager/
├── backend/                # NestJS Backend source code
│   ├── src/modules/        # Business Modules (Users, Auth, Facilities...)
│   └── ...
├── frontend/               # Next.js Frontend source code
│   ├── src/app/            # App Router pages
│   └── ...
├── database/               # SQL scripts for DB initialization (seed data)
└── docker-compose.yml      # Docker Services configuration
```
