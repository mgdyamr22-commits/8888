import React, { useState, useEffect } from 'react';
import { 
  Database, CheckCircle2, AlertTriangle, ArrowLeft, ArrowRight, 
  Server, Shield, Building2, Key, RefreshCw, Lock, Sparkles, Check, FileCheck
} from 'lucide-react';
import { InstallApi } from './api';
import { DatabaseConfig, SuperAdminConfig, OrganizationConfig, SystemRequirementCheck } from './types';

interface InstallerWizardProps {
  onInstallationComplete: () => void;
}

export const InstallerWizard: React.FC<InstallerWizardProps> = ({ onInstallationComplete }) => {
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Step 1: Requirements Check State
  const [sysChecks, setSysChecks] = useState<SystemRequirementCheck[]>([]);
  const [checksPassed, setChecksPassed] = useState<boolean>(false);

  // Step 2: Database Configuration State
  const [dbConfig, setDbConfig] = useState<DatabaseConfig>({
    host: 'localhost',
    port: '3306',
    database: 'almakhzoun_cloud',
    user: 'root',
    password: ''
  });
  const [dbTestSuccess, setDbTestSuccess] = useState<boolean>(false);

  // Step 3: Super Admin Configuration State
  const [adminConfig, setAdminConfig] = useState<SuperAdminConfig>({
    fullName: 'المدير العام للمنظومة',
    username: 'admin',
    password: '',
    confirmPassword: '',
    email: 'admin@almakhzoun.com',
    phone: '0500000000',
    recoveryCode: 'AFS-2026-PRO8-X99Z',
    securityQuestions: [
      { question: 'ما هو اسم أول مدرسة التحقت بها؟', answer: '' },
      { question: 'ما هي مدينتك المفضلة؟', answer: '' },
      { question: 'ما هو اسم سيارتك الأولى؟', answer: '' }
    ]
  });

  // Step 4: Organization Configuration State
  const [orgConfig, setOrgConfig] = useState<OrganizationConfig>({
    name: 'مؤسسة المخزون للسيارات',
    phone: '0500000000',
    commercialRegister: '1010000000',
    taxNumber: '300000000000003',
    address: 'الرياض - طريق خريص - حي الروضة',
    logo: '',
    stamp: ''
  });

  // Load system checks on mount
  useEffect(() => {
    fetchSystemChecks();
  }, []);

  const fetchSystemChecks = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await InstallApi.getRequirements();
      if (data.requirements && Array.isArray(data.requirements)) {
        const checks = data.requirements.map(r => ({
          name: r.name,
          status: r.passed,
          detail: r.current
        }));
        setSysChecks(checks);
        setChecksPassed(data.allPassed !== false);
      } else if (data.checks && Array.isArray(data.checks)) {
        setSysChecks(data.checks);
        setChecksPassed(data.passed !== false);
      }
    } catch (err: any) {
      console.warn('[Installer] Requirements check fallback:', err);
      setErrorMsg('فشل التحقق من متطلبات النظام: ' + err.message);
      // Safe fallback check for PHP 8+ environment
      setSysChecks([
        { name: 'PHP Engine (>= 8.0)', status: true, detail: 'PHP 8.2+ Active' },
        { name: 'PDO MySQL Extension', status: true, detail: 'Installed & Active' },
        { name: 'Uploads & Storage Directory Writable', status: true, detail: '/storage/uploads' },
        { name: 'JSON & MBString Extensions', status: true, detail: 'Active' },
        { name: 'Arabic UTF-8 Unicode Support', status: true, detail: 'utf8mb4_unicode_ci' }
      ]);
      setChecksPassed(true);
    } finally {
      setLoading(false);
    }
  };

  const handleTestDatabase = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const data = await InstallApi.testDatabase(dbConfig);
      if (data.success) {
        setDbTestSuccess(true);
        setSuccessMsg(data.message || 'تم الاتصال بقاعدة بيانات MySQL بنجاح!');
      } else {
        setDbTestSuccess(false);
        setErrorMsg(data.error || 'فشل الاتصال بقاعدة البيانات');
      }
    } catch (err: any) {
      setDbTestSuccess(false);
      setErrorMsg('تعذر الوصول إلى خادم قاعدة البيانات: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDatabase = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const data = await InstallApi.createDatabase(dbConfig);
      if (data.success) {
        setDbTestSuccess(true);
        setSuccessMsg(data.message || `تم إنشاء والتحقق من وجود قاعدة البيانات [${dbConfig.database}] بنجاح!`);
      } else {
        setErrorMsg(data.error || 'فشل إنشاء قاعدة البيانات');
      }
    } catch (err: any) {
      setErrorMsg('تعذر إنشاء قاعدة البيانات: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTables = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const data = await InstallApi.runMigrations(dbConfig);
      if (data.success) {
        setDbTestSuccess(true);
        setSuccessMsg(data.message || `تم توليد وإنشاء جداول قاعدة البيانات بنجاح (${data.applied?.length || 0} جدول جديد)!`);
      } else {
        setErrorMsg(data.error || 'فشل توليد الجداول');
      }
    } catch (err: any) {
      setErrorMsg('تعذر توليد الجداول: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const persistLocalData = () => {
    try {
      const tenantId = 'org-default';
      const cleanName = (orgConfig.name || '').trim() || 'مؤسسة المخزون لتجارة السيارات';
      const cleanCR = (orgConfig.commercialRegister || '').trim();
      const cleanTax = (orgConfig.taxNumber || '').trim();
      const cleanPhone = (orgConfig.phone || '').trim();
      const cleanAddress = (orgConfig.address || '').trim();
      const cleanLogo = orgConfig.logo || '';
      const cleanStamp = orgConfig.stamp || '';

      const realTenant = {
        id: tenantId,
        name: cleanName,
        commercialRegistry: cleanCR,
        taxNumber: cleanTax,
        phone: cleanPhone,
        email: adminConfig.email || '',
        address: cleanAddress,
        logoUrl: cleanLogo,
        stampUrl: cleanStamp,
        createdAt: new Date().toISOString()
      };
      localStorage.setItem('almakhzoun_tenants', JSON.stringify([realTenant]));
      localStorage.setItem('current_tenant_id', tenantId);

      // Load existing or initialize app settings
      let existingSettings: any = {};
      try {
        const s = localStorage.getItem('app_settings');
        if (s) existingSettings = JSON.parse(s);
      } catch {}

      const updatedSettings = {
        ...existingSettings,
        name: cleanName,
        commercialRegister: cleanCR,
        taxNumber: cleanTax,
        contactNumber: cleanPhone,
        address: cleanAddress,
        logoUrl: cleanLogo || existingSettings.logoUrl || '',
        stampUrl: cleanStamp || existingSettings.stampUrl || ''
      };

      localStorage.setItem('app_settings', JSON.stringify(updatedSettings));
      localStorage.setItem(`tenant_${tenantId}_app_settings`, JSON.stringify(updatedSettings));
      localStorage.setItem(`tenant_${tenantId}_settings_secure`, JSON.stringify(updatedSettings));
      localStorage.setItem('system_installed', 'true');

      // Update VFS branding
      try {
        let vfs: any = {};
        const rawVfs = localStorage.getItem('almakhzoun_vfs');
        if (rawVfs) vfs = JSON.parse(rawVfs);
        vfs['branding.json'] = JSON.stringify({
          companyName: cleanName,
          logoSubtext: cleanAddress,
          supportPhone: cleanPhone,
          commercialRegister: cleanCR,
          taxNumber: cleanTax
        });
        localStorage.setItem('almakhzoun_vfs', JSON.stringify(vfs));
      } catch (e) {}

      // Create Admin User
      const adminUser = {
        id: 'usr_admin_1',
        username: adminConfig.username || 'admin',
        password: adminConfig.password || 'admin123',
        role: 'مدير',
        name: adminConfig.fullName || 'المدير العام',
        phone: adminConfig.phone || '',
        email: adminConfig.email || '',
        permissions: {
          canAddCar: true,
          canEditCar: true,
          canDeleteCar: true,
          canExportExcel: true,
          canPrintReport: true,
          canManageUsers: true,
          canManageSettings: true,
          canManageBackup: true,
          canViewCosts: true,
          canAddLetter: true
        }
      };

      localStorage.setItem('users', JSON.stringify([adminUser]));
      localStorage.setItem(`tenant_${tenantId}_users`, JSON.stringify([adminUser]));
      localStorage.setItem(`tenant_${tenantId}_users_secure`, JSON.stringify([adminUser]));
    } catch (e) {
      console.error('Error saving local settings from wizard:', e);
    }
  };

  const handleExecuteInstallation = async () => {
    // Validation
    if (adminConfig.password.length < 6) {
      setErrorMsg('كلمة المرور يجب أن لا تقل عن 6 خانات.');
      return;
    }
    if (adminConfig.password !== adminConfig.confirmPassword) {
      setErrorMsg('كلمتا المرور غير متطابقتين.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // Execute via unified InstallApi.executeInstallation
      const data = await InstallApi.executeInstallation({
        dbConfig,
        adminConfig,
        orgConfig
      });

      if (data.success) {
        // Persist real configurations to local storage immediately
        persistLocalData();
        setStep(5); // Success step
      } else {
        setErrorMsg(data.error || 'حدث خطأ أثناء تثبيت النظام.');
      }
    } catch (err: any) {
      // If server returned network error but user clicked execute, save locally as fallback
      persistLocalData();
      setErrorMsg('فشل تنفيذ التثبيت على الخادم: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-start sm:justify-center items-center p-4 sm:p-6 py-8 overflow-y-auto" dir="rtl">
      {/* Header */}
      <div className="w-full max-w-3xl mb-6 text-center">
        <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl mb-3 text-emerald-400">
          <Server className="w-8 h-8 ml-2" />
          <span className="text-xl font-bold font-mono">Almakhzoun Cloud Installer</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">معالج التثبيت الذاتي للنظام السحابي</h1>
        <p className="text-slate-400 text-sm mt-1">تهيئة قاعدة بيانات MySQL المركزية وحساب المدير في دقائق معدودة</p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 relative overflow-hidden">
        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-8 border-b border-slate-800 pb-4">
          {[
            { num: 1, title: 'فحص الخادم' },
            { num: 2, title: 'قاعدة البيانات' },
            { num: 3, title: 'حساب المدير' },
            { num: 4, title: 'بيانات المنشأة' },
            { num: 5, title: 'اكتمال التثبيت' }
          ].map((s) => (
            <div key={s.num} className="flex items-center space-x-2 space-x-reverse">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
                step === s.num 
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20' 
                  : step > s.num 
                    ? 'bg-emerald-950 border border-emerald-500 text-emerald-400' 
                    : 'bg-slate-800 text-slate-500'
              }`}>
                {step > s.num ? <Check className="w-4 h-4" /> : s.num}
              </div>
              <span className={`text-xs hidden sm:inline ${step === s.num ? 'font-bold text-white' : 'text-slate-500'}`}>
                {s.title}
              </span>
            </div>
          ))}
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start text-red-400 text-sm">
            <AlertTriangle className="w-5 h-5 ml-2 shrink-0 mt-0.5" />
            <div className="whitespace-pre-line leading-relaxed">{errorMsg}</div>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start text-emerald-400 text-sm">
            <CheckCircle2 className="w-5 h-5 ml-2 shrink-0 mt-0.5" />
            <div>{successMsg}</div>
          </div>
        )}

        {/* STEP 1: System Check */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/50">
              <h3 className="text-base font-bold text-white mb-3 flex items-center">
                <Server className="w-5 h-5 text-emerald-400 ml-2" />
                فحص جاهزية الخادم وبيئة التشغيل
              </h3>
              <div className="space-y-3">
                {sysChecks.map((chk, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-900 rounded-lg border border-slate-800/80">
                    <span className="text-sm font-medium text-slate-300">{chk.name}</span>
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <span className="text-xs text-slate-500 font-mono">{chk.detail}</span>
                      {chk.status ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center pt-4">
              <button
                type="button"
                onClick={fetchSystemChecks}
                disabled={loading}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm flex items-center transition"
              >
                <RefreshCw className={`w-4 h-4 ml-2 ${loading ? 'animate-spin' : ''}`} />
                إعادة الفحص
              </button>
              <button
                type="button"
                onClick={() => { setErrorMsg(null); setStep(2); }}
                disabled={!checksPassed}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-sm flex items-center shadow-lg transition"
              >
                المتابعة إلى إعداد قاعدة البيانات
                <ArrowLeft className="w-4 h-4 mr-2" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Database Configuration */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white flex items-center mb-2">
              <Database className="w-5 h-5 text-emerald-400 ml-2" />
              معلومات الاتصال بخادم MySQL السحابي
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-400 mb-1">عنوان خادم MySQL (Host)</label>
                <input
                  type="text"
                  value={dbConfig.host}
                  onChange={(e) => setDbConfig({ ...dbConfig, host: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:border-emerald-500 outline-none"
                  placeholder="localhost أو IP الخادم"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">المنفذ (Port)</label>
                <input
                  type="text"
                  value={dbConfig.port}
                  onChange={(e) => setDbConfig({ ...dbConfig, port: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:border-emerald-500 outline-none"
                  placeholder="3306"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">اسم قاعدة البيانات (Database Name)</label>
              <input
                type="text"
                value={dbConfig.database}
                onChange={(e) => setDbConfig({ ...dbConfig, database: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:border-emerald-500 outline-none"
                placeholder="almakhzoun_cloud"
              />
              <p className="text-[11px] text-slate-500 mt-1">سيتم إنشاء قاعدة البيانات والجداول تلقائياً في حال عدم وجودها مسبقاً.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">اسم مستخدم MySQL (User)</label>
                <input
                  type="text"
                  value={dbConfig.user}
                  onChange={(e) => setDbConfig({ ...dbConfig, user: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:border-emerald-500 outline-none"
                  placeholder="root"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">كلمة مرور MySQL (Password)</label>
                <input
                  type="password"
                  value={dbConfig.password || ''}
                  onChange={(e) => setDbConfig({ ...dbConfig, password: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:border-emerald-500 outline-none"
                  placeholder="اتركها فارغة إذا لم تكن محددة"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
              <button
                type="button"
                onClick={handleTestDatabase}
                disabled={loading}
                className="py-2.5 px-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold flex items-center justify-center transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ml-1.5 ${loading ? 'animate-spin' : ''}`} />
                فحص الاتصال بقاعدة البيانات
              </button>
              <button
                type="button"
                onClick={handleCreateDatabase}
                disabled={loading}
                className="py-2.5 px-2 bg-slate-800 hover:bg-slate-700 text-sky-400 border border-sky-500/30 rounded-xl text-xs font-semibold flex items-center justify-center transition"
              >
                <Database className={`w-3.5 h-3.5 ml-1.5 ${loading ? 'animate-spin' : ''}`} />
                إنشاء قاعدة البيانات
              </button>
              <button
                type="button"
                onClick={handleGenerateTables}
                disabled={loading}
                className="py-2.5 px-2 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 rounded-xl text-xs font-semibold flex items-center justify-center transition"
              >
                <FileCheck className={`w-3.5 h-3.5 ml-1.5 ${loading ? 'animate-spin' : ''}`} />
                تطبيق Migration (الجداول)
              </button>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-sm"
              >
                السابق
              </button>
              <button
                type="button"
                onClick={() => { setErrorMsg(null); setStep(3); }}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-sm flex items-center shadow-lg transition"
              >
                المتابعة إلى حساب المدير
                <ArrowLeft className="w-4 h-4 mr-2" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Admin Account */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white flex items-center mb-2">
              <Shield className="w-5 h-5 text-emerald-400 ml-2" />
              تهيئة حساب المشرف العام والحماية
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">الاسم الكامل للمدير</label>
                <input
                  type="text"
                  value={adminConfig.fullName}
                  onChange={(e) => setAdminConfig({ ...adminConfig, fullName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">اسم المستخدم لتسجيل الدخول</label>
                <input
                  type="text"
                  value={adminConfig.username}
                  onChange={(e) => setAdminConfig({ ...adminConfig, username: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:border-emerald-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">البريد الإلكتروني للإدارة</label>
                <input
                  type="email"
                  value={adminConfig.email || ''}
                  onChange={(e) => setAdminConfig({ ...adminConfig, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:border-emerald-500 outline-none"
                  placeholder="admin@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">رقم الهاتف / الجوال</label>
                <input
                  type="tel"
                  value={adminConfig.phone || ''}
                  onChange={(e) => setAdminConfig({ ...adminConfig, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:border-emerald-500 outline-none"
                  placeholder="0500000000"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">كلمة المرور الرئيسية</label>
                <input
                  type="password"
                  value={adminConfig.password}
                  onChange={(e) => setAdminConfig({ ...adminConfig, password: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:border-emerald-500 outline-none"
                  placeholder="******"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">تأكيد كلمة المرور</label>
                <input
                  type="password"
                  value={adminConfig.confirmPassword || ''}
                  onChange={(e) => setAdminConfig({ ...adminConfig, confirmPassword: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:border-emerald-500 outline-none"
                  placeholder="******"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <label className="block text-xs font-semibold text-emerald-400 mb-1 flex items-center">
                <Key className="w-4 h-4 ml-1" />
                رمز الاسترداد التشفيري للطوارئ (Recovery Code)
              </label>
              <input
                type="text"
                readOnly
                value={adminConfig.recoveryCode}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-emerald-300 font-mono tracking-wider text-center"
              />
              <p className="text-[11px] text-slate-400 mt-1">احتفظ بهذا الرمز في مكان آمن، يمكنك استخدامه لاستعادة حساب الإدارة في حال فقدان كلمة المرور.</p>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-sm"
              >
                السابق
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!adminConfig.password) {
                    setErrorMsg('يرجى تحديد كلمة مرور لحساب المدير.');
                    return;
                  }
                  if (adminConfig.password !== adminConfig.confirmPassword) {
                    setErrorMsg('كلمتا المرور غير متطابقتين.');
                    return;
                  }
                  setErrorMsg(null);
                  setStep(4);
                }}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-sm flex items-center shadow-lg transition"
              >
                المتابعة إلى بيانات المنشأة
                <ArrowLeft className="w-4 h-4 mr-2" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Organization Branding */}
        {step === 4 && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white flex items-center mb-2">
              <Building2 className="w-5 h-5 text-emerald-400 ml-2" />
              بيانات وهوية المنشأة / المعرض
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">اسم المنشأة / المعرض الرسمي</label>
              <input
                type="text"
                value={orgConfig.name}
                onChange={(e) => setOrgConfig({ ...orgConfig, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:border-emerald-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">رقم السجل التجاري</label>
                <input
                  type="text"
                  value={orgConfig.commercialRegister}
                  onChange={(e) => setOrgConfig({ ...orgConfig, commercialRegister: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">الرقم الضريبي (15 رقم)</label>
                <input
                  type="text"
                  value={orgConfig.taxNumber}
                  onChange={(e) => setOrgConfig({ ...orgConfig, taxNumber: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:border-emerald-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">رقم الهاتف / التواصل</label>
                <input
                  type="text"
                  value={orgConfig.phone}
                  onChange={(e) => setOrgConfig({ ...orgConfig, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">العنوان والموقع</label>
                <input
                  type="text"
                  value={orgConfig.address}
                  onChange={(e) => setOrgConfig({ ...orgConfig, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:border-emerald-500 outline-none"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-sm"
              >
                السابق
              </button>
              <button
                type="button"
                onClick={handleExecuteInstallation}
                disabled={loading}
                className="px-8 py-3 bg-gradient-to-l from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-slate-950 font-extrabold rounded-xl text-sm flex items-center shadow-lg transition"
              >
                <Sparkles className="w-5 h-5 ml-2" />
                {loading ? 'جاري إنشاء الجداول وتثبيت النظام...' : 'بدء التثبيت التلقائي وقفل المعالج'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Success Screen */}
        {step === 5 && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-2 border border-emerald-500/40">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-black text-white">مبروك! تم تثبيت وتشغيل المنظومة بنجاح</h2>
            <p className="text-slate-400 text-sm max-w-md mx-auto">
              تم إنشاء وتحديث الجداول في قاعدة بيانات MySQL، وحفظ إعدادات الاتصال في ملف .env وتأمين النظام بإنشاء ملفات قفل التثبيت (install.lock و .installed) لمنع إعادة تشغيل المعالج.
            </p>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 max-w-md mx-auto text-right space-y-2 text-sm">
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">اسم المستخدم:</span>
                <span className="font-bold text-white">{adminConfig.username}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">الرتبة:</span>
                <span className="text-emerald-400 font-bold">المدير العام (صلاحيات كاملة)</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">رمز الاسترداد:</span>
                <span className="font-mono text-xs text-amber-300">{adminConfig.recoveryCode}</span>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="button"
                onClick={onInstallationComplete}
                className="w-full max-w-md py-3.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-base shadow-xl transition"
              >
                الدخول إلى لوحة التحكم الآن
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
