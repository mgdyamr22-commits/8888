<?php
/**
 * POST /api/auth/login
 * User Authentication with rate limiting and audit logging
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

use Almakhzoun\Database\Database;
use Almakhzoun\Config\Security;

$body = getJsonBody();
$username = trim($body['username'] ?? '');
$password = $body['password'] ?? '';

if (empty($username) || empty($password)) {
    jsonError('اسم المستخدم وكلمة المرور مطلوبان.', 400);
}

try {
    $user = Database::queryOne(
        'SELECT id, tenant_id, branch_id, username, password_hash, role, full_name, email, phone, avatar, is_active, failed_attempts, lockout_until FROM users WHERE username = ? OR email = ?',
        [$username, $username]
    );

    if (!$user) {
        jsonError('اسم المستخدم أو كلمة المرور غير صحيحة.', 401);
    }

    if (empty($user['is_active'])) {
        jsonError('هذا الحساب معطل، يرجى مراجعة إدارة النظام.', 403);
    }

    // Check lockout
    if (!empty($user['lockout_until']) && strtotime($user['lockout_until']) > time()) {
        $remaining = ceil((strtotime($user['lockout_until']) - time()) / 60);
        jsonError("الحساب مقفل مؤقتاً لكثرة المحاولات الخاطئة. يرجى المحاولة بعد {$remaining} دقيقة.", 429);
    }

    // Check password
    $isValid = Security::verifyPassword($password, $user['password_hash']);
    if (!$isValid) {
        // Increment failed attempts
        $attempts = ($user['failed_attempts'] ?? 0) + 1;
        $lockout = null;
        if ($attempts >= 5) {
            $lockout = date('Y-m-d H:i:s', time() + 900); // 15 minutes lockout
        }
        Database::execute('UPDATE users SET failed_attempts = ?, lockout_until = ? WHERE id = ?', [$attempts, $lockout, $user['id']]);
        
        jsonError('اسم المستخدم أو كلمة المرور غير صحيحة.', 401);
    }

    // Reset failed attempts & update last login
    Database::execute('UPDATE users SET failed_attempts = 0, lockout_until = NULL, last_login = NOW() WHERE id = ?', [$user['id']]);

    // Fetch user permissions
    $perms = Database::query('SELECT permission_key FROM user_permissions WHERE user_id = ?', [$user['id']]);
    $permissionKeys = array_column($perms, 'permission_key');

    // Generate token
    $token = Security::generateToken([
        'userId'   => $user['id'],
        'username' => $user['username'],
        'role'     => $user['role'],
        'tenantId' => $user['tenant_id'],
        'branchId' => $user['branch_id']
    ]);

    logAudit('LOGIN', $user['id'], 'users', 'تسجيل دخول ناجح للمستخدم: ' . $user['username']);

    jsonSuccess('تم تسجيل الدخول بنجاح.', [
        'token' => $token,
        'user'  => [
            'id'          => $user['id'],
            'username'    => $user['username'],
            'fullName'    => $user['full_name'],
            'role'        => $user['role'],
            'email'       => $user['email'],
            'phone'       => $user['phone'],
            'branchId'    => $user['branch_id'],
            'tenantId'    => $user['tenant_id'],
            'avatar'      => $user['avatar'],
            'permissions' => $permissionKeys
        ]
    ]);
} catch (\Throwable $e) {
    jsonError('حدث خطأ أثناء المصادقة: ' . $e->getMessage(), 500);
}
