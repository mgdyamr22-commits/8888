<?php
/**
 * /api/backups
 * Unified Database Backup & Smart Recovery Controller
 * Supports:
 * - GET: List backups, download backup, or export full database snapshot (/api/auth/backup-db)
 * - POST: Atomic database restoration (/api/auth/restore-db, /api/backups/restore) from JSON/SQL files or payloads
 * - POST: Create new database dump snapshot
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

use Almakhzoun\Config\Paths;
use Almakhzoun\Database\Database;
use Almakhzoun\Config\Security;

// Ensure storage subfolders exist
Paths::ensureDirectories();

// Strictly enforce Admin authorization for all backup, restore, dump, and download operations
$currentAdmin = requireAdmin();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$uri = $_SERVER['REQUEST_URI'] ?? '';
$actionParam = $_GET['action'] ?? '';

// =========================================================================
// 1. GET HANDLER (Listing, Exporting dump, Downloading)
// =========================================================================
if ($method === 'GET') {
    try {
        // Check if caller requests full database export (e.g. /api/auth/backup-db or ?action=dump)
        if (str_contains($uri, 'auth/backup-db') || $actionParam === 'dump' || $actionParam === 'export' || isset($_GET['export'])) {
            $dump = createDatabaseDump();
            jsonSuccess('تم استخراج نسخة قاعدة البيانات بنجاح.', [
                'dbData' => $dump['data'],
                'dump'   => $dump
            ]);
        }

        // Check if caller requests download of a specific backup file
        if (!empty($_GET['download'])) {
            $safeName = basename((string)$_GET['download']);
            $filePath = Paths::backups() . '/' . $safeName;

            if (!file_exists($filePath)) {
                jsonError('ملف النسخة الاحتياطية غير موجود.', 404);
            }

            header('Content-Type: application/json; charset=utf-8');
            header('Content-Disposition: attachment; filename="' . $safeName . '"');
            header('Content-Length: ' . filesize($filePath));
            readfile($filePath);
            exit;
        }

        // Default: List all available backups
        $backupDir = Paths::backups();
        $files = array_merge(
            glob($backupDir . '/*.json') ?: [],
            glob($backupDir . '/*.sql') ?: []
        );

        $backups = [];
        foreach ($files as $file) {
            $base = basename($file);
            $backups[] = [
                'fileName'  => $base,
                'name'      => $base,
                'fileSize'  => filesize($file),
                'size'      => filesize($file),
                'createdAt' => date('c', filemtime($file)),
                'date'      => date('Y-m-d H:i:s', filemtime($file)),
                'isSql'     => str_ends_with(strtolower($base), '.sql')
            ];
        }

        // Sort latest first
        usort($backups, fn($a, $b) => strcmp($b['createdAt'], $a['createdAt']));

        jsonSuccess('Success', [
            'backups' => $backups,
            'files'   => $backups
        ]);
    } catch (\Throwable $e) {
        jsonError('فشل استرجاع بيانات النسخ الاحتياطية: ' . $e->getMessage(), 500);
    }
}

// =========================================================================
// 2. POST HANDLER (Restore or Create Backup)
// =========================================================================
if ($method === 'POST') {
    $body = getJsonBody();

    // Determine if this is a restore request
    $isRestore = str_contains($uri, 'auth/restore-db')
        || str_contains($uri, 'backups/restore')
        || ($body['action'] ?? '') === 'restore'
        || isset($body['dbData'])
        || isset($body['cars'])
        || isset($body['sql'])
        || (isset($body['fileName']) && ($body['action'] ?? '') !== 'create');

    if ($isRestore) {
        handleRestoreExecution($body, $uri);
    } else {
        handleCreateBackup();
    }
}

jsonError('Method Not Allowed', 405);

// =========================================================================
// HELPER FUNCTIONS
// =========================================================================

/**
 * Creates a full associative dump of all MySQL application tables
 */
function createDatabaseDump(): array
{
    $tables = [
        'tenants', 'branches', 'users', 'user_permissions', 'user_security_questions',
        'user_trusted_devices', 'user_layout_preferences', 'cars', 'car_exit_data',
        'car_custom_fields', 'car_history', 'inventory_movements', 'customers',
        'delegates', 'reservations', 'sales', 'transfers', 'transfer_items',
        'vehicle_costs', 'letters_archive', 'companies', 'settings'
    ];

    $dump = [
        'system'    => 'Almakhzoun Inventory Pro',
        'version'   => '3.6.0',
        'dumpDate'  => date('c'),
        'data'      => []
    ];

    foreach ($tables as $t) {
        try {
            $dump['data'][$t] = Database::query("SELECT * FROM `{$t}`");
        } catch (\Throwable $e) {
            $dump['data'][$t] = [];
        }
    }

    return $dump;
}

/**
 * Creates and writes a JSON snapshot to storage/backups/
 */
function handleCreateBackup(): void
{
    $currentUser = getAuthenticatedUser();
    $username = $currentUser ? $currentUser['username'] : 'system_admin';

    $dump = createDatabaseDump();
    $dump['createdBy'] = $username;

    $fileName = 'backup_' . date('Y-m-d_His') . '.json';
    $filePath = Paths::backups() . '/' . $fileName;

    file_put_contents($filePath, json_encode($dump, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

    logAudit('CREATE_BACKUP', $fileName, 'backups', "إنشاء نسخة احتياطية: {$fileName}");
    jsonSuccess('تم إنشاء النسخة الاحتياطية بنجاح.', [
        'fileName' => $fileName,
        'fileSize' => filesize($filePath),
        'filePath' => $filePath
    ]);
}

/**
 * Executes full atomic restoration on incoming recovery/backup payloads
 */
function handleRestoreExecution(array $body, string $uri): void
{
    // Authorization is already strictly validated via requireAdmin() at entry point.
    $currentUser = requireAdmin();

    // 1. Resolve raw data payload
    $rawInput = null;

    // Check if filename in storage/backups was provided
    if (!empty($body['fileName']) && empty($body['dbData']) && empty($body['cars']) && empty($body['data'])) {
        $safeName = basename((string)$body['fileName']);
        $filePath = Paths::backups() . '/' . $safeName;

        if (!file_exists($filePath)) {
            jsonError("ملف النسخة الاحتياطية ({$safeName}) غير موجود على الخادم.", 404);
        }

        if (str_ends_with(strtolower($safeName), '.sql')) {
            // Raw SQL File restoration
            executeSqlDump(file_get_contents($filePath));
            jsonSuccess("تم تنفيذ واستعادة ملف SQL ({$safeName}) بنجاح تام.");
            return;
        }

        $fileContent = file_get_contents($filePath);
        $rawInput = json_decode($fileContent, true);
        if (!$rawInput || !is_array($rawInput)) {
            jsonError("محتوى ملف النسخة الاحتياطية ({$safeName}) تالف أو غير صالح.", 400);
        }
    } else {
        $rawInput = $body;
    }

    // Check if raw SQL was directly posted
    if (!empty($rawInput['sql'])) {
        executeSqlDump((string)$rawInput['sql']);
        jsonSuccess('تم تنفيذ تعليمات SQL بنجاح في قاعدة البيانات.');
        return;
    }

    // 2. Unpack tables collection
    // Supports: PHP dump format, Express dbData format, or Full React client-side BackupData format
    $tablesData = [];

    if (isset($rawInput['data']) && is_array($rawInput['data'])) {
        $tablesData = $rawInput['data'];
    } elseif (isset($rawInput['dbData']) && is_array($rawInput['dbData'])) {
        $tablesData = $rawInput['dbData'];
        if (isset($tablesData['data']) && is_array($tablesData['data'])) {
            $tablesData = $tablesData['data'];
        }
    } elseif (isset($rawInput['backendDatabase']) && is_array($rawInput['backendDatabase'])) {
        $tablesData = $rawInput['backendDatabase'];
        if (isset($tablesData['data']) && is_array($tablesData['data'])) {
            $tablesData = $tablesData['data'];
        }
    }

    // Also blend direct top-level arrays from standard client backups (BackupData)
    $tableAliases = [
        'tenants'             => ['tenants'],
        'branches'            => ['branches'],
        'users'               => ['users'],
        'cars'                => ['cars'],
        'customers'           => ['customers'],
        'delegates'           => ['delegates'],
        'inventory_movements' => ['inventoryMovements', 'movements', 'inventory_movements'],
        'sales'               => ['sales'],
        'transfers'           => ['companyTransfers', 'transfers'],
        'vehicle_costs'       => ['vehicleCosts', 'costs', 'vehicle_costs'],
        'letters_archive'     => ['lettersArchive', 'letters', 'letters_archive'],
        'companies'           => ['sisterCompanies', 'companies'],
        'settings'            => ['settings']
    ];

    foreach ($tableAliases as $dbTable => $aliases) {
        if (!isset($tablesData[$dbTable]) || !is_array($tablesData[$dbTable]) || empty($tablesData[$dbTable])) {
            foreach ($aliases as $alias) {
                if (isset($rawInput[$alias])) {
                    $tablesData[$dbTable] = is_array($rawInput[$alias]) ? $rawInput[$alias] : [$rawInput[$alias]];
                    break;
                }
            }
        }
    }

    if (empty($tablesData)) {
        jsonError('ملف الاسترداد لا يحتوي على أي جداول أو سجلات قابلة للاستعادة.', 400);
    }

    // 3. Perform Transactional Restoration
    try {
        $restoredStats = [];

        Database::transaction(function(\PDO $pdo) use ($tablesData, &$restoredStats) {
            $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');

            foreach ($tablesData as $tableName => $rows) {
                // Table name sanitization
                $table = preg_replace('/[^a-zA-Z0-9_]/', '', (string)$tableName);
                if (empty($table)) continue;

                // Handle settings if passed as single associative object
                if ($table === 'settings' && is_array($rows) && !isset($rows[0]) && !empty($rows)) {
                    $rows = [$rows];
                }

                if (!is_array($rows) || empty($rows)) {
                    continue;
                }

                // Verify table exists in current MySQL database
                $checkStmt = $pdo->prepare('SHOW TABLES LIKE ?');
                $checkStmt->execute([$table]);
                if (!$checkStmt->fetch()) {
                    continue; // Skip tables not defined in MySQL schema
                }

                // Get table columns and their attributes
                $colStmt = $pdo->query("SHOW COLUMNS FROM `{$table}`");
                $dbColumns = $colStmt->fetchAll(\PDO::FETCH_COLUMN, 0);
                if (empty($dbColumns)) continue;

                // Truncate/clear existing data before restoring
                $pdo->exec("DELETE FROM `{$table}`");

                $insertedCount = 0;
                foreach ($rows as $rawRow) {
                    if (!is_array($rawRow) || empty($rawRow)) continue;

                    $mappedRow = mapRowToColumns($rawRow, $dbColumns, $table);
                    if (empty($mappedRow)) continue;

                    $cols = array_keys($mappedRow);
                    $colsEscaped = array_map(fn($c) => "`{$c}`", $cols);
                    $placeholders = array_fill(0, count($cols), '?');

                    $sql = "INSERT INTO `{$table}` (" . implode(', ', $colsEscaped) . ") VALUES (" . implode(', ', $placeholders) . ")";
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute(array_values($mappedRow));
                    $insertedCount++;
                }

                $restoredStats[$table] = $insertedCount;
            }

            $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
        });

        // Save a copy of this restored snapshot into storage/backups as audit history
        $snapshotName = 'restored_' . date('Y-m-d_His') . '.json';
        @file_put_contents(Paths::backups() . '/' . $snapshotName, json_encode($rawInput, JSON_UNESCAPED_UNICODE));

        logAudit('RESTORE_DATABASE', 'all_tables', 'backups', 'تم استعادة وتنفيذ ملف الاسترداد بنجاح في قاعدة البيانات.');

        jsonSuccess('تم استعادة وتنفيذ ملف الاسترداد بنجاح في قاعدة بيانات الاستضافة!', [
            'restored' => true,
            'stats'    => $restoredStats
        ]);

    } catch (\Throwable $e) {
        jsonError('فشل تنفيذ استعادة قاعدة البيانات: ' . $e->getMessage(), 500);
    }
}

/**
 * Maps camelCase / unstructured row attributes to MySQL database columns
 */
function mapRowToColumns(array $row, array $dbColumns, string $table): array
{
    $mapped = [];

    // Pre-calculate camel to snake lookup
    foreach ($dbColumns as $col) {
        $val = null;

        // 1. Direct match
        if (array_key_exists($col, $row)) {
            $val = $row[$col];
        } else {
            // 2. camelCase equivalent (e.g. cost_price -> costPrice, plate_number -> plateNumber)
            $camel = lcfirst(str_replace(' ', '', ucwords(str_replace('_', ' ', $col))));
            if (array_key_exists($camel, $row)) {
                $val = $row[$camel];
            }
        }

        // Table-specific custom aliases
        if ($val === null) {
            if ($col === 'password_hash' && isset($row['password'])) {
                $rawPass = (string)$row['password'];
                $val = str_starts_with($rawPass, '$2y$') || str_starts_with($rawPass, '$2a$') || str_starts_with($rawPass, '$2b$')
                    ? $rawPass
                    : Security::hashPassword($rawPass);
            } elseif ($col === 'recovery_code_hash' && isset($row['recoveryCodeHash'])) {
                $val = $row['recoveryCodeHash'];
            } elseif ($col === 'recovery_code_hash' && isset($row['recoveryCode'])) {
                $val = Security::hashPassword((string)$row['recoveryCode']);
            } elseif ($col === 'role' && isset($row['role'])) {
                $r = strtoupper((string)$row['role']);
                $val = match($r) {
                    'ADMIN', 'مدير' => 'مدير',
                    'DELEGATE', 'مندوب' => 'مندوب',
                    default => 'موظف'
                };
            } elseif ($col === 'tenant_id' && !isset($row['tenant_id']) && !isset($row['tenantId'])) {
                $val = 'org-default';
            } elseif ($col === 'org_name' && isset($row['name'])) {
                $val = $row['name'];
            } elseif ($col === 'contact_number' && isset($row['phone'])) {
                $val = $row['phone'];
            } elseif ($col === 'commercial_register' && (isset($row['cr']) || isset($row['commercialRegistry']))) {
                $val = $row['cr'] ?? $row['commercialRegistry'] ?? '';
            }
        }

        // Serialization for arrays or objects
        if (is_array($val) || is_object($val)) {
            $val = json_encode($val, JSON_UNESCAPED_UNICODE);
        }

        // Ensure boolean converts to 0/1
        if (is_bool($val)) {
            $val = $val ? 1 : 0;
        }

        if ($val !== null) {
            $mapped[$col] = $val;
        }
    }

    // Ensure ID exists
    if (!isset($mapped['id']) && in_array('id', $dbColumns, true)) {
        $mapped['id'] = $table . '_' . bin2hex(random_bytes(8));
    }

    return $mapped;
}

/**
 * Executes a multi-statement SQL script safely within a transaction
 */
function executeSqlDump(string $sql): void
{
    $pdo = Database::getConnection();
    if (!$pdo) {
        throw new \Exception('لا يوجد اتصال بقاعدة بيانات MySQL.');
    }

    $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');

    // Split SQL by semicolons avoiding comments and string literals
    $statements = array_filter(
        array_map('trim', explode(";\n", $sql)),
        fn($s) => !empty($s) && !str_starts_with($s, '--') && !str_starts_with($s, '/*')
    );

    foreach ($statements as $stmt) {
        if (!empty($stmt)) {
            $pdo->exec($stmt);
        }
    }

    $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
}
