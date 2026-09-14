<?php
/**
 * Almakhzoun Inventory Pro - Installer Gateway
 */

declare(strict_types=1);

// If action query parameter is provided, forward directly to actions.php
if (isset($_GET['action'])) {
    require __DIR__ . '/actions.php';
    exit;
}

$root = dirname(__DIR__);
$isInstalled = file_exists($root . '/install.lock') || file_exists($root . '/config/installed.json') || file_exists($root . '/.installed');

// If already installed, redirect directly to the main root application (clean URL)
if ($isInstalled) {
    header('Location: ../');
    exit;
}

// Redirect to root app with clean URL /install for fresh installation
header('Location: ../install');
exit;
