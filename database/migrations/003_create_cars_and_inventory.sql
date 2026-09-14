-- Migration: 003_create_cars_and_inventory.sql
-- Creates Cars, Exit Data, Custom Fields, History and Movements Tables

CREATE TABLE IF NOT EXISTS cars (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) DEFAULT 'org-default',
  branch_id VARCHAR(64) NULL,
  brand VARCHAR(128) NOT NULL,
  model VARCHAR(128) NOT NULL,
  year INT NOT NULL,
  color VARCHAR(128) NOT NULL,
  interior_color VARCHAR(100) NULL,
  vin VARCHAR(128) NOT NULL,
  vin_matching VARCHAR(128) NULL,
  card_number VARCHAR(128) NULL,
  price DECIMAL(12,2) DEFAULT 0.00,
  cost_price DECIMAL(12,2) DEFAULT 0.00,
  supplier VARCHAR(128) NULL,
  ownership_type VARCHAR(128) DEFAULT 'مباشر',
  status VARCHAR(128) DEFAULT 'متوفره',
  rental_status VARCHAR(128) DEFAULT 'لم يتم التجير',
  entry_date DATE NULL,
  attribution_source VARCHAR(128) NULL,
  is_present_in_showroom TINYINT(1) DEFAULT 1,
  presence_description TEXT NULL,
  is_outbound TINYINT(1) DEFAULT 0,
  has_plate TINYINT(1) DEFAULT 0,
  plate_number VARCHAR(64) NULL,
  plate_owner_name VARCHAR(128) NULL,
  plate_serial_number VARCHAR(64) NULL,
  plate_issue_date DATE NULL,
  card_file LONGTEXT NULL,
  card_file_name VARCHAR(255) NULL,
  reserved_by_user_id VARCHAR(64) NULL,
  reservation_date DATETIME NULL,
  status_note TEXT NULL,
  car_remark TEXT NULL,
  notes TEXT NULL,
  seller VARCHAR(128) NULL,
  model_year VARCHAR(64) NULL,
  exit_type VARCHAR(64) NULL,
  transfer_sender VARCHAR(128) NULL,
  transfer_receiver VARCHAR(128) NULL,
  transfer_no VARCHAR(64) NULL,
  transfer_date DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_vin (vin),
  INDEX idx_vin_matching (vin_matching),
  INDEX idx_status (status),
  INDEX idx_brand_model (brand, model)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS car_exit_data (
  id INT AUTO_INCREMENT PRIMARY KEY,
  car_id VARCHAR(64) NOT NULL UNIQUE,
  receiver_name VARCHAR(128) NOT NULL,
  receiver_phone VARCHAR(64) NOT NULL,
  receiver_id VARCHAR(64) NOT NULL,
  nationality VARCHAR(64) NULL,
  delivery_type VARCHAR(64) DEFAULT 'صاحبها',
  transport_company VARCHAR(128) NULL,
  exit_date DATETIME NOT NULL,
  seller VARCHAR(128) NULL,
  sale_type VARCHAR(64) NULL,
  bank_name VARCHAR(128) NULL,
  representative_name VARCHAR(128) NULL,
  car_condition VARCHAR(128) NULL,
  notes TEXT NULL,
  FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS car_custom_fields (
  id INT AUTO_INCREMENT PRIMARY KEY,
  car_id VARCHAR(64) NOT NULL,
  field_key VARCHAR(64) NOT NULL,
  field_value TEXT NULL,
  FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE,
  INDEX idx_car_field (car_id, field_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS car_history (
  id VARCHAR(64) PRIMARY KEY,
  car_id VARCHAR(64) NOT NULL,
  action VARCHAR(255) NOT NULL,
  user VARCHAR(64) NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE,
  INDEX idx_car_hist (car_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_movements (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) DEFAULT 'org-default',
  branch_id VARCHAR(64) NULL,
  car_id VARCHAR(64) NULL,
  vin VARCHAR(64) NOT NULL,
  movement_type VARCHAR(64) NOT NULL,
  prev_status VARCHAR(64) NULL,
  new_status VARCHAR(64) NULL,
  user VARCHAR(64) NOT NULL,
  details TEXT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vin (vin),
  INDEX idx_mov_type (movement_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
