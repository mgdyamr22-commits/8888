<?php
/**
 * /api/lan/data.php
 * Fetches all LAN sync data for offline/online network synchronization
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';
use Almakhzoun\Database\Database;

try {
    $cars = Database::queryAll("SELECT * FROM cars ORDER BY id DESC");
    $customers = Database::queryAll("SELECT * FROM customers ORDER BY id DESC");
    $logs = Database::queryAll("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 500");
    $letters = Database::queryAll("SELECT * FROM letters_archive ORDER BY id DESC");
    $costs = Database::queryAll("SELECT * FROM vehicle_costs ORDER BY id DESC");
    $movements = Database::queryAll("SELECT * FROM inventory_movements ORDER BY id DESC");
    $transfers = Database::queryAll("SELECT * FROM company_transfers ORDER BY id DESC");
    $delegates = Database::queryAll("SELECT * FROM delegates ORDER BY id DESC");

    $settingsRow = Database::queryOne("SELECT setting_value FROM system_settings WHERE setting_key = 'app_settings'");
    $settings = $settingsRow && !empty($settingsRow['setting_value']) ? json_decode($settingsRow['setting_value'], true) : null;

    $transferSettingsRow = Database::queryOne("SELECT setting_value FROM system_settings WHERE setting_key = 'transfer_settings'");
    $transferSettings = $transferSettingsRow && !empty($transferSettingsRow['setting_value']) ? json_decode($transferSettingsRow['setting_value'], true) : null;

    jsonSuccess('بيانات المزامنة المركزية', [
        'cars' => $cars ?: [],
        'customers' => $customers ?: [],
        'logs' => $logs ?: [],
        'settings' => $settings,
        'lettersArchive' => $letters ?: [],
        'vehicleCosts' => $costs ?: [],
        'inventoryMovements' => $movements ?: [],
        'sisterCompanies' => [],
        'companyTransfers' => $transfers ?: [],
        'companyTransfersSettings' => $transferSettings,
        'delegates' => $delegates ?: []
    ]);
} catch (\Throwable $e) {
    // Graceful fallback for non-configured or empty database
    jsonSuccess('بيانات المزامنة المركزية (افتراضي)', [
        'cars' => [],
        'customers' => [],
        'logs' => [],
        'settings' => null,
        'lettersArchive' => [],
        'vehicleCosts' => [],
        'inventoryMovements' => [],
        'sisterCompanies' => [],
        'companyTransfers' => [],
        'companyTransfersSettings' => null,
        'delegates' => []
    ]);
}
