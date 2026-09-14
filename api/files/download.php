<?php
/**
 * GET /api/files/download or /api/files/get
 * Safe file download/view endpoint
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

use Almakhzoun\Config\Paths;
use Almakhzoun\Database\Database;

$fileName = basename($_GET['file'] ?? '');

if (empty($fileName)) {
    jsonError('اسم الملف مطلوب.', 400);
}

// Security: If the request is from a delegate, only allow downloading files of cars reserved by this delegate
$delegate = getAuthenticatedDelegate();
if ($delegate) {
    $delegateName = $delegate['name'] ?: $delegate['username'];
    $delegateUsername = $delegate['username'];
    $delegateId = $delegate['id'];

    $isAllowed = false;
    try {
        $allowedCar = Database::queryOne("
            SELECT id FROM cars 
            WHERE (card_file LIKE ? OR card_file = ? OR card_file_name = ?)
              AND (
                LOWER(reserved_by_user_id) = LOWER(?)
                OR LOWER(reserved_by_user_id) = LOWER(?)
                OR reserved_by_user_id = ?
                OR LOWER(seller) = LOWER(?)
                OR LOWER(seller) = LOWER(?)
              )
            LIMIT 1
        ", ['%' . $fileName, $fileName, $fileName, $delegateUsername, $delegateName, $delegateId, $delegateUsername, $delegateName]);

        if ($allowedCar) {
            $isAllowed = true;
        }
    } catch (\Throwable $e) {}

    if (!$isAllowed) {
        jsonError('غير مصرح لك بتحميل أو استعراض مستندات هذه السيارة. المستندات متاحة حصرياً للسيارات المحجوزة باسمك.', 403);
    }
}

$filePath = Paths::uploads() . '/' . $fileName;

if (!file_exists($filePath)) {
    jsonError('الملف غير موجود.', 404);
}

$mimeType = mime_content_type($filePath) ?: 'application/octet-stream';
header('Content-Type: ' . $mimeType);
header('Content-Length: ' . filesize($filePath));
header('Content-Disposition: inline; filename="' . $fileName . '"');
readfile($filePath);
exit;
