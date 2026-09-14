# Almakhzoun Inventory Pro — Database Schema & Migration Map
**System:** نظام المخزون الاحترافي للسيارات (Almakhzoun Inventory Pro)  
**Target:** MySQL Relational Cloud Architecture with Idempotent Auto-Migrations  

---

## 1. Migration System Architecture
The application includes an automated Migration Engine (`/src/database/mysqlMigrations.ts`) that executes SQL migration scripts upon installation or startup. Each migration is tracked in the `migration_history` table to guarantee **idempotency** (safe to run repeatedly without data corruption or redundant executions).

---

## 2. Table Dependency Graph
```text
tenants
  ├── branches
  │     ├── users
  │     │     ├── user_permissions
  │     │     ├── user_security_questions
  │     │     ├── user_trusted_devices
  │     │     └── user_layout_preferences
  │     └── cars
  │           ├── car_exit_data
  │           ├── car_custom_fields
  │           ├── car_history
  │           ├── reservations
  │           ├── sales
  │           └── vehicle_costs
  ├── companies
  ├── customers
  ├── delegates
  ├── transfers
  │     └── transfer_items
  ├── letters_archive
  ├── inventory_movements
  ├── audit_logs
  ├── settings
  ├── otp_logs
  ├── backup_logs
  └── migration_history
```

---

## 3. SQL Migrations Sequence

### `001_create_tenants_and_branches.sql`
Creates:
- `tenants` (id, name, commercial_registry, tax_number, phone, email, address, logo_url, stamp_url, notes, created_at, updated_at)
- `branches` (id, tenant_id, name, code, phone, address, is_active, created_at)

### `002_create_users_and_security.sql`
Creates:
- `users` (id, tenant_id, branch_id, username, password_hash, role, full_name, email, phone, admin_email, specialty, avatar, primary_admin, recovery_code_hash, failed_attempts, lockout_until, last_login, is_active, created_at)
- `user_permissions` (id, user_id, permission_key)
- `user_security_questions` (id, user_id, question, answer_hash)
- `user_trusted_devices` (id, user_id, device_id, device_name, created_at)
- `user_layout_preferences` (id, user_id, table_key, layout_json, updated_at)

### `003_create_cars_and_inventory.sql`
Creates:
- `cars` (id, tenant_id, branch_id, brand, model, grade, year, color, vin, vin_matching, card_number, price, cost_price, supplier, ownership_type, status, rental_status, entry_date, attribution_source, is_present_in_showroom, is_outbound, has_plate, plate_number, plate_owner_name, plate_serial_number, plate_issue_date, card_file, card_file_name, reserved_by_user_id, reservation_date, status_note, car_remark, notes, seller, model_year, exit_type, transfer_sender, transfer_receiver, transfer_no, transfer_date, created_at, updated_at)
- `car_exit_data` (id, car_id, receiver_name, receiver_phone, receiver_id, nationality, delivery_type, transport_company, exit_date, seller, sale_type, bank_name, representative_name, car_condition, notes)
- `car_custom_fields` (id, car_id, field_key, field_value)
- `car_history` (id, car_id, action, user, timestamp)
- `inventory_movements` (id, tenant_id, branch_id, car_id, vin, movement_type, prev_status, new_status, user, details, timestamp)

### `004_create_sales_transfers_customers.sql`
Creates:
- `customers` (id, tenant_id, name, phone, national_id, type, created_at)
- `delegates` (id, tenant_id, username, phone, email, specialty, is_active, target, created_at)
- `reservations` (id, car_id, delegate_name, customer_name, customer_phone, deposit_amount, status, reservation_date, expiry_date, notes, created_by_user_id)
- `sales` (id, tenant_id, branch_id, car_id, customer_id, customer_name, customer_phone, customer_id_number, sale_price, cost_price, profit, sale_type, bank_name, seller_name, delegate_name, delivery_type, transport_company, sale_date, notes, created_by_user_id)
- `transfers` (id, transfer_no, tenant_id, source_branch_id, source_company_name, dest_branch_id, dest_company_name, status, driver_name, driver_phone, driver_id, transfer_date, receive_date, sender_user, receiver_user, notes, created_at)
- `transfer_items` (id, transfer_id, car_id, vin, brand, model, year, color, price)

### `005_create_financials_letters_settings.sql`
Creates:
- `vehicle_costs` (id, tenant_id, car_id, car_name, vin, purchase_price, shipping_expense, clearance_expense, transport_expense, other_expense, total_cost, supplier, entry_date, notes, is_archived, created_at)
- `letters_archive` (id, tenant_id, letter_number, letter_type, letter_date, vin, plate_number, card_number, vehicle_name, driver_name, destination, created_by, created_at, html_content, manual_car_brand, manual_car_model, manual_car_year, manual_car_price)
- `companies` (id, tenant_id, company_name, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass_encrypted, sender_email, logo, stamp_url, phone, address, created_at)
- `settings` (id, tenant_id, org_name, org_type, description, contact_number, tax_number, commercial_register, address, currency, low_stock_threshold, system_version, declaration_text, declaration_text_plural, reservation_confirm_period_days, exit_permit_settings, custom_fields_config, column_visibility_config, updated_at)
- `audit_logs` (id, tenant_id, user_id, user_name, action, target_id, target_type, details, ip_address, timestamp)
- `otp_logs` (id, user_id, otp_hash, attempts, status, ip_address, created_at, expires_at)
- `backup_logs` (id, tenant_id, backup_type, file_name, file_size_bytes, records_count, created_by, created_at, status)
- `migration_history` (id, migration_name, batch, applied_at)
