import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  Upload, Check, AlertCircle, Database, Columns, Eye, RefreshCcw, 
  FileSpreadsheet, ChevronRight, ChevronLeft, X, Settings2, FileText, 
  CheckCircle2, Sliders, Info, AlertTriangle, HelpCircle, CheckCircle, UserPlus
} from 'lucide-react';
import { motion } from 'motion/react';
import { Customer } from '../types';

interface TargetField {
  key: string;
  label: string;
  required: boolean;
  type: 'string';
  description: string;
  regexMatches: string[];
}

const TARGET_FIELDS: TargetField[] = [
  { key: 'name', label: 'الاسم الكامل للعميل / المستلم', required: true, type: 'string', description: 'الاسم الثنائي أو الثلاثي كامل لتسجيل عقود التوريد والصرف بشكل رسمي', regexMatches: ['الاسم', 'الاسم كامل', 'الاسم الكامل', 'الاسم الرباعي', 'name', 'fullname', 'full name', 'customer_name'] },
  { key: 'phone', label: 'رقم الجوال / الهاتف', required: true, type: 'string', description: 'رقم الهاتف الخاص للعميل للتواصل وضمان سلامة الإرساليات', regexMatches: ['الهاتف', 'رقم الهاتف', 'الجوال', 'رقم الجوال', 'هاتف', 'جوال', 'phone', 'mobile', 'telephone', 'mobile_number'] },
  { key: 'nationalId', label: 'رقم الهوية الوطنية / الإقامة', required: false, type: 'string', description: 'رقم الهوية المؤلف من 10 أرقام في المملكة العربية السعودية أو الإقامة للمقيم', regexMatches: ['الهوية', 'رقم الهوية', 'الهوية الوطنية', 'الهويه', 'رقم الإقامة', 'الاقامه', 'id', 'nationalid', 'national_id', 'id number'] },
  { key: 'type', label: 'نوع السجل (عميل / مستلم)', required: false, type: 'string', description: 'تصنيف السجل مثل (عميل) أو (مستلم) للفرز الذكي بالبوابة', regexMatches: ['نوع السجل', 'النوع', 'تصنيف', 'type', 'recordtype', 'customer_type', 'role'] }
];

interface CustomerImportWizardProps {
  existingCustomers: Customer[];
  currentUser: any;
  onImportComplete: (customers: Customer[], duplicateMode: 'overwrite' | 'skip') => void;
  onClose: () => void;
}

export const CustomerImportWizard: React.FC<CustomerImportWizardProps> = ({
  existingCustomers = [],
  currentUser,
  onImportComplete,
  onClose
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [sheetData, setSheetData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({}); // Target -> Source
  const [duplicateMode, setDuplicateMode] = useState<'overwrite' | 'skip'>('skip');
  const [isDragging, setIsDragging] = useState(false);
  
  // Filtering for step 3 preview
  const [validationFilter, setValidationFilter] = useState<'all' | 'errors' | 'valid'>('all');
  const [previewPage, setPreviewPage] = useState(1);
  const PREVIEW_ITEMS_PER_PAGE = 8;

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper matching heuristically
  const findBestMatchingHeader = (target: TargetField, srcHeaders: string[]): string => {
    let bestMatch = '';
    let maxScore = 0;

    for (const h of srcHeaders) {
      const cleanH = h.trim().toLowerCase();
      // Try exact matching
      for (const matchText of target.regexMatches) {
        if (cleanH === matchText.toLowerCase()) {
          return h;
        }
        if (cleanH.includes(matchText.toLowerCase()) || matchText.toLowerCase().includes(cleanH)) {
          const score = matchText.length / Math.abs(cleanH.length - matchText.length + 1);
          if (score > maxScore) {
            maxScore = score;
            bestMatch = h;
          }
        }
      }
    }
    return bestMatch;
  };

  const handleFileChange = (selectedFile: File) => {
    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (rawJson.length === 0) {
          alert("الملف فارغ أو لا يحتوي على صفوف بيانات صالحة.");
          return;
        }

        const detectedHeaders = Object.keys(rawJson[0]);
        setHeaders(detectedHeaders);
        setSheetData(rawJson);

        // Run autoheuristics
        const initialMappings: Record<string, string> = {};
        TARGET_FIELDS.forEach(field => {
          const matched = findBestMatchingHeader(field, detectedHeaders);
          if (matched) {
            initialMappings[field.key] = matched;
          }
        });
        setMappings(initialMappings);
        setStep(2);
      } catch (err) {
        alert("فشل في قراءة ومعالجة الملف. يرجى التأكد من اختيار ملف Excel ساري.");
        console.error(err);
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      const ext = droppedFile.name.split('.').pop()?.toLowerCase();
      if (['xlsx', 'xls', 'csv'].includes(ext || '')) {
        handleFileChange(droppedFile);
      } else {
        alert("يرجى سحب وإفلات ملف Excel (.xlsx/.xls) أو CSV ساري المفعول فقط.");
      }
    }
  };

  const parsedItems = useMemo(() => {
    return sheetData.map((row, index) => {
      const id = `cust-imp-${Date.now()}-${index}`;
      
      const name = mappings.name ? row[mappings.name]?.toString().trim() : '';
      const phone = mappings.phone ? row[mappings.phone]?.toString().trim() : '';
      const nationalId = mappings.nationalId ? row[mappings.nationalId]?.toString().trim() : '';
      const typeRaw = mappings.type ? row[mappings.type]?.toString().trim() : '';

      // Normalize Type to exact types
      let type: 'عميل' | 'مستلم' = 'عميل';
      if (typeRaw) {
        if (typeRaw.includes('مستلم') || typeRaw.toLowerCase().includes('receiver') || typeRaw.toLowerCase().includes('recipient')) {
          type = 'مستلم';
        }
      }

      const errors: string[] = [];
      const warnings: string[] = [];

      if (!name) errors.push("اسم العميل مفقود وهو حقل إجباري");
      if (!phone) {
        errors.push("رقم الهاتف مفقود وهو حقل إجباري لتفادي تعارض البيانات");
      }

      // Check sheet duplicate phone numbers
      const duplicateInSheet = phone ? sheetData.some((otherRow, otherIdx) => {
        if (otherIdx === index) return false;
        const otherPhone = mappings.phone ? otherRow[mappings.phone]?.toString().trim() : '';
        return phone === otherPhone;
      }) : false;

      if (duplicateInSheet && phone) {
        errors.push("رقم الجوال مكرر مرتين داخل نفس هذا الملف");
      }

      // Check database duplicate phone numbers
      const duplicateInDb = phone ? existingCustomers.some(c => c.phone?.trim() === phone.trim()) : false;
      if (duplicateInDb && phone) {
        if (duplicateMode === 'skip') {
          warnings.push("مكرر مع السجلات الحالية بالنظام: سيتم تخطيه مع الإبقاء على القديم");
        } else {
          warnings.push("مكرر مع السجلات الحالية بالنظام: سيتم استبدال بيانات الهوية والتصنيف به حياً");
        }
      }

      const isValid = errors.length === 0;

      return {
        id,
        name: name || 'غير محدد',
        phone: phone || '',
        nationalId: nationalId || '',
        type,
        addedAt: new Date().toISOString(),
        _originalRowIndex: index + 1,
        _errors: errors,
        _warnings: warnings,
        _isValid: isValid,
        _isDuplicateInDb: duplicateInDb
      };
    });
  }, [sheetData, mappings, existingCustomers, duplicateMode]);

  const stats = useMemo(() => {
    const total = parsedItems.length;
    const validCount = parsedItems.filter(item => item._isValid).length;
    const invalidCount = total - validCount;
    const duplicateDbCount = parsedItems.filter(item => item._isDuplicateInDb).length;

    return {
      total,
      validCount,
      invalidCount,
      duplicateDbCount,
      toImportCount: duplicateMode === 'skip'
        ? parsedItems.filter(item => item._isValid && !item._isDuplicateInDb).length
        : parsedItems.filter(item => item._isValid).length
    };
  }, [parsedItems, duplicateMode]);

  const filteredPreviewItems = useMemo(() => {
    return parsedItems.filter(item => {
      if (validationFilter === 'errors') {
        return !item._isValid || item._warnings.length > 0;
      }
      if (validationFilter === 'valid') {
        return item._isValid && item._warnings.length === 0;
      }
      return true;
    });
  }, [parsedItems, validationFilter]);

  const paginatedPreviewItems = useMemo(() => {
    const start = (previewPage - 1) * PREVIEW_ITEMS_PER_PAGE;
    return filteredPreviewItems.slice(start, start + PREVIEW_ITEMS_PER_PAGE);
  }, [filteredPreviewItems, previewPage]);

  const handleNextStep = () => {
    if (step === 2) {
      if (!mappings.name || !mappings.phone) {
        alert("يرجى تحديد أعمدة الربط الإلزامية لتغذية جدول العملاء: (الاسم، والاتصال الجوال) لتفعيل المعالجة.");
        return;
      }
      setStep(3);
      setPreviewPage(1);
    }
  };

  const executeImport = () => {
    const finalImportable = parsedItems.filter(item => {
      if (!item._isValid) return false;
      if (duplicateMode === 'skip' && item._isDuplicateInDb) return false;
      return true;
    });

    if (finalImportable.length === 0) {
      alert("لا توجد سجلات مستوفاة وخالية من الأخطاء قابلة للاستيراد حالياً.");
      return;
    }

    onImportComplete(finalImportable as Customer[], duplicateMode);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto overscroll-contain" dir="rtl">
      <div className="bg-white dark:bg-slate-950 rounded-2xl sm:rounded-[2.5rem] w-full max-w-5xl shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col max-h-[92vh] sm:max-h-[90vh] my-auto overflow-hidden">
        
        {/* Header toolbar */}
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/10 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl sm:rounded-2xl">
              <UserPlus size={20} className="sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 dark:text-white text-base sm:text-lg font-sans">بوابة استيراد وتصنيف العملاء الذكية</h3>
              <p className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500 font-bold mt-0.5">مطابقة واسترداد قوائم جهات الاتصال والمستلمين الذاتية بكفاءة عالية</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 sm:p-3 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stepper Indicator */}
        <div className="px-3 sm:px-8 py-3 sm:py-5 bg-slate-50 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-2 sm:gap-4 shrink-0 overflow-x-auto">
          <div className="flex items-center gap-3 sm:gap-6 md:gap-12 w-full max-w-2xl mx-auto min-w-[260px]">
            
            <div className="flex items-center gap-1.5 sm:gap-2 flex-1 relative">
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-black text-xs transition-all shrink-0 ${
                step >= 1 ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-900 text-slate-400'
              }`}>
                {step > 1 ? <Check size={14} className="stroke-[3]" /> : '1'}
              </div>
              <div>
                <span className={`block text-[11px] sm:text-xs font-black ${step >= 1 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>رفع الملف</span>
              </div>
              <div className={`h-[2px] flex-1 mr-2 sm:mr-4 rounded-full ${step > 1 ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-800'}`} />
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 flex-1 relative">
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-black text-xs transition-all shrink-0 ${
                step >= 2 ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-900 text-slate-400'
              }`}>
                {step > 2 ? <Check size={14} className="stroke-[3]" /> : '2'}
              </div>
              <div>
                <span className={`block text-[11px] sm:text-xs font-black ${step >= 2 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>مطابقة الأعمدة</span>
              </div>
              <div className={`h-[2px] flex-1 mr-2 sm:mr-4 rounded-full ${step > 2 ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-800'}`} />
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-black text-xs transition-all shrink-0 ${
                step === 3 ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-900 text-slate-400'
              }`}>
                3
              </div>
              <div>
                <span className={`block text-[11px] sm:text-xs font-black ${step === 3 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>الاعتماد</span>
              </div>
            </div>

          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
          
          {step === 1 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="max-w-xl mx-auto py-10 space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="mx-auto w-16 h-16 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 rounded-3xl flex items-center justify-center">
                  <Upload size={30} />
                </div>
                <h4 className="font-extrabold text-slate-800 dark:text-white text-base">تحميل ملف جهات اتصال العملاء</h4>
                <p className="text-xs text-slate-400">سيقوم النظام بقراءة أسماء العملاء، هواتفهم الجوالة، الهوية الوطنية والأدوار لإدراجها تلقائياً.</p>
              </div>

              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-3 border-dashed rounded-[2rem] p-10 text-center cursor-pointer transition-all space-y-4 ${
                  isDragging 
                    ? 'border-indigo-500 bg-indigo-500/5' 
                    : 'border-slate-200 hover:border-indigo-400 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/10'
                }`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".xlsx,.xls,.csv" 
                  onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])} 
                />
                
                <div className="mx-auto w-14 h-14 bg-slate-100 dark:bg-slate-900 text-slate-400 rounded-xl flex items-center justify-center">
                  <Upload size={20} className="stroke-[2.5]" />
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-black text-slate-700 dark:text-slate-200">اسحب وأفلت الملف بجدول العملاء هنا</p>
                  <p className="text-xs text-slate-400">Excel (.xlsx/.xls) أو جداول CSV</p>
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="space-y-6"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                <div className="lg:col-span-8 space-y-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 rounded-xl">
                    <h4 className="font-black text-xs text-slate-800 dark:text-white flex items-center gap-2">
                      <Columns size={16} className="text-indigo-500" />
                      مواءمة وربط حقول العملاء الهيكلية
                    </h4>
                  </div>

                  <div className="space-y-3">
                    {TARGET_FIELDS.map(field => {
                      const isMapped = !!mappings[field.key];
                      const selectedVal = mappings[field.key] || "";

                      return (
                        <div 
                          key={field.key} 
                          className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                            isMapped ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-850'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-xs text-slate-800 dark:text-slate-100">{field.label}</span>
                              {field.required && (
                                <span className="bg-rose-500/10 text-rose-500 text-[10px] font-black px-1.5 py-0.5 rounded">إلزامي</span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 leading-normal">{field.description}</p>
                          </div>

                          <select
                            value={selectedVal}
                            onChange={(e) => setMappings({ ...mappings, [field.key]: e.target.value })}
                            className="text-xs font-bold rounded-xl px-4 py-2.5 outline-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-56"
                          >
                            <option value="">-- تخطي وتجاهل --</option>
                            {headers.map((h, idx) => (
                              <option key={idx} value={h}>{h}</option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="lg:col-span-4 space-y-4">
                  <div className="p-5 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-2xl space-y-3 text-xs">
                    <h5 className="font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                      <Database size={15} /> تكرار الجوال بالحفظ
                    </h5>
                    <p className="text-[10px] text-slate-400 leading-normal">رقم الهاتف مسطرة فريدة للعملاء لمنع تداخل الحسابات المالية:</p>
                    
                    <div className="space-y-2 pt-1">
                      <label className="flex items-center gap-2 p-2 rounded-xl hover:bg-white dark:hover:bg-slate-900/40 cursor-pointer">
                        <input 
                          type="radio" 
                          name="dupModeCust" 
                          checked={duplicateMode === 'skip'} 
                          onChange={() => setDuplicateMode('skip')} 
                          className="text-indigo-600"
                        />
                        <span className="font-bold text-slate-700 dark:text-slate-200 text-[11px]">تجاهل جهات الاتصال المسجلة مسبقاً</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 rounded-xl hover:bg-white dark:hover:bg-slate-900/40 cursor-pointer">
                        <input 
                          type="radio" 
                          name="dupModeCust" 
                          checked={duplicateMode === 'overwrite'} 
                          onChange={() => setDuplicateMode('overwrite')}
                          className="text-indigo-600"
                        />
                        <span className="font-bold text-slate-700 dark:text-slate-200 text-[11px]">استبدال وتحديث ببيانات الملف الجديدة</span>
                      </label>
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="space-y-4"
            >
              <div className="flex items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-850 text-xs">
                <span className="font-black">مراجعة قائمة العملاء المستخلصة:</span>
                <span className="text-slate-400 font-bold">
                  إجمالي مقروء: <strong>{stats.total}</strong> | سليم: <strong className="text-emerald-500">{stats.validCount}</strong> | مكرر: <strong className="text-amber-500">{stats.duplicateDbCount}</strong>
                </span>
              </div>

              <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                <div className="overflow-x-auto custom-scrollbar w-full">
                <table className="w-full text-right">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-black border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="p-3 w-12 text-center">#</th>
                      <th className="p-3">اسم العميل ومسماه الرياضي</th>
                      <th className="p-3">رقم الجوال النشط</th>
                      <th className="p-3">الهوية الوطنية / السجل</th>
                      <th className="p-3">نوع السجل بالعملاء</th>
                      <th className="p-3 text-left">الحالة والتدقيق الاستباقي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {paginatedPreviewItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400 font-bold">لا يوجد سجلات للمعالجة</td>
                      </tr>
                    ) : (
                      paginatedPreviewItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                          <td className="p-3 text-center text-slate-400">{item._originalRowIndex}</td>
                          <td className="p-3 font-extrabold text-slate-800 dark:text-slate-100">{item.name}</td>
                          <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{item.phone}</td>
                          <td className="p-3 font-mono">{item.nationalId || '-'}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded font-black text-[10px] ${
                              item.type === 'مستلم' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                            }`}>
                              {item.type}
                            </span>
                          </td>
                          <td className="p-3 text-left">
                            {item._isValid ? (
                              item._isDuplicateInDb ? (
                                <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded text-[10px] font-black">مكرر بالنظام</span>
                              ) : (
                                <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded text-[10px] font-black">جاهز</span>
                              )
                            ) : (
                              <span className="bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded text-[10px] font-black">أخطاء ⚠️</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                </div>
              </div>
            </motion.div>
          )}

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/10">
          <div>
            {step > 1 && (
              <button 
                onClick={() => setStep(s => (s - 1) as any)}
                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-black flex items-center gap-1"
              >
                <ChevronRight size={14} /> الرجوع للخطوة السابقة
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-5 py-3 text-slate-500 hover:text-slate-800 text-xs font-bold">إلغاء الأمر</button>
            
            {step === 2 && (
              <button 
                onClick={handleNextStep}
                className="px-7 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black flex items-center gap-2"
              >
                متابعة للمعاينة والاعتماد
                <ChevronLeft size={14} />
              </button>
            )}

            {step === 3 && (
              <button 
                disabled={stats.toImportCount === 0}
                onClick={executeImport}
                className="px-7 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-2 disabled:bg-slate-100 disabled:text-slate-400"
              >
                <Database size={15} /> تغذية سجلات العملاء ({stats.toImportCount} جاهز)
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
