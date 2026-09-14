<?php
/**
 * PDO Database Manager & Query Execution
 */

declare(strict_types=1);

namespace Almakhzoun\Database;

use Almakhzoun\Config\DatabaseConfig;
use PDO;
use PDOException;

class Database
{
    private static ?PDO $pdo = null;
    private static ?string $lastError = null;

    public static function setConnection(?PDO $pdo): void
    {
        self::$pdo = $pdo;
        self::$lastError = null;
    }

    public static function connect(?array $customConfig = null): ?PDO
    {
        if (self::$pdo !== null && $customConfig === null) {
            return self::$pdo;
        }

        $config = $customConfig ?? DatabaseConfig::get();
        $host = $config['host'] ?? 'localhost';
        $port = (int)($config['port'] ?? 3306);
        $dbName = $config['database'] ?? $config['dbName'] ?? 'almakhzoun_cloud';
        $user = $config['username'] ?? $config['user'] ?? 'root';
        $pass = $config['password'] ?? '';
        $charset = $config['charset'] ?? 'utf8mb4';

        $dsn = "mysql:host={$host};port={$port};dbname={$dbName};charset={$charset}";
        $options = [
            PDO::ATTR_ERRMODE                  => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE       => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES         => false,
            PDO::MYSQL_ATTR_INIT_COMMAND       => "SET NAMES {$charset} COLLATE utf8mb4_unicode_ci",
            PDO::ATTR_TIMEOUT                  => 10,
            PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true
        ];

        try {
            $pdo = new PDO($dsn, $user, $pass, $options);
            try {
                $pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, true);
            } catch (\Throwable $t) {}
            self::$pdo = $pdo;
            self::$lastError = null;
            self::ensureEssentialTablesExist();
            return $pdo;
        } catch (PDOException $e) {
            // Auto-create database if unknown database error (1049)
            if (strpos($e->getMessage(), '1049') !== false || stripos($e->getMessage(), 'unknown database') !== false) {
                try {
                    $rootDsn = "mysql:host={$host};port={$port};charset={$charset}";
                    $rootPdo = new PDO($rootDsn, $user, $pass, [
                        PDO::ATTR_ERRMODE                  => PDO::ERRMODE_EXCEPTION,
                        PDO::ATTR_TIMEOUT                  => 5,
                        PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true
                    ]);
                    try {
                        $rootPdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, true);
                    } catch (\Throwable $t) {}
                    $rootPdo->exec("CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
                    $pdo = new PDO($dsn, $user, $pass, $options);
                    try {
                        $pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, true);
                    } catch (\Throwable $t) {}
                    self::$pdo = $pdo;
                    self::$lastError = null;
                    self::ensureEssentialTablesExist();
                    return $pdo;
                } catch (PDOException $createEx) {
                    self::$lastError = $e->getMessage();
                    return null;
                }
            }

            self::$lastError = $e->getMessage();
            return null;
        }
    }

    public static function testConnection(array $config): array
    {
        $host = $config['host'] ?? 'localhost';
        $port = (int)($config['port'] ?? 3306);
        $dbName = $config['database'] ?? $config['dbName'] ?? '';
        $user = $config['username'] ?? $config['user'] ?? 'root';
        $pass = $config['password'] ?? '';
        $charset = 'utf8mb4';

        // 1. Try to connect to MySQL server (without database first if dbName might need creation)
        if (!empty($dbName)) {
            try {
                $rootDsn = "mysql:host={$host};port={$port};charset={$charset}";
                $pdoRoot = new PDO($rootDsn, $user, $pass, [
                    PDO::ATTR_ERRMODE                  => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_TIMEOUT                  => 5,
                    PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true
                ]);
                try {
                    $pdoRoot->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, true);
                } catch (\Throwable $t) {}
                $pdoRoot->exec("CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            } catch (PDOException $e) {
                // If cannot connect to root or create DB, proceed to direct database test
            }
        }

        // 2. Direct connection test to the target database
        try {
            $dsn = "mysql:host={$host};port={$port};dbname={$dbName};charset={$charset}";
            $pdo = new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE                  => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_TIMEOUT                  => 5,
                PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true
            ]);
            try {
                $pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, true);
            } catch (\Throwable $t) {}
            $stmt = $pdo->query('SELECT 1');
            if ($stmt) {
                $stmt->fetchAll();
                $stmt->closeCursor();
            }
            return [
                'success' => true,
                'message' => "تم الاتصال بقاعدة بيانات MySQL بنجاح ({$host}:{$port} -> {$dbName})."
            ];
        } catch (PDOException $e) {
            $msg = $e->getMessage();
            if (strpos($msg, '1045') !== false || stripos($msg, 'access denied') !== false) {
                $usingPass = empty($pass) ? 'بدون كلمة مرور' : 'باستخدام كلمة مرور';
                return [
                    'success' => false,
                    'error'   => "تم رفض وصول المستخدم '{$user}' على الخادم '{$host}' ({$usingPass}). يرجى التحقق من صحة اسم المستخدم وكلمة المرور الخاصة بقاعدة البيانات في لوحة تحكم الاستضافة (cPanel)، والتأكد من إضافة المستخدم إلى قاعدة البيانات ومنحه كافة الصلاحيات (ALL PRIVILEGES)."
                ];
            }
            if (strpos($msg, '1049') !== false || stripos($msg, 'unknown database') !== false) {
                return [
                    'success' => false,
                    'error'   => "قاعدة البيانات '{$dbName}' غير موجودة على الخادم '{$host}'. يرجى إنشاء قاعدة البيانات في لوحة الاستضافة (cPanel) ثم إعادة المحاولة."
                ];
            }
            if (strpos($msg, '2002') !== false || stripos($msg, 'connection refused') !== false || stripos($msg, 'no such host') !== false) {
                return [
                    'success' => false,
                    'error'   => "تعذر الوصول إلى خادم MySQL على '{$host}:{$port}'. تأكد من عنوان الخادم (عادة ما يكون localhost أو 127.0.0.1 على معظم الاستضافات المشتركة)."
                ];
            }
            return [
                'success' => false,
                'error'   => 'فشل الاتصال بقاعدة بيانات MySQL: ' . $msg
            ];
        }
    }

    public static function getLastError(): ?string
    {
        return self::$lastError;
    }

    public static function query(string $sql, array $params = []): array
    {
        $pdo = self::connect();
        if (!$pdo) {
            throw new \RuntimeException('قاعدة البيانات غير متصلة: ' . (self::$lastError ?: 'يرجى مراجعة إعدادات الاتصال بمخدم MySQL'));
        }

        try {
            $pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, true);
        } catch (\Throwable $t) {}

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $stmt->closeCursor();
        return $rows;
    }

    public static function queryAll(string $sql, array $params = []): array
    {
        return self::query($sql, $params);
    }

    public static function queryOne(string $sql, array $params = []): ?array
    {
        $rows = self::query($sql, $params);
        return $rows[0] ?? null;
    }

    private static bool $tablesEnsured = false;

    public static function ensureEssentialTablesExist(bool $force = false): void
    {
        if (self::$tablesEnsured && !$force) {
            return;
        }
        self::$tablesEnsured = true;

        $lockDir = dirname(__DIR__) . '/storage/framework';
        if (!is_dir($lockDir)) {
            @mkdir($lockDir, 0777, true);
        }
        $lockFile = $lockDir . '/tables_ensured.lock';
        if (!$force && file_exists($lockFile)) {
            if ((time() - @filemtime($lockFile)) < 86400) {
                return;
            }
        }

        $pdo = self::connect();
        if (!$pdo) {
            return;
        }

        try {
            // 1. Ensure system_settings table exists
            $pdo->exec("CREATE TABLE IF NOT EXISTS system_settings (
                setting_key VARCHAR(128) PRIMARY KEY,
                setting_value LONGTEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

            // 2. Ensure delegates table exists
            $pdo->exec("CREATE TABLE IF NOT EXISTS delegates (
                id VARCHAR(64) PRIMARY KEY,
                tenant_id VARCHAR(64) DEFAULT 'org-default',
                name VARCHAR(128) NOT NULL DEFAULT '',
                username VARCHAR(128) NOT NULL,
                password_hash VARCHAR(255) NULL,
                phone VARCHAR(64) NULL,
                email VARCHAR(128) NULL,
                specialty VARCHAR(128) DEFAULT 'مبيعات',
                is_active TINYINT(1) DEFAULT 1,
                target INT DEFAULT 0,
                notes TEXT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_delegate_name (username),
                INDEX idx_delegate_phone (phone)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

            // Self-heal delegates table columns if created by an older migration
            $colStmt = $pdo->query("SHOW COLUMNS FROM delegates");
            $existingCols = [];
            if ($colStmt) {
                $rawCols = $colStmt->fetchAll(PDO::FETCH_ASSOC);
                $colStmt->closeCursor();
                foreach ($rawCols as $c) {
                    $existingCols[strtolower($c['Field'])] = true;
                }
            }

            if (!isset($existingCols['name'])) {
                try { $pdo->exec("ALTER TABLE delegates ADD COLUMN name VARCHAR(128) NOT NULL DEFAULT '' AFTER tenant_id"); } catch (\Throwable $e) {}
            }
            if (!isset($existingCols['password_hash'])) {
                try { $pdo->exec("ALTER TABLE delegates ADD COLUMN password_hash VARCHAR(255) NULL AFTER username"); } catch (\Throwable $e) {}
            }
            if (!isset($existingCols['updated_at'])) {
                try { $pdo->exec("ALTER TABLE delegates ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"); } catch (\Throwable $e) {}
            }
            if (!isset($existingCols['notes'])) {
                try { $pdo->exec("ALTER TABLE delegates ADD COLUMN notes TEXT NULL"); } catch (\Throwable $e) {}
            }
            if (!isset($existingCols['specialty'])) {
                try { $pdo->exec("ALTER TABLE delegates ADD COLUMN specialty VARCHAR(128) DEFAULT 'مبيعات'"); } catch (\Throwable $e) {}
            }
            if (!isset($existingCols['target'])) {
                try { $pdo->exec("ALTER TABLE delegates ADD COLUMN target INT DEFAULT 0"); } catch (\Throwable $e) {}
            }
            if (!isset($existingCols['is_active'])) {
                try { $pdo->exec("ALTER TABLE delegates ADD COLUMN is_active TINYINT(1) DEFAULT 1"); } catch (\Throwable $e) {}
            }

            // 3. Ensure audit_logs table exists
            $pdo->exec("CREATE TABLE IF NOT EXISTS audit_logs (
                id VARCHAR(64) PRIMARY KEY,
                tenant_id VARCHAR(64) DEFAULT 'org-default',
                user VARCHAR(128) NOT NULL,
                action VARCHAR(255) NOT NULL,
                target_id VARCHAR(64) NULL,
                target_type VARCHAR(64) NULL,
                details TEXT NULL,
                ip_address VARCHAR(64) NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

            // 4. Ensure car sub-tables exist
            $pdo->exec("CREATE TABLE IF NOT EXISTS car_custom_fields (
                id INT AUTO_INCREMENT PRIMARY KEY,
                car_id VARCHAR(64) NOT NULL,
                field_key VARCHAR(128) NOT NULL,
                field_value TEXT NULL,
                INDEX idx_car_field (car_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

            $pdo->exec("CREATE TABLE IF NOT EXISTS car_exit_data (
                car_id VARCHAR(64) PRIMARY KEY,
                receiver_name VARCHAR(128) NULL,
                receiver_phone VARCHAR(64) NULL,
                receiver_id VARCHAR(64) NULL,
                delivery_type VARCHAR(64) DEFAULT 'فوري',
                exit_date DATE NULL,
                seller VARCHAR(128) NULL,
                representative_name VARCHAR(128) NULL,
                notes TEXT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_car_exit (car_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

            // Self-heal car_exit_data table columns if created by an older migration
            // (fixes: SQLSTATE[42S22] Unknown column 'transport_company' / 'sale_type' / etc.
            // when saving car exit/sale details on databases created before these columns existed)
            $exitColStmt = $pdo->query("SHOW COLUMNS FROM car_exit_data");
            $existingExitCols = [];
            if ($exitColStmt) {
                $rawExitCols = $exitColStmt->fetchAll(PDO::FETCH_ASSOC);
                $exitColStmt->closeCursor();
                foreach ($rawExitCols as $c) {
                    $existingExitCols[strtolower($c['Field'])] = true;
                }
            }
            if (!isset($existingExitCols['nationality'])) {
                try { $pdo->exec("ALTER TABLE car_exit_data ADD COLUMN nationality VARCHAR(64) NULL"); } catch (\Throwable $e) {}
            }
            if (!isset($existingExitCols['transport_company'])) {
                try { $pdo->exec("ALTER TABLE car_exit_data ADD COLUMN transport_company VARCHAR(128) NULL"); } catch (\Throwable $e) {}
            }
            if (!isset($existingExitCols['sale_type'])) {
                try { $pdo->exec("ALTER TABLE car_exit_data ADD COLUMN sale_type VARCHAR(64) NULL"); } catch (\Throwable $e) {}
            }
            if (!isset($existingExitCols['bank_name'])) {
                try { $pdo->exec("ALTER TABLE car_exit_data ADD COLUMN bank_name VARCHAR(128) NULL"); } catch (\Throwable $e) {}
            }
            if (!isset($existingExitCols['car_condition'])) {
                try { $pdo->exec("ALTER TABLE car_exit_data ADD COLUMN car_condition TEXT NULL"); } catch (\Throwable $e) {}
            }

            $pdo->exec("CREATE TABLE IF NOT EXISTS car_history (
                id VARCHAR(64) PRIMARY KEY,
                car_id VARCHAR(64) NOT NULL,
                action VARCHAR(255) NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                user VARCHAR(128) DEFAULT 'نظام',
                INDEX idx_car_history (car_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

            @file_put_contents($lockFile, (string)time());
        } catch (\Throwable $e) {
            // Ignore background self-heal errors to allow main execution
        }
    }

    public static function execute(string $sql, array $params = []): int
    {
        $pdo = self::connect();
        if (!$pdo) {
            throw new \RuntimeException('قاعدة البيانات غير متصلة: ' . (self::$lastError ?: 'يرجى مراجعة إعدادات الاتصال بمخدم MySQL'));
        }

        try {
            $pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, true);
        } catch (\Throwable $t) {}

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $count = $stmt->rowCount();
        $stmt->closeCursor();
        return $count;
    }

    public static function transaction(callable $callback)
    {
        $pdo = self::connect();
        if (!$pdo) {
            throw new \RuntimeException('قاعدة البيانات غير متصلة: ' . (self::$lastError ?: 'يرجى مراجعة إعدادات الاتصال بمخدم MySQL'));
        }

        if (!$pdo->inTransaction()) {
            $pdo->beginTransaction();
        }
        try {
            $result = $callback($pdo);
            if ($pdo->inTransaction()) {
                $pdo->commit();
            }
            return $result;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }
}
