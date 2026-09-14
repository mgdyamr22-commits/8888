import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { InstallerWizard, InstallApi } from '../install';
import App from '../../App.tsx';
import { 
  RefreshCw, 
  Server, 
  AlertTriangle, 
  ShieldCheck, 
  Wrench, 
  ArrowRight,
  Database,
  CheckCircle2,
  HardDrive
} from 'lucide-react';

export type BootstrapState = 
  | 'CHECKING'
  | 'NOT_INSTALLED'
  | 'INSTALLING'
  | 'INSTALLED'
  | 'API_UNAVAILABLE'
  | 'DATABASE_UNAVAILABLE'
  | 'CONFIG_ERROR'
  | 'UNKNOWN_ERROR';

interface Props {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AppErrorBoundary] Uncaught application exception:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 select-none" dir="rtl">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-8 shadow-2xl space-y-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">تنبيه أثناء تهيئة الواجهة</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                تم عزل استثناء غير متوقع في متصفحك لمنع ظهور الصفحة البيضاء والحفاظ على استقرار النظام.
              </p>
              {this.state.error && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-red-400 text-left overflow-x-auto max-h-32">
                  {this.state.error.message}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => window.location.reload()}
                className="flex items-center justify-center py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors border border-slate-700 text-sm"
              >
                <RefreshCw className="w-4 h-4 ml-2" />
                إعادة المحاولة
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.href = '/install';
                }}
                className="flex items-center justify-center py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors shadow-lg shadow-blue-600/20 text-sm"
              >
                <Wrench className="w-4 h-4 ml-2" />
                فتح معالج التثبيت
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export const AppBootstrap: React.FC = () => {
  const [state, setState] = useState<BootstrapState>('CHECKING');
  const [details, setDetails] = useState<{
    databaseConnected?: boolean;
    hasAdmin?: boolean;
    tablesCount?: number;
    error?: string | null;
  }>({});

  // Helper to test if URL directly requests installer
  const isInstallerUrl = () => {
    const p = window.location.pathname.toLowerCase();
    const h = window.location.hash.toLowerCase();
    const s = window.location.search.toLowerCase();
    return p.includes('install') || h.includes('install') || s.includes('install');
  };

  const [isForcedInstall, setIsForcedInstall] = useState<boolean>(isInstallerUrl);

  const performBootstrapCheck = async () => {
    console.log('[BOOT] starting');
    console.log('[BOOT] requesting /api/install/status');
    setState('CHECKING');
    setDetails({});

    // 8-second watchdog to prevent hanging on slow network or container boot
    const timeout = setTimeout(() => {
      console.warn('[BOOT] API check timed out after 8s');
      setState('API_UNAVAILABLE');
      setDetails({ error: 'استغرق الاتصال بخادم التطبيق وقتاً أطول من المعتاد (انتهت المهلة).' });
    }, 8000);

    try {
      const data = await InstallApi.getStatus();
      clearTimeout(timeout);

      console.log('[BOOT] response body:', data);
      const installed = typeof data.installed === 'boolean' ? data.installed : false;
      const dbConnected = !!data.databaseConnected;

      setDetails({
        databaseConnected: dbConnected,
        hasAdmin: !!data.hasAdmin,
        tablesCount: Number(data.tablesCount) || 0,
        error: null
      });

      console.log(`[BOOT] installation state: ${installed ? 'INSTALLED' : 'NOT_INSTALLED'}`);

      if (installed) {
        console.log('[BOOT] System is INSTALLED. Initializing main application...');

        // Hydrate organization details into localStorage if provided by server
        if (data.organization && data.organization.name && !data.organization.name.includes('الفرسان')) {
          try {
            const org = data.organization;
            const tenantId = 'org-default';
            const tenantObj = {
              id: tenantId,
              name: org.name,
              commercialRegistry: org.commercialRegistry || org.commercialRegister || '',
              taxNumber: org.taxNumber || '',
              phone: org.phone || '',
              email: org.email || '',
              address: org.address || '',
              logoUrl: org.logoUrl || org.logo || '',
              stampUrl: org.stampUrl || org.stamp || '',
              createdAt: new Date().toISOString()
            };
            localStorage.setItem('almakhzoun_tenants', JSON.stringify([tenantObj]));
            localStorage.setItem('current_tenant_id', tenantId);

            let curSettings: any = {};
            try {
              const s = localStorage.getItem('app_settings');
              if (s) curSettings = JSON.parse(s);
            } catch {}

            const mergedSettings = {
              ...curSettings,
              name: org.name,
              commercialRegister: org.commercialRegistry || org.commercialRegister || curSettings.commercialRegister || '',
              taxNumber: org.taxNumber || curSettings.taxNumber || '',
              contactNumber: org.phone || curSettings.contactNumber || '',
              address: org.address || curSettings.address || '',
              logoUrl: org.logoUrl || org.logo || curSettings.logoUrl || '',
              stampUrl: org.stampUrl || org.stamp || curSettings.stampUrl || ''
            };
            localStorage.setItem('app_settings', JSON.stringify(mergedSettings));
            localStorage.setItem(`tenant_${tenantId}_app_settings`, JSON.stringify(mergedSettings));
            localStorage.setItem(`tenant_${tenantId}_settings_secure`, JSON.stringify(mergedSettings));
          } catch (e) {
            console.warn('[BOOT] Error hydrating organization in AppBootstrap:', e);
          }
        }

        setState('INSTALLED');
        // If user navigated with #install or any hash, strip the hash and convert to clean URL
        if (window.location.hash.toLowerCase().includes('install')) {
          try {
            history.replaceState(null, '', window.location.pathname.replace(/\/+$/, '') || '/');
          } catch (e) {}
          window.location.hash = '';
          setIsForcedInstall(false);
        }
      } else {
        console.log('[BOOT] System is NOT_INSTALLED. routing to /install');
        if (window.location.hash.toLowerCase().includes('install')) {
          try {
            history.replaceState(null, '', '/install');
          } catch (e) {}
          window.location.hash = '';
        }
        setState('NOT_INSTALLED');
      }
    } catch (err: any) {
      clearTimeout(timeout);
      console.error('[BOOT] API unavailable or failed to check status:', err);

      // Resilient fallback: If user was previously authenticated or installed flag exists, continue to app
      const hasPreviousSession = 
        localStorage.getItem('is_admin_logged_in') === 'true' ||
        sessionStorage.getItem('is_admin_logged_in') === 'true' ||
        localStorage.getItem('almakhzoun_delegate_session') !== null ||
        localStorage.getItem('system_installed') === 'true';

      if (hasPreviousSession) {
        console.warn('[BOOT] Lock check API failed, but local session found. Proceeding to INSTALLED state.');
        setState('INSTALLED');
        return;
      }

      setState('API_UNAVAILABLE');
      setDetails({
        error: err.message || 'تعذر الاتصال بـ API فحص التثبيت أو خادم MySQL'
      });
    }
  };

  useEffect(() => {
    try {
      if (typeof (window as any).__dismissInitialLoader === 'function') {
        (window as any).__dismissInitialLoader();
      }
    } catch {}

    performBootstrapCheck();

    const handleUrlChange = () => {
      setIsForcedInstall(isInstallerUrl());
    };
    window.addEventListener('hashchange', handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);

    return () => {
      window.removeEventListener('hashchange', handleUrlChange);
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);

  // 1. URL forces installer AND not explicitly installed
  if (isForcedInstall && state === 'NOT_INSTALLED') {
    return (
      <AppErrorBoundary>
        <InstallerWizard
          onInstallationComplete={() => {
            setState('INSTALLED');
            try {
              history.replaceState(null, '', window.location.pathname + window.location.search);
            } catch (e) {}
            window.location.hash = '';
            setIsForcedInstall(false);
            window.location.reload();
          }}
        />
      </AppErrorBoundary>
    );
  }

  // 2. CHECKING STATE (Animated high-contrast loader with clear indicator)
  if (state === 'CHECKING') {
    return (
      <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 select-none" dir="rtl">
        <div className="flex flex-col items-center max-w-md w-full text-center space-y-6">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
            <Server className="w-6 h-6 text-blue-400 absolute inset-0 m-auto animate-pulse" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white tracking-wide">جاري التحقق من حالة النظام...</h2>
            <p className="text-slate-400 text-sm">Almakhzoun Inventory Pro • فحص الخادم وقاعدة البيانات</p>
          </div>
        </div>
      </div>
    );
  }

  // 3. API OR BACKEND UNAVAILABLE (Safe fallback - never a white screen)
  if (state === 'API_UNAVAILABLE' || state === 'DATABASE_UNAVAILABLE' || state === 'CONFIG_ERROR' || state === 'UNKNOWN_ERROR') {
    return (
      <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6" dir="rtl">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-8 shadow-2xl space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white">المخزون برو (Almakhzoun Pro)</h2>
            <p className="text-slate-300 font-bold text-base">تعذر تهيئة النظام تلقائياً</p>
            <p className="text-slate-400 text-sm leading-relaxed">
              {details.error || 'لا يمكن الوصول إلى خادم التطبيق أو أن إعدادات قاعدة البيانات لم تكتمل بعد.'}
            </p>
          </div>

          <div className="pt-2 space-y-2">
            <button
              onClick={performBootstrapCheck}
              className="w-full flex items-center justify-center py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors border border-slate-700 text-sm"
            >
              <RefreshCw className="w-4 h-4 ml-2" />
              إعادة المحاولة (Retry)
            </button>
            <button
              onClick={() => {
                localStorage.setItem('system_installed', 'true');
                setState('INSTALLED');
              }}
              className="w-full flex items-center justify-center py-3 px-4 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 font-bold transition-colors border border-blue-500/30 text-xs"
            >
              المتابعة إلى النظام وتخطي الفحص
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. INSTALLED BUT USER OPENED /install URL (Secure Lock Screen with NO re-install button)
  if (state === 'INSTALLED' && isForcedInstall) {
    return (
      <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6" dir="rtl">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-8 shadow-2xl space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">النظام مثبت ومقفل بالأمان</h2>
            <p className="text-slate-300 text-sm leading-relaxed font-medium">
              تم إكمال تثبيت قاعدة البيانات وحساب المدير العام مسبقاً. تم قفل معالج الإعداد لحماية بيانات المؤسسة من أي محاولات تعديل أو تلاعب.
            </p>
            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-400 leading-relaxed text-right">
              🔒 <strong className="text-slate-300">ملاحظة أمنية لمسؤول الخادم:</strong> تم تفعيل قفل الأمان التلقائي. لإعادة التثبيت الشامل لأسباب إدارية، يجب حذف ملف <code className="text-emerald-400 font-mono">config/installed.json</code> يدوياً من مدير ملفات الاستضافة (cPanel / FTP).
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => {
                try {
                  history.replaceState(null, '', window.location.pathname + window.location.search);
                } catch (e) {}
                window.location.hash = '';
                setIsForcedInstall(false);
                window.location.href = window.location.pathname;
              }}
              className="w-full flex items-center justify-center py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold transition-all shadow-lg shadow-emerald-500/20 text-sm"
            >
              الانتقال إلى لوحة التحكم / تسجيل الدخول
              <ArrowRight className="w-4 h-4 mr-2" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 5. NOT INSTALLED: Render the Setup Wizard IMMEDIATELY!
  if (state === 'NOT_INSTALLED') {
    return (
      <AppErrorBoundary>
        <InstallerWizard
          onInstallationComplete={() => {
            setState('INSTALLED');
            try {
              history.replaceState(null, '', window.location.pathname + window.location.search);
            } catch (e) {}
            window.location.hash = '';
            setIsForcedInstall(false);
            window.location.reload();
          }}
        />
      </AppErrorBoundary>
    );
  }

  // 6. INSTALLED: Mount the Main Application
  return (
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  );
};
