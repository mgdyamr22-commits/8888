<?php
/**
 * Unified API Front-Router for Almakhzoun Inventory Pro
 * Dispatches all /api/* requests to the corresponding PHP endpoints
 */

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

$requestUri = $_SERVER['REQUEST_URI'] ?? '/';
$uriPath = (string)parse_url($requestUri, PHP_URL_PATH);

// 1. Strip base prefix up to /api/ or /api
$path = preg_replace('#^.*?/api/?#i', '', $uriPath);
// 2. Strip index.php prefix if called as /api/index.php/cars or /api/index.php
$path = preg_replace('#^index\.php/?#i', '', $path);
$path = trim($path, '/');

// 3. Fallback to query parameter ?route=... or ?path=... or ?action=...
if (empty($path)) {
    if (!empty($_GET['route'])) {
        $path = trim((string)$_GET['route'], '/');
    } else if (!empty($_GET['path'])) {
        $path = trim((string)$_GET['path'], '/');
    }
}

// Direct route mappings
$routes = [
    // Health
    ''                         => __DIR__ . '/health.php',
    'health'                   => __DIR__ . '/health.php',

    // Tenants & Organization
    'tenants'                  => __DIR__ . '/tenants/index.php',
    'tenants/'                 => __DIR__ . '/tenants/index.php',
    'tenants/index'            => __DIR__ . '/tenants/index.php',
    'tenants/index.php'        => __DIR__ . '/tenants/index.php',

    // LAN / Offline Data Synchronization
    'lan/data'                 => __DIR__ . '/lan/data.php',
    'lan/data.php'             => __DIR__ . '/lan/data.php',
    'lan/sync'                 => __DIR__ . '/lan/sync.php',
    'lan/sync.php'             => __DIR__ . '/lan/sync.php',

    // Install
    'install/status'           => __DIR__ . '/install/status.php',
    'install/requirements'     => __DIR__ . '/install/requirements.php',
    'install/system-check'     => __DIR__ . '/install/requirements.php',
    'install/database-test'    => __DIR__ . '/install/test-db.php',
    'install/test-db'          => __DIR__ . '/install/test-db.php',
    'install/migrate'          => __DIR__ . '/install/migrate.php',
    'install/create-admin'     => __DIR__ . '/install/create-admin.php',
    'install/finalize'         => __DIR__ . '/install/finalize.php',
    'install/execute'          => __DIR__ . '/install/execute.php',

    // Auth
    'auth/login'               => __DIR__ . '/auth/login.php',
    'auth/login.php'           => __DIR__ . '/auth/login.php',
    'auth/logout'              => __DIR__ . '/auth/logout.php',
    'auth/logout.php'          => __DIR__ . '/auth/logout.php',
    'auth/me'                  => __DIR__ . '/auth/me.php',
    'auth/me.php'              => __DIR__ . '/auth/me.php',
    'auth/validate-session'    => __DIR__ . '/auth/validate-session.php',
    'auth/validate-session.php'=> __DIR__ . '/auth/validate-session.php',
    'auth/refresh-token'       => __DIR__ . '/auth/refresh-token.php',
    'auth/refresh-token.php'   => __DIR__ . '/auth/refresh-token.php',
    'auth/users'               => __DIR__ . '/auth/users.php',
    'auth/users.php'           => __DIR__ . '/auth/users.php',
    'auth/register'            => __DIR__ . '/auth/users.php',
    'auth/register.php'        => __DIR__ . '/auth/users.php',
    'auth/delegates'           => __DIR__ . '/auth/delegates.php',
    'auth/delegates.php'       => __DIR__ . '/auth/delegates.php',
    'auth/sync-delegates'      => __DIR__ . '/auth/sync-delegates.php',
    'auth/sync-delegates.php'  => __DIR__ . '/auth/sync-delegates.php',
    'auth/delegate-login'      => __DIR__ . '/delegate/login.php',
    'auth/delegate-login.php'  => __DIR__ . '/delegate/login.php',
    'delegate/login'           => __DIR__ . '/delegate/login.php',
    'delegate/login.php'       => __DIR__ . '/delegate/login.php',
    'delegate/profile'         => __DIR__ . '/delegate/profile.php',
    'delegate/profile.php'     => __DIR__ . '/delegate/profile.php',
    'delegate/cars'            => __DIR__ . '/delegate/cars.php',
    'delegate/cars.php'        => __DIR__ . '/delegate/cars.php',
    'delegate/reserve'         => __DIR__ . '/delegate/reserve.php',
    'delegate/reserve.php'     => __DIR__ . '/delegate/reserve.php',
    'delegate/cancel-reserve'  => __DIR__ . '/delegate/cancel-reserve.php',
    'delegate/cancel-reserve.php' => __DIR__ . '/delegate/cancel-reserve.php',
    'delegate/my-bookings'     => __DIR__ . '/delegate/my-bookings.php',
    'delegate/my-bookings.php' => __DIR__ . '/delegate/my-bookings.php',
    'auth/sync-users'          => __DIR__ . '/auth/sync-users.php',
    'auth/sync-users.php'      => __DIR__ . '/auth/sync-users.php',
    'auth/company'             => __DIR__ . '/auth/company.php',
    'auth/company.php'         => __DIR__ . '/auth/company.php',
    'auth/verify-password'     => __DIR__ . '/auth/verify-password.php',
    'auth/verify-password.php' => __DIR__ . '/auth/verify-password.php',
    'auth/verify-otp'          => __DIR__ . '/auth/verify-otp.php',
    'auth/verify-otp.php'      => __DIR__ . '/auth/verify-otp.php',
    'auth/resend-otp'          => __DIR__ . '/auth/resend-otp.php',
    'auth/resend-otp.php'      => __DIR__ . '/auth/resend-otp.php',
    'auth/request-reset'       => __DIR__ . '/auth/resend-otp.php',
    'auth/request-reset.php'   => __DIR__ . '/auth/resend-otp.php',
    'auth/request-reset-phone' => __DIR__ . '/auth/resend-otp.php',
    'auth/reset-password'      => __DIR__ . '/auth/reset-password.php',
    'auth/reset-password.php'  => __DIR__ . '/auth/reset-password.php',
    'auth/verify-recovery-code'     => __DIR__ . '/auth/verify-recovery-code.php',
    'auth/verify-recovery-code.php' => __DIR__ . '/auth/verify-recovery-code.php',
    'auth/verify-recovery-file'     => __DIR__ . '/auth/verify-recovery-file.php',
    'auth/verify-recovery-file.php' => __DIR__ . '/auth/verify-recovery-file.php',
    'auth/get-security-questions'     => __DIR__ . '/auth/get-security-questions.php',
    'auth/get-security-questions.php' => __DIR__ . '/auth/get-security-questions.php',
    'auth/verify-questions'         => __DIR__ . '/auth/verify-questions.php',
    'auth/verify-questions.php'     => __DIR__ . '/auth/verify-questions.php',
    'auth/admin-reset-password'     => __DIR__ . '/auth/admin-reset-password.php',
    'auth/admin-reset-password.php' => __DIR__ . '/auth/admin-reset-password.php',
    'auth/backup-db'           => __DIR__ . '/backups/index.php',
    'auth/restore-db'          => __DIR__ . '/backups/index.php',
    'backup/restore'           => __DIR__ . '/backups/index.php',
    'backups/upload'           => __DIR__ . '/backups/index.php',
    'backups/restore-snapshot' => __DIR__ . '/backups/index.php',

    // Installer & System Setup
    'install/execute'          => __DIR__ . '/install/execute.php',
    'install/execute.php'      => __DIR__ . '/install/execute.php',
    'install/status'           => __DIR__ . '/install/status.php',
    'install/status.php'       => __DIR__ . '/install/status.php',
    'install/requirements'     => __DIR__ . '/install/requirements.php',
    'install/requirements.php' => __DIR__ . '/install/requirements.php',
    'install/test-db'          => __DIR__ . '/install/test-db.php',
    'install/test-db.php'      => __DIR__ . '/install/test-db.php',
    'install/migrate'          => __DIR__ . '/install/migrate.php',
    'install/migrate.php'      => __DIR__ . '/install/migrate.php',
    'install/create-admin'     => __DIR__ . '/install/create-admin.php',
    'install/create-admin.php' => __DIR__ . '/install/create-admin.php',
    'install/finalize'         => __DIR__ . '/install/finalize.php',
    'install/finalize.php'     => __DIR__ . '/install/finalize.php',

    // Cars & Inventory
    'cars'                     => __DIR__ . '/cars/index.php',
    'cars/'                    => __DIR__ . '/cars/index.php',
    'cars/index'               => __DIR__ . '/cars/index.php',
    'cars/index.php'           => __DIR__ . '/cars/index.php',
    'cars/bulk-insert'         => __DIR__ . '/cars/index.php',
    'cars/bulk-delete'         => __DIR__ . '/cars/index.php',
    'cars/detail'              => __DIR__ . '/cars/detail.php',
    'cars/detail.php'          => __DIR__ . '/cars/detail.php',
    'cars/exit'                => __DIR__ . '/cars/exit.php',
    'cars/exit.php'            => __DIR__ . '/cars/exit.php',

    // Sales
    'sales'                    => __DIR__ . '/sales/index.php',
    'sales/'                   => __DIR__ . '/sales/index.php',
    'sales/index.php'          => __DIR__ . '/sales/index.php',
    'sales/detail'             => __DIR__ . '/sales/detail.php',
    'sales/detail.php'         => __DIR__ . '/sales/detail.php',

    // Transfers
    'transfers'                => __DIR__ . '/transfers/index.php',
    'transfers/'               => __DIR__ . '/transfers/index.php',
    'transfers/index.php'      => __DIR__ . '/transfers/index.php',
    'transfers/receive'        => __DIR__ . '/transfers/receive.php',
    'transfers/receive.php'    => __DIR__ . '/transfers/receive.php',

    // Customers & Delegates
    'customers'                => __DIR__ . '/customers/index.php',
    'customers/'               => __DIR__ . '/customers/index.php',
    'customers/index.php'      => __DIR__ . '/customers/index.php',
    'delegates'                => __DIR__ . '/customers/index.php',
    'delegates.php'            => __DIR__ . '/customers/index.php',

    // Costs
    'costs'                    => __DIR__ . '/costs/index.php',
    'costs/'                   => __DIR__ . '/costs/index.php',
    'costs/index.php'          => __DIR__ . '/costs/index.php',

    // Letters
    'letters'                  => __DIR__ . '/letters/index.php',
    'letters/'                 => __DIR__ . '/letters/index.php',
    'letters/index.php'        => __DIR__ . '/letters/index.php',

    // Reports
    'reports'                  => __DIR__ . '/reports/index.php',
    'reports/'                 => __DIR__ . '/reports/index.php',
    'reports/index.php'        => __DIR__ . '/reports/index.php',

    // Settings & Branches
    'settings'                 => __DIR__ . '/settings/index.php',
    'settings/'                => __DIR__ . '/settings/index.php',
    'settings/index.php'       => __DIR__ . '/settings/index.php',
    'branches'                 => __DIR__ . '/settings/branches.php',
    'branches.php'             => __DIR__ . '/settings/branches.php',
    'settings/branches'        => __DIR__ . '/settings/branches.php',
    'settings/branches.php'    => __DIR__ . '/settings/branches.php',

    // Files
    'files/upload'             => __DIR__ . '/files/upload.php',
    'files/upload.php'         => __DIR__ . '/files/upload.php',
    'files/download'           => __DIR__ . '/files/download.php',
    'files/download.php'       => __DIR__ . '/files/download.php',

    // Delegate System (Isolated and Secure)
    'delegate/login'           => __DIR__ . '/delegate/login.php',
    'delegate/login.php'       => __DIR__ . '/delegate/login.php',
    'delegate/cars'            => __DIR__ . '/delegate/cars.php',
    'delegate/cars.php'        => __DIR__ . '/delegate/cars.php',
    'delegate/reserve'         => __DIR__ . '/delegate/reserve.php',
    'delegate/reserve.php'     => __DIR__ . '/delegate/reserve.php',
    'delegate/cancel-reserve'  => __DIR__ . '/delegate/cancel-reserve.php',
    'delegate/cancel-reserve.php' => __DIR__ . '/delegate/cancel-reserve.php',
    'delegate/my-bookings'     => __DIR__ . '/delegate/my-bookings.php',
    'delegate/my-bookings.php' => __DIR__ . '/delegate/my-bookings.php',
    'delegate/profile'         => __DIR__ . '/delegate/profile.php',
    'delegate/profile.php'     => __DIR__ . '/delegate/profile.php',
    'auth/delegate-login'      => __DIR__ . '/delegate/login.php',
    'auth/delegate-login.php'  => __DIR__ . '/delegate/login.php',

    // Backups
    'backups'                  => __DIR__ . '/backups/index.php',
    'backups/'                 => __DIR__ . '/backups/index.php',
    'backups/index.php'        => __DIR__ . '/backups/index.php',
    'backups/create'           => __DIR__ . '/backups/index.php',
    'backups/restore'          => __DIR__ . '/backups/index.php',
];

// Exact match check
if (isset($routes[$path])) {
    require $routes[$path];
    exit;
}

// Regex matching for parameterized car routes
if (preg_match('#^cars/([^/]+)/reserve$#i', $path, $matches)) {
    $_GET['id'] = urldecode($matches[1]);
    $_GET['action'] = 'reserve';
    require __DIR__ . '/cars/detail.php';
    exit;
}

if (preg_match('#^cars/([^/]+)/cancel-reservation$#i', $path, $matches)) {
    $_GET['id'] = urldecode($matches[1]);
    $_GET['action'] = 'cancel-reservation';
    require __DIR__ . '/cars/detail.php';
    exit;
}

if (preg_match('#^cars/([^/]+)$#i', $path, $matches)) {
    $sub = urldecode($matches[1]);
    if ($sub === 'bulk-insert' || $sub === 'bulk-delete') {
        $_GET['action'] = $sub;
        require __DIR__ . '/cars/index.php';
        exit;
    }
    if ($sub === 'exit' || $sub === 'exit.php') {
        require __DIR__ . '/cars/exit.php';
        exit;
    }
    if ($sub === 'detail' || $sub === 'detail.php') {
        require __DIR__ . '/cars/detail.php';
        exit;
    }
    if ($sub === 'index' || $sub === 'index.php') {
        require __DIR__ . '/cars/index.php';
        exit;
    }
    $_GET['id'] = $sub;
    require __DIR__ . '/cars/detail.php';
    exit;
}

if (preg_match('#^auth/company/([^/]+)$#i', $path, $matches)) {
    $_GET['id'] = urldecode($matches[1]);
    require __DIR__ . '/auth/company.php';
    exit;
}

if (preg_match('#^sales/([^/]+)$#', $path, $matches)) {
    $_GET['id'] = $matches[1];
    require __DIR__ . '/sales/detail.php';
    exit;
}

if (preg_match('#^costs/([^/]+)$#', $path, $matches)) {
    $_GET['id'] = $matches[1];
    require __DIR__ . '/costs/index.php';
    exit;
}

if (preg_match('#^letters/([^/]+)$#', $path, $matches)) {
    $_GET['id'] = $matches[1];
    require __DIR__ . '/letters/index.php';
    exit;
}

// Dynamic file resolution for any sub-endpoint: e.g. api/auth/something or api/something
$candidateFile = __DIR__ . '/' . $path . '.php';
if (file_exists($candidateFile) && is_file($candidateFile)) {
    require $candidateFile;
    exit;
}
$candidateFileRaw = __DIR__ . '/' . $path;
if (file_exists($candidateFileRaw) && is_file($candidateFileRaw) && str_ends_with($candidateFileRaw, '.php')) {
    require $candidateFileRaw;
    exit;
}

// 404 fallback
jsonError("Endpoint not found: /api/{$path}", 404);
