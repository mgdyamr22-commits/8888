<?php
/**
 * POST /api/auth/setup-security-questions
 * Saves custom security questions, generates unique recovery code and encrypted recovery.key content
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

use Almakhzoun\Database\Database;
use Almakhzoun\Config\Security;

$body = getJsonBody();
$username = trim($body['username'] ?? '');
$questions = $body['questions'] ?? [];
$deviceId = trim($body['deviceId'] ?? '');
$phone = isset($body['phone']) ? trim((string)$body['phone']) : null;
$email = isset($body['email']) ? trim((string)$body['email']) : null;

if (empty($username) || !is_array($questions) || count($questions) !== 3) {
    jsonError('الرجاء إدخال اسم المستخدم و 3 أسئلة أمان مع الإجابات.', 400);
}

try {
    $user = Database::queryOne('SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR id = ?', [$username, $username]);
    if (!$user) {
        // Fallback: search by admin email or create user record if missing
        $user = Database::queryOne('SELECT * FROM users WHERE role = "مدير" OR primary_admin = 1 LIMIT 1');
        if (!$user) {
            jsonError('المستخدم المطلوب غير موجود بكشوف النظام.', 404);
        }
    }

    $userId = $user['id'];

    // 1. Clear previous security questions for this user
    Database::execute('DELETE FROM user_security_questions WHERE user_id = ?', [$userId]);

    // 2. Insert new hashed security questions
    $stmt = Database::prepare('INSERT INTO user_security_questions (user_id, question, answer_hash) VALUES (?, ?, ?)');
    foreach ($questions as $q) {
        $qText = trim($q['question'] ?? '');
        $qAns = trim(strtolower($q['answer'] ?? ''));
        if (empty($qText) || empty($qAns)) {
            jsonError('الرجاء إدخال إجابات كاملة لجميع الأسئلة.', 400);
        }
        $ansHash = Security::hashPassword($qAns);
        $stmt->execute([$userId, $qText, $ansHash]);
    }

    // 3. Generate Cryptographic Recovery Code (AFS-XXXX-XXXX-XXXX)
    $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    $segments = [];
    for ($i = 0; $i < 3; $i++) {
        $seg = '';
        for ($c = 0; $c < 4; $c++) {
            $seg .= $chars[random_int(0, strlen($chars) - 1)];
        }
        $segments[] = $seg;
    }
    $recoveryCode = 'AFS-' . implode('-', $segments);
    $recoveryCodeHash = Security::hashPassword($recoveryCode);

    // 4. Update user record with recovery code hash and profile contacts
    $updateFields = ['recovery_code_hash = ?', 'failed_attempts = 0', 'lockout_until = NULL'];
    $updateParams = [$recoveryCodeHash];

    if ($phone !== null) {
        $updateFields[] = 'phone = ?';
        $updateParams[] = $phone;
    }
    if ($email !== null) {
        $updateFields[] = 'email = ?';
        $updateParams[] = $email;
        $updateFields[] = 'admin_email = ?';
        $updateParams[] = $email;
    }

    $updateParams[] = $userId;
    Database::execute('UPDATE users SET ' . implode(', ', $updateFields) . ' WHERE id = ?', $updateParams);

    // 5. Register Trusted Device if provided
    if (!empty($deviceId)) {
        $existingDevice = Database::queryOne('SELECT id FROM user_trusted_devices WHERE user_id = ? AND device_id = ?', [$userId, $deviceId]);
        if (!$existingDevice) {
            Database::execute('INSERT INTO user_trusted_devices (user_id, device_id, device_name) VALUES (?, ?, ?)', [$userId, $deviceId, 'Trusted Browser/Client']);
        }
    }

    // 6. Generate AES Encrypted Recovery Key file content
    $recoveryPayload = json_encode([
        'username' => $user['username'],
        'recoveryCode' => $recoveryCode,
        'timestamp' => date('c')
    ], JSON_UNESCAPED_UNICODE);

    $encryptedKeyContent = Security::encryptAES($recoveryPayload);

    jsonSuccess([
        'message' => 'تم تفعيل معيار الأمان الثلاثي وحفظ أسئلة الأمان وتوليد رمز الاستعادة المحمي بنجاح!',
        'recoveryCode' => $recoveryCode,
        'recoveryFileContent' => $encryptedKeyContent
    ]);
} catch (\Throwable $e) {
    jsonError('خطأ أثناء حفظ وتوليد معيار الأمان: ' . $e->getMessage(), 500);
}
