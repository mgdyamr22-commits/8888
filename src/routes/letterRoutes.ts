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

// 1. GET letters archive
router.get('/', async (req: Request, res: Response) => {
  if (!checkDb(res)) return;
  try {
    const pool = dbManager.getPool();
    const [rows] = await pool.query('SELECT * FROM letters_archive ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. POST save letter
router.post('/', async (req: Request, res: Response) => {
  if (!checkDb(res)) return;
  try {
    const letter = req.body;
    const pool = dbManager.getPool();
    const letterId = letter.id || `letter_${Date.now()}`;

    await pool.query(`
      INSERT INTO letters_archive (
        id, tenant_id, letter_number, letter_type, letter_date, vin, plate_number,
        card_number, vehicle_name, driver_name, destination, created_by, html_content,
        manual_car_brand, manual_car_model, manual_car_year, manual_car_price
      ) VALUES (?, 'org-default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      letterId,
      letter.letter_number || `DOC-${Date.now().toString().slice(-6)}`,
      letter.letter_type || 'خطاب رسمي',
      letter.letter_date || new Date().toISOString().split('T')[0],
      letter.vin || null,
      letter.plate_number || null,
      letter.card_number || null,
      letter.vehicle_name || null,
      letter.driver_name || null,
      letter.destination || null,
      letter.created_by || 'النظام',
      letter.html_content || '',
      letter.manual_car_brand || null,
      letter.manual_car_model || null,
      letter.manual_car_year || null,
      letter.manual_car_price || null
    ]);

    res.json({ success: true, message: 'تم حفظ الخطاب في الأرشيف بنجاح', data: { id: letterId } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. DELETE letter
router.delete('/:id', async (req: Request, res: Response) => {
  if (!checkDb(res)) return;
  try {
    const { id } = req.params;
    const pool = dbManager.getPool();
    await pool.query('DELETE FROM letters_archive WHERE id = ?', [id]);
    res.json({ success: true, message: 'تم حذف الخطاب من الأرشيف بنجاح' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
