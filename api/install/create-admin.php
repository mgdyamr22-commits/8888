<?php
/**
 * POST /api/install/create-admin
 * Creates or resets the initial Super Admin account
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

use Almakhzoun\Database\Database;
use Almakhzoun\Config\Security;
use Almakhzoun\Config\DatabaseConfig;

// Protect against unauthorized admin reset if already installed
if (DatabaseConfig::isInstalled()) {
    jsonError('النظام مثبت مسبقاً ومحمي ضد إعادة التثبيت. لا يمكن إنشاء حساب مدير عبر معالج التثبيت.', 403);
}

$body = getJsonBody();
$username = trim($body['adminConfig']['username'] ?? $body['username'] ?? $body['adminUsername'] ?? '');
$password = $body['adminConfig']['password'] ?? $body['password'] ?? $body['adminPassword'] ?? '';
$fullName = trim($body['adminConfig']['fullName'] ?? $body['fullName'] ?? $body['adminFullName'] ?? 'المدير العام');
$email = trim($body['adminConfig']['email'] ?? $body['email'] ?? $body['adminEmail'] ?? 'admin@almakhzoun.com');
$phone = trim($body['adminConfig']['phone'] ?? $body['phone'] ?? '');

if (empty($username) || empty($password)) {
    jsonError('اسم المستخدم وكلمة المرور مطلوبان لإنشاء حساب المدير.', 400);
}

if (strlen($password) < 6) {
    jsonError('كلمة المرور يجب ألا تقل عن 6 أحرف.', 400);
}

$dbConfig = $body['dbConfig'] ?? null;

try {
    $pdo = Database::connect($dbConfig);
    if (!$pdo) {
        jsonError('قاعدة البيانات غير متصلة: ' . (Database::getLastError() ?: 'يرجى مراجعة إعدادات خادم MySQL'), 500);
    }

    $passwordHash = Security::hashPassword($password);
    $userId = 'usr_' . bin2hex(random_bytes(8));
    $tenantId = 'org-default';

    $recoveryCode = trim($body['adminConfig']['recoveryCode'] ?? $body['recoveryCode'] ?? 'AFS-2026-PRO8-X99Z');
    $recoveryHash = Security::hashPassword($recoveryCode);

    // Check if username exists
    $existing = Database::queryOne('SELECT id FROM users WHERE username = ?', [$username]);
    if ($existing) {
        // Update existing admin
        Database::execute(
            'UPDATE users SET password_hash = ?, full_name = ?, email = ?, recovery_code_hash = ?, role = "مدير", primary_admin = 1, is_active = 1, failed_attempts = 0, lockout_until = NULL WHERE id = ?',
            [$passwordHash, $fullName, $email, $recoveryHash, $existing['id']]
        );
        $userId = $existing['id'];
    } else {
        // Insert new admin
        Database::execute(
            'INSERT INTO users (id, tenant_id, username, password_hash, role, full_name, email, phone, recovery_code_hash, primary_admin, is_active, created_at) VALUES (?, ?, ?, ?, "مدير", ?, ?, ?, ?, 1, 1, NOW())',
            [$userId, $tenantId, $username, $passwordHash, $fullName, $email, $phone, $recoveryHash]
        );
    }

    // Assign all standard permissions
    $allPerms = [
        'car.view', 'car.create', 'car.edit', 'car.delete',
        'reservation.create', 'reservation.cancel',
        'sale.create', 'sale.edit', 'sale.delete',
        'transfer.create', 'transfer.receive', 'transfer.delete',
        'cost.view', 'cost.create', 'cost.edit', 'cost.delete',
        'letter.create', 'letter.print', 'letter.delete',
        'reports.view', 'reports.export',
        'users.manage', 'settings.manage', 'backup.manage'
    ];

    foreach ($allPerms as $perm) {
        Database::execute(
            'INSERT IGNORE INTO user_permissions (user_id, permission_key) VALUES (?, ?)',
            [$userId, $perm]
        );
    }

    jsonSuccess('تم إنشاء وتفعيل حساب المدير العام بنجاح.', [
        'userId'   => $userId,
        'username' => $username,
        'role'     => 'مدير'
    ]);
} catch (\Throwable $e) {
    jsonError('فشل إنشاء حساب المدير: ' . $e->getMessage(), 500);
}
