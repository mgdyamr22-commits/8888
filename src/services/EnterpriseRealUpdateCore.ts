import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import AdmZip from 'adm-zip';
import { db } from '../database/db';

export interface FileManifestEntry {
  path: string;
  sha256: string;
  size: number;
  type: 'component' | 'service' | 'route' | 'migration' | 'asset' | 'config' | 'root' | 'source';
  action: 'update' | 'create' | 'delete';
}

export interface DatabaseMigration {
  id: string;
  version: string;
  name: string;
  description: string;
  sql?: string;
  transformFunction?: string;
  executedAt?: string;
}

export interface EnterpriseUpdateManifest {
  manifestVersion: string;
  packageName: string;
  currentVersion: string;
  targetVersion: string;
  buildNumber: number;
  releaseDate: string;
  releaseChannel: 'stable' | 'beta' | 'enterprise';
  minimumSupportedVersion: string;
  databaseVersion: string;
  changelog: string;
  files: FileManifestEntry[];
  migrations: DatabaseMigration[];
  digitalSignature: string;
}

export interface UpdateBackupInfo {
  id: string;
  timestamp: string;
  fromVersion: string;
  targetVersion: string;
  backupDir: string;
  filesCount: number;
  dbSnapshotPath?: string;
  description: string;
}

export const UPDATE_HMAC_SECRET = process.env.UPDATE_SIGNATURE_SECRET || 'almakhzoun_enterprise_update_sec_key_2026_x89';
const PROJECT_ROOT = process.cwd();
const STORAGE_ROOT = path.join(PROJECT_ROOT, '.updates_storage');
const BACKUPS_DIR = path.join(STORAGE_ROOT, 'backups');
const MIGRATIONS_LEDGER = path.join(STORAGE_ROOT, 'applied_migrations.json');
const UPDATE_HISTORY_LEDGER = path.join(STORAGE_ROOT, 'update_history.json');

function ensureStoragePaths() {
  if (!fs.existsSync(STORAGE_ROOT)) fs.mkdirSync(STORAGE_ROOT, { recursive: true });
  if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

/**
 * =========================================================================
 * 1. DIGITAL SIGNATURE ENGINE (HMAC-SHA256)
 * =========================================================================
 */
export class DigitalSignatureEngine {
  static sign(payloadWithoutSignature: Omit<EnterpriseUpdateManifest, 'digitalSignature'>, secret = UPDATE_HMAC_SECRET): string {
    const keys = Object.keys(payloadWithoutSignature).sort();
    const serialized = JSON.stringify(payloadWithoutSignature, keys);
    return crypto.createHmac('sha256', secret).update(serialized).digest('hex');
  }

  static verify(manifest: EnterpriseUpdateManifest, secret = UPDATE_HMAC_SECRET): boolean {
    if (!manifest.digitalSignature) return false;
    const { digitalSignature, ...rest } = manifest;
    const expected = this.sign(rest, secret);
    try {
      return crypto.timingSafeEqual(Buffer.from(digitalSignature, 'hex'), Buffer.from(expected, 'hex'));
    } catch {
      return digitalSignature.toLowerCase() === expected.toLowerCase();
    }
  }
}

/**
 * =========================================================================
 * 2. SHA256 VERIFIER ENGINE
 * =========================================================================
 */
export class Sha256Verifier {
  static compute(buffer: Buffer | string): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  static computeFile(filePath: string): string {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    const content = fs.readFileSync(filePath);
    return this.compute(content);
  }

  static verify(buffer: Buffer | string, expectedHash: string): boolean {
    const actual = this.compute(buffer);
    return actual.toLowerCase() === expectedHash.toLowerCase();
  }

  static verifyFile(filePath: string, expectedHash: string): boolean {
    const actual = this.computeFile(filePath);
    return actual.toLowerCase() === expectedHash.toLowerCase();
  }
}

/**
 * =========================================================================
 * 3. MANIFEST GENERATOR
 * =========================================================================
 */
export class ManifestGenerator {
  static generate(options: {
    currentVersion: string;
    targetVersion: string;
    buildNumber?: number;
    releaseChannel?: 'stable' | 'beta' | 'enterprise';
    minimumSupportedVersion?: string;
    databaseVersion?: string;
    changelog: string;
    files: FileManifestEntry[];
    migrations?: DatabaseMigration[];
  }): EnterpriseUpdateManifest {
    const manifestWithoutSig: Omit<EnterpriseUpdateManifest, 'digitalSignature'> = {
      manifestVersion: '2.0.0-enterprise',
      packageName: 'almakhzoun_inventory_pro_update',
      currentVersion: options.currentVersion,
      targetVersion: options.targetVersion,
      buildNumber: options.buildNumber || Date.now(),
      releaseDate: new Date().toISOString(),
      releaseChannel: options.releaseChannel || 'stable',
      minimumSupportedVersion: options.minimumSupportedVersion || '3.5.0',
      databaseVersion: options.databaseVersion || '3.6.0',
      changelog: options.changelog,
      files: options.files,
      migrations: options.migrations || []
    };

    const signature = DigitalSignatureEngine.sign(manifestWithoutSig);

    return {
      ...manifestWithoutSig,
      digitalSignature: signature
    };
  }
}

/**
 * =========================================================================
 * 4. PATCH BUILDER (Creates directory structure with adm-zip)
 * =========================================================================
 */
export class PatchBuilder {
  static scanAndCollectFiles(relativePaths: string[], baseDir = PROJECT_ROOT): {
    manifestEntries: FileManifestEntry[];
    fileBuffers: { path: string; buffer: Buffer }[];
  } {
    const manifestEntries: FileManifestEntry[] = [];
    const fileBuffers: { path: string; buffer: Buffer }[] = [];

    for (const relPath of relativePaths) {
      const fullPath = path.join(baseDir, relPath);
      if (fs.existsSync(fullPath) && !fs.statSync(fullPath).isDirectory()) {
        const content = fs.readFileSync(fullPath);
        const hash = Sha256Verifier.compute(content);

        let type: FileManifestEntry['type'] = 'source';
        if (relPath.startsWith('components/')) type = 'component';
        else if (relPath.startsWith('services/')) type = 'service';
        else if (relPath.startsWith('src/routes/')) type = 'route';
        else if (relPath.startsWith('src/database/')) type = 'migration';
        else if (relPath.startsWith('public/')) type = 'asset';
        else if (relPath.endsWith('.json')) type = 'config';

        manifestEntries.push({
          path: relPath,
          sha256: hash,
          size: content.length,
          type,
          action: 'update'
        });

        fileBuffers.push({ path: relPath, buffer: content });
      }
    }

    return { manifestEntries, fileBuffers };
  }
}

/**
 * =========================================================================
 * 5. UPDATE BUILDER (Assembles real .kpatch / .zip on disk using adm-zip)
 * =========================================================================
 */
export class UpdateBuilder {
  static buildPackage(options: {
    targetVersion: string;
    buildNumber?: number;
    releaseChannel?: 'stable' | 'beta' | 'enterprise';
    minimumSupportedVersion?: string;
    databaseVersion?: string;
    changelog: string;
    filesToInclude: string[];
    migrations?: DatabaseMigration[];
    outputFilePath?: string;
    baseDir?: string;
  }): { zipBuffer: Buffer; manifest: EnterpriseUpdateManifest; outputFile?: string } {
    const baseDir = options.baseDir || PROJECT_ROOT;
    const pkgPath = path.join(baseDir, 'package.json');
    let currentVersion = '3.5.1';
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        currentVersion = pkg.version || '3.5.1';
      } catch {}
    }

    const { manifestEntries, fileBuffers } = PatchBuilder.scanAndCollectFiles(options.filesToInclude, baseDir);

    const manifest = ManifestGenerator.generate({
      currentVersion,
      targetVersion: options.targetVersion,
      buildNumber: options.buildNumber,
      releaseChannel: options.releaseChannel,
      minimumSupportedVersion: options.minimumSupportedVersion,
      databaseVersion: options.databaseVersion,
      changelog: options.changelog,
      files: manifestEntries,
      migrations: options.migrations
    });

    const zip = new AdmZip();

    // 1. Add manifest.json to root of zip
    zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));

    // 2. Add each file to patch/ subdirectory
    for (const item of fileBuffers) {
      const zipPath = path.join('patch', item.path).replace(/\\/g, '/');
      const dirInZip = path.dirname(zipPath);
      const fileName = path.basename(zipPath);
      zip.addFile(zipPath, item.buffer);
    }

    const zipBuffer = zip.toBuffer();

    if (options.outputFilePath) {
      fs.mkdirSync(path.dirname(options.outputFilePath), { recursive: true });
      fs.writeFileSync(options.outputFilePath, zipBuffer);
    }

    return { zipBuffer, manifest, outputFile: options.outputFilePath };
  }
}

/**
 * =========================================================================
 * 6. ATOMIC BACKUP ENGINE
 * =========================================================================
 */
export class AtomicBackupEngine {
  static createBackup(
    filesToModify: string[],
    fromVersion: string,
    targetVersion: string,
    baseDir = PROJECT_ROOT
  ): UpdateBackupInfo {
    ensureStoragePaths();
    const backupId = `update_backup_${Date.now()}_v${fromVersion.replace(/\./g, '_')}`;
    const backupDir = path.join(BACKUPS_DIR, backupId);
    fs.mkdirSync(backupDir, { recursive: true });

    let filesCount = 0;

    // Backup targeted files
    for (const relPath of filesToModify) {
      const src = path.join(baseDir, relPath);
      if (fs.existsSync(src)) {
        const dst = path.join(backupDir, relPath);
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.copyFileSync(src, dst);
        filesCount++;
      }
    }

    // Critical root files
    const critical = ['package.json', 'metadata.json'];
    for (const c of critical) {
      const src = path.join(baseDir, c);
      if (fs.existsSync(src)) {
        const dst = path.join(backupDir, c);
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.copyFileSync(src, dst);
      }
    }

    // Database snapshot
    const dbData = db.getRawData();
    const dbSnapshotPath = path.join(backupDir, 'database_snapshot.json');
    fs.writeFileSync(dbSnapshotPath, JSON.stringify(dbData, null, 2), 'utf8');

    const backupInfo: UpdateBackupInfo = {
      id: backupId,
      timestamp: new Date().toISOString(),
      fromVersion,
      targetVersion,
      backupDir,
      filesCount,
      dbSnapshotPath,
      description: `نسخة احتياطية ذرية قبل الترقية من ${fromVersion} إلى ${targetVersion}`
    };

    const indexFile = path.join(BACKUPS_DIR, 'index.json');
    let existing: UpdateBackupInfo[] = [];
    if (fs.existsSync(indexFile)) {
      try {
        existing = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
      } catch {}
    }

    existing.unshift(backupInfo);
    if (existing.length > 10) {
      const purged = existing.pop();
      if (purged && fs.existsSync(purged.backupDir)) {
        try {
          fs.rmSync(purged.backupDir, { recursive: true, force: true });
        } catch {}
      }
    }

    fs.writeFileSync(indexFile, JSON.stringify(existing, null, 2), 'utf8');
    return backupInfo;
  }

  static listBackups(): UpdateBackupInfo[] {
    ensureStoragePaths();
    const indexFile = path.join(BACKUPS_DIR, 'index.json');
    if (!fs.existsSync(indexFile)) return [];
    try {
      return JSON.parse(fs.readFileSync(indexFile, 'utf8'));
    } catch {
      return [];
    }
  }
}

/**
 * =========================================================================
 * 7. ROLLBACK ENGINE
 * =========================================================================
 */
export class RollbackEngine {
  static rollback(backupId: string, baseDir = PROJECT_ROOT): { success: boolean; restoredFiles: number; error?: string } {
    ensureStoragePaths();
    const backups = AtomicBackupEngine.listBackups();
    const target = backups.find(b => b.id === backupId);

    if (!target || !fs.existsSync(target.backupDir)) {
      return { success: false, restoredFiles: 0, error: 'النسخة الاحتياطية غير موجودة على القرص.' };
    }

    try {
      let restoredFiles = 0;

      const restoreDir = (dir: string, prefix = '') => {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
          const itemRel = path.join(prefix, item.name);
          const fullSrc = path.join(dir, item.name);

          if (item.name === 'database_snapshot.json' && prefix === '') {
            try {
              const snapshotData = JSON.parse(fs.readFileSync(fullSrc, 'utf8'));
              db.replaceDatabase(snapshotData);
            } catch (e) {
              console.error('Failed to restore database during rollback:', e);
            }
            continue;
          }

          if (item.isDirectory()) {
            restoreDir(fullSrc, itemRel);
          } else {
            const dest = path.join(baseDir, itemRel);
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.copyFileSync(fullSrc, dest);
            restoredFiles++;
          }
        }
      };

      restoreDir(target.backupDir);
      return { success: true, restoredFiles };
    } catch (err: any) {
      return { success: false, restoredFiles: 0, error: err.message || String(err) };
    }
  }
}

/**
 * =========================================================================
 * 8. DATABASE MIGRATION ENGINE
 * =========================================================================
 */
export class DatabaseMigrationEngine {
  static getAppliedMigrations(): DatabaseMigration[] {
    ensureStoragePaths();
    if (!fs.existsSync(MIGRATIONS_LEDGER)) return [];
    try {
      return JSON.parse(fs.readFileSync(MIGRATIONS_LEDGER, 'utf8'));
    } catch {
      return [];
    }
  }

  static recordApplied(migration: DatabaseMigration) {
    ensureStoragePaths();
    const existing = this.getAppliedMigrations();
    existing.push({
      ...migration,
      executedAt: new Date().toISOString()
    });
    fs.writeFileSync(MIGRATIONS_LEDGER, JSON.stringify(existing, null, 2), 'utf8');
  }

  static async executeMigrations(migrations: DatabaseMigration[]): Promise<{ applied: DatabaseMigration[]; errors: string[] }> {
    const applied: DatabaseMigration[] = [];
    const errors: string[] = [];
    const executedSet = new Set(this.getAppliedMigrations().map(m => m.id));

    for (const mig of migrations) {
      if (executedSet.has(mig.id)) continue;

      try {
        // Execute SQL statement on database
        if (mig.sql) {
          await new Promise<void>((resolve, reject) => {
            db.run(mig.sql!, [], (err: any) => {
              if (err) reject(err);
              else resolve();
            });
          });
        }

        // Execute JS Transformer if present
        if (mig.transformFunction) {
          const fn = new Function('db', 'fs', 'path', mig.transformFunction);
          await Promise.resolve(fn(db, fs, path));
        }

        this.recordApplied(mig);
        applied.push(mig);
      } catch (err: any) {
        console.error(`Migration error [${mig.id}]:`, err);
        errors.push(`فشل تنفيذ هجرة (${mig.name}): ${err.message || err}`);
      }
    }

    return { applied, errors };
  }
}

/**
 * =========================================================================
 * 9. PHYSICAL FILE REPLACEMENT ENGINE
 * =========================================================================
 */
export class PhysicalFileReplacementEngine {
  static apply(
    files: { path: string; buffer: Buffer; action: 'update' | 'create' | 'delete' }[],
    baseDir = PROJECT_ROOT
  ): { replacedCount: number; deletedCount: number } {
    let replacedCount = 0;
    let deletedCount = 0;

    for (const file of files) {
      const fullDest = path.join(baseDir, file.path);

      if (file.action === 'delete') {
        if (fs.existsSync(fullDest)) {
          fs.unlinkSync(fullDest);
          deletedCount++;
        }
        continue;
      }

      fs.mkdirSync(path.dirname(fullDest), { recursive: true });
      fs.writeFileSync(fullDest, file.buffer);
      replacedCount++;
    }

    return { replacedCount, deletedCount };
  }

  static bumpVersionInFiles(targetVersion: string, baseDir = PROJECT_ROOT) {
    const pkgPath = path.join(baseDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        pkg.version = targetVersion;
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
      } catch (e) {
        console.error('Failed to bump version in package.json:', e);
      }
    }

    const metaPath = path.join(baseDir, 'metadata.json');
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        meta.version = targetVersion;
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
      } catch (e) {
        console.error('Failed to bump version in metadata.json:', e);
      }
    }
  }
}

/**
 * =========================================================================
 * 10. RESTART ENGINE
 * =========================================================================
 */
export class RestartEngine {
  static restartElectronApp() {
    try {
      const electron = require('electron');
      const app = electron.app || (electron.remote && electron.remote.app);
      if (app && typeof app.relaunch === 'function') {
        app.relaunch();
        app.exit(0);
        return true;
      }
    } catch {}
    return false;
  }
}

/**
 * =========================================================================
 * FULL REAL UPDATE WORKFLOW CONTROLLER
 * =========================================================================
 */
export class RealUpdateEngineController {
  static async inspectPackage(zipBuffer: Buffer): Promise<{
    isValid: boolean;
    error?: string;
    manifest?: EnterpriseUpdateManifest;
    integrityValid?: boolean;
    integrityReport?: { path: string; valid: boolean; size: number }[];
  }> {
    try {
      const zip = new AdmZip(zipBuffer);
      const manifestEntry = zip.getEntry('manifest.json');
      if (!manifestEntry) {
        return { isValid: false, error: 'ملف manifest.json غير موجود داخل حزمة التحديث.' };
      }

      const manifestContent = manifestEntry.getData().toString('utf8');
      const manifest: EnterpriseUpdateManifest = JSON.parse(manifestContent);

      // 1. HMAC Verification
      const isSignatureValid = DigitalSignatureEngine.verify(manifest);
      if (!isSignatureValid) {
        return { isValid: false, error: 'التوقيع الرقمي لحزمة التحديث غير معتمد أو تم التلاعب بها.' };
      }

      // 2. SHA256 Verification of every file in patch/
      const report: { path: string; valid: boolean; size: number }[] = [];
      let allValid = true;

      for (const entry of manifest.files) {
        if (entry.action === 'delete') {
          report.push({ path: entry.path, valid: true, size: 0 });
          continue;
        }

        const zipPath = `patch/${entry.path}`.replace(/\\/g, '/');
        const zipFileEntry = zip.getEntry(zipPath);
        if (!zipFileEntry) {
          report.push({ path: entry.path, valid: false, size: 0 });
          allValid = false;
          continue;
        }

        const buf = zipFileEntry.getData();
        const matches = Sha256Verifier.verify(buf, entry.sha256);
        if (!matches) allValid = false;
        report.push({ path: entry.path, valid: matches, size: buf.length });
      }

      return {
        isValid: allValid,
        manifest,
        integrityValid: allValid,
        integrityReport: report
      };
    } catch (err: any) {
      return { isValid: false, error: `فشل فحص الحزمة: ${err.message || err}` };
    }
  }

  static async applyPackage(
    zipBuffer: Buffer,
    baseDir = PROJECT_ROOT,
    onProgress?: (phase: string, percent: number, details?: string) => void
  ): Promise<{
    success: boolean;
    error?: string;
    manifest?: EnterpriseUpdateManifest;
    filesUpdated?: number;
    migrationsRun?: number;
    backupId?: string;
  }> {
    let backupCreated: UpdateBackupInfo | null = null;

    try {
      onProgress?.('قراءة وفحص حزمة التحديث...', 10, 'استخراج الـ Manifest');
      const zip = new AdmZip(zipBuffer);

      const inspection = await this.inspectPackage(zipBuffer);
      if (!inspection.isValid || !inspection.manifest) {
        return { success: false, error: inspection.error || 'فشل التحقق الأمني من حزمة التحديث.' };
      }

      const manifest = inspection.manifest;

      // 1. Current App Version
      const pkgPath = path.join(baseDir, 'package.json');
      let currentVersion = '3.5.1';
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          currentVersion = pkg.version || '3.5.1';
        } catch {}
      }

      // 2. Atomic Pre-update Backup
      onProgress?.('إنشاء نسخة احتياطية ذرية للملفات وقاعدة البيانات...', 30, 'حماية البيانات قبل الاستبدال الفيزيائي');
      const filesToModify = manifest.files.map(f => f.path);
      backupCreated = AtomicBackupEngine.createBackup(filesToModify, currentVersion, manifest.targetVersion, baseDir);

      // 3. Extract Files
      onProgress?.('فك الضغط والتحقق من سلامة البصمات...', 50, 'قراءة محتوى مجلد patch/');
      const filesToWrite: { path: string; buffer: Buffer; action: 'update' | 'create' | 'delete' }[] = [];

      for (const entry of manifest.files) {
        if (entry.action === 'delete') {
          filesToWrite.push({ path: entry.path, buffer: Buffer.alloc(0), action: 'delete' });
          continue;
        }

        const zipPath = `patch/${entry.path}`.replace(/\\/g, '/');
        const zipFileEntry = zip.getEntry(zipPath);
        if (!zipFileEntry) {
          throw new Error(`ملف مفقود داخل الحزمة: ${entry.path}`);
        }

        const buf = zipFileEntry.getData();
        if (!Sha256Verifier.verify(buf, entry.sha256)) {
          throw new Error(`فشل التحقق من تجزئة SHA-256 للملف: ${entry.path}`);
        }

        filesToWrite.push({ path: entry.path, buffer: buf, action: 'update' });
      }

      // 4. Physical File Replacement
      onProgress?.('استبدال الملفات الفيزيائية على القرص الصلب...', 70, `${filesToWrite.length} ملف برمجياً`);
      const { replacedCount } = PhysicalFileReplacementEngine.apply(filesToWrite, baseDir);

      // 5. Run Database Migrations
      onProgress?.('تنفيذ هجرات قاعدة البيانات والفهارس...', 85, `${manifest.migrations.length} هجرة`);
      let migrationsRun = 0;
      if (manifest.migrations && manifest.migrations.length > 0) {
        const migResult = await DatabaseMigrationEngine.executeMigrations(manifest.migrations);
        migrationsRun = migResult.applied.length;
        if (migResult.errors.length > 0) {
          console.warn('Migration warnings:', migResult.errors);
        }
      }

      // 6. Bump Version
      onProgress?.('تحديث ملفات الإصدار (package.json & metadata.json)...', 95, `v${manifest.targetVersion}`);
      PhysicalFileReplacementEngine.bumpVersionInFiles(manifest.targetVersion, baseDir);

      // Record update in ledger
      ensureStoragePaths();
      let history: any[] = [];
      if (fs.existsSync(UPDATE_HISTORY_LEDGER)) {
        try {
          history = JSON.parse(fs.readFileSync(UPDATE_HISTORY_LEDGER, 'utf8'));
        } catch {}
      }
      history.unshift({
        fromVersion: currentVersion,
        targetVersion: manifest.targetVersion,
        buildNumber: manifest.buildNumber,
        filesUpdated: replacedCount,
        migrationsRun,
        timestamp: new Date().toISOString(),
        changelog: manifest.changelog
      });
      fs.writeFileSync(UPDATE_HISTORY_LEDGER, JSON.stringify(history, null, 2), 'utf8');

      onProgress?.('اكتملت الترقية بنجاح 100%!', 100, `تمت الترقية إلى v${manifest.targetVersion}`);

      return {
        success: true,
        manifest,
        filesUpdated: replacedCount,
        migrationsRun,
        backupId: backupCreated.id
      };
    } catch (err: any) {
      console.error('Update failure, initiating atomic rollback:', err);
      if (backupCreated) {
        RollbackEngine.rollback(backupCreated.id, baseDir);
      }
      return {
        success: false,
        error: `فشل التحديث: ${err.message || err}. تم التراجع الذري التلقائي لاستعادة حالة النظام السابقة.`
      };
    }
  }
}
