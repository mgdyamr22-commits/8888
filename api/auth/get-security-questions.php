<?php
/**
 * POST /api/auth/get-security-questions
 * Returns security questions for username (hiding the answer hashes)
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

use Almakhzoun\Database\Database;

$body = getJsonBody();
$username = trim($body['username'] ?? '');

if (empty($username)) {
    jsonError('مطلوب اسم المستخدم.', 400);
}

try {
    $user = Database::queryOne('SELECT id, username, lockout_until FROM users WHERE LOWER(username) = LOWER(?)', [$username]);
    if (!$user) {
        jsonError('اسم المستخدم المدخل غير مسجل بكشوف الحماية.', 404);
    }

    if (!empty($user['lockout_until']) && strtotime($user['lockout_until']) > time()) {
        $minutesLeft = ceil((strtotime($user['lockout_until']) - time()) / 60);
        jsonError("الحساب معلق مؤقتاً لأسباب أمنية. يرجى الانتظار لمدة {$minutesLeft} دقيقة.", 403);
    }

    $questions = Database::query('SELECT question FROM user_security_questions WHERE user_id = ? ORDER BY id ASC', [$user['id']]);
    if (empty($questions) || count($questions) < 3) {
        jsonError('بروتوكول الأمان: هذا الحساب لم يتم تسجيل أسئلة الأمان له بعد. يرجى الاستعادة برموز أخرى.', 400);
    }

    $questionList = array_map(fn($q) => $q['question'], $questions);

    jsonSuccess([
        'questions' => $questionList
    ]);
} catch (\Throwable $e) {
    jsonError('خطأ أثناء جلب أسئلة الأمان: ' . $e->getMessage(), 500);
}
