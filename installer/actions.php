<?php
/**
 * Almakhzoun Inventory Pro - Standalone Installer Actions Handler
 * Direct endpoint: /installer/actions.php?action=...
 */

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

use function Almakhzoun\Installer\jsonResponse;
use function Almakhzoun\Installer\jsonSuccess;
use function Almakhzoun\Installer\jsonError;
use function Almakhzoun\Installer\getJsonBody;
use function Almakhzoun\Installer\rootPath;

// Safely require core framework classes if available
$root = rootPath();
if (file_exists($root . '/config/paths.php')) {
    require_once $root . '/config/paths.php';
}
if (file_exists($root . '/config/security.php')) {
    require_once $root . '/config/security.php';
}
if (file_exists($root . '/config/DatabaseConfig.php')) {
    require_once $root . '/config/DatabaseConfig.php';
}
if (file_exists($root . '/database/Database.php')) {
    require_once $root . '/database/Database.php';
}
if (file_exists($root . '/database/MigrationRunner.php')) {
    require_once $root . '/database/MigrationRunner.php';
}

$body = getJsonBody();
$action = $_GET['action'] ?? $body['action'] ?? 'ping';

// Global Lock Check for Sensitive / Mutating Actions
$lockFile = $root . '/.installed';
$altLock = $root . '/install.lock';
$configFile = $root . '/config/installed.json';
$isLocked = file_exists($lockFile) || file_exists($altLock) || file_exists($configFile);

$sensitiveActions = [
    'create_database', 'create_db',
    'create_table', 'create_tables', 'migrate',
    'seed_default_data',
    'create_admin',
    'save_config', 'finish_install', 'finalize',
    'execute'
];

if ($isLocked && in_array($action, $sensitiveActions, true)) {
    jsonError('النظام مثبت مسبقاً ومحمي ضد إعادة التثبيت. لحماية بيانات المؤسسة تم قفل معالج التثبيت. لإعادة التثبيت يجب حذف ملف install.lock أو .installed أو config/installed.json يدوياً من مجلد الاستضافة.', 403);
}

switch ($action) {
    // -------------------------------------------------------------
    // 1. PING / DIAGNOSTIC
    // -------------------------------------------------------------
    case 'ping':
    case 'test':
        jsonSuccess('Installer API يعمل بشكل صحيح', [
            'data' => [
                'ping'                => 'pong',
                'php_version'         => PHP_VERSION,
                'server_software'     => $_SERVER['SERVER_SOFTWARE'] ?? 'PHP CLI / Internal',
                'script_filename'     => $_SERVER['SCRIPT_FILENAME'] ?? __FILE__,
                'script_name'         => $_SERVER['SCRIPT_NAME'] ?? '/installer/actions.php',
                'request_uri'         => $_SERVER['REQUEST_URI'] ?? '/installer/actions.php?action=ping',
                'document_root'       => $_SERVER['DOCUMENT_ROOT'] ?? $root,
                'installer_directory' => __DIR__
            ]
        ]);
        break;

    // -------------------------------------------------------------
    // 2. CHECK LOCK / STATUS
    // -------------------------------------------------------------
    case 'check_lock':
    case 'status':
        $lockFile = $root . '/.installed';
        $configFile = $root . '/config/installed.json';
        $isLocked = file_exists($lockFile) || file_exists($configFile);
        
        $dbConnected = false;
        $hasDb = false;
        $hasAdmin = false;
        $tablesCount = 0;
        $reason = 'READY_TO_INSTALL';

        if (class_exists('Almakhzoun\Database\Database')) {
            $pdo = \Almakhzoun\Database\Database::connect();
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
                        $hasAdmin = (int)($userRows[0]['cnt'] ?? 0) > 0;
                    }
                } catch (\Throwable $e) {}
            }
        }

        jsonResponse([
            'success'           => true,
            'installed'         => ($isLocked && $tablesCount >= 10 && $hasAdmin),
            'is_locked'         => $isLocked,
            'databaseConnected' => $dbConnected,
            'hasDb'             => $hasDb,
            'hasAdmin'          => $hasAdmin,
            'tablesCount'       => $tablesCount,
            'reason'            => $reason,
            'phpVersion'        => PHP_VERSION,
            'serverTime'        => date('c')
        ]);
        break;

    // -------------------------------------------------------------
    // 3. CHECK REQUIREMENTS
    // -------------------------------------------------------------
    case 'check_requirements':
    case 'requirements':
    case 'system_check':
        $phpVersion = PHP_VERSION;
        $phpOk = version_compare($phpVersion, '8.0.0', '>=');
        $pdoInstalled = extension_loaded('pdo');
        $pdoMysqlInstalled = extension_loaded('pdo_mysql');
        $jsonInstalled = extension_loaded('json');
        $mbstringInstalled = extension_loaded('mbstring');
        $opensslInstalled = extension_loaded('openssl');
        $fileinfoInstalled = extension_loaded('fileinfo');

        $storageDir = $root . '/storage';
        $uploadsDir = $storageDir . '/uploads';
        $backupsDir = $storageDir . '/backups';
        $configDir  = $root . '/config';

        $storageWritable = is_writable($storageDir) || @mkdir($storageDir, 0755, true);
        $uploadsWritable = is_writable($uploadsDir) || @mkdir($uploadsDir, 0755, true);
        $backupsWritable = is_writable($backupsDir) || @mkdir($backupsDir, 0755, true);
        $configWritable  = is_writable($configDir) || @mkdir($configDir, 0755, true);

        $allPassed = $phpOk && $pdoInstalled && $pdoMysqlInstalled && $jsonInstalled && $mbstringInstalled && $uploadsWritable && $configWritable;

        $requirements = [
            [
                'name'     => 'إصدار PHP (8.0+)',
                'passed'   => $phpOk,
                'status'   => $phpOk,
                'current'  => "PHP {$phpVersion}",
                'required' => '>= 8.0.0'
            ],
            [
                'name'     => 'امتداد PDO الرئيسي',
                'passed'   => $pdoInstalled,
                'status'   => $pdoInstalled,
                'current'  => $pdoInstalled ? 'مفعل' : 'غير متوفر',
                'required' => 'مفعل'
            ],
            [
                'name'     => 'امتداد PDO MySQL',
                'passed'   => $pdoMysqlInstalled,
                'status'   => $pdoMysqlInstalled,
                'current'  => $pdoMysqlInstalled ? 'مفعل' : 'غير متوفر',
                'required' => 'مفعل'
            ],
            [
                'name'     => 'امتداد JSON',
                'passed'   => $jsonInstalled,
                'status'   => $jsonInstalled,
                'current'  => $jsonInstalled ? 'مفعل' : 'غير متوفر',
                'required' => 'مفعل'
            ],
            [
                'name'     => 'امتداد MBString (دعم النصوص العربية)',
                'passed'   => $mbstringInstalled,
                'status'   => $mbstringInstalled,
                'current'  => $mbstringInstalled ? 'مفعل' : 'غير متوفر',
                'required' => 'مفعل'
            ],
            [
                'name'     => 'امتداد OpenSSL (تشفير الجلسات)',
                'passed'   => $opensslInstalled,
                'status'   => $opensslInstalled,
                'current'  => $opensslInstalled ? 'مفعل' : 'غير متوفر',
                'required' => 'مفعل'
            ],
            [
                'name'     => 'صلاحية الكتابة لمجلد الملفات uploads',
                'passed'   => $uploadsWritable,
                'status'   => $uploadsWritable,
                'current'  => $uploadsWritable ? 'قابل للكتابة' : 'غير قابل للكتابة',
                'required' => 'قابل للكتابة'
            ],
            [
                'name'     => 'صلاحية الكتابة لمجلد الإعدادات config',
                'passed'   => $configWritable,
                'status'   => $configWritable,
                'current'  => $configWritable ? 'قابل للكتابة' : 'غير قابل للكتابة',
                'required' => 'قابل للكتابة'
            ]
        ];

        jsonResponse([
            'success'      => true,
            'allPassed'    => $allPassed,
            'requirements' => $requirements,
            'checks'       => $requirements,
            'phpVersion'   => $phpVersion,
            'server'       => $_SERVER['SERVER_SOFTWARE'] ?? 'Apache/PHP'
        ]);
        break;

    // -------------------------------------------------------------
    // 4. TEST DATABASE CONNECTION
    // -------------------------------------------------------------
    case 'test_db':
    case 'database_test':
        $dbHost = $body['dbConfig']['host'] ?? $body['host'] ?? $body['dbHost'] ?? 'localhost';
        $dbPort = (int)($body['dbConfig']['port'] ?? $body['port'] ?? $body['dbPort'] ?? 3306);
        $dbName = $body['dbConfig']['database'] ?? $body['dbConfig']['dbName'] ?? $body['database'] ?? $body['dbName'] ?? '';
        $dbUser = $body['dbConfig']['user'] ?? $body['dbConfig']['username'] ?? $body['username'] ?? $body['dbUser'] ?? $body['user'] ?? 'root';
        $dbPass = $body['dbConfig']['password'] ?? $body['password'] ?? $body['dbPassword'] ?? '';

        if (empty($dbHost) || empty($dbName) || empty($dbUser)) {
            jsonError('يرجى تزويد خادم قاعدة البيانات واسم القاعدة واسم المستخدم.', 400);
        }

        if (class_exists('Almakhzoun\Database\Database')) {
            $testRes = \Almakhzoun\Database\Database::testConnection([
                'host'     => $dbHost,
                'port'     => $dbPort,
                'database' => $dbName,
                'username' => $dbUser,
                'password' => $dbPass
            ]);
            if ($testRes['success']) {
                jsonSuccess($testRes['message'], [
                    'databaseConnected' => true,
                    'details' => [
                        'host'     => $dbHost,
                        'port'     => $dbPort,
                        'database' => $dbName,
                        'user'     => $dbUser
                    ]
                ]);
            } else {
                jsonError($testRes['error'] ?? 'فشل الاتصال بقاعدة البيانات', 400);
            }
        }

        try {
            $dsn = "mysql:host={$dbHost};port={$dbPort};dbname={$dbName};charset=utf8mb4";
            $pdo = new PDO($dsn, $dbUser, $dbPass, [
                PDO::ATTR_ERRMODE                  => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_TIMEOUT                  => 5,
                PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true
            ]);
            jsonSuccess('تم الاتصال بقاعدة بيانات MySQL بنجاح!', [
                'databaseConnected' => true,
                'details' => [
                    'host'     => $dbHost,
                    'port'     => $dbPort,
                    'database' => $dbName,
                    'user'     => $dbUser
                ]
            ]);
        } catch (\PDOException $e) {
            jsonError('فشل الاتصال بخادم MySQL: ' . $e->getMessage(), 400);
        }
        break;

    // -------------------------------------------------------------
    // 4.5. CREATE DATABASE IF NOT EXISTS
    // -------------------------------------------------------------
    case 'create_database':
    case 'create_db':
        $dbHost = $body['dbConfig']['host'] ?? $body['host'] ?? $body['dbHost'] ?? 'localhost';
        $dbPort = (int)($body['dbConfig']['port'] ?? $body['port'] ?? $body['dbPort'] ?? 3306);
        $dbName = $body['dbConfig']['database'] ?? $body['dbConfig']['dbName'] ?? $body['database'] ?? $body['dbName'] ?? '';
        $dbUser = $body['dbConfig']['user'] ?? $body['dbConfig']['username'] ?? $body['username'] ?? $body['dbUser'] ?? $body['user'] ?? 'root';
        $dbPass = $body['dbConfig']['password'] ?? $body['password'] ?? $body['dbPassword'] ?? '';

        if (empty($dbHost) || empty($dbName) || empty($dbUser)) {
            jsonError('يرجى تزويد خادم قاعدة البيانات واسم القاعدة واسم المستخدم.', 400);
        }

        try {
            $dsn = "mysql:host={$dbHost};port={$dbPort};charset=utf8mb4";
            $pdo = new PDO($dsn, $dbUser, $dbPass, [
                PDO::ATTR_ERRMODE                  => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_TIMEOUT                  => 5,
                PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true
            ]);
            $cleanDbName = preg_replace('/[^a-zA-Z0-9_]/', '', $dbName);
            $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$cleanDbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            jsonSuccess("تم إنشاء أو التحقق من وجود قاعدة البيانات [{$cleanDbName}] بنجاح!", [
                'databaseCreated' => true,
                'database'        => $cleanDbName
            ]);
        } catch (\PDOException $e) {
            jsonError('فشل إنشاء قاعدة البيانات: ' . $e->getMessage(), 400);
        }
        break;

    // -------------------------------------------------------------
    // 5. CREATE TABLES / MIGRATE
    // -------------------------------------------------------------
    case 'create_table':
    case 'create_tables':
    case 'migrate':
        $dbHost = $body['dbConfig']['host'] ?? $body['host'] ?? 'localhost';
        $dbPort = (int)($body['dbConfig']['port'] ?? $body['port'] ?? 3306);
        $dbName = $body['dbConfig']['database'] ?? $body['database'] ?? 'almakhzoun_cloud';
        $dbUser = $body['dbConfig']['user'] ?? $body['username'] ?? 'root';
        $dbPass = $body['dbConfig']['password'] ?? $body['password'] ?? '';

        try {
            $dsn = "mysql:host={$dbHost};port={$dbPort};dbname={$dbName};charset=utf8mb4";
            $pdo = new PDO($dsn, $dbUser, $dbPass, [
                PDO::ATTR_ERRMODE                  => PDO::ERRMODE_EXCEPTION,
                PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true
            ]);
            try {
                $pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, true);
            } catch (\Throwable $t) {}

            if (class_exists('Almakhzoun\Database\MigrationRunner')) {
                \Almakhzoun\Database\MigrationRunner::ensureCarsColumns($pdo);
                $res = \Almakhzoun\Database\MigrationRunner::runAll($pdo);
                jsonSuccess('تم إنشاء وتطبيق جداول قاعدة البيانات بنجاح', $res);
            } else {
                jsonSuccess('تم الاتصال وتجهيز الجداول بنجاح');
            }
        } catch (\Throwable $e) {
            jsonError('فشل تنفيذ ترقية وهيكلة الجداول: ' . $e->getMessage(), 400);
        }
        break;

    // -------------------------------------------------------------
    // 6. SEED DEFAULT DATA
    // -------------------------------------------------------------
    case 'seed_default_data':
        $dbHost = $body['dbConfig']['host'] ?? $body['host'] ?? 'localhost';
        $dbPort = (int)($body['dbConfig']['port'] ?? $body['port'] ?? 3306);
        $dbName = $body['dbConfig']['database'] ?? $body['database'] ?? 'almakhzoun_cloud';
        $dbUser = $body['dbConfig']['user'] ?? $body['username'] ?? 'root';
        $dbPass = $body['dbConfig']['password'] ?? $body['password'] ?? '';

        try {
            $dsn = "mysql:host={$dbHost};port={$dbPort};dbname={$dbName};charset=utf8mb4";
            $pdo = new PDO($dsn, $dbUser, $dbPass, [
                PDO::ATTR_ERRMODE                  => PDO::ERRMODE_EXCEPTION,
                PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true
            ]);

            $pdo->exec("
                INSERT IGNORE INTO branches (id, tenant_id, name, code, is_active, created_at)
                VALUES ('branch-main', 'org-default', 'الفرع الرئيسي', 'MAIN-01', 1, NOW())
            ");
            jsonSuccess('تم غرس البيانات الأساسية والفروع بنجاح');
        } catch (\Throwable $e) {
            jsonError('فشل غرس البيانات الأساسية: ' . $e->getMessage(), 400);
        }
        break;

    // -------------------------------------------------------------
    // 7. CREATE SUPER ADMIN
    // -------------------------------------------------------------
    case 'create_admin':
        $dbHost = $body['dbConfig']['host'] ?? $body['host'] ?? 'localhost';
        $dbPort = (int)($body['dbConfig']['port'] ?? $body['port'] ?? 3306);
        $dbName = $body['dbConfig']['database'] ?? $body['database'] ?? 'almakhzoun_cloud';
        $dbUser = $body['dbConfig']['user'] ?? $body['username'] ?? 'root';
        $dbPass = $body['dbConfig']['password'] ?? $body['password'] ?? '';

        $adminUser = trim($body['adminConfig']['username'] ?? $body['username'] ?? 'admin');
        $adminPass = $body['adminConfig']['password'] ?? $body['password'] ?? 'admin123';
        $adminName = trim($body['adminConfig']['fullName'] ?? $body['fullName'] ?? 'المدير العام');
        $adminEmail = trim($body['adminConfig']['email'] ?? $body['email'] ?? 'admin@almakhzoun.com');

        try {
            $dsn = "mysql:host={$dbHost};port={$dbPort};dbname={$dbName};charset=utf8mb4";
            $pdo = new PDO($dsn, $dbUser, $dbPass, [
                PDO::ATTR_ERRMODE                  => PDO::ERRMODE_EXCEPTION,
                PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true
            ]);

            $passwordHash = password_hash($adminPass, PASSWORD_BCRYPT, ['cost' => 10]);
            $stmt = $pdo->prepare("
                INSERT INTO users (id, tenant_id, username, password_hash, role, full_name, email, primary_admin, is_active, created_at)
                VALUES (?, 'org-default', ?, ?, 'مدير', ?, ?, 1, 1, NOW())
                ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), full_name = VALUES(full_name), email = VALUES(email)
            ");
            $adminId = 'usr_' . bin2hex(random_bytes(8));
            $stmt->execute([$adminId, $adminUser, $passwordHash, $adminName, $adminEmail]);
            $stmt->closeCursor();

            jsonSuccess('تم إنشاء حساب المدير العام بنجاح', [
                'admin' => [
                    'username' => $adminUser,
                    'fullName' => $adminName,
                    'email'    => $adminEmail,
                    'role'     => 'مدير'
                ]
            ]);
        } catch (\Throwable $e) {
            jsonError('فشل إنشاء حساب المدير: ' . $e->getMessage(), 400);
        }
        break;

    // -------------------------------------------------------------
    // 8. SAVE CONFIG / FINALIZE
    // -------------------------------------------------------------
    case 'save_config':
    case 'finish_install':
    case 'finalize':
        $dbConfig = $body['dbConfig'] ?? $body['db'] ?? null;
        $adminInfo = $body['adminConfig'] ?? $body['admin'] ?? [];
        $orgInfo = $body['orgConfig'] ?? $body['org'] ?? [];

        if (!empty($dbConfig) && class_exists('Almakhzoun\Config\DatabaseConfig')) {
            \Almakhzoun\Config\DatabaseConfig::saveInstalledConfig($dbConfig, $adminInfo, $orgInfo);
        } else {
            $lockFile = $root . '/.installed';
            $altLock = $root . '/install.lock';
            $configFile = $root . '/config/installed.json';
            $existingSecurity = [];
            if (file_exists($configFile)) {
                $existingRaw = @json_decode(@file_get_contents($configFile) ?: '', true);
                if (!empty($existingRaw['security'])) {
                    $existingSecurity = $existingRaw['security'];
                }
            }
            $info = [
                'installed'    => true,
                'installed_at' => date('c'),
                'version'      => '3.6.0',
                'security'     => [
                    'jwtSecret' => $existingSecurity['jwtSecret'] ?? bin2hex(random_bytes(32)),
                    'aesKeyHex' => $existingSecurity['aesKeyHex'] ?? bin2hex(random_bytes(32))
                ],
                'org'          => $orgInfo
            ];
            @file_put_contents($lockFile, date('c') . "\n");
            @file_put_contents($altLock, date('c') . "\n");
            @file_put_contents($configFile, json_encode($info, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        }

        // Also persist org details directly to database if credentials are known
        if (!empty($dbConfig) && !empty($orgInfo)) {
            try {
                $dbHost = $dbConfig['host'] ?? 'localhost';
                $dbPort = (int)($dbConfig['port'] ?? 3306);
                $dbName = $dbConfig['database'] ?? 'almakhzoun_cloud';
                $dbUser = $dbConfig['user'] ?? $dbConfig['username'] ?? 'root';
                $dbPass = $dbConfig['password'] ?? '';
                $dsn = "mysql:host={$dbHost};port={$dbPort};dbname={$dbName};charset=utf8mb4";
                $pdo = new PDO($dsn, $dbUser, $dbPass, [
                    PDO::ATTR_ERRMODE                  => PDO::ERRMODE_EXCEPTION,
                    PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true
                ]);

                $oName = trim($orgInfo['name'] ?? 'مؤسسة المخزون لتجارة السيارات');
                $oPhone = trim($orgInfo['phone'] ?? '');
                $oTax = trim($orgInfo['taxNumber'] ?? '');
                $oCR = trim($orgInfo['commercialRegister'] ?? '');
                $oAddr = trim($orgInfo['address'] ?? '');
                $oLogo = $orgInfo['logo'] ?? null;
                $oStamp = $orgInfo['stamp'] ?? null;
                $aEmail = trim($adminInfo['email'] ?? 'admin@almakhzoun.com');

                $st = $pdo->prepare('INSERT INTO tenants (id, name, commercial_registry, tax_number, phone, email, address, logo_url, stamp_url, created_at)
                    VALUES ("org-default", ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                    ON DUPLICATE KEY UPDATE 
                        name = VALUES(name), 
                        commercial_registry = VALUES(commercial_registry),
                        tax_number = VALUES(tax_number),
                        phone = VALUES(phone),
                        email = VALUES(email),
                        address = VALUES(address),
                        logo_url = VALUES(logo_url),
                        stamp_url = VALUES(stamp_url)');
                $st->execute([$oName, $oCR, $oTax, $oPhone, $aEmail, $oAddr, $oLogo, $oStamp]);
                $st->closeCursor();

                $st2 = $pdo->prepare('INSERT INTO settings (id, tenant_id, org_name, contact_number, tax_number, commercial_register, address, currency, system_version, updated_at)
                    VALUES ("settings_default", "org-default", ?, ?, ?, ?, ?, "SAR", "3.6.0", NOW())
                    ON DUPLICATE KEY UPDATE 
                        org_name = VALUES(org_name), 
                        contact_number = VALUES(contact_number),
                        tax_number = VALUES(tax_number),
                        commercial_register = VALUES(commercial_register),
                        address = VALUES(address)');
                $st2->execute([$oName, $oPhone, $oTax, $oCR, $oAddr]);
                $st2->closeCursor();
            } catch (\Throwable $t) {}
        }

        jsonSuccess('تم إتمام التثبيت وحفظ ملف الإعدادات بنجاح!');
        break;

    // -------------------------------------------------------------
    // 9. EXECUTE ALL-IN-ONE
    // -------------------------------------------------------------
    case 'execute':
        if (file_exists($root . '/api/install/execute.php')) {
            require $root . '/api/install/execute.php';
            exit;
        }
        jsonError('Execute script not found', 500);
        break;

    default:
        jsonError("الإجراء المطلوب غير معروف: {$action}", 400);
        break;
}
