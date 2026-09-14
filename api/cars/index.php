<?php
/**
 * /api/cars
 * GET: Retrieve list of vehicles from MySQL database with full metadata and filters
 * POST: Create a new vehicle in MySQL with movement logs and custom fields
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

use Almakhzoun\Database\Database;

/**
 * Self-heals the cars schema on older MySQL installations to prevent truncation or missing column errors
 */
function autoHealCarsTableColumns(\PDO $pdo, bool $force = false): void
{
    static $autoHealed = false;
    if ($autoHealed && !$force) return;
    $autoHealed = true;

    $lockDir = dirname(__DIR__, 2) . '/storage/framework';
    if (!is_dir($lockDir)) {
        @mkdir($lockDir, 0777, true);
    }
    $lockFile = $lockDir . '/cars_schema_healed.lock';
    if (!$force && file_exists($lockFile)) {
        if ((time() - @filemtime($lockFile)) < 86400) {
            return;
        }
    }

    try {
        // Fetch existing column names
        $cols = [];
        $stmt = $pdo->query("SHOW COLUMNS FROM cars");
        if ($stmt) {
            while ($row = $stmt->fetch(\PDO::FETCH_ASSOC)) {
                $cols[strtolower($row['Field'])] = true;
            }
        }

        $neededCols = [
            'tenant_id' => "VARCHAR(64) DEFAULT 'org-default'",
            'branch_id' => "VARCHAR(64) NULL",
            'brand' => "VARCHAR(128) NOT NULL",
            'model' => "VARCHAR(128) NOT NULL",
            'year' => "INT NOT NULL DEFAULT 0",
            'color' => "VARCHAR(128) NOT NULL DEFAULT ''",
            'interior_color' => "VARCHAR(128) NULL",
            'vin' => "VARCHAR(128) NOT NULL",
            'vin_matching' => "VARCHAR(128) NULL",
            'card_number' => "VARCHAR(128) NULL",
            'price' => "DECIMAL(12,2) DEFAULT 0.00",
            'cost_price' => "DECIMAL(12,2) DEFAULT 0.00",
            'supplier' => "VARCHAR(128) NULL",
            'ownership_type' => "VARCHAR(128) DEFAULT 'مباشر'",
            'status' => "VARCHAR(128) DEFAULT 'متوفره'",
            'rental_status' => "VARCHAR(128) DEFAULT 'لم يتم التجير'",
            'entry_date' => "DATE NULL",
            'attribution_source' => "VARCHAR(128) NULL",
            'is_present_in_showroom' => "TINYINT(1) DEFAULT 1",
            'presence_description' => "TEXT NULL",
            'is_outbound' => "TINYINT(1) DEFAULT 0",
            'has_plate' => "TINYINT(1) DEFAULT 0",
            'plate_number' => "VARCHAR(64) NULL",
            'plate_owner_name' => "VARCHAR(128) NULL",
            'plate_serial_number' => "VARCHAR(64) NULL",
            'plate_issue_date' => "DATE NULL",
            'card_file' => "LONGTEXT NULL",
            'card_file_name' => "VARCHAR(255) NULL",
            'reserved_by_user_id' => "VARCHAR(64) NULL",
            'reservation_date' => "DATETIME NULL",
            'status_note' => "TEXT NULL",
            'car_remark' => "TEXT NULL",
            'notes' => "TEXT NULL",
            'seller' => "VARCHAR(128) NULL",
            'model_year' => "VARCHAR(64) NULL",
            'exit_type' => "VARCHAR(64) NULL",
            'transfer_sender' => "VARCHAR(128) NULL",
            'transfer_receiver' => "VARCHAR(128) NULL",
            'transfer_no' => "VARCHAR(64) NULL",
            'transfer_date' => "DATETIME NULL",
            'created_at' => "DATETIME DEFAULT CURRENT_TIMESTAMP",
            'updated_at' => "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
        ];

        foreach ($neededCols as $colName => $colDef) {
            if (!isset($cols[strtolower($colName)])) {
                try {
                    $pdo->exec("ALTER TABLE cars ADD COLUMN `{$colName}` {$colDef}");
                } catch (\Throwable $e) {}
            }
        }

        // Drop removed grade column if present to ensure clean schema
        if (isset($cols['grade'])) {
            try {
                $pdo->exec("ALTER TABLE cars DROP COLUMN grade");
            } catch (\Throwable $e) {}
        }

        // Safely adjust column types
        try { $pdo->exec("ALTER TABLE cars MODIFY COLUMN vin_matching VARCHAR(128) NULL"); } catch (\Throwable $e) {}
        try { $pdo->exec("ALTER TABLE cars MODIFY COLUMN card_number VARCHAR(128) NULL"); } catch (\Throwable $e) {}
        try { $pdo->exec("ALTER TABLE cars MODIFY COLUMN color VARCHAR(128) NOT NULL"); } catch (\Throwable $e) {}
        try { $pdo->exec("ALTER TABLE cars MODIFY COLUMN interior_color VARCHAR(128) NULL"); } catch (\Throwable $e) {}
        try { $pdo->exec("ALTER TABLE cars MODIFY COLUMN model_year VARCHAR(64) NULL"); } catch (\Throwable $e) {}
        try { $pdo->exec("ALTER TABLE cars MODIFY COLUMN status VARCHAR(128) DEFAULT 'متوفره'"); } catch (\Throwable $e) {}
        try { $pdo->exec("ALTER TABLE cars MODIFY COLUMN rental_status VARCHAR(128) DEFAULT 'لم يتم التجير'"); } catch (\Throwable $e) {}
        try { $pdo->exec("ALTER TABLE cars MODIFY COLUMN ownership_type VARCHAR(128) DEFAULT 'مباشر'"); } catch (\Throwable $e) {}

        // Ensure support tables exist
        $pdo->exec("CREATE TABLE IF NOT EXISTS car_custom_fields (
            id INT AUTO_INCREMENT PRIMARY KEY,
            car_id VARCHAR(64) NOT NULL,
            field_key VARCHAR(128) NOT NULL,
            field_value LONGTEXT NULL,
            INDEX idx_car_id (car_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS car_exit_data (
            id INT AUTO_INCREMENT PRIMARY KEY,
            car_id VARCHAR(64) NOT NULL UNIQUE,
            receiver_name VARCHAR(128) NOT NULL DEFAULT '',
            receiver_phone VARCHAR(64) NOT NULL DEFAULT '',
            receiver_id VARCHAR(64) NOT NULL DEFAULT '',
            nationality VARCHAR(64) NULL,
            delivery_type VARCHAR(64) DEFAULT 'مالك',
            transport_company VARCHAR(128) NULL,
            sale_type VARCHAR(64) NULL,
            bank_name VARCHAR(128) NULL,
            exit_date DATE NULL,
            notes TEXT NULL,
            seller VARCHAR(128) NULL,
            representative_name VARCHAR(128) NULL,
            car_condition TEXT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_car_exit (car_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        try { $pdo->exec("ALTER TABLE car_exit_data ADD COLUMN nationality VARCHAR(64) NULL"); } catch (\Throwable $e) {}
        try { $pdo->exec("ALTER TABLE car_exit_data ADD COLUMN sale_type VARCHAR(64) NULL"); } catch (\Throwable $e) {}
        try { $pdo->exec("ALTER TABLE car_exit_data ADD COLUMN bank_name VARCHAR(128) NULL"); } catch (\Throwable $e) {}
        try { $pdo->exec("ALTER TABLE car_exit_data ADD COLUMN representative_name VARCHAR(128) NULL"); } catch (\Throwable $e) {}
        try { $pdo->exec("ALTER TABLE car_exit_data ADD COLUMN car_condition TEXT NULL"); } catch (\Throwable $e) {}

        $pdo->exec("CREATE TABLE IF NOT EXISTS inventory_movements (
            id VARCHAR(64) PRIMARY KEY,
            tenant_id VARCHAR(64) DEFAULT 'org-default',
            branch_id VARCHAR(64) NULL,
            car_id VARCHAR(64) NULL,
            vin VARCHAR(64) NOT NULL,
            movement_type VARCHAR(64) NOT NULL,
            prev_status VARCHAR(64) NULL,
            new_status VARCHAR(64) NULL,
            user VARCHAR(128) NOT NULL,
            details TEXT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_vin (vin),
            INDEX idx_mov_type (movement_type)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS car_history (
            id VARCHAR(64) PRIMARY KEY,
            car_id VARCHAR(64) NOT NULL,
            action VARCHAR(255) NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            user VARCHAR(128) DEFAULT 'نظام',
            INDEX idx_car_history (car_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        @file_put_contents($lockFile, (string)time());
    } catch (\Throwable $e) {
        // Table might lack alter privileges, continue safely
    }
}

$method = $_SERVER['REQUEST_METHOD'];

// Enforce authentication on all write operations (POST, PUT, DELETE)
if ($method === 'POST' || $method === 'PUT' || $method === 'DELETE') {
    $currentUser = requireAuth();
} else {
    // Read operations: authenticated user if token present, otherwise null for public showroom
    $currentUser = getAuthenticatedUser();
}

try {
    if ($method === 'GET') {
        $search = trim($_GET['search'] ?? '');
        $status = trim($_GET['status'] ?? '');
        $brand = trim($_GET['brand'] ?? '');
        $branchId = trim($_GET['branchId'] ?? $_GET['branch_id'] ?? '');

        $sql = 'SELECT * FROM cars WHERE 1=1';
        $params = [];

        if (!empty($status) && $status !== 'all') {
            $sql .= ' AND status = ?';
            $params[] = $status;
        }

        if (!empty($brand) && $brand !== 'all') {
            $sql .= ' AND brand = ?';
            $params[] = $brand;
        }

        if (!empty($branchId) && $branchId !== 'all') {
            $sql .= ' AND (branch_id = ? OR branch_id IS NULL)';
            $params[] = $branchId;
        }

        if (!empty($search)) {
            $sql .= ' AND (vin LIKE ? OR vin_matching LIKE ? OR brand LIKE ? OR model LIKE ? OR plate_number LIKE ? OR card_number LIKE ?)';
            $like = "%{$search}%";
            $params = array_merge($params, [$like, $like, $like, $like, $like, $like]);
        }

        $sql .= ' ORDER BY created_at DESC';

        $rawCars = Database::query($sql, $params);
        $cars = [];

        foreach ($rawCars as $car) {
            $carId = (string)$car['id'];
            $exitData = Database::queryOne('SELECT * FROM car_exit_data WHERE car_id = ?', [$carId]);
            $customFields = Database::query('SELECT field_key, field_value FROM car_custom_fields WHERE car_id = ?', [$carId]);
            $historyRows = Database::query('SELECT * FROM car_history WHERE car_id = ? ORDER BY timestamp DESC', [$carId]);

            $cars[] = mapCarRow($car, $exitData, $customFields, $historyRows);
        }

        jsonSuccess('Success', ['data' => $cars, 'cars' => $cars, 'count' => count($cars)]);
    } else if ($method === 'POST') {
        $body = getJsonBody();
        $action = $_GET['action'] ?? $body['action'] ?? '';

        // If action or override is targeted for a single car or sub-action, delegate to detail.php
        if (isset($body['_method'])) {
            $override = strtoupper((string)$body['_method']);
            if ($override === 'PUT' || $override === 'DELETE') {
                require __DIR__ . '/detail.php';
                exit;
            }
        }

        if ($action === 'update' || $action === 'delete' || $action === 'destroy' || $action === 'reserve' || $action === 'cancel-reservation') {
            require __DIR__ . '/detail.php';
            exit;
        }

        // Handle Bulk Delete
        if ($action === 'bulk-delete' || (isset($body['ids']) && is_array($body['ids']))) {
            $ids = $body['ids'] ?? [];
            if (empty($ids)) {
                jsonError('قائمة المعرفات مطلوبة للحذف الجماعي.', 400);
            }
            Database::transaction(function ($pdo) use ($ids) {
                $placeholders = implode(',', array_fill(0, count($ids), '?'));
                $pdo->prepare("DELETE FROM cars WHERE id IN ($placeholders)")->execute($ids);
                $pdo->prepare("DELETE FROM car_custom_fields WHERE car_id IN ($placeholders)")->execute($ids);
                $pdo->prepare("DELETE FROM car_exit_data WHERE car_id IN ($placeholders)")->execute($ids);
            });
            logAudit('BULK_DELETE_CARS', 'bulk', 'cars', 'حذف جماعي لعدد ' . count($ids) . ' سيارة');
            jsonSuccess('تم حذف السيارات المحددة بنجاح.');
        }

        // Handle Bulk Insert
        if ($action === 'bulk-insert' || (isset($body['cars']) && is_array($body['cars']))) {
            $rawList = $body['cars'] ?? [];
            if (empty($rawList)) {
                jsonError('قائمة السيارات مطلوبة للإدخال الجماعي.', 400);
            }
            $pdoConn = Database::connect();
            if ($pdoConn) {
                autoHealCarsTableColumns($pdoConn);
            }
            $createdList = [];
            Database::transaction(function ($pdo) use ($rawList, $currentUser, &$createdList) {
                $tenantId = $currentUser['tenant_id'] ?? 'org-default';
                $branchId = $currentUser['branch_id'] ?? 'branch-main';

                $stmt = $pdo->prepare('
                    INSERT INTO cars (
                        id, tenant_id, branch_id, brand, model, year, color, vin, vin_matching, card_number,
                        price, cost_price, supplier, ownership_type, status, rental_status, notes, entry_date,
                        has_plate, plate_number, plate_owner_name, plate_serial_number, plate_issue_date,
                        card_file, card_file_name, attribution_source, is_present_in_showroom, is_outbound,
                        car_remark, status_note, seller, model_year, exit_type,
                        transfer_sender, transfer_receiver, transfer_no, transfer_date,
                        reserved_by_user_id, reservation_date,
                        created_at, updated_at
                    ) VALUES (
                        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?, ?,
                        ?, ?, ?, ?,
                        ?, ?,
                        NOW(), NOW()
                    )
                    ON DUPLICATE KEY UPDATE
                        brand = VALUES(brand),
                        model = VALUES(model),
                        year = VALUES(year),
                        color = VALUES(color),
                        vin = VALUES(vin),
                        vin_matching = VALUES(vin_matching),
                        card_number = VALUES(card_number),
                        price = VALUES(price),
                        cost_price = VALUES(cost_price),
                        supplier = VALUES(supplier),
                        ownership_type = VALUES(ownership_type),
                        status = VALUES(status),
                        rental_status = VALUES(rental_status),
                        notes = VALUES(notes),
                        entry_date = VALUES(entry_date),
                        has_plate = VALUES(has_plate),
                        plate_number = VALUES(plate_number),
                        plate_owner_name = VALUES(plate_owner_name),
                        plate_serial_number = VALUES(plate_serial_number),
                        plate_issue_date = VALUES(plate_issue_date),
                        card_file = COALESCE(VALUES(card_file), cars.card_file),
                        card_file_name = COALESCE(VALUES(card_file_name), cars.card_file_name),
                        attribution_source = VALUES(attribution_source),
                        is_present_in_showroom = VALUES(is_present_in_showroom),
                        is_outbound = VALUES(is_outbound),
                        car_remark = VALUES(car_remark),
                        status_note = VALUES(status_note),
                        seller = VALUES(seller),
                        model_year = VALUES(model_year),
                        exit_type = VALUES(exit_type),
                        transfer_sender = VALUES(transfer_sender),
                        transfer_receiver = VALUES(transfer_receiver),
                        transfer_no = VALUES(transfer_no),
                        transfer_date = VALUES(transfer_date),
                        reserved_by_user_id = VALUES(reserved_by_user_id),
                        reservation_date = VALUES(reservation_date),
                        updated_at = NOW()
                ');

                foreach ($rawList as $item) {
                    try {
                        $vin = strtoupper(trim($item['vin'] ?? ''));
                        if (empty($vin)) continue;

                        $existingCar = null;
                        try {
                            $checkStmt = $pdo->prepare('SELECT id FROM cars WHERE vin = ? LIMIT 1');
                            $checkStmt->execute([$vin]);
                            $existingCar = $checkStmt->fetch(\PDO::FETCH_ASSOC);
                        } catch (\Throwable $e) {}

                        $carId = $existingCar['id'] ?? ($item['id'] ?? ('car_' . bin2hex(random_bytes(8))));
                        $brand = mb_substr(trim($item['brand'] ?? ''), 0, 120, 'UTF-8');
                        if (empty($brand)) {
                            $brand = 'مركبة مستوردة';
                        }
                        $model = mb_substr(trim($item['model'] ?? ''), 0, 120, 'UTF-8');
                        if (empty($model)) {
                            $model = $brand;
                        }
                        $year = (int)($item['year'] ?? date('Y'));
                        $color = mb_substr(trim($item['color'] ?? ''), 0, 120, 'UTF-8');
                        $rawVinMatching = trim((string)($item['vinMatching'] ?? $item['vin_matching'] ?? ''));
                        if ($rawVinMatching === 'غير مطابق' || $rawVinMatching === 'غير متطابق' || $rawVinMatching === 'mismatch' || $rawVinMatching === 'غير_مطابق') {
                            $vinMatching = 'غير متطابق';
                        } else {
                            $vinMatching = 'متطابق';
                        }
                        $cardNumber = mb_substr(trim($item['cardNumber'] ?? $item['card_number'] ?? ''), 0, 120, 'UTF-8');
                        $price = (float)($item['price'] ?? 0);
                        $costPrice = (float)($item['costPrice'] ?? $item['cost_price'] ?? 0);
                        $supplier = mb_substr(trim($item['supplier'] ?? ''), 0, 120, 'UTF-8');
                        $ownershipType = mb_substr(trim($item['ownershipType'] ?? $item['ownership_type'] ?? 'مباشر'), 0, 60, 'UTF-8');
                        $status = mb_substr(trim($item['status'] ?? 'متوفره'), 0, 60, 'UTF-8');
                        $rentalStatus = mb_substr(trim($item['rentalStatus'] ?? $item['rental_status'] ?? 'لم يتم التجير'), 0, 60, 'UTF-8');
                        $notes = trim($item['notes'] ?? '');
                        $entryDate = normalizeDate($item['entryDate'] ?? $item['entry_date'] ?? null);

                        $plateData = $item['plateData'] ?? [];
                        $plateNumber = mb_substr(trim((string)($item['plateNumber'] ?? $plateData['plateNumber'] ?? '')), 0, 60, 'UTF-8') ?: null;
                        $plateOwnerName = mb_substr(trim((string)($plateData['ownerName'] ?? '')), 0, 120, 'UTF-8') ?: null;
                        $plateSerialNumber = mb_substr(trim((string)($plateData['serialNumber'] ?? '')), 0, 60, 'UTF-8') ?: null;
                        $plateIssueDate = normalizeDate($plateData['issueDate'] ?? ($item['plateIssueDate'] ?? null), 'null');
                        $hasPlate = (!empty($item['hasPlate']) || !empty($plateNumber)) ? 1 : 0;

                        $cardFile = $item['cardFile'] ?? $item['card_file'] ?? null;
                        $cardFileName = $item['cardFileName'] ?? $item['card_file_name'] ?? null;
                        $attributionSource = mb_substr(trim((string)($item['attributionSource'] ?? $item['attribution_source'] ?? '')), 0, 120, 'UTF-8') ?: null;
                        $isPresentInShowroom = isset($item['isPresentInShowroom']) ? ($item['isPresentInShowroom'] ? 1 : 0) : (isset($item['is_present_in_showroom']) ? ($item['is_present_in_showroom'] ? 1 : 0) : 1);
                        $isOutbound = !empty($item['isOutbound']) || !empty($item['is_outbound']) ? 1 : 0;
                        $carRemark = $item['carRemark'] ?? $item['car_remark'] ?? null;
                        $statusNote = $item['statusNote'] ?? $item['status_note'] ?? null;
                        $seller = mb_substr(trim((string)($item['seller'] ?? ($item['exitData']['seller'] ?? ''))), 0, 120, 'UTF-8') ?: null;
                        $modelYear = mb_substr(trim((string)($item['modelYear'] ?? $item['model_year'] ?? '')), 0, 60, 'UTF-8') ?: null;
                        $exitType = mb_substr(trim((string)($item['exitType'] ?? $item['exit_type'] ?? '')), 0, 60, 'UTF-8') ?: null;
                        $transferSender = mb_substr(trim((string)($item['transferSender'] ?? $item['transfer_sender'] ?? '')), 0, 120, 'UTF-8') ?: null;
                        $transferReceiver = mb_substr(trim((string)($item['transferReceiver'] ?? $item['transfer_receiver'] ?? '')), 0, 120, 'UTF-8') ?: null;
                        $transferNo = mb_substr(trim((string)($item['transferNo'] ?? $item['transfer_no'] ?? '')), 0, 60, 'UTF-8') ?: null;
                        $transferDate = !empty($item['transferDate']) ? normalizeDate($item['transferDate']) : null;
                        $reservedByUserId = $item['reservedByUserId'] ?? $item['reserved_by_user_id'] ?? null;
                        $reservationDate = !empty($item['reservationDate']) ? normalizeDate($item['reservationDate']) : null;

                        $stmt->execute([
                            $carId, $tenantId, $branchId, $brand, $model, $year, $color, $vin, $vinMatching, $cardNumber,
                            $price, $costPrice, $supplier, $ownershipType, $status, $rentalStatus, $notes, $entryDate,
                            $hasPlate, $plateNumber, $plateOwnerName, $plateSerialNumber, $plateIssueDate,
                            $cardFile, $cardFileName, $attributionSource, $isPresentInShowroom, $isOutbound,
                            $carRemark, $statusNote, $seller, $modelYear, $exitType,
                            $transferSender, $transferReceiver, $transferNo, $transferDate,
                            $reservedByUserId, $reservationDate
                        ]);

                        $saved = fetchCarFromDb($carId);
                        if (!$saved) {
                            $carByVin = Database::queryOne('SELECT id FROM cars WHERE vin = ?', [$vin]);
                            if ($carByVin && !empty($carByVin['id'])) {
                                $saved = fetchCarFromDb((string)$carByVin['id']);
                            }
                        }
                        if ($saved) {
                            $createdList[] = $saved;
                        }

                        $customMap = (is_array($item['customData'] ?? null)) ? $item['customData'] : [];
                        if (!empty($item['interiorColor']) && !isset($customMap['interiorColor'])) {
                            $customMap['interiorColor'] = $item['interiorColor'];
                        }
                        if (!empty($item['presenceDescription']) && !isset($customMap['presenceDescription'])) {
                            $customMap['presenceDescription'] = $item['presenceDescription'];
                        }
                        if (!empty($customMap)) {
                            try {
                                $pdo->prepare('DELETE FROM car_custom_fields WHERE car_id = ?')->execute([$carId]);
                                $cfStmt = $pdo->prepare('INSERT INTO car_custom_fields (car_id, field_key, field_value) VALUES (?, ?, ?)');
                                foreach ($customMap as $k => $v) {
                                    if ($k !== '' && $v !== null && $v !== '') {
                                        $cfStmt->execute([$carId, mb_substr((string)$k, 0, 120, 'UTF-8'), (string)$v]);
                                    }
                                }
                            } catch (\Throwable $e) {}
                        }

                        if (!empty($item['exitData']) && is_array($item['exitData'])) {
                            try {
                                $ed = $item['exitData'];
                                $pdo->prepare('DELETE FROM car_exit_data WHERE car_id = ?')->execute([$carId]);
                                $exitStmt = $pdo->prepare('
                                    INSERT INTO car_exit_data (
                                        car_id, receiver_name, receiver_phone, receiver_id, delivery_type,
                                        transport_company, sale_type, bank_name, exit_date, notes,
                                        seller, representative_name, car_condition, created_at
                                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                                ');
                                $exitStmt->execute([
                                    $carId,
                                    mb_substr((string)($ed['receiverName'] ?? ''), 0, 120, 'UTF-8'),
                                    mb_substr((string)($ed['receiverPhone'] ?? ''), 0, 60, 'UTF-8'),
                                    mb_substr((string)($ed['receiverId'] ?? ''), 0, 60, 'UTF-8'),
                                    mb_substr((string)($ed['deliveryType'] ?? 'مالك'), 0, 60, 'UTF-8'),
                                    mb_substr((string)($ed['transportCompany'] ?? ''), 0, 120, 'UTF-8'),
                                    mb_substr((string)($ed['saleType'] ?? ''), 0, 60, 'UTF-8'),
                                    mb_substr((string)($ed['bankName'] ?? ''), 0, 120, 'UTF-8'),
                                    !empty($ed['exitDate']) ? normalizeDate($ed['exitDate']) : date('Y-m-d'),
                                    (string)($ed['notes'] ?? ''),
                                    mb_substr((string)($ed['seller'] ?? ''), 0, 120, 'UTF-8'),
                                    mb_substr((string)($ed['representativeName'] ?? ($ed['seller'] ?? '')), 0, 120, 'UTF-8'),
                                    (string)($ed['carCondition'] ?? '')
                                ]);
                            } catch (\Throwable $e) {}
                        }
                    } catch (\Throwable $e) {
                        error_log("Error bulk inserting car row: " . $e->getMessage());
                    }
                }
            });

            logAudit('BULK_CREATE_CARS', 'bulk', 'cars', 'إدخال جماعي لعدد ' . count($createdList) . ' سيارة');
            jsonSuccess('تم إدخال السيارات بنجاح.', ['data' => $createdList, 'cars' => $createdList, 'count' => count($createdList)]);
        }

        // Single Car Creation
        $brand = trim($body['brand'] ?? '');
        $model = trim($body['model'] ?? '');
        $year = (int)($body['year'] ?? date('Y'));
        $color = trim($body['color'] ?? '');
        $vin = strtoupper(trim($body['vin'] ?? ''));
        $price = (float)($body['price'] ?? 0);
        $costPrice = (float)($body['costPrice'] ?? $body['cost_price'] ?? 0);
        $cardNumber = trim($body['cardNumber'] ?? $body['card_number'] ?? '');
        $supplier = trim($body['supplier'] ?? '');
        $ownershipType = trim($body['ownershipType'] ?? $body['ownership_type'] ?? 'مباشر');
        $status = trim($body['status'] ?? 'متوفره');
        $rentalStatus = trim($body['rentalStatus'] ?? $body['rental_status'] ?? 'لم يتم التجير');
        $notes = trim($body['notes'] ?? '');
        $entryDate = normalizeDate($body['entryDate'] ?? $body['entry_date'] ?? null);
        $branchId = $body['branchId'] ?? $body['branch_id'] ?? ($currentUser['branch_id'] ?? 'branch-main');
        $tenantId = $currentUser['tenant_id'] ?? 'org-default';

        if (empty($brand) || empty($model) || empty($vin)) {
            jsonError('الرجاء إدخال الشركة المصنعة، الموديل، ورقم الهيكل (VIN).', 400);
        }

        // Check if VIN already exists
        $existing = Database::queryOne('SELECT id FROM cars WHERE vin = ?', [$vin]);
        if ($existing) {
            jsonError("رقم الهيكل ({$vin}) مسجل مسبقاً في قاعدة البيانات.", 409);
        }

        $carId = $body['id'] ?? ('car_' . bin2hex(random_bytes(8)));
        $brand = mb_substr(trim($body['brand'] ?? ''), 0, 120, 'UTF-8');
        $model = mb_substr(trim($body['model'] ?? ''), 0, 120, 'UTF-8');
        $color = mb_substr(trim($body['color'] ?? ''), 0, 120, 'UTF-8');
        $rawVinMatching = trim((string)($body['vinMatching'] ?? $body['vin_matching'] ?? ''));
        if ($rawVinMatching === 'غير مطابق' || $rawVinMatching === 'غير متطابق' || $rawVinMatching === 'mismatch' || $rawVinMatching === 'غير_مطابق') {
            $vinMatching = 'غير متطابق';
        } else {
            $vinMatching = 'متطابق';
        }
        $cardNumber = mb_substr(trim($body['cardNumber'] ?? $body['card_number'] ?? ''), 0, 120, 'UTF-8');
        $supplier = mb_substr(trim($body['supplier'] ?? ''), 0, 120, 'UTF-8');
        $ownershipType = mb_substr(trim($body['ownershipType'] ?? $body['ownership_type'] ?? 'مباشر'), 0, 60, 'UTF-8');
        $status = mb_substr(trim($body['status'] ?? 'متوفره'), 0, 60, 'UTF-8');
        $rentalStatus = mb_substr(trim($body['rentalStatus'] ?? $body['rental_status'] ?? 'لم يتم التجير'), 0, 60, 'UTF-8');

        $plateData = $body['plateData'] ?? [];
        $plateNumber = mb_substr(trim((string)($body['plateNumber'] ?? $plateData['plateNumber'] ?? '')), 0, 60, 'UTF-8') ?: null;
        $plateOwnerName = mb_substr(trim((string)($plateData['ownerName'] ?? '')), 0, 120, 'UTF-8') ?: null;
        $plateSerialNumber = mb_substr(trim((string)($plateData['serialNumber'] ?? '')), 0, 60, 'UTF-8') ?: null;
        $plateIssueDate = normalizeDate($plateData['issueDate'] ?? ($body['plateIssueDate'] ?? null), 'null');
        $hasPlate = (!empty($body['hasPlate']) || !empty($plateNumber)) ? 1 : 0;

        $cardFile = $body['cardFile'] ?? $body['card_file'] ?? null;
        $cardFileName = $body['cardFileName'] ?? $body['card_file_name'] ?? null;
        $attributionSource = mb_substr(trim((string)($body['attributionSource'] ?? $body['attribution_source'] ?? '')), 0, 120, 'UTF-8') ?: null;
        $isPresentInShowroom = isset($body['isPresentInShowroom']) ? ($body['isPresentInShowroom'] ? 1 : 0) : (isset($body['is_present_in_showroom']) ? ($body['is_present_in_showroom'] ? 1 : 0) : 1);
        $isOutbound = !empty($body['isOutbound']) || !empty($body['is_outbound']) ? 1 : 0;
        $carRemark = $body['carRemark'] ?? $body['car_remark'] ?? null;
        $statusNote = $body['statusNote'] ?? $body['status_note'] ?? null;
        $seller = mb_substr(trim((string)($body['seller'] ?? ($body['exitData']['seller'] ?? ''))), 0, 120, 'UTF-8') ?: null;
        $modelYear = mb_substr(trim((string)($body['modelYear'] ?? $body['model_year'] ?? '')), 0, 60, 'UTF-8') ?: null;
        $exitType = mb_substr(trim((string)($body['exitType'] ?? $body['exit_type'] ?? '')), 0, 60, 'UTF-8') ?: null;
        $transferSender = mb_substr(trim((string)($body['transferSender'] ?? $body['transfer_sender'] ?? '')), 0, 120, 'UTF-8') ?: null;
        $transferReceiver = mb_substr(trim((string)($body['transferReceiver'] ?? $body['transfer_receiver'] ?? '')), 0, 120, 'UTF-8') ?: null;
        $transferNo = mb_substr(trim((string)($body['transferNo'] ?? $body['transfer_no'] ?? '')), 0, 60, 'UTF-8') ?: null;
        $transferDate = !empty($body['transferDate']) ? normalizeDate($body['transferDate']) : null;
        $reservedByUserId = $body['reservedByUserId'] ?? $body['reserved_by_user_id'] ?? null;
        $reservationDate = !empty($body['reservationDate']) ? normalizeDate($body['reservationDate']) : null;

        $pdoConn = Database::connect();
        if ($pdoConn) {
            autoHealCarsTableColumns($pdoConn);
        }

        Database::transaction(function ($pdo) use (
            $carId, $tenantId, $branchId, $brand, $model, $year, $color,
            $vin, $vinMatching, $cardNumber, $price, $costPrice, $supplier, $ownershipType,
            $status, $rentalStatus, $entryDate, $notes, $hasPlate, $plateNumber,
            $plateOwnerName, $plateSerialNumber, $plateIssueDate,
            $cardFile, $cardFileName, $attributionSource, $isPresentInShowroom, $isOutbound,
            $carRemark, $statusNote, $seller, $modelYear, $exitType,
            $transferSender, $transferReceiver, $transferNo, $transferDate,
            $reservedByUserId, $reservationDate,
            $currentUser, $body
        ) {
            $stmt = $pdo->prepare('
                INSERT INTO cars (
                    id, tenant_id, branch_id, brand, model, year, color, vin, vin_matching, card_number,
                    price, cost_price, supplier, ownership_type, status, rental_status, notes, entry_date,
                    has_plate, plate_number, plate_owner_name, plate_serial_number, plate_issue_date,
                    card_file, card_file_name, attribution_source, is_present_in_showroom, is_outbound,
                    car_remark, status_note, seller, model_year, exit_type,
                    transfer_sender, transfer_receiver, transfer_no, transfer_date,
                    reserved_by_user_id, reservation_date,
                    created_at, updated_at
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?,
                    NOW(), NOW()
                )
            ');

            $stmt->execute([
                $carId, $tenantId, $branchId, $brand, $model, $year, $color, $vin, $vinMatching, $cardNumber,
                $price, $costPrice, $supplier, $ownershipType, $status, $rentalStatus, $notes, $entryDate,
                $hasPlate, $plateNumber, $plateOwnerName, $plateSerialNumber, $plateIssueDate,
                $cardFile, $cardFileName, $attributionSource, $isPresentInShowroom, $isOutbound,
                $carRemark, $statusNote, $seller, $modelYear, $exitType,
                $transferSender, $transferReceiver, $transferNo, $transferDate,
                $reservedByUserId, $reservationDate
            ]);

            // Save exitData if provided
            if (!empty($body['exitData']) && is_array($body['exitData'])) {
                $exit = $body['exitData'];
                $hasExitDetails = !empty($exit['receiverName']) || !empty($exit['seller']) || (!empty($exit['exitDate']) && ($status === 'مباعة' || $status === 'محجوزة' || !empty($isOutbound)));
                if ($hasExitDetails) {
                    try {
                        $pdo->prepare('
                            INSERT INTO car_exit_data (
                                car_id, receiver_name, receiver_phone, receiver_id, nationality,
                                delivery_type, transport_company, exit_date, seller, sale_type,
                                bank_name, representative_name, car_condition, notes
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ON DUPLICATE KEY UPDATE
                                receiver_name = VALUES(receiver_name),
                                receiver_phone = VALUES(receiver_phone),
                                receiver_id = VALUES(receiver_id),
                                nationality = VALUES(nationality),
                                delivery_type = VALUES(delivery_type),
                                transport_company = VALUES(transport_company),
                                exit_date = VALUES(exit_date),
                                seller = VALUES(seller),
                                sale_type = VALUES(sale_type),
                                bank_name = VALUES(bank_name),
                                representative_name = VALUES(representative_name),
                                car_condition = VALUES(car_condition),
                                notes = VALUES(notes)
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
                    } catch (\Throwable $exitErr) {
                        // Fallback query if table lacks nationality column
                        try {
                            $pdo->prepare('
                                INSERT INTO car_exit_data (
                                    car_id, receiver_name, receiver_phone, receiver_id,
                                    delivery_type, transport_company, exit_date, seller, sale_type,
                                    bank_name, representative_name, car_condition, notes
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                ON DUPLICATE KEY UPDATE
                                    receiver_name = VALUES(receiver_name),
                                    receiver_phone = VALUES(receiver_phone),
                                    receiver_id = VALUES(receiver_id),
                                    delivery_type = VALUES(delivery_type),
                                    transport_company = VALUES(transport_company),
                                    exit_date = VALUES(exit_date),
                                    seller = VALUES(seller),
                                    sale_type = VALUES(sale_type),
                                    bank_name = VALUES(bank_name),
                                    representative_name = VALUES(representative_name),
                                    car_condition = VALUES(car_condition),
                                    notes = VALUES(notes)
                            ')->execute([
                                $carId,
                                $exit['receiverName'] ?? '',
                                $exit['receiverPhone'] ?? '',
                                $exit['receiverId'] ?? '',
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
                        } catch (\Throwable $t) {}
                    }
                }
            }

            // Save custom fields if provided
            $customMap = (is_array($body['customData'] ?? null)) ? $body['customData'] : [];
            if (!empty($body['interiorColor']) && !isset($customMap['interiorColor'])) {
                $customMap['interiorColor'] = $body['interiorColor'];
            }
            if (!empty($body['presenceDescription']) && !isset($customMap['presenceDescription'])) {
                $customMap['presenceDescription'] = $body['presenceDescription'];
            }
            if (!empty($customMap)) {
                try {
                    $cfStmt = $pdo->prepare('INSERT INTO car_custom_fields (car_id, field_key, field_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE field_value = VALUES(field_value)');
                    foreach ($customMap as $key => $val) {
                        $cfStmt->execute([$carId, (string)$key, (string)$val]);
                    }
                } catch (\Throwable $cfErr) {}
            }

            // Record movement safely
            try {
                $movStmt = $pdo->prepare('
                    INSERT INTO inventory_movements (id, tenant_id, branch_id, car_id, vin, movement_type, prev_status, new_status, user, details, timestamp)
                    VALUES (?, ?, ?, ?, ?, "إدخال_مخزون", NULL, ?, ?, "إدخال سيارة جديدة للمخزون", NOW())
                ');
                $movStmt->execute(['mov_' . bin2hex(random_bytes(8)), $tenantId, $branchId, $carId, $vin, $status, $currentUser['username'] ?? 'النظام']);
            } catch (\Throwable $movErr) {}
        });

        $savedCar = fetchCarFromDb($carId) ?: fetchCarFromDb($vin);
        if (!$savedCar) {
            jsonError('فشل التحقق من حفظ بيانات السيارة في قاعدة بيانات MySQL.', 500);
        }

        logAudit('CREATE_CAR', $carId, 'cars', "إضافة سيارة جديدة: {$brand} {$model} ({$vin})");
        jsonSuccess('تم حفظ السيارة في قاعدة بيانات MySQL بنجاح.', ['data' => $savedCar, 'car' => $savedCar]);
    } else if ($method === 'PUT' || $method === 'DELETE') {
        require __DIR__ . '/detail.php';
        exit;
    } else {
        jsonError('Method Not Allowed', 405);
    }
} catch (\Throwable $e) {
    jsonError('حدث خطأ أثناء معالجة بيانات السيارات: ' . $e->getMessage(), 500);
}
