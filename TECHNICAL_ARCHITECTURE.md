# Technical Architecture Document
Project: **University Facility Manager**

## 1. Architectural Pattern: Modular Monolith

The project is built upon the **Modular Monolith** architecture. Instead of splitting into Microservices from the start (which introduces infrastructure and deployment complexity) or creating a chaotic Monolith (Spaghetti code), Modular Monolith organizes source code into independent modules centered around specific *Domain Businesses*.

### Why Modular Monolith?
*   **High Cohesion, Low Coupling**: Related logic is grouped within a single module.
*   **Typical Example - Separating Booking and Payment**:
    *   The `Booking` module is solely responsible for reservations, availability checks, and booking status management.
    *   The `Payment` module handles financial transactions and payment gateway integration.
    *   **Benefit**: When payment logic changes or a Payment Gateway is switched, the `Booking` module remains completely unaffected. It ensures easier maintenance, debugging (fault isolation), and allows for splitting into separate Microservices in the future if scaling is required.

---

## 2. Database: PostgreSQL

PostgreSQL was chosen for its robustness, ACID compliance, and support for advanced features (Triggers, Stored Procedures, Advanced Indexing) which ensure data integrity logic is enforced effectively at the DB layer.

### Query Optimization (Performance & Indexing)
Indexing in this project is not arbitrary but focused on query "hotspots":
*   **Composite Index `(check_in_time, check_out_time)`**: This is the most critical index. Every operation involving availability checks or conflict detection must scan this time range. The index prevents the Database from performing a full table scan.
*   **Foreign Key Index `(user_id, facility_id)`**: Optimizes `JOIN` operations when retrieving user booking history or a facility's booking list.
*   **Status Index**: Ensures that filtering by status (PENDING, CONFIRMED...) on the management Dashboard is instantaneous.

---

## 3. System Integration

The system communicates with the external world and the frontend via modern standard protocols:

*   **RESTful API**: The primary protocol for Frontend (Next.js) to Backend (NestJS) communication. The API is designed in a Resource-oriented manner (e.g., `POST /api/bookings`, `GET /api/facilities`).
*   **SSO - Single Sign-On (OAuth2)**:
    *   Integrates centralized authentication simulating a university system.
    *   Uses the OAuth2 Authorization Code Flow for security, ensuring user passwords are not stored in the application DB.
*   **Webhooks**:
    *   Designed handling **Asynchronous Payments**. Example: When a user pays via E-wallet/Banking, the payment gateway calls back (webhook) to the system to update the order status without requiring the user to maintain an active connection.

---

## 4. Implementation Techniques

The project employs classic Design Patterns to enhance flexibility and extensibility:

### A. Strategy Pattern
*   **Application**: Authentication Module.
*   **Purpose**: The system can support multiple login methods (Local User, Google OAuth, University SSO) without modifying the core `AuthService` logic (`Open-Closed Principle`). We simply switch to the corresponding "Strategy".

### B. Factory Pattern
*   **Application**: Booking initialization logic or data processing from various sources.
*   **Purpose**: Encapsulates the complexity of creating complex Booking objects (which may include Equipment, Recurrence/Repetition).

### C. Observer Pattern (Event-Driven)
*   **Application**: Notification System.
*   **Purpose**: When a Booking is successfully created (`BookingCreated`), the Service emits an Event. The Notification Module "listens" to this event to send emails/notifications.
*   **Benefit**: The Booking Module does not need to know about the existence of the Email Service. To add an "SMS Sending" function later, simply add a new Listener without modifying old code.

---

## 5. Solving Overbooking (Concurrency Control)

One of the hardest problems in booking systems is the **Race Condition**: Two students hitting the "Book" button at the exact same moment for the same room.

### Solution: Database Locking & Constraints
Instead of relying solely on application-layer checks (which are unreliable when running multiple instances), the project applies protection layers at the Database level:

1.  **Pessimistic Locking (FOR UPDATE)**: (Optionally applied in Code) When a booking transaction starts, the Facility row or Time Slot is locked. Other transactions must wait.
2.  **PostgreSQL EXCLUDE Constraint (Primary Solution)**:
    *   Utilizes PostgreSQL's `EXCLUDE USING GIST`.
    *   Definition: *"Do not allow 2 rows with the same `facility_id` where the time range `[check_in, check_out]` overlaps (&&)"*.
    *   This is the final and strongest line of defense. If logic errors slip through the code, the Database will throw an error immediately, ensuring absolute Data Integrity.

---

## 6. Tech Stack Overview

*   **Frontend**: Next.js 15 (App Router), TailwindCSS, Shadcn/UI, Lucide React.
*   **Backend**: NestJS (Node.js framework), TypeORM.
*   **Containerization**: Docker & Docker Compose (Ensures consistent dev/prod environments).
*   **Validation**: Zod (Frontend), Class-Validator (Backend DTO).
