import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  CheckCircle, 
  XCircle, 
  Lock, 
  AlertTriangle, 
  ShieldAlert, 
  RefreshCw, 
  X,
  UserCheck,
  Car as CarIcon,
  Search,
  Check,
  RotateCcw
} from 'lucide-react';
import { Car, User, CarStatus, OrganizationSettings, formatVehicleDisplay } from '../types';
import { hashPassword, verifyUserPassword } from '../services/SecurityService';

interface ReservationAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  cars: Car[];
  currentUser: User | null;
  settings: OrganizationSettings;
  onUpdateCars: (updatedCars: Car[]) => void;
  addLog: (action: string, refId: string, refType: string, details: string) => void;
  isRtl?: boolean;
}

export const ReservationAuditModal: React.FC<ReservationAuditModalProps> = ({
  isOpen,
  onClose,
  cars,
  currentUser,
  settings,
  onUpdateCars,
  addLog,
  isRtl = true,
}) => {
  const [serialCode, setSerialCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [shake, setShake] = useState(false);
  
  // Track temporary changes to car reservation state during this modal turn
  const [pendingCars, setPendingCars] = useState<Car[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Settle initial copy of cars
  useEffect(() => {
    if (isOpen) {
      setPendingCars(JSON.parse(JSON.stringify(cars))); // deep copy
      setSerialCode('');
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isOpen, cars]);

  if (!isOpen) return null;

  // Helper: Get days remaining or elapsed since reservation
  const getReservationDays = (car: Car) => {
    const reservationDateStr = car.reservationDate || car.lastModified || car.entryDate;
    if (!reservationDateStr) return 0;
    const resDate = new Date(reservationDateStr);
    const diffTime = Math.max(0, Date.now() - resDate.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  // Filter cars to show only RESERVED (محجوزة) ones
  const reservedCars = pendingCars.filter(car => {
    const isReserved = car.status === CarStatus.RESERVED || String(car.status) === 'محجوزة' || String(car.status) === 'محجوز';
    if (!isReserved) return false;
    
    if (searchTerm.trim() === '') return true;
    
    const searchLower = searchTerm.toLowerCase();
    const matchesBrand = car.brand?.toLowerCase().includes(searchLower);
    const matchesModel = car.model?.toLowerCase().includes(searchLower);
    const matchesVin = car.vin?.toLowerCase().includes(searchLower);
    const matchesPlate = car.plateData?.plateNumber?.toLowerCase().includes(searchLower);
    const matchesDelegate = car.reservedByUserId?.toLowerCase().includes(searchLower);
    
    return matchesBrand || matchesModel || matchesVin || matchesPlate || matchesDelegate;
  });

  const targetDays = settings?.reservationConfirmPeriodDays !== undefined ? settings.reservationConfirmPeriodDays : 4;

  // Calculate statistics
  const carsExceeding4Days = pendingCars.filter(car => {
    const isReserved = car.status === CarStatus.RESERVED || String(car.status) === 'محجوزة' || String(car.status) === 'محجوز';
    return isReserved && getReservationDays(car) >= targetDays;
  });

  // Action: Confirm reservation (Extends booking by setting current time)
  const handleConfirmReservationItem = (carId: string) => {
    setPendingCars(prev => prev.map(c => {
      if (c.id === carId) {
        return {
          ...c,
          reservationDate: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          history: [
            ...(c.history || []),
            {
              id: `hist-${Date.now()}`,
              action: `تأكيد وتجديد الحجز الدوري (رقم السيري)`,
              timestamp: new Date().toISOString(),
              user: currentUser?.username || 'نظام'
            }
          ]
        };
      }
      return c;
    }));
  };

  // Action: Cancel reservation (Releases vehicle)
  const handleCancelReservationItem = (carId: string) => {
    setPendingCars(prev => prev.map(c => {
      if (c.id === carId) {
        return {
          ...c,
          status: CarStatus.AVAILABLE,
          reservedByUserId: undefined,
          reservationDate: undefined,
          lastModified: new Date().toISOString(),
          history: [
            ...(c.history || []),
            {
              id: `hist-${Date.now()}`,
              action: `إلغاء الحجز الفوري وتجهيز للمخزون`,
              timestamp: new Date().toISOString(),
              user: currentUser?.username || 'نظام'
            }
          ]
        };
      }
      return c;
    }));
  };

  // Submit changes without requiring password
  const handleSaveChangesAndAuthorize = async () => {
    setErrorMsg('');

    try {
      // Check how many changes we did
      let countConfirmed = 0;
      let countCancelled = 0;

      const finalUpdatedCars = cars.map(originalCar => {
        const pendingCar = pendingCars.find(p => p.id === originalCar.id);
        if (!pendingCar) return originalCar;

        // Compare states to count and build log
        const origReserved = originalCar.status === CarStatus.RESERVED || String(originalCar.status) === 'محجوزة';
        const pendReserved = pendingCar.status === CarStatus.RESERVED || String(pendingCar.status) === 'محجوزة';
        
        if (origReserved && !pendReserved) {
          countCancelled++;
          addLog(
            'تدقيق وإلغاء حجز', 
            originalCar.id, 
            'car', 
            `تم تفكيك وإلغاء حجز السيارة ${originalCar.brand} ${originalCar.model} المخصصة سابقاً لـ ${originalCar.reservedByUserId || 'غير محدد'} وإعادتها للمخزون.`
          );
        } else if (origReserved && pendReserved) {
          const origDate = originalCar.reservationDate || originalCar.lastModified;
          const pendDate = pendingCar.reservationDate;
          if (origDate !== pendDate) {
            countConfirmed++;
            addLog(
              'تدقيق وتأكيد حجز دوري', 
              originalCar.id, 
              'car', 
              `تأكيد حجز السيارة ${originalCar.brand} ${originalCar.model} للمندوب ${originalCar.reservedByUserId || 'غير محدد'} وتمديد دورتها الدورية الاستعراضية.`
            );
          }
        }
        return pendingCar;
      });

      // Commit changes globally
      onUpdateCars(finalUpdatedCars);
      
      setSuccessMsg(isRtl 
        ? `تم حفظ التغييرات بنجاح! تم تأكيد ${countConfirmed} حجزاً وإلغاء ${countCancelled} حجزاً.` 
        : `Successfully saved! Confirmed ${countConfirmed} and cancelled ${countCancelled} reservations.`
      );

      setTimeout(() => {
        onClose();
      }, 800);

    } catch (e) {
      setErrorMsg(isRtl ? 'حدث خطأ أثناء حفظ البيانات.' : 'Error saving changes.');
    }
  };

  // Helper: Extend all overdue/active bookings in one click and close
  const handleExtendAllAndClose = () => {
    const nowIso = new Date().toISOString();
    let countConfirmed = 0;

    const finalUpdatedCars = cars.map(car => {
      const isReserved = car.status === CarStatus.RESERVED || String(car.status) === 'محجوزة' || String(car.status) === 'محجوز';
      if (isReserved) {
        countConfirmed++;
        addLog(
          'تمديد حجز دوري',
          car.id,
          'car',
          `تم تمديد حجز السيارة ${car.brand} ${car.model || ''} تلقائياً`
        );
        return {
          ...car,
          reservationDate: nowIso,
          lastModified: nowIso,
          history: [
            ...(car.history || []),
            {
              id: `hist-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              action: `تمديد وتأكيد الحجز الدوري`,
              user: currentUser?.username || 'النظام',
              timestamp: nowIso,
              details: 'تمديد الحجز وتثبيته عبر مراجعة الحجوزات الدورية'
            }
          ]
        };
      }
      return car;
    });

    onUpdateCars(finalUpdatedCars);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto overscroll-contain">
      <motion.div 
        animate={{ 
          scale: 1, 
          y: 0, 
          x: shake ? [-10, 10, -10, 10, 0] : 0 
        }}
        initial={{ scale: 0.95, y: 15 }}
        transition={{ duration: 0.25 }}
        className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] sm:max-h-[90vh] my-auto overflow-hidden flex flex-col font-sans"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Header section with security indicators & close button */}
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-amber-500/[0.04] flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 bg-amber-500/10 rounded-xl sm:rounded-2xl text-amber-500 dark:text-amber-400">
              <ShieldAlert size={22} className="sm:w-7 sm:h-7 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg md:text-xl font-black text-slate-800 dark:text-white leading-tight flex flex-wrap items-center gap-2">
                {isRtl ? 'تدقيق الحجوزات الدورية وتأكيدها' : 'Periodic Reservations Audit'}
                <span className="text-[10px] sm:text-xs bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2 sm:px-2.5 py-0.5 rounded-full font-bold">
                  {isRtl ? `كل ${targetDays} أيام` : `Every ${targetDays} Days`}
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs font-semibold text-slate-400 dark:text-slate-500 mt-0.5 sm:mt-1">
                {isRtl 
                  ? 'بوابة التدقيق الميداني لحجوزات مناديب المعارض لمنع تكدس وعقد حركات الحجز غير النشطة.' 
                  : 'An internal dashboard to confirm delegate bookings or return stale ones to active inventory.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {carsExceeding4Days.length > 0 && (
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl text-xs font-bold">
                <AlertTriangle size={14} />
                <span>
                  {isRtl ? `${carsExceeding4Days.length} حجزاً بحاجة للمراجعة` : `${carsExceeding4Days.length} bookings to review`}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 sm:p-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={isRtl ? 'إغلاق وتجاوز النافذة' : 'Close and bypass'}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Search bar inside the modal */}
        <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          <div className="relative w-full sm:w-72">
            <Search className="absolute right-3.5 top-2.5 sm:top-3 text-slate-400" size={16} />
            <input
              type="text"
              placeholder={isRtl ? 'البحث بالماركة، المندوب، رقم اللوحة...' : 'Search brand, agent, vin...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs font-bold pr-10 pl-4 py-2 sm:py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span>{isRtl ? 'عدد الحجوزات النشطة المدرجة:' : 'Active listings count:'}</span>
            <span className="font-extrabold text-blue-500 text-sm">{reservedCars.length}</span>
          </div>
        </div>

        {/* Scrolling list container */}
        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-4">
          
          {/* Main warning alert for strict policy */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-850 rounded-2xl flex items-start gap-3">
            <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 mt-0.5">
              <Calendar size={15} />
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">
              {isRtl ? (
                <span>
                  النظام يطالب بفحص ومراجعة كافة المركبات المحجوزة لدى المندوبين بصفة دورية <strong className="text-amber-600 dark:text-amber-400">كل {targetDays} أيام</strong>. عند الضغط على <strong className="text-emerald-500">تأكيد الحجز</strong> سيتم تجديد دورة الحجز لـ {targetDays} أيام إضافية، وعند الضغط على <strong className="text-rose-500">إلغاء الحجز</strong> ستعود السيارة لـ <span className="text-slate-800 dark:text-white font-bold">"متوفرة"</span> وتتاح للبيع فوراً للجميع.
                </span>
              ) : (
                <span>
                  The inventory system restricts reservations up to <strong className="text-yellow-500">{targetDays} days</strong>. Confirm renews the lease timer, while Cancel returns the vehicle instantly to saleable inventory.
                </span>
              )}
            </div>
          </div>

          {reservedCars.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center gap-4">
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-full text-slate-400 dark:text-slate-500">
                <CarIcon size={48} className="stroke-[1.2]" />
              </div>
              <div>
                <p className="font-black text-slate-700 dark:text-slate-350">{isRtl ? 'لا توجد سيارات محجوزة حالياً' : 'No Reserved Vehicles Found'}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  {isRtl ? 'جميع السيارات متوفرة أو مباعة حالياً بالمرآب' : 'All workspace vehicles are either sold or available for delivery.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {reservedCars.map(car => {
                const days = getReservationDays(car);
                const isOverdue = days >= targetDays;
                const originalCar = cars.find(c => c.id === car.id);
                const currentStatus = car.status; // Might be altered in pending copy

                return (
                  <div 
                    key={car.id} 
                    className={`p-4 rounded-2xl border transition-all ${
                      currentStatus === CarStatus.AVAILABLE
                        ? 'bg-rose-500/[0.02] border-rose-500/20'
                        : isOverdue 
                        ? 'bg-amber-500/[0.02] border-amber-500/20 hover:border-amber-500/40' 
                        : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-750'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      {/* Left: Car Title, Details, and Booking Agent */}
                      <div className="flex items-start gap-3">
                        <div className={`p-3 rounded-xl mt-1 ${
                          currentStatus === CarStatus.AVAILABLE
                            ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-600'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        }`}>
                          <CarIcon size={20} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 dark:text-white text-sm">
                            {formatVehicleDisplay(car)} ({car.year}) 
                            {currentStatus === CarStatus.AVAILABLE && (
                              <span className="mr-2 text-[10px] bg-rose-500/20 text-rose-600 font-extrabold px-2 py-0.5 rounded-full">
                                {isRtl ? 'معين للإلغاء' : 'Marked to Cancel'}
                              </span>
                            )}
                            {currentStatus === CarStatus.RESERVED && originalCar?.reservationDate !== car.reservationDate && (
                              <span className="mr-2 text-[10px] bg-emerald-500/20 text-emerald-600 font-extrabold px-2 py-0.5 rounded-full">
                                {isRtl ? 'معين للتجديد' : 'Marked to Renew'}
                              </span>
                            )}
                          </h4>
                          
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-xs text-slate-400 dark:text-slate-500 font-semibold">
                            <span className="flex items-center gap-1 bg-slate-50 dark:bg-slate-950 px-2 py-0.5 rounded-lg text-slate-600 dark:text-slate-400">
                              <UserCheck size={12} className="text-blue-500" />
                              {isRtl ? `المندوب: ${car.reservedByUserId || 'غير معروف'}` : `Agent: ${car.reservedByUserId || 'N/A'}`}
                            </span>
                            <span>{isRtl ? `شاسية: ${car.vin || '—'}` : `VIN: ${car.vin || '—'}`}</span>
                            {car.plateData?.plateNumber && (
                              <span>{isRtl ? `اللوحة: ${car.plateData.plateNumber}` : `Plate: ${car.plateData.plateNumber}`}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Reservation Days and Action Buttons */}
                      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-0 pt-3 sm:pt-0 border-slate-50 dark:border-slate-850">
                        {/* Days indicator banner */}
                        <div className="text-right flex flex-col">
                          <span className={`text-xs font-black px-2.5 py-1 rounded-xl w-fit self-end ${
                            isOverdue 
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25' 
                              : 'bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400'
                          }`}>
                            {isRtl ? `منذ ${days} م يوم` : `${days} days elapsed`}
                          </span>
                          {isOverdue && currentStatus === CarStatus.RESERVED && (
                            <span className="text-[10px] text-amber-500 font-bold mt-1 text-left sm:text-right">
                              ⚠️ {isRtl ? 'تنبيه: حان موعد المراجعة!' : 'Action required!'}
                            </span>
                          )}
                        </div>

                        {/* Interactive toggle actions inside modal */}
                        <div className="flex items-center gap-1.5">
                          {currentStatus === CarStatus.RESERVED ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleConfirmReservationItem(car.id)}
                                title={isRtl ? `تمديد وتأكيد الحجز لـ ${targetDays} أيام إضافية` : 'Renew and confirm reservation'}
                                className={`p-2 rounded-xl transition-all ${
                                  originalCar?.reservationDate !== car.reservationDate
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-500'
                                }`}
                              >
                                <CheckCircle size={18} />
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => handleCancelReservationItem(car.id)}
                                title={isRtl ? 'إلغاء حجز هذه السيارة وإرجاعها للمخزون' : 'Cancel booking and release'}
                                className="p-2 bg-slate-50 dark:bg-slate-800 text-slate-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-500 rounded-xl transition-all"
                              >
                                <XCircle size={18} />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                // Revert/Reset back to original reserved status for audit
                                setPendingCars(prev => prev.map(c => {
                                  if (c.id === car.id && originalCar) {
                                    return JSON.parse(JSON.stringify(originalCar));
                                  }
                                  return c;
                                }));
                              }}
                              className="px-3 py-1.5 bg-rose-500/15 text-rose-500 text-xs font-black rounded-xl hover:bg-rose-500/25 flex items-center gap-1 transition-all"
                            >
                              <RotateCcw size={12} />
                              <span>{isRtl ? 'تراجع' : 'Revert'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer verification authorization zone */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 font-sans">
          
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
              {isRtl ? 'يمكنك التجاوز وإغلاق النافذة مباشرة أو تمديد الحجز بضغطة واحدة.' : 'You can bypass/close directly or extend booking with one click.'}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handleExtendAllAndClose}
                className="flex-1 sm:flex-initial px-5 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw size={15} />
                <span>{isRtl ? 'تمديد الحجز (تأكيد الجميع)' : 'Extend Booking (All)'}</span>
              </button>

              <button
                type="button"
                onClick={handleSaveChangesAndAuthorize}
                className="flex-1 sm:flex-initial px-5 py-3 bg-slate-900 dark:bg-blue-600 hover:bg-slate-850 dark:hover:bg-blue-700 text-white text-xs font-black rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <Check size={14} />
                <span>{isRtl ? 'حفظ التغيرات' : 'Save Changes'}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-initial px-4 py-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
              >
                <X size={14} />
                <span>{isRtl ? 'تجاوز وإغلاق' : 'Bypass & Close'}</span>
              </button>
            </div>
          </div>

          <AnimatePresence>
            {errorMsg && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold rounded-xl flex items-center gap-2"
              >
                <AlertTriangle size={14} className="flex-shrink-0" />
                <span>{errorMsg}</span>
              </motion.div>
            )}

            {successMsg && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-bold rounded-xl flex items-center gap-2 text-center"
              >
                <Check size={14} className="flex-shrink-0 text-emerald-500" />
                <span>{successMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
