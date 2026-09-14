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

// 1. GET all sales
router.get('/', async (req: Request, res: Response) => {
  if (!checkDb(res)) return;
  try {
    const pool = dbManager.getPool();
    const sql = `
      SELECT s.*, c.brand, c.model, c.year, c.color, c.vin, c.plate_number
      FROM sales s
      LEFT JOIN cars c ON s.car_id = c.id
      ORDER BY s.sale_date DESC
    `;
    const [rows] = await pool.query(sql);
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. POST create sale (Atomic Transaction)
router.post('/', async (req: Request, res: Response) => {
  if (!checkDb(res)) return;
  try {
    const saleData = req.body;
    const {
      car_id,
      customer_name,
      customer_phone,
      customer_id_number,
      sale_price,
      cost_price,
      profit,
      sale_type,
      bank_name,
      seller_name,
      delegate_name,
      delivery_type,
      transport_company,
      notes,
      user
    } = saleData;

    if (!car_id || !customer_name || !customer_phone) {
      return res.status(400).json({ error: 'بيانات البيع والمشتري غير مكتملة.' });
    }

    const saleId = `sale_${Date.now()}`;

    await dbManager.transaction(async (conn) => {
      // 1. Update car status to sold and record exit
      const [updateRes]: any = await conn.query(`
        UPDATE cars SET
          status = 'مباعة',
          is_outbound = 1,
          is_present_in_showroom = 0,
          exit_type = 'بيع مباشر',
          seller = ?
        WHERE id = ? AND status != 'مباعة'
      `, [seller_name || user || 'مسؤول بيع', car_id]);

      if (updateRes.affectedRows === 0) {
        throw new Error('السيارة مباعة مسبقاً أو غير موجودة.');
      }

      // 2. Insert exit data
      await conn.query(`
        INSERT INTO car_exit_data (
          car_id, receiver_name, receiver_phone, receiver_id, delivery_type,
          transport_company, exit_date, seller, sale_type, bank_name, representative_name, notes
        ) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          receiver_name = VALUES(receiver_name),
          receiver_phone = VALUES(receiver_phone),
          exit_date = NOW()
      `, [
        car_id,
        customer_name,
        customer_phone,
        customer_id_number || '',
        delivery_type || 'صاحبها',
        transport_company || null,
        seller_name || user || null,
        sale_type || 'كاش',
        bank_name || null,
        delegate_name || null,
        notes || null
      ]);

      // 3. Insert sales record
      await conn.query(`
        INSERT INTO sales (
          id, tenant_id, branch_id, car_id, customer_name, customer_phone, customer_id_number,
          sale_price, cost_price, profit, sale_type, bank_name, seller_name, delegate_name,
          delivery_type, transport_company, sale_date, notes, created_by_user_id
        ) VALUES (?, 'org-default', 'branch-main', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)
      `, [
        saleId,
        car_id,
        customer_name,
        customer_phone,
        customer_id_number || '',
        parseFloat(sale_price || '0'),
        parseFloat(cost_price || '0'),
        parseFloat(profit || '0'),
        sale_type || 'كاش',
        bank_name || null,
        seller_name || null,
        delegate_name || null,
        delivery_type || 'صاحبها',
        transport_company || null,
        notes || null,
        user || null
      ]);

      // 4. Record Movement
      const [carRows]: any = await conn.query('SELECT vin, brand, model FROM cars WHERE id = ?', [car_id]);
      const vin = carRows[0]?.vin || '';
      await conn.query(`
        INSERT INTO inventory_movements (id, car_id, vin, movement_type, prev_status, new_status, user, details)
        VALUES (?, ?, ?, 'بيع سيارة', 'متوفره', 'مباعة', ?, ?)
      `, [
        `mov_${Date.now()}`,
        car_id,
        vin,
        user || seller_name || 'مسؤول بيع',
        `تم بيع المركبة ${carRows[0]?.brand || ''} ${carRows[0]?.model || ''} لصالح ${customer_name}`
      ]);
    });

    res.json({ success: true, message: 'تم إتمام عملية البيع بنجاح', data: { saleId } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. POST Return to stock (Cancel Sale)
router.post('/:id/return-to-stock', async (req: Request, res: Response) => {
  if (!checkDb(res)) return;
  try {
    const { id } = req.params; // sale_id or car_id
    const { user, reason } = req.body;

    await dbManager.transaction(async (conn) => {
      // Find sale
      const [saleRows]: any = await conn.query('SELECT * FROM sales WHERE id = ? OR car_id = ?', [id, id]);
      if (!saleRows || saleRows.length === 0) {
        throw new Error('سجل البيع غير موجود.');
      }
      const sale = saleRows[0];
      const carId = sale.car_id;

      // Restore car status
      await conn.query(`
        UPDATE cars SET
          status = 'متوفره',
          is_outbound = 0,
          is_present_in_showroom = 1,
          exit_type = NULL,
          seller = NULL
        WHERE id = ?
      `, [carId]);

      // Remove / archive sale record
      await conn.query('DELETE FROM sales WHERE id = ?', [sale.id]);
      await conn.query('DELETE FROM car_exit_data WHERE car_id = ?', [carId]);

      // Record movement
      const [carRows]: any = await conn.query('SELECT vin FROM cars WHERE id = ?', [carId]);
      const vin = carRows[0]?.vin || '';
      await conn.query(`
        INSERT INTO inventory_movements (id, car_id, vin, movement_type, prev_status, new_status, user, details)
        VALUES (?, ?, ?, 'إلغاء بيع وإرجاع للمخزون', 'مباعة', 'متوفره', ?, ?)
      `, [
        `mov_${Date.now()}`,
        carId,
        vin,
        user || 'مشرف',
        `تم إلغاء البيع وإعادة السيارة للمخزون. السبب: ${reason || 'إلغاء بناء على طلب الإدارة'}`
      ]);
    });

    res.json({ success: true, message: 'تم إلغاء البيع وإرجاع السيارة إلى المخزون بنجاح' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
