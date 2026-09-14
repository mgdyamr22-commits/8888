# Almakhzoun Inventory Pro — Migration API Map
**System:** نظام المخزون الاحترافي للسيارات (Almakhzoun Inventory Pro)  
**Target:** Central MySQL Cloud Backend API Specifications  

---

## 1. Overview
All client-side components now communicate with an Express REST API backend connected to a central MySQL database. Every operation is authenticated, validated, and recorded in audit logs.

---

## 2. API Endpoints Catalog

### 2.1 System Installation & Health (`/api/install`, `/api/health`)
* `GET /api/install/status` — Checks installation state (`is_installed: boolean`, system diagnostics, database connection status).
* `POST /api/install/test-db` — Tests credentials for MySQL host, port, user, password, and database.
* `POST /api/install/execute` — Automatically runs all idempotent SQL migrations, sets up database schema, creates the super admin user, configures initial organization settings, creates storage directories, writes `.env` / lock state, and returns token.
* `GET /api/health` — Returns status of API, MySQL database pool, file storage permissions, and server time.

### 2.2 Authentication & Access Control (`/api/auth`)
* `POST /api/auth/login` — Verifies username and bcrypt-hashed password, checks brute-force lockout, registers session, logs audit trail.
* `POST /api/auth/logout` — Revokes session.
* `POST /api/auth/verify-questions` — Verifies 3-factor security questions for password recovery.
* `POST /api/auth/verify-recovery-code` — Verifies AFS cryptographic recovery code.
* `POST /api/auth/verify-recovery-file` — Validates recovery.key cryptographic file.
* `POST /api/auth/admin-reset-password` — Allows privileged admin to reset user password.
* `POST /api/auth/request-reset` — Generates and emails 6-digit OTP code.
* `POST /api/auth/verify-otp` — Validates OTP code and completes password reset.
* `POST /api/auth/register-device` — Enrolls trusted hardware device fingerprint.

### 2.3 Cars & Inventory Engine (`/api/cars`)
* `GET /api/cars` — Retrieves vehicle inventory with filters (branch, status, brand, model, search query, dates).
* `POST /api/cars` — Inserts new vehicle, creates custom fields, generates entry movement record and audit log.
* `GET /api/cars/:id` — Gets full vehicle details, exit permit data, history timeline, and attachments.
* `PUT /api/cars/:id` — Updates vehicle specifications, notes, plate info, or pricing.
* `DELETE /api/cars/:id` — Deletes vehicle (requires admin permission and password verification; logs audit trail).
* `POST /api/cars/:id/reserve` — **Atomic Transaction:** Checks availability and reserves vehicle with row lock; records delegate and customer details.
* `POST /api/cars/:id/cancel-reservation` — Cancels active reservation and restores vehicle to available stock.
* `POST /api/cars/bulk-import` — Imports multi-row Excel dataset with validation.
* `GET /api/cars/export` — Streams or returns structured export dataset formatted for Arabic Excel (RTL).

### 2.4 Sales & Exit Operations (`/api/sales`)
* `GET /api/sales` — Retrieves completed sales history with financials and exit data.
* `POST /api/sales` — **Atomic Transaction:** Updates vehicle status to sold, creates sales record, records payment and exit clearance, creates movement entry.
* `PUT /api/sales/:id` — Updates sale and exit details.
* `POST /api/sales/:id/return-to-stock` — Cancels sale, voids exit permit, and returns vehicle to showroom stock.

### 2.5 Transfers & Logistics (`/api/transfers`)
* `GET /api/transfers` — Lists all inbound and outbound transfer orders.
* `POST /api/transfers` — Creates outbound transfer document, flags vehicles as `قيد التحويل`, and records sender.
* `POST /api/transfers/:id/receive` — **Atomic Transaction:** Confirms receipt at destination branch, updates vehicles branch and physical status.

### 2.6 Customers & Contacts (`/api/customers`)
* `GET /api/customers` — Retrieves customer and receiver directory.
* `POST /api/customers` — Adds customer profile.
* `PUT /api/customers/:id` — Edits customer details.
* `DELETE /api/customers/:id` — Deletes customer.
* `GET /api/customers/lookup` — Auto-lookup by national ID or phone number.
* `POST /api/customers/bulk-import` — Excel import for customer lists.

### 2.7 Financials & Costs (`/api/costs`)
* `GET /api/costs` — Lists vehicle purchase and expense records.
* `POST /api/costs` — Records new expense breakdown.
* `PUT /api/costs/:id` — Edits expense entry.
* `DELETE /api/costs/:id` — Removes or archives cost record.

### 2.8 Official Letters Archive (`/api/letters`)
* `GET /api/letters` — Fetches generated official letters (carrier, checkpoint, withdrawal).
* `POST /api/letters` — Stores generated letter with HTML content for re-printing.
* `DELETE /api/letters/:id` — Deletes archived letter.

### 2.9 Reports & Analytics (`/api/reports`)
* `GET /api/reports/inventory` — Generates aggregated inventory report by brand, category, and status.
* `GET /api/reports/movements` — Daily entry/exit movements report.
* `GET /api/reports/sales` — Sales performance and profit analysis.
* `GET /api/reports/delegates` — Representative KPIs and performance.

### 2.10 User & Organization Administration (`/api/users`, `/api/settings`)
* `GET /api/users` — Lists system users, roles, and assigned permissions.
* `POST /api/users` — Creates user with hashed password and permissions.
* `PUT /api/users/:id` — Updates user profile, role, and branch assignment.
* `DELETE /api/users/:id` — Deactivates or removes user.
* `GET /api/settings/organization` — Retrieves organization branding, tax number, CR, logo, stamp, and print rules.
* `PUT /api/settings/organization` — Updates organization settings.
* `GET /api/settings/user-layout` — Loads user-customized table column order and visibility.
* `PUT /api/settings/user-layout` — Saves user column preferences.

### 2.11 Storage & File Uploads (`/api/files`)
* `POST /api/files/upload` — Uploads vehicle photos, customs cards, or attachments to server storage.
* `GET /api/files/:filename` — Serves stored documents securely.

### 2.12 Centralized Backup & Disaster Recovery (`/api/backups`)
* `POST /api/backups/export` — Generates a full system snapshot (SQL + JSON + attachments) for download.
* `POST /api/backups/restore` — Ingests and validates a backup package, applying it inside an atomic transaction.
