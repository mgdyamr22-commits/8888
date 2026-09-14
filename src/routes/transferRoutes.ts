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

// 1. GET all transfers
router.get('/', async (req: Request, res: Response) => {
  if (!checkDb(res)) return;
  try {
    const pool = dbManager.getPool();
    const [transfers]: any = await pool.query('SELECT * FROM transfers ORDER BY transfer_date DESC');
    
    for (const trf of transfers) {
      const [items]: any = await pool.query('SELECT * FROM transfer_items WHERE transfer_id = ?', [trf.id]);
      trf.cars = items || [];
    }

    res.json({ success: true, data: transfers });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. POST create transfer
router.post('/', async (req: Request, res: Response) => {
  if (!checkDb(res)) return;
  try {
    const {
      transfer_no,
      source_company_name,
      dest_company_name,
      driver_name,
      driver_phone,
      driver_id,
      sender_user,
      notes,
      cars
    } = req.body;

    if (!transfer_no || !source_company_name || !dest_company_name || !cars || !cars.length) {
      return res.status(400).json({ error: 'بيانات التحويل والسيارات المختارة مطلوبة.' });
    }

    const transferId = `trf_${Date.now()}`;

    await dbManager.transaction(async (conn) => {
      // 1. Insert Transfer Header
      await conn.query(`
        INSERT INTO transfers (
          id, transfer_no, source_company_name, dest_company_name, status,
          driver_name, driver_phone, driver_id, sender_user, notes, transfer_date
        ) VALUES (?, ?, ?, ?, 'قيد النقل', ?, ?, ?, ?, ?, NOW())
      `, [
        transferId,
        transfer_no,
        source_company_name,
        dest_company_name,
        driver_name || null,
        driver_phone || null,
        driver_id || null,
        sender_user || 'مسؤول فرع',
        notes || null
      ]);

      // 2. Insert items and update car statuses
      for (const c of cars) {
        await conn.query(`
          INSERT INTO transfer_items (transfer_id, car_id, vin, brand, model, year, color, price)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          transferId,
          c.id || c.car_id,
          c.vin,
          c.brand || '',
          c.model || '',
          c.year || 0,
          c.color || '',
          c.price || 0
        ]);

        await conn.query(`
          UPDATE cars SET
            status = 'قيد التحويل',
            transfer_sender = ?,
            transfer_receiver = ?,
            transfer_no = ?,
            transfer_date = NOW()
          WHERE id = ? OR vin = ?
        `, [source_company_name, dest_company_name, transfer_no, c.id || '', c.vin || '']);

        await conn.query(`
          INSERT INTO inventory_movements (id, car_id, vin, movement_type, prev_status, new_status, user, details)
          VALUES (?, ?, ?, 'تحويل سيارة', 'متوفره', 'قيد التحويل', ?, ?)
        `, [
          `mov_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          c.id || '',
          c.vin,
          sender_user || 'مسؤول تحويل',
          `تحويل صادر برقم سند ${transfer_no} من ${source_company_name} إلى ${dest_company_name}`
        ]);
      }
    });

    res.json({ success: true, message: 'تم إنشاء سند التحويل بنجاح', data: { id: transferId, transfer_no } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. POST receive transfer
router.post('/:id/receive', async (req: Request, res: Response) => {
  if (!checkDb(res)) return;
  try {
    const { id } = req.params;
    const { receiver_user, notes } = req.body;

    await dbManager.transaction(async (conn) => {
      const [trfRows]: any = await conn.query('SELECT * FROM transfers WHERE id = ? OR transfer_no = ?', [id, id]);
      if (!trfRows || trfRows.length === 0) {
        throw new Error('سند التحويل غير موجود.');
      }
      const trf = trfRows[0];

      // Update transfer status
      await conn.query(`
        UPDATE transfers SET
          status = 'تم الاستلام',
          receive_date = NOW(),
          receiver_user = ?,
          notes = CONCAT(COALESCE(notes, ''), ' [استلام: ', ?, ']')
        WHERE id = ?
      `, [receiver_user || 'مسؤول استلام', notes || 'تم تأكيد الاستلام', trf.id]);

      // Get items and update cars
      const [items]: any = await conn.query('SELECT * FROM transfer_items WHERE transfer_id = ?', [trf.id]);
      for (const itm of items) {
        await conn.query(`
          UPDATE cars SET
            status = 'متوفره',
            is_present_in_showroom = 1
          WHERE id = ? OR vin = ?
        `, [itm.car_id, itm.vin]);

        await conn.query(`
          INSERT INTO inventory_movements (id, car_id, vin, movement_type, prev_status, new_status, user, details)
          VALUES (?, ?, ?, 'استلام تحويل', 'قيد التحويل', 'متوفره', ?, ?)
        `, [
          `mov_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          itm.car_id,
          itm.vin,
          receiver_user || 'مسؤول استلام',
          `تم تأكيد استلام المركبة في ${trf.dest_company_name}`
        ]);
      }
    });

    res.json({ success: true, message: 'تم تأكيد استلام السيارات بنجاح وتحديث حالتها في المعرض المستلم.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
