<?php
/**
 * /api/transfers
 * GET: List transfer orders and their items
 * POST: Create a new inter-branch or company transfer
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

use Almakhzoun\Database\Database;

$currentUser = requireAuth();
$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        $transfers = Database::query('SELECT * FROM transfers ORDER BY created_at DESC');

        foreach ($transfers as &$trf) {
            $items = Database::query('SELECT * FROM transfer_items WHERE transfer_id = ?', [$trf['id']]);
            $trf['cars'] = $items;
            $trf['transferNo'] = $trf['transfer_no'];
            $trf['sourceCompanyName'] = $trf['source_company_name'];
            $trf['destCompanyName'] = $trf['dest_company_name'];
            $trf['driverName'] = $trf['driver_name'];
            $trf['driverPhone'] = $trf['driver_phone'];
            $trf['driverId'] = $trf['driver_id'];
            $trf['transferDate'] = $trf['transfer_date'];
            $trf['receiveDate'] = $trf['receive_date'];
            $trf['senderUser'] = $trf['sender_user'];
            $trf['receiverUser'] = $trf['receiver_user'];
        }

        jsonSuccess('Success', ['transfers' => $transfers, 'count' => count($transfers)]);
    } else if ($method === 'POST') {
        $body = getJsonBody();
        $sourceBranchId = $body['sourceBranchId'] ?? $body['source_branch_id'] ?? null;
        $sourceCompanyName = trim($body['sourceCompanyName'] ?? $body['source_company_name'] ?? 'الفرع الرئيسي');
        $destBranchId = $body['destBranchId'] ?? $body['dest_branch_id'] ?? null;
        $destCompanyName = trim($body['destCompanyName'] ?? $body['dest_company_name'] ?? '');
        $driverName = trim($body['driverName'] ?? $body['driver_name'] ?? '');
        $driverPhone = trim($body['driverPhone'] ?? $body['driver_phone'] ?? '');
        $driverId = trim($body['driverId'] ?? $body['driver_id'] ?? '');
        $notes = trim($body['notes'] ?? '');
        $carIds = $body['carIds'] ?? $body['cars'] ?? [];

        if (empty($destCompanyName) || empty($carIds)) {
            jsonError('الجهة المحول إليها والسيارات المحولة مطلوبة لإنشاء أمر النقل.', 400);
        }

        $transferId = 'trf_' . bin2hex(random_bytes(8));
        $transferNo = 'TRF-' . date('Ymd') . '-' . rand(100, 999);
        $tenantId = $currentUser['tenant_id'] ?? 'org-default';

        Database::transaction(function ($pdo) use ($transferId, $transferNo, $tenantId, $sourceBranchId, $sourceCompanyName, $destBranchId, $destCompanyName, $driverName, $driverPhone, $driverId, $notes, $carIds, $currentUser) {
            $trfStmt = $pdo->prepare('
                INSERT INTO transfers (
                    id, transfer_no, tenant_id, source_branch_id, source_company_name,
                    dest_branch_id, dest_company_name, status, driver_name, driver_phone,
                    driver_id, transfer_date, sender_user, notes, created_at
                ) VALUES (
                    ?, ?, ?, ?, ?,
                    ?, ?, "قيد النقل", ?, ?,
                    ?, NOW(), ?, ?, NOW()
                )
            ');

            $trfStmt->execute([
                $transferId, $transferNo, $tenantId, $sourceBranchId, $sourceCompanyName,
                $destBranchId, $destCompanyName, $driverName, $driverPhone,
                $driverId, $currentUser['username'], $notes
            ]);

            $itemStmt = $pdo->prepare('
                INSERT INTO transfer_items (transfer_id, car_id, vin, brand, model, year, color, price)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ');

            foreach ($carIds as $item) {
                $cId = is_array($item) ? ($item['id'] ?? $item['carId']) : $item;
                $car = Database::queryOne('SELECT * FROM cars WHERE id = ?', [$cId]);
                if ($car) {
                    $itemStmt->execute([
                        $transferId, $car['id'], $car['vin'], $car['brand'],
                        $car['model'], $car['year'], $car['color'], $car['price']
                    ]);

                    // Update car status
                    $pdo->prepare('UPDATE cars SET status = "محولة", transfer_no = ?, transfer_date = NOW() WHERE id = ?')->execute([$transferNo, $car['id']]);

                    // Movement log
                    $pdo->prepare('
                        INSERT INTO inventory_movements (id, tenant_id, branch_id, car_id, vin, movement_type, prev_status, new_status, user, details, timestamp)
                        VALUES (?, ?, ?, ?, ?, "تحويل_صادر", "متوفره", "محولة", ?, ?, NOW())
                    ')->execute(['mov_' . bin2hex(random_bytes(8)), $tenantId, $sourceBranchId, $car['id'], $car['vin'], $currentUser['username'], "تحويل إلى: {$destCompanyName} بأمر نقل رقم {$transferNo}"]);
                }
            }
        });

        logAudit('CREATE_TRANSFER', $transferId, 'transfers', "إنشاء أمر تحويل جديد رقم {$transferNo} إلى {$destCompanyName}");
        jsonSuccess('تم إنشاء أمر التحويل وتحديث حالة السيارات بنجاح.', ['transferId' => $transferId, 'transferNo' => $transferNo]);
    } else {
        jsonError('Method Not Allowed', 405);
    }
} catch (\Throwable $e) {
    jsonError('فشل معالجة التحويلات: ' . $e->getMessage(), 500);
}
