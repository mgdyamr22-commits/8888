<?php
/**
 * GET /api/install/requirements or /api/install/system-check
 * Checks server requirements (PHP version, PDO, PDO MySQL, file permissions, extensions)
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

use Almakhzoun\Config\Paths;

$phpVersion = PHP_VERSION;
$phpOk = version_compare($phpVersion, '8.0.0', '>=');

$pdoInstalled = extension_loaded('pdo');
$pdoMysqlInstalled = extension_loaded('pdo_mysql');
$jsonInstalled = extension_loaded('json');
$mbstringInstalled = extension_loaded('mbstring');
$opensslInstalled = extension_loaded('openssl');
$fileinfoInstalled = extension_loaded('fileinfo');

$storageWritable = is_writable(Paths::storage()) || @mkdir(Paths::storage(), 0755, true);
$uploadsWritable = is_writable(Paths::uploads()) || @mkdir(Paths::uploads(), 0755, true);
$backupsWritable = is_writable(Paths::backups()) || @mkdir(Paths::backups(), 0755, true);
$configWritable  = is_writable(Paths::root() . '/config') || @mkdir(Paths::root() . '/config', 0755, true);

$allPassed = $phpOk && $pdoInstalled && $pdoMysqlInstalled && $jsonInstalled && $mbstringInstalled && $uploadsWritable && $configWritable;

$checks = [
    [
        'name'     => 'إصدار PHP (8.0+)',
        'status'   => $phpOk,
        'passed'   => $phpOk,
        'current'  => "PHP {$phpVersion}",
        'detail'   => "PHP {$phpVersion}",
        'required' => '>= 8.0.0'
    ],
    [
        'name'     => 'امتداد PDO الرئيسي',
        'status'   => $pdoInstalled,
        'passed'   => $pdoInstalled,
        'current'  => $pdoInstalled ? 'مفعل وشغال' : 'غير متوفر',
        'detail'   => $pdoInstalled ? 'مفعل وشغال' : 'غير متوفر',
        'required' => 'مفعل'
    ],
    [
        'name'     => 'امتداد PDO MySQL للاتصال بقواعد البيانات',
        'status'   => $pdoMysqlInstalled,
        'passed'   => $pdoMysqlInstalled,
        'current'  => $pdoMysqlInstalled ? 'مفعل' : 'غير متوفر',
        'detail'   => $pdoMysqlInstalled ? 'مفعل' : 'غير متوفر',
        'required' => 'مفعل'
    ],
    [
        'name'     => 'امتداد JSON',
        'status'   => $jsonInstalled,
        'passed'   => $jsonInstalled,
        'current'  => $jsonInstalled ? 'مفعل' : 'غير متوفر',
        'detail'   => $jsonInstalled ? 'مفعل' : 'غير متوفر',
        'required' => 'مفعل'
    ],
    [
        'name'     => 'امتداد MBString (النصوص العربية utf8mb4)',
        'status'   => $mbstringInstalled,
        'passed'   => $mbstringInstalled,
        'current'  => $mbstringInstalled ? 'مفعل' : 'غير متوفر',
        'detail'   => $mbstringInstalled ? 'مفعل' : 'غير متوفر',
        'required' => 'مفعل'
    ],
    [
        'name'     => 'امتداد OpenSSL (تشفير الجلسات و JWT)',
        'status'   => $opensslInstalled,
        'passed'   => $opensslInstalled,
        'current'  => $opensslInstalled ? 'مفعل' : 'غير متوفر',
        'detail'   => $opensslInstalled ? 'مفعل' : 'غير متوفر',
        'required' => 'مفعل'
    ],
    [
        'name'     => 'صلاحية الكتابة لمجلد الملفات uploads',
        'status'   => $uploadsWritable,
        'passed'   => $uploadsWritable,
        'current'  => $uploadsWritable ? 'قابل للكتابة' : 'غير قابل للكتابة',
        'detail'   => Paths::uploads(),
        'required' => 'قابل للكتابة'
    ],
    [
        'name'     => 'صلاحية الكتابة لمجلد النسخ الاحتياطية backups',
        'status'   => $backupsWritable,
        'passed'   => $backupsWritable,
        'current'  => $backupsWritable ? 'قابل للكتابة' : 'غير قابل للكتابة',
        'detail'   => Paths::backups(),
        'required' => 'قابل للكتابة'
    ],
    [
        'name'     => 'صلاحية الكتابة لمجلد الإعدادات config',
        'status'   => $configWritable,
        'passed'   => $configWritable,
        'current'  => $configWritable ? 'قابل للكتابة' : 'غير قابل للكتابة',
        'detail'   => Paths::root() . '/config',
        'required' => 'قابل للكتابة'
    ]
];

jsonResponse([
    'success'      => true,
    'allPassed'    => $allPassed,
    'passed'       => $allPassed,
    'requirements' => $checks,
    'checks'       => $checks
]);

