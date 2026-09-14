import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, Laptop, Users2, ShieldAlert, ArrowLeftRight, Landmark, Zap, 
  HelpCircle, Car, ArrowRight, ClipboardCheck, Database, KeyRound, CheckCircle,
  Home, LayoutDashboard
} from 'lucide-react';
import { motion } from 'motion/react';
import { Car as CarType, OrganizationSettings, CarStatus } from '../types';

interface CorporateLandingProps {
  settings: OrganizationSettings;
  cars: CarType[];
  currentUser: any;
  onLogout: () => void;
  isRtl: boolean;
}

export const CorporateLanding: React.FC<CorporateLandingProps> = ({
  settings,
  cars,
  currentUser,
  onLogout,
  isRtl
}) => {
  const navigate = useNavigate();

  // Dynamic Metrics calculation based on the shared inventory
  const totalCars = cars.length;
  const availableCars = cars.filter(c => c.status === CarStatus.AVAILABLE).length;
  const reservedCars = cars.filter(c => c.status === CarStatus.RESERVED).length;
  const soldCars = cars.filter(c => c.status === CarStatus.SOLD).length;

  return (
    <div className="w-full min-h-screen bg-slate-950 text-white selection:bg-blue-600 selection:text-white flex flex-col justify-between py-12 px-4 md:px-12 relative" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Background Ambience Overlays */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-950/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-950/20 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto w-full space-y-16 relative z-10">
        
        {/* Header Branding & Portal Navigator */}
        <header className="space-y-6 pb-6 border-b border-slate-800/60">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4 text-center sm:text-start">
              <div className="h-14 w-14 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Car size={32} className="text-white" />
              </div>
              <div className="space-y-1">
                <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                  {settings.name || 'مؤسسة المخزون الذكي الرقمية'}
                </h1>
                <p className="text-xs font-bold text-slate-400">
                  {settings.description || 'منظومة إدارة المستودعات والربط المحلي الذكي'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {currentUser ? (
                <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-200">{currentUser.username}</p>
                    <p className="text-[10px] text-indigo-400 font-bold">{currentUser.role}</p>
                  </div>
                  <button 
                    onClick={onLogout}
                    className="p-2 bg-rose-500 hover:bg-rose-600 rounded-lg text-xs font-bold cursor-pointer transition-all"
                  >
                    {isRtl ? 'خروج' : 'Logout'}
                  </button>
                </div>
              ) : (
                <span className="text-xs px-3.5 py-1.5 bg-slate-900 border border-slate-800 text-slate-400 rounded-full font-black flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  {isRtl ? 'بوابة الشبكة المحلية نشطة' : 'LAN Node Active'}
                </span>
              )}
            </div>
          </div>

          {/* Unified Platform Navigation Tabs */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 bg-slate-900/60 border border-slate-800/80 p-2 rounded-2xl max-w-2xl">
            <button
              onClick={() => navigate('/corporate-portal')}
              className="px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 bg-blue-600 text-white shadow-lg shadow-blue-600/10 cursor-pointer"
            >
              <Home size={14} />
              <span>{isRtl ? 'الواجهة التعريفية' : 'Corporate Home'}</span>
            </button>
            
            <button
              onClick={() => navigate('/showroom')}
              className="px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 text-slate-400 hover:text-white hover:bg-slate-800/50 cursor-pointer"
            >
              <Laptop size={14} />
              <span>{isRtl ? 'معرض المبيعات والمناديب' : 'Delegate Showroom'}</span>
            </button>

            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 text-slate-400 hover:text-white hover:bg-slate-800/50 cursor-pointer"
            >
              <LayoutDashboard size={14} />
              <span>{isRtl ? 'لوحة إدارة وتوريد المستودع' : 'Admin Control Dashboard'}</span>
            </button>
          </div>
        </header>

        {/* Hero Section */}
        <section className="text-center space-y-6 max-w-4xl mx-auto py-8">
          <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full text-xs font-black uppercase tracking-widest leading-none">
            <Zap size={14} className="animate-pulse" />
            {isRtl ? 'الإصدار المطور للاتصال متعدد الأجهزة' : 'Multi-Device Enabled Enterprise Platform'}
          </span>
          <h2 className="text-3xl md:text-6xl font-black leading-tight tracking-tight text-white">
            {isRtl ? 'منظومة المخزون الذكي' : 'Smart Stock Management Platform'}
          </h2>
          <p className="text-slate-400 text-sm md:text-lg font-semibold max-w-3xl mx-auto leading-relaxed">
            {isRtl 
              ? 'نهج معماري حديث يربط أجهزة كواشير صالة العرض بالخلفية المشتركة. يمكنك استخدامه كنقطة تفتيش مركزية لمتابعة حركات سيارات المعرض، أو الاتصال اللاسلكي كـ Client للمزامنة مع الخادم لمنع تعارض الفواتير أو الحجوزات المكررة.'
              : 'A modern decentralized solution connecting your local showroom computers in real-time. Powering reliable client-server local networks to synchronize stock adjustments and prevent duplicate bookings elegantly without external internet dependencies.'}
          </p>
        </section>

        {/* Action Pathways Cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          
          {/* Path 1: Showroom / Delegate View */}
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/10 rounded-3xl p-8 transition-all group flex flex-col justify-between">
            <div className="space-y-6">
              <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-all">
                <Laptop size={28} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl md:text-2xl font-black text-slate-100 group-hover:text-white transition-all">
                  {isRtl ? 'بوابة المناديب وصالة العرض' : 'Showroom & Representative Portal'}
                </h3>
                <p className="text-xs text-slate-400 font-bold leading-relaxed">
                  {isRtl 
                    ? 'الولوج السريع والمبسط لاستعراض المركبات كبطاقات تفصيلية، والتحقق الفوري من توافر فئات الموديلات، مع الصلاحية التامة لحجز السيارات وتعديل حالتها تلقائياً بمجرد توفيرها.'
                    : 'Instant access designed for field agents and delegates. View vehicle portfolios, specifications, and statuses. Perform instantaneous reservations during client meetings on the go.'}
                </p>
              </div>
              
              {/* Features subset */}
              <div className="space-y-2.5 pt-2 border-t border-slate-800/60 text-xs text-slate-300 font-bold">
                <div className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-indigo-400" />
                  <span>{isRtl ? 'عرض بطاقات المركبات متكامل البيانات' : 'Fully featured spec sheet cards view'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-indigo-400" />
                  <span>{isRtl ? 'حجز السيارة على الفور لتفادي التعارض' : 'Instant booking and lock to prevent collision'}</span>
                </div>
              </div>
            </div>

            <button 
              onClick={() => navigate('/showroom')}
              className="mt-8 w-full p-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 shadow-lg shadow-indigo-600/15"
            >
              <span>{isRtl ? 'استعراض المعرض وحجز المركبات' : 'Open Representative Showroom'}</span>
              <ArrowRight size={16} className={`${isRtl ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Path 2: Full System Admin Gate */}
          <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-500/10 rounded-3xl p-8 transition-all group flex flex-col justify-between">
            <div className="space-y-6">
              <div className="h-14 w-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-all">
                <Database size={28} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl md:text-2xl font-black text-slate-100 group-hover:text-white transition-all">
                  {isRtl ? 'بوابة إدارة المخزون المركزية' : 'Central Stock Control Room'}
                </h3>
                <p className="text-xs text-slate-400 font-bold leading-relaxed">
                  {isRtl 
                    ? 'الوصول للوحة التحكم الكاملة لإدارة المستودع الموحد، التحقق المالي وتوريد السجلات، الصلاحيات العليا لتعديل المبيعات، ومراقبة تزامنات الأجهزة المتصلة بالـ LAN.'
                    : 'The comprehensive suite for managers. Add, modify or delete car stock, fetch analytical and financial reports, administer user privileges, configure custom fields and local backups.'}
                </p>
              </div>

              {/* Features subset */}
              <div className="space-y-2.5 pt-2 border-t border-slate-800/60 text-xs text-slate-300 font-bold">
                <div className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-blue-400" />
                  <span>{isRtl ? 'جداول توريد متكاملة ولوحة تحليلات مالية' : 'Full-scale spreadsheets and pricing indices'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-blue-400" />
                  <span>{isRtl ? 'سجل العمليات والرقابة الأمنية LAN' : 'Active tracking of local client pings and logs'}</span>
                </div>
              </div>
            </div>

            <button 
              onClick={() => navigate('/dashboard')}
              className="mt-8 w-full p-4 bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-600 hover:to-blue-500 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 shadow-lg shadow-blue-600/15"
            >
              <span>{isRtl ? 'تسجيل الدخول كمدير نظام' : 'System Administrator Login'}</span>
              <KeyRound size={16} />
            </button>
          </div>

        </section>

        {/* Statistics Bar Component */}
        <section className="bg-slate-900/40 border border-slate-800/60 rounded-[2rem] p-6 max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center backdrop-blur-md">
          <div className="space-y-1">
            <span className="block text-2xl md:text-4xl font-extrabold text-white font-mono">{totalCars}</span>
            <span className="block text-xs font-bold text-slate-400">{isRtl ? 'إجمالي المركبات' : 'Total fleet'}</span>
          </div>
          <div className="space-y-1 border-r border-slate-800/60">
            <span className="block text-2xl md:text-4xl font-extrabold text-emerald-400 font-mono">{availableCars}</span>
            <span className="block text-xs font-bold text-slate-400">{isRtl ? 'المتوفرة للمبيعات' : 'For sale / Available'}</span>
          </div>
          <div className="space-y-1 border-r border-slate-800/60">
            <span className="block text-2xl md:text-4xl font-extrabold text-amber-500 font-mono">{reservedCars}</span>
            <span className="block text-xs font-bold text-slate-400">{isRtl ? 'المحجوزة حالياً' : 'Reserved status'}</span>
          </div>
          <div className="space-y-1 border-r border-slate-800/60">
            <span className="block text-2xl md:text-4xl font-extrabold text-blue-500 font-mono">{soldCars}</span>
            <span className="block text-xs font-bold text-slate-400">{isRtl ? 'المباعة والمجدولة' : 'Sold ledger'}</span>
          </div>
        </section>

        {/* Feature Highlights Section */}
        <section className="space-y-8 max-w-4xl mx-auto">
          <h3 className="text-center font-black text-lg text-slate-300">{isRtl ? 'مزايا منظومة المخزون الذكي للمستودع اللاسلكي' : 'Decentralized Smart Stock Features'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-start">
            <div className="p-5 bg-slate-900/20 border border-slate-900 rounded-2xl space-y-2">
              <Shield size={20} className="text-emerald-400" />
              <h4 className="font-extrabold text-sm text-slate-100">{isRtl ? 'حماية مشددة وقواعد محلية' : 'Encrypted Local DB'}</h4>
              <p className="text-[11px] font-semibold text-slate-400 leading-normal">{isRtl ? 'تخزين مشفر آلياً ببروتوكولات التشفير العسكري لحفظ الفواتير بشكل مطلق.' : 'Secure military encryption on flash devices protecting operational cash balances.'}</p>
            </div>
            <div className="p-5 bg-slate-900/20 border border-slate-900 rounded-2xl space-y-2">
              <ArrowLeftRight size={20} className="text-indigo-400" />
              <h4 className="font-extrabold text-sm text-slate-100">{isRtl ? 'إتاحة الربط اللامركزي للواي فاي' : 'Multiuser Router Sync'}</h4>
              <p className="text-[11px] font-semibold text-slate-400 leading-normal">{isRtl ? 'بروتوكول UDP معقد لمعاينة عناوين الأجهزة الملحقة وجمع بورتات الفحص.' : 'Optimistic offline timestamps allowing multiple clients to sync at high concurrency rates.'}</p>
            </div>
            <div className="p-5 bg-slate-900/20 border border-slate-900 rounded-2xl space-y-2">
              <Users2 size={20} className="text-blue-400" />
              <h4 className="font-extrabold text-sm text-slate-100">{isRtl ? 'مرونة الأدوار وصلاحيات الأعضاء' : 'Role Hierarchy Control'}</h4>
              <p className="text-[11px] font-semibold text-slate-400 leading-normal">{isRtl ? 'تخصيص كامل لصلاحيات المدراء، الكواشير، والمناديب وتدقيقها بسجلات الحركة.' : 'Individual logins for executives, inventory handlers, and showroom clerks.'}</p>
            </div>
          </div>
        </section>

      </div>

      {/* Footer copyright */}
      <footer className="mt-16 text-center text-xs text-slate-500 font-bold border-t border-slate-900 pt-6">
        <span>© 2026 {settings.name}. {isRtl ? 'كافة الحقوق محفوظة بموجب الترخيص المشفر.' : 'All operations managed in encrypted local systems.'}</span>
      </footer>
    </div>
  );
};
