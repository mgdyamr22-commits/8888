import React, { useState, useMemo } from 'react';
import { X, Printer, User, Phone, IdCard, Calendar, Briefcase, FileText, CheckCircle2, ChevronDown, Check } from 'lucide-react';
import { Car, User as AppUser, Delegate, DeliveryType, formatVehicleDisplay } from '../types';
import { lookupCustomerById } from '../services/customerLookupService';

interface BulkExitPermitModalProps {
  selectedCars: Car[];
  users: AppUser[];
  delegates: Delegate[];
  currentUser: AppUser | null;
  onClose: () => void;
  onPrint: (params: {
    receiverName: string;
    receiverPhone: string;
    receiverId: string;
    nationality: string;
    deliveryType: DeliveryType | string;
    transportCompany: string;
    exitDate: string;
    seller: string;
    notes: string;
    permitTitle: string;
    shouldSaveToCars: boolean;
  }) => void;
}

export const BulkExitPermitModal: React.FC<BulkExitPermitModalProps> = ({
  selectedCars,
  users = [],
  delegates = [],
  currentUser,
  onClose,
  onPrint,
}) => {
  // Try to find if any of the selected cars already has some exit data to prefill
  const firstCarWithExitData = selectedCars.find(c => c.exitData && c.exitData.receiverName) || selectedCars[0];
  const initialExitData = firstCarWithExitData?.exitData;

  const [receiverName, setReceiverName] = useState(initialExitData?.receiverName || '');
  const [receiverPhone, setReceiverPhone] = useState(initialExitData?.receiverPhone || '');
  const [receiverId, setReceiverId] = useState(initialExitData?.receiverId || '');
  const [nationality, setNationality] = useState(initialExitData?.nationality || 'سعودي');
  const [deliveryType, setDeliveryType] = useState<DeliveryType | string>(initialExitData?.deliveryType || DeliveryType.OWNER);
  const [transportCompany, setTransportCompany] = useState(initialExitData?.transportCompany || '');
  const [exitDate, setExitDate] = useState(initialExitData?.exitDate || new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState(initialExitData?.notes || '');
  
  // Set default seller
  const defaultSeller = initialExitData?.seller || currentUser?.username || '';
  const [seller, setSeller] = useState(defaultSeller);

  // Permit Title selection ("إذن خروج وتسليم سيارات" vs "إذن خروج وتسليم سيارات ولوحات")
  const [permitTitle, setPermitTitle] = useState<'vehicles' | 'plates'>('vehicles');
  
  // Option to update the exit details of all selected cars
  const [shouldSaveToCars, setShouldSaveToCars] = useState(true);

  // List of unique sellers (active users and active delegates)
  const sellersList = useMemo(() => {
    const list: string[] = [];
    users.forEach(u => {
      if (u.username && !list.includes(u.username)) {
        list.push(u.username);
      }
    });
    delegates.forEach(d => {
      if (d.username && d.isActive !== false && !list.includes(d.username)) {
        list.push(d.username);
      }
    });
    // Add first car's seller if any
    selectedCars.forEach(c => {
      if (c.seller && !list.includes(c.seller)) {
        list.push(c.seller);
      }
    });
    return list;
  }, [users, delegates, selectedCars]);

  const transportSuggestions = useMemo(() => {
    const list: string[] = [];
    selectedCars.forEach(c => {
      if (c.customData?.entryTransportCompany) list.push(c.customData.entryTransportCompany);
      if (c.exitData?.transportCompany) list.push(c.exitData.transportCompany);
    });
    return Array.from(new Set(list)).filter(Boolean);
  }, [selectedCars]);

  const driverSuggestions = useMemo(() => {
    const list: string[] = [];
    selectedCars.forEach(c => {
      if (c.customData?.entryDriverName) list.push(c.customData.entryDriverName);
      if (c.exitData?.receiverName) list.push(c.exitData.receiverName);
    });
    return Array.from(new Set(list)).filter(Boolean);
  }, [selectedCars]);

  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!receiverName.trim()) {
      setError('يرجى إدخال اسم المستلم');
      return;
    }

    const titleText = permitTitle === 'plates' 
      ? 'إذن خروج وتسليم سيارات ولوحات' 
      : 'إذن خروج وتسليم سيارات';

    onPrint({
      receiverName: receiverName.trim(),
      receiverPhone: receiverPhone.trim(),
      receiverId: receiverId.trim(),
      nationality: nationality.trim(),
      deliveryType,
      transportCompany: transportCompany.trim(),
      exitDate,
      seller,
      notes: notes.trim(),
      permitTitle: titleText,
      shouldSaveToCars
    });
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-sm animate-in fade-in overflow-y-auto overscroll-contain" dir="rtl">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-6 md:p-8 border border-slate-100 dark:border-slate-800 shadow-2xl space-y-4 sm:space-y-6 text-right max-h-[92vh] sm:max-h-[90vh] my-auto flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3 sm:pb-4 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl sm:rounded-2xl">
              <Printer size={20} className="sm:w-6 sm:h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg md:text-xl font-black text-slate-900 dark:text-white">
                إصدار إذن خروج مجمع وتسليم
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 font-bold mt-0.5">
                تحديد بيانات مستلم واحد وإصدار إذن الخروج للمركبات المحددة ({selectedCars.length} سيارات)
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 sm:p-2 bg-slate-100 dark:bg-slate-800 dark:text-slate-200 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/50 rounded-xl text-slate-400 transition-all font-bold"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6 flex-1 min-h-0 flex flex-col overflow-hidden">
          {error && (
            <div className="p-3 sm:p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-xl sm:rounded-2xl border border-rose-100 dark:border-rose-900/30 text-xs font-bold flex items-center gap-2 shrink-0">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8 flex-1 min-h-0 overflow-y-auto pr-1">
            
            {/* Form Fields: Column span 7 */}
            <div className="lg:col-span-7 space-y-5">
              
              {/* Permit Title Selector */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">عنوان إذن الخروج المجمع</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPermitTitle('vehicles')}
                    className={`p-3.5 rounded-2xl border font-black text-xs transition-all flex flex-col items-center justify-center gap-1.5 ${
                      permitTitle === 'vehicles'
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-900/50 dark:text-indigo-400 ring-2 ring-indigo-500/10'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
                    }`}
                  >
                    <FileText size={16} />
                    <span>إذن خروج وتسليم سيارات</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPermitTitle('plates')}
                    className={`p-3.5 rounded-2xl border font-black text-xs transition-all flex flex-col items-center justify-center gap-1.5 ${
                      permitTitle === 'plates'
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-900/50 dark:text-indigo-400 ring-2 ring-indigo-500/10'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
                    }`}
                  >
                    <FileText size={16} />
                    <span>إذن خروج وتسليم سيارات ولوحات</span>
                  </button>
                </div>
              </div>

              {/* Grid of Receiver Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Receiver Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">اسم المستلم</label>
                  <div className="relative">
                    <User className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      list="bulk-receiver-suggestions"
                      value={receiverName}
                      onChange={(e) => setReceiverName(e.target.value)}
                      placeholder="مثال: فهد عبد الله الشهراني"
                      className="w-full pr-10 pl-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 font-bold text-sm text-right dark:text-white"
                      required
                    />
                    <datalist id="bulk-receiver-suggestions">
                      {driverSuggestions.map((d, i) => (
                        <option key={i} value={d} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* Receiver Phone */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">رقم جوال المستلم</label>
                  <div className="relative">
                    <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      value={receiverPhone}
                      onChange={(e) => setReceiverPhone(e.target.value)}
                      placeholder="مثال: 05XXXXXXXX"
                      className="w-full pr-10 pl-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 font-bold text-sm text-right dark:text-white"
                    />
                  </div>
                </div>

                {/* Receiver ID */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">رقم الهوية / الإقامة</label>
                  <div className="relative">
                    <IdCard className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      value={receiverId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setReceiverId(val);
                        if (val.trim()) {
                          const match = lookupCustomerById(val, selectedCars);
                          if (match) {
                            if (match.phone) setReceiverPhone(match.phone);
                            if (match.name && !receiverName) setReceiverName(match.name);
                            if (match.nationality && !nationality) setNationality(match.nationality);
                          }
                        }
                      }}
                      placeholder="مثال: 10XXXXXXXX"
                      maxLength={10}
                      className="w-full pr-10 pl-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 font-bold text-sm text-right dark:text-white"
                    />
                  </div>
                </div>

                {/* Nationality */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">جنسية المستلم</label>
                  <div className="relative">
                    <FlagIcon className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      value={nationality}
                      onChange={(e) => setNationality(e.target.value)}
                      placeholder="مثال: سعودي"
                      className="w-full pr-10 pl-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 font-bold text-sm text-right dark:text-white"
                    />
                  </div>
                </div>

                {/* Delivery Type */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">نوع التسليم</label>
                  <select
                    value={deliveryType}
                    onChange={(e) => setDeliveryType(e.target.value as DeliveryType)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 font-bold text-sm text-right dark:text-white cursor-pointer select-none"
                  >
                    <option value={DeliveryType.OWNER}>تسليم لصاحبها مباشرة</option>
                    <option value={DeliveryType.TRANSPORT}>تسليم عبر نقليات وشحن</option>
                    <option value={DeliveryType.OTHER}>تسليم لمستلم آخر / وكيل</option>
                  </select>
                </div>

                {/* Exit Date */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">تاريخ خروج السيارات</label>
                  <div className="relative">
                    <Calendar className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="date"
                      value={exitDate}
                      onChange={(e) => setExitDate(e.target.value)}
                      className="w-full pr-10 pl-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 font-bold text-sm text-right dark:text-white cursor-pointer"
                    />
                  </div>
                </div>

                {/* Transport Company (Show only if TRANSPORT) */}
                {deliveryType === DeliveryType.TRANSPORT && (
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">شركة النقليات والشحن</label>
                    <input
                      type="text"
                      list="bulk-transport-suggestions"
                      value={transportCompany}
                      onChange={(e) => setTransportCompany(e.target.value)}
                      placeholder="مثال: البسامي الدولية"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 font-bold text-sm text-right dark:text-white"
                    />
                    <datalist id="bulk-transport-suggestions">
                      {transportSuggestions.map((t, i) => (
                        <option key={i} value={t} />
                      ))}
                    </datalist>
                  </div>
                )}

                {/* Seller / Representative */}
                <div className="col-span-2 space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">البائع / مندوب المعرض المسؤول</label>
                  <div className="relative">
                    <Briefcase className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      list="sellers-list-bulk"
                      value={seller}
                      onChange={(e) => setSeller(e.target.value)}
                      placeholder="اكتب اسم البائع أو اختر من القائمة"
                      className="w-full pr-10 pl-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 font-bold text-sm text-right dark:text-white"
                    />
                    <datalist id="sellers-list-bulk">
                      {sellersList.map((s, i) => (
                        <option key={i} value={s} />
                      ))}
                    </datalist>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">ملاحظات إضافية</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثال: تم تسليم كرت الشتشغيل والمفاتيح الاحتياطية..."
                  rows={2}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 font-bold text-sm text-right dark:text-white resize-none"
                />
              </div>

              {/* Option to Save details directly to Database */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShouldSaveToCars(!shouldSaveToCars)}
                  className="flex items-center gap-3 text-right hover:opacity-90 select-none group"
                >
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all ${
                    shouldSaveToCars 
                      ? 'bg-emerald-500 border-emerald-500 text-white' 
                      : 'border-slate-300 dark:border-slate-700 bg-transparent'
                  }`}>
                    {shouldSaveToCars && <Check size={14} strokeWidth={3} />}
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-750 dark:text-slate-300">
                      تحديث وحفظ بيانات الخروج لهذه السيارات في النظام
                    </span>
                    <p className="text-[10px] text-slate-400 font-medium">
                      سيتم حفظ اسم المستلم وتفاصيله بملفات السيارات المحددة للمستقبل.
                    </p>
                  </div>
                </button>
              </div>

            </div>

            {/* Selected Cars List Sidebar: Column span 5 */}
            <div className="lg:col-span-5 flex flex-col h-full bg-slate-50 dark:bg-slate-950/60 rounded-3xl border border-slate-150 dark:border-slate-850 p-5 space-y-4 max-h-[60vh] lg:max-h-none overflow-y-auto">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-750 dark:text-slate-200">السيارات المحددة ({selectedCars.length})</span>
                <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-lg font-black">مجمع</span>
              </div>

              <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                {selectedCars.map((car, index) => (
                  <div 
                    key={car.id} 
                    className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col gap-1.5 shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                        {index + 1}
                      </span>
                      <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">
                        {formatVehicleDisplay(car)}
                      </h4>
                    </div>

                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                      <div>
                        <span>اللون: </span>
                        <span className="text-slate-800 dark:text-slate-200">{car.color || 'غير محدد'}</span>
                      </div>
                      <div>
                        <span>الموديل: </span>
                        <span className="text-slate-800 dark:text-slate-200">{car.year || 'غير محدد'}</span>
                      </div>
                      <div className="col-span-2 mt-0.5 pt-0.5 border-t border-slate-100/60 dark:border-slate-800/60 font-mono">
                        <span className="text-slate-400 font-sans">الشاصي: </span>
                        <span className="text-slate-700 dark:text-slate-300">{car.vin}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-400 font-sans">اللوحة: </span>
                        <span className="text-slate-700 dark:text-slate-300">
                          {car.plateData?.plateNumber || car.customData?.plateNumber || 'بطاقة جمركية'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 border-t border-slate-100 dark:border-slate-800 pt-6">
            <button 
              type="submit"
              className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-indigo-600/10 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Printer size={18} />
              <span>طباعة وإصدار الإذن المجمع</span>
            </button>
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black rounded-2xl border border-slate-200 dark:border-slate-750 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-sm cursor-pointer"
            >
              إلغاء
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

// Simple FlagIcon component since we didn't import a specific Flag icon
const FlagIcon = ({ className, size }: { className?: string; size?: number }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size || 24} 
    height={size || 24} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" x2="4" y1="22" y2="15" />
  </svg>
);
