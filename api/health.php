<?php
/**
 * GET /api/health
 * Health check endpoint returning API, PHP, MySQL, and Storage status
 */

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

use Almakhzoun\Config\Paths;
use Almakhzoun\Database\Database;

$mysqlOk = false;
$tablesCount = 0;
$mysqlError = null;

try {
    $pdo = Database::connect();
    if ($pdo) {
        $stmt = $pdo->query('SHOW TABLES');
        $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
        $tablesCount = count($tables);
        $mysqlOk = true;
    } else {
        $mysqlError = Database::getLastError();
    }
} catch (\Throwable $e) {
    $mysqlError = $e->getMessage();
}

$storageOk = is_writable(Paths::storage()) || is_dir(Paths::storage());

jsonResponse([
    'status'    => $mysqlOk ? 'healthy' : 'degraded',
    'api'       => 'OK',
    'php'       => [
        'version' => PHP_VERSION,
        'status'  => 'OK'
    ],
    'mysql'     => [
        'connected'   => $mysqlOk,
        'tablesCount' => $tablesCount,
        'error'       => $mysqlError
    ],
    'storage'   => [
        'writable' => $storageOk,
        'path'     => Paths::storage()
    ],
    'timestamp' => date('c')
]);
