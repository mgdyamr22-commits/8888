<?php
/**
 * /api/auth/company/:id
 * Manages company profile and SMTP settings.
 *
 * SINGLE SOURCE OF TRUTH: the `tenants` table (columns: name, commercial_registry,
 * tax_number, phone, address, logo_url, stamp_url). Logo/stamp are stored as file
 * URLs returned by /api/files/upload (never as inline base64 blobs), and SMTP
 * settings are stored in system_settings under 'smtp_config'. This avoids the
 * previous split-brain bug where GET and POST used two different, inconsistent
 * storage locations for the same data.
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';
use Almakhzoun\Database\Database;
use Almakhzoun\Config\DatabaseConfig;

$method = $_SERVER['REQUEST_METHOD'];
$companyId = $_GET['id'] ?? 'c1';

try {
    if ($method === 'GET') {
        $tenant = Database::queryOne(
            'SELECT id, name, commercial_registry, tax_number, phone, email, address, logo_url, stamp_url FROM tenants ORDER BY created_at ASC LIMIT 1'
        );

        $smtpRow = Database::queryOne("SELECT setting_value FROM system_settings WHERE setting_key = 'smtp_config'");
        $smtp = $smtpRow && !empty($smtpRow['setting_value']) ? json_decode($smtpRow['setting_value'], true) : [];

        if ($tenant) {
            $company = [
                'id'                 => $companyId,
                'companyName'        => $tenant['name'] ?? '',
                'commercialRegister' => $tenant['commercial_registry'] ?? '',
                'taxNumber'          => $tenant['tax_number'] ?? '',
                'phone'              => $tenant['phone'] ?? '',
                'senderEmail'        => $smtp['senderEmail'] ?? ($tenant['email'] ?? 'admin@almakhzoun.com'),
                'address'            => $tenant['address'] ?? '',
                'logo'               => $tenant['logo_url'] ?? '',
                'stampUrl'           => $tenant['stamp_url'] ?? '',
                'smtpHost'           => $smtp['smtpHost'] ?? 'smtp.gmail.com',
                'smtpPort'           => $smtp['smtpPort'] ?? 587,
                'smtpSecure'         => $smtp['smtpSecure'] ?? true,
                'smtpUser'           => $smtp['smtpUser'] ?? '',
                'smtpPassPlaceholder'=> !empty($smtp['smtpPass']) ? '••••••••' : ''
            ];
        } else {
            $orgCfg = DatabaseConfig::getOrgConfig();
            $company = [
                'id'                 => $companyId,
                'companyName'        => $orgCfg['name'] ?? 'مؤسسة المخزون لتجارة السيارات',
                'commercialRegister' => $orgCfg['commercialRegister'] ?? '',
                'taxNumber'          => $orgCfg['taxNumber'] ?? '',
                'phone'              => $orgCfg['phone'] ?? '',
                'senderEmail'        => 'admin@almakhzoun.com',
                'address'            => $orgCfg['address'] ?? '',
                'logo'               => $orgCfg['logo'] ?? '',
                'stampUrl'           => $orgCfg['stamp'] ?? '',
                'smtpHost'           => 'smtp.gmail.com',
                'smtpPort'           => 587,
                'smtpSecure'         => true
            ];
        }

        jsonSuccess('بيانات المؤسسة', ['company' => $company]);
    } else if ($method === 'POST') {
        requireAuth();
        $body = getJsonBody();

        // 1. Persist organization identity + logo/stamp URLs to the single source of truth: tenants
        $companyName = trim($body['companyName'] ?? '');
        $logoUrl = array_key_exists('logo', $body) ? trim((string)($body['logo'] ?? '')) : null;
        $stampUrl = array_key_exists('stampUrl', $body) ? trim((string)($body['stampUrl'] ?? '')) : null;

        // Reject any accidental inline base64 payloads - logo/stamp must always be a
        // server file URL produced by /api/files/upload, never embedded image data.
        if ($logoUrl !== null && str_starts_with($logoUrl, 'data:')) {
            jsonError('يجب رفع الشعار كملف عبر /api/files/upload بدل إرساله كبيانات base64 مباشرة.', 400);
        }
        if ($stampUrl !== null && str_starts_with($stampUrl, 'data:')) {
            jsonError('يجب رفع الختم كملف عبر /api/files/upload بدل إرساله كبيانات base64 مباشرة.', 400);
        }

        $existingTenant = Database::queryOne('SELECT id FROM tenants ORDER BY created_at ASC LIMIT 1');
        if ($existingTenant) {
            Database::execute(
                'UPDATE tenants SET
                    name = COALESCE(NULLIF(?, \'\'), name),
                    commercial_registry = COALESCE(NULLIF(?, \'\'), commercial_registry),
                    tax_number = COALESCE(NULLIF(?, \'\'), tax_number),
                    phone = COALESCE(NULLIF(?, \'\'), phone),
                    address = COALESCE(NULLIF(?, \'\'), address),
                    logo_url = CASE WHEN ? IS NULL THEN logo_url ELSE ? END,
                    stamp_url = CASE WHEN ? IS NULL THEN stamp_url ELSE ? END
                 WHERE id = ?',
                [
                    $companyName,
                    trim($body['commercialRegister'] ?? ''),
                    trim($body['taxNumber'] ?? ''),
                    trim($body['phone'] ?? ''),
                    trim($body['address'] ?? ''),
                    $logoUrl, $logoUrl,
                    $stampUrl, $stampUrl,
                    $existingTenant['id']
                ]
            );
        } else {
            Database::execute(
                'INSERT INTO tenants (id, name, commercial_registry, tax_number, phone, address, logo_url, stamp_url, created_at)
                 VALUES ("org-default", ?, ?, ?, ?, ?, ?, ?, NOW())',
                [
                    $companyName ?: 'مؤسسة المخزون لتجارة السيارات',
                    trim($body['commercialRegister'] ?? ''),
                    trim($body['taxNumber'] ?? ''),
                    trim($body['phone'] ?? ''),
                    trim($body['address'] ?? ''),
                    $logoUrl ?? '',
                    $stampUrl ?? ''
                ]
            );
        }

        // 2. Persist SMTP settings separately (these are not part of the tenants table)
        $smtpPayload = [
            'smtpHost'    => $body['smtpHost'] ?? 'smtp.gmail.com',
            'smtpPort'    => $body['smtpPort'] ?? 587,
            'smtpSecure'  => $body['smtpSecure'] ?? true,
            'smtpUser'    => $body['smtpUser'] ?? '',
            'senderEmail' => $body['senderEmail'] ?? ''
        ];
        // Only overwrite the stored SMTP password if a real new one was sent
        // (the frontend sends back a masked placeholder otherwise).
        if (!empty($body['smtpPass']) && $body['smtpPass'] !== '••••••••') {
            $smtpPayload['smtpPass'] = $body['smtpPass'];
        } else {
            $existingSmtp = Database::queryOne("SELECT setting_value FROM system_settings WHERE setting_key = 'smtp_config'");
            $existingDecoded = $existingSmtp && !empty($existingSmtp['setting_value']) ? json_decode($existingSmtp['setting_value'], true) : [];
            $smtpPayload['smtpPass'] = $existingDecoded['smtpPass'] ?? '';
        }

        Database::execute(
            "INSERT INTO system_settings (setting_key, setting_value, updated_at)
             VALUES ('smtp_config', ?, NOW())
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()",
            [json_encode($smtpPayload, JSON_UNESCAPED_UNICODE)]
        );

        logAudit('UPDATE_COMPANY_SETTINGS', $companyId, 'tenants', 'تحديث بيانات المؤسسة والشعار والختم وإعدادات SMTP');

        jsonSuccess('تم تحديث بيانات المؤسسة بنجاح.', [
            'company' => array_merge($body, ['logo' => $logoUrl, 'stampUrl' => $stampUrl])
        ]);
    } else {
        jsonError('طريقة الطلب غير مدعومة.', 405);
    }
} catch (\Throwable $e) {
    jsonError('تعذر معالجة بيانات المؤسسة: ' . $e->getMessage(), 500);
}
