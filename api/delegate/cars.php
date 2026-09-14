<?php
/**
 * Delegate Cars Endpoint
 * Returns showroom cars with STRICT document privacy:
 * Customs documents and card files are ONLY exposed to the delegate who reserved the car!
 */

declare(strict_types=1);

require_once __DIR__ . '/../helpers.php';

use Almakhzoun\Database\Database;

$delegate = requireDelegateAuth();
$delegateId = $delegate['id'];
$delegateName = $delegate['name'] ?: $delegate['username'];
$delegateUsername = $delegate['username'];

try {
    // Showroom cars: present in showroom and not outbound and not sold/delivered
    $cars = Database::queryAll('
        SELECT * FROM cars 
        WHERE (is_outbound = 0 OR is_outbound IS NULL)
          AND (status NOT IN ("مباعة", "تم البيع", "خارج المعرض"))
        ORDER BY updated_at DESC, created_at DESC
    ');

    $sanitizedCars = [];

    foreach ($cars as $car) {
        $reservedBy = trim($car['reserved_by_user_id'] ?? '');
        $statusNote = trim($car['status_note'] ?? '');
        $seller = trim($car['seller'] ?? '');
        
        // Determine if this car is reserved by the current delegate
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

        $statusStr = trim($car['status'] ?? 'متوفره');
        $isReserved = ($statusStr === 'محجوزة' || $statusStr === 'محجوز' || $statusStr === 'Reserved');

        // Document access: Strictly restricted to the reserver delegate
        $canAccessDocs = $isReservedByMe;
        $cardFile = $canAccessDocs ? ($car['card_file'] ?? null) : null;
        $cardFileName = $canAccessDocs ? ($car['card_file_name'] ?? null) : null;

        $sanitizedCars[] = [
            'id' => $car['id'],
            'brand' => $car['brand'],
            'model' => $car['model'],
            'year' => (int)$car['year'],
            'color' => $car['color'],
            'interiorColor' => $car['interior_color'] ?? '',
            'vin' => $car['vin'],
            'cardNumber' => $canAccessDocs ? ($car['card_number'] ?? '') : (substr($car['card_number'] ?? '****', 0, 4) . '****'),
            'cardFile' => $cardFile,
            'cardFileName' => $cardFileName,
            'price' => (float)($car['price'] ?? 0),
            'status' => $car['status'] ?? 'متوفره',
            'isPresentInShowroom' => (bool)($car['is_present_in_showroom'] ?? true),
            'presenceDescription' => $car['presence_description'] ?? '',
            'reservedByUserId' => $car['reserved_by_user_id'] ?? null,
            'reservationDate' => $car['reservation_date'] ?? null,
            'statusNote' => $car['status_note'] ?? null,
            'seller' => $car['seller'] ?? null,
            'isReservedByMe' => $isReservedByMe,
            'canAccessDocs' => $canAccessDocs,
            'updatedAt' => $car['updated_at'] ?? $car['created_at']
        ];
    }

    jsonSuccess('تم جلب مركبات صالة العرض بنجاح.', ['cars' => $sanitizedCars]);
} catch (\Throwable $e) {
    jsonError('حدث خطأ أثناء جلب المركبات: ' . $e->getMessage(), 500);
}
