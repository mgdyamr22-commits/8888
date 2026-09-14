import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { dbManager } from '../database/mysqlClient';

const router = Router();

const checkDb = (res: Response) => {
  if (!dbManager.hasPool()) {
    res.status(503).json({ error: 'قاعدة البيانات غير متصلة.' });
    return false;
  }
  return true;
};

// 1. Export Backup Snapshot
router.get('/export', async (req: Request, res: Response) => {
  if (!checkDb(res)) return;
  try {
    const pool = dbManager.getPool();

    const [tables]: any = await pool.query('SHOW TABLES');
    const tableNames: string[] = tables.map((t: any) => Object.values(t)[0] as string);

    const snapshot: Record<string, any[]> = {};
    let totalRecords = 0;

    for (const table of tableNames) {
      if (table === 'migration_history' || table === 'otp_logs') continue;
      const [rows]: any = await pool.query(`SELECT * FROM \`${table}\``);
      snapshot[table] = rows;
      totalRecords += rows.length;
    }

    const backupPayload = {
      system: 'Almakhzoun Inventory Pro Cloud',
      version: '3.6.0',
      exported_at: new Date().toISOString(),
      records_count: totalRecords,
      data: snapshot
    };

    // Record log
    await pool.query(`
      INSERT INTO backup_logs (id, backup_type, file_name, file_size_bytes, records_count, created_by)
      VALUES (?, 'MANUAL_WEB', ?, ?, ?, 'المشرف')
    `, [
      `bkg_${Date.now()}`,
      `almakhzoun_backup_${Date.now()}.json`,
      Buffer.byteLength(JSON.stringify(backupPayload)),
      totalRecords
    ]);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="almakhzoun_backup_${new Date().toISOString().split('T')[0]}.json"`);
    res.send(JSON.stringify(backupPayload, null, 2));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Restore Backup Snapshot
router.post('/restore', async (req: Request, res: Response) => {
  if (!checkDb(res)) return;
  try {
    const { data } = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'ملف النسخة الاحتياطية غير صالح.' });
    }

    await dbManager.transaction(async (conn) => {
      // Disable foreign key checks during restore
      await conn.query('SET FOREIGN_KEY_CHECKS = 0');

      for (const [table, rows] of Object.entries(data)) {
        if (!Array.isArray(rows) || rows.length === 0) continue;

        // Clear existing table data
        await conn.query(`DELETE FROM \`${table}\``);

        // Bulk insert
        for (const row of rows) {
          const keys = Object.keys(row);
          const values = Object.values(row);
          const placeholders = keys.map(() => '?').join(', ');
          const columns = keys.map(k => `\`${k}\``).join(', ');

          await conn.query(
            `INSERT INTO \`${table}\` (${columns}) VALUES (${placeholders})`,
            values
          );
        }
      }

      await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    });

    res.json({ success: true, message: 'تم استرجاع قاعدة البيانات السحابية بنجاح تام.' });
  } catch (err: any) {
    res.status(500).json({ error: `فشل الاسترجاع: ${err.message}` });
  }
});

export default router;
