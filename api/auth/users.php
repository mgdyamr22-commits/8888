<?php
/**
 * /api/auth/users
 * GET: List all users
 * POST: Create a new user
 * PUT: Update user
 * DELETE: Remove user
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

use Almakhzoun\Database\Database;
use Almakhzoun\Config\Security;

$currentUser = requireAdmin();
$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        $users = Database::query(
            'SELECT id, username, full_name, email, phone, role, branch_id, specialty, is_active, last_login, created_at FROM users ORDER BY created_at DESC'
        );

        // Fetch permissions for each user
        foreach ($users as &$u) {
            $perms = Database::query('SELECT permission_key FROM user_permissions WHERE user_id = ?', [$u['id']]);
            $u['permissions'] = array_column($perms, 'permission_key');
            $u['fullName'] = $u['full_name'];
            $u['branchId'] = $u['branch_id'];
            $u['isActive'] = (bool)$u['is_active'];
        }

        jsonSuccess('Success', ['users' => $users]);
    } else if ($method === 'POST') {
        requireAdmin();
        $body = getJsonBody();
        $username = trim($body['username'] ?? '');
        $password = $body['password'] ?? '';
        $fullName = trim($body['fullName'] ?? $body['full_name'] ?? '');
        $email = trim($body['email'] ?? '');
        $phone = trim($body['phone'] ?? '');
        $role = $body['role'] ?? 'موظف';
        $branchId = $body['branchId'] ?? $body['branch_id'] ?? null;
        $specialty = $body['specialty'] ?? null;
        $permissions = $body['permissions'] ?? [];

        if (empty($username) || empty($password)) {
            jsonError('اسم المستخدم وكلمة المرور مطلوبان.', 400);
        }

        $existing = Database::queryOne('SELECT id FROM users WHERE username = ?', [$username]);
        if ($existing) {
            jsonError('اسم المستخدم مسجل مسبقاً في النظام.', 400);
        }

        $userId = 'usr_' . bin2hex(random_bytes(8));
        $passwordHash = Security::hashPassword($password);

        Database::execute(
            'INSERT INTO users (id, tenant_id, branch_id, username, password_hash, role, full_name, email, phone, specialty, is_active, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())',
            [$userId, $currentUser['tenant_id'], $branchId, $username, $passwordHash, $role, $fullName, $email, $phone, $specialty]
        );

        if (is_array($permissions)) {
            foreach ($permissions as $p) {
                Database::execute('INSERT INTO user_permissions (user_id, permission_key) VALUES (?, ?)', [$userId, $p]);
            }
        }

        logAudit('CREATE_USER', $userId, 'users', "إضافة مستخدم جديد: {$username} ({$role})");
        jsonSuccess('تم إضافة المستخدم بنجاح.', ['userId' => $userId]);
    } else if ($method === 'PUT') {
        requireAdmin();
        $body = getJsonBody();
        $userId = $body['id'] ?? $body['userId'] ?? '';
        if (empty($userId)) {
            jsonError('معرف المستخدم مطلوب.', 400);
        }

        $username = trim($body['username'] ?? '');
        $fullName = trim($body['fullName'] ?? $body['full_name'] ?? '');
        $email = trim($body['email'] ?? '');
        $phone = trim($body['phone'] ?? '');
        $role = $body['role'] ?? null;
        $branchId = $body['branchId'] ?? $body['branch_id'] ?? null;
        $specialty = $body['specialty'] ?? null;
        $isActive = isset($body['isActive']) ? ($body['isActive'] ? 1 : 0) : 1;
        $permissions = $body['permissions'] ?? null;

        $params = [$fullName, $email, $phone, $branchId, $specialty, $isActive];
        $sql = 'UPDATE users SET full_name = ?, email = ?, phone = ?, branch_id = ?, specialty = ?, is_active = ?';

        if (!empty($username)) {
            $sql .= ', username = ?';
            $params[] = $username;
        }

        if (!empty($role)) {
            $sql .= ', role = ?';
            $params[] = $role;
        }

        if (!empty($body['password'])) {
            $sql .= ', password_hash = ?';
            $params[] = Security::hashPassword($body['password']);
        }

        $sql .= ' WHERE id = ?';
        $params[] = $userId;

        Database::execute($sql, $params);

        if (is_array($permissions)) {
            Database::execute('DELETE FROM user_permissions WHERE user_id = ?', [$userId]);
            foreach ($permissions as $p) {
                Database::execute('INSERT INTO user_permissions (user_id, permission_key) VALUES (?, ?)', [$userId, $p]);
            }
        }

        logAudit('UPDATE_USER', $userId, 'users', "تعديل بيانات المستخدم: {$userId}");
        jsonSuccess('تم تحديث بيانات المستخدم بنجاح.');
    } else if ($method === 'DELETE') {
        requireAdmin();
        $body = getJsonBody();
        $userId = $_GET['id'] ?? $body['id'] ?? $body['userId'] ?? '';

        if (empty($userId)) {
            jsonError('معرف المستخدم مطلوب.', 400);
        }

        if ($userId === $currentUser['id']) {
            jsonError('لا يمكنك حذف حسابك الشخصي الحالي.', 400);
        }

        Database::execute('DELETE FROM users WHERE id = ?', [$userId]);
        logAudit('DELETE_USER', $userId, 'users', "حذف المستخدم: {$userId}");
        jsonSuccess('تم حذف المستخدم بنجاح.');
    } else {
        jsonError('Method Not Allowed', 405);
    }
} catch (\Throwable $e) {
    jsonError('حدث خطأ أثناء إدارة المستخدمين: ' . $e->getMessage(), 500);
}
