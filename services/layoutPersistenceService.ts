/**
 * Table and Report Column & Layout Persistence Service
 * Supports Electron userData file storage + LocalStorage as high-performance runtime fallback.
 * Manages per-user column widths, ordering, visibility states, and responsive view preferences.
 */

const ipcRenderer = typeof window !== 'undefined' ? (window as any).ipcRenderer : null;
const LOCAL_STORAGE_KEY = 'almakhzoun_table_layout_pref';

export interface TableColumnConfig {
  key: string;
  label: string;
  visible: boolean;
  width?: string | number;
  minWidth?: number;
  order?: number;
  pinned?: 'left' | 'right' | false;
}

export interface TableLayoutSettings {
  columns?: TableColumnConfig[];
  columnWidths?: Record<string, string | number>;
  columnOrder?: string[];
  hiddenColumns?: string[];
  fontSize?: number;
  tableDensity?: 'compact' | 'normal' | 'relaxed';
  showStampArea?: boolean;
  showOrgLogo?: boolean;
  orientation?: 'portrait' | 'landscape';
  filters?: Record<string, any>;
  viewMode?: 'table' | 'grid' | 'auto';
  lastUpdated?: string;
  userId?: string;
}

// Memory cache for active settings
let memoryLayoutCache: Record<string, TableLayoutSettings> = {};

// Load cache initially from localStorage (synchronous fallback)
try {
  const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (cached) {
    memoryLayoutCache = JSON.parse(cached);
  }
} catch (e) {
  console.warn('[LayoutPersistence] Failed to initialize layout memories from localstorage:', e);
}

/**
 * Builds a scoped storage key taking into account the user context.
 */
export function getUserTableKey(tableKey: string, userId?: string): string {
  if (!tableKey) return '';
  if (userId && String(userId).trim()) {
    return `u_${String(userId).trim()}::${tableKey}`;
  }
  return tableKey;
}

/**
 * Initialize layouts from Electron local storage file (userData directory)
 */
export async function syncLayoutSettingsFromElectron(): Promise<Record<string, TableLayoutSettings> | null> {
  if (ipcRenderer && typeof ipcRenderer.invoke === 'function') {
    try {
      console.log('[LayoutPersistence] Requesting persistent layouts from Electron userData...');
      const electronData = await ipcRenderer.invoke('load-user-layout-settings-async');
      if (electronData && typeof electronData === 'object') {
        console.log('[LayoutPersistence] Successfully loaded settings from Electron file:', Object.keys(electronData));
        memoryLayoutCache = { ...memoryLayoutCache, ...electronData };
        // Sync back to localstorage to keep both in sync
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(memoryLayoutCache));
        
        // Dispatch custom event to notify React components that persistent preferences are ready
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('layout-preferences-synced'));
        }
        
        return memoryLayoutCache;
      }
    } catch (e) {
      console.error('[LayoutPersistence] Electron layout loading error, falling back to LocalStorage:', e);
    }
  }
  return null;
}

/**
 * Saves settings for a specific table or report view (with optional user scoping).
 * 
 * @param tableKey Unique identifier for the table/report (e.g., 'inventory', 'reports_pdf_excel')
 * @param settings Partial layout settings to update or save
 * @param userId Optional user identifier to isolate preferences per account
 * @param source Optional identifier for caller (e.g. 'CarManager_auto_save') to prevent loopbacks
 */
export function saveTableLayout(tableKey: string, settings: Partial<TableLayoutSettings>, userId?: string, source?: string) {
  if (!tableKey) return;
  
  const key = getUserTableKey(tableKey, userId);
  const current = memoryLayoutCache[key] || memoryLayoutCache[tableKey] || {};
  
  // Extract column widths and order automatically if columns are provided
  let columnWidths = settings.columnWidths || current.columnWidths || {};
  let columnOrder = settings.columnOrder || current.columnOrder;
  let hiddenColumns = settings.hiddenColumns || current.hiddenColumns;

  if (settings.columns && Array.isArray(settings.columns)) {
    columnOrder = settings.columns.map(c => c.key);
    hiddenColumns = settings.columns.filter(c => !c.visible).map(c => c.key);
    const newWidths: Record<string, string | number> = { ...columnWidths };
    settings.columns.forEach(c => {
      if (c.width !== undefined) {
        newWidths[c.key] = c.width;
      }
    });
    columnWidths = newWidths;
  }

  const updated: TableLayoutSettings = {
    ...current,
    ...settings,
    columnWidths,
    columnOrder,
    hiddenColumns,
    userId: userId || current.userId,
    lastUpdated: new Date().toISOString(),
  };

  // Compare content excluding lastUpdated to avoid redundant cycles
  const currentComparable = { ...current, lastUpdated: undefined };
  const updatedComparable = { ...updated, lastUpdated: undefined };
  if (JSON.stringify(currentComparable) === JSON.stringify(updatedComparable)) {
    return;
  }
  
  memoryLayoutCache[key] = updated;

  // Also maintain the general fallback key if userId was specified
  if (userId) {
    memoryLayoutCache[tableKey] = {
      ...(memoryLayoutCache[tableKey] || {}),
      ...updated,
    };
  }

  // 1. Instantly write to LocalStorage for zero-latency UI re-render and browser support
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(memoryLayoutCache));
  } catch (e) {
    console.error('[LayoutPersistence] Failed to write layout settings to LocalStorage:', e);
  }

  // 2. Persist to local JSON file via Electron main process if available
  if (ipcRenderer && typeof ipcRenderer.send === 'function') {
    ipcRenderer.send('save-user-layout-settings', memoryLayoutCache);
  }

  // Notify listeners of layout updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('layout-preferences-updated', { detail: { tableKey, key, userId, source } }));
  }
}

/**
 * Loads layout settings for a specific table or report view (with user scoping and fallback).
 * 
 * @param tableKey Unique identifier for the table/report
 * @param userId Optional user identifier to load per-user preference
 * @returns TableLayoutSettings or null
 */
export function loadTableLayout(tableKey: string, userId?: string): TableLayoutSettings | null {
  if (!tableKey) return null;
  
  const userKey = getUserTableKey(tableKey, userId);
  if (userId && memoryLayoutCache[userKey]) {
    return memoryLayoutCache[userKey];
  }
  
  return memoryLayoutCache[tableKey] || null;
}

/**
 * Convenience helper to save detailed column preferences specifically.
 */
export function saveColumnPreferences(
  tableKey: string, 
  columns: TableColumnConfig[], 
  options?: { 
    userId?: string; 
    columnWidths?: Record<string, string | number>; 
    viewMode?: 'table' | 'grid' | 'auto';
    filters?: Record<string, any>;
  }
) {
  saveTableLayout(tableKey, {
    columns,
    columnWidths: options?.columnWidths,
    viewMode: options?.viewMode,
    filters: options?.filters,
  }, options?.userId);
}

/**
 * Convenience helper to load column preferences with fallback reconstruction.
 */
export function loadColumnPreferences(tableKey: string, userId?: string): {
  columns?: TableColumnConfig[];
  columnWidths?: Record<string, string | number>;
  viewMode?: 'table' | 'grid' | 'auto';
  hiddenColumns?: string[];
  columnOrder?: string[];
} | null {
  const layout = loadTableLayout(tableKey, userId);
  if (!layout) return null;

  return {
    columns: layout.columns,
    columnWidths: layout.columnWidths,
    viewMode: layout.viewMode,
    hiddenColumns: layout.hiddenColumns,
    columnOrder: layout.columnOrder,
  };
}

/**
 * Clear layout settings for a specific table or revert to defaults
 */
export function clearTableLayout(tableKey: string, userId?: string) {
  if (!tableKey) return;
  const userKey = getUserTableKey(tableKey, userId);
  
  delete memoryLayoutCache[userKey];
  if (!userId) {
    delete memoryLayoutCache[tableKey];
  }
  
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(memoryLayoutCache));
  } catch (e) {
    console.error('[LayoutPersistence] Failed to reset layout settings in LocalStorage:', e);
  }

  if (ipcRenderer && typeof ipcRenderer.send === 'function') {
    ipcRenderer.send('save-user-layout-settings', memoryLayoutCache);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('layout-preferences-updated', { detail: { tableKey, userKey, userId } }));
  }
}

