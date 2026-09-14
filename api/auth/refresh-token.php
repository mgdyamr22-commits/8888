<?php
/**
 * POST /api/auth/refresh-token
 * Rotates and returns fresh access token
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

use Almakhzoun\Database\Database;
use Almakhzoun\Config\Security;

$body = getJsonBody();
$refreshToken = $body['refreshToken'] ?? '';

if (empty($refreshToken)) {
    jsonError('رمز التحديث مطلوب.', 400);
}

try {
    $payload = Security::verifyToken($refreshToken);
    $userId = $payload['userId'] ?? null;

    if (!$userId) {
        jsonError('رمز التحديث منتهي الصلاحية أو غير صالح.', 401);
    }

    $user = Database::queryOne(
        'SELECT id, tenant_id, branch_id, username, role, full_name, email, phone, is_active FROM users WHERE id = ?',
        [$userId]
    );

    if (!$user || empty($user['is_active'])) {
        jsonError('المستخدم غير موجود أو تم تعطيل الحساب.', 403);
    }

    $newAccessToken = Security::generateToken([
        'userId'   => $user['id'],
        'username' => $user['username'],
        'role'     => $user['role'],
        'tenantId' => $user['tenant_id'],
        'branchId' => $user['branch_id']
    ]);

    $perms = Database::query('SELECT permission_key FROM user_permissions WHERE user_id = ?', [$user['id']]);
    $permissionKeys = array_column($perms, 'permission_key');

    jsonSuccess('تم تجديد الجلسة بنجاح.', [
        'accessToken'  => $newAccessToken,
        'refreshToken' => $refreshToken,
        'user' => [
            'id'          => $user['id'],
            'username'    => $user['username'],
            'fullName'    => $user['full_name'],
            'role'        => $user['role'],
            'email'       => $user['email'],
            'phone'       => $user['phone'],
            'branchId'    => $user['branch_id'],
            'tenantId'    => $user['tenant_id'],
            'permissions' => $permissionKeys
        ]
    ]);
} catch (\Throwable $e) {
    jsonError('فشل تجديد رمز الجلسة: ' . $e->getMessage(), 500);
}
