<?php
/**
 * /api/auth/delegates & /api/auth/sync-delegates
 * Manages delegates (sales reps) list in database
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

use Almakhzoun\Config\Security;
use Almakhzoun\Database\Database;

$method = $_SERVER['REQUEST_METHOD'];

function normalizePhoneDigits(string $phone): string {
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

    if ($method === 'GET') {
        $delegates = [];
        
        try {
            $rows = Database::query(
                "SELECT id, tenant_id, name, username, phone, email, specialty, is_active as isActive, target, notes, created_at as createdAt 
                 FROM delegates ORDER BY name ASC, username ASC"
            );
            if (!empty($rows)) {
                $delegates = array_map(function ($r) {
                    return [
                        'id' => $r['id'],
                        'name' => $r['name'] ?: $r['username'],
                        'username' => $r['username'],
                        'phone' => $r['phone'] ?? '',
                        'email' => $r['email'] ?? '',
                        'specialty' => $r['specialty'] ?? 'مبيعات',
                        'isActive' => (bool)$r['isActive'],
                        'target' => (int)($r['target'] ?? 0),
                        'notes' => $r['notes'] ?? '',
                        'createdAt' => $r['createdAt'] ?? ''
                    ];
                }, $rows);
            }
        } catch (\Throwable $e) {
            // Table might not exist yet, fallback
        }

        if (empty($delegates)) {
            // Check settings/storage
            try {
                $stored = Database::queryOne("SELECT setting_value FROM system_settings WHERE setting_key = 'system_delegates'");
                if ($stored && !empty($stored['setting_value'])) {
                    $delegates = json_decode($stored['setting_value'], true) ?: [];
                }
            } catch (\Throwable $e) {}
        }

        jsonSuccess('قائمة المناديب', ['delegates' => $delegates ?: []]);
    } else if ($method === 'POST') {
        $body = getJsonBody();
        $incomingList = [];

        if (!empty($body['delegates']) && is_array($body['delegates'])) {
            $incomingList = $body['delegates'];
        } elseif (!empty($body['delegate']) && is_array($body['delegate'])) {
            $incomingList = [$body['delegate']];
        } elseif (isset($body[0]) && is_array($body[0])) {
            $incomingList = $body;
        }

        $processedCount = 0;

        foreach ($incomingList as $d) {
            if (empty($d['username']) && empty($d['name']) && empty($d['phone'])) continue;
            $username = trim((string)($d['username'] ?? ''));
            $name = trim((string)($d['name'] ?? ''));
            if (empty($username)) {
                $username = preg_replace('/\s+/u', '_', strtolower($name));
            }
            if (empty($name)) {
                $name = $username;
            }

            $id = !empty($d['id']) ? (string)$d['id'] : ('del_' . md5($username));
            $phone = trim((string)($d['phone'] ?? ''));
            $email = trim((string)($d['email'] ?? ''));
            $specialty = $d['specialty'] ?? 'مبيعات';
            $isActive = isset($d['isActive']) ? ($d['isActive'] ? 1 : 0) : (isset($d['status']) && $d['status'] === 'inactive' ? 0 : 1);
            $target = (int)($d['target'] ?? 0);
            $password = trim((string)($d['password'] ?? ''));

            try {
                // Check existing delegate by ID or username or phone
                $existing = Database::queryOne(
                    'SELECT id, password_hash FROM delegates WHERE id = ? OR username = ? LIMIT 1', 
                    [$id, $username]
                );
                
                $passwordHash = $existing['password_hash'] ?? null;
                if ($existing && !empty($existing['id'])) {
                    $id = $existing['id']; // Match exact record ID
                }

                if (!empty($password)) {
                    $passwordHash = Security::hashPassword($password);
                }

                Database::execute(
                    "INSERT INTO delegates (id, tenant_id, name, username, password_hash, phone, email, specialty, is_active, target, updated_at)
                     VALUES (?, 'org-default', ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                     ON DUPLICATE KEY UPDATE 
                        name = VALUES(name),
                        username = VALUES(username),
                        phone = VALUES(phone),
                        email = VALUES(email),
                        specialty = VALUES(specialty),
                        is_active = VALUES(is_active),
                        target = VALUES(target),
                        password_hash = COALESCE(VALUES(password_hash), delegates.password_hash),
                        updated_at = NOW()",
                    [$id, $name, $username, $passwordHash, $phone, $email, $specialty, $isActive, $target]
                );
                $processedCount++;
            } catch (\Throwable $e) {
                error_log('Delegate sync insert error: ' . $e->getMessage());
            }
        }

        // Always sync the full current state of delegates table back into system_settings
        try {
            $allRows = Database::query(
                "SELECT id, tenant_id, name, username, phone, email, specialty, is_active as isActive, target, notes, created_at as createdAt 
                 FROM delegates ORDER BY name ASC, username ASC"
            );
            if (is_array($allRows)) {
                $safeDelegates = array_map(function ($r) {
                    return [
                        'id' => $r['id'],
                        'name' => $r['name'] ?: $r['username'],
                        'username' => $r['username'],
                        'phone' => $r['phone'] ?? '',
                        'email' => $r['email'] ?? '',
                        'specialty' => $r['specialty'] ?? 'مبيعات',
                        'isActive' => (bool)$r['isActive'],
                        'target' => (int)($r['target'] ?? 0),
                        'notes' => $r['notes'] ?? '',
                        'createdAt' => $r['createdAt'] ?? ''
                    ];
                }, $allRows);

                Database::execute(
                    "INSERT INTO system_settings (setting_key, setting_value, updated_at) 
                     VALUES ('system_delegates', ?, NOW()) 
                     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()",
                    [json_encode($safeDelegates, JSON_UNESCAPED_UNICODE)]
                );
            }
        } catch (\Throwable $ignored) {}

        jsonSuccess('تمت مزامنة المناديب في قاعدة البيانات بنجاح.', [
            'processedCount' => $processedCount
        ]);
    } else if ($method === 'DELETE') {
        $body = getJsonBody();
        $id = trim((string)($body['id'] ?? ($_GET['id'] ?? '')));
        if (!empty($id)) {
            Database::execute("DELETE FROM delegates WHERE id = ?", [$id]);
            jsonSuccess('تم حذف المندوب بنجاح.');
        } else {
            jsonError('معرّف المندوب مطلوب للحذف.', 400);
        }
    }
} catch (\Throwable $e) {
    jsonError('فشلت معالجة المناديب: ' . $e->getMessage(), 500);
}
