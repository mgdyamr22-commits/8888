<?php
/**
 * GET /api/tenants
 * Public endpoint to fetch configured organization tenants from database or config
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

use Almakhzoun\Config\DatabaseConfig;
use Almakhzoun\Database\Database;

header('Content-Type: application/json; charset=UTF-8');

try {
    $pdo = Database::connect();
    $tenants = [];

    if ($pdo) {
        try {
            $stmt = $pdo->query("SELECT id, name, commercial_registry, tax_number, phone, email, address, logo_url, stamp_url, created_at FROM tenants ORDER BY created_at ASC");
            if ($stmt) {
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $tenants[] = [
                        'id'                 => $row['id'] ?? 'org-default',
                        'name'               => $row['name'] ?? '',
                        'commercialRegistry' => $row['commercial_registry'] ?? '',
                        'taxNumber'          => $row['tax_number'] ?? '',
                        'phone'              => $row['phone'] ?? '',
                        'email'              => $row['email'] ?? '',
                        'address'            => $row['address'] ?? '',
                        'logoUrl'            => $row['logo_url'] ?? '',
                        'stampUrl'           => $row['stamp_url'] ?? '',
                        'createdAt'          => $row['created_at'] ?? date('c')
                    ];
                }
                $stmt->closeCursor();
            }
        } catch (\Throwable $e) {}
    }

    if (empty($tenants)) {
        $orgConfig = DatabaseConfig::getOrgConfig();
        if (!empty($orgConfig['name'])) {
            $tenants[] = [
                'id'                 => 'org-default',
                'name'               => $orgConfig['name'],
                'commercialRegistry' => $orgConfig['commercialRegister'] ?? '',
                'taxNumber'          => $orgConfig['taxNumber'] ?? '',
                'phone'              => $orgConfig['phone'] ?? '',
                'email'              => '',
                'address'            => $orgConfig['address'] ?? '',
                'logoUrl'            => $orgConfig['logo'] ?? '',
                'stampUrl'           => $orgConfig['stamp'] ?? '',
                'createdAt'          => date('c')
            ];
        }
    }

    jsonSuccess('قائمة المنشآت', ['tenants' => $tenants]);
} catch (\Throwable $e) {
    jsonError('تعذر جلب بيانات المنشآت: ' . $e->getMessage(), 500);
}
