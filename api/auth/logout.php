<?php
/**
 * POST /api/auth/logout
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

logAudit('LOGOUT', null, 'users', 'تسجيل خروج المستخدم');

jsonSuccess('تم تسجيل الخروج بنجاح.');
