import { Router, Request, Response } from 'express';
import { dbManager } from '../database/mysqlClient';

const router = Router();

const checkDb = (res: Response) => {
  if (!dbManager.hasPool()) {
    res.status(503).json({ error: 'قاعدة البيانات غير متصلة.' });
    return false;
  }
  return true;
};

// 1. GET customers list
router.get('/', async (req: Request, res: Response) => {
  if (!checkDb(res)) return;
  try {
    const { type, search } = req.query;
    const pool = dbManager.getPool();

    let sql = 'SELECT * FROM customers WHERE 1=1';
    const params: any[] = [];

    if (type && type !== 'all') {
      sql += ' AND type = ?';
      params.push(type);
    }

    if (search) {
      sql += ' AND (name LIKE ? OR phone LIKE ? OR national_id LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    sql += ' ORDER BY created_at DESC';

    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. GET quick lookup by phone or national_id
router.get('/lookup', async (req: Request, res: Response) => {
  if (!checkDb(res)) return;
  try {
    const { query } = req.query;
    if (!query) {
      return res.json({ success: true, data: [] });
    }

    const pool = dbManager.getPool();
    const q = `%${query}%`;
    const [rows] = await pool.query(`
      SELECT * FROM customers
      WHERE phone LIKE ? OR national_id LIKE ? OR name LIKE ?
      LIMIT 10
    `, [q, q, q]);

    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. POST add customer
router.post('/', async (req: Request, res: Response) => {
  if (!checkDb(res)) return;
  try {
    const { name, phone, national_id, type } = req.body;
    if (!name || !phone || !national_id) {
      return res.status(400).json({ error: 'الاسم ورقم الهاتف ورقم الهوية حقول إلزامية.' });
    }

    const pool = dbManager.getPool();
    const customerId = `cust_${Date.now()}`;

    await pool.query(`
      INSERT INTO customers (id, tenant_id, name, phone, national_id, type)
      VALUES (?, 'org-default', ?, ?, ?, ?)
    `, [customerId, name, phone, national_id, type || 'عميل']);

    res.json({ success: true, message: 'تم حفظ العميل بنجاح', data: { id: customerId, name, phone, national_id, type } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. PUT update customer
router.put('/:id', async (req: Request, res: Response) => {
  if (!checkDb(res)) return;
  try {
    const { id } = req.params;
    const { name, phone, national_id, type } = req.body;
    const pool = dbManager.getPool();

    await pool.query(`
      UPDATE customers SET
        name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        national_id = COALESCE(?, national_id),
        type = COALESCE(?, type)
      WHERE id = ?
    `, [name, phone, national_id, type, id]);

    res.json({ success: true, message: 'تم تحديث بيانات العميل بنجاح' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. DELETE customer
router.delete('/:id', async (req: Request, res: Response) => {
  if (!checkDb(res)) return;
  try {
    const { id } = req.params;
    const pool = dbManager.getPool();
    await pool.query('DELETE FROM customers WHERE id = ?', [id]);
    res.json({ success: true, message: 'تم حذف العميل بنجاح' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
