/**
 * Local Directory Backup Service
 * Allows users to select a folder on their local computer/device and automatically
 * saves scheduled full-system backups directly into that folder using the
 * Web File System Access API (window.showDirectoryPicker) or Electron Native IPC.
 */

import { saveFileSafely } from './downloadService';

const IDB_DB_NAME = 'AlmakhzounDirectoryHandleDB';
const IDB_STORE_NAME = 'directory_handles';
const HANDLE_KEY = 'local_backup_folder_handle';

/**
 * Open or initialize the IndexedDB store for holding directory handles.
 */
function openHandleDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not supported in this environment.'));
    }
    const request = indexedDB.open(IDB_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Check if the Modern Web File System Access API is supported.
 */
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/**
 * Check if the application is currently running inside an iframe.
 */
export function isInIframe(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch (e) {
    return true;
  }
}

/**
 * Check if running in Electron environment.
 */
export function isElectronEnv(): boolean {
  return !!(
    (window as any).electronAPI ||
    (window as any).ipcRenderer ||
    ((window as any).require && (window as any).process?.versions?.electron)
  );
}

/**
 * Store a FileSystemDirectoryHandle persistently in IndexedDB.
 */
export async function storeDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
    const store = tx.objectStore(IDB_STORE_NAME);
    const req = store.put(handle, HANDLE_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieve the saved FileSystemDirectoryHandle from IndexedDB.
 */
export async function getStoredDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openHandleDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.get(HANDLE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn('[LocalDirectoryBackup] Failed to get stored directory handle:', err);
    return null;
  }
}

/**
 * Clear the saved directory handle from IndexedDB.
 */
export async function clearStoredDirectoryHandle(): Promise<void> {
  try {
    const db = await openHandleDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.delete(HANDLE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch (err) {
    console.warn('[LocalDirectoryBackup] Failed to clear directory handle:', err);
  }
}

/**
 * Verify or query permissions for the directory handle.
 */
export async function verifyDirectoryPermission(
  handle: FileSystemDirectoryHandle,
  requestIfNeeded = false
): Promise<boolean> {
  try {
    const options = { mode: 'readwrite' as const };
    if ((await (handle as any).queryPermission(options)) === 'granted') {
      return true;
    }
    if (requestIfNeeded) {
      if ((await (handle as any).requestPermission(options)) === 'granted') {
        return true;
      }
    }
    return false;
  } catch (err) {
    console.warn('[LocalDirectoryBackup] Error checking directory permission:', err);
    return false;
  }
}

/**
 * Prompt user to select a folder on their device and save the handle/path.
 * Opens the native operating system file explorer / folder selection window directly.
 */
export async function promptSelectBackupDirectory(): Promise<{
  success: boolean;
  dirName?: string;
  canceled?: boolean;
  error?: string;
}> {
  // 1. Electron handling
  const electronAPI = (window as any).electronAPI;
  let ipc = (window as any).ipcRenderer;
  if (!ipc && !electronAPI && (window as any).require) {
    try {
      ipc = (window as any).require('electron').ipcRenderer;
    } catch (e) {}
  }

  if (electronAPI && typeof electronAPI.selectBackupDirectory === 'function') {
    try {
      const res = await electronAPI.selectBackupDirectory();
      if (res && res.success && res.dirPath) {
        localStorage.setItem('local_disk_backup_dir_name', res.dirPath);
        return { success: true, dirName: res.dirPath };
      } else if (res && res.canceled) {
        return { success: false, canceled: true };
      }
    } catch (err: any) {
      console.warn('[LocalDirectoryBackup] Electron directory select failed:', err);
    }
  }

  if (ipc && typeof ipc.invoke === 'function') {
    try {
      const res = await ipc.invoke('select-backup-directory');
      if (res && res.success && res.dirPath) {
        localStorage.setItem('local_disk_backup_dir_name', res.dirPath);
        return { success: true, dirName: res.dirPath };
      } else if (res && res.canceled) {
        return { success: false, canceled: true };
      }
    } catch (err: any) {
      console.warn('[LocalDirectoryBackup] Electron IPC directory select failed:', err);
    }
  }

  // 2. Web File System Access API (window.showDirectoryPicker)
  if (isFileSystemAccessSupported() && !isInIframe()) {
    try {
      const handle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents'
      });

      if (!handle) {
        return { success: false, canceled: true };
      }

      await storeDirectoryHandle(handle);
      const dirName = handle.name || 'مجلد على الجهاز';
      localStorage.setItem('local_disk_backup_dir_name', dirName);
      return { success: true, dirName };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, canceled: true };
      }
      console.warn('[LocalDirectoryBackup] showDirectoryPicker failed, falling back to input folder picker:', err);
    }
  }

  // 3. Native OS Folder Chooser via webkitdirectory input (Opens Windows / Mac folder dialog directly)
  return promptSelectDirectoryViaInput();
}

/**
 * Open the native operating system folder selection dialog via webkitdirectory input.
 */
export function promptSelectDirectoryViaInput(): Promise<{
  success: boolean;
  dirName?: string;
  canceled?: boolean;
  error?: string;
}> {
  return new Promise((resolve) => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      (input as any).webkitdirectory = true;
      (input as any).directory = true;
      input.setAttribute('webkitdirectory', '');
      input.setAttribute('directory', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      input.style.top = '-9999px';

      let isHandled = false;

      input.onchange = (event: any) => {
        isHandled = true;
        const files = event.target.files;
        if (files && files.length > 0) {
          const sampleFile = files[0];
          const relativePath = sampleFile.webkitRelativePath || '';
          const folderName = relativePath.split('/')[0] || sampleFile.name || 'المجلد المحدد على الجهاز';
          localStorage.setItem('local_disk_backup_dir_name', folderName);
          resolve({ success: true, dirName: folderName });
        } else {
          // If empty folder selected or canceled
          const fallback = 'مجلد تم اختياره على جهازك';
          localStorage.setItem('local_disk_backup_dir_name', fallback);
          resolve({ success: true, dirName: fallback });
        }
        if (document.body.contains(input)) {
          document.body.removeChild(input);
        }
      };

      input.oncancel = () => {
        isHandled = true;
        if (document.body.contains(input)) {
          document.body.removeChild(input);
        }
        resolve({ success: false, canceled: true });
      };

      document.body.appendChild(input);
      input.click();
    } catch (err: any) {
      console.error('[LocalDirectoryBackup] promptSelectDirectoryViaInput error:', err);
      resolve({ success: false, error: err.message || 'فشل فتح نافذة اختيار المجلد' });
    }
  });
}

/**
 * Create a complete, self-contained system backup JSON payload string
 * including all client stores, local storage state, and backend database tables.
 */
export async function createFullSystemBackupPayload(customSettings?: any): Promise<string> {
  let backendDb = null;
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 2000) : null;
    const res = await fetch('/api/auth/backup-db', {
      signal: controller ? controller.signal : undefined
    }).catch(() => null);
    if (timeoutId) clearTimeout(timeoutId);

    if (res && res.ok) {
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const resData = await res.json().catch(() => null);
        if (resData && resData.success) {
          backendDb = resData.dbData;
        }
      }
    }
  } catch (err) {
    console.warn('[LocalDirectoryBackup] Backend DB fetch skipped/timed out:', err);
  }

  const localStorageData: Record<string, string> = {};
  if (typeof localStorage !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !key.includes('almakhzoun_emergency_rollback')) {
        localStorageData[key] = localStorage.getItem(key) || '';
      }
    }
  }

  const version = customSettings?.systemVersion || 
    (typeof localStorage !== 'undefined' && localStorage.getItem('almakhzoun_system_version')) || 
    '3.5.1';

  const backup = {
    backupType: "FULL_SYSTEM_BACKUP",
    version,
    exportDate: new Date().toISOString(),
    localStorageData,
    backendDatabase: backendDb
  };

  return JSON.stringify(backup, null, 2);
}

/**
 * Helper to resolve the saved backup directory path across localStorage and multi-tenant settings.
 */
export function resolveSavedBackupDirectory(): string {
  if (typeof localStorage === 'undefined') return '';
  const dir = localStorage.getItem('local_disk_backup_dir_name');
  if (dir && dir.trim()) return dir.trim();

  // Try current tenant app_settings
  try {
    const tenantId = localStorage.getItem('current_tenant_id') || 'org-default';
    const rawTenantSettings = localStorage.getItem(`tenant_${tenantId}_app_settings`);
    if (rawTenantSettings) {
      const s = JSON.parse(rawTenantSettings);
      if (s.localDiskAutoBackupDirName && s.localDiskAutoBackupDirName.trim()) {
        const d = s.localDiskAutoBackupDirName.trim();
        localStorage.setItem('local_disk_backup_dir_name', d);
        return d;
      }
    }
  } catch (e) {}

  // Try global app_settings
  try {
    const raw = localStorage.getItem('app_settings') || localStorage.getItem('almakhzoun_settings');
    if (raw) {
      const s = JSON.parse(raw);
      if (s.localDiskAutoBackupDirName && s.localDiskAutoBackupDirName.trim()) {
        const d = s.localDiskAutoBackupDirName.trim();
        localStorage.setItem('local_disk_backup_dir_name', d);
        return d;
      }
    }
  } catch (e) {}

  return '';
}

/**
 * Save a backup JSON file directly into the designated local directory.
 * Updates the same daily file in-place during the day (YYYY-MM-DD),
 * and creates a new file only when a new day begins.
 */
export async function saveBackupToLocalDirectory(
  fileContent?: string,
  prefix = 'almakhzoun_auto_backup',
  maxFilesToKeep = 20
): Promise<{
  success: boolean;
  filename: string;
  dirName?: string;
  sizeBytes?: number;
  error?: string;
  fallbackUsed?: boolean;
}> {
  // If file content wasn't provided, generate it automatically
  const actualContent = fileContent || (await createFullSystemBackupPayload());

  // Format daily date string (YYYY-MM-DD) so the same file is updated throughout the day
  const todayStr = new Date().toISOString().split('T')[0];
  const filename = `${prefix}_${todayStr}.json`;
  const sizeBytes = new Blob([actualContent]).size;

  // 1. Electron Native Direct File System Save (Completely Silent, No Prompts / Dialogs)
  const electronAPI = (window as any).electronAPI;
  let ipc = (window as any).ipcRenderer;
  if (!ipc && !electronAPI && (window as any).require) {
    try {
      ipc = (window as any).require('electron').ipcRenderer;
    } catch (e) {}
  }

  const savedDirName = resolveSavedBackupDirectory();

  if (electronAPI && typeof electronAPI.saveBackupToDirectory === 'function' && savedDirName) {
    try {
      const res = await electronAPI.saveBackupToDirectory({
        dirPath: savedDirName,
        filename,
        content: actualContent,
        maxKeep: maxFilesToKeep
      });
      if (res && res.success) {
        return {
          success: true,
          filename,
          dirName: savedDirName,
          sizeBytes: res.sizeBytes || sizeBytes
        };
      } else {
        return {
          success: false,
          filename,
          error: res?.error || 'فشل حفظ النسخة في المجلد المحدد'
        };
      }
    } catch (err: any) {
      console.error('[LocalDirectoryBackup] Electron direct save error:', err);
      return {
        success: false,
        filename,
        error: err.message || 'فشل حفظ النسخة في المجلد المحدد'
      };
    }
  }

  if (ipc && typeof ipc.invoke === 'function' && savedDirName) {
    try {
      const res = await ipc.invoke('save-backup-to-directory', {
        dirPath: savedDirName,
        filename,
        content: actualContent,
        maxKeep: maxFilesToKeep
      });
      if (res && res.success) {
        return {
          success: true,
          filename,
          dirName: savedDirName,
          sizeBytes: res.sizeBytes || sizeBytes
        };
      } else {
        return {
          success: false,
          filename,
          error: res?.error || 'فشل حفظ النسخة في المجلد المحدد'
        };
      }
    } catch (err: any) {
      console.error('[LocalDirectoryBackup] Electron IPC save error:', err);
      return {
        success: false,
        filename,
        error: err.message || 'فشل حفظ النسخة في المجلد المحدد'
      };
    }
  }

  // 2. Web File System Access API (In Browser Mode)
  const handle = await getStoredDirectoryHandle();
  if (handle) {
    try {
      const hasPerm = await verifyDirectoryPermission(handle, false);
      if (!hasPerm) {
        // If permission isn't granted silently, we try to request
        const requested = await verifyDirectoryPermission(handle, true);
        if (!requested) {
          throw new Error('لم يتم منح إذن الكتابة في المجلد المحدد على جهازك.');
        }
      }

      // Create / Open existing daily file inside the directory (updates in-place)
      const fileHandle = await (handle as any).getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(actualContent);
      await writable.close();

      // Optional cleanup of older daily backups only if maxKeep > 0
      if (maxFilesToKeep && maxFilesToKeep > 0) {
        cleanupOldLocalBackups(handle, prefix, maxFilesToKeep).catch((err) => {
          console.warn('[LocalDirectoryBackup] Cleanup old files failed:', err);
        });
      }

      return {
        success: true,
        filename,
        dirName: handle.name || savedDirName || 'المجلد المحلي',
        sizeBytes
      };
    } catch (err: any) {
      console.error('[LocalDirectoryBackup] Writing to directory handle failed:', err);
      return { success: false, filename, error: err.message || 'فشل حفظ الملف بالمجلد' };
    }
  }

  // 3. If in Electron without a directory configured, notify user to pick a folder first
  if (isElectronEnv()) {
    return {
      success: false,
      filename,
      error: 'يرجى تحديد مجلد الحفظ على جهازك أولاً لتفعيل النسخ التلقائي الصامت.'
    };
  }

  // 4. Browser Only Fallback: If no directory handle was configured yet in Web mode
  try {
    const fallbackRes = await saveFileSafely(fileContent, filename);
    if (fallbackRes.success) {
      return {
        success: true,
        filename,
        dirName: 'مجلد التنزيلات الافتراضي',
        sizeBytes,
        fallbackUsed: true
      };
    }
    return { success: false, filename, error: 'تعذر حفظ الملف' };
  } catch (err: any) {
    return { success: false, filename, error: err.message || 'فشل الحفظ' };
  }
}

/**
 * Clean up old local backups in the directory if exceeding max count.
 */
async function cleanupOldLocalBackups(
  handle: FileSystemDirectoryHandle,
  prefix: string,
  maxKeep: number
): Promise<void> {
  // If maxKeep <= 0, it means unlimited retention (keep all files)
  if (!maxKeep || maxKeep <= 0) return;

  try {
    const backupFiles: { name: string; handle: any }[] = [];
    // Iterate entries
    for await (const [name, entryHandle] of (handle as any).entries()) {
      if (name.startsWith(prefix) && name.endsWith('.json')) {
        backupFiles.push({ name, handle: entryHandle });
      }
    }

    if (backupFiles.length > maxKeep) {
      // Sort alphabetically by filename (which has ISO date inside)
      backupFiles.sort((a, b) => a.name.localeCompare(b.name));
      const filesToDelete = backupFiles.slice(0, backupFiles.length - maxKeep);

      for (const item of filesToDelete) {
        try {
          await (handle as any).removeEntry(item.name);
          console.log(`[LocalDirectoryBackup] Removed old backup file: ${item.name}`);
        } catch (e) {
          console.warn(`[LocalDirectoryBackup] Failed to remove old file ${item.name}:`, e);
        }
      }
    }
  } catch (e) {
    console.warn('[LocalDirectoryBackup] Old files cleanup error:', e);
  }
}

/**
 * List existing backup files currently saved in the selected directory.
 */
export async function listFilesFromLocalDirectory(prefix = 'almakhzoun'): Promise<
  Array<{ name: string; size?: number; lastModified?: string }>
> {
  const electronAPI = (window as any).electronAPI;
  let ipc = (window as any).ipcRenderer;
  if (!ipc && !electronAPI && (window as any).require) {
    try {
      ipc = (window as any).require('electron').ipcRenderer;
    } catch (e) {}
  }

  const savedDirName = resolveSavedBackupDirectory();

  // Electron native directory listing
  if (electronAPI && typeof electronAPI.listBackupDirectoryFiles === 'function' && savedDirName) {
    try {
      const res = await electronAPI.listBackupDirectoryFiles({ dirPath: savedDirName, prefix });
      if (res && res.success && Array.isArray(res.files)) {
        return res.files;
      }
    } catch (err) {
      console.warn('[LocalDirectoryBackup] Electron list files error:', err);
    }
  }

  if (ipc && typeof ipc.invoke === 'function' && savedDirName) {
    try {
      const res = await ipc.invoke('list-backup-directory-files', { dirPath: savedDirName, prefix });
      if (res && res.success && Array.isArray(res.files)) {
        return res.files;
      }
    } catch (err) {
      console.warn('[LocalDirectoryBackup] Electron IPC list files error:', err);
    }
  }

  // Web File System Access API listing
  const handle = await getStoredDirectoryHandle();
  if (!handle) return [];

  const results: Array<{ name: string; size?: number; lastModified?: string }> = [];

  try {
    const hasPerm = await verifyDirectoryPermission(handle, false);
    if (!hasPerm) return [];

    for await (const [name, entryHandle] of (handle as any).entries()) {
      if (name.includes(prefix) && name.endsWith('.json')) {
        try {
          const file = await entryHandle.getFile();
          results.push({
            name,
            size: file.size,
            lastModified: new Date(file.lastModified).toISOString()
          });
        } catch {
          results.push({ name });
        }
      }
    }

    // Sort newest first
    results.sort((a, b) => (b.lastModified || b.name).localeCompare(a.lastModified || a.name));
  } catch (err) {
    console.warn('[LocalDirectoryBackup] listFilesFromLocalDirectory error:', err);
  }

  return results;
}

/**
 * Read the content of a specific backup file from the saved local directory.
 */
export async function readBackupFileFromLocalDirectory(fileName: string): Promise<string | null> {
  const electronAPI = (window as any).electronAPI;
  let ipc = (window as any).ipcRenderer;
  if (!ipc && !electronAPI && (window as any).require) {
    try {
      ipc = (window as any).require('electron').ipcRenderer;
    } catch (e) {}
  }

  const savedDirName = resolveSavedBackupDirectory();

  // Electron native read
  if (electronAPI && typeof electronAPI.readBackupDirectoryFile === 'function' && savedDirName) {
    try {
      const res = await electronAPI.readBackupDirectoryFile({ dirPath: savedDirName, fileName });
      if (res && res.success && typeof res.content === 'string') {
        return res.content;
      }
    } catch (err) {
      console.warn('[LocalDirectoryBackup] Electron read file error:', err);
    }
  }

  if (ipc && typeof ipc.invoke === 'function' && savedDirName) {
    try {
      const res = await ipc.invoke('read-backup-directory-file', { dirPath: savedDirName, fileName });
      if (res && res.success && typeof res.content === 'string') {
        return res.content;
      }
    } catch (err) {
      console.warn('[LocalDirectoryBackup] Electron IPC read file error:', err);
    }
  }

  // Electron native read
  if (electronAPI && typeof electronAPI.readBackupDirectoryFile === 'function' && savedDirName) {
    try {
      const res = await electronAPI.readBackupDirectoryFile({ dirPath: savedDirName, fileName });
      if (res && res.success && typeof res.content === 'string') {
        return res.content;
      }
    } catch (err) {
      console.warn('[LocalDirectoryBackup] Electron read file error:', err);
    }
  }

  if (ipc && typeof ipc.invoke === 'function' && savedDirName) {
    try {
      const res = await ipc.invoke('read-backup-directory-file', { dirPath: savedDirName, fileName });
      if (res && res.success && typeof res.content === 'string') {
        return res.content;
      }
    } catch (err) {
      console.warn('[LocalDirectoryBackup] Electron IPC read file error:', err);
    }
  }

  // Web File System API read
  const handle = await getStoredDirectoryHandle();
  if (!handle) return null;

  try {
    const hasPerm = await verifyDirectoryPermission(handle, true);
    if (!hasPerm) return null;

    const fileHandle = await (handle as any).getFileHandle(fileName);
    const file = await fileHandle.getFile();
    return await file.text();
  } catch (err) {
    console.error('[LocalDirectoryBackup] readBackupFileFromLocalDirectory error:', err);
    return null;
  }
}
