-- Migration: 001_create_tenants_and_branches.sql
-- Creates Tenants and Branches Tables

CREATE TABLE IF NOT EXISTS tenants (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  commercial_registry VARCHAR(64) NULL,
  tax_number VARCHAR(64) NULL,
  phone VARCHAR(64) NULL,
  email VARCHAR(128) NULL,
  address TEXT NULL,
  logo_url MEDIUMTEXT NULL,
  stamp_url MEDIUMTEXT NULL,
  notes TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS branches (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  code VARCHAR(32) NULL UNIQUE,
  phone VARCHAR(64) NULL,
  address VARCHAR(255) NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
