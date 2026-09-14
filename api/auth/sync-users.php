<?php
/**
 * POST /api/auth/sync-users
 */
declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';
use Almakhzoun\Database\Database;

// Only system administrators can sync users cache
$currentUser = requireAdmin();

$body = getJsonBody();
$users = $body['users'] ?? [];

if (!empty($users) && is_array($users)) {
    try {
        Database::execute(
            "INSERT INTO system_settings (setting_key, setting_value, updated_at) 
             VALUES ('synced_users_cache', ?, NOW()) 
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()",
            [json_encode($users, JSON_UNESCAPED_UNICODE)]
        );
    } catch (\Throwable $e) {
        // Silently catch
    }
}

jsonSuccess('تمت مزامنة المستخدمين بنجاح.');
