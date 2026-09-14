import { 
  DatabaseConfig, 
  SuperAdminConfig, 
  OrganizationConfig, 
  SystemCheckResponse, 
  InstallationStatusResponse 
} from './types';

/**
 * Dynamically computes the base URL for the current application root or subdirectory.
 * Works seamlessly whether hosted at root (https://example.com) or subfolder (https://example.com/88/).
 */
export function getBasePrefix(): string {
  if (typeof window === 'undefined') return '';

  // 1. Explicit window-level base overrides
  const customBase = (window as any).__APP_BASE_PATH__ || (window as any).__API_BASE_URL__ || (window as any).__INSTALLER_BASE__;
  if (customBase && customBase !== '/' && customBase !== './') {
    return customBase.replace(/\/+$/, '');
  }

  // 2. Vite base URL if configured and not default root
  const viteBase = (import.meta as any).env?.BASE_URL;
  if (viteBase && viteBase !== '/' && viteBase !== './') {
    return viteBase.replace(/\/+$/, '');
  }

  // 3. Document <base href> tag if present
  try {
    const baseEl = document.querySelector('base');
    if (baseEl && baseEl.href) {
      const parsed = new URL(baseEl.href, window.location.origin);
      if (parsed.pathname && parsed.pathname !== '/') {
        return parsed.pathname.replace(/\/+$/, '');
      }
    }
  } catch (e) {}

  // 4. Infer from window.location.pathname by slicing before any known SPA route
  const knownSegments = [
    'dashboard', 'reports', 'inventory', 'sales', 'customers', 
    'search', 'users', 'backup', 'backups', 'settings', 'delegate-dashboard', 
    'vehicle-costs', 'corporate-portal', 'showroom', 'login', 'install',
    'installer', 'api', 'cars', 'letters', 'costs', 'transfers', 'archive'
  ];

  const segments = window.location.pathname.split('/').filter(Boolean);
  const matchedIdx = segments.findIndex(seg => {
    const cleanSeg = seg.toLowerCase().replace(/\.[a-zA-Z0-9]+$/, '');
    return knownSegments.includes(cleanSeg);
  });

  if (matchedIdx >= 0) {
    return matchedIdx === 0 ? '' : '/' + segments.slice(0, matchedIdx).join('/');
  }

  // 5. Fallback: strip file names like index.html, index.php etc.
  let pathname = window.location.pathname.replace(/\/[^/]+\.[a-zA-Z0-9]+$/i, '');
  return pathname.replace(/\/+$/, '');
}

/**
 * Returns the primary installer action URL dynamically.
 */
export function getInstallerActionUrl(action: string): string {
  const base = getBasePrefix();
  return `${base}/installer/actions.php?action=${encodeURIComponent(action)}`;
}

/**
 * Returns the alternate fallback API route.
 */
export function getApiFallbackUrl(route: string): string {
  const base = getBasePrefix();
  return `${base}/api/install/${route.replace(/^\/+/, '')}`;
}

/**
 * Robust JSON fetcher with automatic multi-candidate fallback handling and user-friendly error formatting.
 */
async function fetchInstallerJson<T = any>(
  action: string, 
  fallbackRoute: string, 
  options?: RequestInit
): Promise<T> {
  const base = getBasePrefix();
  const cleanRoute = fallbackRoute.replace(/^\/+/, '');

  // Build ordered list of candidate endpoints
  const candidates = [
    `${base}/installer/actions.php?action=${encodeURIComponent(action)}`,
    `${base}/installer/index.php?action=${encodeURIComponent(action)}`,
    `${base}/api/install/${cleanRoute}`,
    `${base}/api/install/${cleanRoute}.php`,
    `${base}/api/index.php?route=install/${cleanRoute}`,
    `/installer/actions.php?action=${encodeURIComponent(action)}`,
    `/installer/index.php?action=${encodeURIComponent(action)}`,
    `/api/install/${cleanRoute}`,
    `/api/install/${cleanRoute}.php`,
    `/api/index.php?route=install/${cleanRoute}`
  ].filter((v, i, a) => a.indexOf(v) === i); // Unique

  const method = options?.method || 'GET';
  console.log(`[INSTALLER] executing action "${action}" (${method})`);

  let lastStatus = 0;
  let lastErrorMsg = '';

  for (const url of candidates) {
    try {
      const response = await fetch(url, options);
      if (response.status === 404 || response.status === 405) {
        lastStatus = response.status;
        continue;
      }
      
      const contentType = response.headers.get('content-type') || '';
      const text = await response.text();
      
      if (!contentType.includes('application/json') && (text.includes('<!DOCTYPE') || text.includes('<html'))) {
        // Returned HTML (e.g. SPA fallback index.html), try next candidate
        lastStatus = response.status;
        continue;
      }

      try {
        const data = JSON.parse(text);
        if (!response.ok) {
          const errorMsg = data?.error || data?.message || `خطأ في الخادم (HTTP ${response.status})`;
          throw new Error(errorMsg);
        }
        return data as T;
      } catch (jsonErr: any) {
        if (!response.ok) {
          lastErrorMsg = jsonErr.message;
          throw jsonErr;
        }
        // Non-JSON or parse error on 200, try next candidate
      }
    } catch (fetchErr: any) {
      if (fetchErr.message && !fetchErr.message.includes('Failed to fetch') && !fetchErr.message.includes('NetworkError')) {
        // If it's a specific backend error message, propagate it
        throw fetchErr;
      }
    }
  }

  // If all candidates failed
  throw new Error(
    lastErrorMsg || `تعذر الوصول إلى Installer API.\n\nHTTP Status: ${lastStatus || 404} (Not Found)\nAPI:\n${candidates[0]}\n\nيرجى التأكد من وجود:\ninstaller/actions.php وصلاحيات تشغيل PHP.`
  );
}

export const InstallApi = {
  /**
   * Diagnostic ping check
   */
  async ping(): Promise<{ success: boolean; message: string; data?: any }> {
    return fetchInstallerJson('ping', 'status');
  },

  async getStatus(): Promise<InstallationStatusResponse> {
    return fetchInstallerJson<InstallationStatusResponse>('check_lock', 'status');
  },

  async getRequirements(): Promise<SystemCheckResponse> {
    return fetchInstallerJson<SystemCheckResponse>('check_requirements', 'requirements');
  },

  async testDatabase(config: DatabaseConfig): Promise<{ success: boolean; message?: string; error?: string }> {
    return fetchInstallerJson<{ success: boolean; message?: string; error?: string }>('test_db', 'test-db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dbConfig: config, ...config })
    });
  },

  async createDatabase(config: DatabaseConfig): Promise<{ success: boolean; message?: string; error?: string; databaseCreated?: boolean }> {
    return fetchInstallerJson<{ success: boolean; message?: string; error?: string; databaseCreated?: boolean }>('create_database', 'create-database', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dbConfig: config, ...config })
    });
  },

  async runMigrations(config: DatabaseConfig): Promise<{ success: boolean; message?: string; error?: string; applied?: string[]; skipped?: string[]; tablesCount?: number }> {
    const data = await fetchInstallerJson<{ success: boolean; message?: string; error?: string; applied?: string[]; skipped?: string[]; tablesCount?: number }>('create_table', 'migrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dbConfig: config, ...config })
    });
    if (!data.success) {
      throw new Error(data.error || 'Failed to apply schema migrations');
    }
    return data;
  },

  async createAdmin(adminConfig: SuperAdminConfig, orgConfig: OrganizationConfig): Promise<{ success: boolean; message?: string; error?: string; admin?: any }> {
    const data = await fetchInstallerJson<{ success: boolean; message?: string; error?: string; admin?: any }>('create_admin', 'create-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminConfig, orgConfig })
    });
    if (!data.success) {
      throw new Error(data.error || 'Failed to create administrator');
    }
    return data;
  },

  async finalizeInstallation(orgConfig: OrganizationConfig): Promise<{ success: boolean; message?: string; error?: string }> {
    const data = await fetchInstallerJson<{ success: boolean; message?: string; error?: string }>('save_config', 'finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgConfig })
    });
    if (!data.success) {
      throw new Error(data.error || 'Failed to finalize installation');
    }
    return data;
  },

  async executeInstallation(payload: {
    dbConfig: DatabaseConfig;
    adminConfig: SuperAdminConfig;
    orgConfig: OrganizationConfig;
  }): Promise<{ success: boolean; message?: string; error?: string; admin?: any; migrations?: any }> {
    const data = await fetchInstallerJson<{ success: boolean; message?: string; error?: string; admin?: any; migrations?: any }>('execute', 'execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!data.success) {
      throw new Error(data.error || data.message || 'حدث خطأ أثناء تثبيت النظام');
    }
    return data;
  }
};
