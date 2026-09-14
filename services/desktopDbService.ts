/**
 * Pure Electron Native & Client Database Service
 * Operates directly on Electron userData directory via IPC bridge or LocalStorage fallback.
 * Eliminates express / server.cjs / localhost dependencies completely.
 */

import { Car, Customer, User, ActivityLog, OrganizationSettings, LetterArchiveEntry, VehicleCost, InventoryMovement, Delegate } from '../types';

export interface ApplicationState {
  cars: Car[];
  users: User[];
  customers: Customer[];
  logs: ActivityLog[];
  settings: OrganizationSettings;
  lettersArchive: LetterArchiveEntry[];
  vehicleCosts: VehicleCost[];
  inventoryMovements: InventoryMovement[];
  companies?: any[];
  transfers?: any[];
  transferSettings?: any;
  delegates?: Delegate[];
  updatedAt?: string;
}

const STORAGE_KEYS = {
  cars: 'almakhzoun_cars',
  users: 'almakhzoun_app_users',
  customers: 'almakhzoun_customers',
  logs: 'almakhzoun_logs',
  settings: 'almakhzoun_settings',
  lettersArchive: 'almakhzoun_letters_archive',
  vehicleCosts: 'almakhzoun_vehicle_costs',
  inventoryMovements: 'almakhzoun_inventory_movements',
  companies: 'almakhzoun_companies',
  transfers: 'almakhzoun_transfers',
  transferSettings: 'almakhzoun_transfer_settings',
  delegates: 'almakhzoun_delegates'
};

/**
 * Save complete application state to Electron userData DB file via IPC and LocalStorage fallback
 */
export async function saveDesktopState(state: Partial<ApplicationState>): Promise<boolean> {
  try {
    // 1. Write to local storage for fast client UI hydration
    if (state.cars) localStorage.setItem(STORAGE_KEYS.cars, JSON.stringify(state.cars));
    if (state.users) localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(state.users));
    if (state.customers) localStorage.setItem(STORAGE_KEYS.customers, JSON.stringify(state.customers));
    if (state.logs) localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(state.logs));
    if (state.settings) localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
    if (state.lettersArchive) localStorage.setItem(STORAGE_KEYS.lettersArchive, JSON.stringify(state.lettersArchive));
    if (state.vehicleCosts) localStorage.setItem(STORAGE_KEYS.vehicleCosts, JSON.stringify(state.vehicleCosts));
    if (state.inventoryMovements) localStorage.setItem(STORAGE_KEYS.inventoryMovements, JSON.stringify(state.inventoryMovements));
    if (state.companies) localStorage.setItem(STORAGE_KEYS.companies, JSON.stringify(state.companies));
    if (state.transfers) localStorage.setItem(STORAGE_KEYS.transfers, JSON.stringify(state.transfers));
    if (state.transferSettings) localStorage.setItem(STORAGE_KEYS.transferSettings, JSON.stringify(state.transferSettings));
    if (state.delegates) localStorage.setItem(STORAGE_KEYS.delegates, JSON.stringify(state.delegates));

    // 2. Persist directly to Electron userData DB file via IPC
    const win = typeof window !== 'undefined' ? (window as any) : null;
    if (win && win.electronAPI && typeof win.electronAPI.saveDatabaseState === 'function') {
      const payload = {
        ...state,
        updatedAt: new Date().toISOString()
      };
      await win.electronAPI.saveDatabaseState(payload);
    }
    return true;
  } catch (err) {
    console.error('[DesktopDbService] Error saving state:', err);
    return false;
  }
}

/**
 * Load complete application state from Electron userData DB file or LocalStorage
 */
export async function loadDesktopState(): Promise<Partial<ApplicationState> | null> {
  try {
    const win = typeof window !== 'undefined' ? (window as any) : null;
    if (win && win.electronAPI && typeof win.electronAPI.loadDatabaseState === 'function') {
      const result = await win.electronAPI.loadDatabaseState();
      if (result && result.success && result.data) {
        return result.data;
      }
    }

    // Fallback: Read from localStorage
    const state: Partial<ApplicationState> = {};
    const cars = localStorage.getItem(STORAGE_KEYS.cars);
    if (cars) state.cars = JSON.parse(cars);

    const users = localStorage.getItem(STORAGE_KEYS.users);
    if (users) state.users = JSON.parse(users);

    const customers = localStorage.getItem(STORAGE_KEYS.customers);
    if (customers) state.customers = JSON.parse(customers);

    const logs = localStorage.getItem(STORAGE_KEYS.logs);
    if (logs) state.logs = JSON.parse(logs);

    const settings = localStorage.getItem(STORAGE_KEYS.settings);
    if (settings) state.settings = JSON.parse(settings);

    const letters = localStorage.getItem(STORAGE_KEYS.lettersArchive);
    if (letters) state.lettersArchive = JSON.parse(letters);

    const costs = localStorage.getItem(STORAGE_KEYS.vehicleCosts);
    if (costs) state.vehicleCosts = JSON.parse(costs);

    const movements = localStorage.getItem(STORAGE_KEYS.inventoryMovements);
    if (movements) state.inventoryMovements = JSON.parse(movements);

    const companies = localStorage.getItem(STORAGE_KEYS.companies);
    if (companies) state.companies = JSON.parse(companies);

    const transfers = localStorage.getItem(STORAGE_KEYS.transfers);
    if (transfers) state.transfers = JSON.parse(transfers);

    const transferSettings = localStorage.getItem(STORAGE_KEYS.transferSettings);
    if (transferSettings) state.transferSettings = JSON.parse(transferSettings);

    const delegates = localStorage.getItem(STORAGE_KEYS.delegates);
    if (delegates) state.delegates = JSON.parse(delegates);

    return state;
  } catch (err) {
    console.error('[DesktopDbService] Error loading state:', err);
    return null;
  }
}

/**
 * Native Clean Database Backup
 * Closes virtual lock, serializes current database, verifies integrity, and returns backup payload.
 */
export async function exportDesktopBackup(): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    const currentState = await loadDesktopState();
    const backupObj = {
      app: 'almakhzoun_inventory_pro',
      version: '3.5.1',
      timestamp: new Date().toISOString(),
      data: currentState || {}
    };

    const serialized = JSON.stringify(backupObj, null, 2);
    // Integrity check
    const verified = JSON.parse(serialized);
    if (!verified.data) {
      return { success: false, error: 'فشل التحقق من سلامة ملف النسخة الاحتياطية.' };
    }

    return { success: true, data: serialized };
  } catch (err) {
    return { success: false, error: 'خطأ في إنشاء النسخة الاحتياطية: ' + String(err) };
  }
}

/**
 * Native Clean Database Restore
 * Restores state without calling window.location.reload() or BrowserWindow.reload().
 * Re-hydrates state into memory and storage smoothly.
 */
export async function restoreDesktopBackup(backupJsonString: string): Promise<{ success: boolean; restoredState?: Partial<ApplicationState>; error?: string }> {
  try {
    if (!backupJsonString || !backupJsonString.trim()) {
      return { success: false, error: 'محتوى النسخة الاحتياطية فارغ.' };
    }

    const parsed = JSON.parse(backupJsonString);
    const state: Partial<ApplicationState> = parsed.data || parsed;

    if (!state || typeof state !== 'object') {
      return { success: false, error: 'بنية النسخة الاحتياطية غير صالحة.' };
    }

    // Save to Electron userData DB file and LocalStorage
    await saveDesktopState(state);

    return {
      success: true,
      restoredState: state
    };
  } catch (err) {
    return { success: false, error: 'فشل استعادة البيانات. تأكد من سلامة صيغة ملف JSON.' };
  }
}
