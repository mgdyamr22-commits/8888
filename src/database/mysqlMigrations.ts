import { dbManager } from './mysqlClient';

export interface MigrationDefinition {
  id: string;
  name: string;
  sql: string;
}

export const MIGRATIONS: MigrationDefinition[] = [
  {
    id: '001_create_tenants_and_branches',
    name: 'Create Tenants and Branches Tables',
    sql: `
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
    `
  },
  {
    id: '002_create_users_and_security',
    name: 'Create Users, Permissions, Security and Preferences Tables',
    sql: `
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
    `
  },
  {
    id: '003_create_cars_and_inventory',
    name: 'Create Cars, Exit Data, Custom Fields, History and Movements',
    sql: `
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
    `
  },
  {
    id: '004_create_sales_transfers_customers',
    name: 'Create Customers, Delegates, Reservations, Sales, and Transfers Tables',
    sql: `
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
    `
  },
  {
    id: '005_create_financials_letters_settings',
    name: 'Create Vehicle Costs, Letters Archive, Settings, Companies, Audit and Migration History',
    sql: `
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
    `
  },
  {
    id: '006_expand_cars_fields',
    name: 'Expand cars table column sizes to prevent string truncation',
    sql: `
      ALTER TABLE cars MODIFY COLUMN vin_matching VARCHAR(128) NULL;
      ALTER TABLE cars MODIFY COLUMN card_number VARCHAR(128) NULL;
      ALTER TABLE cars MODIFY COLUMN color VARCHAR(128) NOT NULL;
      ALTER TABLE cars MODIFY COLUMN model_year VARCHAR(64) NULL;
      ALTER TABLE cars MODIFY COLUMN status VARCHAR(128) DEFAULT 'متوفره';
      ALTER TABLE cars MODIFY COLUMN rental_status VARCHAR(128) DEFAULT 'لم يتم التجير';
      ALTER TABLE cars MODIFY COLUMN ownership_type VARCHAR(128) DEFAULT 'مباشر';
    `
  }
];

/**
 * Safely ensures the cars table has the required interior_color column.
 * 1- Checks if column 'interior_color' exists in table 'cars'.
 * 2- If not present, creates column: interior_color VARCHAR(100) NULL.
 * 3- If present, does nothing (skips execution without altering).
 * 4- Does not drop, delete, or recreate table, keeping all data and keys safe.
 */
export async function ensureCarsColumns(): Promise<void> {
  try {
    const tableRows: any = await dbManager.query("SHOW TABLES LIKE 'cars'");
    const tableExists = Array.isArray(tableRows) && tableRows.length > 0;
    if (!tableExists) return;

    const colRows: any = await dbManager.query("SHOW COLUMNS FROM `cars` LIKE 'interior_color'");
    const hasColumn = Array.isArray(colRows) && colRows.length > 0;

    if (!hasColumn) {
      await dbManager.query("ALTER TABLE `cars` ADD COLUMN `interior_color` VARCHAR(100) NULL");
      console.log('✅ Safely added interior_color VARCHAR(100) NULL to cars table');
    }
  } catch (e: any) {
    console.warn('[mysqlMigrations] ensureCarsColumns notice:', e?.message || e);
  }
}

export async function runAllMigrations(): Promise<{ applied: string[]; skipped: string[] }> {
  const applied: string[] = [];
  const skipped: string[] = [];

  // Safe pre-check: ensure cars table has interior_color if cars already exists
  await ensureCarsColumns();

  // Ensure migration_history table exists first
  await dbManager.query(`
    CREATE TABLE IF NOT EXISTS migration_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      migration_id VARCHAR(128) NOT NULL UNIQUE,
      migration_name VARCHAR(255) NOT NULL,
      batch INT NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Fetch already applied migrations
  const rows: any = await dbManager.query('SELECT migration_id FROM migration_history');
  const appliedSet = new Set((rows as any[]).map(r => r.migration_id));

  // Determine current batch number
  const batchRows: any = await dbManager.query('SELECT MAX(batch) as maxBatch FROM migration_history');
  const nextBatch = (((batchRows as any[])[0]?.maxBatch) || 0) + 1;

  for (const m of MIGRATIONS) {
    if (appliedSet.has(m.id)) {
      skipped.push(m.id);
      continue;
    }

    console.log(`⏳ Running migration [${m.id}]: ${m.name}...`);
    // Split SQL by statements to execute properly
    const statements = m.sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      if (stmt.toLowerCase().includes('interior_color') && stmt.toLowerCase().includes('modify')) {
        await ensureCarsColumns();
        continue;
      }

      try {
        await dbManager.query(stmt);
      } catch (stmtErr: any) {
        if (stmtErr?.message?.includes('1054') && stmt.includes('interior_color')) {
          await ensureCarsColumns();
          continue;
        }
        throw stmtErr;
      }
    }

    await dbManager.query(
      'INSERT INTO migration_history (migration_id, migration_name, batch) VALUES (?, ?, ?)',
      [m.id, m.name, nextBatch]
    );

    applied.push(m.id);
    console.log(`✅ Migration [${m.id}] applied successfully.`);

    // Re-verify after table creations
    await ensureCarsColumns();
  }

  // Final verification check
  await ensureCarsColumns();

  return { applied, skipped };
}
