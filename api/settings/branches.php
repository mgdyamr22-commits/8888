<?php
/**
 * /api/settings/branches or /api/branches
 * Branches management
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

use Almakhzoun\Database\Database;

$currentUser = requireAuth();
$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        $branches = Database::query('SELECT * FROM branches ORDER BY created_at ASC');
        jsonSuccess('Success', ['branches' => $branches]);
    } else if ($method === 'POST') {
        requireAdmin();
        $body = getJsonBody();
        $name = trim($body['name'] ?? '');
        $code = trim($body['code'] ?? '');
        $phone = trim($body['phone'] ?? '');
        $address = trim($body['address'] ?? '');

        if (empty($name)) {
            jsonError('اسم الفرع مطلوب.', 400);
        }

        $id = 'branch_' . bin2hex(random_bytes(6));
        Database::execute(
            'INSERT INTO branches (id, tenant_id, name, code, phone, address, is_active, created_at) VALUES (?, "org-default", ?, ?, ?, ?, 1, NOW())',
            [$id, $name, $code, $phone, $address]
        );

        logAudit('CREATE_BRANCH', $id, 'branches', "إضافة فرع جديد: {$name}");
        jsonSuccess('تم إضافة الفرع بنجاح.', ['branchId' => $id]);
    } else {
        jsonError('Method Not Allowed', 405);
    }
} catch (\Throwable $e) {
    jsonError('حدث خطأ أثناء معالجة الفروع: ' . $e->getMessage(), 500);
}
