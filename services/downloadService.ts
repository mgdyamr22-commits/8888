import { saveAs } from 'file-saver';

/**
 * Universal safe file downloader for both Electron (EXE) and Web Browser.
 * Prevents window navigation / blank dark screens by using native Electron IPC or FileSaver.
 */
export const saveFileSafely = async (
  content: string | Blob, 
  filename: string, 
  mimeType = 'application/json;charset=utf-8'
): Promise<{ success: boolean; method?: string; filePath?: string; canceled?: boolean; error?: any }> => {
  // 1. Detect Electron IPC / electronAPI
  const electronAPI = (window as any).electronAPI;
  let ipc: any = (window as any).ipcRenderer;
  if (!ipc && !electronAPI && (window as any).require) {
    try {
      ipc = (window as any).require('electron').ipcRenderer;
    } catch (e) {
      // Ignore if window.require fails in browser
    }
  }

  // Convert Blob content to string if using Electron IPC
  let strContent = '';
  if (typeof content === 'string') {
    strContent = content;
  } else {
    try {
      strContent = await content.text();
    } catch (e) {
      strContent = '';
    }
  }

  // 2. If running in Electron, use native Save Dialog via electronAPI or IPC
  if (electronAPI && typeof electronAPI.exportBackupFile === 'function') {
    try {
      const result = await electronAPI.exportBackupFile({
        content: strContent,
        filename
      });
      if (result && result.success) {
        return { success: true, method: 'electron', filePath: result.filePath };
      } else if (result && result.canceled) {
        return { success: false, canceled: true };
      }
    } catch (err) {
      console.warn('[downloadService] Electron API exportBackupFile failed, trying IPC fallback:', err);
    }
  }

  if (ipc && typeof ipc.invoke === 'function') {
    try {
      const result = await ipc.invoke('export-backup-file', {
        content: strContent,
        filename
      });
      if (result && result.success) {
        return { success: true, method: 'electron', filePath: result.filePath };
      } else if (result && result.canceled) {
        return { success: false, canceled: true };
      }
    } catch (err) {
      console.warn('[downloadService] Electron IPC save failed, using FileSaver fallback:', err);
    }
  }

  // 3. Fallback for Browser Mode: Use FileSaver (prevents window.location navigation)
  try {
    const blob = typeof content === 'string' 
      ? new Blob([content], { type: mimeType }) 
      : content;
    saveAs(blob, filename);
    return { success: true, method: 'filesaver' };
  } catch (err) {
    console.error('[downloadService] FileSaver download failed:', err);
    return { success: false, error: err };
  }
};

/**
 * Universal safe file opener/reader for both Electron (EXE) and Web Browser.
 */
export const openBackupFileSafely = async (): Promise<{ success: boolean; content?: string; canceled?: boolean; error?: any }> => {
  const electronAPI = (window as any).electronAPI;
  let ipc: any = (window as any).ipcRenderer;
  if (!ipc && !electronAPI && (window as any).require) {
    try {
      ipc = (window as any).require('electron').ipcRenderer;
    } catch (e) {}
  }

  if (electronAPI && typeof electronAPI.importBackupFile === 'function') {
    try {
      const result = await electronAPI.importBackupFile();
      if (result && result.success && result.content) {
        return { success: true, content: result.content };
      } else if (result && result.canceled) {
        return { success: false, canceled: true };
      }
    } catch (err) {
      console.warn('[downloadService] Electron API importBackupFile failed:', err);
    }
  }

  if (ipc && typeof ipc.invoke === 'function') {
    try {
      const result = await ipc.invoke('import-backup-file');
      if (result && result.success && result.content) {
        return { success: true, content: result.content };
      } else if (result && result.canceled) {
        return { success: false, canceled: true };
      }
    } catch (err) {
      console.warn('[downloadService] Electron IPC import failed:', err);
    }
  }

  return { success: false };
};
