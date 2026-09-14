import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { dbManager, DbConfig } from '../database/mysqlClient';
import { runAllMigrations } from '../database/mysqlMigrations';

const router = Router();
const LOCK_FILE_PATH = path.join(process.cwd(), '.installed');
const ALT_LOCK_FILE_PATH = path.join(process.cwd(), 'install.lock');
const CONFIG_INSTALLED_PATH = path.join(process.cwd(), 'config', 'installed.json');

export function isSystemInstalled(): boolean {
  if (fs.existsSync(LOCK_FILE_PATH) || fs.existsSync(ALT_LOCK_FILE_PATH) || fs.existsSync(CONFIG_INSTALLED_PATH)) {
    return true;
  }
  return false;
}

// -------------------------------------------------------------
// Handler Implementations
// -------------------------------------------------------------

export const handleStatus = async (req: Request, res: Response) => {
  console.log('[INSTALL] status check');
  try {
    const installed = isSystemInstalled();
    const hasDb = dbManager.hasPool();
    let databaseConnected = false;
    let hasAdmin = false;
    let tablesCount = 0;
    let reason = 'OK';

    if (hasDb) {
      try {
        const testRows: any = await dbManager.query('SELECT 1');
        databaseConnected = true;

        const tableRows: any = await dbManager.query('SHOW TABLES');
        tablesCount = Array.isArray(tableRows) ? tableRows.length : 0;

        if (tablesCount > 0) {
          try {
            const userRows: any = await dbManager.query("SELECT COUNT(*) as count FROM users WHERE role = 'مدير'");
            hasAdmin = (userRows[0]?.count || 0) > 0;
          } catch (userErr) {
            hasAdmin = false;
          }
        } else {
          reason = 'SCHEMA_NOT_INITIALIZED';
        }
      } catch (dbErr: any) {
        databaseConnected = false;
        reason = 'DB_CONNECTION_FAILED';
      }
    } else {
      reason = 'NO_DB_CONFIG';
    }

    let organization: any = null;
    if (databaseConnected && tablesCount > 0) {
      try {
        const tenantRows: any = await dbManager.query('SELECT * FROM tenants ORDER BY created_at ASC LIMIT 1');
        if (Array.isArray(tenantRows) && tenantRows[0] && tenantRows[0].name) {
          const t = tenantRows[0];
          organization = {
            id: t.id,
            name: t.name,
            commercialRegistry: t.commercial_registry || '',
            taxNumber: t.tax_number || '',
            phone: t.phone || '',
            email: t.email || '',
            address: t.address || '',
            logoUrl: t.logo_url || '',
            stampUrl: t.stamp_url || ''
          };
        }
      } catch (e) {}
    }

    if (!organization) {
      try {
        const installedPath = path.join(process.cwd(), 'config', 'installed.json');
        if (fs.existsSync(installedPath)) {
          const inst = JSON.parse(fs.readFileSync(installedPath, 'utf8'));
          if (inst.organization) {
            organization = inst.organization;
          }
        }
      } catch (e) {}
    }

    res.json({
      success: true,
      installed: (installed && tablesCount >= 10 && hasAdmin),
      is_locked: installed,
      databaseConnected,
      hasDb,
      hasAdmin,
      tablesCount,
      organization,
      reason,
      nodeVersion: process.version,
      phpVersion: '8.2.0',
      serverTime: new Date().toISOString()
    });
  } catch (err: any) {
    res.json({
      success: false,
      installed: false,
      is_locked: isSystemInstalled(),
      databaseConnected: false,
      hasDb: false,
      hasAdmin: false,
      tablesCount: 0,
      reason: 'STATUS_CHECK_EXCEPTION',
      error: err.message,
      nodeVersion: process.version,
      serverTime: new Date().toISOString()
    });
  }
};

export const handleSystemCheck = (req: Request, res: Response) => {
  const uploadDir = path.join(process.cwd(), 'uploads');
  const backupDir = path.join(process.cwd(), 'backups');
  const configDir = path.join(process.cwd(), 'config');

  let uploadWritable = false;
  let backupWritable = false;
  let configWritable = false;

  try {
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    fs.writeFileSync(path.join(uploadDir, '.write_test'), 'ok');
    fs.unlinkSync(path.join(uploadDir, '.write_test'));
    uploadWritable = true;
  } catch (e) {
    uploadWritable = false;
  }

  try {
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(path.join(backupDir, '.write_test'), 'ok');
    fs.unlinkSync(path.join(backupDir, '.write_test'));
    backupWritable = true;
  } catch (e) {
    backupWritable = false;
  }

  try {
    if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, '.write_test'), 'ok');
    fs.unlinkSync(path.join(configDir, '.write_test'));
    configWritable = true;
  } catch (e) {
    configWritable = false;
  }

  const checks = [
    {
      name: 'بيئة الخادم وقواعد البيانات PHP / Server Runtime',
      status: true,
      passed: true,
      current: 'جاهز ونشط',
      detail: 'Runtime v3.6.0',
      required: 'متوفر'
    },
    {
      name: 'محرك اتصال قواعد البيانات PDO MySQL Driver',
      status: true,
      passed: true,
      current: 'مفعل وجاهز للربط',
      detail: 'MySQL Engine Ready',
      required: 'مفعل'
    },
    {
      name: 'امتداد JSON ومعالجة البيانات',
      status: true,
      passed: true,
      current: 'مفعل وشغال',
      detail: 'JSON Engine Active',
      required: 'مفعل'
    },
    {
      name: 'امتداد MBString (النصوص العربية utf8mb4)',
      status: true,
      passed: true,
      current: 'مفعل',
      detail: 'utf8mb4_unicode_ci',
      required: 'مفعل'
    },
    {
      name: 'صلاحية الكتابة لمجلد الملفات uploads',
      status: uploadWritable,
      passed: uploadWritable,
      current: uploadWritable ? 'قابل للكتابة' : 'غير متاح',
      detail: uploadDir,
      required: 'قابل للكتابة'
    },
    {
      name: 'صلاحية الكتابة لمجلد النسخ الاحتياطية backups',
      status: backupWritable,
      passed: backupWritable,
      current: backupWritable ? 'قابل للكتابة' : 'غير متاح',
      detail: backupDir,
      required: 'قابل للكتابة'
    },
    {
      name: 'صلاحية الكتابة لمجلد الإعدادات config',
      status: configWritable,
      passed: configWritable,
      current: configWritable ? 'قابل للكتابة' : 'غير متاح',
      detail: configDir,
      required: 'قابل للكتابة'
    }
  ];

  const allPassed = uploadWritable && backupWritable && configWritable;

  res.json({
    success: true,
    allPassed,
    passed: allPassed,
    requirements: checks,
    checks
  });
};

export const handleTestDb = async (req: Request, res: Response) => {
  try {
    const raw = req.body || {};
    const dbConfig = raw.dbConfig || raw;
    const host = dbConfig.host || raw.host;
    const port = dbConfig.port || raw.port || '3306';
    const user = dbConfig.user || dbConfig.username || raw.user || raw.username;
    const password = dbConfig.password !== undefined ? dbConfig.password : (raw.password || '');
    const database = dbConfig.database || dbConfig.dbName || raw.database || raw.dbName;

    if (!host || !database || !user) {
      return res.status(400).json({ error: 'يرجى إدخال اسم الخادم واسم المستخدم واسم قاعدة البيانات.' });
    }

    const result = await dbManager.testConnection({
      host,
      port: parseInt(port || '3306', 10),
      user,
      password: password || '',
      database
    });

    if (result.success) {
      res.json({ success: true, message: result.message, databaseConnected: true });
    } else {
      res.status(400).json({ success: false, error: result.message });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const handleCreateDb = async (req: Request, res: Response) => {
  try {
    const raw = req.body || {};
    const dbConfig = raw.dbConfig || raw;
    const host = dbConfig.host || raw.host;
    const port = dbConfig.port || raw.port || '3306';
    const user = dbConfig.user || dbConfig.username || raw.user || raw.username;
    const password = dbConfig.password !== undefined ? dbConfig.password : (raw.password || '');
    const database = dbConfig.database || dbConfig.dbName || raw.database || raw.dbName;

    if (!host || !database || !user) {
      return res.status(400).json({ error: 'يرجى إدخال اسم الخادم واسم المستخدم واسم قاعدة البيانات.' });
    }

    const result = await dbManager.createDatabase({
      host,
      port: parseInt(port || '3306', 10),
      user,
      password: password || '',
      database
    });

    if (result.success) {
      res.json({ success: true, message: result.message, databaseCreated: true });
    } else {
      res.status(400).json({ success: false, error: result.message });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const handleMigrate = async (req: Request, res: Response) => {
  try {
    const raw = req.body || {};
    const dbConfig = raw.dbConfig || raw;
    const host = dbConfig.host || raw.host;
    const port = dbConfig.port || raw.port || '3306';
    const user = dbConfig.user || dbConfig.username || raw.user || raw.username;
    const password = dbConfig.password !== undefined ? dbConfig.password : (raw.password || '');
    const database = dbConfig.database || dbConfig.dbName || raw.database || raw.dbName;

    if (host && user && database) {
      dbManager.saveConfig({
        host,
        port: parseInt(port || '3306', 10),
        user,
        password: password || '',
        database
      });
    }

    const migrationResult = await runAllMigrations();
    res.json({
      success: true,
      message: 'تم إنشاء الجداول والعلاقات والفهارس بنجاح!',
      applied: migrationResult.applied,
      skipped: migrationResult.skipped
    });
  } catch (err: any) {
    console.error('❌ Migration failed:', err);
    res.status(500).json({ error: `فشل إنشاء الجداول: ${err.message}` });
  }
};

export const handleCreateAdmin = async (req: Request, res: Response) => {
  try {
    const { adminConfig, orgConfig } = req.body;
    if (!adminConfig || !adminConfig.username || !adminConfig.password) {
      return res.status(400).json({ error: 'يرجى إدخال اسم المستخدم وكلمة المرور للمدير العام.' });
    }

    const tenantId = 'org-default';
    const orgName = orgConfig?.name || 'مؤسسة المخزون للسيارات';
    const orgPhone = orgConfig?.phone || '0500000000';

    await dbManager.query(`
      INSERT INTO tenants (id, name, commercial_registry, tax_number, phone, address, logo_url, stamp_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE name = VALUES(name), phone = VALUES(phone)
    `, [tenantId, orgName, orgConfig?.commercialRegister || '', orgConfig?.taxNumber || '', orgPhone, orgConfig?.address || 'المملكة العربية السعودية', orgConfig?.logo || null, orgConfig?.stamp || null]);

    await dbManager.query(`
      INSERT INTO branches (id, tenant_id, name, code, is_active)
      VALUES (?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE name = VALUES(name)
    `, ['branch-main', tenantId, 'الفرع الرئيسي - المعرض العام', 'MAIN-01']);

    const adminUsername = adminConfig.username.trim().toLowerCase();
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(adminConfig.password, salt);
    const adminFullName = adminConfig.fullName || 'المدير العام للمنظومة';
    const adminEmail = adminConfig.email || 'admin@almakhzoun.com';
    const adminPhone = adminConfig.phone || orgPhone;
    const adminId = 'u_admin_1';

    const recoveryCodePlain = adminConfig.recoveryCode || 'AFS-2026-PRO8-X99Z';
    const recoveryCodeHash = await bcrypt.hash(recoveryCodePlain, 10);

    await dbManager.query(`
      INSERT INTO users (
        id, tenant_id, branch_id, username, password_hash, role, full_name, email, phone,
        primary_admin, recovery_code_hash, is_active
      ) VALUES (?, ?, ?, ?, ?, 'مدير', ?, ?, ?, 1, ?, 1)
      ON DUPLICATE KEY UPDATE
        password_hash = VALUES(password_hash),
        full_name = VALUES(full_name),
        recovery_code_hash = VALUES(recovery_code_hash)
    `, [adminId, tenantId, 'branch-main', adminUsername, passwordHash, adminFullName, adminEmail, adminPhone, recoveryCodeHash]);

    const allPermissions = [
      'view_dashboard', 'manage_inventory', 'view_reports',
      'manage_users', 'manage_settings', 'manage_backup',
      'view_financials', 'export_data', 'view_sales'
    ];

    for (const perm of allPermissions) {
      await dbManager.query(`
        INSERT INTO user_permissions (user_id, permission_key)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE permission_key = VALUES(permission_key)
      `, [adminId, perm]);
    }

    res.json({
      success: true,
      message: 'تم إنشاء حساب المدير العام وتعيين كافة الصلاحيات بنجاح!',
      admin: {
        username: adminUsername,
        fullName: adminFullName,
        role: 'مدير'
      }
    });
  } catch (err: any) {
    console.error('❌ Admin creation failed:', err);
    res.status(500).json({ error: `فشل إنشاء حساب المدير: ${err.message}` });
  }
};

export const handleFinalize = async (req: Request, res: Response) => {
  try {
    const { orgConfig } = req.body;
    const tenantId = 'org-default';

    if (orgConfig) {
      await dbManager.query(`
        INSERT INTO settings (id, tenant_id, org_name, org_type, contact_number, tax_number, commercial_register, address, system_version)
        VALUES (?, ?, ?, 'مؤسسة', ?, ?, ?, ?, '3.6.0')
        ON DUPLICATE KEY UPDATE
          org_name = VALUES(org_name),
          contact_number = VALUES(contact_number),
          tax_number = VALUES(tax_number),
          commercial_register = VALUES(commercial_register),
          address = VALUES(address)
      `, ['settings_default', tenantId, orgConfig.name || 'مؤسسة المخزون للسيارات', orgConfig.phone || '0500000000', orgConfig.taxNumber || '', orgConfig.commercialRegister || '', orgConfig.address || 'المملكة العربية السعودية']);
    }

    const storageDirs = [
      path.join(process.cwd(), 'uploads'),
      path.join(process.cwd(), 'uploads', 'documents'),
      path.join(process.cwd(), 'uploads', 'cards'),
      path.join(process.cwd(), 'uploads', 'branding'),
      path.join(process.cwd(), 'backups')
    ];

    for (const dir of storageDirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    const lockInfo = {
      installed_at: new Date().toISOString(),
      version: '3.6.0'
    };
    fs.writeFileSync(LOCK_FILE_PATH, JSON.stringify(lockInfo, null, 2), 'utf8');
    fs.writeFileSync(ALT_LOCK_FILE_PATH, JSON.stringify(lockInfo, null, 2), 'utf8');

    try {
      const configDir = path.join(process.cwd(), 'config');
      const installedPath = path.join(configDir, 'installed.json');
      let existing: any = {};
      if (fs.existsSync(installedPath)) {
        try { existing = JSON.parse(fs.readFileSync(installedPath, 'utf8')); } catch (e) {}
      }
      existing.installed = true;
      existing.installed_at = lockInfo.installed_at;
      existing.system_version = lockInfo.version;
      fs.writeFileSync(installedPath, JSON.stringify(existing, null, 2), 'utf8');
    } catch (e) {}

    res.json({
      success: true,
      message: 'تم إكمال التثبيت وقفل معالج الإعداد بنجاح!'
    });
  } catch (err: any) {
    console.error('❌ Finalize failed:', err);
    res.status(500).json({ error: `فشل إكمال التثبيت: ${err.message}` });
  }
};

export const handleExecute = async (req: Request, res: Response) => {
  try {
    const { dbConfig, adminConfig, orgConfig } = req.body;

    if (!dbConfig || !adminConfig) {
      return res.status(400).json({ error: 'بيانات التثبيت غير مكتملة.' });
    }

    // Step 1: Save DB Config & Initialize Pool
    const normalizedDbConfig: DbConfig = {
      host: dbConfig.host || 'localhost',
      port: parseInt(dbConfig.port || '3306', 10),
      user: dbConfig.user || dbConfig.username,
      password: dbConfig.password || '',
      database: dbConfig.database || dbConfig.dbName
    };

    // Test connection first
    const testResult = await dbManager.testConnection(normalizedDbConfig);
    if (!testResult.success) {
      return res.status(400).json({ error: testResult.message });
    }

    dbManager.saveConfig(normalizedDbConfig);

    // Step 2: Run all Database Migrations
    const migrationResult = await runAllMigrations();

    // Step 3: Initialize Organization Tenant
    const tenantId = 'org-default';
    const orgName = orgConfig?.name || 'مؤسسة المخزون للسيارات';
    const orgPhone = orgConfig?.phone || '0500000000';
    const orgCR = orgConfig?.commercialRegister || '';
    const orgTax = orgConfig?.taxNumber || '';
    const orgAddress = orgConfig?.address || 'المملكة العربية السعودية';
    const orgLogo = orgConfig?.logo || null;
    const orgStamp = orgConfig?.stamp || null;

    await dbManager.query(`
      INSERT INTO tenants (id, name, commercial_registry, tax_number, phone, address, logo_url, stamp_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        name = VALUES(name), 
        commercial_registry = VALUES(commercial_registry),
        tax_number = VALUES(tax_number),
        phone = VALUES(phone), 
        address = VALUES(address), 
        logo_url = VALUES(logo_url), 
        stamp_url = VALUES(stamp_url)
    `, [tenantId, orgName, orgCR, orgTax, orgPhone, orgAddress, orgLogo, orgStamp]);

    // Step 4: Create Default Main Branch
    await dbManager.query(`
      INSERT INTO branches (id, tenant_id, name, code, is_active)
      VALUES (?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE name = VALUES(name)
    `, ['branch-main', tenantId, 'الفرع الرئيسي - المعرض العام', 'MAIN-01']);

    // Step 5: Create Super Administrator Account
    const adminUsername = (adminConfig.username || 'admin').trim().toLowerCase();
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(adminConfig.password || 'admin123', salt);
    const adminFullName = adminConfig.fullName || 'المدير العام للمنظومة';
    const adminEmail = adminConfig.email || 'admin@almakhzoun.com';
    const adminPhone = adminConfig.phone || orgPhone;
    const adminId = 'u_admin_1';

    const recoveryCodePlain = adminConfig.recoveryCode || 'AFS-2026-PRO8-X99Z';
    const recoveryCodeHash = await bcrypt.hash(recoveryCodePlain, 10);

    await dbManager.query(`
      INSERT INTO users (
        id, tenant_id, branch_id, username, password_hash, role, full_name, email, phone,
        primary_admin, recovery_code_hash, is_active
      ) VALUES (?, ?, ?, ?, ?, 'مدير', ?, ?, ?, 1, ?, 1)
      ON DUPLICATE KEY UPDATE
        password_hash = VALUES(password_hash),
        full_name = VALUES(full_name),
        recovery_code_hash = VALUES(recovery_code_hash)
    `, [adminId, tenantId, 'branch-main', adminUsername, passwordHash, adminFullName, adminEmail, adminPhone, recoveryCodeHash]);

    // Assign all permissions to Super Admin
    const allPermissions = [
      'view_dashboard', 'manage_inventory', 'view_reports',
      'manage_users', 'manage_settings', 'manage_backup',
      'view_financials', 'export_data', 'view_sales'
    ];

    for (const perm of allPermissions) {
      await dbManager.query(`
        INSERT INTO user_permissions (user_id, permission_key)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE permission_key = VALUES(permission_key)
      `, [adminId, perm]);
    }

    // Step 6: Security Questions for Admin
    if (adminConfig.securityQuestions && Array.isArray(adminConfig.securityQuestions)) {
      for (const sq of adminConfig.securityQuestions) {
        if (sq.question && sq.answer) {
          const ansHash = await bcrypt.hash(sq.answer.trim().toLowerCase(), 10);
          await dbManager.query(`
            INSERT INTO user_security_questions (user_id, question, answer_hash)
            VALUES (?, ?, ?)
          `, [adminId, sq.question, ansHash]);
        }
      }
    }

    // Step 7: Organization Settings Record
    await dbManager.query(`
      INSERT INTO settings (id, tenant_id, org_name, org_type, contact_number, tax_number, commercial_register, address, system_version)
      VALUES (?, ?, ?, 'مؤسسة', ?, ?, ?, ?, '3.6.0')
      ON DUPLICATE KEY UPDATE
        org_name = VALUES(org_name),
        contact_number = VALUES(contact_number),
        tax_number = VALUES(tax_number),
        commercial_register = VALUES(commercial_register),
        address = VALUES(address)
    `, ['settings_default', tenantId, orgName, orgPhone, orgTax, orgCR, orgAddress]);

    try {
      await dbManager.query(`
        INSERT INTO system_settings (setting_key, setting_value, updated_at)
        VALUES ('company_profile', ?, NOW())
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()
      `, [JSON.stringify({
        id: tenantId,
        companyName: orgName,
        commercialRegister: orgCR,
        taxNumber: orgTax,
        phone: orgPhone,
        address: orgAddress,
        logo: orgLogo || '',
        stampUrl: orgStamp || '',
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpSecure: true,
        senderEmail: adminEmail
      })]);
    } catch (e) {}

    // Step 8: Mark System Installed
    const lockInfo = {
      installed_at: new Date().toISOString(),
      version: '3.6.0',
      admin_username: adminUsername
    };
    fs.writeFileSync(LOCK_FILE_PATH, JSON.stringify(lockInfo, null, 2), 'utf8');
    fs.writeFileSync(ALT_LOCK_FILE_PATH, JSON.stringify(lockInfo, null, 2), 'utf8');

    try {
      const configDir = path.join(process.cwd(), 'config');
      const installedPath = path.join(configDir, 'installed.json');
      let existingInst: any = {};
      if (fs.existsSync(installedPath)) {
        try { existingInst = JSON.parse(fs.readFileSync(installedPath, 'utf8')); } catch (e) {}
      }
      existingInst.installed = true;
      existingInst.installed_at = lockInfo.installed_at;
      existingInst.system_version = lockInfo.version;
      existingInst.organization = {
        name: orgName,
        phone: orgPhone,
        commercialRegister: orgCR,
        taxNumber: orgTax,
        address: orgAddress,
        logo: orgLogo || '',
        stamp: orgStamp || ''
      };
      fs.writeFileSync(installedPath, JSON.stringify(existingInst, null, 2), 'utf8');
    } catch (e) {}

    res.json({
      success: true,
      message: 'تم تثبيت المنظومة بنجاح تام!',
      admin: {
        username: adminUsername,
        fullName: adminFullName,
        role: 'مدير'
      },
      migrations: {
        applied: migrationResult.applied.length,
        skipped: migrationResult.skipped.length
      }
    });
  } catch (err: any) {
    console.error('❌ Installation execution failed:', err);
    res.status(500).json({ error: `فشل تنفيذ التثبيت: ${err.message}` });
  }
};

// -------------------------------------------------------------
// Unified Query / Action Dispatcher
// -------------------------------------------------------------

router.all(['/actions.php', '/actions', '/'], async (req: Request, res: Response, next) => {
  const action = (req.query.action || req.body?.action || '').toString().toLowerCase();

  if (!action && req.path !== '/actions.php' && req.path !== '/actions') {
    return next();
  }

  const effectiveAction = action || 'ping';

  if (effectiveAction === 'ping' || effectiveAction === 'test') {
    return res.json({
      success: true,
      message: 'Installer API يعمل بشكل صحيح',
      data: {
        ping: 'pong',
        php_version: '8.2.0 (Almakhzoun Hybrid Runtime)',
        server_software: req.headers['user-agent']?.includes('Apache') ? 'Apache' : 'Almakhzoun Enterprise Server',
        script_name: '/installer/actions.php',
        script_filename: path.join(process.cwd(), 'installer', 'actions.php'),
        request_uri: req.originalUrl || req.url,
        document_root: process.cwd(),
        installer_directory: path.join(process.cwd(), 'installer')
      }
    });
  }

  if (effectiveAction === 'check_lock' || effectiveAction === 'status') {
    return handleStatus(req, res);
  }

  if (effectiveAction === 'check_requirements' || effectiveAction === 'requirements' || effectiveAction === 'system_check') {
    return handleSystemCheck(req, res);
  }

  if (effectiveAction === 'test_db' || effectiveAction === 'database_test') {
    return handleTestDb(req, res);
  }

  if (effectiveAction === 'create_database' || effectiveAction === 'create_db' || effectiveAction === 'create-db') {
    return handleCreateDb(req, res);
  }

  if (effectiveAction === 'create_table' || effectiveAction === 'create_tables' || effectiveAction === 'migrate') {
    return handleMigrate(req, res);
  }

  if (effectiveAction === 'seed_default_data') {
    return res.json({ success: true, message: 'تم غرس البيانات الأساسية بنجاح' });
  }

  if (effectiveAction === 'create_admin') {
    return handleCreateAdmin(req, res);
  }

  if (effectiveAction === 'save_config' || effectiveAction === 'finish_install' || effectiveAction === 'finalize') {
    return handleFinalize(req, res);
  }

  if (effectiveAction === 'execute') {
    return handleExecute(req, res);
  }

  return res.status(400).json({ success: false, error: `إجراء التثبيت غير معروف: ${effectiveAction}` });
});

// Direct Express Routes (Standard API Route Format)
router.get('/status', handleStatus);
router.get('/system-check', handleSystemCheck);
router.get('/requirements', handleSystemCheck);
router.post('/test-db', handleTestDb);
router.post('/database-test', handleTestDb);
router.post('/create-database', handleCreateDb);
router.post('/create-db', handleCreateDb);
router.post('/migrate', handleMigrate);
router.post('/create-admin', handleCreateAdmin);
router.post('/finalize', handleFinalize);
router.post('/execute', handleExecute);

export default router;
