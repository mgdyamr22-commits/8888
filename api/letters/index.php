<?php
/**
 * /api/letters
 * GET, POST, DELETE for Official Letters Archive
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

use Almakhzoun\Database\Database;

$currentUser = requireAuth();
$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        $letters = Database::query('SELECT * FROM letters_archive ORDER BY letter_date DESC');
        foreach ($letters as &$l) {
            $l['letterNumber'] = $l['letter_number'];
            $l['letterType'] = $l['letter_type'];
            $l['letterDate'] = $l['letter_date'];
            $l['plateNumber'] = $l['plate_number'];
            $l['cardNumber'] = $l['card_number'];
            $l['vehicleName'] = $l['vehicle_name'];
            $l['driverName'] = $l['driver_name'];
            $l['createdBy'] = $l['created_by'];
            $l['htmlContent'] = $l['html_content'];
        }
        jsonSuccess('Success', ['letters' => $letters, 'count' => count($letters)]);
    } else if ($method === 'POST') {
        $body = getJsonBody();
        $letterNumber = trim($body['letterNumber'] ?? $body['letter_number'] ?? 'LTR-' . rand(1000, 9999));
        $letterType = trim($body['letterType'] ?? $body['letter_type'] ?? 'خطاب رسمي');
        $letterDate = $body['letterDate'] ?? $body['letter_date'] ?? date('Y-m-d');
        $vin = trim($body['vin'] ?? '');
        $plateNumber = trim($body['plateNumber'] ?? $body['plate_number'] ?? '');
        $cardNumber = trim($body['cardNumber'] ?? $body['card_number'] ?? '');
        $vehicleName = trim($body['vehicleName'] ?? $body['vehicle_name'] ?? '');
        $driverName = trim($body['driverName'] ?? $body['driver_name'] ?? '');
        $destination = trim($body['destination'] ?? '');
        $htmlContent = $body['htmlContent'] ?? $body['html_content'] ?? '';

        if (empty($htmlContent)) {
            jsonError('محتوى الخطاب مطلوب.', 400);
        }

        $id = 'ltr_' . bin2hex(random_bytes(8));
        Database::execute('
            INSERT INTO letters_archive (
                id, tenant_id, letter_number, letter_type, letter_date, vin,
                plate_number, card_number, vehicle_name, driver_name, destination,
                created_by, html_content, created_at
            ) VALUES (?, "org-default", ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ', [
            $id, $letterNumber, $letterType, $letterDate, $vin,
            $plateNumber, $cardNumber, $vehicleName, $driverName, $destination,
            $currentUser['username'], $htmlContent
        ]);

        logAudit('CREATE_LETTER', $id, 'letters_archive', "أرشفة خطاب رسمي رقم {$letterNumber} ({$letterType})");
        jsonSuccess('تم حفظ وأرشفة الخطاب بنجاح.', ['letterId' => $id, 'letterNumber' => $letterNumber]);
    } else if ($method === 'DELETE') {
        $id = $_GET['id'] ?? '';
        if (empty($id)) {
            jsonError('معرف الخطاب مطلوب.', 400);
        }

        Database::execute('DELETE FROM letters_archive WHERE id = ?', [$id]);
        logAudit('DELETE_LETTER', $id, 'letters_archive', "حذف خطاب من الأرشيف: {$id}");
        jsonSuccess('تم حذف الخطاب بنجاح.');
    } else {
        jsonError('Method Not Allowed', 405);
    }
} catch (\Throwable $e) {
    jsonError('حدث خطأ أثناء معالجة أرشيف الخطابات: ' . $e->getMessage(), 500);
}
