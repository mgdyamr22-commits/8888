<?php
/**
 * /api/costs
 * GET, POST, PUT, DELETE for Vehicle Financial Costs
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

use Almakhzoun\Database\Database;

$currentUser = requireAuth();
$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        $costs = Database::query('SELECT * FROM vehicle_costs ORDER BY entry_date DESC');
        foreach ($costs as &$c) {
            $c['purchasePrice'] = (float)$c['purchase_price'];
            $c['shippingExpense'] = (float)$c['shipping_expense'];
            $c['clearanceExpense'] = (float)$c['clearance_expense'];
            $c['transportExpense'] = (float)$c['transport_expense'];
            $c['otherExpense'] = (float)$c['other_expense'];
            $c['totalCost'] = (float)$c['total_cost'];
            $c['carName'] = $c['car_name'];
            $c['entryDate'] = $c['entry_date'];
            $c['isArchived'] = (bool)$c['is_archived'];
        }
        jsonSuccess('Success', ['costs' => $costs, 'count' => count($costs)]);
    } else if ($method === 'POST') {
        $body = getJsonBody();
        $carName = trim($body['carName'] ?? $body['car_name'] ?? '');
        $vin = strtoupper(trim($body['vin'] ?? ''));
        $purchasePrice = (float)($body['purchasePrice'] ?? $body['purchase_price'] ?? 0);
        $shippingExpense = (float)($body['shippingExpense'] ?? $body['shipping_expense'] ?? 0);
        $clearanceExpense = (float)($body['clearanceExpense'] ?? $body['clearance_expense'] ?? 0);
        $transportExpense = (float)($body['transportExpense'] ?? $body['transport_expense'] ?? 0);
        $otherExpense = (float)($body['otherExpense'] ?? $body['other_expense'] ?? 0);
        $totalCost = $purchasePrice + $shippingExpense + $clearanceExpense + $transportExpense + $otherExpense;
        $supplier = trim($body['supplier'] ?? '');
        $entryDate = $body['entryDate'] ?? $body['entry_date'] ?? date('Y-m-d');
        $notes = trim($body['notes'] ?? '');

        if (empty($carName) || empty($vin)) {
            jsonError('اسم السيارة ورقم الهيكل مطلوبان لتسجيل التكاليف.', 400);
        }

        $id = 'cost_' . bin2hex(random_bytes(8));
        Database::execute('
            INSERT INTO vehicle_costs (
                id, tenant_id, car_name, vin, purchase_price, shipping_expense,
                clearance_expense, transport_expense, other_expense, total_cost,
                supplier, entry_date, notes, created_at
            ) VALUES (?, "org-default", ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ', [
            $id, $carName, $vin, $purchasePrice, $shippingExpense,
            $clearanceExpense, $transportExpense, $otherExpense, $totalCost,
            $supplier, $entryDate, $notes
        ]);

        logAudit('CREATE_COST', $id, 'vehicle_costs', "تسجيل تكاليف لسيارة: {$carName} ({$vin}) بمجموع {$totalCost}");
        jsonSuccess('تم حفظ بيان التكاليف بنجاح.', ['costId' => $id]);
    } else if ($method === 'DELETE') {
        $id = $_GET['id'] ?? '';
        if (empty($id)) {
            jsonError('معرف التكلفة مطلوب.', 400);
        }

        Database::execute('DELETE FROM vehicle_costs WHERE id = ?', [$id]);
        logAudit('DELETE_COST', $id, 'vehicle_costs', "حذف تكلفة: {$id}");
        jsonSuccess('تم حذف السجل بنجاح.');
    } else {
        jsonError('Method Not Allowed', 405);
    }
} catch (\Throwable $e) {
    jsonError('حدث خطأ أثناء معالجة بيانات التكاليف: ' . $e->getMessage(), 500);
}
