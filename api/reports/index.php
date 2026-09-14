<?php
/**
 * /api/reports
 * Aggregated analytics and reporting (Inventory, Movements, Sales, Profit)
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

use Almakhzoun\Database\Database;

$currentUser = requireAuth();
$type = $_GET['type'] ?? 'inventory';

try {
    if ($type === 'inventory') {
        $stats = Database::query('
            SELECT 
                brand, model, COUNT(*) as total_count,
                SUM(CASE WHEN status = "متوفره" THEN 1 ELSE 0 END) as available_count,
                SUM(CASE WHEN status = "مباعة" THEN 1 ELSE 0 END) as sold_count,
                SUM(CASE WHEN status = "محجوزة" THEN 1 ELSE 0 END) as reserved_count,
                SUM(CASE WHEN status = "محولة" THEN 1 ELSE 0 END) as transferred_count,
                SUM(price) as total_price,
                SUM(cost_price) as total_cost
            FROM cars
            GROUP BY brand, model
            ORDER BY brand ASC, model ASC
        ');
        jsonSuccess('Success', ['inventory' => $stats]);
    } else if ($type === 'movements') {
        $movements = Database::query('SELECT * FROM inventory_movements ORDER BY timestamp DESC LIMIT 200');
        jsonSuccess('Success', ['movements' => $movements]);
    } else if ($type === 'sales') {
        $salesStats = Database::query('
            SELECT 
                DATE_FORMAT(sale_date, "%Y-%m") as month,
                COUNT(*) as sales_count,
                SUM(sale_price) as total_revenue,
                SUM(cost_price) as total_cost,
                SUM(profit) as total_profit
            FROM sales
            GROUP BY DATE_FORMAT(sale_date, "%Y-%m")
            ORDER BY month DESC
        ');
        jsonSuccess('Success', ['salesSummary' => $salesStats]);
    } else {
        jsonError('نوع التقرير غير مدعوم.', 400);
    }
} catch (\Throwable $e) {
    jsonError('فشل استخراج التقرير: ' . $e->getMessage(), 500);
}
