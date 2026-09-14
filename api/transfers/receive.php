<?php
/**
 * POST /api/transfers/receive
 * Acknowledges receipt of transferred vehicles into destination inventory
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

use Almakhzoun\Database\Database;

$currentUser = requireAuth();
$body = getJsonBody();
$transferId = $body['transferId'] ?? $body['id'] ?? '';

if (empty($transferId)) {
    jsonError('معرف أمر التحويل مطلوب.', 400);
}

try {
    Database::transaction(function ($pdo) use ($transferId, $currentUser) {
        $trf = Database::queryOne('SELECT * FROM transfers WHERE id = ?', [$transferId]);
        if (!$trf) {
            throw new \RuntimeException('أمر التحويل غير موجود.');
        }

        $items = Database::query('SELECT car_id, vin FROM transfer_items WHERE transfer_id = ?', [$transferId]);

        // Update transfer status
        $pdo->prepare('UPDATE transfers SET status = "تم الاستلام", receive_date = NOW(), receiver_user = ? WHERE id = ?')->execute([$currentUser['username'], $transferId]);

        // Update cars status and branch
        $carUpdateStmt = $pdo->prepare('UPDATE cars SET status = "متوفره", branch_id = ?, is_present_in_showroom = 1 WHERE id = ?');
        $movStmt = $pdo->prepare('
            INSERT INTO inventory_movements (id, tenant_id, branch_id, car_id, vin, movement_type, prev_status, new_status, user, details, timestamp)
            VALUES (?, "org-default", ?, ?, ?, "تحويل_وارد", "محولة", "متوفره", ?, "استلام التحويل وإدخال السيارات للمخزون", NOW())
        ');

        foreach ($items as $item) {
            $carUpdateStmt->execute([$trf['dest_branch_id'], $item['car_id']]);
            $movStmt->execute(['mov_' . bin2hex(random_bytes(8)), $trf['dest_branch_id'], $item['car_id'], $item['vin'], $currentUser['username']]);
        }
    });

    logAudit('RECEIVE_TRANSFER', $transferId, 'transfers', "تأكيد استلام أمر التحويل: {$transferId}");
    jsonSuccess('تم تأكيد استلام السيارات المحولة وإدخالها لمخزون الفرع المستلم بنجاح.');
} catch (\Throwable $e) {
    jsonError('فشل تأكيد استلام التحويل: ' . $e->getMessage(), 500);
}
