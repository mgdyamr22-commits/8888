import { Car } from '../../types';

export interface CarFilters {
  branchId?: string;
  status?: string;
  search?: string;
}

export class CarApiService {
  private static inFlightFetchPromise: Map<string, Promise<Car[]>> = new Map();
  private static lastCarsCache: { data: Car[]; timestamp: number; key: string } | null = null;

  public static invalidateCache(): void {
    CarApiService.lastCarsCache = null;
    CarApiService.inFlightFetchPromise.clear();
  }
  /**
   * Dynamically resolves the base URL prefix for API calls.
   * Seamlessly supports root domain, subfolders (e.g. /88/), and configured bases.
   */
  public static getBasePrefix(): string {
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
   * Constructs the full normalized URL for a given API path
   */
  public static getApiUrl(path: string): string {
    const base = this.getBasePrefix();
    const cleanPath = path.replace(/^\/+/, '');
    return base ? `${base}/${cleanPath}` : `/${cleanPath}`;
  }

  private static getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['X-Authorization'] = `Bearer ${token}`;
      headers['X-Custom-Auth'] = token;
    }

    return headers;
  }

  /**
   * Resilient fetcher with multi-endpoint fallback, Content-Type validation,
   * and clean Arabic error reporting.
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

        // If a write operation was redirected (301/302 changes POST to GET and drops body), discard this candidate
        if (options.method && options.method.toUpperCase() !== 'GET' && res.redirected) {
          console.warn(`[CarApiService] Write request to ${url} was redirected to ${res.url}. Skipping to next candidate.`);
          continue;
        }

        // If the server returns a 404 or 405 (method not allowed on rewrite), try the next candidate endpoint
        if (res.status === 404 || res.status === 405) {
          continue;
        }

        const contentType = res.headers.get('content-type') || '';
        const isJson = contentType.includes('application/json');

        if (!isJson) {
          // If response is HTML (e.g. SPA fallback index.html or Apache 404 HTML), skip to next candidate
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
        // If it's a known logical error with a custom message (not a 404/network error), rethrow immediately
        if (lastStatus !== 404 && lastStatus !== 405 && lastStatus !== 0 && !err.message?.includes('404')) {
          throw err;
        }
      }
    }

    throw lastError || new Error(`${defaultErrorMsg} (${lastStatus || 404})`);
  }

  /**
   * 1. GET /api/cars - Fetches all cars from MySQL database with deduplication and short-lived caching
   */
  public static async fetchCars(filters?: CarFilters, forceFresh: boolean = false): Promise<Car[]> {
    const params = new URLSearchParams();
    if (filters?.branchId && filters.branchId !== 'all') {
      params.append('branch_id', filters.branchId);
    }
    if (filters?.status && filters.status !== 'all') {
      params.append('status', filters.status);
    }
    if (filters?.search) {
      params.append('search', filters.search);
    }

    const cacheKey = params.toString();

    // 1. Return cached cars if fetched recently (within 2.5s) to eliminate tab-switch lags
    if (!forceFresh && this.lastCarsCache && this.lastCarsCache.key === cacheKey) {
      const age = Date.now() - this.lastCarsCache.timestamp;
      if (age < 2500) {
        return this.lastCarsCache.data;
      }
    }

    // 2. Deduplicate in-flight requests
    if (!forceFresh && this.inFlightFetchPromise.has(cacheKey)) {
      return this.inFlightFetchPromise.get(cacheKey)!;
    }

    const query = params.toString() ? `?${params.toString()}` : '';
    const base = this.getBasePrefix();

    const candidates = [
      `${base}/api/cars/${query}`,
      `${base}/api/cars/index.php${query}`,
      `${base}/api/cars${query}`,
      `${base}/api/index.php?route=cars${params.toString() ? `&${params.toString()}` : ''}`,
      `/api/cars/${query}`,
      `/api/cars${query}`
    ].filter((v, i, a) => a.indexOf(v) === i);

    const fetchPromise = (async () => {
      try {
        const json = await this.executeRequest(
          candidates,
          { method: 'GET' },
          'تعذر تحميل قائمة السيارات من الخادم وقاعدة البيانات.'
        );

        const rawCars: any[] = Array.isArray(json.data) 
          ? json.data 
          : (Array.isArray(json.cars) ? json.cars : []);

        const carsList: Car[] = rawCars.map((c: any) => {
          const raw = String(c.vinMatching || c.vin_matching || '').trim();
          return {
            ...c,
            vinMatching: (raw === 'غير مطابق' || raw === 'غير متطابق' || raw === 'mismatch' || raw === 'غير_مطابق') ? 'غير متطابق' : 'متطابق'
          };
        });

        this.lastCarsCache = {
          data: carsList,
          timestamp: Date.now(),
          key: cacheKey
        };

        return carsList;
      } finally {
        this.inFlightFetchPromise.delete(cacheKey);
      }
    })();

    this.inFlightFetchPromise.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  /**
   * Helper to normalize car object and format date fields to YYYY-MM-DD for MySQL
   */
  private static sanitizeCarData(car: Partial<Car>): Partial<Car> {
    const cleaned = { ...car };

    // Strict vinMatching normalization: only 'متطابق' or 'غير متطابق'
    if (cleaned.vinMatching !== undefined) {
      const raw = String(cleaned.vinMatching || '').trim();
      cleaned.vinMatching = (raw === 'غير مطابق' || raw === 'غير متطابق' || raw === 'mismatch' || raw === 'غير_مطابق') ? 'غير متطابق' : 'متطابق';
    }

    // Format entryDate if it is an ISO string (e.g. 2026-08-25T12:00:00.000Z)
    if (cleaned.entryDate) {
      const match = String(cleaned.entryDate).match(/^(\d{4}-\d{2}-\d{2})/);
      if (match) {
        cleaned.entryDate = match[1];
      }
    }

    if ((cleaned as any).entry_date) {
      const match = String((cleaned as any).entry_date).match(/^(\d{4}-\d{2}-\d{2})/);
      if (match) {
        (cleaned as any).entry_date = match[1];
      }
    }

    // Format plateData issueDate if present
    if (cleaned.plateData && cleaned.plateData.issueDate) {
      const match = String(cleaned.plateData.issueDate).match(/^(\d{4}-\d{2}-\d{2})/);
      if (match) {
        cleaned.plateData = {
          ...cleaned.plateData,
          issueDate: match[1]
        };
      }
    }

    return cleaned;
  }

  /**
   * 2. POST /api/cars - Creates a new car directly in MySQL database
   */
  public static async createCar(car: Partial<Car>): Promise<Car> {
    const base = this.getBasePrefix();
    const sanitized = this.sanitizeCarData(car);
    const candidates = [
      `${base}/api/cars/`,
      `${base}/api/cars/index.php`,
      `${base}/api/cars`,
      `${base}/api/index.php?route=cars`,
      `/api/cars/`,
      `/api/cars`
    ].filter((v, i, a) => a.indexOf(v) === i);

    const json = await this.executeRequest(
      candidates,
      {
        method: 'POST',
        body: JSON.stringify(sanitized)
      },
      'فشل الخادم في حفظ السيارة في قاعدة البيانات.'
    );

    // Guard against server redirects turning POST into GET returning full car array
    if (Array.isArray(json?.data) && !json?.car && !json?.data?.car) {
      throw new Error('فشل الخادم في حفظ السيارة: استجاب الخادم بقائمة السيارات بدلاً من حفظ البيانات (قد يكون تم تحويل الطلب بشكل غير صحيح).');
    }

    // Flexible extraction from all possible API response formats
    let createdCar: any = json?.data?.car || json?.data?.data || json?.data || json?.car || json?.item || json?.vehicle;
    if (Array.isArray(createdCar) && createdCar.length > 0) {
      createdCar = createdCar[0];
    }

    if (!createdCar || typeof createdCar !== 'object') {
      const id = json?.id || json?.carId || json?.data?.id || (sanitized as any)?.id;
      createdCar = {
        ...sanitized,
        id: id || `car_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      };
    } else if (!createdCar.id) {
      createdCar.id = (sanitized as any)?.id || json?.id || json?.carId || `car_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    }

    // Ensure all critical fields from sanitized exist in createdCar
    const finalCar: Car = {
      ...(sanitized as Car),
      ...createdCar,
      id: String(createdCar.id || (sanitized as any).id || `car_${Date.now()}`),
      brand: createdCar.brand || sanitized.brand || '',
      model: createdCar.model || sanitized.model || '',
      year: Number(createdCar.year || sanitized.year || 2026),
      color: createdCar.color || sanitized.color || '',
      interiorColor: createdCar.interiorColor || sanitized.interiorColor || '',
      vin: createdCar.vin || sanitized.vin || '',
      vinMatching: (() => {
        const raw = String(createdCar.vinMatching || sanitized.vinMatching || '').trim();
        return (raw === 'غير مطابق' || raw === 'غير متطابق' || raw === 'mismatch' || raw === 'غير_مطابق') ? 'غير متطابق' : 'متطابق';
      })(),
      cardNumber: createdCar.cardNumber || sanitized.cardNumber || '',
      price: Number(createdCar.price ?? sanitized.price ?? 0),
      costPrice: Number(createdCar.costPrice ?? sanitized.costPrice ?? 0),
      supplier: createdCar.supplier || sanitized.supplier || '',
      ownershipType: createdCar.ownershipType || sanitized.ownershipType || 'مباشر',
      status: createdCar.status || sanitized.status || 'متوفره',
      rentalStatus: createdCar.rentalStatus || sanitized.rentalStatus || 'لم يتم التجير',
      notes: createdCar.notes || sanitized.notes || '',
      entryDate: createdCar.entryDate || sanitized.entryDate || new Date().toISOString().split('T')[0],
      isPresentInShowroom: createdCar.isPresentInShowroom ?? sanitized.isPresentInShowroom ?? true,
      presenceDescription: createdCar.presenceDescription || sanitized.presenceDescription || '',
      hasPlate: createdCar.hasPlate ?? sanitized.hasPlate ?? false,
      lastModified: createdCar.lastModified || sanitized.lastModified || new Date().toISOString(),
      updatedAt: createdCar.updatedAt || sanitized.updatedAt || new Date().toISOString()
    };

    this.invalidateCache();
    return finalCar;
  }

  /**
   * 3. PUT /api/cars/:id - Updates car details in MySQL
   */
  public static async updateCar(id: string, car: Partial<Car>): Promise<Car> {
    const base = this.getBasePrefix();
    const encodedId = encodeURIComponent(id);
    const sanitized = this.sanitizeCarData(car);

    const candidates = [
      `${base}/api/cars/${encodedId}`,
      `${base}/api/cars/detail.php?id=${encodedId}`,
      `${base}/api/index.php?route=cars/${encodedId}`,
      `${base}/api/cars/${encodedId}/`,
      `/api/cars/${encodedId}`
    ].filter((v, i, a) => a.indexOf(v) === i);

    let json: any;
    try {
      json = await this.executeRequest(
        candidates,
        {
          method: 'PUT',
          body: JSON.stringify({ ...sanitized, id, _method: 'PUT' })
        },
        'فشل الخادم في تحديث بيانات السيارة.'
      );
    } catch (err: any) {
      if (String(err?.message || '').includes('404')) {
        console.warn(`[CarApiService] Vehicle ${id} returned 404 on update; automatically creating/upserting...`);
        return await this.createCar({ ...car, id });
      }
      throw err;
    }

    let updatedCar: any = json?.data?.car || json?.data?.data || json?.data || json?.car || json?.item || json?.vehicle;
    if (Array.isArray(updatedCar) && updatedCar.length > 0) {
      updatedCar = updatedCar[0];
    }

    const rawFinalVinMatching = String(updatedCar?.vinMatching || (sanitized as any)?.vinMatching || '').trim();
    const finalCar: Car = {
      ...(sanitized as Car),
      ...(updatedCar && typeof updatedCar === 'object' ? updatedCar : {}),
      vinMatching: (rawFinalVinMatching === 'غير مطابق' || rawFinalVinMatching === 'غير متطابق' || rawFinalVinMatching === 'mismatch' || rawFinalVinMatching === 'غير_مطابق') ? 'غير متطابق' : 'متطابق',
      id: String(id)
    };

    this.invalidateCache();
    return finalCar;
  }

  /**
   * 4. DELETE /api/cars/:id - Removes a car from MySQL database
   */
  public static async deleteCar(id: string, reason?: string, user?: string): Promise<boolean> {
    const base = this.getBasePrefix();
    const encodedId = encodeURIComponent(id);

    const candidates = [
      `${base}/api/cars/${encodedId}`,
      `${base}/api/cars/detail.php?id=${encodedId}&action=delete`,
      `${base}/api/index.php?route=cars/${encodedId}`,
      `/api/cars/${encodedId}`
    ].filter((v, i, a) => a.indexOf(v) === i);

    await this.executeRequest(
      candidates,
      {
        method: 'DELETE',
        body: JSON.stringify({ id, reason, user, _method: 'DELETE' })
      },
      'فشل الخادم في حذف السيارة من قاعدة البيانات.'
    );

    this.invalidateCache();
    return true;
  }

  /**
   * 5. POST /api/cars/bulk-insert - Inserts multiple cars into MySQL
   */
  public static async bulkCreateCars(cars: Partial<Car>[]): Promise<Car[]> {
    const base = this.getBasePrefix();
    const sanitizedList = cars.map(c => this.sanitizeCarData(c));
    const candidates = [
      `${base}/api/cars/bulk-insert`,
      `${base}/api/cars/index.php?action=bulk-insert`,
      `${base}/api/index.php?route=cars/bulk-insert`,
      `${base}/api/cars`,
      `${base}/api/cars/index.php`,
      `/api/cars/bulk-insert`,
      `/api/cars/index.php?action=bulk-insert`,
      `/api/index.php?route=cars/bulk-insert`,
      `/api/cars`
    ].filter((v, i, a) => a.indexOf(v) === i);

    const json = await this.executeRequest(
      candidates,
      {
        method: 'POST',
        body: JSON.stringify({ cars: sanitizedList, action: 'bulk-insert' })
      },
      'فشل الخادم في حفظ مجموعة السيارات.'
    );

    this.invalidateCache();
    const resList = json?.data?.cars || json?.data?.data || json?.data || json?.cars || [];
    if (Array.isArray(resList) && resList.length > 0) {
      return resList;
    }

    return sanitizedList.map(c => ({
      ...c,
      id: c.id || `car_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    })) as Car[];
  }

  /**
   * 6. POST /api/cars/bulk-delete - Deletes multiple cars from MySQL
   */
  public static async bulkDeleteCars(ids: string[]): Promise<boolean> {
    const base = this.getBasePrefix();
    const candidates = [
      `${base}/api/cars/bulk-delete`,
      `${base}/api/cars/index.php?action=bulk-delete`,
      `${base}/api/index.php?route=cars/bulk-delete`,
      `/api/cars/bulk-delete`
    ].filter((v, i, a) => a.indexOf(v) === i);

    await this.executeRequest(
      candidates,
      {
        method: 'POST',
        body: JSON.stringify({ ids, action: 'bulk-delete' })
      },
      'فشل الخادم في الحذف الجماعي للسيارات.'
    );

    this.invalidateCache();
    return true;
  }

  /**
   * 7. POST /api/cars/:id/reserve - Atomic reservation in MySQL
   */
  public static async reserveCar(id: string, reservationDetails: any): Promise<any> {
    const base = this.getBasePrefix();
    const encodedId = encodeURIComponent(id);

    const candidates = [
      `${base}/api/cars/${encodedId}/reserve`,
      `${base}/api/cars/detail.php?id=${encodedId}&action=reserve`,
      `${base}/api/index.php?route=cars/${encodedId}/reserve`,
      `/api/cars/${encodedId}/reserve`
    ].filter((v, i, a) => a.indexOf(v) === i);

    const json = await this.executeRequest(
      candidates,
      {
        method: 'POST',
        body: JSON.stringify({ ...reservationDetails, id, action: 'reserve' })
      },
      'فشل الخادم في حجز السيارة.'
    );

    return json.data;
  }

  /**
   * 8. POST /api/cars/:id/cancel-reservation - Cancels reservation in MySQL
   */
  public static async cancelCarReservation(id: string, reason?: string, user?: string): Promise<boolean> {
    const base = this.getBasePrefix();
    const encodedId = encodeURIComponent(id);

    const candidates = [
      `${base}/api/cars/${encodedId}/cancel-reservation`,
      `${base}/api/cars/detail.php?id=${encodedId}&action=cancel-reservation`,
      `${base}/api/index.php?route=cars/${encodedId}/cancel-reservation`,
      `/api/cars/${encodedId}/cancel-reservation`
    ].filter((v, i, a) => a.indexOf(v) === i);

    const json = await this.executeRequest(
      candidates,
      {
        method: 'POST',
        body: JSON.stringify({ id, action: 'cancel-reservation', reason, user })
      },
      'فشل الخادم في إلغاء حجز السيارة.'
    );

    return json.success ?? true;
  }

  /**
   * 9. POST /api/files/upload - Uploads file (image/pdf/document) to server
   */
  /**
   * Resolves a stored file reference (a server-relative path like
   * 'storage/uploads/xxx.png', as returned by uploadFile()) into an absolute URL
   * usable in <img src> or link hrefs anywhere in the app. Already-absolute URLs
   * (http/https) and legacy inline data: URIs are returned unchanged.
   */
  public static resolveFileUrl(value?: string | null): string {
    if (!value) return '';
    if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:')) {
      return value;
    }
    const base = this.getBasePrefix();
    const cleanPath = value.replace(/^\/+/, '');
    return base ? `${base}/${cleanPath}` : `/${cleanPath}`;
  }

  public static async uploadFile(file: File): Promise<{ fileName: string; originalName: string; fileUrl: string }> {
    const base = this.getBasePrefix();
    const candidates = [
      `${base}/api/files/upload`,
      `${base}/api/files/upload.php`,
      `${base}/api/index.php?route=files/upload`,
      `/api/files/upload`,
      `/api/files/upload.php`
    ].filter((v, i, a) => a.indexOf(v) === i);

    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    const headers: Record<string, string> = {
      'Accept': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let lastError: any = null;
    for (const url of candidates) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: formData
        });

        if (response.ok) {
          const json = await response.json();
          if (json && json.success && (json.fileUrl || json.data?.fileUrl)) {
            return {
              fileName: json.fileName || json.data?.fileName || file.name,
              originalName: json.originalName || json.data?.originalName || file.name,
              fileUrl: json.fileUrl || json.data?.fileUrl
            };
          }
        }
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error('فشل رفع الملف إلى الخادم.');
  }
}
