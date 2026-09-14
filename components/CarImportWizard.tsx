import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  Upload, Check, AlertCircle, Database, Columns, Eye, RefreshCcw, 
  FileSpreadsheet, ChevronRight, ChevronLeft, X, Settings2, FileText, 
  CheckCircle2, Sliders, Info, AlertTriangle, HelpCircle, CheckCircle, Clock,
  ChevronDown, ChevronUp, Loader2
} from 'lucide-react';
import { motion } from 'motion/react';
import { Car, CarStatus, RentalStatus, OwnershipType, DeliveryType } from '../types';

interface TargetField {
  key: string;
  label: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean';
  description: string;
  regexMatches: string[];
}

const TARGET_FIELDS: TargetField[] = [
  { key: 'brand', label: 'السيارة / المركبة', required: true, type: 'string', description: 'الاسم التعريفي للمركبة أو السيارة المعنية (مثال: نيسان باترول، تويوتا كامري، الخ)', regexMatches: ['السيارة', 'المركبة', 'الماركة', 'الشركة', 'البراند', 'الصانع', 'brand', 'make', 'company', 'manufacturer', 'ماركة السيارة', 'ماركة المركبة', 'شركة السيارة', 'شركة المركبة', 'طراز', 'الطراز', 'model', 'vehicle_model', 'اسم السيارة', 'براند_النظام_الداخلي'] },
  { key: 'year', label: 'الموديل (سنة الصنع)', required: false, type: 'number', description: 'سنة صنع المركبة أو الموديل بالأرقام مثل (2025، 2026)', regexMatches: ['الموديل', 'السنة', 'سنة الصنع', 'سنة الموديل', 'سنه', 'الموديل سنة', 'الموديل سنه', 'موديل السيارة', 'موديل المركبة', 'موديل السيارة سنة', 'موديل المركبة سنة', 'year', 'manufacturing_year', 'model_year', 'prod_year', 'سنة صنع السيارة', 'سنة صنع المركبة', 'سنة_النظام_الداخلي', 'الموديل (السنة)'] },
  { key: 'color', label: 'اللون الخارجي', required: false, type: 'string', description: 'اللون الخارجي للمركبة من الاستمارة', regexMatches: ['اللون', 'اللون الخارجي', 'جسم السيارة', 'لون', 'color', 'colour', 'exterior_color', 'لون السيارة', 'لون المركبة', 'الون', 'لون_النظام_الداخلي', 'اللون (النظام)'] },
  { key: 'vin', label: 'رقم الهيكل / الشاصي', required: true, type: 'string', description: 'رقم الهيكل الحقيقي والفريد المكون من 17 رمزاً', regexMatches: ['رقم الهيكل', 'شاصي', 'رقم الشاصي', 'الهيكل', 'الشاصيه', 'المحرك رقم', 'vin', 'chassis', 'chassis_no', 'vin_number', 'رقم هيكل السيارة', 'رقم هيكل المركبة', 'شاصي السيارة', 'شاصي المركبة', 'رقم الهيكل (VIN)'] },
  { key: 'cardNumber', label: 'رقم البطاقة الجمركية', required: false, type: 'string', description: 'رقم البطاقة الجمركية الخاصة بالبيان الجمركي', regexMatches: ['البطاقة', 'رقم البطاقة', 'البطاقة الجمركية', 'رقم الجمرك', 'رقم الجمارك', 'card', 'card_number', 'customs_no', 'customs_number', 'بطاقة جمركية للسيارة', 'بطاقة جمركية للمركبة'] },
  { key: 'price', label: 'سعر البيع الافتراضي', required: false, type: 'number', description: 'سعر بيع المركبة الافتراضي للجمهور', regexMatches: ['السعر', 'سعر البيع', 'سعر السيارة', 'المبلغ', 'سعر', 'price', 'sale_price', 'price_out', 'سعر المركبة'] },
  { key: 'costPrice', label: 'سعر التكلفة الاستيرادية', required: false, type: 'number', description: 'سعر شراء واستيراد أو تصنيع المركبة الفعلي', regexMatches: ['التكلفة', 'سعر التكلفة', 'تكلفة الاستيراد', 'الشراء', 'سعر الشراء', 'cost', 'cost_price', 'purchase_price', 'تكلفة السيارة', 'تكلفة المركبة'] },
  { key: 'supplier', label: 'المورد / مصدر التوريد', required: false, type: 'string', description: 'اسم المورد أو الوكيل المستورد لصالحه', regexMatches: ['المورد', 'مصدر السيارة', 'مورد', 'الجهة الموردة', 'supplier', 'vendor', 'source', 'مصدر المركبة'] },
  { key: 'notes', label: 'ملاحظات إضافية', required: false, type: 'string', description: 'أي بيانات، شروحات أو تفاصيل تشغيلية أخرى', regexMatches: ['ملاحظات', 'البيان', 'توضيح', 'تفاصيل', 'بيان', 'notes', 'remarks', 'comment', 'description', 'ملاحظات إضافية'] },
  { key: 'rentalStatus', label: 'حالة التجير', required: false, type: 'string', description: 'حالة تجير السيارة مثل (مجير، لم يتم التجير)', regexMatches: ['حالة التجير', 'التجير', 'التأجير', 'حالة التأجير', 'تجير', 'تأجير', 'rentalStatus', 'rental_status', 'rented', 'is_rented'] },
  { key: 'status', label: 'حالة السيارة / المركبة', required: false, type: 'string', description: 'حالة مركبة الفعلية مثل (متوفرة، مباعة، محجوزة، لم تصل بعد، مرتجعة للمعرض)', regexMatches: ['حالة السيارة', 'الحالة', 'حالة المركبة', 'الوضعية', 'الحاله', 'status', 'car_status', 'state', 'condition'] },
  { key: 'seller', label: 'المندوب / البائع', required: false, type: 'string', description: 'اسم المندوب أو البائع الكفيل بالعملية', regexMatches: ['المندوب', 'البائع', 'مندوب', 'بائع', 'اسم المندوب', 'اسم البائع', 'سيلز', 'كفيل', 'salesperson', 'seller', 'delegate', 'agent', 'salesman', 'representative', 'البائع / المندوب'] },
  { key: 'ownershipType', label: 'المالك / ملاك المركبة', required: false, type: 'string', description: 'نوع المالك الحالي للسيارة (مباشر / عميل)', regexMatches: ['المالك', 'ownership', 'ownershipType', 'نوع الملكية'] },
  { key: 'entryDate', label: 'تاريخ الدخول', required: false, type: 'string', description: 'تاريخ دخول وتسجيل المركبة للمخزن', regexMatches: ['تاريخ الدخول', 'تاريخ ورود', 'تاريخ دخول', 'entry_date', 'entryDate', 'entryDateCustom'] },
  { key: 'isPresentInShowroom', label: 'التواجد بالمعرض', required: false, type: 'string', description: 'مدى التواجد الفعلي في صالة المعرض (نعم / لا)', regexMatches: ['التواجد بالمعرض', 'متواجد بالمعرض', 'بالمعرض', 'showroom', 'isPresentInShowroom', 'showroomCustom'] },
  { key: 'attributionSource', label: 'وارد المركبة / المصدر', required: false, type: 'string', description: 'سجل وارد المركبة ومصدر استيرادها الخارجي', regexMatches: ['وارد المركبة', 'الوارد', 'المصدر', 'جهة الوارد', 'وارد', 'attribution', 'attributionSource', 'attributionCustom'] },
  { key: 'carRemark', label: 'وصف حالة المركبة', required: false, type: 'string', description: 'ملاحظات سلامة المركبة ووصف حالتها', regexMatches: ['وصف حالة المركبة', 'حالة المركبة', 'الملاحظة', 'ملاحظات المعرض', 'car_condition', 'condition', 'carRemark'] },
  { key: 'plateNumber', label: 'رقم اللوحة', required: false, type: 'string', description: 'رقم اللوحة المرورية للسيارة إن وجدت', regexMatches: ['رقم اللوحة', 'اللوحة', 'لوحة', 'plate', 'plateNumber'] },
  { key: 'plateOwner', label: 'مالك اللوحة', required: false, type: 'string', description: 'اسم مالك لوحة السيارة المسجلة', regexMatches: ['مالك اللوحة', 'اسم مالك اللوحة', 'plateOwner'] },
  { key: 'deliveryType', label: 'نوع المستلم', required: false, type: 'string', description: 'صفة الشخص المستلم للسيارة', regexMatches: ['نوع المستلم', 'المستلم نوع', 'delivery_type', 'deliveryType'] },
  { key: 'transportCompany', label: 'شركة النقليات', required: false, type: 'string', description: 'شركة النقليات التي قامت بنقل السيارة', regexMatches: ['شركة النقليات', 'النقليات', 'المشحن', 'مجموعة النقل', 'transport_company', 'transportCompany'] },
  { key: 'receiverName', label: 'العميل المستلم', required: false, type: 'string', description: 'اسم العميل المشتري أو المستلم النهائي للسيارة', regexMatches: ['العميل', 'المستلم', 'اسم العميل', 'receiver_name', 'receiverName'] },
  { key: 'receiverId', label: 'هوية العميل', required: false, type: 'string', description: 'رقم الهوية الوطنية أو إقامة المشتري المستلم', regexMatches: ['هوية العميل', 'رقم الهوية', 'هوية', 'receiver_id', 'receiverId'] },
  { key: 'receiverPhone', label: 'رقم هاتف العميل', required: false, type: 'string', description: 'رقم الاتصال الخاص بالعميل المستلم', regexMatches: ['رقم الهاتف', 'هاتف', 'جوال', 'receiver_phone', 'receiverPhone'] },
  { key: 'exitDate', label: 'تاريخ الخروج', required: false, type: 'string', description: 'تاريخ خروج وتسليم المركبة من المعرض', regexMatches: ['تاريخ الخروج', 'خروج', 'exit_date', 'exitDate'] },
  { key: 'exitNotes', label: 'ملاحظات الخروج', required: false, type: 'string', description: 'ملاحظات نهائية كتبت أثناء تسليم السيارة', regexMatches: ['ملاحظات الخروج', 'ملاحظة خروج', 'exit_notes', 'exitNotes'] }
];

const isCardNumberValidForDuplicateCheck = (card: any): boolean => {
  if (!card) return false;
  const s = card.toString().trim();
  if (!s) return false;
  const lower = s.toLowerCase();
  if (
    lower === '-' ||
    lower === '--' ||
    lower === 'غير محدد' ||
    lower.includes('لم يرد') ||
    lower.includes('بعد') ||
    lower.includes('لا يوجد') ||
    lower.includes('n/a') ||
    lower.includes('none') ||
    lower.includes('null') ||
    lower.includes('undefined')
  ) {
    return false;
  }
  return true;
};

interface CarImportWizardProps {
  existingCars: Car[];
  currentUser: any;
  onImportComplete: (cars: Car[], duplicateMode: 'overwrite' | 'skip') => void | Promise<void>;
  onClose: () => void;
}

export const CarImportWizard: React.FC<CarImportWizardProps> = ({ 
  existingCars = [], 
  currentUser, 
  onImportComplete, 
  onClose 
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [importMode, setImportMode] = useState<'direct' | 'smart'>('smart');
  const [step2ErrorBanner, setStep2ErrorBanner] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sheetData, setSheetData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);

  // Configured columns structure (ordered and toggleable) loaded from localStorage if exist
  const [orderedFields, setOrderedFields] = useState<{
    key: string;
    label: string;
    required: boolean;
    type: string;
    description: string;
    enabled: boolean;
  }[]>(() => {
    try {
      const savedConfig = localStorage.getItem('car_import_wizard_fields_config');
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const merged = parsed.map((p: any) => {
            const original = TARGET_FIELDS.find(t => t.key === p.key);
            if (original) {
              return {
                key: original.key,
                label: original.label,
                required: original.required,
                type: original.type,
                description: original.description,
                enabled: p.enabled !== false,
              };
            }
            return null;
          }).filter(Boolean) as any[];

          // Append any fields that weren't in saved list
          TARGET_FIELDS.forEach(t => {
            if (!merged.some(m => m.key === t.key)) {
              merged.push({
                key: t.key,
                label: t.label,
                required: t.required,
                type: t.type,
                description: t.description,
                enabled: true
              });
            }
          });
          return merged;
        }
      }
    } catch (e) {
      console.error('Error parsing car_import_wizard_fields_config', e);
    }
    return TARGET_FIELDS.map(f => ({
      key: f.key,
      label: f.label,
      required: f.required,
      type: f.type,
      description: f.description,
      enabled: true
    }));
  });

  const [mappings, setMappings] = useState<Record<string, string>>(() => {
    try {
      const savedMappings = localStorage.getItem('car_import_wizard_mappings');
      if (savedMappings) {
        return JSON.parse(savedMappings);
      }
    } catch (e) {
      console.error('Error parsing car_import_wizard_mappings', e);
    }
    return {};
  });

  const [duplicateMode, setDuplicateMode] = useState<'overwrite' | 'skip'>('skip');
  const [isDragging, setIsDragging] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  
  // Filtering for step 3 preview
  const [validationFilter, setValidationFilter] = useState<'all' | 'errors' | 'valid' | 'duplicates'>('all');
  const [previewPage, setPreviewPage] = useState(1);
  const [selectedDupCompareId, setSelectedDupCompareId] = useState<string | null>(null);
  const PREVIEW_ITEMS_PER_PAGE = 8;

  // Diagnostic debug telemetry states
  const [debugSheetName, setDebugSheetName] = useState<string>('');
  const [debugAllSheetNames, setDebugAllSheetNames] = useState<string[]>([]);
  const [debugTotalRawRows, setDebugTotalRawRows] = useState<number>(0);
  const [debugHeaderRowIdx, setDebugHeaderRowIdx] = useState<number>(0);
  const [debugOriginalHeaders, setDebugOriginalHeaders] = useState<string[]>([]);
  const [showDebugPanel, setShowDebugPanel] = useState<boolean>(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const moveField = (index: number, direction: 'up' | 'down') => {
    const list = [...orderedFields];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;
    setOrderedFields(list);
  };

  const toggleFieldEnabled = (key: string) => {
    setOrderedFields(prev => prev.map(f => {
      if (f.key === key) {
        if (f.required) return f;
        const newEnabled = !f.enabled;
        if (!newEnabled) {
          setMappings(m => ({ ...m, [key]: '' }));
        }
        return { ...f, enabled: newEnabled };
      }
      return f;
    }));
  };

  const saveImportSettings = () => {
    try {
      localStorage.setItem('car_import_wizard_fields_config', JSON.stringify(orderedFields));
      localStorage.setItem('car_import_wizard_mappings', JSON.stringify(mappings));
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 4000);
    } catch (err) {
      alert("فشل في حفظ الإعدادات، يرجى التثبت من ذاكرة المتصفح.");
    }
  };

  // Helper dictionary lookup to score a string match
  const findBestMatchingHeader = (target: TargetField, srcHeaders: string[]): string => {
    const normalizeArabic = (text: string): string => {
      return text.toString().trim().toLowerCase()
        // Replace Alef spelling variants
        .replace(/[أإآ]/g, 'ا')
        // Replace Teh Marbuta with Heh
        .replace(/ة/g, 'ه')
        // Replace Alef Maksura with Yeh
        .replace(/ى/g, 'ي')
        // Standardize vehicle vs car synonyms as requested directly
        .replace(/المركبه/g, 'سياره')
        .replace(/المركبة/g, 'سياره')
        .replace(/مركبه/g, 'سياره')
        .replace(/مركبة/g, 'سياره')
        .replace(/السياره/g, 'سياره')
        .replace(/السيارة/g, 'سياره')
        .replace(/سيارة/g, 'سياره')
        // Strip leading "الـ" definite article for broader matching
        .replace(/^ال/g, '')
        .replace(/\sال/g, ' ')
        // Remove redundant separator symbols/spaces
        .replace(/[\s_-]+/g, ' ')
        .trim();
    };

    let bestMatch = '';
    let maxScore = 0;

    for (const h of srcHeaders) {
      const cleanH = normalizeArabic(h);
      // Try exact matching with spelling variants
      for (const matchText of target.regexMatches) {
        const cleanMatchText = normalizeArabic(matchText);
        if (cleanH === cleanMatchText) {
          return h; // Immediate exact match!
        }
        // Substring scoring
        if (cleanH.includes(cleanMatchText) || cleanMatchText.includes(cleanH)) {
          const score = matchText.length / Math.abs(cleanH.length - cleanMatchText.length + 1);
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
        
        // 1. Dynamic check for correct Excel sheet containing our actual tabular inventory headers
        const sheetNames = workbook.SheetNames;
        setDebugAllSheetNames(sheetNames);
        
        let bestSheetName = sheetNames[0];
        let bestSheetHeaderMatchCount = -1;
        let bestSheetHeaders: string[] = [];
        let bestSheetRows: any[][] = [];
        let bestHeaderIdx = 0;

        for (const sName of sheetNames) {
          const ws = workbook.Sheets[sName];
          const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
          if (rawRows.length === 0) continue;
          
          let maxHeaderMatchThisSheet = 0;
          let tempHeaderIdx = 0;
          const scanLimit = Math.min(rawRows.length, 15);
          for (let r = 0; r < scanLimit; r++) {
            const rowValues = rawRows[r].map(cell => cell?.toString().trim().toLowerCase() || '');
            let matchCount = 0;
            for (const field of TARGET_FIELDS) {
              const hasMatch = field.regexMatches.some(keyword => {
                const cleanedKeyword = keyword.toLowerCase();
                return rowValues.some(val => val === cleanedKeyword || val.includes(cleanedKeyword));
              });
              if (hasMatch) {
                matchCount++;
              }
            }
            if (matchCount > maxHeaderMatchThisSheet) {
              maxHeaderMatchThisSheet = matchCount;
              tempHeaderIdx = r;
            }
          }

          // If fallback has at least 3 non-blank values
          if (maxHeaderMatchThisSheet < 2) {
            for (let r = 0; r < scanLimit; r++) {
              const nonBlankCount = rawRows[r].filter(cell => cell?.toString().trim() !== '').length;
              if (nonBlankCount >= 3) {
                maxHeaderMatchThisSheet = 2; // custom matching score
                tempHeaderIdx = r;
                break;
              }
            }
          }

          if (maxHeaderMatchThisSheet > bestSheetHeaderMatchCount) {
            bestSheetHeaderMatchCount = maxHeaderMatchThisSheet;
            bestSheetName = sName;
            bestSheetRows = rawRows;
            bestHeaderIdx = tempHeaderIdx;
          }
        }

        const sheetName = bestSheetName;
        const worksheet = workbook.Sheets[sheetName];
        setDebugSheetName(sheetName);

        // Read raw rows of the best sheet
        const rawRows = bestSheetRows;
        setDebugTotalRawRows(rawRows.length);
        setDebugHeaderRowIdx(bestHeaderIdx);

        if (rawRows.length === 0) {
          alert("الملف فارغ أو لا يحتوي على صفوف بيانات صالحة.");
          return;
        }

        const rawHeaders = rawRows[bestHeaderIdx] || [];
        const detectedHeaders = rawHeaders.map((h, idx) => {
          const val = h?.toString().trim();
          if (!val) return `UnnamedColumn_${idx + 1}`;
          return val;
        });

        setDebugOriginalHeaders(detectedHeaders);

        const parsedSheetData: any[] = [];
        for (let r = bestHeaderIdx + 1; r < rawRows.length; r++) {
          const row = rawRows[r];
          if (!row || row.length === 0) continue;
          const isRowEmpty = row.every(cell => {
            if (cell === undefined || cell === null) return true;
            return cell.toString().trim() === '';
          });
          if (isRowEmpty) continue;

          const rowData: Record<string, any> = {};
          detectedHeaders.forEach((header, colIdx) => {
            rowData[header] = row[colIdx] !== undefined ? row[colIdx] : "";
          });
          parsedSheetData.push(rowData);
        }

        if (parsedSheetData.length === 0) {
          alert("لا توجد بيانات صالحة أسفل صف العناوين.");
          return;
        }

        setHeaders(detectedHeaders);
        setSheetData(parsedSheetData);

        const DIRECT_SYSTEM_MAP: Record<string, string> = {
          'السيارة': 'brand',
          'ماركة السيارة': 'brand',
          'الماركة': 'brand',
          'البراند': 'brand',
          'اللون والموديل': 'color',
          'اللون': 'color',
          'المالك': 'ownershipType',
          'البطاقة الجمركية': 'cardNumber',
          'رقم البطاقة': 'cardNumber',
          'البطاقة': 'cardNumber',
          'رقم الهيكل (VIN)': 'vin',
          'رقم الهيكل': 'vin',
          'رقم الشاصي': 'vin',
          'الشاصي': 'vin',
          'تطابق الهيكل': 'vinMatching',
          'مطابقة الهيكل': 'vinMatching',
          'حالة التجير': 'rentalStatus',
          'الحالة': 'status',
          'حالة التخليص': 'customData_clearanceStatus',
          'تاريخ الوصول': 'customData_arrivalDate',
          'وصف حالة المركبة': 'carRemark',
          'المورد': 'supplier',
          'الجهة الموردة': 'supplier',
          'تاريخ الدخول': 'entryDate',
          'ملاحظات': 'notes',
          'الملاحظات': 'notes',
          'ملاحظات الحجز': 'notes',
          'التواجد بالمعرض': 'isPresentInShowroom',
          'وارد المركبة': 'attributionSource',
          'البائع / المندوب': 'seller',
          'نوع المستلم': 'deliveryType',
          'شركة النقليات': 'transportCompany',
          'العميل': 'receiverName',
          'هوية العميل': 'receiverId',
          'رقم الهاتف': 'receiverPhone',
          'تاريخ الخروج': 'exitDate',
          'ملاحظات الخروج': 'exitNotes',
          'التكلفة': 'costPrice',
          'السعر': 'price',
          'سعر البيع': 'price',
          'رقم اللوحة': 'plateNumber',
          'مالك اللوحة': 'plateOwner'
        };

        const SYSTEM_EXPORTED_MAP: Record<string, string> = {
          'السيارة': 'brand',
          'اللون والموديل': 'color',
          'المالك': 'ownershipType',
          'البطاقة الجمركية': 'cardNumber',
          'رقم الهيكل (VIN)': 'vin',
          'رقم الهيكل': 'vin',
          'تطابق الهيكل': 'vinMatching',
          'حالة التجير': 'rentalStatus',
          'الحالة': 'status',
          'وصف حالة المركبة': 'carRemark',
          'المورد': 'supplier',
          'تاريخ الدخول': 'entryDate',
          'ملاحظات الحجز': 'notes',
          'التواجد بالمعرض': 'isPresentInShowroom',
          'وارد المركبة': 'attributionSource',
          'البائع / المندوب': 'seller',
          'نوع المستلم': 'deliveryType',
          'شركة النقليات': 'transportCompany',
          'العميل': 'receiverName',
          'هوية العميل': 'receiverId',
          'رقم الهاتف': 'receiverPhone',
          'تاريخ الخروج': 'exitDate',
          'ملاحظات الخروج': 'exitNotes',
          'التكلفة': 'costPrice',
          'السعر': 'price',
          'رقم اللوحة': 'plateNumber',
          'مالك اللوحة': 'plateOwner'
        };

        const initialMappings: Record<string, string> = {};
        let savedMappings: Record<string, string> = {};
        try {
          const stored = localStorage.getItem('car_import_wizard_mappings');
          if (stored) savedMappings = JSON.parse(stored);
        } catch {}

        orderedFields.forEach(field => {
          if (!field.enabled) return;

          if (importMode === 'direct') {
            const matchedHeader = detectedHeaders.find(h => {
              const hClean = h.trim();
              return hClean === field.label || DIRECT_SYSTEM_MAP[hClean] === field.key;
            });
            if (matchedHeader) {
              initialMappings[field.key] = matchedHeader;
            }
          } else {
            // Try system-exported map first
            const systemHeader = detectedHeaders.find(h => SYSTEM_EXPORTED_MAP[h] === field.key);
            if (systemHeader) {
              initialMappings[field.key] = systemHeader;
            } else {
              const savedHeader = savedMappings[field.key];
              if (savedHeader && detectedHeaders.includes(savedHeader)) {
                initialMappings[field.key] = savedHeader;
              } else {
                const matched = findBestMatchingHeader(TARGET_FIELDS.find(t => t.key === field.key) || { ...field, regexMatches: [] } as any, detectedHeaders);
                if (matched) {
                  initialMappings[field.key] = matched;
                }
              }
            }
          }
        });
        setMappings(initialMappings);
        setStep(2);
      } catch (err) {
        alert("فشل في قراءة ومعالجة الملف.");
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

  // Map sheet items to model format with continuous diagnostic logging
  const { parsedItems, diagnosticLogs } = useMemo(() => {
    const logs: string[] = [];
    const seenVinsInSheet = new Set<string>();

    logs.push(`🔍 بدأ تحليل مسير بيانات ملف الاستيراد النشط: إجمالي صفوف ورقة العمل المكتشفة = ${sheetData.length} صفاً`);
    logs.push(`📌 اسم ورقة البيانات الحالية: "${debugSheetName || "الورقة الأولى الافتراضية"}"`);
    logs.push(`📊 موقع صف العناوين الرئيسي المكتشف بصفة تصفية: الصف رقم ${debugHeaderRowIdx + 1}`);
    logs.push(`📑 العناوين الهيكلية المقروءة للجدول: [${debugOriginalHeaders.join(', ')}]`);

    logs.push(`🔗 إعدادات وخرائط الربط النشطة حالياً بين حقول النظام وجدول Excel:
      - حقل السيارة (brand): {${mappings.brand || "⚠️ غير مرتبط (مطلوب للتحقق)"}}
      - حقل رقم الشاصي (vin): {${mappings.vin || "⚠️ غير مرتبط (مطلوب للتحقق)"}}
      - حقل لون الهيكل (color): {${mappings.color || "غير مرتبط"}}
      - حقل موديل السنة (year): {${mappings.year || "غير مرتبط"}}
      - حقل سعر البيع (price): {${mappings.price || "غير مرتبط"}}
      - حقل التكلفة (costPrice): {${mappings.costPrice || "غير مرتبط"}}
      - حقل حالة المركبة (status): {${mappings.status || "غير مرتبط"}}`);

    // Log first 10 rows samples immediately as requested by user
    const sampleLimit = Math.min(sheetData.length, 10);
    logs.push(`📋 تسجيل أول ${sampleLimit} صفوف بيانات خام مقروءة مباشرة قبل التصفية لتتبع القيم المستخرجة:`);
    for (let r = 0; r < sampleLimit; r++) {
      const rowItem = sheetData[r];
      const itemsStr = Object.entries(rowItem).map(([key, val]) => `"${key}":"${val}"`).join(' | ');
      logs.push(`   * [عينة صف خام ${r + 1}]: ${itemsStr}`);
    }

    // Step 1: Filter row list with precise logging
    const filteredRows: { row: any; originalIndex: number }[] = [];
    sheetData.forEach((row, idx) => {
      const originalRowIdx = debugHeaderRowIdx + idx + 2; // spreadsheet 1-based index
      const vals = Object.values(row).map(v => v?.toString().trim() || '');
      const nonAttrVals = vals.filter(v => v !== '-' && v !== '');
      
      if (nonAttrVals.length === 0) {
        logs.push(`⚠️ تجاهل الصف المستند رقم [${originalRowIdx}]: الصف فارغ تماماً ولا يحتوي على أي قيم ملموسة.`);
        return;
      }

      const joined = nonAttrVals.join(' ');
      const cleanJoined = joined.replace(/\s+/g, '').trim();

      // Only apply structural header filter if density is very low to avoid dropping genuine records
      const isLowDensity = nonAttrVals.length <= 3;
      if (isLowDensity) {
        if (
          cleanJoined.startsWith('🚘') || 
          cleanJoined.endsWith('🚘') || 
          cleanJoined.includes('حالةالسيارات') || 
          cleanJoined.includes('إجماليالسيارات') || 
          cleanJoined.includes('إحصائيات') ||
          cleanJoined.includes('الوارد/المصدر') || 
          cleanJoined.includes('لمتصلالمعرض') ||
          cleanJoined.includes('وارد:') ||
          cleanJoined.includes('ملاحظة:')
        ) {
          logs.push(`⚠️ تجاهل الصف المستند رقم [${originalRowIdx}]: تم رصد عبارات لهيكل أو إحصائية فرعية أو عنوان قسم جانبي: ("${cleanJoined.slice(0, 45)}")`);
          return;
        }
      }

      // Check if VIN is unmapped or blank
      const mappedVinHeader = mappings?.vin;
      const vinVal = mappedVinHeader ? row[mappedVinHeader]?.toString().trim() : '';
      if (!vinVal && isLowDensity) {
        logs.push(`⚠️ تجاهل الصف المستند رقم [${originalRowIdx}]: صف عالي الفراغات وخلو الهيكل شاصي تماماً (كثافة الأعمدة الهيكلية الممتلئة: ${nonAttrVals.length})`);
        return;
      }

      filteredRows.push({ row, originalIndex: originalRowIdx });
    });

    logs.push(`📉 كفاءة التصفية الأولية: تم تصفية وقبول ${filteredRows.length} صفاً من إجمالي ${sheetData.length} صفاً وبدء تحويلها لكائنات برمجية.`);

    // Step 2: Map and validate rows
    const items = filteredRows.map(({ row, originalIndex }, index) => {
      const id = `imp-${Date.now()}-${index}`;
      const errors: string[] = [];
      const warnings: string[] = [];

      const rowValues = Object.entries(row).map(([k, v]) => ({
        key: k,
        val: v?.toString().trim() || ''
      }));

      // Read raw mappings
      const brandRaw = mappings.brand ? row[mappings.brand]?.toString().trim() : '';
      const modelRaw = mappings.model ? row[mappings.model]?.toString().trim() : '';
      const yearRawVal = mappings.year ? row[mappings.year] : null;
      const colorRaw = mappings.color ? row[mappings.color]?.toString().trim() : '';
      const vinRaw = mappings.vin ? row[mappings.vin]?.toString().trim().toUpperCase() : '';
      const rawCardNumber = mappings.cardNumber ? row[mappings.cardNumber]?.toString().trim() : '';

      const supplier = mappings.supplier ? row[mappings.supplier]?.toString().trim() : '';
      const notes = mappings.notes ? row[mappings.notes]?.toString().trim() : '';
      const seller = mappings.seller ? row[mappings.seller]?.toString().trim() : '';

      // Smart Fallback Extractor
      let finalBrand = brandRaw ? brandRaw.trim() : '';
      let finalModel = modelRaw ? modelRaw.trim() : '';
      let finalColor = colorRaw ? colorRaw.trim() : '';
      let finalYear = 0;
      let finalAttribution = '';
      let finalRemark = '';

      // Part A: Parsing "car_info" if model is unmapped but brand starts with complex pattern or is mapped to combined "السيارة"
      if (finalBrand && !finalModel) {
        let str = finalBrand;
        
        // Extract attribution
        const attrMatch = str.match(/\[وارد:\s*([^\]]+)\]/);
        if (attrMatch) {
          finalAttribution = attrMatch[1].trim();
          str = str.replace(/\[وارد:\s*([^\]]+)\]/, '');
        }
        
        // Extract remark
        const remarkMatch = str.match(/\[ملاحظة:\s*([^\]]+)\]/);
        if (remarkMatch) {
          finalRemark = remarkMatch[1].trim();
          str = str.replace(/\[ملاحظة:\s*([^\]]+)\]/, '');
        }
        
        // Remove parenthesized notes if present
        str = str.replace(/\(([^)]+)\)/, '').trim();

        // Now split brand + model (e.g. "تويوتا كامري")
        str = str.replace(/\s+/g, ' ').trim();
        const brandTokens = str.split(' ');
        if (brandTokens.length > 0) {
          if (str.toLowerCase().startsWith('بي ام دبليو') || str.toLowerCase().startsWith('bmw')) {
            finalBrand = 'بي ام دبليو';
            finalModel = brandTokens.slice(3).join(' ').trim();
            if (!finalModel && brandTokens.slice(1).join(' ').trim().toLowerCase().startsWith('mw')) {
              finalModel = brandTokens.slice(2).join(' ').trim();
            }
          } else if (str.toLowerCase().startsWith('لاند روفر') || str.toLowerCase().startsWith('land rover')) {
            finalBrand = 'لاند روفر';
            finalModel = brandTokens.slice(2).join(' ').trim();
          } else if (str.toLowerCase().startsWith('رنج روفر') || str.toLowerCase().startsWith('range rover')) {
            finalBrand = 'رنج روفر';
            finalModel = brandTokens.slice(2).join(' ').trim();
          } else if (str.toLowerCase().startsWith('ميني كوبر') || str.toLowerCase().startsWith('mini cooper')) {
            finalBrand = 'ميني كوبر';
            finalModel = brandTokens.slice(2).join(' ').trim();
          } else {
            finalBrand = brandTokens[0];
            finalModel = brandTokens.slice(1).join(' ').trim();
          }
        }
      }

      // Part B: Parsing combined "اللون والموديل" (e.g. "أبيض | 2024")
      if (finalColor && finalColor.includes('|')) {
        const parts = finalColor.split('|');
        finalColor = parts[0].trim();
        const yearPart = parts[1]?.trim();
        if (yearPart && !yearRawVal) {
          const parsedYear = parseInt(yearPart.replace(/[^0-9]/g, '')) || 0;
          if (parsedYear >= 1900 && parsedYear <= 2100) {
            finalYear = parsedYear;
          }
        }
      }

      // Map Arabic to English numbers strictly
      const mapArToEn = (str: string) => {
        const ar = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
        return str.split('').map(c => {
          const idx = ar.indexOf(c);
          return idx !== -1 ? idx.toString() : c;
        }).join('');
      };

      if (yearRawVal !== undefined && yearRawVal !== null && yearRawVal !== '') {
        const cleanRaw = mapArToEn(yearRawVal.toString().trim());
        const parsedYear = parseInt(cleanRaw.replace(/[^0-9]/g, '')) || 0;
        finalYear = parsedYear;
      }

      if (!finalYear) {
        finalYear = 0;
        warnings.push("سنة الصنع أو الموديل مفقود في السجل الأصلي، تم تركه فارغاً والالتزام الكامل بالملف.");
      }

      const priceRaw = mappings.price ? row[mappings.price] : null;
      const costPriceRaw = mappings.costPrice ? row[mappings.costPrice] : null;

      // Parse price and costPrice properly, cleaning out any symbols or spaces
      const price = priceRaw ? parseFloat(priceRaw.toString().replace(/[^0-9.]/g, '')) || 0 : 0;
      const costPrice = costPriceRaw ? parseFloat(costPriceRaw.toString().replace(/[^0-9.]/g, '')) || 0 : 0;

      const finalVinClean = vinRaw ? vinRaw.replace(/\s+/g, '').toUpperCase() : '';
      const cardNumber = rawCardNumber ? rawCardNumber.toString().trim() : 'لم يرد البطاقه بعد';

      // Advanced property maps (e.g. ownership, entry date, showroom)
      const ownershipTypeRaw = mappings.ownershipType ? row[mappings.ownershipType]?.toString().trim() : '';
      let ownershipType = OwnershipType.DIRECT;
      if (ownershipTypeRaw) {
        if (ownershipTypeRaw.includes('تصريف') || ownershipTypeRaw.includes('distribution') || ownershipTypeRaw.includes('عميل') || ownershipTypeRaw.includes('customer')) {
          ownershipType = OwnershipType.DISTRIBUTION;
        }
      }

      const showroomRaw = mappings.isPresentInShowroom ? row[mappings.isPresentInShowroom]?.toString().trim() : '';
      let isPresentInShowroom = true;
      if (showroomRaw) {
        if (showroomRaw === 'لا' || showroomRaw.includes('false') || showroomRaw === '0') {
          isPresentInShowroom = false;
        }
      }

      const attributionInRow = mappings.attributionSource ? row[mappings.attributionSource]?.toString().trim() : '';
      const finalAttributionSource = attributionInRow || finalAttribution || '';

      const carRemarkRaw = mappings.carRemark ? row[mappings.carRemark]?.toString().trim() : '';
      const finalCarRemark = carRemarkRaw || finalRemark || '';

      const plateNumber = mappings.plateNumber ? row[mappings.plateNumber]?.toString().trim() : '';
      const plateOwner = mappings.plateOwner ? row[mappings.plateOwner]?.toString().trim() : '';

      const saleType = mappings.saleType ? row[mappings.saleType]?.toString().trim() : '';
      const bankName = mappings.bankName ? row[mappings.bankName]?.toString().trim() : '';
      const deliveryTypeRaw = mappings.deliveryType ? row[mappings.deliveryType]?.toString().trim() : '';
      let deliveryType = DeliveryType.OWNER;
      if (deliveryTypeRaw) {
        if (deliveryTypeRaw.includes('نقليات') || deliveryTypeRaw.includes('transport') || deliveryTypeRaw.includes('شحن')) {
          deliveryType = DeliveryType.TRANSPORT;
        } else if (deliveryTypeRaw.includes('اخر') || deliveryTypeRaw.includes('other') || deliveryTypeRaw.includes('مستلم')) {
          deliveryType = DeliveryType.OTHER;
        }
      }

      const transportCompany = mappings.transportCompany ? row[mappings.transportCompany]?.toString().trim() : '';
      const receiverName = mappings.receiverName ? row[mappings.receiverName]?.toString().trim() : '';
      const receiverId = mappings.receiverId ? row[mappings.receiverId]?.toString().trim() : '';
      const receiverPhone = mappings.receiverPhone ? row[mappings.receiverPhone]?.toString().trim() : '';
      const exitDateVal = mappings.exitDate ? row[mappings.exitDate]?.toString().trim() : '';
      const exitNotes = mappings.exitNotes ? row[mappings.exitNotes]?.toString().trim() : '';
      const entryDateRaw = mappings.entryDate ? row[mappings.entryDate]?.toString().trim() : '';

      const parseExcelDate = (val: any): string => {
        if (!val) return new Date().toISOString();
        const str = val.toString().trim();
        if (!str || str === '-') return new Date().toISOString();
        const num = parseFloat(str);
        if (!isNaN(num) && num > 30000 && num < 60000) {
          const ms = Math.round((num - 25569) * 86400 * 1000) + 12 * 3600 * 1000;
          return new Date(ms).toISOString();
        }
        const parsedDate = Date.parse(str);
        if (!isNaN(parsedDate)) {
          return new Date(parsedDate).toISOString();
        }
        return new Date().toISOString();
      };

      const entryDate = parseExcelDate(entryDateRaw);
      const exitDateStr = exitDateVal && exitDateVal !== '-' ? parseExcelDate(exitDateVal).split('T')[0] : '';

      const rentalStatusRaw = mappings.rentalStatus ? row[mappings.rentalStatus]?.toString().trim() : '';
      let rentalStatus = RentalStatus.NOT_RENTED;
      if (rentalStatusRaw) {
        const norm = rentalStatusRaw.trim().toLowerCase();
        if (norm.includes('مجير') || norm.includes('rented') || norm.includes('نعم') || norm.includes('yes') || norm === '1' || norm === 'true') {
          rentalStatus = RentalStatus.RENTED;
        }
      }

      // Collect unmapped columns to customData to ensure complete alignment with import file ("الالتزام الكامل بالموجود فى ملف الاستراد")
      const customData: Record<string, any> = {};
      Object.entries(row).forEach(([colKey, colVal]) => {
        const isMappedKey = Object.values(mappings).includes(colKey);
        if (!isMappedKey && colKey && !colKey.startsWith('UnnamedColumn_') && !colKey.startsWith('براند_') && !colKey.startsWith('موديل_') && !colKey.startsWith('فئة_') && !colKey.startsWith('سنة_') && !colKey.startsWith('لون_')) {
          customData[colKey] = colVal !== undefined && colVal !== null ? colVal.toString().trim() : '';
        }
      });

      // Check validations strictly
      const lacksBrand = !finalBrand || finalBrand === '' || finalBrand === 'غير محدد' || finalBrand === '-' || finalBrand === '--';
      const lacksVin = !finalVinClean || finalVinClean === '';

      if (lacksBrand) {
        errors.push("اسم المركبة / السيارة مفقود في ملف Excel الأصلي وهو حقل إجباري");
      }
      if (lacksVin) {
        errors.push("رقم الهيكل (VIN) مفقود في ملف Excel الأصلي وهو حقل إجباري");
      } else {
        if (finalVinClean.length !== 17) {
          warnings.push("رقم الهيكل ليس بالطول القياسي المعتمد (17 حرفاً)");
        }
      }

      // Strict status assignment purely from status mapping or direct fallback to AVAILABLE
      let status = CarStatus.AVAILABLE;
      const statusRaw = mappings.status ? row[mappings.status]?.toString().trim() : '';
      
      if (statusRaw) {
        const norm = statusRaw.toLowerCase();
        if (
          norm.includes('لم تصل') || 
          norm.includes('طريق') || 
          norm.includes('شحن') || 
          norm.includes('وصول') ||
          norm.includes('transit') || 
          norm.includes('dispatched') || 
          norm.includes('en route') || 
          norm.includes('not arrived') || 
          norm.includes('not in showroom') || 
          norm.includes('not in showroom yet') || 
          norm.includes('coming soon') ||
          norm.includes('قادمة') ||
          norm.includes('ستصل')
        ) {
          status = CarStatus.NOT_ARRIVED;
          warnings.push("ملاحظة تحليل ذكي: رصد كلمات تفيد بأن المركبة لم تصل صالة المعرض. تم منحها تلقائياً حالة (لم تصل بعد - NOT_ARRIVED). تقع هذه المركبة رسمياً خارج صالة العرض الكبرى والمخزون المادي الملموس للمستودع حالياً.");
        } else if (
          norm.includes('مرتجع') || 
          norm.includes('مرتجعة') || 
          norm.includes('تم ردها') || 
          norm.includes('مستردة') ||
          norm.includes('برقية رد') ||
          norm.includes('رد المعرض') ||
          norm.includes('returned') || 
          norm.includes('repossessed') || 
          norm.includes('refunded')
        ) {
          status = CarStatus.RETURNED;
          warnings.push("تم اكتشاف حالة السيارة تلقائياً: (مرتجعة للمعرض) بناءً على الكلمات المفتاحية في الصف");
        } else if (
          norm.includes('مباع') || 
          norm.includes('مباعة') || 
          norm.includes('مباعه') || 
          norm.includes('sold') || 
          norm.includes('تم البيع') || 
          norm.includes(' بيع') ||
          norm.includes('بيعت') ||
          norm.includes('تم بيعها')
        ) {
          status = CarStatus.SOLD;
          warnings.push("تم اكتشاف حالة السيارة تلقائياً: (مباعة) بناءً على الكلمات المفتاحية في الصف");
        } else if (
          norm.includes('محجوز') || 
          norm.includes('محجوزة') || 
          norm.includes('محجوزه') || 
          norm.includes('reserved') || 
          norm.includes('حجز')
        ) {
          status = CarStatus.RESERVED;
          warnings.push("تم اكتشاف حالة السيارة تلقائياً: (محجوزة) بناءً على الكلمات المفتاحية في الصف");
        } else {
          // Fallback checking exact values
          const matchedEnum = Object.values(CarStatus).find(val => val.toLowerCase() === norm);
          if (matchedEnum) {
            status = matchedEnum;
          } else {
            status = CarStatus.AVAILABLE;
          }
        }
      } else {
        // Fallback when status column is not mapped
        status = CarStatus.AVAILABLE;
      }

      // If isPresentInShowroom is false, we should warn if status doesn't align
      if (!isPresentInShowroom && status !== CarStatus.NOT_ARRIVED && status !== CarStatus.SOLD) {
        status = CarStatus.NOT_ARRIVED;
        warnings.push("تنبيه ربط التواجد: المستند أشار لعدم تواجد السيارة بصالة المعرض، تم تعيين حالتها كـ (لم تصل بعد)");
      }

      const duplicateInSheet = lacksVin ? false : seenVinsInSheet.has(finalVinClean);
      if (finalVinClean && !duplicateInSheet && !lacksVin) {
        seenVinsInSheet.add(finalVinClean);
      }

      if (duplicateInSheet && finalVinClean) {
        errors.push(`رقم الهيكل مكرر داخل ملف الاستيراد نفسه (الصف مكرر لـ: ${finalVinClean}) لتجنب الازدواجية والتغذية الخاطئة للمخزن`);
      }

      // Check inside current imported sheet for Card Number duplicates
      const isCardValidForDup = isCardNumberValidForDuplicateCheck(cardNumber);
      const duplicateCardInSheet = isCardValidForDup ? sheetData.some((otherRow, otherIdx) => {
        if (otherIdx === index) return false;
        const otherCard = mappings.cardNumber ? otherRow[mappings.cardNumber]?.toString().trim() : '';
        return otherCard && isCardNumberValidForDuplicateCheck(otherCard) && cardNumber.trim() === otherCard.trim();
      }) : false;

      if (duplicateCardInSheet && isCardValidForDup) {
        errors.push(`رقم البطاقة الجمركية مكرر في نفس ملف الاستيراد (${cardNumber})`);
      }

      // Check inside database for VIN duplicates
      const isStatusActiveForDb = (status: string | undefined): boolean => {
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

      const duplicateVinInDb = (!lacksVin && finalVinClean)
        ? existingCars.some(c => String(c.vin || '').replace(/\s+/g, '').toUpperCase() === finalVinClean && isStatusActiveForDb(c.status))
        : false;

      // Check inside database for Card Number duplicates
      const duplicateCardInDb = isCardValidForDup ? existingCars.some(c => {
        return c.cardNumber && isCardNumberValidForDuplicateCheck(c.cardNumber) && String(c.cardNumber).trim() === String(cardNumber).trim();
      }) : false;

      // Handled intelligently based on Duplicate Mode
      let isDuplicateBlocker = false;
      if (duplicateInSheet) {
        isDuplicateBlocker = true;
      } else if (duplicateVinInDb) {
        if (duplicateMode === 'skip') {
          isDuplicateBlocker = true;
          errors.push(`رقم الهيكل موجود مسبقاً في قاعدة البيانات: تم تفعيل خيار تخطي السجلات والمكررات تلقائياً لحفظ أصالة المخزن`);
        } else if (duplicateMode === 'overwrite') {
          isDuplicateBlocker = false;
          warnings.push(`تنبيه تحديث متكرر: متواجد مسبقاً، سيتم دمج وتحديث كامل للمواصفات والأسعار بدقة بالغة`);
        }
      }

      if (duplicateCardInDb && !duplicateVinInDb) {
        warnings.push(`تنبيه: رقم البطاقة الجمركية (${cardNumber}) مدرج مسبقاً للوحة جمركية أخرى بالمعرض`);
      }

      const isValid = errors.length === 0;

      // Determine vinMatching strictly between 'متطابق' and 'غير متطابق'
      let vinMatching = 'متطابق';
      const rawVinMatching = mappings.vinMatching ? String(row[mappings.vinMatching] || '').trim() : '';
      if (rawVinMatching === 'غير مطابق' || rawVinMatching === 'غير متطابق' || rawVinMatching === 'mismatch' || rawVinMatching === 'غير_مطابق') {
        vinMatching = 'غير متطابق';
      } else {
        vinMatching = 'متطابق';
      }

      const hasPlate = !(!plateNumber || plateNumber === '-' || plateNumber === '');
      let plateData = undefined;
      if (hasPlate) {
        plateData = {
          plateNumber: plateNumber,
          ownerName: plateOwner || '',
          registrationDate: new Date().toISOString().split('T')[0]
        };
      }

      const hasExitData = !!(exitDateVal || receiverName || receiverId || receiverPhone || transportCompany || saleType || bankName || deliveryTypeRaw || exitNotes || seller || status === CarStatus.SOLD);
      let exitData = undefined;
      if (hasExitData) {
        // Safe extraction of bank name if saleType is combined like "عميل بنك (الراجحي)"
        let finalSaleType = saleType || '';
        let finalBankName = bankName || '';
        
        if (finalSaleType.includes('بنك') || finalSaleType.includes('البنك') || finalSaleType.startsWith('عميل بنك')) {
          if (!finalBankName) {
            if (finalSaleType.includes('(') && finalSaleType.includes(')')) {
              const match = finalSaleType.match(/\(([^)]+)\)/);
              if (match) {
                finalBankName = match[1].trim();
              }
            } else if (finalSaleType.startsWith('عميل بنك ')) {
              finalBankName = finalSaleType.substring(8).trim();
            } else if (finalSaleType.startsWith('عميل بنك')) {
              finalBankName = finalSaleType.substring(8).trim();
            } else if (finalSaleType.startsWith('بنك ')) {
              finalBankName = finalSaleType.substring(4).trim();
            } else {
              finalBankName = finalSaleType.replace('عميل بنك', '').replace('بنك', '').trim();
            }
          }
          finalSaleType = 'عميل بنك';
        }

        exitData = {
          exitDate: exitDateStr || new Date().toISOString().split('T')[0],
          receiverName: receiverName || '',
          receiverPhone: receiverPhone || '',
          receiverId: receiverId || '',
          deliveryType: deliveryType,
          transportCompany: transportCompany || '',
          saleType: finalSaleType,
          bankName: finalBankName,
          notes: exitNotes || '',
          seller: seller || '',
          representativeName: seller || '',
          carCondition: finalCarRemark || '',
          loggedAt: new Date().toISOString()
        };
      }

      // Log row results dynamically
      if (isValid && !isDuplicateBlocker) {
        logs.push(`✅ معالجة سليمة وقبول للصف المستند رقم [${originalIndex}]: السيارة "${finalBrand} ${finalModel || ''}" | الشاصي: (${finalVinClean}) | الحالة: [${status}] | التواجد: ${isPresentInShowroom ? "بالصالة" : "خارج الصالة"}`);
      } else if (isDuplicateBlocker) {
        logs.push(`🔂 تخطي الصف المستند رقم [${originalIndex}] (حماية مكرر): السيارة "${finalBrand} ${finalModel || ''}" | شاصي (${finalVinClean}) موجود بقاعدة البيانات.`);
      } else {
        logs.push(`❌ رفض واستبعاد الصف المستند رقم [${originalIndex}]: السيارة "${finalBrand || 'مجهولة'}" | الشاصي: "${finalVinClean || 'مفقود'}" | الأسباب: [${errors.join(' | ')}]`);
      }

      return {
        id,
        brand: finalBrand || 'مركبة مستوردة',
        model: finalModel || finalBrand || '-',
        year: finalYear,
        color: finalColor || '',
        vin: finalVinClean,
        cardNumber: cardNumber || '',
        price,
        costPrice,
        supplier: supplier || '',
        notes: notes || '',
        vinMatching: vinMatching,
        ownershipType: ownershipType,
        status: status,
        rentalStatus: rentalStatus,
        entryDate: entryDate,
        lastModified: new Date().toISOString(),
        isPresentInShowroom: isPresentInShowroom,
        attributionSource: finalAttributionSource ? finalAttributionSource : undefined,
        carRemark: finalCarRemark ? finalCarRemark : undefined,
        isOutbound: status === CarStatus.SOLD,
        hasPlate: hasPlate,
        plateData: plateData,
        seller: seller || '',
        exitData: exitData,
        history: [{ 
          id: `h-${Date.now()}`, 
          action: `استيراد متقدم منسق (الحالة: ${status}, المندوب: ${seller || 'غير محدد'}) بالتزامن ومطابقة الحقول بدقة وحفظ customData`, 
          timestamp: new Date().toISOString(), 
          user: currentUser?.username || 'نظام' 
        }],
        customData: customData,
        _originalRowIndex: originalIndex,
        _errors: errors,
        _warnings: warnings,
        _isValid: isValid,
        _lacksVin: lacksVin,
        _lacksBrand: lacksBrand,
        _isDuplicateInDb: duplicateVinInDb,
        _isDuplicateInSheet: duplicateInSheet,
        _isDuplicate: isDuplicateBlocker,
        _brandHeuristics: false,
        _modelHeuristics: false,
        _colorHeuristics: false,
        _yearHeuristics: false
      };
    });

    logs.push(`🏁 اكتمال التحليل الإجمالي: من أصل ${sheetData.length} صفوف، تم استخراج ${items.length} مركبة صالحة المعالجة برمجياً.`);
    logs.forEach(msg => console.log(`[CarImportWizard Diagnostic] ${msg}`));

    return { parsedItems: items, diagnosticLogs: logs };
  }, [sheetData, mappings, existingCars, duplicateMode, currentUser, debugSheetName, debugHeaderRowIdx, debugOriginalHeaders]);

  // Compute aggregate statistics
  const stats = useMemo(() => {
    // 1. عدد الصفوف المكتشفة بالملف
    const totalDetectedRows = sheetData.length;

    // 2. عدد المركبات التي تحتوي على رقم هيكل
    const valWithVinCount = parsedItems.filter(item => !item._lacksVin).length;

    // 3. عدد المركبات المستوردة المقبولة
    const insertedCount = parsedItems.filter(item => item._isValid).length;

    // 4. عدد المركبات المرفوضة (التي تحتوي على رقم هيكل ولكنها غير صالحة لسبب ما مثل غياب الاسم أو تكرار بالملف أو بالمستودع)
    const rejectedCount = parsedItems.filter(item => !item._isValid).length;

    // 5. عدد السجلات المكررة المستبعدة بنشاط
    const duplicateCount = parsedItems.filter(item => 
      !item._lacksVin && (item._isDuplicateInSheet || item._isDuplicateInDb)
    ).length;

    // 6. الحساب الدقيق للعدد الجاهز للاستيراد الفعلي
    const finalImportableCount = parsedItems.filter(item => {
      if (!item._isValid) return false;
      if (duplicateMode === 'skip' && (item._isDuplicateInDb || item._isDuplicateInSheet)) return false;
      return true;
    }).length;

    // Compatibility counters
    const total = parsedItems.length;
    const notArrivedCount = parsedItems.filter(item => 
      !item._lacksBrand && !item._lacksVin && item.status === CarStatus.NOT_ARRIVED
    ).length;
    const returnedCount = parsedItems.filter(item => 
      !item._lacksBrand && !item._lacksVin && item.status === CarStatus.RETURNED
    ).length;

    const hasAnyLacksVin = parsedItems.some(item => item._lacksVin);

    return {
      total,
      totalDetectedRows,
      valWithVinCount,
      insertedCount,
      rejectedCount,
      duplicateCount,
      validProcessedCount: valWithVinCount,
      toImportCount: finalImportableCount,
      notArrivedCount,
      returnedCount,
      hasAnyLacksVin
    };
  }, [parsedItems, sheetData, duplicateMode]);

  const filteredPreviewItems = useMemo(() => {
    return parsedItems.filter(item => {
      if (validationFilter === 'errors') {
        return !item._isValid || item._warnings.length > 0;
      }
      if (validationFilter === 'valid') {
        return item._isValid && item._warnings.length === 0;
      }
      if (validationFilter === 'duplicates') {
        return item._isDuplicateInDb || item._isDuplicateInSheet;
      }
      return true;
    });
  }, [parsedItems, validationFilter]);

  // Paginated list
  const paginatedPreviewItems = useMemo(() => {
    const start = (previewPage - 1) * PREVIEW_ITEMS_PER_PAGE;
    return filteredPreviewItems.slice(start, start + PREVIEW_ITEMS_PER_PAGE);
  }, [filteredPreviewItems, previewPage]);

  const handleNextStep = () => {
    if (step === 2) {
      // Ensure required mappings are present
      const brandMap = mappings.brand;
      const vinMap = mappings.vin;

      if (!brandMap || !vinMap) {
        setStep2ErrorBanner("يرجى تحديد أعمدة الربط الإلزامية لتغذية المركبات: (السيارة / المركبة، ورقم الهيكل) للمتابعة إلى المعاينة.");
        return;
      }

      setStep2ErrorBanner(null);

      // Auto-save on proceed
      try {
        localStorage.setItem('car_import_wizard_fields_config', JSON.stringify(orderedFields));
        localStorage.setItem('car_import_wizard_mappings', JSON.stringify(mappings));
      } catch (e) {
        console.error("Auto-save failed:", e);
      }

      setStep(3);
      setPreviewPage(1);
    }
  };

  const executeImport = async () => {
    if (isImporting) return;
    setImportError(null);

    const finalImportable = parsedItems.filter(item => {
      if (!item._isValid) return false;
      if (duplicateMode === 'skip' && (item._isDuplicateInDb || item._isDuplicateInSheet)) return false;
      return true;
    });

    if (finalImportable.length === 0) {
      alert("لا توجد سجلات مستوفاة وخالية من الأخطاء قابلة للاستيراد حالياً.");
      return;
    }

    try {
      setIsImporting(true);
      await onImportComplete(finalImportable, duplicateMode);
    } catch (err: any) {
      console.error('Error during executeImport:', err);
      setImportError(err?.message || 'حدث خطأ أثناء الاتصال بقاعدة البيانات وحفظ المركبات المستوردة.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto overscroll-contain" dir="rtl">
      <div className="bg-white dark:bg-slate-950 rounded-2xl sm:rounded-[2.5rem] w-full max-w-6xl shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col max-h-[92vh] sm:max-h-[90vh] my-auto overflow-hidden">
        
        {/* Header toolbar */}
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/10 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-3 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl sm:rounded-2xl">
              <Settings2 size={20} className="sm:w-5 sm:h-5 animate-spin-slow" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 dark:text-white text-base sm:text-lg">بوابة الاستيراد الذكي وربط البيانات الهيكلية</h3>
              <p className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500 font-bold mt-0.5">استيراد وقراءة ملفات Excel/CSV مع تحديد وتطابق الحقول الحية بشكل احترافي وديناميكي</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 sm:p-3 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stepper Wizard Indicator */}
        <div className="px-3 sm:px-8 py-3 sm:py-5 bg-slate-50 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-2 sm:gap-4 shrink-0 overflow-x-auto">
          <div className="flex items-center gap-3 sm:gap-6 md:gap-12 w-full max-w-3xl mx-auto min-w-[280px]">
            
            {/* Step 1 */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 flex-1 relative">
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-black text-xs transition-all shrink-0 ${
                step >= 1 ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'bg-slate-100 dark:bg-slate-900 text-slate-400'
              }`}>
                {step > 1 ? <Check size={14} className="stroke-[3]" /> : '1'}
              </div>
              <div className="text-right">
                <span className={`block text-[11px] sm:text-xs font-black ${step >= 1 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>رفع الملف</span>
                <span className="text-[9px] sm:text-[10px] text-slate-400 hidden md:block">اختيار وقراءة ملف المستند</span>
              </div>
              <div className={`h-[2px] flex-1 mr-2 sm:mr-4 rounded-full ${step > 1 ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-800'}`} />
            </div>

            {/* Step 2 */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 flex-1 relative">
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-black text-xs transition-all shrink-0 ${
                step >= 2 ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'bg-slate-100 dark:bg-slate-900 text-slate-400'
              }`}>
                {step > 2 ? <Check size={14} className="stroke-[3]" /> : '2'}
              </div>
              <div className="text-right">
                <span className={`block text-[11px] sm:text-xs font-black ${step >= 2 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>ربط الأعمدة</span>
                <span className="text-[9px] sm:text-[10px] text-slate-400 hidden md:block">ملاءمة حقول الاستيراد</span>
              </div>
              <div className={`h-[2px] flex-1 mr-2 sm:mr-4 rounded-full ${step > 2 ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-800'}`} />
            </div>

            {/* Step 3 */}
            <div className="flex items-center gap-1.5 sm:gap-2.5">
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-black text-xs transition-all shrink-0 ${
                step === 3 ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'bg-slate-100 dark:bg-slate-900 text-slate-400'
              }`}>
                3
              </div>
              <div className="text-right">
                <span className={`block text-[11px] sm:text-xs font-black ${step === 3 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>المراجعة</span>
                <span className="text-[9px] sm:text-[10px] text-slate-400 hidden md:block">تدقيق وحفظ السجلات</span>
              </div>
            </div>

          </div>
        </div>

        {/* Wizard Main Panel Body Content */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
          
          {step === 1 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="max-w-xl mx-auto py-12 space-y-8"
            >
              <div className="text-center space-y-2">
                <div className="mx-auto w-16 h-16 bg-blue-50 dark:bg-blue-500/10 text-blue-500 rounded-3xl flex items-center justify-center">
                  <FileSpreadsheet size={32} />
                </div>
                <h4 className="font-extrabold text-slate-800 dark:text-white text-base">تحميل ملف استيراد المركبات</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">يدعم النظام ملفات مخرجات جداول البيانات بصيغ Excel (.xlsx, .xls) والملفات المفصولة بفواصل (.csv)</p>
              </div>

              {/* Drag Area */}
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-3 border-dashed rounded-[2rem] p-10 text-center cursor-pointer transition-all space-y-4 relative overflow-hidden ${
                  isDragging 
                    ? 'border-blue-500 bg-blue-500/5 scale-98' 
                    : 'border-slate-200 hover:border-blue-400 dark:border-slate-800 dark:hover:border-slate-700 bg-slate-50/30 dark:bg-slate-900/20'
                }`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".xlsx,.xls,.csv" 
                  onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])} 
                />
                
                <div className="mx-auto w-16 h-16 bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-500 rounded-2xl flex items-center justify-center group-hover:bg-blue-100 group-hover:text-blue-500 transition-colors">
                  <Upload size={24} className="stroke-[2.5]" />
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-black text-slate-700 dark:text-slate-200">اسحب وأفلت الملف هنا بأي مكان بالفراغ</p>
                  <p className="text-xs text-slate-400">أو انقر لتصفح ملفات جهاز الكمبيوتر الخاص بك</p>
                </div>
                
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-900 text-slate-500 rounded-lg text-[10px] font-bold">
                  <Info size={12} />
                  <span>تلميح فني: سيسعى النظام للتعرف على حقول الماركات والموديلات وهياكل السيارات فوراً وعرضها عليك لمراجعتها.</span>
                </div>
              </div>

              {/* Sample sheet download / instructions helper list */}
              <div className="p-5 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
                <h5 className="font-bold text-slate-800 dark:text-white text-xs flex items-center gap-1.5">
                  <HelpCircle size={14} className="text-blue-500" />
                  تعليمات وضمانات سلامة الاستيراد الفنية:
                </h5>
                <ul className="text-[11px] text-slate-500 dark:text-slate-400 list-disc pr-4 space-y-1.5 leading-relaxed">
                  <li>تجنب وجود دمج للخانات أو حقول فارغة تماماً برأس الجدول بملف البيانات.</li>
                  <li>رقم الهيكل (VIN) يعتبر المعرّف الحصري الفريد لكل مركبة، احرص على دقته.</li>
                  <li>حتى وإن كانت أسماء الأعمدة مغايرة بملفك، ستتمكن بالخطوة التالية من مطابقتها يدوياً بمنتهى السهولة.</li>
                </ul>
              </div>

            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="space-y-6"
            >
              {/* Top Banner info */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-blue-500/5 border border-blue-500/10 rounded-2xl text-xs">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <FileText className="text-blue-500" size={18} />
                  <span>اسم الملف الذكي النشط: <strong className="text-blue-600 dark:text-blue-400">{file?.name}</strong></span>
                  <span className="text-slate-300">|</span>
                  <span>صفوف البيانات المستخرجة: <strong className="text-slate-800 dark:text-white">{sheetData.length} سجل</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-extrabold">
                  <Sliders size={14} />
                  <span>التعرف التلقائي المبرمج نشط وجاهز</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left Form: Field list mapping */}
                <div className="lg:col-span-8 space-y-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <h4 className="font-black text-xs text-slate-800 dark:text-white flex items-center gap-2">
                        <Columns size={16} className="text-blue-500" />
                        ربط وإعداد أعمدة ملف الاستيراد
                      </h4>
                      <p className="text-[10px] text-slate-400 font-bold">يمكنك تحديد الأعمدة المطلوبة، ترتيبها، أو كتم حقول بالكامل وحفظ الإعدادات</p>
                    </div>
                    
                    <button
                      type="button"
                      onClick={saveImportSettings}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-md transition-all self-end sm:self-auto shrink-0"
                    >
                      <Settings2 size={14} />
                      حفظ هذه الإعدادات بشكل دائم
                    </button>
                  </div>

                  {showSaveSuccess && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      className="p-4 bg-emerald-55/10 dark:bg-emerald-950/20 border border-emerald-500/30 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-600 dark:text-emerald-400 font-black animate-fade-in"
                    >
                      <CheckCircle size={18} className="text-emerald-500 shrink-0" />
                      <span>تم حفظ ترتيب الأعمدة، الحقول المستبعدة والمطابقات الحالية بشكل دائم بنجاح! ✨</span>
                    </motion.div>
                  )}

                  <div className="space-y-3.5 bg-white dark:bg-slate-900/10 p-1.5 rounded-2xl border border-dashed border-slate-100 dark:border-slate-800">
                    {orderedFields.map((field, idx) => {
                      const isMapped = !!mappings[field.key];
                      const selectedVal = mappings[field.key] || "";

                      return (
                        <div 
                          key={field.key} 
                          className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                            !field.enabled
                              ? 'bg-slate-50/40 dark:bg-slate-950/20 border-slate-200/40 dark:border-slate-800/40 opacity-50'
                              : isMapped 
                                ? 'bg-emerald-500/5 border-emerald-500/20 dark:border-emerald-500/10' 
                                : field.required
                                  ? 'bg-rose-500/5 border-rose-500/20 dark:border-rose-500/10'
                                  : 'bg-slate-50/50 dark:bg-slate-950/20 border-slate-200/60 dark:border-slate-800/60'
                          }`}
                        >
                          <div className="flex items-start sm:items-center gap-3">
                            {/* Checkbox selector to Include / Exclude (المختارة والمستبعدة) */}
                            <input 
                              type="checkbox"
                              checked={field.enabled}
                              disabled={field.required}
                              onChange={() => toggleFieldEnabled(field.key)}
                              className="mt-1 sm:mt-0 w-4 h-4 text-blue-600 border-slate-200 rounded focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
                              title={field.required ? "هذا الحقل إلزامي وهيكلي للنظام ولا يمكن كتم استيراده" : "استبعاد هذا الحقل من عملية الاستيراد"}
                            />

                            {/* Up/Down controls to Reorder field (ترتيب الأعمدة) */}
                            <div className="flex flex-col gap-0.5 pointer-events-auto">
                              <button
                                type="button"
                                onClick={() => moveField(idx, 'up')}
                                disabled={idx === 0}
                                className="p-0.5 rounded text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-20"
                                title="تحريك للأعلى (تغيير الترتيب)"
                              >
                                <ChevronUp size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveField(idx, 'down')}
                                disabled={idx === orderedFields.length - 1}
                                className="p-0.5 rounded text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-20"
                                title="تحريك للأسفل (تغيير الترتيب)"
                              >
                                <ChevronDown size={13} />
                              </button>
                            </div>

                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200">{field.label}</span>
                                {field.required && (
                                  <span className="text-[10px] bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400 font-black px-2 py-0.5 rounded">إلزامي</span>
                                )}
                                {!field.enabled && (
                                  <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-black px-2 py-0.5 rounded">مستبعد</span>
                                )}
                                {field.enabled && isMapped && (
                                  <span className="flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 font-black px-2 py-0.5 rounded">
                                    <CheckCircle size={10} /> تم الربط
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal max-w-sm">{field.description}</p>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <select
                              value={selectedVal}
                              disabled={!field.enabled}
                              onChange={(e) => {
                                const val = e.target.value;
                                setMappings({
                                  ...mappings,
                                  [field.key]: val
                                });
                              }}
                              className={`text-xs font-bold rounded-xl px-4 py-2.5 outline-none transition-all w-60 border ${
                                !field.enabled
                                  ? 'bg-slate-100 dark:bg-slate-900/40 border-slate-200/40 text-slate-400 cursor-not-allowed'
                                  : isMapped 
                                    ? 'bg-white dark:bg-slate-900 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 focus:border-emerald-500' 
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 focus:border-blue-500'
                              }`}
                            >
                              <option value="">{field.enabled ? "-- تخطي وتجاهل هذا الحقل --" : "-- الحقل مستبعد حالياً --"}</option>
                              {headers.map((h, idx) => (
                                <option key={idx} value={h}>{h}</option>
                              ))}
                            </select>
                            {field.enabled && isMapped && sheetData[0] && sheetData[0][selectedVal] !== undefined && sheetData[0][selectedVal] !== null && (
                              <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold font-mono pl-1 max-w-[240px] truncate text-left direction-ltr">
                                عينة القيمة الأولية: "{sheetData[0][selectedVal]?.toString().substring(0, 30)}"
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Panel: Auto detection reports and manual tweaks */}
                <div className="lg:col-span-4 space-y-6">
                  
                  {/* Matching accuracy feedback */}
                  <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-3xl space-y-4">
                    <h5 className="font-black text-slate-800 dark:text-white text-xs flex items-center gap-2">
                      <Sliders className="text-blue-500" size={16} />
                      نظام قراءة وتحليل الحقول
                    </h5>

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      يقوم نظام المطابقة الآلي بعمل تقاطعات لغوية للاستدلال على الأعمدة ومكافئاتها تلقائياً لتسهيل الاستيراد السريع.
                    </p>

                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between text-xs border-b border-dashed border-slate-200 dark:border-slate-800 pb-2">
                        <span className="text-slate-400 font-bold">الحقول الهيكلية المتاحة:</span>
                        <span className="font-black text-slate-800 dark:text-white">
                          {orderedFields.filter(f => f.enabled).length} من {orderedFields.length} حقل
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs border-b border-dashed border-slate-200 dark:border-slate-800 pb-2">
                        <span className="text-slate-400 font-bold">تم ربطها تلقائياً بالملف:</span>
                        <span className="font-black text-blue-600 dark:text-blue-400">
                          {Object.keys(mappings).filter(k => !!mappings[k]).length} حقل
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs pb-1">
                        <span className="text-slate-400 font-bold">الحقول الإلزامية الناقصة:</span>
                        <span className={`font-black ${
                          orderedFields.filter(f => f.required && !mappings[f.key]).length > 0 
                            ? 'text-rose-500' 
                            : 'text-emerald-500'
                        }`}>
                          {orderedFields.filter(f => f.required && !mappings[f.key]).length === 0 
                            ? 'مستوفاة بالكامل ✨' 
                            : orderedFields.filter(f => f.required && !mappings[f.key]).length
                          }
                        </span>
                      </div>
                    </div>

                    {orderedFields.filter(f => f.required && !mappings[f.key]).length > 0 && (
                      <div className="p-3.5 bg-rose-50 dark:bg-rose-950/20 text-rose-500 rounded-xl text-[11px] font-bold leading-normal flex items-start gap-2 border border-rose-500/10">
                        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                        <span>يرجى ربط الحقول الإلزامية المتبقية لترقية وحفظ البيانات بالخطوة التالية.</span>
                      </div>
                    )}
                  </div>

                  {/* Duplicate Mode selector */}
                  <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-3xl space-y-4">
                    <h5 className="font-black text-slate-800 dark:text-white text-xs flex items-center gap-2">
                      <Database className="text-indigo-500" size={16} />
                      سياسة تكرار أرقام الهيكل (VIN)
                    </h5>

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      سعر المعرف (رقم الهيكل) فريد وقاطع، كيف ترغب بمعالجة وجود مركبات متطابقة بالهيكل سابقاً؟
                    </p>

                    <div className="space-y-2.5 pt-2">
                      <label className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                        duplicateMode === 'skip'
                          ? 'bg-white dark:bg-slate-900 border-blue-500 text-blue-600'
                          : 'border-slate-100 dark:border-slate-800 text-slate-400 hover:bg-white/40 dark:hover:bg-slate-900/30'
                      }`}>
                        <input
                          type="radio"
                          name="dupMode"
                          checked={duplicateMode === 'skip'}
                          onChange={() => setDuplicateMode('skip')}
                          className="mt-0.5 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="space-y-0.5">
                          <span className="block text-xs font-black text-slate-800 dark:text-slate-100">تخطي المكرر (Skip) - آمن جداً</span>
                          <span className="block text-[10px] text-slate-400 leading-normal">تجاهل المركبة القادمة إن كان رقم الهيكل مدرج مسبقاً بقاعدة البيانات</span>
                        </div>
                      </label>

                      <label className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                        duplicateMode === 'overwrite'
                          ? 'bg-white dark:bg-slate-900 border-amber-500 text-amber-600'
                          : 'border-slate-100 dark:border-slate-800 text-slate-400 hover:bg-white/40 dark:hover:bg-slate-900/30'
                      }`}>
                        <input
                          type="radio"
                          name="dupMode"
                          checked={duplicateMode === 'overwrite'}
                          onChange={() => setDuplicateMode('overwrite')}
                          className="mt-0.5 text-amber-600 focus:ring-amber-500"
                        />
                        <div className="space-y-0.5">
                          <span className="block text-xs font-black text-slate-800 dark:text-slate-100">استبدال وتحديث السجل (Overwrite)</span>
                          <span className="block text-[10px] text-slate-400 leading-normal">تحديث وتعديل قيم المركبة الحالية بالبيانات والأسعار الجديدة القادمة بالكامل</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* بوابة التشخيص المتقدم وتدقيق توافق الأعمدة (Debug Mode) */}
                  <div className="bg-slate-900 border border-slate-850 rounded-[2rem] p-6 text-white space-y-4 shadow-xl">
                    <div className="flex items-center justify-between">
                      <h4 className="font-black text-xs flex items-center gap-2 text-blue-400">
                        <CheckCircle2 size={16} className="animate-pulse" />
                        بوابة التشخيص المتقدم (Debug Mode)
                      </h4>
                      <span className="text-[9px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-black">نشط ومراقب</span>
                    </div>
                    
                    <div className="space-y-2.5 text-[11px] text-slate-300">
                      <div className="flex justify-between items-center bg-slate-800/40 p-2.5 rounded-xl border border-slate-800/30">
                        <span className="text-slate-400 font-bold">الورقة النشطة المختارة:</span>
                        <strong className="text-white font-mono">{debugSheetName || "يرجى رفع ملف"}</strong>
                      </div>
                      <div className="flex justify-between items-center bg-slate-803/40 p-2.5 rounded-xl border border-slate-800/30">
                        <span className="text-slate-400 font-bold">إجمالي أوراق الملف:</span>
                        <strong className="text-white font-mono">{debugAllSheetNames.length > 0 ? `${debugAllSheetNames.length} (${debugAllSheetNames.join(', ')})` : '0'}</strong>
                      </div>
                      <div className="flex justify-between items-center bg-slate-800/40 p-2.5 rounded-xl border border-slate-800/30">
                        <span className="text-slate-400 font-bold">الصفوف المقروءة بالكامل:</span>
                        <strong className="text-blue-400 font-mono font-black">{debugTotalRawRows} صف</strong>
                      </div>
                      <div className="flex justify-between items-center bg-slate-800/40 p-2.5 rounded-xl border border-slate-800/30">
                        <span className="text-slate-400 font-bold">صف العناوين المعتمد:</span>
                        <strong className="text-white font-mono">الصف رقم {debugHeaderRowIdx + 1}</strong>
                      </div>
                      <div className="flex justify-between items-center bg-slate-800/40 p-2.5 rounded-xl border border-slate-800/30">
                        <span className="text-slate-400 font-bold">سجلات مستوردة مقبولة:</span>
                        <strong className="text-emerald-400 font-mono font-black">{stats.insertedCount} سجل</strong>
                      </div>
                      <div className="flex justify-between items-center bg-slate-800/40 p-2.5 rounded-xl border border-slate-800/30">
                        <span className="text-slate-400 font-bold">سجلات مرفوضة:</span>
                        <strong className="text-rose-400 font-mono font-black">{stats.rejectedCount} سجل</strong>
                      </div>
                      <div className="flex justify-between items-center bg-slate-800/40 p-2.5 rounded-xl border border-slate-800/30">
                        <span className="text-slate-400 font-bold">سجلات مكررة مستبعدة:</span>
                        <strong className="text-amber-400 font-mono font-black">{stats.duplicateCount} سجل</strong>
                      </div>
                    </div>

                    {/* الأعمدة المكتشفة بالملف */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-slate-400 font-bold block">العناوين المكتشفة فعلياً بالملف ({headers.length}):</span>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                        {headers.map((h, i) => (
                          <span key={i} className="text-[9px] bg-slate-900 text-slate-300 px-2 py-0.5 rounded font-mono border border-slate-800/60">{h}</span>
                        ))}
                      </div>
                    </div>

                    {/* مقارنة الأعمدة المصدرة مع المطلوبة */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-slate-400 font-bold block">مقارنة التوافق والمطابقة مع نظام الاستيراد:</span>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[10px]">
                        {orderedFields.map(f => {
                          const isMatched = !!mappings[f.key];
                          const matchedHeader = mappings[f.key];
                          return (
                            <div key={f.key} className="flex justify-between items-center border-b border-slate-900 pb-1.5 last:border-0 last:pb-0">
                              <span className={`font-bold ${f.required ? 'text-rose-400' : 'text-slate-350'}`}>
                                {f.label} {f.required ? '*' : ''}
                              </span>
                              {isMatched ? (
                                <span className="text-emerald-400 font-mono text-left bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/25">
                                  مربوط ➔ {matchedHeader}
                                </span>
                              ) : (
                                <span className={`px-1.5 py-0.5 rounded border text-[9px] ${f.required ? 'bg-rose-500/15 text-rose-400 border-rose-500/25 font-black' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>
                                  {f.required ? 'غير متطابق (ناقص) ⚠️' : 'غير مربوط'}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* تقرير سجل الرفض والتحذيرات */}
                    {stats.rejectedCount > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] text-rose-400 font-bold block">تقرير السجلات المرفوضة وأسباب الرفض بالتفصيل:</span>
                        <div className="space-y-2 max-h-40 overflow-y-auto bg-slate-950 p-2 rounded-xl border border-rose-950/40 text-[9.5px]">
                          {parsedItems.filter(item => item._lacksBrand || item._lacksVin).map((item, i) => (
                            <div key={i} className="p-2 bg-rose-500/5 border border-rose-500/25 rounded-lg space-y-1">
                              <div className="flex justify-between items-center font-bold text-rose-350">
                                <span>السجل رقم {item._originalRowIndex}</span>
                                <span className="text-rose-400">مرفوض ⛔</span>
                              </div>
                              <div className="text-slate-300 leading-normal">
                                {item._errors && item._errors.length > 0 ? (
                                  <ul className="list-disc pr-3 space-y-0.5 text-[8.5px]">
                                    {item._errors.map((e: string, idx: number) => <li key={idx} className="text-rose-350">{e}</li>)}
                                  </ul>
                                ) : (
                                  <span className="text-slate-405">سبب الرفض: مفقود رقم الهيكل أو السيارة كحقل إلزامي</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                </div>

              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="space-y-6"
            >
              
              {/* Aggregate Status Statistics Widgets in STRICT DATA MODE */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                  
                  <div className="p-5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 rounded-2xl text-right">
                    <span className="text-[10px] text-slate-400 font-bold block">عدد الصفوف المكتشفة</span>
                    <span className="text-2xl font-black text-slate-800 dark:text-white leading-none mt-1 block">{stats.totalDetectedRows}</span>
                  </div>

                  <div className="p-5 bg-sky-50/50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/50 rounded-2xl text-right">
                    <span className="text-[10px] text-slate-400 font-bold block">عدد المركبات التي تحتوي على رقم هيكل</span>
                    <span className="text-2xl font-black text-sky-600 dark:text-sky-400 leading-none mt-1 block">{stats.valWithVinCount}</span>
                  </div>

                  <div className="p-5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl text-right">
                    <span className="text-[10px] text-slate-400 font-bold block">عدد المركبات المستوردة</span>
                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 leading-none mt-1 block">{stats.insertedCount}</span>
                  </div>

                  <div className="p-5 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 rounded-2xl text-right">
                    <span className="text-[10px] text-slate-400 font-bold block">عدد المركبات المرفوضة</span>
                    <span className="text-2xl font-black text-rose-600 dark:text-rose-400 leading-none mt-1 block">{stats.rejectedCount}</span>
                  </div>

                  <div className="p-5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50 rounded-2xl text-right">
                    <span className="text-[10px] text-slate-400 font-bold block">المكررة المستبعدة مسبقاً</span>
                    <span className="text-2xl font-black text-amber-600 dark:text-amber-400 leading-none mt-1 block">{stats.duplicateCount}</span>
                  </div>

                </div>

                {/* Sub-Classification: Detailing status categories like returned or not arrived yet! */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-purple-50/40 dark:bg-purple-950/10 border border-purple-100/85 dark:border-purple-900/35 rounded-2xl text-right">
                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-black block">⌛ سيارات تحت الوصول / لم تصل بعد</span>
                    <span className="text-xl font-black text-purple-700 dark:text-purple-300 leading-none mt-1 block">{stats.notArrivedCount} سيارة</span>
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1">المستند يحدد أنها خارج المخزون الفعلي حالياً</p>
                  </div>

                  <div className="p-4 bg-orange-50/40 dark:bg-orange-950/10 border border-orange-100/85 dark:border-orange-900/35 rounded-2xl text-right">
                    <span className="text-[10px] text-orange-600 dark:text-orange-400 font-black block">↩️ سيارات مرتجعة / تم ردها للمعرض</span>
                    <span className="text-xl font-black text-orange-700 dark:text-orange-300 leading-none mt-1 block">{stats.returnedCount} سيارة</span>
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1">المستند يوضح أنها مستردة أو مرتجع</p>
                  </div>

                  <div className="p-4 bg-teal-50/40 dark:bg-teal-950/10 border border-teal-100/85 dark:border-teal-900/35 rounded-2xl text-right">
                    <span className="text-[10px] text-teal-600 dark:text-teal-400 font-black block">✓ متوفرة بالمستودع الفعلي</span>
                    <span className="text-xl font-black text-teal-700 dark:text-teal-300 leading-none mt-1 block">
                      {parsedItems.filter(item => !item._lacksBrand && !item._lacksVin && item.status === CarStatus.AVAILABLE).length} سيارة
                    </span>
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1">سيارات معالجة بحالة متوفرة بالمستودع</p>
                  </div>

                  <div className="p-4 bg-slate-50/50 dark:bg-slate-900/10 border border-slate-100/85 dark:border-slate-800/80 rounded-2xl text-right">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-black block">✉ محجوزة أو مباعة</span>
                    <span className="text-xl font-black text-slate-700 dark:text-slate-300 leading-none mt-1 block">
                      {parsedItems.filter(item => !item._lacksBrand && !item._lacksVin && (item.status === CarStatus.RESERVED || item.status === CarStatus.SOLD)).length} سيارة
                    </span>
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1">سيارات حُجزت مسبقاً أو بيعت بالمستند</p>
                  </div>
                </div>
              </div>

              {/* Strict Data Integrity Alert: Blocked Import due to missing VIN */}
              {parsedItems.some(item => item._lacksVin) && (
                <div className="bg-gradient-to-r from-rose-50 via-red-50 to-rose-50 dark:from-rose-950/20 dark:via-red-950/15 dark:to-rose-950/20 border-2 border-rose-200 dark:border-rose-900/40 rounded-[2rem] p-6 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-lg shrink-0">
                      <AlertTriangle size={24} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-rose-950 dark:text-rose-300">
                        🚫 حظر الاستيراد التام: سياسة صارمة لحفظ البيانات بموجب رقم الهيكل (الشاصي)
                      </h4>
                      <p className="text-xs text-rose-750 dark:text-rose-400 font-bold mt-1.5 leading-relaxed">
                        يحتوي هذا الملف على صفوف مفقود بها <strong>رقم الهيكل (رقم الشاصي / VIN)</strong>. بموجب السياسة الصارمة للمستودع ودقة التقارير الفنية، <strong>تم تعطيل وحظر عملية الاستيراد بالكامل لحين التصحيح</strong>.
                      </p>
                      <div className="bg-white/80 dark:bg-slate-950/40 border border-rose-100/40 rounded-xl p-3 mt-4 text-[11px] font-bold text-slate-650 dark:text-slate-400 space-y-1">
                        <p className="flex items-center gap-1.5 text-rose-800 dark:text-rose-400">
                          <span>📌</span> لا يُسمح برفع أو دمج أي بيانات في المخزن ما لم تكن مستوفية لرقم الهيكل بالكامل لضمان الدقة والنزاهة الرقمية للمركبات.
                        </p>
                        <p className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                          <span>💡</span> يرجى فتح ملف الإكسيل، تعبئة أرقام الهيكل الناقصة للسيارات، أو حذف الصفوف الزائدة، ثم إعادة المحاولة والرفع من جديد.
                        </p>
                        <p className="text-rose-600 dark:text-rose-400 font-black mt-2">
                          ❌ الأسطر المتأثرة الناقصة حالياً: {parsedItems.filter(item => item._lacksVin).map(item => `الصف ${item._originalRowIndex}`).join('، ')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Intelligent Alert Banner for NOT_ARRIVED status vehicles */}
              {stats.notArrivedCount > 0 && (
                <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 dark:from-purple-950/20 dark:via-indigo-950/15 dark:to-purple-950/20 border-2 border-purple-200 dark:border-purple-900/40 rounded-[2rem] p-6 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-lg shrink-0">
                      <Clock size={24} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-purple-950 dark:text-purple-300">
                        تنبيه ذكي: رصد مركبات تقع خارج صالة العرض الكبرى والمخزون الفعلي المادي ⚠️
                      </h4>
                      <p className="text-xs text-purple-700 dark:text-purple-400 font-bold mt-1.5 leading-relaxed">
                        تم رصد عدد <span className="text-sm font-black text-purple-600 dark:text-purple-300">({stats.notArrivedCount})</span> من المركبات في ملف الاستيراد تحتوي على عبارات تفيد بأنها <strong>"لم تصل بعد"</strong>، <strong>"ليست بالمعرض"</strong> أو <strong>"خارج المعرض"</strong>.
                      </p>
                      <div className="bg-white/80 dark:bg-slate-950/40 border border-purple-100/40 rounded-xl p-3 mt-4 text-[11px] font-bold text-slate-650 dark:text-slate-400 space-y-1">
                        <p className="flex items-center gap-1.5 text-purple-800 dark:text-purple-400">
                          <span>💡</span> تم تلقائياً منحها الحالة الرسمية <strong>(لم تصل بعد - NOT_ARRIVED)</strong> لضمان فصل مالي وبصري تام.
                        </p>
                        <p className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                          <span>📌</span> يرجى العلم بأن هذه المركبات تقع رسمياً خارج صالة العرض الكبرى والمخزون المادي الملموس للمستودع حالياً، وسيتم الاحتفاظ بها في حصر تتبع مستقل حتى تأكيد وصولها الفعلي.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Technical Diagnostics Log Panel */}
              <div className="bg-slate-900 border border-slate-800/80 rounded-[2rem] overflow-hidden shadow-xl" dir="rtl">
                <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">🛠️</span>
                    <div>
                      <h4 className="text-sm font-black text-white">بوابة المراقبة الفنية وسجل تتبع الاستيراد (Real-time Diagnostic Log Engine)</h4>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">تتبع فوري لمراحل قراءة الملف وتفنيد أسباب استقطاع البيانات واستبعاد الأسطر</p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-slate-800 text-slate-300 font-black px-2.5 py-1 rounded-md">
                    مستند بـ {diagnosticLogs.length} سجل تتبع مفصل
                  </span>
                </div>
                <div className="p-5 bg-slate-950/80 max-h-[220px] overflow-y-auto font-mono text-[11px] leading-relaxed text-slate-300 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800">
                  {diagnosticLogs.map((log, lIdx) => {
                    let textClass = "text-slate-300";
                    if (log.startsWith("✅")) textClass = "text-emerald-400 font-bold";
                    else if (log.startsWith("❌")) textClass = "text-rose-400 font-bold";
                    else if (log.startsWith("⚠️")) textClass = "text-amber-400";
                    else if (log.startsWith("🔍") || log.startsWith("🔗")) textClass = "text-blue-400 font-black";
                    else if (log.startsWith("📋")) textClass = "text-purple-400 font-black";
                    else if (log.includes("عينة صف خام")) textClass = "text-slate-500 italic";
                    
                    return (
                      <div key={lIdx} className={`py-1 px-2.5 rounded-lg hover:bg-slate-900/50 transition-colors flex items-start gap-1 ${textClass}`}>
                        <span className="shrink-0 text-slate-600 select-none">[{lIdx + 1}]</span>
                        <span className="whitespace-pre-wrap">{log}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Filtering & Preview block */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Eye size={16} className="text-blue-500" />
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">معاينة وتدقيق البيانات المستخرجة:</span>
                  </div>

                  {/* Filter Badges */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setValidationFilter('all'); setPreviewPage(1); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        validationFilter === 'all' 
                          ? 'bg-blue-600 text-white shadow' 
                          : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      عرض الكل ({parsedItems.length})
                    </button>
                    <button
                      onClick={() => { setValidationFilter('valid'); setPreviewPage(1); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        validationFilter === 'valid' 
                          ? 'bg-emerald-600 text-white shadow' 
                          : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      المركبات السليمة ({parsedItems.filter(i=>i._isValid && i._warnings.length ===0).length})
                    </button>
                    <button
                      onClick={() => { setValidationFilter('errors'); setPreviewPage(1); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        validationFilter === 'errors' 
                          ? 'bg-rose-600 text-white shadow' 
                          : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      أخطاء / تحذيرات ({parsedItems.filter(i=> !i._isValid || i._warnings.length > 0).length})
                    </button>
                    <button
                      onClick={() => { setValidationFilter('duplicates'); setPreviewPage(1); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        validationFilter === 'duplicates' 
                          ? 'bg-amber-600 text-white shadow' 
                          : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      المكررات المستبعدة ({parsedItems.filter(i=> i._isDuplicateInDb || i._isDuplicateInSheet).length})
                    </button>
                  </div>
                </div>

                {/* Table details */}
                <div className="border border-slate-100 dark:border-slate-800/80 rounded-2xl overflow-hidden bg-white dark:bg-slate-900/10">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-950 font-black text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800/80">
                        <tr>
                          <th className="p-4 w-12 text-center">الصف #</th>
                          <th className="p-4">السيارة / المركبة</th>
                          <th className="p-4">السنة واللون</th>
                          <th className="p-4">رقم الهيكل (VIN)</th>
                          <th className="p-4 text-left">التكلفة والبيع (-درهم-)</th>
                          <th className="p-4">الجهة الموردة</th>
                          <th className="p-4 w-60">حالة الصلاحية التدقيقية</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                        {paginatedPreviewItems.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-12 text-center text-slate-400 font-bold">
                              لا توجد سجلات تطابق عوامل البحث والفلترة حالياً بالمعاينة.
                            </td>
                          </tr>
                        ) : (
                          paginatedPreviewItems.map((item, idx) => {
                            const isRowValid = item._isValid;
                            const isDup = item._isDuplicateInDb || item._isDuplicateInSheet;
                            const isSelectedForCompare = selectedDupCompareId === item.id;

                            return (
                              <React.Fragment key={item.id}>
                                <tr 
                                  className={`group transition-colors ${
                                    !isRowValid 
                                      ? 'bg-rose-50/20 dark:bg-rose-950/5' 
                                      : isDup 
                                        ? 'bg-amber-50/20 dark:bg-amber-950/5' 
                                        : 'hover:bg-slate-50/50 dark:hover:bg-slate-900/20'
                                  }`}
                                >
                                  <td className="p-4 text-center font-bold text-slate-400">
                                    {item._originalRowIndex}
                                  </td>
                                  <td className="p-4">
                                    <div className="font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                                      <span>{item.brand}</span>
                                      {item._brandHeuristics && (
                                        <span className="inline-flex items-center gap-0.5 text-[8px] font-black bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-md leading-none">مركبة ذكية 🧠</span>
                                      )}
                                      {item.status === CarStatus.NOT_ARRIVED && (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-black bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-md leading-none border border-purple-500/20">⌛ لم تصل بعد</span>
                                      )}
                                      {item.status === CarStatus.RETURNED && (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-black bg-orange-500/10 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-md leading-none border border-orange-500/20">↩️ مرتجعة المعرض</span>
                                      )}
                                      {item.status === CarStatus.AVAILABLE && (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-black bg-teal-500/10 text-teal-600 dark:text-teal-400 px-2 py-0.5 rounded-md leading-none border border-teal-500/20">✓ متوفرة</span>
                                      )}
                                      {item.status === CarStatus.RESERVED && (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-md leading-none border border-amber-500/20">✉ محجوزة</span>
                                      )}
                                      {item.status === CarStatus.SOLD && (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-black bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-md leading-none border border-rose-500/20">✗ مباعة</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-4">
                                    <div className="text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1.5">
                                      <span>{item.year}</span>
                                      {item._yearHeuristics && (
                                        <span className="inline-flex items-center gap-0.5 text-[8px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-md leading-none">موديل سنة 🧠</span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                                      <span>{item.color}</span>
                                      {item._colorHeuristics && (
                                        <span className="inline-flex items-center gap-0.5 text-[8px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-md leading-none">لون ذكي 🧠</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-4">
                                    <span className="font-mono text-[10px] font-black tracking-wider uppercase bg-slate-100 dark:bg-slate-900 p-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                                      {item.vin || 'فارغ ⚠️'}
                                    </span>
                                  </td>
                                  <td className="p-4 text-left font-mono">
                                    <div className="text-slate-800 dark:text-slate-200 font-black">
                                      {item.price.toLocaleString()} سعر
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                      {item.costPrice.toLocaleString()} تكلفة
                                    </div>
                                  </td>
                                  <td className="p-4 text-slate-600 dark:text-slate-400 font-bold">
                                    {item.supplier || '-'}
                                  </td>
                                  <td className="p-4">
                                    <div className="space-y-1">
                                      {/* Succeeded */}
                                      {isRowValid && item._warnings.length === 0 && !isDup && (
                                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md font-black">
                                          <CheckCircle size={12} /> جاهز وسليم بالكامل
                                        </span>
                                      )}

                                      {/* Warnings list */}
                                      {item._warnings.map((w, wIdx) => (
                                        <span key={wIdx} className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-1 rounded-md font-bold leading-tight block w-full whitespace-normal">
                                          <AlertTriangle size={12} className="shrink-0" />
                                          {w}
                                        </span>
                                      ))}

                                      {/* Errors list */}
                                      {item._errors.map((err, eIdx) => (
                                        <span key={eIdx} className="inline-flex items-center gap-1 text-[10px] text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-1 rounded-md font-bold leading-tight block w-full whitespace-normal">
                                          <AlertCircle size={12} className="shrink-0" />
                                          {err}
                                        </span>
                                      ))}

                                      {/* Comparison Button for Duplicate entries */}
                                      {isDup && (
                                        <button
                                          type="button"
                                          onClick={() => setSelectedDupCompareId(isSelectedForCompare ? null : item.id)}
                                          className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black text-amber-700 bg-amber-550/15 dark:bg-amber-550/20 hover:bg-amber-500/25 border border-amber-500/30 rounded-lg cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                                        >
                                          <span>🔍</span>
                                          <span>{isSelectedForCompare ? 'إغلاق المقارنة' : 'عرض مادة المقارنة ومعالجة المكرر'}</span>
                                          {isSelectedForCompare ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>

                                {/* Expandable comparative view row */}
                                {isSelectedForCompare && (
                                  <tr className="bg-amber-500/5 dark:bg-amber-500/2">
                                    <td colSpan={7} className="p-6 border-y-2 border-dashed border-amber-300 dark:border-amber-900/40">
                                      <div className="space-y-4 text-right">
                                        <h5 className="font-extrabold text-amber-900 dark:text-amber-400 text-xs flex items-center gap-2">
                                          <Database size={16} />
                                          تفاصيل مطابقة ومقارنة سجل مكرر (رقم الهيكل: <span className="font-mono tracking-wider uppercase bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">{item.vin}</span>)
                                        </h5>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                          
                                          {/* Left Card: Imported Record */}
                                          <div className="p-5 bg-white dark:bg-slate-950 rounded-2xl border border-amber-300/40 dark:border-amber-900/40 space-y-3 shadow-inner">
                                            <div className="flex items-center justify-between border-b border-dashed dark:border-slate-850 pb-2">
                                              <span className="text-xs font-black text-amber-700 bg-amber-50 dark:bg-amber-950/45 px-2.5 py-0.5 rounded-lg">البيانات الواردة بملف الاستيراد</span>
                                              <span className="text-[10px] text-slate-400 font-bold">الصف رقم {item._originalRowIndex}</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs font-semibold text-slate-705 dark:text-slate-300">
                                              <div><span className="text-slate-400 font-bold block">المركبة:</span> <span className="font-extrabold text-slate-900 dark:text-white">{item.brand}</span></div>
                                              <div><span className="text-slate-400 font-bold block">الموديل (سنة الصنع):</span> <span className="font-mono font-bold text-slate-900 dark:text-white">{item.year || '—'}</span></div>
                                              <div><span className="text-slate-400 font-bold block">اللون الخارجي:</span> <span className="font-bold text-slate-900 dark:text-white">{item.color || '—'}</span></div>
                                              <div><span className="text-slate-400 font-bold block">البطاقة الجمركية:</span> <span className="font-mono font-bold text-slate-900 dark:text-white">{item.cardNumber || '—'}</span></div>
                                              <div><span className="text-slate-400 font-bold block">المورد / المصدر:</span> <span className="font-bold text-slate-900 dark:text-white">{item.supplier || '—'}</span></div>
                                              <div><span className="text-slate-400 font-bold block">التكلفة والبيع الافتراضي:</span> <span className="font-mono font-bold text-rose-500 block">{item.costPrice ? item.costPrice.toLocaleString() : '0'} درهم</span></div>
                                              <div><span className="text-slate-400 font-bold block">&nbsp;</span> <span className="font-mono font-bold text-emerald-500 block">{item.price ? item.price.toLocaleString() : '0'} درهم</span></div>
                                            </div>
                                            {item.notes && (
                                              <div className="text-[11px] bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-slate-500 leading-normal">
                                                <strong>ملاحظات الملف الصادرة:</strong> {item.notes}
                                              </div>
                                            )}
                                          </div>

                                          {/* Right Card: Existing Database Record */}
                                          {item._isDuplicateInDb ? (() => {
                                            const cleanVin = String(item.vin || '').replace(/\s+/g, '').toUpperCase();
                                            const existing = existingCars.find(c => String(c.vin || '').replace(/\s+/g, '').toUpperCase() === cleanVin);
                                            if (!existing) {
                                              return (
                                                <div className="p-5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-center flex flex-col justify-center items-center text-slate-400 text-xs">
                                                  <span>تكرار داخلي بجدول العمل نفسه (لا يوجد سجل مطابق بقاعدة البيانات حالياً).</span>
                                                </div>
                                              );
                                            }
                                            return (
                                              <div className="p-5 bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-inner">
                                                <div className="flex items-center justify-between border-b border-dashed dark:border-slate-850 pb-2">
                                                  <span className="text-xs font-black text-blue-700 bg-blue-50 dark:bg-blue-950/45 px-2.5 py-0.5 rounded-lg">السجل الحالي النشط في النظام</span>
                                                  <span className="text-[10px] text-slate-400 font-mono font-bold">ID: {existing.id.substring(0, 8)}...</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs font-semibold text-slate-705 dark:text-slate-300">
                                                  <div><span className="text-slate-400 font-bold block">المركبة:</span> <span className="font-extrabold text-slate-900 dark:text-white">{existing.brand}</span></div>
                                                  <div><span className="text-slate-400 font-bold block">الموديل (سنة الصنع):</span> <span className="font-mono font-bold text-slate-900 dark:text-white">{existing.year || '—'}</span></div>
                                                  <div><span className="text-slate-400 font-bold block">اللون الخارجي:</span> <span className="font-bold text-slate-900 dark:text-white">{existing.color || '—'}</span></div>
                                                  <div><span className="text-slate-400 font-bold block">البطاقة الجمركية:</span> <span className="font-mono font-bold text-slate-900 dark:text-white">{existing.cardNumber || '—'}</span></div>
                                                  <div><span className="text-slate-400 font-bold block">المورد / المصدر:</span> <span className="font-bold text-slate-900 dark:text-white">{existing.supplier || '—'}</span></div>
                                                  <div><span className="text-slate-400 font-bold block">التكلفة والبيع الافتراضي:</span> <span className="font-mono font-bold text-rose-500 block">{existing.costPrice ? existing.costPrice.toLocaleString() : '0'} درهم</span></div>
                                                  <div><span className="text-slate-400 font-bold block">&nbsp;</span> <span className="font-mono font-bold text-emerald-500 block">{existing.price ? existing.price.toLocaleString() : '0'} درهم</span></div>
                                                </div>

                                                {/* Advanced administrative tracking analysis to clear up system counts discrepancy */}
                                                <div className="pt-3 border-t border-dashed dark:border-slate-800 flex flex-col gap-2 bg-slate-50/50 dark:bg-slate-900/20 p-2.5 rounded-xl">
                                                  <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-slate-400 text-[11px] font-bold">الحالة الإدارية الحالية:</span>
                                                    {existing.status === CarStatus.NOT_ARRIVED && (
                                                      <span className="inline-flex items-center gap-1 text-[9px] font-black bg-purple-500/15 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded border border-purple-500/20">⌛ تحت الوصول (خارج الصالة)</span>
                                                    )}
                                                    {existing.status === CarStatus.RETURNED && (
                                                      <span className="inline-flex items-center gap-1 text-[9px] font-black bg-orange-500/15 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded border border-orange-500/20">↩️ مرتجعة للمعرض</span>
                                                    )}
                                                    {existing.status === CarStatus.AVAILABLE && (
                                                      <span className="inline-flex items-center gap-1 text-[9px] font-black bg-teal-500/15 text-teal-600 dark:text-teal-400 px-2 py-0.5 rounded border border-teal-500/20">✓ متوفرة فعلياً بالمخزن</span>
                                                    )}
                                                    {existing.status === CarStatus.RESERVED && (
                                                      <span className="inline-flex items-center gap-1 text-[9px] font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded border border-amber-500/20">✉ محجوزة</span>
                                                    )}
                                                    {existing.status === CarStatus.SOLD && (
                                                      <span className="inline-flex items-center gap-1 text-[9px] font-black bg-rose-500/15 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded border border-rose-500/20">✗ مباعة تماماً للمبيعات</span>
                                                    )}
                                                  </div>
                                                  <div className="flex items-center justify-between text-[11px]">
                                                    <span className="text-slate-400 font-bold">مكان التواجد:</span>
                                                    <span className="font-extrabold text-slate-700 dark:text-slate-300">
                                                      {existing.isOutbound 
                                                        ? '📦 خارج المعرض والمخزن النشط (تاريخ مبيعات أرشيفي)' 
                                                        : existing.isPresentInShowroom !== false 
                                                          ? '✅ بصالة العرض (يظهر بالمخزون النشط)' 
                                                          : '❌ مستودع خارجي / لم تصل المعرض بعد (مستبعد من المعرض الرئيسي)'}
                                                    </span>
                                                  </div>
                                                  <div className="flex items-center justify-between text-[11px]">
                                                    <span className="text-slate-400 font-bold">أيلولة السجل (إخراج مالي):</span>
                                                    <span className="font-extrabold text-slate-700 dark:text-slate-300">
                                                      {existing.isOutbound ? '📦 خارج وحسابات مباعة (SOLD/EXITED)' : '📈 ساري بالمخزونات الدورية الجارية'}
                                                    </span>
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                          })() : (
                                            <div className="p-5 bg-orange-50/50 dark:bg-orange-950/20 rounded-2xl border border-orange-100 dark:border-orange-900/40 text-xs text-orange-900 dark:text-orange-300 space-y-2 flex flex-col justify-center">
                                              <p className="font-black leading-relaxed">⚠️ مكرر ذاتي داخل ورقة العمل!</p>
                                              <p className="leading-relaxed text-[11px] text-slate-500 dark:text-slate-400">
                                                تم إيجاد هذا الهيكل مكرراً عدة مرات داخل هذا الملف الذي تم رفعه للتو. يُهمل الصف الإضافي منعاً للتخزين التراكمي العشوائي.
                                              </p>
                                            </div>
                                          )}

                                        </div>

                                        {/* Dynamic informational bar to indicate treatment based on mode */}
                                        <div className="p-4 bg-amber-500/10 border border-amber-300 dark:border-amber-900/30 rounded-2xl text-xs space-y-1">
                                          <p className="font-black text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                                            <span>💡</span>
                                            وضع المعالجة الحالي: <span className="underline font-bold text-amber-950 dark:text-amber-200">{duplicateMode === 'skip' ? 'تخطي واستبعاد السجلات المكررة (الأكثر أماناً)' : 'الاستبدال وإعادة الكتابة الكاملة للسجل القائم'}</span>
                                          </p>
                                          <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                                            {duplicateMode === 'skip' 
                                              ? 'سيقوم النظام بتثبيت السجل القائم دون إحداث أدنى تغيير عليه، مع إهمال استيراد السجل الوارد الحالي تماماً.' 
                                              : 'سيتم تحديث كافة حقول وقيم السجل القائم وتعديل بياناته لتطابق تماماً القيم الجديدة الواردة بالملف المرفوع.'
                                            }
                                          </p>
                                        </div>

                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Table pagination controller */}
                  {filteredPreviewItems.length > PREVIEW_ITEMS_PER_PAGE && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-bold">
                        تصفح المعاينة: الصفحة <strong className="text-slate-700 dark:text-white">{previewPage}</strong> من أصل <strong className="text-slate-700 dark:text-white">{Math.ceil(filteredPreviewItems.length / PREVIEW_ITEMS_PER_PAGE)}</strong> ({filteredPreviewItems.length} سجلات)
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          disabled={previewPage === 1}
                          onClick={() => setPreviewPage(p => Math.max(1, p - 1))}
                          className="p-2 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors disabled:opacity-50"
                        >
                          <ChevronRight size={14} />
                        </button>
                        <button
                          disabled={previewPage >= Math.ceil(filteredPreviewItems.length / PREVIEW_ITEMS_PER_PAGE)}
                          onClick={() => setPreviewPage(p => p + 1)}
                          className="p-2 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors disabled:opacity-50"
                        >
                          <ChevronLeft size={14} />
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              </div>

            </motion.div>
          )}

        </div>

        {/* Wizard Actions Footer Panel Bar */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/10">
          <div>
            {step === 2 && (
              <button 
                onClick={() => { setStep(1); setSheetData([]); setFile(null); }}
                className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 active:scale-95"
              >
                <ChevronRight size={14} />
                تغيير الملف وإعادة الرفع
              </button>
            )}
            {step === 3 && (
              <button 
                onClick={() => setStep(2)}
                className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 active:scale-95"
              >
                <ChevronRight size={14} />
                الرجوع لتعديل ربط الأعمدة
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {step === 2 && step2ErrorBanner && (
              <span className="text-xs font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 px-3 py-1.5 rounded-xl">
                {step2ErrorBanner}
              </span>
            )}
            {importError && (
              <div className="text-xs font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 px-3 py-2 rounded-xl flex items-center gap-2 max-w-md">
                <AlertCircle size={15} className="shrink-0" />
                <span className="truncate">{importError}</span>
              </div>
            )}
            <button 
              disabled={isImporting}
              onClick={onClose}
              className="px-6 py-3.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white text-xs font-bold disabled:opacity-50"
            >
              إلغاء الأمر
            </button>

            {step === 2 && (
              <button 
                onClick={handleNextStep}
                className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/10 text-white rounded-2xl text-xs font-black transition-all flex items-center gap-2 active:scale-95"
              >
                المضي للمعاينة والتحقق الذكي
                <ChevronLeft size={14} />
              </button>
            )}

            {step === 3 && (
              <button 
                id="btn-execute-car-import"
                disabled={stats.toImportCount === 0 || isImporting}
                onClick={executeImport}
                className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-900 dark:disabled:text-slate-600 shadow-lg shadow-emerald-500/10 text-white rounded-2xl text-xs font-black transition-all flex items-center gap-2 active:scale-95 cursor-pointer disabled:cursor-not-allowed"
              >
                {isImporting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>جارٍ الاستيراد وتغذية المخزن...</span>
                  </>
                ) : (
                  <>
                    <Database size={16} />
                    <span>استيراد وتغذية المخزن برولوج ({stats.toImportCount} مركبة جاهزة)</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
