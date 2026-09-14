
import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { 
  Plus, Search, Edit3, Trash2, X, 
  Car as CarIcon, DollarSign, RefreshCcw, CheckCircle2,
  Layers, FileUp, ClipboardList, LogOut, ShoppingBag, 
  User as UserIcon, Phone, CreditCard, Tag, Briefcase, 
  UserCheck, Zap, Hash, Calendar, Palette,
  AlertCircle, AlertTriangle, Loader2, Printer, 
  Building2, CheckSquare, Square, Lock, ShieldAlert,
  IdCard, FileSpreadsheet, Flag, List, Type, ArrowDownLeft,
  LayoutGrid, Table, ArrowRightLeft, Check,
  Settings2, Truck, Shield, FileText, FileDown, Copy
} from 'lucide-react';
import { Car, CarStatus, OwnershipType, RentalStatus, User, OrganizationSettings, DeliveryType, UserRole, Permission, Delegate, getNormalizedSaleTypeAndBank, formatVehicleDisplay } from '../types';
import { ROLE_PERMISSIONS } from '../constants';
import { isCarMatchingQuery, getUnifiedSearchResults } from '../src/utils/searchEngine';
import { useLocation, useNavigate } from 'react-router-dom';
import CarFormModal, { autoCalculateVinMatching } from './CarFormModal';
import { CarImportWizard } from './CarImportWizard';
import { verifyPassword, verifyUserPassword } from '../services/SecurityService';
import { getCleanBrandName, sortCarsUnderBrand } from './Reports';
import { WithdrawalLetterModal } from './WithdrawalLetterModal';
import { CheckpointLetterModal } from './CheckpointLetterModal';
import { CarrierLetterModal } from './CarrierLetterModal';
import { PriceQuotationModal } from './PriceQuotationModal';
import { getLogoDataUri, getStampDataUri } from './OfficialAssets';
import { loadTableLayout, saveTableLayout, clearTableLayout, saveColumnPreferences, loadColumnPreferences, TableColumnConfig } from '../services/layoutPersistenceService';
import { ExcelService, SmartExportProgress, ExcelExportDiagnostics } from '../services/excelService';
import { exportTableDataToPDF, TablePDFColumn } from '../services/exportService';
import { BulkExitPermitModal } from './BulkExitPermitModal';
import { 
  getResolvedStatusColors, 
  getCustomRuleForCar, 
  getCarRowStyleAndClass, 
  getContrastTextColor,
  getCarStatusColorInfo,
  getCarRentalColorInfo,
  hexToArgb
} from '../src/utils/statusColors';
import { getBilingualPrintHeaderHtml, getBilingualPrintHeaderCss } from '../src/utils/printHeaderHelper';

export const getCleanDelegateName = (note: string | null | undefined): string => {
  if (!note) return '-';
  let str = note.trim();
  
  const patternsToStrip = [
    /^(محجوزة\s+للمندوب\s*:\s*|محجوز\s+للمندوب\s*:\s*)/,
    /^(محجوزة\s+للمندوب\s+|محجوز\s+للمندوب\s+)/,
    /^(محجوزة\s+لـ\s*:\s*|محجوز\s+لـ\s*:\s*)/,
    /^(محجوزة\s+لـ|محجوز\s+لـ)/,
    /^(محجوزة\s+بإسم\s+|محجوز\s+بإسم\s+|محجوزة\s+باسم\s+|محجوز\s+باسم\s+)/,
    /^(محجوزة\s+|محجوز\s+)/,
    /^(الحجز\s+بواسطة\s*:\s*|الحجز\s+بواسطة\s+)/,
    /^(بواسطة\s+المندوب\s*:\s*|بواسطة\s+المندوب\s+)/,
    /^(المندوب\s*:\s*|المندوب\s+)/,
    /^(مندوب\s+الحجز\s*:\s*|مندوب\s+الحجز\s+)/,
  ];

  for (const regex of patternsToStrip) {
    if (regex.test(str)) {
      str = str.replace(regex, '').trim();
    }
  }

  str = str.replace(/^[:\-–\s.]+/, '').replace(/[:\-–\s.]+$/, '').trim();
  return str || '-';
};

export const getRepresentativeOrSeller = (car: any): string => {
  const statusStr = String(car.status || '').trim();
  const isReserved = statusStr === 'محجوز' || statusStr === 'محجوزة' || statusStr === 'Reserved';
  
  if (isReserved) {
    if (car.statusNote) {
      return getCleanDelegateName(car.statusNote);
    }
    return car.reservedByUserId || car.seller || (car.notes ? getCleanDelegateName(car.notes) : '') || '-';
  }
  
  return car.exitData?.seller || car.exitData?.representativeName || car.seller || (car.notes ? getCleanDelegateName(car.notes) : '') || '-';
};

export const getReservationRepresentative = (car: any): string => {
  const statusStr = String(car.status || '').trim();
  const isReserved = statusStr === 'محجوز' || statusStr === 'محجوزة' || statusStr === 'Reserved';
  const isSold = statusStr === 'مباع' || statusStr === 'مبيعة' || statusStr === 'Sold' || statusStr === 'مباعة';
  
  if (isReserved) {
    const val = car.statusNote ? getCleanDelegateName(car.statusNote) : (car.reservedByUserId || car.seller || '');
    if (val && val !== '-') return val;
  }
  
  if (isSold) {
    const val = car.exitData?.seller || car.exitData?.representativeName || car.seller || '';
    if (val && val !== '-') return val;
  }
  
  if (car.notes) {
    return getCleanDelegateName(car.notes);
  }
  
  return '-';
};

export const getCleanModelKey = (model: string | undefined): string => {
  const m = (model || '').trim().toLowerCase().replace(/\s+/g, ' ')
             .replace(/[أإآ]/g, 'ا')
             .replace(/[ى]/g, 'ي')
             .replace(/ة/g, 'ه');
  return m || 'عام';
};

export const sortCarsByBrandCategory = (a: any, b: any) => {
  // 1. Group by Brand (ماركة)
  const brandA = getCleanBrandName(a.brand || '');
  const brandB = getCleanBrandName(b.brand || '');
  const brandCompare = brandA.localeCompare(brandB, 'ar');
  if (brandCompare !== 0) return brandCompare;

  // 2. Sort by Model (الموديل / طراز)
  const modelA = (a.model || '').trim().replace(/\s+/g, ' ').replace(/[أإآ]/g, 'ا').replace(/[ى]/g, 'ي').replace(/ة/g, 'ه');
  const modelB = (b.model || '').trim().replace(/\s+/g, ' ').replace(/[أإآ]/g, 'ا').replace(/[ى]/g, 'ي').replace(/ة/g, 'ه');
  const modelCompare = modelA.localeCompare(modelB, 'ar');
  if (modelCompare !== 0) return modelCompare;

  // 3. Year (سنة الصنع) - Newer years first, directly after Model
  const yearA = Number(a.year) || 0;
  const yearB = Number(b.year) || 0;
  if (yearB !== yearA) return yearB - yearA;

  // 4. Sort by Import Source (وارد المركبة / attributionSource)
  const getImportScore = (car: any) => {
    const source = (car.attributionSource || '').trim().toLowerCase();
    if (!source) return 99; // Empty source goes to the bottom
    if (source.includes('سعودي') || source.includes('سعودى') || source.includes('الرسمي') || source.includes('وكالة') || source.includes('وكيل')) {
      return 1; // Saudi official agency first
    }
    if (source.includes('خليجي') || source.includes('خليجى') || source.includes('بحرين') || source.includes('امارات') || source.includes('عمان') || source.includes('قطر') || source.includes('كويت')) {
      return 2; // GCC/Gulf imports second
    }
    return 10; // Other custom resources/distributors
  };

  const scoreA = getImportScore(a);
  const scoreB = getImportScore(b);
  if (scoreA !== scoreB) return scoreA - scoreB;

  const attrA = a.attributionSource || '';
  const attrB = b.attributionSource || '';
  const attrCompare = attrA.localeCompare(attrB, 'ar');
  if (attrCompare !== 0) return attrCompare;

  // 5. Stable fallback by VIN
  return (a.vin || '').localeCompare(b.vin || '');
};

interface CarManagerProps {
  cars: Car[];
  users: User[];
  delegates?: Delegate[];
  companies?: any[];
  onAdd: (car: Car) => void;
  onAddBulk: (cars: Car[]) => Promise<void> | void;
  onUpdate: (car: Car) => void;
  onDelete: (id: string) => void;
  onDeleteBulk: (ids: Set<string>) => void;
  currentUser: User | null;
  settings: OrganizationSettings;
  onArchiveLetter?: (letter: any) => void;
  addLog?: (action: string, targetId: string, targetType: 'car' | 'user' | 'backup' | 'settings' | 'system_update' | 'transfer', details: string) => void;
}

const safePrint = (html: string) => {
  const cleanHtml = html
    .replace(/window\.close\(\);?/gi, '')
    .replace(/window\.print\(\);?/gi, '')
    .trim();

  // If the premium global PrintPreviewModal trigger is registered, we delegate render & print to it directly
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
    }, 1000);
  } else {
    alert('حدث خطأ أثناء محاولة تهيئة نافذة الطباعة');
  }
};

const CarManager: React.FC<CarManagerProps> = ({ cars, users, delegates = [], companies = [], onAdd, onAddBulk, onUpdate, onDelete, onDeleteBulk, currentUser, settings, onArchiveLetter, addLog }) => {
  const getLogoStyleOverride = () => {
    const width = settings.logoWidth !== undefined ? settings.logoWidth : 120;
    const posX = settings.logoPosX !== undefined ? settings.logoPosX : 0;
    const posY = settings.logoPosY !== undefined ? settings.logoPosY : 0;
    return `
      .logo, .logo-img, .header-logo, .logo-area, .logo-header img, .logo-container img, .bilingual-logo, .bilingual-logo-img { 
        width: ${width}px !important;
        max-width: none !important;
        max-height: none !important;
        height: auto !important;
        position: relative !important;
        transform: translate(${posX}px, ${posY}px) !important;
      }
    `;
  };
  const location = useLocation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState(() => {
    try {
      const saved = localStorage.getItem('car_manager_search_term');
      return saved || '';
    } catch {
      return '';
    }
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('car_manager_search_term', searchTerm);
    } catch {}
  }, [searchTerm]);

  React.useEffect(() => {
    if (location.state && (location.state as any).searchVin) {
      const targetVin = (location.state as any).searchVin;
      console.log("[CarManager] Received search VIN from location state context:", targetVin);
      setSearchTerm(targetVin);
      // Clean up the location state so that refreshing doesn't keep resetting the searchTerm
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  const [startDate, setStartDate] = useState(() => {
    try {
      const persisted = loadTableLayout('inventory', currentUser?.id || currentUser?.username);
      return persisted?.filters?.startDate || '';
    } catch {
      return '';
    }
  });

  const [endDate, setEndDate] = useState(() => {
    try {
      const persisted = loadTableLayout('inventory', currentUser?.id || currentUser?.username);
      return persisted?.filters?.endDate || '';
    } catch {
      return '';
    }
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inventoryTab, setInventoryTab] = useState<'showroom' | 'transit'>('showroom');
  const [isArrivalModalOpen, setIsArrivalModalOpen] = useState(false);
  const [carsToReceive, setCarsToReceive] = useState<Car[]>([]);
  const [arrivalDate, setArrivalDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [arrivalDriver, setArrivalDriver] = useState<string>('');
  const [arrivalNotes, setArrivalNotes] = useState<string>('');
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [isBulkExitModalOpen, setIsBulkExitModalOpen] = useState(false);
  const [isWithdrawalModalOpen, setIsWithdrawalModalOpen] = useState(false);
  const [selectedWithdrawalCar, setSelectedWithdrawalCar] = useState<Car | undefined>(undefined);
  const [isCheckpointModalOpen, setIsCheckpointModalOpen] = useState(false);
  const [selectedCheckpointCar, setSelectedCheckpointCar] = useState<Car | undefined>(undefined);
  const [selectedCheckpointCars, setSelectedCheckpointCars] = useState<Car[] | undefined>(undefined);
  const [isCarrierModalOpen, setIsCarrierModalOpen] = useState(false);
  const [selectedCarrierCar, setSelectedCarrierCar] = useState<Car | undefined>(undefined);
  const [selectedCarrierCars, setSelectedCarrierCars] = useState<Car[] | undefined>(undefined);
  const [isPriceQuoteModalOpen, setIsPriceQuoteModalOpen] = useState(false);
  const [selectedPriceQuoteCar, setSelectedPriceQuoteCar] = useState<Car | null>(null);
  const [activeExitPermitCarId, setActiveExitPermitCarId] = useState<string | null>(null);
  const [editingNotesCar, setEditingNotesCar] = useState<Car | null>(null);
  const [quickNoteValue, setQuickNoteValue] = useState('');
  const [copiedVinId, setCopiedVinId] = useState<string | null>(null);
  const [columnSearchTerm, setColumnSearchTerm] = useState('');
  const [screenWidth, setScreenWidth] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1200);
  const [mobileForcedTable, setMobileForcedTable] = useState(false);

  const isMobileScreen = screenWidth < 640;
  const isTabletScreen = screenWidth >= 640 && screenWidth < 1024;

  React.useEffect(() => {
    const handleResize = () => {
      setScreenWidth(typeof window !== 'undefined' ? window.innerWidth : 1200);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const quickDelegateOptions = useMemo(() => {
    const activeDel = (delegates || []).filter(u => u.isActive !== false);
    const opts = activeDel.map(d => ({ label: d.username, value: d.username }));
    opts.unshift({ label: 'اختر مندوب الحجز...', value: '' });
    const currentQuickValue = quickNoteValue || '';
    if (currentQuickValue && !activeDel.some(d => d.username === currentQuickValue)) {
      opts.push({ label: `${currentQuickValue} (غير نشط حالياً)`, value: currentQuickValue });
    }
    return opts;
  }, [delegates, quickNoteValue]);
  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);
  const [editingCar, setEditingCar] = useState<Car | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('car_manager_selected_ids');
      if (saved) {
        return new Set(JSON.parse(saved));
      }
    } catch {}
    return new Set();
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('car_manager_selected_ids', JSON.stringify(Array.from(selectedIds)));
    } catch {}
  }, [selectedIds]);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [excelExportMode, setExcelExportMode] = useState<'all' | 'filtered' | 'selected' | 'page'>('filtered');
  const [excelRowHeightPx, setExcelRowHeightPx] = useState<number>(45);
  const [excelFontSizePt, setExcelFontSizePt] = useState<number>(11);
  const [excelIncludeSeparators, setExcelIncludeSeparators] = useState<boolean>(false);
  const [exportingProgress, setExportingProgress] = useState<SmartExportProgress | null>(null);
  const [exportDiagnostics, setExportDiagnostics] = useState<ExcelExportDiagnostics | null>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfReportTitle, setPdfReportTitle] = useState<string>('تقرير جدول مخزون السيارات الفعلي بالمعرض');
  const [pdfExportScope, setPdfExportScope] = useState<'filtered' | 'selected' | 'all'>('filtered');
  const [pdfFontSizePreset, setPdfFontSizePreset] = useState<'auto' | 'small' | 'medium' | 'large' | 'custom'>('auto');
  const [pdfCustomFontSize, setPdfCustomFontSize] = useState<number>(8.5);
  const [pdfOrientation, setPdfOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [pdfRowHeightPx, setPdfRowHeightPx] = useState<number>(60);
  
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isClearAllConfirmOpen, setIsClearAllConfirmOpen] = useState(false);
  const [includeOutboundInClearAll, setIncludeOutboundInClearAll] = useState(false);
  const [itemToDeleteId, setItemToDeleteId] = useState<string | null>(null);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const isAdmin = !currentUser || currentUser?.role === UserRole.ADMIN || String(currentUser?.role).toUpperCase() === 'ADMIN';
  const hasPermission = (perm: Permission) => 
    currentUser?.permissions?.includes(perm) || 
    (isAdmin ? ROLE_PERMISSIONS[UserRole.ADMIN].includes(perm) : 
     (currentUser?.role === UserRole.EMPLOYEE || String(currentUser?.role).toUpperCase() === 'EMPLOYEE' ? ROLE_PERMISSIONS[UserRole.EMPLOYEE].includes(perm) : 
      (currentUser?.role === UserRole.DELEGATE || String(currentUser?.role).toUpperCase() === 'DELEGATE' ? ROLE_PERMISSIONS[UserRole.DELEGATE].includes(perm) : false)));
  const canManageInventory = hasPermission(Permission.MANAGE_INVENTORY);
  const canViewFinancials = hasPermission(Permission.VIEW_FINANCIALS);
  const canExport = hasPermission(Permission.EXPORT_DATA);

  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const getInventoryColumns = () => {
    const isVisible = (key: string) => {
      if (!settings.inventoryColumnsVisible) return true;
      return settings.inventoryColumnsVisible[key] !== false;
    };

    const invCustomFields = (settings.inventoryCustomFields && settings.inventoryCustomFields.length > 0)
      ? settings.inventoryCustomFields
      : settings.customFields;

    const defaultCols = [
      { key: 'brand', label: 'الماركة', visible: isVisible('brand') },
      { key: 'model', label: 'الموديل', visible: isVisible('model') },
      { key: 'year', label: 'سنة الصنع', visible: isVisible('year') },
      { key: 'interior_color', label: 'اللون الداخلي', visible: isVisible('interior_color') },
      { key: 'color', label: 'اللون الخارجي', visible: isVisible('color') },
      { key: 'vin', label: 'رقم الهيكل (VIN)', visible: isVisible('vin') },
      { key: 'card_number', label: 'البطاقة الجمركية', visible: isVisible('card_number') },
      { key: 'vin_matching', label: 'تطابق الهيكل', visible: isVisible('vin_matching') },
      { key: 'plate', label: 'اللوحة', visible: isVisible('plate') },
      { key: 'notes', label: 'مندوب الحجز', visible: isVisible('notes') },
      { key: 'car_remark', label: 'ملاحظات السيارة', visible: isVisible('car_remark') },
      { key: 'attribution', label: 'وارد السيارة', visible: isVisible('attribution') },
      { key: 'ownership', label: 'المالك', visible: isVisible('ownership') },
      { key: 'status', label: 'الحالة', visible: isVisible('status') },
      { key: 'rental', label: 'حالة التجير', visible: isVisible('rental') },
      { key: 'showroom', label: 'التواجد بالمعرض', visible: isVisible('showroom') },
      { key: 'supplier', label: 'المورد', visible: isVisible('supplier') },
      { key: 'entry_date', label: 'تاريخ الدخول', visible: isVisible('entry_date') },
      { key: 'entry_transport_company', label: 'شركة نقليات الدخول', visible: isVisible('entry_transport_company') },
      { key: 'delivery_type', label: 'نوع المستلم', visible: isVisible('delivery_type') },
      { key: 'transport_company', label: 'شركة النقليات', visible: isVisible('transport_company') },
      { key: 'receiver_name', label: 'العميل', visible: isVisible('receiver_name') },
      { key: 'receiver_id', label: 'هوية العميل', visible: isVisible('receiver_id') },
      { key: 'nationality', label: 'الجنسية', visible: isVisible('nationality') },
      { key: 'receiver_phone', label: 'رقم الهاتف', visible: isVisible('receiver_phone') },
      { key: 'exit_date', label: 'تاريخ الخروج', visible: isVisible('exit_date') },
      { key: 'exit_notes', label: 'ملاحظات الخروج', visible: isVisible('exit_notes') },
      ...(invCustomFields || []).map(f => ({ key: f.id, label: f.label, visible: true })),
      { key: 'cost_price', label: 'التكلفة', visible: canViewFinancials && isVisible('cost_price') },
      { key: 'price', label: 'السعر', visible: canViewFinancials && isVisible('price') }
    ];

    try {
      const persisted = loadTableLayout('inventory', currentUser?.id || currentUser?.username);
      // Discard legacy layouts that used aggregated columns or removed fields
      const hasLegacyAggregatedCols = persisted && Array.isArray(persisted.columns) && (
        persisted.columns.some((pCol: any) => 
          pCol.key === 'car_info' || 
          pCol.key === 'color_model' || 
          pCol.key === 'grade' || 
          pCol.key === 'sale_type' || 
          pCol.key === 'bank_name' || 
          pCol.key === 'saleType' || 
          pCol.key === 'bankName'
        )
      );
      if (persisted && Array.isArray(persisted.columns) && !hasLegacyAggregatedCols) {
        const orderedCols: typeof defaultCols = [];
        // First, add persisted columns in their saved order if they exist in defaultCols
        persisted.columns.forEach((pCol: any) => {
          if (pCol.key === 'seq' || pCol.key === 'sale_type' || pCol.key === 'bank_name' || pCol.key === 'saleType' || pCol.key === 'bankName') return;
          const matchingDefault = defaultCols.find(d => d.key === pCol.key);
          if (matchingDefault) {
            orderedCols.push({
              ...matchingDefault,
              visible: pCol.visible
            });
          }
        });
        // Second, append any defaultCols that were NOT in the persisted.columns list (e.g. newly added custom fields)
        defaultCols.forEach(dCol => {
          if (!orderedCols.some(o => o.key === dCol.key)) {
            orderedCols.push(dCol);
          }
        });

        // Ensure 'year' (سنة الصنع) is positioned immediately after 'model' (الموديل)
        const modelIdx = orderedCols.findIndex(c => c.key === 'model');
        const yearIdx = orderedCols.findIndex(c => c.key === 'year');
        if (modelIdx !== -1 && yearIdx !== -1 && yearIdx !== modelIdx + 1) {
          const [yearCol] = orderedCols.splice(yearIdx, 1);
          const newModelIdx = orderedCols.findIndex(c => c.key === 'model');
          orderedCols.splice(newModelIdx + 1, 0, yearCol);
        }

        return orderedCols.filter(c => c.key !== 'seq' && c.key !== 'sale_type' && c.key !== 'bank_name' && c.key !== 'saleType' && c.key !== 'bankName');
      }
    } catch (e) {
      console.warn('[CarManager] Failed to apply persisted inventory columns:', e);
    }

    return defaultCols;
  };

  const areColumnsEqual = (
    a: Array<{ key: string; label: string; visible: boolean }>, 
    b: Array<{ key: string; label: string; visible: boolean }>
  ): boolean => {
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i].key !== b[i].key || a[i].visible !== b[i].visible || a[i].label !== b[i].label) {
        return false;
      }
    }
    return true;
  };

  const isApplyingExternalSyncRef = useRef<boolean>(false);
  const lastSavedLayoutRef = useRef<string>('');

  const [columns, setColumns] = useState<Array<{ key: string; label: string; visible: boolean }>>(() => getInventoryColumns());
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => {
    try {
      const persisted = loadTableLayout('inventory', currentUser?.id || currentUser?.username);
      if (persisted && (persisted.viewMode === 'table' || persisted.viewMode === 'grid')) {
        return persisted.viewMode;
      }
      const saved = localStorage.getItem('inventory_view_mode');
      if (saved === 'table' || saved === 'grid') return saved;
    } catch {}
    return typeof window !== 'undefined' && window.innerWidth < 1024 ? 'grid' : 'table';
  });

  const effectiveViewMode = (isMobileScreen && !mobileForcedTable) ? 'grid' : viewMode;

  React.useEffect(() => {
    setColumns(prev => {
      const next = getInventoryColumns();
      return areColumnsEqual(prev, next) ? prev : next;
    });
  }, [settings.inventoryColumnsVisible, settings.inventoryCustomFields, settings.customFields, canViewFinancials, currentUser?.id]);

  // Auto-save inventory layout choices on change with loop-prevention guards
  React.useEffect(() => {
    if (isApplyingExternalSyncRef.current) {
      return;
    }

    try {
      const payloadObj = {
        columns: columns.map(({ key, label, visible }) => ({ key, label, visible })),
        viewMode,
        filters: { startDate, endDate }
      };
      const payloadStr = JSON.stringify(payloadObj);

      // Deep compare: if nothing has changed since last save, do NOT trigger save or dispatch events
      if (payloadStr === lastSavedLayoutRef.current) {
        return;
      }

      lastSavedLayoutRef.current = payloadStr;

      saveTableLayout('inventory', payloadObj, currentUser?.id || currentUser?.username, 'CarManager_auto_save');
      localStorage.setItem('inventory_view_mode', viewMode);
    } catch (e) {
      console.error('[CarManager] Auto-presist layout values error:', e);
    }
  }, [columns, viewMode, startDate, endDate, currentUser?.id]);

  // Listen for persistent preferences synced event to refresh layout states safely
  React.useEffect(() => {
    const handleSync = (e?: any) => {
      // Guard against responding to our own auto-save event or irrelevant tables
      const detail = e?.detail;
      if (detail?.tableKey && detail.tableKey !== 'inventory') {
        return;
      }
      if (detail?.source === 'CarManager_auto_save') {
        return;
      }

      try {
        console.log('[CarManager] Persistent preferences loaded, checking inventory columns & layout filters.');
        const persisted = loadTableLayout('inventory', currentUser?.id || currentUser?.username);
        if (persisted) {
          isApplyingExternalSyncRef.current = true;

          if (persisted.columns && Array.isArray(persisted.columns)) {
            setColumns(prev => {
              const next = getInventoryColumns();
              return areColumnsEqual(prev, next) ? prev : next;
            });
          }
          if (persisted.viewMode === 'table' || persisted.viewMode === 'grid') {
            const validMode: 'table' | 'grid' = persisted.viewMode;
            setViewMode(prev => prev === validMode ? prev : validMode);
          }
          if (persisted.filters) {
            if (persisted.filters.startDate !== undefined) {
              setStartDate(prev => prev === persisted.filters.startDate ? prev : persisted.filters.startDate);
            }
            if (persisted.filters.endDate !== undefined) {
              setEndDate(prev => prev === persisted.filters.endDate ? prev : persisted.filters.endDate);
            }
          }

          // Cache current payload to avoid auto-save echo loop
          const syncPayload = JSON.stringify({
            columns: (persisted.columns || []).map((c: any) => ({ key: c.key, label: c.label, visible: c.visible })),
            viewMode: persisted.viewMode || 'table',
            filters: persisted.filters || {}
          });
          lastSavedLayoutRef.current = syncPayload;

          // Release the sync guard after render batch completes
          setTimeout(() => {
            isApplyingExternalSyncRef.current = false;
          }, 150);
        }
      } catch (err) {
        isApplyingExternalSyncRef.current = false;
        console.error('[CarManager] Error handling layout preferences sync event:', err);
      }
    };

    window.addEventListener('layout-preferences-synced', handleSync);
    window.addEventListener('layout-preferences-updated', handleSync);
    return () => {
      window.removeEventListener('layout-preferences-synced', handleSync);
      window.removeEventListener('layout-preferences-updated', handleSync);
    };
  }, [settings.inventoryColumnsVisible, settings.inventoryCustomFields, settings.customFields, canViewFinancials, currentUser?.id]);

  const filteredCars = useMemo(() => {
    // 1. Get filtered / ranked list using unified search if search term is active
    let candidates = searchTerm.trim().length > 0 ? getUnifiedSearchResults(cars, searchTerm) : cars;

    // 2. Filter key properties: isInventory and date range
    let matched = candidates.filter(car => {
      const isInventory = !car.isOutbound;
      if (!isInventory) return false;

      if (startDate || endDate) {
        const entryDateStr = car.entryDate?.split('T')[0];
        if (!entryDateStr) return false;
        
        if (startDate && entryDateStr < startDate) return false;
        if (endDate && entryDateStr > endDate) return false;
      }

      return true;
    });

    // 3. Sorting behavior: if there's no search term, use default branding sort.
    // If there is an active search term, retain the relevance-score sorted order!
    if (searchTerm.trim().length > 0) {
      return matched;
    } else {
      return matched.sort(sortCarsByBrandCategory);
    }
  }, [cars, searchTerm, startDate, endDate]);

  const presentCars = useMemo(() => {
    return filteredCars.filter(car => car.isPresentInShowroom !== false);
  }, [filteredCars]);

  const absentCars = useMemo(() => {
    return filteredCars.filter(car => car.isPresentInShowroom === false);
  }, [filteredCars]);

  const displayedCars = useMemo(() => {
    return inventoryTab === 'showroom' ? presentCars : absentCars;
  }, [inventoryTab, presentCars, absentCars]);

  const toggleSelect = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) newSelection.delete(id);
    else newSelection.add(id);
    setSelectedIds(newSelection);
  };

  const toggleSelectAll = () => {
    const currentList = inventoryTab === 'showroom' ? presentCars : absentCars;
    if (selectedIds.size === currentList.length && currentList.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(currentList.map(c => c.id)));
    }
  };

  const handleReceiveNotArrivedCar = (car: Car) => {
    setCarsToReceive([car]);
    setArrivalDate(new Date().toISOString().split('T')[0]);
    setIsArrivalModalOpen(true);
  };

  const handleConfirmArrival = () => {
    if (!carsToReceive || carsToReceive.length === 0) return;
    
    const formattedDate = arrivalDate || new Date().toISOString().split('T')[0];

    carsToReceive.forEach(car => {
      const finalStatus = (car.status === CarStatus.NOT_ARRIVED_SHOWROOM || car.status === CarStatus.NOT_ARRIVED) 
        ? CarStatus.AVAILABLE 
        : car.status;
        
      const updatedCar: Car = {
        ...car,
        status: finalStatus,
        isPresentInShowroom: true,
        entryDate: formattedDate,
        lastModified: new Date().toISOString(),
        customData: {
          ...(car.customData || {}),
          entryDriverName: arrivalDriver || car.customData?.entryDriverName || '',
          entryNotes: arrivalNotes || car.customData?.entryNotes || ''
        },
        history: [
          ...(car.history || []),
          {
            id: `h-receive-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            action: `تم اعتماد وصول المركبة وتأكيد تاريخ الدخول للمعرض [${formattedDate}] والتواجد الفعلي بنجاح`,
            timestamp: new Date().toISOString(),
            user: currentUser?.username || 'نظام'
          }
        ]
      };

      onUpdate(updatedCar);

      if (addLog) {
        addLog(
          'استلام واعتماد مركبة', 
          car.id, 
          'car', 
          `تم اعتماد وصول المركبة ${formatVehicleDisplay(car)} شاصيه ${car.vin} وتعيين تاريخ الدخول للمعرض كـ [${formattedDate}] وتنشيطها في المخزون الفعلي`
        );
      }
    });

    const newSelected = new Set(selectedIds);
    carsToReceive.forEach(c => newSelected.delete(c.id));
    setSelectedIds(newSelected);
    
    setIsArrivalModalOpen(false);
    setCarsToReceive([]);
    setArrivalDriver('');
    setArrivalNotes('');
  };

  const handleMoveToSales = (car: Car) => {
    // We open the modal but forced to outbound
    setEditingCar({
      ...car,
      isOutbound: true,
      status: CarStatus.SOLD,
      exitData: {
        ...(car.exitData || {
          receiverName: '', 
          receiverPhone: '', 
          receiverId: '', 
          nationality: '',
          deliveryType: DeliveryType.OWNER, 
          notes: ''
        }),
        exitDate: new Date().toISOString().split('T')[0]
      }
    });
    setIsModalOpen(true);
  };

  const initiateBulkDelete = () => {
    setDeleteError('');
    setConfirmPassword('');
    setItemToDeleteId(null);
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmBulkDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError('');
    const targetUsername = currentUser?.username || 'admin';
    const matchedUser = users.find(u => u.username?.toLowerCase() === targetUsername.toLowerCase());
    const userPasswordHash = matchedUser?.password || currentUser?.password || '';
    
    const isCorrect = await verifyUserPassword(targetUsername, confirmPassword, userPasswordHash);
    
    if (isCorrect) {
      if (itemToDeleteId) {
        onDelete(itemToDeleteId);
        setItemToDeleteId(null);
      } else {
        onDeleteBulk(selectedIds);
        setSelectedIds(new Set());
      }
      setIsDeleteConfirmOpen(false);
      setConfirmPassword('');
    } else {
      setDeleteError('كلمة المرور غير صحيحة.');
    }
  };

  const handleConfirmClearAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError('');
    const targetUsername = currentUser?.username || 'admin';
    const matchedUser = users.find(u => u.username?.toLowerCase() === targetUsername.toLowerCase());
    const userPasswordHash = matchedUser?.password || currentUser?.password || '';
    
    const isCorrect = await verifyUserPassword(targetUsername, confirmPassword, userPasswordHash);
    
    if (isCorrect) {
      const allIds = includeOutboundInClearAll 
        ? new Set(cars.map(c => c.id)) 
        : new Set(filteredCars.map(c => c.id));
      onDeleteBulk(allIds);
      setSelectedIds(new Set());
      setIsClearAllConfirmOpen(false);
      setIncludeOutboundInClearAll(false);
      setConfirmPassword('');
    } else {
      setDeleteError('كلمة المرور غير صحيحة.');
    }
  };

  const handleImportWizardComplete = async (imported: Car[], duplicateMode: 'overwrite' | 'skip') => {
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

    const allCarsToSave: Car[] = [];
    
    for (const item of imported) {
      const existing = cars.find(c => {
        const itemVinClean = String(item.vin || '').replace(/\s+/g, '').toUpperCase();
        const cVinClean = String(c.vin || '').replace(/\s+/g, '').toUpperCase();
        
        // Match strictly by VIN if available on both side to protect the chassis uniqueness ("عدم تكرار رقم الهيكل")
        if (itemVinClean && cVinClean) {
          return itemVinClean === cVinClean;
        }

        // Fallback to Card Number only if VIN is missing from one of them (very rare due to wizard validation)
        const matchCard = isCardNumberValidForDuplicateCheck(item.cardNumber) && 
                          isCardNumberValidForDuplicateCheck(c.cardNumber) && 
                          String(c.cardNumber || '').trim() === String(item.cardNumber || '').trim();
        return matchCard;
      });

      if (existing) {
        if (duplicateMode === 'overwrite') {
          const updated: Car = {
            ...existing,
            brand: item.brand || existing.brand,
            model: item.model || existing.model || item.brand || existing.brand || '-',
            year: item.year || existing.year,
            color: item.color || existing.color,
            cardNumber: item.cardNumber || existing.cardNumber,
            price: item.price || existing.price,
            costPrice: item.costPrice || existing.costPrice,
            supplier: item.supplier || existing.supplier,
            notes: item.notes || existing.notes,
            entryDate: item.entryDate || existing.entryDate,
            customData: {
              ...(existing.customData || {}),
              ...(item.customData || {})
            },
            lastModified: new Date().toISOString(),
            history: [
              ...(Array.isArray(existing.history) ? existing.history : []),
              {
                id: `h-import-${Date.now()}`,
                action: 'تحديث البيانات والأسعار والتكلفة والتفاصيل التكميلية عبر بوابة الاستيراد الاحترافية والتحقق المزدوج للبطاقة والهيكل',
                timestamp: new Date().toISOString(),
                user: currentUser?.username || 'نظام'
              }
            ]
          };
          allCarsToSave.push(updated);
        }
      } else {
        allCarsToSave.push({
          ...item,
          brand: item.brand || 'مركبة مستوردة',
          model: item.model || item.brand || '-'
        });
      }
    }

    if (allCarsToSave.length > 0) {
      if (onAddBulk) {
        await onAddBulk(allCarsToSave);
      } else {
        for (const c of allCarsToSave) {
          await onAdd(c);
        }
      }
    }

    setIsImportWizardOpen(false);
  };

  const handlePrintEntryPermit = async (car: Car) => {
    const { generateQrCodeDataUrl: genQR, getEmbeddedQrHtml: getQRHtml } = await import('../src/utils/qrHelper');
    const { getDocumentSerial } = await import('../src/utils/documentSerialManager');
    const docSerial = getDocumentSerial('entry_permit', car.id || car.vin || '');

    const qrResult = await genQR({
      documentType: 'إذن استلام مخزني (دخول)',
      serialNumber: docSerial,
      date: car.entryDate || new Date().toISOString().split('T')[0],
      orgName: settings.name || 'سما الفرسان للتجارة',
      orgCr: settings.commercialRegister || '',
      orgVat: settings.taxNumber || '',
      vehicleDetails: {
        brand: car.brand,
        model: car.model,
        year: String(car.modelYear || car.year || ''),
        color: car.color,
        vin: car.vin,
        plateNumber: car.plateData?.plateNumber || car.customData?.plateNumber || '',
        cardNumber: car.cardNumber || '',
      },
      recipientDetails: {
        name: car.exitData?.receiverName || '',
        idNumber: car.exitData?.receiverId || '',
        phoneNumber: car.exitData?.receiverPhone || '',
        destination: car.supplier || '',
      }
    });

    const carEntryNote = (car.customData?.entryNotes || '').trim();

    const formattedEntryDate = car.entryDate 
      ? `${new Date(car.entryDate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'numeric', day: 'numeric' })} م (${car.entryDate.split('T')[0]})` 
      : `${new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'numeric', day: 'numeric' })} م (${new Date().toISOString().split('T')[0]})`;

    const html = `
      <html dir="rtl">
        <head>
          <title>إذن استلام مخزني - ${formatVehicleDisplay(car)}</title>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
          <style>
            @page { size: A4 portrait; margin: 8mm; }
            html, body { margin: 0; padding: 0; background: #fff; }
            body { 
              font-family: 'Cairo', sans-serif; 
              direction: rtl; 
              color: #000; 
              background: #fff; 
              -webkit-print-color-adjust: exact;
            }
            .content-wrapper { 
              padding: 4mm 6mm; 
              position: relative; 
              height: 262mm; 
              overflow: hidden;
              display: flex; 
              flex-direction: column; 
              justify-content: flex-start;
              gap: 6px;
              box-sizing: border-box; 
              border: 3px solid #000;
            }
            
            .header { 
              display: flex; 
              justify-content: space-between; 
              align-items: flex-start; 
              margin-bottom: 2px; 
            }
            .header-info { 
              text-align: right; 
              font-size: 9pt; 
              font-weight: bold; 
              line-height: 1.3; 
            }
            .logo-header {
              text-align: center;
              width: 180px;
            }
            .logo { 
              width: 100px; 
              max-height: 55px;
              object-fit: contain;
              margin-bottom: 2px;
            }
            .brand-under-logo {
              font-size: 12pt;
              font-weight: 900;
              margin-top: -3px;
            }
            
            .title-section { 
              text-align: center; 
              margin: 2px 0 4px 0; 
              border-top: 2pt solid #000;
              padding-top: 4px;
            }
            .title { 
              font-size: 19pt; 
              font-weight: 900; 
              display: inline-block; 
              letter-spacing: -0.5px; 
              margin: 0;
            }
            
            .date-row { 
              text-align: left; 
              margin-bottom: 4px; 
              font-weight: 900; 
              font-size: 10.5pt; 
            }
            
            table { width: 100%; border-collapse: collapse; margin-bottom: 6px; table-layout: fixed; }
            th.col-counter, td.col-counter, .col-counter { width: 45px !important; min-width: 45px !important; max-width: 45px !important; }
            th, td { border: 1.5pt solid #000; padding: 4px 2px; text-align: center; font-size: 9.5pt; font-weight: 900; }
            th { background-color: #fcfcfc; font-size: 9pt; height: 28px; }
            .data-row { height: 38px; }
            .empty-row { height: 38px; }
            
            .management-section {
              margin-top: 6px;
              display: flex; 
              justify-content: space-between;
              align-items: center;
              font-size: 11pt;
              font-weight: 900;
              padding-bottom: 4px;
              border-top: 1px dashed #475569;
              padding-top: 4px;
            }
            
            .watermark { 
              position: absolute; 
              top: 50%; 
              left: 50%; 
              transform: translate(-50%, -50%); 
              opacity: 0.18; 
              width: 60%; 
              pointer-events: none; 
              z-index: 9999; 
            }
            .debug-panel { display: none !important; }
            
            @media print { 
              html, body { height: auto; overflow: visible; margin: 0; padding: 0; }
              .content-wrapper { 
                height: 262mm !important; 
                overflow: hidden !important;
                border: 3px solid #000 !important; 
                padding: 4mm 6mm !important; 
                box-sizing: border-box !important; 
                page-break-inside: avoid; 
              }
              .debug-panel { display: none !important; }
            }
            ${getBilingualPrintHeaderCss()}
            ${getLogoStyleOverride()}
          </style>
        </head>
        <body>
          <div class="content-wrapper">
            <img src="${settings.logoUrl || getLogoDataUri(settings.name, settings.orgType)}" class="watermark" />
            
            ${getBilingualPrintHeaderHtml(settings)}

            <div class="title-section">
              <h1 class="title">إذن استلام مخزني للسيارات</h1>
              <div style="font-size: 10pt; font-weight: bold; margin-top: 2px; color: #475569;">رقم المستند: ${docSerial}</div>
            </div>

            <div class="date-row">
               التاريخ: ${formattedEntryDate}
            </div>

            <table>
              <colgroup>
                <col style="width: 45px; min-width: 45px; max-width: 45px;" class="col-counter" />
                <col style="width: 25%;" />
                <col style="width: 25%;" />
                <col style="width: 16%;" />
                <col style="width: 17%;" />
                <col style="width: 17%;" />
              </colgroup>
              <thead>
                <tr>
                  <th style="width: 45px; min-width: 45px; max-width: 45px;" class="col-counter">الرقم</th>
                  <th style="width: 25%">نوع المركبة</th>
                  <th style="width: 25%">رقم الشاسية</th>
                  <th style="width: 16%">اللون / الموديل</th>
                  <th style="width: 17%">المورد</th>
                  <th style="width: 17%">شركة الشحن</th>
                </tr>
              </thead>
              <tbody>
                <tr class="data-row">
                  <td>1</td>
                  <td>${formatVehicleDisplay(car)}</td>
                  <td style="font-family: monospace;">${car.vin}</td>
                  <td>${car.color} / ${car.year}</td>
                  <td>${car.supplier || '—'}</td>
                  <td>${car.customData?.entryTransportCompany || car.exitData?.transportCompany || '—'}</td>
                </tr>
                ${Array.from({ length: 7 }).map((_, i) => `
                  <tr class="empty-row">
                    <td>${i + 2}</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <!-- DEDICATED ENTRY NOTES & DRIVER BOX -->
            <div style="border: 1.5pt solid #000; border-radius: 4px; padding: 6px 10px; margin-top: 4px; margin-bottom: 4px; background-color: #f8fafc; text-align: right;">
              <div style="font-weight: 900; font-size: 10pt; color: #0f172a; margin-bottom: 2px; display: flex; justify-content: space-between; align-items: center;">
                <span>📝 ملحوظة دخول واستلام السيارة:</span>
                ${car.customData?.entryDriverName ? `<span style="font-size: 9.5pt; color: #334155;">سائق الناقلة: <strong>${car.customData.entryDriverName}</strong></span>` : ''}
              </div>
              <div style="font-weight: 800; font-size: 9.5pt; color: #1e293b; line-height: 1.4; white-space: pre-wrap;">${carEntryNote || 'تم استلام السيارة وحفظها بالمخزن بحالة جيدة بدون ملاحظات إضافية.'}</div>
            </div>

            <!-- DIGITAL VERIFICATION QR CODE (PUSHED DOWN TO FOOTER) -->
            <div style="margin-top: auto; padding-bottom: 2px; text-align: center;">
              ${getQRHtml(qrResult.qrCodeDataUrl, qrResult.fingerprint, { size: 68 })}
            </div>

            <div class="management-section">
              <span>ادارة المخزون :</span>
              <img src="${settings.stampUrl || getStampDataUri(settings.name ? `${settings.orgType || 'مؤسسة'} ${settings.name}` : undefined, settings.commercialRegister, settings.orgType)}" style="max-height: 70px; max-width: 70px; mix-blend-mode: multiply;" />
              <span>ادارة الحسابات :</span>
            </div>
          </div>
          <script>
            window.onload = () => {
              try {
                const content = document.querySelector('.content-wrapper');
                const header = document.querySelector('.header');
                const titleSec = document.querySelector('.title-section');
                const dateRow = document.querySelector('.date-row');
                const table = document.querySelector('table');
                const footer = document.querySelector('.management-section');
                const qrBlock = document.querySelector('.qr-verification-block');

                // A4 Portrait total height in pixels is approx 1122px (297mm at 96 DPI)
                const maxPageHeight = content ? content.clientHeight : 1122;
                
                // Measure sizes
                const headerH = header ? header.offsetHeight : 0;
                const titleH = titleSec ? titleSec.offsetHeight : 0;
                const dateH = dateRow ? dateRow.offsetHeight : 0;
                const footerH = footer ? footer.offsetHeight : 0;
                const qrH = qrBlock ? qrBlock.offsetHeight : 0;
                
                const style = window.getComputedStyle(content);
                const paddingTop = parseFloat(style.paddingTop) || 0;
                const paddingBottom = parseFloat(style.paddingBottom) || 0;
                const borderTop = parseFloat(style.borderTopWidth) || 0;
                const borderBottom = parseFloat(style.borderBottomWidth) || 0;
                const wrapperOverhead = paddingTop + paddingBottom + borderTop + borderBottom;

                // Auto Fit Height: Assign remaining height safely to rows
                const nonTableHeight = headerH + titleH + dateH + footerH + qrH + wrapperOverhead;
                const availableTableHeight = maxPageHeight - nonTableHeight - 20;
                
                const rows = table ? table.querySelectorAll('tbody tr') : [];
                const rowCount = rows.length;
                
                if (rowCount > 0 && availableTableHeight > 100) {
                  const optimalRowHeight = Math.floor(availableTableHeight / rowCount);
                  // Maintain readable height limits between 35px and 60px
                  const targetHeight = Math.min(Math.max(optimalRowHeight, 35), 60);
                  rows.forEach(r => {
                    r.style.height = targetHeight + 'px';
                  });
                }

                // Page Content Bounds Validation & Auto-Shrink
                let tableH = table ? table.offsetHeight : 0;
                let currentTotal = headerH + titleH + dateH + tableH + footerH + qrH + wrapperOverhead;
                let attempts = 0;

                while (currentTotal > maxPageHeight && attempts < 10) {
                  attempts++;
                  
                  if (header) {
                    const mb = parseFloat(window.getComputedStyle(header).marginBottom) || 0;
                    if (mb > 2) header.style.marginBottom = (mb - 2) + 'px';
                  }
                  if (titleSec) {
                    const mt = parseFloat(window.getComputedStyle(titleSec).marginTop) || 0;
                    const mb = parseFloat(window.getComputedStyle(titleSec).marginBottom) || 0;
                    const pt = parseFloat(window.getComputedStyle(titleSec).paddingTop) || 0;
                    if (mt > 2) titleSec.style.marginTop = (mt - 2) + 'px';
                    if (mb > 2) titleSec.style.marginBottom = (mb - 2) + 'px';
                    if (pt > 2) titleSec.style.paddingTop = (pt - 2) + 'px';
                  }
                  if (dateRow) {
                    const mb = parseFloat(window.getComputedStyle(dateRow).marginBottom) || 0;
                    if (mb > 2) dateRow.style.marginBottom = (mb - 2) + 'px';
                  }
                  if (table) {
                    const mb = parseFloat(window.getComputedStyle(table).marginBottom) || 0;
                    if (mb > 2) table.style.marginBottom = (mb - 2) + 'px';
                  }
                  if (footer) {
                    const pb = parseFloat(window.getComputedStyle(footer).paddingBottom) || 0;
                    if (pb > 2) footer.style.paddingBottom = (pb - 1) + 'px';
                  }

                  // Force reduce rows slightly if we are still overflowing
                  if (attempts > 3) {
                    const remTable = maxPageHeight - (header ? header.offsetHeight : 0) - (titleSec ? titleSec.offsetHeight : 0) - (dateRow ? dateRow.offsetHeight : 0) - (footer ? footer.offsetHeight : 0) - qrH - wrapperOverhead - 15;
                    if (remTable > 100) {
                      const lowerRowH = Math.floor(remTable / rowCount);
                      rows.forEach(r => {
                        r.style.height = Math.max(lowerRowH, 30) + 'px';
                      });
                    }
                  }

                  const fHeaderH = header ? header.offsetHeight : 0;
                  const fTitleH = titleSec ? titleSec.offsetHeight : 0;
                  const fDateH = dateRow ? dateRow.offsetHeight : 0;
                  const fTableH = table ? table.offsetHeight : 0;
                  const fFooterH = footer ? footer.offsetHeight : 0;
                  currentTotal = fHeaderH + fTitleH + fDateH + fTableH + fFooterH + qrH + wrapperOverhead;
                }

                // Update Debug UI
                const finalHeaderH = header ? header.offsetHeight : 0;
                const finalTitleH = titleSec ? titleSec.offsetHeight : 0;
                const finalDateH = dateRow ? dateRow.offsetHeight : 0;
                const finalTableH = table ? table.offsetHeight : 0;
                const finalFooterH = footer ? footer.offsetHeight : 0;
                
                document.getElementById('debug-page-h').innerText = 'Page Height: ' + maxPageHeight + 'px (297mm)';
                document.getElementById('debug-header-h').innerText = 'Header Height: ' + finalHeaderH + 'px';
                document.getElementById('debug-title-h').innerText = 'Title Height: ' + finalTitleH + 'px';
                document.getElementById('debug-date-h').innerText = 'Date Height: ' + finalDateH + 'px';
                document.getElementById('debug-table-h').innerText = 'Table Height: ' + finalTableH + 'px';
                document.getElementById('debug-footer-h').innerText = 'Footer Height: ' + finalFooterH + 'px';
                document.getElementById('debug-total-h').innerText = 'Total Content: ' + currentTotal + 'px';

                let overs = [];
                if (finalHeaderH > 130) overs.push('Header');
                if (finalTitleH > 90) overs.push('Title');
                if (finalTableH > 450) overs.push('Table');
                if (finalFooterH > 150) overs.push('Footer');

                if (currentTotal > maxPageHeight) {
                  document.getElementById('debug-status').innerText = 'OVERFLOW! (' + (currentTotal - maxPageHeight) + 'px over)';
                  document.getElementById('debug-status').style.color = '#ef4444';
                  console.warn('[Debug System] Warehouse receipt permit height exceeded limits. Exceeding elements:', overs);
                } else {
                  document.getElementById('debug-status').innerText = 'STATUS: PERFECTLY FIT ✅';
                  document.getElementById('debug-status').style.color = '#4ade80';
                  console.log('[Debug System] Warehouse receipt permit fits A4 successfully.');
                }
              } catch (err) {
                console.error('[Debug System] Layout optimizer error:', err);
              }

              setTimeout(() => {
                window.print();
                window.close();
              }, 1200);
            };
          </script>
        </body>
      </html>
    `;
    safePrint(html);

    if (onArchiveLetter) {
      onArchiveLetter({
        letterType: 'إذن استلام مخزني (دخول)',
        vin: car.vin || '',
        plateNumber: car.plateData?.plateNumber || car.customData?.plateNumber || '',
        cardNumber: car.cardNumber || '',
        vehicleName: `${car.brand} ${car.model} ${car.year}`,
        driverName: car.exitData?.receiverName || '',
        destination: car.supplier || '',
        htmlContent: html
      });
    }
  };

  const handlePrintExitPermit = async (car: Car, withPlate: boolean = false) => {
    const exitData = car.exitData || { 
      receiverName: '', 
      receiverPhone: '', 
      receiverId: '', 
      nationality: '',
      deliveryType: DeliveryType.OWNER, 
      exitDate: new Date().toISOString().split('T')[0],
      notes: '' 
    };

    const docTitle = withPlate ? 'إذن خروج وتسليم سيارة ولوحة' : 'إذن خروج وتسليم سيارة';

    const receiverDisplayName = exitData.receiverName || (car as any).customerName || (car as any).clientName || '';

    const { generateQrCodeDataUrl: genQR, getEmbeddedQrHtml: getQRHtml } = await import('../src/utils/qrHelper');
    const { getDocumentSerial } = await import('../src/utils/documentSerialManager');
    const docSerial = getDocumentSerial('exit_permit', car.id || car.vin || '');

    const qrResult = await genQR({
      documentType: docTitle,
      serialNumber: docSerial,
      date: exitData.exitDate || new Date().toISOString().split('T')[0],
      orgName: settings.name || 'سما الفرسان للتجارة',
      orgCr: settings.commercialRegister || '',
      orgVat: settings.taxNumber || '',
      vehicleDetails: {
        brand: car.brand,
        model: car.model,
        year: String(car.modelYear || car.year || ''),
        color: car.color,
        vin: car.vin,
        plateNumber: car.plateData?.plateNumber || car.customData?.plateNumber || '',
        cardNumber: car.cardNumber || '',
      },
      recipientDetails: {
        name: receiverDisplayName || '',
        idNumber: exitData.receiverId || '',
        phoneNumber: exitData.receiverPhone || '',
        destination: exitData.transportCompany || '',
      }
    });

    const idDigits = (exitData.receiverId || '').padEnd(10, ' ').split('').slice(0, 10);

    const targetExitDate = settings.exitPermitDateType === 'custom' && settings.exitPermitCustomDate
      ? settings.exitPermitCustomDate
      : new Date().toISOString().split('T')[0];

    const formattedExitDate = `${new Date(targetExitDate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'numeric', day: 'numeric' })} م (${targetExitDate})`;

    const html = `
      <html dir="rtl">
        <head>
          <title>${docTitle} - ${formatVehicleDisplay(car)}</title>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            html, body { margin: 0; padding: 0; background: #fff; }
            body { 
              font-family: 'Cairo', sans-serif; 
              direction: rtl; 
              color: #0f172a; 
              background: #fff; 
              -webkit-print-color-adjust: exact;
            }
            .content-wrapper { 
              padding: ${settings.exitPermitPadding ?? 6}mm ${settings.exitPermitPadding !== undefined ? settings.exitPermitPadding + 2 : 8}mm; 
              position: relative; 
              height: 262mm; 
              overflow: hidden;
              display: flex; 
              flex-direction: column; 
              justify-content: flex-start;
              gap: ${settings.exitPermitGap ?? 12}px;
              box-sizing: border-box; 
              page-break-inside: avoid;
              border: 3px solid #000;
            }
            
            .header { 
              display: flex; 
              justify-content: space-between; 
              align-items: flex-start; 
              margin-bottom: 4px; 
              border-bottom: 2px solid #0f172a;
              padding-bottom: 8px;
            }
            .header-info { 
              text-align: right; 
              font-size: ${(settings.exitPermitFontSize ?? 11) - 0.5}pt; 
              font-weight: 700; 
              line-height: 1.5; 
              color: #1e293b;
            }
            .logo-header {
              text-align: center;
              width: 180px;
            }
            .logo { 
              width: 85px; 
              margin-bottom: 0px;
            }
            .brand-under-logo {
              font-size: 11pt;
              font-weight: 900;
              margin-top: -3px;
              color: #0f172a;
            }
            
            .title-section { 
              text-align: center; 
              margin: 6px 0; 
              border-top: 2px solid #0f172a;
              border-bottom: 2px solid #0f172a;
              padding: 3px 0;
            }
            .title { 
              font-size: ${(settings.exitPermitFontSize ?? 11) + 4}pt; 
              font-weight: 900; 
              display: inline-block; 
              letter-spacing: -0.5px; 
              color: #0f172a;
              margin: 0;
            }
            
            .date-row { 
              text-align: left; 
              margin-bottom: 4px; 
              font-weight: 700; 
              font-size: ${settings.exitPermitFontSize ?? 11}pt; 
              color: #1e293b;
            }
            
            .receiver-info { 
              margin-bottom: 4px; 
              font-size: ${settings.exitPermitFontSize ?? 11}pt; 
              font-weight: 700; 
              background: #f8fafc;
              border: 1.5px solid #e2e8f0;
              border-radius: 8px;
              padding: ${(settings.exitPermitPadding ?? 6) + 4}px ${(settings.exitPermitPadding ?? 6) + 8}px;
            }
            .info-row { 
              display: flex; 
              align-items: center; 
              margin-bottom: 8px; 
            }
            .info-row:last-child {
              margin-bottom: 0;
            }
            .dotted-line { 
              border-bottom: 1.5px dashed #0f172a; 
              flex: 1; 
              margin: 0 8px; 
              padding-bottom: 2px; 
              min-width: 120px;
              text-align: center;
              font-weight: 900;
              color: #0f172a;
              font-size: ${(settings.exitPermitFontSize ?? 11) + 1}pt;
            }
            
            .id-boxes-container { 
              display: flex; 
              align-items: center; 
              justify-content: flex-end; 
              margin-top: 8px;
              gap: 8px; 
            }
            .id-boxes { display: flex; direction: ltr; gap: 0; border: 1.5px solid #0f172a; }
            .id-box { 
              width: ${(settings.exitPermitFontSize ?? 11) + 15}px; 
              height: ${(settings.exitPermitFontSize ?? 11) + 15}px; 
              border: 0.5px solid #475569; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              font-size: ${(settings.exitPermitFontSize ?? 11) + 0.5}pt; 
              font-weight: 700; 
              background: #fff; 
            }
            
            table { width: 100%; border-collapse: collapse; margin: 6px 0; table-layout: fixed; }
            th, td { border: 1.5px solid #0f172a; padding: ${(settings.exitPermitPadding ?? 6) + 2}px ${settings.exitPermitPadding ?? 6}px; text-align: center; font-size: ${(settings.exitPermitFontSize ?? 11) - 0.5}pt; font-weight: 700; }
            th { background-color: #f1f5f9; font-size: ${(settings.exitPermitFontSize ?? 11) - 0.5}pt; height: 32px; color: #0f172a; }
            .table-data-row { height: ${settings.exitPermitTableRowHeight ?? 46}px; vertical-align: middle; font-size: ${settings.exitPermitFontSize ?? 11}pt; }
            
            .declaration { 
              font-size: ${settings.exitPermitFontSize ?? 11}pt; 
              font-weight: 800; 
              text-align: center; 
              margin: 6px 0; 
              line-height: 1.6; 
              color: #0f172a;
              padding: ${(settings.exitPermitPadding ?? 6) + 4}px ${(settings.exitPermitPadding ?? 6) + 8}px;
              background: #f8fafc;
              border-right: 4px solid #0f172a;
              border-left: 4px solid #0f172a;
              border-radius: 6px;
            }
            
            .notes-row { 
              display: flex; 
              align-items: center; 
              font-size: ${settings.exitPermitFontSize ?? 11}pt; 
              font-weight: 700; 
              margin-bottom: 4px;
            }
            .notes-lines { flex: 1; margin-right: 8px; }
            .dotted-full { border-bottom: 1.5px dotted #0f172a; height: ${settings.exitPermitDottedFullHeight ?? 26}px; width: 100%; }
            
            .footer-grid { 
              display: flex;
              justify-content: space-between;
              margin-top: 10px;
              gap: 20px;
              padding-bottom: 6px;
            }
            .sig-col { display: flex; flex-direction: column; gap: 6px; font-size: ${(settings.exitPermitFontSize ?? 11) - 0.5}pt; font-weight: 700; min-width: 220px; }
            .sig-row { display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px dashed #cbd5e1; padding-bottom: 6px; }
            
            .management-section {
              margin-top: auto;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: ${settings.exitPermitFontSize ?? 11}pt;
              font-weight: 700;
              padding-bottom: 6px;
              border-top: 2.5px double #0f172a;
              padding-top: 10px;
              position: relative;
            }

            .stamp-img {
              max-height: ${settings.exitPermitStampSize ?? 75}px;
              max-width: ${settings.exitPermitStampSize ?? 75}px;
              mix-blend-mode: multiply;
              position: relative;
              left: ${settings.exitPermitStampX ?? 0}px;
              top: ${settings.exitPermitStampY ?? 0}px;
            }
            
            .watermark { 
              position: absolute; 
              top: 50%; 
              left: 50%; 
              transform: translate(-50%, -50%); 
              opacity: 0.20; 
              width: 60%; 
              pointer-events: none; 
              z-index: 9999; 
            }
            
            @media print { 
              html, body { height: auto; overflow: visible; margin: 0; padding: 0; }
              .content-wrapper { 
                height: 262mm !important; 
                overflow: hidden !important;
                border: 3px solid #000 !important; 
                padding: ${settings.exitPermitPadding ?? 6}mm ${settings.exitPermitPadding !== undefined ? settings.exitPermitPadding + 2 : 8}mm !important; 
                box-sizing: border-box !important; 
                page-break-inside: avoid; 
              }
            }
            ${getBilingualPrintHeaderCss()}
            ${getLogoStyleOverride()}
          </style>
        </head>
        <body>
          <div class="content-wrapper">
            <img src="${settings.logoUrl || getLogoDataUri(settings.name, settings.orgType)}" class="watermark" />
            
            ${getBilingualPrintHeaderHtml(settings)}

            <div class="title-section">
              <h1 class="title">${docTitle}</h1>
              <div style="font-size: 11pt; font-weight: bold; margin-top: 4px; color: #475569;">رقم المستند: ${docSerial}</div>
            </div>

            <div class="date-row">
               التاريخ: ${formattedExitDate}
            </div>

            <div class="receiver-info">
              <div class="info-row">
                <span>استلمت انا /</span>
                <span class="dotted-line">${receiverDisplayName}</span>
                <span>الجنسية /</span>
                <span class="dotted-line">${exitData.nationality || ''}</span>
              </div>
              
              <div class="id-boxes-container">
                <span>حامل هوية رقم</span>
                <div class="id-boxes">
                  ${idDigits.map(d => `<div class="id-box">${d}</div>`).join('')}
                </div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 25%">نوع المركبة</th>
                  <th style="width: 30%">اللون / الموديل</th>
                  <th style="width: 20%">رقم اللوحة</th>
                  <th style="width: 25%">رقم الشاسية</th>
                </tr>
              </thead>
              <tbody>
                <tr class="table-data-row">
                  <td>${formatVehicleDisplay(car)}</td>
                  <td>${car.color} / ${car.year}</td>
                  <td>${(car.plateData?.plateNumber || '').trim() || 'بطاقة جمركية'}</td>
                  <td style="font-family: monospace;">${car.vin}</td>
                </tr>
              </tbody>
            </table>

            <div class="declaration">
              ${(settings.declarationText || 'وقد تم استلام المركبة ومحتوياتها وجميع أوراقها وهي بحالة جيدة وحسب ما تم الاتفاق عليه ،\nولا يوجد بها أي خدوش ولا صدمات وأصبحت تحت مسؤوليتي من تاريخ وساعة الاستلام').replace(/\n/g, '<br/>')}
            </div>

            <div class="notes-row">
              <span>ملاحظات /</span>
              <div class="notes-lines" style="padding-right: 12px; font-weight: 800; color: #1e293b; font-size: 11pt;">
                ${exitData.notes ? `<span>${exitData.notes.replace(/\n/g, '<br/>')}</span>` : `<div class="dotted-full"></div><div class="dotted-full"></div>`}
              </div>
            </div>

            <div class="footer-grid">
              <div class="sig-col">
                <div class="sig-row">المستلم / <span>/</span></div>
                <div class="sig-row">التوقيع / <span>/</span></div>
                <div class="sig-row">رقم الهاتف / <span style="font-weight: 800; color: #1e293b; padding-right: 12px;">${exitData.receiverPhone || '/'}</span></div>
              </div>
              <div class="sig-col">
                <div class="sig-row">المسلم / <span>/</span></div>
                <div class="sig-row">التوقيع / <span>/</span></div>
                <div class="sig-row">البائع / <span style="font-weight: 800; color: #1e293b; padding-right: 12px;">${exitData.seller || exitData.representativeName || car.seller || '/'}</span></div>
              </div>
            </div>

            <!-- DIGITAL VERIFICATION QR CODE -->
            ${getQRHtml(qrResult.qrCodeDataUrl, qrResult.fingerprint)}

            <div class="management-section">
              <span>إدارة المخزون :</span>
              <img src="${settings.stampUrl || getStampDataUri(settings.name ? `${settings.orgType || 'مؤسسة'} ${settings.name}` : undefined, settings.commercialRegister, settings.orgType)}" class="stamp-img" style="mix-blend-mode: multiply;" />
              <span>إدارة الحسابات :</span>
            </div>
          </div>
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
                window.close();
              }, 1000);
            };
          </script>
        </body>
      </html>
    `;
    safePrint(html);

    if (onArchiveLetter) {
      onArchiveLetter({
        letterType: docTitle,
        vin: car.vin || '',
        plateNumber: car.plateData?.plateNumber || car.customData?.plateNumber || '',
        cardNumber: car.cardNumber || '',
        vehicleName: `${formatVehicleDisplay(car)} ${car.year}`,
        driverName: exitData.receiverName || '',
        destination: car.customData?.entryTransportCompany || exitData.transportCompany || '',
        htmlContent: html
      });
    }
  };

  const handlePrintCarrierLetter = (car: Car) => {
    setSelectedCarrierCar(car);
    setSelectedCarrierCars(undefined);
    setIsCarrierModalOpen(true);
  };

  const handleSaveWithdrawal = (carData: any, withdrawalHtml: string, entryPermitHtml: string) => {
    if (selectedWithdrawalCar) {
      onUpdate({
        ...selectedWithdrawalCar,
        brand: carData.brand,
        model: carData.model,
        year: carData.year,
        color: carData.color,
        vin: carData.vin,
        notes: carData.notes || selectedWithdrawalCar.notes,
        exitData: {
          ...selectedWithdrawalCar.exitData,
          ...carData.exitData,
        },
        customData: {
          ...selectedWithdrawalCar.customData,
          ...carData.customData,
        },
        history: [
          ...(selectedWithdrawalCar.history || []),
          {
            id: `h-${Date.now()}`,
            action: 'تحديث بيانات وطباعة خطاب سحب وبطاقة استلام',
            timestamp: new Date().toISOString(),
            user: currentUser?.username || 'نظام'
          }
        ]
      });
    } else {
      onAdd({ 
        id: `car-${Date.now()}`, 
        ...carData, 
        entryDate: new Date().toISOString(), 
        history: [{ 
          id: `h-${Date.now()}`, 
          action: 'إضافة مركبة بخطاب سحب', 
          timestamp: new Date().toISOString(), 
          user: currentUser?.username || 'نظام' 
        }] 
      });
    }

    safePrint(withdrawalHtml);

    setTimeout(() => {
      safePrint(entryPermitHtml);
    }, 1000);

    if (onArchiveLetter) {
      onArchiveLetter({
        letterType: 'خطاب سحب مركبة صادر رسمي',
        vin: carData.vin || '',
        plateNumber: '',
        cardNumber: carData.cardNumber || '',
        vehicleName: `${formatVehicleDisplay(carData)} ${carData.year}`,
        driverName: carData.exitData?.receiverName || '',
        destination: carData.customData?.entryTransportCompany || carData.exitData?.transportCompany || '',
        htmlContent: withdrawalHtml
      });

      onArchiveLetter({
        letterType: 'إذن دخول واستلام مخزني (تلقائي)',
        vin: carData.vin || '',
        plateNumber: '',
        cardNumber: carData.cardNumber || '',
        vehicleName: `${formatVehicleDisplay(carData)} ${carData.year}`,
        driverName: carData.exitData?.receiverName || '',
        destination: carData.customData?.entryTransportCompany || carData.exitData?.transportCompany || '',
        htmlContent: entryPermitHtml
      });
    }

    setIsWithdrawalModalOpen(false);
    setSelectedWithdrawalCar(undefined);
  };

  const handleSaveCheckpointLetter = (
    letterHtml: string, 
    info: { brand: string; model: string; year: string; vin: string; driverName: string; transitTo: string }
  ) => {
    safePrint(letterHtml);

    if (onArchiveLetter) {
      onArchiveLetter({
        letterType: 'خطاب شحن ونقل (نقاط التفتيش)',
        vin: info.vin || '',
        plateNumber: '',
        cardNumber: '',
        vehicleName: `${info.brand} ${info.model} ${info.year}`,
        driverName: info.driverName || '',
        destination: info.transitTo || '',
        htmlContent: letterHtml
      });
    }

    setIsCheckpointModalOpen(false);
    setSelectedCheckpointCar(undefined);
    setSelectedCheckpointCars(undefined);
  };

  const handleSaveCarrierLetter = (
    letterHtml: string, 
    info: { 
      brand: string; 
      model: string; 
      year: string; 
      vin: string; 
      salutation: string; 
      deliveryTo: string;
      driverName?: string;
      driverId?: string;
      driverPhone?: string;
      truckPlate?: string;
    }
  ) => {
    safePrint(letterHtml);

    const targetCars = selectedCarrierCar ? [selectedCarrierCar] : (selectedCarrierCars || []);

    // Treat carried vehicles as immediate exit/outbound upon creating a carrier/transfer letter
    targetCars.forEach(carObj => {
      onUpdate({
        ...carObj,
        isOutbound: true,
        isPresentInShowroom: false,
        status: carObj.status === CarStatus.IN_TRANSFER ? carObj.status : CarStatus.IN_TRANSFER,
        exitData: {
          receiverName: info.driverName || info.deliveryTo || info.salutation || 'الجهة المستقبلة',
          receiverPhone: info.driverPhone || '',
          receiverId: info.driverId || '',
          representativeName: info.driverName || currentUser?.username || 'نظام',
          deliveryType: DeliveryType.TRANSPORT,
          transportCompany: info.truckPlate || info.salutation || '',
          exitDate: new Date().toISOString().split('T')[0],
          notes: `تحويل صادر / خروج بموجب خطاب ناقل (سائق: ${info.driverName || '—'}, هوية: ${info.driverId || '—'}, شاحنة: ${info.truckPlate || '—'}) إلى ${info.deliveryTo || info.salutation || 'الجهة المستقبلة'}`,
          seller: currentUser?.username || 'نظام'
        },
        lastModified: new Date().toISOString(),
        history: [
          ...(carObj.history || []),
          {
            id: `h-carrier-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            action: `خروج لحظي / تحويل صادر بموجب خطاب الناقل (السائق: ${info.driverName || '—'}) إلى [${info.deliveryTo || info.salutation}]`,
            timestamp: new Date().toISOString(),
            user: currentUser?.username || 'نظام'
          }
        ]
      });

      if (addLog) {
        addLog(
          'خروج / تحويل مركبة محمولة',
          carObj.id,
          'transfer',
          `تم تسليم وخروج المركبة ${formatVehicleDisplay(carObj)} رقم الهيكل ${carObj.vin} بموجب خطاب التحويل/الناقل (السائق: ${info.driverName || '—'})`
        );
      }
    });

    if (onArchiveLetter) {
      if (selectedCarrierCar) {
        onArchiveLetter({
          letterType: 'خطاب شاحن الناقل (مندوب الشحن)',
          vin: info.vin || '',
          plateNumber: selectedCarrierCar.plateData?.plateNumber || selectedCarrierCar.customData?.plateNumber || '',
          cardNumber: selectedCarrierCar.cardNumber || '',
          vehicleName: `${info.brand} ${info.model} ${info.year}`,
          driverName: info.driverName || info.deliveryTo || '',
          destination: info.salutation || '',
          htmlContent: letterHtml
        });
      } else if (selectedCarrierCars) {
        onArchiveLetter({
          letterType: 'خطاب شاحن الناقل (مجمع)',
          vin: `مجمع - ${selectedCarrierCars.length}`,
          plateNumber: '',
          cardNumber: '',
          vehicleName: `خطاب مجمع لعدد ${selectedCarrierCars.length} سيارات`,
          driverName: info.driverName || info.deliveryTo || '',
          destination: info.salutation || '',
          htmlContent: letterHtml
        });
      }
    }

    setIsCarrierModalOpen(false);
    setSelectedCarrierCar(undefined);
    setSelectedCarrierCars(undefined);
  };

  const handlePrintPriceQuote = (car: Car) => {
    setSelectedPriceQuoteCar(car);
    setIsPriceQuoteModalOpen(true);
  };

  const handleSavePriceQuote = (
    htmlContent: string, 
    quoteInfo: {
      quotationNumber: string;
      quotationDate: string;
      clientName: string;
      representativeName: string;
      finalTotal: number;
      vin: string;
      brand: string;
      model: string;
    }
  ) => {
    safePrint(htmlContent);

    if (onArchiveLetter) {
      onArchiveLetter({
        letterNumber: quoteInfo.quotationNumber,
        letterType: 'خطاب عرض سعر سيارة (Quotation)',
        letterDate: quoteInfo.quotationDate,
        vin: quoteInfo.vin || '',
        plateNumber: '',
        cardNumber: '',
        vehicleName: `${quoteInfo.brand} ${quoteInfo.model}`,
        driverName: quoteInfo.representativeName || '',
        destination: quoteInfo.clientName || '',
        htmlContent: htmlContent
      });
    }

    if (addLog) {
      addLog(
        'طباعة وأرشفة عرض سعر',
        selectedPriceQuoteCar?.id || quoteInfo.vin,
        'car',
        `تم إنشاء وطباعة عرض سعر رقم [${quoteInfo.quotationNumber}] للعميل (${quoteInfo.clientName}) بقيمة ${quoteInfo.finalTotal} ريال بواسطة ${quoteInfo.representativeName}`
      );
    }
  };

  const handlePrintBulkEntryPermits = () => {
    const selectedCars = cars.filter(c => selectedIds.has(c.id));
    if (selectedCars.length === 0) return;

    const formattedEntryDate = `${new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'numeric', day: 'numeric' })} م (${new Date().toISOString().split('T')[0]})`;

    const watermarkImg = `<img src="${settings.logoUrl || getLogoDataUri(settings.name)}" class="watermark" />`;
    
    // Chunk array helper
    const chunkArray = <T,>(arr: T[], size: number): T[][] => {
      const chunks: T[][] = [];
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
      }
      return chunks;
    };

    const carChunks = chunkArray(selectedCars, 8);

    const pagesHtml = carChunks.map((chunk, chunkIndex) => {
      const carRows = chunk.map((car, index) => {
        return `
          <tr class="data-row">
            <td>${chunkIndex * 8 + index + 1}</td>
            <td>${formatVehicleDisplay(car)}</td>
            <td style="font-family: monospace;">${car.vin}</td>
            <td>${car.color || ''} / ${car.year || ''}</td>
            <td>${car.supplier || '—'}</td>
            <td>${car.customData?.entryTransportCompany || car.exitData?.transportCompany || '—'}</td>
          </tr>
        `;
      }).join('');

      const requiredRows = Math.max(0, 8 - chunk.length);
      const emptyRows = Array.from({ length: requiredRows }).map((_, i) => `
        <tr class="empty-row">
          <td>${chunkIndex * 8 + chunk.length + i + 1}</td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>
      `).join('');

      const chunkNotes = chunk
        .map(c => c.customData?.entryNotes ? `سيارة (${c.brand} ${c.model}): ${c.customData.entryNotes}` : null)
        .filter(Boolean)
        .join(' | ');

      return `
        <div class="content-wrapper">
          ${watermarkImg}
          
          <div class="header">
            <div class="header-info">
              <div>${settings.orgType || 'مؤسسة'} ${settings.name || 'سما الفرسان للتجارة'}</div>
              <div>سجل تجاري : ${settings.commercialRegister || '5950007763'}</div>
              <div>الرقم الضريبي : ${settings.taxNumber || '311804654800003'}</div>
              <div>رقم التواصل : ${settings.contactNumber || ''}</div>
              <div>${settings.address || 'نجران - الصناعية'}</div>
            </div>
            <div class="logo-header">
              <img src="${settings.logoUrl || getLogoDataUri(settings.name)}" class="logo" />
            </div>
          </div>

          <div class="title-section">
            <h1 class="title">إذن دخول واستلام مخزني</h1>
          </div>

          <div class="date-row" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
             <span>التاريخ: ${formattedEntryDate}</span>
             <span style="font-size: 10pt; font-weight: bold; color: #475569;">صفحة ${chunkIndex + 1} من ${carChunks.length}</span>
          </div>

          <table>
            <colgroup>
              <col style="width: 45px; min-width: 45px; max-width: 45px;" class="col-counter" />
              <col style="width: 25%;" />
              <col style="width: 25%;" />
              <col style="width: 16%;" />
              <col style="width: 17%;" />
              <col style="width: 17%;" />
            </colgroup>
            <thead>
              <tr>
                <th style="width: 45px; min-width: 45px; max-width: 45px;" class="col-counter">الرقم</th>
                <th style="width: 25%">نوع المركبة</th>
                <th style="width: 25%">رقم الشاسية</th>
                <th style="width: 16%">اللون / الموديل</th>
                <th style="width: 17%">المورد</th>
                <th style="width: 17%">شركة الشحن</th>
              </tr>
            </thead>
            <tbody>
              ${carRows}
              ${emptyRows}
            </tbody>
          </table>

          ${chunkNotes ? `
            <div style="border: 1.5pt solid #000; border-radius: 4px; padding: 6px 10px; margin-top: 4px; margin-bottom: 4px; background-color: #f8fafc; font-size: 9.5pt; font-weight: bold;">
              📝 ملاحظات الدخول: ${chunkNotes}
            </div>
          ` : ''}

          <div class="management-section">
            <span>ادارة المخزون :</span>
            <img src="${settings.stampUrl || getStampDataUri(settings.name ? `${settings.orgType || 'مؤسسة'} ${settings.name}` : undefined, settings.commercialRegister, settings.orgType)}" style="max-height: 70px; max-width: 70px; mix-blend-mode: multiply;" />
            <span>ادارة الحسابات :</span>
          </div>
        </div>
      `;
    }).join('');

    const html = `
      <html dir="rtl">
        <head>
          <title>إذن استلام مخزني مجمع - ${selectedCars.length} سيارات</title>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
          <style>
            @page { size: A4 portrait; margin: 8mm; }
            html, body { margin: 0; padding: 0; background: #fff; }
            body { 
              font-family: 'Cairo', sans-serif; 
              direction: rtl; 
              color: #000; 
              background: #fff; 
              -webkit-print-color-adjust: exact;
            }
            .content-wrapper { 
              padding: 4mm 6mm; 
              position: relative; 
              height: 262mm; 
              overflow: hidden;
              display: flex; 
              flex-direction: column; 
              justify-content: flex-start;
              gap: 6px;
              box-sizing: border-box; 
              page-break-inside: avoid;
              page-break-after: always;
              border: 3px solid #000;
            }
            .content-wrapper:last-child {
              page-break-after: avoid;
            }
            
            .header { 
              display: flex; 
              justify-content: space-between; 
              align-items: flex-start; 
              margin-bottom: 2px; 
              border-bottom: 1.5px solid #cbd5e1;
              padding-bottom: 4px;
            }
            .header-info { 
              text-align: right; 
              font-size: 8.5pt; 
              font-weight: bold; 
              line-height: 1.3; 
              color: #334155;
            }
            .logo-header {
              text-align: center;
              width: 160px;
            }
            .logo { 
              width: 85px; 
              max-height: 50px;
              object-fit: contain;
              margin-bottom: 2px;
            }
            
            .title-section { 
              text-align: center; 
              margin: 4px 0; 
              border-top: 1.5px solid #000;
              border-bottom: 1.5px solid #000;
              padding: 2px 0;
            }
            .title { 
              font-size: 18pt; 
              font-weight: 900; 
              display: inline-block; 
              margin: 0;
            }
            
            .date-row { 
              margin-bottom: 4px; 
              font-weight: 950; 
              font-size: 10pt; 
              color: #334155;
            }
            
            table { width: 100%; border-collapse: collapse; margin-bottom: 6px; table-layout: fixed; }
            th.col-counter, td.col-counter, .col-counter { width: 45px !important; min-width: 45px !important; max-width: 45px !important; }
            th, td { border: 1.5pt solid #000; padding: 4px 2px; text-align: center; font-size: 9.5pt; font-weight: 900; }
            th { background-color: #f1f5f9; font-size: 9pt; height: 26px; }
            .data-row { height: 34px; }
            .empty-row { height: 30px; }
            
            .management-section {
              margin-top: auto;
              display: flex; 
              justify-content: space-between;
              font-size: 11pt;
              font-weight: 900;
              padding-bottom: 4px;
              border-top: 1px dashed #475569;
              padding-top: 6px;
            }
            
            .watermark { 
              position: absolute; 
              top: 50%; 
              left: 50%; 
              transform: translate(-50%, -50%); 
              opacity: 0.18; 
              width: 60%; 
              pointer-events: none; 
              z-index: 9999; 
            }
            
            @media print { 
              html, body { height: auto; overflow: visible; margin: 0; padding: 0; }
              .content-wrapper { 
                height: 262mm !important; 
                overflow: hidden !important;
                width: 100% !important; 
                border: 3px solid #000 !important; 
                padding: 4mm 8mm !important; 
                box-sizing: border-box !important; 
                page-break-after: always !important; 
              }
              .content-wrapper:last-child { page-break-after: avoid !important; }
            }
            ${getLogoStyleOverride()}
          </style>
        </head>
        <body>
          ${pagesHtml}
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
                window.close();
              }, 1000);
            };
          </script>
        </body>
      </html>
    `;
    safePrint(html);

    if (onArchiveLetter) {
      onArchiveLetter({
        letterType: 'إذن استلام مخزني مجمع (دخول)',
        vin: `مجمع - ${selectedCars.length} سيارة`,
        plateNumber: '',
        cardNumber: '',
        vehicleName: `خطاب مجمع لعدد ${selectedCars.length} سيارات`,
        driverName: '',
        destination: 'الحسابات والمخزن',
        htmlContent: html
      });
    }
  };

  const handleBulkEditSave = (fieldsToChange: Partial<Car>, changedFieldsLabels: string[]) => {
    if (selectedIds.size === 0) return;

    cars.forEach((car, idx) => {
      if (selectedIds.has(car.id)) {
        const mergedCarData = {
          ...car,
          ...fieldsToChange
        };
        const updatedCar: Car = {
          ...mergedCarData,
          vinMatching: fieldsToChange.vinMatching !== undefined 
            ? (fieldsToChange.vinMatching === 'غير مطابق' ? 'غير مطابق' : (fieldsToChange.vinMatching === 'لم يرد البطاقه بعد' ? 'لم يرد البطاقه بعد' : 'مطابق'))
            : (car.vinMatching === 'غير مطابق' ? 'غير مطابق' : (car.vinMatching === 'لم يرد البطاقه بعد' ? 'لم يرد البطاقه بعد' : 'مطابق')),
          lastModified: new Date().toISOString(),
          history: [
            ...(car.history || []),
            {
              id: `h-${Date.now()}-${idx}`,
              action: `تعديل جماعي: تم تحديث الحقول [${changedFieldsLabels.join(', ')}]`,
              timestamp: new Date().toISOString(),
              user: currentUser?.username || 'نظام'
            }
          ]
        };
        onUpdate(updatedCar);
      }
    });

    if (addLog) {
      addLog(
        'تعديل جماعي',
        'bulk',
        'car',
        `تم تعديل جماعي لـ (${selectedIds.size}) سيارة بنجاح (الحقول المحدثة: ${changedFieldsLabels.join(', ')}) بواسطة: ${currentUser?.username || 'نظام'}`
      );
    }

    setSelectedIds(new Set());
    setIsBulkEditModalOpen(false);
  };

  const handlePrintBulkExitPermits = async (params: {
    receiverName: string;
    receiverPhone: string;
    receiverId: string;
    nationality: string;
    deliveryType: DeliveryType;
    transportCompany: string;
    exitDate: string;
    seller: string;
    notes: string;
    permitTitle: string;
    shouldSaveToCars: boolean;
  }) => {
    const selectedCars = cars.filter(c => selectedIds.has(c.id));
    if (selectedCars.length === 0) return;

    // Automatically update exit details and move selected cars to Sales (status: SOLD, isOutbound: true)
    selectedCars.forEach((car, idx) => {
      const updatedExitData = {
        ...(car.exitData || {}),
        receiverName: params.receiverName,
        receiverPhone: params.receiverPhone,
        receiverId: params.receiverId,
        nationality: params.nationality,
        deliveryType: params.deliveryType,
        transportCompany: params.transportCompany,
        exitDate: params.exitDate,
        seller: params.seller,
        notes: params.notes,
      };

      const updatedCar: Car = {
        ...car,
        exitData: updatedExitData,
        seller: params.seller || car.seller,
        status: CarStatus.SOLD,
        isOutbound: true,
        lastModified: new Date().toISOString(),
        history: [
          ...(car.history || []),
          {
            id: `h-${Date.now()}-${idx}`,
            action: `إذن خروج مجمع: تم تسجيل وتحديث بيانات المستلم (${params.receiverName}) ونقل المركبة تلقائياً إلى المبيعات`,
            timestamp: new Date().toISOString(),
            user: currentUser?.username || 'نظام'
          }
        ]
      };
      onUpdate(updatedCar);
    });

    if (addLog) {
      addLog(
        'إذن خروج مجمع',
        'bulk',
        'car',
        `تم تسجيل وتعديل بيانات خروج لـ (${selectedCars.length}) سيارات ونقلها تلقائياً إلى المبيعات للمستلم (${params.receiverName}) بواسطة: ${currentUser?.username || 'نظام'}`
      );
    }

    const docTitle = params.permitTitle || 'إذن خروج وتسليم سيارات (مجمع)';

    const { generateQrCodeDataUrl: genQR, getEmbeddedQrHtml: getQRHtml } = await import('../src/utils/qrHelper');
    const qrResult = await genQR({
      documentType: docTitle,
      serialNumber: selectedCars.map(c => c.vin || '').filter(Boolean).slice(0, 3).join(', ') + (selectedCars.length > 3 ? '...' : ''),
      date: params.exitDate || new Date().toISOString().split('T')[0],
      orgName: settings.name || 'سما الفرسان للتجارة',
      orgCr: settings.commercialRegister || '',
      orgVat: settings.taxNumber || '',
      vehicleDetails: {
        brand: `عدد (${selectedCars.length}) مركبة مجمعة`,
        model: selectedCars.map(c => formatVehicleDisplay(c)).join(' / '),
        year: '',
        color: '',
        vin: selectedCars.map(c => c.vin).join(', '),
        plateNumber: selectedCars.map(c => c.plateData?.plateNumber || c.customData?.plateNumber || '').filter(Boolean).join(', '),
        cardNumber: '',
      },
      recipientDetails: {
        name: params.receiverName || '',
        idNumber: params.receiverId || '',
        phoneNumber: params.receiverPhone || '',
        destination: params.transportCompany || '',
      }
    });

    const idDigits = (params.receiverId || '').padEnd(10, ' ').split('').slice(0, 10);

    const targetExitDate = params.exitDate || (settings.exitPermitDateType === 'custom' && settings.exitPermitCustomDate
      ? settings.exitPermitCustomDate
      : new Date().toISOString().split('T')[0]);

    const formattedExitDate = `${new Date(targetExitDate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'numeric', day: 'numeric' })} م (${targetExitDate})`;

    const watermarkImg = `<img src="${settings.logoUrl || getLogoDataUri(settings.name)}" class="watermark" />`;
    const headerLogo = `<img src="${settings.logoUrl || getLogoDataUri(settings.name)}" class="logo" />`;

    const carRows = selectedCars.map((car, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${formatVehicleDisplay(car)}</td>
        <td>${car.color || ''} / ${car.year || ''}</td>
        <td>${(car.plateData?.plateNumber || car.customData?.plateNumber || '').trim() || 'بطاقة جمركية'}</td>
        <td style="font-family: monospace;">${car.vin || ''}</td>
      </tr>
    `).join('');

    const html = `
      <html dir="rtl">
        <head>
          <title>${docTitle} - ${selectedCars.length} سيارات</title>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            html, body { margin: 0; padding: 0; }
            body { 
              font-family: 'Cairo', sans-serif; 
              direction: rtl; 
              color: #0f172a; 
              background: #fff; 
              -webkit-print-color-adjust: exact;
            }
            .content-wrapper { 
              padding: 2.5mm 6mm; 
              position: relative; 
              height: 262mm; 
              overflow: hidden;
              display: flex; 
              flex-direction: column; 
              justify-content: flex-start;
              gap: 5px;
              box-sizing: border-box; 
              border: 3px solid #000;
            }
            
            .header { 
              display: flex; 
              justify-content: space-between; 
              align-items: flex-start; 
              margin-bottom: 3px; 
              border-bottom: 1.2px solid #cbd5e1;
              padding-bottom: 3px;
            }
            .header-info { 
              text-align: right; 
              font-size: 8.5pt; 
              font-weight: 700; 
              line-height: 1.4; 
              color: #475569;
            }
            .logo-header {
              text-align: center;
              width: 140px;
            }
            .logo { 
              width: 75px; 
              margin-bottom: 1px;
            }
            
            .title-section { 
              text-align: center; 
              margin: 3px 0; 
              border-top: 1.2px solid #1e293b;
              border-bottom: 1.2px solid #1e293b;
              padding: 2px 0;
            }
            .title { 
              font-size: 14pt; 
              font-weight: 950; 
              display: inline-block; 
              letter-spacing: -0.5px; 
              color: #0f172a;
              margin: 0;
            }
            
            .date-row { 
              text-align: left; 
              margin-bottom: 3px; 
              font-weight: 700; 
              font-size: 9pt; 
              color: #475569;
            }
            
            .receiver-info { 
              margin-bottom: 3px; 
              font-size: 9.5pt; 
              font-weight: 700; 
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              padding: 4px 8px;
            }
            .info-row { 
              display: flex; 
              align-items: center; 
              margin-bottom: 4px; 
            }
            .info-row:last-child {
              margin-bottom: 0;
            }
            .dotted-line { 
              border-bottom: 1px dashed #64748b; 
              flex: 1; 
              margin: 0 6px; 
              padding-bottom: 1px; 
              min-width: 60px;
              text-align: center;
              min-height: 16px;
              color: #0f172a;
              font-weight: bold;
            }
            
            .id-boxes-container { 
              display: flex; 
              align-items: center; 
              justify-content: flex-end; 
              margin-top: 3px;
              gap: 8px; 
            }
            .id-boxes { display: flex; direction: ltr; gap: 0; border: 1px solid #475569; }
            .id-box { 
              width: 20px; 
              height: 20px; 
              border: 0.5px solid #94a3b8; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              font-size: 9.5pt; 
              font-weight: 700; 
              background: #fff; 
            }
            
            table { width: 100%; border-collapse: collapse; margin: 4px 0; table-layout: fixed; }
            th, td { border: 1px solid #1e293b; padding: 4px 3px; text-align: center; font-size: 8.5pt; font-weight: 700; }
            th { background-color: #f1f5f9; font-size: 8.5pt; height: 26px; color: #1e293b; }
            tbody tr { height: 26px; }
            
            .declaration { 
              font-size: 9.5pt; 
              font-weight: 800; 
              text-align: center; 
              margin: 3px 0; 
              line-height: 1.4; 
              color: #1e293b;
              padding: 4px 8px;
              background: #f8fafc;
              border-right: 3.5px solid #475569;
              border-left: 3.5px solid #475569;
              border-radius: 4px;
            }
            
            .notes-row { 
              display: flex; 
              align-items: center; 
              font-size: 9pt; 
              font-weight: 700; 
              margin-bottom: 3px;
            }
            .notes-lines { flex: 1; margin-right: 6px; }
            .dotted-full { border-bottom: 1px dotted #475569; height: 16px; width: 100%; }
            
            .footer-grid { 
              display: flex;
              justify-content: space-between;
              margin-top: 3px;
              gap: 10px;
              padding-bottom: 2px;
            }
            .sig-col { display: flex; flex-direction: column; gap: 2px; font-size: 9pt; font-weight: 700; min-width: 210px; }
            .sig-row { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #e2e8f0; padding-bottom: 2px; }
            
            .management-section {
              margin-top: auto;
              display: flex;
              justify-content: space-between;
              font-size: 9pt;
              font-weight: 700;
              padding-bottom: 2px;
              border-top: 1px dashed #475569;
              padding-top: 3px;
            }
            
            .watermark { 
              position: absolute; 
              top: 50%; 
              left: 50%; 
              transform: translate(-50%, -50%); 
              opacity: 0.24; 
              width: 50%; 
              pointer-events: none; 
              z-index: 9999; 
            }
            @media print {
              html, body { height: auto; overflow: visible; margin: 0; padding: 0; }
              .content-wrapper { 
                height: 262mm !important; 
                overflow: hidden !important;
                width: 100% !important; 
                border: 3px solid #000 !important; 
                padding: 2.5mm 6mm !important; 
                box-sizing: border-box !important; 
                page-break-inside: avoid; 
              }
            }
            ${getBilingualPrintHeaderCss()}
            ${getLogoStyleOverride()}
          </style>
        </head>
        <body>
          <div class="content-wrapper">
            ${watermarkImg}
            
            ${getBilingualPrintHeaderHtml(settings)}

            <div class="title-section">
               <h1 class="title">${docTitle}</h1>
            </div>

            <div class="date-row">
               التاريخ: ${formattedExitDate}
            </div>

            <div class="receiver-info">
              <div class="info-row">
                <span>استلمت انا /</span>
                <span class="dotted-line">${params.receiverName || '&nbsp;'}</span>
                <span>الجنسية /</span>
                <span class="dotted-line">${params.nationality || '&nbsp;'}</span>
              </div>
              
              <div class="id-boxes-container">
                <span>حامل هوية رقم</span>
                <div class="id-boxes">
                  ${idDigits.map(d => `<div class="id-box">${d === ' ' ? '&nbsp;' : d}</div>`).join('')}
                </div>
              </div>
            </div>

            <table>
              <colgroup>
                <col style="width: 47px; min-width: 47px; max-width: 47px;" class="col-counter" />
                <col style="width: 32%;" />
                <col style="width: 25%;" />
                <col style="width: 18%;" />
                <col style="width: 25%;" />
              </colgroup>
              <thead>
                <tr>
                  <th style="width: 47px; min-width: 47px; max-width: 47px;" class="col-counter">م</th>
                  <th style="width: 32%">السيارة / المركبة</th>
                  <th style="width: 25%">اللون والموديل</th>
                  <th style="width: 18%">رقم اللوحة</th>
                  <th style="width: 25%">رقم الشاسية</th>
                </tr>
              </thead>
              <tbody>
                ${carRows}
              </tbody>
            </table>

            <div class="declaration">
              ${(settings.declarationTextPlural || 'وقد تم استلام المركبات المذكورة أعلاه ومحتوياتها وجميع أوراقها وهي بحالة جيدة وحسب ما تم الاتفاق عليه ،\nولا يوجد بها أي خدوش ولا صدمات وأصبحت تحت مسؤوليتي من تاريخ وساعة الاستلام').replace(/\n/g, '<br/>')}
            </div>

            <div class="notes-row">
              <span>ملاحظات /</span>
              <div class="notes-lines">
                <div class="dotted-full">${params.notes || ''}</div>
              </div>
            </div>

            <div class="footer-grid">
              <div class="sig-col">
                <div class="sig-row">المستلم / <span>/</span></div>
                <div class="sig-row">التوقيع / <span>/</span></div>
                <div class="sig-row">رقم الهاتف / <span style="font-weight: 800; color: #1e293b; padding-right: 12px;">${params.receiverPhone || '/'}</span></div>
              </div>
              <div class="sig-col">
                <div class="sig-row">المسلم / <span>/</span></div>
                <div class="sig-row">التوقيع / <span>/</span></div>
                <div class="sig-row">البائع / <span style="font-weight: 800; color: #1e293b; padding-right: 12px;">${params.seller || (selectedCars[0]?.seller) || '/'}</span></div>
              </div>
            </div>

            <!-- DIGITAL VERIFICATION QR CODE -->
            ${getQRHtml(qrResult.qrCodeDataUrl, qrResult.fingerprint)}

            <div class="management-section">
              <span>إدارة المخزون :</span>
              <img src="${settings.stampUrl || getStampDataUri(settings.name ? `${settings.orgType || 'مؤسسة'} ${settings.name}` : undefined, settings.commercialRegister, settings.orgType)}" style="max-height: 90px; max-width: 90px; mix-blend-mode: multiply;" />
              <span>إدارة الحسابات :</span>
            </div>
          </div>
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
                window.close();
              }, 1000);
            };
          </script>
        </body>
      </html>
    `;
    safePrint(html);

    if (onArchiveLetter) {
      selectedCars.forEach(car => {
        onArchiveLetter({
          letterType: docTitle,
          vin: car.vin || '',
          plateNumber: car.plateData?.plateNumber || car.customData?.plateNumber || '',
          cardNumber: car.cardNumber || '',
          vehicleName: `${formatVehicleDisplay(car)} ${car.year}`,
          driverName: params.receiverName || '',
          destination: params.transportCompany || car.customData?.entryTransportCompany || '',
          htmlContent: html
        });
      });
    }

    setIsBulkExitModalOpen(false);
  };

  const getCarColumnExportValue = (car: Car, key: string): string => {
    const notForSale = (car as any).isNotForSale || car.status === CarStatus.NOT_FOR_SALE || String(car.status).includes('غير معروضة') || String(car.status).includes('غير معروضه');
    
    if (key === 'seq') {
      return '';
    } else if (key === 'brand') {
      return car.brand || '-';
    } else if (key === 'model') {
      return car.model || '-';
    } else if (key === 'interior_color') {
      return car.interiorColor || car.customData?.interiorColor || '-';
    } else if (key === 'color') {
      return car.color || '-';
    } else if (key === 'year') {
      return car.year ? String(car.year) : '-';
    } else if (key === 'car_remark') {
      return car.carRemark || '-';
    } else if (key === 'entry_transport_company') {
      return car.customData?.entryTransportCompany || car.customData?.transportCompany || '-';
    } else if (key === 'car_info') {
      return formatVehicleDisplay(car);
    } else if (key === 'color_model') {
      return `${car.color || '-'} | ${car.year || '-'}`;
    } else if (key === 'ownership') {
      return car.ownershipType || '-';
    } else if (key === 'card_number') {
      const rawCard = car.cardNumber ? String(car.cardNumber).trim() : '';
      const hasNoCard = !rawCard || rawCard === '-' || rawCard === 'null' || rawCard === 'undefined' || rawCard.includes('لم ترد');
      return hasNoCard ? 'لم ترد البطاقة' : (car.cardNumber || '-');
    } else if (key === 'vin') {
      return car.vin || '-';
    } else if (key === 'vin_matching') {
      return car.vinMatching || 'مطابق';
    } else if (key === 'plate') {
      return car.hasPlate && car.plateData?.plateNumber ? car.plateData.plateNumber : '-';
    } else if (key === 'rental') {
      return car.rentalStatus || '-';
    } else if (key === 'status') {
      return car.status || 'متوفرة';
    } else if (key === 'car_condition') {
      const rawCond = car.exitData?.carCondition || '';
      return notForSale ? (rawCond ? `${rawCond} - السياره غير معروضه للبيع` : 'السياره غير معروضه للبيع') : (rawCond || '-');
    } else if (key === 'supplier') {
      return car.supplier || '-';
    } else if (key === 'entry_date') {
      return car.entryDate ? car.entryDate.split('T')[0] : '-';
    } else if (key === 'notes') {
      const rawNotes = getReservationRepresentative(car);
      return notForSale ? (rawNotes && rawNotes !== '-' ? `${rawNotes} - السياره غير معروضه للبيع` : 'السياره غير معروضه للبيع') : (rawNotes || '-');
    } else if (key === 'showroom') {
      return car.status || (car.isPresentInShowroom !== false ? 'نعم' : 'لا');
    } else if (key === 'attribution') {
      return car.attributionSource || '-';
    } else if (key === 'seller') {
      return getRepresentativeOrSeller(car) || '-';
    } else if (key === 'delivery_type') {
      return car.exitData?.deliveryType || '-';
    } else if (key === 'transport_company') {
      return car.customData?.entryTransportCompany || car.exitData?.transportCompany || '-';
    } else if (key === 'receiver_name') {
      return car.exitData?.receiverName || '-';
    } else if (key === 'receiver_id') {
      return car.exitData?.receiverId || '-';
    } else if (key === 'nationality') {
      return car.exitData?.nationality || '-';
    } else if (key === 'receiver_phone') {
      return car.exitData?.receiverPhone || '-';
    } else if (key === 'exit_date') {
      return car.exitData?.exitDate || '-';
    } else if (key === 'exit_notes') {
      const rawExitNotes = car.exitData?.notes || '';
      return notForSale ? (rawExitNotes ? `${rawExitNotes} - السياره غير معروضه للبيع` : 'السياره غير معروضه للبيع') : (rawExitNotes || '-');
    } else if (key === 'cost_price') {
      return canViewFinancials && car.costPrice ? `${Number(car.costPrice).toLocaleString('en-US')} ر.س` : '-';
    } else if (key === 'price') {
      return canViewFinancials && car.price ? `${Number(car.price).toLocaleString('en-US')} ر.س` : '-';
    } else {
      return car.customData?.[key] !== undefined && car.customData?.[key] !== null ? String(car.customData[key]) : '-';
    }
  };

  const handlePDFExport = () => {
    setPdfExportScope(selectedIds.size > 0 ? 'selected' : 'filtered');
    const defaultTitle = inventoryTab === 'showroom' 
      ? 'تقرير جدول مخزون السيارات الفعلي بالمعرض' 
      : 'تقرير جدول مخزون السيارات قيد الشحن والتوريد';
    setPdfReportTitle(defaultTitle);
    setShowPdfModal(true);
  };

  const executePDFExport = async () => {
    try {
      setIsExportingPDF(true);
      let sourceCars: Car[] = [];
      if (pdfExportScope === 'selected') {
        sourceCars = selectedIds.size > 0 ? cars.filter(c => selectedIds.has(c.id)) : displayedCars;
      } else if (pdfExportScope === 'all') {
        sourceCars = cars;
      } else {
        sourceCars = displayedCars;
      }

      const totalCount = sourceCars.length;
      if (totalCount === 0) {
        alert('لا توجد مركبات مطابقة لنطاق التصدير المحدد');
        setIsExportingPDF(false);
        return;
      }

      const availableCount = sourceCars.filter(c => c.status === CarStatus.AVAILABLE || String(c.status) === 'متوفرة').length;
      const reservedCount = sourceCars.filter(c => c.status === CarStatus.RESERVED || String(c.status) === 'محجوزة').length;
      const soldCount = sourceCars.filter(c => c.status === CarStatus.SOLD || String(c.status) === 'مبيعة').length;

      // Filter visible columns dynamically from columns state (excluding actions and seq columns)
      const visibleCols = columns.filter(c => c.visible && c.key !== 'actions' && c.key !== 'seq');
      if (visibleCols.length === 0) {
        alert('يرجى إظهار عمود واحد على الأقل في تخصيص الأعمدة لتتمكن من التصدير');
        setIsExportingPDF(false);
        return;
      }

      const pdfColumns: TablePDFColumn[] = visibleCols.map(col => {
        let align: 'right' | 'center' | 'left' = 'center';
        if (['car_info', 'notes', 'seller', 'receiver_name', 'exit_notes'].includes(col.key)) {
          align = 'right';
        }
        return {
          header: col.label,
          dataKey: col.key,
          align
        };
      });

      const pdfData = sourceCars.map((car, idx) => {
        const rowData: Record<string, any> = {
          seq: idx + 1,
          id: car.id,
          brand: car.brand,
          status: car.status,
          carStatus: car.status,
          vin: car.vin
        };
        visibleCols.forEach(col => {
          if (col.key === 'seq') {
            rowData['seq'] = idx + 1;
          } else {
            rowData[col.key] = getCarColumnExportValue(car, col.key);
          }
        });
        return rowData;
      });

      const subtitle = inventoryTab === 'showroom' 
        ? 'مخزون السيارات الفعلي بالمعرض' 
        : 'مخزون السيارات قيد الشحن والتوريد (لم تصل المعرض)';

      const dateStr = new Date().toISOString().split('T')[0];

      let chosenFontSizePt: number | undefined = undefined;
      if (pdfFontSizePreset === 'small') chosenFontSizePt = 6.5;
      else if (pdfFontSizePreset === 'medium') chosenFontSizePt = 8.0;
      else if (pdfFontSizePreset === 'large') chosenFontSizePt = 9.5;
      else if (pdfFontSizePreset === 'custom') chosenFontSizePt = Number(pdfCustomFontSize) || 8.5;

      const finalTitle = (pdfReportTitle && pdfReportTitle.trim().length > 0)
        ? pdfReportTitle.trim()
        : (inventoryTab === 'showroom' 
            ? `تقرير جدول مخزون السيارات الفعلي بالمعرض (${totalCount} سيارة)` 
            : `تقرير جدول مخزون السيارات قيد الشحن والتوريد (${totalCount} سيارة)`);

      await exportTableDataToPDF({
        title: finalTitle,
        subtitle: subtitle,
        filename: `تقرير_المخزون_${inventoryTab}_${dateStr}`,
        columns: pdfColumns,
        data: pdfData,
        settings: settings,
        orientation: pdfOrientation,
        rowHeightPx: pdfRowHeightPx || 60,
        fontSizePt: chosenFontSizePt,
        summaryStats: [
          { label: 'إجمالي السيارات', value: `${totalCount} سيارة`, color: '#1e3a8a' },
          { label: 'السيارات المتوفرة', value: `${availableCount} سيارة`, color: '#166534' },
          { label: 'السيارات المحجوزة', value: `${reservedCount} سيارة`, color: '#b45309' },
          { label: 'السيارات المبيعة', value: `${soldCount} سيارة`, color: '#9f1239' },
        ]
      });

      setShowPdfModal(false);
    } catch (err) {
      console.error('Failed to export table PDF:', err);
      alert('حدث خطأ أثناء تصدير ملف PDF');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExcelExport = () => {
    setExcelExportMode(selectedIds.size > 0 ? 'selected' : 'filtered');
    setShowExcelModal(true);
  };

  const executeExcelExport = async (mode: 'all' | 'filtered' | 'selected' | 'page' = 'filtered') => {
    setExportDiagnostics(null);
    setExportingProgress({ percent: 10, stage: 'بدء تحليل وفلترة البيانات المطلوبة للتصدير...', processedRows: 0, totalRows: 0 });
    await new Promise(resolve => setTimeout(resolve, 200));

    const direction = localStorage.getItem('excel_export_direction') || 'RTL';
    const isRTL = direction === 'RTL';

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('مخزون السيارات', {
      views: [{ rightToLeft: isRTL }]
    });

    const excelCols: any[] = [];

    columns.forEach(col => {
      if (!col.visible) return;

      if (col.key === 'seq') {
        return;
      } else if (col.key === 'brand') {
        excelCols.push({ header: 'الماركة', key: 'brand', width: 20 });
      } else if (col.key === 'model') {
        excelCols.push({ header: 'الموديل', key: 'model', width: 22 });
      } else if (col.key === 'year') {
        excelCols.push({ header: 'سنة الصنع', key: 'year', width: 12 });
      } else if (col.key === 'interior_color') {
        excelCols.push({ header: 'اللون الداخلي', key: 'interior_color', width: 16 });
      } else if (col.key === 'color') {
        excelCols.push({ header: 'اللون الخارجي', key: 'color', width: 16 });
      } else if (col.key === 'car_remark') {
        excelCols.push({ header: 'ملاحظات السيارة', key: 'car_remark', width: 25 });
      } else if (col.key === 'entry_transport_company') {
        excelCols.push({ header: 'شركة نقليات الدخول', key: 'entry_transport_company', width: 20 });
      } else if (col.key === 'car_info') {
        excelCols.push({ header: 'السيارة', key: 'car_info', width: 32 });
      } else if (col.key === 'color_model') {
        excelCols.push({ header: 'اللون والموديل', key: 'color_model', width: 20 });
      } else if (col.key === 'ownership') {
        excelCols.push({ header: 'المالك', key: 'ownershipType', width: 15 });
      } else if (col.key === 'card_number') {
        excelCols.push({ header: 'البطاقة الجمركية', key: 'cardNumber', width: 20 });
      } else if (col.key === 'vin') {
        excelCols.push({ header: 'رقم الهيكل (VIN)', key: 'vin', width: 25 });
      } else if (col.key === 'vin_matching') {
        excelCols.push({ header: 'تطابق الهيكل', key: 'vinMatching', width: 15 });
      } else if (col.key === 'plate') {
        excelCols.push({ header: 'رقم اللوحة', key: 'plateNumber', width: 15 });
      } else if (col.key === 'rental') {
        excelCols.push({ header: 'حالة التجير', key: 'rentalStatus', width: 15 });
      } else if (col.key === 'status') {
        excelCols.push({ header: 'الحالة', key: 'status', width: 15 });
      } else if (col.key === 'car_condition') {
        excelCols.push({ header: 'وصف حالة المركبة', key: 'car_condition', width: 25 });
      } else if (col.key === 'supplier') {
        excelCols.push({ header: 'المورد', key: 'supplier', width: 15 });
      } else if (col.key === 'entry_date') {
        excelCols.push({ header: 'تاريخ الدخول', key: 'entryDateCustom', width: 20 });
      } else if (col.key === 'notes') {
        excelCols.push({ header: 'مندوب الحجز', key: 'notesCustom', width: 25 });
      } else if (col.key === 'showroom') {
        excelCols.push({ header: 'التواجد بالمعرض', key: 'showroomCustom', width: 15 });
      } else if (col.key === 'attribution') {
        excelCols.push({ header: 'وارد المركبة', key: 'attributionCustom', width: 15 });
      } else if (col.key === 'delivery_type') {
        excelCols.push({ header: 'نوع المستلم', key: 'delivery_type', width: 15 });
      } else if (col.key === 'transport_company') {
        excelCols.push({ header: 'شركة النقليات', key: 'transport_company', width: 20 });
      } else if (col.key === 'receiver_name') {
        excelCols.push({ header: 'العميل', key: 'receiver_name', width: 20 });
      } else if (col.key === 'receiver_id') {
        excelCols.push({ header: 'هوية العميل', key: 'receiver_id', width: 20 });
      } else if (col.key === 'nationality') {
        excelCols.push({ header: 'الجنسية', key: 'nationality', width: 15 });
      } else if (col.key === 'receiver_phone') {
        excelCols.push({ header: 'رقم الهاتف', key: 'receiver_phone', width: 20 });
      } else if (col.key === 'exit_date') {
        excelCols.push({ header: 'تاريخ الخروج', key: 'exit_date', width: 20 });
      } else if (col.key === 'exit_notes') {
        excelCols.push({ header: 'ملاحظات الخروج', key: 'exit_notes', width: 25 });
      } else if (col.key === 'cost_price') {
        excelCols.push({ header: 'التكلفة', key: 'costPrice', width: 15 });
      } else if (col.key === 'price') {
        excelCols.push({ header: 'السعر', key: 'price', width: 15 });
      } else {
        excelCols.push({ header: col.label, key: col.key, width: 15 });
      }
    });

    worksheet.columns = excelCols;

    // Style header
    const headerRow = worksheet.getRow(1);
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
      cell.font = { color: { argb: 'FF000000' }, bold: true, size: 12 };
      cell.alignment = { vertical: 'middle', horizontal: 'center', readingOrder: isRTL ? 'rtl' : 'ltr' };
    });

    let sourceCars: Car[] = [];
    if (mode === 'selected') {
      sourceCars = cars.filter(c => selectedIds.has(c.id));
    } else if (mode === 'all') {
      sourceCars = cars;
    } else {
      sourceCars = filteredCars;
    }

    const presentList = sourceCars.filter(car => car.isPresentInShowroom !== false).sort(sortCarsByBrandCategory);
    const absentList = sourceCars.filter(car => car.isPresentInShowroom === false).sort(sortCarsByBrandCategory);

    const addCarRow = (car: Car, index: number) => {
      const notForSale = car.status === CarStatus.NOT_FOR_SALE || String(car.status) === 'غير معروضة للبيع';

      const rowData: any = {
        seq: index,
        index: index,
        entryDate: car.entryDate?.split('T')[0],
        exitDate: car.exitData?.exitDate || '-',
        receiverName: car.exitData?.receiverName || '-',
        seller: getRepresentativeOrSeller(car),
      };

      columns.forEach(col => {
        if (!col.visible) return;

        if (col.key === 'brand') {
          rowData['brand'] = car.brand || '-';
        } else if (col.key === 'model') {
          rowData['model'] = car.model || '-';
        } else if (col.key === 'interior_color') {
          rowData['interior_color'] = car.interiorColor || car.customData?.interiorColor || '-';
        } else if (col.key === 'color') {
          rowData['color'] = car.color || '-';
        } else if (col.key === 'year') {
          rowData['year'] = car.year ? String(car.year) : '-';
        } else if (col.key === 'car_remark') {
          rowData['car_remark'] = car.carRemark || '-';
        } else if (col.key === 'entry_transport_company') {
          rowData['entry_transport_company'] = car.customData?.entryTransportCompany || car.customData?.transportCompany || '-';
        } else if (col.key === 'car_info') {
          rowData['car_info'] = formatVehicleDisplay(car);
        } else if (col.key === 'color_model') {
          rowData['color_model'] = `${car.color} | ${car.year}`;
        } else if (col.key === 'ownership') {
          rowData['ownershipType'] = car.ownershipType;
        } else if (col.key === 'card_number') {
          rowData['cardNumber'] = car.cardNumber || '-';
        } else if (col.key === 'vin') {
          rowData['vin'] = car.vin;
        } else if (col.key === 'vin_matching') {
          rowData['vinMatching'] = car.vinMatching || 'مطابق';
        } else if (col.key === 'plate') {
          rowData['plateNumber'] = car.plateData?.plateNumber || '-';
        } else if (col.key === 'rental') {
          rowData['rentalStatus'] = car.rentalStatus;
        } else if (col.key === 'status') {
          rowData['status'] = car.status;
        } else if (col.key === 'car_condition') {
          const rawCond = car.exitData?.carCondition || '';
          rowData['car_condition'] = notForSale ? (rawCond ? `${rawCond} - السياره غير معروضه للبيع` : 'السياره غير معروضه للبيع') : (rawCond || '-');
        } else if (col.key === 'supplier') {
          rowData['supplier'] = car.supplier || '-';
        } else if (col.key === 'entry_date') {
          rowData['entryDateCustom'] = car.entryDate ? car.entryDate.split('T')[0] : '-';
        } else if (col.key === 'notes') {
          const rawNotes = getReservationRepresentative(car);
          rowData['notesCustom'] = notForSale ? (rawNotes && rawNotes !== '-' ? `${rawNotes} - السياره غير معروضه للبيع` : 'السياره غير معروضه للبيع') : (rawNotes || '-');
        } else if (col.key === 'showroom') {
          rowData['showroomCustom'] = car.status || (car.isPresentInShowroom !== false ? 'نعم' : 'لا');
        } else if (col.key === 'attribution') {
          rowData['attributionCustom'] = car.attributionSource || '-';
        } else if (col.key === 'delivery_type') {
          rowData['delivery_type'] = car.exitData?.deliveryType || '-';
        } else if (col.key === 'transport_company') {
          rowData['transport_company'] = car.customData?.entryTransportCompany || car.exitData?.transportCompany || '-';
        } else if (col.key === 'receiver_name') {
          rowData['receiver_name'] = car.exitData?.receiverName || '-';
        } else if (col.key === 'receiver_id') {
          rowData['receiver_id'] = car.exitData?.receiverId || '-';
        } else if (col.key === 'nationality') {
          rowData['nationality'] = car.exitData?.nationality || '-';
        } else if (col.key === 'receiver_phone') {
          rowData['receiver_phone'] = car.exitData?.receiverPhone || '-';
        } else if (col.key === 'exit_date') {
          rowData['exit_date'] = car.exitData?.exitDate || '-';
        } else if (col.key === 'exit_notes') {
          const rawExitNotes = car.exitData?.notes || '';
          rowData['exit_notes'] = notForSale ? (rawExitNotes ? `${rawExitNotes} - السياره غير معروضه للبيع` : 'السياره غير معروضه للبيع') : (rawExitNotes || '-');
        } else if (col.key === 'cost_price') {
          rowData['costPrice'] = car.costPrice;
        } else if (col.key === 'price') {
          rowData['price'] = car.price;
        } else {
          rowData[col.key] = car.customData?.[col.key] || '-';
        }
      });

      const row = worksheet.addRow(rowData);
      row.height = 32;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.alignment = { 
          vertical: 'middle', 
          horizontal: colNumber === 1 ? 'center' : (isRTL ? 'right' : 'left'),
          readingOrder: isRTL ? 'rtl' : 'ltr'
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });

      const statusInfo = getCarStatusColorInfo(car, settings);
      const bgArgb = statusInfo.bgArgb;
      const fgArgb = statusInfo.textArgb;
      const isBold = statusInfo.isBold;

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
        cell.font = { name: 'Arial', size: 10, color: { argb: fgArgb }, bold: isBold };

        // مربع التجيير لأي سيارة لم تجير
        const colDef = excelCols[colNumber - 1];
        if (colDef && (colDef.key === 'rental' || colDef.key === 'rentalStatus' || colDef.header === 'حالة التجير')) {
          const rentalInfo = getCarRentalColorInfo(car, settings);
          if (rentalInfo.isNotRented) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rentalInfo.bgArgb } };
            cell.font = { name: 'Arial', size: 10, color: { argb: rentalInfo.textArgb }, bold: true };
          }
        }
      });
    };

    const totalColumns = worksheet.columns?.length || 20;

    if (!excelIncludeSeparators) {
      // Clean continuous export matching PDF layout without brand/category separator rows
      sourceCars.forEach((car, idx) => {
        addCarRow(car, idx + 1);
      });
    } else {
      // 1. Export present cars first
      let lastBrand = '';
      let lastModel = '';
      let lastAttribution = '';
      presentList.forEach((car, idx) => {
        const cleanBrand = getCleanBrandName(car.brand);
        if (cleanBrand !== lastBrand) {
          lastBrand = cleanBrand;
          lastModel = ''; // reset model header on new brand group
          lastAttribution = ''; // reset attribution on new brand group
          const brandRowIndex = worksheet.rowCount + 1;
          worksheet.mergeCells(brandRowIndex, 1, brandRowIndex, totalColumns);
          const brandRow = worksheet.getRow(brandRowIndex);
          brandRow.height = 32;
          const brandCell = brandRow.getCell(1);
          brandCell.value = `🚘 ${cleanBrand} 🚘`;
          brandCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FF1E1B4B' } };
          brandCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBCBBC9' } }; // Light indigo header background (30% intensity)
          brandCell.alignment = { vertical: 'middle', horizontal: 'center' };
          
          for (let col = 1; col <= totalColumns; col++) {
            const cell = brandRow.getCell(col);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBCBBC9' } };
            cell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FF1E1B4B' } };
            cell.border = {
              top: { style: 'medium', color: { argb: 'FF8C899B' } },
              bottom: { style: 'medium', color: { argb: 'FF8C899B' } }
            };
          }
        }

        const modelKey = getCleanModelKey(car.model);
        const isNewModel = modelKey !== lastModel;
        if (isNewModel) {
          lastModel = modelKey;
          lastAttribution = ''; // reset attribution on new model group
          const modelRowIndex = worksheet.rowCount + 1;
          worksheet.mergeCells(modelRowIndex, 1, modelRowIndex, totalColumns);
          const modelRow = worksheet.getRow(modelRowIndex);
          modelRow.height = 26;
          const modelCell = modelRow.getCell(1);
          modelCell.value = `${car.model || 'عام'}`;
          modelCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF374151' } }; // Dark slate gray text
          modelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC3C6CB' } }; // Light slate gray background (30% intensity)
          modelCell.alignment = { vertical: 'middle', horizontal: 'center' };
          
          for (let col = 1; col <= totalColumns; col++) {
            const cell = modelRow.getCell(col);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC3C6CB' } };
            cell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF374151' } };
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFAAAEB5' } },
              bottom: { style: 'thin', color: { argb: 'FFAAAEB5' } }
            };
          }
        }

        const attributionVal = car.attributionSource || 'عام / غير محدد';
        const showAttributionHeader = isNewModel || attributionVal !== lastAttribution;
        if (showAttributionHeader) {
          lastAttribution = attributionVal;
          const attrRowIndex = worksheet.rowCount + 1;
          worksheet.mergeCells(attrRowIndex, 1, attrRowIndex, totalColumns);
          const attrRow = worksheet.getRow(attrRowIndex);
          attrRow.height = 22;
          const attrCell = attrRow.getCell(1);
          attrCell.value = `📥 الوارد / المصدر: ${attributionVal}`;
          attrCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF082F49' } }; // deep dark sky-950 blue text
          attrCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB5C1C8' } }; // Light sky blue background (30% intensity)
          attrCell.alignment = { vertical: 'middle', horizontal: 'center' };
          
          for (let col = 1; col <= totalColumns; col++) {
            const cell = attrRow.getCell(col);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB5C1C8' } };
            cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF082F49' } };
            cell.border = {
              top: { style: 'thin', color: { argb: 'FF99AAB3' } },
              bottom: { style: 'thin', color: { argb: 'FF99AAB3' } }
            };
          }
        }

        addCarRow(car, idx + 1);
      });

      // 2. Export absent cars with an incredibly distinctive, large, and colored section header row
      if (absentList.length > 0) {
        const spacerRow = worksheet.addRow([]);
        spacerRow.height = 15;

        const headerRowIndex = worksheet.rowCount + 1;

        worksheet.mergeCells(headerRowIndex, 1, headerRowIndex, totalColumns);
        const sectionRow = worksheet.getRow(headerRowIndex);
        sectionRow.height = 38;

        const headerCell = sectionRow.getCell(1);
        headerCell.value = `🛑 مركبات لم تصل المعرض (${absentList.length} مركبة) 🛑`;
        headerCell.font = {
          name: 'Segoe UI',
          size: 15,
          bold: true,
          color: { argb: 'FF991B1B' } // Bold Deep Crimson
        };
        
        headerCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFFFF' } // White background
        };
        headerCell.alignment = {
          vertical: 'middle',
          horizontal: 'center'
        };

        for (let c = 1; c <= totalColumns; c++) {
          const cell = sectionRow.getCell(c);
          if (c !== 1) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFFFFF' }
            };
          }
          cell.border = {
            top: { style: 'medium', color: { argb: 'FFFCA5A5' } },
            bottom: { style: 'medium', color: { argb: 'FFFCA5A5' } },
            left: c === 1 ? { style: 'medium', color: { argb: 'FFFCA5A5' } } : undefined,
            right: c === totalColumns ? { style: 'medium', color: { argb: 'FFFCA5A5' } } : undefined
          };
        }

        let lastAbsentBrand = '';
        let lastAbsentModel = '';
        let lastAbsentAttribution = '';
        absentList.forEach((car, idx) => {
          const cleanBrand = getCleanBrandName(car.brand);
          if (cleanBrand !== lastAbsentBrand) {
            lastAbsentBrand = cleanBrand;
            lastAbsentModel = ''; // reset model header on new brand group
            lastAbsentAttribution = ''; // reset attribution on new brand group
            const brandRowIndex = worksheet.rowCount + 1;
            worksheet.mergeCells(brandRowIndex, 1, brandRowIndex, totalColumns);
            const brandRow = worksheet.getRow(brandRowIndex);
            brandRow.height = 32;
            const brandCell = brandRow.getCell(1);
            brandCell.value = `🚘 ${cleanBrand} (لم تصل المعرض) 🚘`;
            brandCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
            brandCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF881337' } }; // Dark rose-900 bg
            brandCell.alignment = { vertical: 'middle', horizontal: 'center' };
            
            for (let col = 1; col <= totalColumns; col++) {
              const cell = brandRow.getCell(col);
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF881337' } };
              cell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
              cell.border = {
                top: { style: 'medium', color: { argb: 'FFBE123C' } },
                bottom: { style: 'medium', color: { argb: 'FFBE123C' } }
              };
            }
          }

          const modelKey = getCleanModelKey(car.model);
          const isNewModel = modelKey !== lastAbsentModel;
          if (isNewModel) {
            lastAbsentModel = modelKey;
            lastAbsentAttribution = ''; // reset attribution on new model group
            const modelRowIndex = worksheet.rowCount + 1;
            worksheet.mergeCells(modelRowIndex, 1, modelRowIndex, totalColumns);
            const modelRow = worksheet.getRow(modelRowIndex);
            modelRow.height = 26;
            const modelCell = modelRow.getCell(1);
            modelCell.value = `${car.model || 'عام'} (لم تصل المعرض)`;
            modelCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } }; // white text
            modelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF451A03' } }; // Dark brown bg for absent model
            modelCell.alignment = { vertical: 'middle', horizontal: 'center' };
            
            for (let col = 1; col <= totalColumns; col++) {
              const cell = modelRow.getCell(col);
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF451A03' } };
              cell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
              cell.border = {
                top: { style: 'thin', color: { argb: 'FF78350F' } },
                bottom: { style: 'thin', color: { argb: 'FF78350F' } }
              };
            }
          }

          const attributionVal = car.attributionSource || 'عام / غير محدد';
          const showAttributionHeader = isNewModel || attributionVal !== lastAbsentAttribution;
          if (showAttributionHeader) {
            lastAbsentAttribution = attributionVal;
            const attrRowIndex = worksheet.rowCount + 1;
            worksheet.mergeCells(attrRowIndex, 1, attrRowIndex, totalColumns);
            const attrRow = worksheet.getRow(attrRowIndex);
            attrRow.height = 22;
            const attrCell = attrRow.getCell(1);
            attrCell.value = `📥 الوارد / المصدر: ${attributionVal} (لم تصل المعرض)`;
            attrCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFECDD3' } }; // light rose text
            attrCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF450A0A' } }; // deep red-950 bg
            attrCell.alignment = { vertical: 'middle', horizontal: 'center' };
            
            for (let col = 1; col <= totalColumns; col++) {
              const cell = attrRow.getCell(col);
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF450A0A' } };
              cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFECDD3' } };
              cell.border = {
                top: { style: 'thin', color: { argb: 'FF7F1D1D' } },
                bottom: { style: 'thin', color: { argb: 'FF7F1D1D' } }
              };
            }
          }

          addCarRow(car, presentList.length + idx + 1);
        });
      }
    }

    setExportingProgress({ percent: 75, stage: 'تطبيق التنسيقات العربية وحساب أبعاد الخلايا التلقائي...', processedRows: sourceCars.length, totalRows: sourceCars.length });
    await new Promise(resolve => setTimeout(resolve, 300));

    // Finalize column spacing, text wrap, font bounds, and generate diagnostic report using our professional service
    const results = await ExcelService.finalizeAndSaveWorkbook(
      workbook,
      worksheet,
      'مخزون_المركبات',
      isRTL,
      (telemetry) => {
        setExportDiagnostics(telemetry);
      },
      settings,
      {
        rowHeightPx: excelRowHeightPx,
        fontSizePt: excelFontSizePt
      }
    );

    setExportingProgress({ percent: 100, stage: 'تم الانتهاء وتوليد ملف Excel المطور بنجاح!', processedRows: sourceCars.length, totalRows: sourceCars.length });
  };

  const handlePrintCarCard = (car: Car) => {
    const customFieldsHtml = (settings?.customFields || []).map(f => `
      <div class="field">
        <span class="label">${f.label}:</span>
        <span class="value">${car.customData?.[f.id] || '-'}</span>
      </div>
    `).join('');

    // Prepare plate details section if available
    let plateDetailsHtml = '';
    if (car.hasPlate || (car.plateData && car.plateData.plateNumber)) {
      plateDetailsHtml = `
        <div class="section-title">بيانات اللوحة والتسجيل</div>
        <div class="grid">
          <div class="field"><span class="label">رقم اللوحة:</span><span class="value">${car.plateData?.plateNumber || '-'}</span></div>
          <div class="field"><span class="label">اسم المالك:</span><span class="value">${car.plateData?.ownerName || '-'}</span></div>
          <div class="field"><span class="label">الرقم التسلسلي:</span><span class="value">${car.plateData?.serialNumber || '-'}</span></div>
          <div class="field"><span class="label">تاريخ الصدور:</span><span class="value">${car.plateData?.issueDate || '-'}</span></div>
        </div>
      `;
    }

    // Prepare exit / sale details section if available
    let exitDetailsHtml = '';
    if (car.status === 'مباعة' || car.exitData) {
      const deliveryTypesMap: Record<string, string> = {
        'OWNER': 'صاحبها (يدوي)',
        'TRANSPORT': 'نقليات (شحن)',
        'OTHER': 'مستلم آخر'
      };
      const deliveryLabel = car.exitData?.deliveryType ? (deliveryTypesMap[car.exitData.deliveryType] || car.exitData.deliveryType) : '-';

      exitDetailsHtml = `
        <div class="section-title">بيانات البيع وإذن الخروج</div>
        <div class="grid">
          <div class="field"><span class="label">العميل المستلم:</span><span class="value">${car.exitData?.receiverName || '-'}</span></div>
          <div class="field"><span class="label">هوية العميل:</span><span class="value">${car.exitData?.receiverId || '-'}</span></div>
          <div class="field"><span class="label">رقم الهاتف:</span><span class="value">${car.exitData?.receiverPhone || '-'}</span></div>
          <div class="field"><span class="label">الجنسية:</span><span class="value">${car.exitData?.nationality || '-'}</span></div>
          <div class="field"><span class="label">تاريخ الخروج:</span><span class="value">${car.exitData?.exitDate || '-'}</span></div>
          <div class="field"><span class="label">نوع المستلم:</span><span class="value">${deliveryLabel}</span></div>
          ${(String(car.exitData?.deliveryType) === 'TRANSPORT' || car.customData?.entryTransportCompany) ? `<div class="field"><span class="label">شركة النقليات/الشحن:</span><span class="value">${car.customData?.entryTransportCompany || car.exitData?.transportCompany || '-'}</span></div>` : ''}
          <div class="field"><span class="label">مندوب الحجز:</span><span class="value">${car.exitData?.seller || car.exitData?.representativeName || '-'}</span></div>
          <div class="field"><span class="label">ملاحظات:</span><span class="value">${car.notes || car.exitData?.carCondition || '-'}</span></div>
        </div>
        ${car.exitData?.notes ? `
          <div style="margin-top: 10px; border-top: 1px dashed #e2e8f0; padding-top: 8px;">
            <span class="label" style="display: block; margin-bottom: 4px;">ملاحظات الخروج:</span>
            <div style="font-size: 10.5pt; color: #1e293b; font-weight: 600; background: #fafafa; padding: 8px; border-radius: 6px;">${car.exitData.notes}</div>
          </div>
        ` : ''}
      `;
    }

    // Prepare financials section if user has access
    let financialsHtml = '';
    if (canViewFinancials) {
      const profit = car.price - car.costPrice;
      financialsHtml = `
        <div class="section-title">البيانات المالية</div>
        <div class="financials-grid">
          <div class="fin-box">
            <span class="fin-label">سعر التكلفة</span>
            <span class="fin-value">${(car.costPrice ?? 0).toLocaleString()} ${settings.currencyUsed || 'ر.س'}</span>
          </div>
          <div class="fin-box">
            <span class="fin-label">سعر البيع</span>
            <span class="fin-value">${(car.price ?? 0).toLocaleString()} ${settings.currencyUsed || 'ر.س'}</span>
          </div>
          <div class="fin-box">
            <span class="fin-label">صافي الربح المتوقع</span>
            <span class="fin-value fin-profit">${((car.price ?? 0) - (car.costPrice ?? 0)).toLocaleString()} ${settings.currencyUsed || 'ر.س'}</span>
          </div>
        </div>
      `;
    }

    const html = `
      <html dir="rtl" lang="ar">
        <head>
          <title>بطاقة تسجيل مركبة - ${car.brand} ${car.model}</title>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
          <style>
            @page { size: A4; margin: 10mm; }
            body { 
              font-family: 'Cairo', sans-serif; 
              padding: 0; 
              margin: 0; 
              direction: rtl; 
              color: #1e293b; 
              background: #fff;
              font-size: 11pt;
              line-height: 1.4;
            }
            .card { 
              border: 3px solid #000; 
              border-radius: 12px; 
              padding: 24px; 
              position: relative; 
              min-height: 260mm;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
            }
            .header { 
              display: flex; 
              justify-content: space-between; 
              align-items: center; 
              border-bottom: 3px solid #0f172a; 
              padding-bottom: 15px; 
              margin-bottom: 15px; 
            }
            .logo { max-height: 65px; max-width: 140px; object-fit: contain; }
            .title-container { text-align: right; }
            .title { font-size: 20pt; font-weight: 900; margin: 0; color: #0f172a; }
            .subtitle { margin: 3px 0 0 0; color: #3b82f6; font-size: 11pt; font-weight: bold; }
            
            .section-title { 
              font-size: 11.5pt; 
              font-weight: 900; 
              background: #f1f5f9; 
              padding: 4px 10px; 
              margin-top: 15px; 
              margin-bottom: 8px; 
              border-right: 4px solid #0f172a; 
              color: #0f172a;
            }
            
            .grid { 
              display: grid; 
              grid-template-columns: 1fr 1fr; 
              gap: 10px 20px; 
            }
            .field { 
              border-bottom: 1px solid #e2e8f0; 
              padding: 5px 0; 
              display: flex; 
              justify-content: space-between; 
              align-items: center;
            }
            .label { font-weight: bold; color: #64748b; font-size: 9.5pt; }
            .value { font-weight: 700; font-size: 10.5pt; color: #0f172a; }
            
            .financials-grid {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 12px;
              margin-top: 5px;
            }
            .fin-box {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 8px;
              text-align: center;
            }
            .fin-label { font-weight: bold; color: #64748b; font-size: 9pt; display: block; margin-bottom: 2px; }
            .fin-value { font-weight: 900; font-size: 12pt; color: #0f172a; }
            .fin-profit { color: #16a34a; }
            
            .footer { 
              margin-top: auto; 
              border-top: 1px solid #e2e8f0; 
              padding-top: 12px; 
              display: flex; 
              justify-content: space-between; 
              font-size: 8.5pt; 
              color: #64748b; 
            }
            
            .watermark { 
              position: absolute; 
              top: 50%; 
              left: 50%; 
              transform: translate(-50%, -50%); 
              opacity: 0.24; 
              width: 50%; 
              pointer-events: none; 
              z-index: 9999; 
            }
            
            @media print { 
              body { padding: 0; } 
              .card { min-height: 260mm; }
            }
            ${getBilingualPrintHeaderCss()}
            ${getLogoStyleOverride()}
          </style>
        </head>
        <body>
          <div class="card">
            <img src="${settings.logoUrl || getLogoDataUri(settings.name)}" class="watermark" />
            ${getBilingualPrintHeaderHtml(settings)}

            <div class="title-container" style="text-align: center; margin: 6px 0 10px 0;">
              <h1 class="title" style="font-size: 16pt; font-weight: 900; margin: 0;">بطاقة تفاصيل وبيانات المركبة</h1>
            </div>

            <div class="section-title">بيانات المركبة الأساسية</div>
            <div class="grid">
              <div class="field"><span class="label">الماركة:</span><span class="value">${car.brand}</span></div>
              <div class="field"><span class="label">الموديل:</span><span class="value">${car.model}</span></div>
              <div class="field"><span class="label">سنة الصنع:</span><span class="value">${car.year}</span></div>
              <div class="field"><span class="label">اللون الخارجي:</span><span class="value">${car.color || '-'}</span></div>
              <div class="field"><span class="label">اللون الداخلي:</span><span class="value">${car.interiorColor || car.customData?.interiorColor || '-'}</span></div>
              <div class="field"><span class="label">رقم الهيكل (VIN):</span><span class="value" style="font-family: monospace; font-size: 10pt; letter-spacing: 0.5px;">${car.vin}</span></div>
              <div class="field"><span class="label">البطاقة الجمركية:</span><span class="value">${car.cardNumber || '-'}</span></div>
              <div class="field"><span class="label">المورد:</span><span class="value">${car.supplier || '-'}</span></div>
              <div class="field"><span class="label">نوع الملكية:</span><span class="value">${car.ownershipType || '-'}</span></div>
              <div class="field"><span class="label">تاريخ الدخول:</span><span class="value">${car.entryDate || '-'}</span></div>
              <div class="field"><span class="label">حالة المخزون الحالية:</span><span class="value" style="color: ${car.status === 'مباعة' ? '#dc2626' : '#16a34a'}">${car.status}</span></div>
              ${car.carRemark ? `<div class="field" style="grid-column: span 3;"><span class="label">ملاحظات السيارة الخاصة:</span><span class="value" style="color: #475569; font-weight: bold;">${car.carRemark}</span></div>` : ''}
              ${customFieldsHtml}
            </div>

            ${plateDetailsHtml}

            ${exitDetailsHtml}

            ${financialsHtml}

            <div class="footer" style="position: relative; padding-bottom: 50px;">
              <div>
                <span>طُبع بواسطة نظام المستودع الذكي لـ ${settings.name}</span><br/>
                <span>تاريخ الطباعة: ${new Date().toLocaleString('ar-EG', { dateStyle: 'long', timeStyle: 'short' })}</span>
              </div>
              <img src="${settings.stampUrl || getStampDataUri(settings.name ? `${settings.orgType || 'مؤسسة'} ${settings.name}` : undefined, settings.commercialRegister, settings.orgType)}" style="position: absolute; bottom: 5px; left: 10px; max-height: 80px; max-width: 80px; mix-blend-mode: multiply;" alt="الختم الرسمي" />
            </div>
          </div>
          <script>
            window.onload = () => { 
              setTimeout(() => {
                window.print(); 
                window.close();
              }, 1000);
            };
          </script>
        </body>
      </html>
    `;
    safePrint(html);

    if (onArchiveLetter) {
      onArchiveLetter({
        letterType: 'بطاقة سيارة',
        vin: car.vin || '',
        plateNumber: car.plateData?.plateNumber || car.customData?.plateNumber || '',
        cardNumber: car.cardNumber || '',
        vehicleName: `${formatVehicleDisplay(car)} ${car.year}`,
        driverName: car.exitData?.receiverName || '',
        destination: car.supplier || car.customData?.entryTransportCompany || car.exitData?.transportCompany || '',
        htmlContent: html
      });
    }
  };

  const renderCarRow = (car: Car, rowIndex?: number) => {
    const customRule = getCustomRuleForCar(car, settings);
    const statusColors = getResolvedStatusColors(settings);

    const isReserved = car.status === CarStatus.RESERVED || String(car.status) === 'محجوزة' || String(car.status) === 'محجوز';
    const isSold = car.status === CarStatus.SOLD || String(car.status) === 'مباعة' || String(car.status) === 'مباع';
    const notForSale = car.status === CarStatus.NOT_FOR_SALE || String(car.status) === 'غير معروضة للبيع';
    const isAvailable = car.status === CarStatus.AVAILABLE || String(car.status) === 'متوفرة' || String(car.status) === 'متوفر';
    const isSoldButNotExited = isSold && !car.isOutbound;
    const isReturned = car.status === CarStatus.RETURNED || String(car.status) === 'مسترجعة' || String(car.status) === 'مرتجع';
    const isNotArrived = car.status === CarStatus.NOT_ARRIVED || String(car.status) === 'لم تصل بعد' || car.isPresentInShowroom === false;
    const isMismatch = Boolean(car.vinMatching && (String(car.vinMatching).trim() === 'غير مطابق' || String(car.vinMatching).trim() === 'غير متطابق' || String(car.vinMatching).trim() === 'mismatch'));

    const rowInfo = getCarRowStyleAndClass(car, settings, selectedIds.has(car.id));
    const rowStyle: React.CSSProperties = rowInfo.rowStyle;
    const rowBgClass = rowInfo.rowBgClass;
    const titleTextColorClass = rowInfo.titleTextColorClass;
    const bodyTextColorClass = rowInfo.bodyTextColorClass;

    const notesClean = getReservationRepresentative(car);
    const notesDisplay = notForSale
      ? (notesClean && notesClean !== '-' ? `${notesClean} | السيارة غير معروضة للبيع` : 'السيارة غير معروضة للبيع')
      : (notesClean || '-');

    const cellRenderers: Record<string, () => React.ReactNode> = {
      seq: () => {
        const carIndex = rowIndex !== undefined ? rowIndex : (displayedCars.findIndex(c => c.id === car.id) + 1);
        return (
          <td className={`px-2 py-0 h-[60px] max-h-[60px] text-center align-middle font-mono font-black text-xs ${bodyTextColorClass}`} key="seq">
            {carIndex > 0 ? carIndex : '-'}
          </td>
        );
      },
      brand: () => (
        <td className="px-3 py-0 h-[60px] max-h-[60px] align-middle text-center" key="brand">
          <span
            onClick={() => { setEditingCar(car); setIsModalOpen(true); }}
            className={`font-black text-xs md:text-sm truncate block cursor-pointer hover:underline ${titleTextColorClass}`}
            title="اضغط لفتح نافذة التعديل"
          >{car.brand || '-'}</span>
        </td>
      ),
      model: () => (
        <td className="px-3 py-0 h-[60px] max-h-[60px] align-middle text-center" key="model">
          <span className={`font-bold text-xs md:text-sm truncate block ${titleTextColorClass}`}>{car.model || '-'}</span>
        </td>
      ),
      interior_color: () => (
        <td className={`px-3 py-0 h-[60px] max-h-[60px] text-center align-middle ${bodyTextColorClass}`} key="interior_color">
          <span className="text-xs font-bold truncate block">{car.interiorColor || car.customData?.interiorColor || '-'}</span>
        </td>
      ),
      color: () => (
        <td className={`px-3 py-0 h-[60px] max-h-[60px] text-center align-middle ${bodyTextColorClass}`} key="color">
          <span className="text-xs font-bold truncate block">{car.color || '-'}</span>
        </td>
      ),
      year: () => (
        <td className={`px-3 py-0 h-[60px] max-h-[60px] text-center align-middle ${bodyTextColorClass}`} key="year">
          <span className="text-xs font-bold truncate block">{car.year || '-'}</span>
        </td>
      ),
      car_remark: () => (
        <td className={`px-3 py-0 h-[60px] max-h-[60px] text-center align-middle ${bodyTextColorClass}`} key="car_remark" title={car.carRemark || '-'}>
          <span className="text-xs font-bold truncate block max-w-[150px] mx-auto">{car.carRemark || '-'}</span>
        </td>
      ),
      entry_transport_company: () => (
        <td className={`px-3 py-0 h-[60px] max-h-[60px] text-center align-middle ${bodyTextColorClass}`} key="entry_transport_company">
          <span className="text-xs font-bold truncate block">{car.customData?.entryTransportCompany || car.customData?.transportCompany || '-'}</span>
        </td>
      ),
      car_info: () => (
        <td className="px-3 py-0 h-[60px] max-h-[60px] align-middle animate-fade-in" key="car_info">
          <div className="flex items-center gap-2 max-h-[56px] overflow-hidden">
            <button 
              onClick={() => { setEditingCar(car); setIsModalOpen(true); }}
              title="تعديل بيانات السيارة"
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 shrink-0 ${car.isOutbound ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-blue-50 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400 shadow-inner'}`}
            >
               <CarIcon size={16} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap leading-tight">
                <p className={`font-black text-xs md:text-sm leading-tight truncate max-w-[220px] ${titleTextColorClass}`} title={`${car.brand} ${car.model}`}>
                  {car.brand} {car.model}
                  {(car.carRemark || car.notes) && ` (${car.carRemark || car.notes})`}
                </p>
                {car.attributionSource && (
                  <span className="text-[9px] font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700/60 shadow-none">
                    وارد: {car.attributionSource}
                  </span>
                )}
                {car.carRemark && (
                  <span className="text-[9px] font-black bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 px-1.5 py-0.2 rounded border border-amber-100/50 truncate max-w-[110px]" title={car.carRemark}>
                    📝 {car.carRemark}
                  </span>
                )}
              </div>
            </div>
          </div>
        </td>
      ),
      notes: () => (
        <td className={`px-3 py-0 h-[60px] max-h-[60px] text-center align-middle min-w-[120px] max-w-[220px] ${notForSale ? 'text-red-700 dark:text-red-300 font-extrabold' : bodyTextColorClass}`} title={notesDisplay} key="notes">
          <div className="flex items-center justify-center gap-1 group/note max-h-[56px] overflow-hidden">
            <span className="text-xs font-bold truncate max-w-[160px] leading-tight">{notesDisplay}</span>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setEditingNotesCar(car);
                setQuickNoteValue(car.notes || car.exitData?.carCondition || '');
              }}
              className="p-1 text-slate-400 hover:text-blue-650 opacity-0 group-hover/note:opacity-100 dark:hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-all cursor-pointer inline-flex items-center shrink-0"
              title="تعديل الملاحظة سريعاً"
            >
              <Edit3 size={12} />
            </button>
          </div>
        </td>
      ),
      color_model: () => (
        <td className={`px-3 py-0 h-[60px] max-h-[60px] text-center align-middle ${bodyTextColorClass}`} key="color_model">
          <span className="text-xs font-bold truncate block">{car.color} | {car.year}</span>
        </td>
      ),
      vin: () => {
        const isNotMatching = Boolean(car.vinMatching && (String(car.vinMatching).trim() === 'غير مطابق' || String(car.vinMatching).trim() === 'غير متطابق' || String(car.vinMatching).trim() === 'mismatch'));
        return (
          <td 
            style={isNotMatching ? { backgroundColor: '#CC0000', color: '#FFFFFF' } : undefined}
            className={`px-3 py-0 h-[60px] max-h-[60px] text-center align-middle font-mono font-black text-xs tracking-normal uppercase ${isNotMatching ? 'text-white font-extrabold' : bodyTextColorClass}`} 
            key="vin"
          >
            <span className="truncate block">{car.vin}</span>
          </td>
        );
      },
      vin_matching: () => {
        const rawMatching = String(car.vinMatching || '').trim();
        const isNotMatching = rawMatching === 'غير مطابق' || rawMatching === 'غير متطابق' || rawMatching === 'mismatch' || rawMatching === 'غير_مطابق';
        return (
          <td 
            style={isNotMatching ? { backgroundColor: statusColors.mismatchBg, color: statusColors.mismatchText } : undefined}
            className={`px-3 py-0 h-[60px] max-h-[60px] text-center align-middle ${isNotMatching ? 'text-white font-extrabold' : ''}`}
            key="vin_matching"
          >
            <span 
              style={isNotMatching ? { backgroundColor: statusColors.mismatchBg, color: statusColors.mismatchText } : undefined}
              className={`px-2 py-0.5 rounded text-[10px] font-black ${
                isNotMatching 
                  ? 'border border-black/20'
                  : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/40'
              }`}
            >
              {isNotMatching ? 'غير متطابق' : 'متطابق'}
            </span>
          </td>
        );
      },
      plate: () => (
        <td className="px-3 py-0 h-[60px] max-h-[60px] text-center align-middle" key="plate">
          {car.hasPlate ? (
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-2 py-0.5 inline-flex flex-col items-center max-h-[56px]">
              <span className="text-xs font-black text-slate-900 dark:text-white tracking-normal leading-tight">{car.plateData?.plateNumber}</span>
              <span className="text-[7px] font-bold text-slate-400 uppercase leading-none">KSA Plate</span>
            </div>
          ) : (
            <span className="text-slate-400 font-bold text-xs">-</span>
          )}
        </td>
      ),
      card_number: () => {
        const rawCard = String(car.cardNumber || '').trim();
        const hasNoCard = !rawCard || rawCard === '-' || rawCard === 'لم يرد البطاقه بعد' || rawCard === 'لم يرد البطاقة بعد' || rawCard === 'بدون' || rawCard === 'غير متوفر' || rawCard === 'لا يوجد' || rawCard === 'غير مدرجة' || rawCard === 'null' || rawCard === 'undefined';
        const isTextCard = !hasNoCard && isNaN(Number(rawCard.replace(/\s+/g, '')));
        return (
          <td 
            style={hasNoCard ? { backgroundColor: '#DC2626', color: '#FFFFFF' } : (isTextCard ? { backgroundColor: '#EA580C', color: '#FFFFFF' } : undefined)}
            className={`px-3 py-0 h-[60px] max-h-[60px] text-center align-middle ${hasNoCard ? 'bg-red-600 text-white font-black' : (isTextCard ? 'text-white font-extrabold' : bodyTextColorClass)}`} 
            key="card_number"
            title={hasNoCard ? 'لم ترد البطاقة الجمركية بعد' : undefined}
          >
            {hasNoCard ? (
              <span className="inline-block px-2 py-0.5 rounded bg-red-700/80 text-white font-black text-[10px]">
                {rawCard && rawCard !== '-' && rawCard !== 'null' && rawCard !== 'undefined' ? rawCard : 'لم ترد البطاقة'}
              </span>
            ) : (
              <span className="text-xs font-mono font-bold truncate block">{car.cardNumber || '-'}</span>
            )}
          </td>
        );
      },
      ownership: () => (
        <td className={`px-3 py-0 h-[60px] max-h-[60px] text-center align-middle text-xs font-bold ${bodyTextColorClass}`} key="ownership">
          <span className="truncate block">{car.ownershipType || '-'}</span>
        </td>
      ),
      status: () => {
        let badgeBg = statusColors.availableBg;
        let badgeText = statusColors.availableText;
        if (customRule && customRule.applyToBadge !== false) {
          badgeBg = customRule.bgColor;
          badgeText = customRule.textColor || getContrastTextColor(customRule.bgColor);
        } else if (car.status === CarStatus.SOLD || String(car.status) === 'مباعة' || String(car.status) === 'مباع') {
          badgeBg = statusColors.soldBg;
          badgeText = statusColors.soldText || getContrastTextColor(statusColors.soldBg);
        } else if (car.status === CarStatus.RESERVED || String(car.status) === 'محجوزة' || String(car.status) === 'محجوز') {
          badgeBg = statusColors.reservedBg;
          badgeText = statusColors.reservedText || getContrastTextColor(statusColors.reservedBg);
        } else if (car.status === CarStatus.RETURNED || String(car.status) === 'مرتجعة للمعرض' || String(car.status) === 'مرتجع') {
          badgeBg = statusColors.returnedBg;
          badgeText = statusColors.returnedText || getContrastTextColor(statusColors.returnedBg);
        } else if (car.status === CarStatus.NOT_ARRIVED || String(car.status) === 'لم تصل بعد') {
          badgeBg = statusColors.notArrivedBg;
          badgeText = statusColors.notArrivedText || getContrastTextColor(statusColors.notArrivedBg);
        } else if (car.status === CarStatus.NOT_FOR_SALE || String(car.status) === 'غير معروضة للبيع') {
          badgeBg = statusColors.notForSaleBg;
          badgeText = statusColors.notForSaleText || getContrastTextColor(statusColors.notForSaleBg);
        }
        return (
          <td className="px-3 py-0 h-[60px] max-h-[60px] text-center align-middle" key="status">
            <span 
              style={{ backgroundColor: badgeBg, color: badgeText }}
              className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase shadow-sm border border-black/10 dark:border-white/10 whitespace-nowrap inline-block"
            >
              {car.status}
            </span>
          </td>
        );
      },
      car_condition: () => (
        <td className={`px-3 py-0 h-[60px] max-h-[60px] text-center align-middle min-w-[100px] max-w-[200px] text-xs font-medium ${bodyTextColorClass}`} key="car_condition">
          <span className="truncate block" title={car.exitData?.carCondition || '-'}>{car.exitData?.carCondition || '-'}</span>
        </td>
      ),
      rental: () => {
        const isNotRented = car.rentalStatus !== RentalStatus.RENTED;
        return (
          <td 
            style={isNotRented ? { backgroundColor: statusColors.notRentedBg, color: statusColors.notRentedText || getContrastTextColor(statusColors.notRentedBg) } : undefined}
            className={`px-3 py-0 h-[60px] max-h-[60px] text-center align-middle text-xs font-black uppercase whitespace-nowrap ${
              isNotRented ? 'text-white font-black' : bodyTextColorClass
            }`}
            key="rental"
          >
            {car.rentalStatus === RentalStatus.RENTED ? 'مجيرة' : 'لم تجير بعد'}
          </td>
        );
      },
      showroom: () => (
        <td className="px-3 py-0 h-[60px] max-h-[60px] text-center align-middle" key="showroom">
          <span
            title={car.presenceDescription || (car.isPresentInShowroom !== false ? 'داخل المعرض' : 'خارج المعرض')}
            className={`px-2.5 py-0.5 rounded text-[10px] font-black truncate inline-block max-w-[140px] align-middle ${
            car.isPresentInShowroom !== false 
              ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/40' 
              : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-100 dark:border-rose-900/40'
          }`}>
            {car.presenceDescription && car.presenceDescription.trim() !== ''
              ? car.presenceDescription
              : (car.isPresentInShowroom !== false ? 'نعم' : 'لا')}
          </span>
        </td>
      ),
      supplier: () => (
        <td className={`px-3 py-0 h-[60px] max-h-[60px] text-center align-middle text-xs font-bold ${bodyTextColorClass}`} key="supplier">
          <span className="truncate block max-w-[140px] mx-auto">{car.supplier || '-'}</span>
        </td>
      ),
      entry_date: () => (
        <td className={`px-3 py-0 h-[60px] max-h-[60px] text-center align-middle text-xs whitespace-nowrap font-medium ${bodyTextColorClass}`} key="entry_date">
          {car.entryDate ? new Date(car.entryDate).toLocaleDateString('ar-EG') : '-'}
        </td>
      ),
      attribution: () => (
        <td className={`px-3 py-0 h-[60px] max-h-[60px] text-center align-middle text-xs font-bold ${bodyTextColorClass}`} key="attribution">
          <span className="truncate block max-w-[120px] mx-auto">{car.attributionSource || '-'}</span>
        </td>
      ),
      seller: () => (
        <td className={`px-3 py-0 h-[60px] max-h-[60px] text-center align-middle text-xs font-bold ${bodyTextColorClass}`} key="seller">
          <span className="truncate block max-w-[140px] mx-auto">{getRepresentativeOrSeller(car)}</span>
        </td>
      ),
      delivery_type: () => (
        <td className={`px-3 py-0 h-[60px] max-h-[60px] text-center align-middle text-xs font-medium ${bodyTextColorClass}`} key="delivery_type">
          <span className="truncate block max-w-[120px] mx-auto">{car.exitData?.deliveryType || '-'}</span>
        </td>
      ),
      transport_company: () => (
        <td className={`px-3 py-0 h-[60px] max-h-[60px] text-center align-middle text-xs font-medium ${bodyTextColorClass}`} key="transport_company">
          <span className="truncate block max-w-[140px] mx-auto">{car.customData?.entryTransportCompany || car.exitData?.transportCompany || '-'}</span>
        </td>
      ),
      receiver_name: () => (
        <td className={`px-3 py-0 h-[60px] max-h-[60px] text-center align-middle text-xs font-bold ${bodyTextColorClass}`} key="receiver_name">
          <span className="truncate block max-w-[150px] mx-auto">{car.exitData?.receiverName || '-'}</span>
        </td>
      ),
      receiver_id: () => (
        <td className={`px-3 py-0 h-[60px] max-h-[60px] text-center align-middle text-xs font-mono font-medium ${bodyTextColorClass}`} key="receiver_id">
          <span className="truncate block">{car.exitData?.receiverId || '-'}</span>
        </td>
      ),
      nationality: () => (
        <td className={`px-3 py-0 h-[60px] max-h-[60px] text-center align-middle text-xs font-medium ${bodyTextColorClass}`} key="nationality">
          <span className="truncate block">{car.exitData?.nationality || '-'}</span>
        </td>
      ),
      receiver_phone: () => (
        <td className={`px-3 py-0 h-[60px] max-h-[60px] text-center align-middle whitespace-nowrap ${bodyTextColorClass} font-mono text-xs leading-none`} dir="ltr" key="receiver_phone">
          {car.exitData?.receiverPhone || '-'}
        </td>
      ),
      exit_date: () => (
        <td className={`px-3 py-0 h-[60px] max-h-[60px] text-center align-middle text-xs whitespace-nowrap font-medium ${bodyTextColorClass}`} key="exit_date">
          {car.exitData?.exitDate ? new Date(car.exitData.exitDate).toLocaleDateString('ar-EG') : '-'}
        </td>
      ),
      exit_notes: () => (
        <td className={`px-3 py-0 h-[60px] max-h-[60px] text-center align-middle text-xs font-medium ${bodyTextColorClass}`} title={car.exitData?.notes || ''} key="exit_notes">
          <span className="truncate block max-w-[160px] mx-auto">{car.exitData?.notes || '-'}</span>
        </td>
      ),
      cost_price: () => (
        <td className="px-3 py-0 h-[60px] max-h-[60px] text-center align-middle font-black text-slate-500 text-xs whitespace-nowrap" key="cost_price">
          {canViewFinancials ? (car.costPrice ?? 0).toLocaleString() : '****'}
        </td>
      ),
      price: () => (
        <td className="px-3 py-0 h-[60px] max-h-[60px] text-center align-middle font-black text-blue-600 text-sm whitespace-nowrap" key="price">
          {canViewFinancials ? (car.price ?? 0).toLocaleString() : '****'}
        </td>
      )
    };

    return (
      <tr 
        key={car.id} 
        style={{ ...rowStyle, height: '60px', minHeight: '60px', maxHeight: '60px' }} 
        className={`h-[60px] max-h-[60px] transition-colors ${rowBgClass}`}
      >
        <td className="px-2 py-0 h-[60px] max-h-[60px] text-center print:hidden align-middle">
          <button onClick={() => toggleSelect(car.id)} className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto ${selectedIds.has(car.id) ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-300'}`}>
            {selectedIds.has(car.id) ? <CheckSquare size={16} /> : <Square size={16} />}
          </button>
        </td>
        
        {/* Render customized table cells in their specific configured layout order */}
        {columns.map(col => {
          if (!col.visible) return null;
          const renderCell = cellRenderers[col.key];
          if (renderCell) {
            return renderCell();
          }
          // Dynamic fallback for custom fields
          return (
            <td key={col.key} className="px-3 py-0 h-[60px] max-h-[60px] text-center align-middle font-bold text-xs text-slate-600 dark:text-slate-400">
              <span className="truncate block max-w-[160px] mx-auto">{car.customData?.[col.key] || '-'}</span>
            </td>
          );
        })}

        <td className="px-2 py-0 h-[60px] max-h-[60px] text-center print:hidden align-middle">
        <div className="flex justify-center items-center gap-1 max-h-[58px]">
          {(car.status === CarStatus.NOT_ARRIVED_SHOWROOM || car.isPresentInShowroom === false) && (
            <button 
              onClick={() => handleReceiveNotArrivedCar(car)} 
              className="px-2 py-1 bg-emerald-650 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black flex items-center gap-1 transition-all animate-pulse"
              title="استلام المركبة وتنشيطها بالمخزون الفعلي"
            >
              <Check size={12} />
              <span>استلام</span>
            </button>
          )}

          {car.status !== CarStatus.NOT_ARRIVED_SHOWROOM && (
            <button 
              onClick={() => handleMoveToSales(car)} 
              className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 rounded-lg transition-all"
              title="نقل إلى المبيعات (خروج)"
            >
              <ShoppingBag size={16} />
            </button>
          )}
          {canManageInventory && (
            <button onClick={() => { setEditingCar(car); setIsModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-all"><Edit3 size={16} /></button>
          )}
          <button 
            onClick={() => handlePrintPriceQuote(car)} 
            className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:text-white hover:bg-emerald-600 dark:hover:bg-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg transition-all font-bold shadow-sm"
            title="إعداد وطباعة عرض سعر سيارة (Quotation)"
          >
            <FileText size={16} />
          </button>
          <button onClick={() => handlePrintCarCard(car)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded-lg transition-all" title="طباعة بطاقة">
            <Printer size={16} />
          </button>
          <button 
            onClick={() => handlePrintEntryPermit(car)} 
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-all"
            title="طباعة إذن استلام مخزني (دخول)"
          >
            <ArrowDownLeft size={16} />
          </button>
          <div className="relative inline-block">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setActiveExitPermitCarId(activeExitPermitCarId === car.id ? null : car.id);
              }} 
              className={`p-1.5 rounded-lg transition-all ${
                activeExitPermitCarId === car.id 
                  ? "text-rose-600 bg-rose-50 dark:bg-rose-950/40" 
                  : "text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800"
              }`}
              title="طباعة إذن خروج وتسليم"
            >
              <IdCard size={16} />
            </button>
            {activeExitPermitCarId === car.id && (
              <>
                <div 
                  className="fixed inset-0 z-30" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveExitPermitCarId(null);
                  }} 
                />
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-slate-100 dark:border-slate-800 z-40 py-1.5 text-right font-sans">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrintExitPermit(car, false);
                      setActiveExitPermitCarId(null);
                    }}
                    className="w-full text-right px-4 py-2.5 text-xs font-black text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    إذن خروج وتسليم سيارة
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrintExitPermit(car, true);
                      setActiveExitPermitCarId(null);
                    }}
                    className="w-full text-right px-4 py-2.5 text-xs font-black text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2 border-t border-slate-100 dark:border-slate-800"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    إذن خروج وتسليم سيارة ولوحة
                  </button>
                </div>
              </>
            )}
          </div>
          <button 
            onClick={() => handlePrintCarrierLetter(car)} 
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-all"
            title="طباعة خطاب شاحن والناقل السريع"
          >
            <Truck size={16} />
          </button>
          <button 
            onClick={() => { setSelectedCheckpointCar(car); setIsCheckpointModalOpen(true); }} 
            className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-slate-800 rounded-lg transition-all"
            title="طباعة وتحرير خطاب نقاط التفتيش"
          >
            <Shield size={16} />
          </button>
          {canManageInventory && (
            <button 
              onClick={() => {
                setItemToDeleteId(car.id);
                setDeleteError('');
                setConfirmPassword('');
                setIsDeleteConfirmOpen(true);
              }} 
              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg transition-all"
              title="حذف المركبة"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );};

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-32 text-right relative flex flex-col" dir="rtl">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 5mm; }
          body { 
            background: white !important; 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact;
            font-family: 'Cairo', sans-serif;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print-hidden, .no-print, button, .search-bar, .z-20 { display: none !important; }
          
          .table-print {
            border: none !important;
            box-shadow: none !important;
            overflow: visible !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .overflow-x-auto {
            overflow: visible !important;
            width: 100% !important;
          }
          
          table {
            width: 100% !important;
            min-width: 0 !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
          }
          
          th, td {
            padding: 2px 1px !important;
            font-size: 7pt !important;
            border: 0.1pt solid #94a3b8 !important;
            text-align: center !important;
            word-wrap: break-word !important;
            line-height: 1.1 !important;
          }
          
          th {
            background-color: #0f172a !important;
            color: white !important;
            font-weight: 900 !important;
          }
          
          tr { page-break-inside: avoid !important; }
          thead { display: table-header-group !important; }
          
          .table-print::before {
            content: "تقرير جرد المخزون - ${settings.name}";
            display: block;
            text-align: center;
            font-size: 14pt;
            font-weight: 900;
            margin-bottom: 10px;
            padding-bottom: 5px;
            border-bottom: 2pt solid #0f172a;
          }

          .bg-emerald-500, .bg-emerald-600 { background-color: #10b981 !important; color: white !important; }
          .bg-red-500, .bg-rose-500 { background-color: #ef4444 !important; color: white !important; }
          .bg-amber-500 { background-color: #f59e0b !important; color: white !important; }
          .text-blue-600 { color: #2563eb !important; }
        }
      `}</style>
      <div className="bg-white dark:bg-slate-900 p-5 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl flex flex-col items-center gap-5 print:hidden z-20">
        <div className="flex flex-col lg:flex-row items-center justify-between w-full gap-5">
          <div className="relative flex-1 w-full group">
            <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text" 
              placeholder="البحث بالماركة، الموديل، الشاسيه، أو رقم اللوحة..."
              className="w-full pr-16 pl-6 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-[1.8rem] outline-none focus:border-blue-500 font-bold dark:text-white shadow-inner transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {selectedIds.size > 0 && canManageInventory && (
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsBulkEditModalOpen(true)}
                  className="px-6 py-4 bg-amber-550 hover:bg-amber-600 text-white rounded-2xl font-black text-xs shadow-lg flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Layers size={18} />
                  <span>تعديل جماعي ({selectedIds.size})</span>
                </button>
                <button 
                  onClick={initiateBulkDelete}
                  className="px-6 py-4 bg-rose-500 text-white rounded-2xl font-black text-xs shadow-lg flex items-center gap-2"
                >
                  <Trash2 size={18} />
                  <span>حذف المحدد ({selectedIds.size})</span>
                </button>
              </div>
            )}

            {filteredCars.length > 0 && canManageInventory && (
              <button 
                onClick={() => { setDeleteError(''); setConfirmPassword(''); setIsClearAllConfirmOpen(true); }}
                className="px-6 py-4 bg-slate-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 rounded-2xl font-black text-xs flex items-center gap-2 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
              >
                <AlertTriangle size={18} />
                <span>حذف كل المخزون</span>
              </button>
            )}

            {canExport && (
              <button onClick={handleExcelExport} className="px-6 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs shadow-lg flex items-center gap-2 hover:bg-emerald-700 transition-colors">
                <FileSpreadsheet size={18} /> 
                <span>تصدير النتائج</span>
              </button>
            )}

            {selectedIds.size > 0 && (
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={() => setIsBulkExitModalOpen(true)} 
                  className="px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs shadow-lg flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Printer size={18} />
                  <span>إذن خروج مجمع للمحدد ({selectedIds.size})</span>
                </button>
                <button 
                  onClick={handlePrintBulkEntryPermits} 
                  className="px-6 py-4 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-black text-xs shadow-lg flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Printer size={18} />
                  <span>إذن دخول جماعي للمحدد ({selectedIds.size})</span>
                </button>
                <button 
                  onClick={() => {
                    setSelectedCarrierCar(undefined);
                    setSelectedCarrierCars(cars.filter(c => selectedIds.has(c.id)));
                    setIsCarrierModalOpen(true);
                  }}
                  className="px-6 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-black text-xs shadow-lg flex items-center gap-2 transition-all cursor-pointer ring-2 ring-purple-300 dark:ring-purple-900"
                >
                  <Truck size={18} />
                  <span>خطاب تحويل مجمع / سيارة محمولة ({selectedIds.size})</span>
                </button>
                <button 
                  onClick={() => {
                    setSelectedCheckpointCar(undefined);
                    setSelectedCheckpointCars(cars.filter(c => selectedIds.has(c.id)));
                    setIsCheckpointModalOpen(true);
                  }}
                  className="px-6 py-4 bg-sky-600 hover:bg-sky-700 text-white rounded-2xl font-black text-xs shadow-lg flex items-center gap-2 transition-all cursor-pointer animate-pulse"
                >
                  <Shield size={18} />
                  <span>خطاب تفتيش مجمع للمحدد ({selectedIds.size})</span>
                </button>
              </div>
            )}

            {canManageInventory && (
              <>
                <button 
                  onClick={() => { setEditingCar(null); setIsModalOpen(true); }} 
                  className="px-6 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors"
                >
                  <Plus size={18} />
                  <span>إضافة مركبة جديدة</span>
                </button>
                <button onClick={() => setIsImportWizardOpen(true)} className="px-6 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs shadow-lg flex items-center gap-2 hover:bg-blue-700 transition-colors">
                  <FileUp size={18} /> 
                  <span>استيراد ذكي</span>
                </button>
              </>
            )}
            
            <button 
              onClick={() => setShowColumnSettings(true)} 
              className="p-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl border border-slate-200 dark:border-slate-700 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2 font-bold text-xs"
              title="تخصيص الأعمدة"
            >
              <Settings2 size={18} />
              <span className="hidden sm:inline">تخصيص الأعمدة</span>
            </button>

            <button onClick={() => window.print()} className="p-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl border border-slate-200 dark:border-slate-700">
               <Printer size={18} />
            </button>

            {canManageInventory && (
              <>
                <button 
                  onClick={() => { setSelectedCheckpointCar(undefined); setIsCheckpointModalOpen(true); }} 
                  className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-8 py-4 rounded-[1.5rem] font-black shadow-xl hover:scale-105 transition-all text-sm"
                >
                  <Shield size={18} /> خطاب نقاط التفتيش
                </button>
                <button 
                  onClick={() => { setSelectedWithdrawalCar(undefined); setIsWithdrawalModalOpen(true); }} 
                  className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-blue-600 dark:bg-sky-600 text-white px-8 py-4 rounded-[1.5rem] font-black shadow-xl hover:scale-105 transition-all text-sm"
                >
                  <Truck size={18} /> خطاب سحب جديد
                </button>
              </>
            )}

            {canManageInventory && (
              <div className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-slate-150 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-6 py-4 rounded-[1.5rem] font-black border border-slate-250 dark:border-slate-700 text-xs">
                <ShieldAlert className="text-blue-600 dark:text-blue-400 animate-pulse" size={16} />
                <span>نمط البيانات الصارم نشط (الاستيراد عبر Excel فقط)</span>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation: Showroom Inventory vs In Transit / Shipping */}
        <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-100 dark:bg-slate-950 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 print:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setInventoryTab('showroom');
                setSelectedIds(new Set());
              }}
              className={`px-5 py-3 rounded-xl font-black text-xs sm:text-sm flex items-center gap-2.5 transition-all cursor-pointer ${
                inventoryTab === 'showroom'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
              }`}
            >
              <Building2 size={18} />
              <span>🏬 المخزون الفعلي بالمعرض</span>
              <span className={`px-2.5 py-0.5 text-[11px] rounded-full font-mono font-black ${
                inventoryTab === 'showroom' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}>
                {presentCars.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setInventoryTab('transit');
                setSelectedIds(new Set());
              }}
              className={`px-5 py-3 rounded-xl font-black text-xs sm:text-sm flex items-center gap-2.5 transition-all cursor-pointer ${
                inventoryTab === 'transit'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
              }`}
            >
              <Truck size={18} />
              <span>🚚 قسم الشحن والواردات (لم تصل المعرض)</span>
              <span className={`px-2.5 py-0.5 text-[11px] rounded-full font-mono font-black ${
                inventoryTab === 'transit' 
                  ? 'bg-white text-amber-800' 
                  : absentCars.length > 0 
                  ? 'bg-amber-500 text-white animate-pulse' 
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}>
                {absentCars.length}
              </span>
            </button>
          </div>

          {inventoryTab === 'transit' && absentCars.length > 0 && selectedIds.size > 0 && (
            <button
              type="button"
              onClick={() => {
                const selectedCars = absentCars.filter(c => selectedIds.has(c.id));
                setCarsToReceive(selectedCars);
                setArrivalDate(new Date().toISOString().split('T')[0]);
                setIsArrivalModalOpen(true);
              }}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs shadow-md shadow-emerald-500/20 flex items-center gap-2 transition-all cursor-pointer animate-bounce"
            >
              <CheckCircle2 size={16} />
              <span>اعتماد وصول المحدد للمعرض ({selectedIds.size} مركبة)</span>
            </button>
          )}
        </div>

        {/* Transit section banner */}
        {inventoryTab === 'transit' && (
          <div className="w-full bg-amber-500/10 border border-amber-300 dark:border-amber-900/60 p-4 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-xl">
                <Truck size={22} />
              </div>
              <div>
                <h4 className="text-sm font-black text-amber-900 dark:text-amber-300">
                  قسم الشحن والواردات — المركبات قيد الوصول (لم تصل المعرض)
                </h4>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-0.5">
                  هذه المركبات معزولة كلياً ولا تدمج في المخزون الفعلي ولا التقارير المالية لحين إدخالها واعتماد تاريخ الوصول الفعلي.
                </p>
              </div>
            </div>

            {absentCars.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setCarsToReceive(absentCars);
                  setArrivalDate(new Date().toISOString().split('T')[0]);
                  setIsArrivalModalOpen(true);
                }}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
              >
                <CheckCircle2 size={15} />
                <span>اعتماد وصول جميع الواردات ({absentCars.length})</span>
              </button>
            )}
          </div>
        )}

        <div className="w-full flex flex-wrap items-center gap-4 p-4 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-blue-500" />
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">تصفية حسب تاريخ الدخول:</span>
          </div>
          
          <div className="flex items-center gap-4 flex-1 min-w-[300px]">
             <div className="flex items-center gap-2 flex-1">
               <span className="text-[10px] font-bold text-slate-400">من</span>
               <input 
                 type="date" 
                 value={startDate} 
                 onChange={(e) => setStartDate(e.target.value)}
                 className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-blue-500 dark:text-white"
               />
             </div>
             <div className="flex items-center gap-2 flex-1">
               <span className="text-[10px] font-bold text-slate-400">إلى</span>
               <input 
                 type="date" 
                 value={endDate} 
                 onChange={(e) => setEndDate(e.target.value)}
                 className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-blue-500 dark:text-white"
               />
             </div>
             {(startDate || endDate || searchTerm) && (
               <button 
                 onClick={() => { setStartDate(''); setEndDate(''); setSearchTerm(''); }}
                 className="px-4 py-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl text-[10px] font-black uppercase transition-colors"
               >
                 مسح التصفية
               </button>
             )}
          </div>
          
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="text-[10px] font-black text-slate-400 bg-white dark:bg-slate-950 px-3 py-2 rounded-lg border border-slate-100 dark:border-slate-800">
               {inventoryTab === 'showroom' ? 'المخزون الفعلي:' : 'المركبات قيد الشحن:'} <span className="text-blue-500 font-extrabold">{displayedCars.length}</span>
            </div>

            {/* زر التبديل الذكي المتناسب مع العرض */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 select-none print:hidden">
              <button
                type="button"
                onClick={() => {
                  setViewMode('table');
                  try { localStorage.setItem('inventory_view_mode', 'table'); } catch(e){}
                }}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/50 dark:border-slate-850'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
                title="عرض القائمة كجدول متكامل بجميع التفاصيل"
              >
                <Table size={13} />
                <span>جدول</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode('grid');
                  try { localStorage.setItem('inventory_view_mode', 'grid'); } catch(e){}
                }}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/50 dark:border-slate-850'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
                title="عرض بطاقات شبكية متجاوبة وبنسب متناسقة حسب الشاشة"
              >
                <LayoutGrid size={13} />
                <span>بطاقات</span>
              </button>
            </div>

            {canExport && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleExcelExport} 
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-black text-[10px] flex items-center gap-1.5 shadow-md transition-all hover:scale-105 cursor-pointer"
                  title="تصدير جدول مخزون السيارات الفعلي المعروض حالياً إلى ملف Excel"
                >
                  <FileSpreadsheet size={14} />
                  <span>تصدير Excel</span>
                </button>

                <button 
                  onClick={handlePDFExport} 
                  disabled={isExportingPDF}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-black text-[10px] flex items-center gap-1.5 shadow-md transition-all hover:scale-105 cursor-pointer disabled:opacity-50"
                  title="تصدير جدول مخزون السيارات الفعلي المعروض حالياً إلى ملف PDF رسمي مع الشعار"
                >
                  {isExportingPDF ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>جاري التصدير...</span>
                    </>
                  ) : (
                    <>
                      <FileDown size={14} />
                      <span>تصدير PDF 📥</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2rem] sm:rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden table-print transition-theme">
        {effectiveViewMode === 'grid' ? (
          <div className="p-3 sm:p-6 bg-slate-50/40 dark:bg-slate-950/20 animate-fade-in print:hidden">
            {isMobileScreen && (
              <div className="mb-4 p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-2xl flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-bold">
                  <LayoutGrid size={16} className="shrink-0 text-blue-600" />
                  <span>تم تفعيل عرض البطاقات الذكي المتوافق مع الشاشات الصغيرة</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileForcedTable(!mobileForcedTable)}
                  className="px-2.5 py-1 bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg font-black text-[10px] shrink-0 hover:bg-blue-50 transition-all cursor-pointer"
                >
                  {mobileForcedTable ? 'الرجوع للبطاقات' : 'عرض كجدول واسع'}
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
              {displayedCars.map((car) => {
                const notForSale = car.status === CarStatus.NOT_FOR_SALE || String(car.status) === 'غير معروضة للبيع';
                const isSelected = selectedIds.has(car.id);
                const notesClean = getReservationRepresentative(car);
                const notesDisplay = notForSale
                  ? (notesClean && notesClean !== '-' ? `${notesClean} | غير معروضة للبيع` : 'غير معروضة للبيع')
                  : (notesClean || '-');
                
                const statusInfo = getCarStatusColorInfo(car, settings);
                const rentalInfo = getCarRentalColorInfo(car, settings);
                const rowCustomRule = getCustomRuleForCar(car, settings);

                let statusText: string = car.status;
                if (car.status === CarStatus.AVAILABLE) {
                  statusText = 'متوفرة';
                } else if (car.status === CarStatus.SOLD) {
                  statusText = 'مبيعة';
                } else if (car.status === CarStatus.RESERVED) {
                  statusText = 'محجوزة';
                } else if (car.status === CarStatus.NOT_ARRIVED || car.status === CarStatus.NOT_ARRIVED_SHOWROOM) {
                  statusText = 'لم تصل بعد';
                } else if (car.status === CarStatus.RETURNED) {
                  statusText = 'مسترجعة';
                }

                const borderClass = car.status === CarStatus.AVAILABLE ? 'border-emerald-200 dark:border-emerald-900/40 hover:border-emerald-400 dark:hover:border-emerald-600' :
                                    car.status === CarStatus.RESERVED ? 'border-amber-200 dark:border-amber-900/40 hover:border-amber-400 dark:hover:border-amber-600' :
                                    car.status === CarStatus.SOLD ? 'border-rose-200 dark:border-rose-900/40 hover:border-rose-400 dark:hover:border-rose-600' :
                                    car.status === CarStatus.NOT_ARRIVED || car.status === CarStatus.NOT_ARRIVED_SHOWROOM ? 'border-purple-200 dark:border-purple-900/40 hover:border-purple-400 dark:hover:border-purple-600' :
                                    'border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600';

                const isCopied = copiedVinId === car.id;

                return (
                  <div 
                    key={car.id} 
                    className={`bg-white dark:bg-slate-850 rounded-2xl sm:rounded-[2rem] border p-4 sm:p-5 transition-all duration-300 flex flex-col justify-between hover:shadow-lg relative min-h-[360px] ${borderClass} ${isSelected ? 'ring-2 ring-blue-500 dark:ring-blue-400 shadow-md' : ''}`}
                    style={rowCustomRule ? {
                      borderColor: rowCustomRule.textColor || undefined
                    } : undefined}
                  >
                    {/* Top Status Header */}
                    <div className="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-800 pb-2.5 gap-2">
                      <button 
                        onClick={() => toggleSelect(car.id)} 
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-blue-500'}`}
                        type="button"
                        title={isSelected ? 'إلغاء التحديد' : 'تحديد السيارة'}
                      >
                        {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                      </button>

                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {/* Status Badge */}
                        <span 
                          className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm transition-all inline-flex items-center gap-1"
                          style={{
                            backgroundColor: statusInfo.bg,
                            color: statusInfo.text
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80 animate-pulse"></span>
                          {statusText}
                        </span>

                        {/* Rental Badge */}
                        {rentalInfo.isNotRented && (
                          <span 
                            className="px-2 py-0.5 rounded text-[9px] font-black border"
                            style={{
                              backgroundColor: rentalInfo.bg,
                              color: rentalInfo.text,
                              borderColor: 'rgba(255,255,255,0.2)'
                            }}
                          >
                            غير مؤجرة
                          </span>
                        )}

                        {/* VIN Matching Badge */}
                        {car.vinMatching && (String(car.vinMatching).trim() === 'غير مطابق' || String(car.vinMatching).trim() === 'غير متطابق' || String(car.vinMatching).trim() === 'mismatch' || String(car.vinMatching).trim() === 'غير_مطابق') && (
                          <span className="bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-[9px] font-black px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900/30">
                            غير متطابق
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Car Header Info */}
                    <div className="mb-3">
                      <div className="flex items-center gap-2.5">
                        <button 
                          onClick={() => { setEditingCar(car); setIsModalOpen(true); }}
                          className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 cursor-pointer transition-colors shadow-inner shrink-0"
                          title="تعديل بيانات السيارة"
                          type="button"
                        >
                          <CarIcon size={20} />
                        </button>
                        <div className="flex-1 min-w-0 font-sans">
                          <h4 className="font-black text-slate-900 dark:text-white text-sm sm:text-base truncate leading-tight" title={`${car.brand} ${car.model}`}>
                            {car.brand} {car.model}
                          </h4>
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            <span className="text-[9px] font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                              سنة: {car.year}
                            </span>
                            {car.color && (
                              <span className="text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded">
                                {car.color}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Specs Grid */}
                    <div className="space-y-2 bg-slate-50/70 dark:bg-slate-900/40 p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-100 dark:border-slate-800/60 mb-3 text-xs font-bold text-slate-700 dark:text-slate-300 grow flex flex-col justify-center">
                      {/* VIN with quick copy */}
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50 pb-1.5">
                        <span className="text-slate-400 dark:text-slate-500 text-[10px]">الهيكل VIN</span>
                        <div className="flex items-center gap-1">
                          <span className="font-mono font-black text-xs tracking-wider uppercase text-slate-900 dark:text-slate-100 select-all">{car.vin}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (car.vin) {
                                navigator.clipboard.writeText(car.vin);
                                setCopiedVinId(car.id);
                                setTimeout(() => setCopiedVinId(null), 1500);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-blue-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-all cursor-pointer"
                            title="نسخ رقم الهيكل"
                          >
                            {isCopied ? <CheckCircle2 size={12} className="text-emerald-500" /> : <Copy size={11} />}
                          </button>
                        </div>
                      </div>

                      {/* Plate / Customs */}
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50 pb-1.5">
                        <span className="text-slate-400 dark:text-slate-500 text-[10px]">اللوحة / الجمرك</span>
                        {car.hasPlate ? (
                          <span className="font-black text-slate-850 dark:text-slate-200 font-mono text-[11px] tracking-wide">{car.plateData?.plateNumber}</span>
                        ) : (
                          <span className="text-slate-400 px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 text-[9px] rounded font-black">جمرك</span>
                        )}
                      </div>

                      {/* Showroom presence */}
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50 pb-1.5">
                        <span className="text-slate-400 dark:text-slate-500 text-[10px]">التواجد</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${car.isPresentInShowroom !== false ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-650 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400'}`}>
                          {car.isPresentInShowroom !== false ? 'داخل المعرض' : 'خارج المعرض'}
                        </span>
                      </div>

                      {/* Delegate Notes */}
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50 pb-1.5">
                        <span className="text-slate-400 dark:text-slate-500 text-[10px]">مندوب الحجز</span>
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="text-slate-700 dark:text-slate-300 text-xs truncate max-w-[120px] font-bold" title={notesDisplay}>
                            {notesDisplay}
                          </span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingNotesCar(car);
                              setQuickNoteValue(car.notes || '');
                            }}
                            className="p-1 text-slate-400 hover:text-blue-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-all cursor-pointer inline-flex items-center"
                            title="تعديل مندوب الحجز سريعاً"
                            type="button"
                          >
                            <Edit3 size={11} />
                          </button>
                        </div>
                      </div>

                      {/* Seller */}
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50 pb-1.5">
                        <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold">مندوب الحجز</span>
                        <span className="text-blue-600 dark:text-sky-400 text-xs truncate max-w-[120px] font-black" title={getRepresentativeOrSeller(car)}>
                          {getRepresentativeOrSeller(car)}
                        </span>
                      </div>

                      {/* Financials (if permitted) */}
                      {canViewFinancials && (
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-slate-400 dark:text-slate-500 text-[10px]">التكلفة / السعر</span>
                          <div className="flex items-center gap-1 font-black text-xs">
                            <span className="text-emerald-600 dark:text-emerald-400">{car.price ? `${Number(car.price).toLocaleString('ar-EG')} ر.س` : '-'}</span>
                            <span className="text-slate-300 dark:text-slate-600 text-[9px]">/</span>
                            <span className="text-slate-500 dark:text-slate-400">{car.costPrice ? `${Number(car.costPrice).toLocaleString('ar-EG')}` : '-'}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Card Actions Bottom Toolbar */}
                    <div className="flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800 pt-3 flex-wrap">
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => { setEditingCar(car); setIsModalOpen(true); }}
                          className="min-h-[36px] px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-sky-400 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                          title="تعديل سيارة"
                          type="button"
                        >
                          <Edit3 size={13} />
                          <span className="hidden sm:inline">تعديل</span>
                        </button>
                        {canManageInventory && (
                          <button 
                            onClick={() => {
                              setItemToDeleteId(car.id);
                              setDeleteError('');
                              setConfirmPassword('');
                              setIsDeleteConfirmOpen(true);
                            }}
                            className="min-h-[36px] p-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-all cursor-pointer"
                            title="حذف سيارة"
                            type="button"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(car.status === CarStatus.NOT_ARRIVED_SHOWROOM || car.isPresentInShowroom === false) && (
                          <button 
                            onClick={() => handleReceiveNotArrivedCar(car)}
                            className="min-h-[36px] px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-colors cursor-pointer animate-pulse"
                            type="button"
                            title="استلام المركبة وتنشيطها بالمخزون الفعلي"
                          >
                            <Check size={12} />
                            <span>استلام</span>
                          </button>
                        )}

                        <button 
                          onClick={() => handlePrintPriceQuote(car)}
                          className="min-h-[36px] px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
                          type="button"
                          title="إعداد وتخصيص وطباعة عرض سعر"
                        >
                          <FileText size={12} />
                          <span>عرض سعر</span>
                        </button>

                        {car.status === CarStatus.RESERVED && (
                          <button 
                            onClick={() => { setSelectedCheckpointCar(car); setIsCheckpointModalOpen(true); }}
                            className="min-h-[36px] px-2.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-colors cursor-pointer"
                            type="button"
                          >
                            <Shield size={12} />
                            <span>نقاط التفتيش</span>
                          </button>
                        )}
                        
                        {car.status === CarStatus.SOLD && (
                          <button 
                            onClick={() => { setSelectedWithdrawalCar(car); setIsWithdrawalModalOpen(true); }}
                            className="min-h-[36px] px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-colors cursor-pointer"
                            type="button"
                          >
                            <Truck size={12} />
                            <span>خطاب السحب</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-right border-collapse min-w-[1400px]">
            <thead className="bg-slate-950 text-white text-[10px] font-black uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-4 py-6 text-center print:hidden w-16">
                   <button onClick={toggleSelectAll} className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/10">
                     {selectedIds.size === displayedCars.length && displayedCars.length > 0 ? <CheckSquare size={20} className="text-blue-400" /> : <Square size={20} />}
                   </button>
                </th>
                {columns.map(col => {
                  if (!col.visible) return null;
                  return (
                    <th key={col.key} className={`px-4 py-6 font-black ${col.key === 'car_info' ? 'text-right' : 'text-center'}`}>
                      {col.label}
                    </th>
                  );
                })}
                <th className="px-6 py-6 text-center print:hidden">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {displayedCars.length === 0 ? (
                <tr>
                  <td colSpan={100} className="px-6 py-12 text-center text-slate-400 font-extrabold text-sm">
                    {inventoryTab === 'showroom' ? 'لا توجد سيارات في المخزون الفعلي بالمعرض' : 'لا توجد سيارات قيد الشحن أو الواردات (لم تصل المعرض)'}
                  </td>
                </tr>
              ) : (
                (() => {
                  let lastBrand = '';
                  let lastModel = '';
                  let lastAttribution = '';
                  return displayedCars.map((car, carIdx) => {
                    const cleanBrand = getCleanBrandName(car.brand);
                    const showBrandHeader = cleanBrand !== lastBrand;
                    if (showBrandHeader) {
                      lastBrand = cleanBrand;
                      lastModel = ''; // reset model header on new brand group
                      lastAttribution = ''; // reset attribution
                    }

                    const modelKey = getCleanModelKey(car.model);
                    const showModelHeader = modelKey !== lastModel;
                    if (showModelHeader) {
                      lastModel = modelKey;
                      lastAttribution = ''; // reset attribution on model change
                    }

                    const attributionVal = car.attributionSource || 'عام / غير محدد';
                    const showAttributionHeader = showModelHeader || attributionVal !== lastAttribution;
                    if (showAttributionHeader) {
                      lastAttribution = attributionVal;
                    }

                    return (
                      <React.Fragment key={car.id}>
                        {showBrandHeader && (
                          <tr className="bg-[#1e1b4b]/15 dark:bg-[#1e1b4b]/40 border-y-2 border-indigo-900/20 dark:border-indigo-900/40">
                            <td colSpan={100} className="px-6 py-4.5 text-center">
                              <span className="text-lg md:text-xl font-extrabold text-[#1e1b4b] dark:text-indigo-200 tracking-widest uppercase inline-block">
                                🚘 {cleanBrand} {inventoryTab === 'transit' ? '(لم تصل المعرض)' : ''}
                              </span>
                            </td>
                          </tr>
                        )}
                        {showModelHeader && (
                          <tr className="bg-[#374151]/15 dark:bg-[#374151]/40 border-y border-gray-300 dark:border-gray-600 shadow-sm animate-fade-in">
                            <td colSpan={100} className="px-8 py-3.5 text-center">
                              <span className="text-[17px] md:text-[20px] font-black text-[#374151] dark:text-slate-200 tracking-wider inline-block">
                                {car.model || 'عام'}
                              </span>
                            </td>
                          </tr>
                        )}
                        {showAttributionHeader && (
                          <tr className="bg-[#082f49]/10 dark:bg-[#082f49]/35 border-y border-sky-100 dark:border-sky-900/60 shadow-sm animate-fade-in">
                            <td colSpan={100} className="px-10 py-2.5 text-center">
                              <span className="text-[12px] font-extrabold text-[#082f49] dark:text-sky-200 tracking-wide inline-block">
                                📥 الوارد والمصدر: {attributionVal} {inventoryTab === 'transit' ? '(لم تصل المعرض)' : ''}
                              </span>
                            </td>
                          </tr>
                        )}
                        {renderCarRow(car, carIdx + 1)}
                      </React.Fragment>
                    );
                  });
                })()
              )}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <CarFormModal 
          car={editingCar} 
          settings={settings} 
          cars={cars}
          currentUser={currentUser}
          users={users}
          delegates={delegates}
          onClose={() => setIsModalOpen(false)}
          hideOutboundToggle={false}
          onSave={(data) => {
            if (editingCar) {
              const statusChanged = editingCar.status !== data.status;
              if (statusChanged && editingCar.status === CarStatus.RESERVED) {
                const isAdminUser = String(currentUser?.role) === UserRole.ADMIN || String(currentUser?.role) === 'مدير' || String(currentUser?.role).toUpperCase() === 'ADMIN';
                const isCreator = currentUser && editingCar.reservedByUserId && currentUser.username.trim().toLowerCase() === editingCar.reservedByUserId.trim().toLowerCase();
                
                if (!isAdminUser && !isCreator) {
                  alert('خطأ: لا يمكن تغيير حالة هذه المركبة لأنها محجوزة! فقط مدير النظام أو المندوب المسؤول عن الحجز بإمكانه تغيير الحالة.');
                  return;
                }
              }

              // Clear reservation info if status is reset back to available
              if (data.status === CarStatus.AVAILABLE) {
                data.reservedByUserId = undefined;
              }

              const action = (!editingCar.isOutbound && data.isOutbound) ? 'نقل للمبيعات' : 'تعديل بيانات';
              onUpdate({ 
                ...editingCar, 
                ...data, 
                lastModified: new Date().toISOString(),
                history: [
                  ...(editingCar.history || []),
                  { id: `h-${Date.now()}`, action, timestamp: new Date().toISOString(), user: currentUser?.username || 'نظام' }
                ]
              });
            } else {
              onAdd({ id: `car-${Date.now()}`, ...data, entryDate: data.entryDate || new Date().toISOString(), history: [{ id: `h-${Date.now()}`, action: 'إضافة للمخزون', timestamp: new Date().toISOString(), user: currentUser?.username || 'نظام' }] });
            }
            setIsModalOpen(false);
          }}
        />
      )}

      {showExcelModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300 overflow-y-auto overscroll-contain" dir="rtl">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-8 border border-slate-100 dark:border-slate-800 shadow-2xl space-y-6 animate-in zoom-in-95 duration-300 text-right max-h-[92vh] sm:max-h-[90vh] my-auto overflow-y-auto">
            
            {/* Header */}
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl sm:rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <FileSpreadsheet size={22} className="sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">بوابة تصدير التقارير إلى Excel المطور</h3>
                  <p className="text-[11px] sm:text-xs text-slate-500">منظومة موازنة وقراءة ومعالجة أطوال الخلايا التلقائية ورعاية الطباعة</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setShowExcelModal(false);
                  setExportingProgress(null);
                  setExportDiagnostics(null);
                }}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 dark:text-slate-500 transition-colors cursor-pointer border-0 bg-transparent"
              >
                <X size={18} />
              </button>
            </div>

            {exportingProgress && exportingProgress.percent < 100 ? (
              /* PROGRESS STAGE */
              <div className="space-y-6 py-6 text-center">
                <div className="relative w-24 h-24 mx-auto animate-spin rounded-full border-4 border-slate-150 border-t-emerald-600 dark:border-slate-850 dark:border-t-emerald-400" />
                <div className="space-y-2">
                  <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">{exportingProgress.stage}</h4>
                  <p className="text-[11px] text-slate-400 font-mono">التقدم الكلي: {exportingProgress.percent}% ({exportingProgress.processedRows} من {exportingProgress.totalRows} سجل)</p>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${exportingProgress.percent}%` }} />
                </div>
              </div>
            ) : exportDiagnostics ? (
              /* DIAGNOSTIC REPORT STAGE */
              <div className="space-y-5">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-150 dark:border-emerald-900/40 rounded-2xl flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Check size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white">تم تصدير وحفظ التقرير المطور بنجاح وتحميله على جهازك!</h4>
                    <p className="text-[10px] text-slate-400">أدناه التفصيل والتقرير التشخيصي (Telemetry Log) لأبعاد الأعمدة وقيم الفحص التلقائي.</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-850 text-center">
                    <span className="block text-[10px] text-slate-400">اتجاه الطباعة</span>
                    <span className="block text-xs font-black text-slate-800 dark:text-white mt-1">
                      {exportDiagnostics.printOrientation === 'landscape' ? 'أفقي (Landscape)' : 'عمودي (Portrait)'}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-850 text-center">
                    <span className="block text-[10px] text-slate-400">الصفوف النشطة</span>
                    <span className="block text-xs font-black text-indigo-600 dark:text-indigo-400 mt-1 font-mono">
                      {exportDiagnostics.activeRowsExported} صف
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-850 text-center">
                    <span className="block text-[10px] text-slate-400">الصفوف الفارغة المحذوفة</span>
                    <span className="block text-xs font-black text-rose-600 dark:text-rose-400 mt-1 font-mono">
                      {exportDiagnostics.emptyRowsDetected} صف
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">سجل عرض وقيم الأعمدة الموزونة (Auto-Fit Columns Log):</span>
                  <div className="max-h-48 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden text-xs custom-scrollbar">
                    <div className="overflow-x-auto custom-scrollbar w-full">
                    <table className="w-full text-right border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-bold border-b border-slate-105">
                          <th className="p-3">اسم العمود</th>
                          <th className="p-3 text-center">العرض الموزون (Width)</th>
                          <th className="p-3">أطول قيمة مستخدمة بالعمود</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-slate-700 dark:text-slate-300">
                        {exportDiagnostics.columnsWidths.map((col, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20">
                            <td className="p-3 font-bold">{col.header}</td>
                            <td className="p-3 text-center font-mono text-emerald-600 dark:text-emerald-400">{col.calculatedWidth} ch</td>
                            <td className="p-3 text-slate-400 font-bold truncate max-w-[180px]">{col.longestValue || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setShowExcelModal(false);
                      setExportingProgress(null);
                      setExportDiagnostics(null);
                    }}
                    className="px-6 py-3 bg-slate-900 border border-slate-800 hover:bg-slate-950 text-white font-black text-xs rounded-xl cursor-pointer shadow-md transition-colors"
                  >
                    إغلاق التقرير التشخيصي
                  </button>
                </div>
              </div>
            ) : (
              /* OPTION SELECT PANEL */
              <>
                {/* dynamic counts details information card */}
                <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-150 dark:border-emerald-900/40 rounded-[1.5rem] space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span>المركبات المحددة بالجدول:</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold bg-white dark:bg-slate-950 px-2.5 py-1 rounded-md shadow-sm">
                      {selectedIds.size} سيارة
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span>السيارات التي تم تصفيتها (نتائج البحث):</span>
                    <span className="font-mono text-blue-600 dark:text-blue-400 font-bold bg-white dark:bg-slate-950 px-2.5 py-1 rounded-md shadow-sm">
                      {filteredCars.length} سيارة
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span>إجمالي المخزون بالنظام:</span>
                    <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold bg-white dark:bg-slate-950 px-2.5 py-1 rounded-md shadow-sm">
                      {cars.length} سيارة
                    </span>
                  </div>
                </div>

                {/* Bulk select controller with Select All / Deselect All */}
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950/40 px-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-black text-slate-600 dark:text-slate-400">تحكم التحديد الجماعي السريع:</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedIds(new Set(filteredCars.map(c => c.id)))}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-[10px] font-black rounded-lg transition-all border-0 cursor-pointer"
                    >
                      تحديد الكل ({filteredCars.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedIds(new Set())}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 text-rose-600 dark:text-rose-400 text-[10px] font-black rounded-lg transition-all border-0 cursor-pointer"
                    >
                      إلغاء تحديد الكل
                    </button>
                  </div>
                </div>

                {/* Export targets choices */}
                <div className="space-y-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">حدد خيار نطاق التصدير:</span>
                  
                  <div className="grid grid-cols-1 gap-2.5">
                    {/* 1. Selected only */}
                    <button
                      type="button"
                      disabled={selectedIds.size === 0}
                      onClick={() => setExcelExportMode('selected')}
                      className={`flex items-start gap-3.5 p-4 rounded-2xl border-2 text-right transition-all cursor-pointer ${
                        selectedIds.size === 0 
                          ? 'opacity-40 cursor-not-allowed border-slate-150 bg-slate-50' 
                          : excelExportMode === 'selected'
                            ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10'
                            : 'border-slate-150 dark:border-slate-800 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-950/10'
                      }`}
                    >
                      <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${excelExportMode === 'selected' ? 'border-emerald-500' : 'border-slate-300'}`}>
                        {excelExportMode === 'selected' && <div className="w-2 h-2 bg-emerald-500 rounded-full" />}
                      </div>
                      <div className="space-y-0.5">
                        <span className="block font-black text-xs text-slate-800 dark:text-white flex items-center gap-1.5">
                          <span>تصدير المركبات المحددة فقط</span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-150 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-400 font-mono font-black">{selectedIds.size} مركبة</span>
                        </span>
                        <span className="block text-[10px] text-slate-400 font-bold">يقوم بتصدير الخيارات التي وضعت عليها علامة (صح) فقط مع احترام الفلترة والترتيب وقائمة الأعمدة النشطة.</span>
                      </div>
                    </button>

                    {/* 2. Filtered results */}
                    <button
                      type="button"
                      onClick={() => setExcelExportMode('filtered')}
                      className={`flex items-start gap-3.5 p-4 rounded-2xl border-2 text-right transition-all cursor-pointer ${
                        excelExportMode === 'filtered'
                          ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10'
                          : 'border-slate-150 dark:border-slate-800 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-950/10'
                      }`}
                    >
                      <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${excelExportMode === 'filtered' ? 'border-emerald-500' : 'border-slate-300'}`}>
                        {excelExportMode === 'filtered' && <div className="w-2 h-2 bg-emerald-500 rounded-full" />}
                      </div>
                      <div className="space-y-0.5">
                        <span className="block font-black text-xs text-slate-800 dark:text-white flex items-center gap-1.5">
                          <span>تصدير نتائج البحث الجارية فقط</span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-150 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-400 font-mono font-black">{filteredCars.length} مركبة</span>
                        </span>
                        <span className="block text-[10px] text-slate-400 font-bold">تحميل كافة السيارات التي تطابق الفلاتر النشطة أو شريط البحث حالياً.</span>
                      </div>
                    </button>

                    {/* 3. Page only */}
                    <button
                      type="button"
                      onClick={() => setExcelExportMode('page')}
                      className={`flex items-start gap-3.5 p-4 rounded-2xl border-2 text-right transition-all cursor-pointer ${
                        excelExportMode === 'page'
                          ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10'
                          : 'border-slate-150 dark:border-slate-800 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-950/10'
                      }`}
                    >
                      <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${excelExportMode === 'page' ? 'border-emerald-500' : 'border-slate-300'}`}>
                        {excelExportMode === 'page' && <div className="w-2 h-2 bg-emerald-500 rounded-full" />}
                      </div>
                      <div className="space-y-0.5">
                        <span className="block font-black text-xs text-slate-800 dark:text-white flex items-center gap-1.5">
                          <span>تصدير الصفحة الحالية فقط</span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-150 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-400 font-mono font-black">{filteredCars.length} مركبة</span>
                        </span>
                        <span className="block text-[10px] text-slate-400 font-bold">توليد جدول يحتوي بدقة على المركبات الظاهرة بالصفحة النشطة مباشرة.</span>
                      </div>
                    </button>

                    {/* 4. Full dataset */}
                    <button
                      type="button"
                      onClick={() => setExcelExportMode('all')}
                      className={`flex items-start gap-3.5 p-4 rounded-2xl border-2 text-right transition-all cursor-pointer ${
                        excelExportMode === 'all'
                          ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10'
                          : 'border-slate-150 dark:border-slate-800 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-950/10'
                      }`}
                    >
                      <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${excelExportMode === 'all' ? 'border-emerald-500' : 'border-slate-300'}`}>
                        {excelExportMode === 'all' && <div className="w-2 h-2 bg-emerald-500 rounded-full" />}
                      </div>
                      <div className="space-y-0.5">
                        <span className="block font-black text-xs text-slate-800 dark:text-white flex items-center gap-1.5">
                          <span>تصدير قاعدة البيانات بالكامل</span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-150 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-400 font-mono font-black">{cars.length} مركبة</span>
                        </span>
                        <span className="block text-[10px] text-slate-400 font-bold">تحميل أرشيف كامل للنظام يشمل جميع الماركات والسيارات (المباعة والمتوفرة) بلا قيود.</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Excel Row Height & Font Size Configuration */}
                <div className="p-4 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-150 dark:border-slate-850 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2">
                    <span className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-2">
                      <span>إعدادات ارتفاع الصف وحجم الخط في Excel:</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold">
                      توحيد الأبعاد وتصغير الخط
                    </span>
                  </div>

                  {/* Row Height Unified Selector */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 block">
                      توحيد ارتفاع الصفوف (Excel Row Height):
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setExcelRowHeightPx(45)}
                        className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                          excelRowHeightPx === 45
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-xs font-black">45 بكسل (34pt)</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">موحد ومدمج (موصى به)</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setExcelRowHeightPx(60)}
                        className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                          excelRowHeightPx === 60
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-xs font-black">60 بكسل (45pt)</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">موحد ومريح</div>
                      </button>

                      <div className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-1.5 col-span-2 sm:col-span-1">
                        <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">مخصص:</span>
                        <input
                          type="number"
                          min="20"
                          max="120"
                          value={excelRowHeightPx}
                          onChange={(e) => setExcelRowHeightPx(Math.max(20, Math.min(150, Number(e.target.value) || 45)))}
                          className="w-16 px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-black text-center"
                        />
                        <span className="text-[10px] text-slate-400 font-bold">px</span>
                      </div>
                    </div>
                  </div>

                  {/* Font Size Selector */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 block">
                      حجم خط البيانات (Font Size):
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      {[
                        { size: 10, label: 'صغير (10pt)' },
                        { size: 11, label: 'قياسي (11pt) - افتراضي' },
                        { size: 12, label: 'متوسط (12pt)' }
                      ].map((item) => (
                        <button
                          key={item.size}
                          type="button"
                          onClick={() => setExcelFontSizePt(item.size)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black border transition-all cursor-pointer ${
                            excelFontSizePt === item.size
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Clean continuous rows without brand/category separators */}
                  <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800">
                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!excelIncludeSeparators}
                        onChange={(e) => setExcelIncludeSeparators(!e.target.checked)}
                        className="w-4 h-4 mt-0.5 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                      />
                      <div>
                        <span className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                          جدول متصل ونظيف بدون فواصل الماركات والفئات (مطابق لتنسيق PDF)
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          إزالة صفوف الترويسات الفاصلة بين السيارات ليظهر كل صف سيارة مباشرة وبترقيم متصل 1, 2, 3...
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Footer buttons */}
                <div className="flex gap-3 justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setShowExcelModal(false);
                      setExportingProgress(null);
                      setExportDiagnostics(null);
                    }}
                    className="px-5 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl border-0 cursor-pointer"
                  >
                    إلغاء الأمر
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      executeExcelExport(excelExportMode);
                    }}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl flex items-center gap-2 border-0 cursor-pointer transition-colors shadow-md animate-pulse"
                  >
                    <FileSpreadsheet size={16} />
                    <span>تأكيد وتحميل التقرير (Excel)</span>
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

      {/* PDF Export Configuration Modal */}
      {showPdfModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto overscroll-contain">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl sm:rounded-[2.5rem] p-5 sm:p-8 border border-slate-100 dark:border-slate-800 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 my-auto text-right">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-150 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-inner">
                  <FileText size={24} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    تصدير تقرير PDF لمخزون السيارات
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                    تصدير عالي الدقة مع التزام صارم بالأعمدة الظاهرة وارتفاع صفوف موحد (60px)
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isExportingPDF}
                onClick={() => setShowPdfModal(false)}
                className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center transition-colors border-0 cursor-pointer disabled:opacity-40"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Container */}
            <div className="space-y-4 max-h-[65vh] overflow-y-auto px-1">
              
              {/* Report Title Input Section */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-150 dark:border-slate-800 space-y-2">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                  عنوان التقرير (يظهر داخل الحاوية العلوية بالتقرير):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={pdfReportTitle}
                    onChange={(e) => setPdfReportTitle(e.target.value)}
                    placeholder="اكتب عنوان التقرير هنا..."
                    className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const defaultTitle = inventoryTab === 'showroom' 
                        ? 'تقرير جدول مخزون السيارات الفعلي بالمعرض' 
                        : 'تقرير جدول مخزون السيارات قيد الشحن والتوريد';
                      setPdfReportTitle(defaultTitle);
                    }}
                    className="px-3 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-300 border-0 cursor-pointer whitespace-nowrap"
                  >
                    استعادة الافتراضي
                  </button>
                </div>
              </div>

              {/* Columns Commitment Banner */}
              <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    <span className="text-xs font-black text-rose-800 dark:text-rose-300">
                      التزام تام بالأعمدة المعتمدة:
                    </span>
                    <span className="text-[11px] px-2 py-0.5 bg-rose-150 dark:bg-rose-900/60 text-rose-700 dark:text-rose-200 rounded-full font-black">
                      {columns.filter(c => c.visible && c.key !== 'actions').length} عمود ظاهر
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPdfModal(false);
                      setShowColumnSettings(true);
                    }}
                    className="text-[11px] font-black text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 border-0 bg-transparent cursor-pointer"
                  >
                    <Settings2 size={13} />
                    <span>تعديل تخصيص الأعمدة</span>
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {columns.filter(c => c.visible && c.key !== 'actions').map(col => (
                    <span key={col.key} className="px-2 py-0.5 bg-white dark:bg-slate-800 border border-rose-100 dark:border-slate-700 rounded-md text-[10px] font-bold text-slate-700 dark:text-slate-300">
                      {col.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Selection Scope */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                    نطاق بيانات التصدير:
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedIds(new Set(displayedCars.map(c => c.id)))}
                      className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-[10px] font-black rounded-lg border-0 cursor-pointer"
                    >
                      تحديد الكل ({displayedCars.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedIds(new Set())}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-500 text-[10px] font-black rounded-lg border-0 cursor-pointer"
                    >
                      إلغاء التحديد
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPdfExportScope('filtered')}
                    className={`p-3 rounded-xl border-2 text-right transition-all cursor-pointer ${
                      pdfExportScope === 'filtered'
                        ? 'border-rose-500 bg-rose-50/30 dark:bg-rose-950/30'
                        : 'border-slate-150 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-black text-xs text-slate-800 dark:text-white flex items-center justify-between">
                      <span>المعروض بالجدول</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
                        {displayedCars.length}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-1">النتائج المطابقة للفلترة الحالية</span>
                  </button>

                  <button
                    type="button"
                    disabled={selectedIds.size === 0}
                    onClick={() => setPdfExportScope('selected')}
                    className={`p-3 rounded-xl border-2 text-right transition-all cursor-pointer ${
                      selectedIds.size === 0 
                        ? 'opacity-40 cursor-not-allowed border-slate-150' 
                        : pdfExportScope === 'selected'
                          ? 'border-rose-500 bg-rose-50/30 dark:bg-rose-950/30'
                          : 'border-slate-150 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-black text-xs text-slate-800 dark:text-white flex items-center justify-between">
                      <span>المحددة فقط</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
                        {selectedIds.size}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-1">المركبات التي تم وضع علامة عليها</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPdfExportScope('all')}
                    className={`p-3 rounded-xl border-2 text-right transition-all cursor-pointer ${
                      pdfExportScope === 'all'
                        ? 'border-rose-500 bg-rose-50/30 dark:bg-rose-950/30'
                        : 'border-slate-150 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-black text-xs text-slate-800 dark:text-white flex items-center justify-between">
                      <span>كافة المخزون</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
                        {cars.length}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-1">جميع مركبات النظام دون استثناء</span>
                  </button>
                </div>
              </div>

              {/* PDF Settings Grid: Font Size & Orientation & Row Height */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                
                {/* Font Size & Data Scaling */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-150 dark:border-slate-800 space-y-2.5">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                    تنسيق حجم الخط والبيانات:
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPdfFontSizePreset('auto')}
                      className={`px-2.5 py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                        pdfFontSizePreset === 'auto'
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      تلقائي ذكي
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfFontSizePreset('small')}
                      className={`px-2.5 py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                        pdfFontSizePreset === 'small'
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      صغير (6.5pt)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfFontSizePreset('medium')}
                      className={`px-2.5 py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                        pdfFontSizePreset === 'medium'
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      متوسط (8.0pt)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfFontSizePreset('large')}
                      className={`px-2.5 py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                        pdfFontSizePreset === 'large'
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      كبير (9.5pt)
                    </button>
                  </div>
                  
                  {/* Custom font size option */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setPdfFontSizePreset('custom')}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black border transition-all cursor-pointer ${
                        pdfFontSizePreset === 'custom'
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      حجم مخصص
                    </button>
                    {pdfFontSizePreset === 'custom' && (
                      <div className="flex items-center gap-1.5 flex-1">
                        <input
                          type="number"
                          step="0.5"
                          min="5"
                          max="16"
                          value={pdfCustomFontSize}
                          onChange={(e) => setPdfCustomFontSize(Number(e.target.value) || 8)}
                          className="w-20 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-center"
                        />
                        <span className="text-[11px] text-slate-400 font-bold">نقطة (pt)</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Page Orientation & Row Height */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-150 dark:border-slate-800 space-y-3">
                  <div>
                    <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1.5">
                      اتجاه صفحة التقرير:
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPdfOrientation('landscape')}
                        className={`px-2.5 py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                          pdfOrientation === 'landscape'
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        أفقي (Landscape) - موصى به
                      </button>
                      <button
                        type="button"
                        onClick={() => setPdfOrientation('portrait')}
                        className={`px-2.5 py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                          pdfOrientation === 'portrait'
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        طولي (Portrait)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1">
                      ارتفاع صفوف الجدول في PDF:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="30"
                        max="120"
                        value={pdfRowHeightPx}
                        onChange={(e) => setPdfRowHeightPx(Math.max(30, Math.min(150, Number(e.target.value) || 60)))}
                        className="w-20 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-center"
                      />
                      <span className="text-[11px] text-slate-500 font-bold">بكسل (الموحد: 60px)</span>
                      <button
                        type="button"
                        onClick={() => setPdfRowHeightPx(60)}
                        className="text-[10px] px-2 py-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded font-bold hover:bg-slate-300 border-0 cursor-pointer mr-auto"
                      >
                        إعادة للارتفاع 60px
                      </button>
                    </div>
                  </div>
                </div>

              </div>

            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-150 dark:border-slate-800">
              <button
                type="button"
                disabled={isExportingPDF}
                onClick={() => setShowPdfModal(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40"
              >
                إلغاء
              </button>

              <button
                type="button"
                disabled={isExportingPDF}
                onClick={executePDFExport}
                className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl flex items-center gap-2 border-0 cursor-pointer transition-colors shadow-md disabled:opacity-50"
              >
                {isExportingPDF ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>جاري تحضير وتوليد ملف PDF...</span>
                  </>
                ) : (
                  <>
                    <FileText size={16} />
                    <span>تأكيد وتحميل التقرير (PDF)</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {(isDeleteConfirmOpen || isClearAllConfirmOpen) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300 overflow-y-auto overscroll-contain">
           <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl sm:rounded-[2.5rem] p-6 sm:p-10 border border-slate-100 dark:border-slate-800 shadow-2xl space-y-6 sm:space-y-8 animate-in zoom-in-95 duration-300 my-auto">
              <div className="flex flex-col items-center text-center space-y-3 sm:space-y-4">
                 <div className="w-16 h-16 sm:w-24 sm:h-24 bg-rose-50 dark:bg-rose-500/10 rounded-full flex items-center justify-center">
                    <ShieldAlert className="text-rose-600 w-8 h-8 sm:w-12 sm:h-12" />
                  </div>
                  <div className="space-y-2">
                     <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">تأكـيد الحذف النهائي</h3>
                     <p className="text-slate-500 dark:text-slate-400 font-bold text-xs sm:text-sm leading-relaxed">
                        {isClearAllConfirmOpen 
                         ? `أنت على وشك حذف جميع المركبات في المخزون الحالي (${filteredCars.length} مركبة). هذا الإجراء لا يمكن التراجع عنه.`
                         : itemToDeleteId 
                           ? `هل أنت متأكد من حذف هذه المركبة نهائياً من النظام؟`
                           : `هل أنت متأكد من حذف (${selectedIds.size}) مركبات محددة نهائياً من النظام؟`
                        }
                     </p>
                  </div>
              </div>

              <form onSubmit={isClearAllConfirmOpen ? handleConfirmClearAll : handleConfirmBulkDelete} className="space-y-5 sm:space-y-6">
                 <div className="space-y-2.5 sm:space-y-3 text-right">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2 sm:mr-4">يُرجى إدخال كلمة مرور المستخدم (حسابك الشخصي) للتأكيد</label>
                    <div className="relative">
                       <Lock className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                       <input 
                         type="password" 
                         autoFocus
                         className={`w-full pr-12 sm:pr-16 pl-4 sm:pl-6 py-3.5 sm:py-5 bg-slate-50 dark:bg-slate-950 border-2 rounded-xl sm:rounded-[1.5rem] outline-none transition-all font-black text-base sm:text-lg dark:text-white ${deleteError ? 'border-rose-500 ring-4 ring-rose-100 dark:ring-rose-900/20' : 'border-slate-100 dark:border-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/20'}`}
                         value={confirmPassword}
                         onChange={e => { setConfirmPassword(e.target.value); setDeleteError(''); }}
                         placeholder="كلمة مرور حسابك الشخصي"
                       />
                    </div>
                    {isClearAllConfirmOpen && cars.length > filteredCars.length && (
                       <div className="flex items-start gap-3 bg-rose-500/10 p-3 sm:p-4 rounded-xl sm:rounded-[1.25rem] border border-rose-500/20 text-right mt-3">
                          <input 
                            type="checkbox" 
                            id="includeOutboundInClearAll"
                            className="w-4 h-4 accent-rose-600 rounded cursor-pointer mt-1 font-sans shrink-0"
                            checked={includeOutboundInClearAll}
                            onChange={e => setIncludeOutboundInClearAll(e.target.checked)}
                          />
                          <div className="space-y-0.5">
                            <label htmlFor="includeOutboundInClearAll" className="text-xs font-black text-rose-700 dark:text-rose-400 cursor-pointer select-none block">
                               تصفير وحذف الأرشيف المالي والسيارات المباعة أيضاً
                            </label>
                            <span className="block text-[10px] text-slate-400 leading-normal font-bold">
                               يتضمن هذا حذف {cars.length - filteredCars.length} سيارة مباعة ومؤرشفة حالياً لتحقيق تصفير كامل وشامل للنظام.
                            </span>
                          </div>
                       </div>
                     )}
                    {deleteError && (
                      <div className="flex items-center gap-2 text-rose-500 px-2 sm:px-4">
                         <AlertCircle size={14} />
                         <span className="text-[10px] font-black">{deleteError}</span>
                      </div>
                    )}
                 </div>

                 <div className="flex gap-3 sm:gap-4">
                    <button 
                      type="submit"
                      className="flex-1 py-3.5 sm:py-5 bg-rose-600 text-white font-black rounded-xl sm:rounded-2xl shadow-xl shadow-rose-200 dark:shadow-none hover:bg-rose-700 transition-all text-xs sm:text-sm"
                    >
                       تأكيد الحذف النهائي
                    </button>
                    <button 
                      type="button"
                      onClick={() => { setIsDeleteConfirmOpen(false); setIsClearAllConfirmOpen(false); }}
                      className="flex-1 py-3.5 sm:py-5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-all text-xs sm:text-sm"
                    >
                       إلغاء
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {showColumnSettings && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-2 sm:p-4 md:p-6 animate-in fade-in overflow-y-auto overscroll-contain" dir="rtl">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] border border-slate-100 dark:border-slate-800 text-right my-auto">
            <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
                  <Settings2 size={22} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white">
                    تخصيص وترتيب أعمدة جدول المخزون
                  </h3>
                  <p className="text-[11px] text-slate-400 font-bold">
                    الأعمدة النشطة: <span className="text-blue-600 font-black">{columns.filter(c => c.visible).length}</span> من أصل <span className="text-slate-600 dark:text-slate-300 font-black">{columns.length}</span> عموداً
                  </p>
                </div>
              </div>
              <button onClick={() => setShowColumnSettings(false)} className="p-2 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"><X size={20} /></button>
            </div>

            <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
              <div className="relative flex-1">
                <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="بحث في أسماء الأعمدة..."
                  value={columnSearchTerm}
                  onChange={(e) => setColumnSearchTerm(e.target.value)}
                  className="w-full pr-9 pl-3 py-2 text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 text-slate-800 dark:text-white"
                />
                {columnSearchTerm && (
                  <button 
                    type="button"
                    onClick={() => setColumnSearchTerm('')} 
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button 
                  type="button"
                  onClick={() => setColumns(prev => prev.map(c => ({...c, visible: true})))} 
                  className="px-2.5 py-1.5 bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700 rounded-lg font-black text-[11px] hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all cursor-pointer"
                >
                  إظهار الكل
                </button>
                <button 
                  type="button"
                  onClick={() => setColumns(prev => prev.map(c => ({...c, visible: false})))} 
                  className="px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg font-black text-[11px] hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
                >
                  إخفاء الكل
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    try {
                      clearTableLayout('inventory', currentUser?.id || currentUser?.username);
                      setColumns(getInventoryColumns());
                    } catch(e) {}
                  }} 
                  className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30 rounded-lg font-black text-[11px] hover:bg-rose-100 transition-all cursor-pointer"
                  title="إعادة الترتيب والحالة إلى الوضع الافتراضي الأصلي"
                >
                  إعادة ضبط
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-2 custom-scrollbar grow max-h-[50vh]">
              {columns.filter(col => !columnSearchTerm || col.label.toLowerCase().includes(columnSearchTerm.toLowerCase())).length === 0 ? (
                <div className="text-center py-8 text-slate-400 font-bold text-xs">
                  لا توجد أعمدة تطابق كلمة البحث "{columnSearchTerm}"
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
                  {columns.map((col, index) => {
                    if (columnSearchTerm && !col.label.toLowerCase().includes(columnSearchTerm.toLowerCase())) {
                      return null;
                    }
                    return (
                      <div
                        key={col.key}
                        className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border transition-all ${
                          col.visible 
                            ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40 text-blue-700 dark:text-blue-300' 
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setColumns(prev => prev.map(c => c.key === col.key ? { ...c, visible: !c.visible } : c));
                          }}
                          className="flex-1 flex items-center gap-2.5 text-right font-bold text-xs select-none cursor-pointer"
                        >
                          <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                            col.visible ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 dark:border-slate-700'
                          }`}>
                            {col.visible && <CheckCircle2 size={12} strokeWidth={4} />}
                          </div>
                          <span className="truncate">{col.label}</span>
                        </button>
                        
                        <div className="flex items-center gap-1 border-r border-slate-200 dark:border-slate-800 pr-2 select-none font-mono text-[10px] shrink-0 font-extrabold">
                          <button
                            type="button"
                            disabled={index === 0}
                            title="تحريك للأعلى"
                            onClick={() => {
                              setColumns(prev => {
                                const next = [...prev];
                                if (index > 0) {
                                  const temp = next[index];
                                  next[index] = next[index - 1];
                                  next[index - 1] = temp;
                                }
                                return next;
                              });
                            }}
                            className="p-1 px-2 hover:bg-slate-150 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg disabled:opacity-30 transition-all font-sans font-black cursor-pointer"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            disabled={index === columns.length - 1}
                            title="تحريك للأسفل"
                            onClick={() => {
                              setColumns(prev => {
                                const next = [...prev];
                                if (index < next.length - 1) {
                                  const temp = next[index];
                                  next[index] = next[index + 1];
                                  next[index + 1] = temp;
                                }
                                return next;
                              });
                            }}
                            className="p-1 px-2 hover:bg-slate-150 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg disabled:opacity-30 transition-all font-sans font-black cursor-pointer"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 sm:p-6 border-t border-slate-100 dark:border-slate-800 flex gap-3 bg-slate-50 dark:bg-slate-950/50">
              <button 
                onClick={() => {
                  try {
                    saveTableLayout('inventory', {
                      columns: columns.map(({ key, label, visible }) => ({ key, label, visible })),
                      viewMode,
                      filters: { startDate, endDate }
                    }, currentUser?.id || currentUser?.username);
                  } catch (e) {}
                  setShowColumnSettings(false);
                }} 
                className="flex-1 py-2.5 sm:py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs sm:text-sm shadow-md text-center transition-colors cursor-pointer"
              >
                حفظ الإعدادات وتطبيقها
              </button>
            </div>
          </div>
        </div>
      )}

      {isImportWizardOpen && (
        <CarImportWizard
          existingCars={cars}
          currentUser={currentUser}
          onImportComplete={handleImportWizardComplete}
          onClose={() => setIsImportWizardOpen(false)}
        />
      )}

      {isWithdrawalModalOpen && (
        <WithdrawalLetterModal 
          settings={settings}
          car={selectedWithdrawalCar}
          onClose={() => {
            setIsWithdrawalModalOpen(false);
            setSelectedWithdrawalCar(undefined);
          }}
          cars={cars}
          onSave={handleSaveWithdrawal}
        />
      )}

      {isCheckpointModalOpen && (
        <CheckpointLetterModal 
          settings={settings}
          cars={cars}
          car={selectedCheckpointCar}
          selectedVehicles={selectedCheckpointCars}
          onClose={() => {
            setIsCheckpointModalOpen(false);
            setSelectedCheckpointCar(undefined);
            setSelectedCheckpointCars(undefined);
          }}
          onSave={handleSaveCheckpointLetter}
        />
      )}

      {isCarrierModalOpen && (
        <CarrierLetterModal 
          settings={settings}
          cars={cars}
          car={selectedCarrierCar}
          selectedVehicles={selectedCarrierCars}
          companies={companies}
          onClose={() => {
            setIsCarrierModalOpen(false);
            setSelectedCarrierCar(undefined);
            setSelectedCarrierCars(undefined);
          }}
          onSave={handleSaveCarrierLetter}
        />
      )}

      {isPriceQuoteModalOpen && selectedPriceQuoteCar && (
        <PriceQuotationModal 
          settings={settings}
          car={selectedPriceQuoteCar}
          currentUser={currentUser}
          users={users}
          delegates={delegates}
          onClose={() => {
            setIsPriceQuoteModalOpen(false);
            setSelectedPriceQuoteCar(null);
          }}
          onPrintAndArchive={handleSavePriceQuote}
        />
      )}

      {isBulkEditModalOpen && (
        <CarBulkEditModal 
          selectedIds={selectedIds}
          cars={cars}
          currentUser={currentUser}
          onClose={() => setIsBulkEditModalOpen(false)}
          onSave={handleBulkEditSave}
        />
      )}

      {isBulkExitModalOpen && (
        <BulkExitPermitModal 
          selectedCars={cars.filter(c => selectedIds.has(c.id))}
          users={users}
          delegates={delegates}
          currentUser={currentUser}
          onClose={() => setIsBulkExitModalOpen(false)}
          onPrint={handlePrintBulkExitPermits}
        />
      )}

      {isArrivalModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in overflow-y-auto overscroll-contain" dir="rtl">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-4 sm:space-y-6 max-h-[92vh] sm:max-h-[90vh] my-auto overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0">
                  <CheckCircle2 size={22} className="sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">اعتماد وصول وإدخال للمخزون</h3>
                  <p className="text-[11px] sm:text-xs font-bold text-slate-500">تأكيد الاستلام الفعلي بالمعرض وتعيين تاريخ الدخول</p>
                </div>
              </div>
              <button 
                onClick={() => setIsArrivalModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-3 sm:p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl sm:rounded-2xl border border-emerald-100 dark:border-emerald-900/30 text-xs text-emerald-800 dark:text-emerald-300 font-extrabold leading-relaxed">
              سيتم نقل (<span className="text-emerald-600 font-black">{carsToReceive.length}</span>) مركبة من قسم الشحن والواردات إلى المخزون الفعلي بالمعرض واحتسابها في جرد المعرض والتقارير المالية بدءاً من تاريخ الدخول المحدد.
            </div>

            {/* List preview of cars */}
            <div className="max-h-36 overflow-y-auto space-y-2 p-2 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800">
              {carsToReceive.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-xs p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 font-bold">
                  <span className="text-slate-900 dark:text-white truncate max-w-[200px]">{c.brand} {c.model} ({c.year})</span>
                  <span className="font-mono text-[11px] text-slate-500 shrink-0">{c.vin}</span>
                </div>
              ))}
            </div>

            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                  <Calendar size={14} className="text-emerald-500" />
                  <span>تاريخ الوصول والدخول الفعلي للمعرض <span className="text-rose-500">*</span></span>
                </label>
                <input 
                  type="date"
                  value={arrivalDate}
                  onChange={(e) => setArrivalDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl sm:rounded-2xl px-4 py-3 text-xs font-black text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-2">
                  اسم السائق / الناقل عند الاستلام (اختياري):
                </label>
                <input 
                  type="text"
                  value={arrivalDriver}
                  onChange={(e) => setArrivalDriver(e.target.value)}
                  placeholder="مثال: محمد العمري - سطحة / نقليات..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl sm:rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-2">
                  ملاحظات أو حالة الاستلام (اختياري):
                </label>
                <input 
                  type="text"
                  value={arrivalNotes}
                  onChange={(e) => setArrivalNotes(e.target.value)}
                  placeholder="ملاحظات حول الفحص الظاهري أو المستندات..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl sm:rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button 
                type="button"
                onClick={() => setIsArrivalModalOpen(false)}
                className="flex-1 py-3 sm:py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl sm:rounded-2xl font-black text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                إلغاء
              </button>
              <button 
                type="button"
                onClick={handleConfirmArrival}
                className="flex-1 py-3 sm:py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl sm:rounded-2xl font-black text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 size={16} />
                <span>تأكيد اعتماد الدخول والمخزون</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {editingNotesCar && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in overflow-y-auto overscroll-contain" dir="rtl">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl sm:rounded-[2.5rem] p-6 sm:p-10 border border-slate-100 dark:border-slate-800 shadow-2xl space-y-4 sm:space-y-6 text-right my-auto max-h-[92vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <ClipboardList className="text-blue-600 w-5 h-5 sm:w-6 sm:h-6" />
                تعديل مندوب الحجز
              </h3>
              <button 
                onClick={() => setEditingNotesCar(null)} 
                className="p-1 px-2.5 bg-slate-100 dark:bg-slate-800 dark:text-slate-200 hover:bg-rose-50 hover:text-rose-500 rounded-lg text-slate-400 transition-all font-bold"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <p className="text-xs font-black text-slate-400 mb-1">السيارة الحالية:</p>
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800 font-bold text-xs text-slate-700 dark:text-slate-300 truncate">
                  {editingNotesCar.brand} {editingNotesCar.model} / {editingNotesCar.vin}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">مندوب الحجز المسؤول</label>
                <select 
                  autoFocus
                  className="w-full p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl sm:rounded-2xl outline-none focus:border-blue-500 focus:bg-white font-bold text-xs sm:text-sm text-right dark:text-white select-none cursor-pointer"
                  value={quickNoteValue}
                  onChange={(e) => setQuickNoteValue(e.target.value)}
                >
                  {quickDelegateOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 sm:gap-4">
              <button 
                onClick={() => {
                  if (editingNotesCar) {
                    onUpdate({
                      ...editingNotesCar,
                      notes: quickNoteValue,
                      reservedByUserId: editingNotesCar.status === CarStatus.RESERVED || String(editingNotesCar.status) === 'محجوز' || String(editingNotesCar.status) === 'محجوزة' ? quickNoteValue : editingNotesCar.reservedByUserId,
                      exitData: {
                        ...(editingNotesCar.exitData || {
                          receiverName: '',
                          receiverPhone: '',
                          receiverId: '',
                          nationality: '',
                          deliveryType: DeliveryType.OWNER,
                          exitDate: new Date().toISOString().split('T')[0],
                          notes: ''
                        }),
                        carCondition: quickNoteValue
                      }
                    });
                  }
                  setEditingNotesCar(null);
                }}
                className="flex-1 py-3 sm:py-4 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 shadow-md transition-all text-xs sm:text-sm cursor-pointer"
              >
                تحديث وحفظ
              </button>
              <button 
                onClick={() => setEditingNotesCar(null)}
                className="flex-1 py-3 sm:py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-all text-xs sm:text-sm cursor-pointer"
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

interface CarBulkEditModalProps {
  selectedIds: Set<string>;
  cars: Car[];
  currentUser: User | null;
  onClose: () => void;
  onSave: (fieldsToChange: Partial<Car>, changedFieldsLabels: string[]) => void;
}

const CarBulkEditModal: React.FC<CarBulkEditModalProps> = ({ selectedIds, cars, currentUser, onClose, onSave }) => {
  const [enabledFields, setEnabledFields] = useState<Record<string, boolean>>({
    brand: false,
    model: false,
    year: false,
    color: false,
    vin: false,
    vinMatching: false,
    cardNumber: false,
    price: false,
    costPrice: false,
    supplier: false,
    ownershipType: false,
    status: false,
    rentalStatus: false,
    entryDate: false,
    isOutbound: false,
    hasPlate: false,
    notes: false,
    carRemark: false,
    isPresentInShowroom: false,
    seller: false,
  });

  const [formValues, setFormValues] = useState({
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    color: '',
    vin: '',
    vinMatching: '',
    cardNumber: '',
    price: 0,
    costPrice: 0,
    supplier: '',
    ownershipType: OwnershipType.DIRECT as OwnershipType | string,
    status: CarStatus.AVAILABLE,
    rentalStatus: RentalStatus.NOT_RENTED,
    entryDate: new Date().toISOString().split('T')[0],
    isOutbound: false,
    hasPlate: false,
    notes: '',
    carRemark: '',
    isPresentInShowroom: true,
    seller: '',
  });

  const [showConfirm, setShowConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'ids' | 'pricing' | 'status' | 'notes'>('basic');

  const toggleField = (field: string) => {
    setEnabledFields(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const selectedCars = cars.filter(c => selectedIds.has(c.id));

  const fieldLabels: Record<string, string> = {
    brand: 'اسم المركبة / الشركة',
    model: 'الطراز',
    year: 'سنة الصنع',
    color: 'اللون الخارجي',
    vin: 'رقم الهيكل VIN',
    vinMatching: 'مطابقة رقم الهيكل',
    cardNumber: 'رقم البطاقة الجمركية',
    price: 'سعر البيع',
    costPrice: 'سعر التكلفة / الشراء',
    supplier: 'المورد',
    ownershipType: 'نوع الملكية',
    status: 'حالة المركبة',
    rentalStatus: 'حالة التجير',
    entryDate: 'تاريخ دخول المستودع',
    isOutbound: 'حالة البيع (مبيعات / مخزون)',
    hasPlate: 'هل يوجد لوحات',
    notes: 'مندوب الحجز / الملاحظات الأخيرة',
    carRemark: 'ملاحظات إضافية على السيارة',
    isPresentInShowroom: 'الموقع داخل المعرض',
    seller: 'البائع / المندوب',
  };

  const getChangedFields = () => {
    const changes: Partial<Car> = {};
    const labels: string[] = [];

    Object.keys(enabledFields).forEach(field => {
      if (enabledFields[field]) {
        if (field === 'year' || field === 'price' || field === 'costPrice') {
          // @ts-ignore
          changes[field] = Number(formValues[field]) || 0;
        } else {
          // @ts-ignore
          changes[field] = formValues[field];
        }
        labels.push(fieldLabels[field]);
      }
    });

    return { changes, labels };
  };

  const { changes, labels } = getChangedFields();

  const handleApply = () => {
    if (labels.length === 0) {
      alert("يرجى اختيار وتفعيل حقل واحد على الأقل لتعديله جماعياً.");
      return;
    }
    onSave(changes, labels);
  };

  const renderField = (field: string, inputElement: React.ReactNode) => {
    const isEnabled = enabledFields[field];
    return (
      <div className={`flex items-start gap-4 p-4 rounded-3xl border transition-all duration-200 ${
        isEnabled 
          ? 'bg-amber-500/10 dark:bg-amber-500/5 border-amber-500/30 ring-1 ring-amber-500/20' 
          : 'bg-slate-50/50 dark:bg-slate-950/20 border-slate-150 dark:border-slate-850'
      }`}>
        <input 
          type="checkbox" 
          id={`chk-${field}`}
          checked={isEnabled} 
          onChange={() => toggleField(field)}
          className="w-5 h-5 accent-amber-500 cursor-pointer rounded mt-1 shadow-sm"
        />
        <div className="flex-1 space-y-1">
          <label htmlFor={`chk-${field}`} className="text-xs font-black text-slate-700 dark:text-slate-300 cursor-pointer flex justify-between items-center">
            <span>{fieldLabels[field]}</span>
            <span className={`text-[10px] font-bold ${isEnabled ? 'text-amber-500 animate-pulse' : 'text-slate-400'}`}>
              {isEnabled ? 'سيتم التعديل' : 'معطل'}
            </span>
          </label>
          <div className="pt-1 select-none">
            {inputElement}
          </div>
        </div>
      </div>
    );
  };

  const tabs = [
    { id: 'basic', label: 'الأساسية' },
    { id: 'ids', label: 'المعرّفات والمورد' },
    { id: 'pricing', label: 'التسعير والملكية' },
    { id: 'status', label: 'الحالة والموقع' },
    { id: 'notes', label: 'الباعة والملاحظات' },
  ] as const;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-sm animate-in fade-in overflow-y-auto overscroll-contain" dir="rtl">
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-2xl sm:rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[90vh] my-auto overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950 rounded-t-2xl sm:rounded-t-[2.5rem]">
          <div>
            <h3 className="text-lg sm:text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2 sm:gap-3">
              <Layers className="text-amber-500 w-5 h-5 sm:w-6 sm:h-6" />
              التعديل الجماعي الذكي والشامل للمركبات
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] sm:text-xs mt-1">
              أنت على وشك تعديل حقول محددة لعدد <strong className="text-amber-600 dark:text-amber-400 font-extrabold">{selectedCars.length}</strong> مركبة دفعة واحدة.
            </p>
          </div>
          <button onClick={onClose} className="p-2 sm:p-3 text-slate-400 hover:text-rose-500 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={22} />
          </button>
        </div>

        {/* Content */}
        {!showConfirm ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 grid grid-cols-1 lg:grid-cols-5 gap-6 sm:gap-8">
            {/* Left form - 3 cols */}
            <div className="lg:col-span-3 space-y-4 sm:space-y-6 flex flex-col">
              {/* Category tabs */}
              <div className="flex flex-wrap gap-2 pb-2 border-b border-slate-100 dark:border-slate-850">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${
                      activeTab === tab.id 
                        ? 'bg-amber-500 text-white shadow-md' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-750'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Form fields depending on active tab */}
              <div className="space-y-4 flex-1">
                {activeTab === 'basic' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-205">
                    {renderField('brand', (
                      <input 
                        type="text" 
                        disabled={!enabledFields.brand}
                        value={formValues.brand}
                        onChange={(e) => setFormValues(prev => ({ ...prev, brand: e.target.value }))}
                        placeholder="أدخل اسم الشركة المصنعة (مثال: تويوتا)"
                        className="w-full text-xs font-bold p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-none bg-white dark:bg-slate-900 dark:text-white disabled:opacity-40 disabled:bg-slate-100 dark:disabled:bg-slate-950"
                      />
                    ))}

                    {renderField('model', (
                      <input 
                        type="text" 
                        disabled={!enabledFields.model}
                        value={formValues.model}
                        onChange={(e) => setFormValues(prev => ({ ...prev, model: e.target.value }))}
                        placeholder="أدخل طراز السيارة (مثال: كامري)"
                        className="w-full text-xs font-bold p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-none bg-white dark:bg-slate-900 dark:text-white disabled:opacity-40 disabled:bg-slate-100 dark:disabled:bg-slate-950"
                      />
                    ))}

                    {renderField('year', (
                      <input 
                        type="number" 
                        disabled={!enabledFields.year}
                        value={formValues.year}
                        onChange={(e) => setFormValues(prev => ({ ...prev, year: parseInt(e.target.value, 10) || new Date().getFullYear() }))}
                        placeholder="سنة الصنع مثل 2026"
                        className="w-full text-xs font-bold p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-none bg-white dark:bg-slate-900 dark:text-white disabled:opacity-40 disabled:bg-slate-100 dark:disabled:bg-slate-950"
                      />
                    ))}

                    {renderField('color', (
                      <input 
                        type="text" 
                        disabled={!enabledFields.color}
                        value={formValues.color}
                        onChange={(e) => setFormValues(prev => ({ ...prev, color: e.target.value }))}
                        placeholder="أدخل لون الهيكل الخارجي"
                        className="w-full text-xs font-bold p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-none bg-white dark:bg-slate-900 dark:text-white disabled:opacity-40 disabled:bg-slate-100 dark:disabled:bg-slate-950"
                      />
                    ))}
                  </div>
                )}

                {activeTab === 'ids' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-205">
                    <div className="bg-amber-500/10 text-amber-705 dark:text-amber-400 p-4 rounded-2xl text-[11px] leading-relaxed font-bold border border-amber-550/10 mb-2">
                      💡 ملاحظة: عند تفعيل تعديل رقم الهيكل أو رقم البطاقة للتعديل الجماعي، سيطلب النظام تطبيقه على جميع السيارات المحددة بنفس المدخلات. يرجى الحذر وتدقيق البيانات لعدم تكرار المعرّفات الفريدة.
                    </div>

                    {renderField('vin', (
                      <input 
                        type="text" 
                        disabled={!enabledFields.vin}
                        value={formValues.vin}
                        onChange={(e) => setFormValues(prev => ({ ...prev, vin: e.target.value }))}
                        placeholder="أدخل رقم الهيكل VIN الموحد الجديد"
                        className="w-full text-xs font-bold p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-none bg-white dark:bg-slate-900 dark:text-white disabled:opacity-40 disabled:bg-slate-100 dark:disabled:bg-slate-950 font-mono"
                        dir="ltr"
                      />
                    ))}

                    {renderField('vinMatching', (
                      <select 
                        disabled={!enabledFields.vinMatching}
                        value={formValues.vinMatching || 'متطابق'}
                        onChange={(e) => setFormValues(prev => ({ ...prev, vinMatching: e.target.value }))}
                        className="w-full text-xs font-bold p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-none bg-white dark:bg-slate-900 dark:text-white disabled:opacity-40 disabled:bg-slate-100 dark:disabled:bg-slate-950"
                      >
                        <option value="متطابق">متطابق</option>
                        <option value="غير متطابق">غير متطابق</option>
                      </select>
                    ))}

                    {renderField('cardNumber', (
                      <input 
                        type="text" 
                        disabled={!enabledFields.cardNumber}
                        value={formValues.cardNumber}
                        onChange={(e) => setFormValues(prev => ({ ...prev, cardNumber: e.target.value }))}
                        placeholder="رقم بطاقة الاستيراد أو البيان الجمركي"
                        className="w-full text-xs font-bold p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-none bg-white dark:bg-slate-900 dark:text-white disabled:opacity-40 disabled:bg-slate-100 dark:disabled:bg-slate-950 font-mono"
                        dir="ltr"
                      />
                    ))}

                    {renderField('supplier', (
                      <input 
                        type="text" 
                        disabled={!enabledFields.supplier}
                        value={formValues.supplier}
                        onChange={(e) => setFormValues(prev => ({ ...prev, supplier: e.target.value }))}
                        placeholder="مورد أو وكيل الاستيراد الخاص بالسيارة"
                        className="w-full text-xs font-bold p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-none bg-white dark:bg-slate-900 dark:text-white disabled:opacity-40 disabled:bg-slate-100 dark:disabled:bg-slate-950"
                      />
                    ))}
                  </div>
                )}

                {activeTab === 'pricing' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-205">
                    {renderField('costPrice', (
                      <input 
                        type="number" 
                        disabled={!enabledFields.costPrice}
                        value={formValues.costPrice || ''}
                        onChange={(e) => setFormValues(prev => ({ ...prev, costPrice: parseFloat(e.target.value) || 0 }))}
                        placeholder="أدخل قيمة تكلفة شراء الدفعة (مثال: 85000)"
                        className="w-full text-xs font-bold p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-none bg-white dark:bg-slate-900 dark:text-white disabled:opacity-40 disabled:bg-slate-100 dark:disabled:bg-slate-950"
                      />
                    ))}

                    {renderField('price', (
                      <input 
                        type="number" 
                        disabled={!enabledFields.price}
                        value={formValues.price || ''}
                        onChange={(e) => setFormValues(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                        placeholder="أدخل قيمة سعر بيع الدفعة المطلوب (مثال: 95000)"
                        className="w-full text-xs font-bold p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-none bg-white dark:bg-slate-900 dark:text-white disabled:opacity-40 disabled:bg-slate-100 dark:disabled:bg-slate-950"
                      />
                    ))}

                    {renderField('ownershipType', (
                      <div className="space-y-3 w-full">
                        <select 
                          disabled={!enabledFields.ownershipType}
                          value={
                            formValues.ownershipType === 'مباشر' || formValues.ownershipType === 'تصريف'
                              ? formValues.ownershipType
                              : 'custom'
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'custom') {
                              setFormValues(prev => ({ ...prev, ownershipType: '' }));
                            } else {
                              setFormValues(prev => ({ ...prev, ownershipType: val }));
                            }
                          }}
                          className="w-full text-xs font-bold p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-none bg-white dark:bg-slate-900 dark:text-white disabled:opacity-40 disabled:bg-slate-100 dark:disabled:bg-slate-950"
                        >
                          <option value="مباشر">مباشر</option>
                          <option value="تصريف">تصريف</option>
                          <option value="custom">جهة أخرى (كتابة يدوية...)</option>
                        </select>
                        {enabledFields.ownershipType && (formValues.ownershipType !== 'مباشر' && formValues.ownershipType !== 'تصريف') && (
                          <div className="space-y-1 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-205 dark:border-slate-800 animate-in slide-in-from-top-1 duration-200">
                            <label className="text-[10px] font-black text-amber-500 block mb-1">اسم المالك / الجهة الأخرى</label>
                            <input 
                              type="text"
                              value={formValues.ownershipType}
                              onChange={(e) => setFormValues(prev => ({ ...prev, ownershipType: e.target.value }))}
                              placeholder="اكتب اسم المالك أو اسم جهة التصريف الأخرى..."
                              className="w-full text-xs font-bold p-3 border border-slate-200 dark:border-slate-800 rounded-lg outline-none bg-white dark:bg-slate-900 dark:text-white"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'status' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-205">
                    {renderField('status', (
                      <select 
                        disabled={!enabledFields.status}
                        value={formValues.status}
                        onChange={(e) => setFormValues(prev => ({ ...prev, status: e.target.value as CarStatus }))}
                        className="w-full text-xs font-bold p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-none bg-white dark:bg-slate-900 dark:text-white disabled:opacity-40 disabled:bg-slate-100 dark:disabled:bg-slate-950"
                      >
                        {Object.values(CarStatus).map(val => (
                          <option key={val} value={val}>{val}</option>
                        ))}
                      </select>
                    ))}

                    {renderField('rentalStatus', (
                      <select 
                        disabled={!enabledFields.rentalStatus}
                        value={formValues.rentalStatus}
                        onChange={(e) => setFormValues(prev => ({ ...prev, rentalStatus: e.target.value as RentalStatus }))}
                        className="w-full text-xs font-bold p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-none bg-white dark:bg-slate-900 dark:text-white disabled:opacity-40 disabled:bg-slate-100 dark:disabled:bg-slate-950"
                      >
                        {Object.values(RentalStatus).map(val => (
                          <option key={val} value={val}>{val}</option>
                        ))}
                      </select>
                    ))}

                    {renderField('isPresentInShowroom', (
                      <select 
                        disabled={!enabledFields.isPresentInShowroom}
                        value={formValues.isPresentInShowroom ? 'true' : 'false'}
                        onChange={(e) => setFormValues(prev => ({ ...prev, isPresentInShowroom: e.target.value === 'true' }))}
                        className="w-full text-xs font-bold p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-none bg-white dark:bg-slate-900 dark:text-white disabled:opacity-40 disabled:bg-slate-100 dark:disabled:bg-slate-950"
                      >
                        <option value="true">متواجدة داخل غرف المعرض والمستودع</option>
                        <option value="false">خارج المعرض / لم تصل المعرض بعد</option>
                      </select>
                    ))}

                    {renderField('entryDate', (
                      <input 
                        type="date" 
                        disabled={!enabledFields.entryDate}
                        value={formValues.entryDate}
                        onChange={(e) => setFormValues(prev => ({ ...prev, entryDate: e.target.value }))}
                        className="w-full text-xs font-bold p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-none bg-white dark:bg-slate-900 dark:text-white disabled:opacity-40 disabled:bg-slate-100 dark:disabled:bg-slate-950"
                      />
                    ))}

                    {renderField('isOutbound', (
                      <select 
                        disabled={!enabledFields.isOutbound}
                        value={formValues.isOutbound ? 'true' : 'false'}
                        onChange={(e) => setFormValues(prev => ({ ...prev, isOutbound: e.target.value === 'true' }))}
                        className="w-full text-xs font-bold p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-none bg-white dark:bg-slate-900 dark:text-white disabled:opacity-40 disabled:bg-slate-100 dark:disabled:bg-slate-950"
                      >
                        <option value="false">بالمخزون (متاحة ولم تُبع بعد)</option>
                        <option value="true">منقولة لقسم المبيعات (مباعة من المخزن)</option>
                      </select>
                    ))}

                    {renderField('hasPlate', (
                      <select 
                        disabled={!enabledFields.hasPlate}
                        value={formValues.hasPlate ? 'true' : 'false'}
                        onChange={(e) => setFormValues(prev => ({ ...prev, hasPlate: e.target.value === 'true' }))}
                        className="w-full text-xs font-bold p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-none bg-white dark:bg-slate-900 dark:text-white disabled:opacity-40 disabled:bg-slate-100 dark:disabled:bg-slate-950"
                      >
                        <option value="false">لا (بدون لوحات)</option>
                        <option value="true">نعم (لوحات مسجلة)</option>
                      </select>
                    ))}
                  </div>
                )}

                {activeTab === 'notes' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-205">
                    {renderField('seller', (
                      <input 
                        type="text" 
                        disabled={!enabledFields.seller}
                        value={formValues.seller}
                        onChange={(e) => setFormValues(prev => ({ ...prev, seller: e.target.value }))}
                        placeholder="أدخل اسم البائع أو المندوب المعتمد"
                        className="w-full text-xs font-bold p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-none bg-white dark:bg-slate-900 dark:text-white disabled:opacity-40 disabled:bg-slate-100 dark:disabled:bg-slate-950"
                      />
                    ))}

                    {renderField('notes', (
                      <input 
                        type="text" 
                        disabled={!enabledFields.notes}
                        value={formValues.notes}
                        onChange={(e) => setFormValues(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="أدخل ملاحظات الحجز والمسؤول (مثل: محجوز للمندوب...)"
                        className="w-full text-xs font-bold p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-none bg-white dark:bg-slate-900 dark:text-white disabled:opacity-40 disabled:bg-slate-100 dark:disabled:bg-slate-950"
                      />
                    ))}

                    {renderField('carRemark', (
                      <textarea 
                        disabled={!enabledFields.carRemark}
                        value={formValues.carRemark}
                        onChange={(e) => setFormValues(prev => ({ ...prev, carRemark: e.target.value }))}
                        placeholder="أدخل أي ملاحظات تقييمية أو جردية حول حالة المركبة وهيكلها..."
                        className="w-full text-xs font-bold p-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-none bg-white dark:bg-slate-900 dark:text-white disabled:opacity-40 disabled:bg-slate-100 dark:disabled:bg-slate-950 h-24 text-right resize-none"
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right side - 2 cols - changes preview */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-850 space-y-6 shadow-md h-full flex flex-col justify-between">
                <div>
                  <h4 className="font-black text-sm text-amber-400 flex items-center gap-2 border-b border-slate-800 pb-3">
                    <CheckSquare size={18} />
                    معاينة بنود التغيير الجماعي لـ ({selectedCars.length}) سيارات
                  </h4>

                  {labels.length === 0 ? (
                    <div className="text-center py-12 space-y-3">
                      <Layers className="mx-auto text-slate-500 animate-pulse" size={40} />
                      <p className="text-[11px] text-slate-400 leading-relaxed font-bold">
                        يرجى تحديد حقل أو أكثر من التبويبات الجانبية مع وضع علامة (✓) لتفعيل الحقل وعرض المعاينة قبل التطبيق الفعلي.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4 pt-4">
                      <span className="text-[10px] text-slate-400 font-bold block">سيتم الكتابة فوق الحقول التالية لجميع البيانات المحددة:</span>
                      <div className="space-y-3 max-h-[35vh] overflow-y-auto pr-1">
                        {labels.map((lbl, idx) => {
                          let displayVal = '';
                          if (lbl === fieldLabels.brand) displayVal = formValues.brand || '(فارغ)';
                          else if (lbl === fieldLabels.model) displayVal = formValues.model || '(فارغ)';
                          else if (lbl === fieldLabels.year) displayVal = formValues.year.toString();
                          else if (lbl === fieldLabels.color) displayVal = formValues.color || '(فارغ)';
                          else if (lbl === fieldLabels.vin) displayVal = formValues.vin || '(فارغ)';
                          else if (lbl === fieldLabels.vinMatching) displayVal = formValues.vinMatching || '(فارغ)';
                          else if (lbl === fieldLabels.cardNumber) displayVal = formValues.cardNumber || '(فارغ)';
                          else if (lbl === fieldLabels.price) displayVal = (Number(formValues.price) || 0).toLocaleString() + ' ر.س';
                          else if (lbl === fieldLabels.costPrice) displayVal = (Number(formValues.costPrice) || 0).toLocaleString() + ' ر.س';
                          else if (lbl === fieldLabels.supplier) displayVal = formValues.supplier || '(فارغ)';
                          else if (lbl === fieldLabels.ownershipType) displayVal = formValues.ownershipType;
                          else if (lbl === fieldLabels.status) displayVal = formValues.status;
                          else if (lbl === fieldLabels.rentalStatus) displayVal = formValues.rentalStatus;
                          else if (lbl === fieldLabels.entryDate) displayVal = formValues.entryDate;
                          else if (lbl === fieldLabels.isOutbound) displayVal = formValues.isOutbound ? 'منقول لقسم المبيعات' : 'بالمخزون';
                          else if (lbl === fieldLabels.hasPlate) displayVal = formValues.hasPlate ? 'نعم (لوحات مسجلة)' : 'لا (بدون لوحات)';
                          else if (lbl === fieldLabels.notes) displayVal = formValues.notes || '(فارغ)';
                          else if (lbl === fieldLabels.carRemark) displayVal = formValues.carRemark || '(فارغ)';
                          else if (lbl === fieldLabels.isPresentInShowroom) displayVal = formValues.isPresentInShowroom ? 'داخل المعرض' : 'خارج المعرض';
                          else if (lbl === fieldLabels.seller) displayVal = formValues.seller || '(فارغ)';

                          return (
                            <div key={idx} className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs flex justify-between items-center gap-2 animate-in fade-in zoom-in-95">
                              <span className="text-slate-400 font-bold">{lbl}:</span>
                              <span className="text-white font-black truncate max-w-[150px]" title={displayVal}>{displayVal}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1 bg-slate-950/40 p-4 rounded-xl border border-slate-800 text-[10px] leading-relaxed text-slate-400 font-bold mt-4">
                  <span className="text-xs text-amber-500 font-black block mb-1">البيانات التي سيتم الحفاظ عليها دون تغيير 🛡️:</span>
                  <p className="text-[10px] text-slate-400 font-medium">
                    أي حقل لم تقم بتحديده ووضع علامة الصح (✓) بجانبه لن يتأثر نهائياً وسيحافظ على قيمته الفردية لكل مركبة دون أي تغيير.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Confirmation dialog screen */
          <div className="p-10 flex-1 flex flex-col justify-center items-center text-center space-y-6 max-h-[80vh] overflow-y-auto">
            <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center animate-bounce">
              <ShieldAlert size={36} />
            </div>
            
            <div className="space-y-2">
              <h4 className="text-2xl font-black text-slate-850 dark:text-white">تأكيد نهائي لعملية التعديل الجماعي</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg leading-relaxed">
                يرجى قراءة التقرير التالي بدقة من أجل سلامة ومطابقة البيانات قبل الحفظ. هذه العملية ستقوم بتعديل الحقول المختارة لـ (<strong className="text-amber-500 font-bold">{selectedCars.length}</strong>) سيارة بالكامل دفعة واحدة.
              </p>
            </div>

            {/* Preview facts summary */}
            <div className="w-full max-w-xl bg-slate-50 dark:bg-slate-950 p-6 rounded-3xl border border-slate-100 dark:border-slate-850 text-right space-y-4">
              <div className="flex justify-between items-center text-xs pb-3 border-b border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 font-bold">المستخدم المنفذ:</span>
                <span className="text-slate-850 dark:text-white font-black">{currentUser?.username || 'نظام (أدمن)'}</span>
              </div>
              <div className="flex justify-between items-center text-xs pb-3 border-b border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 font-bold">وقت وتاريخ التنفيذ:</span>
                <span className="text-slate-850 dark:text-white font-black">{new Date().toLocaleString('ar-EG')}</span>
              </div>
              <div className="flex justify-between items-center text-xs pb-3 border-b border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 font-bold">عدد المركبات المتأثرة:</span>
                <span className="text-amber-605 dark:text-amber-405 font-black">{selectedCars.length} مركبة</span>
              </div>
              <div className="space-y-1.5 pt-1">
                <span className="text-xs text-slate-400 font-black block">الحقول التي شملها التعديل الجماعي فقط:</span>
                <div className="flex flex-wrap gap-2 text-right">
                  {labels.map((lbl, i) => (
                    <span key={i} className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-full font-black border border-amber-500/20">{lbl}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 sm:p-6 md:p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-b-2xl sm:rounded-b-[2.5rem] flex flex-col sm:flex-row gap-3 sm:gap-4 justify-between items-center">
          {!showConfirm ? (
            <>
              <button 
                onClick={onClose} 
                className="w-full sm:w-auto px-5 sm:px-6 py-3 sm:py-3.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black rounded-xl sm:rounded-2xl text-xs hover:bg-slate-300 dark:hover:bg-slate-700 transition-all font-sans text-center"
              >
                تراجع وإلغاء
              </button>
              <button 
                onClick={() => {
                  if (labels.length === 0) {
                    alert("يرجى تحديد حقل واحد على الأقل لتعديله.");
                    return;
                  }
                  setShowConfirm(true);
                }} 
                className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl sm:rounded-2xl text-xs shadow-lg transition-colors flex items-center justify-center gap-2 font-sans"
              >
                <Layers size={16} />
                <span>عرض معاينة التغييرات والتأكيد</span>
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => setShowConfirm(false)} 
                className="w-full sm:w-auto px-5 sm:px-6 py-3 sm:py-3.5 bg-slate-250 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black rounded-xl sm:rounded-2xl text-xs hover:bg-slate-300 dark:hover:bg-slate-700 transition-all font-sans text-center"
              >
                العودة للتعديل
              </button>
              <button 
                onClick={handleApply} 
                className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl sm:rounded-2xl text-xs shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer font-sans"
              >
                <CheckCircle2 size={16} />
                <span>نعم، تطبيق هذه التعديلات الجماعية الآن</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CarManager;
