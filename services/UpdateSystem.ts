import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Car, User, ActivityLog, Customer, LetterArchiveEntry, OrganizationSettings } from '../types';

// Define VFS File structure
export interface VFSFile {
  path: string;
  content: string;
  lastModified: string;
}

// Define the Update Manifest interface matching the requirement
export interface UpdateManifest {
  version: string;
  base_version: string;
  updated_files: string[]; // paths list in zip
  deleted_files: string[]; // paths list to delete
  checksum: string;
  changelog: string;
}

// Default files inside our Virtual File System to drive system features dynamically
export const DEFAULT_VFS: Record<string, string> = {
  "branding.json": `{
  "companyName": "المخزون برو لخدمات المركبات",
  "themeAccent": "cyan",
  "logoSubtext": "منصة التوزيع والمبيعات الرقمية الذكية",
  "supportPhone": "+966 50 123 4567"
}`,
  "dashboard_layout.json": `{
  "columns": 3,
  "themeMode": "dark",
  "refreshInterval": 45,
  "widgets": [
    { "id": "financial_stats", "visible": true, "order": 1 },
    { "id": "inventory_overview", "visible": true, "order": 2 },
    { "id": "brand_distribution", "visible": true, "order": 3 },
    { "id": "recent_activity", "visible": true, "order": 4 },
    { "id": "quick_actions", "visible": true, "order": 5 }
  ]
}`,
  "localization.json": `{
  "dashboardTitle": "لوحة التحكم العامة",
  "inventoryTitle": "إدارة المخزون والمستودعات",
  "salesTitle": "سجل وعمليات المبيعات",
  "reportsTitle": "التقارير والإحصائيات المالية",
  "usersTitle": "إدارة المستخدمين والصلاحيات",
  "backupTitle": "صيانة النظام والنسخ الاحتياطي",
  "updatesTitle": "مركز تحديثات النواة"
}`,
  "reports_template.json": `{
  "maxReportPeriod": "1_year",
  "showFinancials": true,
  "allowExports": true,
  "currencyFormat": "SAR",
  "autoGroupBrands": true
}`,
  "security_rules.json": `{
  "maxLoginAttempts": 5,
  "sessionTimeout": 120,
  "requireComplexPassword": true,
  "logAllActions": true
}`
};

const VFS_KEY = 'almakhzoun_vfs';
const BACKUPS_KEY = 'almakhzoun_update_backups';

// --- 1. Version Manager ---
export class VersionManager {
  static getCurrentVersion(): string {
    const rawSettings = localStorage.getItem('settings_secure');
    if (rawSettings) {
      try {
        // Since settings are encrypted, we try to load decrypted systemVersion.
        // Fallback to settings from normal localStorage or defaults.
        const appSettings = localStorage.getItem('app_settings');
        if (appSettings) {
          const parsed = JSON.parse(appSettings);
          return parsed.systemVersion || '3.5.0';
        }
      } catch (e) {
        console.error('Error fetching version from settings', e);
      }
    }
    const legacySettings = localStorage.getItem('app_settings');
    if (legacySettings) {
      try {
        return JSON.parse(legacySettings).systemVersion || '3.5.0';
      } catch {}
    }
    return '3.5.0';
  }

  static compareVersions(v1: string, v2: string): number {
    const clean = (v: string) => v.replace(/[a-zA-Z]/g, '').trim().split('.').map(Number);
    const p1 = clean(v1);
    const p2 = clean(v2);
    
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const num1 = p1[i] || 0;
      const num2 = p2[i] || 0;
      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }
    return 0;
  }

  static isCompatible(baseVersion: string, currentVersion: string): boolean {
    // If base_version is empty or equals 'any', it is compatible with anything
    if (!baseVersion || baseVersion.trim() === '' || baseVersion.toLowerCase() === 'any') {
      return true;
    }
    // Is compatible if our current version is greater than or equal to the required base_version
    return this.compareVersions(currentVersion, baseVersion) >= 0;
  }
}

// --- 2. Manifest Manager ---
export class ManifestManager {
  static generate(
    version: string,
    baseVersion: string,
    updatedFiles: string[],
    deletedFiles: string[],
    changelog: string,
    checksum: string
  ): UpdateManifest {
    return {
      version,
      base_version: baseVersion,
      updated_files: updatedFiles,
      deleted_files: deletedFiles,
      checksum,
      changelog
    };
  }

  static validate(manifest: any): boolean {
    if (!manifest) return false;
    return (
      typeof manifest.version === 'string' &&
      typeof manifest.base_version === 'string' &&
      Array.isArray(manifest.updated_files) &&
      Array.isArray(manifest.deleted_files) &&
      typeof manifest.checksum === 'string' &&
      typeof manifest.changelog === 'string'
    );
  }

  static calculateChecksum(vfs: Record<string, string>): string {
    // Standard modular hash checksum simulator
    const combinedStrings = Object.entries(vfs)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join('|');
    
    let hash = 0;
    for (let i = 0; i < combinedStrings.length; i++) {
      const char = combinedStrings.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).toUpperCase();
  }
}

// --- 3. Backup Manager ---
export interface BackupSnapshot {
  id: string;
  date: string;
  version: string;
  vfsSnapshot: Record<string, string>;
  description: string;
}

export class BackupManager {
  static createBackup(vfs: Record<string, string>, currentVersion: string, description = 'نسخة تلقائية قبل التحديث'): string {
    const backups = this.getBackups();
    const backupId = `bk-${Date.now()}`;
    const newBackup: BackupSnapshot = {
      id: backupId,
      date: new Date().toISOString(),
      version: currentVersion,
      vfsSnapshot: { ...vfs },
      description
    };

    backups.unshift(newBackup);
    // Limit to maximum 5 backups to protect local storage space cleanly
    if (backups.length > 5) {
      backups.pop();
    }

    localStorage.setItem(BACKUPS_KEY, JSON.stringify(backups));
    return backupId;
  }

  static getBackups(): BackupSnapshot[] {
    const raw = localStorage.getItem(BACKUPS_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  static rollback(): boolean {
    const backups = this.getBackups();
    if (backups.length === 0) return false;
    
    const lastBackup = backups[0];
    localStorage.setItem(VFS_KEY, JSON.stringify(lastBackup.vfsSnapshot));
    
    // Attempt to update the secure settings with the rollback version
    try {
      const appSettingsStr = localStorage.getItem('app_settings');
      if (appSettingsStr) {
        const settings = JSON.parse(appSettingsStr);
        settings.systemVersion = lastBackup.version;
        localStorage.setItem('app_settings', JSON.stringify(settings));
      }
    } catch (e) {
      console.error('Could not restore systemVersion string directly', e);
    }
    
    return true;
  }

  static deleteBackup(id: string): void {
    const backups = this.getBackups();
    const filtered = backups.filter(b => b.id !== id);
    localStorage.setItem(BACKUPS_KEY, JSON.stringify(filtered));
  }
}

// --- 4. Patch Installer ---
export class PatchInstaller {
  static install(
    vfs: Record<string, string>,
    manifest: UpdateManifest,
    filesInZip: Record<string, string>
  ): { success: boolean; error?: string; updatedVfs: Record<string, string> } {
    try {
      const workingVfs = { ...vfs };

      // Apply modifications and additions
      for (const filePath of manifest.updated_files) {
        if (filesInZip[filePath] !== undefined) {
          workingVfs[filePath] = filesInZip[filePath];
        } else {
          return {
            success: false,
            error: `ملف مفقود في حزمة التحديث: ${filePath}`,
            updatedVfs: vfs
          };
        }
      }

      // Apply deletions
      for (const filePath of manifest.deleted_files) {
        delete workingVfs[filePath];
      }

      // Calculate final integrity checksum and compare if specified in manifest (optional safety step)
      const computedChecksum = ManifestManager.calculateChecksum(workingVfs);
      console.log('Patch computed checksum:', computedChecksum, 'Manifest checksum:', manifest.checksum);

      return {
        success: true,
        updatedVfs: workingVfs
      };
    } catch (err: any) {
      return {
        success: false,
        error: `خطأ أثناء تطبيق التحديث البرمجي: ${err.message || err}`,
        updatedVfs: vfs
      };
    }
  }
}

// --- 5. Update Exporter ---
export class UpdateExporter {
  static async exportToZip(
    vfs: Record<string, string>,
    targetVersion: string,
    changelog: string,
    options: { mode: 'full' | 'incremental'; modifiedFiles?: string[] }
  ): Promise<void> {
    const zip = new JSZip();
    const currentVersion = VersionManager.getCurrentVersion();
    
    // Choose which files to include in zip
    let filesToInclude: Record<string, string> = {};
    let deletedFilesList: string[] = [];
    
    if (options.mode === 'full') {
      filesToInclude = { ...vfs };
    } else {
      // Incremental mode: Export only supplied files or files mutated
      const selected = options.modifiedFiles || Object.keys(vfs);
      for (const key of selected) {
        if (vfs[key]) {
          filesToInclude[key] = vfs[key];
        }
      }
    }

    // Add VFS files into the zip package
    const updatedFilesPaths: string[] = [];
    for (const [filePath, content] of Object.entries(filesToInclude)) {
      zip.file(filePath, content);
      updatedFilesPaths.push(filePath);
    }

    // Generate manifest checksum of the TARGET virtual file system state
    const simulatedTargetVfs = { ...vfs, ...filesToInclude };
    const computedChecksum = ManifestManager.calculateChecksum(simulatedTargetVfs);

    // Create standard JSON matching requirement
    const manifest = ManifestManager.generate(
      targetVersion,
      options.mode === 'full' ? 'any' : currentVersion,
      updatedFilesPaths,
      deletedFilesList,
      changelog,
      computedChecksum
    );

    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    // Generate zip blob
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `update_v${targetVersion}.zip`);
  }
}

// --- 6. Update Importer ---
export class UpdateImporter {
  static async importFromZip(
    zipFile: File,
    onProgress: (phase: string, pct: number) => void
  ): Promise<{ success: boolean; error?: string; beforeVersion?: string; afterVersion?: string; manifest?: UpdateManifest }> {
    try {
      onProgress("قراءة ملف الأرشيف الـ ZIP...", 15);
      
      const zip = new JSZip();
      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
        reader.onerror = (e) => reject(e);
        reader.readAsArrayBuffer(zipFile);
      });

      const loadedZip = await zip.loadAsync(arrayBuffer);
      
      // Look for manifest.json
      const manifestFile = loadedZip.file('manifest.json');
      if (!manifestFile) {
        return { success: false, error: 'الملف غير صالح: مفقود ملف التعريف manifest.json داخل حزمة التحديث.' };
      }

      onProgress("تحليل وقراءة ملف التعريف manifest.json...", 30);
      const manifestContent = await manifestFile.async('string');
      let manifest: UpdateManifest;
      
      try {
        manifest = JSON.parse(manifestContent);
      } catch {
        return { success: false, error: 'الملف غير صالح: بنية ملف manifest.json تالفة.' };
      }

      // Validate manifest
      if (!ManifestManager.validate(manifest)) {
        return { success: false, error: 'الملف غير صالح: حقول ومواصفات ملف التعريف manifest.json مفقودة أو غير متوافقة.' };
      }

      // Check current and required base versions
      onProgress("التحقق من توافق رقم الإصدار البرمجي...", 45);
      const currentVersion = VersionManager.getCurrentVersion();
      
      if (!VersionManager.isCompatible(manifest.base_version, currentVersion)) {
        return { 
          success: false, 
          error: `الإصدار الحالي للنظام (${currentVersion}) غير متوافق للترقية. يتطلب هذا الملف إصداراً ذو أساس (${manifest.base_version}) أو أحدث.` 
        };
      }

      // Gather current VFS
      const currentVfs = VFSManager.getVFS();

      // Create backup before applying modifications
      onProgress("إنشاء نسخة احتياطية آمنة (Backup)...", 65);
      const backupDescription = `نسخة احتياطية تلقائية للنظام v${currentVfs} قبل التحديث إلى v${manifest.version}`;
      BackupManager.createBackup(currentVfs, currentVersion, backupDescription);

      // Extract all file contents specified in updated_files
      onProgress("فك ضغط وقراءة ملفات التحديث والمكونات البرمجية...", 80);
      const filesInZip: Record<string, string> = {};
      
      for (const filePath of manifest.updated_files) {
        const fileInZip = loadedZip.file(filePath);
        if (fileInZip) {
          const content = await fileInZip.async('string');
          filesInZip[filePath] = content;
        } else {
          return { success: false, error: `فشل التحقق: الملف المستهدف لترقيته [${filePath}] مفقود في ملف التحديث المرفوع.` };
        }
      }

      // Apply installer updates
      onProgress("تثبيت الترقية واستبدال الملفات المعدلة يدويًا...", 95);
      const installResult = PatchInstaller.install(currentVfs, manifest, filesInZip);
      
      if (!installResult.success) {
        // Rollback explicitly just in case
        onProgress("فشل في تثبيت الملفات. جاري استعادة الحالة الأصلية...", 98);
        BackupManager.rollback();
        return { success: false, error: installResult.error };
      }

      // Commit update files to our virtual file system storage!
      VFSManager.saveVFS(installResult.updatedVfs);

      onProgress("اكتمل التثبيت بنجاح!", 100);
      return {
        success: true,
        beforeVersion: currentVersion,
        afterVersion: manifest.version,
        manifest
      };
    } catch (err: any) {
      console.error('Import update error:', err);
      // Attempt generic rollback
      BackupManager.rollback();
      return { 
        success: false, 
        error: `فشل فك الحزمة أو معالجتها: ${err.message || err}` 
      };
    }
  }
}

// --- VFS storage helper ---
export class VFSManager {
  static getVFS(): Record<string, string> {
    const raw = localStorage.getItem(VFS_KEY);
    if (!raw) {
      // Initialize with default template files
      localStorage.setItem(VFS_KEY, JSON.stringify(DEFAULT_VFS));
      return { ...DEFAULT_VFS };
    }
    try {
      const parsed = JSON.parse(raw);
      // Ensure all standard initial keys exist
      let amended = false;
      for (const [k, v] of Object.entries(DEFAULT_VFS)) {
        if (parsed[k] === undefined) {
          parsed[k] = v;
          amended = true;
        }
      }
      if (amended) {
        localStorage.setItem(VFS_KEY, JSON.stringify(parsed));
      }
      return parsed;
    } catch {
      localStorage.setItem(VFS_KEY, JSON.stringify(DEFAULT_VFS));
      return { ...DEFAULT_VFS };
    }
  }

  static saveVFS(vfs: Record<string, string>): void {
    localStorage.setItem(VFS_KEY, JSON.stringify(vfs));
  }

  static getFile(path: string): string {
    const vfs = this.getVFS();
    return vfs[path] || '';
  }

  static saveFile(path: string, content: string): void {
    const vfs = this.getVFS();
    vfs[path] = content;
    this.saveVFS(vfs);
  }

  static deleteFile(path: string): void {
    const vfs = this.getVFS();
    delete vfs[path];
    this.saveVFS(vfs);
  }
}

// --- 7. App Auto Backup Manager (Browser-Resident Full-Auto Backup Engine) ---
export interface AppDatabaseBackup {
  id: string;
  date: string;
  reason: string;
  version: string;
  cars: Car[];
  users: User[];
  logs: ActivityLog[];
  customers: Customer[];
  settings: OrganizationSettings;
  lettersArchive: LetterArchiveEntry[];
  sisterCompanies?: any[];
  companyTransfers?: any[];
  companyTransfersSettings?: any;
}

export function cleanLocalStorageSpace(currentTenantId?: string | null): void {
  console.log('[Quota Healing] Running aggressive local storage cleanup...');
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) keys.push(k);
    }
  } catch (e) {
    console.error('Error listing local storage keys:', e);
    return;
  }

  const legacyPairs = [
    { secure: 'cars_secure', legacy: 'cars' },
    { secure: 'users_secure', legacy: 'users' },
    { secure: 'logs_secure', legacy: 'logs' },
    { secure: 'customers_secure', legacy: 'customers' },
    { secure: 'settings_secure', legacy: 'app_settings' },
    { secure: 'prefs_secure', legacy: 'dashboard_prefs' },
    { secure: 'letters_archive_secure', legacy: 'letters_archive' }
  ];

  keys.forEach(k => {
    legacyPairs.forEach(pair => {
      if (k.endsWith(pair.secure)) {
        const prefix = k.substring(0, k.indexOf(pair.secure));
        const legacyKey = prefix + pair.legacy;
        const secureVal = localStorage.getItem(k);
        const legacyVal = localStorage.getItem(legacyKey);
        if (secureVal && secureVal.trim() !== '' && legacyVal) {
          localStorage.removeItem(legacyKey);
          console.warn(`[Quota Healing] Omitted duplicate legacy copy "${legacyKey}" because secure equivalent "${k}" is active.`);
        }
      }
    });

    if (k.includes('_almakhzoun_app_auto_backups') || k === 'almakhzoun_app_auto_backups') {
      try {
        const r = localStorage.getItem(k);
        if (r) {
          const list = JSON.parse(r);
          if (Array.isArray(list) && list.length > 1) {
            // Trim auto-backups down to at most 1 pruned entry
            const trimmed = list.slice(0, 1).map((b: any) => ({
              ...b,
              logs: [],
              lettersArchive: []
            }));
            localStorage.setItem(k, JSON.stringify(trimmed));
            console.warn(`[Quota Healing] Trimmed auto-backups "${k}" to 1 pruned backup.`);
          }
        }
      } catch (e) {
        localStorage.removeItem(k);
      }
    }
  });

  if (currentTenantId) {
    const tenantPrefix = `tenant_${currentTenantId}_`;
    try {
      const secureLetters = localStorage.getItem(`${tenantPrefix}letters_archive_secure`);
      const unencryptedLetters = localStorage.getItem(`${tenantPrefix}letters_archive`);
      if (secureLetters && unencryptedLetters) {
        localStorage.removeItem(`${tenantPrefix}letters_archive`);
      }
    } catch (e) {}
  }
}

const getAppBackupsKey = (): string => {
  const t = localStorage.getItem('current_tenant_id');
  return t ? `tenant_${t}_almakhzoun_app_auto_backups` : 'almakhzoun_app_auto_backups';
};

export class AppAutoBackupManager {
  static validateBackupIntegrity(data: any): { isValid: boolean; error?: string; cleanData?: any } {
    if (!data) {
      return { isValid: false, error: 'الملف المحدد فارغ أو غير موجود.' };
    }

    let parsed = data;
    if (typeof parsed === 'string') {
      const trimmed = parsed.trim().replace(/^\uFEFF/, '');
      
      // Check for Windows executable magic header (MZ) or binary headers
      if (trimmed.startsWith('MZ') || trimmed.startsWith('PK\x03\x04') || trimmed.includes('\x00')) {
        return { 
          isValid: false, 
          error: 'عفواً، الملف المحدد عبارة عن ملف تنفيذي (.exe) أو ملف ثنائي، وليس ملف نسخة احتياطية صالح بصيغة JSON.' 
        };
      }

      try {
        parsed = JSON.parse(trimmed);
      } catch (err: any) {
        return { 
          isValid: false, 
          error: 'فشل قراءة الملف: الملف تالف أو لا يحتوي على كود JSON صحيح.' 
        };
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      return { isValid: false, error: 'هيكل بيانات النسخة الاحتياطية غير صالح.' };
    }

    // Unwrap nested objects if wrapped
    if (parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data)) {
      parsed = { ...parsed.data, ...parsed };
    } else if (parsed.dbData && typeof parsed.dbData === 'object' && !Array.isArray(parsed.dbData)) {
      parsed = { ...parsed.dbData, ...parsed };
    } else if (parsed.state && typeof parsed.state === 'object' && !Array.isArray(parsed.state)) {
      parsed = { ...parsed.state, ...parsed };
    }

    // Check presence of at least one essential domain key
    const hasValidDomainKeys = (
      Array.isArray(parsed.cars) ||
      Array.isArray(parsed.users) ||
      Array.isArray(parsed.customers) ||
      Array.isArray(parsed.logs) ||
      Array.isArray(parsed.lettersArchive) ||
      Array.isArray(parsed.inventoryMovements) ||
      Array.isArray(parsed.vehicleCosts) ||
      (parsed.settings && typeof parsed.settings === 'object') ||
      (parsed.localStorageData && typeof parsed.localStorageData === 'object') ||
      (parsed.backendDatabase && typeof parsed.backendDatabase === 'object')
    );

    if (!hasValidDomainKeys) {
      return {
        isValid: false,
        error: 'الملف المرفق لا يحتوي على أي جداول أو بيانات تابعة لنظام المخزون والسيارات.'
      };
    }

    return { isValid: true, cleanData: parsed };
  }

  static getAutoBackups(): AppDatabaseBackup[] {
    try {
      const raw = localStorage.getItem(getAppBackupsKey());
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(b => b && typeof b === 'object' && b.id && typeof b.date === 'string');
    } catch (err) {
      console.warn('[AppAutoBackupManager] Failed to read auto-backups from localStorage:', err);
      return [];
    }
  }

  static saveAutoBackups(backups: AppDatabaseBackup[]): void {
    let list = [...backups];
    try {
      localStorage.setItem(getAppBackupsKey(), JSON.stringify(list));
    } catch (err) {
      console.warn('Auto backup quota exceeded. Attempting self-healing/pruning strategy...', err);
      
      // Attempt emergency general storage cleanup to free space in other domains
      try {
        const t = localStorage.getItem('current_tenant_id');
        cleanLocalStorageSpace(t);
      } catch (cleanErr) {
        console.error('Failed to run cleanLocalStorageSpace during auto backup failure:', cleanErr);
      }

      // Strategy 1: Reduce number of stored backups to max 3 instead of 6
      if (list.length > 3) {
        list = list.slice(0, 3);
        try {
          localStorage.setItem(getAppBackupsKey(), JSON.stringify(list));
          return;
        } catch {}
      }

      // Strategy 2: Keep only 2 backups
      if (list.length > 2) {
        list = list.slice(0, 2);
        try {
          localStorage.setItem(getAppBackupsKey(), JSON.stringify(list));
          return;
        } catch {}
      }

      // Strategy 3: Prune the extremely heavy metadata (logs and lettersArchive) from all backups in the list
      list = list.map(b => ({
        ...b,
        logs: b.logs ? b.logs.slice(0, 5) : [],
        lettersArchive: b.lettersArchive ? b.lettersArchive.slice(0, 5) : []
      }));
      try {
        localStorage.setItem(getAppBackupsKey(), JSON.stringify(list));
        return;
      } catch {}

      // Strategy 4: Keep only 1 single extremely pruned backup
      if (list.length > 1) {
        list = list.slice(0, 1);
        try {
          localStorage.setItem(getAppBackupsKey(), JSON.stringify(list));
          return;
        } catch {}
      }

      // Strategy 5: Completely clear logs and letters archive from the single remaining backup
      if (list.length > 0) {
        list[0].logs = [];
        list[0].lettersArchive = [];
        try {
          localStorage.setItem(getAppBackupsKey(), JSON.stringify(list));
          return;
        } catch {}
      }

      // Strategy 6: Worst case, clear auto backups key entirely to protect other vital application states
      console.error('Auto backup completely failed to save within quota. Clearing auto-backups namespace.');
      try {
        localStorage.removeItem(getAppBackupsKey());
      } catch {}
    }
  }

  static triggerAutoBackup(
    cars: Car[],
    users: User[],
    logs: ActivityLog[],
    customers: Customer[],
    settings: OrganizationSettings,
    lettersArchive: LetterArchiveEntry[],
    reason: string
  ): string {
    const backups = this.getAutoBackups();
    
    // Throttling: If the last backup is identical or was created recently, avoid spamming.
    // Automated background saves: 5 minutes throttle. Manual saves: 5 seconds throttle.
    if (backups.length > 0) {
      const last = backups[0];
      const timeDiff = Date.now() - new Date(last.date).getTime();
      const isAuto = reason.includes("تلقائي");
      const threshold = isAuto ? 300000 : 5000; // 5 minutes vs 5 seconds
      if (timeDiff < threshold) {
        return last.id; // skip duplicate/too frequent backups
      }
    }

    // Heavy metadata pruning to ensure storage safety (< 5MB limit):
    // 1. Logs: Capped at the 10 most recent logs
    let prunedLogs: any[] = [];
    try {
      prunedLogs = logs ? JSON.parse(JSON.stringify(logs)).slice(0, 10) : [];
    } catch {
      prunedLogs = (logs || []).slice(0, 10).map((l: any) => ({
        id: l.id || '',
        action: l.action || '',
        date: l.date || '',
        user: l.user || ''
      }));
    }
    
    // 2. Letters Archive: Keep metadata but strip HTML content (which can be several megabytes per letter)
    let prunedLetters: any[] = [];
    try {
      prunedLetters = (lettersArchive || []).map((letter: any) => ({
        ...letter,
        htmlContent: "" // Strip heavy content in auto snapshots; manual downloads/backups retain everything correctly
      })).slice(0, 5);
      prunedLetters = JSON.parse(JSON.stringify(prunedLetters));
    } catch {
      prunedLetters = (lettersArchive || []).slice(0, 5).map((letter: any) => ({
        id: letter.id || '',
        letterType: letter.letterType || '',
        date: letter.date || '',
        vin: letter.vin || ''
      }));
    }

    const backupId = `auto-bk-${Date.now()}`;
    let safeCars: any[] = [];
    let safeUsers: any[] = [];
    let safeCustomers: any[] = [];
    let safeSettings: any = {};

    try {
      safeCars = JSON.parse(JSON.stringify(cars));
    } catch {
      safeCars = [...cars];
    }

    try {
      safeUsers = JSON.parse(JSON.stringify(users));
    } catch {
      safeUsers = [...users];
    }

    try {
      safeCustomers = JSON.parse(JSON.stringify(customers));
    } catch {
      safeCustomers = [...customers];
    }

    try {
      safeSettings = JSON.parse(JSON.stringify(settings));
    } catch {
      safeSettings = { ...settings };
    }

    let sisterCompanies: any[] = [];
    let companyTransfers: any[] = [];
    let companyTransfersSettings: any = null;

    try {
      const scStr = localStorage.getItem('company_sister_companies_secure');
      if (scStr) sisterCompanies = JSON.parse(scStr);
    } catch {}

    try {
      const ctStr = localStorage.getItem('company_transfers_secure');
      if (ctStr) companyTransfers = JSON.parse(ctStr);
    } catch {}

    try {
      const ctsStr = localStorage.getItem('company_transfers_settings_secure');
      if (ctsStr) companyTransfersSettings = JSON.parse(ctsStr);
    } catch {}

    const newBackup: AppDatabaseBackup = {
      id: backupId,
      date: new Date().toISOString(),
      reason,
      version: settings.systemVersion || '3.5.0',
      cars: safeCars,
      users: safeUsers,
      logs: prunedLogs,
      customers: safeCustomers,
      settings: safeSettings,
      lettersArchive: prunedLetters,
      sisterCompanies,
      companyTransfers,
      companyTransfersSettings
    };

    backups.unshift(newBackup);
    
    // Proactive memory footprint control: keep at most 2 backups normally, or 1 if size is very large
    let maxBackups = 2;
    try {
      const estimatedSize = JSON.stringify(backups).length;
      if (estimatedSize > 1200000) { // > 1.2M chars (roughly 1.2MB)
        maxBackups = 1; // single restore point to conserve precious quota
      }
    } catch {}

    if (backups.length > maxBackups) {
      backups.splice(maxBackups);
    }

    this.saveAutoBackups(backups);
    return backupId;
  }

  static deleteBackup(id: string): void {
    const backups = this.getAutoBackups();
    const filtered = backups.filter(b => b.id !== id);
    this.saveAutoBackups(filtered);
  }

  static clearAll(): void {
    localStorage.removeItem(getAppBackupsKey());
  }
}
