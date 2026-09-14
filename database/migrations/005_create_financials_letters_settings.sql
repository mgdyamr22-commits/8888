-- Migration: 005_create_financials_letters_settings.sql
-- Creates Vehicle Costs, Letters Archive, Settings, Companies, Audit Logs, OTP and Migration History

CREATE TABLE IF NOT EXISTS vehicle_costs (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) DEFAULT 'org-default',
  car_id VARCHAR(64) NULL,
  car_name VARCHAR(128) NOT NULL,
  vin VARCHAR(64) NOT NULL,
  purchase_price DECIMAL(12,2) DEFAULT 0.00,
  shipping_expense DECIMAL(12,2) DEFAULT 0.00,
  clearance_expense DECIMAL(12,2) DEFAULT 0.00,
  transport_expense DECIMAL(12,2) DEFAULT 0.00,
  other_expense DECIMAL(12,2) DEFAULT 0.00,
  total_cost DECIMAL(12,2) DEFAULT 0.00,
  supplier VARCHAR(128) NULL,
  entry_date DATE NOT NULL,
  notes TEXT NULL,
  is_archived TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vin (vin)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS letters_archive (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) DEFAULT 'org-default',
  letter_number VARCHAR(64) NOT NULL,
  letter_type VARCHAR(64) NOT NULL,
  letter_date DATE NOT NULL,
  vin VARCHAR(64) NULL,
  plate_number VARCHAR(64) NULL,
  card_number VARCHAR(64) NULL,
  vehicle_name VARCHAR(128) NULL,
  driver_name VARCHAR(128) NULL,
  destination VARCHAR(128) NULL,
  created_by VARCHAR(64) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  html_content LONGTEXT NOT NULL,
  manual_car_brand VARCHAR(128) NULL,
  manual_car_model VARCHAR(128) NULL,
  manual_car_year VARCHAR(32) NULL,
  manual_car_price VARCHAR(32) NULL,
  INDEX idx_letter_no (letter_number),
  INDEX idx_letter_type (letter_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS companies (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) DEFAULT 'org-default',
  company_name VARCHAR(128) NOT NULL,
  smtp_host VARCHAR(128) NULL,
  smtp_port INT DEFAULT 587,
  smtp_secure TINYINT(1) DEFAULT 0,
  smtp_user VARCHAR(128) NULL,
  smtp_pass_encrypted TEXT NULL,
  sender_email VARCHAR(128) NULL,
  logo MEDIUMTEXT NULL,
  stamp_url MEDIUMTEXT NULL,
  phone VARCHAR(64) NULL,
  address VARCHAR(255) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
  id VARCHAR(64) PRIMARY KEY DEFAULT 'settings_default',
  tenant_id VARCHAR(64) DEFAULT 'org-default',
  org_name VARCHAR(255) DEFAULT 'مؤسسة المخزون',
  org_type VARCHAR(64) DEFAULT 'مؤسسة',
  description TEXT NULL,
  contact_number VARCHAR(64) NULL,
  tax_number VARCHAR(64) NULL,
  commercial_register VARCHAR(64) NULL,
  address TEXT NULL,
  currency VARCHAR(32) DEFAULT 'SAR',
  low_stock_threshold INT DEFAULT 5,
  system_version VARCHAR(32) DEFAULT '3.6.0',
  declaration_text TEXT NULL,
  declaration_text_plural TEXT NULL,
  reservation_confirm_period_days INT DEFAULT 3,
  exit_permit_settings JSON NULL,
  custom_fields_config JSON NULL,
  column_visibility_config JSON NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tenant_settings (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) DEFAULT 'org-default',
  user_id VARCHAR(64) NULL,
  user_name VARCHAR(128) NOT NULL,
  action VARCHAR(128) NOT NULL,
  target_id VARCHAR(64) NULL,
  target_type VARCHAR(64) NULL,
  details TEXT NULL,
  ip_address VARCHAR(64) NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_action (action),
  INDEX idx_user (user_name),
  INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS otp_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  otp_hash VARCHAR(255) NOT NULL,
  attempts INT DEFAULT 0,
  status ENUM('PENDING', 'VERIFIED', 'EXPIRED', 'FAILED_MAX_ATTEMPTS') DEFAULT 'PENDING',
  ip_address VARCHAR(64) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  INDEX idx_otp_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS backup_logs (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) DEFAULT 'org-default',
  backup_type VARCHAR(64) DEFAULT 'MANUAL_WEB',
  file_name VARCHAR(255) NOT NULL,
  file_size_bytes BIGINT DEFAULT 0,
  records_count INT DEFAULT 0,
  created_by VARCHAR(64) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(32) DEFAULT 'SUCCESS'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS migration_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  migration_id VARCHAR(128) NOT NULL UNIQUE,
  migration_name VARCHAR(255) NOT NULL,
  batch INT NOT NULL,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
