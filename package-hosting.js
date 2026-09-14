import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputDir = path.join(__dirname, 'hosting_package');
const distDir = path.join(__dirname, 'dist');

console.log('🚀 بدء تجهيز وتحديث حزمة الاستضافة المتكاملة (hosting_package)...');

// 1. Ensure clean build & hosting package directories
console.log('🧹 تنظيف مخلفات البناء القديمة من dist و hosting_package و host_package...');
const hostPackageDir = path.join(__dirname, 'host_package');
if (fs.existsSync(outputDir)) {
  fs.rmSync(outputDir, { recursive: true, force: true });
}
if (fs.existsSync(hostPackageDir)) {
  fs.rmSync(hostPackageDir, { recursive: true, force: true });
}
fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(hostPackageDir, { recursive: true });
// 2. Re-build to ensure latest changes are included unless skipped
const shouldBuild = !process.argv.includes('--skip-build') && !process.env.SKIP_BUILD;
if (shouldBuild) {
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  console.log('⚡ بناء الواجهة البرمجية المحدثة (npm run build)...');
  try {
    execSync('npm run build', { stdio: 'inherit', cwd: __dirname });
  } catch (err) {
    console.error('❌ فشل بناء الواجهة:', err.message);
    process.exit(1);
  }
} else {
  console.log('⚡ استخدام ملفات dist المبنية مسبقاً...');
}

// Helper to copy directory recursively
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 3. Copy dist contents (index.html, assets, etc.) directly to root of package
console.log('📦 نسخ ملفات الواجهة المترجمة (Vite dist) إلى جذر حزمة الاستضافة...');
const distEntries = fs.readdirSync(distDir);
for (const entry of distEntries) {
  const srcPath = path.join(distDir, entry);
  const destPath = path.join(outputDir, entry);
  if (fs.lstatSync(srcPath).isDirectory()) {
    copyDir(srcPath, destPath);
  } else {
    fs.copyFileSync(srcPath, destPath);
  }
}

// 4. Copy backend PHP folders
const phpFolders = ['api', 'installer', 'database', 'config', 'storage'];
for (const folder of phpFolders) {
  const srcPath = path.join(__dirname, folder);
  const destPath = path.join(outputDir, folder);
  if (fs.existsSync(srcPath)) {
    console.log(`📁 نسخ مجلد ${folder}/ بالكامل...`);
    copyDir(srcPath, destPath);
  }
}

// 5. Ensure all storage subfolders and permissions exist
const storageSubs = ['uploads', 'documents', 'backups', 'logs', 'snapshots'];
for (const sub of storageSubs) {
  const subPath = path.join(outputDir, 'storage', sub);
  fs.mkdirSync(subPath, { recursive: true });
}

// Ensure .htaccess in storage/
const storageHtaccess = path.join(__dirname, 'storage', '.htaccess');
if (fs.existsSync(storageHtaccess)) {
  fs.copyFileSync(storageHtaccess, path.join(outputDir, 'storage', '.htaccess'));
} else {
  fs.writeFileSync(
    path.join(outputDir, 'storage', '.htaccess'),
    "<IfModule mod_authz_core.c>\n    Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n    Deny from all\n</IfModule>\n"
  );
}

// 6. Copy root configuration files
const copyFiles = ['.htaccess', '.env.example', 'metadata.json'];
for (const f of copyFiles) {
  const p = path.join(__dirname, f);
  if (fs.existsSync(p)) {
    console.log(`📄 نسخ ${f} ...`);
    fs.copyFileSync(p, path.join(outputDir, f));
  }
}

// Ensure installation locks are NOT bundled in the clean deployment package
const deployedLockJson = path.join(outputDir, 'config', 'installed.json');
if (fs.existsSync(deployedLockJson)) {
  fs.rmSync(deployedLockJson, { force: true });
}
const deployedDotLock = path.join(outputDir, '.installed');
if (fs.existsSync(deployedDotLock)) {
  fs.rmSync(deployedDotLock, { force: true });
}

// Add instructions and example config for hosting
const instructions = `=====================================================
نظام المخزون برو (Almakhzoun Pro) - دليل النشر والاستضافة
=====================================================

1. رفع الملفات:
   - قم برفع كافة محتويات هذا المجلد مباشرة إلى مجلد public_html (أو المجلد الرئيسي للموقع).

2. التثبيت لأول مرة:
   - افتح متصفحك وتوجه إلى رابط موقعك: https://yourdomain.com
   - سيظهر معالج التثبيت الذكي تلقائياً (Installer Wizard).
   - قم بإدخال بيانات قاعدة بيانات MySQL (اسم القاعدة، اسم المستخدم، كلمة المرور) واضغط تثبيت.

3. في حال كان لديك قاعدة بيانات جاهزة:
   - يمكنك نسخ ملف config/installed.json.example إلى config/installed.json وتعبئة بيانات الاتصال مباشرة.

4. صلاحيات المجلدات:
   - تأكد من إعطاء صلاحية 755 أو 777 لمجلد storage/ وكافة مجلداته الفرعية (uploads, backups, logs, snapshots).

5. الروابط النظيفة (Clean URLs):
   - تم ضبط ملف .htaccess بالكامل لدعم مسارات React Router النظيفة بدون أي علامة (#) وحماية ملفات الـ API.
=====================================================`;
fs.writeFileSync(path.join(outputDir, 'دليل_الاستضافة_والتثبيت.txt'), instructions, 'utf8');

// 7. Duplicate/mirror to host_package so both naming variants exist
if (fs.existsSync(hostPackageDir)) {
  fs.rmSync(hostPackageDir, { recursive: true, force: true });
}
console.log('📋 مزامنة حزمة الاستضافة إلى مجلد host_package ...');
copyDir(outputDir, hostPackageDir);

// 8. Generate updated compressed archives
try {
  console.log('🗜️ ضغط وتحديث ملفات الأرشيف host_package.tar.gz ...');
  execSync('tar -czf host_package.tar.gz -C . host_package', { stdio: 'ignore', cwd: __dirname });
} catch (e) {
  console.warn('تخطي ضغط الأرشيف:', e.message);
}

console.log('\n✅ اكتمل تجهيز حزمة الاستضافة المتكاملة بنجاح تام!');
console.log(`📂 المجلد المكتمل والجاهز للرفع: /hosting_package و /host_package و host_package.tar.gz`);
console.log('💡 قم برفع محتويات المجلد مباشرة إلى مجلد `public_html` على الاستضافة.');
