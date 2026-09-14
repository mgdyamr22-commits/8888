-- Migration: 007_upgrade_delegates_system.sql
-- Upgrades delegates table to support standalone credentials, profile and security

CREATE TABLE IF NOT EXISTS delegates (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) DEFAULT 'org-default',
  name VARCHAR(128) NOT NULL DEFAULT '',
  username VARCHAR(128) NOT NULL,
  password_hash VARCHAR(255) NULL,
  phone VARCHAR(64) NULL,
  email VARCHAR(128) NULL,
  specialty VARCHAR(128) DEFAULT 'مبيعات',
  is_active TINYINT(1) DEFAULT 1,
  target INT DEFAULT 0,
  notes TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_del_username (username),
  INDEX idx_del_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Safely add missing columns if table previously existed with older schema
SET @dbname = DATABASE();
SET @tablename = "delegates";

-- Add name if not exists
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = 'name'
  ) > 0,
  "SELECT 1",
  "ALTER TABLE delegates ADD COLUMN name VARCHAR(128) NOT NULL DEFAULT '' AFTER tenant_id"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add password_hash if not exists
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = 'password_hash'
  ) > 0,
  "SELECT 1",
  "ALTER TABLE delegates ADD COLUMN password_hash VARCHAR(255) NULL AFTER username"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add notes if not exists
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = 'notes'
  ) > 0,
  "SELECT 1",
  "ALTER TABLE delegates ADD COLUMN notes TEXT NULL AFTER target"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add updated_at if not exists
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = 'updated_at'
  ) > 0,
  "SELECT 1",
  "ALTER TABLE delegates ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
