<?php
/**
 * POST /api/install/test-db or /api/install/database-test
 * Tests connection to MySQL with provided credentials
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

use Almakhzoun\Database\Database;

$body = getJsonBody();
$host = $body['dbConfig']['host'] ?? $body['host'] ?? $body['dbHost'] ?? 'localhost';
$port = (int)($body['dbConfig']['port'] ?? $body['port'] ?? $body['dbPort'] ?? 3306);
$database = $body['dbConfig']['database'] ?? $body['dbConfig']['dbName'] ?? $body['database'] ?? $body['dbName'] ?? '';
$username = $body['dbConfig']['user'] ?? $body['dbConfig']['username'] ?? $body['username'] ?? $body['dbUser'] ?? $body['user'] ?? 'root';
$password = $body['dbConfig']['password'] ?? $body['password'] ?? $body['dbPassword'] ?? '';

if (empty($host) || empty($database) || empty($username)) {
    jsonError('يرجى تزويد خادم قاعدة البيانات، واسم القاعدة، واسم المستخدم.', 400);
}

$testResult = Database::testConnection([
    'host'     => $host,
    'port'     => $port,
    'database' => $database,
    'username' => $username,
    'password' => $password
]);

if ($testResult['success']) {
    jsonSuccess($testResult['message'], [
        'databaseConnected' => true,
        'details' => [
            'host'     => $host,
            'port'     => $port,
            'database' => $database,
            'user'     => $username
        ]
    ]);
} else {
    jsonError($testResult['error'] ?? 'فشل الاتصال بقاعدة البيانات', 400);
}
