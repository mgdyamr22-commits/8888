<?php
/**
 * /api/sales
 * GET: List all vehicle sales with customer details and profit margins
 * POST: Create a new sale transaction with atomic lock
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

use Almakhzoun\Database\Database;

$currentUser = requireAuth();
$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        $branchId = $_GET['branchId'] ?? null;
        $sql = 'SELECT s.*, c.brand, c.model, c.year, c.color, c.vin, c.card_number FROM sales s LEFT JOIN cars c ON s.car_id = c.id WHERE 1=1';
        $params = [];

        if (!empty($branchId)) {
            $sql .= ' AND s.branch_id = ?';
            $params[] = $branchId;
        }

        $sql .= ' ORDER BY s.sale_date DESC';
        $sales = Database::query($sql, $params);

        foreach ($sales as &$s) {
            $s['salePrice'] = (float)$s['sale_price'];
            $s['costPrice'] = (float)$s['cost_price'];
            $s['profit'] = (float)$s['profit'];
            $s['customerName'] = $s['customer_name'];
            $s['customerPhone'] = $s['customer_phone'];
            $s['customerIdNumber'] = $s['customer_id_number'];
            $s['saleType'] = $s['sale_type'];
            $s['bankName'] = $s['bank_name'];
            $s['sellerName'] = $s['seller_name'];
            $s['delegateName'] = $s['delegate_name'];
            $s['saleDate'] = $s['sale_date'];
        }

        jsonSuccess('Success', ['sales' => $sales, 'count' => count($sales)]);
    } else if ($method === 'POST') {
        $body = getJsonBody();
        $carId = $body['carId'] ?? $body['car_id'] ?? '';
        $customerName = trim($body['customerName'] ?? $body['customer_name'] ?? '');
        $customerPhone = trim($body['customerPhone'] ?? $body['customer_phone'] ?? '');
        $customerIdNumber = trim($body['customerIdNumber'] ?? $body['customer_id_number'] ?? '');
        $salePrice = (float)($body['salePrice'] ?? $body['sale_price'] ?? 0);
        $costPrice = (float)($body['costPrice'] ?? $body['cost_price'] ?? 0);
        $saleType = trim($body['saleType'] ?? $body['sale_type'] ?? 'كاش');
        $bankName = trim($body['bankName'] ?? $body['bank_name'] ?? '');
        $sellerName = trim($body['sellerName'] ?? $body['seller_name'] ?? $currentUser['full_name'] ?? $currentUser['username']);
        $delegateName = trim($body['delegateName'] ?? $body['delegate_name'] ?? '');
        $deliveryType = trim($body['deliveryType'] ?? 'صاحبها');
        $transportCompany = trim($body['transportCompany'] ?? '');
        $notes = trim($body['notes'] ?? '');

        if (empty($carId) || empty($customerName)) {
            jsonError('معرف السيارة واسم العميل مطلوبان لتسجيل المبايعة.', 400);
        }

        $saleId = 'sale_' . bin2hex(random_bytes(8));
        $profit = $salePrice - $costPrice;
        $tenantId = $currentUser['tenant_id'] ?? 'org-default';
        $branchId = $currentUser['branch_id'];

        Database::transaction(function ($pdo) use ($saleId, $tenantId, $branchId, $carId, $customerName, $customerPhone, $customerIdNumber, $salePrice, $costPrice, $profit, $saleType, $bankName, $sellerName, $delegateName, $deliveryType, $transportCompany, $notes, $currentUser) {
            // Check car availability
            $stmt = $pdo->prepare('SELECT status, vin FROM cars WHERE id = ? FOR UPDATE');
            $stmt->execute([$carId]);
            $car = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$car) {
                throw new \RuntimeException('السيارة غير موجودة.');
            }

            if ($car['status'] === 'مباعة') {
                throw new \RuntimeException('هذه السيارة تم بيعها مسبقاً.');
            }

            // Insert customer if not exists
            $custStmt = $pdo->prepare('
                INSERT INTO customers (id, tenant_id, name, phone, national_id, type, created_at)
                VALUES (?, ?, ?, ?, ?, "عميل", NOW())
                ON DUPLICATE KEY UPDATE name = VALUES(name), phone = VALUES(phone)
            ');
            $custId = 'cust_' . bin2hex(random_bytes(8));
            $custStmt->execute([$custId, $tenantId, $customerName, $customerPhone, $customerIdNumber]);

            // Insert sale record
            $saleStmt = $pdo->prepare('
                INSERT INTO sales (
                    id, tenant_id, branch_id, car_id, customer_id, customer_name, customer_phone,
                    customer_id_number, sale_price, cost_price, profit, sale_type, bank_name,
                    seller_name, delegate_name, delivery_type, transport_company, sale_date, notes, created_by_user_id
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, NOW(), ?, ?
                )
            ');
            $saleStmt->execute([
                $saleId, $tenantId, $branchId, $carId, $custId, $customerName, $customerPhone,
                $customerIdNumber, $salePrice, $costPrice, $profit, $saleType, $bankName,
                $sellerName, $delegateName, $deliveryType, $transportCompany, $notes, $currentUser['id']
            ]);

            // Update car status to sold
            $pdo->prepare('UPDATE cars SET status = "مباعة", price = ?, is_present_in_showroom = 0, is_outbound = 1 WHERE id = ?')->execute([$salePrice, $carId]);

            // Insert movement log
            $pdo->prepare('
                INSERT INTO inventory_movements (id, tenant_id, branch_id, car_id, vin, movement_type, prev_status, new_status, user, details, timestamp)
                VALUES (?, ?, ?, ?, ?, "مبايعة", ?, "مباعة", ?, ?, NOW())
            ')->execute(['mov_' . bin2hex(random_bytes(8)), $tenantId, $branchId, $carId, $car['vin'], $car['status'], $currentUser['username'], "مبايعة للعميل: {$customerName} بسعر {$salePrice}"]);
        });

        logAudit('CREATE_SALE', $saleId, 'sales', "تسجيل مبايعة جديدة للسيارة: {$carId} للعميل: {$customerName}");
        jsonSuccess('تم تسجيل المبايعة وحفظ بيانات البيع بنجاح.', ['saleId' => $saleId]);
    } else {
        jsonError('Method Not Allowed', 405);
    }
} catch (\Throwable $e) {
    jsonError('فشل تسجيل المبايعة: ' . $e->getMessage(), 500);
}
