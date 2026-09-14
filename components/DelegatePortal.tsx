import React, { useState, useEffect, useMemo } from 'react';
import { 
  Car as CarIcon, 
  Search, 
  Bookmark, 
  User, 
  LogOut, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  FileText, 
  FileUp, 
  Eye, 
  EyeOff, 
  X, 
  Phone, 
  Mail, 
  Lock, 
  Shield, 
  Zap, 
  ArrowRight,
  ChevronRight,
  Filter,
  Check,
  RefreshCw,
  LayoutGrid,
  List
} from 'lucide-react';
import { Car, Delegate, OrganizationSettings, CarStatus } from '../types';
import { DelegateApiService } from '../src/services/delegateApiService';

interface DelegatePortalProps {
  currentDelegate: Delegate;
  cars: Car[];
  onUpdateCar: (car: Car) => void;
  onLogout: () => void;
  settings: OrganizationSettings;
  isRtl?: boolean;
}

export const DelegatePortal: React.FC<DelegatePortalProps> = ({
  currentDelegate,
  cars,
  onUpdateCar,
  onLogout,
  settings,
  isRtl = true
}) => {
  const [activeTab, setActiveTab] = useState<'showroom' | 'my-bookings' | 'profile'>(() => {
    const h = (typeof window !== 'undefined' ? window.location.hash.toLowerCase() : '');
    if (h.includes('bookings') || h.includes('my-bookings')) return 'my-bookings';
    if (h.includes('profile')) return 'profile';
    return 'showroom';
  });

  const handleTabChange = (tab: 'showroom' | 'my-bookings' | 'profile') => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const targetHash = `#/${tab === 'showroom' ? 'showroom' : tab}`;
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash;
      }
    }
  };

  useEffect(() => {
    const onHashChange = () => {
      const h = window.location.hash.toLowerCase();
      if (h.includes('bookings') || h.includes('my-bookings')) {
        setActiveTab('my-bookings');
      } else if (h.includes('profile')) {
        setActiveTab('profile');
      } else if (h.includes('showroom')) {
        setActiveTab('showroom');
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'mine'>('all');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Booking action state
  const [confirmingReserveCar, setConfirmingReserveCar] = useState<Car | null>(null);
  const [confirmingCancelCar, setConfirmingCancelCar] = useState<Car | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Profile Form state
  const [profileName, setProfileName] = useState(currentDelegate.name || currentDelegate.username || '');
  const [profilePhone, setProfilePhone] = useState(currentDelegate.phone || '');
  const [profileEmail, setProfileEmail] = useState(currentDelegate.email || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 5000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  const delegateDisplayName = currentDelegate.name || currentDelegate.username;
  const delegateUsername = currentDelegate.username.toLowerCase();

  // Helper to check if a car is booked by this delegate
  const isCarBookedByMe = (car: Car): boolean => {
    const resUser = String(car.reservedByUserId || car.seller || '').trim().toLowerCase();
    const isReserved = (
      car.status === CarStatus.RESERVED || 
      String(car.status || '').trim() === 'محجوزة' || 
      String(car.status || '').trim() === 'محجوز'
    );
    if (!isReserved) return false;

    return (
      resUser === delegateDisplayName.toLowerCase() ||
      resUser === delegateUsername ||
      car.customData?.reservedByDelegateId === currentDelegate.id ||
      (car.statusNote && car.statusNote.toLowerCase().includes(delegateDisplayName.toLowerCase()))
    );
  };

  // Helper to check if a car is available
  const isCarAvailable = (car: Car): boolean => {
    const st = String(car.status || '').trim();
    return st === 'متوفرة' || st === 'متوفر' || st === 'Available' || car.status === CarStatus.AVAILABLE;
  };

  // Filtered cars in Showroom (only showroom-ready cars, excluding sold/outbound)
  const showroomCars = useMemo(() => {
    return cars.filter(c => {
      const isOutbound = c.isOutbound === true;
      const st = String(c.status || '').trim();
      const isSold = (st === 'مباعة' || st === 'تم البيع' || st === 'خارج المعرض');
      return !isOutbound && !isSold;
    });
  }, [cars]);

  // Distinct Brands
  const availableBrands = useMemo(() => {
    const brands = new Set<string>();
    showroomCars.forEach(c => { if (c.brand) brands.add(c.brand); });
    return Array.from(brands).sort();
  }, [showroomCars]);

  // Filtered Showroom list
  const filteredShowroomCars = useMemo(() => {
    return showroomCars.filter(car => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchBrand = (car.brand || '').toLowerCase().includes(q);
        const matchModel = (car.model || '').toLowerCase().includes(q);
        const matchVin = (car.vin || '').toLowerCase().includes(q);
        const matchColor = (car.color || '').toLowerCase().includes(q);
        const matchYear = String(car.year || '').includes(q);
        if (!matchBrand && !matchModel && !matchVin && !matchColor && !matchYear) {
          return false;
        }
      }

      // Brand filter
      if (brandFilter !== 'all' && car.brand !== brandFilter) {
        return false;
      }

      // Status filter
      if (statusFilter === 'available') {
        return isCarAvailable(car);
      }
      if (statusFilter === 'mine') {
        return isCarBookedByMe(car);
      }

      return true;
    });
  }, [showroomCars, searchQuery, brandFilter, statusFilter, currentDelegate]);

  // My Bookings list
  const myBookedCars = useMemo(() => {
    return showroomCars.filter(isCarBookedByMe);
  }, [showroomCars, currentDelegate]);

  // Total value of my bookings
  const myBookingsTotalValue = useMemo(() => {
    return myBookedCars.reduce((sum, c) => sum + (Number(c.price) || 0), 0);
  }, [myBookedCars]);

  // Instant 1-Click Auto Reservation
  const handleExecuteReservation = async () => {
    if (!confirmingReserveCar) return;
    setIsProcessing(true);

    const carToReserve = confirmingReserveCar;
    const now = new Date().toISOString();
    const updatedStatusNote = `محجوزة بواسطة المندوب: ${delegateDisplayName}`;

    const updatedCar: Car = {
      ...carToReserve,
      status: CarStatus.RESERVED,
      reservedByUserId: delegateDisplayName,
      seller: delegateDisplayName,
      statusNote: updatedStatusNote,
      reservationDate: now,
      lastModified: now,
      customData: {
        ...(carToReserve.customData || {}),
        reservedByDelegateId: currentDelegate.id,
        reservedByDelegateName: delegateDisplayName
      },
      history: [
        ...(carToReserve.history || []),
        {
          id: 'hist-' + Date.now(),
          action: `حجز سيارة تلقائي مباشر بواسطة المندوب: ${delegateDisplayName}`,
          timestamp: now,
          user: delegateDisplayName
        }
      ]
    };

    // 1. Optimistic UI update
    onUpdateCar(updatedCar);

    // 2. Call backend delegate reserve API
    try {
      await DelegateApiService.reserveCar(carToReserve.id);
    } catch (err) {
      console.warn('Backend API reserve call notification:', err);
    }

    setIsProcessing(false);
    setConfirmingReserveCar(null);
    setToastMessage({
      type: 'success',
      text: `تم حجز السيارة ${carToReserve.brand} ${carToReserve.model} بنجاح وتسجيل الحجز باسمك (${delegateDisplayName}) في المخزون!`
    });
  };

  // Cancel Reservation
  const handleExecuteCancelReservation = async () => {
    if (!confirmingCancelCar) return;
    setIsProcessing(true);

    const carToCancel = confirmingCancelCar;
    const now = new Date().toISOString();

    const updatedCar: Car = {
      ...carToCancel,
      status: CarStatus.AVAILABLE,
      reservedByUserId: undefined,
      seller: undefined,
      statusNote: undefined,
      reservationDate: undefined,
      lastModified: now,
      history: [
        ...(carToCancel.history || []),
        {
          id: 'hist-' + Date.now(),
          action: `إلغاء حجز السيارة وإعادتها للمعرض بواسطة المندوب: ${delegateDisplayName}`,
          timestamp: now,
          user: delegateDisplayName
        }
      ]
    };

    if (updatedCar.customData) {
      delete updatedCar.customData.reservedByDelegateId;
      delete updatedCar.customData.reservedByDelegateName;
    }

    // 1. Optimistic UI update
    onUpdateCar(updatedCar);

    // 2. Call backend delegate cancel API
    try {
      await DelegateApiService.cancelReservation(carToCancel.id);
    } catch (err) {
      console.warn('Backend API cancel-reserve call notification:', err);
    }

    setIsProcessing(false);
    setConfirmingCancelCar(null);
    setToastMessage({
      type: 'success',
      text: `تم إلغاء حجز السيارة ${carToCancel.brand} ${carToCancel.model} وإعادتها فوراً للمخزون المتاح بالمعرض.`
    });
  };

  // Save Profile Changes
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    if (newPassword && newPassword.length < 6) {
      setProfileError('يجب أن تتكون كلمة المرور الجديدة من 6 أحرف أو أرقام على الأقل.');
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setProfileError('كلمتا المرور غير متطابقتين.');
      return;
    }

    setIsProcessing(true);
    const updatePayload: { name: string; phone: string; email: string; password?: string } = {
      name: profileName.trim(),
      phone: profilePhone.trim(),
      email: profileEmail.trim()
    };
    if (newPassword) {
      updatePayload.password = newPassword;
    }

    const res = await DelegateApiService.updateProfile(updatePayload);
    setIsProcessing(false);

    if (res.success) {
      setProfileSuccess('تم حفظ وتحديث بياناتك الشخصية بنجاح.');
      setNewPassword('');
      setConfirmPassword('');
      if (res.delegate) {
        currentDelegate.name = res.delegate.name;
        currentDelegate.phone = res.delegate.phone;
        currentDelegate.email = res.delegate.email;
      }
    } else {
      setProfileError(res.message || 'فشل تحديث البيانات الشخصية.');
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white overflow-y-auto" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Top Notification Toast */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] max-w-lg w-full px-4 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className={`p-4 rounded-2xl shadow-2xl border flex items-center justify-between gap-3 ${
            toastMessage.type === 'success' 
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200' 
              : 'bg-rose-950/90 border-rose-500/50 text-rose-200'
          }`}>
            <div className="flex items-center gap-3">
              {toastMessage.type === 'success' ? <CheckCircle2 size={20} className="text-emerald-400 shrink-0" /> : <AlertCircle size={20} className="text-rose-400 shrink-0" />}
              <p className="text-xs font-black leading-relaxed">{toastMessage.text}</p>
            </div>
            <button 
              onClick={() => setToastMessage(null)}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Modern Header */}
      <header className="bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          {/* Brand & Portal Identity */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-blue-500/20">
              <CarIcon size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black text-white tracking-tight">{settings?.name || 'مخزوني المعتمد'}</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  بوابة المناديب
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-bold">صالة العرض وحجز المركبات الفوري</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-2xl border border-slate-800">
            <button
              onClick={() => handleTabChange('showroom')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'showroom'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <CarIcon size={15} />
              <span>صالة العرض المتاحة</span>
            </button>

            <button
              onClick={() => handleTabChange('my-bookings')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer relative ${
                activeTab === 'my-bookings'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Bookmark size={15} />
              <span>حجوزاتي</span>
              {myBookedCars.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 shadow-xs">
                  {myBookedCars.length}
                </span>
              )}
            </button>

            <button
              onClick={() => handleTabChange('profile')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <User size={15} />
              <span>بياناتي الشخصية</span>
            </button>
          </nav>

          {/* User Profile & Logout */}
          <div className="flex items-center gap-3">
            <div className="text-left rtl:text-right hidden sm:block">
              <p className="text-xs font-black text-slate-200 leading-tight">{delegateDisplayName}</p>
              <p className="text-[10px] text-slate-400 font-mono">@{currentDelegate.username}</p>
            </div>
            <button
              onClick={onLogout}
              className="p-2.5 bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-900/50 rounded-2xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-black"
              title="تسجيل الخروج"
            >
              <LogOut size={16} />
              <span className="hidden md:inline">خروج</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* ======================================================== */}
        {/* TAB 1: SHOWROOM CARS                                     */}
        {/* ======================================================== */}
        {activeTab === 'showroom' && (
          <div className="space-y-6">
            {/* Filter & Search Bar */}
            <div className="bg-slate-950/60 p-4 rounded-3xl border border-slate-800/80 shadow-xl space-y-4">
              <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
                {/* Search input */}
                <div className="relative w-full md:max-w-md">
                  <Search size={17} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث بالماركة، الموديل، اللون، أو رقم الشاصي (VIN)..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl pr-10 pl-4 py-2.5 text-xs font-bold text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Status Quick Filters */}
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  <div className="flex bg-slate-900 p-1 rounded-2xl border border-slate-800 text-xs font-black">
                    <button
                      onClick={() => setStatusFilter('all')}
                      className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                        statusFilter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      الكل ({showroomCars.length})
                    </button>
                    <button
                      onClick={() => setStatusFilter('available')}
                      className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                        statusFilter === 'available' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      المتاح للحجز ({showroomCars.filter(isCarAvailable).length})
                    </button>
                    <button
                      onClick={() => setStatusFilter('mine')}
                      className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                        statusFilter === 'mine' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      حجوزاتي ({myBookedCars.length})
                    </button>
                  </div>

                  {/* Brand select */}
                  {availableBrands.length > 0 && (
                    <select
                      value={brandFilter}
                      onChange={(e) => setBrandFilter(e.target.value)}
                      className="bg-slate-900 border border-slate-800 rounded-2xl px-3 py-2 text-xs font-bold text-slate-200 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="all">كل الماركات ({availableBrands.length})</option>
                      {availableBrands.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  )}

                  {/* View Mode Toggle */}
                  <div className="flex bg-slate-900 p-1 rounded-2xl border border-slate-800 text-slate-400">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded-xl transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-slate-800 text-blue-400' : 'hover:text-slate-200'}`}
                      title="عرض شبكي"
                    >
                      <LayoutGrid size={15} />
                    </button>
                    <button
                      onClick={() => setViewMode('table')}
                      className={`p-1.5 rounded-xl transition-all cursor-pointer ${viewMode === 'table' ? 'bg-slate-800 text-blue-400' : 'hover:text-slate-200'}`}
                      title="عرض جدول"
                    >
                      <List size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Rules Banner */}
            <div className="bg-blue-950/30 border border-blue-800/40 rounded-2xl p-3.5 flex items-center justify-between text-xs text-blue-300">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-blue-400 shrink-0" />
                <span>
                  <strong>نظام الحجز الفوري للمناديب:</strong> اضغط على <strong>"حجز السيارة فوراً"</strong> لتأكيد الحجز المباشر لحسابك تلقائياً دون إدخال أي بيانات. تتاح المستندات والبطاقة الجمركية حصرياً بعد تأكيد الحجز باسمك.
                </span>
              </div>
              <span className="text-[10px] font-mono bg-blue-900/60 px-2 py-0.5 rounded-lg border border-blue-700/50 hidden md:inline">
                {filteredShowroomCars.length} سيارة مطابقة
              </span>
            </div>

            {/* Cars List */}
            {filteredShowroomCars.length === 0 ? (
              <div className="bg-slate-950/40 border border-slate-800/60 rounded-3xl p-12 text-center space-y-3">
                <CarIcon size={40} className="mx-auto text-slate-600" />
                <h3 className="text-base font-black text-slate-300">لا توجد سيارات مطابقة لخيارات البحث</h3>
                <p className="text-xs text-slate-500">جرب تغيير كلمات البحث أو إزالة التصفية لعرض المزيد من السيارات.</p>
              </div>
            ) : viewMode === 'grid' ? (
              /* GRID VIEW */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredShowroomCars.map((car) => {
                  const available = isCarAvailable(car);
                  const bookedByMe = isCarBookedByMe(car);
                  const isReserved = !available && (
                    car.status === CarStatus.RESERVED || 
                    String(car.status || '').trim() === 'محجوزة' || 
                    String(car.status || '').trim() === 'محجوز'
                  );
                  const bookedByOther = isReserved && !bookedByMe;

                  return (
                    <div 
                      key={car.id} 
                      className={`rounded-3xl border transition-all overflow-hidden flex flex-col justify-between ${
                        bookedByMe 
                          ? 'bg-gradient-to-b from-blue-950/40 to-slate-950 border-blue-500/40 shadow-lg shadow-blue-950/20' 
                          : bookedByOther
                          ? 'bg-slate-950/40 border-slate-850 opacity-80'
                          : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Top Bar of Card */}
                      <div className="p-5 space-y-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-black uppercase text-blue-400 font-mono tracking-wider block">
                              {car.brand}
                            </span>
                            <h3 className="text-base font-black text-white leading-snug">
                              {car.model} {car.year}
                            </h3>
                          </div>

                          {/* Status Badge */}
                          {bookedByMe ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1 shrink-0">
                              <CheckCircle2 size={12} />
                              محجوزة باسمك
                            </span>
                          ) : available ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              متوفرة بالمعرض
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1 shrink-0">
                              <Clock size={12} />
                              محجوزة
                            </span>
                          )}
                        </div>

                        {/* Specs Grid */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-slate-900/80 p-2.5 rounded-2xl border border-slate-800/80">
                            <span className="text-[10px] text-slate-400 block mb-0.5">اللون الخارجي</span>
                            <span className="font-extrabold text-slate-200">{car.color || 'غير محدد'}</span>
                          </div>

                          <div className="bg-slate-900/80 p-2.5 rounded-2xl border border-slate-800/80">
                            <span className="text-[10px] text-slate-400 block mb-0.5">سعر البيع</span>
                            <span className="font-black text-emerald-400 font-mono">
                              {(Number(car.price) || 0).toLocaleString()} {settings?.currency || 'ر.س'}
                            </span>
                          </div>

                          <div className="bg-slate-900/80 p-2.5 rounded-2xl border border-slate-800/80 col-span-2">
                            <span className="text-[10px] text-slate-400 block mb-0.5">رقم الهيكل (VIN)</span>
                            <span className="font-bold text-slate-300 font-mono text-[11px] tracking-wide" dir="ltr">
                              {car.vin}
                            </span>
                          </div>
                        </div>

                        {/* Document Access Status */}
                        <div className="pt-2 border-t border-slate-850">
                          {bookedByMe ? (
                            /* Documents UNLOCKED for the delegate who booked this car */
                            <div className="bg-emerald-950/40 border border-emerald-600/30 p-2.5 rounded-2xl space-y-2">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-black text-emerald-400 flex items-center gap-1">
                                  <CheckCircle2 size={13} />
                                  المستندات الرسمية مفعلة
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  بطاقة: {car.cardNumber || 'مسجلة'}
                                </span>
                              </div>

                              {car.cardFile ? (
                                <div className="flex items-center gap-1.5 pt-1">
                                  <a
                                    href={car.cardFile}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 text-center rounded-xl text-[10px] font-black transition-colors"
                                  >
                                    معاينة البطاقة
                                  </a>
                                  <a
                                    href={car.cardFile}
                                    download={car.cardFileName || `customs_card_${car.vin}`}
                                    className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-center rounded-xl text-[10px] font-black transition-colors flex items-center justify-center gap-1"
                                  >
                                    <FileUp size={11} />
                                    تحميل المستند
                                  </a>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 block text-center">
                                  لم يتم إرفاق ملف مستند لهذه السيارة حتى الآن
                                </span>
                              )}
                            </div>
                          ) : (
                            /* Documents strictly LOCKED if not booked by this delegate */
                            <div className="bg-slate-900/50 p-2.5 rounded-2xl border border-slate-850 flex items-center gap-2 text-[11px] text-slate-500">
                              <Lock size={14} className="text-slate-500 shrink-0" />
                              <span>المستندات والبطاقة الجمركية تظهر فقط للسيارات المحجوزة باسمك.</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Action Footer */}
                      <div className="p-4 bg-slate-950 border-t border-slate-850">
                        {available ? (
                          /* Auto-Reserve Button */
                          <button
                            onClick={() => setConfirmingReserveCar(car)}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-600/25 active:scale-98"
                          >
                            <Zap size={14} />
                            <span>حجز السيارة فوراً</span>
                          </button>
                        ) : bookedByMe ? (
                          /* Cancel Reservation Button */
                          <button
                            onClick={() => setConfirmingCancelCar(car)}
                            className="w-full py-2.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <X size={14} />
                            <span>إلغاء الحجز وإعادتها للمعرض</span>
                          </button>
                        ) : (
                          /* Locked/Disabled for others */
                          <div className="py-2.5 text-center text-xs font-bold text-slate-500 bg-slate-900 rounded-2xl border border-slate-850">
                            محجوزة لجهة أخرى • غير متاحة للتعديل
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* TABLE VIEW */
              <div className="bg-slate-950/80 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800 text-[11px] font-black">
                        <th className="p-4">المركبة والموديل</th>
                        <th className="p-4">رقم الهيكل (VIN)</th>
                        <th className="p-4">اللون</th>
                        <th className="p-4">السعر</th>
                        <th className="p-4">الحالة</th>
                        <th className="p-4">المستندات</th>
                        <th className="p-4 text-center">الإجراء المتاح</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 font-bold">
                      {filteredShowroomCars.map((car) => {
                        const available = isCarAvailable(car);
                        const bookedByMe = isCarBookedByMe(car);

                        return (
                          <tr key={car.id} className="hover:bg-slate-900/40 transition-colors">
                            <td className="p-4">
                              <div className="font-black text-slate-200">{car.brand} {car.model}</div>
                              <span className="text-[10px] text-slate-400">سنة {car.year}</span>
                            </td>
                            <td className="p-4 font-mono text-slate-300 text-[11px]" dir="ltr">
                              {car.vin}
                            </td>
                            <td className="p-4 text-slate-300">
                              {car.color || '-'}
                            </td>
                            <td className="p-4 font-mono font-black text-emerald-400">
                              {(Number(car.price) || 0).toLocaleString()} {settings?.currency || 'ر.س'}
                            </td>
                            <td className="p-4">
                              {bookedByMe ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/40">
                                  محجوزة باسمك
                                </span>
                              ) : available ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                  متوفرة بالمعرض
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-800 text-slate-400">
                                  محجوزة
                                </span>
                              )}
                            </td>
                            <td className="p-4">
                              {bookedByMe && car.cardFile ? (
                                <div className="flex items-center gap-1.5">
                                  <a
                                    href={car.cardFile}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 rounded-lg text-[10px] font-bold"
                                  >
                                    معاينة
                                  </a>
                                  <a
                                    href={car.cardFile}
                                    download={car.cardFileName || `card_${car.vin}`}
                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold"
                                  >
                                    تحميل
                                  </a>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                  <Lock size={11} />
                                  مقفلة
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-center">
                              {available ? (
                                <button
                                  onClick={() => setConfirmingReserveCar(car)}
                                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[11px] font-black transition-all cursor-pointer inline-flex items-center gap-1"
                                >
                                  <Zap size={12} />
                                  حجز فوري
                                </button>
                              ) : bookedByMe ? (
                                <button
                                  onClick={() => setConfirmingCancelCar(car)}
                                  className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 rounded-xl text-[11px] font-black transition-all cursor-pointer inline-flex items-center gap-1"
                                >
                                  <X size={12} />
                                  إلغاء
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-500">غير متاح</span>
                              )}
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
        )}

        {/* ======================================================== */}
        {/* TAB 2: MY BOOKINGS                                       */}
        {/* ======================================================== */}
        {activeTab === 'my-bookings' && (
          <div className="space-y-6">
            {/* Header / Summary Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-950/70 p-5 rounded-3xl border border-slate-800 shadow-lg space-y-1">
                <span className="text-xs font-black text-slate-400">إجمالي السيارات المحجوزة</span>
                <div className="text-2xl font-black text-white flex items-center gap-2">
                  <Bookmark className="text-blue-400" size={24} />
                  <span>{myBookedCars.length} سيارات</span>
                </div>
                <p className="text-[11px] text-slate-500 font-bold">محجوزة باسم المندوب: {delegateDisplayName}</p>
              </div>

              <div className="bg-slate-950/70 p-5 rounded-3xl border border-slate-800 shadow-lg space-y-1">
                <span className="text-xs font-black text-slate-400">إجمالي القيمة المالية للحجوزات</span>
                <div className="text-2xl font-black text-emerald-400 font-mono">
                  {myBookingsTotalValue.toLocaleString()} {settings?.currency || 'ر.س'}
                </div>
                <p className="text-[11px] text-slate-500 font-bold">حسب أسعار البيع المسجلة بالمعرض</p>
              </div>

              <div className="bg-slate-950/70 p-5 rounded-3xl border border-slate-800 shadow-lg space-y-1">
                <span className="text-xs font-black text-slate-400">حالة الصلاحيات والمستندات</span>
                <div className="text-lg font-black text-blue-300 flex items-center gap-2 mt-1">
                  <FileText className="text-blue-400" size={20} />
                  <span>مستندات كاملة ومتاحة للتحميل</span>
                </div>
                <p className="text-[11px] text-slate-500 font-bold">يمكنك معاينة وتحميل البطاقات الجمركية لأي سيارة حجزتها</p>
              </div>
            </div>

            {/* Bookings List */}
            {myBookedCars.length === 0 ? (
              <div className="bg-slate-950/40 border border-slate-800 rounded-3xl p-12 text-center space-y-4">
                <Bookmark size={40} className="mx-auto text-slate-600" />
                <h3 className="text-base font-black text-slate-300">لا توجد لديك سيارات محجوزة حالياً</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  يمكنك الذهاب إلى تبويب "صالة العرض المتاحة" لاختيار أي سيارة متوفرة والضغط على "حجز السيارة فوراً" لتأكيد حجزها باسمك مباشرة.
                </p>
                <button
                  onClick={() => handleTabChange('showroom')}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-black transition-all cursor-pointer inline-flex items-center gap-2"
                >
                  <CarIcon size={16} />
                  <span>استعراض صالة العرض</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myBookedCars.map((car) => (
                  <div 
                    key={car.id}
                    className="bg-slate-950/90 rounded-3xl border border-blue-500/30 p-5 space-y-4 shadow-xl flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-black uppercase text-blue-400 font-mono tracking-wider block">
                            {car.brand}
                          </span>
                          <h3 className="text-base font-black text-white">
                            {car.model} {car.year}
                          </h3>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1">
                          <CheckCircle2 size={12} />
                          محجوزة لحسابك
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-900 p-2.5 rounded-2xl border border-slate-800">
                          <span className="text-[10px] text-slate-400 block mb-0.5">رقم الهيكل</span>
                          <span className="font-bold text-slate-200 font-mono text-[11px]" dir="ltr">{car.vin}</span>
                        </div>
                        <div className="bg-slate-900 p-2.5 rounded-2xl border border-slate-800">
                          <span className="text-[10px] text-slate-400 block mb-0.5">السعر المسجل</span>
                          <span className="font-black text-emerald-400 font-mono">
                            {(Number(car.price) || 0).toLocaleString()} {settings?.currency || 'ر.س'}
                          </span>
                        </div>
                        <div className="bg-slate-900 p-2.5 rounded-2xl border border-slate-800">
                          <span className="text-[10px] text-slate-400 block mb-0.5">اللون</span>
                          <span className="font-bold text-slate-200">{car.color || '-'}</span>
                        </div>
                        <div className="bg-slate-900 p-2.5 rounded-2xl border border-slate-800">
                          <span className="text-[10px] text-slate-400 block mb-0.5">تاريخ الحجز</span>
                          <span className="font-bold text-slate-300 font-mono text-[10px]">
                            {car.reservationDate ? new Date(car.reservationDate).toLocaleDateString('ar-SA') : 'مسجل حديثاً'}
                          </span>
                        </div>
                      </div>

                      {/* Customs Card & Documents Section */}
                      <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-black text-slate-300 flex items-center gap-1.5">
                            <FileText size={14} className="text-blue-400" />
                            مستند البطاقة الجمركية:
                          </span>
                          <span className="font-mono text-slate-400 text-[11px]">
                            {car.cardNumber || 'غير مدرج'}
                          </span>
                        </div>

                        {car.cardFile ? (
                          <div className="flex gap-2 pt-1">
                            <a
                              href={car.cardFile}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 py-2 bg-blue-600/25 hover:bg-blue-600/40 text-blue-200 text-center rounded-xl text-xs font-black transition-colors"
                            >
                              معاينة المستند
                            </a>
                            <a
                              href={car.cardFile}
                              download={car.cardFileName || `customs_card_${car.vin}`}
                              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-center rounded-xl text-xs font-black transition-colors flex items-center justify-center gap-1.5"
                            >
                              <FileUp size={13} />
                              تحميل البطاقة الجمركية
                            </a>
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-500 italic text-center pt-1">
                            لم يتم رفع ملف رقمي للبطاقة الجمركية لهذه السيارة بعد.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Cancel Booking Action */}
                    <div className="pt-3 border-t border-slate-850">
                      <button
                        onClick={() => setConfirmingCancelCar(car)}
                        className="w-full py-2.5 bg-rose-600/15 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <X size={14} />
                        <span>إلغاء حجز هذه السيارة وإعادتها للمعرض</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: MY PROFILE                                        */}
        {/* ======================================================== */}
        {activeTab === 'profile' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-slate-950/80 p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl space-y-6">
              <div className="border-b border-slate-800 pb-4">
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <User className="text-blue-400" size={20} />
                  <span>تعديل البيانات الشخصية للمندوب</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  يمكنك تحديث اسمك، رقم جوالك، بريدك الإلكتروني، وتعيين كلمة مرور جديدة لحسابك.
                </p>
              </div>

              {profileSuccess && (
                <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>{profileSuccess}</span>
                </div>
              )}

              {profileError && (
                <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs font-bold flex items-center gap-2">
                  <AlertCircle size={16} className="text-rose-400 shrink-0" />
                  <span>{profileError}</span>
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-4 text-xs font-bold">
                {/* Username (Read Only) */}
                <div className="space-y-1.5">
                  <label className="text-slate-400 block">اسم المستخدم لتسجيل الدخول (ثابت)</label>
                  <input
                    type="text"
                    disabled
                    value={currentDelegate.username}
                    className="w-full bg-slate-900/50 border border-slate-800/80 rounded-2xl px-4 py-3 text-slate-400 font-mono cursor-not-allowed text-right"
                  />
                  <span className="text-[10px] text-slate-500">اسم المستخدم يتم إدارته من قِبل إدارة المعرض ولا يمكن تغييره.</span>
                </div>

                {/* Display Name */}
                <div className="space-y-1.5">
                  <label className="text-slate-300 block">الاسم الكامل للمندوب (يظهر في الحجوزات والمخزون)</label>
                  <input
                    type="text"
                    required
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="مثال: صالح محمد الودعاني"
                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-slate-100 focus:border-blue-500 focus:outline-none text-right"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <label className="text-slate-300 block">رقم الجوال للتواصل</label>
                  <input
                    type="text"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    placeholder="05xxxxxxxx"
                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-slate-100 font-mono focus:border-blue-500 focus:outline-none text-right"
                    dir="ltr"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-slate-300 block">البريد الإلكتروني (اختياري)</label>
                  <input
                    type="email"
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    placeholder="delegate@example.com"
                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-slate-100 font-mono focus:border-blue-500 focus:outline-none text-right"
                    dir="ltr"
                  />
                </div>

                {/* Password Change Divider */}
                <div className="pt-4 border-t border-slate-800 space-y-4">
                  <h4 className="font-black text-slate-300 flex items-center gap-1.5">
                    <Lock size={14} className="text-amber-400" />
                    <span>تغيير كلمة المرور (اترك الحقول فارغة إذا لم ترغب في التغيير)</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-slate-400 block">كلمة المرور الجديدة</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-slate-100 font-mono focus:border-blue-500 focus:outline-none text-right"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                        >
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-slate-400 block">تأكيد كلمة المرور</label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-slate-100 font-mono focus:border-blue-500 focus:outline-none text-right"
                      />
                    </div>
                  </div>
                </div>

                {/* Submit button */}
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-600/30"
                  >
                    {isProcessing ? <RefreshCw size={15} className="animate-spin" /> : <Check size={15} />}
                    <span>حفظ وتحديث البيانات الشخصية</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* ======================================================== */}
      {/* MODAL 1: INSTANT AUTO-RESERVATION CONFIRMATION           */}
      {/* ======================================================== */}
      {confirmingReserveCar && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-[200] p-4 animate-in fade-in duration-150 text-right">
          <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl w-full max-w-md p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-blue-400 font-black text-sm">
                <Zap size={18} />
                <span>تأكيد الحجز التلقائي المباشر</span>
              </div>
              <button
                onClick={() => setConfirmingReserveCar(null)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-300 font-bold leading-relaxed">
                هل أنت متأكد من رغبتك في حجز السيارة التالية لحسابك فوراً؟
              </p>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 space-y-2">
                <div className="font-black text-white text-sm">
                  {confirmingReserveCar.brand} {confirmingReserveCar.model} ({confirmingReserveCar.year})
                </div>
                <div className="flex justify-between text-slate-400 font-mono text-[11px]" dir="ltr">
                  <span>VIN: {confirmingReserveCar.vin}</span>
                  <span className="text-emerald-400 font-bold">{(Number(confirmingReserveCar.price) || 0).toLocaleString()} {settings?.currency || 'ر.س'}</span>
                </div>
                <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-850">
                  اللون: {confirmingReserveCar.color || 'غير محدد'}
                </div>
              </div>

              <div className="p-3 bg-blue-950/40 border border-blue-800/40 rounded-xl text-[11px] text-blue-300 space-y-1">
                <p className="font-black flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-blue-400" />
                  سيتم تسجيل الحجز مباشرة باسم:
                </p>
                <p className="font-extrabold text-white text-xs mr-4">
                  {delegateDisplayName} (@{currentDelegate.username})
                </p>
                <p className="text-[10px] text-blue-400/80 mr-4">
                  سيظهر اسمك فوراً في لوحة التحكم وعرض المخزون لإدارة المعرض، وسيتم فك قفل البطاقة الجمركية لك.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleExecuteReservation}
                disabled={isProcessing}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-600/30"
              >
                {isProcessing ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
                <span>تأكيد الحجز الآن</span>
              </button>
              <button
                onClick={() => setConfirmingReserveCar(null)}
                disabled={isProcessing}
                className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-black text-xs transition-all cursor-pointer"
              >
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: CANCEL RESERVATION CONFIRMATION                 */}
      {/* ======================================================== */}
      {confirmingCancelCar && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-[200] p-4 animate-in fade-in duration-150 text-right">
          <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl w-full max-w-md p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-rose-400 font-black text-sm">
                <AlertCircle size={18} />
                <span>إلغاء حجز السيارة وإعادتها للمعرض</span>
              </div>
              <button
                onClick={() => setConfirmingCancelCar(null)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-300 font-bold leading-relaxed">
                هل أنت متأكد من رغبتك في إلغاء حجز هذه السيارة وإعادتها فوراً للمخزون المتاح بالمعرض؟
              </p>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 space-y-1.5">
                <div className="font-black text-white text-sm">
                  {confirmingCancelCar.brand} {confirmingCancelCar.model} ({confirmingCancelCar.year})
                </div>
                <div className="font-mono text-slate-400 text-[11px]" dir="ltr">
                  VIN: {confirmingCancelCar.vin}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleExecuteCancelReservation}
                disabled={isProcessing}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-rose-600/30"
              >
                {isProcessing ? <RefreshCw size={14} className="animate-spin" /> : <X size={14} />}
                <span>نعم، إلغاء الحجز</span>
              </button>
              <button
                onClick={() => setConfirmingCancelCar(null)}
                disabled={isProcessing}
                className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-black text-xs transition-all cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
