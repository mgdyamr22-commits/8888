import { Delegate, Car } from '../../types';
import { CarApiService } from './carApiService';

const DELEGATE_SESSION_KEY = 'almakhzoun_delegate_session';
const DELEGATE_TOKEN_KEY = 'almakhzoun_delegate_token';

export interface DelegateSession {
  delegate: Delegate;
  token: string;
}

export class DelegateApiService {
  /**
   * Generates candidate URLs for any delegate portal endpoint to guarantee compatibility
   * across all shared hosting and server configurations (rewrite on/off, direct php, subfolder, etc.)
   */
  private static getCandidateUrls(endpoint: string): string[] {
    const clean = endpoint.replace(/^\/+/, '');
    return [
      CarApiService.getApiUrl(`api/delegate/${clean}`),
      CarApiService.getApiUrl(`api/delegate/${clean}.php`),
      CarApiService.getApiUrl(`api/index.php?route=delegate/${clean}`),
      `/api/delegate/${clean}`,
      `/api/delegate/${clean}.php`
    ];
  }

  /**
   * Candidate URLs for delegate management & sync endpoints
   */
  private static getAuthCandidateUrls(endpoint: string): string[] {
    const clean = endpoint.replace(/^\/+/, '');
    return [
      CarApiService.getApiUrl(`api/auth/${clean}`),
      CarApiService.getApiUrl(`api/auth/${clean}.php`),
      CarApiService.getApiUrl(`api/index.php?route=auth/${clean}`),
      `/api/auth/${clean}`,
      `/api/auth/${clean}.php`
    ];
  }

  /**
   * Helper that executes a fetch request trying candidate URLs until one succeeds
   */
  private static async fetchWithFallback(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const candidates = this.getCandidateUrls(endpoint);
    let lastError: any = null;

    for (const url of candidates) {
      try {
        const res = await fetch(url, options);
        if (res.status !== 404 && res.status !== 502 && res.status !== 503) {
          const contentType = res.headers.get('content-type') || '';
          if (!contentType.includes('application/json') && candidates.indexOf(url) < candidates.length - 1) {
            continue;
          }
          return res;
        }
      } catch (err) {
        lastError = err;
      }
    }

    if (lastError) throw lastError;
    throw new Error(`تعذر الوصول إلى نقطة النهاية: ${endpoint}`);
  }

  /**
   * Helper for auth/delegates management endpoints
   */
  private static async fetchAuthWithFallback(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const candidates = this.getAuthCandidateUrls(endpoint);
    let lastError: any = null;

    for (const url of candidates) {
      try {
        const res = await fetch(url, options);
        if (res.status !== 404 && res.status !== 502 && res.status !== 503) {
          const contentType = res.headers.get('content-type') || '';
          if (!contentType.includes('application/json') && candidates.indexOf(url) < candidates.length - 1) {
            continue;
          }
          return res;
        }
      } catch (err) {
        lastError = err;
      }
    }

    if (lastError) throw lastError;
    throw new Error(`تعذر الوصول إلى نقطة إدارة المناديب: ${endpoint}`);
  }

  public static getCurrentSession(): DelegateSession | null {
    try {
      const stored = localStorage.getItem(DELEGATE_SESSION_KEY) || sessionStorage.getItem(DELEGATE_SESSION_KEY);
      if (!stored) return null;
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }

  public static getStoredToken(): string | null {
    const session = this.getCurrentSession();
    return session?.token || localStorage.getItem(DELEGATE_TOKEN_KEY) || null;
  }

  public static setSession(delegate: Delegate, token: string, rememberMe: boolean = true) {
    const session: DelegateSession = { delegate, token };
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem(DELEGATE_SESSION_KEY, JSON.stringify(session));
    storage.setItem(DELEGATE_TOKEN_KEY, token);
  }

  public static clearSession() {
    localStorage.removeItem(DELEGATE_SESSION_KEY);
    localStorage.removeItem(DELEGATE_TOKEN_KEY);
    sessionStorage.removeItem(DELEGATE_SESSION_KEY);
    sessionStorage.removeItem(DELEGATE_TOKEN_KEY);
  }

  private static getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    const token = this.getStoredToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Normalizes Arabic numerals and input strings
   */
  public static normalizeInput(input: string): string {
    const eastern = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
    const ascii   = ['0','1','2','3','4','5','6','7','8','9'];
    let str = input.trim();
    for (let i = 0; i < eastern.length; i++) {
      str = str.replace(new RegExp(eastern[i], 'g'), ascii[i]);
    }
    return str;
  }

  /**
   * Authenticate delegate with backend database
   */
  public static async login(username: string, password: string, rememberMe: boolean = true): Promise<{ success: boolean; message: string; delegate?: Delegate; token?: string }> {
    try {
      const cleanUser = this.normalizeInput(username);
      const res = await this.fetchWithFallback('login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ username: cleanUser, password: password.trim() })
      });

      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await res.json() : null;

      if (res.ok && data?.success && data?.delegate) {
        this.setSession(data.delegate, data.token || '', rememberMe);
        return { success: true, message: data.message || 'تم تسجيل الدخول بنجاح', delegate: data.delegate, token: data.token };
      }

      return { 
        success: false, 
        message: data?.message || data?.error || 'بيانات الدخول غير صحيحة، لم يتم العثور على حساب المندوب. يرجى التأكد من اسم المستخدم أو رقم الجوال.' 
      };
    } catch (err: any) {
      return { success: false, message: err.message || 'تعذر الاتصال بخادم المصادقة بقاعدة البيانات' };
    }
  }

  /**
   * Synchronize full array of delegates into the backend MySQL database
   */
  public static async syncDelegates(delegates: Delegate[]): Promise<{ success: boolean; message: string }> {
    try {
      const res = await this.fetchAuthWithFallback('sync-delegates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ delegates })
      });

      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await res.json() : null;

      if (res.ok && data?.success) {
        return { success: true, message: data.message || 'تمت مزامنة المناديب في قاعدة البيانات بنجاح.' };
      }

      return { success: false, message: data?.message || 'فشلت مزامنة بيانات المناديب في قاعدة البيانات' };
    } catch (err: any) {
      return { success: false, message: err.message || 'تعذر الاتصال بقاعدة البيانات لمزامنة المناديب' };
    }
  }

  /**
   * Save or update a single delegate in the backend MySQL database
   */
  public static async saveDelegate(delegate: Partial<Delegate>): Promise<{ success: boolean; message: string }> {
    try {
      const res = await this.fetchAuthWithFallback('delegates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ delegate })
      });

      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await res.json() : null;

      if (res.ok && data?.success) {
        return { success: true, message: data.message || 'تم حفظ المندوب في قاعدة البيانات بنجاح.' };
      }

      return { success: false, message: data?.message || 'فشل حفظ بيانات المندوب في قاعدة البيانات' };
    } catch (err: any) {
      return { success: false, message: err.message || 'تعذر الاتصال بقاعدة البيانات لحفظ المندوب' };
    }
  }

  /**
   * Fetch all delegates from backend MySQL database
   */
  public static async fetchDelegates(): Promise<Delegate[]> {
    try {
      const res = await this.fetchAuthWithFallback('delegates', {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return [];

      const data = await res.json();
      if (res.ok && data?.success && Array.isArray(data.delegates)) {
        return data.delegates;
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Delete a delegate from backend MySQL database
   */
  public static async deleteDelegate(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await this.fetchAuthWithFallback('delegates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ id })
      });

      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await res.json() : null;

      if (res.ok && data?.success) {
        return { success: true, message: data.message || 'تم حذف المندوب من قاعدة البيانات بنجاح.' };
      }

      return { success: false, message: data?.message || 'فشل حذف المندوب من قاعدة البيانات' };
    } catch (err: any) {
      return { success: false, message: err.message || 'تعذر الاتصال بقاعدة البيانات لحذف المندوب' };
    }
  }

  public static async getProfile(): Promise<Delegate | null> {
    try {
      const res = await this.fetchWithFallback('profile', {
        method: 'GET',
        headers: this.getHeaders()
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return null;
      const data = await res.json();
      if (res.ok && data?.success && data?.profile) {
        return data.profile;
      }
      return null;
    } catch {
      return null;
    }
  }

  public static async updateProfile(updateData: { name?: string; phone?: string; email?: string; password?: string }): Promise<{ success: boolean; message: string; delegate?: Delegate }> {
    try {
      const res = await this.fetchWithFallback('profile', {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(updateData)
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return { success: false, message: 'استجابة الخادم غير متوافقة' };
      }
      const data = await res.json();
      if (res.ok && data?.success && data?.delegate) {
        const current = this.getCurrentSession();
        if (current) {
          this.setSession({ ...current.delegate, ...data.delegate }, current.token);
        }
        return { success: true, message: data.message || 'تم تحديث الملف الشخصي بنجاح', delegate: data.delegate };
      }
      return { success: false, message: data?.message || data?.error || 'فشل تحديث البيانات' };
    } catch (err: any) {
      return { success: false, message: err.message || 'حدث خطأ بالاتصال' };
    }
  }

  public static async getShowroomCars(): Promise<Car[]> {
    try {
      const res = await this.fetchWithFallback('cars', {
        method: 'GET',
        headers: this.getHeaders()
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return [];
      const data = await res.json();
      if (res.ok && data?.success && Array.isArray(data.cars)) {
        return data.cars;
      }
      return [];
    } catch {
      return [];
    }
  }

  public static async reserveCar(carId: string): Promise<{ success: boolean; message: string; car?: Car }> {
    try {
      const res = await this.fetchWithFallback('reserve', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ carId })
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return { success: false, message: 'استجابة الخادم غير متوافقة' };
      }
      const data = await res.json();
      if (res.ok && data?.success && data?.car) {
        return { success: true, message: data.message, car: data.car };
      }
      return { success: false, message: data?.message || data?.error || 'فشل حجز السيارة' };
    } catch (err: any) {
      return { success: false, message: err.message || 'فشل الاتصال بالخادم لإتمام الحجز' };
    }
  }

  public static async cancelReservation(carId: string): Promise<{ success: boolean; message: string; car?: Car }> {
    try {
      const res = await this.fetchWithFallback('cancel-reserve', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ carId })
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return { success: false, message: 'استجابة الخادم غير متوافقة' };
      }
      const data = await res.json();
      if (res.ok && data?.success && data?.car) {
        return { success: true, message: data.message, car: data.car };
      }
      return { success: false, message: data?.message || data?.error || 'فشل إلغاء الحجز' };
    } catch (err: any) {
      return { success: false, message: err.message || 'فشل الاتصال بالخادم لإلغاء الحجز' };
    }
  }

  public static async getMyBookings(): Promise<Car[]> {
    try {
      const res = await this.fetchWithFallback('my-bookings', {
        method: 'GET',
        headers: this.getHeaders()
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return [];
      const data = await res.json();
      if (res.ok && data?.success && Array.isArray(data.bookings)) {
        return data.bookings;
      }
      return [];
    } catch {
      return [];
    }
  }
}
