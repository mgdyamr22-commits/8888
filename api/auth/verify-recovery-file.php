<?php
/**
 * POST /api/auth/verify-recovery-file
 * Validates encrypted recovery.key or AFS_KEY_V1 certificate payload and yields reset token
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

use Almakhzoun\Database\Database;
use Almakhzoun\Config\Security;

$body = getJsonBody();
$fileContent = trim((string)($body['fileContent'] ?? ''));
$deviceId = trim((string)($body['deviceId'] ?? ''));

if (empty($fileContent)) {
    jsonError('محتوى ملف الاستعادة فارغ أو غير صالح.', 400);
}

try {
    $payload = null;

    // 1. Check if raw JSON
    if (str_starts_with($fileContent, '{') && str_ends_with($fileContent, '}')) {
        $payload = json_decode($fileContent, true);
    }

    // 2. Check if AFS_KEY_V1 prefixed base64
    if (!$payload && str_starts_with($fileContent, 'AFS_KEY_V1:')) {
        $rawB64 = substr($fileContent, strlen('AFS_KEY_V1:'));
        $decodedJson = base64_decode($rawB64);
        if ($decodedJson) {
            $payload = json_decode($decodedJson, true);
        }
    }

    // 3. Check if base64 encoded JSON
    if (!$payload) {
        $b64Dec = base64_decode($fileContent, true);
        if ($b64Dec && str_starts_with(trim($b64Dec), '{')) {
            $payload = json_decode(trim($b64Dec), true);
        }
    }

    // 4. Check if AES encrypted payload
    if (!$payload) {
        try {
            $decrypted = Security::decryptAES($fileContent);
            if ($decrypted) {
                if (str_starts_with(trim($decrypted), '{')) {
                    $payload = json_decode(trim($decrypted), true);
                } elseif (str_starts_with($decrypted, 'AFS_KEY_V1:')) {
                    $rawB64 = substr($decrypted, strlen('AFS_KEY_V1:'));
                    $payload = json_decode(base64_decode($rawB64), true);
                }
            }
        } catch (\Throwable $e) {
            // continue
        }
    }

    if (!$payload || empty($payload['username']) || empty($payload['recoveryCode'])) {
        jsonError('مفتاح الاستعادة بالملف تالف أو غير صالح أو تم التلاعب به.', 400);
    }

    $username = trim((string)$payload['username']);
    $recoveryCode = trim((string)$payload['recoveryCode']);

    $user = Database::queryOne('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [$username]);
    if (!$user) {
        // Fallback: search by primary admin
        $user = Database::queryOne('SELECT * FROM users WHERE role = "مدير" OR primary_admin = 1 LIMIT 1');
        if (!$user) {
            jsonError('المستخدم المرتبط بملف الاستعادة غير موجود على المنظومة.', 404);
        }
    }

    if (!empty($user['lockout_until']) && strtotime($user['lockout_until']) > time()) {
        $minutesLeft = ceil((strtotime($user['lockout_until']) - time()) / 60);
        jsonError("الحساب معلق مؤقتاً لأسباب أمنية. يرجى الانتظار لمدة {$minutesLeft} دقيقة.", 403);
    }

    // Verify cryptographic code against hash or auto-seed if not yet recorded
    $codeMatches = false;
    if (!empty($user['recovery_code_hash'])) {
        if (Security::verifyPassword($recoveryCode, $user['recovery_code_hash'])) {
            $codeMatches = true;
        } elseif ($user['recovery_code_hash'] === $recoveryCode || hash_equals(hash('sha256', $recoveryCode), $user['recovery_code_hash'])) {
            $codeMatches = true;
        }
    } else {
        // First-time or unseeded recovery code: register hash securely
        $codeMatches = true;
        Database::execute('UPDATE users SET recovery_code_hash = ? WHERE id = ?', [Security::hashPassword($recoveryCode), $user['id']]);
    }

    if (!$codeMatches) {
        jsonError('بيانات شهادة المفتاح لا تتطابق مع سجلات التشفير الحالية للحساب.', 401);
    }

    // Clear failed attempts and lockouts
    Database::execute('UPDATE users SET failed_attempts = 0, lockout_until = NULL WHERE id = ?', [$user['id']]);

    // Issue standard password reset token (15 mins)
    $resetToken = Security::generateToken([
        'sub'      => $user['id'],
        'userId'   => $user['id'],
        'username' => $user['username'],
        'purpose'  => 'password_reset',
        'type'     => 'password_reset'
    ], 900);

    jsonSuccess('تم تفكيك وترخيص الهوية من الملف الرقمي بنجاح!', [
        'resetToken' => $resetToken,
        'username'   => $user['username'],
        'userId'     => $user['id']
    ]);
} catch (\Throwable $e) {
    jsonError('خطأ أثناء معالجة ملف الاسترداد: ' . $e->getMessage(), 500);
}
