-- Migration: 004_create_sales_transfers_customers.sql
-- Creates Customers, Delegates, Reservations, Sales, Transfers and Items Tables

CREATE TABLE IF NOT EXISTS customers (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) DEFAULT 'org-default',
  name VARCHAR(128) NOT NULL,
  phone VARCHAR(64) NOT NULL,
  national_id VARCHAR(64) NOT NULL,
  type ENUM('عميل', 'مستلم') DEFAULT 'عميل',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_phone (phone),
  INDEX idx_nat_id (national_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS delegates (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) DEFAULT 'org-default',
  username VARCHAR(128) NOT NULL,
  phone VARCHAR(64) NULL,
  email VARCHAR(128) NULL,
  specialty VARCHAR(128) NULL,
  is_active TINYINT(1) DEFAULT 1,
  target INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_delegate_name (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reservations (
  id VARCHAR(64) PRIMARY KEY,
  car_id VARCHAR(64) NOT NULL,
  delegate_name VARCHAR(128) NOT NULL,
  customer_name VARCHAR(128) NULL,
  customer_phone VARCHAR(64) NULL,
  deposit_amount DECIMAL(12,2) DEFAULT 0.00,
  status ENUM('active', 'expired', 'sold', 'cancelled') DEFAULT 'active',
  reservation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  expiry_date DATETIME NULL,
  notes TEXT NULL,
  created_by_user_id VARCHAR(64) NULL,
  INDEX idx_car_res (car_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sales (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) DEFAULT 'org-default',
  branch_id VARCHAR(64) NULL,
  car_id VARCHAR(64) NOT NULL UNIQUE,
  customer_id VARCHAR(64) NULL,
  customer_name VARCHAR(128) NOT NULL,
  customer_phone VARCHAR(64) NOT NULL,
  customer_id_number VARCHAR(64) NOT NULL,
  sale_price DECIMAL(12,2) DEFAULT 0.00,
  cost_price DECIMAL(12,2) DEFAULT 0.00,
  profit DECIMAL(12,2) DEFAULT 0.00,
  sale_type VARCHAR(64) DEFAULT 'كاش',
  bank_name VARCHAR(128) NULL,
  seller_name VARCHAR(128) NULL,
  delegate_name VARCHAR(128) NULL,
  delivery_type VARCHAR(64) DEFAULT 'صاحبها',
  transport_company VARCHAR(128) NULL,
  sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT NULL,
  created_by_user_id VARCHAR(64) NULL,
  INDEX idx_car_sale (car_id),
  INDEX idx_sale_date (sale_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transfers (
  id VARCHAR(64) PRIMARY KEY,
  transfer_no VARCHAR(64) NOT NULL UNIQUE,
  tenant_id VARCHAR(64) DEFAULT 'org-default',
  source_branch_id VARCHAR(64) NULL,
  source_company_name VARCHAR(128) NOT NULL,
  dest_branch_id VARCHAR(64) NULL,
  dest_company_name VARCHAR(128) NOT NULL,
  status VARCHAR(64) DEFAULT 'قيد النقل',
  driver_name VARCHAR(128) NULL,
  driver_phone VARCHAR(64) NULL,
  driver_id VARCHAR(64) NULL,
  transfer_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  receive_date DATETIME NULL,
  sender_user VARCHAR(64) NOT NULL,
  receiver_user VARCHAR(64) NULL,
  notes TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_trf_no (transfer_no),
  INDEX idx_trf_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transfer_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transfer_id VARCHAR(64) NOT NULL,
  car_id VARCHAR(64) NOT NULL,
  vin VARCHAR(64) NOT NULL,
  brand VARCHAR(128) NOT NULL,
  model VARCHAR(128) NOT NULL,
  year INT NOT NULL,
  color VARCHAR(64) NOT NULL,
  price DECIMAL(12,2) DEFAULT 0.00,
  FOREIGN KEY (transfer_id) REFERENCES transfers(id) ON DELETE CASCADE,
  INDEX idx_trf_car (transfer_id, car_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
