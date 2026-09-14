import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Car, CheckCircle2, Search, Filter, Bookmark, Check,
  AlertCircle, ShieldCheck, RefreshCw, Send, Sparkles, BookOpen, UserCheck, X,
  Home, LayoutDashboard, Paperclip, FileUp, LayoutGrid, Table as TableIcon,
  DollarSign, FileSpreadsheet, Eye, FileText, Tag, Layers, Building2, Warehouse,
  CreditCard, ChevronRight, CheckCircle, Info, Shield
} from 'lucide-react';
import { Car as CarType, CarStatus, User, UserRole, OrganizationSettings, RentalStatus, OwnershipType, formatVehicleDisplay } from '../types';
import { getUnifiedSearchResults } from '../src/utils/searchEngine';

interface DelegateShowroomProps {
  cars: CarType[];
  onUpdateCar: (car: CarType) => void;
  currentUser: User | null;
  settings?: OrganizationSettings;
  addLog: (action: string, targetId: string, targetType: any, details: string) => void;
  isRtl: boolean;
}

export const DelegateShowroom: React.FC<DelegateShowroomProps> = ({
  cars,
  onUpdateCar,
  currentUser,
  settings,
  addLog,
  isRtl
}) => {
  const navigate = useNavigate();
  const currency = settings?.currency || 'ر.س';

  // Search/Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('الكل');
  const [selectedStatus, setSelectedStatus] = useState('الكل');
  const [selectedDocFilter, setSelectedDocFilter] = useState<'all' | 'has_doc' | 'no_doc'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Reservation Form State
  const [reservationCar, setReservationCar] = useState<CarType | null>(null);
  const [selectedCarDetails, setSelectedCarDetails] = useState<CarType | null>(null);
  const [delegateName, setDelegateName] = useState(currentUser?.username || '');
  const [delegatePhone, setDelegatePhone] = useState('');
  const [notes, setNotes] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successInfo, setSuccessInfo] = useState('');

  // Extract unique brands for filtering
  const brands = useMemo(() => {
    return ['الكل', ...Array.from(new Set(cars.map(c => c.brand).filter(Boolean))).sort()];
  }, [cars]);

  // Filtering Logic
  const filteredCars = useMemo(() => {
    let candidates = searchQuery.trim().length > 0 ? getUnifiedSearchResults(cars, searchQuery) : cars;

    let matched = candidates.filter(car => {
      // Exclude sold or outbound cars from Showroom immediately
      if (car.isOutbound || (car.status as string) === CarStatus.SOLD || (car.status as string) === 'مباعة' || (car.status as string) === 'مباع') {
        return false;
      }
      const matchesBrand = selectedBrand === 'الكل' || car.brand === selectedBrand;
      const matchesStatus = selectedStatus === 'الكل' || car.status === selectedStatus;

      // Filter by attached financial paper / customs card document
      if (selectedDocFilter === 'has_doc' && !car.cardFile && !car.cardNumber) return false;
      if (selectedDocFilter === 'no_doc' && (car.cardFile || car.cardNumber)) return false;

      return matchesBrand && matchesStatus;
    });

    return matched;
  }, [cars, searchQuery, selectedBrand, selectedStatus, selectedDocFilter]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const activeShowroomCars = cars.filter(c => !c.isOutbound && (c.status as string) !== CarStatus.SOLD && (c.status as string) !== 'مباعة');
    const available = activeShowroomCars.filter(c => (c.status as string) === CarStatus.AVAILABLE || (c.status as string) === 'متوفرة').length;
    const reserved = activeShowroomCars.filter(c => (c.status as string) === CarStatus.RESERVED || (c.status as string) === 'محجوزة').length;
    const withCustomsDoc = activeShowroomCars.filter(c => Boolean(c.cardFile || c.cardNumber)).length;
    const totalValue = activeShowroomCars.reduce((sum, c) => sum + (Number(c.price) || 0), 0);

    return {
      total: activeShowroomCars.length,
      available,
      reserved,
      withCustomsDoc,
      totalValue
    };
  }, [cars]);

  const handleOpenReserveModal = (car: CarType) => {
    setReservationCar(car);
    setDelegateName(currentUser?.username || localStorage.getItem('last_delegate_name') || '');
  };

  const handleCloseReserveModal = () => {
    setReservationCar(null);
    setDelegatePhone('');
    setNotes('');
  };

  const handleConfirmReservation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reservationCar) return;

    if (!delegateName.trim()) {
      alert(isRtl ? 'الرجاء كتابة اسم المندوب لحفظ الحجز' : 'Please specify Delegate Name to secure booking');
      return;
    }

    // Update car status to RESERVED
    const updatedCar: CarType = {
      ...reservationCar,
      status: CarStatus.RESERVED,
      reservedByUserId: delegateName,
      lastModified: new Date().toISOString(),
      notes: notes ? `${notes} (حجز بواسطة المندوب: ${delegateName})` : `محجوزة للمندوب: ${delegateName}`,
      history: [
        ...(reservationCar.history || []),
        {
          id: 'hist-' + Date.now(),
          action: `حجز سيارة بواسطة المندوب: ${delegateName}`,
          timestamp: new Date().toISOString(),
          user: delegateName
        }
      ]
    };

    onUpdateCar(updatedCar);
    localStorage.setItem('last_delegate_name', delegateName);

    // Add activity logs
    addLog(
      `حجز سيارة لمندوب`, 
      reservationCar.id, 
      'car', 
      `تم حجز السيارة ${reservationCar.brand} ${reservationCar.model} (${reservationCar.year}) رقم الهيكل ${reservationCar.vin} للمندوب ${delegateName}. جوال: ${delegatePhone || 'غير مدرج'}`
    );

    setSuccessInfo(isRtl 
      ? `تم حجز السيارة ${reservationCar.brand} بنجاح لحساب المندوب: ${delegateName}` 
      : `Car ${reservationCar.brand} reserved successfully for agent: ${delegateName}`
    );
    setShowSuccessToast(true);
    setReservationCar(null);
    
    setTimeout(() => {
      setShowSuccessToast(false);
    }, 4000);
  };

  const handleCancelReservation = (car: CarType) => {
    // Protection: Only system admin OR the delegate who booked can change/release status
    const isAdminUser = String(currentUser?.role) === UserRole.ADMIN || String(currentUser?.role) === 'مدير' || String(currentUser?.role).toUpperCase() === 'ADMIN';
    const isCreator = currentUser && car.reservedByUserId && currentUser.username.trim().toLowerCase() === car.reservedByUserId.trim().toLowerCase();
    
    if (!isAdminUser && !isCreator) {
      alert(isRtl 
        ? 'عذراً، لا يمكن إلغاء الحجز إلا من قبل مدير النظام أو المندوب الذي قام بإنشاء هذا الحجز للسيارة!' 
        : 'Unauthorized: Only the system Administrator or the representative who booked this car can cancel its status.'
      );
      return;
    }

    const updatedCar: CarType = {
      ...car,
      status: CarStatus.AVAILABLE,
      reservedByUserId: undefined,
      lastModified: new Date().toISOString(),
      history: [
        ...(car.history || []),
        {
          id: 'hist-' + Date.now(),
          action: `إلغاء حجز السيارة وإعادتها للمخزون`,
          timestamp: new Date().toISOString(),
          user: currentUser?.username || 'المندوب'
        }
      ]
    };

    onUpdateCar(updatedCar);
    addLog(
      `إلغاء حجز السيارة`, 
      car.id, 
      'car', 
      `تم إلغاء الحجز للسيارة ${car.brand} ${car.model} وإتاحتها مجدداً بالمخازن الفورية.`
    );

    setSuccessInfo(isRtl ? 'تم إلغاء الحجز وإعادة السيارة للمخازن الفورية' : 'Booking released, car is available again.');
    setShowSuccessToast(true);
    setTimeout(() => {
      setShowSuccessToast(false);
    }, 4000);
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 text-white selection:bg-indigo-600 p-4 md:p-10 relative" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Background Ambience */}
      <div className="absolute top-[10%] right-[-5%] w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute top-[40%] left-[-5%] w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
      
      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        
        {/* Top bar with unified navigation tabs */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 pb-6 border-b border-slate-800/60">
          {/* Unified Platform Navigation Tabs */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 bg-slate-900/70 border border-slate-800/90 p-1.5 rounded-2xl w-full md:w-auto">
            <button
              onClick={() => navigate('/corporate-portal')}
              className="px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 text-slate-400 hover:text-white hover:bg-slate-800/50 cursor-pointer"
            >
              <Home size={14} />
              <span>{isRtl ? 'الواجهة التعريفية' : 'Corporate Home'}</span>
            </button>
            
            <button
              onClick={() => navigate('/showroom')}
              className="px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 cursor-pointer"
            >
              <Car size={14} />
              <span>{isRtl ? 'معرض المبيعات والمناديب' : 'Delegate Showroom'}</span>
            </button>

            <button
              onClick={() => navigate('/dashboard')}
              className="px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 text-slate-400 hover:text-white hover:bg-slate-800/50 cursor-pointer"
            >
              <LayoutDashboard size={14} />
              <span>{isRtl ? 'لوحة التحكم وإدارة المخزون' : 'Admin Control Dashboard'}</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-black text-slate-300 font-mono">
              {isRtl ? 'تزامن شبكة المخزون لحظي ونشط' : 'Live Inventory Sync Active'}
            </span>
          </div>
        </div>

        {/* Title Heading */}
        <div className="space-y-4 text-center sm:text-start">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 text-xs text-indigo-400 font-extrabold tracking-widest uppercase">
                <Sparkles size={13} className="animate-pulse" />
                {isRtl ? 'بوابة المبيعات وحجز الأسطول' : 'FLEET SALES & RESERVATION PORTAL'}
              </span>
              <h1 className="text-2xl md:text-4xl font-black tracking-tight text-white flex items-center justify-center sm:justify-start gap-3">
                <Car className="text-indigo-500" size={36} />
                {isRtl ? 'معرض المبيعات وحجز الأسطول' : 'Automotive Booking Terminal'}
              </h1>
            </div>
            {currentUser && (
              <div className="self-center bg-indigo-500/10 border border-indigo-500/20 px-4 py-2 rounded-2xl flex items-center gap-2.5 shadow-sm">
                <UserCheck size={16} className="text-indigo-400" />
                <span className="text-xs font-extrabold text-slate-200">
                  {isRtl ? `المندوب النشط: ${currentUser.username}` : `Active Agent: ${currentUser.username}`}
                </span>
              </div>
            )}
          </div>
          <p className="text-xs md:text-sm font-semibold text-slate-400 max-w-3xl leading-relaxed">
            {isRtl 
              ? 'استعراض فوري لأسطول المركبات بالمعرض والمستودعات مع إظهار الأسعار الرسمية والبطاقات الجمركية والأوراق المالية الموثقة وإمكانية الحجز الفوري للمبيعات.'
              : 'Browse active fleet vehicles with transparent official pricing, verified customs documentation, financial certificates, and instant booking mechanisms.'}
          </p>
        </div>

        {/* Quick KPI Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400">{isRtl ? 'إجمالي معروض الأسطول' : 'Total Fleet Stock'}</span>
              <p className="text-xl font-black text-white font-mono">{metrics.total}</p>
            </div>
            <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl">
              <Warehouse size={20} />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400">{isRtl ? 'متوفرة للبيع الفوري' : 'Available for Sale'}</span>
              <p className="text-xl font-black text-emerald-400 font-mono">{metrics.available}</p>
            </div>
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <CheckCircle2 size={20} />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400">{isRtl ? 'محجوزة مؤقتاً' : 'Reserved Units'}</span>
              <p className="text-xl font-black text-amber-400 font-mono">{metrics.reserved}</p>
            </div>
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl">
              <Bookmark size={20} />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400">{isRtl ? 'أوراق وبطاقات جمركية موثقة' : 'Verified Customs Docs'}</span>
              <p className="text-xl font-black text-indigo-400 font-mono">{metrics.withCustomsDoc}</p>
            </div>
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <FileSpreadsheet size={20} />
            </div>
          </div>
        </div>

        {/* Success Alert Toast Notification */}
        {showSuccessToast && (
          <div className="fixed bottom-6 left-6 right-6 md:left-auto md:right-6 md:max-w-md bg-emerald-950 border border-emerald-500/30 text-white rounded-2xl p-4 shadow-2xl flex items-start gap-3 animate-in slide-in-from-bottom duration-300 z-50">
            <CheckCircle2 size={24} className="text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <p className="font-extrabold text-emerald-400">{isRtl ? 'تم تحديث الشبكة والمستودع' : 'LAN Synchronized'}</p>
              <p className="font-bold text-slate-300 leading-normal">{successInfo}</p>
            </div>
          </div>
        )}

        {/* Search controls, filters & View Mode Toggle */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-5 backdrop-blur-md space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            {/* Query input */}
            <div className="space-y-1.5 md:col-span-4">
              <label className="text-xs font-black text-slate-300 flex items-center gap-1.5">
                <Search size={14} className="text-indigo-400" />
                {isRtl ? 'البحث عن سيارة (ماركة، موديل، هيكل، بطاقة)' : 'Search Vehicle, VIN, Card'}
              </label>
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isRtl ? 'ابحث عن ماركة، موديل، رقم هيكل، أو رقم بطاقة...' : 'Search brand, model, VIN, card...'}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-600"
              />
            </div>

            {/* Brand select */}
            <div className="space-y-1.5 md:col-span-3">
              <label className="text-xs font-black text-slate-300 flex items-center gap-1.5">
                <Filter size={14} className="text-indigo-400" />
                {isRtl ? 'الماركة' : 'Brand'}
              </label>
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer"
              >
                {brands.map(brand => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
            </div>

            {/* Status Select */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-black text-slate-300 flex items-center gap-1.5">
                <Bookmark size={14} className="text-indigo-400" />
                {isRtl ? 'حالة التوفر' : 'Status'}
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer"
              >
                <option value="الكل">{isRtl ? 'الكل' : 'All States'}</option>
                <option value="متوفره">{isRtl ? 'متوفرة للمبيعات' : 'Available'}</option>
                <option value="محجوزة">{isRtl ? 'محجوزة مؤقتاً' : 'Reserved'}</option>
              </select>
            </div>

            {/* Customs Docs Filter */}
            <div className="space-y-1.5 md:col-span-3">
              <label className="text-xs font-black text-slate-300 flex items-center gap-1.5">
                <FileText size={14} className="text-indigo-400" />
                {isRtl ? 'الأوراق والبطاقات الجمركية' : 'Customs Documents'}
              </label>
              <select
                value={selectedDocFilter}
                onChange={(e) => setSelectedDocFilter(e.target.value as any)}
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer"
              >
                <option value="all">{isRtl ? 'جميع السيارات' : 'All Vehicles'}</option>
                <option value="has_doc">{isRtl ? 'تحتوي على بطاقة/مستند جمركي' : 'With Customs Card/Doc'}</option>
                <option value="no_doc">{isRtl ? 'بدون مستند مرفق' : 'Without Attached Doc'}</option>
              </select>
            </div>
          </div>

          {/* View mode toggle + Active Filter chips */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/60">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
              <span>{isRtl ? `النتائج المعروضة: ${filteredCars.length} سيارة` : `Showing: ${filteredCars.length} vehicles`}</span>
            </div>

            {/* View Mode Switcher (Grid vs Table) */}
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  viewMode === 'grid' 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                }`}
                title={isRtl ? 'عرض البطاقات' : 'Grid View'}
              >
                <LayoutGrid size={13} />
                <span>{isRtl ? 'عرض البطاقات' : 'Grid'}</span>
              </button>

              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  viewMode === 'table' 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                }`}
                title={isRtl ? 'عرض الجدول المالي' : 'Table View'}
              >
                <TableIcon size={13} />
                <span>{isRtl ? 'عرض الجدول المالي' : 'Table'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Empty State */}
        {filteredCars.length === 0 ? (
          <div className="py-20 text-center bg-slate-900/20 border border-slate-900 rounded-[2rem] flex flex-col items-center justify-center space-y-4">
            <AlertCircle size={48} className="text-slate-500 animate-pulse" />
            <p className="text-slate-400 font-extrabold text-sm">
              {isRtl ? 'لا توجد سيارات مطابقة لبحثك في صالة العرض حالياً' : 'No vehicles corresponding to your inquiry found'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          /* =========================================================================
             1. GRID CARDS VIEW (مع السعر والبيانات والأوراق المالية)
             ========================================================================= */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCars.map((car) => {
              const isAvailable = String(car.status) === CarStatus.AVAILABLE || String(car.status) === 'متوفرة' || String(car.status) === 'متوفره';
              const isReserved = String(car.status) === CarStatus.RESERVED || String(car.status) === 'محجوزة' || String(car.status) === 'محجوز';
              const isSold = String(car.status) === CarStatus.SOLD || String(car.status) === 'مباعة';
              const isNotForSale = String(car.status) === CarStatus.NOT_FOR_SALE || String(car.status) === 'غير معروضة للبيع';

              return (
                <div 
                  key={car.id} 
                  className={`bg-slate-900/60 border rounded-[2rem] p-6 transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10 group flex flex-col justify-between overflow-hidden relative ${
                    isReserved ? 'border-amber-500/40 bg-amber-950/10' : 
                    isSold ? 'border-rose-500/20 opacity-75' : 
                    isNotForSale ? 'border-rose-500/30 opacity-75' : 
                    'border-slate-800 hover:border-indigo-500/50'
                  }`}
                >
                  <div className="space-y-4">
                    {/* Top Row: Brand/Year Badge & Status Badge */}
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] bg-slate-800 text-indigo-400 font-extrabold px-3 py-1 rounded-full uppercase font-mono tracking-wider">
                        {car.year} • {car.brand}
                      </span>
                      
                      <span className={`text-[10px] px-2.5 py-0.5 font-black rounded-full ${
                        isAvailable ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 
                        isReserved ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 
                        isNotForSale ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 
                        'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      }`}>
                        {car.status}
                      </span>
                    </div>

                    {/* Vehicle Title & Icon */}
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-2xl ${
                        isReserved ? 'bg-amber-500/10 text-amber-400' : 
                        isSold ? 'bg-rose-500/10 text-rose-400' : 
                        isNotForSale ? 'bg-rose-500/15 text-rose-400' : 
                        'bg-indigo-500/10 text-indigo-400'
                      } group-hover:scale-105 transition-all shrink-0`}>
                        <Car size={24} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-black text-slate-100 group-hover:text-white transition-all truncate">
                          {formatVehicleDisplay(car)}
                        </h3>
                        <p className="text-[11px] text-slate-400 font-bold truncate">
                          {car.model} • {car.color}
                        </p>
                      </div>
                    </div>

                    {/* Prominent Price Bar (عرض السعر) */}
                    <div className="p-3.5 bg-gradient-to-r from-slate-950 via-indigo-950/30 to-slate-950 rounded-2xl border border-indigo-500/20 flex items-center justify-between">
                      <div className="space-y-0.5 text-right">
                        <span className="text-[10px] font-extrabold text-indigo-300 block">
                          {isRtl ? 'سعر البيع المعتمد' : 'Official Selling Price'}
                        </span>
                        <div className="text-lg md:text-xl font-black text-emerald-400 font-mono flex items-baseline gap-1">
                          <span>{(Number(car.price) || 0).toLocaleString()}</span>
                          <span className="text-xs font-bold text-slate-400">{currency}</span>
                        </div>
                      </div>
                      <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
                        <DollarSign size={18} />
                      </div>
                    </div>

                    {/* Core Specifications & Financial Papers Sheet */}
                    <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-900 text-xs space-y-2 font-bold">
                      <div className="flex justify-between items-center text-slate-400">
                        <span>{isRtl ? 'رقم الهيكل (VIN):' : 'VIN Number:'}</span>
                        <span className="text-slate-200 font-mono text-[11px]" title={car.vin}>{car.vin}</span>
                      </div>
                      
                      <div className="flex justify-between items-center text-slate-400 pt-1.5 border-t border-slate-900/80">
                        <span>{isRtl ? 'البطاقة الجمركية / الرقم:' : 'Customs Card Number:'}</span>
                        <span className="text-slate-200 font-mono text-[11px]">
                          {car.cardNumber ? car.cardNumber : (isRtl ? 'غير مسجلة' : 'Unregistered')}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-slate-400 pt-1.5 border-t border-slate-900/80">
                        <span>{isRtl ? 'نوع الملكية:' : 'Ownership:'}</span>
                        <span className="text-indigo-300">{car.ownershipType || 'مباشر'}</span>
                      </div>

                      <div className="flex justify-between items-center text-slate-400 pt-1.5 border-t border-slate-900/80">
                        <span>{isRtl ? 'المورد:' : 'Supplier:'}</span>
                        <span className="text-slate-200 truncate max-w-[140px]">{car.supplier || '-'}</span>
                      </div>

                      <div className="flex justify-between items-center text-slate-400 pt-1.5 border-t border-slate-900/80">
                        <span>{isRtl ? 'الموقع الفعلي:' : 'Location:'}</span>
                        <span className="text-slate-200">
                          {car.isPresentInShowroom ? (isRtl ? 'داخل المعرض' : 'In Showroom') : (isRtl ? 'مستودع خارجي' : 'External Yard')}
                        </span>
                      </div>
                    </div>

                    {/* Attached Financial Document / Customs Card Box */}
                    {car.cardFile ? (
                      <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/25 flex items-center justify-between text-xs font-bold text-indigo-300">
                        <div className="flex items-center gap-2 min-w-0">
                          <Paperclip size={14} className="text-indigo-400 shrink-0" />
                          <div className="truncate">
                            <p className="text-[11px] font-black text-indigo-200 truncate">
                              {car.cardFileName || (isRtl ? 'البطاقة الجمركية المرفقة' : 'Customs Card File')}
                            </p>
                            <span className="text-[9px] text-indigo-400/80 block">
                              {isRtl ? 'مستند موثق ومعتمد' : 'Verified Document'}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          {car.cardFile.startsWith('data:image/') && (
                            <a 
                              href={car.cardFile}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 bg-indigo-500/20 hover:bg-indigo-500/35 text-indigo-300 font-extrabold rounded-lg text-[10px] transition-all cursor-pointer"
                            >
                              {isRtl ? 'معاينة' : 'Preview'}
                            </a>
                          )}
                          <a 
                            href={car.cardFile}
                            download={car.cardFileName || `customs_card_${car.vin}`}
                            className="px-2.5 py-1 bg-indigo-600 text-white hover:bg-indigo-500 font-extrabold rounded-lg text-[10px] transition-all flex items-center gap-1 cursor-pointer shadow-sm shadow-indigo-600/20"
                          >
                            <FileUp size={11} />
                            <span>{isRtl ? 'تحميل' : 'Download'}</span>
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-slate-950/40 rounded-xl border border-slate-900/60 flex items-center justify-between text-[11px] text-slate-400 font-bold">
                        <span className="flex items-center gap-1.5">
                          <FileText size={13} className="text-slate-500" />
                          <span>{isRtl ? 'الأوراق والبطاقة الجمركية:' : 'Customs Document:'}</span>
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {car.cardNumber ? (isRtl ? 'رقم مسجل (بدون ملف)' : 'Number logged') : (isRtl ? 'قيد التوثيق' : 'Pending')}
                        </span>
                      </div>
                    )}

                    {/* Reservation state info */}
                    {isReserved && car.reservedByUserId && (
                      <div className="p-3 bg-amber-500/15 rounded-xl text-[11px] text-amber-400 font-bold border border-amber-500/30 flex items-center gap-2">
                        <Bookmark size={14} className="shrink-0 text-amber-400" />
                        <span>{isRtl ? `حجز حالي باسم: ${car.reservedByUserId}` : `Reserved currently by: ${car.reservedByUserId}`}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions buttons */}
                  <div className="mt-5 pt-3 border-t border-slate-900/80 flex items-center gap-2">
                    {isAvailable && (
                      <button
                        onClick={() => handleOpenReserveModal(car)}
                        className="flex-1 p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20"
                      >
                        <Bookmark size={14} />
                        <span>{isRtl ? 'حجز هذه السيارة للمبيعات' : 'Reserve this vehicle'}</span>
                      </button>
                    )}

                    {isReserved && (
                      <button
                        onClick={() => handleCancelReservation(car)}
                        className="flex-1 p-2.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 rounded-xl text-xs font-black cursor-pointer transition-all border border-rose-500/30"
                      >
                        {isRtl ? 'إلغاء وفك الحجز' : 'Release reserve'}
                      </button>
                    )}

                    {isSold && (
                      <button
                        disabled
                        className="flex-1 p-2.5 bg-slate-900 text-slate-600 rounded-xl text-xs font-black border border-slate-800 cursor-not-allowed flex items-center justify-center gap-1.5"
                      >
                        <X size={14} />
                        <span>{isRtl ? 'السيارة مباعة كلياً' : 'Vehicle sold'}</span>
                      </button>
                    )}

                    <button
                      onClick={() => setSelectedCarDetails(car)}
                      className="px-3 p-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-black cursor-pointer border border-slate-700 transition-all flex items-center justify-center"
                      title={isRtl ? 'عرض تفاصيل المركبة والبيانات المالية' : 'View specs & financial papers'}
                    >
                      <Eye size={15} />
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        ) : (
          /* =========================================================================
             2. TABLE VIEW (عرض الأوراق والبيانات المالية نفس لوحة التحكم والمخزون)
             ========================================================================= */
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-[#2F5597] text-white font-bold border-b border-slate-700">
                    <th className="p-3.5 text-center font-bold">#</th>
                    <th className="p-3.5 font-bold">{isRtl ? 'المركبة' : 'Vehicle'}</th>
                    <th className="p-3.5 text-center font-bold">{isRtl ? 'الموديل / السنة' : 'Year'}</th>
                    <th className="p-3.5 text-center font-bold">{isRtl ? 'اللون' : 'Color'}</th>
                    <th className="p-3.5 font-bold">{isRtl ? 'رقم الهيكل VIN' : 'VIN'}</th>
                    <th className="p-3.5 font-bold">{isRtl ? 'الأوراق والبطاقة الجمركية' : 'Customs Docs'}</th>
                    <th className="p-3.5 text-center font-bold">{isRtl ? 'سعر البيع' : 'Selling Price'}</th>
                    <th className="p-3.5 text-center font-bold">{isRtl ? 'الحالة' : 'Status'}</th>
                    <th className="p-3.5 text-center font-bold">{isRtl ? 'الموقع' : 'Location'}</th>
                    <th className="p-3.5 text-center font-bold">{isRtl ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredCars.map((car, idx) => {
                    const isAvailable = String(car.status) === CarStatus.AVAILABLE || String(car.status) === 'متوفرة' || String(car.status) === 'متوفره';
                    const isReserved = String(car.status) === CarStatus.RESERVED || String(car.status) === 'محجوزة' || String(car.status) === 'محجوز';
                    const isSold = String(car.status) === CarStatus.SOLD || String(car.status) === 'مباعة';

                    return (
                      <tr 
                        key={car.id}
                        className={`hover:bg-slate-800/40 transition-colors ${
                          idx % 2 === 1 ? 'bg-slate-950/40' : 'bg-slate-900/30'
                        } ${isReserved ? 'bg-amber-950/10' : ''}`}
                      >
                        <td className="p-3.5 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                        <td className="p-3.5">
                          <div className="font-extrabold text-white">{car.brand} {car.model}</div>
                        </td>
                        <td className="p-3.5 text-center font-mono font-bold text-slate-200">{car.year}</td>
                        <td className="p-3.5 text-center font-bold text-slate-300">{car.color}</td>
                        <td className="p-3.5 font-mono text-[11px] text-slate-300 font-bold">{car.vin}</td>
                        <td className="p-3.5">
                          <div className="space-y-1">
                            <div className="font-mono text-slate-300 font-bold">
                              {car.cardNumber || (isRtl ? 'غير مسجلة' : 'Unregistered')}
                            </div>
                            {car.cardFile && (
                              <div className="flex items-center gap-2">
                                <a 
                                  href={car.cardFile}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-indigo-400 hover:text-indigo-300 underline font-bold"
                                >
                                  {isRtl ? 'معاينة المستند' : 'Preview doc'}
                                </a>
                                <span className="text-slate-600">•</span>
                                <a 
                                  href={car.cardFile}
                                  download={car.cardFileName || `card_${car.vin}`}
                                  className="text-[10px] text-emerald-400 hover:text-emerald-300 underline font-bold"
                                >
                                  {isRtl ? 'تحميل' : 'Download'}
                                </a>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="font-mono font-black text-emerald-400 text-sm">
                            {(Number(car.price) || 0).toLocaleString()} <span className="text-[10px] text-slate-400 font-bold">{currency}</span>
                          </div>
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`inline-block text-[10px] px-2.5 py-0.5 font-black rounded-full ${
                            isAvailable ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 
                            isReserved ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 
                            'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          }`}>
                            {car.status}
                          </span>
                          {isReserved && car.reservedByUserId && (
                            <div className="text-[10px] text-amber-400/90 font-bold mt-0.5 truncate max-w-[110px]">
                              {car.reservedByUserId}
                            </div>
                          )}
                        </td>
                        <td className="p-3.5 text-center text-slate-300 font-bold text-[11px]">
                          {car.isPresentInShowroom ? (isRtl ? 'بالمعرض' : 'Showroom') : (isRtl ? 'مستودع' : 'Yard')}
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {isAvailable && (
                              <button
                                onClick={() => handleOpenReserveModal(car)}
                                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-black cursor-pointer transition-all shadow-sm flex items-center gap-1"
                              >
                                <Bookmark size={12} />
                                <span>{isRtl ? 'حجز' : 'Reserve'}</span>
                              </button>
                            )}

                            {isReserved && (
                              <button
                                onClick={() => handleCancelReservation(car)}
                                className="px-2.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 rounded-lg text-[11px] font-black cursor-pointer transition-all border border-rose-500/30"
                              >
                                {isRtl ? 'فك الحجز' : 'Release'}
                              </button>
                            )}

                            <button
                              onClick={() => setSelectedCarDetails(car)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer border border-slate-700 transition-all"
                              title={isRtl ? 'معاينة التفاصيل' : 'Details'}
                            >
                              <Eye size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* Reservation Confirmation Modal popup */}
      {reservationCar && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 overflow-hidden"
          onClick={(e) => { if (e.target === e.currentTarget) handleCloseReserveModal(); }}
        >
          <div 
            className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg max-h-[92vh] sm:max-h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-start"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-800 bg-slate-900/95 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-500/15 text-indigo-400 rounded-xl">
                  <Bookmark size={18} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">{isRtl ? 'تأكيد حجز سيارة للمبيعات' : 'Secure Vehicle Reservation'}</h3>
                  <p className="text-[11px] text-slate-400 font-bold">{isRtl ? 'حجز فوري وتحديث مباشر لبيانات المعرض' : 'Instant booking & live showroom inventory update'}</p>
                </div>
              </div>
              <button 
                onClick={handleCloseReserveModal}
                className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl cursor-pointer border border-slate-800 transition-all"
                title={isRtl ? 'إغلاق النافذة' : 'Close'}
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleConfirmReservation} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 custom-scrollbar">
              <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-850 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Car size={22} className="text-indigo-500 shrink-0" />
                  <div className="text-xs">
                    <p className="font-extrabold text-slate-100">{formatVehicleDisplay(reservationCar)}</p>
                    <p className="font-bold text-slate-400 font-mono text-[11px]">VIN: {reservationCar.vin} | موديل {reservationCar.year}</p>
                  </div>
                </div>
                <div className="text-left font-mono font-black text-emerald-400 text-sm shrink-0">
                  {(Number(reservationCar.price) || 0).toLocaleString()} {currency}
                </div>
              </div>

              {/* Card File Display inside Booking Modal */}
              {reservationCar.cardFile ? (
                <div className="p-3.5 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 space-y-2.5 text-right">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span className="flex items-center gap-1.5 text-indigo-400 font-extrabold text-[11px]">
                      <Paperclip size={13} />
                      {isRtl ? 'البطاقة الجمركية والأوراق المرفقة' : 'Customs Document'}
                    </span>
                    <span className="text-[10px] bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded-full font-black border border-indigo-800">
                      {isRtl ? 'مستند موثق' : 'Verified'}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850 flex flex-col sm:flex-row gap-2.5 items-center justify-between">
                    <div className="text-right text-xs truncate max-w-full sm:max-w-[200px]">
                      <p className="font-extrabold text-slate-200 truncate">
                        {reservationCar.cardFileName || 'vehicle_customs_card'}
                      </p>
                      <p className="text-[10px] text-slate-500 font-bold">
                        {isRtl ? 'رقم البطاقة:' : 'Card No:'} {reservationCar.cardNumber || '-'}
                      </p>
                    </div>
                    <div className="flex gap-1.5 w-full sm:w-auto justify-end">
                      {reservationCar.cardFile.startsWith('data:image/') && (
                        <a 
                          href={reservationCar.cardFile} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/35 text-indigo-400 font-bold rounded-lg text-[10px] transition-all text-center"
                        >
                          {isRtl ? 'معاينة' : 'Preview'}
                        </a>
                      )}
                      <a 
                        href={reservationCar.cardFile} 
                        download={reservationCar.cardFileName || `card_${reservationCar.vin}`}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-lg text-[10px] transition-all flex items-center justify-center gap-1 shrink-0 text-center"
                      >
                        <FileUp size={11} />
                        <span>{isRtl ? 'تحميل' : 'Download'}</span>
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-900 text-center text-xs text-slate-500 font-bold">
                  {isRtl ? 'معلومات البطاقة الجمركية: ' + (reservationCar.cardNumber || 'غير مدرجة') : 'Customs Card: ' + (reservationCar.cardNumber || 'None')}
                </div>
              )}

              {/* Delegate name input */}
              <div className="space-y-1 text-right">
                <label className="text-xs font-black text-slate-300 block">{isRtl ? 'اسم المندوب المسؤول عن الحجز' : 'Authorized Representative Name'}</label>
                <input 
                  type="text"
                  required
                  value={delegateName}
                  onChange={(e) => setDelegateName(e.target.value)}
                  placeholder={isRtl ? 'أدخل اسم المندوب...' : 'Representative Name'}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* Client / Delegate Phone */}
              <div className="space-y-1 text-right">
                <label className="text-xs font-black text-slate-300 block">{isRtl ? 'رقم جوال العميل / المندوب' : 'Representative or Buyer Phone'}</label>
                <input 
                  type="text"
                  value={delegatePhone}
                  onChange={(e) => setDelegatePhone(e.target.value)}
                  placeholder="05xxxxxxx"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1 text-right">
                <label className="text-xs font-black text-slate-300 block">{isRtl ? 'ملاحظات الحجز الإضافية' : 'Additional reservation notes'}</label>
                <textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={isRtl ? 'حجز مبدئي للعميل لحين سداد العربون...' : 'Write any specific booking conditions...'}
                  className="w-full h-18 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                />
              </div>

              {/* Sticky Form Footer */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseReserveModal}
                  className="flex-1 p-2.5 bg-slate-950 hover:bg-slate-800 text-slate-400 rounded-xl text-xs font-black transition-all cursor-pointer border border-slate-800"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="flex-1 p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-lg shadow-indigo-600/20"
                >
                  {isRtl ? 'تأكيد وحجز السيارة' : 'Secure Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details/Attached File Modal (عرض تفاصيل الأوراق والبيانات المالية) */}
      {selectedCarDetails && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 overflow-hidden" 
          dir={isRtl ? 'rtl' : 'ltr'}
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedCarDetails(null); }}
        >
          <div 
            className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[92vh] sm:max-h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-right"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-slate-800 bg-slate-900/95 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-500/15 text-indigo-400 rounded-xl">
                  <Car size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    {formatVehicleDisplay(selectedCarDetails)}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-bold">
                    {isRtl ? 'المواصفات الفنية، الأوراق الرسمية، والبيانات المالية' : 'Specifications & Financial Customs Documents'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedCarDetails(null)}
                className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl cursor-pointer border border-slate-800 transition-all"
                title={isRtl ? 'إغلاق النافذة' : 'Close'}
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Body Content */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-5 custom-scrollbar text-right">
              
              {/* Highlight Price Banner */}
              <div className="p-4 bg-gradient-to-r from-slate-950 via-indigo-950/40 to-slate-950 rounded-2xl border border-indigo-500/25 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-extrabold text-indigo-300 block">
                    {isRtl ? 'سعر البيع المعتمد للمبيعات' : 'Official Selling Price'}
                  </span>
                  <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono flex items-baseline gap-1.5">
                    <span>{(Number(selectedCarDetails.price) || 0).toLocaleString()}</span>
                    <span className="text-xs font-bold text-slate-400">{currency}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-3 py-1 font-black rounded-full ${
                    String(selectedCarDetails.status) === CarStatus.AVAILABLE || String(selectedCarDetails.status) === 'متوفرة' || String(selectedCarDetails.status) === 'متوفره'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' 
                      : String(selectedCarDetails.status) === CarStatus.RESERVED || String(selectedCarDetails.status) === 'محجوزة'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  }`}>
                    {selectedCarDetails.status}
                  </span>
                </div>
              </div>

              {/* Main specs grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold text-slate-300">
                {/* Primary Specs */}
                <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-850 space-y-2.5 text-right">
                  <p className="text-indigo-400 font-black mb-2 border-b border-slate-900 pb-1.5 flex items-center gap-1.5">
                    <Tag size={13} />
                    <span>{isRtl ? 'البيانات الأساسية' : 'Primary Spec'}</span>
                  </p>
                  <div className="flex justify-between"><span>{isRtl ? 'الماركة:' : 'Brand:'}</span><span className="text-white font-extrabold">{selectedCarDetails.brand}</span></div>
                  <div className="flex justify-between"><span>{isRtl ? 'الموديل:' : 'Model:'}</span><span className="text-white font-extrabold">{selectedCarDetails.model}</span></div>
                  <div className="flex justify-between"><span>{isRtl ? 'موديل السنة:' : 'Year:'}</span><span className="text-white font-mono font-bold">{selectedCarDetails.year}</span></div>
                  <div className="flex justify-between"><span>{isRtl ? 'اللون:' : 'Color:'}</span><span className="text-white font-extrabold">{selectedCarDetails.color}</span></div>
                  <div className="flex justify-between items-center">
                    <span>{isRtl ? 'رقم الهيكل VIN:' : 'VIN:'}</span>
                    <span className="text-white font-mono font-bold text-[11px]">{selectedCarDetails.vin}</span>
                  </div>
                </div>
                
                {/* Financial & Administrative Data */}
                <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-850 space-y-2.5 text-right">
                  <p className="text-emerald-400 font-black mb-2 border-b border-slate-900 pb-1.5 flex items-center gap-1.5">
                    <DollarSign size={13} />
                    <span>{isRtl ? 'البيانات الإدارية والتوثيق' : 'Financial & Official Records'}</span>
                  </p>
                  <div className="flex justify-between items-center">
                    <span>{isRtl ? 'البطاقة الجمركية:' : 'Custom Card:'}</span>
                    <span className="text-white font-mono font-bold">{selectedCarDetails.cardNumber || (isRtl ? 'غير مسجلة' : 'Unregistered')}</span>
                  </div>
                  <div className="flex justify-between"><span>{isRtl ? 'تطابق الهيكل:' : 'VIN Match:'}</span><span className="text-white font-extrabold">{selectedCarDetails.vinMatching || 'مطابق'}</span></div>
                  <div className="flex justify-between"><span>{isRtl ? 'نوع الملكية:' : 'Ownership:'}</span><span className="text-indigo-300 font-extrabold">{selectedCarDetails.ownershipType || 'مباشر'}</span></div>
                  <div className="flex justify-between"><span>{isRtl ? 'المورد:' : 'Supplier:'}</span><span className="text-white font-extrabold">{selectedCarDetails.supplier || '-'}</span></div>
                  <div className="flex justify-between">
                    <span>{isRtl ? 'الموقع الفعلي:' : 'Location:'}</span>
                    <span className="text-white font-extrabold">
                      {selectedCarDetails.isPresentInShowroom ? (isRtl ? 'داخل المعرض' : 'Showroom') : (isRtl ? 'المستودع الخارجي' : 'External Yard')}
                    </span>
                  </div>
                  {selectedCarDetails.reservedByUserId && (
                    <div className="flex justify-between text-amber-400 pt-1 border-t border-slate-900">
                      <span>{isRtl ? 'المندوب الحاجز:' : 'Reserved By:'}</span>
                      <span className="font-extrabold">{selectedCarDetails.reservedByUserId}</span>
                    </div>
                  )}
                </div>
              </div>

              {selectedCarDetails.notes && (
                <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-850 text-right">
                  <p className="text-xs font-black text-indigo-400 mb-1">{isRtl ? 'ملاحظات وتفاصيل إضافية:' : 'Notes:'}</p>
                  <p className="text-xs text-slate-300 leading-relaxed font-bold">{selectedCarDetails.notes}</p>
                </div>
              )}

              {/* Attached Customs Card / Financial Document */}
              <div className="p-4 sm:p-5 bg-slate-950/70 rounded-2xl border border-slate-850 space-y-3 text-right">
                <p className="text-xs font-black text-indigo-400 flex items-center gap-1.5">
                  <Paperclip size={14} />
                  {isRtl ? 'مستند البطاقة الجمركية والشهادات المرفقة:' : 'Customs Card & Financial Documents:'}
                </p>
                
                {selectedCarDetails.cardFile ? (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between bg-slate-900 p-3.5 rounded-xl border border-slate-800 text-right">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 bg-indigo-500/15 text-indigo-400 rounded-xl shrink-0">
                        <FileUp size={18} />
                      </div>
                      <div className="text-right text-xs truncate">
                        <p className="font-extrabold text-slate-200 truncate max-w-[220px] sm:max-w-[280px]">
                          {selectedCarDetails.cardFileName || 'vehicle_customs_card'}
                        </p>
                        <p className="text-[10px] text-slate-500 font-bold">
                          {isRtl ? 'مستند موثق ومعتمد رقمياً' : 'Verified official document'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto justify-end shrink-0">
                      {selectedCarDetails.cardFile.startsWith('data:image/') && (
                        <a 
                          href={selectedCarDetails.cardFile} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/35 text-indigo-400 font-black rounded-lg text-[11px] transition-all"
                        >
                          {isRtl ? 'معاينة الصورة' : 'Preview'}
                        </a>
                      )}
                      <a 
                        href={selectedCarDetails.cardFile} 
                        download={selectedCarDetails.cardFileName || `card_${selectedCarDetails.vin}`}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-lg text-[11px] transition-all flex items-center gap-1 shrink-0 shadow-sm shadow-indigo-600/20"
                      >
                        <FileUp size={12} />
                        <span>{isRtl ? 'تحميل المستند' : 'Download Document'}</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 text-center bg-slate-900/50 border border-slate-850 rounded-xl text-xs font-bold text-slate-500">
                    {isRtl ? 'لا يوجد ملف بطاقة جمركية مرفق بهذه المركبة حالياً.' : 'No customs card document attached to this vehicle.'}
                  </div>
                )}
              </div>

            </div>

            {/* Sticky Modal Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-7 py-4 border-t border-slate-800 bg-slate-900/95 shrink-0">
              <span className="text-[10px] text-slate-400 font-bold font-mono">
                {isRtl ? `المعرف الرقمي: ${selectedCarDetails.id}` : `ID: ${selectedCarDetails.id}`}
              </span>
              
              <div className="flex items-center gap-2.5">
                {(String(selectedCarDetails.status) === CarStatus.AVAILABLE || String(selectedCarDetails.status) === 'متوفرة' || String(selectedCarDetails.status) === 'متوفره') && (
                  <button
                    onClick={() => {
                      const carToReserve = selectedCarDetails;
                      setSelectedCarDetails(null);
                      handleOpenReserveModal(carToReserve);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
                  >
                    <Bookmark size={13} />
                    <span>{isRtl ? 'حجز هذه السيارة للمبيعات' : 'Reserve Vehicle'}</span>
                  </button>
                )}

                <button
                  onClick={() => setSelectedCarDetails(null)}
                  className="px-5 py-2 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-black transition-all cursor-pointer border border-slate-800"
                >
                  {isRtl ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
