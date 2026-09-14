<?php
/**
 * /api/settings
 * GET: Retrieve organization settings
 * PUT: Update settings and identity
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

use Almakhzoun\Database\Database;

$currentUser = requireAuth();
$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        $settings = Database::queryOne('SELECT * FROM settings WHERE id = "settings_default"');
        if (!$settings) {
            $settings = [
                'org_name' => 'مؤسسة المخزون لتجارة السيارات',
                'currency' => 'SAR',
                'system_version' => '3.6.0'
            ];
        }

        $tenant = Database::queryOne('SELECT * FROM tenants WHERE id = "org-default"');

        jsonSuccess('Success', [
            'settings' => [
                'orgName'            => $settings['org_name'] ?? 'مؤسسة المخزون',
                'orgType'            => $settings['org_type'] ?? 'مؤسسة',
                'description'        => $settings['description'] ?? '',
                'contactNumber'      => $settings['contact_number'] ?? '',
                'taxNumber'          => $settings['tax_number'] ?? '',
                'commercialRegister' => $settings['commercial_register'] ?? '',
                'address'            => $settings['address'] ?? '',
                'currency'           => $settings['currency'] ?? 'SAR',
                'lowStockThreshold'  => (int)($settings['low_stock_threshold'] ?? 5),
                'systemVersion'      => $settings['system_version'] ?? '3.6.0',
                'logoUrl'            => $tenant['logo_url'] ?? '',
                'stampUrl'           => $tenant['stamp_url'] ?? ''
            ]
        ]);
    } else if ($method === 'PUT') {
        requireAdmin();
        $body = getJsonBody();
        $orgName = trim($body['orgName'] ?? $body['org_name'] ?? '');
        $contactNumber = trim($body['contactNumber'] ?? $body['contact_number'] ?? '');
        $taxNumber = trim($body['taxNumber'] ?? $body['tax_number'] ?? '');
        $commercialRegister = trim($body['commercialRegister'] ?? $body['commercial_register'] ?? '');
        $address = trim($body['address'] ?? '');
        $currency = trim($body['currency'] ?? 'SAR');
        $logoUrl = $body['logoUrl'] ?? null;
        $stampUrl = $body['stampUrl'] ?? null;

        Database::execute('
            INSERT INTO settings (
                id, tenant_id, org_name, contact_number, tax_number, commercial_register,
                address, currency, system_version, updated_at
            ) VALUES (
                "settings_default", "org-default", ?, ?, ?, ?,
                ?, ?, "3.6.0", NOW()
            ) ON DUPLICATE KEY UPDATE
                org_name = VALUES(org_name),
                contact_number = VALUES(contact_number),
                tax_number = VALUES(tax_number),
                commercial_register = VALUES(commercial_register),
                address = VALUES(address),
                currency = VALUES(currency)
        ', [$orgName, $contactNumber, $taxNumber, $commercialRegister, $address, $currency]);

        if ($logoUrl !== null || $stampUrl !== null) {
            Database::execute('
                UPDATE tenants SET 
                    logo_url = COALESCE(?, logo_url),
                    stamp_url = COALESCE(?, stamp_url)
                WHERE id = "org-default"
            ', [$logoUrl, $stampUrl]);
        }

        logAudit('UPDATE_SETTINGS', 'settings_default', 'settings', 'تحديث إعدادات وبيانات المؤسسة');
        jsonSuccess('تم حفظ إعدادات المؤسسة بنجاح.');
    } else {
        jsonError('Method Not Allowed', 405);
    }
} catch (\Throwable $e) {
    jsonError('حدث خطأ أثناء معالجة الإعدادات: ' . $e->getMessage(), 500);
}
