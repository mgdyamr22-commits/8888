import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { dbManager } from '../database/mysqlClient';

const router = Router();

const checkDb = (res: Response) => {
  if (!dbManager.hasPool()) {
    res.status(503).json({ error: 'قاعدة البيانات غير متصلة.' });
    return false;
  }
  return true;
};

// 1. GET Organization Settings
router.get('/organization', async (req: Request, res: Response) => {
  if (!checkDb(res)) return;
  try {
    const pool = dbManager.getPool();
    const [settingsRows]: any = await pool.query('SELECT * FROM settings WHERE id = "settings_default" OR tenant_id = "org-default" LIMIT 1');
    const [tenantRows]: any = await pool.query('SELECT * FROM tenants WHERE id = "org-default" LIMIT 1');

    const setting = settingsRows[0] || {};
    const tenant = tenantRows[0] || {};

    const merged = {
      name: tenant.name || setting.org_name || 'مؤسسة المخزون',
      phone: tenant.phone || setting.contact_number || '',
      email: tenant.email || '',
      commercialRegister: tenant.commercial_registry || setting.commercial_register || '',
      taxNumber: tenant.tax_number || setting.tax_number || '',
      address: tenant.address || setting.address || '',
      logo: tenant.logo_url || null,
      stamp: tenant.stamp_url || null,
      declarationText: setting.declaration_text || '',
      declarationTextPlural: setting.declaration_text_plural || '',
      customFields: setting.custom_fields_config ? (typeof setting.custom_fields_config === 'string' ? JSON.parse(setting.custom_fields_config) : setting.custom_fields_config) : [],
      columnVisibility: setting.column_visibility_config ? (typeof setting.column_visibility_config === 'string' ? JSON.parse(setting.column_visibility_config) : setting.column_visibility_config) : {},
      exitPermitSettings: setting.exit_permit_settings ? (typeof setting.exit_permit_settings === 'string' ? JSON.parse(setting.exit_permit_settings) : setting.exit_permit_settings) : {}
    };

    res.json({ success: true, data: merged });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. PUT Update Organization Settings
router.put('/organization', async (req: Request, res: Response) => {
  if (!checkDb(res)) return;
  try {
    const data = req.body;
    const pool = dbManager.getPool();

    await pool.query(`
      UPDATE tenants SET
        name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        commercial_registry = COALESCE(?, commercial_registry),
        tax_number = COALESCE(?, tax_number),
        address = COALESCE(?, address),
        logo_url = COALESCE(?, logo_url),
        stamp_url = COALESCE(?, stamp_url)
      WHERE id = 'org-default'
    `, [
      data.name, data.phone, data.email, data.commercialRegister,
      data.taxNumber, data.address, data.logo, data.stamp
    ]);

    await pool.query(`
      UPDATE settings SET
        org_name = COALESCE(?, org_name),
        contact_number = COALESCE(?, contact_number),
        commercial_register = COALESCE(?, commercial_register),
        tax_number = COALESCE(?, tax_number),
        address = COALESCE(?, address),
        declaration_text = COALESCE(?, declaration_text),
        declaration_text_plural = COALESCE(?, declaration_text_plural),
        custom_fields_config = COALESCE(?, custom_fields_config),
        column_visibility_config = COALESCE(?, column_visibility_config),
        exit_permit_settings = COALESCE(?, exit_permit_settings)
      WHERE id = 'settings_default' OR tenant_id = 'org-default'
    `, [
      data.name, data.phone, data.commercialRegister, data.taxNumber, data.address,
      data.declarationText, data.declarationTextPlural,
      data.customFields ? JSON.stringify(data.customFields) : null,
      data.columnVisibility ? JSON.stringify(data.columnVisibility) : null,
      data.exitPermitSettings ? JSON.stringify(data.exitPermitSettings) : null
    ]);

    res.json({ success: true, message: 'تم حفظ إعدادات المؤسسة بنجاح' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. GET / PUT User Layout Preferences
router.get('/user-layout', async (req: Request, res: Response) => {
  if (!checkDb(res)) return;
  try {
    const { userId, tableKey } = req.query;
    if (!userId || !tableKey) {
      return res.json({ success: true, data: null });
    }

    const pool = dbManager.getPool();
    const [rows]: any = await pool.query(
      'SELECT layout_json FROM user_layout_preferences WHERE user_id = ? AND table_key = ?',
      [userId, tableKey]
    );

    const layout = rows[0]?.layout_json ? (typeof rows[0].layout_json === 'string' ? JSON.parse(rows[0].layout_json) : rows[0].layout_json) : null;
    res.json({ success: true, data: layout });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/user-layout', async (req: Request, res: Response) => {
  if (!checkDb(res)) return;
  try {
    const { userId, tableKey, layout } = req.body;
    if (!userId || !tableKey || !layout) {
      return res.status(400).json({ error: 'البيانات غير مكتملة' });
    }

    const pool = dbManager.getPool();
    const jsonStr = JSON.stringify(layout);

    await pool.query(`
      INSERT INTO user_layout_preferences (user_id, table_key, layout_json)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE layout_json = VALUES(layout_json)
    `, [userId, tableKey, jsonStr]);

    res.json({ success: true, message: 'تم حفظ ترتيب الأعمدة بنجاح' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. GET Users list
router.get('/users', async (req: Request, res: Response) => {
  if (!checkDb(res)) return;
  try {
    const pool = dbManager.getPool();
    const [users]: any = await pool.query('SELECT id, tenant_id, branch_id, username, role, full_name, email, phone, is_active, created_at, last_login FROM users');

    for (const u of users) {
      const [permRows]: any = await pool.query('SELECT permission_key FROM user_permissions WHERE user_id = ?', [u.id]);
      u.permissions = permRows.map((p: any) => p.permission_key);
    }

    res.json({ success: true, data: users });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. POST Create User
router.post('/users', async (req: Request, res: Response) => {
  if (!checkDb(res)) return;
  try {
    const { username, password, fullName, email, phone, role, permissions, branch_id } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبة' });
    }

    const pool = dbManager.getPool();
    const userId = `u_${Date.now()}`;
    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(`
      INSERT INTO users (id, tenant_id, branch_id, username, password_hash, role, full_name, email, phone, is_active)
      VALUES (?, 'org-default', ?, ?, ?, ?, ?, ?, ?, 1)
    `, [userId, branch_id || 'branch-main', username.trim().toLowerCase(), passwordHash, role || 'موظف', fullName || '', email || '', phone || '']);

    if (permissions && Array.isArray(permissions)) {
      for (const p of permissions) {
        await pool.query('INSERT INTO user_permissions (user_id, permission_key) VALUES (?, ?)', [userId, p]);
      }
    }

    res.json({ success: true, message: 'تم إضافة المستخدم بنجاح', data: { id: userId, username } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. DELETE User
router.delete('/users/:id', async (req: Request, res: Response) => {
  if (!checkDb(res)) return;
  try {
    const { id } = req.params;
    const pool = dbManager.getPool();

    // Check if primary admin
    const [rows]: any = await pool.query('SELECT primary_admin FROM users WHERE id = ?', [id]);
    if (rows[0]?.primary_admin) {
      return res.status(403).json({ error: 'لا يمكن حذف حساب المشرف الرئيسي للمنظومة.' });
    }

    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true, message: 'تم حذف المستخدم بنجاح' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
