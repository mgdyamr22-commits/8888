<?php
/**
 * POST /api/auth/verify-questions
 * Verifies security answers and yields reset signature token
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

use Almakhzoun\Database\Database;
use Almakhzoun\Config\Security;

$body = getJsonBody();
$username = trim($body['username'] ?? '');
$answers = $body['answers'] ?? [];
$deviceId = trim($body['deviceId'] ?? '');

if (empty($username) || !is_array($answers) || count($answers) !== 3) {
    jsonError('الرجاء إدخال اسم المستخدم وجميع الإجابات الثلاثة.', 400);
}

try {
    $user = Database::queryOne('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [$username]);
    if (!$user) {
        jsonError('اسم المستخدم غير مسجل.', 404);
    }

    if (!empty($user['lockout_until']) && strtotime($user['lockout_until']) > time()) {
        $minutesLeft = ceil((strtotime($user['lockout_until']) - time()) / 60);
        jsonError("الحساب معلق مؤقتاً لأسباب أمنية. يرجى الانتظار لمدة {$minutesLeft} دقيقة.", 403);
    }

    $storedQuestions = Database::query('SELECT question, answer_hash FROM user_security_questions WHERE user_id = ? ORDER BY id ASC', [$user['id']]);
    if (count($storedQuestions) < 3) {
        jsonError('لم يتم إعداد أسئلة الأمان لهذا الحساب.', 400);
    }

    // Verify answers sequentially
    $allMatched = true;
    for ($i = 0; $i < 3; $i++) {
        $providedAns = trim(strtolower((string)($answers[$i] ?? '')));
        $expectedHash = $storedQuestions[$i]['answer_hash'];
        if (!Security::verifyPassword($providedAns, $expectedHash)) {
            $allMatched = false;
            break;
        }
    }

    if (!$allMatched) {
        $failedAttempts = (int)($user['failed_attempts'] ?? 0) + 1;
        $lockoutUntil = null;
        if ($failedAttempts >= 5) {
            $lockoutUntil = date('Y-m-d H:i:s', time() + 900); // 15 min lockout
        }
        Database::execute('UPDATE users SET failed_attempts = ?, lockout_until = ? WHERE id = ?', [$failedAttempts, $lockoutUntil, $user['id']]);

        if ($failedAttempts >= 5) {
            jsonError('تم تجاوز عدد المحاولات المسموح بها. تم تعليق الحساب مؤقتاً لمدة 15 دقيقة.', 403);
        }
        $remaining = 5 - $failedAttempts;
        jsonError("إجابات أسئلة الأمان غير صحيحة. متبقي لديك {$remaining} محاولات قبل الإغلاق الأمني.", 401);
    }

    // Reset failed attempts on success
    Database::execute('UPDATE users SET failed_attempts = 0, lockout_until = NULL WHERE id = ?', [$user['id']]);

    // Issue short-lived password reset token (15 mins)
    $resetToken = Security::generateToken([
        'sub' => $user['id'],
        'username' => $user['username'],
        'purpose' => 'password_reset',
        'type' => 'password_reset'
    ], 900);

    jsonSuccess([
        'message'    => 'تم التحقق من إجابات أسئلة الأمان بنجاح!',
        'resetToken' => $resetToken,
        'username'   => $user['username'],
        'userId'     => $user['id']
    ]);
} catch (\Throwable $e) {
    jsonError('خطأ أثناء فحص إجابات الأمان: ' . $e->getMessage(), 500);
}
