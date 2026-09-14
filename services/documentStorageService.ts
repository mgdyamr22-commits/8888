// Standalone storage service using browser-native IndexedDB or LocalStorage based on system configuration.
// It bypasses traditional sandbox limitations and offers isolated, secure storage with foreign key relationships.

export interface VehicleDocument {
  id: string;
  carId: string;
  vin: string;
  category: string; // e.g., 'استمارة', 'اللوحات', 'إذن خروج', etc.
  fileName: string;
  fileType: string;
  fileData: string; // Base64 Data URL or blob data
  notes?: string;
  isArchived: boolean;
  uploadDate: string;
  uploadedBy: string;
  lastModifiedDate: string;
}

const BASE_DB_NAME = 'VehicleDocumentsCenterDB';
const STORE_NAME = 'vehicle_documents';
const DB_VERSION = 1;

class DocumentStorageService {
  private db: IDBDatabase | null = null;
  private currentDbTenantId: string | null = null;
  private isInitializing = false;
  private initPromise: Promise<IDBDatabase> | null = null;

  private getTenantId(): string {
    return localStorage.getItem('current_tenant_id') || 'default';
  }

  private getTenantPrefix(): string {
    const t = this.getTenantId();
    return t ? `tenant_${t}_` : '';
  }

  private getStorageType(): 'indexeddb' | 'localstorage' | 'cloud_drive_folder' | 'local_folder' {
    try {
      const tenantPrefix = this.getTenantPrefix();
      let raw = localStorage.getItem(`${tenantPrefix}settings_secure`);
      if (!raw) {
        raw = localStorage.getItem(`${tenantPrefix}app_settings`);
      }
      if (!raw) {
        raw = localStorage.getItem('app_settings');
      }
      if (raw) {
        let parsed: any = null;
        if (raw.startsWith('{')) {
          parsed = JSON.parse(raw);
        } else {
          try {
            const cleanStr = raw.trim();
            if (cleanStr.startsWith('{')) {
              parsed = JSON.parse(cleanStr);
            }
          } catch {
            // Ignore
          }
        }
        if (parsed && parsed.documentStorageType) {
          return parsed.documentStorageType;
        }
      }
    } catch (e) {
      console.error("Failed to read document storage type configuration:", e);
    }
    return 'indexeddb';
  }

  private getLocalstorageDocuments(): VehicleDocument[] {
    try {
      const raw = localStorage.getItem(`${this.getTenantPrefix()}localstorage_vehicle_documents`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveLocalstorageDocuments(docs: VehicleDocument[]): void {
    localStorage.setItem(`${this.getTenantPrefix()}localstorage_vehicle_documents`, JSON.stringify(docs));
  }

  public async initDb(): Promise<IDBDatabase> {
    const activeTenant = this.getTenantId();
    if (this.db && this.currentDbTenantId === activeTenant) return this.db;

    if (this.db && this.currentDbTenantId !== activeTenant) {
      try {
        this.db.close();
      } catch (e) {
        console.error("Error closing remote connection:", e);
      }
      this.db = null;
      this.initPromise = null;
    }

    this.currentDbTenantId = activeTenant;
    this.isInitializing = true;
    this.initPromise = new Promise((resolve, reject) => {
      try {
        const dbNameForTenant = `${BASE_DB_NAME}_${activeTenant}`;
        const request = indexedDB.open(dbNameForTenant, DB_VERSION);

        request.onupgradeneeded = (event: any) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('carId', 'carId', { unique: false });
            store.createIndex('vin', 'vin', { unique: false });
            store.createIndex('category', 'category', { unique: false });
          }
        };

        request.onsuccess = (event: any) => {
          this.db = event.target.result;
          this.isInitializing = false;
          resolve(this.db!);
        };

        request.onerror = (event: any) => {
          this.isInitializing = false;
          console.error('IndexedDB failed to load:', event.target.error);
          reject(event.target.error);
        };
      } catch (err) {
        this.isInitializing = false;
        console.error('IndexedDB open block error:', err);
        reject(err);
      }
    });

    return this.initPromise;
  }

  private async getStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.initDb();
    const tx = db.transaction(STORE_NAME, mode);
    return tx.objectStore(STORE_NAME);
  }

  public async getDocumentsForCar(carId: string, returnAll = false): Promise<VehicleDocument[]> {
    if (this.getStorageType() === 'localstorage') {
      let docs = this.getLocalstorageDocuments().filter(d => d.carId === carId);
      if (!returnAll) {
        docs = docs.filter(doc => !doc.isArchived);
      }
      return docs;
    }

    return new Promise(async (resolve, reject) => {
      try {
        const store = await this.getStore('readonly');
        const index = store.index('carId');
        const request = index.getAll(carId);

        request.onsuccess = () => {
          let docs = request.result as VehicleDocument[] || [];
          if (!returnAll) {
            docs = docs.filter(doc => !doc.isArchived);
          }
          resolve(docs);
        };

        request.onerror = (e: any) => {
          reject(e.target.error);
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  public async getAllDocuments(returnAll = true): Promise<VehicleDocument[]> {
    if (this.getStorageType() === 'localstorage') {
      let docs = this.getLocalstorageDocuments();
      if (!returnAll) {
        docs = docs.filter(doc => !doc.isArchived);
      }
      return docs;
    }

    return new Promise(async (resolve, reject) => {
      try {
        const store = await this.getStore('readonly');
        const request = store.getAll();

        request.onsuccess = () => {
          let docs = request.result as VehicleDocument[] || [];
          if (!returnAll) {
            docs = docs.filter(doc => !doc.isArchived);
          }
          resolve(docs);
        };

        request.onerror = (e: any) => {
          reject(e.target.error);
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  private getCategoryEnum(categoryName?: string): 'customs' | 'exit_permit' | 'plates' | 'reports' | 'root' {
    if (!categoryName) return 'root';
    const name = categoryName.trim();
    if (name.includes('جمرك') || name.includes('بيان') || name.includes('جمارك')) return 'customs';
    if (name.includes('خروج') || name.includes('استلام') || name.includes('تسليم') || name.includes('خطاب') || name.includes('إذن')) return 'exit_permit';
    if (name.includes('لوحة') || name.includes('لوحات') || name.includes('استمارة') || name.includes('رخصة') || name.includes('سير')) return 'plates';
    if (name.includes('تقرير') || name.includes('تقارير') || name.includes('ملخص') || name.includes('جرد')) return 'reports';
    return 'root';
  }

  public async addDocument(doc: Omit<VehicleDocument, 'id'>): Promise<VehicleDocument> {
    const newDoc: VehicleDocument = {
      ...doc,
      id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    const stType = this.getStorageType();
    if (stType === 'local_folder') {
      try {
        await this.writeToLocalFolderIfActive(newDoc.fileName, newDoc.fileData, this.getCategoryEnum(newDoc.category));
      } catch (err) {
        console.error("Local folder write failed during addDocument:", err);
      }
    }

    if (stType === 'localstorage') {
      const docs = this.getLocalstorageDocuments();
      docs.push(newDoc);
      this.saveLocalstorageDocuments(docs);
      return newDoc;
    }

    return new Promise(async (resolve, reject) => {
      try {
        const store = await this.getStore('readwrite');
        const request = store.add(newDoc);

        request.onsuccess = () => {
          resolve(newDoc);
        };

        request.onerror = (e: any) => {
          reject(e.target.error);
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  public async updateDocument(doc: VehicleDocument): Promise<VehicleDocument> {
    const stType = this.getStorageType();
    if (stType === 'local_folder') {
      try {
        await this.writeToLocalFolderIfActive(doc.fileName, doc.fileData, this.getCategoryEnum(doc.category));
      } catch (err) {
        console.error("Local folder write failed during updateDocument:", err);
      }
    }

    if (stType === 'localstorage') {
      const docs = this.getLocalstorageDocuments();
      const idx = docs.findIndex(d => d.id === doc.id);
      if (idx !== -1) {
        docs[idx] = doc;
        this.saveLocalstorageDocuments(docs);
      }
      return doc;
    }

    return new Promise(async (resolve, reject) => {
      try {
        const store = await this.getStore('readwrite');
        const request = store.put(doc);

        request.onsuccess = () => {
          resolve(doc);
        };

        request.onerror = (e: any) => {
          reject(e.target.error);
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  public async deleteDocument(id: string): Promise<void> {
    if (this.getStorageType() === 'localstorage') {
      const docs = this.getLocalstorageDocuments();
      const filtered = docs.filter(d => d.id !== id);
      this.saveLocalstorageDocuments(filtered);
      return;
    }

    return new Promise(async (resolve, reject) => {
      try {
        const store = await this.getStore('readwrite');
        const request = store.delete(id);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = (e: any) => {
          reject(e.target.error);
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  public async getLocalFolderHandle(): Promise<any | null> {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open('LocalFolderHandleDB', 1);
        request.onupgradeneeded = (e: any) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('handles')) {
            db.createObjectStore('handles');
          }
        };
        request.onsuccess = (e: any) => {
          const db = e.target.result;
          const tx = db.transaction('handles', 'readonly');
          const getReq = tx.objectStore('handles').get('active_folder');
          getReq.onsuccess = () => {
            resolve(getReq.result || null);
          };
          getReq.onerror = () => {
            resolve(null);
          };
        };
        request.onerror = () => {
          resolve(null);
        };
      } catch {
        resolve(null);
      }
    });
  }

  private getSettings(): any {
    try {
      const tenantPrefix = this.getTenantPrefix();
      let raw = localStorage.getItem(`${tenantPrefix}app_settings`);
      if (!raw) {
        raw = localStorage.getItem('app_settings');
      }
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error("Failed to read settings in storage driver:", e);
    }
    return {};
  }

  private async getDirectoryHandleRecursive(parentHandle: any, pathString: string): Promise<any> {
    const parts = pathString.split('/').filter(p => p.trim() !== '');
    let currentHandle = parentHandle;
    for (const part of parts) {
      currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
    }
    return currentHandle;
  }

  public async verifyAndWriteToLocalFolder(
    fileName: string, 
    fileData: string | Blob, 
    category: 'customs' | 'exit_permit' | 'plates' | 'reports' | 'root' = 'root'
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      const storageType = this.getStorageType();
      if (storageType !== 'local_folder') {
        return { success: false, error: 'محرك التخزين المحلي غير نشط حالياً.' };
      }

      const handle = await this.getLocalFolderHandle();
      if (!handle) {
        return { success: false, error: 'لم يتم ربط مجلد محلي، يرجى التوصيل من الإعدادات.' };
      }

      // 1. Permissions Check (التحقق من صلاحية الوصول والكتابة)
      const options = { mode: 'readwrite' };
      const currentPerm = await handle.queryPermission(options);
      if (currentPerm !== 'granted') {
        const reqPerm = await handle.requestPermission(options);
        if (reqPerm !== 'granted') {
          return { success: false, error: 'تم رفض صلاحية الكتابة للمجلد المحلي من نظام التشغيل.' };
        }
      }

      // 2. Resolve sub-path based on the unified directory configurations
      const config = this.getSettings();
      let subPath = '';
      if (category === 'customs') {
        subPath = config.documentStoragePathCustoms || '/assets/customs/';
      } else if (category === 'exit_permit') {
        subPath = config.documentStoragePathExitPermits || '/assets/exit_permits/';
      } else if (category === 'plates') {
        subPath = config.documentStoragePathPlates || '/assets/plates/';
      } else if (category === 'reports') {
        subPath = config.documentStoragePathReports || '/assets/reports/';
      }

      // 3. Traversal (انشاء المجلدات الفرعية تلقائيا إذا لم تكن موجودة)
      let targetFolderHandle = handle;
      if (subPath) {
        targetFolderHandle = await this.getDirectoryHandleRecursive(handle, subPath);
      }

      // 4. File Write
      const fileHandle = await targetFolderHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();

      let blob: Blob;
      if (fileData instanceof Blob) {
        blob = fileData;
      } else if (typeof fileData === 'string') {
        if (fileData.includes(';base64,')) {
          const parts = fileData.split(';base64,');
          const contentType = parts[0].split(':')[1];
          const raw = window.atob(parts[1]);
          const rawLength = raw.length;
          const uInt8Array = new Uint8Array(rawLength);
          for (let i = 0; i < rawLength; ++i) {
            uInt8Array[i] = raw.charCodeAt(i);
          }
          blob = new Blob([uInt8Array], { type: contentType });
        } else {
          blob = new Blob([fileData], { type: 'text/plain' });
        }
      } else {
        throw new Error('صيغة البيانات غير مدعومة.');
      }

      await writable.write(blob);
      await writable.close();

      return { 
        success: true, 
        path: subPath ? `${subPath}/${fileName}`.replace(/\/+/g, '/') : fileName 
      };
    } catch (err: any) {
      console.error("verifyAndWriteToLocalFolder failed:", err);
      return { success: false, error: err?.message || String(err) };
    }
  }

  public async createRequiredFolders(): Promise<{ success: boolean; created: string[]; error?: string }> {
    try {
      const handle = await this.getLocalFolderHandle();
      if (!handle) {
        return { success: false, created: [], error: 'لم يتم ربط مجلد محلي، يرجى التوصيل من الإعدادات.' };
      }

      const options = { mode: 'readwrite' };
      const currentPerm = await handle.queryPermission(options);
      if (currentPerm !== 'granted') {
        const reqPerm = await handle.requestPermission(options);
        if (reqPerm !== 'granted') {
          return { success: false, created: [], error: 'تم رفض صلاحية الكتابة للمجلد المحلي من نظام التشغيل.' };
        }
      }

      const config = this.getSettings();
      const pathsToCreate = [
        config.documentStoragePathCustoms || '/assets/customs/',
        config.documentStoragePathExitPermits || '/assets/exit_permits/',
        config.documentStoragePathPlates || '/assets/plates/',
        config.documentStoragePathReports || '/assets/reports/'
      ];

      const createdDirs: string[] = [];
      for (const pathStr of pathsToCreate) {
        if (pathStr) {
          await this.getDirectoryHandleRecursive(handle, pathStr);
          createdDirs.push(pathStr);
        }
      }

      return { success: true, created: createdDirs };
    } catch (err: any) {
      console.error("createRequiredFolders failed:", err);
      return { success: false, created: [], error: err?.message || String(err) };
    }
  }

  public async createCustomFolder(pathStr: string): Promise<{ success: boolean; error?: string }> {
    try {
      const handle = await this.getLocalFolderHandle();
      if (!handle) {
        return { success: false, error: 'لم يتم ربط مجلد محلي، يرجى التوصيل من الإعدادات.' };
      }

      const options = { mode: 'readwrite' };
      const currentPerm = await handle.queryPermission(options);
      if (currentPerm !== 'granted') {
        const reqPerm = await handle.requestPermission(options);
        if (reqPerm !== 'granted') {
          return { success: false, error: 'تم رفض صلاحية الكتابة للمجلد المحلي من نظام التشغيل.' };
        }
      }

      await this.getDirectoryHandleRecursive(handle, pathStr);
      return { success: true };
    } catch (err: any) {
      console.error("createCustomFolder failed:", err);
      return { success: false, error: err?.message || String(err) };
    }
  }

  public async writeToLocalFolderIfActive(fileName: string, fileData: string, category: 'customs' | 'exit_permit' | 'plates' | 'reports' | 'root' = 'root'): Promise<boolean> {
    const res = await this.verifyAndWriteToLocalFolder(fileName, fileData, category);
    return res.success;
  }
}

export const documentStorageService = new DocumentStorageService();
