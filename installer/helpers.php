<?php
/**
 * Almakhzoun Inventory Pro - Installer Helpers
 */

declare(strict_types=1);

namespace Almakhzoun\Installer;

// Set permissive CORS headers for installer
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

function rootPath(): string
{
    return dirname(__DIR__);
}

function jsonResponse(array $data, int $statusCode = 200): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function jsonSuccess(string $message, array $data = []): void
{
    jsonResponse(array_merge([
        'success' => true,
        'message' => $message
    ], $data), 200);
}

function jsonError(string $error, int $statusCode = 400, array $extra = []): void
{
    jsonResponse(array_merge([
        'success' => false,
        'error'   => $error,
        'message' => $error
    ], $extra), $statusCode);
}

function getJsonBody(): array
{
    $input = file_get_contents('php://input');
    $data = [];
    if (!empty($input)) {
        $parsed = json_decode($input, true);
        if (is_array($parsed)) {
            $data = $parsed;
        }
    }
    return array_merge($_GET, $_POST, $data);
}
