import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { 
  PieChart, Pie, Cell, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { 
  CarFront, 
  PackageCheck, 
  TrendingUp,
  AlertTriangle,
  Settings,
  Plus,
  ChevronLeft,
  Database,
  Zap,
  ShieldCheck,
  ArrowUpRight,
  Activity,
  BarChart3,
  Clock,
  Eye,
  EyeOff,
  SlidersHorizontal,
  User as UserIcon,
  ShoppingBag,
  FileSpreadsheet,
  Cpu,
  Terminal,
  Sparkles,
  TrendingDown,
  ChevronRight,
  Bookmark,
  Bell,
  ArrowRight,
  Search,
  X,
  RefreshCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from './LanguageContext.tsx';
import { Car, CarStatus, ActivityLog, DashboardPreferences, OrganizationSettings, RentalStatus, User, UserRole, Permission } from '../types';
import { ROLE_PERMISSIONS } from '../constants';
import { isCarMatchingQuery, getUnifiedSearchResults } from '../src/utils/searchEngine';

interface DashboardProps {
  cars: Car[];
  logs: ActivityLog[];
  prefs: DashboardPreferences;
  onUpdatePrefs: (prefs: DashboardPreferences) => void;
  settings: OrganizationSettings;
  currentUser: User | null;
}

const Dashboard: React.FC<DashboardProps> = ({ cars, logs, prefs, onUpdatePrefs, settings, currentUser }) => {
  const [securityScore, setSecurityScore] = useState(99.4);
  const [showConfig, setShowConfig] = useState(false);
  const [activeMetricCard, setActiveMetricCard] = useState<string | null>(null);
  const navigate = useNavigate();

  const { lang, setLang, dir, t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState<'all' | 'available' | 'reserved' | 'sold' | 'rented'>('all');
  const [selectedCarForDetail, setSelectedCarForDetail] = useState<Car | null>(null);

  // Advanced Multi-Criteria Search States
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advBrand, setAdvBrand] = useState('');
  const [advModel, setAdvModel] = useState('');
  const [advColor, setAdvColor] = useState('');
  const [advYear, setAdvYear] = useState('');
  const [advStatus, setAdvStatus] = useState<'all' | 'available' | 'reserved' | 'sold' | 'rented'>('all');
  const [advMinPrice, setAdvMinPrice] = useState('');
  const [advMaxPrice, setAdvMaxPrice] = useState('');

  // Extract unique fields from current stock for smart interactive dropdown selectors
  const uniqueBrands = useMemo(() => {
    return Array.from(new Set(cars.map(c => c.brand).filter(Boolean))).sort();
  }, [cars]);

  const uniqueColors = useMemo(() => {
    return Array.from(new Set(cars.map(c => c.color).filter(Boolean))).sort();
  }, [cars]);

  const uniqueYears = useMemo(() => {
    return Array.from(new Set(cars.map(c => c.year).filter(Boolean))).sort((a, b) => b - a);
  }, [cars]);

  // Get popular tags from actual stock to suggest
  const popularTags = useMemo(() => {
    const brandCounts: Record<string, number> = {};
    const yearCounts: Record<string, number> = {};
    const colorCounts: Record<string, number> = {};

    cars.forEach(c => {
      if (c.brand) brandCounts[c.brand] = (brandCounts[c.brand] || 0) + 1;
      if (c.year) {
        const yStr = c.year.toString();
        yearCounts[yStr] = (yearCounts[yStr] || 0) + 1;
      }
      if (c.color) colorCounts[c.color] = (colorCounts[c.color] || 0) + 1;
    });

    const sortedBrands = Object.entries(brandCounts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ar'))
      .map(([name]) => name)
      .slice(0, 4);

    const sortedYears = Object.entries(yearCounts)
      .sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))
      .map(([name]) => name)
      .slice(0, 2);

    const sortedColors = Object.entries(colorCounts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ar'))
      .map(([name]) => name)
      .slice(0, 2);

    return Array.from(new Set([...sortedBrands, ...sortedYears, ...sortedColors])).filter(Boolean);
  }, [cars]);

  // Filtered cars for smart advanced search combining multiple criteria simultaneously
  const searchedCars = useMemo(() => {
    const hasQuery = searchQuery.trim().length > 0;
    const hasPillFilter = searchFilter !== 'all';
    
    // Check active advanced criteria
    const hasAdvBrand = advBrand.trim().length > 0;
    const hasAdvModel = advModel.trim().length > 0;
    const hasAdvColor = advColor.trim().length > 0;
    const hasAdvYear = advYear.trim().length > 0;
    const hasAdvStatus = advStatus !== 'all';
    const hasAdvMinPrice = advMinPrice.trim().length > 0;
    const hasAdvMaxPrice = advMaxPrice.trim().length > 0;
    
    const isAdvActive = showAdvanced && (
      hasAdvBrand || hasAdvModel || hasAdvColor || hasAdvYear || hasAdvStatus || hasAdvMinPrice || hasAdvMaxPrice
    );

    // If nothing has been searched or filtered, return empty results for quick dropdown view
    if (!hasQuery && !hasPillFilter && !isAdvActive) {
      return []; 
    }
    
    // First, filter and rank candidates by the unified search engine (with scores / priority)
    let candidates = hasQuery ? getUnifiedSearchResults(cars, searchQuery) : cars;
    
    let matched = candidates.filter(car => {
      // 1. General Pill status filter
      if (searchFilter === 'available' && car.status !== CarStatus.AVAILABLE) return false;
      if (searchFilter === 'reserved' && car.status !== CarStatus.RESERVED) return false;
      if (searchFilter === 'sold' && car.status !== CarStatus.SOLD) return false;
      if (searchFilter === 'rented' && car.rentalStatus !== RentalStatus.RENTED) return false;

      // 2. Advanced cumulative multi-criteria query matching (color, model, brand, status, price)
      if (showAdvanced) {
        if (hasAdvBrand && car.brand.toLowerCase() !== advBrand.toLowerCase()) return false;
        if (hasAdvModel && !car.model.toLowerCase().includes(advModel.toLowerCase().trim())) return false;
        if (hasAdvColor && car.color.toLowerCase() !== advColor.toLowerCase()) return false;
        if (hasAdvYear && car.year.toString() !== advYear.trim()) return false;
        
        if (advStatus === 'available' && car.status !== CarStatus.AVAILABLE) return false;
        if (advStatus === 'reserved' && car.status !== CarStatus.RESERVED) return false;
        if (advStatus === 'sold' && car.status !== CarStatus.SOLD) return false;
        if (advStatus === 'rented' && car.rentalStatus !== RentalStatus.RENTED) return false;
        
        if (hasAdvMinPrice) {
          const minVal = parseFloat(advMinPrice);
          if (!isNaN(minVal) && car.price < minVal) return false;
        }
        if (hasAdvMaxPrice) {
          const maxVal = parseFloat(advMaxPrice);
          if (!isNaN(maxVal) && car.price > maxVal) return false;
        }
      }
      
      return true;
    });

    if (hasQuery) {
      // If we have an active text search, keep the relevance score ranking sorted order returned by the engine
      return matched;
    } else {
      // Otherwise, sort showing newest entries first to be highly structured and consistent
      return matched.sort((a, b) => {
        const dateA = new Date(a.entryDate || 0).getTime();
        const dateB = new Date(b.entryDate || 0).getTime();
        return dateB - dateA || b.id.localeCompare(a.id);
      });
    }
  }, [
    cars, 
    searchQuery, 
    searchFilter, 
    showAdvanced, 
    advBrand, 
    advModel, 
    advColor, 
    advYear, 
    advStatus, 
    advMinPrice, 
    advMaxPrice
  ]);

  const isAdmin = !currentUser || currentUser?.role === UserRole.ADMIN || String(currentUser?.role).toUpperCase() === 'ADMIN';
  const hasPermission = (perm: Permission) => 
    currentUser?.permissions?.includes(perm) || 
    (isAdmin ? ROLE_PERMISSIONS[UserRole.ADMIN].includes(perm) : 
     (currentUser?.role === UserRole.EMPLOYEE || String(currentUser?.role).toUpperCase() === 'EMPLOYEE' ? ROLE_PERMISSIONS[UserRole.EMPLOYEE].includes(perm) : 
      (currentUser?.role === UserRole.DELEGATE || String(currentUser?.role).toUpperCase() === 'DELEGATE' ? ROLE_PERMISSIONS[UserRole.DELEGATE].includes(perm) : false)));

  // Security score fluctuation to look immersive
  useEffect(() => {
    const interval = setInterval(() => {
      setSecurityScore(prev => Math.min(100, Math.max(98.5, prev + (Math.random() > 0.5 ? 0.04 : -0.04))));
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const stats = useMemo(() => {
    const activeCars = cars.filter(c => !c.isOutbound && c.status !== CarStatus.IN_TRANSFER);
    return {
      total: activeCars.length,
      available: activeCars.filter(c => c.status === CarStatus.AVAILABLE).length,
      reserved: activeCars.filter(c => c.status === CarStatus.RESERVED).length,
      sold: cars.filter(c => c.status === CarStatus.SOLD).length,
      notArrived: activeCars.filter(c => c.status === CarStatus.NOT_ARRIVED).length,
      returned: activeCars.filter(c => c.status === CarStatus.RETURNED).length,
      rented: activeCars.filter(c => c.rentalStatus === RentalStatus.RENTED).length,
      totalValue: activeCars.reduce((acc, c) => acc + c.price, 0),
      totalCost: activeCars.reduce((acc, c) => acc + (c.costPrice || 0), 0),
      salesCount: cars.filter(c => c.isOutbound && c.status !== CarStatus.IN_TRANSFER).length,
      growth: 12.8, 
      availableTrend: '+2.4%',
      reservedTrend: '-1.2%',
      rentedTrend: '+5.7%'
    };
  }, [cars]);

  const welcomeMessage = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 4) return 'أهلاً بك في فترتك الليلية';
    if (hour < 12) return 'صباح الخير واليُمن';
    if (hour < 17) return 'طاب يومك بكل خير';
    return 'مساء الخير والبركة';
  }, []);

  const recentLogs = useMemo(() => logs.slice(0, 5), [logs]);

  const pieData = useMemo(() => [
    { name: 'متوفر للبيع', value: stats.available, color: '#06b6d4' }, // Cyan
    { name: 'محجوز مؤقتاً', value: stats.reserved, color: '#f59e0b' }, // Amber
    { name: 'مباع نهائياً', value: stats.sold, color: '#ef4444' }, // Red
    { name: 'تحت التجير', value: stats.rented, color: '#8b5cf6' }, // Violet
    { name: 'لم تصل إلى المعرض', value: stats.notArrived, color: '#a855f7' }, // Purple
    { name: 'مرتجع المعرض', value: stats.returned, color: '#f97316' }, // Orange
  ], [stats]);

  const brandData = useMemo(() => {
    const brandCounts: Record<string, number> = {};
    cars.forEach(car => {
      brandCounts[car.brand] = (brandCounts[car.brand] || 0) + 1;
    });
    return Object.entries(brandCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ar'))
      .slice(0, 5);
  }, [cars]);

  const togglePref = (key: keyof DashboardPreferences) => {
    onUpdatePrefs({ ...prefs, [key]: !prefs[key] });
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(prefs.widgetOrder || []);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    onUpdatePrefs({ ...prefs, widgetOrder: items });
  };

  // Define widgets and components
  const widgets = useMemo(() => [
    {
      id: 'quickActions',
      label: 'إجراءات سريعة واختصارات منسقة',
      visible: prefs.showQuickActions && hasPermission(Permission.VIEW_DASHBOARD),
      toggleKey: 'showQuickActions' as keyof DashboardPreferences,
      gridClass: 'xl:col-span-4 col-span-12',
      component: (
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800/80 shadow-sm transition-all h-full relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-slate-950 dark:text-white flex items-center gap-3">
                <span className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
                  <Zap size={20} fill="currentColor" />
                </span>
                اختصارات سريعة
              </h3>
              <span className="text-[10px] bg-slate-50 dark:bg-slate-800 text-slate-400 font-bold px-3 py-1 rounded-full uppercase tracking-wider">لوحة القيادة</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {hasPermission(Permission.VIEW_SALES) && (
                <QuickActionBtn 
                  icon={<ShoppingBag size={20}/>} 
                  label="المبيعات" 
                  onClick={() => navigate('/sales')} 
                  color="text-rose-600 dark:text-rose-400" 
                  bg="bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-950/40" 
                />
              )}
              {hasPermission(Permission.VIEW_REPORTS) && (
                <QuickActionBtn 
                  icon={<FileSpreadsheet size={20}/>} 
                  label="تصدير جرد" 
                  onClick={() => navigate('/reports')} 
                  color="text-emerald-600 dark:text-emerald-400" 
                  bg="bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-950/40" 
                />
              )}
              {hasPermission(Permission.MANAGE_BACKUP) && (
                <QuickActionBtn 
                  icon={<Database size={20}/>} 
                  label="قاعدة البيانات" 
                  onClick={() => navigate('/backup')} 
                  color="text-cyan-600 dark:text-cyan-400" 
                  bg="bg-cyan-50 dark:bg-cyan-950/20 hover:bg-cyan-100 dark:hover:bg-cyan-950/40" 
                />
              )}
              {hasPermission(Permission.MANAGE_SETTINGS) && (
                <QuickActionBtn 
                  icon={<Settings size={20}/>} 
                  label="النظام" 
                  onClick={() => navigate('/settings')} 
                  color="text-slate-600 dark:text-slate-400" 
                  bg="bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700" 
                />
              )}
            </div>
          </div>
          
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400 font-bold">
            <span className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-emerald-500" />
              صلاحيات المستخدم نشطة
            </span>
            <span className="text-[10px] text-slate-300 dark:text-slate-600">v{settings.systemVersion}</span>
          </div>
        </div>
      )
    },
    {
      id: 'marketTrends',
      label: 'تحليل القيمة السوقية التدريجي',
      visible: prefs.showMarketTrends && hasPermission(Permission.VIEW_FINANCIALS),
      toggleKey: 'showMarketTrends' as keyof DashboardPreferences,
      gridClass: 'xl:col-span-8 col-span-12',
      component: (
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800/80 shadow-sm transition-all h-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-950 dark:text-white flex items-center gap-3">
                <span className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
                  <TrendingUp size={20} />
                </span>
                تطور قيمة مخزون المعرض
              </h3>
              <p className="text-xs text-slate-400 font-bold">الرصد الهندسي والتراكمي لغلة وقيمة الأصول</p>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-xl">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse"></span>
              <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 tracking-wider">6 أشهر ماضية</span>
            </div>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[
                { name: 'يناير', value: stats.totalValue * 0.75 },
                { name: 'فبراير', value: stats.totalValue * 0.8 },
                { name: 'مارس', value: stats.totalValue * 0.88 },
                { name: 'أبريل', value: stats.totalValue * 0.94 },
                { name: 'مايو', value: stats.totalValue * 0.98 },
                { name: 'يونيو', value: stats.totalValue },
              ]}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:hidden" />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" className="hidden dark:block" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                <YAxis hide />
                <ReTooltip 
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                    background: '#0f172a',
                    color: '#fff',
                    fontFamily: 'Cairo'
                  }} 
                  formatter={(val: number) => [`${val.toLocaleString()} ${settings.currency}`, 'قيمة المقدرة']}
                />
                <Area type="monotone" dataKey="value" stroke="#06b6d4" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )
    },
    {
      id: 'inventoryStats',
      label: 'مستودع بطاقة إحصائيات المعرض',
      visible: prefs.showInventoryStats && hasPermission(Permission.VIEW_DASHBOARD),
      toggleKey: 'showInventoryStats' as keyof DashboardPreferences,
      gridClass: 'xl:col-span-12 col-span-12',
      component: (
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 md:p-10 border border-slate-100 dark:border-slate-800/80 shadow-md dark:shadow-none flex flex-col justify-between relative overflow-hidden group transition-all h-full">
          <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
          
          <div className="relative z-10 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-2xl md:text-3xl font-black text-slate-950 dark:text-white tracking-tighter">
                  حالة مستودع المركبات والمبيعات
                </h2>
                <p className="text-xs font-bold text-slate-400">تحليلات دقيقة لأعداد المركبات وتوزيع المبيعات والتجير الذكي</p>
              </div>
              <div className="flex items-center gap-3 bg-cyan-50 dark:bg-cyan-500/10 px-4 py-2 rounded-xl border border-cyan-100/40 dark:border-cyan-500/20">
                <ShieldCheck size={16} className="text-cyan-500" />
                <span className="text-[10px] font-black uppercase text-cyan-600 dark:text-cyan-400 tracking-wider">
                  حالة الاستقرار: {securityScore.toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-6">
              <MiniMetricItem 
                label="إجمالي المركبات" 
                value={stats.total} 
                icon={<CarFront size={20}/>} 
                color="text-blue-500 bg-blue-50 dark:bg-blue-950/30" 
                isActive={activeMetricCard === 'total'}
                onHover={() => setActiveMetricCard('total')}
                onLeave={() => setActiveMetricCard(null)}
                description="إجمالي الأسطول المسجل بالكامل"
                percentage={100}
                progressColor="bg-blue-500"
              />
              <MiniMetricItem 
                label="إجمالي المبيعات" 
                value={stats.salesCount} 
                icon={<ShoppingBag size={20}/>} 
                color="text-rose-500 bg-rose-50 dark:bg-rose-950/30" 
                isActive={activeMetricCard === 'sales'}
                onHover={() => setActiveMetricCard('sales')}
                onLeave={() => setActiveMetricCard(null)}
                description="المركبات المكتمل بيعها بالمعرض"
                percentage={stats.total > 0 ? (stats.salesCount / stats.total) * 100 : 0}
                progressColor="bg-rose-500"
              />
              <MiniMetricItem 
                label="متوفر للبيع" 
                value={stats.available} 
                icon={<PackageCheck size={20}/>} 
                color="text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" 
                trend={stats.availableTrend} 
                trendColor="text-emerald-500"
                isActive={activeMetricCard === 'avail'}
                onHover={() => setActiveMetricCard('avail')}
                onLeave={() => setActiveMetricCard(null)}
                description="سيارات معروضة بانتظار المشترين"
                percentage={stats.total > 0 ? (stats.available / stats.total) * 100 : 0}
                progressColor="bg-emerald-500"
              />
              <MiniMetricItem 
                label="محجوزة مؤقتاً" 
                value={stats.reserved} 
                icon={<AlertTriangle size={20}/>} 
                color="text-amber-500 bg-amber-50 dark:bg-amber-950/30" 
                trend={stats.reservedTrend} 
                trendColor="text-red-400"
                isActive={activeMetricCard === 'res'}
                onHover={() => setActiveMetricCard('res')}
                onLeave={() => setActiveMetricCard(null)}
                description="سيارات محجوزة لعملاء مؤقتاً"
                percentage={stats.total > 0 ? (stats.reserved / stats.total) * 100 : 0}
                progressColor="bg-amber-500"
              />
              <MiniMetricItem 
                label="بطاقات مجيرة" 
                value={stats.rented} 
                icon={<Zap size={20}/>} 
                color="text-purple-500 bg-purple-50 dark:bg-purple-950/30" 
                trend={stats.rentedTrend} 
                trendColor="text-purple-400"
                isActive={activeMetricCard === 'rent'}
                onHover={() => setActiveMetricCard('rent')}
                onLeave={() => setActiveMetricCard(null)}
                description="سيارات جرى تجير بطاقتها الجمركية للمشتري"
                percentage={stats.total > 0 ? (stats.rented / stats.total) * 100 : 0}
                progressColor="bg-purple-500"
              />
              <MiniMetricItem 
                label="لم تصل إلى المعرض" 
                value={stats.notArrived} 
                icon={<Clock size={20}/>} 
                color="text-purple-600 bg-purple-50 dark:bg-purple-950/20" 
                isActive={activeMetricCard === 'not_arr'}
                onHover={() => setActiveMetricCard('not_arr')}
                onLeave={() => setActiveMetricCard(null)}
                description="سيارات تحت الوصول قادمة للمخزون"
                percentage={stats.total > 0 ? (stats.notArrived / stats.total) * 100 : 0}
                progressColor="bg-purple-600"
              />
              <MiniMetricItem 
                label="مرتجعة للمعرض" 
                value={stats.returned} 
                icon={<RefreshCcw size={20}/>} 
                color="text-orange-500 bg-orange-50 dark:bg-orange-950/20" 
                isActive={activeMetricCard === 'ret_sh'}
                onHover={() => setActiveMetricCard('ret_sh')}
                onLeave={() => setActiveMetricCard(null)}
                description="سيارات تم ردها واستردادها للصالات"
                percentage={stats.total > 0 ? (stats.returned / stats.total) * 100 : 0}
                progressColor="bg-orange-500"
              />
            </div>
          </div>

          {prefs.showFinancialStats && hasPermission(Permission.VIEW_FINANCIALS) && (
            <div className="pt-8 mt-10 border-t border-slate-100 dark:border-slate-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex flex-wrap items-center gap-8 w-full md:w-auto">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">القيمة السوقية التقريبية للمخزون</span>
                  <p className="text-4xl font-extrabold text-slate-950 dark:text-white tracking-tighter">
                    {stats.totalValue.toLocaleString()} <span className="text-xs font-black text-blue-500">{settings.currency}</span>
                  </p>
                </div>
                
                <div className="h-10 w-[1px] bg-slate-100 dark:bg-slate-800 hidden md:block"></div>
                
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">رأس المال المستثمر الفعلي</span>
                  <p className="text-xl font-bold text-slate-400 dark:text-slate-500 tracking-tighter">
                    {stats.totalCost.toLocaleString()} <span className="text-xs">{settings.currency}</span>
                  </p>
                </div>
              </div>

              {hasPermission(Permission.MANAGE_INVENTORY) && (
                <button 
                  onClick={() => navigate('/inventory')} 
                  className="w-full md:w-auto px-6 py-4 bg-slate-950 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white rounded-2xl font-black shadow-lg shadow-blue-500/10 transition-all flex items-center justify-center gap-3 text-xs"
                >
                  <Plus size={18} />
                  إضافة سيارة جديدة للمخزن
                </button>
              )}
            </div>
          )}
        </div>
      )
    },
    {
      id: 'statusPie',
      label: 'كفاءة توزيع الحالات للمركبات',
      visible: prefs.showStatusPie && hasPermission(Permission.VIEW_DASHBOARD),
      toggleKey: 'showStatusPie' as keyof DashboardPreferences,
      gridClass: 'xl:col-span-4 col-span-12',
      component: (
        <div className="bg-slate-950 dark:bg-slate-900/40 rounded-[2.5rem] p-8 text-white border border-slate-900 dark:border-slate-800/80 shadow-sm relative overflow-hidden flex flex-col justify-between h-full group">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-600/15 via-transparent to-transparent pointer-events-none"></div>
          
          <div>
            <h3 className="text-lg font-black flex items-center gap-3 relative z-10">
              <span className="p-2 bg-white/10 rounded-xl text-cyan-400">
                <Activity size={18} />
              </span>
              كفاءة توزيع الحالات
            </h3>
            <p className="text-[11px] text-slate-455 font-medium pr-1 mt-1">نسبة وتناسب فئات المركبات داخل النظام</p>
          </div>
          
          <div className="h-[200px] w-full relative z-10 my-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={pieData} 
                  cx="50%" 
                  cy="50%" 
                  innerRadius={55} 
                  outerRadius={80} 
                  paddingAngle={6} 
                  dataKey="value" 
                  stroke="none"
                >
                  {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <ReTooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', background: '#0f172a', color: '#fff', padding: '12px', fontFamily: 'Cairo' }} 
                  itemStyle={{ fontWeight: '900', fontSize: '11px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <span className="text-[10px] text-slate-440 block font-bold">إجمالي الوحدات</span>
              <span className="text-2xl font-black text-white leading-none">{stats.total}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 relative z-10">
            {pieData.map(item => (
              <div key={item.name} className="flex items-center gap-2.5 bg-white/5 dark:bg-slate-900/60 p-2.5 rounded-xl border border-white/5">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }}></div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-bold text-slate-400 truncate">{item.name}</p>
                  <p className="text-xs font-black text-white">{item.value} مركبة</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    },
    {
      id: 'brandChart',
      label: 'معدل علامات المركبات الأعلى تمثيلاً',
      visible: prefs.showBrandChart && hasPermission(Permission.VIEW_DASHBOARD),
      toggleKey: 'showBrandChart' as keyof DashboardPreferences,
      gridClass: 'xl:col-span-5 col-span-12',
      component: (
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800/80 shadow-sm transition-all h-full">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-black text-slate-950 dark:text-white flex items-center gap-3">
              <span className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
                <BarChart3 size={18} />
              </span>
              أكثر 5 ماركات مبيعاً ومخزوناً
            </h3>
            <span className="text-[10px] font-black text-slate-400 bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-lg">التوزيع النسبي</span>
          </div>
          
          <div className="h-[280px] w-full overflow-y-auto pr-1 space-y-4">
            {brandData.map((item, index) => {
              const maxCount = Math.max(...brandData.map(d => d.count), 1);
              const percentage = (item.count / maxCount) * 100;
              
              // Premium colors matched beautifully for light & dark themes
              const colors = [
                { text: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-500', lightBg: 'bg-sky-500/10' },
                { text: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-500', lightBg: 'bg-indigo-500/10' },
                { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500', lightBg: 'bg-emerald-500/10' },
                { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500', lightBg: 'bg-amber-500/10' },
                { text: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500', lightBg: 'bg-rose-500/10' }
              ];
              const rankColor = colors[index % colors.length];

              return (
                <div key={item.name} className="group relative flex flex-col space-y-1.5 pb-2 border-b border-slate-50 dark:border-slate-800/40 last:border-b-0">
                  <div className="flex items-center justify-between text-right font-sans">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Rank index badge */}
                      <span className={`w-6 h-6 rounded-lg text-[11px] font-black flex items-center justify-center shrink-0 ${rankColor.lightBg} ${rankColor.text}`}>
                        {index + 1}
                      </span>
                      {/* Vehicle detail name, truncated for perfect aesthetics if too long with rich hover tooltip */}
                      <span className="text-xs font-black text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-200 truncate" title={item.name}>
                        {item.name}
                      </span>
                    </div>

                    {/* Vehicles count */}
                    <div className="flex items-center gap-1 shrink-0 ml-4">
                      <span className="text-xs font-bold text-slate-950 dark:text-white">
                        {item.count}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">مركبة</span>
                    </div>
                  </div>

                  {/* Horizontal visual progress bar */}
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800/80 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ease-out shadow-sm ${rankColor.bg}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {brandData.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-600">
                <p className="text-xs font-bold">لا يوجد مركبات مسجلة في المخزون حتى الآن</p>
              </div>
            )}
          </div>
        </div>
      )
    },
    {
      id: 'recentActivity',
      label: 'سجل عمليات ووقائع الرقابة والتحكم',
      visible: prefs.showRecentActivity && hasPermission(Permission.VIEW_DASHBOARD),
      toggleKey: 'showRecentActivity' as keyof DashboardPreferences,
      gridClass: prefs.showBrandChart ? 'xl:col-span-7 col-span-12' : 'xl:col-span-12 col-span-12',
      component: (
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800/80 shadow-sm transition-all flex flex-col h-full">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-black text-slate-950 dark:text-white flex items-center gap-3">
              <span className="p-2 bg-violet-500/10 text-violet-500 rounded-xl">
                <Clock size={18} />
              </span>
              سجل نشاطات وعمليات المعرض الأخيرة
            </h3>
            <button 
              onClick={() => navigate('/users')} 
              className="text-xs font-black text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:gap-2 transition-all"
            >
              عرض الجميع <ChevronLeft size={16} />
            </button>
          </div>

          <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar max-h-[280px] pl-2">
            {recentLogs.length > 0 ? recentLogs.map(log => (
              <div key={log.id} className="flex gap-4 group">
                <div className="relative flex flex-col items-center shrink-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 border border-slate-100 dark:border-slate-700/50 shadow-sm group-hover:bg-cyan-500 group-hover:text-white transition-all">
                    <ShieldCheck size={16} />
                  </div>
                  <div className="flex-1 w-[2px] bg-slate-100 dark:bg-slate-800 mt-2 mb-2"></div>
                </div>
                <div className="pb-3 flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-black text-slate-800 dark:text-white">{log.user}</span>
                      <span className={`text-[9px] px-2.5 py-0.5 rounded-md font-black uppercase ${
                        log.action.includes('حذف') || log.action.includes('إلغاء') 
                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-950/20' 
                          : 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 border border-cyan-100 dark:border-cyan-950/20'
                      }`}>
                        {log.action}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-350 dark:text-slate-500">
                      {new Date(log.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-450 dark:text-slate-400 leading-relaxed truncate">
                    {log.details}
                  </p>
                </div>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center h-full py-10 opacity-20">
                <Activity size={32} className="mb-2" />
                <p className="text-xs font-black text-slate-400">لا يوجد تعديلات مؤرشفة حالياً</p>
              </div>
            )}
          </div>
        </div>
      )
    }
  ], [prefs, securityScore, stats, navigate, pieData, brandData, recentLogs, settings]);

  // Handle widget orders dynamically
  const currentOrder = useMemo(() => {
    const order = prefs.widgetOrder || [];
    const widgetIds = widgets.map(w => w.id);
    const missingIds = widgetIds.filter(id => !order.includes(id));
    return [...order.filter(id => widgetIds.includes(id)), ...missingIds];
  }, [prefs.widgetOrder, widgets]);

  return (
    <div className="space-y-8 animate-in fade-in duration-505 pb-32 font-['Cairo'] text-right" dir="rtl">
      
      {/* 🔴 Top Premium Welcome Hero Banner */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden bg-slate-950 rounded-[3rem] p-8 md:p-12 text-white shadow-xl shadow-blue-900/10"
      >
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-600/15 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-indigo-600/10 blur-[100px] rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-3.5 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full flex items-center gap-2">
                <Sparkles size={13} className="text-cyan-400" />
                <span className="text-[9px] font-black uppercase tracking-widest text-cyan-300">نظام ذكي نشط</span>
              </span>
              <span className="px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center gap-2">
                <ShieldCheck size={13} className="text-emerald-400" />
                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-300">أمان عالي ومحمي</span>
              </span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">
              {welcomeMessage}، <span className="text-transparent bg-clip-text bg-gradient-to-l from-cyan-400 to-indigo-300">{currentUser?.username}</span>
            </h1>
            <p className="text-sm md:text-base text-slate-450 font-bold max-w-2xl leading-relaxed">
              أهلاً بك في منصة التحكم الشاملة. تتوفر حالياً <span className="text-white font-black">{stats.available} سيارة جاهزة للبيع</span> داخل المعرض، وسجلنا نجاحات متميزة هذا الأسبوع بزيادة تدفق بلغت <span className="text-emerald-400 font-extrabold">+{stats.growth}%</span>.
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3.5 self-start lg:self-center">
            {hasPermission(Permission.MANAGE_INVENTORY) && (
              <button 
                onClick={() => navigate('/inventory')} 
                className="px-6 py-4 bg-cyan-500 hover:bg-cyan-400 text-white rounded-2xl font-black shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2 text-xs group"
              >
                <Plus size={16} className="group-hover:rotate-90 transition-transform" />
                إضافة سيارة جديدة
              </button>
            )}
            {hasPermission(Permission.VIEW_REPORTS) && (
              <button 
                onClick={() => navigate('/reports')} 
                className="px-6 py-4 bg-white/10 hover:bg-white/15 backdrop-blur-md text-white border border-white/10 rounded-2xl font-black transition-all flex items-center gap-2 text-xs"
              >
                <BarChart3 size={16} />
                التحليلات والمبيعات
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* 🔮 Smart Search Engine Dashboard Section */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 md:p-8 border border-slate-100 dark:border-slate-800/80 shadow-md transition-all space-y-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-blue-500/5 blur-[80px] rounded-full pointer-events-none"></div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-xl font-black text-slate-950 dark:text-white flex items-center gap-3">
              <span className="p-2.5 bg-blue-500/10 text-blue-500 rounded-xl">
                <Search size={22} className="animate-pulse" />
              </span>
              مربع البحث الذكي للمخزون
            </h3>
            <p className="text-xs text-slate-400 font-bold">البحث بحسب الماركة، الموديل، رقم الهيكل، المورد أو حتى الملاحظات...</p>
          </div>
          
          {/* Search Status Toggle Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black text-slate-400 ml-1">تصفية بـ:</span>
            {[
              { id: 'all', label: 'الكل' },
              { id: 'available', label: 'متوفرة بالمخزن' },
              { id: 'reserved', label: 'محجوزة لعملاء' },
              { id: 'sold', label: 'مباعة نهائياً' },
              { id: 'rented', label: 'سيارات مجيرة' }
            ].map(pill => (
              <button
                key={pill.id}
                onClick={() => setSearchFilter(pill.id as any)}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                  searchFilter === pill.id
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search Field & Tags */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative group flex-1">
              <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
              
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 transition-colors p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X size={16} />
                </button>
              )}

              <input 
                type="text"
                placeholder="اكتب للبحث الفوري عن أي سيارة في المستودع..."
                className="w-full pr-16 pl-14 py-5 bg-slate-50 dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-800 rounded-3xl outline-none focus:ring-[10px] focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-500 dark:focus:border-blue-500 transition-all font-bold text-base dark:text-white"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Advanced Search Toggle Button */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`px-6 py-5 rounded-3xl font-black text-sm flex items-center justify-center gap-2.5 transition-all shrink-0 ${
                showAdvanced 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                  : 'bg-slate-100 dark:bg-slate-850 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <SlidersHorizontal size={18} className={showAdvanced ? 'rotate-180 text-white' : 'text-slate-450 dark:text-slate-400'} />
              <span>{lang === 'ar' ? 'البحث المتقدم' : 'Advanced Search'}</span>
            </button>
          </div>

          {/* Sugguested Tags */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5 shrink-0 font-['Cairo']">
                <Sparkles size={11} className="text-amber-500 animate-bounce" />
                اختبارات سريعة واقتراحات:
              </span>
              {popularTags.slice(0, 8).map(tag => (
                <button
                  key={tag}
                  onClick={() => setSearchQuery(tag)}
                  className="px-3 py-1 bg-slate-50 dark:bg-slate-850 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg border border-slate-100 dark:border-slate-800/60 transition-all shadow-sm"
                >
                  #{tag}
                </button>
              ))}
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-[10px] font-black text-rose-500 hover:underline"
                >
                  مسح البحث
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Beautiful Animated Advanced Search Interactive Form Panel */}
        {showAdvanced && (
          <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-3xl border border-slate-100 dark:border-slate-850 animate-in slide-in-from-top-4 duration-300 space-y-5 text-right relative z-30 shadow-inner">
            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="text-blue-500 animate-pulse" size={18} />
                <span className="text-xs font-black text-slate-850 dark:text-white">
                  {lang === 'ar' ? 'معايير التصفية التراكمية الفورية' : 'Advanced Multi-Criteria Cumulative Filters'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAdvBrand('');
                  setAdvModel('');
                  setAdvColor('');
                  setAdvYear('');
                  setAdvStatus('all');
                  setAdvMinPrice('');
                  setAdvMaxPrice('');
                }}
                className="text-xs font-black text-rose-500 hover:text-rose-600 transition-colors"
              >
                {lang === 'ar' ? 'إعادة ضبط المعايير ↺' : 'Reset Filters ↺'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Brand Selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-450 block">
                  {lang === 'ar' ? 'العلامة التجارية (الماركة)' : 'Brand / Make'}
                </label>
                <select
                  value={advBrand}
                  onChange={e => setAdvBrand(e.target.value)}
                  className="w-full text-xs font-bold px-3.5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white transition-all appearance-none"
                >
                  <option value="">{lang === 'ar' ? 'كل الماركات' : 'All Brands'}</option>
                  {uniqueBrands.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              {/* Model Input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-450 block">
                  {lang === 'ar' ? 'موديل السيارة' : 'Model'}
                </label>
                <input
                  type="text"
                  placeholder={lang === 'ar' ? 'مثال: كامري، كورولا...' : 'e.g. Camry, Accent...'}
                  value={advModel}
                  onChange={e => setAdvModel(e.target.value)}
                  className="w-full text-xs font-bold px-3.5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Color Selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-450 block">
                  {lang === 'ar' ? 'اللون الخارجي' : 'Exterior Color'}
                </label>
                <select
                  value={advColor}
                  onChange={e => setAdvColor(e.target.value)}
                  className="w-full text-xs font-bold px-3.5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white transition-all appearance-none"
                >
                  <option value="">{lang === 'ar' ? 'كل الألوان' : 'All Colors'}</option>
                  {uniqueColors.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Year Selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-450 block">
                  {lang === 'ar' ? 'سنة الصنع (الموديل)' : 'Year'}
                </label>
                <select
                  value={advYear}
                  onChange={e => setAdvYear(e.target.value)}
                  className="w-full text-xs font-bold px-3.5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white transition-all appearance-none"
                >
                  <option value="">{lang === 'ar' ? 'كل السنوات' : 'All Years'}</option>
                  {uniqueYears.map(y => (
                    <option key={y} value={y.toString()}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Multiselect / Filter status buttons */}
              <div className="space-y-1.5 col-span-1 md:col-span-2">
                <label className="text-[11px] font-black text-slate-450 block font-['Cairo']">
                  {lang === 'ar' ? 'الحالة في المعرض' : 'Showroom stock status'}
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { id: 'all', label: lang === 'ar' ? 'الكل' : 'All' },
                    { id: 'available', label: lang === 'ar' ? 'متوفر' : 'Available' },
                    { id: 'reserved', label: lang === 'ar' ? 'محجوز' : 'Reserved' },
                    { id: 'sold', label: lang === 'ar' ? 'مباع' : 'Sold' },
                    { id: 'rented', label: lang === 'ar' ? 'مجير' : 'Endorsed' }
                  ].map(st => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setAdvStatus(st.id as any)}
                      className={`py-2.5 text-[10px] font-black rounded-lg border transition-all ${
                        advStatus === st.id
                          ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                          : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price bracket range */}
              <div className="space-y-1.5 col-span-1 md:col-span-2">
                <label className="text-[11px] font-black text-slate-450 block">
                  {lang === 'ar' ? 'نطاق السعر المقدر بالريال السعودي (من - إلى)' : 'Price Bracket SAR (Min - Max)'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder={lang === 'ar' ? 'الحد الأدنى' : 'Min Price'}
                    value={advMinPrice}
                    onChange={e => setAdvMinPrice(e.target.value)}
                    className="w-1/2 text-xs font-bold px-3.5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white transition-all"
                  />
                  <span className="text-slate-450 text-xs font-bold leading-none">←</span>
                  <input
                    type="number"
                    placeholder={lang === 'ar' ? 'الحد الأقصى' : 'Max Price'}
                    value={advMaxPrice}
                    onChange={e => setAdvMaxPrice(e.target.value)}
                    className="w-1/2 text-xs font-bold px-3.5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Active filters indicators bar */}
            {(advBrand || advModel || advColor || advYear || advStatus !== 'all' || advMinPrice || advMaxPrice) && (
              <div className="flex flex-wrap items-center gap-2 bg-blue-50/30 dark:bg-blue-950/10 p-3 rounded-2xl border border-blue-100/50 dark:border-blue-900/20">
                <span className="text-[10px] font-black text-blue-500 ml-1">
                  {lang === 'ar' ? 'المعايير المدمجة الفعالة حالياً:' : 'Active Combined Query Parameters:'}
                </span>
                
                {advBrand && (
                  <span className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[9px] font-black text-slate-700 dark:text-slate-300 rounded-lg flex items-center gap-1.5">
                    {lang === 'ar' ? `الماركة: ${advBrand}` : `Brand: ${advBrand}`}
                    <button type="button" onClick={() => setAdvBrand('')} className="text-rose-500 font-sans hover:text-rose-600">×</button>
                  </span>
                )}
                
                {advModel && (
                  <span className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[9px] font-black text-slate-700 dark:text-slate-300 rounded-lg flex items-center gap-1.5">
                    {lang === 'ar' ? `الطراز: ${advModel}` : `Model: ${advModel}`}
                    <button type="button" onClick={() => setAdvModel('')} className="text-rose-500 font-sans hover:text-rose-600">×</button>
                  </span>
                )}

                {advColor && (
                  <span className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[9px] font-black text-slate-700 dark:text-slate-300 rounded-lg flex items-center gap-1.5">
                    {lang === 'ar' ? `اللون: ${advColor}` : `Color: ${advColor}`}
                    <button type="button" onClick={() => setAdvColor('')} className="text-rose-500 font-sans hover:text-rose-600">×</button>
                  </span>
                )}

                {advYear && (
                  <span className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[9px] font-black text-slate-700 dark:text-slate-300 rounded-lg flex items-center gap-1.5">
                    {lang === 'ar' ? `الموديل: ${advYear}` : `Year: ${advYear}`}
                    <button type="button" onClick={() => setAdvYear('')} className="text-rose-500 font-sans hover:text-rose-600">×</button>
                  </span>
                )}

                {advStatus !== 'all' && (
                  <span className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[9px] font-black text-slate-700 dark:text-slate-300 rounded-lg flex items-center gap-1.5">
                    {lang === 'ar' ? `الحالة: ${advStatus}` : `Status: ${advStatus}`}
                    <button type="button" onClick={() => setAdvStatus('all')} className="text-rose-500 font-sans hover:text-rose-600">×</button>
                  </span>
                )}

                {(advMinPrice || advMaxPrice) && (
                  <span className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[9px] font-black text-slate-700 dark:text-slate-300 rounded-lg flex items-center gap-1.5">
                    {lang === 'ar' 
                      ? `السعر: ${advMinPrice || '0'} - ${advMaxPrice || 'بدون حد كسر'}`
                      : `Price: ${advMinPrice || '0'} - ${advMaxPrice || 'unlimited'}`}
                    <button type="button" onClick={() => { setAdvMinPrice(''); setAdvMaxPrice(''); }} className="text-rose-500 font-sans hover:text-rose-600">×</button>
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Real-time dropdown search results */}
        {(searchQuery.trim() || searchFilter !== 'all' || showAdvanced) && (
          <div className="pt-2 animate-in fade-in duration-300">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 text-xs font-black text-slate-400">
              <span>نتائج البحث الفوري والمنسق ({searchedCars.length})</span>
              {(searchQuery.trim() || showAdvanced) && (
                <button 
                  onClick={() => {
                    navigate('/inventory');
                  }} 
                  className="text-blue-600 hover:underline flex items-center gap-1"
                >
                  الذهاب لصفحة المخزن بالتصفية الفعالة
                  <ArrowUpRight size={14} />
                </button>
              )}
            </div>

            {searchedCars.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
                {searchedCars.map(car => {
                  const isAvailable = car.status === CarStatus.AVAILABLE;
                  const isReserved = car.status === CarStatus.RESERVED;
                  const isSold = car.status === CarStatus.SOLD;
                  const isRented = car.rentalStatus === RentalStatus.RENTED;

                  return (
                    <div 
                      key={car.id} 
                      className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group/item hover:bg-slate-50/40 dark:hover:bg-slate-900/30 px-3 -mx-3 rounded-2xl transition-all"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        {/* Status Icon Indicator */}
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm border ${
                          isAvailable ? 'bg-cyan-50 text-cyan-600 border-cyan-100 dark:bg-cyan-950/20 dark:text-cyan-400 dark:border-cyan-950/40' :
                          isReserved ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-950/40' :
                          isSold ? 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-950/40' :
                          'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-950/40'
                        }`}>
                          <CarFront size={18} />
                        </div>

                        <div className="min-w-0 space-y-1.5 text-right">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-black text-sm text-slate-850 dark:text-white leading-tight">
                              {car.brand} {car.model}
                            </span>
                            <span className="text-[10px] font-black bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-slate-500">
                              {car.year}
                            </span>
                            <span className="text-[10px] font-black bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-md text-slate-400 border-r-4 border-slate-300 pl-1.5 pr-0.5">
                              اللون: {car.color}
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400 font-bold">
                            <span className="font-mono">VIN: {car.vin}</span>
                            {car.cardNumber && <span>البطاقة: {car.cardNumber}</span>}
                            {car.supplier && <span className="opacity-80">المورد: {car.supplier}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Side Price and Action */}
                      <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0">
                        <div className="text-right sm:text-left space-y-1">
                          <div className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                            {car.price.toLocaleString()} <span className="text-xs text-blue-500 font-bold">{settings.currency}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Standard Status Badges */}
                            <span className={`text-[9px] px-2.5 py-0.5 rounded-md font-black uppercase ${
                              isAvailable ? 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 border border-cyan-100 dark:border-cyan-950/20' :
                              isReserved ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-950/20' :
                              'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-950/20'
                            }`}>
                              {car.status}
                            </span>
                            
                            {/* Rental / Commission Badges */}
                            <span className={`text-[9px] px-2.5 py-0.5 rounded-md font-black uppercase ${
                              isRented 
                                ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-950/20' 
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-100 dark:border-slate-800/80'
                            }`}>
                              {car.rentalStatus}
                            </span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedCarForDetail(car)}
                            className="p-2.5 bg-slate-50 hover:bg-blue-600 hover:text-white dark:bg-slate-800 dark:hover:bg-blue-600 text-slate-500 dark:text-slate-350 rounded-xl transition-all shadow-sm border border-slate-150 dark:border-slate-700/80"
                            title="معاينة سريعة"
                          >
                            <Eye size={15} />
                          </button>
                          {hasPermission(Permission.MANAGE_INVENTORY) && (
                            <button
                              onClick={() => {
                                navigate('/inventory');
                              }}
                              className="p-2.5 bg-slate-50 hover:bg-slate-900 hover:text-white dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-all border border-slate-150 dark:border-slate-700/80"
                              title="تعديل في صفحة المخزن"
                            >
                              <ArrowUpRight size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 space-y-2">
                <p className="text-sm font-black">لم يتم العثور على نتائج تطابق المربع الحالي. يرجى تعديل معيار البحث.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Customize Panel control bar */}
      <div className="flex items-center justify-between mb-4">
        <button 
          onClick={() => setShowConfig(!showConfig)}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs transition-all border ${
            showConfig 
              ? 'bg-cyan-500 hover:bg-cyan-600 text-white border-cyan-500 shadow-md shadow-cyan-500/10' 
              : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'
          }`}
        >
          <SlidersHorizontal size={14} />
          تعديل وبناء الواجهة الرئيسية (بنتو)
        </button>
      </div>

      {/* Animation panel configuration */}
      <AnimatePresence>
        {showConfig && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">حدد العناصر والعناصر المرئية</span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                {widgets.map(w => (
                  <ConfigToggle 
                    key={w.id} 
                    label={w.label} 
                    active={w.visible} 
                    onClick={() => togglePref(w.toggleKey)} 
                  />
                ))}
                <ConfigToggle 
                  label="تفاصيل الأداء المالي التراكمي" 
                  active={prefs.showFinancialStats} 
                  onClick={() => togglePref('showFinancialStats')} 
                />
              </div>
              <p className="text-[10px] text-slate-400 font-bold text-center pt-2">
                * ملاحظة: يمكنك النقر مع السحب على مؤشر السحب الجانبي لكل بطاقة لإعادة ترتيب المربعات تنازليًا.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 🔴 Drag & Drop Bento widgets Grid */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="dashboard-widgets" direction="vertical">
          {(provided) => (
            <div 
              {...provided.droppableProps} 
              ref={provided.innerRef}
              className="grid grid-cols-1 xl:grid-cols-12 gap-6"
            >
              {currentOrder.map((widgetId, index) => {
                const widget = widgets.find(w => w.id === widgetId);
                if (!widget || !widget.visible) return null;

                return (
                  <Draggable key={widget.id} draggableId={widget.id} index={index}>
                    {(provided, snapshot) => (
                      <motion.div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        layout
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4, delay: index * 0.05 }}
                        className={`${widget.gridClass} relative group/widget ${snapshot.isDragging ? 'z-50 shadow-2xl scale-[1.01]' : ''}`}
                      >
                        {/* Drag and Drop Handle visible in group hovering */}
                        <div 
                          {...provided.dragHandleProps}
                          className="absolute top-4 left-4 z-20 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg opacity-0 group-hover/widget:opacity-100 transition-opacity cursor-grab active:cursor-grabbing border border-slate-200 dark:border-slate-700 shadow-sm"
                          title="اسحب هنا لتغيير الارتفاع والترتيب"
                        >
                          <SlidersHorizontal size={12} className="text-slate-400" />
                        </div>
                        
                        <div className="h-full">
                          {widget.component}
                        </div>
                      </motion.div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* 🔴 Detailed Car Quick View Modal */}
      <AnimatePresence>
        {selectedCarForDetail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setSelectedCarForDetail(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-4xl shadow-2xl p-6 md:p-10 border border-slate-100 dark:border-slate-800 text-right space-y-8 relative overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Abs decoration */}
              <div className="absolute top-0 left-0 w-48 h-48 bg-blue-500/5 blur-[80px] rounded-full pointer-events-none"></div>

              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-5">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl md:text-3xl font-black text-slate-950 dark:text-white">
                      {selectedCarForDetail.brand} {selectedCarForDetail.model}
                    </h2>
                    <span className="px-3.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350 rounded-xl text-xs font-black">
                      {selectedCarForDetail.year}
                    </span>
                    <span className="px-3 py-1 bg-slate-50 dark:bg-slate-800 text-slate-500 rounded-xl text-[11px] font-bold">
                      {selectedCarForDetail.color}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-bold">معاينة سجل ومستندات السيارة التفصيلية بنظام مخزوني برو الآمن</p>
                </div>
                
                <button
                  onClick={() => setSelectedCarForDetail(null)}
                  className="p-2.5 bg-slate-50 hover:bg-rose-50 hover:text-rose-650 dark:bg-slate-800 dark:hover:bg-rose-950/40 dark:hover:text-rose-450 text-slate-400 rounded-xl transition-all border border-slate-150 dark:border-slate-700/80"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Information Grid Container */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {/* Block 1: Specs */}
                <div className="space-y-5 bg-slate-50/50 dark:bg-slate-950/30 p-6 rounded-3xl border border-slate-100/60 dark:border-slate-800/60 text-right">
                  <h4 className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800/80 pb-2">سجل المركبة الفني والبيانات المعتمدة</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-450 font-black">الماركة</span>
                      <span className="text-slate-800 dark:text-white font-extrabold">{selectedCarForDetail.brand}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-455 font-black">الطراز</span>
                      <span className="text-slate-800 dark:text-white font-extrabold">{selectedCarForDetail.model}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-455 font-black">الموديل (سنة الصنع)</span>
                      <span className="text-slate-800 dark:text-white font-extrabold">{selectedCarForDetail.year}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-455 font-black">اللون الخارجي</span>
                      <span className="text-slate-800 dark:text-white font-extrabold">{selectedCarForDetail.color}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-455 font-black text-right pr-1">رقم الهيكل (VIN)</span>
                      <span className="text-slate-800 dark:text-white font-mono font-bold text-left">{selectedCarForDetail.vin}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-455 font-black">رقم البطاقة / اللوحة</span>
                      <span className="text-slate-800 dark:text-white font-extrabold">{selectedCarForDetail.cardNumber || 'غير متوفر'}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-455 font-black">تاريخ الدخول</span>
                      <span className="text-slate-800 dark:text-white font-bold">{selectedCarForDetail.entryDate}</span>
                    </div>
                  </div>
                </div>

                {/* Block 2: Financial Valuation & Status */}
                <div className="space-y-5 bg-slate-50/50 dark:bg-slate-950/30 p-6 rounded-3xl border border-slate-100/60 dark:border-slate-800/60 text-right">
                  <h4 className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800/80 pb-2">سعر وتكاليف الأصل</h4>
                  <div className="space-y-3.5 text-sm">
                    <div className="space-y-1">
                      <span className="text-slate-450 text-xs font-bold block">سعر إعادة البيع المقترح</span>
                      <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                        {selectedCarForDetail.price.toLocaleString()} <span className="text-xs font-bold">{settings.currency}</span>
                      </p>
                    </div>

                    {(hasPermission(Permission.VIEW_FINANCIALS) || isAdmin) && (
                      <>
                        <div className="space-y-1 pt-1">
                          <span className="text-slate-450 text-xs font-bold block">سعر التكلفة والشراء</span>
                          <p className="text-lg font-black text-slate-500">
                            {selectedCarForDetail.costPrice.toLocaleString()} <span className="text-xs font-bold">{settings.currency}</span>
                          </p>
                        </div>
                        <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-slate-450 text-xs font-bold block">صافي هامش الربح المتوقع</span>
                          <p className="text-lg font-black text-blue-500">
                            {(selectedCarForDetail.price - selectedCarForDetail.costPrice).toLocaleString()} <span className="text-xs font-bold">{settings.currency}</span>
                          </p>
                        </div>
                      </>
                    )}

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-black">حالة رصد المعرض</span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                          selectedCarForDetail.status === CarStatus.AVAILABLE ? 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 border border-cyan-100 dark:border-cyan-950/20' :
                          selectedCarForDetail.status === CarStatus.RESERVED ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-950/20' :
                          selectedCarForDetail.status === CarStatus.NOT_FOR_SALE ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-950/30' :
                          'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-950/20'
                        }`}>
                          {selectedCarForDetail.status}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-black">حالة التفويض التجاري</span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                          selectedCarForDetail.rentalStatus === RentalStatus.RENTED 
                            ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-950/20' 
                            : 'bg-slate-105 dark:bg-slate-800 text-slate-400 border border-slate-100 dark:border-slate-800/80'
                        }`}>
                          {selectedCarForDetail.rentalStatus}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Block 3: Acquisition & Notes */}
                <div className="space-y-5 bg-slate-50/50 dark:bg-slate-950/30 p-6 rounded-3xl border border-slate-100/60 dark:border-slate-800/60 text-right">
                  <h4 className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800/80 pb-2">طبيعة الاستحواذ والمالك</h4>
                  <div className="space-y-3.5 text-sm">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-440 font-black">طبيعة الاستحواذ</span>
                      <span className="text-slate-800 dark:text-white font-extrabold">{selectedCarForDetail.ownershipType}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-440 font-black">المورد الأصلي</span>
                      <span className="text-slate-800 dark:text-white font-extrabold">{selectedCarForDetail.supplier || 'غير متوفر'}</span>
                    </div>
                    
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1">
                      <span className="text-slate-400 font-black text-xs block">معلومات إضافية وملاحظات الصيانة</span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed max-h-32 overflow-y-auto custom-scrollbar">
                        {selectedCarForDetail.notes || 'لم تضف ملاحظات إدارية أو فنية معينة بصدد هذه السيارة.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Block 4: Exit details (if outbound or sold) */}
              {selectedCarForDetail.isOutbound && selectedCarForDetail.exitData && (
                <div className="bg-rose-500/[0.02] border border-rose-500/10 p-6 md:p-8 rounded-3xl space-y-4 text-right">
                  <h4 className="text-sm font-black text-rose-500 flex items-center gap-2 border-b border-rose-500/5 pb-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                    تفاصيل الخروج والبيع بالتفصيل
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 text-xs">
                    <div className="space-y-1 text-right">
                      <span className="text-slate-440 font-black block">المشتري / المستلم الحالي</span>
                      <span className="font-extrabold text-slate-900 dark:text-white text-sm">{selectedCarForDetail.exitData.receiverName}</span>
                    </div>
                    <div className="space-y-1 text-right font-mono">
                      <span className="text-slate-440 font-black block font-['Cairo']">رقم الجوال الخاص بالمستلم</span>
                      <span className="text-slate-900 dark:text-white text-sm">{selectedCarForDetail.exitData.receiverPhone}</span>
                    </div>
                    <div className="space-y-1 text-right font-mono">
                      <span className="text-slate-440 font-black block font-['Cairo']">رقم هوية أو إقامة المستلم</span>
                      <span className="text-slate-900 dark:text-white text-sm">{selectedCarForDetail.exitData.receiverId}</span>
                    </div>
                    <div className="space-y-1 text-right">
                      <span className="text-slate-440 font-black block">طريقة وتاريخ التسلّم</span>
                      <span className="font-bold text-slate-500 block text-sm">
                        {selectedCarForDetail.exitData.deliveryType} | {selectedCarForDetail.exitData.exitDate}
                      </span>
                    </div>
                    {selectedCarForDetail.exitData.seller && (
                      <div className="space-y-1 text-right">
                        <span className="text-slate-440 font-black block">البائع المسؤول الحالي</span>
                        <span className="font-extrabold text-blue-500 text-sm">{selectedCarForDetail.exitData.seller}</span>
                      </div>
                    )}
                    {selectedCarForDetail.exitData.notes && (
                      <div className="space-y-1 text-right sm:col-span-3">
                        <span className="text-slate-440 font-black block">ملاحظات تسوية الخروج</span>
                        <p className="text-slate-500 leading-normal">{selectedCarForDetail.exitData.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Modal Footer Controls */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800 pt-6">
                <span className="text-[10px] text-slate-400 font-bold font-mono">المعرف الرقمي للمركبة: {selectedCarForDetail.id}</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedCarForDetail(null)}
                    className="px-6 py-3.5 bg-slate-105 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-xs transition-all"
                  >
                    الرجوع للوحة القيادة
                  </button>
                  {hasPermission(Permission.MANAGE_INVENTORY) && (
                    <button
                      onClick={() => {
                        setSelectedCarForDetail(null);
                        navigate('/inventory');
                      }}
                      className="px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs shadow-lg shadow-blue-500/15 transition-all flex items-center gap-2"
                    >
                      تعديل بيانات السيارة
                      <ArrowUpRight size={14} />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Subcomponent: MiniMetricItem
interface MetricItemProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  trend?: string;
  trendColor?: string;
  isActive: boolean;
  onHover: () => void;
  onLeave: () => void;
  description?: string;
  percentage?: number;
  progressColor?: string;
}

const MiniMetricItem: React.FC<MetricItemProps> = ({ 
  label, 
  value, 
  icon, 
  color, 
  trend, 
  trendColor, 
  isActive, 
  onHover, 
  onLeave,
  description,
  percentage,
  progressColor = 'bg-blue-500'
}) => {
  return (
    <div 
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={`p-6 rounded-[2rem] border transition-all duration-300 relative overflow-hidden group flex flex-col justify-between h-full bg-slate-50/50 dark:bg-slate-900/30 border-slate-100/80 dark:border-slate-800/50 ${
        isActive 
          ? 'scale-[1.03] border-cyan-400/50 dark:border-cyan-500/50 bg-cyan-500/[0.02] dark:bg-cyan-500/[0.04] shadow-lg shadow-cyan-500/[0.05]' 
          : 'hover:bg-white dark:hover:bg-slate-800/80 hover:shadow-md hover:border-slate-200 dark:hover:border-slate-700/60'
      }`}
    >
      <div className={`absolute -right-3 -bottom-3 w-16 h-16 rounded-full opacity-5 blur-xl ${progressColor} group-hover:scale-150 transition-transform duration-700`} />

      <div>
        <div className="flex items-start justify-between gap-2 mb-5">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border border-slate-100 dark:border-slate-800 transition-all duration-500 ${color} ${isActive ? 'scale-110 rotate-[5deg] shadow-md' : 'group-hover:rotate-[3deg]'}`}>
            {icon}
          </div>
          {trend && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-black text-[10px] ${trendColor} bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 shadow-sm`}>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
              <span>{trend}</span>
            </div>
          )}
        </div>
        
        <div className="space-y-1">
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500 block">
            {label}
          </span>
          <p className="text-3xl md:text-4xl font-black text-slate-950 dark:text-white tracking-tight leading-none">
            {value}
          </p>
          {description && (
            <p className="text-[10px] text-slate-400 dark:text-slate-550 leading-normal pt-1.5">
              {description}
            </p>
          )}
        </div>
      </div>

      {percentage !== undefined && (
        <div className="mt-5 space-y-1.5 relative z-10 pt-1">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500">
            <span>نسبة من المخزون</span>
            <span>{Math.round(percentage)}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className={`h-full rounded-full ${progressColor}`}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Subcomponent: ConfigToggle
const ConfigToggle: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-right transition-all font-black text-[10px] uppercase tracking-wider ${
      active 
        ? 'bg-cyan-50/70 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-500/30 text-cyan-600 dark:text-cyan-400 font-extrabold' 
        : 'bg-white dark:bg-slate-950 border-slate-100 dark:border-slate-800 text-slate-400 hover:text-slate-600'
    }`}
  >
    <span className="truncate">{label}</span>
    {active ? <Eye size={12} className="shrink-0" /> : <EyeOff size={11} className="shrink-0" />}
  </button>
);

// Subcomponent: QuickActionBtn
interface QuickActionProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  color: string;
  bg: string;
}

const QuickActionBtn: React.FC<QuickActionProps> = ({ icon, label, onClick, color, bg }) => (
  <button 
    onClick={onClick} 
    className={`flex items-center gap-3.5 p-4 rounded-2xl transition-all hover:scale-[1.02] active:scale-95 border border-transparent hover:border-slate-200 dark:hover:border-slate-800 w-full ${bg}`}
  >
    <div className={`p-2.5 rounded-xl shrink-0 ${color} bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800`}>
      {icon}
    </div>
    <span className="text-xs font-black text-slate-700 dark:text-slate-200 tracking-tight">{label}</span>
  </button>
);

export default Dashboard;
