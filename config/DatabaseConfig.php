<?php
/**
 * Database Configuration for Almakhzoun Inventory Pro
 * Reads credentials from environment variables, .env file, or installed.json config
 */

declare(strict_types=1);

namespace Almakhzoun\Config;

class DatabaseConfig
{
    private static ?array $config = null;

    public static function get(): array
    {
        if (self::$config !== null) {
            return self::$config;
        }

        // 1. Check for installed config file (config/installed.json)
        $configFile = dirname(__DIR__) . '/config/installed.json';
        if (file_exists($configFile)) {
            $json = @file_get_contents($configFile);
            if ($json) {
                $data = @json_decode($json, true);
                if (!empty($data['db']) && !empty($data['db']['host']) && !empty($data['db']['database'])) {
                    self::$config = [
                        'host'     => $data['db']['host'] ?? 'localhost',
                        'port'     => (int)($data['db']['port'] ?? 3306),
                        'database' => $data['db']['database'] ?? 'almakhzoun_cloud',
                        'username' => $data['db']['user'] ?? $data['db']['username'] ?? 'root',
                        'password' => $data['db']['password'] ?? '',
                        'charset'  => 'utf8mb4'
                    ];
                    return self::$config;
                }
            }
        }

        // 2. Read from parsed .env file if present
        $envFile = dirname(__DIR__) . '/.env';
        $envVars = [];
        if (file_exists($envFile)) {
            $lines = @file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
            foreach ($lines as $line) {
                $line = trim($line);
                if (empty($line) || str_starts_with($line, '#')) {
                    continue;
                }
                if (strpos($line, '=') !== false) {
                    [$k, $v] = explode('=', $line, 2);
                    $k = trim($k);
                    $v = trim($v, " \t\n\r\0\x0B\"'");
                    $envVars[$k] = $v;
                }
            }
        }

        // 3. Read from Environment Variables or .env
        $host = getenv('DB_HOST') ?: ($envVars['DB_HOST'] ?? ($envVars['DATABASE_HOST'] ?? 'localhost'));
        $port = (int)(getenv('DB_PORT') ?: ($envVars['DB_PORT'] ?? ($envVars['DATABASE_PORT'] ?? 3306)));
        $database = getenv('DB_DATABASE') ?: ($envVars['DB_DATABASE'] ?? ($envVars['DATABASE_NAME'] ?? 'almakhzoun_cloud'));
        $username = getenv('DB_USER') ?: (getenv('DB_USERNAME') ?: ($envVars['DB_USERNAME'] ?? ($envVars['DB_USER'] ?? ($envVars['DATABASE_USER'] ?? 'root'))));
        $password = getenv('DB_PASSWORD') !== false ? getenv('DB_PASSWORD') : ($envVars['DB_PASSWORD'] ?? ($envVars['DATABASE_PASSWORD'] ?? ''));

        self::$config = [
            'host'     => $host,
            'port'     => $port,
            'database' => $database,
            'username' => $username,
            'password' => $password,
            'charset'  => 'utf8mb4'
        ];

        return self::$config;
    }

    public static function saveInstalledConfig(array $dbConfig, array $adminInfo = [], array $orgInfo = []): bool
    {
        $configDir = dirname(__DIR__) . '/config';
        if (!is_dir($configDir)) {
            @mkdir($configDir, 0755, true);
        }

        $configFile = $configDir . '/installed.json';
        $host = $dbConfig['host'] ?? 'localhost';
        $port = (int)($dbConfig['port'] ?? 3306);
        $database = $dbConfig['database'] ?? 'almakhzoun_cloud';
        $username = $dbConfig['user'] ?? $dbConfig['username'] ?? 'root';
        $password = $dbConfig['password'] ?? '';

        // Generate the JWT/AES security keys ONCE at install time and persist them permanently
        // into installed.json (a file we already know is writable, since the whole install
        // depends on it). Without this, the keys were only ever cached in storage/framework/keys.json,
        // a directory that is never created during install; if it can't be lazily created/written
        // on the hosting server, a brand-new random secret was generated on every request, silently
        // invalidating every login token the moment the next request came in ("fake login").
        $existingSecurity = [];
        if (file_exists($configFile)) {
            $existingRaw = @json_decode(@file_get_contents($configFile) ?: '', true);
            if (!empty($existingRaw['security'])) {
                $existingSecurity = $existingRaw['security'];
            }
        }
        $jwtSecret = $existingSecurity['jwtSecret'] ?? bin2hex(random_bytes(32));
        $aesKeyHex = $existingSecurity['aesKeyHex'] ?? bin2hex(random_bytes(32));

        $data = [
            'installed'     => true,
            'installed_at'  => date('c'),
            'system_version'=> '3.6.0',
            'security' => [
                'jwtSecret' => $jwtSecret,
                'aesKeyHex' => $aesKeyHex
            ],
            'db' => [
                'host'     => $host,
                'port'     => $port,
                'database' => $database,
                'username' => $username,
                'password' => $password
            ],
            'admin' => [
                'username' => $adminInfo['username'] ?? 'admin',
                'email'    => $adminInfo['email'] ?? 'admin@almakhzoun.com'
            ],
            'org' => [
                'name'               => $orgInfo['name'] ?? 'مؤسسة المخزون لتجارة السيارات',
                'phone'              => $orgInfo['phone'] ?? $orgInfo['contactNumber'] ?? '',
                'taxNumber'          => $orgInfo['taxNumber'] ?? '',
                'commercialRegister' => $orgInfo['commercialRegister'] ?? $orgInfo['commercial_register'] ?? $orgInfo['orgCR'] ?? '',
                'address'            => $orgInfo['address'] ?? '',
                'logo'               => $orgInfo['logo'] ?? '',
                'stamp'              => $orgInfo['stamp'] ?? ''
            ]
        ];

        @file_put_contents($configFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        @file_put_contents(dirname(__DIR__) . '/.installed', date('c'));
        @file_put_contents(dirname(__DIR__) . '/install.lock', date('c'));

        // Update or create .env file
        $envFile = dirname(__DIR__) . '/.env';
        $envContent = file_exists($envFile) ? @file_get_contents($envFile) : '';
        
        $replacements = [
            'DB_HOST'     => $host,
            'DB_PORT'     => (string)$port,
            'DB_DATABASE' => $database,
            'DB_USERNAME' => $username,
            'DB_USER'     => $username,
            'DB_PASSWORD' => $password
        ];

        foreach ($replacements as $key => $val) {
            if (preg_match("/^{$key}=.*/m", $envContent)) {
                $envContent = preg_replace("/^{$key}=.*/m", "{$key}={$val}", $envContent);
            } else {
                $envContent .= "\n{$key}={$val}";
            }
        }
        @file_put_contents($envFile, trim($envContent) . "\n");

        self::$config = null; // Clear cached config
        return true;
    }

    public static function isInstalled(): bool
    {
        $root = dirname(__DIR__);
        $configFile = $root . '/config/installed.json';
        $lockFile = $root . '/.installed';
        $altLock = $root . '/install.lock';
        return file_exists($configFile) || file_exists($lockFile) || file_exists($altLock);
    }

    public static function getOrgConfig(): array
    {
        $configFile = dirname(__DIR__) . '/config/installed.json';
        if (file_exists($configFile)) {
            $json = @file_get_contents($configFile);
            if ($json) {
                $data = @json_decode($json, true);
                if (!empty($data['org']) && is_array($data['org'])) {
                    return $data['org'];
                }
            }
        }
        return [];
    }
}
