<?php
/**
 * /api/customers
 * GET, POST, PUT, DELETE for Customers and Delegates
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

use Almakhzoun\Database\Database;

$currentUser = requireAuth();
$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        $type = $_GET['type'] ?? '';
        if ($type === 'delegates') {
            $delegates = Database::query('SELECT * FROM delegates ORDER BY created_at DESC');
            jsonSuccess('Success', ['delegates' => $delegates]);
        } else {
            $customers = Database::query('SELECT * FROM customers ORDER BY created_at DESC');
            foreach ($customers as &$c) {
                $c['nationalId'] = $c['national_id'];
            }
            jsonSuccess('Success', ['customers' => $customers]);
        }
    } else if ($method === 'POST') {
        $body = getJsonBody();
        $isDelegate = !empty($body['isDelegate']) || ($body['type'] ?? '') === 'مندوب';

        if ($isDelegate) {
            $username = trim($body['username'] ?? $body['name'] ?? '');
            $phone = trim($body['phone'] ?? '');
            $email = trim($body['email'] ?? '');
            $specialty = trim($body['specialty'] ?? '');
            $target = (int)($body['target'] ?? 0);

            if (empty($username)) {
                jsonError('اسم المندوب مطلوب.', 400);
            }

            $id = 'del_' . bin2hex(random_bytes(8));
            Database::execute(
                'INSERT INTO delegates (id, tenant_id, username, phone, email, specialty, target, is_active, created_at) VALUES (?, "org-default", ?, ?, ?, ?, ?, 1, NOW())',
                [$id, $username, $phone, $email, $specialty, $target]
            );

            logAudit('CREATE_DELEGATE', $id, 'delegates', "إضافة مندوب مبيعات: {$username}");
            jsonSuccess('تم إضافة المندوب بنجاح.', ['delegateId' => $id]);
        } else {
            $name = trim($body['name'] ?? '');
            $phone = trim($body['phone'] ?? '');
            $nationalId = trim($body['nationalId'] ?? $body['national_id'] ?? '');
            $type = $body['type'] ?? 'عميل';

            if (empty($name) || empty($phone)) {
                jsonError('اسم العميل ورقم الهاتف مطلوبان.', 400);
            }

            $id = 'cust_' . bin2hex(random_bytes(8));
            Database::execute(
                'INSERT INTO customers (id, tenant_id, name, phone, national_id, type, created_at) VALUES (?, "org-default", ?, ?, ?, ?, NOW())',
                [$id, $name, $phone, $nationalId, $type]
            );

            logAudit('CREATE_CUSTOMER', $id, 'customers', "إضافة عميل: {$name}");
            jsonSuccess('تم إضافة العميل بنجاح.', ['customerId' => $id]);
        }
    } else if ($method === 'DELETE') {
        $id = $_GET['id'] ?? '';
        if (empty($id)) {
            jsonError('المعرف مطلوب للحذف.', 400);
        }

        if (str_starts_with($id, 'del_')) {
            Database::execute('DELETE FROM delegates WHERE id = ?', [$id]);
        } else {
            Database::execute('DELETE FROM customers WHERE id = ?', [$id]);
        }

        jsonSuccess('تم الحذف بنجاح.');
    } else {
        jsonError('Method Not Allowed', 405);
    }
} catch (\Throwable $e) {
    jsonError('حدث خطأ أثناء معالجة بيانات العملاء/المناديب: ' . $e->getMessage(), 500);
}
