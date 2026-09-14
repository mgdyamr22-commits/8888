<?php
/**
 * Common API Helpers and PSR-4 Auto-loader
 */

declare(strict_types=1);

// 1. PSR-4 Autoloader for Almakhzoun namespace
spl_autoload_register(function ($class) {
    $prefix = 'Almakhzoun\\';
    $baseDir = dirname(__DIR__) . '/';

    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) {
        return;
    }

    $relativeClass = substr($class, $len);
    $normalizedPath = str_replace('\\', '/', $relativeClass);
    $file = $baseDir . $normalizedPath . '.php';

    if (file_exists($file)) {
        require_once $file;
        return;
    }

    // Lowercase directory fallback (e.g. Config -> config, Database -> database)
    $parts = explode('/', $normalizedPath);
    if (count($parts) > 1) {
        for ($i = 0; $i < count($parts) - 1; $i++) {
            $parts[$i] = strtolower($parts[$i]);
        }
        $fallbackFile = $baseDir . implode('/', $parts) . '.php';
        if (file_exists($fallbackFile)) {
            require_once $fallbackFile;
            return;
        }

        // All lowercase fallback
        $allLower = $baseDir . strtolower($normalizedPath) . '.php';
        if (file_exists($allLower)) {
            require_once $allLower;
            return;
        }
    }
});

use Almakhzoun\Config\Security;
use Almakhzoun\Config\Paths;
use Almakhzoun\Database\Database;

// 2. Set CORS, Error Handling, and Output Buffering
if (!ob_get_level()) {
    ob_start();
}
error_reporting(E_ALL & ~E_NOTICE & ~E_DEPRECATED);
ini_set('display_errors', '0');

Security::setCorsHeaders();
Paths::ensureDirectories();

// 3. Helper Functions
function jsonResponse(array $data, int $status = 200): void
{
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0, private');
    header('Pragma: no-cache');
    header('Expires: 0');
    header('X-LiteSpeed-Cache-Control: no-cache');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function jsonSuccess(string $message = 'Success', array $extra = []): void
{
    jsonResponse(array_merge(['success' => true, 'message' => $message], $extra), 200);
}

function jsonError(string $message, int $status = 400, array $extra = []): void
{
    jsonResponse(array_merge(['success' => false, 'error' => $message, 'message' => $message], $extra), $status);
}

function getJsonBody(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function getBearerToken(): ?string
{
    // 1. Check $_SERVER environment variables (handling multiple rewrite levels)
    $serverKeys = [
        'HTTP_AUTHORIZATION',
        'REDIRECT_HTTP_AUTHORIZATION',
        'REDIRECT_REDIRECT_HTTP_AUTHORIZATION',
        'Authorization',
        'HTTP_X_AUTHORIZATION',
        'REDIRECT_HTTP_X_AUTHORIZATION',
        'HTTP_X_CUSTOM_AUTH'
    ];

    $authHeader = '';
    foreach ($serverKeys as $k) {
        if (!empty($_SERVER[$k])) {
            $authHeader = trim((string)$_SERVER[$k]);
            break;
        }
    }

    // 2. Check Apache request headers case-insensitively
    if (empty($authHeader) && function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        if (is_array($headers)) {
            foreach ($headers as $hk => $hv) {
                if (in_array(strtolower($hk), ['authorization', 'x-authorization', 'x-custom-auth'])) {
                    $authHeader = trim((string)$hv);
                    break;
                }
            }
        }
    }

    // 3. Check getallheaders case-insensitively
    if (empty($authHeader) && function_exists('getallheaders')) {
        $headers = getallheaders();
        if (is_array($headers)) {
            foreach ($headers as $hk => $hv) {
                if (in_array(strtolower($hk), ['authorization', 'x-authorization', 'x-custom-auth'])) {
                    $authHeader = trim((string)$hv);
                    break;
                }
            }
        }
    }

    if (!empty($authHeader)) {
        if (preg_match('/Bearer\s+(\S+)/i', $authHeader, $matches)) {
            return $matches[1];
        }
        // Direct token passed without "Bearer " prefix
        if (substr_count($authHeader, '.') === 2) {
            return $authHeader;
        }
    }

    // 4. Check query or body parameter
    if (!empty($_GET['token'])) {
        return trim((string)$_GET['token']);
    }
    if (!empty($_GET['auth_token'])) {
        return trim((string)$_GET['auth_token']);
    }
    if (!empty($_POST['auth_token'])) {
        return trim((string)$_POST['auth_token']);
    }

    return null;
}

function getAuthenticatedUser(): ?array
{
    $token = getBearerToken();
    if (!$token) {
        return null;
    }

    $payload = Security::verifyToken($token);
    if (!$payload || empty($payload['userId'])) {
        return null;
    }

    try {
        $user = Database::queryOne('SELECT id, username, full_name, email, role, branch_id, tenant_id FROM users WHERE id = ? AND is_active = 1', [$payload['userId']]);
        return $user;
    } catch (\Throwable $e) {
        return null;
    }
}

function requireAuth(): array
{
    $user = getAuthenticatedUser();
    if (!$user) {
        jsonError('غير مصرح لك بالوصول. يرجى تسجيل الدخول أولاً.', 401);
    }
    return $user;
}

function getAuthenticatedDelegate(): ?array
{
    $token = getBearerToken();
    if (!$token) {
        return null;
    }

    $payload = Security::verifyToken($token);
    if (!$payload || empty($payload['delegateId'])) {
        return null;
    }

    try {
        $delegate = Database::queryOne(
            'SELECT id, tenant_id, name, username, phone, email, specialty, is_active, target, notes FROM delegates WHERE id = ? AND is_active = 1',
            [$payload['delegateId']]
        );
        return $delegate;
    } catch (\Throwable $e) {
        return null;
    }
}

function requireDelegateAuth(): array
{
    $delegate = getAuthenticatedDelegate();
    if (!$delegate) {
        jsonError('غير مصرح لك بالوصول. يرجى تسجيل دخول المندوب أولاً.', 401);
    }
    return $delegate;
}

function requireAdmin(): array
{
    $user = requireAuth();
    if ($user['role'] !== 'مدير') {
        jsonError('هذا الإجراء يتطلب صلاحيات المدير العام.', 403);
    }
    return $user;
}

function logAudit(string $action, ?string $targetId = null, ?string $targetType = null, ?string $details = null): void
{
    $user = getAuthenticatedUser();
    $userId = $user['id'] ?? null;
    $userName = $user['full_name'] ?? $user['username'] ?? 'System';
    $tenantId = $user['tenant_id'] ?? 'org-default';
    $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
    $id = 'audit_' . bin2hex(random_bytes(8));

    try {
        Database::execute(
            'INSERT INTO audit_logs (id, tenant_id, user_id, user_name, action, target_id, target_type, details, ip_address, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
            [$id, $tenantId, $userId, $userName, $action, $targetId, $targetType, $details, $ip]
        );
    } catch (\Throwable $e) {
        // Silently skip audit error if table not ready
    }
}

/**
 * Normalizes any incoming date string (e.g. ISO-8601 '2026-08-25T12:00:00.000Z' or timestamp)
 * into MySQL DATE format ('YYYY-MM-DD').
 */
function normalizeDate(?string $dateStr, string $fallback = 'now'): ?string
{
    if (empty($dateStr)) {
        return $fallback === 'now' ? date('Y-m-d') : null;
    }
    try {
        $timestamp = strtotime($dateStr);
        if ($timestamp === false) {
            // Try extracting YYYY-MM-DD using regex
            if (preg_match('/^(\d{4}-\d{2}-\d{2})/', $dateStr, $m)) {
                return $m[1];
            }
            return $fallback === 'now' ? date('Y-m-d') : null;
        }
        return date('Y-m-d', $timestamp);
    } catch (\Throwable $e) {
        return $fallback === 'now' ? date('Y-m-d') : null;
    }
}

/**
 * Normalizes any incoming datetime string into MySQL DATETIME format ('YYYY-MM-DD HH:MM:SS').
 */
function normalizeDateTime(?string $dateTimeStr, string $fallback = 'now'): ?string
{
    if (empty($dateTimeStr)) {
        return $fallback === 'now' ? date('Y-m-d H:i:s') : null;
    }
    try {
        $timestamp = strtotime($dateTimeStr);
        if ($timestamp === false) {
            return $fallback === 'now' ? date('Y-m-d H:i:s') : null;
        }
        return date('Y-m-d H:i:s', $timestamp);
    } catch (\Throwable $e) {
        return $fallback === 'now' ? date('Y-m-d H:i:s') : null;
    }
}

/**
 * Formats a raw database car row and related relational records into a standardized frontend Car object.
 */
function mapCarRow(array $car, ?array $exitData = null, array $customFields = [], array $historyRows = []): array
{
    $customFieldMap = [];
    foreach ($customFields as $cf) {
        $customFieldMap[$cf['field_key']] = $cf['field_value'];
    }

    $vin = $car['vin'] ?? '';
    $rawVinMatching = trim((string)($car['vin_matching'] ?? ''));
    if ($rawVinMatching === 'غير مطابق' || $rawVinMatching === 'غير متطابق' || $rawVinMatching === 'mismatch' || $rawVinMatching === 'غير_مطابق') {
        $vinMatching = 'غير متطابق';
    } else {
        $vinMatching = 'متطابق';
    }

    $plateData = !empty($car['plate_number']) ? [
        'plateNumber'   => $car['plate_number'],
        'ownerName'     => $car['plate_owner_name'] ?? '',
        'serialNumber'  => $car['plate_serial_number'] ?? '',
        'issueDate'     => $car['plate_issue_date'] ?? ''
    ] : null;

    $formattedExitData = $exitData ? [
        'receiverName'      => $exitData['receiver_name'] ?? '',
        'receiverPhone'     => $exitData['receiver_phone'] ?? '',
        'receiverId'        => $exitData['receiver_id'] ?? '',
        'nationality'       => $exitData['nationality'] ?? '',
        'deliveryType'      => $exitData['delivery_type'] ?? 'صاحبها',
        'transportCompany'  => $exitData['transport_company'] ?? '',
        'exitDate'          => $exitData['exit_date'] ?? '',
        'notes'             => $exitData['notes'] ?? '',
        'seller'            => $exitData['seller'] ?? '',
        'saleType'          => $exitData['sale_type'] ?? '',
        'bankName'          => $exitData['bank_name'] ?? '',
        'representativeName'=> $exitData['representative_name'] ?? '',
        'carCondition'      => $exitData['car_condition'] ?? ''
    ] : null;

    return [
        'id'                  => (string)$car['id'],
        'tenantId'            => $car['tenant_id'] ?? 'org-default',
        'branchId'            => $car['branch_id'] ?? null,
        'brand'               => (string)$car['brand'],
        'model'               => (string)$car['model'],
        'year'                => (int)($car['year'] ?? date('Y')),
        'color'               => (string)$car['color'],
        'interiorColor'       => $car['interior_color'] ?? ($customFieldMap['interiorColor'] ?? $customFieldMap['interior_color'] ?? ''),
        'vin'                 => $vin,
        'vinMatching'         => $vinMatching,
        'cardNumber'          => $car['card_number'] ?? '',
        'price'               => (float)($car['price'] ?? 0),
        'costPrice'           => (float)($car['cost_price'] ?? 0),
        'supplier'            => $car['supplier'] ?? '',
        'ownershipType'       => $car['ownership_type'] ?? 'مباشر',
        'status'              => $car['status'] ?? 'متوفره',
        'rentalStatus'        => $car['rental_status'] ?? 'لم يتم التجير',
        'entryDate'           => $car['entry_date'] ?? date('Y-m-d'),
        'attributionSource'   => $car['attribution_source'] ?? null,
        'isPresentInShowroom' => (bool)($car['is_present_in_showroom'] ?? 1),
        'presenceDescription' => $car['presence_description'] ?? ($customFieldMap['presenceDescription'] ?? $customFieldMap['presence_description'] ?? ''),
        'isOutbound'          => (bool)($car['is_outbound'] ?? 0),
        'hasPlate'            => (bool)($car['has_plate'] ?? (!empty($car['plate_number']) ? 1 : 0)),
        'plateData'           => $plateData,
        'cardFile'            => $car['card_file'] ?? null,
        'cardFileName'        => $car['card_file_name'] ?? null,
        'statusNote'          => $car['status_note'] ?? null,
        'carRemark'           => $car['car_remark'] ?? null,
        'notes'               => $car['notes'] ?? null,
        'seller'              => $car['seller'] ?? null,
        'modelYear'           => $car['model_year'] ?? null,
        'exitType'            => $car['exit_type'] ?? null,
        'transferSender'      => $car['transfer_sender'] ?? null,
        'transferReceiver'    => $car['transfer_receiver'] ?? null,
        'transferNo'          => $car['transfer_no'] ?? null,
        'transferDate'        => $car['transfer_date'] ?? null,
        'reservedByUserId'    => $car['reserved_by_user_id'] ?? null,
        'reservationDate'     => $car['reservation_date'] ?? null,
        'exitData'            => $formattedExitData,
        'customData'          => $customFieldMap,
        'history'             => $historyRows ?: [],
        'lastModified'        => $car['updated_at'] ?? $car['created_at'] ?? date('c'),
        'updatedAt'           => $car['updated_at'] ?? $car['created_at'] ?? date('c')
    ];
}

/**
 * Fetches and fully hydrates a single vehicle directly from the MySQL database.
 */
function fetchCarFromDb(string $carIdOrVin): ?array
{
    $car = Database::queryOne('SELECT * FROM cars WHERE id = ? OR vin = ? LIMIT 1', [$carIdOrVin, $carIdOrVin]);
    if (!$car) {
        return null;
    }

    $actualId = (string)$car['id'];
    $exitData = Database::queryOne('SELECT * FROM car_exit_data WHERE car_id = ?', [$actualId]);
    $customFields = Database::query('SELECT field_key, field_value FROM car_custom_fields WHERE car_id = ?', [$actualId]);
    $historyRows = Database::query('SELECT * FROM car_history WHERE car_id = ? ORDER BY timestamp DESC', [$actualId]);

    return mapCarRow($car, $exitData, $customFields, $historyRows);
}

