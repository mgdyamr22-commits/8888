<?php
/**
 * GET /api/auth/me
 * Returns the currently authenticated user's profile and permissions
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

use Almakhzoun\Database\Database;

$user = requireAuth();

try {
    $fullUser = Database::queryOne(
        'SELECT id, tenant_id, branch_id, username, role, full_name, email, phone, avatar, is_active FROM users WHERE id = ?',
        [$user['id']]
    );

    if (!$fullUser) {
        jsonError('المستخدم غير موجود', 404);
    }

    $perms = Database::query('SELECT permission_key FROM user_permissions WHERE user_id = ?', [$user['id']]);
    $permissionKeys = array_column($perms, 'permission_key');

    jsonSuccess('Success', [
        'user' => [
            'id'          => $fullUser['id'],
            'username'    => $fullUser['username'],
            'fullName'    => $fullUser['full_name'],
            'role'        => $fullUser['role'],
            'email'       => $fullUser['email'],
            'phone'       => $fullUser['phone'],
            'branchId'    => $fullUser['branch_id'],
            'tenantId'    => $fullUser['tenant_id'],
            'avatar'      => $fullUser['avatar'],
            'permissions' => $permissionKeys
        ]
    ]);
} catch (\Throwable $e) {
    jsonError('فشل جلب بيانات المستخدم: ' . $e->getMessage(), 500);
}
