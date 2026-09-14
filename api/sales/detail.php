<?php
/**
 * /api/sales/detail
 * DELETE / PUT for Sales (including return to stock)
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

use Almakhzoun\Database\Database;

$currentUser = requireAuth();
$method = $_SERVER['REQUEST_METHOD'];

try {
    $saleId = $_GET['id'] ?? '';
    if (empty($saleId)) {
        $body = getJsonBody();
        $saleId = $body['id'] ?? $body['saleId'] ?? '';
    }

    if (empty($saleId)) {
        jsonError('معرف المبايعة مطلوب.', 400);
    }

    if ($method === 'DELETE' || (isset($_GET['action']) && $_GET['action'] === 'return-to-stock')) {
        requireAdmin();
        $sale = Database::queryOne('SELECT * FROM sales WHERE id = ?', [$saleId]);
        if (!$sale) {
            jsonError('المبايعة غير موجودة.', 404);
        }

        $carId = $sale['car_id'];

        Database::transaction(function ($pdo) use ($saleId, $carId, $currentUser) {
            // Delete sale
            $pdo->prepare('DELETE FROM sales WHERE id = ?')->execute([$saleId]);

            // Return car to available status
            $pdo->prepare('UPDATE cars SET status = "متوفره", is_outbound = 0, is_present_in_showroom = 1 WHERE id = ?')->execute([$carId]);

            // Add movement
            $car = Database::queryOne('SELECT vin FROM cars WHERE id = ?', [$carId]);
            $pdo->prepare('
                INSERT INTO inventory_movements (id, tenant_id, branch_id, car_id, vin, movement_type, prev_status, new_status, user, details, timestamp)
                VALUES (?, "org-default", NULL, ?, ?, "إرجاع_للمخزون", "مباعة", "متوفره", ?, "إلغاء المبايعة وإرجاع السيارة للمخزون", NOW())
            ')->execute(['mov_' . bin2hex(random_bytes(8)), $carId, $car['vin'] ?? '', $currentUser['username']]);
        });

        logAudit('CANCEL_SALE', $saleId, 'sales', "إلغاء مبايعة وإرجاع السيارة ({$carId}) للمخزون");
        jsonSuccess('تم إلغاء المبايعة وإرجاع السيارة إلى المخزون بنجاح.');
    } else {
        jsonError('Method Not Allowed', 405);
    }
} catch (\Throwable $e) {
    jsonError('حدث خطأ أثناء معالجة المبايعة: ' . $e->getMessage(), 500);
}
