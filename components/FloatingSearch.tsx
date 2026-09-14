import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  X, 
  GripVertical, 
  Copy, 
  Check, 
  MapPin, 
  Car, 
  Calendar, 
  Coins, 
  FileText, 
  Sparkles, 
  Cpu, 
  BadgeAlert, 
  Paperclip, 
  FileUp, 
  ExternalLink,
  History
} from 'lucide-react';
import { Car as CarType, CarStatus } from '../types';
import { useLanguage } from './LanguageContext.tsx';
import { cleanIdentifier, normalizeArabicText, convertArabicNumerals } from '../src/utils/searchEngine';

interface FloatingSearchProps {
  cars: CarType[];
}

export const FloatingSearch: React.FC<FloatingSearchProps> = ({ cars = [] }) => {
  const { lang, isRtl } = useLanguage();
  const navigate = useNavigate();
  
  // Responsive floating button coordinate state (distance from bottom-right)
  const [position, setPosition] = useState({ right: 24, bottom: 96 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // UI state for the Spotlight Search Box
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCarId, setSelectedCarId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'AVAILABLE' | 'RESERVED' | 'SOLD'>('ALL');

  const inputRef = useRef<HTMLInputElement>(null);

  // Diagnostic log for general component loading status
  useEffect(() => {
    console.log("[FloatingSearch] Component loaded/mounted. Total indexable cars:", cars.length);
  }, []);

  // Load search history from localStorage on mount
  useEffect(() => {
    const history = localStorage.getItem('floating_search_history');
    if (history) {
      try {
        const parsed = JSON.parse(history);
        console.log("[FloatingSearch] Recovered search history records:", parsed);
        setSearchHistory(parsed);
      } catch (err) {
        console.error('[FloatingSearch] Failed to parse floating search history:', err);
      }
    }
  }, []);

  // Monitor toggle open/close and focus search element
  useEffect(() => {
    console.log("[FloatingSearch] isOpen state triggered. Value:", isOpen);
    if (isOpen) {
      setTimeout(() => {
        if (inputRef.current) {
          console.log("[FloatingSearch] Safely focused search input field.");
          inputRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen]);

  // Global keyboard shortcuts (Ctrl+K, Cmd+K, Escape) to trigger/dismiss spotlight
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        console.log("[FloatingSearch] Global hotkey Ctrl/Cmd + K registered.");
        e.preventDefault();
        setIsOpen(prev => {
          const next = !prev;
          if (!next) {
            setSearchQuery('');
            setSelectedCarId(null);
          }
          return next;
        });
      }
      
      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        console.log("[FloatingSearch] Escape key pressed. Dismissing spotlight.");
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isOpen]);

  // Electron IPC listener - support 'toggle-spotlight' from main process / native menus
  useEffect(() => {
    const ipcRenderer = (window as any).ipcRenderer;
    if (ipcRenderer && typeof ipcRenderer.on === 'function') {
      console.log("[FloatingSearch] Electron environment detected. Listening to IPC channel 'toggle-spotlight'.");
      const handleIpcToggle = () => {
        console.log("[FloatingSearch] Received 'toggle-spotlight' event from Electron main process.");
        setIsOpen(prev => {
          const next = !prev;
          if (!next) {
            setSearchQuery('');
            setSelectedCarId(null);
          }
          return next;
        });
      };
      
      ipcRenderer.on('toggle-spotlight', handleIpcToggle);
      return () => {
        if (typeof ipcRenderer.removeListener === 'function') {
          ipcRenderer.removeListener('toggle-spotlight', handleIpcToggle);
        }
      };
    }
  }, []);

  // Drag handlers (Desktop Mouse)
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.btn-interactive')) {
      console.log("[FloatingSearch] MouseDown clicked inside interactive button. Drag disabled.");
      return;
    }
    console.log("[FloatingSearch] MouseDown registered on floating ball container. Initiating drag watch.");
    setIsDragging(true);
    
    setDragOffset({
      x: window.innerWidth - e.clientX - position.right,
      y: window.innerHeight - e.clientY - position.bottom,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      let newRight = window.innerWidth - e.clientX - dragOffset.x;
      let newBottom = window.innerHeight - e.clientY - dragOffset.y;

      const pad = 12;
      newRight = Math.max(pad, Math.min(window.innerWidth - 72, newRight));
      newBottom = Math.max(pad, Math.min(window.innerHeight - 72, newBottom));

      setPosition({ right: newRight, bottom: newBottom });
    };

    const handleMouseUp = () => {
      if (isDragging) {
        console.log("[FloatingSearch] MouseUp registered. Drag finished at position:", position);
        setIsDragging(false);
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, position]);

  // Touch handlers (Mobile)
  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('.btn-interactive')) {
      console.log("[FloatingSearch] TouchStart clicked inside interactive button. Drag disabled.");
      return;
    }
    console.log("[FloatingSearch] TouchStart registered. Initiating touch drag.");
    setIsDragging(true);
    
    const touch = e.touches[0];
    setDragOffset({
      x: window.innerWidth - touch.clientX - position.right,
      y: window.innerHeight - touch.clientY - position.bottom,
    });
  };

  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      
      let newRight = window.innerWidth - touch.clientX - dragOffset.x;
      let newBottom = window.innerHeight - touch.clientY - dragOffset.y;

      const pad = 12;
      newRight = Math.max(pad, Math.min(window.innerWidth - 72, newRight));
      newBottom = Math.max(pad, Math.min(window.innerHeight - 72, newBottom));

      setPosition({ right: newRight, bottom: newBottom });
    };

    const handleTouchEnd = () => {
      if (isDragging) {
        console.log("[FloatingSearch] TouchEnd registered. Touch drag finished.");
        setIsDragging(false);
      }
    };

    if (isDragging) {
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
    }
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, dragOffset]);

  // Dynamic Ingest & Scoring Search Algorithm
  const processedResults = useMemo(() => {
    if (!searchQuery || !searchQuery.trim()) return [];

    const rawQuery = searchQuery.trim().toLowerCase();
    const unifiedQuery = convertArabicNumerals(rawQuery);
    const normalizedQuery = normalizeArabicText(unifiedQuery);
    const cleanQuery = cleanIdentifier(rawQuery);

    const queryWords = normalizedQuery.split(/\s+/).filter(Boolean);
    if (queryWords.length === 0) return [];

    const matched: Array<{ car: CarType; score: number; matchedField: string }> = [];

    cars.forEach(car => {
      // Apply status filter if not 'ALL'
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'AVAILABLE' && car.status !== CarStatus.AVAILABLE) return;
        if (statusFilter === 'RESERVED' && car.status !== CarStatus.RESERVED) return;
        if (statusFilter === 'SOLD' && car.status !== CarStatus.SOLD) return;
      }

      let score = 0;
      let matchedField = '';

      const carVinClean = cleanIdentifier(car.vin || '');
      const carCardClean = cleanIdentifier(car.cardNumber || '');
      const carPlateClean = cleanIdentifier(car.plateData?.plateNumber || '');
      const carName = `${car.brand} ${car.model}`.toLowerCase();
      const carNameNorm = normalizeArabicText(carName);

      // Priority 1: Exact VIN match O(1)
      if (cleanQuery && carVinClean === cleanQuery) {
        score = 100;
        matchedField = 'vin';
      }
      // Priority 2: Exact Custom Card match O(1)
      else if (cleanQuery && carCardClean === cleanQuery) {
        score = 95;
        matchedField = 'cardNumber';
      }
      // Priority 3: Exact Plate match O(1)
      else if (cleanQuery && carPlateClean === cleanQuery) {
        score = 90;
        matchedField = 'plateNumber';
      }
      // Priority 4: Starts with name match O(1)
      else if (carNameNorm.startsWith(normalizedQuery)) {
        score = 80;
        matchedField = 'name_prefix';
      }
      // Priority 5: Contains name match
      else if (carNameNorm.includes(normalizedQuery)) {
        score = 70;
        matchedField = 'name_contains';
      }
      // Priority 6: Word overlap multi-match fallback
      else {
        let matchedWordsCount = 0;
        queryWords.forEach(word => {
          if (carNameNorm.includes(word) || carVinClean.includes(word) || carCardClean.includes(word)) {
            matchedWordsCount++;
          }
        });
        if (matchedWordsCount > 0) {
          score = 50 + Math.round((matchedWordsCount / queryWords.length) * 20);
          matchedField = 'partial';
        }
      }

      if (score > 0) {
        matched.push({ car, score, matchedField });
      }
    });

    return matched.sort((a, b) => b.score - a.score);
  }, [searchQuery, statusFilter, cars]);

  // Automatically select/expand single matching result
  useEffect(() => {
    if (processedResults.length === 1) {
      setSelectedCarId(processedResults[0].car.id);
    }
  }, [processedResults]);

  // Save successful search query to history list
  const addQueryToHistory = (queryToAdd: string) => {
    const trimmed = queryToAdd.trim();
    if (trimmed.length < 2) return;
    
    setSearchHistory(prev => {
      const filtered = prev.filter(q => q !== trimmed);
      const updated = [trimmed, ...filtered].slice(0, 5);
      localStorage.setItem('floating_search_history', JSON.stringify(updated));
      return updated;
    });
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getMatchedLabel = (field: string) => {
    if (!isRtl) return `Matched: ${field}`;
    switch (field) {
      case 'vin': return 'رقم الهيكل مطابق تماماً';
      case 'cardNumber': return 'رقم البطاقة الجمركية مطابق';
      case 'plateNumber': return 'رقم اللوحة مطابق';
      case 'name_prefix': return 'بداية الاسم مطابقة';
      case 'name_contains': return 'يحتوي على الاسم';
      default: return 'مطابقة جزئية بالكلمات';
    }
  };

  // Safe thumbnail/color renderer
  const renderThumbnail = (car: CarType) => {
    if (car.cardFile && car.cardFile.startsWith('data:image/')) {
      return (
        <img 
          src={car.cardFile} 
          alt={car.brand} 
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover rounded-xl border border-slate-100 dark:border-slate-850" 
        />
      );
    }

    const colorConfig: Record<string, string> = {
      'أبيض': '#FFFFFF', 'white': '#FFFFFF',
      'أسود': '#475569', 'black': '#0F172A',
      'فضي': '#CBD5E1', 'silver': '#94A3B8',
      'أحمر': '#EF4444', 'red': '#B91C1C',
      'أزرق': '#3B82F6', 'blue': '#1D4ED8',
      'رمادي': '#64748B', 'gray': '#334155',
      'ذهبي': '#F59E0B', 'gold': '#B45309',
    };
    const colorCircle = colorConfig[car.color] || '#6366F1';

    return (
      <div className="w-full h-full bg-slate-50 dark:bg-slate-950/60 rounded-xl flex flex-col items-center justify-center border border-slate-100 dark:border-slate-850 relative overflow-hidden">
        <Car size={24} style={{ color: colorCircle }} className="filter drop-shadow-sm" />
        <span className="text-[7.5px] font-black text-slate-400 dark:text-slate-500 uppercase mt-0.5">{car.color}</span>
      </div>
    );
  };

  return (
    <>
      {/* Floating Action Button */}
      <div 
        className="fixed z-[990] transition-shadow select-none cursor-grab active:cursor-grabbing print:hidden flex items-center justify-center animate-in fade-in zoom-in duration-300"
        style={{
          right: `${position.right}px`,
          bottom: `${position.bottom}px`
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div className="relative group flex items-center justify-center">
          {/* Pulsing ring indicator */}
          <span className="absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-40 animate-ping pointer-events-none"></span>
          
          <button
            onClick={() => {
              console.log("[FloatingSearch] Click Event triggers inside .btn-interactive button. Setting isOpen to:", !isOpen);
              setIsOpen(!isOpen);
              if (!isOpen) {
                setSearchQuery('');
                setSelectedCarId(null);
              }
            }}
            className="btn-interactive w-14 h-14 bg-gradient-to-tr from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-full flex items-center justify-center shadow-2xl border border-white/20 transition-all hover:scale-110 active:scale-95 duration-200"
            title={isRtl ? 'البحث الفوري المخزني والسيارات' : 'Instant Warehouse Search Finder'}
          >
            {isOpen ? <X size={22} /> : <Search size={22} className="hover:rotate-6 transition-transform duration-300" />}
          </button>

          {/* Draggable notice tooltip */}
          <div className="absolute -top-10 bg-slate-900/95 text-white text-[9.5px] px-2.5 py-1 rounded-xl shadow-2xl border border-slate-800 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1 whitespace-nowrap">
            <GripVertical size={11} className="text-slate-400" />
            <span>{isRtl ? 'اسحب لوضع الزر في أي مكان' : 'Drag to reposition'}</span>
          </div>
        </div>
      </div>

      {/* Spotlight Command Center Modal Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[5000] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in duration-200"
          dir={isRtl ? 'rtl' : 'ltr'}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              console.log("[FloatingSearch] Closing spotlight command center because backdrop container was clicked.");
              setIsOpen(false);
            }
          }}
        >
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl flex flex-col h-[80vh] max-h-[720px] overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Header bar */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/10 dark:bg-blue-500/5 text-blue-500 rounded-2xl flex items-center justify-center">
                  <Search size={18} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-850 dark:text-white flex items-center gap-1.5">
                    {isRtl ? 'محرك البحث السريع والذكي للمخزون' : 'Instant Inventory Lookup Engine'}
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-black">
                      {isRtl ? 'مباشر' : 'Live'}
                    </span>
                  </h3>
                  <p className="text-[10.5px] text-slate-400 font-bold">
                    {isRtl 
                      ? 'البحث فوري بـ: رقم الهيكل (VIN)، رقم البطاقة الجمركية، رقم اللوحة، اسم المركبة'
                      : 'Lookup instantly via: Chassis number (VIN), Customs card, Plate, or Name.'}
                  </p>
                </div>
              </div>
              
              <button 
                onClick={() => setIsOpen(false)} 
                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                title={isRtl ? 'إغلاق' : 'Close'}
              >
                <X size={18} />
              </button>
            </div>

            {/* Custom search queries & Filter Tabs */}
            <div className="px-6 pt-5 pb-3 bg-slate-50/20 dark:bg-slate-950/10 border-b border-slate-100 dark:border-slate-800/40 flex flex-wrap gap-2 items-center justify-between">
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200/50 dark:border-slate-850">
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${
                    statusFilter === 'ALL' 
                      ? 'bg-white dark:bg-slate-850 text-blue-600 dark:text-blue-400 shadow-sm' 
                      : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'
                  }`}
                >
                  {isRtl ? 'الكل' : 'All'}
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('AVAILABLE')}
                  className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${
                    statusFilter === 'AVAILABLE' 
                      ? 'bg-emerald-500 text-white shadow-sm' 
                      : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'
                  }`}
                >
                  {isRtl ? 'متاح' : 'Available'}
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('RESERVED')}
                  className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${
                    statusFilter === 'RESERVED' 
                      ? 'bg-amber-500 text-white shadow-sm' 
                      : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'
                  }`}
                >
                  {isRtl ? 'محجوز' : 'Reserved'}
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('SOLD')}
                  className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${
                    statusFilter === 'SOLD' 
                      ? 'bg-rose-500 text-white shadow-sm' 
                      : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'
                  }`}
                >
                  {isRtl ? 'مباع' : 'Sold'}
                </button>
              </div>

              <div className="flex items-center gap-1 font-mono text-[9.5px] font-black text-slate-400">
                <Cpu size={11} className="text-indigo-400 animate-spin mr-1" />
                <span>{isRtl ? `مفهرس: ${cars.length} سيارة` : `Total indexed: ${cars.length}`}</span>
              </div>
            </div>

            {/* Glowing input sector */}
            <div className="p-6 pb-4">
              <div className="relative">
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400">
                  <Search size={18} />
                </div>
                <input 
                  ref={inputRef}
                  type="text"
                  dir={isRtl ? 'rtl' : 'ltr'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchQuery.trim().length > 1) {
                      addQueryToHistory(searchQuery);
                    }
                  }}
                  placeholder={isRtl 
                    ? 'اكتب هنا (اسم السيارة، رقم الهيكل VIN، رقم البطاقة الجمركية، تفاصيل اللوحة)...' 
                    : 'Search by model brand, chassis (VIN), plate serial or custom card...'
                  }
                  className="w-full py-4 pr-11 pl-11 bg-slate-50 dark:bg-slate-950/80 text-slate-800 dark:text-slate-100 rounded-2xl border border-slate-200 dark:border-slate-850 shadow-inner focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none text-sm font-bold transition-all placeholder-slate-400 dark:placeholder-slate-500"
                />
                {searchQuery && (
                  <button 
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCarId(null);
                    }}
                    className="absolute inset-y-0 left-4 flex items-center text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* Instant Search History shortcuts */}
              {searchQuery.length === 0 && searchHistory.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mt-3 animate-in fade-in duration-200">
                  <span className="text-[9.5px] font-black text-slate-400 flex items-center gap-1 mr-1">
                    <History size={10} />
                    {isRtl ? 'من سجلاتك:' : 'Recent:'}
                  </span>
                  {searchHistory.map((historyQuery, idx) => (
                    <button
                      key={`${historyQuery}-${idx}`}
                      onClick={() => setSearchQuery(historyQuery)}
                      className="px-2.5 py-1 bg-slate-100 dark:bg-slate-950 hover:bg-blue-500/5 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200/50 dark:border-slate-850 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-400 transition-colors"
                    >
                      {historyQuery}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Main Result listings viewport */}
            <div className="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar space-y-3 bg-slate-50/20 dark:bg-slate-950/5">
              {searchQuery.trim() === '' ? (
                // Initial prompt layout helper
                <div className="py-12 text-center text-slate-400 dark:text-slate-500 space-y-3">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-950 rounded-full flex items-center justify-center mx-auto text-slate-400">
                    <Car size={24} className="opacity-40" />
                  </div>
                  <div className="max-w-xs mx-auto space-y-1">
                    <h4 className="text-xs font-black text-slate-700 dark:text-slate-350">{isRtl ? 'جاهز لاستقبال المدخلات' : 'Ready for inputs'}</h4>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 leading-relaxed">
                      {isRtl 
                        ? 'أدخل رقم الهيكل (الشاصي)، اسم الطراز، لوحة المركبة أو رقم البطاقة الجمركية للبحث المخزني والفرز الفوري'
                        : 'Provide vehicle chassis (VIN), manufacturer name, license plate, or custom metadata to locate spec.'}
                    </p>
                  </div>
                </div>
              ) : processedResults.length > 0 ? (
                // Matched results
                processedResults.map(({ car, score, matchedField }) => {
                  const isExpanded = selectedCarId === car.id;
                  
                  // Score indicator style mapping
                  const scorePill = score >= 90 ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' 
                                  : score >= 80 ? 'text-blue-500 bg-blue-500/10 border-blue-500/20'
                                  : 'text-slate-400 bg-slate-500/10 border-slate-500/15';

                  return (
                    <div 
                      key={car.id}
                      className={`rounded-2xl border transition-all text-start overflow-hidden bg-white dark:bg-slate-900 ${
                        isExpanded 
                          ? 'border-blue-500 ring-2 ring-blue-500/10 shadow-md shadow-blue-500/5' 
                          : 'border-slate-100 dark:border-slate-850 hover:border-slate-200 dark:hover:border-slate-800'
                      }`}
                    >
                      {/* Heading card row */}
                      <div 
                        onClick={() => setSelectedCarId(isExpanded ? null : car.id)}
                        className="p-4 flex items-start gap-4 cursor-pointer select-none relative"
                      >
                        {/* Match indicator pill */}
                        <div className={`absolute top-4 ${isRtl ? 'left-4' : 'right-4'} flex items-center gap-1.5`} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => {
                              console.log("[FloatingSearch] Direct View in Inventory action clicked for VIN:", car.vin);
                              setIsOpen(false);
                              navigate('/inventory', { state: { searchVin: car.vin } });
                            }}
                            className="text-[8.5px] font-black px-2 py-1 rounded-full border border-blue-500/30 bg-blue-550 hover:bg-blue-600 text-white dark:border-blue-800/50 dark:bg-blue-900 dark:hover:bg-blue-805 transition-all flex items-center gap-1 cursor-pointer shadow-sm hover:scale-105 active:scale-95 duration-100"
                            title={isRtl ? 'عرض تفاصيل وبطاقة السيارة في صفحة المخزن' : 'View car details directly in inventory'}
                          >
                            <ExternalLink size={9} />
                            <span>{isRtl ? 'عرض في المخزن' : 'View in Inventory'}</span>
                          </button>
                          <span className={`text-[8.5px] font-black px-2 py-1 rounded-full border ${scorePill}`}>
                            {score}% {isRtl ? 'تطابق' : 'Match'}
                          </span>
                        </div>

                        {/* Thumbnail icon */}
                        <div className="w-14 h-14 shrink-0">
                          {renderThumbnail(car)}
                        </div>

                        {/* Text fields spec */}
                        <div className="flex-1 min-w-0 pr-2 pt-0.5">
                          <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 truncate pr-16">
                            {car.brand} {car.model}
                            <span className="text-[10px] font-mono font-medium text-slate-400 ml-2">({car.year})</span>
                          </h4>

                          <p className="flex items-center gap-1 mt-1 text-[10.5px] text-slate-400">
                            <span className="font-mono bg-slate-100 dark:bg-slate-950 px-1.5 py-0.5 rounded text-[8.5px] text-slate-500 font-extrabold">VIN</span>
                            <span className="font-black text-slate-600 dark:text-slate-300 font-mono tracking-tight">{car.vin}</span>
                          </p>

                          {/* Extra subtle indicators */}
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span className={`text-[9.5px] font-black px-2 py-0.5 rounded-md border ${
                              car.status === CarStatus.AVAILABLE 
                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/15'
                                : car.status === CarStatus.RESERVED
                                ? 'bg-amber-500/10 text-amber-500 border-amber-500/15'
                                : 'bg-rose-500/10 text-rose-500 border-rose-500/15'
                            }`}>
                              {car.status}
                            </span>

                            <span className="text-[9.5px] font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-950 px-2 py-0.5 rounded-md flex items-center gap-1.5">
                              <MapPin size={9} />
                              {car.isPresentInShowroom ? (isRtl ? 'بالمعرض' : 'In Showroom') : (isRtl ? 'مستودع خارجي' : 'Depot')}
                            </span>
                            
                            {/* Match text highlight */}
                            <span className="text-[9.5px] font-bold text-slate-400 flex items-center gap-1">
                              <Sparkles size={9} className="text-amber-500" />
                              <span>{getMatchedLabel(matchedField)}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Expanded specification worksheets drawer details */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-1 bg-slate-50/50 dark:bg-slate-950/30 border-t border-slate-100 dark:border-slate-850/60 animate-in slide-in-from-top-2 duration-200">
                          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-4 rounded-xl space-y-3.5 shadow-sm text-xs mt-1">
                            
                            {/* Specification details grid */}
                            <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-[11px] text-slate-500 dark:text-slate-400">
                              <div className="flex justify-between items-center pb-1.5 border-b border-slate-50 dark:border-slate-850">
                                <span className="font-bold">{isRtl ? 'اللون الخارجي' : 'Color'}</span>
                                <span className="font-black text-slate-800 dark:text-slate-250">{car.color}</span>
                              </div>
                              <div className="flex justify-between items-center pb-1.5 border-b border-slate-50 dark:border-slate-850">
                                <span className="font-bold">{isRtl ? 'رقم البطاقة الجمركية' : 'Custom Card'}</span>
                                <div className="flex items-center gap-1">
                                  <span className="font-black text-slate-800 dark:text-slate-250 font-mono">{car.cardNumber || '-'}</span>
                                  {car.cardNumber && (
                                    <button
                                      type="button"
                                      onClick={() => handleCopyText(`card-${car.id}`, car.cardNumber!)}
                                      className="p-0.5 hover:text-blue-500 text-slate-400"
                                      title={isRtl ? 'نسخ' : 'Copy'}
                                    >
                                      {copiedId === `card-${car.id}` ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="flex justify-between items-center pb-1.5 border-b border-slate-50 dark:border-slate-850">
                                <span className="font-bold">{isRtl ? 'رقم اللوحة' : 'Plate ID'}</span>
                                <div className="flex items-center gap-1">
                                  <span className="font-black text-slate-800 dark:text-slate-250">{car.plateData?.plateNumber || (isRtl ? 'بدون لوحة' : 'No Plate')}</span>
                                  {car.plateData?.plateNumber && (
                                    <button
                                      type="button"
                                      onClick={() => handleCopyText(`plate-${car.id}`, car.plateData!.plateNumber)}
                                      className="p-0.5 hover:text-blue-500 text-slate-400"
                                      title={isRtl ? 'نسخ اللوحة' : 'Copy'}
                                    >
                                      {copiedId === `plate-${car.id}` ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="flex justify-between items-center pb-1.5 border-b border-slate-50 dark:border-slate-850">
                                <span className="font-bold">{isRtl ? 'القيمة التقديرية (البيع)' : 'Est. Price'}</span>
                                <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">{(car.price ?? 0).toLocaleString()} ر.س</span>
                              </div>
                              <div className="flex justify-between items-center pb-1.5 col-span-2">
                                <span className="font-bold">{isRtl ? 'المورد المسؤول' : 'Supplier'}</span>
                                <span className="font-black text-slate-700 dark:text-slate-300">{car.supplier || '-'}</span>
                              </div>
                            </div>

                            {/* Copy VIN section */}
                            <div className="pt-2 flex gap-2 items-center justify-between border-t border-slate-100 dark:border-slate-850/60">
                              <span className="text-[10px] text-slate-400 font-bold font-mono">ID: {car.id}</span>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleCopyText(`vin-${car.id}`, car.vin)}
                                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 font-black rounded-lg text-[10px] transition-colors flex items-center gap-1 shadow-sm"
                                >
                                  {copiedId === `vin-${car.id}` ? (
                                    <>
                                      <Check size={11} className="text-emerald-500" />
                                      <span>{isRtl ? 'تم نسخ الشاصي' : 'Chassis Copied'}</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={11} />
                                      <span>{isRtl ? 'نسخ رقم الهيكل' : 'Copy VIN'}</span>
                                    </>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    console.log("[FloatingSearch] Search result details view-in-inventory clicked for VIN:", car.vin);
                                    setIsOpen(false);
                                    navigate('/inventory', { state: { searchVin: car.vin } });
                                  }}
                                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-750 text-white font-black rounded-lg text-[10px] transition-all flex items-center gap-1.5 shadow-sm hover:scale-105 active:scale-95 duration-150 cursor-pointer"
                                  title={isRtl ? 'عرض تفاصيل وبطاقة السيارة في صفحة المخزن' : 'View car record directly in inventory'}
                                >
                                  <ExternalLink size={11} />
                                  <span>{isRtl ? 'عرض في المخزن' : 'View in Inventory'}</span>
                                </button>

                                {car.cardFile ? (
                                  <a
                                    href={car.cardFile}
                                    download={car.cardFileName || `customized_card_${car.vin}`}
                                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-lg text-[10px] transition-all flex items-center gap-1.5 shadow-sm"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <FileUp size={11} />
                                    <span>{isRtl ? 'تحميل البطاقة الجمركية' : 'Download Custom Card'}</span>
                                  </a>
                                ) : (
                                  <span className="text-[9.5px] text-slate-400 bg-slate-50 dark:bg-slate-950 px-2 py-1.5 rounded-lg font-bold">
                                    {isRtl ? 'بدون ملف مرفق' : 'No attached doc'}
                                  </span>
                                )}
                              </div>
                            </div>

                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                // Found empty layout matches
                <div className="py-12 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-[2rem] text-center space-y-3 animate-in fade-in duration-250">
                  <div className="w-12 h-12 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto text-rose-500">
                    <BadgeAlert size={22} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">
                      {isRtl ? 'تنبيه: لم نعثر على نتائج مطابقة' : 'No matches found'}
                    </h4>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold max-w-xs mx-auto">
                      {isRtl 
                        ? 'لم نجد أي تطابق لـ "رقم الشاصي" أو "الاسم" أو "رقم البطاقة" المرفق بالاستعلام الحالي.' 
                        : 'Review spelling key references. No matching parameters indexed.'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Status bar footer */}
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex justify-between items-center text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider rounded-b-[2.5rem]">
              <div>
                {isRtl ? `إجمالي المفهرس: ${cars.length} سيارة` : `Total searchable: ${cars.length} cars`}
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 rounded-xl transition-all font-black text-[10.5px]"
              >
                {isRtl ? 'إغلاق نافذة البحث' : 'Close Lookup'}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
