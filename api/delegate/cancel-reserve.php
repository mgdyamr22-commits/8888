<?php
/**
 * Delegate Cancel Reservation Endpoint
 * Strictly allows the delegate who booked the car to release it back to available.
 * Forbidden from altering any other cars.
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
    jsonError('معرف السيارة مطلوب لإلغاء الحجز.', 400);
}

try {
    $car = Database::queryOne('SELECT * FROM cars WHERE id = ?', [$carId]);
    if (!$car) {
        jsonError('السيارة المطلوبة غير موجودة.', 404);
    }

    $reservedBy = trim($car['reserved_by_user_id'] ?? '');
    $seller = trim($car['seller'] ?? '');

    $isReservedByMe = (
        (!empty($reservedBy) && (
            strcasecmp($reservedBy, $delegateUsername) === 0 ||
            strcasecmp($reservedBy, $delegateName) === 0 ||
            $reservedBy === $delegateId
        )) ||
        (!empty($seller) && (
            strcasecmp($seller, $delegateUsername) === 0 ||
            strcasecmp($seller, $delegateName) === 0
        ))
    );

    if (!$isReservedByMe) {
        jsonError('عذراً، ليس لديك الصلاحية لإلغاء حجز هذه السيارة لأنها غير محجوزة باسمك.', 403);
    }

    Database::transaction(function ($pdo) use ($carId, $delegateName, $car) {
        // Revert car back to available
        $pdo->prepare('
            UPDATE cars 
            SET status = "متوفره",
                reserved_by_user_id = NULL,
                seller = NULL,
                status_note = NULL,
                reservation_date = NULL,
                updated_at = NOW()
            WHERE id = ?
        ')->execute([$carId]);

        // Log movement
        $vin = $car['vin'] ?? '';
        $pdo->prepare('
            INSERT INTO inventory_movements (id, tenant_id, branch_id, car_id, vin, movement_type, prev_status, new_status, user, details, timestamp)
            VALUES (?, "org-default", NULL, ?, ?, "إلغاء_حجز_مندوب", "محجوزة", "متوفره", ?, ?, NOW())
        ')->execute([
            'mov_' . bin2hex(random_bytes(8)),
            $carId,
            $vin,
            $delegateName,
            "إلغاء حجز السيارة وإعادتها لحالة متوفرة بواسطة المندوب الحائز: {$delegateName}"
        ]);
    });

    logAudit('DELEGATE_CANCEL_RESERVE', $carId, 'cars', "إلغاء حجز المركبة وإعادتها للمخزون بواسطة المندوب: {$delegateName}");

    $updatedCar = Database::queryOne('SELECT * FROM cars WHERE id = ?', [$carId]);

    jsonSuccess("تم إلغاء حجز السيارة {$car['brand']} {$car['model']} وإعادتها للمخزون المتاح بنجاح.", [
        'car' => [
            'id' => $updatedCar['id'],
            'brand' => $updatedCar['brand'],
            'model' => $updatedCar['model'],
            'year' => (int)$updatedCar['year'],
            'color' => $updatedCar['color'],
            'vin' => $updatedCar['vin'],
            'status' => 'متوفره',
            'reservedByUserId' => null,
            'isReservedByMe' => false,
            'canAccessDocs' => false,
            'cardFile' => null
        ]
    ]);
} catch (\Throwable $e) {
    jsonError('حدث خطأ أثناء إلغاء الحجز: ' . $e->getMessage(), 500);
}
