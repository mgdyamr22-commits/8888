import { Router, Request, Response } from 'express';
import { dbManager } from '../database/mysqlClient';
import { db } from '../database/db';
import { INITIAL_CARS } from '../../constants';

const router = Router();

const getJsonCars = (): any[] => {
  const raw = (db as any).getRawData ? (db as any).getRawData() : {};
  if (!Array.isArray(raw.cars) || raw.cars.length === 0) {
    if (Array.isArray(INITIAL_CARS) && INITIAL_CARS.length > 0) {
      raw.cars = JSON.parse(JSON.stringify(INITIAL_CARS));
      if ((db as any).rawSave) (db as any).rawSave();
    } else {
      raw.cars = [];
    }
  }
  return raw.cars;
};

// 1. GET Inventory aggregated summary
router.get('/inventory', async (req: Request, res: Response) => {
  try {
    if (!dbManager.hasPool()) {
      const cars = getJsonCars();
      const statusCountsMap: Record<string, { count: number; total_value: number; total_cost: number }> = {};
      const brandModelsMap: Record<string, { brand: string; model: string; year: number; color: string; status: string; count: number }> = {};

      cars.forEach((c: any) => {
        const st = c.status || 'متوفره';
        if (!statusCountsMap[st]) {
          statusCountsMap[st] = { count: 0, total_value: 0, total_cost: 0 };
        }
        statusCountsMap[st].count++;
        statusCountsMap[st].total_value += Number(c.price || 0);
        statusCountsMap[st].total_cost += Number(c.costPrice || 0);

        const bmKey = `${c.brand || ''}-${c.model || ''}-${c.year || ''}-${c.color || ''}-${st}`;
        if (!brandModelsMap[bmKey]) {
          brandModelsMap[bmKey] = {
            brand: c.brand || '',
            model: c.model || '',
            year: c.year || 2024,
            color: c.color || '',
            status: st,
            count: 0
          };
        }
        brandModelsMap[bmKey].count++;
      });

      const statusCounts = Object.entries(statusCountsMap).map(([status, val]) => ({
        status,
        ...val
      }));

      return res.json({
        success: true,
        data: {
          statusCounts,
          brandModels: Object.values(brandModelsMap)
        }
      });
    }

    const pool = dbManager.getPool();

    // Total counts by status
    const [statusCounts]: any = await pool.query(`
      SELECT status, COUNT(*) as count, SUM(price) as total_value, SUM(cost_price) as total_cost
      FROM cars
      GROUP BY status
    `);

    // Group by Brand and Model
    const [brandModels]: any = await pool.query(`
      SELECT brand, model, year, color, status, COUNT(*) as count
      FROM cars
      GROUP BY brand, model, year, color, status
      ORDER BY brand, model, year
    `);

    res.json({
      success: true,
      data: {
        statusCounts,
        brandModels
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. GET Daily movements report
router.get('/movements', async (req: Request, res: Response) => {
  try {
    const { fromDate, toDate } = req.query;

    if (!dbManager.hasPool()) {
      const raw = (db as any).getRawData ? (db as any).getRawData() : {};
      let movements = Array.isArray(raw.inventory_movements) ? raw.inventory_movements : [];
      if (fromDate) {
        movements = movements.filter((m: any) => String(m.timestamp || '').slice(0, 10) >= String(fromDate));
      }
      if (toDate) {
        movements = movements.filter((m: any) => String(m.timestamp || '').slice(0, 10) <= String(toDate));
      }
      return res.json({ success: true, data: movements });
    }

    const pool = dbManager.getPool();

    let sql = 'SELECT * FROM inventory_movements WHERE 1=1';
    const params: any[] = [];

    if (fromDate) {
      sql += ' AND timestamp >= ?';
      params.push(`${fromDate} 00:00:00`);
    }

    if (toDate) {
      sql += ' AND timestamp <= ?';
      params.push(`${toDate} 23:59:59`);
    }

    sql += ' ORDER BY timestamp DESC LIMIT 500';

    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. GET Sales and Profit Analytics
router.get('/sales', async (req: Request, res: Response) => {
  try {
    if (!dbManager.hasPool()) {
      const cars = getJsonCars();
      const soldCars = cars.filter((c: any) => c.status === 'مباعة' || c.status === 'خارج المعرض');
      const totalSales = soldCars.length;
      const totalRevenue = soldCars.reduce((acc: number, c: any) => acc + Number(c.price || 0), 0);
      const totalCost = soldCars.reduce((acc: number, c: any) => acc + Number(c.costPrice || 0), 0);
      const totalProfit = totalRevenue - totalCost;

      return res.json({
        success: true,
        data: [{
          total_sales_count: totalSales,
          total_revenue: totalRevenue,
          total_cost: totalCost,
          total_profit: totalProfit,
          sale_type: 'إجمالي المبيعات',
          count_by_type: totalSales
        }]
      });
    }

    const pool = dbManager.getPool();
    const [rows]: any = await pool.query(`
      SELECT
        COUNT(*) as total_sales_count,
        SUM(sale_price) as total_revenue,
        SUM(cost_price) as total_cost,
        SUM(profit) as total_profit,
        sale_type,
        COUNT(*) as count_by_type
      FROM sales
      GROUP BY sale_type WITH ROLLUP
    `);

    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
