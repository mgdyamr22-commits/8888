# Almakhzoun Inventory Pro — Comprehensive Data Inventory & Relational Schema
**Project:** نظام المخزون الذكي للسيارات (Almakhzoun Inventory Pro)  
**Target:** MySQL Central Cloud Database Schema & Normalization Plan  
**Document Type:** Full Exhaustive Data Inventory (Phase 1 Inspection)  

---

## 1. Data Schema Architecture Principles
To transition from non-relational LocalStorage keys (`almakhzoun_cars`, `almakhzoun_app_users`, `almakhzoun_settings`, etc.) and JSON files to a robust, ACID-compliant **MySQL Central Cloud Database**, all entities are normalized into relational tables with strict foreign keys, indexes on high-frequency search fields (`vin`, `phone`, `username`, `status`, `branch_id`), unique constraints, and transaction safety.

---

## 2. Relational Entity Catalogs

### 2.1 Table: `tenants` (المؤسسات / الشركات المالكة للمنظومة)
*Current Source:* `localStorage.getItem('almakhzoun_tenants')` / `OrganizationTenant`
| Field Name | MySQL Data Type | Constraints | Nullable | Default | Description & Migration Notes |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `PRIMARY KEY` | NO | UUID/Slug | Tenant unique identifier (e.g., `org-default`) |
| `name` | `VARCHAR(255)` | `NOT NULL` | NO | - | Organization official name |
| `commercial_registry` | `VARCHAR(64)` | `INDEX` | YES | NULL | السجل التجاري |
| `tax_number` | `VARCHAR(64)` | `INDEX` | YES | NULL | الرقم الضريبي |
| `phone` | `VARCHAR(64)` | - | YES | NULL | رقم الهاتف الرئيسي |
| `email` | `VARCHAR(128)` | - | YES | NULL | البريد الإلكتروني للمؤسسة |
| `address` | `TEXT` | - | YES | NULL | العنوان الفعلي والفرع الرئيسي |
| `logo_url` | `MEDIUMTEXT` | - | YES | NULL | Base64 data URI or Cloud Asset URL |
| `stamp_url` | `MEDIUMTEXT` | - | YES | NULL | Base64 data URI or Cloud Asset URL |
| `notes` | `TEXT` | - | YES | NULL | ملاحظات إضافية |
| `created_at` | `DATETIME` | - | NO | `CURRENT_TIMESTAMP` | وقت إنشاء السجل |
| `updated_at` | `DATETIME` | `ON UPDATE CURRENT_TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | وقت آخر تحديث |

---

### 2.2 Table: `branches` (الفروع ومستودعات المعارض)
*Current Source:* `types.ts`, `TransferManager.tsx`, `App.tsx`
| Field Name | MySQL Data Type | Constraints | Nullable | Default | Description & Migration Notes |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `PRIMARY KEY` | NO | - | Branch unique ID (e.g. `b_riyadh`, `b_jeddah`) |
| `tenant_id` | `VARCHAR(64)` | `FOREIGN KEY (tenants.id)`, `INDEX` | NO | `org-default` | Link to parent tenant organization |
| `name` | `VARCHAR(128)` | `NOT NULL` | NO | - | اسم الفرع (معرض الرياض، مستودع جدة...) |
| `code` | `VARCHAR(32)` | `UNIQUE` | YES | NULL | كود الفرع الفريد |
| `phone` | `VARCHAR(64)` | - | YES | NULL | هاتف الفرع |
| `address` | `VARCHAR(255)` | - | YES | NULL | عنوان موقع الفرع |
| `is_active` | `TINYINT(1)` | - | NO | `1` | حالة الفرع (نشط / معطل) |
| `created_at` | `DATETIME` | - | NO | `CURRENT_TIMESTAMP` | تاريخ الإنشاء |

---

### 2.3 Table: `users` (المستخدمون والمشرفون والموظفون والمناديب)
*Current Source:* `types.ts` (`User`), `nativeAuthService.ts`, `authRoutes.ts`
| Field Name | MySQL Data Type | Constraints | Nullable | Default | Description & Migration Notes |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `PRIMARY KEY` | NO | - | User unique ID (e.g. `u_1`, `u_admin`) |
| `tenant_id` | `VARCHAR(64)` | `FOREIGN KEY (tenants.id)`, `INDEX` | NO | `org-default` | Parent tenant |
| `branch_id` | `VARCHAR(64)` | `FOREIGN KEY (branches.id)`, `INDEX` | YES | NULL | Assigned branch (NULL = global access) |
| `username` | `VARCHAR(64)` | `UNIQUE`, `NOT NULL`, `INDEX` | NO | - | Normalized lower-case username |
| `password_hash` | `VARCHAR(255)` | `NOT NULL` | NO | - | Bcrypt hashed password |
| `role` | `ENUM('مدير', 'موظف', 'مندوب')` | `NOT NULL`, `INDEX` | NO | `موظف` | System role |
| `full_name` | `VARCHAR(128)` | - | YES | NULL | الاسم الكامل للموظف |
| `email` | `VARCHAR(128)` | `INDEX` | YES | NULL | البريد الإلكتروني للتواصل والإشعارات |
| `phone` | `VARCHAR(64)` | `INDEX` | YES | NULL | رقم هاتف الموظف |
| `admin_email` | `VARCHAR(128)` | - | YES | NULL | بريد المشرف المعتمد للطوارئ |
| `specialty` | `VARCHAR(128)` | - | YES | NULL | التخصص أو القسم الوظيفي |
| `avatar` | `MEDIUMTEXT` | - | YES | NULL | صورة الموظف الرمزية |
| `primary_admin` | `TINYINT(1)` | - | NO | `0` | هل هو المشرف الرئيسي الأولي |
| `recovery_code_hash` | `VARCHAR(255)` | - | YES | NULL | Bcrypt hash for `AFS-XXXX-XXXX-XXXX` code |
| `failed_attempts` | `INT` | - | NO | `0` | عدد محاولات الدخول الخاطئة المتتالية |
| `lockout_until` | `DATETIME` | - | YES | NULL | وقت انتهاء الحظر الأمني المؤقت |
| `last_login` | `DATETIME` | - | YES | NULL | آخر تسجيل دخول مسجل |
| `is_active` | `TINYINT(1)` | - | NO | `1` | هل الحساب نشط |
| `created_at` | `DATETIME` | - | NO | `CURRENT_TIMESTAMP` | تاريخ الإنشاء |

---

### 2.4 Table: `user_permissions` (صلاحيات المستخدمين المخصصة)
*Current Source:* `User.permissions`, `constants.ts` (`Permission`)
| Field Name | MySQL Data Type | Constraints | Nullable | Default | Description |
|---|---|---|---|---|---|
| `id` | `INT AUTO_INCREMENT` | `PRIMARY KEY` | NO | - | Surrogate Key |
| `user_id` | `VARCHAR(64)` | `FOREIGN KEY (users.id) ON DELETE CASCADE`, `INDEX` | NO | - | Link to user |
| `permission_key` | `VARCHAR(64)` | `INDEX` | NO | - | Enum: `view_dashboard`, `manage_inventory`, `view_reports`, `manage_users`, `manage_settings`, `manage_backup`, `view_financials`, `export_data`, `view_sales` |

---

### 2.5 Table: `user_security_questions` (أسئلة الأمان الثلاثية للاستعادة)
*Current Source:* `User.securityQuestions`, `authRoutes.ts`
| Field Name | MySQL Data Type | Constraints | Nullable | Default | Description |
|---|---|---|---|---|---|
| `id` | `INT AUTO_INCREMENT` | `PRIMARY KEY` | NO | - | Primary Key |
| `user_id` | `VARCHAR(64)` | `FOREIGN KEY (users.id) ON DELETE CASCADE`, `INDEX` | NO | - | Target user |
| `question` | `VARCHAR(255)` | `NOT NULL` | NO | - | سؤال الأمان المختار |
| `answer_hash` | `VARCHAR(255)` | `NOT NULL` | NO | - | Bcrypt hash للإجابة بحروف صغيرة |

---

### 2.6 Table: `user_trusted_devices` (الأجهزة الموثوقة للموظف)
*Current Source:* `User.trustedDevices`, `authRoutes.ts`
| Field Name | MySQL Data Type | Constraints | Nullable | Default | Description |
|---|---|---|---|---|---|
| `id` | `INT AUTO_INCREMENT` | `PRIMARY KEY` | NO | - | Primary Key |
| `user_id` | `VARCHAR(64)` | `FOREIGN KEY (users.id) ON DELETE CASCADE`, `INDEX` | NO | - | Target user |
| `device_id` | `VARCHAR(128)` | `INDEX` | NO | - | UUID or hardware fingerprint string |
| `device_name` | `VARCHAR(128)` | - | YES | NULL | اسم أو نوع الجهاز |
| `created_at` | `DATETIME` | - | NO | `CURRENT_TIMESTAMP` | وقت تسجيل الجهاز |

---

### 2.7 Table: `cars` (أصول المركبات وسجل المخزون المركزي)
*Current Source:* `types.ts` (`Car`), `INITIAL_CARS`, `CarManager.tsx`
| Field Name | MySQL Data Type | Constraints | Nullable | Default | Description & Migration Notes |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `PRIMARY KEY` | NO | - | Unique Vehicle ID |
| `tenant_id` | `VARCHAR(64)` | `FOREIGN KEY (tenants.id)`, `INDEX` | NO | `org-default` | Parent organization tenant |
| `branch_id` | `VARCHAR(64)` | `FOREIGN KEY (branches.id)`, `INDEX` | YES | NULL | Current physical showroom branch |
| `brand` | `VARCHAR(128)` | `NOT NULL`, `INDEX` | NO | - | الماركة (تويوتا، هيونداي، نيسان...) |
| `model` | `VARCHAR(128)` | `NOT NULL`, `INDEX` | NO | - | الموديل / الطراز (لاندكروزر، كامري...) |
| `grade` | `VARCHAR(128)` | `INDEX` | YES | NULL | الفئة / الدرجة (فل كامل، ستاندرد...) |
| `year` | `INT` | `INDEX` | NO | - | سنة الصنع (2024, 2025, 2026...) |
| `color` | `VARCHAR(64)` | `INDEX` | NO | - | اللون الخارجي |
| `vin` | `VARCHAR(64)` | `UNIQUE`, `NOT NULL`, `INDEX` | NO | - | رقم الهيكل كاملاً (17 حرف/رقم) |
| `vin_matching` | `VARCHAR(16)` | `INDEX` | YES | NULL | آخر 6 أرقام من الشاسيه لتسريع البحث |
| `card_number` | `VARCHAR(64)` | `INDEX` | YES | NULL | رقم البطاقة الجمركية |
| `price` | `DECIMAL(12,2)` | - | NO | `0.00` | سعر البيع المعتمد |
| `cost_price` | `DECIMAL(12,2)` | - | NO | `0.00` | سعر التكلفة الفعلي |
| `supplier` | `VARCHAR(128)` | `INDEX` | YES | NULL | المورد أو جهة الشراء |
| `ownership_type` | `VARCHAR(64)` | `INDEX` | NO | `مباشر` | مباشر أو تصريف |
| `status` | `VARCHAR(64)` | `INDEX` | NO | `متوفره` | متوفره, بالساحة, قيد التحويل, محجوزة, مباعة, مؤرشفة, لم تصل بعد, مرتجعة للمعرض, غير معروضة للبيع |
| `rental_status` | `VARCHAR(64)` | - | NO | `لم يتم التجير` | مجير أو لم يتم التجير |
| `entry_date` | `DATE` | `INDEX` | NO | - | تاريخ دخول المركبة للنظام |
| `attribution_source`| `VARCHAR(128)` | - | YES | NULL | جهة التوريد / الوارد (سعودي، خليجي...) |
| `is_present_in_showroom` | `TINYINT(1)`| - | NO | `1` | هل السيارة موجودة بالمعرض حالياً |
| `is_outbound` | `TINYINT(1)` | `INDEX` | NO | `0` | هل تم تصديرها / خروجها |
| `has_plate` | `TINYINT(1)` | - | NO | `0` | هل صدرت لها لوحات |
| `plate_number` | `VARCHAR(64)` | `INDEX` | YES | NULL | رقم اللوحة |
| `plate_owner_name` | `VARCHAR(128)` | - | YES | NULL | اسم مالك اللوحة المسجل |
| `plate_serial_number`| `VARCHAR(64)` | - | YES | NULL | الرقم التسلسلي للوحة |
| `plate_issue_date` | `DATE` | - | YES | NULL | تاريخ إصدار اللوحة |
| `card_file` | `LONGTEXT` | - | YES | NULL | رابط ملف البطاقة الجمركية / Base64 |
| `card_file_name` | `VARCHAR(255)` | - | YES | NULL | اسم الملف المرفق |
| `reserved_by_user_id`| `VARCHAR(64)` | `INDEX` | YES | NULL | المندوب أو الموظف الحاجز |
| `reservation_date` | `DATETIME` | `INDEX` | YES | NULL | تاريخ ووقت الحجز |
| `status_note` | `TEXT` | - | YES | NULL | ملاحظة الحالة / اسم المندوب النظيف |
| `car_remark` | `TEXT` | - | YES | NULL | ملاحظات تسجيل المركبة |
| `notes` | `TEXT` | - | YES | NULL | الملاحظات العامة |
| `seller` | `VARCHAR(128)` | - | YES | NULL | البائع أو مسؤول البيع |
| `model_year` | `VARCHAR(32)` | - | YES | NULL | سنة الطراز |
| `exit_type` | `VARCHAR(64)` | - | YES | NULL | نوع الخروج |
| `transfer_sender` | `VARCHAR(128)` | - | YES | NULL | جهة أو موظف الإرسال في التحويل |
| `transfer_receiver` | `VARCHAR(128)` | - | YES | NULL | جهة أو موظف الاستلام في التحويل |
| `transfer_no` | `VARCHAR(64)` | `INDEX` | YES | NULL | رقم سند التحويل |
| `transfer_date` | `DATETIME` | - | YES | NULL | تاريخ التحويل |
| `created_at` | `DATETIME` | - | NO | `CURRENT_TIMESTAMP` | تاريخ إضافة السجل |
| `updated_at` | `DATETIME` | `ON UPDATE CURRENT_TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | تاريخ التعديل |

---

### 2.8 Table: `car_exit_data` (بيانات تصريح الخروج والتسليم)
*Current Source:* `Car.exitData` (`ExitData`)
| Field Name | MySQL Data Type | Constraints | Nullable | Default | Description |
|---|---|---|---|---|---|
| `id` | `INT AUTO_INCREMENT` | `PRIMARY KEY` | NO | - | Primary Key |
| `car_id` | `VARCHAR(64)` | `FOREIGN KEY (cars.id) ON DELETE CASCADE`, `UNIQUE` | NO | - | Vehicle relation |
| `receiver_name` | `VARCHAR(128)` | `INDEX` | NO | - | اسم المستلم |
| `receiver_phone` | `VARCHAR(64)` | `INDEX` | NO | - | هاتف المستلم |
| `receiver_id` | `VARCHAR(64)` | `INDEX` | NO | - | هوية / إقامة المستلم |
| `nationality` | `VARCHAR(64)` | - | YES | NULL | الجنسية |
| `delivery_type` | `VARCHAR(64)` | - | NO | `صاحبها` | صاحبها, نقليات, مستلم اخر |
| `transport_company` | `VARCHAR(128)`| - | YES | NULL | شركة النقليات الناقلة |
| `exit_date` | `DATETIME` | `INDEX` | NO | - | تاريخ ووقت الخروج |
| `seller` | `VARCHAR(128)` | `INDEX` | YES | NULL | البائع |
| `sale_type` | `VARCHAR(64)` | `INDEX` | YES | NULL | كاش, عميل بنك, أقساط |
| `bank_name` | `VARCHAR(128)` | `INDEX` | YES | NULL | اسم البنك الممول |
| `representative_name` | `VARCHAR(128)`| - | YES | NULL | اسم المندوب |
| `car_condition` | `VARCHAR(128)` | - | YES | NULL | حالة واستلام المركبة |
| `notes` | `TEXT` | - | YES | NULL | ملاحظات سند الخروج |

---

### 2.9 Table: `car_custom_fields` (الحقول المخصصة لكل سيارة)
*Current Source:* `Car.customData`, `OrganizationSettings.customFields`
| Field Name | MySQL Data Type | Constraints | Nullable | Default | Description |
|---|---|---|---|---|---|
| `id` | `INT AUTO_INCREMENT` | `PRIMARY KEY` | NO | - | Primary Key |
| `car_id` | `VARCHAR(64)` | `FOREIGN KEY (cars.id) ON DELETE CASCADE`, `INDEX` | NO | - | Vehicle ID |
| `field_key` | `VARCHAR(64)` | `INDEX` | NO | - | Field key/label |
| `field_value` | `TEXT` | - | YES | NULL | Value |

---

### 2.10 Table: `car_history` (سجل تتبع الحركات التاريخية للسيارة)
*Current Source:* `Car.history` (`CarHistoryEntry`)
| Field Name | MySQL Data Type | Constraints | Nullable | Default | Description |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `PRIMARY KEY` | NO | - | Entry unique ID |
| `car_id` | `VARCHAR(64)` | `FOREIGN KEY (cars.id) ON DELETE CASCADE`, `INDEX` | NO | - | Vehicle ID |
| `action` | `VARCHAR(255)` | `NOT NULL` | NO | - | وصف الإجراء |
| `user` | `VARCHAR(64)` | `INDEX` | NO | - | اسم الموظف المنفذ |
| `timestamp` | `DATETIME` | `INDEX` | NO | `CURRENT_TIMESTAMP` | وقت الإجراء |

---

### 2.11 Table: `reservations` (حجوزات السيارات وضبط التعارض المتزامن)
*Current Source:* `getUnifiedBookings()`, `CarManager.tsx`, `ReservationAuditModal.tsx`
| Field Name | MySQL Data Type | Constraints | Nullable | Default | Description |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `PRIMARY KEY` | NO | - | Unique Reservation ID |
| `car_id` | `VARCHAR(64)` | `FOREIGN KEY (cars.id)`, `INDEX` | NO | - | Reserved Vehicle |
| `delegate_name` | `VARCHAR(128)` | `INDEX` | NO | - | اسم المندوب أو الموظف الحاجز |
| `customer_name` | `VARCHAR(128)` | - | YES | NULL | اسم العميل الحاجز |
| `customer_phone` | `VARCHAR(64)` | - | YES | NULL | هاتف العميل |
| `deposit_amount` | `DECIMAL(12,2)` | - | NO | `0.00` | مبلغ العربون المدفوع |
| `status` | `ENUM('active', 'expired', 'sold', 'cancelled')` | `INDEX` | NO | `active` | حالة الحجز |
| `reservation_date` | `DATETIME` | `INDEX` | NO | `CURRENT_TIMESTAMP` | وقت بدء الحجز |
| `expiry_date` | `DATETIME` | `INDEX` | YES | NULL | وقت انتهاء صلاحية الحجز (افتراضياً 3 أيام) |
| `notes` | `TEXT` | - | YES | NULL | ملاحظات الحجز |
| `created_by_user_id` | `VARCHAR(64)` | `FOREIGN KEY (users.id)` | YES | NULL | الموظف الذي سجل الحجز |

---

### 2.12 Table: `customers` (دليل العملاء والمستلمين)
*Current Source:* `types.ts` (`Customer`), `CustomersManager.tsx`
| Field Name | MySQL Data Type | Constraints | Nullable | Default | Description |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `PRIMARY KEY` | NO | - | Customer Unique ID |
| `tenant_id` | `VARCHAR(64)` | `FOREIGN KEY (tenants.id)`, `INDEX` | NO | `org-default` | Parent Tenant |
| `name` | `VARCHAR(128)` | `INDEX`, `NOT NULL` | NO | - | اسم العميل / المستلم |
| `phone` | `VARCHAR(64)` | `INDEX`, `NOT NULL` | NO | - | رقم الهاتف |
| `national_id` | `VARCHAR(64)` | `INDEX`, `NOT NULL` | NO | - | رقم الهوية الوطنية / الإقامة |
| `type` | `ENUM('عميل', 'مستلم')` | `INDEX` | NO | `عميل` | تصنيف الشخص |
| `created_at` | `DATETIME` | - | NO | `CURRENT_TIMESTAMP` | تاريخ الإضافة |

---

### 2.13 Table: `delegates` (المناديب ومسؤولو التسويق)
*Current Source:* `types.ts` (`Delegate`), `DelegateManagementTab.tsx`
| Field Name | MySQL Data Type | Constraints | Nullable | Default | Description |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `PRIMARY KEY` | NO | - | Delegate ID |
| `tenant_id` | `VARCHAR(64)` | `FOREIGN KEY (tenants.id)`, `INDEX` | NO | `org-default` | Parent Tenant |
| `username` | `VARCHAR(128)` | `NOT NULL`, `INDEX` | NO | - | اسم المندوب |
| `phone` | `VARCHAR(64)` | `INDEX` | YES | NULL | رقم هاتف المندوب |
| `email` | `VARCHAR(128)` | - | YES | NULL | البريد الإلكتروني |
| `specialty` | `VARCHAR(128)` | - | YES | NULL | التخصص أو منطقة البيع |
| `is_active` | `TINYINT(1)` | - | NO | `1` | هل هو نشط |
| `target` | `INT` | - | NO | `0` | الهدف الشهري للسيارات |
| `created_at` | `DATETIME` | - | NO | `CURRENT_TIMESTAMP` | تاريخ الإنشاء |

---

### 2.14 Table: `transfers` (سندات التحويل بين الفروع والشركات الشقيقة)
*Current Source:* `TransferManager.tsx` (`Transfer`), `localStorage` (`almakhzoun_transfers`)
| Field Name | MySQL Data Type | Constraints | Nullable | Default | Description |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `PRIMARY KEY` | NO | - | Unique Transfer ID |
| `transfer_no` | `VARCHAR(64)` | `UNIQUE`, `NOT NULL`, `INDEX` | NO | - | رقم سند التحويل (مثال: TRF-2026-0001) |
| `tenant_id` | `VARCHAR(64)` | `FOREIGN KEY (tenants.id)`, `INDEX` | NO | `org-default` | Parent Tenant |
| `source_branch_id` | `VARCHAR(64)` | `INDEX` | YES | NULL | الفرع المصدر |
| `source_company_name`| `VARCHAR(128)` | - | NO | - | اسم جهة / معرض الإرسال |
| `dest_branch_id` | `VARCHAR(64)` | `INDEX` | YES | NULL | الفرع المستلم |
| `dest_company_name` | `VARCHAR(128)` | - | NO | - | اسم جهة / معرض الاستلام |
| `status` | `VARCHAR(64)` | `INDEX` | NO | `قيد النقل` | قيد النقل, تم الاستلام, ملغي |
| `driver_name` | `VARCHAR(128)` | - | YES | NULL | اسم السائق |
| `driver_phone` | `VARCHAR(64)` | - | YES | NULL | هاتف السائق |
| `driver_id` | `VARCHAR(64)` | - | YES | NULL | هوية السائق |
| `transfer_date` | `DATETIME` | `INDEX` | NO | `CURRENT_TIMESTAMP` | تاريخ الإرسال |
| `receive_date` | `DATETIME` | - | YES | NULL | تاريخ الاستلام الفعلي |
| `sender_user` | `VARCHAR(64)` | - | NO | - | الموظف المرسل |
| `receiver_user` | `VARCHAR(64)` | - | YES | NULL | الموظف المستلم |
| `notes` | `TEXT` | - | YES | NULL | ملاحظات التحويل |
| `created_at` | `DATETIME` | - | NO | `CURRENT_TIMESTAMP` | تاريخ الإنشاء |

---

### 2.15 Table: `transfer_items` (السيارات المندرجة في سند التحويل)
*Current Source:* `Transfer.cars`, `TransferManager.tsx`
| Field Name | MySQL Data Type | Constraints | Nullable | Default | Description |
|---|---|---|---|---|---|
| `id` | `INT AUTO_INCREMENT` | `PRIMARY KEY` | NO | - | Primary Key |
| `transfer_id` | `VARCHAR(64)` | `FOREIGN KEY (transfers.id) ON DELETE CASCADE`, `INDEX` | NO | - | Parent Transfer |
| `car_id` | `VARCHAR(64)` | `FOREIGN KEY (cars.id)`, `INDEX` | NO | - | Vehicle ID |
| `vin` | `VARCHAR(64)` | `INDEX` | NO | - | VIN snapshot |
| `brand` | `VARCHAR(128)` | - | NO | - | Brand snapshot |
| `model` | `VARCHAR(128)` | - | NO | - | Model snapshot |
| `year` | `INT` | - | NO | - | Year snapshot |
| `color` | `VARCHAR(64)` | - | NO | - | Color snapshot |
| `price` | `DECIMAL(12,2)` | - | NO | `0.00` | Price snapshot |

---

### 2.16 Table: `companies` (الشركات الشقيقة / إعدادات البريد والمؤسسة)
*Current Source:* `src/database/db.ts` (`Companies`), `TransferManager.tsx` (`SisterCompany`)
| Field Name | MySQL Data Type | Constraints | Nullable | Default | Description |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `PRIMARY KEY` | NO | - | Company ID (e.g. `c1`, `c_2`) |
| `tenant_id` | `VARCHAR(64)` | `FOREIGN KEY (tenants.id)` | NO | `org-default` | Parent Tenant |
| `company_name` | `VARCHAR(128)` | `NOT NULL`, `INDEX` | NO | - | اسم الشركة / الفرع الشقيق |
| `smtp_host` | `VARCHAR(128)` | - | YES | NULL | خادم SMTP |
| `smtp_port` | `INT` | - | YES | `587` | منفذ SMTP |
| `smtp_secure` | `TINYINT(1)` | - | NO | `0` | هل الاتصال مشفر SSL/TLS |
| `smtp_user` | `VARCHAR(128)` | - | YES | NULL | حساب SMTP |
| `smtp_pass_encrypted`| `TEXT` | - | YES | NULL | كلمة سر البريد مشفرة AES-256 |
| `sender_email` | `VARCHAR(128)` | - | YES | NULL | البريد الإلكتروني للمرسل |
| `logo` | `MEDIUMTEXT` | - | YES | NULL | شعار الشركة |
| `stamp_url` | `MEDIUMTEXT` | - | YES | NULL | ختم الشركة |
| `phone` | `VARCHAR(64)` | - | YES | NULL | هاتف الشركة |
| `address` | `VARCHAR(255)` | - | YES | NULL | عنوان الشركة |
| `created_at` | `DATETIME` | - | NO | `CURRENT_TIMESTAMP` | تاريخ الإنشاء |

---

### 2.17 Table: `sales` (سجل عمليات البيع وسندات التسليم المكتملة)
*Current Source:* `SalesManager.tsx`, `Car.exitData`, `CarStatus.SOLD`
| Field Name | MySQL Data Type | Constraints | Nullable | Default | Description |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `PRIMARY KEY` | NO | - | Sale Unique ID |
| `tenant_id` | `VARCHAR(64)` | `FOREIGN KEY (tenants.id)`, `INDEX` | NO | `org-default` | Parent Tenant |
| `branch_id` | `VARCHAR(64)` | `FOREIGN KEY (branches.id)`, `INDEX` | YES | NULL | Branch where sale occurred |
| `car_id` | `VARCHAR(64)` | `FOREIGN KEY (cars.id)`, `UNIQUE`, `INDEX`| NO | - | Sold Vehicle |
| `customer_id` | `VARCHAR(64)` | `FOREIGN KEY (customers.id)`, `INDEX` | YES | NULL | Buyer profile |
| `customer_name` | `VARCHAR(128)` | `INDEX` | NO | - | اسم العميل المشتري |
| `customer_phone` | `VARCHAR(64)` | `INDEX` | NO | - | هاتف العميل |
| `customer_id_number`| `VARCHAR(64)` | `INDEX` | NO | - | هوية المشتري |
| `sale_price` | `DECIMAL(12,2)` | - | NO | `0.00` | سعر البيع الفعلي |
| `cost_price` | `DECIMAL(12,2)` | - | NO | `0.00` | تكلفة الشراء |
| `profit` | `DECIMAL(12,2)` | - | NO | `0.00` | صافي الربح المحسوب |
| `sale_type` | `VARCHAR(64)` | `INDEX` | NO | `كاش` | كاش, عميل بنك, أقساط |
| `bank_name` | `VARCHAR(128)` | `INDEX` | YES | NULL | اسم البنك الممول |
| `seller_name` | `VARCHAR(128)` | `INDEX` | YES | NULL | اسم البائع |
| `delegate_name` | `VARCHAR(128)` | `INDEX` | YES | NULL | اسم المندوب |
| `delivery_type` | `VARCHAR(64)` | - | NO | `صاحبها` | صاحبها, نقليات, مستلم آخر |
| `transport_company` | `VARCHAR(128)`| - | YES | NULL | شركة النقليات |
| `sale_date` | `DATETIME` | `INDEX` | NO | `CURRENT_TIMESTAMP` | تاريخ البيع والخروج |
| `notes` | `TEXT` | - | YES | NULL | ملاحظات العملية |
| `created_by_user_id`| `VARCHAR(64)` | `FOREIGN KEY (users.id)` | YES | NULL | الموظف مدخل البيانات |

---

### 2.18 Table: `vehicle_costs` (محاسبة تكاليف ومصروفات المركبات)
*Current Source:* `types.ts` (`VehicleCost`), `VehicleCostsManager.tsx`
| Field Name | MySQL Data Type | Constraints | Nullable | Default | Description |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `PRIMARY KEY` | NO | - | Unique Cost ID |
| `tenant_id` | `VARCHAR(64)` | `FOREIGN KEY (tenants.id)`, `INDEX` | NO | `org-default` | Parent Tenant |
| `car_id` | `VARCHAR(64)` | `INDEX` | YES | NULL | Linked Vehicle ID |
| `car_name` | `VARCHAR(128)` | `INDEX` | NO | - | اسم السيارة |
| `vin` | `VARCHAR(64)` | `INDEX` | NO | - | رقم الشاسيه |
| `purchase_price` | `DECIMAL(12,2)` | - | NO | `0.00` | سعر الشراء الأساسي |
| `shipping_expense` | `DECIMAL(12,2)` | - | NO | `0.00` | مصاريف الشحن |
| `clearance_expense` | `DECIMAL(12,2)` | - | NO | `0.00` | مصاريف التخليص الجمركي |
| `transport_expense` | `DECIMAL(12,2)` | - | NO | `0.00` | مصاريف النقل الداخلي |
| `other_expense` | `DECIMAL(12,2)` | - | NO | `0.00` | مصاريف أخرى إضافية |
| `total_cost` | `DECIMAL(12,2)` | - | NO | `0.00` | إجمالي التكلفة |
| `supplier` | `VARCHAR(128)` | `INDEX` | YES | NULL | المورد |
| `entry_date` | `DATE` | `INDEX` | NO | - | تاريخ قيد التكلفة |
| `notes` | `TEXT` | - | YES | NULL | ملاحظات المصروفات |
| `is_archived` | `TINYINT(1)` | `INDEX` | NO | `0` | هل السجل مؤرشف |
| `created_at` | `DATETIME` | - | NO | `CURRENT_TIMESTAMP` | تاريخ الإنشاء |

---

### 2.19 Table: `letters_archive` (أرشيف الخطابات الرسمية والتفويضات)
*Current Source:* `types.ts` (`LetterArchiveEntry`), `LettersArchive.tsx`
| Field Name | MySQL Data Type | Constraints | Nullable | Default | Description |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `PRIMARY KEY` | NO | - | Letter ID |
| `tenant_id` | `VARCHAR(64)` | `FOREIGN KEY (tenants.id)`, `INDEX` | NO | `org-default` | Parent Tenant |
| `letter_number` | `VARCHAR(64)` | `INDEX` | NO | - | رقم الخطاب / السند |
| `letter_type` | `VARCHAR(64)` | `INDEX` | NO | - | نوع الخطاب (سحب، نقطة تفتيش، نقليات...) |
| `letter_date` | `DATE` | `INDEX` | NO | - | تاريخ الخطاب |
| `vin` | `VARCHAR(64)` | `INDEX` | YES | NULL | رقم الهيكل |
| `plate_number` | `VARCHAR(64)` | - | YES | NULL | رقم اللوحة |
| `card_number` | `VARCHAR(64)` | - | YES | NULL | رقم البطاقة الجمركية |
| `vehicle_name` | `VARCHAR(128)` | - | YES | NULL | اسم ومواصفات المركبة |
| `driver_name` | `VARCHAR(128)` | - | YES | NULL | اسم السائق / المفوض |
| `destination` | `VARCHAR(128)` | - | YES | NULL | الوجهة المقصودة |
| `created_by` | `VARCHAR(64)` | `INDEX` | NO | - | منشئ الخطاب |
| `created_at` | `DATETIME` | `INDEX` | NO | `CURRENT_TIMESTAMP` | وقت التوليد |
| `html_content` | `LONGTEXT` | - | NO | - | المحتوى الكامل للخطاب بصيغة HTML جاهزة للطباعة |
| `manual_car_brand` | `VARCHAR(128)`| - | YES | NULL | الماركة اليدوية |
| `manual_car_model` | `VARCHAR(128)`| - | YES | NULL | الموديل اليدوي |
| `manual_car_year` | `VARCHAR(32)` | - | YES | NULL | سنة الصنع اليدوية |
| `manual_car_price` | `VARCHAR(32)` | - | YES | NULL | السعر اليدوي |

---

### 2.20 Table: `inventory_movements` (سجل حركات الدخول والخروج وتغيير الحالات)
*Current Source:* `types.ts` (`InventoryMovement`, `MovementEvent`), `CarManager.tsx`
| Field Name | MySQL Data Type | Constraints | Nullable | Default | Description |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `PRIMARY KEY` | NO | - | Movement ID |
| `tenant_id` | `VARCHAR(64)` | `FOREIGN KEY (tenants.id)`, `INDEX` | NO | `org-default` | Parent Tenant |
| `branch_id` | `VARCHAR(64)` | `FOREIGN KEY (branches.id)`, `INDEX` | YES | NULL | Branch ID |
| `car_id` | `VARCHAR(64)` | `INDEX` | YES | NULL | Vehicle ID |
| `vin` | `VARCHAR(64)` | `INDEX` | NO | - | VIN |
| `movement_type` | `VARCHAR(64)` | `INDEX` | NO | - | دخول, خروج, تحويل, حجز, بيع, إلغاء حجز, تعديل |
| `prev_status` | `VARCHAR(64)` | - | YES | NULL | الحالة السابقة |
| `new_status` | `VARCHAR(64)` | - | YES | NULL | الحالة الجديدة |
| `user` | `VARCHAR(64)` | `INDEX` | NO | - | اسم الموظف المنفذ للحركة |
| `details` | `TEXT` | - | YES | NULL | تفاصيل إضافية عن الحركة |
| `timestamp` | `DATETIME` | `INDEX` | NO | `CURRENT_TIMESTAMP` | وقت الحركة الدقيق |

---

### 2.21 Table: `audit_logs` (سجل التدقيق الأمني وعمليات النظام)
*Current Source:* `types.ts` (`ActivityLog`), `src/database/db.ts` (`Log_History`)
| Field Name | MySQL Data Type | Constraints | Nullable | Default | Description |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `PRIMARY KEY` | NO | - | Log ID |
| `tenant_id` | `VARCHAR(64)` | `FOREIGN KEY (tenants.id)`, `INDEX` | NO | `org-default` | Parent Tenant |
| `user_id` | `VARCHAR(64)` | `INDEX` | YES | NULL | User who triggered the action |
| `user_name` | `VARCHAR(128)` | `INDEX` | NO | - | User display name |
| `action` | `VARCHAR(128)` | `INDEX`, `NOT NULL` | NO | - | Action Name (e.g. `LOGIN`, `DELETE_CAR`, `TRANSFER_CAR`, `PASSWORD_RESET`) |
| `target_id` | `VARCHAR(64)` | `INDEX` | YES | NULL | Affected record ID |
| `target_type` | `VARCHAR(64)` | `INDEX` | YES | NULL | `car`, `user`, `sale`, `transfer`, `settings`, `backup`, `letter` |
| `details` | `TEXT` | - | YES | NULL | Comprehensive operation details |
| `ip_address` | `VARCHAR(64)` | - | YES | NULL | Client IP Address |
| `timestamp` | `DATETIME` | `INDEX` | NO | `CURRENT_TIMESTAMP` | Exact ISO Timestamp |

---

### 2.22 Table: `settings` (إعدادات المنظومة والمظهر والطباعة)
*Current Source:* `OrganizationSettings`, `AppSettings.tsx`, `localStorage` (`almakhzoun_settings`)
| Field Name | MySQL Data Type | Constraints | Nullable | Default | Description |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `PRIMARY KEY` | NO | `settings_default` | Primary Key |
| `tenant_id` | `VARCHAR(64)` | `FOREIGN KEY (tenants.id)`, `UNIQUE` | NO | `org-default` | Unique per tenant |
| `org_name` | `VARCHAR(255)` | - | NO | `مؤسسة المخزون` | اسم المؤسسة في الترويسة والطباعة |
| `org_type` | `VARCHAR(64)` | - | NO | `مؤسسة` | مؤسسة أو شركة |
| `description` | `TEXT` | - | YES | NULL | وصف النشاط التجاري |
| `contact_number` | `VARCHAR(64)` | - | YES | NULL | رقم التواصل المعتمد |
| `tax_number` | `VARCHAR(64)` | - | YES | NULL | الرقم الضريبي |
| `commercial_register`| `VARCHAR(64)`| - | YES | NULL | السجل التجاري |
| `address` | `TEXT` | - | YES | NULL | العنوان الرسمي |
| `currency` | `VARCHAR(32)` | - | NO | `SAR` | العملة المعتمدة |
| `low_stock_threshold`| `INT` | - | NO | `5` | حد تنبيه المخزون المنخفض |
| `system_version` | `VARCHAR(32)` | - | NO | `3.6.0` | إصدار المنظومة |
| `declaration_text` | `TEXT` | - | YES | NULL | نص الإقرار الفردي |
| `declaration_text_plural`| `TEXT`| - | YES | NULL | نص الإقرار للجمع |
| `reservation_confirm_period_days`| `INT`| - | NO | `3` | مدة تثبيت الحجز بالأيام |
| `exit_permit_settings`| `JSON` | - | YES | NULL | مسافات وهوامش خط وتصميم تصريح الخروج |
| `custom_fields_config`| `JSON` | - | YES | NULL | تعريفات الحقول الإضافية للشاشات |
| `column_visibility_config`| `JSON`| - | YES | NULL | إعدادات إظهار وإخفاء الأعمدة |
| `updated_at` | `DATETIME` | `ON UPDATE CURRENT_TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | تاريخ التعديل |

---

### 2.23 Table: `user_layout_preferences` (تخصيص ترتيب وعرض أعمدة الجداول لكل مستخدم)
*Current Source:* `layoutPersistenceService.ts`, `localStorage`
| Field Name | MySQL Data Type | Constraints | Nullable | Default | Description |
|---|---|---|---|---|---|
| `id` | `INT AUTO_INCREMENT` | `PRIMARY KEY` | NO | - | Primary Key |
| `user_id` | `VARCHAR(64)` | `FOREIGN KEY (users.id) ON DELETE CASCADE`, `INDEX` | NO | - | User ID |
| `table_key` | `VARCHAR(64)` | `INDEX` | NO | - | Table identifier (e.g. `cars_table`, `sales_table`) |
| `layout_json` | `JSON` | - | NO | - | JSON payload of columns order, widths, and visibility |
| `updated_at` | `DATETIME` | `ON UPDATE CURRENT_TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Timestamp |

---

### 2.24 Table: `otp_logs` (سجلات أكواد التحقق لمرة واحدة)
*Current Source:* `src/database/db.ts` (`OTP_Logs`), `src/otp/otpService.ts`
| Field Name | MySQL Data Type | Constraints | Nullable | Default | Description |
|---|---|---|---|---|---|
| `id` | `INT AUTO_INCREMENT` | `PRIMARY KEY` | NO | - | Primary Key |
| `user_id` | `VARCHAR(64)` | `INDEX` | NO | - | Username / User ID |
| `otp_hash` | `VARCHAR(255)` | `NOT NULL` | NO | - | Bcrypt hash of 6-digit OTP code |
| `attempts` | `INT` | - | NO | `0` | عدد المحاولات الخاطئة |
| `status` | `ENUM('PENDING', 'VERIFIED', 'EXPIRED', 'FAILED_MAX_ATTEMPTS')` | `INDEX` | NO | `PENDING` | حالة الرمز |
| `ip_address` | `VARCHAR(64)` | - | YES | NULL | IP address of request |
| `created_at` | `DATETIME` | `INDEX` | NO | `CURRENT_TIMESTAMP` | وقت التوليد |
| `expires_at` | `DATETIME` | `INDEX` | NO | - | وقت انتهاء الصلاحية (10 دقائق) |

---

### 2.25 Table: `backup_logs` (سجل النسخ الاحتياطية المركزية)
*Current Source:* `BackupManager.tsx`, `localDirectoryBackupService.ts`
| Field Name | MySQL Data Type | Constraints | Nullable | Default | Description |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `PRIMARY KEY` | NO | - | Backup ID |
| `tenant_id` | `VARCHAR(64)` | `FOREIGN KEY (tenants.id)`, `INDEX` | NO | `org-default` | Parent Tenant |
| `backup_type` | `VARCHAR(64)` | - | NO | `MANUAL_WEB` | `MANUAL_WEB`, `SCHEDULED_AUTO`, `CLOUD_SYNC` |
| `file_name` | `VARCHAR(255)` | - | NO | - | اسم الملف |
| `file_size_bytes` | `BIGINT` | - | NO | `0` | حجم الملف بالبايت |
| `records_count` | `INT` | - | NO | `0` | إجمالي السجلات المؤرشفة |
| `created_by` | `VARCHAR(64)` | - | NO | - | المستخدم أو النظام |
| `created_at` | `DATETIME` | `INDEX` | NO | `CURRENT_TIMESTAMP` | تاريخ وتوقيت أخذ النسخة |
| `status` | `VARCHAR(32)` | - | NO | `SUCCESS` | حالة النسخ |

---

## 3. Data Integrity & Concurrency Rules
1. **VIN Uniqueness:** `cars.vin` is strictly enforced as a unique index. No two cars can share a VIN under the same tenant.
2. **Atomic Reservation Check-and-Set:** Concurrent reservation requests are serialized via `UPDATE cars SET status = 'محجوزة', reserved_by_user_id = ?, reservation_date = NOW() WHERE id = ? AND status IN ('متوفره', 'بالساحة')` inside a MySQL Transaction.
3. **Atomic Sales Lock:** A vehicle is marked `status = 'مباعة'` and recorded into `sales` table in a single atomic SQL transaction.
4. **Transfer Integrity:** Vehicles in transfer have `status = 'قيد التحويل'` and are only assigned to the target branch upon the receiver clicking "استلام".
