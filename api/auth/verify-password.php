<?php
/**
 * POST /api/auth/verify-password
 * Verifies current user's password for sensitive actions (like deleting car or backup)
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

use Almakhzoun\Database\Database;
use Almakhzoun\Config\Security;

$user = requireAuth();
$body = getJsonBody();
$password = $body['password'] ?? '';

if (empty($password)) {
    jsonError('يرجى إدخال كلمة المرور للتأكيد.', 400);
}

try {
    $dbUser = Database::queryOne('SELECT password_hash FROM users WHERE id = ?', [$user['id']]);
    if (!$dbUser || !Security::verifyPassword($password, $dbUser['password_hash'])) {
        jsonError('كلمة المرور غير صحيحة.', 401);
    }

    jsonSuccess('تم التحقق من كلمة المرور بنجاح.');
} catch (\Throwable $e) {
    jsonError('حدث خطأ أثناء التحقق: ' . $e->getMessage(), 500);
}
