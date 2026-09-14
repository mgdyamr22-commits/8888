<?php
/**
 * /api/cars/detail
 * GET: Retrieve single car details from MySQL
 * PUT: Update vehicle in MySQL
 * DELETE: Remove vehicle from MySQL
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

use Almakhzoun\Database\Database;

$method = $_SERVER['REQUEST_METHOD'];
$body = getJsonBody();
$carId = $_GET['id'] ?? ($body['id'] ?? '');
$action = $_GET['action'] ?? ($body['action'] ?? '');

// Support POST method overriding and action parameter (e.g. from firewalls/proxies blocking PUT/DELETE)
if ($method === 'POST') {
    if (isset($body['_method'])) {
        $method = strtoupper((string)$body['_method']);
    } else if ($action === 'delete' || $action === 'destroy') {
        $method = 'DELETE';
    } else if ($action === 'update') {
        $method = 'PUT';
    }
}

// Authentication check
$delegate = getAuthenticatedDelegate();
$currentUser = getAuthenticatedUser();

if ($method === 'GET') {
    // Read-only operation: allowed for showroom visitors or authenticated users
} else {
    // Write operations (PUT, DELETE, POST reserve/cancel-reservation)
    if ($delegate && !$currentUser) {
        if ($method === 'DELETE' || $method === 'PUT') {
            jsonError('غير مصرح للمناديب بتعديل أو حذف بيانات السيارات. يرجى استخدام بوابة المناديب المخصصة.', 403);
        }
        // Delegate authorized for reservation actions
        $currentUser = [
            'id' => $delegate['id'] ?? 'delegate',
            'username' => $delegate['name'] ?? 'مندوب',
            'role' => 'مندوب',
            'tenant_id' => 'org-default',
            'branch_id' => null
        ];
    } else {
        $currentUser = requireAuth();
    }
}

try {
    if (empty($carId) || $carId === 'index' || $carId === 'index.php' || $carId === 'detail' || $carId === 'detail.php') {
        if ($carId === 'index' || $carId === 'index.php' || empty($carId)) {
            require __DIR__ . '/index.php';
            exit;
        }
    }

    if (empty($carId)) {
        jsonError('معرف السيارة مطلوب.', 400);
    }

    if ($method === 'POST' && ($action === 'reserve' || $action === 'cancel-reservation')) {
        $body = getJsonBody();
        if ($action === 'reserve') {
            $delegateName = $body['delegateName'] ?? $body['reservedByName'] ?? $currentUser['username'] ?? 'النظام';
            $customerName = $body['customerName'] ?? '';
            $notes = $body['notes'] ?? 'حجز المركبة';

            Database::transaction(function ($pdo) use ($carId, $currentUser, $delegateName, $customerName, $notes) {
                $pdo->prepare('
                    UPDATE cars SET status = "محجوزة", reserved_by_user_id = ?, reservation_date = NOW(), updated_at = NOW() WHERE id = ?
                ')->execute([$currentUser['id'] ?? null, $carId]);

                $car = Database::queryOne('SELECT vin, brand, model FROM cars WHERE id = ?', [$carId]);
                $vin = $car['vin'] ?? '';

                $pdo->prepare('
                    INSERT INTO inventory_movements (id, tenant_id, branch_id, car_id, vin, movement_type, prev_status, new_status, user, details, timestamp)
                    VALUES (?, "org-default", NULL, ?, ?, "حجز_مركبة", "متوفره", "محجوزة", ?, ?, NOW())
                ')->execute([
                    'mov_' . bin2hex(random_bytes(8)), $carId, $vin, $currentUser['username'] ?? 'النظام',
                    "حجز لصالح العميل: {$customerName} بواسطة: {$delegateName} - {$notes}"
                ]);
            });

            logAudit('RESERVE_CAR', $carId, 'cars', "حجز السيارة: {$carId}");
            $savedCar = fetchCarFromDb($carId);
            jsonSuccess('تم حجز السيارة بنجاح.', ['data' => $savedCar, 'car' => $savedCar]);
        } else if ($action === 'cancel-reservation') {
            $reason = $body['reason'] ?? 'إلغاء الحجز يدوياً';

            Database::transaction(function ($pdo) use ($carId, $currentUser, $reason) {
                $pdo->prepare('
                    UPDATE cars SET status = "متوفره", reserved_by_user_id = NULL, reservation_date = NULL, updated_at = NOW() WHERE id = ?
                ')->execute([$carId]);

                $car = Database::queryOne('SELECT vin, brand, model FROM cars WHERE id = ?', [$carId]);
                $vin = $car['vin'] ?? '';

                $pdo->prepare('
                    INSERT INTO inventory_movements (id, tenant_id, branch_id, car_id, vin, movement_type, prev_status, new_status, user, details, timestamp)
                    VALUES (?, "org-default", NULL, ?, ?, "إلغاء_حجز", "محجوزة", "متوفره", ?, ?, NOW())
                ')->execute([
                    'mov_' . bin2hex(random_bytes(8)), $carId, $vin, $currentUser['username'] ?? 'النظام',
                    "إلغاء حجز السيارة: {$reason}"
                ]);
            });

            logAudit('CANCEL_RESERVATION', $carId, 'cars', "إلغاء حجز السيارة: {$carId}");
            $savedCar = fetchCarFromDb($carId);
            jsonSuccess('تم إلغاء حجز السيارة بنجاح وإعادتها للمخزون المتوفر.', ['data' => $savedCar, 'car' => $savedCar]);
        }
    }

    if ($method === 'GET') {
        $formattedCar = fetchCarFromDb($carId);
        if (!$formattedCar) {
            jsonError('السيارة غير موجودة في قاعدة البيانات.', 404);
        }

        jsonSuccess('Success', ['data' => $formattedCar, 'car' => $formattedCar]);
    } else if ($method === 'PUT') {
        $body = getJsonBody();
        $existing = fetchCarFromDb($carId);
        if (!$existing) {
            $brand = trim((string)($body['brand'] ?? ''));
            $model = trim((string)($body['model'] ?? ''));
            $vin = strtoupper(trim((string)($body['vin'] ?? '')));
            if (!empty($brand) && !empty($vin)) {
                $y = (int)($body['year'] ?? date('Y'));
                $c = (string)($body['color'] ?? '');
                $p = (float)($body['price'] ?? 0);
                $cp = (float)($body['costPrice'] ?? ($body['cost_price'] ?? 0));
                $st = (string)($body['status'] ?? 'متوفره');
                $rs = (string)($body['rentalStatus'] ?? ($body['rental_status'] ?? 'لم يتم التجير'));
                $ot = (string)($body['ownershipType'] ?? ($body['ownership_type'] ?? 'مباشر'));
                $cn = (string)($body['cardNumber'] ?? ($body['card_number'] ?? ''));
                $sp = (string)($body['supplier'] ?? '');
                $nt = (string)($body['notes'] ?? '');
                $ed = !empty($body['entryDate']) ? normalizeDate($body['entryDate']) : date('Y-m-d');
                Database::execute(
                    'INSERT INTO cars (id, brand, model, year, color, vin, price, cost_price, status, rental_status, ownership_type, card_number, supplier, notes, entry_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [$carId, $brand, $model, $y, $c, $vin, $p, $cp, $st, $rs, $ot, $cn, $sp, $nt, $ed]
                );
                $existing = fetchCarFromDb($carId);
            }
            if (!$existing) {
                jsonError('السيارة غير موجودة في قاعدة البيانات.', 404);
            }
        }

        $brand = array_key_exists('brand', $body) ? trim((string)$body['brand']) : $existing['brand'];
        $model = array_key_exists('model', $body) ? trim((string)$body['model']) : $existing['model'];
        $year = array_key_exists('year', $body) ? (int)$body['year'] : (int)($existing['year'] ?? date('Y'));
        $color = array_key_exists('color', $body) ? trim((string)$body['color']) : $existing['color'];
        $vin = array_key_exists('vin', $body) ? strtoupper(trim((string)$body['vin'])) : $existing['vin'];
        $price = array_key_exists('price', $body) ? (float)$body['price'] : (float)($existing['price'] ?? 0);
        $costPrice = array_key_exists('costPrice', $body) ? (float)$body['costPrice'] : (array_key_exists('cost_price', $body) ? (float)$body['cost_price'] : (float)($existing['costPrice'] ?? 0));
        $cardNumber = array_key_exists('cardNumber', $body) ? trim((string)$body['cardNumber']) : (array_key_exists('card_number', $body) ? trim((string)$body['card_number']) : ($existing['cardNumber'] ?? ''));
        $supplier = array_key_exists('supplier', $body) ? trim((string)$body['supplier']) : ($existing['supplier'] ?? '');
        $ownershipType = array_key_exists('ownershipType', $body) ? trim((string)$body['ownershipType']) : (array_key_exists('ownership_type', $body) ? trim((string)$body['ownership_type']) : ($existing['ownershipType'] ?? 'مباشر'));
        $status = array_key_exists('status', $body) ? trim((string)$body['status']) : ($existing['status'] ?? 'متوفره');
        $rentalStatus = array_key_exists('rentalStatus', $body) ? trim((string)$body['rentalStatus']) : (array_key_exists('rental_status', $body) ? trim((string)$body['rental_status']) : ($existing['rentalStatus'] ?? 'لم يتم التجير'));
        $notes = array_key_exists('notes', $body) ? trim((string)$body['notes']) : ($existing['notes'] ?? '');
        $entryDate = (!empty($body['entryDate']) || !empty($body['entry_date'])) ? normalizeDate($body['entryDate'] ?? $body['entry_date']) : ($existing['entryDate'] ?? null);

        $plateData = $body['plateData'] ?? [];
        $plateNumber = array_key_exists('plateNumber', $body) ? $body['plateNumber'] : ($plateData['plateNumber'] ?? ($existing['plateNumber'] ?? null));
        $plateOwnerName = $plateData['ownerName'] ?? ($existing['plateData']['ownerName'] ?? null);
        $plateSerialNumber = $plateData['serialNumber'] ?? ($existing['plateData']['serialNumber'] ?? null);
        $plateIssueDate = normalizeDate($plateData['issueDate'] ?? ($body['plateIssueDate'] ?? ($existing['plateData']['issueDate'] ?? null)), 'null');
        $hasPlate = (isset($body['hasPlate']) ? ($body['hasPlate'] ? 1 : 0) : (!empty($plateNumber) ? 1 : ($existing['hasPlate'] ? 1 : 0)));

        $rawVinMatching = array_key_exists('vinMatching', $body) ? trim((string)$body['vinMatching']) : (array_key_exists('vin_matching', $body) ? trim((string)$body['vin_matching']) : ($existing['vinMatching'] ?? ''));
        if ($rawVinMatching === 'غير مطابق' || $rawVinMatching === 'غير متطابق' || $rawVinMatching === 'mismatch' || $rawVinMatching === 'غير_مطابق') {
            $vinMatching = 'غير متطابق';
        } else {
            $vinMatching = 'متطابق';
        }

        $cardFile = array_key_exists('cardFile', $body) ? $body['cardFile'] : ($body['card_file'] ?? ($existing['cardFile'] ?? null));
        $cardFileName = array_key_exists('cardFileName', $body) ? $body['cardFileName'] : ($body['card_file_name'] ?? ($existing['cardFileName'] ?? null));
        $attributionSource = array_key_exists('attributionSource', $body) ? $body['attributionSource'] : ($body['attribution_source'] ?? ($existing['attributionSource'] ?? null));
        $isPresentInShowroom = isset($body['isPresentInShowroom']) ? ($body['isPresentInShowroom'] ? 1 : 0) : (isset($body['is_present_in_showroom']) ? ($body['is_present_in_showroom'] ? 1 : 0) : ($existing['isPresentInShowroom'] ? 1 : 0));
        $isOutbound = isset($body['isOutbound']) ? ($body['isOutbound'] ? 1 : 0) : (isset($body['is_outbound']) ? ($body['is_outbound'] ? 1 : 0) : ($existing['isOutbound'] ? 1 : 0));
        $carRemark = array_key_exists('carRemark', $body) ? $body['carRemark'] : ($body['car_remark'] ?? ($existing['carRemark'] ?? null));
        $statusNote = array_key_exists('statusNote', $body) ? $body['statusNote'] : ($body['status_note'] ?? ($existing['statusNote'] ?? null));
        $seller = array_key_exists('seller', $body) ? $body['seller'] : ($body['exitData']['seller'] ?? ($existing['seller'] ?? null));
        $modelYear = array_key_exists('modelYear', $body) ? $body['modelYear'] : ($body['model_year'] ?? ($existing['modelYear'] ?? null));
        $exitType = array_key_exists('exitType', $body) ? $body['exitType'] : ($body['exit_type'] ?? ($existing['exitType'] ?? null));
        $transferSender = array_key_exists('transferSender', $body) ? $body['transferSender'] : ($body['transfer_sender'] ?? ($existing['transferSender'] ?? null));
        $transferReceiver = array_key_exists('transferReceiver', $body) ? $body['transferReceiver'] : ($body['transfer_receiver'] ?? ($existing['transferReceiver'] ?? null));
        $transferNo = array_key_exists('transferNo', $body) ? $body['transferNo'] : ($body['transfer_no'] ?? ($existing['transferNo'] ?? null));
        $transferDate = !empty($body['transferDate']) ? normalizeDate($body['transferDate']) : ($existing['transferDate'] ?? null);
        $reservedByUserId = array_key_exists('reservedByUserId', $body) ? $body['reservedByUserId'] : ($body['reserved_by_user_id'] ?? ($existing['reservedByUserId'] ?? null));
        $reservationDate = !empty($body['reservationDate']) ? normalizeDate($body['reservationDate']) : ($existing['reservationDate'] ?? null);

        Database::transaction(function ($pdo) use (
            $carId, $brand, $model, $year, $color, $vin, $vinMatching,
            $cardNumber, $price, $costPrice, $supplier, $ownershipType, $status,
            $rentalStatus, $entryDate, $notes, $hasPlate, $plateNumber,
            $plateOwnerName, $plateSerialNumber, $plateIssueDate,
            $cardFile, $cardFileName, $attributionSource, $isPresentInShowroom, $isOutbound,
            $carRemark, $statusNote, $seller, $modelYear, $exitType,
            $transferSender, $transferReceiver, $transferNo, $transferDate,
            $reservedByUserId, $reservationDate,
            $body
        ) {
            $stmt = $pdo->prepare('
                UPDATE cars SET
                    brand = ?,
                    model = ?,
                    year = ?,
                    color = ?,
                    vin = ?,
                    vin_matching = ?,
                    card_number = ?,
                    price = ?,
                    cost_price = ?,
                    supplier = ?,
                    ownership_type = ?,
                    status = ?,
                    rental_status = ?,
                    entry_date = ?,
                    notes = ?,
                    has_plate = ?,
                    plate_number = ?,
                    plate_owner_name = ?,
                    plate_serial_number = ?,
                    plate_issue_date = ?,
                    card_file = CASE WHEN ? = 1 THEN ? ELSE card_file END,
                    card_file_name = CASE WHEN ? = 1 THEN ? ELSE card_file_name END,
                    attribution_source = ?,
                    is_present_in_showroom = ?,
                    is_outbound = ?,
                    car_remark = ?,
                    status_note = ?,
                    seller = ?,
                    model_year = ?,
                    exit_type = ?,
                    transfer_sender = ?,
                    transfer_receiver = ?,
                    transfer_no = ?,
                    transfer_date = ?,
                    reserved_by_user_id = ?,
                    reservation_date = ?,
                    updated_at = NOW()
                WHERE id = ?
            ');

            $hasCardFileKey = (array_key_exists('cardFile', $body) || array_key_exists('card_file', $body)) ? 1 : 0;
            $hasCardFileNameKey = (array_key_exists('cardFileName', $body) || array_key_exists('card_file_name', $body)) ? 1 : 0;

            $stmt->execute([
                $brand, $model, $year, $color, $vin, $vinMatching,
                $cardNumber, $price, $costPrice, $supplier, $ownershipType,
                $status, $rentalStatus, $entryDate, $notes, $hasPlate, $plateNumber,
                $plateOwnerName, $plateSerialNumber, $plateIssueDate,
                $hasCardFileKey, $cardFile,
                $hasCardFileNameKey, $cardFileName,
                $attributionSource, $isPresentInShowroom, $isOutbound,
                $carRemark, $statusNote, $seller, $modelYear, $exitType,
                $transferSender, $transferReceiver, $transferNo, $transferDate,
                $reservedByUserId, $reservationDate,
                $carId
            ]);

            // Save or update exitData
            if (isset($body['exitData']) && is_array($body['exitData'])) {
                $exit = $body['exitData'];
                $pdo->prepare('DELETE FROM car_exit_data WHERE car_id = ?')->execute([$carId]);
                if (!empty($exit['receiverName']) || !empty($exit['exitDate']) || !empty($exit['seller'])) {
                    $pdo->prepare('
                        INSERT INTO car_exit_data (
                            car_id, receiver_name, receiver_phone, receiver_id, nationality,
                            delivery_type, transport_company, exit_date, seller, sale_type,
                            bank_name, representative_name, car_condition, notes
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ')->execute([
                        $carId,
                        $exit['receiverName'] ?? '',
                        $exit['receiverPhone'] ?? '',
                        $exit['receiverId'] ?? '',
                        $exit['nationality'] ?? '',
                        $exit['deliveryType'] ?? 'صاحبها',
                        $exit['transportCompany'] ?? '',
                        normalizeDate($exit['exitDate'] ?? null) ?: date('Y-m-d H:i:s'),
                        $exit['seller'] ?? '',
                        $exit['saleType'] ?? '',
                        $exit['bankName'] ?? '',
                        $exit['representativeName'] ?? '',
                        $exit['carCondition'] ?? '',
                        $exit['notes'] ?? ''
                    ]);
                }
            }

            $customMap = (isset($body['customData']) && is_array($body['customData'])) ? $body['customData'] : null;
            if ($customMap !== null || !empty($body['interiorColor']) || !empty($body['presenceDescription'])) {
                $customMap = $customMap ?? [];
                if (!empty($body['interiorColor']) && !isset($customMap['interiorColor'])) {
                    $customMap['interiorColor'] = $body['interiorColor'];
                }
                if (!empty($body['presenceDescription']) && !isset($customMap['presenceDescription'])) {
                    $customMap['presenceDescription'] = $body['presenceDescription'];
                }
                $pdo->prepare('DELETE FROM car_custom_fields WHERE car_id = ?')->execute([$carId]);
                $cfStmt = $pdo->prepare('INSERT INTO car_custom_fields (car_id, field_key, field_value) VALUES (?, ?, ?)');
                foreach ($customMap as $key => $val) {
                    $cfStmt->execute([$carId, (string)$key, (string)$val]);
                }
            }
        });

        $updatedCar = fetchCarFromDb($carId);
        if (!$updatedCar) {
            jsonError('فشل استرداد بيانات السيارة المحدثة من قاعدة بيانات MySQL.', 500);
        }

        logAudit('UPDATE_CAR', $carId, 'cars', "تعديل بيانات السيارة في MySQL: {$updatedCar['vin']}");
        jsonSuccess('تم تحديث بيانات السيارة في MySQL بنجاح.', ['data' => $updatedCar, 'car' => $updatedCar]);
    } else if ($method === 'DELETE') {
        Database::execute('DELETE FROM cars WHERE id = ?', [$carId]);
        Database::execute('DELETE FROM car_custom_fields WHERE car_id = ?', [$carId]);
        Database::execute('DELETE FROM car_exit_data WHERE car_id = ?', [$carId]);
        logAudit('DELETE_CAR', $carId, 'cars', "حذف السيارة من المخزون: {$carId}");
        jsonSuccess('تم حذف السيارة من MySQL بنجاح.');
    } else {
        jsonError('Method Not Allowed', 405);
    }
} catch (\Throwable $e) {
    jsonError('حدث خطأ أثناء معالجة تفاصيل السيارة: ' . $e->getMessage(), 500);
}
