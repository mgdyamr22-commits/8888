<?php
/**
 * Delegate Profile Management Endpoint
 * Allows authenticated delegates to view and update their own profile data only.
 */

declare(strict_types=1);

require_once __DIR__ . '/../helpers.php';

use Almakhzoun\Config\Security;
use Almakhzoun\Database\Database;

$delegate = requireDelegateAuth();
$delegateId = $delegate['id'];

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $row = Database::queryOne(
        'SELECT id, tenant_id, name, username, phone, email, specialty, is_active, target, notes, created_at, updated_at FROM delegates WHERE id = ?',
        [$delegateId]
    );

    if (!$row) {
        jsonError('لم يتم العثور على بيانات المندوب.', 404);
    }

    jsonSuccess('تم جلب بيانات المندوب بنجاح.', [
        'profile' => [
            'id' => $row['id'],
            'name' => $row['name'] ?: $row['username'],
            'username' => $row['username'],
            'phone' => $row['phone'] ?? '',
            'email' => $row['email'] ?? '',
            'specialty' => $row['specialty'] ?? 'مبيعات',
            'target' => (int)($row['target'] ?? 0),
            'isActive' => (bool)$row['is_active']
        ]
    ]);
} elseif ($method === 'POST' || $method === 'PUT') {
    $body = getJsonBody();

    $name = trim($body['name'] ?? $delegate['name'] ?? '');
    $phone = trim($body['phone'] ?? $delegate['phone'] ?? '');
    $email = trim($body['email'] ?? $delegate['email'] ?? '');
    $newPassword = trim($body['password'] ?? '');

    $updates = ['name = ?', 'phone = ?', 'email = ?', 'updated_at = NOW()'];
    $params = [$name, $phone, $email];

    if (!empty($newPassword)) {
        if (strlen($newPassword) < 6) {
            jsonError('يجب أن لا تقل كلمة المرور الجديدة عن 6 خانات.', 400);
        }
        $hashed = Security::hashPassword($newPassword);
        $updates[] = 'password_hash = ?';
        $params[] = $hashed;
    }

    $params[] = $delegateId;
    $sql = 'UPDATE delegates SET ' . implode(', ', $updates) . ' WHERE id = ?';

    Database::execute($sql, $params);

    $updated = Database::queryOne(
        'SELECT id, tenant_id, name, username, phone, email, specialty, is_active, target FROM delegates WHERE id = ?',
        [$delegateId]
    );

    jsonSuccess('تم تحديث البيانات الشخصية للمندوب بنجاح.', [
        'delegate' => [
            'id' => $updated['id'],
            'name' => $updated['name'] ?: $updated['username'],
            'username' => $updated['username'],
            'phone' => $updated['phone'] ?? '',
            'email' => $updated['email'] ?? '',
            'specialty' => $updated['specialty'] ?? 'مبيعات',
            'target' => (int)($updated['target'] ?? 0),
            'isActive' => (bool)$updated['is_active']
        ]
    ]);
} else {
    jsonError('طريقة الطلب غير مدعومة.', 405);
}
