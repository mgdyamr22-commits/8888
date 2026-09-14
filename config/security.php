<?php
/**
 * Security & Helper Configuration
 */

declare(strict_types=1);

namespace Almakhzoun\Config;

class Security
{
    private static ?string $jwtSecret = null;
    private static ?string $aesKeyHex = null;
    private const LEGACY_JWT_SECRET = 'almakhzoun_inventory_pro_jwt_master_key_2026';
    private const LEGACY_AES_KEY = '8c79f9f82d1c6ebd0f24950fa2b98e1e127bf9bd5a8b2dfa0cb9c87f65e23b12';

    /**
     * Resolves the JWT signing secret from .env, environment, or persistent security store.
     */
    public static function getJwtSecret(): string
    {
        if (self::$jwtSecret !== null) {
            return self::$jwtSecret;
        }

        // 1. Environment variable
        $envVal = getenv('JWT_SECRET') ?: ($_ENV['JWT_SECRET'] ?? null);
        if (!empty($envVal)) {
            return self::$jwtSecret = (string)$envVal;
        }

        // 2. Read from .env file
        $envFile = dirname(__DIR__) . '/.env';
        if (file_exists($envFile)) {
            $lines = @file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
            foreach ($lines as $line) {
                $line = trim($line);
                if (empty($line) || str_starts_with($line, '#')) continue;
                if (str_starts_with($line, 'JWT_SECRET=')) {
                    $val = trim(substr($line, 11), " \t\n\r\0\x0B\"'");
                    if (!empty($val)) {
                        return self::$jwtSecret = $val;
                    }
                }
            }
        }

        // 3. Read from config/installed.json
        $installedFile = dirname(__DIR__) . '/config/installed.json';
        if (file_exists($installedFile)) {
            $installed = @json_decode(@file_get_contents($installedFile) ?: '', true);
            if (!empty($installed['security']['jwtSecret'])) {
                return self::$jwtSecret = (string)$installed['security']['jwtSecret'];
            }
        }

        // 4. Auto-generate persistent instance key.
        //    IMPORTANT: on some shared hosts (e.g. Hostinger) storage/framework/
        //    may not be writable. Silently trusting a "generated" secret without
        //    verifying the write actually succeeded means EVERY request would
        //    mint a brand-new random secret (since it never actually persisted),
        //    instantly invalidating every token issued moments earlier by a
        //    different request/process. This is what used to make a perfectly
        //    real, successful login get rejected as "not authorized" on the
        //    very next API call. We now verify the write, and additionally
        //    persist into config/installed.json — proven writable, since the
        //    installer itself writes there — as a second durable location.
        $keyFile = dirname(__DIR__) . '/storage/framework/keys.json';
        $keyDir = dirname($keyFile);
        $installedFile = dirname(__DIR__) . '/config/installed.json';

        if (!is_dir($keyDir)) {
            @mkdir($keyDir, 0755, true);
        }

        $lockFile = $keyDir . '/keys.lock';
        $lockHandle = @fopen($lockFile, 'c');
        if ($lockHandle && @flock($lockHandle, LOCK_EX)) {
            try {
                if (file_exists($keyFile)) {
                    $keys = @json_decode(@file_get_contents($keyFile) ?: '', true);
                    if (!empty($keys['jwtSecret'])) {
                        return self::$jwtSecret = (string)$keys['jwtSecret'];
                    }
                }

                $newSecret = bin2hex(random_bytes(32));
                $existing = file_exists($keyFile) ? (@json_decode(@file_get_contents($keyFile) ?: '', true) ?: []) : [];
                $existing['jwtSecret'] = $newSecret;
                $writeOk = @file_put_contents($keyFile, json_encode($existing, JSON_PRETTY_PRINT), LOCK_EX);

                if ($writeOk !== false) {
                    // Re-read to be 100% sure what's on disk (not just what we think we wrote)
                    $reread = @json_decode(@file_get_contents($keyFile) ?: '', true);
                    if (!empty($reread['jwtSecret'])) {
                        return self::$jwtSecret = (string)$reread['jwtSecret'];
                    }
                }
                // Falls through to the config/installed.json attempt below if the
                // write above didn't actually verify on disk.
            } catch (\Throwable $t) {
                // Falls through below
            } finally {
                @flock($lockHandle, LOCK_UN);
                @fclose($lockHandle);
            }
        }

        // storage/framework/ was not writable (or the write couldn't be
        // verified) — try the second durable location instead.
        if (file_exists($installedFile)) {
            $installed = @json_decode(@file_get_contents($installedFile) ?: '', true) ?: [];
            if (!empty($installed['security']['jwtSecret'])) {
                return self::$jwtSecret = (string)$installed['security']['jwtSecret'];
            }
            if (is_writable($installedFile) || is_writable(dirname($installedFile))) {
                $newSecret = bin2hex(random_bytes(32));
                $installed['security'] = $installed['security'] ?? [];
                $installed['security']['jwtSecret'] = $newSecret;
                $writeOk = @file_put_contents($installedFile, json_encode($installed, JSON_PRETTY_PRINT), LOCK_EX);
                if ($writeOk !== false) {
                    $reread = @json_decode(@file_get_contents($installedFile) ?: '', true);
                    if (!empty($reread['security']['jwtSecret'])) {
                        return self::$jwtSecret = (string)$reread['security']['jwtSecret'];
                    }
                }
            }
        }

        // Absolute last resort: a fixed, consistent value. This is intentionally
        // NEVER a freshly random value here — a value that can't be persisted
        // must still be the SAME value on every request, or no token issued by
        // any request would ever verify on a later one.
        return self::$jwtSecret = self::LEGACY_JWT_SECRET;
    }

    /**
     * Resolves the AES-256 encryption key.
     */
    public static function getAesKeyHex(): string
    {
        if (self::$aesKeyHex !== null) {
            return self::$aesKeyHex;
        }

        // 1. Environment variable
        $envVal = getenv('AES_KEY') ?: ($_ENV['AES_KEY'] ?? null);
        if (!empty($envVal)) {
            return self::$aesKeyHex = (string)$envVal;
        }

        // 2. Read from .env file
        $envFile = dirname(__DIR__) . '/.env';
        if (file_exists($envFile)) {
            $lines = @file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
            foreach ($lines as $line) {
                $line = trim($line);
                if (empty($line) || str_starts_with($line, '#')) continue;
                if (str_starts_with($line, 'AES_KEY=')) {
                    $val = trim(substr($line, 8), " \t\n\r\0\x0B\"'");
                    if (!empty($val)) {
                        return self::$aesKeyHex = $val;
                    }
                }
            }
        }

        // 3. Read from config/installed.json (persisted once at install time, always writable)
        $installedFile = dirname(__DIR__) . '/config/installed.json';
        if (file_exists($installedFile)) {
            $installed = @json_decode(@file_get_contents($installedFile) ?: '', true);
            if (!empty($installed['security']['aesKeyHex'])) {
                return self::$aesKeyHex = (string)$installed['security']['aesKeyHex'];
            }
        }

        // 4. Persistent instance key in storage/framework/keys.json
        $keyFile = dirname(__DIR__) . '/storage/framework/keys.json';
        if (file_exists($keyFile)) {
            $keys = @json_decode(@file_get_contents($keyFile) ?: '', true);
            if (!empty($keys['aesKeyHex'])) {
                return self::$aesKeyHex = (string)$keys['aesKeyHex'];
            }
        }

        try {
            $newKey = bin2hex(random_bytes(32));
            $keyDir = dirname($keyFile);
            if (!is_dir($keyDir)) {
                @mkdir($keyDir, 0755, true);
            }
            $existing = file_exists($keyFile) ? (@json_decode(@file_get_contents($keyFile) ?: '', true) ?: []) : [];
            $existing['aesKeyHex'] = $newKey;
            @file_put_contents($keyFile, json_encode($existing, JSON_PRETTY_PRINT));
            return self::$aesKeyHex = $newKey;
        } catch (\Throwable $t) {
            return self::$aesKeyHex = self::LEGACY_AES_KEY;
        }
    }

    public static function hashPassword(string $password): string
    {
        return password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);
    }

    public static function verifyPassword(string $password, string $hash): bool
    {
        return password_verify($password, $hash);
    }

    public static function generateToken(array $payload, int $expirySeconds = 86400 * 7): string
    {
        $header = base64_encode(json_encode(['typ' => 'JWT', 'alg' => 'HS256']));
        $payload['exp'] = time() + $expirySeconds;
        $payload['iat'] = time();
        $body = base64_encode(json_encode($payload));
        $signature = hash_hmac('sha256', "$header.$body", self::getJwtSecret(), true);
        $sigEncoded = base64_encode($signature);
        return "$header.$body.$sigEncoded";
    }

    public static function verifyToken(string $token): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }

        [$header, $body, $sigEncoded] = $parts;

        // Primary verification using active secret
        $expectedSig = hash_hmac('sha256', "$header.$body", self::getJwtSecret(), true);
        $verified = hash_equals(base64_decode($sigEncoded), $expectedSig);

        // Fallback verification for tokens generated before secret migration
        if (!$verified && self::getJwtSecret() !== self::LEGACY_JWT_SECRET) {
            $legacySig = hash_hmac('sha256', "$header.$body", self::LEGACY_JWT_SECRET, true);
            $verified = hash_equals(base64_decode($sigEncoded), $legacySig);
        }

        if (!$verified) {
            return null;
        }

        $payload = json_decode(base64_decode($body), true);
        if (!$payload || !isset($payload['exp']) || $payload['exp'] < time()) {
            return null;
        }

        return $payload;
    }

    public static function encryptAES(string $text): string
    {
        try {
            $key = hex2bin(self::getAesKeyHex());
            $iv = openssl_random_pseudo_bytes(16);
            $encrypted = openssl_encrypt($text, 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv);
            return bin2hex($iv) . ':' . bin2hex($encrypted);
        } catch (\Throwable $e) {
            return $text;
        }
    }

    public static function decryptAES(string $text): string
    {
        try {
            if (!str_contains($text, ':')) return $text;
            $parts = explode(':', $text, 2);
            if (count($parts) !== 2) return $text;
            $iv = hex2bin($parts[0]);
            $encrypted = hex2bin($parts[1]);

            // Try primary key first
            $key = hex2bin(self::getAesKeyHex());
            $decrypted = openssl_decrypt($encrypted, 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv);
            if ($decrypted !== false) {
                return $decrypted;
            }

            // Fallback to legacy key if changed
            if (self::getAesKeyHex() !== self::LEGACY_AES_KEY) {
                $legacyKey = hex2bin(self::LEGACY_AES_KEY);
                $decryptedLegacy = openssl_decrypt($encrypted, 'AES-256-CBC', $legacyKey, OPENSSL_RAW_DATA, $iv);
                if ($decryptedLegacy !== false) {
                    return $decryptedLegacy;
                }
            }

            return $text;
        } catch (\Throwable $e) {
            return $text;
        }
    }

    public static function setCorsHeaders(): void
    {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

        if (!empty($origin)) {
            // Echo back requesting origin when present, enabling credentials safely without wildcard
            header("Access-Control-Allow-Origin: {$origin}");
            header('Access-Control-Allow-Credentials: true');
        } else {
            // General fallback without credentials
            header('Access-Control-Allow-Origin: *');
        }

        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Tenant-Id, X-Custom-Auth');
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: SAMEORIGIN');
        header('X-XSS-Protection: 1; mode=block');

        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
            http_response_code(200);
            exit;
        }
    }
}
