<?php
/**
 * POST /api/cars/exit
 * Records vehicle exit permit and delivery data
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

use Almakhzoun\Database\Database;

$currentUser = requireAuth();
$body = getJsonBody();

$carId = $body['carId'] ?? $body['car_id'] ?? '';
$receiverName = trim($body['receiverName'] ?? $body['receiver_name'] ?? '');
$receiverPhone = trim($body['receiverPhone'] ?? $body['receiver_phone'] ?? '');
$receiverId = trim($body['receiverId'] ?? $body['receiver_id'] ?? '');
$nationality = trim($body['nationality'] ?? '');
$deliveryType = trim($body['deliveryType'] ?? 'صاحبها');
$transportCompany = trim($body['transportCompany'] ?? '');
$exitDate = normalizeDateTime($body['exitDate'] ?? ($body['exit_date'] ?? null));
$seller = trim($body['seller'] ?? '');
$saleType = trim($body['saleType'] ?? '');
$bankName = trim($body['bankName'] ?? '');
$representativeName = trim($body['representativeName'] ?? '');
$carCondition = trim($body['carCondition'] ?? '');
$notes = trim($body['notes'] ?? '');

if (empty($carId) || empty($receiverName)) {
    jsonError('معرف السيارة واسم المستلم مطلوبان لتسجيل إذن الخروج.', 400);
}

try {
    Database::transaction(function ($pdo) use ($carId, $receiverName, $receiverPhone, $receiverId, $nationality, $deliveryType, $transportCompany, $exitDate, $seller, $saleType, $bankName, $representativeName, $carCondition, $notes, $currentUser) {
        // Insert or update exit data
        $stmt = $pdo->prepare('
            INSERT INTO car_exit_data (
                car_id, receiver_name, receiver_phone, receiver_id, nationality,
                delivery_type, transport_company, exit_date, seller, sale_type,
                bank_name, representative_name, car_condition, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                receiver_name = VALUES(receiver_name),
                receiver_phone = VALUES(receiver_phone),
                receiver_id = VALUES(receiver_id),
                exit_date = VALUES(exit_date),
                delivery_type = VALUES(delivery_type),
                notes = VALUES(notes)
        ');
        $stmt->execute([
            $carId, $receiverName, $receiverPhone, $receiverId, $nationality,
            $deliveryType, $transportCompany, $exitDate, $seller, $saleType,
            $bankName, $representativeName, $carCondition, $notes
        ]);

        // Update car status
        $pdo->prepare('UPDATE cars SET status = "مباعة", is_outbound = 1, is_present_in_showroom = 0 WHERE id = ?')->execute([$carId]);

        // Add movement log
        $car = Database::queryOne('SELECT vin, brand, model FROM cars WHERE id = ?', [$carId]);
        $vin = $car['vin'] ?? '';
        $pdo->prepare('
            INSERT INTO inventory_movements (id, tenant_id, branch_id, car_id, vin, movement_type, prev_status, new_status, user, details, timestamp)
            VALUES (?, "org-default", NULL, ?, ?, "خروج_سيارة", "متوفره", "مباعة", ?, ?, NOW())
        ')->execute(['mov_' . bin2hex(random_bytes(8)), $carId, $vin, $currentUser['username'], "تسليم السيارة للمستلم: {$receiverName}"]);
    });

    logAudit('CAR_EXIT', $carId, 'cars', "تسجيل إذن خروج وتسليم السيارة: {$carId} للمستلم {$receiverName}");
    jsonSuccess('تم تسجيل إذن الخروج وتسليم السيارة بنجاح.');
} catch (\Throwable $e) {
    jsonError('فشل تسجيل إذن الخروج: ' . $e->getMessage(), 500);
}
