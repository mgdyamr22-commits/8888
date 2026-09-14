<?php
/**
 * POST /api/auth/reset-password
 * Updates password after verified OTP, security questions, recovery code, recovery file, or admin override
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

use Almakhzoun\Database\Database;
use Almakhzoun\Config\Security;

$body = getJsonBody();
$username = trim((string)($body['username'] ?? ''));
$userId = trim((string)($body['userId'] ?? ''));
$resetToken = trim((string)($body['resetToken'] ?? ''));
$newPassword = (string)($body['newPassword'] ?? $body['password'] ?? '');

if (empty($newPassword)) {
    jsonError('كلمة المرور الجديدة مطلوبة.', 400);
}

if (strlen($newPassword) < 6) {
    jsonError('كلمة المرور يجب ألا تقل عن 6 أحرف.', 400);
}

$user = null;

// 1. Resolve user via verified reset token if provided
if (!empty($resetToken)) {
    $tokenPayload = Security::verifyToken($resetToken);
    if (!$tokenPayload) {
        jsonError('رمز تفويض الاستعادة منتهي الصلاحية أو غير صالح. يرجى إعادة محاولة التحقق.', 403);
    }

    $purpose = $tokenPayload['purpose'] ?? $tokenPayload['type'] ?? '';
    if (!in_array($purpose, ['password_reset', 'password-reset'], true)) {
        jsonError('رمز التفويض غير مخصص لإعادة تعيين كلمة المرور.', 403);
    }

    $tokenUserId = $tokenPayload['userId'] ?? $tokenPayload['sub'] ?? '';
    $tokenUsername = $tokenPayload['username'] ?? '';

    if (!empty($tokenUserId)) {
        $user = Database::queryOne('SELECT * FROM users WHERE id = ?', [$tokenUserId]);
    }
    if (!$user && !empty($tokenUsername)) {
        $user = Database::queryOne('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [$tokenUsername]);
    }
}

// 2. If token did not resolve user directly, try input username or userId
if (!$user) {
    if (!empty($username)) {
        $user = Database::queryOne('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [$username]);
    } elseif (!empty($userId)) {
        $user = Database::queryOne('SELECT * FROM users WHERE id = ?', [$userId]);
    }

    // If reset token is missing, enforce Admin authentication
    if ($user && empty($resetToken)) {
        $admin = getAuthenticatedUser();
        if (!$admin || $admin['role'] !== 'مدير') {
            jsonError('غير مصرح بتعيين كلمة المرور بدون رمز استرداد صالح أو صلاحيات مدير النظام.', 403);
        }
    }
}

if (!$user) {
    jsonError('لم يتم العثور على حساب المستخدم المحدد لتحديث كلمة المرور.', 404);
}

try {
    $passwordHash = Security::hashPassword($newPassword);
    Database::execute(
        'UPDATE users SET password_hash = ?, failed_attempts = 0, lockout_until = NULL WHERE id = ?',
        [$passwordHash, $user['id']]
    );

    logAudit('PASSWORD_RESET', $user['id'], 'users', "تم إعادة تعيين كلمة المرور بنجاح للمستخدم: {$user['username']}");

    jsonSuccess('تم تحديث واعتماد كلمة المرور الجديدة ومزامنة سجلات الأمان بنجاح. يمكنك الآن تسجيل الدخول.', [
        'username' => $user['username'],
        'userId'   => $user['id']
    ]);
} catch (\Throwable $e) {
    jsonError('فشل إعادة تعيين كلمة المرور: ' . $e->getMessage(), 500);
}
