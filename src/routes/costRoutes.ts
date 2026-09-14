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

// 1. GET vehicle costs
router.get('/', async (req: Request, res: Response) => {
  if (!checkDb(res)) return;
  try {
    const pool = dbManager.getPool();
    const [rows] = await pool.query('SELECT * FROM vehicle_costs ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. POST create cost record
router.post('/', async (req: Request, res: Response) => {
  if (!checkDb(res)) return;
  try {
    const cost = req.body;
    const pool = dbManager.getPool();
    const costId = cost.id || `cost_${Date.now()}`;

    const purchase = parseFloat(cost.purchase_price || '0');
    const shipping = parseFloat(cost.shipping_expense || '0');
    const clearance = parseFloat(cost.clearance_expense || '0');
    const transport = parseFloat(cost.transport_expense || '0');
    const other = parseFloat(cost.other_expense || '0');
    const total = purchase + shipping + clearance + transport + other;

    await pool.query(`
      INSERT INTO vehicle_costs (
        id, tenant_id, car_id, car_name, vin, purchase_price, shipping_expense,
        clearance_expense, transport_expense, other_expense, total_cost, supplier, entry_date, notes
      ) VALUES (?, 'org-default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      costId,
      cost.car_id || null,
      cost.car_name || '',
      cost.vin || '',
      purchase,
      shipping,
      clearance,
      transport,
      other,
      total,
      cost.supplier || null,
      cost.entry_date || new Date().toISOString().split('T')[0],
      cost.notes || null
    ]);

    // If car_id or vin provided, update cost_price on cars table
    if (cost.vin) {
      await pool.query('UPDATE cars SET cost_price = ? WHERE vin = ?', [total, cost.vin]);
    }

    res.json({ success: true, message: 'تم حفظ قيد التكلفة بنجاح', data: { id: costId, total_cost: total } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. DELETE or archive cost
router.delete('/:id', async (req: Request, res: Response) => {
  if (!checkDb(res)) return;
  try {
    const { id } = req.params;
    const pool = dbManager.getPool();
    await pool.query('DELETE FROM vehicle_costs WHERE id = ?', [id]);
    res.json({ success: true, message: 'تم حذف قيد التكلفة بنجاح' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
