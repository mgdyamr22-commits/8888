<?php
/**
 * Delegate My Bookings Endpoint
 * Returns all cars currently booked by this authenticated delegate.
 * Includes unlocked card files and customs documents for these booked cars only.
 */

declare(strict_types=1);

require_once __DIR__ . '/../helpers.php';

use Almakhzoun\Database\Database;

$delegate = requireDelegateAuth();
$delegateId = $delegate['id'];
$delegateName = $delegate['name'] ?: $delegate['username'];
$delegateUsername = $delegate['username'];

try {
    $rows = Database::queryAll('
        SELECT * FROM cars 
        WHERE (status = "محجوزة" OR status = "محجوز" OR status = "Reserved")
          AND (
            LOWER(reserved_by_user_id) = LOWER(?)
            OR LOWER(reserved_by_user_id) = LOWER(?)
            OR reserved_by_user_id = ?
            OR LOWER(seller) = LOWER(?)
            OR LOWER(seller) = LOWER(?)
          )
        ORDER BY reservation_date DESC, updated_at DESC
    ', [$delegateUsername, $delegateName, $delegateId, $delegateUsername, $delegateName]);

    $bookings = array_map(function ($car) {
        return [
            'id' => $car['id'],
            'brand' => $car['brand'],
            'model' => $car['model'],
            'year' => (int)$car['year'],
            'color' => $car['color'],
            'vin' => $car['vin'],
            'cardNumber' => $car['card_number'] ?? '',
            'cardFile' => $car['card_file'] ?? null,
            'cardFileName' => $car['card_file_name'] ?? null,
            'price' => (float)($car['price'] ?? 0),
            'status' => 'محجوزة',
            'reservationDate' => $car['reservation_date'] ?? $car['updated_at'],
            'statusNote' => $car['status_note'] ?? '',
            'canAccessDocs' => true
        ];
    }, $rows);

    jsonSuccess('تم جلب قائمة الحجوزات الخاصة بالمندوب بنجاح.', [
        'bookings' => $bookings,
        'count' => count($bookings)
    ]);
} catch (\Throwable $e) {
    jsonError('حدث خطأ أثناء جلب قائمة الحجوزات: ' . $e->getMessage(), 500);
}
