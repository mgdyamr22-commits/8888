import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  Sparkles, 
  Clock, 
  Trash2, 
  Copy, 
  Check, 
  MapPin, 
  X, 
  Car, 
  Calendar, 
  Coins, 
  FileText, 
  ExternalLink,
  Cpu,
  BadgeAlert,
  ArrowLeft,
  ChevronRight,
  Database,
  Paperclip,
  FileUp,
  Filter,
  Plus,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Printer,
  FileSpreadsheet,
  Eye,
  EyeOff
} from 'lucide-react';
import { Car as CarType, CarStatus, RentalStatus, formatVehicleDisplay } from '../types';
import { useLanguage } from './LanguageContext.tsx';
import { cleanIdentifier, normalizeArabicText, convertArabicNumerals } from '../src/utils/searchEngine';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { ExcelService } from '../services/excelService';

interface SmartSearchProps {
  cars: CarType[];
  onOpenDetails?: (car: CarType) => void;
}

interface IndexMetadata {
  timeMs: number;
  totalCarsCount: number;
}

interface SearchCondition {
  id: string;
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'is_empty' | 'is_not_empty' | 'greater_than' | 'less_than' | 'between';
  value: string;
  value2?: string;
}

interface CustomTemplate {
  id: string;
  name: string;
  conditions: SearchCondition[];
  joinType: 'and' | 'or';
}

const SEARCH_FIELDS = [
  { value: 'brand', label: 'الماركة', type: 'text' },
  { value: 'model', label: 'الموديل', type: 'text' },
  { value: 'year', label: 'سنة الصنع', type: 'number' },
  { value: 'color', label: 'اللون', type: 'text' },
  { value: 'vin', label: 'رقم الهيكل VIN', type: 'text' },
  { value: 'vinMatching', label: 'حالة المطابقة', type: 'select', options: ['مطابق', 'غير مطابق'] },
  { value: 'cardNumber', label: 'رقم البطاقة الجمركية', type: 'text' },
  { value: 'price', label: 'سعر البيع', type: 'number' },
  { value: 'costPrice', label: 'سعر التكلفة', type: 'number' },
  { value: 'supplier', label: 'المورد', type: 'text' },
  { value: 'ownershipType', label: 'الوارد / الساحة', type: 'text' },
  { value: 'status', label: 'حالة السيارة', type: 'select', options: [CarStatus.AVAILABLE, CarStatus.RESERVED, CarStatus.SOLD] },
  { value: 'rentalStatus', label: 'حالة التجيير', type: 'select', options: [RentalStatus.RENTED, RentalStatus.NOT_RENTED] },
  { value: 'isPresentInShowroom', label: 'الموقع داخل المعرض', type: 'boolean' },
  { value: 'hasPlate', label: 'حالة اللوحات', type: 'boolean' },
  { value: 'plateNumber', label: 'رقم اللوحة', type: 'text' },
  { value: 'notes', label: 'الملاحظات والبيان', type: 'text' }
];

const OPERATORS = [
  { value: 'equals', label: 'يساوي' },
  { value: 'not_equals', label: 'لا يساوي' },
  { value: 'contains', label: 'يحتوي على' },
  { value: 'not_contains', label: 'لا يحتوي على' },
  { value: 'is_empty', label: 'فارغ' },
  { value: 'is_not_empty', label: 'غير فارغ' },
  { value: 'greater_than', label: 'أكبر من' },
  { value: 'less_than', label: 'أقل من' },
  { value: 'between', label: 'بين قيمتين' }
];

const COLUMNS_DEF = [
  { key: 'brandModel', label: 'المركبة', defaultVisible: true },
  { key: 'year', label: 'السنة', defaultVisible: true },
  { key: 'color', label: 'اللون', defaultVisible: true },
  { key: 'vin', label: 'رقم الهيكل VIN', defaultVisible: true },
  { key: 'cardNumber', label: 'البطاقة الجمركية', defaultVisible: true },
  { key: 'plateNumber', label: 'رقم اللوحة', defaultVisible: true },
  { key: 'ownershipType', label: 'الوارد / الساحة', defaultVisible: true },
  { key: 'price', label: 'سعر البيع', defaultVisible: true },
  { key: 'costPrice', label: 'سعر التكلفة', defaultVisible: false },
  { key: 'status', label: 'الحالة', defaultVisible: true },
  { key: 'rentalStatus', label: 'التجيير', defaultVisible: true },
  { key: 'isPresentInShowroom', label: 'الموقع', defaultVisible: true },
  { key: 'supplier', label: 'المورد', defaultVisible: false },
  { key: 'entryDate', label: 'تاريخ الدخول', defaultVisible: false }
];

export default function SmartSearch({ cars: originalCars }: SmartSearchProps) {
  const { lang, isRtl } = useLanguage();
  
  // Custom Query Builder State
  const [conditions, setConditions] = useState<SearchCondition[]>([]);
  const [joinType, setJoinType] = useState<'and' | 'or'>('and');
  const [textFilter, setTextFilter] = useState('');
  
  // Performance Sandbox State
  const [performanceTestMode, setPerformanceTestMode] = useState(false);
  const [indexMeta, setIndexMeta] = useState<IndexMetadata>({ timeMs: 0, totalCarsCount: 0 });

  // Columns & Grouping State
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('smart_search_cols_visible');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('localStorage is not accessible in this environment:', e);
    }
    const defaults: Record<string, boolean> = {};
    COLUMNS_DEF.forEach(col => { defaults[col.key] = col.defaultVisible; });
    return defaults;
  });

  const [groupByField, setGroupByField] = useState<string>('none'); // 'none', 'brand', 'model', 'ownershipType', 'status'
  const [sortByField, setSortByField] = useState<string>('brand');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Custom Saved Templates
  const [savedTemplates, setSavedTemplates] = useState<CustomTemplate[]>(() => {
    try {
      const saved = localStorage.getItem('smart_search_templates');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('localStorage is not accessible in this environment:', e);
    }
    return [];
  });
  const [newTemplateName, setNewTemplateName] = useState('');
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);

  // Selected vehicle drawer
  const [selectedCar, setSelectedCar] = useState<CarType | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Pagination Table
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Save visible columns to localStorage with full try-catch safety block
  useEffect(() => {
    try {
      localStorage.setItem('smart_search_cols_visible', JSON.stringify(visibleColumns));
    } catch (e) {
      console.warn('Failed to write visible columns to localStorage:', e);
    }
  }, [visibleColumns]);

  // Save Templates to localStorage with full try-catch safety block
  useEffect(() => {
    try {
      localStorage.setItem('smart_search_templates', JSON.stringify(savedTemplates));
    } catch (e) {
      console.warn('Failed to write templates to localStorage:', e);
    }
  }, [savedTemplates]);

  // Purely computed performance dataset & indexing information in a single useMemo without writing side-effects during render
  const { processedCarsList, indexMetaComputed } = useMemo(() => {
    const startTime = performance.now();
    const carsList = Array.isArray(originalCars) ? originalCars : [];
    
    if (!performanceTestMode) {
      const endTime = performance.now();
      return {
        processedCarsList: carsList,
        indexMetaComputed: {
          timeMs: parseFloat((endTime - startTime).toFixed(2)),
          totalCarsCount: carsList.length
        }
      };
    }
    
    // Generate 105,000 highly realistic vehicles based on original templates
    const generated: CarType[] = [...carsList];
    const brands = ['Toyota', 'Nissan', 'Hyundai', 'Kia', 'Ford', 'Chevrolet', 'Lexus', 'Mercedes', 'BMW', 'Honda', 'Mazda', 'MG'];
    const modelsByBrand: Record<string, string[]> = {
      'Toyota': ['Camry', 'Land Cruiser', 'Hilux', 'Corolla', 'Yaris', 'Avalon', 'Fortuner'],
      'Nissan': ['Patrol', 'Sunny', 'Altima', 'X-Trail', 'Navara', 'Pathfinder'],
      'Hyundai': ['Accent', 'Elantra', 'Sonata', 'Tucson', 'Santa Fe', 'Creta'],
      'Kia': ['Optima', 'Cerato', 'Sportage', 'Sorento', 'K5', 'Pegas'],
      'Ford': ['Taurus', 'Explorer', 'F-150', 'Expedition', 'Territory'],
      'Chevrolet': ['Tahoe', 'Suburban', 'Malibu', 'Captiva', 'Groove'],
      'Lexus': ['LX570', 'ES350', 'RX350', 'LS500'],
      'Mercedes': ['S-Class', 'E-Class', 'C-Class', 'GLE', 'G-Class'],
      'BMW': ['7 Series', '5 Series', 'X5', 'X6', '3 Series'],
      'Honda': ['Accord', 'Civic', 'CR-V', 'City', 'Pilot'],
      'Mazda': ['Mazda 6', 'CX-9', 'CX-5', 'Mazda 3'],
      'MG': ['MG6', 'MG ZS', 'MG RX5', 'MG5']
    };
    const colors = ['أبيض', 'أسود', 'فضي', 'أزرق', 'رمادي', 'أحمر', 'ذهبي', 'بني'];
    const statusValues = [CarStatus.AVAILABLE, CarStatus.RESERVED, CarStatus.SOLD];
    const suppliers = ['شركة الوعلان للسيارات', 'شركة عبد اللطيف جميل', 'مورد دبي الدولي', 'شركة السبر للمركبات', 'مورد الخليج للسيارات'];
    const yards = ['الساحة الرئيسية', 'مستودع السلي', 'ساحة الشفا', 'معرض النسيم', 'مستودع الميناء'];
    
    const countNeeded = 105000 - carsList.length;
    for (let i = 0; i < countNeeded; i++) {
      const brand = brands[i % brands.length];
      const brandModels = modelsByBrand[brand];
      const model = brandModels[i % brandModels.length];
      const vinSuffix = 1000000 + i;
      const cardSuffix = 2000000 + i;
      const plateChar1 = ['أ', 'ب', 'ج', 'د', 'ر', 'س', 'ص', 'ط', 'ع', 'ق', 'ك', 'م', 'ن', 'هـ', 'و', 'ي'][i % 16];
      const plateChar2 = ['ب', 'ح', 'د', 'س', 'ص', 'م', 'ن', 'و', 'ي', 'ر'][i % 10];
      const plateChar3 = ['ج', 'ر', 'ط', 'ق', 'ك', 'ل', 'هـ', 'أ', 'ب', 'ت'][i % 10];
      const plateNumber = `${plateChar1} ${plateChar2} ${plateChar3} ${1000 + (i % 8999)}`;

      generated.push({
        id: `perf-car-${i}`,
        brand,
        model,
        year: 2018 + (i % 8),
        color: colors[i % colors.length],
        vin: `VIN-${brand.toUpperCase().substring(0, 3)}-${vinSuffix}`,
        vinMatching: i % 100 === 0 ? 'غير مطابق' : 'مطابق',
        cardNumber: i % 15 === 0 ? '' : `CARD-${cardSuffix}`,
        price: 45000 + (i % 60) * 1500,
        costPrice: 40000 + (i % 60) * 1500,
        supplier: suppliers[i % suppliers.length],
        ownershipType: yards[i % yards.length],
        status: statusValues[i % statusValues.length],
        rentalStatus: i % 12 === 0 ? RentalStatus.RENTED : RentalStatus.NOT_RENTED,
        entryDate: new Date(Date.now() - (i % 150) * 24 * 60 * 60 * 1000).toISOString(),
        lastModified: new Date().toISOString(),
        isOutbound: i % 20 === 0,
        hasPlate: i % 4 !== 0,
        plateData: i % 4 !== 0 ? {
          plateNumber,
          ownerName: `مالك افتراضي رقم ${i + 1}`,
          serialNumber: `S-${112000 + i}`,
          issueDate: new Date().toISOString()
        } : undefined,
        history: [],
        isPresentInShowroom: i % 5 === 0,
        notes: i % 18 === 0 ? 'سيارة تحتاج فحص وثيقة التأمين ومستندات اللوحة' : i % 25 === 0 ? 'مؤمنة بالكامل' : ''
      });
    }
    
    const endTime = performance.now();
    return {
      processedCarsList: generated,
      indexMetaComputed: {
        timeMs: parseFloat((endTime - startTime).toFixed(2)),
        totalCarsCount: generated.length
      }
    };
  }, [originalCars, performanceTestMode]);

  // Sync index metadata safely to local state so the rest of the application references remain clean and static
  useEffect(() => {
    setIndexMeta(indexMetaComputed);
  }, [indexMetaComputed]);

  // Execute advanced condition queries based on conditions + joinType and textual search
  const filteredCars = useMemo(() => {
    if (conditions.length === 0 && !textFilter.trim()) {
      return processedCarsList;
    }

    return processedCarsList.filter(car => {
      // 1. Check Condition builder
      let builderPass = true;
      if (conditions.length > 0) {
        const conditionResults = conditions.map(cond => {
          let valueToCompare: any = null;

          // Resolve car value
          switch (cond.field) {
            case 'brand': valueToCompare = car.brand; break;
            case 'model': valueToCompare = car.model; break;
            case 'year': valueToCompare = car.year; break;
            case 'color': valueToCompare = car.color; break;
            case 'vin': valueToCompare = car.vin; break;
            case 'vinMatching': valueToCompare = car.vinMatching; break;
            case 'cardNumber': valueToCompare = car.cardNumber; break;
            case 'price': valueToCompare = car.price; break;
            case 'costPrice': valueToCompare = car.costPrice; break;
            case 'supplier': valueToCompare = car.supplier; break;
            case 'ownershipType': valueToCompare = car.ownershipType; break;
            case 'status': valueToCompare = car.status; break;
            case 'rentalStatus': valueToCompare = car.rentalStatus; break;
            case 'isPresentInShowroom': valueToCompare = car.isPresentInShowroom; break;
            case 'hasPlate': valueToCompare = car.hasPlate; break;
            case 'plateNumber': valueToCompare = car.plateData?.plateNumber; break;
            case 'notes': valueToCompare = (car.notes || '') + ' ' + (car.carRemark || ''); break;
          }

          if (valueToCompare === undefined || valueToCompare === null) {
            valueToCompare = '';
          }

          const op = cond.operator;
          
          // Deal with empty / non empty
          if (op === 'is_empty') {
            return !valueToCompare || String(valueToCompare).trim() === '' || String(valueToCompare).toLowerCase() === 'بدون';
          }
          if (op === 'is_not_empty') {
            return valueToCompare && String(valueToCompare).trim() !== '' && String(valueToCompare).toLowerCase() !== 'بدون';
          }

          // Convert to string search
          const strCarVal = normalizeArabicText(convertArabicNumerals(String(valueToCompare).toLowerCase().trim()));
          const strCondVal = normalizeArabicText(convertArabicNumerals(String(cond.value).toLowerCase().trim()));
          const strCondVal2 = cond.value2 ? normalizeArabicText(convertArabicNumerals(String(cond.value2).toLowerCase().trim())) : '';

          // Number comparison conversion if applicable
          const numCarVal = parseFloat(valueToCompare);
          const numCondVal = parseFloat(cond.value);
          const numCondVal2 = cond.value2 ? parseFloat(cond.value2) : NaN;

          switch (op) {
            case 'equals':
              if (cond.field === 'isPresentInShowroom' || cond.field === 'hasPlate') {
                return String(valueToCompare) === cond.value;
              }
              return strCarVal === strCondVal;
            case 'not_equals':
              if (cond.field === 'isPresentInShowroom' || cond.field === 'hasPlate') {
                return String(valueToCompare) !== cond.value;
              }
              return strCarVal !== strCondVal;
            case 'contains':
              return strCarVal.includes(strCondVal);
            case 'not_contains':
              return !strCarVal.includes(strCondVal);
            case 'greater_than':
              return !isNaN(numCarVal) && !isNaN(numCondVal) && numCarVal > numCondVal;
            case 'less_than':
              return !isNaN(numCarVal) && !isNaN(numCondVal) && numCarVal < numCondVal;
            case 'between':
              return !isNaN(numCarVal) && !isNaN(numCondVal) && !isNaN(numCondVal2) && 
                     numCarVal >= numCondVal && numCarVal <= numCondVal2;
            default:
              return true;
          }
        });

        if (joinType === 'and') {
          builderPass = conditionResults.every(res => res === true);
        } else {
          builderPass = conditionResults.some(res => res === true);
        }
      }

      // 2. Secondary Text Filter
      let textPass = true;
      if (textFilter.trim()) {
        const queryTerm = normalizeArabicText(convertArabicNumerals(textFilter.toLowerCase().trim()));
        const cleanQuery = cleanIdentifier(textFilter);
        
        const brandModel = normalizeArabicText(`${car.brand} ${car.model}`.toLowerCase());
        const vin = cleanIdentifier(car.vin || '');
        const cardVal = cleanIdentifier(car.cardNumber || '');
        const plateVal = cleanIdentifier(car.plateData?.plateNumber || '');

        textPass = brandModel.includes(queryTerm) || 
                   (cleanQuery && vin.includes(cleanQuery)) || 
                   (cleanQuery && cardVal.includes(cleanQuery)) || 
                   (cleanQuery && plateVal.includes(cleanQuery)) ||
                   normalizeArabicText(car.color || '').includes(queryTerm);
      }

      return builderPass && textPass;
    });
  }, [processedCarsList, conditions, joinType, textFilter]);

  // Precomputed Shortcut statistics counts to display active badges (E.g. بدون لوحة: 5)
  const quickSearchCounts = useMemo(() => {
    const counts = {
      noCustoms: 0,
      notTransferred: 0,
      transferred: 0,
      noLicencePlate: 0,
      noInsurance: 0,
      noLocationYards: 0,
      inShowroom: 0,
      outShowroom: 0,
      sold: 0,
      unsold: 0,
      reserved: 0,
      missingData: 0,
      vinCompliant: 0
    };

    processedCarsList.forEach(c => {
      // no customs
      if (!c.cardNumber || c.cardNumber.trim() === '' || c.cardNumber === 'بدون') counts.noCustoms++;
      // rental
      if (c.rentalStatus === RentalStatus.NOT_RENTED) counts.notTransferred++;
      if (c.rentalStatus === RentalStatus.RENTED) counts.transferred++;
      // plate
      if (!c.hasPlate || !c.plateData?.plateNumber) counts.noLicencePlate++;
      // insurance - check custom text inside notes/remark or lack of insurance document
      const noteStr = ((c.notes || '') + ' ' + (c.carRemark || '')).toLowerCase();
      const hasInsuranceWord = noteStr.includes('تأمين') || noteStr.includes('مؤمن') || noteStr.includes('insurance');
      if (!hasInsuranceWord) counts.noInsurance++;
      // location
      if (!c.ownershipType || c.ownershipType.trim() === '') counts.noLocationYards++;
      // showroom
      if (c.isPresentInShowroom === true) counts.inShowroom++;
      if (c.isPresentInShowroom === false) counts.outShowroom++;
      // status
      if (c.status === CarStatus.SOLD) counts.sold++;
      if (c.status !== CarStatus.SOLD) counts.unsold++;
      if (c.status === CarStatus.RESERVED) counts.reserved++;
      // vin matching
      if (c.vinMatching === 'مطابق') counts.vinCompliant++;
      // missing essential fields
      if (!c.vin || !c.cardNumber || !c.brand || !c.model || !c.color || !c.year) counts.missingData++;
    });

    return counts;
  }, [processedCarsList]);

  // Statistics summaries for filtered results
  const resultsStats = useMemo(() => {
    let salesTotal = 0;
    let costTotal = 0;
    let avaCount = 0;
    let resCount = 0;
    let sldCount = 0;

    filteredCars.forEach(c => {
      salesTotal += c.price || 0;
      costTotal += c.costPrice || 0;
      if (c.status === CarStatus.AVAILABLE) avaCount++;
      else if (c.status === CarStatus.RESERVED) resCount++;
      else if (c.status === CarStatus.SOLD) sldCount++;
    });

    const expectedProfit = salesTotal - costTotal;

    return {
      count: filteredCars.length,
      salesTotal,
      costTotal,
      expectedProfit,
      available: avaCount,
      reserved: resCount,
      sold: sldCount
    };
  }, [filteredCars]);

  // Sort Results
  const sortedCars = useMemo(() => {
    const list = [...filteredCars];
    list.sort((a, b) => {
      let valA: any = String(a[sortByField as keyof CarType] || '').toLowerCase();
      let valB: any = String(b[sortByField as keyof CarType] || '').toLowerCase();

      // Handling custom fields properties
      if (sortByField === 'plateNumber') {
        valA = String(a.plateData?.plateNumber || '').toLowerCase();
        valB = String(b.plateData?.plateNumber || '').toLowerCase();
      }

      // Handling numbers
      const numA = parseFloat(valA);
      const numB = parseFloat(valB);
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortDirection === 'asc' ? numA - numB : numB - numA;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredCars, sortByField, sortDirection]);

  // Grouped results dynamically
  const groupedCars = useMemo(() => {
    if (groupByField === 'none') {
      return null;
    }

    const groups: Record<string, CarType[]> = {};
    sortedCars.forEach(car => {
      let key = 'أخرى';
      
      if (groupByField === 'brand') {
        key = car.brand || 'غير محدد';
      } else if (groupByField === 'model') {
        key = `${car.brand} - ${car.model}` || 'غير محدد';
      } else if (groupByField === 'ownershipType') {
        key = car.ownershipType || 'بدون ساحة وارد';
      } else if (groupByField === 'status') {
        key = car.status || 'غير محدد';
      } else if (groupByField === 'rentalStatus') {
        key = car.rentalStatus === RentalStatus.RENTED ? 'مجيرة' : 'غير مجيرة';
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(car);
    });

    return groups;
  }, [sortedCars, groupByField]);

  // Pagination bounds
  const paginatedCars = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedCars.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedCars, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedCars.length / itemsPerPage) || 1;

  useEffect(() => {
    setCurrentPage(1);
  }, [conditions, joinType, textFilter, itemsPerPage, groupByField]);

  // Action: Add search condition
  const addCondition = (fieldVal?: string, opVal?: string, valueVal?: string) => {
    const defaultField = fieldVal || 'brand';
    const fieldType = SEARCH_FIELDS.find(f => f.value === defaultField)?.type || 'text';
    const defaultOp = opVal || (fieldType === 'number' ? 'greater_than' : 'contains');
    
    const newCond: SearchCondition = {
      id: `cond-${Date.now()}-${Math.random()}`,
      field: defaultField,
      operator: defaultOp as any,
      value: valueVal || ''
    };
    setConditions(prev => [...prev, newCond]);
  };

  const removeCondition = (id: string) => {
    setConditions(prev => prev.filter(c => c.id !== id));
  };

  const updateCondition = (id: string, updates: Partial<SearchCondition>) => {
    setConditions(prev => prev.map(c => {
      if (c.id === id) {
        const updated = { ...c, ...updates };
        // reset operator if field type changed to prevent illegal operants
        if (updates.field) {
          const newFieldType = SEARCH_FIELDS.find(f => f.value === updates.field)?.type;
          if (newFieldType === 'number') {
            updated.operator = 'greater_than';
            updated.value = '';
          } else if (newFieldType === 'boolean') {
            updated.operator = 'equals';
            updated.value = 'true';
          } else if (newFieldType === 'select') {
            updated.operator = 'equals';
            const opt = SEARCH_FIELDS.find(f => f.value === updates.field)?.options || [];
            updated.value = opt[0] || '';
          } else {
            updated.operator = 'contains';
            updated.value = '';
          }
        }
        return updated;
      }
      return c;
    }));
  };

  // Pre-made shortcuts loading actions (أمثلة البحث)
  const loadQuickSearchShortcut = (type: string) => {
    setCurrentPage(1);
    setSelectedCar(null);
    setTextFilter('');
    
    switch (type) {
      case 'noCustoms':
        setJoinType('and');
        setConditions([
          { id: 'q1', field: 'cardNumber', operator: 'is_empty', value: '' }
        ]);
        break;
      case 'notTransferred':
        setJoinType('and');
        setConditions([
          { id: 'q2', field: 'rentalStatus', operator: 'equals', value: RentalStatus.NOT_RENTED }
        ]);
        break;
      case 'transferred':
        setJoinType('and');
        setConditions([
          { id: 'q3', field: 'rentalStatus', operator: 'equals', value: RentalStatus.RENTED }
        ]);
        break;
      case 'noLicencePlate':
        setJoinType('and');
        setConditions([
          { id: 'q4', field: 'hasPlate', operator: 'equals', value: 'false' }
        ]);
        break;
      case 'noInsurance':
        setJoinType('and');
        setConditions([
          { id: 'q5', field: 'notes', operator: 'not_contains', value: 'تأمين' },
          { id: 'q5b', field: 'notes', operator: 'not_contains', value: 'مؤمن' }
        ]);
        break;
      case 'noLocationYards':
        setJoinType('and');
        setConditions([
          { id: 'q6', field: 'ownershipType', operator: 'is_empty', value: '' }
        ]);
        break;
      case 'inShowroom':
        setJoinType('and');
        setConditions([
          { id: 'q7', field: 'isPresentInShowroom', operator: 'equals', value: 'true' }
        ]);
        break;
      case 'outShowroom':
        setJoinType('and');
        setConditions([
          { id: 'q8', field: 'isPresentInShowroom', operator: 'equals', value: 'false' }
        ]);
        break;
      case 'sold':
        setJoinType('and');
        setConditions([
          { id: 'q9', field: 'status', operator: 'equals', value: CarStatus.SOLD }
        ]);
        break;
      case 'unsold':
        setJoinType('and');
        setConditions([
          { id: 'q10', field: 'status', operator: 'equals', value: CarStatus.AVAILABLE }
        ]);
        break;
      case 'reserved':
        setJoinType('and');
        setConditions([
          { id: 'q11', field: 'status', operator: 'equals', value: CarStatus.RESERVED }
        ]);
        break;
      case 'missingData':
        setJoinType('or');
        setConditions([
          { id: 'mq1', field: 'vin', operator: 'is_empty', value: '' },
          { id: 'mq2', field: 'cardNumber', operator: 'is_empty', value: '' },
          { id: 'mq3', field: 'brand', operator: 'is_empty', value: '' },
          { id: 'mq4', field: 'model', operator: 'is_empty', value: '' }
        ]);
        break;
      case 'vinCompliant':
        setJoinType('and');
        setConditions([
          { id: 'q12', field: 'vinMatching', operator: 'equals', value: 'مطابق' }
        ]);
        break;
      default:
        setConditions([]);
    }
  };

  // Save current query configuration as custom template
  const saveCurrentSearchAsTemplate = () => {
    if (!newTemplateName.trim()) {
      return;
    }
    
    const newTemplate: CustomTemplate = {
      id: `tmpl-${Date.now()}`,
      name: newTemplateName.trim(),
      conditions: [...conditions],
      joinType
    };

    setSavedTemplates(prev => [...prev, newTemplate]);
    setNewTemplateName('');
    setShowSaveTemplateModal(false);
  };

  const deleteTemplate = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSavedTemplates(prev => prev.filter(t => t.id !== id));
  };

  const loadTemplate = (tmpl: CustomTemplate) => {
    setCurrentPage(1);
    setSelectedCar(null);
    setConditions(tmpl.conditions);
    setJoinType(tmpl.joinType);
    setTextFilter('');
  };

  // Helper to copy strings
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Column toggle
  const toggleColumnVisibility = (key: string) => {
    setVisibleColumns(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Sort trigger
  const triggerSort = (field: string) => {
    if (sortByField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortByField(field);
      setSortDirection('asc');
    }
  };

  // Export to Excel JS (Support selective columns or all) with premium custom-tailored styling, alignments and KPI blocks
  const exportSearchResultsToExcel = async (exportAllColumns: boolean) => {
    let direction = 'RTL';
    try {
      direction = localStorage.getItem('excel_export_direction') || 'RTL';
    } catch (_) {}
    const isRTL = direction === 'RTL';

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('تحليل وبحث المركبات المخصص', {
      views: [{ rightToLeft: isRTL }]
    });

    const columnsToExport = COLUMNS_DEF.filter(c => exportAllColumns || visibleColumns[c.key]);

    // Setup sheet columns with custom fitting widths to prevent truncating
    worksheet.columns = columnsToExport.map(col => {
      let width = 15;
      if (col.key === 'brandModel') width = 25;
      else if (col.key === 'vin') width = 22;
      else if (col.key === 'cardNumber') width = 18;
      else if (col.key === 'plateNumber') width = 16;
      else if (col.key === 'supplier') width = 24;
      else if (col.key === 'ownershipType') width = 18;
      else if (col.key === 'price' || col.key === 'costPrice') width = 16;
      else if (col.key === 'status') width = 14;
      else if (col.key === 'year') width = 10;
      else if (col.key === 'color') width = 12;
      
      return {
        header: col.label,
        key: col.key,
        width: width
      };
    });

    // Helper to get Excel column letters dynamically
    const getExcelColumnName = (colNum: number) => {
      let columnName = "";
      while (colNum > 0) {
        let rem = (colNum - 1) % 26;
        columnName = String.fromCharCode(65 + rem) + columnName;
        colNum = Math.floor((colNum - rem) / 26);
      }
      return columnName;
    };
    const lastColLetter = getExcelColumnName(columnsToExport.length);

    // Title Block Banner Row 2
    worksheet.insertRow(1, []);
    worksheet.insertRow(2, []);
    const mergeRangeTitle = `A2:${lastColLetter}2`;
    worksheet.mergeCells(mergeRangeTitle);
    const titleCell = worksheet.getCell('A2');
    titleCell.value = 'تقرير استخراج وبحث المركبات الذكي والمطور';
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }; // Deep Royal Navy background
    titleCell.alignment = { vertical: 'middle', horizontal: 'center', readingOrder: isRTL ? 'rtl' : 'ltr' };
    worksheet.getRow(2).height = 36;

    // Subtitle Block Row 3
    const mergeRangeSub = `A3:${lastColLetter}3`;
    worksheet.mergeCells(mergeRangeSub);
    const subtitleCell = worksheet.getCell('A3');
    subtitleCell.value = `إجمالي عدد المطابقات: ${sortedCars.length} سيارة | تاريخ التصدير: ${new Date().toLocaleDateString('ar-EG')} - ${new Date().toLocaleTimeString('ar-EG')}`;
    subtitleCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF475569' } };
    subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }; // Light Slate background
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'center', readingOrder: isRTL ? 'rtl' : 'ltr' };
    worksheet.getRow(3).height = 24;

    worksheet.insertRow(4, []); // Spacer Row 4
    worksheet.getRow(4).height = 12;

    // 4 Dynamic-Span Beautiful Top KPI Cards (Rows 5 and 6)
    const kpiCards = [
      { label: 'إجمالي السيارات المطابقة', value: sortedCars.length, isCurrency: false, bgColor: 'FFF0F9FF', textColor: 'FF0284C7', format: '#,##0" سيارة"' },
      { label: 'إجمالي القيمة التقديرية للبيع', value: resultsStats.salesTotal, isCurrency: true, bgColor: 'FFE8F5E9', textColor: 'FF2E7D32', format: '#,##0" ر.س"' },
      { label: 'إجمالي كلفة المخزون المالي', value: resultsStats.costTotal, isCurrency: true, bgColor: 'FFF5F5F5', textColor: 'FF424242', format: '#,##0" ر.س"' },
      { label: 'صافي عوائد الأرباح المتوقعة', value: resultsStats.expectedProfit, isCurrency: true, bgColor: 'FFE8EAF6', textColor: 'FF3F51B5', format: '#,##0" ر.س"' }
    ];

    const colSpan = Math.max(1, Math.floor(columnsToExport.length / 4));
    worksheet.getRow(5).height = 20;
    worksheet.getRow(6).height = 28;

    for (let i = 0; i < 4; i++) {
      const startCol = i * colSpan + 1;
      const endCol = i === 3 ? columnsToExport.length : (i + 1) * colSpan;
      if (startCol > columnsToExport.length) break;

      const startColLetter = getExcelColumnName(startCol);
      const endColLetter = getExcelColumnName(endCol);

      // Label (Row 5)
      const labelRange = `${startColLetter}5:${endColLetter}5`;
      worksheet.mergeCells(labelRange);
      const labelCell = worksheet.getCell(`${startColLetter}5`);
      labelCell.value = kpiCards[i].label;
      labelCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF595959' } };
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpiCards[i].bgColor } };
      labelCell.alignment = { vertical: 'middle', horizontal: 'center', readingOrder: isRTL ? 'rtl' : 'ltr' };
      labelCell.border = {
        top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
      };

      // Value (Row 6)
      const valueRange = `${startColLetter}6:${endColLetter}6`;
      worksheet.mergeCells(valueRange);
      const valueCell = worksheet.getCell(`${startColLetter}6`);
      valueCell.value = kpiCards[i].value;
      valueCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: kpiCards[i].textColor } };
      valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpiCards[i].bgColor } };
      valueCell.alignment = { vertical: 'middle', horizontal: 'center', readingOrder: isRTL ? 'rtl' : 'ltr' };
      valueCell.numFmt = kpiCards[i].format;
      valueCell.border = {
        bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
      };
    }

    worksheet.addRow([]); // Row 7 - empty spacer
    worksheet.getRow(7).height = 15;

    // Add Grid Headers Row (Row 8)
    const headerRowValues = columnsToExport.map(c => c.label);
    const gridHeaderRow = worksheet.addRow(headerRowValues);
    gridHeaderRow.height = 30;
    gridHeaderRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; // Slate-900 beautiful dark luxury
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF334155' } },
        bottom: { style: 'medium', color: { argb: 'FF334155' } },
        left: { style: 'thin', color: { argb: 'FF334155' } },
        right: { style: 'thin', color: { argb: 'FF334155' } }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center', readingOrder: isRTL ? 'rtl' : 'ltr' };
    });

    // Add Data items (Rows 9+)
    sortedCars.forEach((car, index) => {
      const rowVal = columnsToExport.map(col => {
        switch (col.key) {
          case 'brandModel': return formatVehicleDisplay(car);
          case 'year': return car.year;
          case 'color': return car.color;
          case 'vin': return car.vin;
          case 'cardNumber': return car.cardNumber || '-';
          case 'plateNumber': return car.plateData?.plateNumber || 'بدون لوحة';
          case 'ownershipType': return car.ownershipType || '-';
          case 'price': return car.price !== undefined && car.price !== null ? Number(car.price) : 0;
          case 'costPrice': return car.costPrice !== undefined && car.costPrice !== null ? Number(car.costPrice) : 0;
          case 'status': return car.status;
          case 'rentalStatus': return car.rentalStatus === RentalStatus.RENTED ? 'مجيرة' : 'غير مجيرة';
          case 'isPresentInShowroom': return car.isPresentInShowroom ? 'داخل المعرض' : 'خارج المعرض';
          case 'supplier': return car.supplier || '-';
          case 'entryDate': return car.entryDate ? new Date(car.entryDate).toLocaleDateString('ar-EG') : '-';
          default: return '';
        }
      });

      const added = worksheet.addRow(rowVal);
      added.height = 22;
      const isEvenRow = index % 2 === 1;

      added.eachCell((cell, colIndex) => {
        const colDef = columnsToExport[colIndex - 1];
        
        // Fonts and general colors
        cell.font = { name: 'Arial', size: 10, color: { argb: 'FF1E293B' } };
        
        // Zebra striping background styling
        if (isEvenRow) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; // Soft light slate-50
        }

        // Alignments matching specific field types
        const isNumeric = colDef.key === 'price' || colDef.key === 'costPrice' || colDef.key === 'year';
        cell.alignment = { 
          vertical: 'middle', 
          horizontal: isNumeric ? 'center' : (isRTL ? 'right' : 'left'), 
          readingOrder: isRTL ? 'rtl' : 'ltr' 
        };

        // Pricing column styling & cell format compatibility
        if (colDef.key === 'price' || colDef.key === 'costPrice') {
          cell.numFmt = '#,##0" ر.س"';
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: colDef.key === 'price' ? 'FF059669' : 'FF475569' } }; // Emerald for price, Slate for cost
        }

        // Monospace code looks for critical tracking identifiers
        if (colDef.key === 'vin' || colDef.key === 'cardNumber' || colDef.key === 'plateNumber') {
          cell.font = { name: 'Consolas', size: 10, bold: true, color: { argb: 'FF0F172A' } };
        }

        // Status pill highlight coloring simulated in Excel
        if (colDef.key === 'status') {
          const sVal = String(cell.value);
          let colorHex = 'FF1E293B'; // neutral
          if (sVal.includes('متوفر') || sVal.toLowerCase().includes('avail')) {
            colorHex = 'FF059669'; // Emerald
          } else if (sVal.includes('محجوز') || sVal.toLowerCase().includes('reserv')) {
            colorHex = 'FFD97706'; // Amber
          } else if (sVal.includes('مباع') || sVal.toLowerCase().includes('sold')) {
            colorHex = 'FFDC2626'; // Red
          }
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: colorHex } };
        }

        // Set cell borders cleanly
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        };
      });
    });

    // Add professional ledgers Total row with a double bottom border
    const totalsRowValues = columnsToExport.map((col, idx) => {
      if (idx === 0) return 'المجموع الإجمالي لمعروض السرد المطبّق:';
      if (col.key === 'price') return resultsStats.salesTotal;
      if (col.key === 'costPrice') return resultsStats.costTotal;
      return '';
    });
    
    const totalsRow = worksheet.addRow(totalsRowValues);
    totalsRow.height = 26;
    totalsRow.eachCell((cell, colIdx) => {
      const colDef = columnsToExport[colIdx - 1];
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }; // Sleek light gray
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'double', color: { argb: 'FF0F172A' } }, // Double line representing net balance
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
      
      if (colDef.key === 'price' || colDef.key === 'costPrice') {
        cell.numFmt = '#,##0" ر.س"';
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colIdx === 1) {
        cell.alignment = { vertical: 'middle', horizontal: isRTL ? 'right' : 'left', readingOrder: isRTL ? 'rtl' : 'ltr' };
      }
    });

    workbook.worksheets.forEach(ws => {
      ExcelService.formatWorksheet(ws, { isRTL });
    });

    // Save and download
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `تحليل_المركبات_المطور_${new Date().toISOString().split('T')[0]}.xlsx`;
    const blob = new Blob([buffer]);
    saveAs(blob, fileName);
  };

  // Reusable High-Fidelity safePrint helper utilizing a hidden background iframe proxy to prevent webview / EXE about:blank popups
  const safePrint = (html: string) => {
    const cleanHtml = html
      .replace(/window\.close\(\);?/gi, '')
      .replace(/window\.print\(\);?/gi, '')
      .trim();

    if (typeof (window as any).showPrintPreview === 'function') {
      (window as any).showPrintPreview(cleanHtml);
      return;
    }

    const iframeHtml = cleanHtml;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.bottom = '0';
    iframe.style.right = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.zIndex = '-9999';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(iframeHtml);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (err) {
          console.error('Print failed:', err);
        }
        setTimeout(() => {
          try {
            if (iframe.parentNode) {
              document.body.removeChild(iframe);
            }
          } catch (e) {
            console.error('Iframe removal error:', e);
          }
        }, 3000);
      }, 500);
    }
  };

  // Direct High-Fidelity Printable Layout with RTL matching using safePrint iframe
  const printSearchResults = (printAllColumns: boolean) => {
    const columnsToPrint = COLUMNS_DEF.filter(c => printAllColumns || visibleColumns[c.key]);

    let tableHeaderHtml = columnsToPrint.map(col => `
      <th style="background-color: #cbdcf0; color: #011d33; padding: 10px; border: 1px solid #94a3b8; font-weight: 900; text-align: center;">
        ${col.label}
      </th>
    `).join('');

    let tableRowsHtml = '';

    const renderRowHtml = (car: CarType, index: number) => {
      const tdCells = columnsToPrint.map(col => {
        let value = '';
        switch (col.key) {
          case 'brandModel': value = formatVehicleDisplay(car); break;
          case 'year': value = String(car.year); break;
          case 'color': value = car.color; break;
          case 'vin': value = `<span style="font-family: monospace; font-size: 10px; font-weight: bold;">${car.vin}</span>`; break;
          case 'cardNumber': value = car.cardNumber || '-'; break;
          case 'plateNumber': value = car.plateData?.plateNumber || 'بدون لوحة'; break;
          case 'ownershipType': value = car.ownershipType || '-'; break;
          case 'price': value = `<b>${(car.price ?? 0).toLocaleString()} ر.س</b>`; break;
          case 'costPrice': value = `${(car.costPrice ?? 0).toLocaleString()} ر.س`; break;
          case 'status': value = `<span style="color: ${car.status === CarStatus.AVAILABLE ? 'green' : car.status === CarStatus.RESERVED ? 'orange' : 'red'}; font-weight: 900;">${car.status}</span>`; break;
          case 'rentalStatus': value = car.rentalStatus === RentalStatus.RENTED ? 'مجيرة' : 'غير مجيرة'; break;
          case 'isPresentInShowroom': value = car.isPresentInShowroom ? 'داخل المعرض' : 'خارج المعرض'; break;
          case 'supplier': value = car.supplier || '-'; break;
          case 'entryDate': value = car.entryDate ? new Date(car.entryDate).toLocaleDateString('ar-EG') : '-'; break;
        }
        return `<td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">${value}</td>`;
      }).join('');

      return `<tr>${tdCells}</tr>`;
    };

    if (groupByField !== 'none' && groupedCars) {
      Object.entries(groupedCars).forEach(([groupName, carsList]) => {
        tableRowsHtml += `
          <tr style="background-color: #f1f5f9;">
            <td colspan="${columnsToPrint.length}" style="padding: 10px; font-weight: 900; color: #1e3a8a; text-align: right; border: 1px solid #cbd5e1;">
              📂 المجموعة: ${groupName} (${carsList.length} مركبة)
            </td>
          </tr>
        `;
        carsList.forEach((car, idx) => {
          tableRowsHtml += renderRowHtml(car, idx);
        });
      });
    } else {
      sortedCars.forEach((car, idx) => {
        tableRowsHtml += renderRowHtml(car, idx);
      });
    }

    const printHtmlContent = `
      <html dir="rtl" lang="ar">
        <head>
          <title>طباعة تقرير البحث ومطابقة المركبات</title>
          <style>
            body { font-family: 'Arial', sans-serif; padding: 25px; color: #1e293b; background-color: #fff; }
            h1 { color: #1e3a8a; font-size: 18pt; margin-bottom: 5px; font-weight: 900; text-align: center; }
            .meta-bar { display: flex; justify-content: space-between; font-size: 10pt; color: #64748b; border-bottom: 2px solid #cbd5e1; padding-bottom: 12px; margin-bottom: 20px; font-weight: bold;}
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 10pt; }
            .stats-card { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin-bottom: 25px; display: flex; justify-content: space-around; font-weight: bold; font-size: 10pt; }
            .footer-info { text-align: center; font-size: 8pt; color: #94a3b8; font-weight: bold; border-top: 1px dashed #cbd5e1; padding-top: 10px; margin-top: 20px; }
            @media print {
              input, button, select { display: none !important; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <h1>تقرير تصفية وبحث المركبات المتقدم والمطابقة</h1>
          <div class="meta-bar">
            <span>إجمالي مطابقة البحث: <b>${sortedCars.length}</b> سيارات</span>
            <span>تاريخ الطباعة: <b>${new Date().toLocaleDateString('ar-EG') + " " + new Date().toLocaleTimeString('ar-EG')}</b></span>
          </div>

          <div class="stats-card">
            <span>إجمالي قيمة المبيعات الظاهرة: <b>${resultsStats.salesTotal.toLocaleString()} ر.س</b></span>
            <span>إجمالي قيمة التكلفة: <b>${resultsStats.costTotal.toLocaleString()} ر.س</b></span>
            <span>الأرباح المتوقعة: <b style="color: green;">${resultsStats.expectedProfit.toLocaleString()} ر.س</b></span>
          </div>

          <table>
            <thead>
              <tr>${tableHeaderHtml}</tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>

          <div class="footer-info">
            تم التوليد إلكترونياً بواسطة نظام الكاشير والمخزون الذكي الموحد - جميع الحقوق محفوظة لجهة الملكية
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `;

    safePrint(printHtmlContent);
  };

  // Car thumbnail dynamic rendering based on active color
  const renderCarImagePreview = (car: CarType) => {
    if (car.cardFile && car.cardFile.startsWith('data:image/')) {
      return (
        <img 
          src={car.cardFile} 
          alt={car.brand} 
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover rounded-xl border border-slate-100 dark:border-slate-800" 
        />
      );
    }
    const colorMap: Record<string, string> = {
      'أبيض': '#F8FAFC', 'white': '#FFFFFF',
      'أسود': '#1E293B', 'black': '#0F172A',
      'فضي': '#CBD5E1', 'silver': '#E2E8F0',
      'أحمر': '#EF4444', 'red': '#DC2626',
      'أزرق': '#3B82F6', 'blue': '#2563EB',
      'رمادي': '#64748B', 'gray': '#475569',
      'ذهبي': '#F59E0B', 'gold': '#D97706',
    };
    const physicalColor = colorMap[car.color] || '#3B82F6';
    return (
      <div className="w-full h-full bg-slate-50 dark:bg-slate-900/40 rounded-xl flex items-center justify-center border border-slate-100 dark:border-slate-800">
        <Car size={24} style={{ color: physicalColor, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.15))' }} />
      </div>
    );
  };

  return (
    <div className="space-y-8 text-start max-w-7xl mx-auto pb-16">
      
      {/* 1. Header Banner of Smart Search Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-tr from-emerald-600 to-teal-600 rounded-2xl text-white shadow-lg">
              <Sparkles size={24} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-800 dark:text-white">
                البحث الذكي وتحليل بيانات المركبات
              </h1>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 mt-1">
                <Cpu size={14} className="text-emerald-500 animate-pulse" />
                <span>
                  فهرسة وإسناد ذكي لـ (<span className="text-emerald-600 font-extrabold">{indexMeta.totalCarsCount.toLocaleString()}</span>) مركبة خلال <span className="text-teal-600 font-black">{indexMeta.timeMs}ms</span>
                </span>
                <span className="text-slate-300 dark:text-slate-800">|</span>
                <span className="text-slate-450">قسم معزول كلياً لا يؤثر على التقارير أو الفواتير</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dev sandbox performance trigger */}
        <div className="flex gap-2">
          <button 
            onClick={() => {
              setPerformanceTestMode(prev => !prev);
              setSelectedCar(null);
            }}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl font-black text-xs transition-all border shadow-sm ${
              performanceTestMode 
                ? 'bg-amber-500/15 text-amber-600 border-amber-500/30 dark:border-amber-500/20 shadow-amber-500/5' 
                : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200/60 dark:border-slate-800'
            }`}
          >
            <Database size={15} className={performanceTestMode ? 'animate-bounce' : ''} />
            <span>
              {performanceTestMode ? 'إيقاف الاختبار (إرجاع للبيانات الفعلية)' : 'محاكاة اختبار أداء بـ (105,000 سيارة)'}
            </span>
          </button>
        </div>
      </div>

      {/* 2. Visual Aggregations & Dashboard of Filtered Result */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-5 rounded-3xl space-y-1 shadow-sm">
          <span className="text-xs font-bold text-slate-450 block">المركبات المطابقة للمكعب</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-800 dark:text-white">
              {resultsStats.count.toLocaleString()} <span className="text-xs font-bold text-slate-400">سيارة</span>
            </span>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
              {((resultsStats.count / indexMeta.totalCarsCount) * 100).toFixed(1)}% من الأساس
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-5 rounded-3xl space-y-1 shadow-sm">
          <span className="text-xs font-bold text-slate-450 block text-emerald-600">تقديرات المبيعات الكلية</span>
          <div className="flex items-baseline">
            <span className="text-2xl font-black text-emerald-600">
              {resultsStats.salesTotal.toLocaleString()} <span className="text-xs font-bold text-slate-400">ر.س</span>
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-5 rounded-3xl space-y-1 shadow-sm">
          <span className="text-xs font-bold text-slate-450 block text-blue-500">مجموع قيم التكلفة</span>
          <div className="flex items-baseline">
            <span className="text-2xl font-black text-blue-500">
              {resultsStats.costTotal.toLocaleString()} <span className="text-xs font-bold text-slate-400">ر.س</span>
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-5 rounded-3xl space-y-1 shadow-sm">
          <span className="text-xs font-bold text-slate-450 block text-teal-600">الأرباح التقديرية والهامش</span>
          <div className="flex items-baseline justify-between w-full">
            <span className="text-2xl font-black text-teal-600">
              {resultsStats.expectedProfit.toLocaleString()} <span className="text-xs font-bold text-slate-400">ر.س</span>
            </span>
            <span className="text-[10px] bg-teal-500/10 text-teal-500 px-2 py-0.5 rounded-lg font-bold">
              {resultsStats.salesTotal > 0 ? ((resultsStats.expectedProfit / resultsStats.salesTotal) * 100).toFixed(1) : 0}% هامش
            </span>
          </div>
        </div>
      </div>

      {/* 3. Main Split Center Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* SIDE BAR (Query Shortcuts & Saved Custom Templates) */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* A. PREDEFINED EXAMPLES Short Panel */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl space-y-4 shadow-sm">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5 border-b border-slate-50 dark:border-slate-850 pb-3">
              <Filter size={14} className="text-emerald-500" />
              أمثلة وحالات البحث الجاهزة
            </h3>
            
            <div className="space-y-1.5 max-h-[350px] overflow-y-auto pr-1 text-xs">
              <button 
                onClick={() => loadQuickSearchShortcut('noCustoms')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold transition-all text-right"
              >
                <span>المركبات بدون بطاقة جمركية</span>
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-lg text-[10px]">
                  {quickSearchCounts.noCustoms}
                </span>
              </button>

              <button 
                onClick={() => loadQuickSearchShortcut('notTransferred')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold transition-all text-right"
              >
                <span>المركبات التي لم يتم تجييرها</span>
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-lg text-[10px]">
                  {quickSearchCounts.notTransferred}
                </span>
              </button>

              <button 
                onClick={() => loadQuickSearchShortcut('transferred')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold transition-all text-right"
              >
                <span>المركبات التي تم تجييرها</span>
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-lg text-[10px]">
                  {quickSearchCounts.transferred}
                </span>
              </button>

              <button 
                onClick={() => loadQuickSearchShortcut('noLicencePlate')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold transition-all text-right"
              >
                <span>المركبات بدون لوحة</span>
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-lg text-[10px]">
                  {quickSearchCounts.noLicencePlate}
                </span>
              </button>

              <button 
                onClick={() => loadQuickSearchShortcut('noInsurance')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold transition-all text-right"
              >
                <span>المركبات بدون تأمين</span>
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-lg text-[10px]">
                  {quickSearchCounts.noInsurance}
                </span>
              </button>

              <button 
                onClick={() => loadQuickSearchShortcut('noLocationYards')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold transition-all text-right"
              >
                <span>المركبات بدون موقع / ساحة</span>
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-lg text-[10px]">
                  {quickSearchCounts.noLocationYards}
                </span>
              </button>

              <button 
                onClick={() => loadQuickSearchShortcut('inShowroom')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold transition-all text-right"
              >
                <span>المركبات الموجودة داخل المعرض</span>
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-lg text-[10px]">
                  {quickSearchCounts.inShowroom}
                </span>
              </button>

              <button 
                onClick={() => loadQuickSearchShortcut('outShowroom')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold transition-all text-right"
              >
                <span>المركبات الموجودة خارج المعرض</span>
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-lg text-[10px]">
                  {quickSearchCounts.outShowroom}
                </span>
              </button>

              <button 
                onClick={() => loadQuickSearchShortcut('sold')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold transition-all text-right"
              >
                <span>المركبات المباعة</span>
                <span className="bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded-lg text-[10px]">
                  {quickSearchCounts.sold}
                </span>
              </button>

              <button 
                onClick={() => loadQuickSearchShortcut('unsold')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold transition-all text-right"
              >
                <span>المركبات غير المباعة</span>
                <span className="bg-emerald-500/10 text-emerald-550 px-2 py-0.5 rounded-lg text-[10px]">
                  {quickSearchCounts.unsold}
                </span>
              </button>

              <button 
                onClick={() => loadQuickSearchShortcut('reserved')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold transition-all text-right"
              >
                <span>المركبات المحجوزة</span>
                <span className="bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-lg text-[10px]">
                  {quickSearchCounts.reserved}
                </span>
              </button>

              <button 
                onClick={() => loadQuickSearchShortcut('missingData')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-rose-500 dark:text-rose-455 font-bold transition-all text-right"
              >
                <span>مركبات ذات بيانات ناقصة</span>
                <span className="bg-rose-500/15 text-rose-600 px-2 py-0.5 rounded-lg text-[10px]">
                  {quickSearchCounts.missingData}
                </span>
              </button>

              <button 
                onClick={() => loadQuickSearchShortcut('vinCompliant')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold transition-all text-right"
              >
                <span>متطابقة مع الجمارك</span>
                <span className="bg-indigo-500/10 text-indigo-500 px-2 py-0.5 rounded-lg text-[10px]">
                  {quickSearchCounts.vinCompliant}
                </span>
              </button>
            </div>
          </div>

          {/* B. SAVED TEMPLATES */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-850 pb-3">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                <Clock size={14} className="text-emerald-500" />
                قوالب استعلاماتي المخصصة
              </h3>
              {conditions.length > 0 && (
                <button 
                  onClick={() => setShowSaveTemplateModal(true)}
                  className="p-1 hover:text-emerald-600 text-slate-400 transition-colors"
                  title="حفظ الاستعلام الحالي كقالب"
                >
                  <Save size={15} />
                </button>
              )}
            </div>

            {savedTemplates.length === 0 ? (
              <p className="text-[11px] text-slate-400 font-bold text-center py-4 bg-slate-50 dark:bg-slate-950/20 rounded-xl border border-dashed border-slate-100 dark:border-slate-850">
                لا توجد قوالب مخصصة محفوظة حالياً.
              </p>
            ) : (
              <div className="space-y-1 max-h-[250px] overflow-y-auto">
                {savedTemplates.map(tmpl => (
                  <div 
                    key={tmpl.id}
                    onClick={() => loadTemplate(tmpl)}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-850/50 cursor-pointer text-xs"
                  >
                    <span className="font-extrabold text-slate-700 dark:text-slate-300 truncate max-w-[130px]" title={tmpl.name}>
                      {tmpl.name}
                    </span>
                    <button 
                      onClick={(e) => deleteTemplate(e, tmpl.id)}
                      className="text-rose-500 hover:text-rose-700 p-1"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CENTRAL MASTER PANEL (Multi-condition Builder + Visual Tables + Grouping + Exports) */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* A. Dynamic Query Builder Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-105 dark:border-slate-805 p-6 rounded-[2rem] shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-50 dark:border-slate-850 pb-4">
              <div>
                <h3 className="font-black text-slate-850 dark:text-white text-base">بناء شروط التصفية المتقدمة</h3>
                <p className="text-xs text-slate-400 font-bold mt-0.5">يمكنك إضافة شروط استقصائية مركبة وتحديد حقول وعلاقات مع تفريغ فوري للبيانات</p>
              </div>

              {/* Clear / Add condition widgets */}
              <div className="flex gap-2 font-bold text-xs shrink-0 pt-2 sm:pt-0">
                {conditions.length > 0 && (
                  <button 
                    onClick={() => setConditions([])} 
                    className="px-3 py-2 text-rose-500 border border-rose-500/20 hover:bg-rose-500/5 rounded-xl transition-all flex items-center gap-1.5"
                  >
                    <RotateCcw size={13} />
                    إعادة تعيين كاملة
                  </button>
                )}
                
                <button 
                  onClick={() => addCondition()}
                  className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-500 rounded-xl transition-all shadow-md flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  إضافة شرط للمكعب
                </button>
              </div>
            </div>

            {/* Logical Join relation types selectors */}
            {conditions.length > 1 && (
              <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-950/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-850/80 text-xs">
                <span className="font-extrabold text-slate-450">علاقة الربط للمصفوفة:</span>
                <div className="flex gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                    <input 
                      type="radio" 
                      name="joinType" 
                      value="and" 
                      checked={joinType === 'and'} 
                      onChange={() => setJoinType('and')} 
                      className="accent-emerald-600"
                    />
                    <span>مطابقة جميع الشروط (و) AND</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                    <input 
                      type="radio" 
                      name="joinType" 
                      value="or" 
                      checked={joinType === 'or'} 
                      onChange={() => setJoinType('or')} 
                      className="accent-emerald-600"
                    />
                    <span>مطابقة أي من الشروط (أو) OR</span>
                  </label>
                </div>
              </div>
            )}

            {/* Conditions input list area */}
            {conditions.length === 0 ? (
              <div className="py-8 text-center text-slate-400 bg-slate-50/50 dark:bg-slate-950/20 border-2 border-dashed border-slate-200 dark:border-slate-850 rounded-2xl">
                <p className="text-xs font-bold">لم يتم تأسيس أي شروط بحث بعد.</p>
                <p className="text-[10px] text-slate-400 mt-1">اضغط على زر (إضافة شرط) أو حدد أحد (أمثلة البحث الجاهزة) على اليمين للبدء.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {conditions.map((cond, idx) => {
                  const targetFieldDef = SEARCH_FIELDS.find(f => f.value === cond.field);
                  const isNumField = targetFieldDef?.type === 'number';
                  const isSelectField = targetFieldDef?.type === 'select';
                  const isBoolField = targetFieldDef?.type === 'boolean';

                  return (
                    <div 
                      key={cond.id} 
                      className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-slate-50/50 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-100/60 dark:border-slate-800/80 text-xs font-bold"
                    >
                      {/* Badge indicator */}
                      <span className="w-6 h-6 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center font-bold text-[10px] text-slate-550 shrink-0">
                        {idx + 1}
                      </span>

                      {/* Field selection dropdown */}
                      <select 
                        value={cond.field}
                        onChange={(e) => updateCondition(cond.id, { field: e.target.value })}
                        className="p-2 border dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-emerald-500 shrink-0 select-text max-w-[130px]"
                      >
                        {SEARCH_FIELDS.map(f => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>

                      {/* Operator selection dropdown guided by types */}
                      <select 
                        value={cond.operator}
                        onChange={(e) => updateCondition(cond.id, { operator: e.target.value as any })}
                        className="p-2 border dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-emerald-500 shrink-0 select-text max-w-[110px]"
                      >
                        {OPERATORS.filter(op => {
                          if (isBoolField) return op.value === 'equals' || op.value === 'not_equals';
                          if (isSelectField) return op.value === 'equals' || op.value === 'not_equals';
                          if (isNumField) return true; // Numbers have all operators
                          
                          // Texts do not have greater, less or between
                          return op.value !== 'greater_than' && op.value !== 'less_than' && op.value !== 'between';
                        }).map(op => (
                          <option key={op.value} value={op.value}>{op.label}</option>
                        ))}
                      </select>

                      {/* Values Input controls guided by types */}
                      {cond.operator !== 'is_empty' && cond.operator !== 'is_not_empty' && (
                        <div className="flex-1 flex gap-2 w-full sm:w-auto">
                          {isBoolField ? (
                            <select 
                              value={cond.value}
                              onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                              className="w-full sm:w-44 p-2 border dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-emerald-500"
                            >
                              <option value="true">نعم</option>
                              <option value="false">لا</option>
                            </select>
                          ) : isSelectField ? (
                            <select 
                              value={cond.value}
                              onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                              className="w-full sm:w-44 p-2 border dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-emerald-500"
                            >
                              {(targetFieldDef?.options || []).map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : cond.operator === 'between' ? (
                            <div className="flex items-center gap-2 w-full">
                              <input 
                                type="number" 
                                placeholder="من"
                                value={cond.value}
                                onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                                className="w-full p-2 border dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-emerald-500"
                              />
                              <input 
                                type="number" 
                                placeholder="إلى"
                                value={cond.value2 || ''}
                                onChange={(e) => updateCondition(cond.id, { value2: e.target.value })}
                                className="w-full p-2 border dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-emerald-500"
                              />
                            </div>
                          ) : (
                            <input 
                              type={isNumField ? 'number' : 'text'}
                              placeholder="أدخل القيمة..."
                              value={cond.value}
                              onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                              className="w-full p-2 border dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-emerald-500"
                            />
                          )}
                        </div>
                      )}

                      {/* Remove condition */}
                      <button 
                        onClick={() => removeCondition(cond.id)}
                        className="p-2 text-rose-500 hover:text-rose-700 bg-white dark:bg-slate-850 hover:bg-rose-500/10 rounded-xl transition-all border border-slate-100 dark:border-slate-750/30"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* B. Secondary filter bar & Show Hide columns & Export buttons panel */}
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-850 p-4 rounded-3xl flex flex-wrap gap-3 items-center justify-between text-xs font-bold text-slate-705">
            
            {/* Search string inside filter */}
            <div className="relative flex-1 min-w-[200px]">
              <div className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-slate-400">
                <Search size={14} />
              </div>
              <input 
                type="text" 
                placeholder="تصفية نصية مخصصة ثانوية داخل النتائج المطبقة..." 
                value={textFilter}
                onChange={(e) => setTextFilter(e.target.value)}
                className="w-full py-2.5 pr-10 pl-4 bg-white dark:bg-slate-950 text-slate-800 dark:text-white rounded-2xl border border-slate-2 w-full outline-none focus:border-emerald-500 text-[11px] font-bold"
              />
              {textFilter && (
                <button 
                  onClick={() => setTextFilter('')} 
                  className="absolute inset-y-0 left-3 flex items-center text-slate-400 hover:text-rose-500"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Custom Layout Groupings and columns show controls */}
            <div className="flex flex-wrap items-center gap-3">
              
              {/* Grouping Select */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-slate-450">تجميع حسب:</span>
                <select 
                  value={groupByField}
                  onChange={(e) => setGroupByField(e.target.value)}
                  className="p-2 border bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl outline-none select-text focus:border-emerald-500"
                >
                  <option value="none">بدون تجميع (سرد مسطح)</option>
                  <option value="brand">الماركة الرئيسية</option>
                  <option value="model">الموديل</option>
                  <option value="ownershipType">الوارد / ساحة التخزين</option>
                  <option value="status">حالة التواجد (مباع/متوفر)</option>
                </select>
              </div>

              {/* Toggle columns show popup dropdown drawer (HTML Popover style) */}
              <div className="relative group shrink-0">
                <button 
                  className="px-3.5 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-100 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye size={13} />
                  أعمدة الجدول ({Object.values(visibleColumns).filter(Boolean).length})
                  <ChevronDown size={11} />
                </button>
                <div className="absolute left-0 mt-2 w-56 bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-4 space-y-2 hidden group-focus-within:block hover:block">
                  <span className="text-[10px] font-black uppercase text-slate-400 block pb-1 border-b mb-2">إظهار/إخفاء الأعمدة</span>
                  <div className="max-h-[220px] overflow-y-auto space-y-1.5 text-right font-semibold text-[11px] pr-1">
                    {COLUMNS_DEF.map(col => (
                      <label key={col.key} className="flex items-center gap-2 cursor-pointer py-1 hover:bg-slate-50 dark:hover:bg-slate-900 rounded px-1.5">
                        <input 
                          type="checkbox" 
                          checked={!!visibleColumns[col.key]} 
                          onChange={() => toggleColumnVisibility(col.key)}
                          className="accent-emerald-600 rounded"
                        />
                        <span>{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Export Suite Buttons with selection */}
              <div className="flex gap-1.5">
                
                {/* Print button */}
                <button 
                  onClick={() => printSearchResults(false)} 
                  className="px-3 py-2.5 bg-sky-600 text-white rounded-xl hover:bg-sky-500 transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                  title="طباعة الأعمدة الظاهرة فقط"
                >
                  <Printer size={13} />
                  طباعة
                </button>

                {/* Print All columns button */}
                <button 
                  onClick={() => printSearchResults(true)} 
                  className="px-3 py-2.5 bg-blue-700 text-white rounded-xl hover:bg-blue-600 transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                  title="طباعة التقرير كاملاً (كافة الأعمدة)"
                >
                  <Printer size={13} />
                  كل البيانات
                </button>

                {/* Excel Button */}
                <button 
                  onClick={() => exportSearchResultsToExcel(false)}
                  className="px-3 py-2.5 bg-emerald-700 text-white rounded-xl hover:bg-emerald-600 transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                  title="تصدير مصفوفة الأعمدة الظاهرة فقط لملف Excel"
                >
                  <FileSpreadsheet size={13} />
                  إكسيل
                </button>

                {/* Excel All Button */}
                <button 
                  onClick={() => exportSearchResultsToExcel(true)}
                  className="px-3 py-2.5 bg-emerald-800 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                  title="تصدير كافة حقول قاعدة البيانات المخفية والظاهرة لملف Excel كلي"
                >
                  <FileSpreadsheet size={13} />
                  إكسيل الكلي
                </button>
              </div>

            </div>
          </div>

          {/* C. Results List Drawer / Master Table Grid layout */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-3xl shadow-sm overflow-hidden space-y-4">
            
            {sortedCars.length === 0 ? (
              <div className="p-16 text-center space-y-3">
                <div className="w-12 h-12 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto text-rose-500">
                  <BadgeAlert size={24} />
                </div>
                <h4 className="font-extrabold text-sm text-slate-800 dark:text-white">لم نجد أي مركبات مطابقة للشروط المطبقة</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto font-bold">لا تتوفر سيارات تتماشى مع شروط المكعب المحددة. يرجى تعديل أو إضافة شروط بديلة.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs text-slate-650 font-bold">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950/70 text-slate-450 border-b border-slate-100 dark:border-slate-850 select-none">
                      <th className="p-3 w-[47px] min-w-[47px] max-w-[47px] font-black text-center">#</th>
                      {visibleColumns.brandModel && (
                        <th onClick={() => triggerSort('brand')} className="p-3 font-extrabold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 text-right">
                          <span className="flex items-center gap-1">المركبة {sortByField === 'brand' && (sortDirection === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}</span>
                        </th>
                      )}
                      {visibleColumns.year && (
                        <th onClick={() => triggerSort('year')} className="p-3 font-extrabold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 text-center">
                          <span className="flex items-center justify-center gap-1">الموديل {sortByField === 'year' && (sortDirection === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}</span>
                        </th>
                      )}
                      {visibleColumns.color && <th className="p-3 font-extrabold text-center">اللون</th>}
                      {visibleColumns.vin && (
                        <th onClick={() => triggerSort('vin')} className="p-3 font-extrabold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 text-center">
                          <span className="flex items-center justify-center gap-1">رقم الهيكل VIN {sortByField === 'vin' && (sortDirection === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}</span>
                        </th>
                      )}
                      {visibleColumns.cardNumber && <th className="p-3 font-extrabold text-center">البطاقة الجمركية</th>}
                      {visibleColumns.plateNumber && <th className="p-3 font-extrabold text-center">رقم اللوحة</th>}
                      {visibleColumns.ownershipType && <th className="p-3 font-extrabold text-center">الوارد / الساحة</th>}
                      {visibleColumns.price && (
                        <th onClick={() => triggerSort('price')} className="p-3 font-extrabold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 text-center">
                          <span className="flex items-center justify-center gap-1">سعر البيع {sortByField === 'price' && (sortDirection === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}</span>
                        </th>
                      )}
                      {visibleColumns.costPrice && <th className="p-3 font-extrabold text-center">سعر التكلفة</th>}
                      {visibleColumns.status && <th className="p-3 font-extrabold text-center">حالة السيارة</th>}
                      {visibleColumns.rentalStatus && <th className="p-3 font-extrabold text-center">التجيير</th>}
                      {visibleColumns.isPresentInShowroom && <th className="p-3 font-extrabold text-center">الموقع</th>}
                      {visibleColumns.supplier && <th className="p-3 font-extrabold text-center">المورد</th>}
                      {visibleColumns.entryDate && <th className="p-3 font-extrabold text-center">تاريخ الدخول</th>}
                      <th className="p-3 font-extrabold text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  
                  <tbody>
                    {groupByField === 'none' ? (
                      // المسار العادي سرد مسطح
                      paginatedCars.map((car, index) => {
                        const globalIdx = (currentPage - 1) * itemsPerPage + index + 1;
                        const isSelected = selectedCar?.id === car.id;

                        return (
                          <tr 
                            key={car.id} 
                            onClick={() => setSelectedCar(car)}
                            className={`border-b last:border-0 border-slate-100 dark:border-slate-850 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 cursor-pointer transition-all ${
                              isSelected ? 'bg-indigo-50/30 dark:bg-indigo-950/20' : ''
                            }`}
                          >
                            <td className="p-3 text-center text-slate-400 font-bold w-[47px] min-w-[47px] max-w-[47px]" style={{ width: '47px', minWidth: '47px', maxWidth: '47px' }}>{globalIdx}</td>
                            
                            {visibleColumns.brandModel && (
                              <td className="p-3 text-slate-800 dark:text-white font-extrabold">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 shrink-0">
                                    {renderCarImagePreview(car)}
                                  </div>
                                  <span>{formatVehicleDisplay(car)}</span>
                                </div>
                              </td>
                            )}
                            
                            {visibleColumns.year && <td className="p-3 text-center font-black">{car.year}</td>}
                            {visibleColumns.color && <td className="p-3 text-center">{car.color}</td>}
                            
                            {visibleColumns.vin && (
                              <td className="p-3 text-center font-mono tracking-tighter pr-3">
                                <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-black text-slate-700 dark:text-slate-350">{car.vin}</span>
                              </td>
                            )}
                            
                            {visibleColumns.cardNumber && (
                              <td className="p-3 text-center font-mono">
                                {car.cardNumber ? (
                                  <span className="bg-emerald-500/5 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded">{car.cardNumber}</span>
                                ) : (
                                  <span className="text-rose-500 bg-rose-500/5 px-2 py-0.5 rounded">بدون</span>
                                )}
                              </td>
                            )}
                            
                            {visibleColumns.plateNumber && (
                              <td className="p-3 text-center">
                                {car.plateData?.plateNumber ? (
                                  <span className="bg-sky-500/5 text-sky-600 dark:text-sky-400 px-1.5 py-0.5 rounded font-mono">{car.plateData.plateNumber}</span>
                                ) : (
                                  <span className="text-slate-400 font-normal">بلا لوحة</span>
                                )}
                              </td>
                            )}
                            
                            {visibleColumns.ownershipType && <td className="p-3 text-center">{car.ownershipType || '-'}</td>}
                            
                            {visibleColumns.price && (
                              <td className="p-3 text-center font-black text-indigo-650 dark:text-indigo-400">
                                {(car.price ?? 0).toLocaleString()} ر.س
                              </td>
                            )}
                            
                            {visibleColumns.costPrice && (
                              <td className="p-3 text-center font-black text-slate-600 dark:text-slate-300">
                                {(car.costPrice ?? 0).toLocaleString()} ر.س
                              </td>
                            )}
                            
                            {visibleColumns.status && (
                              <td className="p-3 text-center">
                                <span className={`px-2 py-1 rounded-lg text-[10px] font-black border ${
                                  car.status === CarStatus.AVAILABLE ? 'bg-emerald-500/10 text-emerald-550 border-emerald-500/20' :
                                  car.status === CarStatus.RESERVED ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                  'bg-rose-500/10 text-rose-500 border-rose-500/20'
                                }`}>
                                  {car.status}
                                </span>
                              </td>
                            )}
                            
                            {visibleColumns.rentalStatus && (
                              <td className="p-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] ${
                                  car.rentalStatus === RentalStatus.RENTED ? 'bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                }`}>
                                  {car.rentalStatus === RentalStatus.RENTED ? 'مجيرة' : 'غير مجيرة'}
                                </span>
                              </td>
                            )}
                            
                            {visibleColumns.isPresentInShowroom && (
                              <td className="p-3 text-center text-[11px]">
                                {car.isPresentInShowroom ? (
                                  <span className="text-teal-600 bg-teal-50 dark:bg-teal-950/20 px-2 py-0.5 rounded-full">بالمعرض</span>
                                ) : (
                                  <span className="text-slate-500 bg-slate-100 dark:bg-slate-850 px-2 py-0.5 rounded-full">ساحة خارجية</span>
                                )}
                              </td>
                            )}
                            
                            {visibleColumns.supplier && <td className="p-3 text-center truncate max-w-[120px]">{car.supplier || '-'}</td>}
                            {visibleColumns.entryDate && <td className="p-3 text-center font-mono">{car.entryDate ? new Date(car.entryDate).toLocaleDateString('ar-EG') : '-'}</td>}
                            
                            <td className="p-3 text-center">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedCar(car);
                                }}
                                className="px-2.5 py-1.5 bg-blue-500/10 text-blue-600 font-extrabold hover:bg-blue-600 hover:text-white rounded-lg transition-all"
                              >
                                الخصائص
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      // مسار التجميع والتصنيف المبوب
                      Object.entries(groupedCars || {}).map(([groupName, carsInGroup]) => (
                        <React.Fragment key={groupName}>
                          {/* Header Group */}
                          <tr className="bg-emerald-500/5 dark:bg-slate-950 border-y border-slate-200 dark:border-slate-800">
                            <td colSpan={16} className="p-3 font-black text-slate-800 dark:text-white text-right">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600/10 text-emerald-600 rounded-xl">
                                📂 {groupName} ({carsInGroup.length} سيارة)
                              </span>
                            </td>
                          </tr>
                          {carsInGroup.slice(0, 100).map((car, idx) => (
                            <tr 
                              key={car.id} 
                              onClick={() => setSelectedCar(car)}
                              className="border-b border-slate-100 dark:border-slate-850/60 hover:bg-slate-50 dark:hover:bg-slate-900/40 cursor-pointer"
                            >
                              <td className="p-3 text-center text-slate-400">{idx + 1}</td>
                              
                              {visibleColumns.brandModel && (
                                <td className="p-3 text-slate-850 dark:text-white font-extrabold">
                                  <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 shrink-0">{renderCarImagePreview(car)}</div>
                                    <span>{formatVehicleDisplay(car)}</span>
                                  </div>
                                </td>
                              )}
                              
                              {visibleColumns.year && <td className="p-3 text-center font-black">{car.year}</td>}
                              {visibleColumns.color && <td className="p-3 text-center">{car.color}</td>}
                              {visibleColumns.vin && <td className="p-3 text-center font-mono tracking-tighter"><span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-black text-slate-700">{car.vin}</span></td>}
                              {visibleColumns.cardNumber && <td className="p-3 text-center font-mono">{car.cardNumber || 'بدون'}</td>}
                              {visibleColumns.plateNumber && <td className="p-3 text-center font-mono">{car.plateData?.plateNumber || 'بدون'}</td>}
                              {visibleColumns.ownershipType && <td className="p-3 text-center">{car.ownershipType || '-'}</td>}
                              {visibleColumns.price && <td className="p-3 text-center font-black text-indigo-600">{(car.price ?? 0).toLocaleString()} ر.س</td>}
                              {visibleColumns.costPrice && <td className="p-3 text-center font-black text-slate-500">{(car.costPrice ?? 0).toLocaleString()} ر.س</td>}
                              {visibleColumns.status && <td className="p-3 text-center"><span className="px-2 py-0.5 rounded text-[10px] bg-slate-100">{car.status}</span></td>}
                              {visibleColumns.rentalStatus && <td className="p-3 text-center">{car.rentalStatus === RentalStatus.RENTED ? 'مجيرة' : 'غير مجيرة'}</td>}
                              {visibleColumns.isPresentInShowroom && <td className="p-3 text-center">{car.isPresentInShowroom ? 'معرض' : 'خارجي'}</td>}
                              {visibleColumns.supplier && <td className="p-3 text-center max-w-[120px] truncate">{car.supplier || '-'}</td>}
                              {visibleColumns.entryDate && <td className="p-3 text-center font-mono">{car.entryDate ? new Date(car.entryDate).toLocaleDateString('ar-EG') : '-'}</td>}
                              
                              <td className="p-3 text-center">
                                <button className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[10px]">الخصائص</button>
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Panel (Only shown in Flat LIST mode) */}
            {groupByField === 'none' && sortedCars.length > itemsPerPage && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-850 text-xs font-bold text-slate-450 select-none">
                <div className="flex items-center gap-3">
                  <span>الأصناف المعروضة بالصفحة:</span>
                  <select 
                    value={itemsPerPage} 
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    className="p-1 px-2 border dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-lg outline-none cursor-pointer"
                  >
                    <option value={10}>10 أصناف</option>
                    <option value={25}>25 أصنف</option>
                    <option value={50}>50 صنف</option>
                    <option value={100}>100 صنف</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-2 px-3 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-lg disabled:opacity-50 hover:bg-slate-100 disabled:pointer-events-none transition-all cursor-pointer"
                  >
                    السابق
                  </button>
                  <span>صفحة {currentPage} من {totalPages}</span>
                  <button 
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="p-2 px-3 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-lg disabled:opacity-50 hover:bg-slate-100 disabled:pointer-events-none transition-all cursor-pointer"
                  >
                    التالي
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. DETAILS DRAWER OVERLAY (Right detailed profile slide) */}
      {selectedCar && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm flex items-center justify-end z-[100] animate-in fade-in duration-200">
          <div className="w-full max-w-md h-full bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-850 p-6 flex flex-col justify-between shadow-2xl animate-in slide-in-from-left duration-300">
            
            {/* Top header spec card */}
            <div className="space-y-6 overflow-y-auto max-h-[85vh] pr-1">
              <div className="flex items-center justify-between border-b border-onew dark:border-slate-850 pb-4">
                <span className="text-[11px] font-black uppercase tracking-wider bg-emerald-600 text-white px-2.5 py-1 rounded-full">
                  بطاقة وثائق المركبة التفصيلية
                </span>
                <button 
                  onClick={() => setSelectedCar(null)}
                  className="p-1.5 bg-slate-100 dark:bg-slate-850 text-slate-450 hover:text-rose-500 rounded-lg transition-colors border border-slate-150 dark:border-slate-750"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Cover dynamic thumb */}
              <div className="h-44 w-full relative">
                {selectedCar.cardFile && selectedCar.cardFile.startsWith('data:image/') ? (
                  <img 
                    src={selectedCar.cardFile} 
                    alt={selectedCar.brand} 
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover rounded-2xl border" 
                  />
                ) : (
                  <div className="w-full h-full bg-slate-50 dark:bg-slate-900 rounded-2xl flex flex-col items-center justify-center border text-slate-400 gap-1.5">
                    <Car size={36} className="text-emerald-500" />
                    <span className="text-[10px] font-black">{selectedCar.color}</span>
                  </div>
                )}
              </div>

              {/* Title brand & model */}
              <div>
                <h3 className="text-xl font-black text-slate-800 dark:text-white">{formatVehicleDisplay(selectedCar)}</h3>
                <p className="text-xs text-slate-400 font-bold mt-1">الموديل وسنة الصنع: <span className="text-slate-800 dark:text-white font-black">{selectedCar.year}</span></p>
              </div>

              {/* Params listing */}
              <div className="space-y-3 bg-slate-50/50 dark:bg-slate-950/70 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 text-xs font-bold text-slate-500 space-y-3.5">
                
                <div className="flex items-center justify-between py-1.5 border-b border-dashed border-slate-200/60 dark:border-slate-800">
                  <span>رقم الهيكل VIN :</span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="font-black text-slate-800 dark:text-white">{selectedCar.vin}</span>
                    <button 
                      onClick={() => handleCopy('vin', selectedCar.vin)}
                      className="p-1 hover:text-emerald-500 text-slate-400"
                    >
                      {copiedId === 'vin' ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-dashed border-slate-200/60 dark:border-slate-800">
                  <span>رقم البطاقة الجمركية :</span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="font-black text-slate-800 dark:text-white">{selectedCar.cardNumber || '-'}</span>
                    {selectedCar.cardNumber && (
                      <button 
                        onClick={() => handleCopy('card', selectedCar.cardNumber)}
                        className="p-1 hover:text-emerald-500 text-slate-400"
                      >
                        {copiedId === 'card' ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-dashed border-slate-200/60 dark:border-slate-800">
                  <span>رقم اللوحة المرورية :</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-slate-800 dark:text-white">{selectedCar.plateData?.plateNumber || 'بلا لوحة'}</span>
                    {selectedCar.plateData?.plateNumber && (
                      <button 
                        onClick={() => handleCopy('plate', selectedCar.plateData!.plateNumber)}
                        className="p-1 hover:text-emerald-500 text-slate-400"
                      >
                        {copiedId === 'plate' ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-dashed border-slate-200/60 dark:border-slate-800">
                  <span>الوارد / الساحة الفعلية :</span>
                  <span className="font-black text-slate-800 dark:text-white">{selectedCar.ownershipType || '-'}</span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-dashed border-slate-200/60 dark:border-slate-800">
                  <span>مكان التواجد والفرع :</span>
                  <span className="font-black text-blue-600 dark:text-blue-400">
                    {selectedCar.isPresentInShowroom ? 'داخل فرع المعرض الرئيسي' : 'في الساحة والمستودع المستقل'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-dashed border-slate-200/60 dark:border-slate-800">
                  <span>المورد المورد للمركبة :</span>
                  <span className="font-black text-slate-700 dark:text-slate-300">{selectedCar.supplier || '-'}</span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-dashed border-slate-200/60 dark:border-slate-800">
                  <span>مجموع التكلفة المعيارية :</span>
                  <span className="font-black text-slate-700 dark:text-slate-300">{(selectedCar.costPrice ?? 0).toLocaleString()} ر.س</span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-dashed border-slate-200/60 dark:border-slate-800">
                  <span>قيمة البيع المسعرة :</span>
                  <span className="font-black text-emerald-600">{(selectedCar.price ?? 0).toLocaleString()} ر.س</span>
                </div>

                {selectedCar.notes && (
                  <div className="py-1.5 flex flex-col gap-1">
                    <span>ملاحظات وعلامة جردية:</span>
                    <span className="p-2.5 bg-white dark:bg-slate-900 border text-slate-650 leading-relaxed rounded-xl font-medium">{selectedCar.notes}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Print and download card PDF actions */}
            <div className="pt-4 border-t flex gap-2 font-bold text-xs shrink-0">
              <button 
                onClick={() => setSelectedCar(null)}
                className="w-1/3 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-850 dark:hover:bg-slate-800 rounded-xl transition-all select-none"
              >
                إغلاق
              </button>
              <button 
                onClick={() => {
                  const cardPrintHtml = `
                    <html dir="rtl" lang="ar">
                      <head>
                        <title>بطاقة خصائص المركبة - ${selectedCar.brand}</title>
                        <style>
                          body { font-family: Arial, sans-serif; padding: 40px; color: #334155; }
                          .box { border: 2px solid #1e3a8a; padding: 25px; border-radius: 12px; }
                          h2 { margin: 0 0 15px 0; color: #1e3a8a; font-weight: 900; }
                          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                          tr { border-bottom: 1px solid #e2e8f0; }
                          td { padding: 10px 5px; }
                          .lbl { font-weight: bold; width: 40%; color: #64748b; }
                          .val { font-weight: 900; }
                        </style>
                      </head>
                      <body>
                        <div class="box">
                          <h2>سند مواصفات المركبة الفني</h2>
                          <table>
                            <tr><td class="lbl">المركبة:</td><td class="val">${formatVehicleDisplay(selectedCar)}</td></tr>
                            <tr><td class="lbl">سنة الصنع:</td><td class="val">${selectedCar.year}</td></tr>
                            <tr><td class="lbl">رقم الهيكل VIN:</td><td class="val" style="font-family: monospace;">${selectedCar.vin}</td></tr>
                            <tr><td class="lbl">البطاقة الجمركية:</td><td class="val">${selectedCar.cardNumber || 'بدون'}</td></tr>
                            <tr><td class="lbl">الفرع / الموقع:</td><td class="val">${selectedCar.isPresentInShowroom ? 'داخل المعرض' : 'خارج المعرض'}</td></tr>
                            <tr><td class="lbl">الوارد / جهة الساحات:</td><td class="val">${selectedCar.ownershipType || '-'}</td></tr>
                            <tr><td class="lbl">المورد:</td><td class="val">${selectedCar.supplier || '-'}</td></tr>
                            <tr><td class="lbl">السعر المقدر:</td><td class="val">${(selectedCar.price ?? 0).toLocaleString()} ر.س</td></tr>
                          </table>
                        </div>
                        <script>
                          window.onload = function() { window.print(); }
                        </script>
                      </body>
                    </html>
                  `;
                  safePrint(cardPrintHtml);
                }}
                className="w-2/3 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 transition-all shadow-md flex items-center justify-center gap-1.5"
              >
                <Printer size={14} />
                طباعة كارت مواصفات السند
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 5. MODAL: SAVE SEARCH TEMPLATE NAME INPUT */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center z-[110] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 p-6 rounded-3xl w-full max-w-sm space-y-4 shadow-xl text-xs font-bold text-slate-700">
            <h3 className="text-base font-black text-slate-800 dark:text-white border-b pb-2">حفظ القالب المخصص الجديد</h3>
            <div className="space-y-1">
              <label className="block text-[11px] text-slate-450">اسم القالب المخصص:</label>
              <input 
                type="text" 
                placeholder="مثلاً: وارد السبر غير مباع..." 
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-emerald-500 font-bold"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button 
                onClick={() => setShowSaveTemplateModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-xl transition-all"
              >
                إلغلاق
              </button>
              <button 
                onClick={saveCurrentSearchAsTemplate}
                disabled={!newTemplateName.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all disabled:opacity-50"
              >
                تأكيد حفظ القالب
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
