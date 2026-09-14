# Almakhzoun Inventory Pro — PHP API Migration Design Document
**System:** نظام المخزون الاحترافي للسيارات (Almakhzoun Inventory Pro)  
**Target Environment:** Native PHP 8.0+ / PDO / MySQL / Apache / cPanel / Shared Hosting  
**Document Code:** `MIGRATION_PHP_API_MAP.md`  
**Status:** Completed & Production Ready  

---

## 1. Executive Summary & Architecture Transition

This document defines the 1-to-1 mapping and architectural design replacing the former Node.js/Express runtime with a pure, standalone **PHP 8.0+ & MySQL** backend. 

### Key Architectural Tenets:
- **Zero Node.js Dependency in Production:** The production app runs entirely on standard Apache/Nginx web servers with PHP 8.0+ and MySQL (such as cPanel, Plesk, Hostinger, GoDaddy, or VPS), requiring no persistent Node background daemon.
- **Unified Front-Controller Architecture:** All `/api/*` HTTP requests are intercepted by Apache `.htaccess` (or Nginx rewrite rules) and passed to `/api/index.php`, which dispatches requests using PSR-4 autoloader to specific domain controllers.
- **Stateless JWT + RBAC Security:** Uses HMAC-SHA256 cryptographic tokens passed via `Authorization: Bearer <token>`, with brute-force throttling and full database-persisted audit logging.
- **ACID Transactional Integrity:** Critical operations (sales, vehicle checkout, transfers, inventory deduction) run within atomic PDO transactions (`Database::transaction(...)`) with `SELECT ... FOR UPDATE` row locks.

---

## 2. Directory Structure & File Hierarchy

```
├── .htaccess                         # Root Apache rewrite (SPA fallback + API routing)
├── api/
│   ├── .htaccess                     # API rewrite rule to index.php
│   ├── index.php                     # Central API router & dispatcher
│   ├── helpers.php                   # Autoloader, CORS, JSON envelopes, Auth checks
│   ├── health.php                    # System & database health probe
│   ├── install/
│   │   ├── status.php                # System installation status probe
│   │   ├── requirements.php          # PHP extensions & folder permissions check
│   │   ├── test-db.php               # Database connection validator
│   │   ├── migrate.php               # Idempotent database schema migration runner
│   │   ├── create-admin.php          # Initial super admin creation
│   │   ├── finalize.php              # Tenant & initial settings persistence
│   │   └── execute.php               # One-click all-in-one automated installer
│   ├── auth/
│   │   ├── login.php                 # Authentication & JWT issuance
│   │   ├── logout.php                # Session termination & audit log
│   │   ├── me.php                    # Current user profile & permission matrix
│   │   ├── users.php                 # User CRUD & role/permission assignment
│   │   ├── verify-password.php       # Password verification for sensitive actions
│   │   ├── verify-otp.php            # OTP recovery verification
│   │   ├── resend-otp.php            # OTP generation & dispatch
│   │   └── reset-password.php        # Password override/update
│   ├── cars/
│   │   ├── index.php                 # List vehicles (filtered) / Create vehicle
│   │   ├── detail.php                # Single vehicle GET / PUT / DELETE
│   │   └── exit.php                  # Delivery permit & exit authorization
│   ├── sales/
│   │   ├── index.php                 # Sales history / Atomic sale creation
│   │   └── detail.php                # Sale details / Return to showroom stock
│   ├── transfers/
│   │   ├── index.php                 # List transfers / Create outbound order
│   │   └── receive.php               # Acknowledge receipt into destination branch
│   ├── customers/
│   │   └── index.php                 # Customers & Sales delegates CRUD
│   ├── costs/
│   │   └── index.php                 # Customs, shipping & purchase cost accounting
│   ├── letters/
│   │   └── index.php                 # Official letters generator & archive
│   ├── reports/
│   │   └── index.php                 # Aggregated analytics (Inventory, Movements, Profit)
│   ├── settings/
│   │   ├── index.php                 # Tenant profile, CR, tax, stamp & logo
│   │   └── branches.php              # Multi-branch directory management
│   ├── files/
│   │   ├── upload.php                # File attachment processor (PDF, Images, Cards)
│   │   └── download.php              # Secured file delivery
│   └── backups/
│       └── index.php                 # Database snapshot generator & restore
├── config/
│   ├── DatabaseConfig.php            # Database configuration reader / writer
│   ├── paths.php                     # Path resolver & directory creator
│   └── security.php                  # Password hashing, JWT engine, CORS headers
├── database/
│   ├── Database.php                  # PDO singleton & transaction wrapper
│   ├── MigrationRunner.php           # Database migration runner
│   └── migrations/                   # SQL incremental schema files
│       ├── 001_create_tenants_and_branches.sql
│       ├── 002_create_users_and_security.sql
│       ├── 003_create_cars_and_inventory.sql
│       ├── 004_create_sales_transfers_customers.sql
│       └── 005_create_financials_letters_settings.sql
└── storage/
    ├── uploads/                      # Uploaded customs cards, images, attachments
    ├── documents/                    # Generated letters & PDF receipts
    ├── backups/                      # JSON / SQL automated snapshots
    └── logs/                         # Error and audit logs
```

---

## 3. Comprehensive 1-to-1 Endpoint Mapping

### 3.1 Installation & System Health

| Endpoint | Method | PHP Target File | Description | Auth Required |
| :--- | :--- | :--- | :--- | :--- |
| `/api/health` | `GET` | `api/health.php` | Probes PHP status, MySQL connectivity, table counts, and storage writability. | None |
| `/api/install/status` | `GET` | `api/install/status.php` | Returns whether the system is installed, DB connected, tables count, and admin presence. | None |
| `/api/install/requirements` | `GET` | `api/install/requirements.php` | Checks PHP 8.0+, PDO, PDO_MySQL, JSON, MBString, and storage permissions. | None |
| `/api/install/test-db` | `POST` | `api/install/test-db.php` | Validates MySQL host, port, credentials, and auto-creates database if missing. | None |
| `/api/install/migrate` | `POST` | `api/install/migrate.php` | Executes all pending `.sql` migrations in sequential batches. | None |
| `/api/install/create-admin`| `POST` | `api/install/create-admin.php` | Creates the primary super admin user and assigns full permissions. | None |
| `/api/install/finalize` | `POST` | `api/install/finalize.php` | Saves organization info, writes lock file and `config/installed.json`. | None |
| `/api/install/execute` | `POST` | `api/install/execute.php` | Complete all-in-one automated pipeline running steps 1–5 in one atomic request. | None |

---

### 3.2 Authentication, Users & Access Control

| Endpoint | Method | PHP Target File | Description | Auth Required |
| :--- | :--- | :--- | :--- | :--- |
| `/api/auth/login` | `POST` | `api/auth/login.php` | Authenticates user, enforces lockout after 5 failed attempts, issues JWT. | None |
| `/api/auth/logout` | `POST` | `api/auth/logout.php` | Invalidates user session and logs audit trail. | Bearer Token |
| `/api/auth/me` | `GET` | `api/auth/me.php` | Returns current user profile, role, branch, and permission array. | Bearer Token |
| `/api/auth/users` | `GET` | `api/auth/users.php` | Lists all users with branch and permission matrix. | Bearer Token |
| `/api/auth/users` | `POST` | `api/auth/users.php` | Creates a new user with bcrypt password and permissions. | Admin Role |
| `/api/auth/users` | `PUT` | `api/auth/users.php` | Updates user details, password (optional), role, or active state. | Admin Role |
| `/api/auth/users` | `DELETE` | `api/auth/users.php` | Deletes user (prevents deleting active self). | Admin Role |
| `/api/auth/verify-password`| `POST` | `api/auth/verify-password.php`| Re-verifies user password for sensitive actions (car deletion, etc.). | Bearer Token |
| `/api/auth/resend-otp` | `POST` | `api/auth/resend-otp.php` | Generates 6-digit OTP code with 10-minute expiry for password recovery. | None |
| `/api/auth/verify-otp` | `POST` | `api/auth/verify-otp.php` | Validates OTP code against bcrypt hash in `otp_logs`. | None |
| `/api/auth/reset-password`| `POST` | `api/auth/reset-password.php` | Overrides password for verified user. | None / Token |

---

### 3.3 Vehicles & Inventory Management

| Endpoint | Method | PHP Target File | Description | Auth Required |
| :--- | :--- | :--- | :--- | :--- |
| `/api/cars` | `GET` | `api/cars/index.php` | Fetches vehicle inventory with search (VIN/Brand/Plate), status, and branch filters. | Bearer Token |
| `/api/cars` | `POST` | `api/cars/index.php` | Inserts new vehicle, creates custom fields, and logs initial movement. | Bearer Token |
| `/api/cars/detail` / `/api/cars/:id` | `GET` | `api/cars/detail.php` | Fetches single vehicle details, custom fields, and exit permit info. | Bearer Token |
| `/api/cars/detail` / `/api/cars/:id` | `PUT` | `api/cars/detail.php` | Updates vehicle specs, price, cost price, notes, and custom fields. | Bearer Token |
| `/api/cars/detail` / `/api/cars/:id` | `DELETE`| `api/cars/detail.php` | Removes car from database with audit logging. | Bearer Token |
| `/api/cars/exit` | `POST` | `api/cars/exit.php` | Records delivery data, updates car status to `مباعة`, and logs outbound movement. | Bearer Token |

---

### 3.4 Sales & Exit Permits

| Endpoint | Method | PHP Target File | Description | Auth Required |
| :--- | :--- | :--- | :--- | :--- |
| `/api/sales` | `GET` | `api/sales/index.php` | Lists all completed vehicle sales with profit calculations and customer data. | Bearer Token |
| `/api/sales` | `POST` | `api/sales/index.php` | **Atomic Transaction:** Locks car row, updates status to `مباعة`, inserts customer and sales record, and logs movement. | Bearer Token |
| `/api/sales/detail` | `DELETE` / `POST` | `api/sales/detail.php` | **Atomic Return:** Cancels sale, returns car status to `متوفره`, and logs reversal. | Admin Role |

---

### 3.5 Inter-Branch & Company Transfers

| Endpoint | Method | PHP Target File | Description | Auth Required |
| :--- | :--- | :--- | :--- | :--- |
| `/api/transfers` | `GET` | `api/transfers/index.php` | Lists all transfer orders with associated vehicle items. | Bearer Token |
| `/api/transfers` | `POST` | `api/transfers/index.php` | Creates transfer order, sets cars to `محولة`, and logs outbound movement. | Bearer Token |
| `/api/transfers/receive` | `POST` | `api/transfers/receive.php` | Acknowledges receipt at destination branch, updates car branch ID, and marks as `متوفره`. | Bearer Token |

---

### 3.6 Customers & Sales Delegates

| Endpoint | Method | PHP Target File | Description | Auth Required |
| :--- | :--- | :--- | :--- | :--- |
| `/api/customers` | `GET` | `api/customers/index.php` | Fetches customer list or sales delegates list (`?type=delegates`). | Bearer Token |
| `/api/customers` | `POST` | `api/customers/index.php` | Adds customer or sales delegate profile. | Bearer Token |
| `/api/customers` | `DELETE` | `api/customers/index.php` | Deletes customer or sales delegate record. | Bearer Token |

---

### 3.7 Financials, Letters, Reports & Settings

| Endpoint | Method | PHP Target File | Description | Auth Required |
| :--- | :--- | :--- | :--- | :--- |
| `/api/costs` | `GET` / `POST` / `DELETE` | `api/costs/index.php` | Manages purchase, shipping, clearance, and transport expenses. | Bearer Token |
| `/api/letters` | `GET` / `POST` / `DELETE` | `api/letters/index.php` | Manages generated official letter archive and HTML print templates. | Bearer Token |
| `/api/reports` | `GET` | `api/reports/index.php` | Returns inventory stats, movements log, or monthly sales summary (`?type=inventory|movements|sales`). | Bearer Token |
| `/api/settings` | `GET` / `PUT` | `api/settings/index.php` | Manages organization details, commercial register, tax ID, logo, and stamp. | Bearer Token / Admin |
| `/api/branches` | `GET` / `POST` | `api/settings/branches.php` | Manages showroom branches directory. | Bearer Token |
| `/api/files/upload` | `POST` | `api/files/upload.php` | Validates and stores attachments in `storage/uploads/`. | Bearer Token |
| `/api/files/download` | `GET` | `api/files/download.php` | Safely streams stored attachments. | None / Token |
| `/api/backups` | `GET` / `POST` | `api/backups/index.php` | Generates or lists complete JSON database snapshots. | Admin Role |

---

## 4. Standard Response Formats & Error Handling

### 4.1 Success Envelope
```json
{
  "success": true,
  "message": "تم تنفيذ العملية بنجاح",
  "data": { ... }
}
```

### 4.2 Error Envelope
```json
{
  "success": false,
  "error": "وصف الخطأ بالتفصيل",
  "message": "وصف الخطأ بالتفصيل"
}
```

### 4.3 HTTP Status Codes
- `200 OK`: Request succeeded.
- `400 Bad Request`: Missing required fields or business validation failure.
- `401 Unauthorized`: Missing or invalid JWT Bearer token.
- `403 Forbidden`: Insufficient role or permissions.
- `404 Not Found`: Target resource does not exist.
- `429 Too Many Requests`: Account temporarily locked due to failed login attempts.
- `500 Internal Server Error`: Unhandled database exception or server error.

---

## 5. Deployment Instructions on Any Standard PHP Web Hosting

1. **Upload Files:** Upload the repository files into your hosting document root (e.g. `public_html/`).
2. **Ensure File Permissions:** Ensure the `storage/` directory and its subdirectories (`uploads/`, `documents/`, `backups/`, `logs/`) and `config/` have `0755` write permissions.
3. **Database Creation:** Create a standard MySQL database and user in your hosting control panel (cPanel / phpMyAdmin).
4. **Run Web Installer:** Visit `https://yourdomain.com` in your browser. The system will automatically detect the fresh install state and display the installation wizard to connect MySQL and create the Super Admin account.
5. **Ready to Use:** Log in with your new Super Admin credentials. No Node.js runtime or CLI terminal required.
