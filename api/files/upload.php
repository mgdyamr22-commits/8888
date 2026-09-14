<?php
/**
 * POST /api/files/upload
 * Handles file uploads (Images, PDF, Customs Cards) and saves to storage/uploads/
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/helpers.php';

use Almakhzoun\Config\Paths;

$currentUser = requireAuth();

$file = $_FILES['file'] ?? $_FILES['card_file'] ?? $_FILES['document'] ?? null;

if (empty($file)) {
    jsonError('لم يتم إرفاق أي ملف للرفع.', 400);
}

if ($file['error'] !== UPLOAD_ERR_OK) {
    jsonError('فشل رفع الملف. رمز الخطأ: ' . $file['error'], 500);
}

// 1. Validation
$maxSize = 50 * 1024 * 1024; // 50 MB
if ($file['size'] > $maxSize) {
    jsonError('حجم الملف يتجاوز الحد المسموح (50 ميجابايت).', 400);
}

$allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'xlsx', 'xls', 'docx', 'doc', 'txt', 'csv'];
$origName = basename($file['name']);
$ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));

if (!in_array($ext, $allowedExtensions)) {
    jsonError('نوع الملف غير مسموح به.', 400);
}

Paths::ensureDirectories();
$uploadsDir = Paths::uploads();
if (!is_dir($uploadsDir)) {
    @mkdir($uploadsDir, 0777, true);
}

$uniqueName = bin2hex(random_bytes(16)) . '.' . $ext;
$targetPath = $uploadsDir . '/' . $uniqueName;

$uploaded = false;
if (is_uploaded_file($file['tmp_name'])) {
    $uploaded = @move_uploaded_file($file['tmp_name'], $targetPath);
}
if (!$uploaded) {
    $uploaded = @copy($file['tmp_name'], $targetPath);
}

if (!$uploaded || !file_exists($targetPath)) {
    jsonError('فشل حفظ الملف على القرص التخزيني للملقم. يرجى التحقق من أذونات مجلد storage/uploads.', 500);
}

$fileUrl = 'storage/uploads/' . $uniqueName;

logAudit('UPLOAD_FILE', $uniqueName, 'files', "رفع ملف: {$origName}");

jsonSuccess('تم رفع الملف بنجاح.', [
    'fileName'     => $uniqueName,
    'originalName' => $origName,
    'fileUrl'      => $fileUrl,
    'fileSize'     => $file['size'],
    'mimeType'     => $file['type']
]);
