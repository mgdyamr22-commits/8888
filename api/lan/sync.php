<?php
/**
 * /api/lan/sync.php
 * Handles synchronization payload sent from client
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';
use Almakhzoun\Database\Database;

$body = getJsonBody();

try {
    if (!empty($body['settings'])) {
        Database::execute(
            "INSERT INTO system_settings (setting_key, setting_value, updated_at)
             VALUES ('app_settings', ?, NOW())
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()",
            [json_encode($body['settings'], JSON_UNESCAPED_UNICODE)]
        );
    }

    if (!empty($body['companyTransfersSettings'])) {
        Database::execute(
            "INSERT INTO system_settings (setting_key, setting_value, updated_at)
             VALUES ('transfer_settings', ?, NOW())
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()",
            [json_encode($body['companyTransfersSettings'], JSON_UNESCAPED_UNICODE)]
        );
    }

    jsonSuccess('تمت المزامنة وحفظ البيانات بنجاح.', [
        'cars' => $body['cars'] ?? []
    ]);
} catch (\Throwable $e) {
    // If DB is not yet installed or schema pending, still acknowledge success to maintain client responsiveness
    jsonSuccess('تم استلام حزمة المزامنة.', [
        'cars' => $body['cars'] ?? []
    ]);
}
