<?php
/**
 * POST /api/install/migrate
 * Executes all database migrations and seeds base schema
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

use Almakhzoun\Database\Database;
use Almakhzoun\Database\MigrationRunner;
use Almakhzoun\Config\DatabaseConfig;

// Protect against unauthorized re-migration if already installed
if (DatabaseConfig::isInstalled()) {
    jsonError('النظام مثبت مسبقاً ومحمي ضد إعادة التثبيت. لا يمكن تشغيل التهيئة الهيكلية مرة أخرى.', 403);
}

$body = getJsonBody();

// Optional custom config passed in body
$dbConfig = null;
$host = $body['dbConfig']['host'] ?? $body['host'] ?? null;
$database = $body['dbConfig']['database'] ?? $body['dbConfig']['dbName'] ?? $body['database'] ?? null;
if (!empty($host) && !empty($database)) {
    $dbConfig = [
        'host'     => $host,
        'port'     => (int)($body['dbConfig']['port'] ?? $body['port'] ?? 3306),
        'database' => $database,
        'username' => $body['dbConfig']['user'] ?? $body['dbConfig']['username'] ?? $body['username'] ?? $body['user'] ?? 'root',
        'password' => $body['dbConfig']['password'] ?? $body['password'] ?? '',
        'charset'  => 'utf8mb4'
    ];
}

try {
    $pdo = Database::connect($dbConfig);
    if (!$pdo) {
        jsonError('فشل الاتصال بقاعدة البيانات لتنفيذ التحديثات الهيكلية: ' . Database::getLastError(), 500);
    }

    $migrationResult = MigrationRunner::runAll($pdo);

    jsonSuccess('تم إنشاء الجداول وهيكل قاعدة البيانات بنجاح.', [
        'applied' => $migrationResult['applied'],
        'skipped' => $migrationResult['skipped'],
        'tablesCount' => count($migrationResult['applied']) + count($migrationResult['skipped'])
    ]);
} catch (\Throwable $e) {
    jsonError('حدث خطأ أثناء تنفيذ هيكل قاعدة البيانات: ' . $e->getMessage(), 500);
}
