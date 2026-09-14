-- Migration: 002_create_users_and_security.sql
-- Creates Users, Permissions, Security and Preferences Tables

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) DEFAULT 'org-default',
  branch_id VARCHAR(64) NULL,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('مدير', 'موظف', 'مندوب') DEFAULT 'موظف',
  full_name VARCHAR(128) NULL,
  email VARCHAR(128) NULL,
  phone VARCHAR(64) NULL,
  admin_email VARCHAR(128) NULL,
  specialty VARCHAR(128) NULL,
  avatar MEDIUMTEXT NULL,
  primary_admin TINYINT(1) DEFAULT 0,
  recovery_code_hash VARCHAR(255) NULL,
  failed_attempts INT DEFAULT 0,
  lockout_until DATETIME NULL,
  last_login DATETIME NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_username (username),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  permission_key VARCHAR(64) NOT NULL,
  INDEX idx_user_perm (user_id),
  UNIQUE KEY uq_user_perm (user_id, permission_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_security_questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  question VARCHAR(255) NOT NULL,
  answer_hash VARCHAR(255) NOT NULL,
  INDEX idx_user_sq (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_trusted_devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  device_id VARCHAR(128) NOT NULL,
  device_name VARCHAR(128) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_dev (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_layout_preferences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  table_key VARCHAR(64) NOT NULL,
  layout_json JSON NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_table (user_id, table_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
