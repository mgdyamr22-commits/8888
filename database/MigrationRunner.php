<?php
/**
 * Automated Idempotent Migration Runner
 */

declare(strict_types=1);

namespace Almakhzoun\Database;

use PDO;
use PDOException;

class MigrationRunner
{
    /**
     * Safely ensures the cars table has the required interior_color column.
     * 1- Checks if column 'interior_color' exists in table 'cars'.
     * 2- If not present, creates column: interior_color VARCHAR(100) NULL.
     * 3- If present, does nothing (skips execution without altering).
     * 4- Does not drop, delete, or recreate table, keeping all data and keys safe.
     */
    public static function ensureCarsColumns(PDO $pdo): void
    {
        try {
            // Explicitly enable buffered queries to avoid SQLSTATE[HY000]: 2014
            try {
                $pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, true);
            } catch (\Throwable $t) {}

            // 1. Check if cars table exists
            $tableStmt = $pdo->query("SHOW TABLES LIKE 'cars'");
            $tables = $tableStmt ? $tableStmt->fetchAll(PDO::FETCH_COLUMN) : [];
            if ($tableStmt) {
                $tableStmt->closeCursor();
            }

            if (empty($tables)) {
                return;
            }

            // 2. Check if column interior_color exists inside cars table
            $colStmt = $pdo->query("SHOW COLUMNS FROM `cars` LIKE 'interior_color'");
            $columns = $colStmt ? $colStmt->fetchAll(PDO::FETCH_COLUMN) : [];
            if ($colStmt) {
                $colStmt->closeCursor();
            }

            // 3. If not exists, add column safely
            if (empty($columns)) {
                $pdo->exec("ALTER TABLE `cars` ADD COLUMN `interior_color` VARCHAR(100) NULL");
            }
            // 4. If exists, do nothing on it
        } catch (\Throwable $e) {
            error_log('[MigrationRunner] ensureCarsColumns notice: ' . $e->getMessage());
        }
    }

    /**
     * Safely ensures the car_exit_data table has every column that the API
     * (api/cars/detail.php, api/cars/exit.php, api/cars/index.php) actually writes to.
     * The inline bootstrap CREATE TABLE in Database.php is an older/shorter definition,
     * so databases created before columns like transport_company/sale_type/nationality/
     * bank_name/car_condition were introduced are missing them (CREATE TABLE IF NOT EXISTS
     * does not add columns to an already-existing table). This heals that drift safely:
     * it only ever ADDs a missing column, never drops or alters existing data.
     */
    public static function ensureCarExitDataColumns(PDO $pdo): void
    {
        try {
            try {
                $pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, true);
            } catch (\Throwable $t) {}

            $tableStmt = $pdo->query("SHOW TABLES LIKE 'car_exit_data'");
            $tables = $tableStmt ? $tableStmt->fetchAll(PDO::FETCH_COLUMN) : [];
            if ($tableStmt) {
                $tableStmt->closeCursor();
            }
            if (empty($tables)) {
                return;
            }

            $requiredColumns = [
                'nationality'        => "VARCHAR(64) NULL",
                'transport_company'  => "VARCHAR(128) NULL",
                'sale_type'          => "VARCHAR(64) NULL",
                'bank_name'          => "VARCHAR(128) NULL",
                'car_condition'      => "TEXT NULL",
            ];

            foreach ($requiredColumns as $columnName => $definition) {
                $colStmt = $pdo->query("SHOW COLUMNS FROM `car_exit_data` LIKE '{$columnName}'");
                $existing = $colStmt ? $colStmt->fetchAll(PDO::FETCH_COLUMN) : [];
                if ($colStmt) {
                    $colStmt->closeCursor();
                }
                if (empty($existing)) {
                    $pdo->exec("ALTER TABLE `car_exit_data` ADD COLUMN `{$columnName}` {$definition}");
                }
            }
        } catch (\Throwable $e) {
            error_log('[MigrationRunner] ensureCarExitDataColumns notice: ' . $e->getMessage());
        }
    }

    public static function runAll(?PDO $pdo = null): array
    {
        $pdo = $pdo ?? Database::connect();
        if (!$pdo) {
            throw new \RuntimeException('Database is not connected');
        }

        // Explicitly enable buffered queries to avoid SQLSTATE[HY000]: 2014
        try {
            $pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, true);
        } catch (\Throwable $t) {}

        // Safe pre-check: ensure cars table has interior_color if cars already exists
        self::ensureCarsColumns($pdo);
        self::ensureCarExitDataColumns($pdo);

        // 1. Ensure migration_history table exists
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS migration_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                migration_id VARCHAR(128) NOT NULL UNIQUE,
                migration_name VARCHAR(255) NOT NULL,
                batch INT NOT NULL,
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        ");

        // 2. Fetch applied migrations
        $stmt = $pdo->query('SELECT migration_id FROM migration_history');
        $appliedRows = $stmt ? $stmt->fetchAll(PDO::FETCH_COLUMN) : [];
        if ($stmt) {
            $stmt->closeCursor();
        }
        $appliedMap = array_flip($appliedRows);

        // 3. Determine next batch number
        $batchStmt = $pdo->query('SELECT MAX(batch) as maxBatch FROM migration_history');
        $batchRows = $batchStmt ? $batchStmt->fetchAll(PDO::FETCH_ASSOC) : [];
        if ($batchStmt) {
            $batchStmt->closeCursor();
        }
        $maxBatch = (int)($batchRows[0]['maxBatch'] ?? 0);
        $nextBatch = $maxBatch + 1;

        $migrationsDir = __DIR__ . '/migrations';
        $files = glob($migrationsDir . '/*.sql');
        sort($files);

        $applied = [];
        $skipped = [];

        foreach ($files as $filePath) {
            $fileName = basename($filePath, '.sql');

            if (isset($appliedMap[$fileName])) {
                $skipped[] = $fileName;
                continue;
            }

            $sqlContent = file_get_contents($filePath);
            if (!$sqlContent) {
                continue;
            }

            // Split statements by semicolon
            $statements = array_filter(
                array_map('trim', explode(';', $sqlContent)),
                fn($s) => strlen($s) > 0
            );

            foreach ($statements as $stmtSql) {
                // If statement attempts to alter/modify interior_color, enforce condition 3:
                // If column exists, do not execute any command on it.
                if (stripos($stmtSql, 'interior_color') !== false && stripos($stmtSql, 'MODIFY') !== false) {
                    self::ensureCarsColumns($pdo);
        self::ensureCarExitDataColumns($pdo);
                    continue;
                }

                try {
                    $stmtObj = $pdo->query($stmtSql);
                    if ($stmtObj instanceof \PDOStatement) {
                        $stmtObj->fetchAll();
                        while ($stmtObj->nextRowset()) {
                            $stmtObj->fetchAll();
                        }
                        $stmtObj->closeCursor();
                    }
                } catch (\PDOException $stmtEx) {
                    // If error is 1054 Unknown column related to interior_color, handle safely
                    if ($stmtEx->getCode() === '42S22' || strpos($stmtEx->getMessage(), '1054') !== false) {
                        if (stripos($stmtSql, 'interior_color') !== false) {
                            self::ensureCarsColumns($pdo);
        self::ensureCarExitDataColumns($pdo);
                            continue;
                        }
                    }
                    throw $stmtEx;
                }
            }

            $insStmt = $pdo->prepare('INSERT INTO migration_history (migration_id, migration_name, batch) VALUES (?, ?, ?)');
            $insStmt->execute([$fileName, str_replace('_', ' ', $fileName), $nextBatch]);
            $insStmt->closeCursor();

            $applied[] = $fileName;

            // Re-verify after table creations
            self::ensureCarsColumns($pdo);
        self::ensureCarExitDataColumns($pdo);
        }

        // Final verification check
        self::ensureCarsColumns($pdo);
        self::ensureCarExitDataColumns($pdo);

        return [
            'success' => true,
            'applied' => $applied,
            'skipped' => $skipped
        ];
    }
}
