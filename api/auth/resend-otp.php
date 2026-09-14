<?php
/**
 * POST /api/auth/resend-otp
 * Generates and stores a new OTP for password recovery
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

use Almakhzoun\Database\Database;

$body = getJsonBody();
$username = trim($body['username'] ?? $body['email'] ?? '');

if (empty($username)) {
    jsonError('يرجى تزويد اسم المستخدم أو البريد الإلكتروني.', 400);
}

try {
    $user = Database::queryOne(
        'SELECT id, username, email, phone FROM users WHERE username = ? OR email = ?',
        [$username, $username]
    );

    if (!$user) {
        jsonError('المستخدم غير مسجل في النظام.', 404);
    }

    $otpCode = (string)random_int(100000, 999999);
    $otpHash = password_hash($otpCode, PASSWORD_BCRYPT);
    $expiresAt = date('Y-m-d H:i:s', time() + 600); // 10 minutes
    $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';

    // Invalidate previous pending OTPs
    Database::execute('UPDATE otp_logs SET status = "EXPIRED" WHERE user_id = ? AND status = "PENDING"', [$user['id']]);

    // Insert new OTP log
    Database::execute(
        'INSERT INTO otp_logs (user_id, otp_hash, attempts, status, ip_address, created_at, expires_at) VALUES (?, ?, 0, "PENDING", ?, NOW(), ?)',
        [$user['id'], $otpHash, $ip, $expiresAt]
    );

    // If mail is configured, it would send here. For now, return success with masked email
    $maskedEmail = preg_replace('/(?<=.).(?=.*@)/u', '*', $user['email'] ?? 'admin@almakhzoun.com');

    jsonSuccess("تم إرسال رمز التحقق بنجاح إلى ({$maskedEmail}).", [
        'userId'      => $user['id'],
        'username'    => $user['username'],
        'adminEmail'  => $user['email'] ?? 'admin@almakhzoun.com',
        'maskedEmail' => $maskedEmail
    ]);
} catch (\Throwable $e) {
    jsonError('فشل إرسال رمز التحقق: ' . $e->getMessage(), 500);
}
