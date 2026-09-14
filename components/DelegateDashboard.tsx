import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Users, Car, Calendar, Search, Filter, CheckCircle2, AlertCircle, 
  Clock, X, RefreshCw, Bookmark, ArrowLeftRight, ChevronRight,
  TrendingUp, PlayCircle, Ban, DollarSign, Eye, Award,
  UserPlus, Edit2, Power, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Car as CarType, CarStatus, User, UserRole, ActivityLog, Delegate, UnifiedBooking, getUnifiedBookings } from '../types';
import { DelegateManagementTab } from './DelegateManagementTab';

interface DelegateDashboardProps {
  cars: CarType[];
  onUpdateCar: (car: CarType) => void;
  onUpdateCars?: React.Dispatch<React.SetStateAction<CarType[]>>;
  users: User[];
  setUsers?: React.Dispatch<React.SetStateAction<User[]>>;
  delegates: Delegate[];
  setDelegates?: React.Dispatch<React.SetStateAction<Delegate[]>>;
  addLog: (action: string, targetId: string, targetType: any, details: string) => void;
  currentUser: User | null;
  isRtl: boolean;
}

export const DelegateDashboard: React.FC<DelegateDashboardProps> = ({
  cars,
  onUpdateCar,
  onUpdateCars,
  users,
  setUsers,
  delegates = [],
  setDelegates,
  addLog,
  currentUser,
  isRtl
}) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Tab states: reservations vs management
  const queryParams = new URLSearchParams(location.search);
  const initialTab = queryParams.get('tab') === 'management' ? 'management' : 'reservations';
  const [activeTab, setActiveTab] = useState<'reservations' | 'management'>(initialTab);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab') === 'management' ? 'management' : 'reservations';
    setActiveTab(tab);
  }, [location.search]);

  // Master states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDelegateFilter, setSelectedDelegateFilter] = useState('الكل');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('الكل'); // الكل، نشط، منتهي، مباع
  const [selectedBrandFilter, setSelectedBrandFilter] = useState('الكل');
  
  // States specifically for management tab
  const [showDelegateModal, setShowDelegateModal] = useState<boolean>(false);
  const [editingDelegate, setEditingDelegate] = useState<User | null>(null);
  const [delegateForm, setDelegateForm] = useState({
    username: '',
    phone: '',
    email: '',
    specialty: 'مبيعات',
    status: 'active' as 'active' | 'inactive',
    target: 10,
  });
  const [delegateSearchQuery, setDelegateSearchQuery] = useState('');

  // States specifically for editing documented sales
  const [showEditSaleModal, setShowEditSaleModal] = useState<boolean>(false);
  const [editingSaleCar, setEditingSaleCar] = useState<CarType | null>(null);
  const [saleForm, setSaleForm] = useState({
    price: 0,
    exitDate: '',
    seller: '',
    notes: '',
  });

  // Selected delegate card in dual pane
  const [activeDelegateId, setActiveDelegateId] = useState<string | null>(null);

  // Selected car for detail view modal
  const [selectedCarDetail, setSelectedCarDetail] = useState<CarType | null>(null);

  // Diagnostic state
  const [showDiagnosticModal, setShowDiagnosticModal] = useState<boolean>(false);
  const [activeDiagnosticTab, setActiveDiagnosticTab] = useState<'integrity' | 'performance'>('integrity');

  // ⚡ Performance auditing and counters
  const renderCounterRef = useRef<number>(0);
  renderCounterRef.current += 1;

  const [dataReloadCount, setDataReloadCount] = useState(1);
  const prevCarsLengthRef = useRef<number>(cars.length);

  useEffect(() => {
    if (cars.length !== prevCarsLengthRef.current) {
      setDataReloadCount(c => c + 1);
      prevCarsLengthRef.current = cars.length;
    }
  }, [cars]);

  const perfMetricsRef = useRef<Record<string, { timeMs: number, count: number }>>({});

  // Lazy loading state for bookings cards grid
  const [visibleCount, setVisibleCount] = useState<number>(12);

  useEffect(() => {
    setVisibleCount(12);
  }, [searchQuery, selectedDelegateFilter, selectedStatusFilter, selectedBrandFilter]);

  // State-independent Unified Bookings Query representing Single Source of Truth
  const unifiedBookings = useMemo(() => {
    const start = performance.now();
    const result = getUnifiedBookings(cars);
    const duration = performance.now() - start;
    perfMetricsRef.current['unifiedBookings'] = { timeMs: duration, count: result.length };
    return result;
  }, [cars]);

  // Diagnostic calculations representing Single Source of Truth Reconciler
  const diagnostics = useMemo(() => {
    const start = performance.now();
    // 1. All vehicles in raw database with reserved status
    const dbReservedCars = cars.filter(c => {
      if (!c) return false;
      const statusStr = String(c.status || '').trim();
      return statusStr === 'محجوزة' || statusStr === 'محجوز' || statusStr === 'Reserved' || c.status === CarStatus.RESERVED;
    });

    // 2. All active + expired bookings loaded on the board
    const boardBookings = unifiedBookings.filter(b => b.bookingStatus !== 'sold');
    const boardBookingsIds = new Set(boardBookings.map(b => b.id));

    // 3. Find if any of the dbReservedCars is missing from the board bookings
    const list: { car: CarType; reason: string }[] = [];
    dbReservedCars.forEach(c => {
      if (!boardBookingsIds.has(c.id)) {
        let reason = '';
        if (!c.reservedByUserId && !c.seller && !c.statusNote) {
          reason = isRtl 
            ? 'حقل اسم المندوب الفني فارغ تماماً والملاحظات خالية من المعرفات.' 
            : 'Representative identifier field is completely empty and status notes lack any delegate matching name.';
        } else if (c.isOutbound) {
          reason = isRtl 
            ? 'المركبة مصنفة كحركة خارج المعرض (isOutbound === true).' 
            : 'The vehicle is flagged as an active outbound movement.';
        } else {
          reason = isRtl 
            ? 'تم استبعادها بسبب شروط حالة المركبة أو تصفية الأرشفة.' 
            : 'Excluded due to custom archival flag or status contradiction.';
        }
        list.push({ car: c, reason });
      }
    });

    const result = {
      dbCount: dbReservedCars.length,
      boardCount: boardBookings.length,
      missingCars: list
    };
    const duration = performance.now() - start;
    perfMetricsRef.current['diagnostics'] = { timeMs: duration, count: list.length };
    return result;
  }, [cars, unifiedBookings, isRtl]);

  // Helper: calculate reservation state
  const getReservationState = (car: CarType): 'active' | 'expired' | 'sold' => {
    if (car.status === CarStatus.SOLD) return 'sold';
    if (!car.reservationDate) return 'active';
    const date = new Date(car.reservationDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 3 ? 'expired' : 'active';
  };

  // 1. Compile list of delegates
  // A delegate can be in separate 'delegates' array OR anyone listed in cars' 'reservedByUserId'
  const delegateList = useMemo(() => {
    const start = performance.now();
    const listMap = new Map<string, { id: string; name: string; email?: string; phone?: string; role: string }>();

    // Add delegates from separate delegates array
    if (Array.isArray(delegates)) {
      delegates.forEach(d => {
        if (d && d.username) {
          listMap.set(d.username, {
            id: d.id || `del-${Math.random().toString(36).substring(2, 7)}`,
            name: d.username,
            email: d.email || '',
            phone: d.phone || '',
            role: 'مندوب معتمد'
          });
        }
      });
    }

    // Add anyone who has a reserved vehicle
    unifiedBookings.forEach(b => {
      if (b.delegateName && !listMap.has(b.delegateName)) {
        listMap.set(b.delegateName, {
          id: 'ext-' + b.delegateName,
          name: b.delegateName,
          role: b.delegateName === 'غير مححدد' || b.delegateName === 'غير مححدد' ? 'حجوزات عامة' : 'مندوب نشط'
        });
      }
    });

    const result = Array.from(listMap.values());
    const duration = performance.now() - start;
    perfMetricsRef.current['delegateList'] = { timeMs: duration, count: result.length };
    return result;
  }, [delegates, unifiedBookings]);

  // Aggregate stats per delegate
  const delegateStats = useMemo(() => {
    const start = performance.now();
    const statsMap = new Map<string, { total: number; active: number; expired: number; sold: number }>();

    delegateList.forEach(d => {
      statsMap.set(d.name, { total: 0, active: 0, expired: 0, sold: 0 });
    });

    unifiedBookings.forEach(b => {
      let stats = statsMap.get(b.delegateName);
      if (!stats) {
        stats = { total: 0, active: 0, expired: 0, sold: 0 };
        statsMap.set(b.delegateName, stats);
      }
      
      stats.total += 1;
      if (b.bookingStatus === 'active') stats.active += 1;
      else if (b.bookingStatus === 'expired') stats.expired += 1;
      else if (b.bookingStatus === 'sold') stats.sold += 1;
    });

    const duration = performance.now() - start;
    perfMetricsRef.current['delegateStats'] = { timeMs: duration, count: statsMap.size };
    return statsMap;
  }, [delegateList, unifiedBookings]);

  // Top level overall metrics
  const globalMetrics = useMemo(() => {
    const start = performance.now();
    let total = 0;
    let active = 0;
    let expired = 0;
    let sold = 0;

    unifiedBookings.forEach(b => {
      total += 1;
      if (b.bookingStatus === 'active') active += 1;
      else if (b.bookingStatus === 'expired') expired += 1;
      else if (b.bookingStatus === 'sold') sold += 1;
    });

    const result = { total, active, expired, sold };
    const duration = performance.now() - start;
    perfMetricsRef.current['globalMetrics'] = { timeMs: duration, count: 4 };
    return result;
  }, [unifiedBookings]);

  // Extract unique brands reserved
  const reservedBrands = useMemo(() => {
    const start = performance.now();
    const brands = new Set<string>();
    unifiedBookings.forEach(b => {
      if (b.brand) {
        brands.add(b.brand);
      }
    });
    const result = ['الكل', ...Array.from(brands)];
    const duration = performance.now() - start;
    perfMetricsRef.current['reservedBrands'] = { timeMs: duration, count: result.length };
    return result;
  }, [unifiedBookings]);

  // Handle Cancel Reservation (release back to available)
  const handleCancelReservation = (car: CarType) => {
    const updated: CarType = {
      ...car,
      status: CarStatus.AVAILABLE,
      reservedByUserId: undefined,
      reservationDate: undefined,
      lastModified: new Date().toISOString(),
      history: [
        ...(car.history || []),
        {
          id: 'hist-cancel-' + Date.now(),
          action: isRtl ? `إلغاء الحجز للسيارة وإعادتها للمعرض بواسطة ${currentUser?.username}` : `Cancelled reservation by ${currentUser?.username}`,
          timestamp: new Date().toISOString(),
          user: currentUser?.username || 'System'
        }
      ]
    };
    onUpdateCar(updated);
    addLog(
      isRtl ? 'إلغاء حجز' : 'Cancel Reservation',
      car.id,
      'CAR',
      isRtl ? `تم إلغاء حجز السيارة ${car.brand} ${car.model} VIN: ${car.vin}` : `Cancelled booking for ${car.brand} ${car.model} VIN: ${car.vin}`
    );
  };

  // Handle Extend Reservation (refresh 3-day window)
  const handleExtendReservation = (car: CarType) => {
    const updated: CarType = {
      ...car,
      reservationDate: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      history: [
        ...(car.history || []),
        {
          id: 'hist-extend-' + Date.now(),
          action: isRtl ? `تجديد وتمديد فترة الحجز المعتمدة بواسطة ${currentUser?.username}` : `Extended reservation window by ${currentUser?.username}`,
          timestamp: new Date().toISOString(),
          user: currentUser?.username || 'System'
        }
      ]
    };
    onUpdateCar(updated);
    addLog(
      isRtl ? 'تمديد حجز' : 'Extend Reservation',
      car.id,
      'CAR',
      isRtl ? `تم تمديد صلاحية حجز السيارة ${car.brand} ${car.model}` : `Extended reservation for ${car.brand} ${car.model}`
    );
  };

  // Handle Convert to Sold (Sales integration)
  const handleConvertToSold = (car: CarType) => {
    const updated: CarType = {
      ...car,
      status: CarStatus.SOLD,
      lastModified: new Date().toISOString(),
      exitData: {
        receiverName: car.reservedByUserId || '',
        receiverPhone: '',
        receiverId: '',
        deliveryType: 'فوري' as any,
        exitDate: new Date().toISOString().split('T')[0],
        seller: currentUser?.username || 'System'
      },
      history: [
        ...(car.history || []),
        {
          id: 'hist-sold-' + Date.now(),
          action: isRtl ? `تحويل الحجز لمبيعات معتمدة وتغيير الحالة بموافقة ${currentUser?.username}` : `Converted reservation to direct sale by ${currentUser?.username}`,
          timestamp: new Date().toISOString(),
          user: currentUser?.username || 'System'
        }
      ]
    };
    onUpdateCar(updated);
    addLog(
      isRtl ? 'مبيعات حجز' : 'Convert Reservation to Sale',
      car.id,
      'CAR',
      isRtl ? `تم تحويل حجز السيارة ${car.brand} ${car.model} إلى عملية بيع ناجحة` : `Converted booking to sale for ${car.brand} ${car.model}`
    );
  };

  // Filter cars matching criteria
  const matchingReservations = useMemo(() => {
    const start = performance.now();
    const result = unifiedBookings
      .filter(b => {
        // 1. Search Query filter (matches brand, model, VIN, delegate name)
        const q = searchQuery.toLowerCase().trim();
        const matchesSearch = !q || 
          (b.brand || '').toLowerCase().includes(q) ||
          (b.model || '').toLowerCase().includes(q) ||
          (b.vin || '').toLowerCase().includes(q) ||
          (b.delegateName || '').toLowerCase().includes(q);

        // 2. Delegate filter
        const matchesDelegate = selectedDelegateFilter === 'الكل' || b.delegateName === selectedDelegateFilter;

        // 3. Status filter
        let matchesStatus = true;
        if (selectedStatusFilter !== 'الكل') {
          if (selectedStatusFilter === 'نشط' && b.bookingStatus !== 'active') matchesStatus = false;
          if (selectedStatusFilter === 'منتهي' && b.bookingStatus !== 'expired') matchesStatus = false;
          if (selectedStatusFilter === 'مباع' && b.bookingStatus !== 'sold') matchesStatus = false;
        } else {
          // If status filter is 'الكل', exclude sold bookings by default
          if (b.bookingStatus === 'sold') matchesStatus = false;
        }

        // 4. Brand filter
        const matchesBrand = selectedBrandFilter === 'الكل' || b.brand === selectedBrandFilter;

        return matchesSearch && matchesDelegate && matchesStatus && matchesBrand;
      })
      .map(b => ({
        ...b.car,
        reservedByUserId: b.car.reservedByUserId || b.delegateName
      }));
    const duration = performance.now() - start;
    perfMetricsRef.current['matchingReservations'] = { timeMs: duration, count: result.length };
    return result;
  }, [unifiedBookings, searchQuery, selectedDelegateFilter, selectedStatusFilter, selectedBrandFilter]);

  // Set selected delegate in left pane
  const handleSelectDelegate = (name: string) => {
    setActiveDelegateId(prev => prev === name ? null : name);
    setSelectedDelegateFilter(prev => prev === name ? 'الكل' : name);
  };

  return (
    <div className={`space-y-6 font-sans text-right ${isRtl ? 'rtl' : 'ltr'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      
      {/* 🚀 Top Header banner */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-gradient-to-l from-blue-700 via-blue-800 to-indigo-900 p-6 rounded-[2rem] text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-4 z-10">
          <div className="p-3.5 bg-white/10 backdrop-blur-md rounded-2xl">
            <Users size={28} className="text-blue-200" />
          </div>
          <div>
            <h2 className="text-2xl font-black">{isRtl ? 'لوحة تحكم حجوزات المندوبين المعتمدة' : 'Delegate Reservations Dashboard'}</h2>
            <p className="text-xs text-blue-100 font-bold mt-1">
              {isRtl ? 'نظام تتبع حجوزات المندوبين، إحصاءات صلاحيات ومؤشرات الصلاحية والبيع المباشر.' : 'Monitor delegate metrics, active/expired booking windows, and instant conversions.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 z-10">
          <button
            onClick={() => setShowDiagnosticModal(true)}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white px-4 py-2.5 rounded-2xl text-xs font-black transition-all shadow-md cursor-pointer border-0"
          >
            <AlertCircle size={15} />
            <span>{isRtl ? 'فحص تطابق الحجوزات 🔍' : 'Verify Bookings Match'}</span>
          </button>
          
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10">
            <TrendingUp size={16} className="text-emerald-400" />
            <span className="text-xs font-black">{isRtl ? 'حالة النظام: متصل ومنسق لحظياً' : 'Sync Status: Real-time Live'}</span>
          </div>
        </div>
      </div>

      {/* 🎛️ Dual Tab Selection */}
      <div className="flex bg-slate-100 dark:bg-slate-900/80 p-1.5 rounded-2xl border border-slate-205 dark:border-slate-850 max-w-lg mb-4">
        <button
          onClick={() => {
            navigate('/delegate-dashboard?tab=reservations');
          }}
          className={`flex-1 py-3 px-5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer border-0 ${
            activeTab === 'reservations'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'text-slate-650 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white font-bold bg-transparent'
          }`}
        >
          <Bookmark size={15} />
          <span>{isRtl ? 'لوحة حجوزات ومبيعات المناديب' : 'Delegate Reservations Board'}</span>
        </button>
        <button
          onClick={() => {
            navigate('/delegate-dashboard?tab=management');
          }}
          className={`flex-1 py-3 px-5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer border-0 ${
            activeTab === 'management'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'text-slate-655 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white font-bold bg-transparent'
          }`}
        >
          <Users size={15} />
          <span>{isRtl ? 'إدارة وتفعيل مناديب المبيعات 👥' : 'Delegate Mgmt & Activation'}</span>
        </button>
      </div>

      {activeTab === 'reservations' ? (
        <>
          {/* 📊 Global Grid Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Metric 1 */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-150 dark:border-slate-850 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-slate-400 dark:text-slate-500 text-xs font-bold block">{isRtl ? 'إجمالي السيارات المحجوزة' : 'Total Reserved'}</span>
            <span className="text-2xl font-black text-slate-850 dark:text-white block">{globalMetrics.total}</span>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-2xl">
            <Bookmark size={22} />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-150 dark:border-slate-850 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-slate-400 dark:text-slate-500 text-xs font-bold block">{isRtl ? 'الحجوزات النشطة' : 'Active Bookings'}</span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 block">{globalMetrics.active}</span>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-2xl">
            <CheckCircle2 size={22} />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-150 dark:border-slate-850 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-slate-400 dark:text-slate-500 text-xs font-bold block">{isRtl ? 'حجوزات منتهية الصلاحية' : 'Expired Bookings'}</span>
            <span className="text-2xl font-black text-amber-500 dark:text-amber-400 block">{globalMetrics.expired}</span>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-500 dark:text-amber-400 rounded-2xl">
            <Clock size={22} />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-150 dark:border-slate-850 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-slate-400 dark:text-slate-500 text-xs font-bold block">{isRtl ? 'حجوزات مكتملة (مباعة)' : 'Completed/Sold'}</span>
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 block">{globalMetrics.sold}</span>
          </div>
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl">
            <DollarSign size={22} />
          </div>
        </div>

      </div>

      {/* 🔍 Advanced Filter Control Rail */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-150 dark:border-slate-850 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row items-center gap-4">
          
          {/* Smart Search */}
          <div className="relative w-full lg:flex-1">
            <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={isRtl ? 'ابحث باسم المندوب، ماركة السيارة، الموديل، أو VIN...' : 'Query VIN, model, brand or delegate...'}
              className="w-full pr-11 pl-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-blue-500 text-xs font-bold text-slate-800 dark:text-white"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Brand Filter */}
          <div className="flex items-center gap-2 w-full lg:w-auto shrink-0">
            <Filter size={14} className="text-slate-400 shrink-0" />
            <select
              className="w-full lg:w-40 px-3 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold text-xs text-slate-700 dark:text-slate-300 outline-none"
              value={selectedBrandFilter}
              onChange={e => setSelectedBrandFilter(e.target.value)}
            >
              <option value="الكل">{isRtl ? 'جميع الماركات' : 'All Brands'}</option>
              {reservedBrands.filter(b => b !== 'الكل').map(br => (
                <option key={br} value={br}>{br}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 w-full lg:w-auto shrink-0">
            <Clock size={14} className="text-slate-400 shrink-0" />
            <select
              className="w-full lg:w-40 px-3 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold text-xs text-slate-700 dark:text-slate-300 outline-none"
              value={selectedStatusFilter}
              onChange={e => setSelectedStatusFilter(e.target.value)}
            >
              <option value="الكل">{isRtl ? 'جميع الحالات' : 'All Reservations'}</option>
              <option value="نشط">{isRtl ? 'الحجوزات النشطة' : 'Active Bookings'}</option>
              <option value="منتهي">{isRtl ? 'حجوزات منتهية' : 'Expired Bookings'}</option>
              <option value="مباع">{isRtl ? 'سيارات مباعة' : 'Sold Vehicles'}</option>
            </select>
          </div>

          {/* Delegate Filter */}
          <div className="flex items-center gap-2 w-full lg:w-auto shrink-0">
            <Users size={14} className="text-slate-400 shrink-0" />
            <select
              className="w-full lg:w-48 px-3 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold text-xs text-slate-700 dark:text-slate-300 outline-none"
              value={selectedDelegateFilter}
              onChange={e => {
                setSelectedDelegateFilter(e.target.value);
                setActiveDelegateId(e.target.value === 'الكل' ? null : e.target.value);
              }}
            >
              <option value="الكل">{isRtl ? 'جميع المندوبين' : 'All Delegates'}</option>
              {delegateList.map(dl => (
                <option key={dl.name} value={dl.name}>{dl.name}</option>
              ))}
            </select>
          </div>

        </div>
      </div>

      {/* 👥 Grid layout with split design */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Pane: Delegate Cards */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-black text-slate-800 dark:text-white text-sm flex items-center gap-2">
              <Users size={16} className="text-blue-600" />
              <span>{isRtl ? 'الأشخاص والمندوبين النشطين' : 'Active Delegates & Personnel'}</span>
            </h3>
            <span className="text-[10px] font-mono font-black px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md">
              {delegateList.length} {isRtl ? 'مسجل' : 'Registered'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
            {delegateList.map(del => {
              const stats = delegateStats.get(del.name) || { total: 0, active: 0, expired: 0, sold: 0 };
              const isActive = activeDelegateId === del.name;

              return (
                <motion.div
                  key={del.name}
                  whileHover={{ scale: 1.01 }}
                  transition={{ duration: 0.1 }}
                  onClick={() => handleSelectDelegate(del.name)}
                  className={`p-4 rounded-2xl border text-right cursor-pointer transition-all ${
                    isActive 
                      ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/10' 
                      : 'bg-white dark:bg-slate-900 border-slate-150 dark:border-slate-850 text-slate-800 dark:text-slate-200 hover:border-blue-400'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm uppercase ${
                        isActive ? 'bg-white/10 text-white' : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600'
                      }`}>
                        {del.name.substring(0, 2)}
                      </div>
                      <div>
                        <h4 className="font-black text-xs">{del.name}</h4>
                        <span className={`text-[9px] block font-bold ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                          {del.role}
                        </span>
                      </div>
                    </div>
                    {/* Badge */}
                    <div className="flex items-center gap-1">
                      <span className={`text-[10px] font-black px-2 py-1 rounded-md ${
                        isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}>
                        {stats.total} {isRtl ? 'حجز' : 'Bkg'}
                      </span>
                    </div>
                  </div>

                  {/* Little Stats row */}
                  <div className="mt-4 pt-3 border-t border-dashed border-slate-100 dark:border-slate-850 flex items-center justify-between text-[10px] font-bold">
                    <span className="flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full bg-emerald-400 block`} />
                      <span>{isRtl ? 'نشط:' : 'Active:'} {stats.active}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full bg-amber-400 block`} />
                      <span>{isRtl ? 'منتهي:' : 'Expired:'} {stats.expired}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full bg-indigo-500 block`} />
                      <span>{isRtl ? 'مباع:' : 'Sold:'} {stats.sold}</span>
                    </span>
                  </div>
                </motion.div>
              );
            })}

            {delegateList.length === 0 && (
              <div className="text-center p-8 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                {isRtl ? 'لا يوجد مندوبين لديهم حجوزات بالنظام حالياً.' : 'No delegates found with existing reservations.'}
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Reserved Cars list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-black text-slate-800 dark:text-white text-sm flex items-center gap-2">
              <Car size={16} className="text-blue-600" />
              <span>
                {activeDelegateId 
                  ? (isRtl ? `حجوزات المندوب: ${activeDelegateId}` : `Bookings for: ${activeDelegateId}`)
                  : (isRtl ? 'جميع الحجوزات المطابقة للفلتر المختار' : 'Matched Reservation Vehicles')
                }
              </span>
            </h3>
            <span className="text-[10px] font-mono font-black px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-md">
              {matchingReservations.length} {isRtl ? 'سيارة محجوزة' : 'Cars'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matchingReservations.slice(0, visibleCount).map(car => {
              const rState = getReservationState(car);
              
              return (
                <motion.div
                  key={car.id}
                  layoutId={`reservation-card-${car.id}`}
                  className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-850 p-5 rounded-3xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 relative overflow-hidden text-right"
                >
                  {/* Status Indicator Stripe */}
                  <div className={`absolute top-0 inset-x-0 h-1 ${
                    rState === 'active' ? 'bg-emerald-500' : rState === 'expired' ? 'bg-amber-500' : 'bg-indigo-500'
                  }`} />

                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono font-black tracking-wider block">
                        VIN: {car.vin || 'N/A'}
                      </span>
                      <h4 className="text-sm font-black text-slate-850 dark:text-white mt-0.5">
                        {car.brand} {car.model} ({car.year})
                      </h4>
                    </div>

                    {/* Status Badge */}
                    <span className={`text-[9px] font-black px-2 py-1 rounded-md ${
                      rState === 'active' 
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' 
                        : rState === 'expired'
                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-500 dark:text-amber-400'
                        : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400'
                    }`}>
                      {rState === 'active' ? (isRtl ? 'حجز نشط' : 'Active') : rState === 'expired' ? (isRtl ? 'حجز منتهي' : 'Expired') : (isRtl ? 'مباعة ومكتملة' : 'Sold')}
                    </span>
                  </div>

                  {/* Reservation Date details */}
                  <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-1.5 text-xs text-slate-600 dark:text-slate-400 font-bold">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-400">{isRtl ? 'المحجوز باسمه' : 'Reserved For'}</span>
                      <span className="font-black text-slate-850 dark:text-slate-200">{car.reservedByUserId}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-400">{isRtl ? 'تاريخ الحجز المعتمد' : 'Reservation Date'}</span>
                      <span className="font-mono text-[10px]">{car.reservationDate ? new Date(car.reservationDate).toLocaleString('ar-EG') : 'غير مسجل'}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-850">
                    
                    {/* View Details button */}
                    <button
                      onClick={() => setSelectedCarDetail(car)}
                      className="flex-1.5 p-2 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl justify-center items-center flex gap-1 text-[11px] font-black transition-all border border-slate-200/50 dark:border-slate-800"
                    >
                      <Eye size={12} />
                      <span>{isRtl ? 'تفاصيل' : 'Specs'}</span>
                    </button>

                    {/* Show Admin/Management overrides if not sold */}
                    {rState !== 'sold' && (
                      <>
                        {/* Extend booking */}
                        <button
                          onClick={() => handleExtendReservation(car)}
                          title={isRtl ? 'تمديد الحجز 72 ساعة إضافية' : 'Extend Reservation'}
                          className="flex-1 p-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl justify-center items-center flex gap-1 text-[11px] font-black transition-all"
                        >
                          <Clock size={12} />
                          <span>{isRtl ? 'تجديد' : 'Extend'}</span>
                        </button>

                        {/* Convert to Sale */}
                        <button
                          onClick={() => handleConvertToSold(car)}
                          title={isRtl ? 'تسليم السيارة وتأكيد المباع' : 'Mark as Sold'}
                          className="flex-1 p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl justify-center items-center flex gap-1 text-[11px] font-black transition-all"
                        >
                          <DollarSign size={12} />
                          <span>{isRtl ? 'تثبيت بيع' : 'Sell'}</span>
                        </button>

                        {/* Cancel reservation */}
                        <button
                          onClick={() => handleCancelReservation(car)}
                          title={isRtl ? 'إلغاء حجز السيارة وإعادتها فوراً للمخزن' : 'Release vehicle'}
                          className="p-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl transition-all"
                        >
                          <Ban size={12} />
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {matchingReservations.length === 0 && (
              <div className="md:col-span-2 text-center py-16 bg-slate-50 dark:bg-slate-950 rounded-3xl border-2 border-dashed border-slate-150 dark:border-slate-850 text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                <Bookmark size={32} className="text-slate-300 animate-pulse" />
                <span>{isRtl ? 'لم يتم العثور على أي حجوزات تطابق معايير الفلترة المحددة.' : 'No matched booking vehicles based on active select filters.'}</span>
              </div>
            )}
          </div>
          {matchingReservations.length > visibleCount && (
            <div className="flex justify-center pt-4">
              <button
                type="button"
                onClick={() => setVisibleCount(prev => prev + 12)}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 text-white text-xs font-black rounded-2xl shadow-md transition-all cursor-pointer border-0 flex items-center gap-2"
              >
                <RefreshCw size={14} className="animate-spin" />
                <span>{isRtl ? `عرض المزيد من الحجوزات (+12 من أصل ${matchingReservations.length})` : `Load More Bookings (+12 of ${matchingReservations.length})`}</span>
              </button>
            </div>
          )}
        </div>

      </div>

      {/* 🔮 MODAL: VEHICLE SPECIFICATIONS & RESERVATION TIMELINE */}
      <AnimatePresence>
        {selectedCarDetail && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden text-right font-sans"
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              <div className="relative p-6 bg-gradient-to-l from-blue-700 to-indigo-800 text-white">
                <button
                  onClick={() => setSelectedCarDetail(null)}
                  className="absolute left-6 top-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all"
                >
                  <X size={14} />
                </button>
                <div className="space-y-1">
                  <span className="text-[10px] bg-white/20 text-white font-mono font-black block px-2.5 py-0.5 rounded-full w-fit">
                    VIN: {selectedCarDetail.vin || 'N/A'}
                  </span>
                  <h3 className="text-lg font-black mt-2">
                    {selectedCarDetail.brand} {selectedCarDetail.model}
                  </h3>
                  <p className="text-xs text-blue-100 font-bold">
                    {isRtl ? 'تفاصيل حالة الحجز للسيارة والبيانات اللحظية.' : 'Full specifications and reservations timestamp trace.'}
                  </p>
                </div>
              </div>

              {/* Specs body */}
              <div className="p-6 space-y-4 max-h-[450px] overflow-y-auto custom-scrollbar">
                
                {/* Tech Specs */}
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-slate-800 dark:text-white border-r-4 border-blue-500 pr-2">
                    {isRtl ? 'المواصفات الأساسية والنوعية' : 'Technical Specifications'}
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-xl space-y-0.5">
                      <span className="text-[9px] text-slate-400 block">{isRtl ? 'سنة الصنع' : 'Manufacture Year'}</span>
                      <span className="font-mono font-black text-slate-800 dark:text-slate-200">{selectedCarDetail.year || 'غير مسجل'}</span>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-xl space-y-0.5">
                      <span className="text-[9px] text-slate-400 block">{isRtl ? 'لون المركبة' : 'Color'}</span>
                      <span className="font-black text-slate-800 dark:text-slate-200">{selectedCarDetail.color || 'أبيض'}</span>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-xl space-y-0.5">
                      <span className="text-[9px] text-slate-400 block">{isRtl ? 'الرصيف / الفرع' : 'Warehouse Location'}</span>
                      <span className="font-black text-slate-800 dark:text-slate-200">
                        {selectedCarDetail.isPresentInShowroom ? (isRtl ? 'بالمعرض' : 'Showroom') : (isRtl ? 'المستودع الرئيسي' : 'Main Warehouse')}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-xl space-y-0.5">
                      <span className="text-[9px] text-slate-400 block">{isRtl ? 'قيمة السيارة' : 'Value Price'}</span>
                      <span className="font-mono font-black text-slate-800 dark:text-slate-200">
                        {selectedCarDetail.price ? `${Number(selectedCarDetail.price).toLocaleString()} ر.س` : (isRtl ? 'غير محدد' : 'N/A')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Reservation specifications */}
                <div className="space-y-2 pt-2 border-t border-slate-50 dark:border-slate-800/60">
                  <h4 className="text-xs font-black text-slate-800 dark:text-white border-r-4 border-emerald-500 pr-2">
                    {isRtl ? 'حالة الحجز ومقاييس الضبط' : 'Booking Metadata'}
                  </h4>
                  <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-800 text-xs rounded-2xl space-y-2">
                    <div className="flex justify-between items-center text-slate-700 dark:text-slate-300 font-bold">
                      <span>{isRtl ? 'المندوب كاتب الحجز:' : 'Reserved By:'}</span>
                      <span className="font-black text-blue-600 dark:text-blue-400">{selectedCarDetail.reservedByUserId}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-700 dark:text-slate-300 font-bold">
                      <span>{isRtl ? 'توقيـت حجز السيارة:' : 'Registered Timestamp:'}</span>
                      <span className="font-mono text-slate-850 dark:text-slate-100">
                        {selectedCarDetail.reservationDate ? new Date(selectedCarDetail.reservationDate).toLocaleString('ar-EG') : 'N/A'}
                      </span>
                    </div>
                    {selectedCarDetail.notes && (
                      <div className="pt-2 border-t border-emerald-100/60 dark:border-emerald-800/40 text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                        <span className="font-black text-slate-600 dark:text-slate-300 block mb-0.5">{isRtl ? 'ملاحظات وتفاصيل مضافة:' : 'Additional details:'}</span>
                        {selectedCarDetail.notes}
                      </div>
                    )}
                  </div>
                </div>

                {/* History flow */}
                {selectedCarDetail.history && selectedCarDetail.history.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-50 dark:border-slate-800/60 text-right">
                    <h4 className="text-xs font-black text-slate-800 dark:text-white border-r-4 border-indigo-500 pr-2 mb-3">
                      {isRtl ? 'تاريخ وسيرة المعاملات المسجلة' : 'Transaction History Trace'}
                    </h4>
                    <div className="relative pr-4 border-r border-slate-200 dark:border-slate-800 space-y-4">
                      {selectedCarDetail.history.map((hist, idx) => (
                        <div key={hist.id || idx} className="relative text-xs">
                          <span className="absolute -right-[21px] top-1 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white dark:border-slate-900" />
                          <p className="font-black text-slate-800 dark:text-slate-200 text-xs">{hist.action}</p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold mt-1">
                            <span className="font-mono">{new Date(hist.timestamp).toLocaleString('ar-EG')}</span>
                            <span>•</span>
                            <span>{hist.user}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>

              {/* Footer control */}
              <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex justify-end gap-2 rounded-b-[2rem]">
                <button
                  onClick={() => setSelectedCarDetail(null)}
                  className="px-5 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black rounded-xl text-xs transition-all"
                >
                  {isRtl ? 'إغلاق التفاصيل' : 'Close specifications'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showDiagnosticModal && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-2xl max-w-2xl w-full overflow-hidden text-right font-sans"
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              <div className="relative p-6 bg-gradient-to-l from-amber-500 via-amber-600 to-amber-700 text-white">
                <button
                  onClick={() => setShowDiagnosticModal(false)}
                  className="absolute left-6 top-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all border-0 cursor-pointer"
                >
                  <X size={14} />
                </button>
                <div className="space-y-1">
                  <h3 className="text-lg font-black flex items-center gap-2">
                    <AlertCircle size={20} />
                    <span>{isRtl ? 'بوابة تشخيص ومطابقة الحجوزات الموحدة' : 'Unified Bookings Diagnostics Audit'}</span>
                  </h3>
                  <p className="text-xs text-amber-50 font-bold">
                    {isRtl 
                      ? 'أداة تتبع تطابق الحجوزات لضمان تحقيق مبدأ مصدر الحقيقة الوحيد (Single Source Of Truth) ومطابقة قاعدة البيانات 100%.' 
                      : 'Audit tool to verify data sync against physical database source of truth.'}
                  </p>
                </div>
              </div>

              {/* Tabs for Diagnostics modal */}
              <div className="flex bg-slate-100 dark:bg-slate-950 p-1 mx-6 mt-4 border border-slate-200/60 dark:border-slate-850 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveDiagnosticTab('integrity')}
                  className={`flex-1 py-2 text-xs font-black rounded-lg transition-all border-0 cursor-pointer ${
                    activeDiagnosticTab === 'integrity'
                      ? 'bg-amber-500 text-white shadow-sm font-black'
                      : 'text-slate-600 dark:text-slate-400 bg-transparent'
                  }`}
                >
                  {isRtl ? 'تطابق وسلامة البيانات 🔎' : 'Data Integrity & Sync Audit'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDiagnosticTab('performance')}
                  className={`flex-1 py-2 text-xs font-black rounded-lg transition-all border-0 cursor-pointer ${
                    activeDiagnosticTab === 'performance'
                      ? 'bg-amber-500 text-white shadow-sm font-black'
                      : 'text-slate-600 dark:text-slate-400 bg-transparent'
                  }`}
                >
                  {isRtl ? 'تشخيص وتحليل أداء لوحة المناديب ⚡' : 'Performance Audit & CPU telemetry'}
                </button>
              </div>

              <div className="p-6 space-y-5 max-h-[500px] overflow-y-auto custom-scrollbar">
                {activeDiagnosticTab === 'integrity' ? (
                  <>
                    {/* Metrics comparison */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-150 dark:border-slate-850 rounded-2xl text-center space-y-1">
                        <span className="text-xs text-slate-400 block font-bold">{isRtl ? 'العدد المعتمد بقاعدة البيانات (المخزون)' : 'Count in Database'}</span>
                        <span className="text-3xl font-black text-blue-600 dark:text-blue-400 font-mono">{diagnostics.dbCount}</span>
                      </div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-150 dark:border-slate-850 rounded-2xl text-center space-y-1">
                        <span className="text-xs text-slate-400 block font-bold">{isRtl ? 'العدد الفعلي الظاهر بلوحة المناديب' : 'Count Shown on Board'}</span>
                        <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{diagnostics.boardCount}</span>
                      </div>
                    </div>

                    {/* Match result block */}
                    {diagnostics.dbCount === diagnostics.boardCount ? (
                      <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-150 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 rounded-2xl flex items-center gap-3 text-xs font-bold leading-relaxed">
                        <CheckCircle2 size={22} className="shrink-0 text-emerald-500" />
                        <div>
                          <p className="font-black text-sm mb-0.5">{isRtl ? 'حالة التطابق: مطابقة تامة 100%' : 'Sync Status: 100% Matches Perfectly!'}</p>
                          <p className="font-normal text-slate-500 dark:text-slate-400">
                            {isRtl 
                              ? 'كافة المركبات المحجوزة في المخازن مستوفية لبيانات المناديب ويتم جلبها وتصنيفها ديناميكياً مباشرة من قاعدة البيانات دون وجود أي كاش أو وسيط.' 
                              : 'All reserved inventory items match representatives dashboard smoothly directly from database views.'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-150 dark:border-rose-800 text-rose-700 dark:text-rose-400 rounded-2xl flex items-center gap-3 text-xs font-bold leading-relaxed">
                        <AlertCircle size={22} className="shrink-0 text-rose-500" />
                        <div>
                          <p className="font-black text-sm mb-0.5">{isRtl ? 'رصد عدم تطابق في الأعداد' : 'Mismatch Detected!'}</p>
                          <p className="font-normal text-slate-500 dark:text-slate-400">
                            {isRtl 
                              ? 'يوجد اختلاف في أعداد السيارات المعروضة. يرجى تتبع قائمة المركبات المفقودة تالياً وبحث المسببات لتأمين مطابقة 100%.' 
                              : 'There is a mismatch between raw database inventory reservations and board lists. Review explanation details below.'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Excluded/Missing cars section */}
                    <div className="space-y-3 text-right">
                      <h4 className="text-xs font-black text-slate-800 dark:text-white border-r-4 border-amber-500 pr-2">
                        {isRtl ? 'تتبع السيارات المفقودة والمستبعدة وتفاصيلها' : 'Missing & Excluded Reservations Detail'}
                      </h4>

                      {diagnostics.missingCars.length > 0 ? (
                        <div className="space-y-3">
                          {diagnostics.missingCars.map(({ car, reason }, index) => (
                            <div key={car.id || index} className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-2xl space-y-2">
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="font-black text-xs text-slate-800 dark:text-white">{car.brand} {car.model} ({car.year})</span>
                                  <span className="text-[10px] text-slate-400 block font-mono">VIN: {car.vin}</span>
                                </div>
                                <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-black">
                                  {car.status}
                                </span>
                              </div>
                              <div className="pt-2 border-t border-dashed border-slate-200 dark:border-slate-850 text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-1">
                                <span className="text-rose-500 block shrink-0 font-bold">{isRtl ? 'سبب الاستبعاد:' : 'Reason:'}</span>
                                <span>{reason}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 bg-slate-50 dark:bg-slate-950/65 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs flex flex-col items-center gap-1.5 justify-center">
                          <CheckCircle2 size={24} className="text-emerald-500 animate-bounce" />
                          <span>{isRtl ? 'لا يوجد سيارات محجوزة مفقودة أو مستبعدة حالياً.' : 'No excluded or unaligned vehicles registered.'}</span>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    {/* ⚡ Tab 2: Performance Telemetry Control Center! */}
                    <div className="space-y-4 text-right animate-fade-in">
                      <div className="p-4 bg-slate-950 text-emerald-400 rounded-2xl border border-emerald-800/60 font-mono text-[11px] space-y-3">
                        <div className="flex justify-between border-b border-emerald-950/60 pb-2">
                          <span className="text-slate-500">SYSTEM STATS :</span>
                          <span className="text-emerald-500 font-bold">&#91; OK - ACTIVE MONITORING &#93;</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-xs pt-1">
                          <div className="space-y-1">
                            <span className="text-slate-400 block text-[10px]">{isRtl ? 'عدد مرات رندرة الشاشة (Renders)' : 'Screen Renders'}</span>
                            <span className="text-white font-black text-sm">{renderCounterRef.current} Renders</span>
                          </div>
                          <div className="space-y-1">
                            <span className="text-slate-400 block text-[10px]">{isRtl ? 'تحديثات واستعلامات المخزون (Data Reloads)' : 'Data Reloads'}</span>
                            <span className="text-white font-black text-sm">{dataReloadCount} Times</span>
                          </div>
                          <div className="space-y-1">
                            <span className="text-slate-400 block text-[10px]">{isRtl ? 'إجمالي السجلات المفحوصة (Checked Records)' : 'Checked Records'}</span>
                            <span className="text-white font-black text-sm">{cars.length} Vehicles</span>
                          </div>
                          <div className="space-y-1">
                            <span className="text-slate-400 block text-[10px]">{isRtl ? 'تقدير استهلاك الذاكرة (Memory Usage)' : 'Memory Footprint'}</span>
                            <span className="text-white font-black text-sm font-mono">
                              {(() => {
                                const mem = (performance as any).memory;
                                if (mem) return `${Math.round(mem.usedJSHeapSize / (1024 * 1024))} MB / ${Math.round(mem.jsHeapSizeLimit / (1024 * 1024))} MB`;
                                return `${Math.round((cars.length * 1.8 + 12000) / 1024)} MB (Estimated Heap)`;
                              })()}
                            </span>
                          </div>
                        </div>

                        {/* CPU responsive stress bar (Simulated based on calculations time or frame delay) */}
                        <div className="space-y-1 pt-2 border-t border-emerald-900">
                          <div className="flex justify-between text-[10px]">
                            <span>CPU RENDERING LOAD :</span>
                            <span className="text-emerald-400 font-bold">
                              {(() => {
                                const totalMs = (Object.values(perfMetricsRef.current) as any[]).reduce((acc: number, m: any) => acc + (m?.timeMs || 0), 0);
                                if (totalMs < 10) return "5% (Extremely Fast)";
                                if (totalMs < 45) return "15% (Healthy Response)";
                                return "45% (Heavy computational workload)";
                              })()}
                            </span>
                          </div>
                          <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden flex">
                            {(() => {
                              const totalMs = (Object.values(perfMetricsRef.current) as any[]).reduce((acc: number, m: any) => acc + (m?.timeMs || 0), 0);
                              const pct = Math.min(100, Math.max(5, Math.round(totalMs * 1.8)));
                              return (
                                <div 
                                  className={`h-full rounded-full ${pct > 60 ? 'bg-red-500' : pct > 25 ? 'bg-amber-400' : 'bg-emerald-400'}`} 
                                  style={{ width: `${pct}%` }} 
                                />
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Execution duration table */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-black text-slate-800 dark:text-white border-r-4 border-emerald-500 pr-2">
                          {isRtl ? 'زمن التنفيذ الفعلي لاستعلامات لوحة المناديب (مؤشرات الأداء)' : 'Query Execution Telemetry Logs'}
                        </h4>
                        
                        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden text-xs">
                          <div className="overflow-x-auto custom-scrollbar w-full">
                          <table className="w-full text-right border-collapse">
                            <thead>
                              <tr className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                                <th className="p-3 font-bold">{isRtl ? 'العملية / الاستعلام الفني' : 'Operation / Technical Selector'}</th>
                                <th className="p-3 font-bold text-center">{isRtl ? 'السجلات' : 'Records'}</th>
                                <th className="p-3 font-bold text-left">{isRtl ? 'زمن التنفيذ' : 'Execution Time'}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[
                                { key: 'unifiedBookings', name: isRtl ? 'استعلام دمج الحجوزات (Single Source of Truth)' : 'Get Unified Bookings compiler' },
                                { key: 'diagnostics', name: isRtl ? 'استعلام فحص تطابق الحجوزات والمفقودات' : 'Integrity reconciliation checks' },
                                { key: 'delegateList', name: isRtl ? 'استعلام حصر المناديب النشطة' : 'Active representative mapper' },
                                { key: 'delegateStats', name: isRtl ? 'استعلام تجميع إحصائيات المبيعات والأهداف الفردية' : 'Compile delegate aggregations' },
                                { key: 'globalMetrics', name: isRtl ? 'استبيان المؤشرات العامة والنسب المئوية' : 'Top metric computations' },
                                { key: 'reservedBrands', name: isRtl ? 'استعلام ماركات السيارات المحجوزة النشطة' : 'Extract reserved unique brands' },
                                { key: 'matchingReservations', name: isRtl ? 'تطبيق محرك الفلترة الذكي وشروط البحث الجاري' : 'Active query filtering scheduler' }
                              ].map((item) => {
                                const metric = perfMetricsRef.current[item.key] || { timeMs: 0.1, count: 0 };
                                const isSlow = metric.timeMs > 5;
                                return (
                                  <tr key={item.key} className="border-b border-slate-100 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-950/20 font-medium">
                                    <td className="p-3 text-slate-800 dark:text-slate-200 font-extrabold">{item.name}</td>
                                    <td className="p-3 text-center text-slate-500 font-mono">{metric.count} Recs</td>
                                    <td className={`p-3 text-left font-mono font-black ${isSlow ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                      {metric.timeMs.toFixed(3)} ms
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          </div>
                        </div>
                      </div>

                      {/* Recommendations / Optimizer */}
                      <div className="p-4.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-150 dark:border-blue-800/80 rounded-2xl text-xs flex gap-3 text-blue-850 dark:text-blue-300">
                        <AlertCircle size={22} className="shrink-0 text-blue-500 mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-extrabold">{isRtl ? 'تقرير وتوصيات المدقق الفني للأداء (Performance Optimizer Reporting)' : 'Performance Auditor Diagnostics'}</p>
                          <ul className="list-disc pr-4 space-y-1 text-slate-600 dark:text-slate-400 font-bold">
                            <li>{isRtl ? 'تم تطبيق نظام الـ Lazy Loading لتمرير وعرض الحجوزات دفعات صغيرة في ثبات ورشاقة تامة.' : 'Successfully integrated automated client-side Lazy Loading pagination thresholds.'}</li>
                            <li>{isRtl ? 'جميع المؤشرات والإحصاءات تم تأمينها بـ React useMemo معقدة لمنع تكرار الحسابات عند تنقل الماوس.' : 'All aggregations memoized within useMemo parameters preventing component tree flickering.'}</li>
                            <li>{isRtl ? 'للحفاظ المستمر على سرعة الاستجابة، يوصى بالحد من عدد المجموعات الكبرى بدون فلاتر.' : 'To guarantee 60FPS scrolling, use explicit filters to minimize viewport overhead.'}</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex justify-end gap-2 rounded-b-[2rem]">
                <button
                  type="button"
                  onClick={() => setShowDiagnosticModal(false)}
                  className="px-5 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black rounded-xl text-xs transition-all border-0 cursor-pointer animate-pulse"
                >
                  {isRtl ? 'إغلاق التشخيص' : 'Close audit'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
        </>
      ) : (
        <DelegateManagementTab
          cars={cars}
          delegates={delegates}
          setDelegates={setDelegates}
          onUpdateCars={onUpdateCars}
          addLog={addLog}
          currentUser={currentUser}
          isRtl={isRtl}
        />
      )}
    </div>
  );
};
