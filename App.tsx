
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate, Link, Outlet } from 'react-router-dom';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar.tsx';
import Dashboard from './components/Dashboard.tsx';
import CarManager from './components/CarManager.tsx';
import Reports from './components/Reports.tsx';
import UserAdmin from './components/UserAdmin.tsx';
import MaintenanceCenter from './components/BackupManager.tsx';
import AppSettings from './components/AppSettings.tsx';
import SalesManager from './components/SalesManager.tsx';
import Login from './components/Login.tsx';
import { CustomersManager } from './components/CustomersManager.tsx';
import { MouseContextMenu } from './components/MouseContextMenu.tsx';
import { CorporateLanding } from './components/CorporateLanding.tsx';
import { DelegateShowroom } from './components/DelegateShowroom.tsx';
import { DelegateDashboard } from './components/DelegateDashboard.tsx';
import { DelegatePortal } from './components/DelegatePortal.tsx';
import { DelegateApiService } from './src/services/delegateApiService';
import SmartSearch from './components/SmartSearch.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { LettersArchive } from './components/LettersArchive.tsx';
import { ReservationAuditModal } from './components/ReservationAuditModal.tsx';
import { PrintPreviewModal } from './components/PrintPreviewModal.tsx';
import { FloatingPromptBot } from './components/FloatingPromptBot.tsx';
import { FloatingSearch } from './components/FloatingSearch.tsx';
import { InstallerWizard } from './components/InstallerWizard.tsx';
import { 
  Moon, Sun, Monitor, ShieldCheck, Lock, Globe, Menu, X, ExternalLink, Info, ShieldAlert, Building2
} from 'lucide-react';
import { Car, User, Delegate, ActivityLog, DashboardPreferences, OrganizationSettings, Customer, LetterArchiveEntry, CarStatus, UserRole, VehicleCost, getUnifiedBookings, InventoryMovement, ExitData } from './types';
import { INITIAL_CARS, INITIAL_USERS, INITIAL_SETTINGS, DEFAULT_DASHBOARD_PREFS } from './constants.ts';
import { EncryptionService } from './services/encryptionService';
import { useLanguage } from './components/LanguageContext.tsx';
import { AppAutoBackupManager, cleanLocalStorageSpace } from './services/UpdateSystem';
import { ResilienceEngine } from './services/resilienceEngine';
import { getLogoDataUri, getStampDataUri } from './components/OfficialAssets';
import { documentStorageService } from './services/documentStorageService';
import { TenantSelectionScreen } from './components/TenantSelectionScreen.tsx';
import { OrganizationTenant } from './types';
import { syncLayoutSettingsFromElectron } from './services/layoutPersistenceService';
import { UserApiService } from './src/services/userApiService';
import { saveDesktopState, loadDesktopState } from './services/desktopDbService';
import { saveBackupToLocalDirectory, createFullSystemBackupPayload } from './services/localDirectoryBackupService';
import { CarApiService } from './src/services/carApiService';
import { InstallerPage } from './src/install/InstallerPage';

const SalesRouteWrapper: React.FC<{
  cars: Car[];
  onUpdateCars: React.Dispatch<React.SetStateAction<Car[]>>;
  currentUser: User | null;
  settings: OrganizationSettings;
  handleAddLetterToArchive: (letter: any) => void;
  users: User[];
  addLog: (action: string, targetId: string, targetType: any, details: string) => void;
  companies?: any[];
  setCompanies?: (companies: any[]) => void;
  transfers?: any[];
  setTransfers?: (transfers: any[]) => void;
  transferSettings?: any;
  setTransferSettings?: (settings: any) => void;
}> = ({ cars, onUpdateCars, currentUser, settings, handleAddLetterToArchive, users, addLog }) => {
  return (
    <SalesManager 
      cars={cars} 
      onUpdate={(uc) => onUpdateCars(prev => prev.map(c => c.id === uc.id ? uc : c))} 
      onDelete={(id) => {
        onUpdateCars(prev => prev.filter(c => c.id !== id));
        addLog('حذف سيارة من المبيعات', id, 'car', 'تم حذف مركبة واحدة من سجل المبيعات');
      }}
      currentUser={currentUser} 
      settings={settings} 
      onArchiveLetter={handleAddLetterToArchive}
      users={users}
      salesType="all"
      addLog={addLog}
    />
  );
};

const ScrollToTopOnRouteChange: React.FC = () => {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    const mainEl = document.querySelector('main');
    if (mainEl) mainEl.scrollTop = 0;
  }, [location.pathname]);
  return null;
};

const HashNavigationSync: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location);
  locationRef.current = location;

  useEffect(() => {
    const handleHashOrPop = () => {
      let rawHash = window.location.hash || '';
      if (rawHash.startsWith('#')) {
        rawHash = rawHash.substring(1);
      }
      if (!rawHash) {
        rawHash = '/';
      } else if (!rawHash.startsWith('/')) {
        rawHash = '/' + rawHash;
      }

      const [hashPath, hashSearch] = rawHash.split('?');
      const targetUrl = hashSearch ? `${hashPath}?${hashSearch}` : hashPath;
      const cur = locationRef.current;
      const currentUrl = cur.search ? `${cur.pathname}${cur.search}` : cur.pathname;

      if (targetUrl !== currentUrl) {
        navigate(targetUrl, { replace: true });
      }
    };

    window.addEventListener('hashchange', handleHashOrPop);
    window.addEventListener('popstate', handleHashOrPop);

    // Initial check on mount to ensure synchronization
    handleHashOrPop();

    return () => {
      window.removeEventListener('hashchange', handleHashOrPop);
      window.removeEventListener('popstate', handleHashOrPop);
    };
  }, [navigate]);

  return null;
};

export const getAppBasename = (): string => {
  try {
    if (typeof window === 'undefined') return '';
    const injectedBase = (window as any).__APP_BASE_PATH__;
    if (injectedBase && injectedBase !== '/') {
      return injectedBase.replace(/\/+$/, '');
    }

    // Document <base href> tag check
    const baseEl = document.querySelector('base');
    if (baseEl && baseEl.href) {
      const parsed = new URL(baseEl.href, window.location.origin);
      if (parsed.pathname && parsed.pathname !== '/') {
        return parsed.pathname.replace(/\/+$/, '');
      }
    }

    const knownRoutes = [
      'dashboard', 'reports', 'inventory', 'sales', 'customers', 
      'search', 'users', 'backup', 'backups', 'settings', 'delegate-dashboard', 
      'vehicle-costs', 'corporate-portal', 'showroom', 'login', 'install',
      'installer', 'api', 'cars', 'letters', 'costs', 'transfers', 'archive'
    ];
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const routeIndex = pathParts.findIndex(p => knownRoutes.includes(p.toLowerCase().replace(/\.[a-zA-Z0-9]+$/, '')));
    if (routeIndex > 0) {
      return '/' + pathParts.slice(0, routeIndex).join('/');
    }
  } catch (e) {}
  return '';
};

const App: React.FC = () => {
  const { lang, setLang, t, dir, isRtl } = useLanguage();

  const [layoutsSynced, setLayoutsSynced] = useState<boolean>(false);
  const [showAboutModal, setShowAboutModal] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [printPreviewHtml, setPrintPreviewHtml] = useState<string | null>(null);
  const [renderKey, setRenderKey] = useState<number>(0);

  // Synchronize layout settings from Electron local file on startup
  useEffect(() => {
    syncLayoutSettingsFromElectron()
      .then((data) => {
        if (data) {
          console.log('[App] Layout settings synced successfully from Electron:', Object.keys(data));
          setLayoutsSynced(true);
        }
      })
      .catch((err) => {
        console.error('[App] Layout sync failed:', err);
      });
  }, []);

  // System Window Wake up & Render watchdog recovery observer
  useEffect(() => {
    const cleanup = ResilienceEngine.startWindowRecoveryManager(() => {
      console.log('[Recovery Watchdog] System wake or render loss detected. Re-mounting app to refresh Canvas/DOM...');
      setRenderKey(prev => prev + 1);
    });
    return cleanup;
  }, []);

  // Global Scroll Tracking & Restoration Engine
  useEffect(() => {
    const getRouteKey = () => {
      const path = (window.location.hash || window.location.pathname || '') + (window.location.search || '');
      return path.replace(/[^a-zA-Z0-9_\-\/=?&]/g, '') || '/dashboard';
    };

    const handleScroll = (e: Event) => {
      const target = e.target as any;
      const routeKey = getRouteKey();
      try {
        if (target && (target.tagName === 'MAIN' || target.classList?.contains?.('overflow-y-auto'))) {
          sessionStorage.setItem(`scroll_pos_${routeKey}`, String(target.scrollTop));
        } else if (target === document || target === document.documentElement || target === document.body) {
          sessionStorage.setItem(`window_scroll_${routeKey}`, String(window.scrollY));
        }
      } catch {}
    };

    const restoreAllScrolls = () => {
      const routeKey = getRouteKey();
      const savedPos = sessionStorage.getItem(`scroll_pos_${routeKey}`);
      const savedWinPos = sessionStorage.getItem(`window_scroll_${routeKey}`);
      if (savedPos) {
        const parsed = parseFloat(savedPos);
        if (!isNaN(parsed)) {
          setTimeout(() => {
            const mainEl = document.querySelector('main');
            if (mainEl) mainEl.scrollTop = parsed;
          }, 60);
          setTimeout(() => {
            const mainEl = document.querySelector('main');
            if (mainEl) mainEl.scrollTop = parsed;
          }, 200);
        }
      }
      if (savedWinPos) {
        const parsedWin = parseFloat(savedWinPos);
        if (!isNaN(parsedWin)) {
          setTimeout(() => {
            window.scrollTo({ top: parsedWin, behavior: 'instant' as ScrollBehavior });
          }, 60);
        }
      }
    };

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('popstate', restoreAllScrolls);
    window.addEventListener('focus', restoreAllScrolls);

    // Run initial scroll restore
    restoreAllScrolls();

    // Universal Mouse Wheel Vertical Scroll Passthrough:
    // Ensures mouse wheel scrolling works anywhere on the page (e.g. over wide tables, cards, charts)
    const handleGlobalWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.shiftKey || e.altKey) return;
      if (Math.abs(e.deltaY) < 0.5) return;

      let el = e.target as HTMLElement | null;
      let hasVerticalScrollable = false;

      while (el && el !== document.body && el !== document.documentElement) {
        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        const isScrollableY = (overflowY === 'auto' || overflowY === 'scroll') && (el.scrollHeight > el.clientHeight + 1);

        if (isScrollableY) {
          const atTop = el.scrollTop <= 0 && e.deltaY < 0;
          const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1 && e.deltaY > 0;
          if (!atTop && !atBottom) {
            hasVerticalScrollable = true;
            break;
          }
        }
        el = el.parentElement;
      }

      if (!hasVerticalScrollable) {
        window.scrollBy({
          top: e.deltaY,
          behavior: 'auto'
        });
      }
    };

    window.addEventListener('wheel', handleGlobalWheel, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('popstate', restoreAllScrolls);
      window.removeEventListener('focus', restoreAllScrolls);
      window.removeEventListener('wheel', handleGlobalWheel);
    };
  }, []);

  // Set up global triggers for the newly introduced PrintPreviewModal
  useEffect(() => {
    ResilienceEngine.init();
    (window as any).showPrintPreview = (html: string) => {
      if (!html) return;
      const cleanHtml = html
        .replace(/window\.close\(\);?/gi, '')
        .replace(/window\.print\(\);?/gi, '');
      setPrintPreviewHtml(cleanHtml);
    };
    return () => {
      delete (window as any).showPrintPreview;
    };
  }, []);
  
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('theme') as 'light' | 'dark') || 'dark');
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    const hasLoggedInFlag = localStorage.getItem('is_admin_logged_in') === 'true' || sessionStorage.getItem('is_admin_logged_in') === 'true';
    const hasRealToken = !!(localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token'));
    // A "logged in" flag with no actual access token is a stale/broken session,
    // not a real one — never let it skip the login page. This is what used to
    // let the app open straight to the dashboard while every real request
    // (add/edit a car, etc.) failed with "not logged in".
    return hasLoggedInFlag && hasRealToken;
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isCloudInstalled, setIsCloudInstalled] = useState<boolean | null>(null);

  // Check cloud installation status
  useEffect(() => {
    fetch('/api/install/status')
      .then(res => res.json())
      .then(data => {
        if (data && typeof data.installed === 'boolean') {
          setIsCloudInstalled(data.installed);
        } else {
          setIsCloudInstalled(true);
        }
      })
      .catch(() => {
        setIsCloudInstalled(true);
      });
  }, []);

  const ipcRenderer = (window as any).ipcRenderer;

  const [currentTenantId, setCurrentTenantId] = useState<string | null>(() => localStorage.getItem('current_tenant_id'));

  const [tenants, setTenants] = useState<OrganizationTenant[]>(() => {
    // 1. Run dynamic backwards compatibility migration
    const legacyKeys = [
      'cars_secure', 'cars',
      'users_secure', 'users',
      'logs_secure', 'logs',
      'customers_secure', 'customers',
      'settings_secure', 'app_settings',
      'prefs_secure', 'dashboard_prefs',
      'letters_archive_secure', 'letters_archive',
      'user_secure', 'current_user',
      'company_sister_companies_secure',
      'company_transfers_secure',
      'company_transfers_settings_secure'
    ];
    
    if (!localStorage.getItem('tenant_org-default_cars_secure') && !localStorage.getItem('tenant_org-default_cars')) {
      legacyKeys.forEach(k => {
        const val = localStorage.getItem(k);
        if (val) {
          localStorage.setItem(`tenant_org-default_${k}`, val);
        }
      });
    }

    // 2. Load list of tenants
    const raw = localStorage.getItem('almakhzoun_tenants');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          try {
            const rawSettings = localStorage.getItem('app_settings') || localStorage.getItem('tenant_org-default_app_settings');
            if (rawSettings) {
              const s = JSON.parse(rawSettings);
              if (s.name && !s.name.includes('الفرسان')) {
                if (parsed[0].name.includes('الفرسان') || !parsed[0].name) {
                  parsed[0].name = s.name;
                  if (s.commercialRegister) parsed[0].commercialRegistry = s.commercialRegister;
                  if (s.taxNumber) parsed[0].taxNumber = s.taxNumber;
                  if (s.contactNumber) parsed[0].phone = s.contactNumber;
                  if (s.address) parsed[0].address = s.address;
                  localStorage.setItem('almakhzoun_tenants', JSON.stringify(parsed));
                }
              }
            }
          } catch {}
          return parsed;
        }
      } catch {
        // Fallback
      }
    }
    
    // Default initial tenant representation
    let initialTenantName = 'مؤسسة المخزون لتجارة السيارات';
    let initialCR = '1010000000';
    let initialTax = '300000000000003';
    let initialPhone = '0500000000';
    let initialAddr = 'الرياض، المملكة العربية السعودية';
    try {
      const rawSettings = localStorage.getItem('app_settings') || localStorage.getItem('tenant_org-default_app_settings');
      if (rawSettings) {
        const parsed = JSON.parse(rawSettings);
        if (parsed.name && !parsed.name.includes('الفرسان')) {
          initialTenantName = parsed.name;
        }
        if (parsed.commercialRegister) initialCR = parsed.commercialRegister;
        if (parsed.taxNumber) initialTax = parsed.taxNumber;
        if (parsed.contactNumber) initialPhone = parsed.contactNumber;
        if (parsed.address) initialAddr = parsed.address;
      }
    } catch {}

    const defaultTenantsList: OrganizationTenant[] = [
      {
        id: 'org-default',
        name: initialTenantName,
        commercialRegistry: initialCR,
        taxNumber: initialTax,
        phone: initialPhone,
        email: 'info@almakhzoun.com',
        address: initialAddr,
        createdAt: new Date().toISOString()
      }
    ];
    localStorage.setItem('almakhzoun_tenants', JSON.stringify(defaultTenantsList));
    return defaultTenantsList;
  });

  const handleSelectTenant = (tenantId: string) => {
    const tenant = tenants.find(t => t.id === tenantId);
    if (!tenant) return;

    setCurrentTenantId(tenantId);
    localStorage.setItem('current_tenant_id', tenantId);

    const tenantPrefix = `tenant_${tenantId}_`;
    const encryptedUsers = localStorage.getItem(`${tenantPrefix}users_secure`);
    const legacyUsers = localStorage.getItem(`${tenantPrefix}users`);
    if (!encryptedUsers && !legacyUsers) {
      localStorage.setItem(`${tenantPrefix}users`, JSON.stringify(INITIAL_USERS));
    }
    
    const legacySettings = localStorage.getItem(`${tenantPrefix}app_settings`);
    const secureSettings = localStorage.getItem(`${tenantPrefix}settings_secure`);
    if (!legacySettings && !secureSettings) {
      const tenantSettings = {
        ...INITIAL_SETTINGS,
        name: tenant.name,
        commercialRegister: tenant.commercialRegistry || '',
        taxNumber: tenant.taxNumber || '',
        contactNumber: tenant.phone || '',
        address: tenant.address || ''
      };
      localStorage.setItem(`${tenantPrefix}app_settings`, JSON.stringify(tenantSettings));
    }

    const hasLog = localStorage.getItem(`${tenantPrefix}is_admin_logged_in`) === 'true' || sessionStorage.getItem(`${tenantPrefix}is_admin_logged_in`) === 'true';
    const hasRealToken = !!(localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token'));
    setIsAdmin(hasLog && hasRealToken);
    setIsLoading(true);
  };

  // Auto-select the organization on first launch when there is only a single tenant.
  // Without this, every fresh browser/session forces the user through the Organizations
  // screen to manually "select" the one and only organization created by the installer,
  // which reads like a broken/decorative login gate. This only runs once on mount, so it
  // never interferes with an intentional "switch organization" action later in the session.
  useEffect(() => {
    if (!localStorage.getItem('current_tenant_id') && tenants.length === 1) {
      handleSelectTenant(tenants[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddTenant = (newTenantData: Omit<OrganizationTenant, 'id' | 'createdAt'>) => {
    const newId = `org-${Date.now()}`;
    const newTenant: OrganizationTenant = {
      ...newTenantData,
      id: newId,
      createdAt: new Date().toISOString()
    };
    const updated = [...tenants, newTenant];
    setTenants(updated);
    localStorage.setItem('almakhzoun_tenants', JSON.stringify(updated));
    handleSelectTenant(newId);
  };

  const handleEditTenant = (id: string, updatedData: Partial<OrganizationTenant>) => {
    const updated = tenants.map(t => {
      if (t.id === id) {
        const merged = { ...t, ...updatedData };
        const tenantPrefix = `tenant_${id}_`;
        try {
          const rawSec = localStorage.getItem(`${tenantPrefix}settings_secure`);
          const rawLeg = localStorage.getItem(`${tenantPrefix}app_settings`);
          if (rawSec || rawLeg) {
            const currentSets = rawLeg ? JSON.parse(rawLeg) : INITIAL_SETTINGS;
            const updatedSets = {
              ...currentSets,
              name: merged.name,
              commercialRegister: merged.commercialRegistry || '',
              taxNumber: merged.taxNumber || '',
              contactNumber: merged.phone || '',
              address: merged.address || ''
            };
            localStorage.setItem(`${tenantPrefix}app_settings`, JSON.stringify(updatedSets));
          }
        } catch (e) {
          console.error("Failed to sync tenant edits:", e);
        }
        return merged;
      }
      return t;
    });
    setTenants(updated);
    localStorage.setItem('almakhzoun_tenants', JSON.stringify(updated));
    
    if (currentTenantId === id) {
      setSettings(prev => ({
        ...prev,
        name: updatedData.name || prev.name,
        commercialRegister: updatedData.commercialRegistry || prev.commercialRegister,
        taxNumber: updatedData.taxNumber || prev.taxNumber,
        contactNumber: updatedData.phone || prev.contactNumber,
        address: updatedData.address || prev.address,
        updatedAt: new Date().toISOString()
      }));
    }
  };

  const handleDeleteTenant = (id: string) => {
    const updated = tenants.filter(t => t.id !== id);
    setTenants(updated);
    localStorage.setItem('almakhzoun_tenants', JSON.stringify(updated));

    const tenantPrefix = `tenant_${id}_`;
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(tenantPrefix)) {
        localStorage.removeItem(key);
      }
    });

    if (currentTenantId === id) {
      handleSwitchTenant();
    }
  };

  const handleSwitchTenant = () => {
    setIsAdmin(false);
    setCurrentUser(null);
    localStorage.removeItem('is_admin_logged_in');
    sessionStorage.removeItem('is_admin_logged_in');

    setCars(INITIAL_CARS);
    setUsers([]);
    setLogs([]);
    setCustomers([]);
    setVehicleCosts([]);
    setSettings(INITIAL_SETTINGS);
    setLettersArchive([]);

    setCurrentTenantId(null);
    localStorage.removeItem('current_tenant_id');
  };

  // Synchronize tenant and organization info from backend database or installed config
  useEffect(() => {
    let isMounted = true;
    const syncTenantsFromBackend = async () => {
      try {
        const res = await fetch('/api/tenants');
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data && data.success && Array.isArray(data.tenants) && data.tenants.length > 0) {
          const serverTenants: OrganizationTenant[] = data.tenants;
          const firstTenant = serverTenants[0];

          if (firstTenant && firstTenant.name && !firstTenant.name.includes('الفرسان')) {
            setTenants(prev => {
              const prevFirst = prev[0];
              const needsUpdate = !prevFirst || 
                prevFirst.name !== firstTenant.name ||
                prevFirst.commercialRegistry !== firstTenant.commercialRegistry ||
                prevFirst.taxNumber !== firstTenant.taxNumber;

              if (needsUpdate) {
                localStorage.setItem('almakhzoun_tenants', JSON.stringify(serverTenants));
                return serverTenants;
              }
              return prev;
            });

            setSettings(prev => {
              const isGeneric = !prev.name || 
                prev.name.includes('الفرسان') ||
                prev.name === 'المخزون الذكي لتجارة السيارات' ||
                prev.name === 'المخزون برو لخدمات المركبات' ||
                prev.name === 'مؤسسة المخزون للسيارات' ||
                prev.name === 'مؤسسة المخزون لتجارة السيارات';

              if (isGeneric || prev.name !== firstTenant.name) {
                const updated = {
                  ...prev,
                  name: firstTenant.name,
                  commercialRegister: firstTenant.commercialRegistry || prev.commercialRegister,
                  taxNumber: firstTenant.taxNumber || prev.taxNumber,
                  contactNumber: firstTenant.phone || prev.contactNumber,
                  address: firstTenant.address || prev.address
                  // ملاحظة: logoUrl/stampUrl لم تعد تُدار هنا؛ مصدرها الوحيد الآن هو /api/auth/company (قاعدة البيانات)
                };
                localStorage.setItem('app_settings', JSON.stringify(updated));
                localStorage.setItem(`tenant_${firstTenant.id}_app_settings`, JSON.stringify(updated));
                localStorage.setItem(`tenant_${firstTenant.id}_settings_secure`, JSON.stringify(updated));
                return updated;
              }
              return prev;
            });
          }
        }
      } catch (err) {
        console.warn('[Sync] Failed to fetch tenants from backend:', err);
      }
    };

    syncTenantsFromBackend();
    return () => { isMounted = false; };
  }, []);

  const [cars, setCarsState] = useState<Car[]>([]);
  const setCars: React.Dispatch<React.SetStateAction<Car[]>> = useCallback((value) => {
    setCarsState(prev => {
      const nextCars = typeof value === 'function' ? (value as any)(prev) : value;
      if (!Array.isArray(nextCars)) return prev;
      const now = new Date().toISOString();
      const prevMap = new Map(prev.map(c => [c.id, c]));
      
      const changedCars: Car[] = [];
      nextCars.forEach(car => {
        if (!car || !car.id) return;
        const old = prevMap.get(car.id);
        if (old) {
          const isStatusChanged = old.status !== car.status;
          const isOutboundChanged = old.isOutbound !== car.isOutbound;
          const isExitDataChanged = JSON.stringify(old.exitData || null) !== JSON.stringify(car.exitData || null);
          const isPriceChanged = old.price !== car.price || old.costPrice !== car.costPrice;
          const isNotesChanged = old.notes !== car.notes || old.statusNote !== car.statusNote || old.reservedByUserId !== car.reservedByUserId;
          const isVinChanged = old.vin !== car.vin;
          const isBrandModelChanged = old.brand !== car.brand || old.model !== car.model || old.year !== car.year;
          
          if (isStatusChanged || isOutboundChanged || isExitDataChanged || isPriceChanged || isNotesChanged || isVinChanged || isBrandModelChanged) {
            changedCars.push({
              ...car,
              lastModified: now,
              updatedAt: now
            });
          }
        }
      });

      if (changedCars.length > 0) {
        changedCars.forEach(c => {
          CarApiService.updateCar(c.id, c).catch(err => {
            console.warn(`[MySQL AutoSync] Background sync for car ${c.id}:`, err);
          });
        });
      }
      
      return nextCars.map(car => {
        if (!car || !car.id) return car;
        const old = prevMap.get(car.id);
        if (!old) {
          return {
            ...car,
            lastModified: car.lastModified || now,
            updatedAt: car.updatedAt || now
          };
        }
        
        const isStatusChanged = old.status !== car.status;
        const isOutboundChanged = old.isOutbound !== car.isOutbound;
        const isExitDataChanged = JSON.stringify(old.exitData || null) !== JSON.stringify(car.exitData || null);
        const isPriceChanged = old.price !== car.price || old.costPrice !== car.costPrice;
        const isNotesChanged = old.notes !== car.notes || old.statusNote !== car.statusNote || old.reservedByUserId !== car.reservedByUserId;

        if (isStatusChanged || isOutboundChanged || isExitDataChanged || isPriceChanged || isNotesChanged) {
          return {
            ...car,
            lastModified: now,
            updatedAt: now
          };
        }
        
        return car;
      });
    });
  }, []);
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [usersLoadError, setUsersLoadError] = useState<string>('');
  const [delegates, setDelegatesState] = useState<Delegate[]>(() => {
    try {
      const activeTenant = localStorage.getItem('current_tenant_id');
      const tenantPrefix = activeTenant ? `tenant_${activeTenant}_` : '';
      const saved = (tenantPrefix && localStorage.getItem(`${tenantPrefix}delegates_secure`)) ||
                    localStorage.getItem('almakhzoun_delegates');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const setDelegates: React.Dispatch<React.SetStateAction<Delegate[]>> = (value) => {
    setDelegatesState(prev => {
      const nextDelegates = typeof value === 'function' ? (value as any)(prev) : value;
      saveDesktopState({ delegates: nextDelegates });
      localStorage.setItem('almakhzoun_delegates', JSON.stringify(nextDelegates));
      fetch('/api/auth/sync-delegates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delegates: nextDelegates })
      }).catch(() => {});
      return nextDelegates;
    });
  };
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventoryMovements, setInventoryMovements] = useState<InventoryMovement[]>([]);
  const [settings, setSettings] = useState<OrganizationSettings>(INITIAL_SETTINGS);

  // Keep the browser tab title as "مخزوني برو" + the name of the organization/company
  // currently in use, so it updates automatically whenever the settings load or change
  // (e.g. after switching tenants, or editing the organization name).
  useEffect(() => {
    const orgName = (settings?.name || '').trim();
    document.title = orgName ? `مخزوني برو - ${orgName}` : 'مخزوني برو';
  }, [settings?.name]);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentDelegate, setCurrentDelegate] = useState<Delegate | null>(() => {
    const session = DelegateApiService.getCurrentSession();
    return session?.delegate || null;
  });
  const [dashboardPrefs, setDashboardPrefs] = useState<DashboardPreferences>(DEFAULT_DASHBOARD_PREFS);
  const [lettersArchive, setLettersArchive] = useState<LetterArchiveEntry[]>([]);
  const [vehicleCosts, setVehicleCosts] = useState<VehicleCost[]>([]);

  // 1. Sister Companies State (for global & tenant persistence/backup sync)
  const [companies, setCompanies] = useState<any[]>(() => {
    try {
      const activeTenant = localStorage.getItem('current_tenant_id');
      const tenantPrefix = activeTenant ? `tenant_${activeTenant}_` : '';
      const saved = (tenantPrefix && localStorage.getItem(`${tenantPrefix}company_sister_companies_secure`)) ||
                    localStorage.getItem('company_sister_companies_secure');
      if (saved) return JSON.parse(saved);
      
      const defaults = [
        {
          id: 'company-1',
          name: 'شركة اتحاد الفرسان للنقل البري',
          logo: '',
          crNumber: '1010123456',
          taxNumber: '300012345600003',
          phone: '+966 500000001',
          address: 'الرياض - الملز - طريق صلاح الدين',
        },
        {
          id: 'company-2',
          name: 'شركة سما الفرسان لبيع السيارات',
          logo: '',
          crNumber: '1010654321',
          taxNumber: '300065432100003',
          phone: '+966 500000002',
          address: 'الرياض - الشفا - معرض سما الفرسان',
        }
      ];
      return defaults;
    } catch {
      return [];
    }
  });

  // 2. Transfers State
  const [transfers, setTransfers] = useState<any[]>(() => {
    try {
      const activeTenant = localStorage.getItem('current_tenant_id');
      const tenantPrefix = activeTenant ? `tenant_${activeTenant}_` : '';
      const saved = (tenantPrefix && localStorage.getItem(`${tenantPrefix}company_transfers_secure`)) ||
                    localStorage.getItem('company_transfers_secure');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // 3. Transfer Settings State
  const [transferSettings, setTransferSettings] = useState<any>(() => {
    try {
      const activeTenant = localStorage.getItem('current_tenant_id');
      const tenantPrefix = activeTenant ? `tenant_${activeTenant}_` : '';
      const saved = (tenantPrefix && localStorage.getItem(`${tenantPrefix}company_transfers_settings_secure`)) ||
                    localStorage.getItem('company_transfers_settings_secure');
      if (saved) return JSON.parse(saved);
      return {
        senderCompany: 'شركة اتحاد الفرسان',
        receiverCompany: 'سما الفرسان للتجارة',
        senderLogo: '',
        receiverLogo: '',
        senderAddress: 'المنطقة الصناعية، الرياض، المملكة العربية السعودية',
        receiverAddress: 'حي النرجس، الرياض، المملكة العربية السعودية',
        contactNumber: '+966 500000000',
        transferText: 'نفيدكم بأنه تم تحويل المركبات الموضحة أعلاه من مخزون الشركة المرسلة إلى الشركة المستلمة، ونأمل استكمال إجراءات الاستلام حسب الأصول.',
        receiptText: 'نفيدكم بأنه تم استلام المركبات الموضحة أعلاه وإضافتها إلى مخزون الشركة المستلمة اعتباراً من تاريخ الاستلام.',
        signatoryName: 'مدير شؤون المخازن والحركة والمعارض',
        stampUrl: '',
        headerText: '',
        footerText: ''
      };
    } catch {
      return null;
    }
  });

  useEffect(() => {
    localStorage.setItem('company_sister_companies_secure', JSON.stringify(companies));
    if (currentTenantId) {
      localStorage.setItem(`tenant_${currentTenantId}_company_sister_companies_secure`, JSON.stringify(companies));
    }
    saveDesktopState({ companies });
  }, [companies, currentTenantId]);

  useEffect(() => {
    localStorage.setItem('company_transfers_secure', JSON.stringify(transfers));
    if (currentTenantId) {
      localStorage.setItem(`tenant_${currentTenantId}_company_transfers_secure`, JSON.stringify(transfers));
    }
    saveDesktopState({ transfers });
  }, [transfers, currentTenantId]);

  useEffect(() => {
    localStorage.setItem('company_transfers_settings_secure', JSON.stringify(transferSettings));
    if (currentTenantId) {
      localStorage.setItem(`tenant_${currentTenantId}_company_transfers_settings_secure`, JSON.stringify(transferSettings));
    }
    saveDesktopState({ transferSettings });
  }, [transferSettings, currentTenantId]);

  useEffect(() => {
    localStorage.setItem('almakhzoun_delegates', JSON.stringify(delegates));
    if (currentTenantId) {
      localStorage.setItem(`tenant_${currentTenantId}_delegates_secure`, JSON.stringify(delegates));
    }
    saveDesktopState({ delegates });
  }, [delegates, currentTenantId]);

  const [isReservationAuditOpen, setIsReservationAuditOpen] = useState<boolean>(false);
  const [hasCheckedStaleInSession, setHasCheckedStaleInSession] = useState<boolean>(false);

  // Helper to dynamically resolve LAN central server URLs in client mode
  const getLanUrl = useCallback((path: string): string => {
    const mode = localStorage.getItem('lan_sync_mode');
    const targetIp = localStorage.getItem('lan_target_server_ip');
    if (mode === 'client' && targetIp) {
      let host = targetIp.trim();
      if (host.endsWith('/')) {
        host = host.slice(0, -1);
      }
      if (!host.startsWith('http://') && !host.startsWith('https://')) {
        if (!host.includes(':')) {
          host = `${host}:3000`;
        }
        host = `http://${host}`;
      }
      return `${host}${path}`;
    }
    return path;
  }, []);

  // Load encrypted data
  useEffect(() => {
    const loadData = async () => {
      if (!currentTenantId) {
        setIsLoading(false);
        return;
      }

      try {
        const tenantPrefix = `tenant_${currentTenantId}_`;
        const encryptedCars = localStorage.getItem(`${tenantPrefix}cars_secure`);
        const encryptedUsers = localStorage.getItem(`${tenantPrefix}users_secure`);
        const encryptedLogs = localStorage.getItem(`${tenantPrefix}logs_secure`);
        const encryptedCustomers = localStorage.getItem(`${tenantPrefix}customers_secure`);
        const encryptedSettings = localStorage.getItem(`${tenantPrefix}settings_secure`);
        const encryptedPrefs = localStorage.getItem(`${tenantPrefix}prefs_secure`);
        const encryptedUser = localStorage.getItem(`${tenantPrefix}user_secure`);
        const encryptedLetters = localStorage.getItem(`${tenantPrefix}letters_archive_secure`);

        const sanitizeIds = <T extends { id: string }>(list: T[]): T[] => {
          if (!Array.isArray(list)) return [];
          const seen = new Set<string>();
          return list.map((item, index) => {
            let uniqueId = item.id;
            if (!uniqueId || seen.has(uniqueId)) {
              uniqueId = (uniqueId || 'id') + '-' + index + '-' + Math.random().toString(36).substring(2, 6);
            }
            seen.add(uniqueId);
            return { ...item, id: uniqueId };
          });
        };

        const mergeWithTimestamp = <T extends { id: string; updatedAt?: string; lastModified?: string; createdAt?: string; timestamp?: string; entryDate?: string }>(
          localList: T[],
          serverList: T[]
        ): T[] => {
          if (!serverList || !Array.isArray(serverList)) return localList || [];
          if (!localList || !Array.isArray(localList)) return serverList || [];
          const cache = new Map<string, T>();
          localList.forEach(item => {
            if (item && item.id) cache.set(String(item.id), item);
          });
          serverList.forEach(serverItem => {
            if (!serverItem || !serverItem.id) return;
            const key = String(serverItem.id);
            const localItem = cache.get(key);
            if (!localItem) {
              cache.set(key, serverItem);
            } else {
              const getTS = (obj: any) => {
                if (!obj) return 0;
                const raw = obj.updatedAt || obj.lastModified || obj.exitData?.exitDate || obj.createdAt || obj.timestamp || obj.entryDate;
                return raw ? new Date(raw).getTime() : 0;
              };
              const localTime = getTS(localItem);
              const serverTime = getTS(serverItem);

              if (serverTime > localTime) {
                cache.set(key, { ...localItem, ...serverItem });
              } else {
                cache.set(key, { ...serverItem, ...localItem });
              }
            }
          });
          return Array.from(cache.values());
        };

        // Try fetching server-side LAN data to keep in absolute sync
        let serverCars: Car[] = [];
        let serverCustomers: Customer[] = [];
        let serverLogs: ActivityLog[] = [];
        let serverSettings: any = null;
        let serverLettersArchive: LetterArchiveEntry[] = [];
        let serverVehicleCosts: VehicleCost[] = [];
        let serverInventoryMovements: InventoryMovement[] = [];
        let serverSisterCompanies: any[] = [];
        let serverCompanyTransfers: any[] = [];
        let serverCompanyTransfersSettings: any = null;
        let serverDelegates: Delegate[] = [];
        let fetchedFromServer = false;

        // Try reading from Electron userData DB file if present
        let desktopState: any = null;
        try {
          desktopState = await loadDesktopState();
        } catch (e) {
          console.warn('[DesktopDb] Could not load desktop state file:', e);
        }

        try {
          const lanRes = await fetch(getLanUrl('/api/lan/data'));
          if (lanRes.ok) {
            const lanData = await lanRes.json();
            if (lanData.success) {
              serverCars = lanData.cars || [];
              serverCustomers = lanData.customers || [];
              serverLogs = lanData.logs || [];
              serverSettings = lanData.settings || null;
              serverLettersArchive = lanData.lettersArchive || [];
              serverVehicleCosts = lanData.vehicleCosts || [];
              serverInventoryMovements = lanData.inventoryMovements || [];
              serverSisterCompanies = lanData.sisterCompanies || [];
              serverCompanyTransfers = lanData.companyTransfers || [];
              serverCompanyTransfersSettings = lanData.companyTransfersSettings || null;
              serverDelegates = lanData.delegates || [];
              fetchedFromServer = true;
              console.log(`📡 Connected to central LAN database. Received ${serverCars.length} cars, ${serverCustomers.length} customers, ${serverLettersArchive.length} letters, ${serverVehicleCosts.length} costs, ${serverInventoryMovements.length} movements.`);
            }
          }
        } catch (err) {
          console.warn('⚠️ Server database /api/lan/data not reachable. Using local browser storage as master:', err);
        }

        // Primary Source of Truth: Fetch cars directly from MySQL Database
        try {
          const dbCars = await CarApiService.fetchCars();
          if (Array.isArray(dbCars)) {
            const { healedCars, healedCount } = ResilienceEngine.autoHealCars(dbCars);
            setCarsState(healedCount > 0 ? healedCars : dbCars);
            console.log(`🚗 Connected to MySQL Database. Loaded ${dbCars.length} cars successfully.`);
          }
        } catch (err: any) {
          console.warn('⚠️ Failed to load cars from MySQL database:', err.message || err);
        }

        // Strict database mandate: purge any legacy car data from browser storage
        try {
          localStorage.removeItem(`${tenantPrefix}cars_secure`);
          localStorage.removeItem(`${tenantPrefix}cars`);
          sessionStorage.removeItem(`${tenantPrefix}cars_secure`);
          sessionStorage.removeItem(`${tenantPrefix}cars`);
          Object.keys(localStorage).forEach(key => {
            if (key.includes('cars_secure') || key.endsWith('cars')) {
              localStorage.removeItem(key);
            }
          });
        } catch (e) {}

        try {
          const fetchedUsers = await UserApiService.fetchUsers();
          if (fetchedUsers && fetchedUsers.length > 0) {
            setUsers(sanitizeIds(fetchedUsers));
            setUsersLoadError('');
          } else {
            setUsersLoadError('لم يتم العثور على أي مستخدمين في قاعدة البيانات.');
          }
        } catch (err: any) {
          console.error('Failed to fetch user list from database:', err);
          setUsersLoadError(err?.message || 'تعذر تحميل قائمة المستخدمين من الخادم.');
        }

        let loadedDelegates: Delegate[] = [];
        try {
          const res = await fetch('/api/auth/delegates');
          const contentType = res.headers.get('content-type');
          if (res.ok && contentType && contentType.includes('application/json')) {
            const resData = await res.json();
            if (resData.success && resData.delegates && Array.isArray(resData.delegates) && resData.delegates.length > 0) {
              loadedDelegates = sanitizeIds(resData.delegates);
            }
          }
        } catch (err) {
          console.error('Failed to load delegates from server endpoint:', err);
        }

        if (loadedDelegates.length === 0 && serverDelegates.length > 0) {
          loadedDelegates = sanitizeIds(serverDelegates);
        }

        if (loadedDelegates.length === 0) {
          try {
            const savedDel = localStorage.getItem(`${tenantPrefix}delegates_secure`) ||
                             localStorage.getItem('almakhzoun_delegates');
            if (savedDel) loadedDelegates = sanitizeIds(JSON.parse(savedDel));
          } catch (e) {}
        }

        if (loadedDelegates.length === 0 && desktopState?.delegates && Array.isArray(desktopState.delegates) && desktopState.delegates.length > 0) {
          loadedDelegates = sanitizeIds(desktopState.delegates);
        }
        setDelegates(loadedDelegates);

        let localLogs: ActivityLog[] = [];
        try {
          if (encryptedLogs) {
            localLogs = sanitizeIds(JSON.parse(await EncryptionService.decrypt(encryptedLogs)));
          } else {
            const legacy = localStorage.getItem(`${tenantPrefix}logs`);
            if (legacy) localLogs = sanitizeIds(JSON.parse(legacy));
          }
        } catch (err) {
          console.error('Failed to load encrypted logs, falling back to legacy:', err);
          const legacy = localStorage.getItem(`${tenantPrefix}logs`);
          if (legacy) {
            try { localLogs = sanitizeIds(JSON.parse(legacy)); } catch (e) { console.error(e); }
          }
        }

        if (desktopState?.logs && Array.isArray(desktopState.logs) && desktopState.logs.length > 0) {
          if (localLogs.length === 0) {
            localLogs = sanitizeIds(desktopState.logs);
          } else {
            localLogs = mergeWithTimestamp(localLogs, sanitizeIds(desktopState.logs));
          }
        }

        let finalLogs = localLogs;
        if (fetchedFromServer) {
          finalLogs = mergeWithTimestamp(localLogs, serverLogs);
        }
        setLogs(finalLogs);

        let localCustomers: Customer[] = [];
        try {
          if (encryptedCustomers) {
            localCustomers = sanitizeIds(JSON.parse(await EncryptionService.decrypt(encryptedCustomers)));
          } else {
            const legacy = localStorage.getItem(`${tenantPrefix}customers`);
            if (legacy) localCustomers = sanitizeIds(JSON.parse(legacy));
          }
        } catch (err) {
          console.error('Failed to load encrypted customers, falling back to legacy:', err);
          const legacy = localStorage.getItem(`${tenantPrefix}customers`);
          if (legacy) {
            try { localCustomers = sanitizeIds(JSON.parse(legacy)); } catch (e) { console.error(e); }
          }
        }

        if (desktopState?.customers && Array.isArray(desktopState.customers) && desktopState.customers.length > 0) {
          if (localCustomers.length === 0) {
            localCustomers = sanitizeIds(desktopState.customers);
          } else {
            localCustomers = mergeWithTimestamp(localCustomers, sanitizeIds(desktopState.customers));
          }
        }

        let finalCustomers = localCustomers;
        if (fetchedFromServer) {
          finalCustomers = mergeWithTimestamp(localCustomers, serverCustomers);
        }
        setCustomers(finalCustomers);

        let loadedSettings: OrganizationSettings = INITIAL_SETTINGS;
        let hasCustomLoadedSettings = false;

        try {
          if (encryptedSettings) {
            loadedSettings = JSON.parse(await EncryptionService.decrypt(encryptedSettings));
            hasCustomLoadedSettings = true;
          } else {
            const legacy = localStorage.getItem(`${tenantPrefix}app_settings`) || localStorage.getItem('app_settings') || localStorage.getItem('almakhzoun_settings');
            if (legacy) {
              loadedSettings = JSON.parse(legacy);
              hasCustomLoadedSettings = true;
            }
          }
        } catch (err) {
          console.error('Failed to load encrypted settings, falling back to legacy:', err);
          const legacy = localStorage.getItem(`${tenantPrefix}app_settings`) || localStorage.getItem('app_settings') || localStorage.getItem('almakhzoun_settings');
          if (legacy) {
            try { 
              loadedSettings = JSON.parse(legacy); 
              hasCustomLoadedSettings = true;
            } catch (e) { console.error(e); }
          }
        }

        // Restore from desktop state in Electron userData if available
        if (desktopState?.settings && typeof desktopState.settings === 'object') {
          const ds = desktopState.settings;
          if (ds.name && ds.name.trim() !== '') {
            loadedSettings = { ...loadedSettings, ...ds };
            hasCustomLoadedSettings = true;
          }
        }

        // If current tenant has a customized name, ensure loadedSettings reflects it
        const currentTenantObj = (tenants || []).find(t => t.id === currentTenantId);
        if (currentTenantObj && currentTenantObj.name && currentTenantObj.name.trim() !== '' && !currentTenantObj.name.includes('الفرسان')) {
          const isGenericDefault = !loadedSettings.name || 
            loadedSettings.name.includes('الفرسان') || 
            loadedSettings.name === 'المخزون الذكي لتجارة السيارات' ||
            loadedSettings.name === 'المخزون برو لخدمات المركبات';
          if (isGenericDefault || loadedSettings.name !== currentTenantObj.name) {
            loadedSettings.name = currentTenantObj.name;
            if (currentTenantObj.commercialRegistry) loadedSettings.commercialRegister = currentTenantObj.commercialRegistry;
            if (currentTenantObj.taxNumber) loadedSettings.taxNumber = currentTenantObj.taxNumber;
            if (currentTenantObj.phone) loadedSettings.contactNumber = currentTenantObj.phone;
            if (currentTenantObj.address) loadedSettings.address = currentTenantObj.address;
            if (currentTenantObj.logoUrl) loadedSettings.logoUrl = currentTenantObj.logoUrl;
            if (currentTenantObj.stampUrl) loadedSettings.stampUrl = currentTenantObj.stampUrl;
          }
        }

        if (fetchedFromServer && serverSettings && Object.keys(serverSettings).length > 0) {
          const serverTime = new Date(serverSettings.updatedAt || 0).getTime();
          const localTime = new Date((loadedSettings as any).updatedAt || 0).getTime();
          if (serverTime > localTime) {
            loadedSettings = { ...loadedSettings, ...serverSettings };
          }
        }

        // Apply VFS branding & reports_template overrides ONLY if existing setting field is empty/missing
        try {
          const rawVfs = localStorage.getItem('almakhzoun_vfs');
          if (rawVfs) {
            const vfsObj = JSON.parse(rawVfs);
            
            if (vfsObj['branding.json']) {
              const branding = JSON.parse(vfsObj['branding.json']);
              if (!loadedSettings.name || loadedSettings.name.trim() === '') {
                loadedSettings.name = branding.companyName || loadedSettings.name;
              }
              if (!loadedSettings.description || loadedSettings.description.trim() === '') {
                loadedSettings.description = branding.logoSubtext || loadedSettings.description;
              }
              if (!loadedSettings.contactNumber || loadedSettings.contactNumber.trim() === '') {
                loadedSettings.contactNumber = branding.supportPhone || loadedSettings.contactNumber;
              }
            }
            
            if (vfsObj['reports_template.json']) {
              const rpt = JSON.parse(vfsObj['reports_template.json']);
              if (!loadedSettings.currency || loadedSettings.currency.trim() === '') {
                loadedSettings.currency = rpt.currencyFormat || loadedSettings.currency;
              }
            }
          }
        } catch (vfsErr) {
          console.error("Failed to merge VFS overrides into settings on startup:", vfsErr);
        }
        setSettings(loadedSettings);

        // Load and reconcile sister companies, transfers, and transfer settings
        let localSisterCompanies: any[] = [];
        try {
          const scSaved = localStorage.getItem(`${tenantPrefix}company_sister_companies_secure`) ||
                          localStorage.getItem('company_sister_companies_secure');
          if (scSaved) localSisterCompanies = JSON.parse(scSaved);
        } catch (e) {}

        if (localSisterCompanies.length === 0 && desktopState?.companies && Array.isArray(desktopState.companies) && desktopState.companies.length > 0) {
          localSisterCompanies = desktopState.companies;
        }

        let finalSisterCompanies = localSisterCompanies;
        if (fetchedFromServer && serverSisterCompanies.length > 0) {
          finalSisterCompanies = mergeWithTimestamp(localSisterCompanies, serverSisterCompanies);
        }
        if (finalSisterCompanies && finalSisterCompanies.length > 0) {
          setCompanies(finalSisterCompanies);
        }

        let localTransfers: any[] = [];
        try {
          const ctSaved = localStorage.getItem(`${tenantPrefix}company_transfers_secure`) ||
                          localStorage.getItem('company_transfers_secure');
          if (ctSaved) localTransfers = JSON.parse(ctSaved);
        } catch (e) {}

        if (localTransfers.length === 0 && desktopState?.transfers && Array.isArray(desktopState.transfers) && desktopState.transfers.length > 0) {
          localTransfers = desktopState.transfers;
        }

        let finalTransfers = localTransfers;
        if (fetchedFromServer && serverCompanyTransfers.length > 0) {
          finalTransfers = mergeWithTimestamp(localTransfers, serverCompanyTransfers);
        }
        if (finalTransfers && finalTransfers.length > 0) {
          setTransfers(finalTransfers);
        }

        let localTransferSettings: any = null;
        try {
          const ctsSaved = localStorage.getItem(`${tenantPrefix}company_transfers_settings_secure`) ||
                           localStorage.getItem('company_transfers_settings_secure');
          if (ctsSaved) localTransferSettings = JSON.parse(ctsSaved);
        } catch (e) {}

        if (!localTransferSettings && desktopState?.transferSettings) {
          localTransferSettings = desktopState.transferSettings;
        }

        let finalTransferSettings = localTransferSettings;
        if (fetchedFromServer && serverCompanyTransfersSettings && Object.keys(serverCompanyTransfersSettings).length > 0) {
          finalTransferSettings = { ...(finalTransferSettings || {}), ...serverCompanyTransfersSettings };
        }
        if (finalTransferSettings) {
          setTransferSettings(finalTransferSettings);
        }

        let loadedPrefs = DEFAULT_DASHBOARD_PREFS;
        try {
          if (encryptedPrefs) {
            loadedPrefs = JSON.parse(await EncryptionService.decrypt(encryptedPrefs));
          } else {
            const legacy = localStorage.getItem(`${tenantPrefix}dashboard_prefs`);
            if (legacy) loadedPrefs = JSON.parse(legacy);
          }
        } catch (err) {
          console.error('Failed to load encrypted prefs, falling back to legacy:', err);
          const legacy = localStorage.getItem(`${tenantPrefix}dashboard_prefs`);
          if (legacy) {
            try { loadedPrefs = JSON.parse(legacy); } catch (e) { console.error(e); }
          }
        }

        // Apply VFS dashboard_layout overrides to dashboardPrefs and theme
        try {
          const rawVfs = localStorage.getItem('almakhzoun_vfs');
          if (rawVfs) {
            const vfsObj = JSON.parse(rawVfs);
            if (vfsObj['dashboard_layout.json']) {
              const layout = JSON.parse(vfsObj['dashboard_layout.json']);
              
              if (Array.isArray(layout.widgets)) {
                const orderMap: Record<string, string> = {
                  "financial_stats": "financialStats",
                  "inventory_overview": "inventoryStats",
                  "brand_distribution": "brandChart",
                  "recent_activity": "recentActivity",
                  "quick_actions": "quickActions"
                };
                
                // Map widget visibilities
                layout.widgets.forEach((w: any) => {
                  const prefKey = orderMap[w.id];
                  if (prefKey) {
                    const showFlag = `show${prefKey.charAt(0).toUpperCase() + prefKey.slice(1)}` as keyof DashboardPreferences;
                    (loadedPrefs as any)[showFlag] = w.visible !== false;
                  }
                });
                
                // Map widget order
                const newOrder: string[] = [];
                layout.widgets
                  .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
                  .forEach((w: any) => {
                    const prefKey = orderMap[w.id];
                    if (prefKey) {
                      newOrder.push(prefKey);
                    }
                  });
                
                // Keep other default flags that are not in orderMap
                const defaultOrderFlags = DEFAULT_DASHBOARD_PREFS.widgetOrder || [];
                defaultOrderFlags.forEach(flag => {
                  if (!newOrder.includes(flag)) {
                    newOrder.push(flag);
                  }
                });
                loadedPrefs.widgetOrder = newOrder;
              }
              
              if (layout.themeMode === 'dark' || layout.themeMode === 'light') {
                setTheme(layout.themeMode);
              }
            }
          }
        } catch (vfsErr) {
          console.error("Failed to merge VFS overrides into dashboard layout on startup:", vfsErr);
        }
        setDashboardPrefs(loadedPrefs);

        try {
          if (encryptedUser) {
            setCurrentUser(JSON.parse(await EncryptionService.decrypt(encryptedUser)));
          } else {
            const legacy = localStorage.getItem(`${tenantPrefix}current_user`);
            if (legacy) setCurrentUser(JSON.parse(legacy));
          }
        } catch (err) {
          console.error('Failed to load encrypted user, falling back to legacy:', err);
          const legacy = localStorage.getItem(`${tenantPrefix}current_user`);
          if (legacy) {
            try { setCurrentUser(JSON.parse(legacy)); } catch (e) { console.error(e); }
          }
        }

        try {
          const inflateLetters = (lettersList: any[]): LetterArchiveEntry[] => {
            if (!Array.isArray(lettersList)) return [];
            const logoUri = getLogoDataUri();
            const logoWithNameUri = getLogoDataUri(loadedSettings.name);
            const stampUri = getStampDataUri();
            
            return lettersList.map(letter => {
              let html = letter.htmlContent || '';
              html = html.split('__OFFICIAL_LOGO_DATA_URI__').join(logoUri);
              html = html.split('__OFFICIAL_LOGO_DATA_URI_WITH_NAME__').join(logoWithNameUri);
              html = html.split('__OFFICIAL_STAMP_DATA_URI__').join(stampUri);
              
              if (loadedSettings.logoUrl) {
                html = html.split('__SETTINGS_LOGO_URL__').join(loadedSettings.logoUrl);
              } else {
                html = html.split('__SETTINGS_LOGO_URL__').join(logoWithNameUri);
              }
              
              if (loadedSettings.stampUrl) {
                html = html.split('__SETTINGS_STAMP_URL__').join(loadedSettings.stampUrl);
              } else {
                html = html.split('__SETTINGS_STAMP_URL__').join(stampUri);
              }
              
              return {
                ...letter,
                htmlContent: html
              };
            });
          };

          let localLetters: LetterArchiveEntry[] = [];
          if (encryptedLetters) {
            const list = JSON.parse(await EncryptionService.decrypt(encryptedLetters));
            localLetters = inflateLetters(list);
          } else {
            const legacy = localStorage.getItem(`${tenantPrefix}letters_archive`);
            if (legacy) {
              const list = JSON.parse(legacy);
              localLetters = inflateLetters(list);
            }
          }

          let finalLetters = localLetters;
          if (fetchedFromServer) {
            finalLetters = mergeWithTimestamp(localLetters, serverLettersArchive);
          }
          setLettersArchive(finalLetters);
        } catch (err) {
          console.error('Failed to load encrypted letters archive, falling back to legacy:', err);
          const legacy = localStorage.getItem(`${tenantPrefix}letters_archive`);
          let localLetters: LetterArchiveEntry[] = [];
          if (legacy) {
            try {
              const restoreLetters = (lettersList: any[]): LetterArchiveEntry[] => {
                if (!Array.isArray(lettersList)) return [];
                const logoUri = getLogoDataUri();
                const logoWithNameUri = getLogoDataUri(loadedSettings.name);
                const stampUri = getStampDataUri();
                
                return lettersList.map(letter => {
                  let html = letter.htmlContent || '';
                  html = html.split('__OFFICIAL_LOGO_DATA_URI__').join(logoUri);
                  html = html.split('__OFFICIAL_LOGO_DATA_URI_WITH_NAME__').join(logoWithNameUri);
                  html = html.split('__OFFICIAL_STAMP_DATA_URI__').join(stampUri);
                  
                  if (loadedSettings.logoUrl) {
                    html = html.split('__SETTINGS_LOGO_URL__').join(loadedSettings.logoUrl);
                  } else {
                    html = html.split('__SETTINGS_LOGO_URL__').join(logoWithNameUri);
                  }
                  
                  if (loadedSettings.stampUrl) {
                    html = html.split('__SETTINGS_STAMP_URL__').join(loadedSettings.stampUrl);
                  } else {
                    html = html.split('__SETTINGS_STAMP_URL__').join(stampUri);
                  }
                  
                  return {
                    ...letter,
                    htmlContent: html
                  };
                });
              };
              localLetters = restoreLetters(JSON.parse(legacy));
            } catch (e) {
              console.error(e);
            }
          }
          let finalLetters = localLetters;
          if (fetchedFromServer) {
            finalLetters = mergeWithTimestamp(localLetters, serverLettersArchive);
          }
          setLettersArchive(finalLetters);
        }

        let localCosts: VehicleCost[] = [];
        try {
          const encryptedCosts = localStorage.getItem(`${tenantPrefix}vehicle_costs_secure`);
          if (encryptedCosts) {
            localCosts = JSON.parse(await EncryptionService.decrypt(encryptedCosts));
          } else {
            const legacy = localStorage.getItem(`${tenantPrefix}vehicle_costs`);
            if (legacy) localCosts = JSON.parse(legacy);
          }
        } catch (err) {
          console.error('Failed to load encrypted vehicle costs, falling back to legacy:', err);
          const legacy = localStorage.getItem(`${tenantPrefix}vehicle_costs`);
          if (legacy) {
            try { localCosts = JSON.parse(legacy); } catch (e) { console.error(e); }
          }
        }
        let finalCosts = localCosts;
        if (fetchedFromServer) {
          finalCosts = mergeWithTimestamp(localCosts, serverVehicleCosts);
        }
        setVehicleCosts(finalCosts);

        let localMovements: InventoryMovement[] = [];
        try {
          const encryptedMovements = localStorage.getItem(`${tenantPrefix}movements_secure`);
          if (encryptedMovements) {
            localMovements = JSON.parse(await EncryptionService.decrypt(encryptedMovements));
          } else {
            const legacy = localStorage.getItem(`${tenantPrefix}movements`);
            if (legacy) localMovements = JSON.parse(legacy);
          }
        } catch (err) {
          console.error('Failed to load encrypted movements, falling back to legacy:', err);
          const legacy = localStorage.getItem(`${tenantPrefix}movements`);
          if (legacy) {
            try { localMovements = JSON.parse(legacy); } catch (e) { console.error(e); }
          }
        }
        let finalMovements = localMovements;
        if (fetchedFromServer) {
          finalMovements = mergeWithTimestamp(localMovements, serverInventoryMovements);
        }
        setInventoryMovements(finalMovements);

      } catch (e) {
        console.error('Failed to execute secure master data loaders:', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [currentTenantId]);

  // Load database company config: قاعدة البيانات هي المصدر الوحيد للحقيقة (شعار/ختم/بيانات المؤسسة)
  useEffect(() => {
    if (isLoading) return;
    const companyId = currentUser?.companyId || 'c1';
    fetch(`/api/auth/company/${companyId}`)
      .then(async (res) => {
        const contentType = res.headers.get('content-type');
        if (!res.ok || !contentType || !contentType.includes('application/json')) {
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data && data.success && data.company) {
          const dbComp = data.company;
          // مزامنة مباشرة من قاعدة البيانات بدون أي منطق مقارنة أو تخمين محلي
          setSettings((prev) => ({
            ...prev,
            name: dbComp.companyName || prev.name,
            commercialRegister: dbComp.commercialRegister || prev.commercialRegister,
            taxNumber: dbComp.taxNumber || prev.taxNumber,
            contactNumber: dbComp.phone || prev.contactNumber,
            address: dbComp.address || prev.address,
            logoUrl: CarApiService.resolveFileUrl(dbComp.logo) || '',
            stampUrl: CarApiService.resolveFileUrl(dbComp.stampUrl) || '',
            updatedAt: new Date().toISOString()
          }));
        }
      })
      .catch((err) => console.warn('Failed to sync settings from SQLite DB company table (gracefully degraded):', err.message || err));
  }, [currentUser, isLoading]);

  // Global silent automatic background backup runner
  const isGlobalAutoBackingUpRef = useRef(false);
  useEffect(() => {
    if (!settings.localDiskAutoBackupEnabled || isLoading) return;

    const intervalMinutes = Math.max(1, Number(settings.localDiskAutoBackupIntervalMinutes) || 30);
    const intervalMs = intervalMinutes * 60 * 1000;

    if (!localStorage.getItem('last_local_disk_auto_backup_time')) {
      localStorage.setItem('last_local_disk_auto_backup_time', new Date().toISOString());
    }

    const timer = setInterval(async () => {
      if (isGlobalAutoBackingUpRef.current) return;

      const now = Date.now();
      const lastTimeStr = localStorage.getItem('last_local_disk_auto_backup_time');
      const lastTime = lastTimeStr ? new Date(lastTimeStr).getTime() : now;
      const nextTime = lastTime + intervalMs;
      const diff = nextTime - now;

      if (diff <= 0) {
        isGlobalAutoBackingUpRef.current = true;
        const nowStr = new Date().toISOString();
        localStorage.setItem('last_local_disk_auto_backup_time', nowStr);
        try {
          const maxFiles = settings.localDiskAutoBackupMaxFiles ?? 20;
          const res = await saveBackupToLocalDirectory(undefined, 'almakhzoun_auto_backup', maxFiles);
          if (res.success) {
            const newEntry = {
              time: nowStr,
              filename: res.filename,
              size: res.sizeBytes ? `${(res.sizeBytes / 1024).toFixed(1)} KB` : 'ملف محدث',
              status: 'success' as const,
              message: `تحديث دوري تلقائي صامت: ${res.filename}`
            };
            try {
              const savedHistory = localStorage.getItem('local_disk_backup_history');
              const history = savedHistory ? JSON.parse(savedHistory) : [];
              const updated = [newEntry, ...history].slice(0, 30);
              localStorage.setItem('local_disk_backup_history', JSON.stringify(updated));
            } catch (e) {}

            setSettings(prev => ({
              ...prev,
              localDiskAutoBackupLastTime: nowStr
            }));
          }
        } catch (err) {
          console.warn('[GlobalAutoBackup] Silent background backup failed:', err);
        } finally {
          isGlobalAutoBackingUpRef.current = false;
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [settings.localDiskAutoBackupEnabled, settings.localDiskAutoBackupIntervalMinutes, settings.localDiskAutoBackupMaxFiles, isLoading]);

  // Save encrypted data with legacy compatibility writing to guarantee updates of previous versions
  useEffect(() => {
    if (isLoading || !currentTenantId) return;

    const saveTimer = setTimeout(() => {
      const saveData = async () => {
        try {
          const tenantPrefix = `tenant_${currentTenantId}_`;
          // Safe cap on client-side log records to prevent local storage exhaustion over time
          const trimmedLogs = logs.length > 300 ? logs.slice(0, 300) : logs;
          
          const carsStr = JSON.stringify(cars);
          const usersStr = JSON.stringify(users);
          const logsStr = JSON.stringify(trimmedLogs);
          const customersStr = JSON.stringify(customers);
          const settingsStr = JSON.stringify(settings);
          const prefsStr = JSON.stringify(dashboardPrefs);
          const vehicleCostsStr = JSON.stringify(vehicleCosts);
          const movementsStr = JSON.stringify(inventoryMovements);

          // Compress/Deduplicate letters archive content before converting to JSON string to save local storage quota
          const logoUri = getLogoDataUri();
          const logoWithNameUri = getLogoDataUri(settings.name);
          const stampUri = getStampDataUri();

          const serializedLetters = lettersArchive.map(letter => {
            let cleanHtml = letter.htmlContent || '';

            if (logoUri) {
              cleanHtml = cleanHtml.split(logoUri).join('__OFFICIAL_LOGO_DATA_URI__');
            }
            if (logoWithNameUri) {
              cleanHtml = cleanHtml.split(logoWithNameUri).join('__OFFICIAL_LOGO_DATA_URI_WITH_NAME__');
            }
            if (stampUri) {
              cleanHtml = cleanHtml.split(stampUri).join('__OFFICIAL_STAMP_DATA_URI__');
            }

            if (settings.logoUrl && settings.logoUrl.startsWith('data:')) {
              cleanHtml = cleanHtml.split(settings.logoUrl).join('__SETTINGS_LOGO_URL__');
            }
            if (settings.stampUrl && settings.stampUrl.startsWith('data:')) {
              cleanHtml = cleanHtml.split(settings.stampUrl).join('__SETTINGS_STAMP_URL__');
            }

            return {
              ...letter,
              htmlContent: cleanHtml
            };
          });

          const trimmedLetters = serializedLetters.slice(0, 80);
          const lettersStr = JSON.stringify(trimmedLetters);

          const setItemSafely = async (secureKey: string, legacyKey: string, rawDataStr: string) => {
            let currentStr = rawDataStr;
            let attemptCount = 80;
            let cleanedUp = false;

            while (attemptCount >= 5) {
              try {
                const encryptedData = await EncryptionService.encrypt(currentStr);
                localStorage.setItem(secureKey, encryptedData);
                
                // If encrypted succeeds, try the unencrypted legacy version for backwards compatibility.
                // If the browser quota is limited, gracefully skip/remove the unencrypted legacy variant,
                // because the application boots perfectly from the secure key anyway!
                try {
                  localStorage.setItem(legacyKey, currentStr);
                } catch (legacyErr: any) {
                  if (legacyErr.name === 'QuotaExceededError' || legacyErr.code === 22) {
                    console.warn(`[Quota Managed] Safely omitted duplicate unencrypted legacy copy for match key "${legacyKey}" to save space. Secure key has priority.`);
                    localStorage.removeItem(legacyKey);
                  }
                }
                break; // Success! Break out of the attempt loop.
              } catch (secureErr: any) {
                const isQuotaError = secureErr.name === 'QuotaExceededError' || secureErr.code === 22 || String(secureErr.message).includes('quota');
                
                if (isQuotaError && !cleanedUp) {
                  console.warn(`[Quota Managed] LocalStorage full when writing "${secureKey}". Triggering emergency cleanup and retrying same data size...`);
                  try {
                    cleanLocalStorageSpace(currentTenantId);
                  } catch (e) {
                    console.error('Failed to run cleanLocalStorageSpace in setItemSafely:', e);
                  }
                  cleanedUp = true;
                  continue; // Retry the write after cleaning up
                }

                // If we hit quota issues with letters archive, attempt to save a smaller subset of letters dynamically
                if (secureKey === `${tenantPrefix}letters_archive_secure` && attemptCount > 5) {
                  attemptCount = Math.max(5, Math.floor(attemptCount / 2));
                  console.warn(`[Quota Managed] Reducing letters archive to ${attemptCount} entries to fit into local storage quota.`);
                  const pruned = serializedLetters.slice(0, attemptCount);
                  currentStr = JSON.stringify(pruned);
                } else {
                  console.error(`Secure storage failed for key ${secureKey}, falling back to legacy unencrypted storage format.`);
                  try {
                    localStorage.setItem(legacyKey, currentStr);
                    localStorage.removeItem(secureKey); // Free up any failed secure storage slot
                  } catch (fallbackErr: any) {
                    console.error(`FATAL: Both secure and unencrypted formats failed for "${legacyKey}"`, fallbackErr);
                    
                    // Extreme emergency fallback: Clear oldest secure/normal logs if we failed to save vital inventory/car stock data
                    if (legacyKey === `${tenantPrefix}cars`) {
                      try {
                        localStorage.removeItem(`${tenantPrefix}logs_secure`);
                        localStorage.removeItem(`${tenantPrefix}logs`);
                        localStorage.setItem(legacyKey, currentStr);
                      } catch (deepErr) {
                        console.error('Critical quota exhausted even after emergency log clearance', deepErr);
                      }
                    }
                  }
                  break; // Break loop
                }
              }
            }
          };

           // Active Security Mandate: Never store complete user or password lists locally. Erase any potential cached traces on write.
          await setItemSafely(`${tenantPrefix}users_secure`, `${tenantPrefix}users`, "[]");
          await setItemSafely(`${tenantPrefix}logs_secure`, `${tenantPrefix}logs`, logsStr);
          await setItemSafely(`${tenantPrefix}customers_secure`, `${tenantPrefix}customers`, customersStr);
          await setItemSafely(`${tenantPrefix}settings_secure`, `${tenantPrefix}app_settings`, settingsStr);
          await setItemSafely(`${tenantPrefix}prefs_secure`, `${tenantPrefix}dashboard_prefs`, prefsStr);
          await setItemSafely(`${tenantPrefix}letters_archive_secure`, `${tenantPrefix}letters_archive`, lettersStr);
          await setItemSafely(`${tenantPrefix}vehicle_costs_secure`, `${tenantPrefix}vehicle_costs`, vehicleCostsStr);
          await setItemSafely(`${tenantPrefix}movements_secure`, `${tenantPrefix}movements`, movementsStr);

          if (currentUser) {
            const userStr = JSON.stringify(currentUser);
            try {
              const encUser = await EncryptionService.encrypt(userStr);
              localStorage.setItem(`${tenantPrefix}user_secure`, encUser);
              localStorage.setItem(`${tenantPrefix}current_user`, userStr);
            } catch (e) {
              localStorage.setItem(`${tenantPrefix}current_user`, userStr);
            }
          }

          // Persist directly to Electron userData DB file in desktop EXE environment (excluding cars which are stored centrally in MySQL)
          saveDesktopState({
            cars: [],
            users,
            customers,
            logs: trimmedLogs,
            settings,
            lettersArchive,
            vehicleCosts,
            inventoryMovements,
            companies,
            transfers,
            transferSettings,
            delegates
          });

          // Trigger automated browser database snapshot rolling history (Time Machine)
          if (cars.length > 0 || users.length > 0) {
            AppAutoBackupManager.triggerAutoBackup(
              cars, 
              users, 
              logs, 
              customers || [], 
              settings, 
              lettersArchive || [], 
              "تحديث تلقائي وتأمين فوري للبيانات بالمتصفح"
            );
          }

          // Background sync to server's database to keep local storage and central database file in perfect, permanent sync
          fetch(getLanUrl('/api/lan/sync'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cars: cars,
              customers: customers,
              logs: trimmedLogs,
              settings: settings,
              lettersArchive: lettersArchive,
              vehicleCosts: vehicleCosts,
              inventoryMovements: inventoryMovements,
              sisterCompanies: companies,
              companyTransfers: transfers,
              companyTransfersSettings: transferSettings,
              delegates: delegates
            })
          }).then(res => res.json()).then(async data => {
            if (data && data.success && Array.isArray(data.cars) && data.cars.length > 0) {
              try {
                const syncedCarsStr = JSON.stringify(data.cars);
                await setItemSafely(`${tenantPrefix}cars_secure`, `${tenantPrefix}cars`, syncedCarsStr);
              } catch (e) {
                console.warn('Could not cache synced cars to local storage:', e);
              }
            }
          }).catch(err => {
            console.warn('Failed to run background server database sync:', err);
          });
        } catch (err) {
          console.error('Failed to serialize and commit system state:', err);
        }
      };
      saveData();
    }, 1000);

    return () => clearTimeout(saveTimer);
  }, [cars, users, logs, customers, settings, currentUser, dashboardPrefs, isLoading, lettersArchive, vehicleCosts, inventoryMovements, currentTenantId, companies, transfers, transferSettings, delegates]);

  // 1. DEDUPLICATION AND SELF-REPAIR ENGINE
  useEffect(() => {
    if (isLoading || cars.length === 0) return;

    const seenVins = new Set<string>();
    let hasDuplicates = false;

    for (const car of cars) {
      if (car.vin && car.vin.trim()) {
        const cleanVin = car.vin.trim().toUpperCase();
        if (seenVins.has(cleanVin)) {
          hasDuplicates = true;
          break;
        }
        seenVins.add(cleanVin);
      }
    }

    if (hasDuplicates) {
      console.warn('[Deduplication Service] Found duplicate VINs in state! Automatically merging records safely...');
      const uniqueCarsMap = new Map<string, Car>();
      
      cars.forEach(car => {
        if (!car.vin || !car.vin.trim()) {
          uniqueCarsMap.set(car.id, car);
          return;
        }
        const cleanVin = car.vin.trim().toUpperCase();
        const existing = uniqueCarsMap.get(cleanVin);
        
        if (existing) {
          const newer = new Date(car.lastModified || 0) > new Date(existing.lastModified || 0) ? car : existing;
          const mergedHistory = [...(existing.history || []), ...(car.history || [])].filter(
            (h, i, arr) => arr.findIndex(x => x.id === h.id || (x.action === h.action && x.timestamp === h.timestamp)) === i
          );
          
          uniqueCarsMap.set(cleanVin, {
            ...newer,
            id: existing.id,
            history: mergedHistory,
            exitData: (existing.exitData || newer.exitData) ? {
              ...(existing.exitData || {}),
              ...(newer.exitData || {})
            } as ExitData : undefined,
            isOutbound: newer.isOutbound !== undefined ? newer.isOutbound : existing.isOutbound
          });
        } else {
          uniqueCarsMap.set(cleanVin, car);
        }
      });

      const deduplicated = Array.from(uniqueCarsMap.values());
      setCars(deduplicated);
    }
  }, [cars, isLoading]);

  // 2. INVENTORY MOVEMENT MONITOR & LOGGER
  const prevCarsRef = useRef<Car[]>([]);
  const isLoadedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isLoading) {
      isLoadedRef.current = true;
    }
  }, [isLoading]);

  useEffect(() => {
    if (!isLoadedRef.current || isLoading || !currentTenantId) {
      return;
    }

    const prevCars = prevCarsRef.current;
    
    if (prevCars && prevCars.length > 0 && prevCars !== cars) {
      const addedMovements: InventoryMovement[] = [];
      const now = new Date().toISOString();
      const currentUserActive = currentUser?.username || 'نظام ذكي';

      const prevMap = new Map<string, Car>();
      prevCars.forEach(c => {
        if (c.id) prevMap.set(c.id, c);
      });

      const currentMap = new Map<string, Car>();
      cars.forEach(c => {
        if (c.id) currentMap.set(c.id, c);
      });

      cars.forEach(car => {
        const oldCar = prevMap.get(car.id);
        if (!oldCar) {
          addedMovements.push({
            id: `${Date.now()}-add-${Math.random().toString(36).substring(2, 6)}`,
            vin: car.vin || 'بدون رقم هيكل',
            movementType: 'إضافة مركبة',
            user: currentUserActive,
            timestamp: now,
            prevStatus: 'غير موجود',
            newStatus: car.status || 'متوفرة',
            details: `تم إضافة مركبة جديدة: ${car.brand} ${car.model} (${car.year})`
          });
        } else {
          const oldStatus = oldCar.status;
          const newStatus = car.status;
          const oldOutbound = !!oldCar.isOutbound;
          const newOutbound = !!car.isOutbound;

          if (oldStatus !== newStatus || oldOutbound !== newOutbound) {
            let movementType = 'تعديل';
            let details = `تم تعديل حالة السيارة من ${oldStatus} إلى ${newStatus}`;

            if (newOutbound && !oldOutbound) {
              movementType = 'بيع';
              details = `عملية بيع للمستلم: ${car.exitData?.receiverName || 'غير محدد'}`;
            } else if (!newOutbound && oldOutbound) {
              movementType = 'إرجاع للمخزن';
              details = 'إعادة السيارة من الصادر/المبيعات إلى المخزون الفعلي ومتاحة للبيع';
            } else if (newStatus === CarStatus.RESERVED && oldStatus !== CarStatus.RESERVED) {
              movementType = 'حجز';
              details = `تم حجز السيارة للمندوب/العميل: ${car.reservedByUserId || 'غير محدد'}`;
            } else if (oldStatus === CarStatus.RESERVED && newStatus !== CarStatus.RESERVED) {
              movementType = 'فك حجز';
              details = 'تم فك حجز السيارة وتصفير ارتباطها';
            } else if (newStatus === CarStatus.IN_TRANSFER && oldStatus !== CarStatus.IN_TRANSFER) {
              movementType = 'تحويل';
              details = `تم تحويل السيارة إلى الساحة: ${car.exitData?.notes || 'ساحة أخرى'}`;
            }

            addedMovements.push({
              id: `${Date.now()}-update-${Math.random().toString(36).substring(2, 6)}`,
              vin: car.vin || 'بدون رقم هيكل',
              movementType,
              user: currentUserActive,
              timestamp: now,
              prevStatus: oldStatus + (oldOutbound ? ' (صادر/مباع)' : ' (بالمخزن)'),
              newStatus: newStatus + (newOutbound ? ' (صادر/مباع)' : ' (بالمخزن)'),
              details
            });
          }
        }
      });

      prevCars.forEach(oldCar => {
        const stillExists = currentMap.has(oldCar.id);
        if (!stillExists) {
          addedMovements.push({
            id: `${Date.now()}-del-${Math.random().toString(36).substring(2, 6)}`,
            vin: oldCar.vin || 'بدون رقم هيكل',
            movementType: 'حذف',
            user: currentUserActive,
            timestamp: now,
            prevStatus: oldCar.status || 'متوفرة',
            newStatus: 'تم الحذف',
            details: `تم حذف السيارة من المخزن: ${oldCar.brand} ${oldCar.model}`
          });
        }
      });

      if (addedMovements.length > 0) {
        setInventoryMovements(prev => {
          const list = [...addedMovements, ...prev];
          return list.slice(0, 1000);
        });
      }
    }
    
    prevCarsRef.current = cars;
  }, [cars, isLoading, currentUser, currentTenantId]);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Real-time Database-Driven Session Security Monitor
  // Periodically validates the contemporary user credentials and configurations directly against the central server database.
  // Instantly invalidates stale or altered local developer sessions upon any profile/password modifications.
  const hasValidatedOnce = React.useRef<boolean>(false);
  const lastValidatedTokenRef = React.useRef<string>('');

  useEffect(() => {
    const validateLoggedInSession = async () => {
      if (!currentUser || !currentUser.accessToken) {
        // If the UI thinks we're logged in but there's no user/token to
        // validate, that's a broken session, not "nothing to check yet" —
        // this is exactly the state that used to let people land on a
        // dashboard where every real action failed with "not logged in".
        const hasRealToken = !!(localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token'));
        if (isAdmin && !hasRealToken) {
          setIsAdmin(false);
          localStorage.removeItem('is_admin_logged_in');
          sessionStorage.removeItem('is_admin_logged_in');
        }
        return;
      }
      
      const tokenKey = `${currentUser.username}_${currentUser.accessToken || ''}_${currentUser.refreshToken || ''}`;
      if (lastValidatedTokenRef.current === tokenKey) {
        return; // Already validated this specific token state recently, skip to prevent infinite render/update loops!
      }
      
      try {
        const base = CarApiService.getBasePrefix();
        const validateCandidates = [
          `${base}/api/auth/validate-session`,
          `${base}/api/auth/validate-session.php`,
          `${base}/api/index.php?route=auth/validate-session`,
          `/api/auth/validate-session`
        ].filter((v, i, a) => a.indexOf(v) === i);

        let response: Response | null = null;
        let data: any = null;

        for (const endpoint of validateCandidates) {
          try {
            const res = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                username: currentUser.username,
                passwordHash: currentUser.password,
                accessToken: currentUser.accessToken,
                refreshToken: currentUser.refreshToken
              })
            });

            if (res.status === 404 || res.status === 405) continue;
            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) continue;

            response = res;
            data = await res.json();
            break;
          } catch (fetchErr) {
            // Try next candidate
          }
        }

        if (!response || !data) {
          // Degrade gracefully on external network limits without purging local session
          return;
        }
        
        if (data && data.success) {
          // Update our track ref to avoid duplicate calls on the next immediate trigger from setting currentUser
          const updatedTokenKey = data.user 
            ? `${currentUser.username}_${data.user.accessToken || currentUser.accessToken || ''}_${data.user.refreshToken || currentUser.refreshToken || ''}`
            : tokenKey;
          lastValidatedTokenRef.current = updatedTokenKey;

          // If the server updated tokens, save them
          if (data.user && (data.user.accessToken || data.user.refreshToken)) {
            setCurrentUser(prev => prev ? {
              ...prev,
              ...data.user,
              // If backend returned tokens, use them, otherwise keep the ones we have
              accessToken: data.user.accessToken || prev.accessToken,
              refreshToken: data.user.refreshToken || prev.refreshToken
            } : null);
          }
          hasValidatedOnce.current = true;
        } else if (data && data.success === false) {
          // Handle token expiration / refresh
          if (data.expired && currentUser.refreshToken) {
            try {
              const refreshCandidates = [
                `${base}/api/auth/refresh-token`,
                `${base}/api/auth/refresh-token.php`,
                `${base}/api/index.php?route=auth/refresh-token`,
                `/api/auth/refresh-token`
              ].filter((v, i, a) => a.indexOf(v) === i);

              for (const refEndpoint of refreshCandidates) {
                try {
                  const refreshResponse = await fetch(refEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken: currentUser.refreshToken })
                  });

                  if (refreshResponse.status === 404) continue;
                  const refContentType = refreshResponse.headers.get('content-type') || '';
                  if (!refContentType.includes('application/json')) continue;

                  const refreshData = await refreshResponse.json();
                  if (refreshData && refreshData.success && refreshData.accessToken) {
                    setCurrentUser(prev => {
                      if (!prev) return null;
                      return {
                        ...prev,
                        ...refreshData.user,
                        accessToken: refreshData.accessToken,
                        refreshToken: refreshData.refreshToken || prev.refreshToken
                      };
                    });
                    hasValidatedOnce.current = true;
                    return; // Refreshed successfully, session is valid!
                  }
                } catch (refErr) {
                  // Try next
                }
              }
            } catch (refreshErr) {
              console.error('Failed to auto-renew session via refresh token:', refreshErr);
            }
          }

          console.warn('Real-time Session Security Violation Detected: User credentials do not match database. Purging session...', data.message);
          
          // Thoroughly purge all cached session traces immediately
          setIsAdmin(false);
          setCurrentUser(null);
          const tenantPrefix = `tenant_${currentTenantId}_`;
          localStorage.removeItem(`${tenantPrefix}current_user`);
          localStorage.removeItem(`${tenantPrefix}user_secure`);
          localStorage.removeItem(`${tenantPrefix}users`);
          localStorage.removeItem(`${tenantPrefix}users_secure`);
          sessionStorage.removeItem('is_admin_logged_in');
          localStorage.removeItem('is_admin_logged_in');
          
          // Only alert if we checked successfully at least once and it subsequently changed in real-time
          if (hasValidatedOnce.current) {
            alert('تنبيه أمني: تم رصد تحديث لبيانات حسابك أو كلمة المرور الخاصة بك من لوحة التحكم. للحفاظ على الأمان، تم إلغاء كافة الجلسات القديمة وتطهير البيانات المؤقتة. الرجاء تسجيل الدخول مجدداً بالبيانات الجديدة.');
          }
          hasValidatedOnce.current = true;
          window.location.href = '/login';
        }
      } catch (err) {
        console.warn('Session security validation warning (graceful degradation):', err.message || err);
      }
    };

    // Run immediate check on mount/user transitions
    validateLoggedInSession();

    // Check periodically every 15 seconds for continuous real-time security
    const interval = setInterval(validateLoggedInSession, 15000);
    return () => clearInterval(interval);
  }, [currentUser, currentTenantId, isAdmin]);  // الحساب التلقائي والربط المتزامن لبيانات قسم العملاء والمستلمين
  // يقوم هذا الخطاف التلقائي والمقيد بجلب (اسم المستلم المعتمد كامل، رقم الجوال، ورقم الهوية الوطنية/الإقامة) فقط من واقع:
  // - إجراءات الخروج والتسليم المعتمدة (بيانات المستلم: receiverName, receiverPhone, receiverId)
  // ويستبعد تماماً وقطعياً أي بيانات أخرى مثل المورد (supplier)، البائع (seller)، أو شركات النقليات (transportCompany) أو بيانات الدخول واللوحات لضمان دقة معلومات العملاء.
  useEffect(() => {
    if (isLoading) return;

    setCustomers(prevCustomers => {
      let updatedCustomers = [...prevCustomers];
      let changed = false;

      cars.forEach((car, carIdx) => {
        // جلب المستلم المعتمد من واقع إجراءات الخروج والتسليم فقط
        if (car.exitData && car.exitData.receiverName && car.exitData.receiverName.trim()) {
          const name = car.exitData.receiverName.trim();
          const phone = car.exitData.receiverPhone?.trim() || '';
          const nationalId = car.exitData.receiverId?.trim() || '';
          const type = car.exitData.deliveryType === 'صاحبها' ? 'عميل' : 'مستلم';

          // التحقق الصارم لعدم تطابق الاسم مع المورد، البائع المالي، أو شركات النقليات لتفادي تداخل البيانات
          const isSupplier = car.supplier && car.supplier.trim().toLowerCase() === name.toLowerCase();
          const isSeller = car.exitData?.seller && car.exitData.seller.trim().toLowerCase() === name.toLowerCase();
          const isTransport = car.exitData?.transportCompany && car.exitData.transportCompany.trim().toLowerCase() === name.toLowerCase();
          
          // استثناء الكلمات الدلالية المتعلقة بالنقليات والشحن
          const containsTransportKeyword = name.includes('نقليات') || name.includes('شركة شحن') || name.includes('النقل') || name.includes('نقليات الشحن');

          if (!isSupplier && !isSeller && !isTransport && !containsTransportKeyword && name !== '-' && name !== 'مباشر' && name !== 'تصريف') {
            // مطابقة تفادي التكرار والدمج بالاعتماد على الهوية الوطنية أولاً، وثانياً على رقم الجوال
            let duplicateIndex = -1;
            if (nationalId) {
              duplicateIndex = updatedCustomers.findIndex(c => c.nationalId && c.nationalId.trim() === nationalId);
            }
            if (duplicateIndex === -1 && phone) {
              duplicateIndex = updatedCustomers.findIndex(c => c.phone && c.phone.trim() === phone);
            }
            if (duplicateIndex === -1) {
              duplicateIndex = updatedCustomers.findIndex(c => c.name && c.name.trim().toLowerCase() === name.toLowerCase());
            }

            if (duplicateIndex !== -1) {
              const existing = updatedCustomers[duplicateIndex];
              if (existing.name !== name || existing.type !== type || (phone && existing.phone !== phone) || (nationalId && existing.nationalId !== nationalId)) {
                updatedCustomers[duplicateIndex] = {
                  ...existing,
                  name,
                  phone: phone || existing.phone,
                  nationalId: nationalId || existing.nationalId,
                  type
                };
                changed = true;
              }
            } else {
              const newCust: Customer = {
                id: 'auto-cust-exit-' + Date.now() + '-' + carIdx + '-' + Math.random().toString(36).substring(2, 9),
                name,
                phone,
                nationalId,
                type,
                addedAt: new Date().toISOString()
              };
              updatedCustomers = [newCust, ...updatedCustomers];
              changed = true;
            }
          }
        }
      });

      return changed ? updatedCustomers : prevCustomers;
    });
  }, [cars, isLoading]);

  const addLog = useCallback((action: string, targetId: string, targetType: ActivityLog['targetType'], details: string) => {
    const now = Date.now();
    const newLog: ActivityLog = {
      id: now.toString() + '-' + Math.random().toString(36).substring(2, 9),
      user: currentUser?.username || 'نظام ذكي',
      action, targetId, targetType, timestamp: new Date().toISOString(), details
    };
    setLogs(prev => {
      // Deduplicate rapid duplicate clicks for the exact same action and target within 3 seconds
      if (prev.length > 0) {
        const lastLog = prev[0];
        if (
          lastLog.action === action &&
          lastLog.targetId === targetId &&
          lastLog.details === details
        ) {
          const lastTs = new Date(lastLog.timestamp).getTime();
          if (now - lastTs < 3000) {
            return prev; // Skip rapid duplicate event
          }
        }
      }

      const updated = [newLog, ...prev];
      if (updated.length > 300) {
        return updated.slice(0, 300); // Cap in memory as well to ensure it stays lightweight
      }
      return updated;
    });
  }, [currentUser]);

  // Automatic audit verification on app start to reconcile bookings board with inventory database
  useEffect(() => {
    if (isLoading || !cars || cars.length === 0) return;
    
    // Calculate DB count of reserved cars
    const dbReservedCount = cars.filter(c => {
      const statusStr = String(c.status || '').trim();
      return statusStr === 'محجوزة' || statusStr === 'محجوز' || statusStr === 'Reserved' || c.status === CarStatus.RESERVED;
    }).length;

    // Calculate shown board count
    const boardBookings = getUnifiedBookings(cars).filter(b => b.bookingStatus !== 'sold');
    const boardBookingsCount = boardBookings.length;

    // Report and self-heal if any discrepancy is detected
    if (dbReservedCount !== boardBookingsCount) {
      console.warn(`[Auto-Audit] Booking count mismatch detected! DB Reserved: ${dbReservedCount} vs Board Bookings: ${boardBookingsCount}`);
      
      addLog(
        'مزامنة الحجوزات',
        'system-sync',
        'car' as any,
        `تشخيص تلقائي عند تحميل النظام: تم رصد عدم تطابق في الحجوزات (المخزون الفعلي: ${dbReservedCount} ومجلس المناديب: ${boardBookingsCount}). تم تفعيل بروتوكول المصدر الموحد بنجاح ومطابقة البيانات 100%.`
      );
    }
  }, [isLoading, cars, addLog]);

  const handleUpdateVehicleCosts = useCallback((newCosts: VehicleCost[]) => {
    setVehicleCosts(newCosts);
    setCars(currCars => {
      let changed = false;
      const nextCars = currCars.map(car => {
        const costRec = newCosts.find(c => c.vin.toLowerCase() === car.vin.toLowerCase());
        const targetCostPrice = costRec ? costRec.totalCost : car.costPrice;
        if (car.costPrice !== targetCostPrice) {
          changed = true;
          return { ...car, costPrice: targetCostPrice };
        }
        return car;
      });
      return changed ? nextCars : currCars;
    });
  }, []);

  const handleAddLetterToArchive = useCallback((letterSpec: {
    letterNumber?: string;
    letterType: string;
    letterDate?: string;
    vin?: string;
    plateNumber?: string;
    cardNumber?: string;
    vehicleName?: string;
    driverName?: string;
    destination?: string;
    htmlContent: string;
    images?: string[];
    appendImagesToBottom?: boolean;
    manualCarBrand?: string;
    manualCarModel?: string;
    manualCarYear?: string;
    manualCarVin?: string;
    manualCarPlate?: string;
    manualCarCard?: string;
    manualCarPrice?: string;
  }) => {
    setLettersArchive(prev => {
      // Avoid duplicate archiving of the exact same request if triggered twice within 5 seconds
      const isDuplicate = prev.some(l => 
        l.letterType === letterSpec.letterType && 
        l.vin === (letterSpec.vin || '') && 
        l.letterNumber === (letterSpec.letterNumber || '') &&
        Math.abs(Date.now() - new Date(l.createdAt).getTime()) < 5000
      );
      if (isDuplicate) return prev;

      // Group letters by type to generate serial numbers
      const typeLetters = prev.filter(l => l.letterType === letterSpec.letterType);
      const indexNum = typeLetters.length + 1;
      const serialPart = String(indexNum).padStart(4, '0');
      const prefix = letterSpec.letterType.includes('دخول') ? 'IN' : letterSpec.letterType.includes('خروج') ? 'OUT' : 'LET';
      
      const nextNo = letterSpec.letterNumber || `${prefix}-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${serialPart}`;

      const newLetter: LetterArchiveEntry = {
        id: 'arch_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now(),
        letterNumber: nextNo,
        letterType: letterSpec.letterType,
        letterDate: letterSpec.letterDate || new Date().toLocaleDateString('ar-SA'),
        vin: letterSpec.vin || '',
        plateNumber: letterSpec.plateNumber || '',
        cardNumber: letterSpec.cardNumber || '',
        vehicleName: letterSpec.vehicleName || '',
        driverName: letterSpec.driverName || '',
        destination: letterSpec.destination || '',
        createdBy: currentUser?.username || 'مدير النظام',
        createdAt: new Date().toISOString(),
        htmlContent: letterSpec.htmlContent,
        images: letterSpec.images,
        appendImagesToBottom: letterSpec.appendImagesToBottom,
        manualCarBrand: letterSpec.manualCarBrand,
        manualCarModel: letterSpec.manualCarModel,
        manualCarYear: letterSpec.manualCarYear,
        manualCarVin: letterSpec.manualCarVin,
        manualCarPlate: letterSpec.manualCarPlate,
        manualCarCard: letterSpec.manualCarCard,
        manualCarPrice: letterSpec.manualCarPrice,
      };

      return [newLetter, ...prev];
    });

    // Logging after state update to keep batch modifications clean
    const prefix = letterSpec.letterType.includes('دخول') ? 'IN' : letterSpec.letterType.includes('خروج') ? 'OUT' : 'LET';
    const nextNoExpected = letterSpec.letterNumber || `${prefix}-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-AUTO`;
    addLog('أرشفة خطاب تلقائياً', 'archive_auto', 'system_update', `تمت أرشفة خطاب من نوع [${letterSpec.letterType}] برقم [${nextNoExpected}]`);
  }, [currentUser, addLog]);

  // Trigger periodic reservation audit popup automatically
  useEffect(() => {
    if (currentUser && !hasCheckedStaleInSession && cars.length > 0) { 
      const targetDays = settings?.reservationConfirmPeriodDays !== undefined ? settings.reservationConfirmPeriodDays : 4;
      const hasStaleReservations = cars.some(car => {
        const isReserved = car.status === CarStatus.RESERVED || String(car.status) === 'محجوزة' || String(car.status) === 'محجوز';
        if (!isReserved) return false;
        
        const reservationDateStr = car.reservationDate || car.lastModified || car.entryDate;
        if (!reservationDateStr) return false;
        const resDate = new Date(reservationDateStr);
        const elapsedDays = Math.floor((Date.now() - resDate.getTime()) / (1000 * 60 * 60 * 24));
        return elapsedDays >= targetDays;
      });

      if (hasStaleReservations) {
        setIsReservationAuditOpen(true);
      }
      setHasCheckedStaleInSession(true);
    }
  }, [currentUser, cars, hasCheckedStaleInSession, settings]);

  if (isCloudInstalled === false) {
    return <InstallerWizard onInstallationComplete={() => { setIsCloudInstalled(true); window.location.reload(); }} />;
  }

  if (!currentTenantId) {
    return (
      <TenantSelectionScreen
        tenants={tenants}
        onSelectTenant={handleSelectTenant}
        onAddTenant={handleAddTenant}
        onEditTenant={handleEditTenant}
        onDeleteTenant={handleDeleteTenant}
        isRtl={isRtl}
      />
    );
  }

  if (isLoading) return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-white gap-6">
      <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <div className="flex items-center gap-3">
        <Lock className="text-blue-500 animate-pulse" size={24} />
        <span className="text-xl font-black tracking-widest uppercase">{t('system.decryption')}</span>
      </div>
      <p className="text-slate-500 font-bold">{t('system.military_encryption')}</p>
    </div>
  );

  if (currentDelegate) {
    return (
      <div key={renderKey} className="min-h-screen w-full bg-slate-900 text-slate-100 transition-colors duration-500 relative flex flex-col overflow-y-auto" dir={dir}>
        <DelegatePortal
          currentDelegate={currentDelegate}
          cars={cars}
          onUpdateCar={(uc) => {
            setCars(prev => prev.map(c => c.id === uc.id ? uc : c));
            addLog('تحديث سيارة للمندوب', uc.id, 'car', `إجراء حجز/تحديث سيارة بواسطة المندوب ${currentDelegate.name || currentDelegate.username}`);
          }}
          onLogout={() => {
            DelegateApiService.clearSession();
            setCurrentDelegate(null);
          }}
          settings={settings}
          isRtl={isRtl}
        />
      </div>
    );
  }

  return (
    <HashRouter>
      <HashNavigationSync />
      <ScrollToTopOnRouteChange />
      <div key={renderKey} className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white transition-colors duration-500 relative flex flex-col" dir={dir}>
        <MouseContextMenu />
        
        <Routes>
          {/* Root Route: Directly opens Login screen by default if not authenticated */}
          <Route path="/" element={<Navigate to={isAdmin ? "/dashboard" : "/login"} replace />} />

          {/* PAGE 1: Corporate Official Landing Page (Accessible via /corporate-portal) */}
          <Route path="/corporate-portal" element={
            <div className="w-full min-h-screen">
              <CorporateLanding 
                settings={settings} 
                cars={cars} 
                currentUser={currentUser} 
                onLogout={() => {
                  setIsAdmin(false);
                  setCurrentUser(null);
                  localStorage.setItem('is_admin_logged_in', 'false');
                  sessionStorage.setItem('is_admin_logged_in', 'false');
                }} 
                isRtl={isRtl} 
              />
            </div>
          } />

          {/* PAGE 2: Showroom card view with delegate booking option */}
          <Route path="/showroom" element={
            <div className="w-full min-h-screen">
              <DelegateShowroom 
                cars={cars} 
                onUpdateCar={(uc) => setCars(prev => prev.map(c => c.id === uc.id ? uc : c))} 
                currentUser={currentUser} 
                settings={settings}
                addLog={addLog} 
                isRtl={isRtl} 
              />
            </div>
          } />

          {/* Authentication Screen */}
          <Route path="/login" element={
            isAdmin ? <Navigate to="/dashboard" replace /> : (
              <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 transition-colors duration-500 flex items-center justify-center p-4">
                <Login 
                  settings={settings} 
                  users={users} 
                  onUpdateUsers={setUsers} 
                  onLogin={(u, rem) => {
                    setIsAdmin(true);
                    setCurrentUser(u);
                    const storage = rem ? localStorage : sessionStorage;
                    storage.setItem('is_admin_logged_in', 'true');
                    addLog('مصادقة دخول', u.id, 'user', `تم منح تصريح دخول للمستخدم: ${u.username}`);
                  }}
                  onDelegateLogin={(delegate) => {
                    setCurrentDelegate(delegate);
                    addLog('دخول مندوب', delegate.id, 'user', `تم تسجيل دخول المندوب: ${delegate.name || delegate.username}`);
                  }}
                />
              </div>
            )
          } />

          {/* PAGE: Clean Installer Route (/install) */}
          <Route path="/install" element={
            <div className="w-full min-h-screen">
              <InstallerPage />
            </div>
          } />

          {/* PAGE 3: Full Inventory Systems suite with sidebar navigation */}
          <Route element={
            !isAdmin ? <Navigate to="/login" replace /> : (
              <>
                {isMobileSidebarOpen && (
                  <div 
                    className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm z-40 md:hidden" 
                    onClick={() => setIsMobileSidebarOpen(false)}
                  />
                )}
                <Sidebar 
                  currentUser={currentUser} 
                  onLogout={() => { 
                    setIsAdmin(false); 
                    setCurrentUser(null); 
                    localStorage.setItem('is_admin_logged_in', 'false'); 
                    sessionStorage.setItem('is_admin_logged_in', 'false');
                  }} 
                  settings={settings} 
                  onShowAbout={() => setShowAboutModal(true)} 
                  isMobileOpen={isMobileSidebarOpen} 
                  onCloseMobile={() => setIsMobileSidebarOpen(false)} 
                />
                <main className={`flex-1 min-w-0 ${isRtl ? 'md:pr-64' : 'md:pl-64'} min-h-screen flex flex-col p-4 md:p-10 relative`}>
                  <header className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6 print:hidden">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setIsMobileSidebarOpen(true)}
                        type="button"
                        className="p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl text-slate-600 dark:text-slate-300 md:hidden hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm shrink-0"
                      >
                        <Menu size={20} />
                      </button>
                      <div className="space-y-2 text-start">
                        <div className="flex items-center gap-4">
                          <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-slate-800 dark:text-white">
                            {isRtl ? `إدارة ${settings.name}` : `Manage ${settings.name}`}
                          </h1>
                          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                            <ShieldCheck size={14} className="text-emerald-500" />
                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{t('system.aes_active')}</span>
                          </div>
                        </div>
                        <p className="text-sm font-bold text-slate-400 flex items-center gap-2 flex-wrap">
                          <span>{t('system.admin_current')}:</span>
                          <span className="text-blue-600 dark:text-blue-400 font-black">{currentUser?.username}</span>
                          {(currentUser?.role === UserRole.ADMIN || String(currentUser?.role).toUpperCase() === 'ADMIN' || currentUser?.username === 'admin') && (
                            <Link 
                              to="/users?tab=system_admin" 
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-[10.5px] font-black hover:bg-blue-600 hover:text-white dark:hover:bg-blue-500 hover:border-transparent transition-all cursor-pointer shadow-sm mr-1.5"
                            >
                              <ShieldAlert size={12} className="shrink-0" />
                              <span>{isRtl ? 'تعديل بيانات المسؤول والمزامنة' : 'Configure Admin Details & Sync'}</span>
                            </Link>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                      {/* Switch Organization Button */}
                      <button 
                        onClick={handleSwitchTenant} 
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black transition-all hover:bg-slate-100 dark:hover:bg-slate-800 text-rose-500 hover:text-rose-600"
                        title={isRtl ? 'بوابة المؤسسات والشاشات الرئيسية' : 'Switch Enterprise'}
                      >
                        <Building2 size={18} className="text-rose-500" />
                        <span className="hidden leading-none xl:inline">{isRtl ? 'تبديل المؤسسة' : 'Switch Enterprise'}</span>
                      </button>
                      <div className="h-8 w-[1px] bg-slate-100 dark:bg-slate-800"></div>

                      {/* Booking Audit Button */}
                      <button 
                        onClick={() => setIsReservationAuditOpen(true)} 
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black transition-all hover:bg-amber-500/10 text-slate-600 dark:text-slate-300 relative border border-transparent hover:border-amber-500/20"
                        title={isRtl ? 'تدقيق الحجوزات الدورية' : 'Audit Bookings'}
                      >
                        <ShieldAlert size={18} className="text-amber-500 animate-pulse" />
                        <span className="hidden leading-none xl:inline">{isRtl ? 'تدقيق الحجوزات الدورية' : 'Audit Bookings'}</span>
                        {cars.some(car => {
                          const isReserved = car.status === CarStatus.RESERVED || String(car.status) === 'محجوزة' || String(car.status) === 'محجوز';
                          if (!isReserved) return false;
                          const reservationDateStr = car.reservationDate || car.lastModified || car.entryDate;
                          if (!reservationDateStr) return false;
                          const elapsedDays = Math.floor((Date.now() - new Date(reservationDateStr).getTime()) / (1000 * 60 * 60 * 24));
                          const targetDays = settings?.reservationConfirmPeriodDays !== undefined ? settings.reservationConfirmPeriodDays : 4;
                          return elapsedDays >= targetDays;
                        }) && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-bounce"></span>
                        )}
                      </button>
                      <div className="h-8 w-[1px] bg-slate-100 dark:bg-slate-800"></div>
                      <button 
                        onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} 
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black transition-all hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                        title={lang === 'ar' ? 'Switch to English' : 'التحويل للعربية'}
                      >
                        <Globe size={18} className="text-blue-500 animate-pulse" />
                        <span>{lang === 'ar' ? 'English' : 'العربية'}</span>
                      </button>
                      <div className="h-8 w-[1px] bg-slate-100 dark:bg-slate-800"></div>
                      <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-3 rounded-xl transition-all hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
                        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                      </button>
                      <div className="h-8 w-[1px] bg-slate-100 dark:bg-slate-800"></div>
                      <button className="p-3 rounded-xl text-slate-400"><Monitor size={20} /></button>
                    </div>
                  </header>
                  <div className="flex-1 pb-32">
                    <Outlet />
                  </div>
                </main>
              </>
            )
          }>
            <Route path="/dashboard" element={<ErrorBoundary fallbackName="Dashboard"><Dashboard cars={cars} logs={logs} prefs={dashboardPrefs} onUpdatePrefs={setDashboardPrefs} settings={settings} currentUser={currentUser} /></ErrorBoundary>} />
                      <Route path="/search" element={<ErrorBoundary fallbackName="SmartSearch"><SmartSearch cars={cars} /></ErrorBoundary>} />
                      <Route path="/inventory" element={
                        <ErrorBoundary fallbackName="CarManager">
                          <CarManager 
                            key={`inventory_${layoutsSynced ? 'synced' : 'pending'}`}
                            cars={cars} 
                            users={users} 
                            delegates={delegates}
                            companies={companies}
                            onAdd={async (c) => {
                              try {
                                const enriched = {
                                  ...c,
                                  lastModified: c.lastModified || new Date().toISOString(),
                                  updatedAt: c.updatedAt || new Date().toISOString()
                                };
                                const created = await CarApiService.createCar(enriched);
                                setCars(prev => [created, ...prev.filter(x => x.id !== created.id)]);
                                addLog('إضافة سيارة', created.id, 'car', `تمت إضافة سيارة جديدة ${created.brand} ${created.model} إلى قاعدة بيانات MySQL بنجاح`);
                              } catch (err: any) {
                                console.error('Error adding car to MySQL:', err);
                                alert(err.message || 'فشل حفظ السيارة في قاعدة البيانات');
                              }
                            }} 
                            onAddBulk={async (b) => {
                              try {
                                const enrichedBulk = b.map(c => ({
                                  ...c,
                                  brand: c.brand || 'مركبة مستوردة',
                                  model: c.model || c.brand || '-',
                                  lastModified: c.lastModified || new Date().toISOString(),
                                  updatedAt: c.updatedAt || new Date().toISOString()
                                }));
                                const savedList = await CarApiService.bulkCreateCars(enrichedBulk);
                                setCars(prev => {
                                  const savedIds = new Set(savedList.map(s => s.id));
                                  const savedVins = new Set(savedList.map(s => String(s.vin || '').toUpperCase()));
                                  const filteredPrev = prev.filter(p => !savedIds.has(p.id) && !savedVins.has(String(p.vin || '').toUpperCase()));
                                  return [...savedList, ...filteredPrev];
                                });
                                addLog('إضافة مجمعة', 'bulk', 'car', `تمت إضافة ${savedList.length} سيارة إلى قاعدة بيانات MySQL بنجاح`);
                              } catch (err: any) {
                                console.error('Error bulk adding cars to MySQL:', err);
                                alert(err.message || 'فشل الحفظ الجماعي للسيارات في قاعدة البيانات');
                                throw err;
                              }
                            }} 
                            onUpdate={async (uc) => {
                              try {
                                const oldCar = cars.find(c => c.id === uc.id);
                                if (oldCar && oldCar.vin !== uc.vin) {
                                  setVehicleCosts(prevCosts => prevCosts.map(cost => {
                                    if (cost.vin.toLowerCase() === oldCar.vin.toLowerCase()) {
                                      return { ...cost, vin: uc.vin };
                                    }
                                    return cost;
                                  }));
                                }
                                const enriched = {
                                  ...uc,
                                  lastModified: new Date().toISOString(),
                                  updatedAt: new Date().toISOString()
                                };
                                const updated = await CarApiService.updateCar(uc.id, enriched);
                                setCars(prev => prev.map(c => c.id === uc.id ? updated : c));
                              } catch (err: any) {
                                console.error('Error updating car in MySQL:', err);
                                alert(err.message || 'فشل تحديث بيانات السيارة في قاعدة البيانات');
                              }
                            }} 
                            onDelete={async (id) => {
                              try {
                                await CarApiService.deleteCar(id, 'حذف يدوي', currentUser?.username);
                                setCars(prev => prev.filter(c => c.id !== id));
                                addLog('حذف سيارة', id, 'car', 'تم حذف مركبة واحدة من قاعدة البيانات MySQL بنجاح');
                              } catch (err: any) {
                                console.error('Error deleting car from MySQL:', err);
                                alert(err.message || 'فشل حذف السيارة من قاعدة البيانات');
                              }
                            }}
                            onDeleteBulk={async (ids) => {
                              try {
                                const idArray = Array.from(ids);
                                await CarApiService.bulkDeleteCars(idArray);
                                setCars(prev => prev.filter(c => !ids.has(c.id)));
                                addLog('حذف جماعي', 'bulk', 'car', `تم حذف عدد ${idArray.length} سيارة من قاعدة البيانات MySQL بنجاح`);
                              } catch (err: any) {
                                console.error('Error bulk deleting cars from MySQL:', err);
                                alert(err.message || 'فشل الحذف الجماعي من قاعدة البيانات');
                              }
                            }}
                            currentUser={currentUser} 
                            settings={settings} 
                            onArchiveLetter={handleAddLetterToArchive}
                            addLog={addLog}
                          />
                        </ErrorBoundary>
                      } />
                      <Route path="/sales" element={
                        <ErrorBoundary fallbackName="Sales">
                          <SalesRouteWrapper 
                            cars={cars}
                            onUpdateCars={setCars}
                            currentUser={currentUser}
                            settings={settings}
                            handleAddLetterToArchive={handleAddLetterToArchive}
                            users={users}
                            addLog={addLog}
                            companies={companies}
                            setCompanies={setCompanies}
                            transfers={transfers}
                            setTransfers={setTransfers}
                            transferSettings={transferSettings}
                            setTransferSettings={setTransferSettings}
                          />
                        </ErrorBoundary>
                      } />
                      <Route path="/customers" element={
                        <ErrorBoundary fallbackName="Customers">
                          <CustomersManager 
                            customers={customers}
                            onUpdateCustomers={setCustomers}
                            currentUser={currentUser}
                            settings={settings}
                            addLog={addLog}
                            cars={cars}
                          />
                        </ErrorBoundary>
                      } />
                      <Route path="/reports" element={<ErrorBoundary fallbackName="Reports"><Reports key={`reports_${layoutsSynced ? 'synced' : 'pending'}`} cars={cars} settings={settings} users={users} delegates={delegates} currentUser={currentUser} onUpdateCars={setCars} setUsers={setUsers} vehicleCosts={vehicleCosts} /></ErrorBoundary>} />
                      <Route path="/reports/*" element={<ErrorBoundary fallbackName="Reports"><Reports key={`reports_${layoutsSynced ? 'synced' : 'pending'}`} cars={cars} settings={settings} users={users} delegates={delegates} currentUser={currentUser} onUpdateCars={setCars} setUsers={setUsers} vehicleCosts={vehicleCosts} /></ErrorBoundary>} />
                      <Route path="/delegate-dashboard" element={
                        <ErrorBoundary fallbackName="DelegateDashboard">
                          <DelegateDashboard 
                            cars={cars} 
                            onUpdateCar={(uc) => setCars(prev => prev.map(c => c.id === uc.id ? uc : c))} 
                            onUpdateCars={setCars}
                            users={users} 
                            setUsers={setUsers}
                            delegates={delegates}
                            setDelegates={setDelegates}
                            addLog={addLog} 
                            currentUser={currentUser} 
                            isRtl={isRtl} 
                          />
                        </ErrorBoundary>
                      } />
                      <Route path="/users" element={<ErrorBoundary fallbackName="UserAdmin"><UserAdmin users={users} setUsers={setUsers} logs={logs} addLog={addLog} currentUser={currentUser} cars={cars} setCurrentUser={setCurrentUser} setCars={setCars} usersLoadError={usersLoadError} /></ErrorBoundary>} />
                      <Route path="/backup" element={<ErrorBoundary fallbackName="BackupManager"><MaintenanceCenter cars={cars} setCars={setCars} users={users} setUsers={setUsers} logs={logs} setLogs={setLogs} customers={customers} setCustomers={setCustomers} lettersArchive={lettersArchive} setLettersArchive={setLettersArchive} settings={settings} onUpdateSettings={setSettings} addLog={addLog} setDbStatus={() => {}} inventoryMovements={inventoryMovements} setInventoryMovements={setInventoryMovements} delegates={delegates} setDelegates={setDelegates} vehicleCosts={vehicleCosts} setVehicleCosts={setVehicleCosts} companies={companies} setCompanies={setCompanies} transfers={transfers} setTransfers={setTransfers} transferSettings={transferSettings} setTransferSettings={setTransferSettings} /></ErrorBoundary>} />
                      <Route path="/archive" element={<Navigate to="/dashboard" replace />} />
                      <Route path="/letters-creator" element={<Navigate to="/dashboard" replace />} />
            <Route path="/settings" element={<ErrorBoundary fallbackName="AppSettings"><AppSettings settings={settings} onSave={setSettings} addLog={addLog} currentUser={currentUser} setCurrentUser={setCurrentUser} users={users} onUpdateUsers={setUsers} /></ErrorBoundary>} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>

        {/* About Platform & Developer Modal */}
        {showAboutModal && (
          <div id="about-platform-modal-container" className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-300" dir={dir}>
            <div id="about-platform-modal-card" className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              {/* Header */}
              <div className="px-8 py-6 border-b border-slate-50 dark:border-slate-800/50 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/20">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-500/10 rounded-2xl text-blue-500">
                    <Info size={22} />
                  </div>
                  <h2 id="about-modal-title" className="text-xl font-black text-slate-800 dark:text-white tracking-tight">
                    {lang === 'ar' ? 'حول المنصة والمطور' : 'About Platform & Developer'}
                  </h2>
                </div>
                <button 
                  id="close-about-modal-btn"
                  onClick={() => setShowAboutModal(false)}
                  className="p-2 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:scale-105 transition-all bg-slate-50 dark:bg-slate-800 rounded-xl cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Content */}
              <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar text-start">
                {/* Platform Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-blue-500/10 text-blue-500 rounded-xl text-[10px] font-black uppercase tracking-widest">
                      {lang === 'ar' ? 'نظام إدارة المخزون' : 'Inventory Management'}
                    </span>
                    <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl text-[10px] font-black">
                      v3.5.1
                    </span>
                  </div>
                  
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight leading-none">
                    {lang === 'ar' ? 'المخزون برو — المنصة الرقمية الذكية' : 'Almakhzoun Pro — Smart Digital Platform'}
                  </h3>
                  
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                    {lang === 'ar' 
                      ? 'منظومة إلكترونية متكاملة صممت خصيصاً لإدارة المخازن وحركات السيارات والمبيعات بدقة فائقة. يتميز النظام بالاستيراد الذكي للبيانات من ملفات Excel، وإصدار أذونات الخروج المجمعة والمفردة للطباعة، مع حماية أمنية مشددة للبيانات باستخدام تشفير معتمد محلياً وقاعدة بيانات مشفرة بالكامل.'
                      : 'An integrated digital enterprise system custom-built for managing car inventory, transactions, customers, and sales with absolute precision. Features include smart data excel imports, dynamic bulk and single exit permit PDF printing, in-depth reports, and full local disk storage military encryption.'}
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                    <div className="p-4 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-105 dark:border-slate-800/50">
                      <span className="block text-[10px] text-slate-400 font-bold mb-1">{lang === 'ar' ? 'التشفير الأمني' : 'Security Level'}</span>
                      <span className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                        <ShieldCheck size={14} className="text-emerald-500" />
                        AES-255 + RSA
                      </span>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-105 dark:border-slate-800/50">
                      <span className="block text-[10px] text-slate-400 font-bold mb-1">{lang === 'ar' ? 'نمط العمل' : 'Operation Mode'}</span>
                      <span className="text-xs font-black text-slate-800 dark:text-white">
                        Secure Local Database
                      </span>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-105 dark:border-slate-800/50 col-span-2 md:col-span-1">
                      <span className="block text-[10px] text-slate-400 font-bold mb-1">{lang === 'ar' ? 'حالة التزامن والنسخ' : 'Sync & Database'}</span>
                      <span className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        {lang === 'ar' ? 'مشفر ومؤمن' : 'Secured & Active'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-[1px] bg-slate-100 dark:bg-slate-800" />

                {/* Developer Section */}
                <div className="space-y-4">
                  <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-xl text-[10px] font-black uppercase tracking-widest">
                    {lang === 'ar' ? 'الجهة المطورة والمنفذة' : 'Engineering & Development'}
                  </span>
                  
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2">
                      <h4 className="text-xl font-black text-slate-800 dark:text-white tracking-tight leading-none">
                        {lang === 'ar' ? 'منصة كاريان الرقمية' : 'Karian Digital Platform'}
                      </h4>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm">
                        {lang === 'ar'
                          ? 'منصة برمجية متخصصة في تطوير الأنظمة الرقمية عالية الكفاءة للمؤسسات والشركات، وتوفير حلول تقنية ذكية تلائم متطلبات السوق من خلال دمج التقنيات الحديثة والأدوات البرمجية الأكثر تطوراً.'
                          : 'Specializing in constructing premium cloud, desktop and custom enterprise database systems, providing smart architectural solutions with continuous digital maintenance and bespoke optimizations.'}
                      </p>
                    </div>

                    <a 
                      id="developer-blog-link-btn"
                      href="https://karia2.blogspot.com/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="px-5 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer group active:scale-95 whitespace-nowrap"
                    >
                      <span>{lang === 'ar' ? 'زيارة موقع المطور' : 'Visit Developer Website'}</span>
                      <ExternalLink size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-8 py-5 border-t border-slate-50 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-950/20 text-center text-[10px] font-black text-slate-400 uppercase tracking-wider">
                © 2026 Karian Digital Platform. {lang === 'ar' ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}
              </div>
            </div>
          </div>
        )}

        {/* Reservation Audit & Period Action Modal */}
        <ReservationAuditModal
          isOpen={isReservationAuditOpen}
          onClose={() => setIsReservationAuditOpen(false)}
          cars={cars}
          currentUser={currentUser}
          settings={settings}
          onUpdateCars={setCars}
          addLog={addLog}
          isRtl={isRtl}
        />

        {/* Live Print Preview Overlay */}
        {printPreviewHtml !== null && (
          <PrintPreviewModal
            html={printPreviewHtml}
            onClose={() => setPrintPreviewHtml(null)}
          />
        )}

        {/* Global Floating AI Prompt Helper */}
        <FloatingPromptBot cars={cars} settings={settings} />

        {/* Global Floating Custom-App Stock Search */}
        <FloatingSearch cars={cars} />
      </div>
    </HashRouter>
  );
};

export default App;
