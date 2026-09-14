<?php
/**
 * GET /api/install/status
 * Returns current installation state, database connection, tables count, and admin status
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

use Almakhzoun\Config\DatabaseConfig;
use Almakhzoun\Database\Database;

try {
    // If lock files do not exist, the system is NOT installed (allows installer wizard to open)
    $hasLockFile = DatabaseConfig::isInstalled();
    $isInstalled = false;
    $dbConnected = false;
    $hasDb = false;
    $hasAdmin = false;
    $tablesCount = 0;
    $reason = 'DATABASE_NOT_CONFIGURED';

    $pdo = Database::connect();
    if ($pdo) {
        $dbConnected = true;
        $hasDb = true;

        try {
            try {
                $pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, true);
            } catch (\Throwable $t) {}

            $stmt = $pdo->query("SHOW TABLES");
            $tables = $stmt ? $stmt->fetchAll(PDO::FETCH_COLUMN) : [];
            if ($stmt) {
                $stmt->closeCursor();
            }
            $tablesCount = count($tables);

            if (in_array('users', $tables)) {
                $userCheck = $pdo->query("SELECT COUNT(*) as cnt FROM users WHERE role = 'مدير'");
                $userRows = $userCheck ? $userCheck->fetchAll(PDO::FETCH_ASSOC) : [];
                if ($userCheck) {
                    $userCheck->closeCursor();
                }
                $adminCount = (int)($userRows[0]['cnt'] ?? 0);
                if ($adminCount > 0) {
                    $hasAdmin = true;
                }
            }

            // Mark as installed if lock file exists OR database has tables with admin
            if ($hasLockFile || ($tablesCount >= 5 && $hasAdmin)) {
                $isInstalled = true;
                $reason = 'SYSTEM_HEALTHY_READY';
            } else if ($tablesCount > 0) {
                $reason = 'PARTIAL_DATABASE_SETUP';
            } else {
                $reason = 'EMPTY_DATABASE';
            }

            // Retrieve organization profile if present
            $orgData = null;
            if (in_array('tenants', $tables)) {
                try {
                    $tenantStmt = $pdo->query("SELECT id, name, commercial_registry, tax_number, phone, email, address, logo_url, stamp_url FROM tenants ORDER BY created_at ASC LIMIT 1");
                    $tenantRow = $tenantStmt ? $tenantStmt->fetch(PDO::FETCH_ASSOC) : null;
                    if ($tenantStmt) {
                        $tenantStmt->closeCursor();
                    }
                    if ($tenantRow && !empty($tenantRow['name'])) {
                        $orgData = [
                            'id'                 => $tenantRow['id'] ?? 'org-default',
                            'name'               => $tenantRow['name'],
                            'commercialRegister' => $tenantRow['commercial_registry'] ?? '',
                            'taxNumber'          => $tenantRow['tax_number'] ?? '',
                            'phone'              => $tenantRow['phone'] ?? '',
                            'email'              => $tenantRow['email'] ?? '',
                            'address'            => $tenantRow['address'] ?? '',
                            'logoUrl'            => $tenantRow['logo_url'] ?? '',
                            'stampUrl'           => $tenantRow['stamp_url'] ?? ''
                        ];
                    }
                } catch (\Throwable $t) {}
            }

            if (!$orgData) {
                $orgCfg = DatabaseConfig::getOrgConfig();
                if (!empty($orgCfg['name'])) {
                    $orgData = [
                        'id'                 => 'org-default',
                        'name'               => $orgCfg['name'],
                        'commercialRegister' => $orgCfg['commercialRegister'] ?? '',
                        'taxNumber'          => $orgCfg['taxNumber'] ?? '',
                        'phone'              => $orgCfg['phone'] ?? '',
                        'email'              => '',
                        'address'            => $orgCfg['address'] ?? '',
                        'logoUrl'            => $orgCfg['logo'] ?? '',
                        'stampUrl'           => $orgCfg['stamp'] ?? ''
                    ];
                }
            }
        } catch (\Throwable $e) {
            $reason = 'TABLE_QUERY_FAILED: ' . $e->getMessage();
        }
    } else {
        $reason = 'DATABASE_CONNECTION_FAILED: ' . Database::getLastError();
    }

    jsonResponse([
        'installed'         => $isInstalled,
        'databaseConnected' => $dbConnected,
        'hasDb'             => $hasDb,
        'hasAdmin'          => $hasAdmin,
        'tablesCount'       => $tablesCount,
        'organization'      => $orgData ?? null,
        'reason'            => $reason,
        'timestamp'         => date('c')
    ]);
} catch (\Throwable $e) {
    jsonResponse([
        'installed'         => false,
        'databaseConnected' => false,
        'hasDb'             => false,
        'hasAdmin'          => false,
        'tablesCount'       => 0,
        'reason'            => 'EXCEPTION: ' . $e->getMessage(),
        'timestamp'         => date('c')
    ]);
}
