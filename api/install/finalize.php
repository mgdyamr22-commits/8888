<?php
/**
 * POST /api/install/finalize
 * Saves organization settings, writes lock file and config/installed.json
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

use Almakhzoun\Config\DatabaseConfig;
use Almakhzoun\Config\Paths;
use Almakhzoun\Database\Database;

// Protect against finalize if already installed
if (DatabaseConfig::isInstalled()) {
    jsonError('النظام مثبت مسبقاً ومحمي ضد إعادة التثبيت.', 403);
}

$body = getJsonBody();
$dbConfig = $body['dbConfig'] ?? $body['db'] ?? $body['database'] ?? [];
$adminInfo = $body['adminConfig'] ?? $body['admin'] ?? [];
$orgInfo = $body['orgConfig'] ?? $body['org'] ?? $body['organization'] ?? [];

$orgName = $orgInfo['name'] ?? $orgInfo['orgName'] ?? 'مؤسسة المخزون لتجارة السيارات';
$orgPhone = $orgInfo['phone'] ?? $orgInfo['contactNumber'] ?? '';
$orgTaxNumber = $orgInfo['taxNumber'] ?? '';
$orgCR = $orgInfo['commercialRegister'] ?? '';
$orgAddress = $orgInfo['address'] ?? '';

try {
    $pdo = !empty($dbConfig) ? Database::connect($dbConfig) : Database::connect();
    if ($pdo) {
        $tenantId = 'org-default';
        // Insert or update tenant
        Database::execute(
            'INSERT INTO tenants (id, name, commercial_registry, tax_number, phone, address, created_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE name = VALUES(name), phone = VALUES(phone), address = VALUES(address)',
            [$tenantId, $orgName, $orgCR, $orgTaxNumber, $orgPhone, $orgAddress]
        );

        // Insert or update settings
        Database::execute(
            'INSERT INTO settings (id, tenant_id, org_name, contact_number, tax_number, commercial_register, address, currency, system_version, updated_at)
             VALUES ("settings_default", ?, ?, ?, ?, ?, ?, "SAR", "3.6.0", NOW())
             ON DUPLICATE KEY UPDATE org_name = VALUES(org_name), contact_number = VALUES(contact_number), tax_number = VALUES(tax_number), commercial_register = VALUES(commercial_register), address = VALUES(address)',
            [$tenantId, $orgName, $orgPhone, $orgTaxNumber, $orgCR, $orgAddress]
        );

        // Insert default main branch
        Database::execute(
            'INSERT INTO branches (id, tenant_id, name, code, is_active, created_at)
             VALUES ("branch-main", ?, "الفرع الرئيسي", "MAIN-01", 1, NOW())
             ON DUPLICATE KEY UPDATE name = VALUES(name)',
            [$tenantId]
        );
    }

    // Save installed state
    if (!empty($dbConfig)) {
        DatabaseConfig::saveInstalledConfig($dbConfig, $adminInfo, $orgInfo);
    } else {
        @file_put_contents(Paths::root() . '/.installed', date('c'));
    }

    jsonSuccess('تم إكمال التثبيت وإعداد المؤسسة بنجاح.', [
        'installed' => true,
        'redirect'  => '/login'
    ]);
} catch (\Throwable $e) {
    jsonError('فشل إنهاء التثبيت: ' . $e->getMessage(), 500);
}
