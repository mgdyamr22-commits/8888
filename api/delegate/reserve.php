<?php
/**
 * Delegate Auto-Reserve Endpoint
 * Automatically books an available car without prompting for extraneous data.
 * Records the delegate's name so it prominently displays in the inventory.
 */

declare(strict_types=1);

require_once __DIR__ . '/../helpers.php';

use Almakhzoun\Database\Database;

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('طريقة الطلب غير مدعومة.', 405);
}

$delegate = requireDelegateAuth();
$delegateId = $delegate['id'];
$delegateName = $delegate['name'] ?: $delegate['username'];
$delegateUsername = $delegate['username'];

$body = getJsonBody();
$carId = trim($body['carId'] ?? '');

if (empty($carId)) {
    jsonError('معرف السيارة مطلوب لإتمام الحجز.', 400);
}

try {
    $car = Database::queryOne('SELECT * FROM cars WHERE id = ?', [$carId]);
    if (!$car) {
        jsonError('السيارة المطلوبة غير موجودة بالمعرض.', 404);
    }

    $currentStatus = trim($car['status'] ?? 'متوفره');
    $isAlreadyReserved = ($currentStatus === 'محجوزة' || $currentStatus === 'محجوز' || $currentStatus === 'Reserved');

    if ($isAlreadyReserved) {
        $reserver = $car['reserved_by_user_id'] ?: $car['seller'] ?: 'مندوب آخر';
        jsonError("عذراً، هذه السيارة محجوزة مسبقاً باسم: {$reserver}", 409);
    }

    $statusNote = "محجوزة بواسطة المندوب: {$delegateName}";

    Database::transaction(function ($pdo) use ($carId, $delegateId, $delegateName, $statusNote, $car) {
        // 1. Update car status and prominently set reserved_by_user_id to delegateName
        $pdo->prepare('
            UPDATE cars 
            SET status = "محجوزة",
                reserved_by_user_id = ?,
                seller = ?,
                status_note = ?,
                reservation_date = NOW(),
                updated_at = NOW()
            WHERE id = ?
        ')->execute([$delegateName, $delegateName, $statusNote, $carId]);

        // 2. Log in inventory_movements
        $vin = $car['vin'] ?? '';
        $pdo->prepare('
            INSERT INTO inventory_movements (id, tenant_id, branch_id, car_id, vin, movement_type, prev_status, new_status, user, details, timestamp)
            VALUES (?, "org-default", NULL, ?, ?, "حجز_مندوب_تلقائي", ?, "محجوزة", ?, ?, NOW())
        ')->execute([
            'mov_' . bin2hex(random_bytes(8)),
            $carId,
            $vin,
            $car['status'] ?? 'متوفره',
            $delegateName,
            "حجز تلقائي مباشر من صالة العرض بواسطة المندوب: {$delegateName} (@{$delegate['username']})"
        ]);

        // 3. Create or update reservations record if table exists
        try {
            $pdo->prepare('
                INSERT INTO reservations (id, car_id, delegate_name, customer_name, status, notes, created_by_user_id, created_at)
                VALUES (?, ?, ?, ?, "محجوزة", ?, ?, NOW())
            ')->execute([
                'res_' . bin2hex(random_bytes(8)),
                $carId,
                $delegateName,
                'حجز مباشر من المعرض',
                $statusNote,
                $delegateId
            ]);
        } catch (\Throwable $ignored) {}
    });

    logAudit('DELEGATE_RESERVE', $carId, 'cars', "حجز تلقائي للمركبة {$car['brand']} {$car['model']} بواسطة المندوب: {$delegateName}");

    $updatedCar = Database::queryOne('SELECT * FROM cars WHERE id = ?', [$carId]);

    jsonSuccess("تم حجز السيارة {$car['brand']} {$car['model']} بنجاح وتأكيد الحجز باسم المندوب: {$delegateName}", [
        'car' => [
            'id' => $updatedCar['id'],
            'brand' => $updatedCar['brand'],
            'model' => $updatedCar['model'],
            'year' => (int)$updatedCar['year'],
            'color' => $updatedCar['color'],
            'vin' => $updatedCar['vin'],
            'status' => 'محجوزة',
            'reservedByUserId' => $delegateName,
            'seller' => $delegateName,
            'statusNote' => $statusNote,
            'reservationDate' => $updatedCar['reservation_date'],
            'isReservedByMe' => true,
            'canAccessDocs' => true,
            'cardFile' => $updatedCar['card_file'],
            'cardFileName' => $updatedCar['card_file_name']
        ]
    ]);
} catch (\Throwable $e) {
    jsonError('حدث خطأ أثناء تنفيذ الحجز: ' . $e->getMessage(), 500);
}
