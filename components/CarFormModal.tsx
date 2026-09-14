
import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Car as CarIcon, Tag, Briefcase, Calendar, 
  Palette, Hash, UserCheck, DollarSign, RefreshCcw, 
  Layers, CreditCard, Building2, List, Type, 
  IdCard, User as UserIcon, LogOut, Phone, 
  Flag, CheckCircle2, Truck, FileUp, Paperclip, Trash2, Check, AlertCircle, ChevronDown,
  Eye, Loader2, ExternalLink
} from 'lucide-react';
import { Car, CarStatus, OwnershipType, RentalStatus, OrganizationSettings, DeliveryType, User, UserRole, Delegate } from '../types';
import { VehicleDocumentsTab } from './VehicleDocumentsTab';
import { documentStorageService } from '../services/documentStorageService';
import { lookupCustomerById } from '../services/customerLookupService';
import { CarApiService } from '../src/services/carApiService';

interface InputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  icon?: any;
  error?: boolean;
  disabled?: boolean;
  suggestions?: string[];
  placeholder?: string;
}

export const InputField = ({ label, value, onChange, type = 'text', required, icon: Icon, error, disabled, suggestions, placeholder }: InputFieldProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Filter suggestions based on input value
  const filteredSuggestions = useMemo(() => {
    if (!suggestions || suggestions.length === 0) return [];
    if (!value) return suggestions.slice(0, 8); // show some initial ones
    const searchVal = value.trim().toLowerCase();
    return suggestions
      .filter(s => s && s.toLowerCase().includes(searchVal))
      .slice(0, 8);
  }, [suggestions, value]);

  // Handle click outside to close the suggestion list
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-2 relative" ref={containerRef}>
      <label className={`text-[10px] font-black uppercase tracking-widest mr-2 ${error ? 'text-rose-500' : 'text-slate-500'}`}>{label}</label>
      <div className="relative group">
         {Icon && <Icon size={16} className={`absolute right-5 top-1/2 -translate-y-1/2 transition-colors ${error ? 'text-rose-400 group-focus-within:text-rose-500' : 'text-slate-300 group-focus-within:text-blue-500'}`} />}
         <input 
           type={type} 
           required={required} 
           disabled={disabled}
           placeholder={placeholder}
           autoComplete="off"
           onFocus={() => setIsOpen(true)}
           className={`w-full pr-14 pl-6 py-4 bg-white dark:bg-slate-950 border rounded-2xl outline-none font-bold text-right shadow-sm dark:text-white transition-all ${
             disabled
               ? 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400 cursor-not-allowed'
               : error 
                 ? 'border-rose-500 focus:border-rose-600 focus:ring-1 focus:ring-rose-200 dark:focus:ring-rose-900/40' 
                 : 'border-slate-200 dark:border-slate-800 focus:border-blue-500'
           }`} 
           value={value} 
           onChange={e => {
             onChange(e.target.value);
             setIsOpen(true);
           }} 
         />
         
         {/* Custom Autocomplete Suggestions Dropdown */}
         {isOpen && filteredSuggestions.length > 0 && !disabled && (
           <div className="absolute right-0 left-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 overflow-hidden max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-1 duration-150">
             {filteredSuggestions.map((s, idx) => (
               <button
                 key={idx}
                 type="button"
                 onClick={() => {
                   onChange(s);
                   setIsOpen(false);
                 }}
                 className="w-full text-right px-6 py-3 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors border-b border-slate-100/50 dark:border-slate-800/40 last:border-0 flex items-center justify-between"
               >
                 <span>{s}</span>
                 <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">اقتراح 💡</span>
               </button>
             ))}
           </div>
         )}
      </div>
    </div>
  );
};

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  icon?: any;
  disabled?: boolean;
  required?: boolean;
  error?: boolean;
  placeholder?: string;
  suggestions?: string[];
}

export const SelectField = ({ 
  label, 
  value, 
  onChange, 
  options, 
  icon: Icon, 
  disabled,
  required,
  error,
  placeholder = 'اكتب أو اختر من القائمة...',
  suggestions = []
}: SelectFieldProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Combine standard options and additional suggestions
  const allChoices = useMemo(() => {
    const map = new Map<string, string>();
    options.forEach(opt => {
      if (opt.value !== undefined && opt.value !== null) {
        map.set(String(opt.value), String(opt.label || opt.value));
      }
    });
    suggestions.forEach(s => {
      if (s && !map.has(s)) map.set(s, s);
    });
    return Array.from(map.entries()).map(([val, lbl]) => ({ value: val, label: lbl }));
  }, [options, suggestions]);

  // Filter choices based on current input text
  const filteredChoices = useMemo(() => {
    if (!value || value.trim() === '') return allChoices;
    const searchVal = value.trim().toLowerCase();
    return allChoices.filter(
      c => c.label.toLowerCase().includes(searchVal) || c.value.toLowerCase().includes(searchVal)
    );
  }, [allChoices, value]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-2 relative" ref={containerRef}>
      <div className="flex justify-between items-center mr-2">
        <label className={`text-[10px] font-black uppercase tracking-widest ${error ? 'text-rose-500' : 'text-slate-500'}`}>{label}</label>
        <div className="flex items-center gap-1.5">
          {disabled ? (
            <span className="text-[10px] text-amber-500 font-black px-2 py-0.5 bg-amber-500/10 rounded-full">حساب تلقائي ⚙️</span>
          ) : (
            <span className="text-[9px] text-blue-600 dark:text-blue-400 font-bold px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/60 rounded-md border border-blue-100 dark:border-blue-900/40">إدخال واختيار ✍️</span>
          )}
        </div>
      </div>
      <div className="relative group">
        {Icon && (
          <Icon 
            size={16} 
            className={`absolute right-5 top-1/2 -translate-y-1/2 transition-colors ${
              disabled 
                ? 'text-slate-400' 
                : error 
                  ? 'text-rose-400 group-focus-within:text-rose-500' 
                  : 'text-slate-300 group-focus-within:text-blue-500'
            }`} 
          />
        )}
        
        {/* Main Editable Text Input */}
        <input
          type="text"
          disabled={disabled}
          required={required}
          autoComplete="off"
          placeholder={placeholder}
          onFocus={() => !disabled && setIsOpen(true)}
          className={`w-full pr-14 pl-12 py-4 bg-white dark:bg-slate-950 border rounded-2xl outline-none font-bold text-right shadow-sm dark:text-white transition-all ${
            disabled
              ? 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400 cursor-not-allowed'
              : error
                ? 'border-rose-500 focus:border-rose-600 focus:ring-1 focus:ring-rose-200 dark:focus:ring-rose-900/40'
                : 'border-slate-200 dark:border-slate-800 focus:border-blue-500'
          }`}
          value={value}
          onChange={e => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
        />

        {/* Dropdown Toggle Button on Left */}
        {!disabled && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setIsOpen(prev => !prev)}
            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
            title="فتح قائمة الخيارات السريعة"
          >
            <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-600' : ''}`} />
          </button>
        )}

        {/* Dropdown Menu with Search / Presets */}
        {isOpen && !disabled && (
          <div className="absolute right-0 left-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-64 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] font-black text-slate-400">
              <span>خيارات محددة مسبقاً (أو اكتب ما تريد يدوياً):</span>
              <span className="text-blue-600 font-mono">{filteredChoices.length} خيار</span>
            </div>

            {filteredChoices.length > 0 ? (
              filteredChoices.map((opt, idx) => {
                const isSelected = String(value).trim() === String(opt.value).trim() || (opt.label && String(value).trim() === String(opt.label).trim());
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`w-full text-right px-6 py-3 text-xs font-bold transition-colors border-b border-slate-100/50 dark:border-slate-800/40 last:border-0 flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-black'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {isSelected && <Check size={14} className="text-blue-600" />}
                      <span>{opt.label || opt.value || 'بدون تحديد'}</span>
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                      {opt.value && opt.value !== opt.label ? opt.value : 'اختيار'}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="px-6 py-4 text-center text-xs font-bold text-slate-500">
                <span>سيتم استخدام القيمة المدخلة: &quot;{value}&quot;</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export function autoCalculateVinMatching(carData: {
  vin?: string;
  cardNumber?: string;
  attributionSource?: string;
  brand?: string;
  model?: string;
  year?: number | string;
  color?: string;
  vinMatching?: string;
}): 'متطابق' | 'غير متطابق' {
  const val = String(carData.vinMatching || '').trim();
  if (val === 'غير مطابق' || val === 'غير متطابق' || val === 'mismatch' || val === 'غير_مطابق') {
    return 'غير متطابق';
  }
  return 'متطابق';
}

interface CarFormModalProps {
  car: Car | null;
  settings: OrganizationSettings;
  onClose: () => void;
  onSave: (data: any) => void;
  hideOutboundToggle?: boolean;
  cars?: Car[];
  currentUser?: User | null;
  users?: User[];
  delegates?: Delegate[];
}

const CarFormModal: React.FC<CarFormModalProps> = ({ car, settings, onClose, onSave, hideOutboundToggle = false, cars = [], currentUser = null, users = [], delegates = [] }) => {
  const [activeTab, setActiveTab] = useState<'info' | 'documents'>('info');
  const [formData, setFormData] = useState({
    brand: car?.brand || '', 
    model: car?.model || '', 
    year: car?.year || 2026, 
    color: car?.color || '', 
    interiorColor: car?.interiorColor || car?.customData?.interiorColor || '',
    vin: car?.vin || '', 
    vinMatching: (car?.vinMatching === 'غير مطابق' || car?.vinMatching === 'غير متطابق') ? 'غير متطابق' : 'متطابق',
    cardNumber: car?.cardNumber || 'لم يرد البطاقه بعد', 
    price: car?.price || 0, 
    costPrice: car?.costPrice || 0, 
    supplier: car?.supplier || '', 
    ownershipType: car?.ownershipType || OwnershipType.DIRECT, 
    status: car?.status || CarStatus.AVAILABLE, 
    rentalStatus: car?.rentalStatus || RentalStatus.NOT_RENTED,
    attributionSource: car?.attributionSource || '',
    isOutbound: car?.isOutbound || false,
    exitData: car?.exitData ? {
      ...car.exitData,
      seller: car.exitData.seller || car.exitData.representativeName || car?.reservedByUserId || '',
      bankName: car.exitData.bankName || ''
    } : { 
      receiverName: '', 
      receiverPhone: '', 
      receiverId: '', 
      nationality: '', 
      deliveryType: DeliveryType.OWNER, 
      exitDate: new Date().toISOString().split('T')[0], 
      notes: '',
      seller: car?.reservedByUserId || '',
      saleType: '',
      bankName: ''
    },
    hasPlate: car?.hasPlate || !!car?.plateData?.plateNumber,
    plateData: car?.plateData || { plateNumber: '', ownerName: '', serialNumber: '', issueDate: new Date().toISOString().split('T')[0] },
    notes: car?.notes || car?.exitData?.carCondition || '',
    carRemark: car?.carRemark || '',
    isPresentInShowroom: car?.isPresentInShowroom !== false,
    presenceDescription: car?.presenceDescription || car?.customData?.presenceDescription || '',
    cardFile: car?.cardFile || '',
    cardFileName: car?.cardFileName || '',
    customData: car?.customData || {},
    entryDate: car?.entryDate ? car.entryDate.split('T')[0] : new Date().toISOString().split('T')[0],
    entryDriverName: car?.customData?.entryDriverName || '',
    entryTransportCompany: car?.customData?.entryTransportCompany || '',
    entryNotes: car?.customData?.entryNotes || ''
  });

  // Autocomplete suggestions based on existing cars
  const brandSuggestions = useMemo(() => {
    const brands = cars.map(c => c.brand).filter(Boolean);
    return Array.from(new Set(brands));
  }, [cars]);

  const modelSuggestions = useMemo(() => {
    const models = cars.map(c => c.model).filter(Boolean);
    return Array.from(new Set(models));
  }, [cars]);

  const colorSuggestions = useMemo(() => {
    const colors = cars.map(c => c.color).filter(Boolean);
    return Array.from(new Set(colors));
  }, [cars]);

  const interiorColorSuggestions = useMemo(() => {
    const customColors = cars.map(c => c.interiorColor || c.customData?.interiorColor).filter(Boolean);
    const standardColors = ['بيج', 'جملي', 'أسود', 'رمادي', 'أوف وايت', 'بني', 'تان', 'أحمر', 'عنابي', 'هافان', 'مارون', 'أبيض', 'أزرق'];
    return Array.from(new Set([...customColors, ...standardColors]));
  }, [cars]);

  const supplierSuggestions = useMemo(() => {
    const suppliers = cars.map(c => c.supplier).filter(Boolean);
    return Array.from(new Set(suppliers));
  }, [cars]);

  const cardNumberSuggestions = useMemo(() => {
    const cardNums = cars.map(c => c.cardNumber).filter(Boolean);
    cardNums.push('لم يرد البطاقه بعد', 'خطاب سحب - لم يرد');
    return Array.from(new Set(cardNums));
  }, [cars]);

  const customAttributionSuggestions = useMemo(() => {
    const values = cars.map(c => c.attributionSource).filter(v => v && v !== 'سعودي' && v !== 'خليجي');
    values.push('أمريكي', 'كويتي', 'إماراتي', 'عماني', 'أردني', 'بحريني');
    return Array.from(new Set(values));
  }, [cars]);

  const entryDriverSuggestions = useMemo(() => {
    const drivers = cars.map(c => c.customData?.entryDriverName).filter(Boolean);
    return Array.from(new Set(drivers));
  }, [cars]);

  const entryTransportSuggestions = useMemo(() => {
    const companies = cars.map(c => c.customData?.entryTransportCompany).filter(Boolean);
    return Array.from(new Set(companies));
  }, [cars]);

  const exitTransportSuggestions = useMemo(() => {
    const companies = cars.map(c => c.exitData?.transportCompany).filter(Boolean);
    return Array.from(new Set(companies));
  }, [cars]);

  const receiverNameSuggestions = useMemo(() => {
    const names = cars.map(c => c.exitData?.receiverName).filter(Boolean);
    return Array.from(new Set(names));
  }, [cars]);

  const receiverIdSuggestions = useMemo(() => {
    const ids = cars.map(c => c.exitData?.receiverId).filter(Boolean);
    return Array.from(new Set(ids));
  }, [cars]);

  const nationalitySuggestions = useMemo(() => {
    const nationalities = cars.map(c => c.exitData?.nationality).filter(Boolean);
    nationalities.push('سعودي', 'يمني', 'مصري', 'سوداني', 'باكستاني', 'هندي', 'بنجلاديشي', 'أردني', 'سوري');
    return Array.from(new Set(nationalities));
  }, [cars]);

  const receiverPhoneSuggestions = useMemo(() => {
    const phones = cars.map(c => c.exitData?.receiverPhone).filter(Boolean);
    return Array.from(new Set(phones));
  }, [cars]);

  const bankNameSuggestions = useMemo(() => {
    const banks = cars.map(c => c.exitData?.bankName).filter(Boolean);
    banks.push('الراجحي', 'الأهلي', 'البلاد', 'الإنماء', 'الرياض', 'العربي', 'الفرنسي', 'الجزيرة', 'ساب');
    return Array.from(new Set(banks));
  }, [cars]);

  const customFieldsSuggestions = useMemo(() => {
    const result: Record<string, string[]> = {};
    const fieldsList = (settings.addCarCustomFields && settings.addCarCustomFields.length > 0)
      ? settings.addCarCustomFields
      : settings.customFields;
    if (fieldsList) {
      fieldsList.forEach(f => {
        const values = cars.map(c => c.customData?.[f.id]).filter(Boolean);
        result[f.id] = Array.from(new Set(values));
      });
    }
    return result;
  }, [cars, settings.addCarCustomFields, settings.customFields]);

  // Auto Draft System: Persist and recover form values
  const draftKey = car ? `car_form_draft_edit_${car.id}` : 'car_form_draft_new';
  const [draftExists, setDraftExists] = useState(false);
  const [draftData, setDraftData] = useState<any>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const savedRaw = localStorage.getItem(draftKey);
      if (savedRaw) {
        const saved = JSON.parse(savedRaw);
        if (saved) {
          // Only suggest restoring if it differs from current formData
          const isDiff = Object.keys(saved).some(k => JSON.stringify(saved[k]) !== JSON.stringify((formData as any)[k]));
          if (isDiff) {
            setDraftExists(true);
            setDraftData(saved);
          }
        }
      }
    } catch (e) {
      console.warn('[Auto Draft] Error reading draft:', e);
    }
  }, [draftKey]);

  useEffect(() => {
    if (formData) {
      try {
        localStorage.setItem(draftKey, JSON.stringify(formData));
      } catch (e) {
        console.warn('[Auto Draft] Error writing draft:', e);
      }
    }
  }, [formData, draftKey]);

  const activeDelegates = useMemo(() => {
    return (delegates || []).filter(u => 
      u.isActive !== false
    );
  }, [delegates]);

  const delegateOptions = useMemo(() => {
    const opts = activeDelegates.map(d => ({ label: d.username, value: d.username }));
    const currentSeller = formData?.exitData?.seller || '';
    if (currentSeller && !activeDelegates.some(d => d.username === currentSeller)) {
      opts.unshift({ label: `${currentSeller} (غير نشط حالياً)`, value: currentSeller });
    }
    return opts;
  }, [activeDelegates, formData?.exitData?.seller]);

  const sellerSuggestions = useMemo(() => {
    const list = new Set<string>();
    activeDelegates.forEach(d => {
      if (d.username) list.add(d.username);
    });
    (users || []).forEach(u => {
      if (u.fullName) list.add(u.fullName);
      if (u.username) list.add(u.username);
    });
    cars.forEach(c => {
      if (c.exitData?.seller) list.add(c.exitData.seller);
      if (c.exitData?.representativeName) list.add(c.exitData.representativeName);
    });
    return Array.from(list).filter(Boolean);
  }, [activeDelegates, users, cars]);

  const reservationDelegateSuggestions = useMemo(() => {
    const list = new Set<string>();
    activeDelegates.forEach(d => {
      if (d.username) list.add(d.username);
    });
    (users || []).forEach(u => {
      if (u.fullName) list.add(u.fullName);
      if (u.username) list.add(u.username);
    });
    cars.forEach(c => {
      if (c.notes) list.add(c.notes);
    });
    return Array.from(list).filter(Boolean);
  }, [activeDelegates, users, cars]);

  const reservationDelegateOptions = useMemo(() => {
    const opts = activeDelegates.map(d => ({ label: d.username, value: d.username }));
    opts.unshift({ label: 'اختر مندوب الحجز...', value: '' });
    const currentNotes = formData.notes || '';
    if (currentNotes && !activeDelegates.some(d => d.username === currentNotes)) {
      opts.push({ label: `${currentNotes} (غير نشط حالياً)`, value: currentNotes });
    }
    return opts;
  }, [activeDelegates, formData.notes]);

  const [dragActive, setDragActive] = useState(false);
  const [existingDocCategories, setExistingDocCategories] = useState<Set<string>>(new Set());
  const [requiredSaleDocs, setRequiredSaleDocs] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('required_sale_docs') || '["registration", "exit_permit", "sales_contract"]');
    } catch {
      return ["registration", "exit_permit", "sales_contract"];
    }
  });

  const [attributionSelect, setAttributionSelect] = useState(() => {
    const src = car?.attributionSource || '';
    if (src === 'سعودي' || src === 'خليجي' || src === '') {
      return src;
    }
    return 'custom';
  });

  const [customAttributionVal, setCustomAttributionVal] = useState(() => {
    const src = car?.attributionSource || '';
    if (src !== 'سعودي' && src !== 'خليجي') {
      return src;
    }
    return '';
  });

  const handleAttributionDropdownChange = (val: string) => {
    setAttributionSelect(val);
    if (val === 'custom') {
      setFormData(prev => ({ ...prev, attributionSource: customAttributionVal }));
    } else {
      setFormData(prev => ({ ...prev, attributionSource: val }));
    }
  };

  const handleCustomAttributionChange = (val: string) => {
    setCustomAttributionVal(val);
    setFormData(prev => ({ ...prev, attributionSource: val }));
  };

  const isAdmin = !currentUser || currentUser?.role === UserRole.ADMIN || String(currentUser?.role).toUpperCase() === 'ADMIN';

  const handleToggleRequiredDoc = (categoryKey: string) => {
    if (!isAdmin) return;
    const isAlreadyRequired = requiredSaleDocs.includes(categoryKey);
    let updated: string[];
    if (isAlreadyRequired) {
      updated = requiredSaleDocs.filter(k => k !== categoryKey);
    } else {
      updated = [...requiredSaleDocs, categoryKey];
    }
    setRequiredSaleDocs(updated);
    localStorage.setItem('required_sale_docs', JSON.stringify(updated));
  };



  useEffect(() => {
    if (car) {
      documentStorageService.getDocumentsForCar(car.id, false).then(docs => {
        const uploadedCategories = new Set(docs.map(d => d.category));
        setExistingDocCategories(uploadedCategories);
      }).catch(err => console.error(err));
    }
  }, [car, activeTab]);

  const [isUploadingCardFile, setIsUploadingCardFile] = useState(false);
  const [previewCardModalUrl, setPreviewCardModalUrl] = useState<string | null>(null);

  useEffect(() => {
    console.group('%c🔍 [Car Debug - Reopened / Mounted]', 'color: #3b82f6; font-weight: bold; font-size: 13px;');
    console.log('%cالبيانات المقروءة بعد إعادة الفتح (Car Loaded):', 'color: #10b981; font-weight: bold;', car);
    console.log('مطابق الهيكل (vinMatching):', car?.vinMatching);
    console.log('مطابق اللوحة (hasPlate/plateNumber):', car?.hasPlate, car?.plateData?.plateNumber);
    console.log('مطابق البطاقة (cardNumber):', car?.cardNumber);
    console.log('ملف البطاقة (cardFile):', car?.cardFile);
    console.log('حالة السيارة (status):', car?.status);
    console.groupEnd();
  }, [car]);

  const handleFileChange = async (file: File) => {
    if (!file) return;
    
    // 1. Instantly read data URL for smooth zero-latency preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setFormData(prev => ({
        ...prev,
        cardFile: (e.target?.result as string) || prev.cardFile,
        cardFileName: file.name
      }));
    };
    reader.readAsDataURL(file);

    // 2. Upload file to server host storage/uploads/
    setIsUploadingCardFile(true);
    try {
      const res = await CarApiService.uploadFile(file);
      if (res && res.fileUrl) {
        setFormData(prev => ({
          ...prev,
          cardFile: res.fileUrl,
          cardFileName: res.originalName || file.name
        }));
      }
    } catch (err) {
      console.warn('Fallback: saving card file as data URL', err);
    } finally {
      setIsUploadingCardFile(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const isStatusActive = (status: string | undefined): boolean => {
    if (!status) return true;
    const s = status.trim().toUpperCase();
    const inactiveKeywords = [
      'مباعة', 'SOLD',
      'قيد التحويل', 'IN_TRANSFER', 'محولة', 'محول', 'منقولة', 'TRANSFERRED',
      'مؤرشفة', 'مؤرشف', 'ARCHIVED', 'مغلقة', 'مغلق', 'CLOSED',
      'ملغاة', 'ملغي', 'CANCELLED'
    ];
    return !inactiveKeywords.some(keyword => s === keyword.toUpperCase() || s.includes(keyword.toUpperCase()));
  };

  const activeVinDuplicateCar = useMemo(() => {
    if (!formData.vin) return null;
    const cleanVin = formData.vin.trim().toUpperCase();
    if (!cleanVin) return null;
    
    const duplicate = cars.find(c => 
      c.vin && 
      c.vin.trim().toUpperCase() === cleanVin && 
      c.id !== car?.id &&
      isStatusActive(c.status)
    );
    return duplicate || null;
  }, [formData.vin, cars, car]);

  const hasInactiveVinRecords = useMemo(() => {
    if (!formData.vin) return false;
    const cleanVin = formData.vin.trim().toUpperCase();
    if (!cleanVin) return false;
    
    const matchingCars = cars.filter(c => 
      c.vin && 
      c.vin.trim().toUpperCase() === cleanVin && 
      c.id !== car?.id
    );
    
    if (matchingCars.length === 0) return false;
    return matchingCars.every(c => !isStatusActive(c.status));
  }, [formData.vin, cars, car]);

  const isVinDuplicate = useMemo(() => {
    return activeVinDuplicateCar !== null;
  }, [activeVinDuplicateCar]);

  const missingRequiredDocs = useMemo(() => {
    if (!formData.isOutbound) return [];
    return requiredSaleDocs.filter(key => !existingDocCategories.has(key));
  }, [formData.isOutbound, requiredSaleDocs, existingDocCategories]);

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isVinDuplicate) {
      return; // Block submission. UI visual cues and disabled button handles the feedback elegantly.
    }

    // Plate details and booking representative name are mandatory for outbound procedures
    if (formData.isOutbound || formData.status === CarStatus.SOLD) {
      if (!formData.notes) {
        setValidationError('⚠️ حقل مندوب الحجز إلزامي لإتمام إجراءات الخروج والتسليم.');
        return;
      }
      if (!formData.plateData?.plateNumber?.trim()) {
        setValidationError('⚠️ حقل بيانات اللوحة (رقم اللوحة والحروف) إلزامي لإتمام إجراءات الخروج والتسليم.');
        return;
      }
    }
    setValidationError(null);

    // Document compliance validation is bypassed here to make it fully optional / non-mandatory as requested.

    const finalizedData = {
      ...formData,
      vinMatching: (formData.vinMatching === 'غير مطابق' || formData.vinMatching === 'غير متطابق') ? 'غير متطابق' : 'متطابق',
      entryDate: (() => {
        if (car?.entryDate && formData.entryDate === car.entryDate.split('T')[0]) {
          return car.entryDate;
        }
        return formData.entryDate ? `${formData.entryDate}T12:00:00.000Z` : new Date().toISOString();
      })(),
      reservedByUserId: formData.status === CarStatus.RESERVED ? (formData.notes || car?.reservedByUserId) : undefined,
      exitData: {
        ...formData.exitData,
        carCondition: formData.notes,
        seller: formData.notes,
        representativeName: formData.notes
      },
      presenceDescription: formData.presenceDescription,
      customData: {
        ...formData.customData,
        presenceDescription: formData.presenceDescription,
        entryDriverName: formData.entryDriverName,
        entryTransportCompany: formData.entryTransportCompany,
        entryNotes: formData.entryNotes
      }
    };

    console.group('%c✍️ [Car Debug - On Save / Submit]', 'color: #f59e0b; font-weight: bold; font-size: 13px;');
    console.log('%cالقيمة قبل التعديل (Before Edit):', 'color: #ef4444;', {
      vinMatching: car?.vinMatching || 'مطابق',
      cardNumber: car?.cardNumber || 'لم يرد البطاقه بعد',
      hasPlate: car?.hasPlate || false,
      plateData: car?.plateData,
      status: car?.status
    });
    console.log('%cالقيمة بعد التعديل (After Edit):', 'color: #10b981;', {
      vinMatching: finalizedData.vinMatching,
      cardNumber: finalizedData.cardNumber,
      hasPlate: finalizedData.hasPlate,
      plateData: finalizedData.plateData,
      status: finalizedData.status
    });
    console.groupEnd();

    try {
      localStorage.removeItem(draftKey);
    } catch (e) {
      console.warn('[Auto Draft] Error removing draft on save:', e);
    }
    onSave(finalizedData);
  };

  const handleOutboundToggle = () => {
    const newState = !formData.isOutbound;
    setFormData(prev => ({
      ...prev, 
      isOutbound: newState,
      hasPlate: newState ? true : prev.hasPlate,
      status: newState ? CarStatus.SOLD : CarStatus.AVAILABLE,
      exitData: {
        ...prev.exitData,
        exitDate: newState ? new Date().toISOString().split('T')[0] : prev.exitData.exitDate
      }
    }));
  };

  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto overscroll-contain touch-pan-y bg-slate-950/75 backdrop-blur-md p-2 sm:p-4 md:p-6 flex items-center justify-center animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-3xl md:rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] min-h-0 border border-white/10 text-right my-auto" dir="rtl">
        <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950 shrink-0">
          <h3 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white flex items-center gap-4">
            <CarIcon className="text-blue-600" />
            {car ? (formData.isOutbound ? 'تعديل بيانات مبيعات السيارة' : 'تعديل بيانات السيارة') : 'إضافة سيارة جديدة للمخزون'}
          </h3>
          <button onClick={onClose} className="p-3 md:p-4 text-slate-400 hover:text-rose-500 transition-colors"><X size={28} /></button>
        </div>

        {draftExists && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/60 p-4 px-6 md:px-8 flex flex-col sm:flex-row justify-between items-center gap-3 text-amber-800 dark:text-amber-300 animate-in slide-in-from-top duration-300 shrink-0">
            <span className="text-xs md:text-sm font-bold flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-500 rounded-full animate-ping"></span>
              تم العثور على مسودة غير محفوظة لبيانات هذه السيارة. هل تريد استعادتها وتعبئة الحقول؟
            </span>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (draftData) {
                    setFormData(draftData);
                  }
                  setDraftExists(false);
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl transition-all hover:scale-105 cursor-pointer border-0"
              >
                استعادة المسودة
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.removeItem(draftKey);
                  } catch (e) {}
                  setDraftExists(false);
                }}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-black rounded-xl transition-all hover:scale-105 cursor-pointer border-0"
              >
                تجاهل المسودة
              </button>
            </div>
          </div>
        )}

        {car && (
          <div className="flex bg-slate-50 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800 px-6 md:px-8 gap-6 animate-in fade-in shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('info')}
              className={`py-3 md:py-4 px-4 font-black text-sm border-b-4 transition-all cursor-pointer ${
                activeTab === 'info'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              بيانات ومواصفات السيارة
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('documents')}
              className={`py-3 md:py-4 px-4 font-black text-sm border-b-4 transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'documents'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              <span>ملف ومستندات السيارة</span>
              <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[10px] font-black px-1.5 py-0.5 rounded-full inline-block">وثيقة</span>
            </button>
          </div>
        )}

        {activeTab === 'info' ? (
          <form onSubmit={handleSave} className="flex-1 min-h-0 overflow-y-auto p-6 md:p-10 space-y-8 md:space-y-12 custom-scrollbar overscroll-contain">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {(() => {
              const defaultKeys = [
                'brand', 'model', 'color', 'interiorColor', 'year', 'status', 'presence',
                'vin', 'vinMatching', 'plate', 'cardNumber', 'ownershipType',
                'costPrice', 'price', 'rentalStatus', 'supplier', 'attributionSource'
              ];

              const customFieldsList = (settings.addCarCustomFields && settings.addCarCustomFields.length > 0) 
                ? settings.addCarCustomFields 
                : (settings.customFields || []);

              const customKeys = customFieldsList.map(cf => cf.id);
              const configuredOrder = settings.addCarFieldsOrder || [];

              const orderedKeys: string[] = [];
              for (const key of configuredOrder) {
                if (defaultKeys.includes(key) || customKeys.includes(key) || key === 'hasPlate') {
                  if (!orderedKeys.includes(key)) orderedKeys.push(key);
                }
              }
              for (const key of defaultKeys) {
                if (!orderedKeys.includes(key) && !(key === 'plate' && orderedKeys.includes('hasPlate'))) {
                  orderedKeys.push(key);
                }
              }
              for (const key of customKeys) {
                if (!orderedKeys.includes(key)) {
                  orderedKeys.push(key);
                }
              }

              return orderedKeys.map(fieldKey => {
                // 1. Check if it is a custom field
                const customFieldObj = customFieldsList.find(cf => cf.id === fieldKey);
                if (customFieldObj) {
                  const isVisible = settings.addCarFieldsVisible ? settings.addCarFieldsVisible[customFieldObj.id] !== false : true;
                  if (!isVisible) return null;

                  if (customFieldObj.type === 'select' && customFieldObj.options && customFieldObj.options.length > 0) {
                    return (
                      <SelectField
                        key={customFieldObj.id}
                        label={customFieldObj.label}
                        value={formData.customData[customFieldObj.id] || ''}
                        onChange={(v: string) => setFormData({
                          ...formData,
                          customData: { ...formData.customData, [customFieldObj.id]: v }
                        })}
                        options={customFieldObj.options.map(opt => ({ label: opt, value: opt }))}
                        icon={List}
                      />
                    );
                  }
                  if (customFieldObj.type === 'textarea') {
                    return (
                      <div key={customFieldObj.id} className="md:col-span-3 space-y-2">
                        <label className="text-xs font-black text-slate-500 dark:text-slate-400 block pr-1">
                          {customFieldObj.label}
                        </label>
                        <textarea
                          value={formData.customData[customFieldObj.id] || ''}
                          onChange={e => setFormData({
                            ...formData,
                            customData: { ...formData.customData, [customFieldObj.id]: e.target.value }
                          })}
                          required={customFieldObj.required}
                          placeholder={customFieldObj.placeholder || ''}
                          className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-blue-500 font-bold text-slate-800 dark:text-slate-100 min-h-[100px]"
                        />
                      </div>
                    );
                  }
                  return (
                    <InputField 
                      key={customFieldObj.id}
                      label={customFieldObj.label}
                      type={customFieldObj.type || 'text'}
                      required={customFieldObj.required}
                      value={formData.customData[customFieldObj.id] || ''}
                      onChange={(v: any) => setFormData({
                        ...formData,
                        customData: { ...formData.customData, [customFieldObj.id]: v }
                      })}
                      placeholder={customFieldObj.placeholder || ''}
                      icon={customFieldObj.type === 'date' ? Calendar : customFieldObj.type === 'number' ? DollarSign : Type}
                      suggestions={customFieldsSuggestions[customFieldObj.id] || []}
                    />
                  );
                }

                // 2. Standard fields
                switch (fieldKey) {
                  case 'brand':
                    if (settings.addCarFieldsVisible && settings.addCarFieldsVisible.brand === false) return null;
                    return (
                      <InputField 
                        key="brand"
                        label={settings.addCarFieldLabels?.brand || "الشركة أو الماركة (مثل تويوتا، نيسان)"} 
                        value={formData.brand} 
                        onChange={(v: string) => setFormData({...formData, brand: v})} 
                        required={!settings.addCarFieldsVisible || settings.addCarFieldsVisible.brand !== false} 
                        icon={Tag} 
                        suggestions={brandSuggestions} 
                      />
                    );

                  case 'model':
                    return (
                      <InputField 
                        key="model"
                        label={settings.addCarFieldLabels?.model || "طراز السيارة / الموديل (مثل كامري، ديدسن)"} 
                        value={formData.model} 
                        onChange={(v: string) => setFormData({...formData, model: v})} 
                        required 
                        icon={Type} 
                        suggestions={modelSuggestions} 
                      />
                    );

                  case 'color':
                    if (settings.addCarFieldsVisible && settings.addCarFieldsVisible.color === false) return null;
                    return (
                      <InputField 
                        key="color"
                        label={settings.addCarFieldLabels?.color || "اللون الخارجي"} 
                        value={formData.color} 
                        onChange={(v: string) => setFormData({...formData, color: v})} 
                        icon={Palette} 
                        suggestions={colorSuggestions} 
                      />
                    );

                  case 'interiorColor':
                    if (settings.addCarFieldsVisible && settings.addCarFieldsVisible.interiorColor === false) return null;
                    return (
                      <InputField 
                        key="interiorColor"
                        label={settings.addCarFieldLabels?.interiorColor || "اللون الداخلي"} 
                        value={formData.interiorColor} 
                        onChange={(v: string) => setFormData({...formData, interiorColor: v})} 
                        icon={Palette} 
                        suggestions={interiorColorSuggestions} 
                      />
                    );

                  case 'year':
                    if (settings.addCarFieldsVisible && settings.addCarFieldsVisible.year === false) return null;
                    return (
                      <InputField 
                        key="year"
                        label={settings.addCarFieldLabels?.year || "الموديل (سنة الصنع)"} 
                        type="number" 
                        value={formData.year.toString()} 
                        onChange={(v: string) => setFormData({...formData, year: parseInt(v) || 0})} 
                        icon={Calendar} 
                      />
                    );

                  case 'status': {
                    if (settings.addCarFieldsVisible && settings.addCarFieldsVisible.status === false) return null;
                    const statusOptions = [
                      ...Object.values(CarStatus).map(s => ({ label: s, value: s })),
                      ...(settings.statusColors?.customStatuses || []).map(cs => ({ label: cs.name, value: cs.name }))
                    ];
                    return (
                      <SelectField 
                        key="status"
                        label={settings.addCarFieldLabels?.status || "حالة السيارة"} 
                        value={formData.status} 
                        onChange={(v: any) => {
                          const isNotArrivedStatus = v === CarStatus.NOT_ARRIVED_SHOWROOM || v === CarStatus.NOT_ARRIVED;
                          setFormData(prev => ({
                            ...prev,
                            status: v,
                            isPresentInShowroom: isNotArrivedStatus ? false : prev.isPresentInShowroom,
                            isOutbound: prev.isOutbound,
                            exitData: {
                              ...prev.exitData
                            }
                          }));
                        }} 
                        options={statusOptions}
                        icon={Layers}
                      />
                    );
                  }

                  case 'presence': {
                    const isInShowroom = formData.isPresentInShowroom && formData.status !== CarStatus.NOT_ARRIVED_SHOWROOM && formData.status !== CarStatus.NOT_ARRIVED;
                    const showroomChips = [
                      'جاهزة للعرض بالصالة',
                      'في قسم التجهيز والتلميع',
                      'بالمستودع الرئيسي',
                      'بالموقف الخارجي',
                      'جاهزة للتسليم الفوري',
                      'تحت الفحص والاستلام'
                    ];
                    const shippingChips = [
                      'في الطريق من الميناء',
                      'قيد التخليص الجمركي',
                      'على ظهر الناقلة (شحن بري)',
                      'في مستودع المورد بالرياض',
                      'وصول متوقع خلال 48 ساعة',
                      'قيد الشحن الدولي'
                    ];

                    return (
                      <div key="presence" className="md:col-span-3 bg-slate-50 dark:bg-slate-950/60 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
                        <label className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <Truck className="text-amber-500" size={18} />
                            <span>مكان التواجد الفعلي (المخزون أم الشحن والواردات)</span>
                          </span>
                          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                            isInShowroom 
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                          }`}>
                            {isInShowroom ? 'مخزون فعلي بالمعرض' : 'قيد الشحن والواردات'}
                          </span>
                        </label>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                isPresentInShowroom: true,
                                status: (prev.status === CarStatus.NOT_ARRIVED_SHOWROOM || prev.status === CarStatus.NOT_ARRIVED) ? CarStatus.AVAILABLE : prev.status
                              }));
                            }}
                            className={`p-3.5 rounded-xl border text-right transition-all flex items-center gap-3 cursor-pointer ${
                              isInShowroom
                                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-800 dark:text-emerald-300 font-black shadow-sm ring-2 ring-emerald-500/20'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-emerald-300 dark:hover:border-emerald-800'
                            }`}
                          >
                            <Building2 size={22} className={isInShowroom ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'} />
                            <div>
                              <div className="text-xs font-bold">موجودة في المعرض الفعلي</div>
                              <div className="text-[10px] opacity-75">تُدرج فوراً في المخزون والتقارير</div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                isPresentInShowroom: false,
                                status: CarStatus.NOT_ARRIVED_SHOWROOM
                              }));
                            }}
                            className={`p-3.5 rounded-xl border text-right transition-all flex items-center gap-3 cursor-pointer ${
                              !isInShowroom
                                ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-500 text-amber-800 dark:text-amber-300 font-black shadow-sm ring-2 ring-amber-500/20'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-amber-300 dark:hover:border-amber-800'
                            }`}
                          >
                            <Truck size={22} className={!isInShowroom ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'} />
                            <div>
                              <div className="text-xs font-bold">لم تصل المعرض (قيد الشحن والواردات)</div>
                              <div className="text-[10px] opacity-75">تُحفظ في الشحن ولا تُدمج بالمخزون لحين اعتماد دخولها</div>
                            </div>
                          </button>
                        </div>

                        {/* Description field tailored to the selected state */}
                        <div className={`p-3.5 sm:p-4 rounded-xl border transition-all space-y-2.5 ${
                          isInShowroom
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40'
                            : 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40'
                        }`}>
                          <div className="flex items-center justify-between gap-2">
                            <label className="text-xs font-bold flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                              {isInShowroom ? (
                                <>
                                  <Building2 size={15} className="text-emerald-600 dark:text-emerald-400" />
                                  <span>وصف حالة وموقع السيارة في المعرض:</span>
                                </>
                              ) : (
                                <>
                                  <Truck size={15} className="text-amber-600 dark:text-amber-400" />
                                  <span>وصف وتفاصيل مسار الشحن والواردات:</span>
                                </>
                              )}
                            </label>
                            <span className="text-[10px] text-slate-400 font-normal">اختياري</span>
                          </div>

                          <div className="relative">
                            <input
                              type="text"
                              value={formData.presenceDescription || ''}
                              onChange={(e) => setFormData(prev => ({ ...prev, presenceDescription: e.target.value }))}
                              placeholder={
                                isInShowroom
                                  ? 'مثال: جاهزة للعرض بالصالة، الموقف A4، في قسم التلميع والتجهيز...'
                                  : 'مثال: في الطريق من ميناء الملك عبدالعزيز، قيد التخليص الجمركي، على ظهر ناقلة البسامي، وصول متوقع الثلاثاء...'
                              }
                              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-inner"
                            />
                            {formData.presenceDescription && (
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, presenceDescription: '' }))}
                                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                                title="مسح النص"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>

                          {/* Quick selection tags */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="text-[10px] font-bold text-slate-400 ml-1">اقتراحات سريعة:</span>
                            {(isInShowroom ? showroomChips : shippingChips).map((chip, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  setFormData(prev => {
                                    const current = prev.presenceDescription?.trim() || '';
                                    if (!current) return { ...prev, presenceDescription: chip };
                                    if (current.includes(chip)) return prev;
                                    return { ...prev, presenceDescription: `${current} - ${chip}` };
                                  });
                                }}
                                className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                                  formData.presenceDescription?.includes(chip)
                                    ? isInShowroom
                                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                      : 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                                }`}
                              >
                                + {chip}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  case 'vin':
                    if (settings.addCarFieldsVisible && settings.addCarFieldsVisible.vin === false) return null;
                    return (
                      <div key="vin" className="space-y-1 relative">
                        <div className="relative">
                          <InputField 
                            label={settings.addCarFieldLabels?.vin || "رقم الهيكل (VIN)"} 
                            value={formData.vin} 
                            onChange={(v: string) => {
                              const cleaned = v.toUpperCase().trim();
                              setFormData({...formData, vin: cleaned});
                            }} 
                            required={!settings.addCarFieldsVisible || settings.addCarFieldsVisible.vin !== false} 
                            icon={Hash} 
                            error={isVinDuplicate}
                          />
                          {formData.vin && !isVinDuplicate && (
                            <div className="absolute left-4 top-[38px] text-emerald-500 font-extrabold flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/40 p-1.5 rounded-full border border-emerald-250 dark:border-emerald-800/40 text-xs shadow-sm animate-in fade-in zoom-in-50 duration-200">
                              <Check size={14} className="stroke-[3]" />
                            </div>
                          )}
                        </div>
                        {formData.vin && (
                          <div className={`text-xs font-black mt-1 mr-2 flex items-center gap-2 p-3 rounded-xl border transition-all duration-300 ${
                            isVinDuplicate 
                              ? 'text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/30 animate-pulse' 
                              : hasInactiveVinRecords
                                ? 'text-amber-600 dark:text-amber-450 bg-amber-50 dark:bg-amber-950/30 border-amber-250 dark:border-amber-900/30'
                                : 'text-emerald-600 dark:text-emerald-450 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-250 dark:border-emerald-900/30'
                          }`}>
                            {isVinDuplicate ? (
                              <>
                                <span>⚠️</span>
                                <span>رقم الهيكل موجود حاليًا في المخزون</span>
                              </>
                            ) : hasInactiveVinRecords ? (
                              <>
                                <span>ℹ️</span>
                                <span>تم العثور على سجل سابق للسيارة وتم السماح بإعادة إدخالها</span>
                              </>
                            ) : (
                              <>
                                <span>✓</span>
                                <span>رقم الهيكل متاح</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );

                  case 'vinMatching':
                    if (settings.addCarFieldsVisible && settings.addCarFieldsVisible.vinMatching === false) return null;
                    return (
                      <SelectField 
                        key="vinMatching"
                        label={settings.addCarFieldLabels?.vinMatching || "مطابقة الهيكل"} 
                        value={formData.vinMatching} 
                        onChange={(v: any) => setFormData({...formData, vinMatching: v})} 
                        options={[
                          { label: 'متطابق', value: 'متطابق' },
                          { label: 'غير متطابق', value: 'غير متطابق' }
                        ]}
                        icon={CheckCircle2}
                        disabled={false}
                      />
                    );

                  case 'plate':
                  case 'hasPlate':
                    if (settings.addCarFieldsVisible && (settings.addCarFieldsVisible.plate === false || settings.addCarFieldsVisible.hasPlate === false)) return null;
                    return (
                      <InputField 
                        key="plate"
                        label={settings.addCarFieldLabels?.hasPlate || settings.addCarFieldLabels?.plate || "رقم اللوحة"} 
                        value={formData.plateData.plateNumber} 
                        onChange={(v: string) => setFormData({...formData, plateData: {...formData.plateData, plateNumber: v}})} 
                        icon={Hash} 
                      />
                    );

                  case 'cardNumber':
                    if (settings.addCarFieldsVisible && settings.addCarFieldsVisible.cardNumber === false) return null;
                    return (
                      <InputField 
                        key="cardNumber"
                        label={settings.addCarFieldLabels?.cardNumber || "رقم البطاقة الجمركية"} 
                        value={formData.cardNumber} 
                        onChange={(v: string) => {
                          setFormData({
                            ...formData, 
                            cardNumber: v
                          });
                        }} 
                        icon={CreditCard} 
                        suggestions={cardNumberSuggestions}
                      />
                    );

                  case 'ownershipType':
                    if (settings.addCarFieldsVisible && settings.addCarFieldsVisible.ownershipType === false) return null;
                    return (
                      <SelectField 
                        key="ownershipType"
                        label={settings.addCarFieldLabels?.ownershipType || "المالك (نوع الملكية)"} 
                        value={formData.ownershipType} 
                        onChange={(v: string) => setFormData({...formData, ownershipType: v})} 
                        options={[
                          { label: 'مباشر', value: 'مباشر' },
                          { label: 'تصريف', value: 'تصريف' }
                        ]}
                        placeholder="اكتب اسم المالك أو اختر مباشر/تصريف..."
                        icon={UserCheck}
                      />
                    );

                  case 'costPrice':
                    if (settings.addCarFieldsVisible && settings.addCarFieldsVisible.costPrice === false) return null;
                    return (
                      <InputField 
                        key="costPrice"
                        label={settings.addCarFieldLabels?.costPrice || "التكلفة"} 
                        type="number" 
                        value={formData.costPrice.toString()} 
                        onChange={(v: string) => setFormData({...formData, costPrice: parseFloat(v)})} 
                        icon={DollarSign} 
                      />
                    );

                  case 'price':
                    if (settings.addCarFieldsVisible && settings.addCarFieldsVisible.price === false) return null;
                    return (
                      <InputField 
                        key="price"
                        label={settings.addCarFieldLabels?.price || `السعر (${settings.currency})`} 
                        type="number" 
                        value={formData.price.toString()} 
                        onChange={(v: string) => setFormData({...formData, price: parseFloat(v)})} 
                        required 
                        icon={DollarSign} 
                      />
                    );

                  case 'rentalStatus':
                    if (settings.addCarFieldsVisible && settings.addCarFieldsVisible.rentalStatus === false) return null;
                    return (
                      <SelectField 
                        key="rentalStatus"
                        label={settings.addCarFieldLabels?.rentalStatus || "حالة التجير (مجير أو لم يتم التجير)"} 
                        value={formData.rentalStatus} 
                        onChange={(v: any) => setFormData({...formData, rentalStatus: v})} 
                        options={Object.values(RentalStatus).map(s => ({ label: s, value: s }))}
                        placeholder="اكتب حالة التجير أو اختر..."
                        icon={RefreshCcw}
                      />
                    );

                  case 'supplier':
                    if (settings.addCarFieldsVisible && settings.addCarFieldsVisible.supplier === false) return null;
                    return (
                      <InputField 
                        key="supplier"
                        label={settings.addCarFieldLabels?.supplier || "المورد"} 
                        value={formData.supplier} 
                        onChange={(v: string) => setFormData({...formData, supplier: v})} 
                        icon={Building2} 
                        suggestions={supplierSuggestions} 
                      />
                    );

                  case 'attributionSource':
                    return (
                      <SelectField 
                        key="attributionSource"
                        label={settings.addCarFieldLabels?.attributionSource || "وارد السيارة"} 
                        value={formData.attributionSource || ''} 
                        onChange={(v: string) => setFormData({ ...formData, attributionSource: v })} 
                        options={[
                          { label: 'سعودي', value: 'سعودي' },
                          { label: 'خليجي', value: 'خليجي' },
                          { label: 'أمريكي', value: 'أمريكي' },
                          { label: 'كندي', value: 'كندي' },
                          { label: 'أوروبي', value: 'أوروبي' },
                          { label: 'كوري', value: 'كوري' },
                          { label: 'ياباني', value: 'ياباني' },
                          { label: 'غير محدد', value: '' }
                        ]}
                        suggestions={customAttributionSuggestions}
                        placeholder="اكتب وارد السيارة أو اختر من القائمة..."
                        icon={Flag}
                      />
                    );

                  default:
                    return null;
                }
              });
            })()}
          </div>

          {/* حقل ملف البطاقة (الملف الخاص بالسيارة) */}
          <div 
            className={`p-6 md:p-8 rounded-3xl md:rounded-[2.5rem] border-2 border-dashed transition-all text-center relative ${
              dragActive 
                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20' 
                : 'border-slate-200 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-950/20'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="flex items-center gap-3 text-right mb-4">
              <div className="w-10 h-10 bg-blue-600/10 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center shadow-sm">
                <FileUp size={20} />
              </div>
              <div>
                <h4 className="text-lg font-black text-slate-800 dark:text-white">ملف البطاقة (مستند رئيسي للسيارة)</h4>
                <p className="text-xs text-slate-400 font-bold">يتم رفع الملف وحفظ مساره في قاعدة البيانات فوراً دون فقدان</p>
              </div>
            </div>

            <div className="py-4 flex flex-col items-center justify-center gap-3">
              {isUploadingCardFile ? (
                <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 p-4 rounded-2xl text-blue-600 dark:text-blue-400">
                  <Loader2 size={20} className="animate-spin" />
                  <span className="text-xs font-bold">جاري رفع وحفظ ملف البطاقة على الاستضافة...</span>
                </div>
              ) : formData.cardFile ? (
                <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm text-right w-full max-w-xl">
                  <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-[200px]">
                    <Paperclip size={18} className="text-emerald-500 shrink-0" />
                    <span className="text-xs font-black truncate text-slate-700 dark:text-slate-300">
                      {formData.cardFileName || 'ملف البطاقة الجمركية المرفق'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button 
                      type="button" 
                      onClick={() => setPreviewCardModalUrl(formData.cardFile || null)}
                      className="p-1.5 px-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 transition-colors text-[11px] font-black cursor-pointer flex items-center gap-1"
                    >
                      <Eye size={14} /> معاينة
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setFormData({...formData, cardFile: '', cardFileName: ''})}
                      className="p-1.5 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition-colors text-[11px] font-black cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 size={14} /> حذف
                    </button>
                  </div>
                </div>
              ) : (
                <label className="cursor-pointer group flex flex-col items-center gap-2">
                  <div className="p-4 bg-slate-100 dark:bg-slate-900 rounded-full group-hover:scale-105 transition-transform border border-slate-200/50 dark:border-slate-800">
                    <FileUp size={24} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                  </div>
                  <span className="text-xs font-black text-blue-600 dark:text-blue-400 underline decoration-dotted">اختر ملف البطاقة أو اسقط الملف هنا</span>
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/*,application/pdf" 
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileChange(e.target.files[0]);
                      }
                    }} 
                  />
                  <span className="text-[10px] font-bold text-slate-400">يدعم الصور وملفات PDF من جهازك</span>
                </label>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg"><UserIcon size={20} /></div>
              <h4 className="text-xl font-black text-slate-800 dark:text-white">مندوب الحجز</h4>
            </div>
            <InputField 
              label="اسم مندوب الحجز (كتابة يدوية أو اختيار)" 
              value={formData.notes || ''} 
              onChange={(v: string) => setFormData({ ...formData, notes: v })} 
              icon={UserIcon} 
              suggestions={reservationDelegateSuggestions}
            />
            {activeDelegates.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 self-center ml-1">تحديد سريع:</span>
                {activeDelegates.map(d => (
                  <button
                    type="button"
                    key={d.username}
                    onClick={() => setFormData({
                      ...formData,
                      notes: d.username
                    })}
                    className={`px-3 py-1 text-xs font-bold rounded-full transition-all border cursor-pointer ${
                      formData.notes === d.username 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                        : 'bg-slate-100 hover:bg-blue-50 hover:text-blue-600 dark:bg-slate-800 dark:hover:bg-slate-700/80 dark:text-slate-300 border-slate-200/50 dark:border-slate-700'
                    }`}
                  >
                    {d.username}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg"><Paperclip size={20} /></div>
              <h4 className="text-xl font-black text-slate-800 dark:text-white">ملاحظات السيارة</h4>
            </div>
            <textarea 
              className="w-full p-6 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] outline-none focus:border-blue-500 font-bold text-right shadow-inner dark:text-white min-h-[60px] transition-all"
              value={formData.carRemark}
              onChange={e => setFormData({...formData, carRemark: e.target.value})}
              placeholder="أدخل أي ملاحظات إضافية، مواصفات أو أعطال بخصوص هذه السيارة..."
              rows={2}
            />
          </div>

          <div className="p-8 bg-blue-50 dark:bg-blue-500/5 rounded-[2.5rem] border border-blue-100 dark:border-blue-900/20 space-y-8 shadow-inner">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg"><IdCard size={20} /></div>
                   <h4 className="text-xl font-black text-slate-800 dark:text-white">خدمة بيانات لوحة السيارة</h4>
                </div>
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, hasPlate: !formData.hasPlate})}
                  className={`w-16 h-8 rounded-full transition-all flex items-center px-1 ${formData.hasPlate ? 'bg-blue-600 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'}`}
                >
                  <div className="w-6 h-6 bg-white rounded-full shadow-md" />
                </button>
             </div>

             {formData.hasPlate && (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in zoom-in-95">
                  <InputField label="رقم اللوحة والحروف" value={formData.plateData.plateNumber} onChange={(v: string) => setFormData({...formData, plateData: {...formData.plateData, plateNumber: v}})} icon={Hash} />
               </div>
             )}
          </div>


           <div className="p-8 bg-teal-50 dark:bg-teal-500/5 rounded-[2.5rem] border border-teal-100 dark:border-teal-900/20 space-y-8 shadow-inner">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-teal-600 text-white rounded-xl flex items-center justify-center shadow-lg"><Calendar size={20} /></div>
                 <h4 className="text-xl font-black text-slate-800 dark:text-white">بيانات دخول واستلام السيارة (الوارد للمخزن)</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                 <InputField 
                    label="تاريخ الدخول والاستلام" 
                    type="date"
                    value={formData.entryDate} 
                    onChange={(v: string) => setFormData({...formData, entryDate: v})} 
                    icon={Calendar} 
                 />
                 <InputField 
                    label="اسم سائق ناقلة الدخول" 
                    value={formData.entryDriverName || ''} 
                    onChange={(v: string) => setFormData({...formData, entryDriverName: v})} 
                    icon={UserIcon} 
                    suggestions={entryDriverSuggestions}
                 />
                 <InputField 
                    label="شركة شحن / نقليات الدخول" 
                    value={formData.entryTransportCompany || ''} 
                    onChange={(v: string) => setFormData({...formData, entryTransportCompany: v})} 
                    icon={Truck} 
                    suggestions={entryTransportSuggestions}
                 />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-2">ملاحظات الاستلام والدخول</label>
                <textarea 
                  className="w-full p-6 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl outline-none focus:border-teal-500 font-bold text-right shadow-sm dark:text-white min-h-[80px]"
                  value={formData.entryNotes || ''}
                  onChange={e => setFormData({...formData, entryNotes: e.target.value})}
                  placeholder="أي ملاحظات إضافية بخصوص حالة السيارة عند الدخول والاستلام بالمستودع..."
                />
              </div>
           </div>

          <div className="p-8 bg-emerald-50 dark:bg-emerald-500/5 rounded-[2.5rem] border border-emerald-100 dark:border-emerald-900/20 space-y-8 shadow-inner">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-lg"><LogOut size={20} /></div>
                   <h4 className="text-xl font-black text-slate-800 dark:text-white">إجراءات خروج وتسليم المركبة (المبيعات / الصادر)</h4>
                </div>
                {!hideOutboundToggle && (
                  <button 
                    type="button"
                    onClick={handleOutboundToggle}
                    className={`w-16 h-8 rounded-full transition-all flex items-center px-1 ${formData.isOutbound ? 'bg-emerald-600 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'}`}
                  >
                    <div className="w-6 h-6 bg-white rounded-full shadow-md" />
                  </button>
                )}
             </div>

              {formData.isOutbound && (
                <div className="space-y-6">
                  {/* Document compliance checking is optional and section is hidden as requested */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in zoom-in-95">
                    <SelectField 
                      label="نوع المستلم" 
                      value={formData.exitData.deliveryType} 
                      onChange={(v: any) => setFormData({...formData, exitData: {...formData.exitData, deliveryType: v}})} 
                      options={Object.values(DeliveryType).map(d => ({ label: d, value: d }))}
                      icon={UserCheck}
                    />
                    {formData.exitData.deliveryType === DeliveryType.TRANSPORT && (
                      <InputField 
                        label="اسم شركة النقليات" 
                        value={formData.exitData.transportCompany || ''} 
                        onChange={(v: string) => setFormData({...formData, exitData: {...formData.exitData, transportCompany: v}})} 
                        icon={Truck} 
                        required
                        suggestions={exitTransportSuggestions}
                      />
                    )}
                    <InputField label="المبلغ (البيع)" type="number" value={formData.price.toString()} onChange={(v: string) => setFormData({...formData, price: parseFloat(v)})} icon={DollarSign} />
                    <InputField label="العميل" value={formData.exitData.receiverName} onChange={(v: string) => setFormData({...formData, exitData: {...formData.exitData, receiverName: v}})} icon={UserIcon} suggestions={receiverNameSuggestions} />
                    <InputField 
                      label="هوية العميل" 
                      value={formData.exitData.receiverId} 
                      onChange={(v: string) => {
                        const updatedExit = { ...formData.exitData, receiverId: v };
                        if (v.trim()) {
                          const match = lookupCustomerById(v, cars);
                          if (match) {
                            if (match.phone) updatedExit.receiverPhone = match.phone;
                            if (match.name && !updatedExit.receiverName) updatedExit.receiverName = match.name;
                            if (match.nationality && !updatedExit.nationality) updatedExit.nationality = match.nationality;
                          }
                        }
                        setFormData({ ...formData, exitData: updatedExit });
                      }} 
                      icon={Hash} 
                      suggestions={receiverIdSuggestions} 
                    />
                    <InputField label="الجنسية" value={formData.exitData.nationality || ''} onChange={(v: string) => setFormData({...formData, exitData: {...formData.exitData, nationality: v}})} icon={Flag} suggestions={nationalitySuggestions} />
                    <InputField label="رقم الهاتف" value={formData.exitData.receiverPhone} onChange={(v: string) => setFormData({...formData, exitData: {...formData.exitData, receiverPhone: v}})} icon={Phone} suggestions={receiverPhoneSuggestions} />
                    <InputField label="تاريخ الخروج" type="date" value={formData.exitData.exitDate} onChange={(v: string) => setFormData({...formData, exitData: {...formData.exitData, exitDate: v}})} icon={Calendar} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-2">ملاحظات الخروج</label>
                    <textarea 
                      className="w-full p-6 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl outline-none focus:border-emerald-500 font-bold text-right shadow-sm dark:text-white min-h-[100px]"
                      value={formData.exitData.notes}
                      onChange={e => setFormData({...formData, exitData: {...formData.exitData, notes: e.target.value}})}
                      placeholder="أي ملاحظات إضافية بخصوص تسليم المركبة..."
                    />
                  </div>
                </div>
              )}
          </div>
        </form>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto p-6 md:p-10 custom-scrollbar overscroll-contain">
            <VehicleDocumentsTab 
              car={car!} 
              currentUser={currentUser} 
              settings={settings} 
            />
          </div>
        )}

        {validationError && (
          <div className="mx-6 md:mx-10 mt-4 p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl text-rose-600 dark:text-rose-400 text-xs font-bold text-right flex items-center gap-2 animate-bounce shrink-0">
            <AlertCircle size={16} />
            <span>{validationError}</span>
          </div>
        )}

        {activeTab === 'info' ? (
          <div className="p-6 md:p-10 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-4 bg-slate-50 dark:bg-slate-950/80 shrink-0">
            <button 
              type="button" 
              onClick={handleSave} 
              disabled={isVinDuplicate || isUploadingCardFile}
              className={`flex-1 py-4 md:py-6 font-black rounded-2xl md:rounded-3xl text-lg md:text-xl shadow-xl flex items-center justify-center gap-4 transition-all cursor-pointer ${
                isVinDuplicate 
                  ? 'bg-rose-600 text-white cursor-not-allowed opacity-90' 
                  : isUploadingCardFile
                  ? 'bg-blue-400 text-white cursor-wait'
                  : 'bg-blue-600 hover:scale-[1.01] text-white'
              }`}
            >
               {isUploadingCardFile ? (
                 <>
                   <Loader2 size={24} className="animate-spin" />
                   جاري رفع ملف البطاقة...
                 </>
               ) : (
                 <>
                   <CheckCircle2 size={24} /> {isVinDuplicate ? 'رقم الهيكل مسجل مسبقاً!' : car ? 'حفظ التعديلات' : 'تأكيد الإضافة'}
                 </>
               )}
            </button>
            <button 
              type="button" 
              onClick={onClose} 
              className="px-8 md:px-12 py-4 md:py-6 bg-white dark:bg-slate-800 text-slate-500 font-black rounded-2xl md:rounded-3xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        ) : (
          <div className="p-6 md:p-10 border-t border-slate-100 dark:border-slate-800 flex gap-4 bg-slate-50 dark:bg-slate-950/80 shrink-0">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-4 md:py-6 bg-blue-600 hover:scale-[1.01] text-white font-black rounded-2xl md:rounded-3xl text-lg md:text-xl shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              تم وإغلاق المستندات
            </button>
          </div>
        )}
      </div>

      {/* مودال معاينة ملف البطاقة المرفوع */}
      {previewCardModalUrl && (
        <div className="fixed inset-0 z-[300] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto overscroll-contain touch-pan-y" onClick={() => setPreviewCardModalUrl(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-white/20 my-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 px-6 bg-slate-100 dark:bg-slate-800 flex justify-between items-center">
              <span className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                <Paperclip size={18} className="text-blue-500" />
                معاينة مستند البطاقة الجمركية
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={previewCardModalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <ExternalLink size={14} /> فتح في نافذة مستقلة
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewCardModalUrl(null)}
                  className="p-1.5 text-slate-400 hover:text-rose-500 rounded-xl"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 p-4 bg-slate-950/20 flex items-center justify-center overflow-auto">
              {previewCardModalUrl.startsWith('data:application/pdf') || previewCardModalUrl.endsWith('.pdf') ? (
                <iframe
                  src={previewCardModalUrl}
                  className="w-full h-[70vh] rounded-xl border-0"
                  title="Customs Card Document"
                />
              ) : (
                <img
                  src={previewCardModalUrl}
                  alt="Customs Card Preview"
                  className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-md"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CarFormModal;
