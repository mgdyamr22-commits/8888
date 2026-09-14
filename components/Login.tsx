
import React, { useState } from 'react';
import { 
  Lock, 
  User as UserIcon, 
  ArrowRight, 
  Info, 
  Car, 
  AlertCircle,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  X,
  CheckCircle2,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User, OrganizationSettings, UserRole, Delegate } from '../types';
import { ROLE_PERMISSIONS } from '../constants';
import { verifyPassword } from '../services/SecurityService';
import { getLogoDataUri } from './OfficialAssets';
import { useLanguage } from './LanguageContext.tsx';
import { ForgotPassword } from './ForgotPassword';
import { nativeLogin, nativeRegister, getNativeUsers } from '../services/nativeAuthService';
import { CarApiService } from '../src/services/carApiService';
import { DelegateApiService } from '../src/services/delegateApiService';

interface LoginProps {
  settings: OrganizationSettings;
  users: User[];
  onUpdateUsers?: (updated: User[]) => void;
  onLogin: (user: User, rememberMe: boolean) => void;
  onDelegateLogin?: (delegate: Delegate, rememberMe: boolean) => void;
}

const loginTranslations = {
  ar: {
    title: 'تسجيل الدخول الآمن',
    subtitle: 'يرجى إدخال بيانات الاعتماد المعتمدة للوصول للوحة التحكم العليا',
    username: 'اسم المستخدم',
    usernamePlaceholder: 'اسم المستخدم أو الرقم الوظيفي',
    password: 'كلمة المرور',
    passwordPlaceholder: '••••••••',
    forgotPassword: 'نسيت كلمة السر؟',
    rememberMe: 'تذكر جلسة الدخول النشطة',
    submit: 'دخول النظام الآمن',
    systemTitle: 'النظام السحابي المشفر',
    systemDescription: 'المنصة المتكاملة والآمنة لإدارة الأصول، المبيعات والتقارير المالية بأحدث التقنيات.',
    securePort: 'اتصال مشفر SSL',
    aes256: 'تشفير AES-256',
    warning: 'هذا النظام مخصص للمصادقة المعتمدة والموظفين فقط. أي نشاط غير مصرح به يخضع للرصد والتسجيل الآلي.',
    sysDefault: 'النظام التلقائي',
    quickFill: 'مساعد الدخول السريع (للتجربة والدعم)',
    clickToFill: 'اضغط للتعبئة التلقائية السريعة',
  },
  en: {
    title: 'Secure System Access',
    subtitle: 'Please provide certified credentials to access the higher admin console',
    username: 'Username',
    usernamePlaceholder: 'Username or Employee ID',
    password: 'Password',
    passwordPlaceholder: '••••••••',
    forgotPassword: 'Forgot password?',
    rememberMe: 'Remember active session context',
    submit: 'Enter Secure Terminal',
    systemTitle: 'Encrypted Cloud Hub',
    systemDescription: 'An enterprise-grade platform to manage vehicle assets, sales inventory, and financial reports securely.',
    securePort: 'SSL Encrypted Port',
    aes256: 'AES-256 Protocol',
    warning: 'This terminal is for authorized personnel only. All access, sessions, and actions are actively monitored and locked.',
    sysDefault: 'Intelligent Agent',
    quickFill: 'Quick Login Assistant (For Demo & Support)',
    clickToFill: 'Click to auto-fill credentials',
  }
};

const Login: React.FC<LoginProps> = ({ settings, users, onUpdateUsers, onLogin, onDelegateLogin }) => {
  const { lang, setLang, dir } = useLanguage();
  const [loginType, setLoginType] = useState<'staff' | 'delegate'>('staff');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [showQuickHelper, setShowQuickHelper] = useState(false);

  // Registration States
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regQ1, setRegQ1] = useState('ما هو اسم حيوانك الأليف الأول؟');
  const [regA1, setRegA1] = useState('');
  const [regQ2, setRegQ2] = useState('في أي مدينة وُلدت؟');
  const [regA2, setRegA2] = useState('');
  const [regQ3, setRegQ3] = useState('ما هو اسم أول مدرّسة لك؟');
  const [regA3, setRegA3] = useState('');
  const [regSuccessData, setRegSuccessData] = useState<{ recoveryCode: string; recoveryFileContent: string } | null>(null);

  const curTrans = lang === 'ar' ? loginTranslations.ar : loginTranslations.en;

  const downloadRecoveryKey = (fileName: string, content: string) => {
    const element = document.createElement("a");
    const file = new Blob([content], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = fileName;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!regUsername.trim() || !regPassword.trim() || !regEmail.trim() || !regPhone.trim() || !regA1.trim() || !regA2.trim() || !regA3.trim()) {
      setError(lang === 'ar' ? 'الرجاء ملء كافة خانات التسجيل وجوال الاستعادة والأمان.' : 'All registration and recovery mobile fields are required.');
      setIsLoading(false);
      return;
    }

    const devId = localStorage.getItem('recovery_device_id') || 'dev-default';

    // SECURITY: nativeRegister creates a purely local, client-side-only account with
    // no connection to the real server/database. It must never activate on the hosted
    // web app — only inside the real Electron desktop build, which has no backend server.
    const isRealElectronDesktopApp =
      typeof window !== 'undefined' &&
      !!(window as any).electronAPI &&
      typeof (window as any).electronAPI.saveDatabaseState === 'function';

    try {
      let data: any = null;
      let serverErrorMsg: string | null = null;
      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: regUsername.trim(),
            password: regPassword.trim(),
            email: regEmail.trim(),
            phone: regPhone.trim(),
            deviceId: devId,
            questions: [
              { question: regQ1, answer: regA1 },
              { question: regQ2, answer: regA2 },
              { question: regQ3, answer: regA3 }
            ]
          })
        });
        const resData = await response.json().catch(() => null);
        if (response.ok && resData) {
          data = resData;
        } else {
          serverErrorMsg = resData?.message || resData?.error ||
            (lang === 'ar' ? 'فشل التسجيل عبر الخادم.' : 'Server registration failed.');
        }
      } catch (_) {
        if (isRealElectronDesktopApp) {
          // No backend server exists in the desktop build — this is the legitimate case.
          data = await nativeRegister({
            username: regUsername.trim(),
            password: regPassword.trim(),
            email: regEmail.trim(),
            phone: regPhone.trim(),
            deviceId: devId,
            questions: [
              { question: regQ1, answer: regA1 },
              { question: regQ2, answer: regA2 },
              { question: regQ3, answer: regA3 }
            ]
          });
        } else {
          serverErrorMsg = lang === 'ar'
            ? 'تعذر الاتصال بخادم النظام. لن يتم إنشاء أي حساب بدون تحقق حقيقي من الخادم.'
            : 'Could not reach the server. No account is created without real server verification.';
        }
      }

      if (!data) {
        setError(serverErrorMsg || (lang === 'ar' ? 'حدث خطأ للأسف في تسجيل الحساب.' : 'Failed registration.'));
        setIsLoading(false);
        return;
      }

      if (data.success) {
        setRegSuccessData({
          recoveryCode: data.recoveryCode,
          recoveryFileContent: data.recoveryFileContent
        });
        
        // Auto trigger download
        downloadRecoveryKey(`${regUsername.trim()}_recovery.key`, data.recoveryFileContent);

        // Update list of users in React state
        if (onUpdateUsers) {
          const freshUsers = getNativeUsers();
          onUpdateUsers(freshUsers);
        }
      } else {
        setError(data.message || (lang === 'ar' ? 'حدث خطأ للأسف في تسجيل الحساب.' : 'Failed registration.'));
      }
    } catch (err) {
      setError(lang === 'ar' ? 'حدث عطل في نظام الخدمة أثناء الإرسال.' : 'Registration error.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (loginType === 'delegate') {
      try {
        const res = await DelegateApiService.login(username.trim(), password.trim(), rememberMe);
        if (res.success && res.delegate) {
          if (onDelegateLogin) {
            onDelegateLogin(res.delegate, rememberMe);
          }
          return;
        } else {
          setError(res.message || (res as any).error || (lang === 'ar' ? 'اسم المستخدم أو كلمة المرور الخاصة بالمندوب غير صحيحة.' : 'Invalid delegate credentials.'));
        }
      } catch (err: any) {
        setError(lang === 'ar' ? 'تعذر الاتصال ببوابة المناديب، يرجى التحقق من الخادم.' : 'Could not connect to delegate portal.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    const devId = localStorage.getItem('recovery_device_id') || 'dev-default';

    const loginCandidates = [
      CarApiService.getApiUrl('api/auth/login.php'),
      CarApiService.getApiUrl('api/auth/login'),
      CarApiService.getApiUrl('api/index.php?route=auth/login'),
      '/api/auth/login.php',
      '/api/auth/login'
    ].filter((v, i, a) => a.indexOf(v) === i);

    let loggedInUser: User | null = null;
    let authErrorMsg = '';

    // 1. Attempt Server-side Database Authentication
    for (const url of loginCandidates) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            username: username.trim(),
            password: password.trim(),
            deviceId: devId
          })
        });

        const contentType = response.headers.get('content-type') || '';
        const text = await response.text();

        if (!contentType.includes('application/json') && (text.includes('<!DOCTYPE') || text.includes('<html'))) {
          continue; // SPA fallback, try next candidate
        }

        try {
          const resData = JSON.parse(text);
          if (response.ok && resData.success) {
            const userObj = resData.data?.user || resData.user;
            const token = resData.data?.token || resData.token;

            if (token) {
              localStorage.setItem('auth_token', token);
              sessionStorage.setItem('auth_token', token);
            }

            if (userObj) {
              loggedInUser = {
                id: userObj.id || 'usr_' + Date.now(),
                username: userObj.username || username.trim(),
                name: userObj.fullName || userObj.full_name || userObj.name || username.trim(),
                role: userObj.role || UserRole.ADMIN,
                email: userObj.email || '',
                phone: userObj.phone || '',
                permissions: userObj.permissions || (ROLE_PERMISSIONS as any)[userObj.role || UserRole.ADMIN] || [],
                avatar: userObj.avatar || '',
                branchId: userObj.branchId || userObj.branch_id || ''
              } as User;
              break;
            }
          } else {
            authErrorMsg = resData.error || resData.message || 'بيانات الدخول المدخلة غير صحيحة.';
            // If the server explicitly rejected the credentials, do not continue trying endpoints
            if (response.status === 401 || response.status === 403 || response.status === 429) {
              break;
            }
          }
        } catch {
          // Parsing error on this endpoint, try next
        }
      } catch (err: any) {
        // Network failure on this endpoint, try next
      }
    }

    // 2. Native Fallback — SECURITY: this bypasses the real server/database entirely.
    // It must NEVER activate for the hosted web deployment (it would let anyone in with
    // the built-in demo credentials even though the server rejected/failed the login).
    // It is only legitimate inside the actual Electron desktop build, which has no
    // backend server at all and is expected to store its own local user list.
    const isRealElectronDesktopApp =
      typeof window !== 'undefined' &&
      !!(window as any).electronAPI &&
      typeof (window as any).electronAPI.saveDatabaseState === 'function';

    if (!loggedInUser && !authErrorMsg && isRealElectronDesktopApp) {
      try {
        const nativeRes = await nativeLogin(username.trim(), password.trim());
        if (nativeRes.success && nativeRes.user) {
          loggedInUser = nativeRes.user;
        } else {
          authErrorMsg = nativeRes.message || (lang === 'ar' ? 'بيانات الدخول المدخلة غير صحيحة.' : 'Incorrect password or username.');
        }
      } catch (err) {
        authErrorMsg = lang === 'ar' ? 'حدث خطأ في معالجة تسجيل الدخول.' : 'Login authentication error.';
      }
    }

    // If we reach here on a web/hosted install with no server response at all,
    // report the real problem instead of silently letting the user in.
    if (!loggedInUser && !authErrorMsg && !isRealElectronDesktopApp) {
      authErrorMsg = lang === 'ar'
        ? 'تعذر الاتصال بخادم النظام. تحقق من أن قاعدة البيانات مثبتة بشكل صحيح ومن اتصال الشبكة، ثم أعد المحاولة. لن يتم السماح بالدخول بدون تحقق حقيقي من الخادم.'
        : 'Could not reach the server. Check that the database is installed correctly and your network connection, then try again. Login is never granted without real server verification.';
    }

    setIsLoading(false);

    if (loggedInUser) {
      onLogin(loggedInUser, rememberMe);
    } else {
      setError(authErrorMsg || (lang === 'ar' ? 'بيانات الدخول المدخلة غير صحيحة.' : 'Incorrect password or username.'));
    }
  };

  const getPlainPassword = (user: User) => {
    if (user.username === 'admin' && user.password === 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3') {
      return 'admin';
    }
    if (user.username === 'user' && user.password === 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3') {
      return 'admin';
    }
    return (user as any).plainPassword || 'admin';
  };

  const handleQuickFill = (u: User) => {
    setUsername(u.username);
    setPassword(getPlainPassword(u));
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 md:p-8 font-sans transition-colors duration-500 overflow-hidden relative" dir={dir}>
      {/* Background Orbs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 dark:bg-blue-900/20" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-600/10 blur-[120px] rounded-full translate-y-1/2 -translate-x-1/2 dark:bg-indigo-900/20" />
      
      <div className="w-full max-w-[1240px] bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl overflow-hidden flex flex-col md:flex-row border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-700 relative z-10">
        
        {/* Left Side: Branding / Info */}
        <div className="w-full md:w-1/2 bg-slate-950 p-12 md:p-20 flex flex-col justify-between relative overflow-hidden text-right">
          {/* Animated pattern background */}
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
          </div>

          <div className="relative z-10 space-y-8">
            <div className="bg-blue-600 w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/50 p-2">
              <img src={settings.logoUrl || getLogoDataUri(settings.name)} alt="Logo" className="w-16 h-16 object-contain" />
            </div>

            <div className="space-y-4 text-start">
              <h1 className="text-5xl md:text-6xl font-black text-white tracking-tighter leading-tight">
                {lang === 'ar' ? 'نظام' : 'Console'} <br />
                <span className="text-blue-500">{settings.name}</span>
              </h1>
              <p className="text-slate-400 text-lg font-bold max-w-sm leading-relaxed">
                {curTrans.systemDescription}
              </p>
            </div>
          </div>

          <div className="relative z-10 mt-12 space-y-8 text-start animate-fade-in">
             <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full whitespace-nowrap">
                   <ShieldCheck size={16} className="text-emerald-500" />
                   <span className="text-xs font-black text-slate-300">{curTrans.aes256}</span>
                </div>
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full whitespace-nowrap">
                   <Lock size={16} className="text-blue-500" />
                   <span className="text-xs font-black text-slate-300">{curTrans.securePort}</span>
                </div>
             </div>

             <div className="flex items-center gap-4 text-slate-500 group cursor-help">
                <Info size={18} className="shrink-0" />
                <p className="text-xs font-bold leading-tight group-hover:text-slate-300 transition-colors">
                  {curTrans.warning}
                </p>
             </div>
          </div>
          
          <div className="absolute top-1/2 right-0 w-[600px] h-[600px] bg-blue-600/5 blur-[100px] rounded-full translate-x-1/2" />
        </div>

        {/* Right Side: Tabular Signin / Register Cards */}
        <div className="w-full md:w-1/2 p-12 md:p-14 bg-white dark:bg-slate-900 flex flex-col justify-center">
          <div className="max-w-md mx-auto w-full space-y-8">
            
            {regSuccessData ? (
              /* Success Account Registered Details View */
              <div className="space-y-6 text-start animate-in zoom-in-95 duration-500">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl flex items-center gap-4">
                  <ShieldCheck size={32} className="text-emerald-500 shrink-0" />
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                      {lang === 'ar' ? 'تم تسجيل الحساب بنجاح!' : 'Account Secured Successfully!'}
                    </h3>
                    <p className="text-xs text-slate-500 font-bold">
                      {lang === 'ar' ? 'تم توليد رموز الحماية الاحتياطية وتنزيل الملف.' : 'Backup codes have been safely downloaded.'}
                    </p>
                  </div>
                </div>

                <div className="p-5 bg-slate-50 dark:bg-slate-950/60 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-4">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    {lang === 'ar' ? '🔑 رمز الاسترداد الفريد الخاص بك:' : '🔑 Your Unique Recovery Code:'}
                  </p>
                  <p className="text-xl md:text-2xl font-mono font-black text-blue-600 text-center tracking-widest bg-white dark:bg-slate-900 py-4 px-2 border-2 border-dashed border-blue-200 dark:border-blue-800 rounded-2xl select-all">
                    {regSuccessData.recoveryCode}
                  </p>
                  <p className="text-[10px] text-rose-500 font-bold leading-normal">
                    {lang === 'ar' 
                      ? '⚠️ هام جداً: احفظ هذا الرمز في مكان آمن. لن تتمكن من رؤيته مجدداً في واجهة النظام.' 
                      : '⚠️ Critical: Protect this code. It will never be displayed/revealed again.'}
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => downloadRecoveryKey(`${regUsername.trim()}_recovery.key`, regSuccessData.recoveryFileContent)}
                    className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-750 font-black text-xs rounded-2xl transition-all"
                  >
                    {lang === 'ar' ? 'تنزيل ملف المفتاح (.key) مجدداً' : 'Re-download key backup file'}
                  </button>

                  <button 
                    onClick={() => {
                      setRegSuccessData(null);
                      setIsRegisterMode(false);
                      setUsername(regUsername);
                      setRegUsername('');
                      setRegPassword('');
                      setRegEmail('');
                      setRegA1('');
                      setRegA2('');
                      setRegA3('');
                    }}
                    className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-3xl shadow-lg hover:scale-[1.01] transition-all text-sm uppercase tracking-wide"
                  >
                    {lang === 'ar' ? 'المتابعة لتسجيل الدخول الان ➔' : 'Proceed to Account Login ➔'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-2 text-start">
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                      {isRegisterMode 
                        ? (lang === 'ar' ? 'إنشاء حساب موظف' : 'Employee Registration')
                        : loginType === 'delegate'
                          ? (lang === 'ar' ? 'بوابة مناديب المبيعات' : 'Sales Delegate Portal')
                          : curTrans.title
                      }
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 font-bold leading-normal text-xs">
                      {isRegisterMode 
                        ? (lang === 'ar' ? 'سجل تفاصيل الحساب والأسئلة لتمكين الاسترداد الفوري' : 'Fill fields to construct solid security constraints')
                        : loginType === 'delegate'
                          ? (lang === 'ar' ? 'صالة العرض وحجز السيارات المتاحة واستعراض وثائق الحجوزات' : 'Showroom stock, instant car reservations, and document access')
                          : curTrans.subtitle
                      }
                    </p>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} 
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 text-blue-600 dark:text-blue-400 border border-slate-100 dark:border-slate-800 transition-all shadow-sm shrink-0 self-start sm:self-center animate-pulse"
                  >
                    <Globe size={14} />
                    <span>{lang === 'ar' ? 'English' : 'العربية'}</span>
                  </button>
                </div>

                {error && (
                  <div className="p-5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-black rounded-2xl border border-rose-100 dark:border-rose-500/20 flex items-center gap-3 animate-in slide-in-from-top-4">
                    <AlertCircle size={18} className="shrink-0" />
                    <p className="leading-tight text-start">{error}</p>
                  </div>
                )}

                {/* Authentication Sub-Tabs */}
                <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200/40 dark:border-slate-900">
                  <button 
                    onClick={() => { setIsRegisterMode(false); setLoginType('staff'); setError(''); }}
                    className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${!isRegisterMode && loginType === 'staff' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                  >
                    {lang === 'ar' ? 'دخول الإدارة' : 'Staff Login'}
                  </button>
                  <button 
                    onClick={() => { setIsRegisterMode(false); setLoginType('delegate'); setError(''); }}
                    className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${!isRegisterMode && loginType === 'delegate' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                  >
                    {lang === 'ar' ? '🚗 بوابة المناديب' : '🚗 Delegate Portal'}
                  </button>
                  <button 
                    onClick={() => { setIsRegisterMode(true); setError(''); }}
                    className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${isRegisterMode ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                  >
                    {lang === 'ar' ? 'حساب جديد' : 'New Account'}
                  </button>
                </div>

                {!isRegisterMode && loginType === 'delegate' && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 rounded-2xl text-xs font-bold text-blue-800 dark:text-blue-300 flex items-center gap-3">
                    <Car size={20} className="shrink-0 text-blue-600 dark:text-blue-400" />
                    <span>{lang === 'ar' ? 'مرحباً بك في بوابة المناديب المستقلة. يتم الحصول على اسم المستخدم وكلمة المرور من إدارة المعرض.' : 'Welcome to the independent Sales Delegate Portal. Credentials are provided by administration.'}</span>
                  </div>
                )}

                {!isRegisterMode ? (
                  /* Form: LogIn */
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2 text-start">
                      <label className={`text-[11px] font-black text-slate-500 uppercase tracking-widest ${lang === 'ar' ? 'mr-4' : 'ml-4'}`}>{curTrans.username}</label>
                      <div className="relative group">
                        <UserIcon className={`absolute ${lang === 'ar' ? 'right-6' : 'left-6'} top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors`} size={20} />
                        <input 
                          type="text" 
                          required 
                          placeholder={curTrans.usernamePlaceholder}
                          disabled={isLoading}
                          className={`w-full ${lang === 'ar' ? 'pr-16 pl-6' : 'pl-16 pr-6'} py-4.5 bg-slate-50 dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-800 rounded-[2rem] outline-none focus:ring-[10px] focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-500 dark:focus:border-blue-500 transition-all font-black text-sm dark:text-white disabled:opacity-50`}
                          value={username}
                          onChange={e => setUsername(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2 text-start">
                      <div className="flex justify-between items-center px-4">
                         {loginType === 'delegate' ? (
                           <span className="text-[11px] font-bold text-slate-400">
                             {lang === 'ar' ? 'كلمة المرور تُمنح من الإدارة' : 'Provided by Admin'}
                           </span>
                         ) : (
                           <button 
                             type="button" 
                             onClick={() => setShowForgotModal(true)}
                             className="text-[11px] font-black text-blue-600 hover:underline cursor-pointer"
                           >
                             {curTrans.forgotPassword}
                           </button>
                         )}
                         <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{curTrans.password}</label>
                      </div>
                      <div className="relative group">
                        <Lock className={`absolute ${lang === 'ar' ? 'right-6' : 'left-6'} top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors`} size={20} />
                        <input 
                          type={showPassword ? 'text' : 'password'} 
                          required 
                          placeholder={curTrans.passwordPlaceholder}
                          disabled={isLoading}
                          className={`w-full ${lang === 'ar' ? 'pr-16 pl-14 font-sans' : 'pl-16 pr-14 font-sans'} py-4.5 bg-slate-50 dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-800 rounded-[2rem] outline-none focus:ring-[10px] focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-500 dark:focus:border-blue-500 transition-all font-black text-sm dark:text-white disabled:opacity-50`}
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowPassword(!showPassword)}
                          className={`absolute ${lang === 'ar' ? 'left-6' : 'right-6'} top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors`}
                        >
                          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between px-4">
                       <div className="flex items-center gap-3">
                          <button 
                            type="button"
                            onClick={() => !isLoading && setRememberMe(!rememberMe)}
                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${rememberMe ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}
                          >
                            {rememberMe && <CheckCircle2 size={12} strokeWidth={3} />}
                          </button>
                          <span className="text-xs font-black text-slate-500 dark:text-slate-400">{curTrans.rememberMe}</span>
                       </div>
                    </div>

                    <button 
                      type="submit" 
                      disabled={isLoading}
                      className="w-full py-4 bg-blue-600 text-white font-black rounded-[2rem] shadow-xl shadow-blue-500/10 hover:bg-blue-700 hover:scale-[1.01] active:scale-[0.99] transition-all text-base flex items-center justify-center gap-3 group relative overflow-hidden cursor-pointer"
                    >
                      {isLoading ? (
                        <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>{loginType === 'delegate' ? (lang === 'ar' ? 'دخول صالة عرض المناديب' : 'Enter Delegate Showroom') : curTrans.submit}</span>
                          <ArrowRight size={18} className={`transition-transformCode ${lang === 'ar' ? 'group-hover:translate-x-[-4px] rotate-180' : 'group-hover:translate-x-[4px]'}`} />
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  /* Form: New User Registration with 3 Security Questions */
                  <form onSubmit={handleRegisterSubmit} className="space-y-5 text-start overflow-y-auto max-h-[60vh] pr-1.5 custom-scrollbar">
                    
                    {/* User profile fields */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">
                        {lang === 'ar' ? 'اسم المستخدم المعتمد' : 'Username'}
                      </label>
                      <input 
                        type="text"
                        required
                        disabled={isLoading}
                        placeholder={lang === 'ar' ? 'مثال: ahmed_dev' : 'e.g. ahmed_dev'}
                        className="w-full py-3.5 px-5 bg-slate-50 dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-800 rounded-2xl outline-none text-xs text-slate-800 dark:text-white font-black"
                        value={regUsername}
                        onChange={e => setRegUsername(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">
                        {lang === 'ar' ? 'البريد الإلكتروني الأساسي' : 'Primary Email'}
                      </label>
                      <input 
                        type="email"
                        required
                        disabled={isLoading}
                        placeholder="ahmed@company.com"
                        className="w-full py-3.5 px-5 bg-slate-50 dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-800 rounded-2xl outline-none text-xs text-slate-800 dark:text-white font-black"
                        value={regEmail}
                        onChange={e => setRegEmail(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">
                        {lang === 'ar' ? 'رقم الجوال لتلقي الرموز (الاستعادة)' : 'Recovery Mobile Phone'}
                      </label>
                      <input 
                        type="text"
                        required
                        disabled={isLoading}
                        placeholder="e.g. 05XXXXXXXX"
                        className="w-full py-3.5 px-5 bg-slate-50 dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-800 rounded-2xl outline-none text-xs text-slate-800 dark:text-white font-black"
                        value={regPhone}
                        onChange={e => setRegPhone(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">
                        {lang === 'ar' ? 'كلمة المرور القوية' : 'Strong Password'}
                      </label>
                      <input 
                        type="password"
                        required
                        disabled={isLoading}
                        placeholder="••••••••"
                        className="w-full py-3.5 px-5 bg-slate-50 dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-800 rounded-2xl outline-none text-xs text-slate-800 dark:text-white font-black"
                        value={regPassword}
                        onChange={e => setRegPassword(e.target.value)}
                      />
                    </div>

                    <div className="h-[1px] bg-slate-100 dark:bg-slate-800/80 my-2" />
                    
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-wider px-2">
                      {lang === 'ar' ? '🔐 إعداد أسئلة الأمان الاستباقية (اختر 3 أسئلة):' : '🔐 Establish 3 Custom Security Guard Queries:'}
                    </p>

                    {/* Question 1 */}
                    <div className="space-y-2 bg-slate-50/50 dark:bg-slate-950/20 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-850">
                      <select 
                        value={regQ1} 
                        onChange={e => setRegQ1(e.target.value)}
                        className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-black text-slate-700 dark:text-slate-300 outline-none"
                      >
                        <option value="ما هو اسم حيوانك الأليف الأول؟">{lang === 'ar' ? 'ما هو اسم حيوانك الأليف الأول؟' : 'What is the name of your first pet?'}</option>
                        <option value="في أي مدينة وُلدت؟">{lang === 'ar' ? 'في أي مدينة وُلدت؟' : 'In which city were you born?'}</option>
                        <option value="ما هو طراز سيارتك الأولى؟">{lang === 'ar' ? 'ما هو طراز سيارتك الأولى؟' : 'What was the make of your first car?'}</option>
                        <option value="ما هو اسم أول مدرّسة لك؟">{lang === 'ar' ? 'ما هو اسم أول مدرّسة لك؟' : 'What is the name of your first teacher?'}</option>
                      </select>
                      <input 
                        type="text" 
                        required
                        placeholder={lang === 'ar' ? 'اكتب إجابة السؤال الأول هنا...' : 'Provide answer ...'}
                        className="w-full py-2 px-3 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-xl text-xs outline-none text-slate-900 dark:text-white font-mono"
                        value={regA1}
                        onChange={e => setRegA1(e.target.value)}
                      />
                    </div>

                    {/* Question 2 */}
                    <div className="space-y-2 bg-slate-50/50 dark:bg-slate-950/20 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-850">
                      <select 
                        value={regQ2} 
                        onChange={e => setRegQ2(e.target.value)}
                        className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-black text-slate-700 dark:text-slate-300 outline-none"
                      >
                        <option value="في أي مدينة وُلدت؟">{lang === 'ar' ? 'في أي مدينة وُلدت؟' : 'In which city were you born?'}</option>
                        <option value="ما هو اسم حيوانك الأليف الأول؟">{lang === 'ar' ? 'ما هو اسم حيوانك الأليف الأول؟' : 'What is the name of your first pet?'}</option>
                        <option value="ما هو طراز سيارتك الأولى؟">{lang === 'ar' ? 'ما هو طراز سيارتك الأولى؟' : 'What was the make of your first car?'}</option>
                        <option value="ما هو اسم أول مدرّسة لك؟">{lang === 'ar' ? 'ما هو اسم أول مدرّسة لك؟' : 'What is the name of your first teacher?'}</option>
                      </select>
                      <input 
                        type="text" 
                        required
                        placeholder={lang === 'ar' ? 'اكتب إجابة السؤال الثاني هنا...' : 'Provide answer ...'}
                        className="w-full py-2 px-3 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-xl text-xs outline-none text-slate-900 dark:text-white font-mono"
                        value={regA2}
                        onChange={e => setRegA2(e.target.value)}
                      />
                    </div>

                    {/* Question 3 */}
                    <div className="space-y-2 bg-slate-50/50 dark:bg-slate-950/20 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-850">
                      <select 
                        value={regQ3} 
                        onChange={e => setRegQ3(e.target.value)}
                        className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-black text-slate-700 dark:text-slate-300 outline-none"
                      >
                        <option value="ما هو اسم أول مدرّسة لك؟">{lang === 'ar' ? 'ما هو اسم أول مدرّسة لك؟' : 'What is the name of your first teacher?'}</option>
                        <option value="في أي مدينة وُلدت؟">{lang === 'ar' ? 'في أي مدينة وُلدت؟' : 'In which city were you born?'}</option>
                        <option value="ما هو اسم حيوانك الأليف الأول؟">{lang === 'ar' ? 'ما هو اسم حيوانك الأليف الأول؟' : 'What is the name of your first pet?'}</option>
                        <option value="ما هو طراز سيارتك الأولى؟">{lang === 'ar' ? 'ما هو طراز سيارتك الأولى؟' : 'What was the make of your first car?'}</option>
                      </select>
                      <input 
                        type="text" 
                        required
                        placeholder={lang === 'ar' ? 'اكتب إجابة السؤال الثالث هنا...' : 'Provide answer ...'}
                        className="w-full py-2 px-3 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-xl text-xs outline-none text-slate-900 dark:text-white font-mono"
                        value={regA3}
                        onChange={e => setRegA3(e.target.value)}
                      />
                    </div>

                    <button 
                      type="submit" 
                      disabled={isLoading}
                      className="w-full py-4.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-xl transition-all text-xs flex items-center justify-center gap-2 cursor-pointer mt-4"
                    >
                      {isLoading ? (
                        <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>{lang === 'ar' ? 'سجل الحساب الجديد ونزل مفتاح الاسترداد ➔' : 'Register Account & Save Keys ➔'}</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </>
            )}

            {/* Quick Login Helper - Highly Polish & Design Focused */}

            {/* Quick Login Helper - Highly Polish & Design Focused */}
            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
              <button
                type="button"
                onClick={() => setShowQuickHelper(!showQuickHelper)}
                className="text-xs font-bold text-slate-400 hover:text-blue-500 transition-colors inline-flex items-center gap-1.5"
              >
                <KeyRound size={14} />
                <span>{curTrans.quickFill}</span>
              </button>

              <AnimatePresence>
                {showQuickHelper && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden mt-4"
                  >
                    <div className="p-4 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3 text-start">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{curTrans.clickToFill}</p>
                      <div className="flex flex-col gap-2">
                        {users.map(u => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => handleQuickFill(u)}
                            className="w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-slate-150 dark:border-slate-800 rounded-xl transition-all text-xs"
                          >
                            <span className="font-black text-slate-700 dark:text-slate-200">{u.username} ({String(u.role) === 'admin' || u.role === UserRole.ADMIN ? (lang === 'ar' ? 'مسؤول' : 'Admin') : (lang === 'ar' ? 'موظف' : 'Staff')})</span>
                            <span className="font-mono text-[10px] text-slate-400">{getPlainPassword(u)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>
        </div>

      </div>

      {/* 🔐 Password Recovery Modal */}
      <AnimatePresence>
        {showForgotModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setShowForgotModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-xl shadow-2xl p-6 md:p-10 border border-slate-100 dark:border-slate-800 relative overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <ForgotPassword onClose={() => setShowForgotModal(false)} lang={lang} onUpdateUsers={onUpdateUsers} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Login;
