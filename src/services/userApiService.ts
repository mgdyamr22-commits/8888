import { User } from '../../types';

/**
 * UserApiService
 * ----------------
 * The single source of truth for reading/writing user accounts.
 * Talks exclusively to /api/auth/users (GET / POST / PUT / DELETE).
 *
 * Deliberately does NOT read or write any user data to localStorage /
 * sessionStorage / Electron IPC. On any failure it throws a clear error
 * instead of silently falling back to a local/cached/default user list —
 * callers are responsible for surfacing that error to the user.
 */
export class UserApiService {
  /**
   * Dynamically resolves the base URL prefix for API calls.
   * Seamlessly supports root domain, subfolders, and configured bases.
   * (Kept consistent with CarApiService.getBasePrefix())
   */
  public static getBasePrefix(): string {
    if (typeof window === 'undefined') return '';

    const customBase = (window as any).__APP_BASE_PATH__ || (window as any).__API_BASE_URL__ || (window as any).__INSTALLER_BASE__;
    if (customBase && customBase !== '/' && customBase !== './') {
      return customBase.replace(/\/+$/, '');
    }

    const viteBase = (import.meta as any).env?.BASE_URL;
    if (viteBase && viteBase !== '/' && viteBase !== './') {
      return viteBase.replace(/\/+$/, '');
    }

    try {
      const baseEl = document.querySelector('base');
      if (baseEl && baseEl.href) {
        const parsed = new URL(baseEl.href, window.location.origin);
        if (parsed.pathname && parsed.pathname !== '/') {
          return parsed.pathname.replace(/\/+$/, '');
        }
      }
    } catch (e) {}

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

    let pathname = window.location.pathname.replace(/\/[^/]+\.[a-zA-Z0-9]+$/i, '');
    return pathname.replace(/\/+$/, '');
  }

  private static getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // Reading the auth token to authenticate the request is NOT the kind of
    // "local user data" this service avoids — it never reads/writes the
    // user LIST from storage, only the current session's bearer token.
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['X-Authorization'] = `Bearer ${token}`;
      headers['X-Custom-Auth'] = token;
    }

    return headers;
  }

  /**
   * Resilient fetcher with multi-endpoint fallback and clean Arabic error
   * reporting. On failure (all candidates exhausted), throws — never
   * returns a locally-cached/default value.
   */
  private static async executeRequest<T = any>(
    candidates: string[],
    options: RequestInit,
    defaultErrorMsg: string
  ): Promise<T> {
    let lastError: Error | null = null;
    let lastStatus = 0;

    for (const url of candidates) {
      try {
        const res = await fetch(url, {
          ...options,
          headers: {
            ...this.getHeaders(),
            ...(options.headers || {})
          }
        });

        lastStatus = res.status;

        if (res.status === 401) {
          const hadToken = !!(localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token'));

          let msg = 'غير مصرح لك بالوصول. يرجى تسجيل الدخول أولاً.';
          try {
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              const j = await res.json();
              msg = j?.error || j?.message || msg;
            }
          } catch (e) {}

          // Only treat this as a genuine "your session expired" event when a
          // token actually existed and the server rejected it. This call
          // also runs as part of the app's normal background data load —
          // including on the public login page itself, before anyone has
          // logged in — where a 401 with NO token is completely expected
          // and must NOT clear anything or redirect. Redirecting on every
          // token-less 401 is what caused an infinite reload loop between
          // "/" and "/#/login" (each reload re-triggers the same 401).
          if (hadToken) {
            try {
              localStorage.removeItem('auth_token');
              sessionStorage.removeItem('auth_token');
              localStorage.removeItem('is_admin_logged_in');
              sessionStorage.removeItem('is_admin_logged_in');
            } catch (e) {}

            if (typeof window !== 'undefined' && !/\/login/i.test(window.location.hash) && !/\/login/i.test(window.location.pathname)) {
              setTimeout(() => { window.location.href = '/'; }, 1200);
            }
            msg = msg || 'انتهت صلاحية جلستك أو أنها غير صالحة. سيتم تحويلك لصفحة تسجيل الدخول.';
          }

          throw new Error(msg);
        }

        if (options.method && options.method.toUpperCase() !== 'GET' && res.redirected) {
          console.warn(`[UserApiService] Write request to ${url} was redirected to ${res.url}. Skipping to next candidate.`);
          continue;
        }

        if (res.status === 404 || res.status === 405) {
          continue;
        }

        const contentType = res.headers.get('content-type') || '';
        const isJson = contentType.includes('application/json');

        if (!isJson) {
          if (candidates.indexOf(url) < candidates.length - 1) {
            continue;
          }
        }

        const json = isJson ? await res.json() : null;

        if (!res.ok) {
          const errMsg = json?.error || json?.message || `${defaultErrorMsg} (${res.status})`;
          throw new Error(errMsg);
        }

        if (json && json.success === false) {
          throw new Error(json.error || json.message || defaultErrorMsg);
        }

        return (json || {}) as T;
      } catch (err: any) {
        lastError = err;
        if (lastStatus !== 404 && lastStatus !== 405 && lastStatus !== 0 && !err.message?.includes('404')) {
          throw err;
        }
      }
    }

    throw lastError || new Error(`${defaultErrorMsg} (${lastStatus || 404})`);
  }

  private static candidates(suffix: string = ''): string[] {
    const base = this.getBasePrefix();
    return [
      `${base}/api/auth/users${suffix}`,
      `${base}/api/auth/users.php${suffix}`,
      `${base}/api/index.php?route=auth/users${suffix ? '&' + suffix.replace(/^\?/, '') : ''}`,
      `/api/auth/users${suffix}`
    ].filter((v, i, a) => a.indexOf(v) === i);
  }

  private static normalizeUser(raw: any): User {
    return {
      ...raw,
      id: String(raw.id),
      fullName: raw.fullName ?? raw.full_name ?? '',
      branchId: raw.branchId ?? raw.branch_id ?? undefined,
      isActive: raw.isActive ?? (raw.is_active !== undefined ? !!raw.is_active : true),
      permissions: Array.isArray(raw.permissions) ? raw.permissions : []
    } as User;
  }

  /**
   * GET /api/auth/users — Fetches the full user list from the database.
   * Throws on failure — callers must NOT fall back to a local/default list.
   */
  public static async fetchUsers(): Promise<User[]> {
    const json = await this.executeRequest(
      this.candidates(),
      { method: 'GET' },
      'تعذر تحميل قائمة المستخدمين من الخادم.'
    );

    const rawUsers: any[] = json?.data?.users || json?.users || [];
    return rawUsers.map(u => this.normalizeUser(u));
  }

  /**
   * POST /api/auth/users — Creates a new user account.
   */
  public static async createUser(user: Partial<User> & { username: string; password: string }): Promise<User> {
    const json = await this.executeRequest(
      this.candidates(),
      {
        method: 'POST',
        body: JSON.stringify(user)
      },
      'فشل الخادم في إضافة المستخدم.'
    );

    const newId = json?.data?.userId || json?.userId || `usr_${Date.now()}`;
    return this.normalizeUser({ ...user, id: newId, password: undefined });
  }

  /**
   * PUT /api/auth/users — Updates an existing user account.
   */
  public static async updateUser(id: string, updates: Partial<User>): Promise<boolean> {
    await this.executeRequest(
      this.candidates(),
      {
        method: 'PUT',
        body: JSON.stringify({ ...updates, id })
      },
      'فشل الخادم في تحديث بيانات المستخدم.'
    );

    return true;
  }

  /**
   * DELETE /api/auth/users — Removes a user account.
   */
  public static async deleteUser(id: string): Promise<boolean> {
    await this.executeRequest(
      this.candidates(`?id=${encodeURIComponent(id)}`),
      {
        method: 'DELETE',
        body: JSON.stringify({ id })
      },
      'فشل الخادم في حذف المستخدم.'
    );

    return true;
  }
}
