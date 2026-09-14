
import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  CarFront, 
  Search,
  BarChart3, 
  Users, 
  ShoppingBag,
  UserCheck,
  RefreshCcw,
  LogOut,
  Settings,
  ShieldCheck,
  Zap,
  ChevronLeft,
  Activity,
  Copyright,
  ExternalLink,
  Car,
  Info,
  X,
  Warehouse,
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  FileText,
  TrendingUp,
  ClipboardList,
  Coins,
  Truck,
  Globe
} from 'lucide-react';
import { User, OrganizationSettings, UserRole, Permission } from '../types';
import { useLanguage } from './LanguageContext.tsx';
import { ROLE_PERMISSIONS } from '../constants';
import { getLogoDataUri } from './OfficialAssets';

interface SidebarProps {
  currentUser: User | null;
  onLogout: () => void;
  settings: OrganizationSettings;
  dbStatus?: 'connected' | 'syncing' | 'error' | 'cloud_sync';
  onShowAbout: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  currentUser, 
  onLogout, 
  settings, 
  dbStatus = 'connected', 
  onShowAbout,
  isMobileOpen = false,
  onCloseMobile
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = currentUser?.role === UserRole.ADMIN || String(currentUser?.role).toUpperCase() === 'ADMIN';
  const { t, isRtl } = useLanguage();
  const userPermissions = currentUser?.permissions || 
    (isAdmin ? ROLE_PERMISSIONS[UserRole.ADMIN] : 
     (currentUser?.role === UserRole.EMPLOYEE || String(currentUser?.role).toUpperCase() === 'EMPLOYEE' ? ROLE_PERMISSIONS[UserRole.EMPLOYEE] : 
      (currentUser?.role === UserRole.DELEGATE || String(currentUser?.role).toUpperCase() === 'DELEGATE' ? ROLE_PERMISSIONS[UserRole.DELEGATE] : [])));
  const canViewReports = isAdmin || userPermissions.includes(Permission.VIEW_REPORTS);

  const isReportsPath = location.pathname.startsWith('/reports');
  const [isReportsExpanded, setIsReportsExpanded] = React.useState(isReportsPath);

  React.useEffect(() => {
    if (isReportsPath) {
      setIsReportsExpanded(true);
    }
  }, [location.pathname, isReportsPath]);

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: t('nav.dashboard'), permission: Permission.VIEW_DASHBOARD },
    { to: '/search', icon: Search, label: isRtl ? 'البحث الذكي المتقدم' : 'Smart Search', permission: Permission.VIEW_DASHBOARD },
    { to: '/inventory', icon: CarFront, label: t('nav.inventory'), permission: Permission.MANAGE_INVENTORY },
    { to: '/sales', icon: ShoppingBag, label: t('nav.sales'), permission: Permission.VIEW_SALES },
    { to: '/customers', icon: UserCheck, label: t('nav.customers'), permission: Permission.VIEW_SALES },
    { to: '/delegate-dashboard', icon: ClipboardList, label: isRtl ? 'لوحة حجوزات المندوبين' : 'Delegate Reservations', permission: Permission.VIEW_DASHBOARD },
    { to: '/delegate-dashboard?tab=management', icon: Users, label: isRtl ? 'إدارة وتفعيل المناديب' : 'Delegate Mgmt & Activation', permission: Permission.VIEW_DASHBOARD },
    { to: '/reports?view=inventory', icon: BarChart3, label: t('nav.reports'), permission: Permission.VIEW_REPORTS },
    { to: '/users', icon: Users, label: t('nav.users'), permission: Permission.MANAGE_USERS },
    { to: '/backup', icon: RefreshCcw, label: t('nav.backup'), permission: Permission.MANAGE_BACKUP },
    { to: '/settings', icon: Settings, label: t('nav.settings'), permission: Permission.MANAGE_SETTINGS },
  ].filter(item => 
    isAdmin || 
    (item.permission && userPermissions.includes(item.permission))
  );

  return (
    <aside className={`fixed inset-y-0 ${isRtl ? 'right-0 border-l' : 'left-0 border-r'} z-50 w-64 bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-2xl flex flex-col ${isMobileOpen ? 'translate-x-0' : (isRtl ? 'translate-x-64' : '-translate-x-64')} md:translate-x-0 transition-transform duration-300 md:flex print:hidden transition-theme overflow-y-auto custom-scrollbar`}>
      {onCloseMobile && (
        <button 
          onClick={onCloseMobile}
          type="button"
          className="absolute top-4 left-4 p-2 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 md:hidden transition-all bg-slate-50 dark:bg-slate-800 rounded-xl"
        >
          <X size={16} />
        </button>
      )}
      <div className="p-4 sm:p-6 flex flex-col items-center gap-3 sm:gap-4 text-center shrink-0">
        <div className="w-24 h-24 sm:w-32 sm:h-32 bg-slate-50 dark:bg-slate-800 rounded-2xl sm:rounded-[2rem] text-white shadow-xl flex items-center justify-center relative group transition-all hover:scale-105 border border-slate-100 dark:border-slate-700 overflow-hidden">
          <img src={settings.logoUrl || getLogoDataUri(settings.name)} alt="User Brand" className="w-full h-full object-contain p-2 sm:p-3" />
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-3 border-white dark:border-slate-900 rounded-full animate-pulse"></div>
        </div>
        <div className="space-y-1">
          <span className="font-black text-lg sm:text-xl tracking-tighter text-slate-800 dark:text-white block truncate w-48 leading-none">{settings.name}</span>
          <div className="flex items-center justify-center gap-1.5">
             <Activity size={10} className="text-blue-500" />
             <span className="text-[9px] sm:text-[10px] font-black text-blue-500 uppercase tracking-[0.15em]">Karian Enterprise</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 sm:px-4 py-3 sm:py-4 space-y-1.5">
        {/* بوابات المنصة العامة للشركة */}
        <div className="pb-3 border-b border-slate-100 dark:border-slate-800/80 px-2 mb-3">
          <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider text-right mb-2">
            {isRtl ? 'بوابات المنصة العامة' : 'Official Portal Gates'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <NavLink 
              to="/corporate-portal" 
              onClick={() => {
                if (onCloseMobile) onCloseMobile();
              }}
              className="flex flex-col items-center gap-1.5 p-2 bg-slate-50 dark:bg-slate-950 hover:bg-blue-500/10 dark:hover:bg-blue-500/20 rounded-xl text-slate-500 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 border border-slate-100 dark:border-slate-800/60 transition-all text-center"
            >
              <ExternalLink size={14} className="text-blue-500" />
              <span className="text-[9.5px] font-black leading-none">{isRtl ? 'الرئيسية' : 'Corporate'}</span>
            </NavLink>
            <NavLink 
              to="/showroom" 
              onClick={() => {
                if (onCloseMobile) onCloseMobile();
              }}
              className="flex flex-col items-center gap-1.5 p-2 bg-slate-50 dark:bg-slate-950 hover:bg-indigo-500/10 dark:hover:bg-indigo-500/20 rounded-xl text-slate-500 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 border border-slate-100 dark:border-slate-800/60 transition-all text-center"
            >
              <Car size={14} className="text-indigo-500" />
              <span className="text-[9.5px] font-black leading-none">{isRtl ? 'المعرض وحجوزاتي' : 'Showroom'}</span>
            </NavLink>
          </div>
        </div>

        {navItems.map((item) => {
          const isReportsItem = item.to.startsWith('/reports');

          if (isReportsItem) {
            const isReportsActive = location.pathname.startsWith('/reports');
            return (
              <div key={item.to} className="space-y-1">
                <div
                  onClick={() => {
                    if (onCloseMobile) onCloseMobile();
                    setIsReportsExpanded(true);
                    if (!isReportsActive) {
                      navigate(item.to);
                    }
                  }}
                  className={`flex items-center justify-between px-4 py-4 rounded-2xl transition-all duration-300 group cursor-pointer ${
                    isReportsActive 
                    ? 'bg-slate-950 dark:bg-blue-600 text-white font-black shadow-xl' 
                    : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <item.icon size={20} className={`transition-all duration-500 ${isReportsActive ? 'scale-110' : 'group-hover:text-blue-500'}`} />
                    <span className="text-sm font-bold tracking-tight">{item.label}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsReportsExpanded(prev => !prev);
                    }}
                    className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                    title={isReportsExpanded ? (isRtl ? 'طي القائمة' : 'Collapse') : (isRtl ? 'توسيع القائمة' : 'Expand')}
                  >
                    <ChevronLeft 
                      size={14} 
                      className={`transition-all duration-300 ${
                        isReportsExpanded 
                          ? (isRtl ? '-rotate-90' : 'rotate-90') 
                          : (isRtl ? '' : 'rotate-180')
                      }`} 
                    />
                  </button>
                </div>

                {isReportsExpanded && (
                  <div className={`mt-1 space-y-3 ${isRtl ? 'pr-4 border-r-2' : 'pl-4 border-l-2'} border-slate-100 dark:border-slate-800/60 transition-all duration-300 animate-in fade-in slide-in-from-top-1`}>
                    {(() => {
                      const reportCategories = [
                        {
                          title: isRtl ? '📦 الجرد والمخازن' : '📦 Inventory & Stock',
                          items: [
                            { view: 'comprehensive-inventory', icon: Globe, label: isRtl ? 'التقرير الشامل (كافة المخزون)' : 'Comprehensive Report' },
                            { view: 'outside-showroom', icon: Truck, label: isRtl ? 'سيارات لم تصل أو خارج المعرض' : 'Outside Showroom / Not Arrived' },
                            { view: 'inventory', icon: Warehouse, label: isRtl ? 'تسليم السيارات' : 'Car Delivery' },
                            { view: 'physical-inventory', icon: Warehouse, label: isRtl ? 'المخزون الفعلي بالمعرض' : 'Physical Inventory' },
                            { view: 'physical-inventory-summary', icon: ClipboardList, label: isRtl ? 'ملخص الجرد الفعلي الفئوي' : 'Actual Inventory Summary' },
                            { view: 'comprehensive-inventory-summary', icon: ClipboardList, label: isRtl ? 'ملخص المخزون الشامل للفئات' : 'Comprehensive Inventory Summary' },
                            { view: 'showroom-inventory-cost', icon: Coins, label: isRtl ? 'تكلفة مخزون المعرض 💵' : 'Showroom Stock Cost' },
                          ]
                        },
                        {
                          title: isRtl ? '⏱️ الحركة والنشاط' : '⏱️ Movement & Activity',
                          items: [
                            { view: 'monthly', icon: Calendar, label: isRtl ? 'التقرير السنوي والشهري' : 'Monthly & Annual' },
                            { view: 'daily-entry', icon: ArrowUpRight, label: isRtl ? 'واردات وحركة دخول اليوم' : 'Daily Car Entry' },
                            { view: 'daily-exit', icon: ArrowRightLeft, label: isRtl ? 'صادرات وحركة خروج اليوم' : 'Daily Car Exit' },
                            { view: 'daily-summary', icon: FileText, label: isRtl ? 'ملخص حركة المخازن اليومية' : 'Daily Movement Summary' },
                            { view: 'daily-movement-statement', icon: FileText, label: isRtl ? 'بيان حركة المخزون اليومي 📋' : 'Daily Movement Statement' },
                          ]
                        },
                        {
                          title: isRtl ? '💼 المبيعات والمناديب' : '💼 Sales & Delegates',
                          items: [
                            { view: 'analytics', icon: TrendingUp, label: isRtl ? 'تحليل وإحصائيات الطلب المباشر' : 'Demand Analytics' },
                            { view: 'delegates', icon: Users, label: isRtl ? 'إحصائيات المناديب' : 'Delegates Reports' },
                            { view: 'delegates-reports', icon: FileText, label: isRtl ? 'تقارير المناديب' : 'Delegates Performance' },
                            { view: 'delegates-inventory-summary', icon: ClipboardList, label: isRtl ? 'ملخص مبيعات المخزون' : 'Inventory Sales Summary' },
                          ]
                        },
                        {
                          title: isRtl ? '🛒 المشتريات والموردين' : '🛒 Purchases & Suppliers',
                          items: [
                            { view: 'purchases', icon: ShoppingBag, label: isRtl ? 'المشتريات والاستلام' : 'Purchases & Receiving' },
                            { view: 'supplier-analysis', icon: Users, label: isRtl ? 'تحليل أداء الموردين' : 'Supplier Analysis' },
                            { view: 'resilience-audit', icon: ShieldCheck, label: isRtl ? 'الحماية والتشخيص الذكي' : 'Resilience & Data Audit' },
                          ]
                        }
                      ];

                      return reportCategories.map((cat, catIdx) => (
                        <div key={catIdx} className="space-y-1 pt-1 first:pt-0">
                          <div className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider text-right px-2 pb-1 border-b border-slate-50/10 dark:border-slate-800/20 select-none">
                            {cat.title}
                          </div>
                          {cat.items.map((subItem) => {
                            const currentView = new URLSearchParams(location.search).get('view') || 'inventory';
                            const isSubActive = location.pathname === '/reports' && currentView === subItem.view;

                            return (
                              <NavLink
                                key={subItem.view}
                                to={`/reports?view=${subItem.view}`}
                                onClick={() => {
                                  if (onCloseMobile) onCloseMobile();
                                }}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-300 group border text-start ${
                                  isSubActive
                                    ? 'bg-blue-600/10 dark:bg-blue-500/10 border-blue-100/30 dark:border-blue-900/20 text-blue-600 dark:text-blue-400 font-black shadow-sm'
                                    : 'border-transparent text-slate-455 dark:text-slate-400 hover:bg-slate-500/5 dark:hover:bg-slate-850/40 hover:text-slate-705 dark:hover:text-slate-200'
                                }`}
                              >
                                <subItem.icon size={13} className={`shrink-0 transition-transform duration-300 ${isSubActive ? 'scale-110 text-blue-650 dark:text-blue-400' : 'group-hover:text-blue-500 group-hover:scale-105'}`} />
                                <span className="text-[11px] font-bold truncate leading-none">{subItem.label}</span>
                              </NavLink>
                            );
                          })}
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
            );
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => {
                if (onCloseMobile) onCloseMobile();
              }}
              className={({ isActive }) => 
                `flex items-center justify-between px-4 py-4 rounded-2xl transition-all duration-300 group ${
                  isActive 
                  ? 'bg-slate-950 dark:bg-blue-600 text-white font-black shadow-xl' 
                  : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-4">
                    <item.icon size={20} className={`transition-all duration-500 ${isActive ? 'scale-110' : 'group-hover:text-blue-500'}`} />
                    <span className="text-sm font-bold tracking-tight">{item.label}</span>
                  </div>
                  <ChevronLeft size={14} className={`transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-0'} ${isRtl ? '' : 'rotate-180'}`} />
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-6 space-y-4">
        <button 
          onClick={onShowAbout}
          className="w-full flex items-center gap-3 px-6 py-4 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-2xl transition-all font-black text-xs hover:bg-blue-50 dark:hover:bg-blue-900/20 group"
        >
          <Info size={18} className="group-hover:text-blue-500" />
          <span>{t('nav.about')}</span>
        </button>

        <button onClick={onLogout} className="w-full flex items-center gap-3 px-6 py-4 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-2xl transition-all font-black text-xs group">
          <LogOut size={18} className={`transition-transform ${isRtl ? 'group-hover:translate-x-1' : 'group-hover:-translate-x-1'}`} />
          <span>{t('nav.logout')}</span>
        </button>

        <div className="pt-4 border-t border-slate-100 dark:border-white/5">
          <a href="https://karia2.blogspot.com/" target="_blank" rel="noopener noreferrer" className="block group relative rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-950/50 hover:border-blue-500/30 transition-all">
             <div className="relative z-10 flex flex-col items-center text-center space-y-2">
                <span className="text-[10px] font-black text-slate-800 dark:text-white group-hover:text-blue-500 transition-colors flex items-center gap-2">
                   {t('nav.developer')}
                   <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </span>
                <div className="flex items-center gap-1 text-[8px] font-bold text-slate-500 uppercase">
                   <Copyright size={8} /> 2026 Karian Digital Platform
                </div>
             </div>
          </a>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
