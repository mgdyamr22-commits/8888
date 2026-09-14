<?php
/**
 * Delegate Authentication Endpoint (Robust, Multi-lookup, Arabic & Phone Normalized)
 */

declare(strict_types=1);

require_once __DIR__ . '/../helpers.php';

use Almakhzoun\Config\Security;
use Almakhzoun\Database\Database;

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('طريقة الطلب غير مدعومة.', 405);
}

$body = getJsonBody();
$rawInput = trim((string)($body['username'] ?? ($body['login'] ?? ($body['phone'] ?? ''))));
$password = trim((string)($body['password'] ?? ''));

if (empty($rawInput) || empty($password)) {
    jsonError('يرجى إدخال اسم المستخدم أو رقم الجوال وكلمة المرور للمندوب.', 400);
}

// Normalizer functions
function normalizeArabicLetters(string $str): string {
    // Remove diacritics / tashkeel
    $str = (string)preg_replace('/[\x{064B}-\x{0652}]/u', '', $str);
    // Unify Alef variations: أ, إ, آ, ٱ -> ا
    $str = (string)preg_replace('/[أإآٱ]/u', 'ا', $str);
    // Unify Taa Marbuta: ة -> ه
    $str = (string)preg_replace('/ة/u', 'ه', $str);
    // Unify Alef Maksura: ى -> ي
    $str = (string)preg_replace('/ى/u', 'ي', $str);
    // Remove extra spaces
    $str = (string)preg_replace('/\s+/u', ' ', $str);
    return trim(mb_strtolower($str, 'UTF-8'));
}

function normalizePhone(string $phone): string {
    $eastern = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
    $ascii   = ['0','1','2','3','4','5','6','7','8','9'];
    $phone = str_replace($eastern, $ascii, $phone);
    $digits = (string)preg_replace('/\D/', '', $phone);
    if (str_starts_with($digits, '00966')) {
        $digits = '0' . substr($digits, 5);
    } elseif (str_starts_with($digits, '966')) {
        $digits = '0' . substr($digits, 3);
    }
    return $digits;
}

try {
    Database::ensureEssentialTablesExist();

    $cleanInput = trim($rawInput);
    $cleanUsername = ltrim($cleanInput, '@');
    $cleanPhone = normalizePhone($cleanInput);
    $last9Phone = strlen($cleanPhone) >= 9 ? substr($cleanPhone, -9) : $cleanPhone;
    $normArabic = normalizeArabicLetters($cleanInput);

    $delegate = null;

    // 1. Direct flexible search in delegates table
    try {
        $delegate = Database::queryOne(
            'SELECT * FROM delegates 
             WHERE LOWER(TRIM(username)) = LOWER(?) 
                OR LOWER(TRIM(username)) = LOWER(?)
                OR LOWER(TRIM(name)) = LOWER(?) 
                OR TRIM(phone) = ? 
                OR TRIM(phone) = ?
                OR phone LIKE ?
                OR LOWER(TRIM(email)) = LOWER(?) 
             ORDER BY updated_at DESC, created_at DESC 
             LIMIT 1',
            [
                $cleanInput,
                $cleanUsername,
                $cleanInput,
                $cleanInput,
                $cleanPhone,
                '%' . $last9Phone . '%',
                $cleanInput
            ]
        );
    } catch (\Throwable $e) {
        $delegate = null;
    }

    // 2. In-memory PHP matching across delegates table (for Unicode / collation edge cases)
    if (!$delegate) {
        try {
            $allDelegates = Database::query('SELECT * FROM delegates');
            if (is_array($allDelegates)) {
                foreach ($allDelegates as $d) {
                    $dUser = trim((string)($d['username'] ?? ''));
                    $dName = trim((string)($d['name'] ?? ''));
                    $dPhone = normalizePhone((string)($d['phone'] ?? ''));
                    $dEmail = trim((string)($d['email'] ?? ''));

                    $match = false;
                    if (strcasecmp($dUser, $cleanInput) === 0 || strcasecmp(ltrim($dUser, '@'), $cleanUsername) === 0) {
                        $match = true;
                    } elseif (normalizeArabicLetters($dName) === $normArabic || strcasecmp($dName, $cleanInput) === 0) {
                        $match = true;
                    } elseif (!empty($cleanPhone) && !empty($dPhone)) {
                        if ($dPhone === $cleanPhone || (strlen($dPhone) >= 9 && strlen($cleanPhone) >= 9 && substr($dPhone, -9) === substr($cleanPhone, -9))) {
                            $match = true;
                        }
                    } elseif (!empty($dEmail) && strcasecmp($dEmail, $cleanInput) === 0) {
                        $match = true;
                    }

                    if ($match) {
                        $delegate = $d;
                        break;
                    }
                }
            }
        } catch (\Throwable $e) {}
    }

    // 3. Fallback to system_settings cache (system_delegates, delegates)
    if (!$delegate) {
        try {
            $settingKeys = ['system_delegates', 'delegates'];
            foreach ($settingKeys as $key) {
                $stored = Database::queryOne("SELECT setting_value FROM system_settings WHERE setting_key = ?", [$key]);
                if ($stored && !empty($stored['setting_value'])) {
                    $list = json_decode((string)$stored['setting_value'], true) ?: [];
                    if (is_array($list)) {
                        foreach ($list as $item) {
                            $itemUser = trim((string)($item['username'] ?? ''));
                            $itemName = trim((string)($item['name'] ?? ''));
                            $itemPhone = normalizePhone((string)($item['phone'] ?? ''));
                            $itemEmail = trim((string)($item['email'] ?? ''));

                            $match = false;
                            if (strcasecmp($itemUser, $cleanInput) === 0 || strcasecmp(ltrim($itemUser, '@'), $cleanUsername) === 0) {
                                $match = true;
                            } elseif (normalizeArabicLetters($itemName) === $normArabic || strcasecmp($itemName, $cleanInput) === 0) {
                                $match = true;
                            } elseif (!empty($cleanPhone) && !empty($itemPhone)) {
                                if ($itemPhone === $cleanPhone || (strlen($itemPhone) >= 9 && strlen($cleanPhone) >= 9 && substr($itemPhone, -9) === substr($cleanPhone, -9))) {
                                    $match = true;
                                }
                            } elseif (!empty($itemEmail) && strcasecmp($itemEmail, $cleanInput) === 0) {
                                $match = true;
                            }

                            if ($match) {
                                $delegate = [
                                    'id' => $item['id'] ?? ('del_' . md5($itemUser ?: $itemName)),
                                    'tenant_id' => 'org-default',
                                    'name' => $itemName ?: $itemUser,
                                    'username' => $itemUser ?: $itemName,
                                    'phone' => $item['phone'] ?? '',
                                    'email' => $itemEmail,
                                    'specialty' => $item['specialty'] ?? 'مبيعات',
                                    'target' => (int)($item['target'] ?? 0),
                                    'is_active' => isset($item['isActive']) ? ($item['isActive'] ? 1 : 0) : (isset($item['status']) && $item['status'] === 'inactive' ? 0 : 1),
                                    'password_hash' => !empty($item['password']) ? (password_get_info((string)$item['password'])['algo'] ? $item['password'] : Security::hashPassword((string)$item['password'])) : null
                                ];

                                // Auto-heal & persist directly into delegates table in MySQL
                                try {
                                    Database::execute(
                                        "INSERT INTO delegates (id, tenant_id, name, username, password_hash, phone, email, specialty, is_active, target, updated_at)
                                         VALUES (?, 'org-default', ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                                         ON DUPLICATE KEY UPDATE 
                                            name = VALUES(name), 
                                            username = VALUES(username), 
                                            phone = VALUES(phone), 
                                            email = VALUES(email), 
                                            is_active = VALUES(is_active), 
                                            password_hash = COALESCE(VALUES(password_hash), delegates.password_hash),
                                            updated_at = NOW()",
                                        [
                                            $delegate['id'],
                                            $delegate['name'],
                                            $delegate['username'],
                                            $delegate['password_hash'],
                                            $delegate['phone'],
                                            $delegate['email'],
                                            $delegate['specialty'],
                                            $delegate['is_active'],
                                            $delegate['target']
                                        ]
                                    );
                                } catch (\Throwable $e) {}
                                break 2;
                            }
                        }
                    }
                }
            }
        } catch (\Throwable $e) {}
    }

    // 4. Fallback to users table (if created via UserAdmin with delegate/sales role)
    if (!$delegate) {
        try {
            $userRow = Database::queryOne(
                "SELECT * FROM users 
                 WHERE (LOWER(TRIM(username)) = LOWER(?) OR TRIM(phone) = ? OR TRIM(phone) = ?)
                   AND (role LIKE '%delegate%' OR role LIKE '%مندوب%' OR role LIKE '%مبيعات%' OR role LIKE '%sales%')
                 LIMIT 1",
                [$cleanInput, $cleanInput, $cleanPhone]
            );

            if ($userRow) {
                $delegate = [
                    'id' => 'del_' . $userRow['id'],
                    'tenant_id' => $userRow['tenant_id'] ?? 'org-default',
                    'name' => $userRow['name'] ?? $userRow['username'],
                    'username' => $userRow['username'],
                    'phone' => $userRow['phone'] ?? '',
                    'email' => $userRow['email'] ?? '',
                    'specialty' => 'مبيعات',
                    'target' => 0,
                    'is_active' => isset($userRow['is_active']) ? (int)$userRow['is_active'] : 1,
                    'password_hash' => $userRow['password_hash'] ?? null
                ];

                // Mirror into delegates table
                try {
                    Database::execute(
                        "INSERT INTO delegates (id, tenant_id, name, username, password_hash, phone, email, specialty, is_active, target, updated_at)
                         VALUES (?, 'org-default', ?, ?, ?, ?, ?, 'مبيعات', ?, 0, NOW())
                         ON DUPLICATE KEY UPDATE 
                            name = VALUES(name),
                            password_hash = COALESCE(VALUES(password_hash), delegates.password_hash),
                            updated_at = NOW()",
                        [
                            $delegate['id'],
                            $delegate['name'],
                            $delegate['username'],
                            $delegate['password_hash'],
                            $delegate['phone'],
                            $delegate['email'],
                            $delegate['is_active']
                        ]
                    );
                } catch (\Throwable $e) {}
            }
        } catch (\Throwable $e) {}
    }

    if (!$delegate) {
        jsonError('بيانات الدخول غير صحيحة، لم يتم العثور على حساب المندوب. يرجى التأكد من اسم المستخدم أو رقم الجوال.', 401);
    }

    if (empty($delegate['is_active'])) {
        jsonError('حساب المندوب معطل حالياً من قِبل إدارة المعرض. يرجى مراجعة المسؤول.', 403);
    }

    // Validate Password
    $storedHash = (string)($delegate['password_hash'] ?? '');
    $isValid = false;

    if (!empty($storedHash)) {
        if (password_verify($password, $storedHash) || 
            $password === $storedHash ||
            hash_equals(sha1($password), $storedHash) ||
            hash_equals(md5($password), $storedHash)) {
            $isValid = true;

            // Auto-upgrade plain text or weak hash to bcrypt
            if (!password_get_info($storedHash)['algo']) {
                try {
                    Database::execute(
                        "UPDATE delegates SET password_hash = ?, updated_at = NOW() WHERE id = ?",
                        [Security::hashPassword($password), $delegate['id']]
                    );
                } catch (\Throwable $e) {}
            }
        }
    } else {
        // If password was unset, establish it from the current login attempt
        $isValid = true;
        try {
            Database::execute(
                "UPDATE delegates SET password_hash = ?, updated_at = NOW() WHERE id = ?",
                [Security::hashPassword($password), $delegate['id']]
            );
        } catch (\Throwable $e) {}
    }

    if (!$isValid) {
        jsonError('كلمة المرور غير صحيحة. يرجى التحقق من كلمة المرور والمحاولة مجدداً.', 401);
    }

    // Generate delegate session token (30 days validity)
    $token = Security::generateToken([
        'delegateId' => $delegate['id'],
        'username' => $delegate['username'],
        'name' => $delegate['name'] ?: $delegate['username'],
        'type' => 'delegate'
    ], 86400 * 30);

    $delegateData = [
        'id' => $delegate['id'],
        'tenant_id' => $delegate['tenant_id'] ?? 'org-default',
        'name' => $delegate['name'] ?: $delegate['username'],
        'username' => $delegate['username'],
        'phone' => $delegate['phone'] ?? '',
        'email' => $delegate['email'] ?? '',
        'specialty' => $delegate['specialty'] ?? 'مبيعات',
        'target' => (int)($delegate['target'] ?? 0),
        'isActive' => (bool)$delegate['is_active'],
        'token' => $token
    ];

    jsonSuccess('تم تسجيل دخول المندوب بنجاح.', [
        'delegate' => $delegateData,
        'token' => $token
    ]);
} catch (\Throwable $e) {
    jsonError('حدث خطأ أثناء معالجة تسجيل الدخول: ' . $e->getMessage(), 500);
}
