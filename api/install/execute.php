<?php
/**
 * POST /api/install/execute
 * Complete All-In-One automated installation pipeline
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

use Almakhzoun\Database\Database;
use Almakhzoun\Database\MigrationRunner;
use Almakhzoun\Config\DatabaseConfig;
use Almakhzoun\Config\Security;
use Almakhzoun\Config\Paths;

// Check installation lock protection
if (DatabaseConfig::isInstalled()) {
    jsonError('النظام مثبت مسبقاً ومحمي ضد إعادة التثبيت. لحماية بيانات المؤسسة وحسابات المستخدمين تم قفل معالج التثبيت. لإعادة التثبيت من جديد، يجب حذف ملف config/installed.json أو .installed يدوياً من مجلد الاستضافة.', 403);
}

$body = getJsonBody();

$dbHost = $body['dbConfig']['host'] ?? $body['dbHost'] ?? $body['host'] ?? 'localhost';
$dbPort = (int)($body['dbConfig']['port'] ?? $body['dbPort'] ?? $body['port'] ?? 3306);
$dbName = $body['dbConfig']['database'] ?? $body['dbConfig']['dbName'] ?? $body['dbName'] ?? $body['database'] ?? 'almakhzoun_cloud';
$dbUser = $body['dbConfig']['user'] ?? $body['dbConfig']['username'] ?? $body['dbUser'] ?? $body['username'] ?? 'root';
$dbPassword = $body['dbConfig']['password'] ?? $body['dbPassword'] ?? $body['password'] ?? '';

$adminUsername = trim($body['adminConfig']['username'] ?? $body['adminUsername'] ?? 'admin');
$adminPassword = $body['adminConfig']['password'] ?? $body['adminPassword'] ?? 'admin123';
$adminFullName = trim($body['adminConfig']['fullName'] ?? $body['adminFullName'] ?? 'المدير العام');
$adminEmail = trim($body['adminConfig']['email'] ?? $body['adminEmail'] ?? 'admin@almakhzoun.com');
$adminPhone = trim($body['adminConfig']['phone'] ?? $body['adminPhone'] ?? '');
$recoveryCode = trim($body['adminConfig']['recoveryCode'] ?? $body['recoveryCode'] ?? 'AFS-2026-PRO8-X99Z');
$securityQuestions = $body['adminConfig']['securityQuestions'] ?? $body['securityQuestions'] ?? [];

$orgName = trim($body['orgConfig']['name'] ?? $body['orgName'] ?? 'مؤسسة المخزون لتجارة السيارات');
$orgPhone = trim($body['orgConfig']['phone'] ?? $body['orgPhone'] ?? '');
$orgTaxNumber = trim($body['orgConfig']['taxNumber'] ?? $body['orgTaxNumber'] ?? '');
$orgCR = trim($body['orgConfig']['commercialRegister'] ?? $body['commercialRegister'] ?? $body['orgCR'] ?? '');
$orgAddress = trim($body['orgConfig']['address'] ?? $body['address'] ?? 'المملكة العربية السعودية');
$orgLogo = $body['orgConfig']['logo'] ?? $body['logo'] ?? null;
$orgStamp = $body['orgConfig']['stamp'] ?? $body['stamp'] ?? null;

$dbConfig = [
    'host'     => $dbHost,
    'port'     => $dbPort,
    'database' => $dbName,
    'username' => $dbUser,
    'password' => $dbPassword,
    'charset'  => 'utf8mb4'
];

try {
    // 1. Test and connect with supplied config
    $pdo = Database::connect($dbConfig);
    if (!$pdo) {
        // Try creating database first if unknown database error
        $rootDsn = "mysql:host={$dbHost};port={$dbPort};charset=utf8mb4";
        try {
            $rootPdo = new PDO($rootDsn, $dbUser, $dbPassword, [
                PDO::ATTR_ERRMODE                  => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_TIMEOUT                  => 5,
                PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true
            ]);
            try {
                $rootPdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, true);
            } catch (\Throwable $t) {}
            $rootPdo->exec("CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            $pdo = Database::connect($dbConfig);
        } catch (\Throwable $e) {
            $errMsg = Database::getLastError() ?: $e->getMessage();
            jsonError('فشل الاتصال بقاعدة بيانات MySQL (' . $dbName . ') للمستخدم (' . $dbUser . '): ' . $errMsg . ' — يرجى التأكد من إنشاء قاعدة البيانات والمستخدم وكلمة المرور في لوحة تحكم الاستضافة (cPanel) وتعيين كافة الصلاحيات (ALL PRIVILEGES) للمستخدم على القاعدة.', 400);
        }
    }

    if (!$pdo) {
        $errMsg = Database::getLastError() ?: 'يرجى مراجعة صحة بيانات الاتصال بخادم MySQL';
        jsonError('تعذر الاتصال بقاعدة البيانات: ' . $errMsg, 400);
    }

    // Ensure buffered queries on active connection
    try {
        $pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, true);
    } catch (\Throwable $t) {}

    // Explicitly set active connection in Database manager
    Database::setConnection($pdo);

    // Save database credentials immediately so all subsequent operations use them
    DatabaseConfig::saveInstalledConfig(
        $dbConfig,
        ['username' => $adminUsername, 'email' => $adminEmail],
        [
            'name'               => $orgName,
            'phone'              => $orgPhone,
            'taxNumber'          => $orgTaxNumber,
            'commercialRegister' => $orgCR,
            'address'            => $orgAddress,
            'logo'               => $orgLogo,
            'stamp'              => $orgStamp
        ]
    );

    // 2. Run all migrations
    $migrationResult = MigrationRunner::runAll($pdo);

    // 3. Create Admin user
    $passwordHash = Security::hashPassword($adminPassword);
    $userId = 'usr_' . bin2hex(random_bytes(8));
    $tenantId = 'org-default';

    $stmtCheck = $pdo->prepare('SELECT id FROM users WHERE username = ?');
    $stmtCheck->execute([$adminUsername]);
    $userRows = $stmtCheck->fetchAll(PDO::FETCH_ASSOC);
    $stmtCheck->closeCursor();
    $existing = $userRows[0] ?? null;

    $recoveryCode = trim($adminConfig['recoveryCode'] ?? $body['recoveryCode'] ?? 'AFS-2026-PRO8-X99Z');
    $recoveryHash = Security::hashPassword($recoveryCode);

    if ($existing) {
        $stmtUpd = $pdo->prepare('UPDATE users SET password_hash = ?, full_name = ?, email = ?, role = "مدير", primary_admin = 1, is_active = 1, recovery_code_hash = ? WHERE id = ?');
        $stmtUpd->execute([$passwordHash, $adminFullName, $adminEmail, $recoveryHash, $existing['id']]);
        $stmtUpd->closeCursor();
        $userId = $existing['id'];
    } else {
        $stmtIns = $pdo->prepare('INSERT INTO users (id, tenant_id, username, password_hash, role, full_name, email, recovery_code_hash, primary_admin, is_active, created_at) VALUES (?, ?, ?, ?, "مدير", ?, ?, ?, 1, 1, NOW())');
        $stmtIns->execute([$userId, $tenantId, $adminUsername, $passwordHash, $adminFullName, $adminEmail, $recoveryHash]);
        $stmtIns->closeCursor();
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
    $stmtPerm = $pdo->prepare('INSERT IGNORE INTO user_permissions (user_id, permission_key) VALUES (?, ?)');
    foreach ($allPerms as $perm) {
        $stmtPerm->execute([$userId, $perm]);
        $stmtPerm->closeCursor();
    }

    // 4. Create Organization Tenant & Settings
    $stmtTenant = $pdo->prepare(
        'INSERT INTO tenants (id, name, commercial_registry, tax_number, phone, email, address, logo_url, stamp_url, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE 
            name = VALUES(name), 
            commercial_registry = VALUES(commercial_registry),
            tax_number = VALUES(tax_number),
            phone = VALUES(phone),
            email = VALUES(email),
            address = VALUES(address),
            logo_url = VALUES(logo_url),
            stamp_url = VALUES(stamp_url)'
    );
    $stmtTenant->execute([$tenantId, $orgName, $orgCR, $orgTaxNumber, $orgPhone, $adminEmail, $orgAddress, $orgLogo, $orgStamp]);
    $stmtTenant->closeCursor();

    $stmtSettings = $pdo->prepare(
        'INSERT INTO settings (id, tenant_id, org_name, contact_number, tax_number, commercial_register, address, currency, system_version, updated_at)
         VALUES ("settings_default", ?, ?, ?, ?, ?, ?, "SAR", "3.6.0", NOW())
         ON DUPLICATE KEY UPDATE 
            org_name = VALUES(org_name), 
            contact_number = VALUES(contact_number),
            tax_number = VALUES(tax_number),
            commercial_register = VALUES(commercial_register),
            address = VALUES(address)'
    );
    $stmtSettings->execute([$tenantId, $orgName, $orgPhone, $orgTaxNumber, $orgCR, $orgAddress]);
    $stmtSettings->closeCursor();

    // Mirror company profile into system_settings
    try {
        $companyProfile = [
            'id'                 => 'c1',
            'companyName'        => $orgName,
            'commercialRegister' => $orgCR,
            'taxNumber'          => $orgTaxNumber,
            'phone'              => $orgPhone,
            'address'            => $orgAddress,
            'logo'               => $orgLogo ?: '',
            'stampUrl'           => $orgStamp ?: ''
        ];
        $stmtSys = $pdo->prepare("
            INSERT INTO system_settings (setting_key, setting_value, updated_at)
            VALUES ('company_profile', ?, NOW())
            ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()
        ");
        $stmtSys->execute([json_encode($companyProfile, JSON_UNESCAPED_UNICODE)]);
        $stmtSys->closeCursor();
    } catch (\Throwable $t) {}

    $stmtBranch = $pdo->prepare(
        'INSERT INTO branches (id, tenant_id, name, code, is_active, created_at)
         VALUES ("branch-main", ?, "الفرع الرئيسي", "MAIN-01", 1, NOW())
         ON DUPLICATE KEY UPDATE name = VALUES(name)'
    );
    $stmtBranch->execute([$tenantId]);
    $stmtBranch->closeCursor();

    // 5. Ensure Storage Directories
    Paths::ensureDirectories();

    jsonSuccess('تم إكمال التثبيت الآلي للنظام بالكامل بنجاح.', [
        'installed'   => true,
        'migrations'  => $migrationResult,
        'admin'       => ['username' => $adminUsername, 'userId' => $userId],
        'redirect'    => '/login'
    ]);
} catch (\Throwable $e) {
    jsonError('حدث خطأ أثناء تنفيذ معالج التثبيت: ' . $e->getMessage(), 500);
}
