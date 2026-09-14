
import React, { useState, useMemo } from 'react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { 
  Plus, Search, Trash2, X, AlertCircle,
  Car as CarIcon, DollarSign, RefreshCcw, 
  Layers, LogIn, IdCard, ArrowDownLeft,
  User as UserIcon, Tag, Briefcase, 
  Zap, Hash, Calendar, Palette,
  Printer, 
  Building2,
  FileSpreadsheet,
  Settings2,
  CheckCircle2,
  Truck,
  Edit3,
  FileText,
  CreditCard,
  UserCheck,
  ShieldCheck,
  Check
} from 'lucide-react';
import { Car, CarStatus, User, OrganizationSettings, Permission, DeliveryType, UserRole, RentalStatus, OwnershipType, getNormalizedSaleTypeAndBank, formatVehicleDisplay } from '../types';
import { ExcelService } from '../services/excelService';
import { getCleanDelegateName, getCleanModelKey } from './CarManager';
import { ROLE_PERMISSIONS } from '../constants';
import { isCarMatchingQuery, getUnifiedSearchResults } from '../src/utils/searchEngine';
import CarFormModal from './CarFormModal';
import { getCleanBrandName, sortCarsUnderBrand } from './Reports';
import { lookupCustomerById } from '../services/customerLookupService';
import { getLogoDataUri, getStampDataUri } from './OfficialAssets';
import { PriceQuotationModal } from './PriceQuotationModal';
import { getBilingualPrintHeaderHtml, getBilingualPrintHeaderCss } from '../src/utils/printHeaderHelper';

interface SalesManagerProps {
  cars: Car[];
  onUpdate: (car: Car) => void;
  onDelete: (id: string) => void;
  currentUser: User | null;
  settings: OrganizationSettings;
  onArchiveLetter?: (letter: any) => void;
  users: User[];
  salesType?: 'stock' | 'transfer' | 'all';
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

const safeFormatNumber = (num: any): string => {
  if (num === null || num === undefined || isNaN(Number(num))) return '0';
  return Number(num).toLocaleString();
};

class TempErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("TempErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-slate-900 text-right font-sans min-h-screen text-slate-100 flex flex-col justify-center items-center">
          <div className="max-w-2xl w-full p-8 bg-slate-950/80 border border-rose-500/30 rounded-3xl shadow-2xl">
            <h2 className="text-2xl font-black text-rose-500 mb-4">⚠️ حدث خطأ أثناء تشغيل شاشة المبيعات</h2>
            <p className="text-sm text-slate-300 mb-6 font-medium leading-relaxed font-sans">
              لقد تسبب خطأ برمجياً في توقف الصفحة. هذا الخطأ مؤقت ويجري تتبعه عبر نظام الفحص المتكامل للتطبيق.
            </p>
            <div className="p-5 bg-black/60 rounded-2xl border border-slate-800 text-left font-mono text-xs overflow-auto max-h-72 text-rose-400 mb-6 custom-scrollbar select-text leading-relaxed">
              <strong>Error:</strong> {this.state.error?.message || String(this.state.error)}
              {this.state.error?.stack && (
                <div className="mt-3 text-slate-400 border-t border-slate-900/40 pt-3 whitespace-pre-wrap font-mono">
                  {this.state.error.stack}
                </div>
              )}
            </div>
            <button 
              onClick={() => window.location.reload()} 
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm transition-all shadow-lg flex items-center gap-2 mx-auto justify-center font-sans"
            >
              <span>إعادة تشغيل النظام</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const SalesManager: React.FC<SalesManagerProps> = ({ cars, onUpdate, onDelete, currentUser, settings, onArchiveLetter, users, salesType = 'all', addLog }) => {
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
  const [searchTerm, setSearchTerm] = useState(() => {
    try {
      const saved = localStorage.getItem('sales_manager_search_term');
      return saved || '';
    } catch {
      return '';
    }
  });

  // Debounce state to optimize search performance, avoid lag during typing
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 180);
    return () => clearTimeout(handler);
  }, [searchTerm]);
  const [startDate, setStartDate] = useState(() => {
    try {
      const saved = localStorage.getItem('sales_manager_start_date');
      return saved || '';
    } catch {
      return '';
    }
  });
  const [endDate, setEndDate] = useState(() => {
    try {
      const saved = localStorage.getItem('sales_manager_end_date');
      return saved || '';
    } catch {
      return '';
    }
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCar, setEditingCar] = useState<Car | null>(null);
  const [isPriceQuoteModalOpen, setIsPriceQuoteModalOpen] = useState(false);
  const [selectedPriceQuoteCar, setSelectedPriceQuoteCar] = useState<Car | null>(null);
  const [activeExitPermitCarId, setActiveExitPermitCarId] = useState<string | null>(null);
  const [cardFilter, setCardFilter] = useState<'reserved' | 'pending' | null>(null);

  const [activeSalesSubTab, setActiveSalesSubTab] = useState<'all' | 'stock' | 'transfer'>(() => {
    try {
      const saved = localStorage.getItem('sales_manager_active_tab');
      if (saved === 'all' || saved === 'stock' || saved === 'transfer') {
        return saved;
      }
    } catch {}
    return salesType;
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('sales_manager_search_term', searchTerm);
    } catch {}
  }, [searchTerm]);

  React.useEffect(() => {
    try {
      localStorage.setItem('sales_manager_start_date', startDate);
    } catch {}
  }, [startDate]);

  React.useEffect(() => {
    try {
      localStorage.setItem('sales_manager_end_date', endDate);
    } catch {}
  }, [endDate]);

  React.useEffect(() => {
    try {
      localStorage.setItem('sales_manager_active_tab', activeSalesSubTab);
    } catch {}
  }, [activeSalesSubTab]);

  React.useEffect(() => {
    if (salesType) {
      setActiveSalesSubTab(salesType);
    }
  }, [salesType]);

  const isTransferSale = (car: Car) => {
    if (!car) return false;
    const notes = (car.exitData?.notes || '') + ' ' + (car.notes || '') + ' ' + (car.carRemark || '');
    const saleType = car.exitData?.saleType || (car as any).saleType || car.exitType || '';
    const deliveryType = car.exitData?.deliveryType || '';
    const statusStr = String(car.status || '');
    
    const isStatusTransfer = 
      car.status === CarStatus.IN_TRANSFER || 
      statusStr === 'تحويل' || 
      statusStr === 'في التحويل' || 
      statusStr === 'قيد التحويل' ||
      statusStr === 'محولة' ||
      statusStr === 'محول';

    return (
      isStatusTransfer ||
      !!car.transferNo ||
      !!car.transferReceiver ||
      notes.includes('تحويل') || notes.includes('التحويل') ||
      saleType === 'تحويل' || saleType.includes('تحويل') ||
      deliveryType.includes('تحويل')
    );
  };

  const forStatsCars = useMemo(() => {
    return cars.filter(car => {
      const isTransfer = isTransferSale(car);
      
      if (activeSalesSubTab === 'transfer') {
        return isTransfer;
      }
      
      if (activeSalesSubTab === 'stock') {
        const isOut = car.isOutbound || car.status === CarStatus.SOLD || String(car.status) === 'مباعة' || String(car.status) === 'مباع';
        return isOut && !isTransfer;
      }
      
      // activeSalesSubTab === 'all'
      const isOut = car.isOutbound || car.status === CarStatus.SOLD || car.status === CarStatus.IN_TRANSFER || isTransfer;
      return isOut;
    });
  }, [cars, activeSalesSubTab]);

  // Today and Month strings
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const currentMonthPrefix = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const stats = useMemo(() => {
    // 1. Daily sales
    const salesToday = forStatsCars.filter(car => car.isOutbound && car.exitData?.exitDate === todayStr);
    const numSalesToday = salesToday.length;
    const totalSalesToday = salesToday.reduce((sum, car) => sum + (Number(car.price) || 0), 0);
    const dailyProfit = salesToday.reduce((sum, car) => sum + (Number(car.price) || 0) - (Number(car.costPrice) || 0), 0);

    // 2. Monthly sales
    const salesThisMonth = forStatsCars.filter(car => {
      if (!car.isOutbound) return false;
      const exitDateStr = car.exitData?.exitDate;
      return exitDateStr && exitDateStr.startsWith(currentMonthPrefix);
    });
    const numSalesThisMonth = salesThisMonth.length;
    const totalSalesThisMonth = salesThisMonth.reduce((sum, car) => sum + (Number(car.price) || 0), 0);
    const monthlyProfit = salesThisMonth.reduce((sum, car) => sum + (Number(car.price) || 0) - (Number(car.costPrice) || 0), 0);

    // 3. Total sold
    const totalSoldCars = forStatsCars.filter(car => car.isOutbound || car.status === CarStatus.SOLD || String(car.status) === 'مباعة' || String(car.status) === 'مباع').length;

    // 4. Total profit
    const totalProfit = forStatsCars.filter(car => car.isOutbound).reduce((sum, car) => sum + (Number(car.price) || 0) - (Number(car.costPrice) || 0), 0);

    // 5. Reserved cars
    const reservedCars = forStatsCars.filter(car => car.status === CarStatus.RESERVED || String(car.status) === 'محجوزة' || String(car.status) === 'محجوز');
    const reservedCarsCount = reservedCars.length;

    // 6. Pending delivery
    const pendingDeliveryCars = forStatsCars.filter(car => (car.status === CarStatus.SOLD || String(car.status) === 'مباعة' || String(car.status) === 'مباع') && car.isPresentInShowroom !== false);
    const pendingDeliveryCount = pendingDeliveryCars.length;

    return {
      numSalesToday,
      totalSalesToday,
      dailyProfit,
      numSalesThisMonth,
      totalSalesThisMonth,
      monthlyProfit,
      totalSoldCars,
      totalProfit,
      reservedCarsCount,
      pendingDeliveryCount
    };
  }, [forStatsCars, todayStr, currentMonthPrefix]);
  
  const isAdmin = !currentUser || currentUser?.role === UserRole.ADMIN || String(currentUser?.role).toUpperCase() === 'ADMIN';
  const hasPermission = (perm: Permission) => 
    currentUser?.permissions?.includes(perm) || 
    (isAdmin ? ROLE_PERMISSIONS[UserRole.ADMIN].includes(perm) : 
     (currentUser?.role === UserRole.EMPLOYEE || String(currentUser?.role).toUpperCase() === 'EMPLOYEE' ? ROLE_PERMISSIONS[UserRole.EMPLOYEE].includes(perm) : 
      (currentUser?.role === UserRole.DELEGATE || String(currentUser?.role).toUpperCase() === 'DELEGATE' ? ROLE_PERMISSIONS[UserRole.DELEGATE].includes(perm) : false)));
  const canViewFinancials = hasPermission(Permission.VIEW_FINANCIALS);
  const canExport = hasPermission(Permission.EXPORT_DATA);
  const canManageInventory = hasPermission(Permission.MANAGE_INVENTORY);

  const handlePrintEntryPermit = async (car: Car) => {
    const { generateQrCodeDataUrl: genQR, getEmbeddedQrHtml: getQRHtml } = await import('../src/utils/qrHelper');
    const qrResult = await genQR({
      documentType: 'إذن استلام مخزني (دخول)',
      serialNumber: car.vin || 'ENT-AUTO',
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
            @page { size: A4 portrait; margin: 10mm; }
            html, body { margin: 0; padding: 0; background: #fff; }
            body { 
              font-family: 'Cairo', sans-serif; 
              direction: rtl; 
              color: #000; 
              line-height: 1.4; 
              background: #fff; 
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
            th { background-color: #fff; font-size: 9pt; height: 28px; }
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
              body { -webkit-print-color-adjust: exact; }
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
            </div>

            <div class="date-row">
               التاريخ: ${formattedEntryDate}
            </div>

            <table>
              <colgroup>
                <col style="width: 45px; min-width: 45px; max-width: 45px;" class="col-counter" />
                <col style="width: 25%;" />
                <col style="width: 25%;" />
                <col style="width: 17%;" />
                <col style="width: 16%;" />
                <col style="width: 17%;" />
              </colgroup>
              <thead>
                <tr>
                  <th style="width: 45px; min-width: 45px; max-width: 45px;" class="col-counter">الرقم</th>
                  <th style="width: 25%">نوع المركبة</th>
                  <th style="width: 25%">رقم الشاسية</th>
                  <th style="width: 17%">اللون / الموديل</th>
                  <th style="width: 16%">المورد</th>
                  <th style="width: 17%">شركة الشحن</th>
                </tr>
              </thead>
              <tbody>
                <tr class="data-row">
                  <td>1</td>
                  <td>${formatVehicleDisplay(car)}</td>
                  <td style="font-family: monospace;">${car.vin}</td>
                  <td>${car.color} / ${car.year}</td>
                  <td>${car.supplier || ''}</td>
                  <td>${car.customData?.entryTransportCompany || car.exitData?.transportCompany || ''}</td>
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
              <img src="${settings.stampUrl || getStampDataUri(settings.name ? `${settings.orgType || 'مؤسسة'} ${settings.name}` : undefined, settings.commercialRegister, settings.orgType)}" style="max-height: 90px; max-width: 90px; mix-blend-mode: multiply;" />
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

                // A4 Portrait inner height budget inside content margin-bottom
                const maxPageHeight = content ? content.clientHeight : 1020;
                
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
                const availableTableHeight = maxPageHeight - nonTableHeight - 15;
                
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
                    const remTable = maxPageHeight - (header ? header.offsetHeight : 0) - (titleSec ? titleSec.offsetHeight : 0) - (dateRow ? dateRow.offsetHeight : 0) - (footer ? footer.offsetHeight : 0) - qrH - wrapperOverhead - 10;
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
                
                document.getElementById('debug-page-h').innerText = 'Page Height: ' + maxPageHeight + 'px (270mm)';
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
    const exitData: any = car.exitData || { 
      receiverName: '', 
      receiverPhone: '', 
      receiverId: '', 
      nationality: '',
      deliveryType: DeliveryType.OWNER, 
      transportCompany: '',
      exitDate: new Date().toISOString().split('T')[0],
      notes: '' 
    };

    const docTitle = withPlate ? 'إذن خروج وتسليم سيارة ولوحة' : 'إذن خروج وتسليم سيارة';

    const receiverDisplayName = exitData.receiverName || (car as any).customerName || (car as any).clientName || '';

    const { generateQrCodeDataUrl: genQR, getEmbeddedQrHtml: getQRHtml } = await import('../src/utils/qrHelper');
    const qrResult = await genQR({
      documentType: docTitle,
      serialNumber: car.vin || 'EXIT-AUTO',
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
              width: 360px;
            }
            .logo { 
              width: 200px; 
              margin-bottom: 0px;
              position: relative;
              left: -55px;
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
              margin: 0 6px; 
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
              opacity: 0.25; 
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
                  <th style="width: 30%">اللون والموديل</th>
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
        vehicleName: `${car.brand} ${car.model} ${car.year}`,
        driverName: exitData.receiverName || '',
        destination: car.customData?.entryTransportCompany || exitData.transportCompany || '',
        htmlContent: html
      });
    }
  };

  const handlePrintCarrierLetter = (car: Car) => {
    const exitData: any = car.exitData || { 
      receiverName: '', 
      receiverPhone: '', 
      receiverId: '', 
      nationality: '',
      deliveryType: DeliveryType.OWNER, 
      transportCompany: '',
      exitDate: new Date().toISOString().split('T')[0],
      notes: '' 
    };

    const savedSize = localStorage.getItem('letter_stamp_size');
    const stampSize = savedSize ? parseInt(savedSize, 10) : 110;
    const savedX = localStorage.getItem('letter_stamp_x');
    const stampX = savedX ? parseInt(savedX, 10) : 0;
    const savedY = localStorage.getItem('letter_stamp_y');
    const stampY = savedY ? parseInt(savedY, 10) : -15;

    const exitDateObj = exitData.exitDate ? new Date(exitData.exitDate) : new Date();
    const year = exitDateObj.getFullYear();
    const month = String(exitDateObj.getMonth() + 1).padStart(2, '0');
    const day = String(exitDateObj.getDate()).padStart(2, '0');

    const html = `
      <html dir="rtl">
        <head>
          <title>خطاب شاحن - ${formatVehicleDisplay(car)}</title>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            html, body { height: 100%; margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Cairo', sans-serif; 
              direction: rtl; 
              color: #000; 
              background: #fff; 
              -webkit-print-color-adjust: exact;
              padding: 10px;
            }
            .outer-border {
              border: 3px solid #000;
              padding: 15mm 12mm;
              height: 100%;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              position: relative;
            }
            .header-container {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 40px;
              position: relative;
            }
            .org-details {
              text-align: right;
              font-size: 13pt;
              font-weight: 700;
              line-height: 1.6;
              color: #000;
            }
            .org-details .org-title {
              font-size: 16pt;
              font-weight: 955;
              margin-bottom: 4px;
            }
            .logo-container {
              text-align: left;
              position: relative;
              left: -55px;
            }
            .logo-img {
              max-height: 220px;
              max-width: 360px;
              object-fit: contain;
            }
            .date-section {
              text-align: right;
              font-size: 12pt;
              font-weight: 700;
              margin-bottom: 25px;
              margin-top: 20px;
              padding-right: 40px;
            }
            .salutation {
              font-size: 14pt;
              font-weight: 900;
              margin-bottom: 25px;
              padding-right: 40px;
            }
            .salutation-suffix {
              margin-right: 50px;
              font-weight: 900;
            }
            .peace-greeting {
              font-size: 13pt;
              font-weight: 900;
              margin-bottom: 45px;
              padding-right: 40px;
              word-spacing: 2px;
            }
            .car-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 40px;
              direction: rtl;
            }
            .car-table th {
              border: 2px solid #000;
              background-color: #fff !important;
              -webkit-print-color-adjust: exact;
              color: #000;
              padding: 12px 10px;
              font-size: 13pt;
              font-weight: 900;
              text-align: center;
            }
            .car-table td {
              border: 2px solid #000;
              padding: 14px 10px;
              font-size: 12pt;
              font-weight: 700;
              text-align: center;
              background-color: #fff;
            }
            .delivery-clause {
              font-size: 13pt;
              font-weight: 900;
              margin-bottom: 55px;
              padding-right: 40px;
            }
            .thanks-clause {
              text-align: center;
              font-size: 13pt;
              font-weight: 900;
              margin-bottom: 70px;
            }
            .footer-sign {
              display: flex;
              flex-direction: column;
              align-items: flex-start;
              padding-right: 40px;
              margin-top: auto;
              font-size: 13pt;
              font-weight: 900;
            }
            .stamp-img {
              max-height: ${stampSize}px;
              max-width: ${stampSize}px;
              object-fit: contain;
              margin-top: ${stampY}px;
              transform: translateX(${-stampX}px);
              mix-blend-mode: multiply;
            }
            @media print {
              html, body { height: 100%; overflow: hidden; margin: 0; padding: 0; }
              .outer-border { 
                height: 100% !important; 
                width: 100% !important; 
                border: 3px solid #000 !important; 
                padding: 15mm 12mm !important; 
                box-sizing: border-box !important; 
                page-break-inside: avoid; 
              }
            }
            ${getBilingualPrintHeaderCss()}
            ${getLogoStyleOverride()}
          </style>
        </head>
        <body>
          <div class="outer-border">
            ${getBilingualPrintHeaderHtml(settings)}
            
            <div class="date-section">
              التاريخ: &nbsp;&nbsp;&nbsp;&nbsp; ${day} &nbsp;&nbsp; / &nbsp;&nbsp; ${month} &nbsp;&nbsp; / &nbsp;&nbsp; ${year} م
            </div>

            <div class="salutation">
              السادة/ <span style="display:inline-block; border-bottom: 1px dotted #000; min-width: 250px; text-align: center;">${car.customData?.entryTransportCompany || exitData.transportCompany || ''}</span> <span class="salutation-suffix">المحترمين</span>
            </div>

            <div class="peace-greeting">
              السلام عليكم ورحمة الله وبركاته &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; وبعد ،،،
            </div>

            <table class="car-table">
              <thead>
                <tr>
                  <th style="width: 35%">نوع السيارة</th>
                  <th style="width: 25%">اللون والموديل</th>
                  <th style="width: 20%">اللوحات</th>
                  <th style="width: 20%">رقم الهيكل</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${car.brand} ${car.model}</td>
                  <td>${car.color || '—'} / ${car.year || '—'}</td>
                  <td>${(car.plateData?.plateNumber || car.customData?.plateNumber || '').trim() || 'بطاقة جمركية'}</td>
                  <td style="font-family: monospace; font-size: 11.5pt;">${car.vin}</td>
                </tr>
              </tbody>
            </table>

            <div class="delivery-clause">
              وتسليمها إلي / <span style="display:inline-block; border-bottom: 1px dotted #000; min-width: 350px; text-align: center;">${exitData.receiverName || ''}</span>
            </div>

            <div class="thanks-clause">
              ولكم جزيل الشكر والعرفان ،،،
            </div>

            <div class="footer-sign">
              <div>${settings.orgType || 'مؤسسة'} ${settings.name || 'سما الفرسان للتجارة'}</div>
              <img src="${settings.stampUrl || getStampDataUri(settings.name ? `${settings.orgType || 'مؤسسة'} ${settings.name}` : undefined, settings.commercialRegister, settings.orgType)}" class="stamp-img" style="mix-blend-mode: multiply;" alt="ختم ${settings.orgType || 'المؤسسة'}" />
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
        letterType: 'خطاب شاحن الناقل (مندوب الشحن)',
        vin: car.vin || '',
        plateNumber: car.plateData?.plateNumber || car.customData?.plateNumber || '',
        cardNumber: car.cardNumber || '',
        vehicleName: `${car.brand} ${car.model} ${car.year}`,
        driverName: exitData.receiverName || '',
        destination: car.customData?.entryTransportCompany || exitData.transportCompany || '',
        htmlContent: html
      });
    }
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
          <div class="field"><span class="label">حالة المركبة عند الخروج:</span><span class="value">${car.exitData?.carCondition || '-'}</span></div>
        </div>
        ${car.exitData?.notes ? `
          <div style="margin-top: 10px; border-top: 1px dashed #e2e8f0; padding-top: 8px;">
            <span class="label" style="display: block; margin-bottom: 4px;">ملاحظات الخروج والبيع:</span>
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
            <span class="fin-value">${safeFormatNumber(car.costPrice)} ${settings.currencyUsed || 'ر.س'}</span>
          </div>
          <div class="fin-box">
            <span class="fin-label">سعر البيع</span>
            <span class="fin-value">${safeFormatNumber(car.price)} ${settings.currencyUsed || 'ر.س'}</span>
          </div>
          <div class="fin-box">
            <span class="fin-label">صافي الربح المتوقع</span>
            <span class="fin-value fin-profit">${safeFormatNumber(profit)} ${settings.currencyUsed || 'ر.س'}</span>
          </div>
        </div>
      `;
    }

    const html = `
      <html dir="rtl" lang="ar">
        <head>
          <title>بطاقة تسجيل مركبة - ${formatVehicleDisplay(car)}</title>
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
            .logo { max-height: 170px; max-width: 350px; object-fit: contain; position: relative; left: -55px; }
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
              opacity: 0.25; 
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
            <img src="${settings.logoUrl || getLogoDataUri(settings.name, settings.orgType)}" class="watermark" />
            ${getBilingualPrintHeaderHtml(settings)}

            <div class="title-container" style="text-align: center; margin: 6px 0 10px 0;">
              <h1 class="title" style="font-size: 16pt; font-weight: 900; margin: 0;">بطاقة تفاصيل وبيانات المركبة</h1>
            </div>

            <div class="section-title">بيانات المركبة الأساسية</div>
            <div class="grid">
              <div class="field"><span class="label">الماركة:</span><span class="value">${car.brand}</span></div>
              <div class="field"><span class="label">الموديل:</span><span class="value">${car.model}</span></div>
              <div class="field"><span class="label">سنة الصنع:</span><span class="value">${car.year}</span></div>
              <div class="field"><span class="label">اللون:</span><span class="value">${car.color}</span></div>
              <div class="field"><span class="label">رقم الهيكل (VIN):</span><span class="value" style="font-family: monospace; font-size: 10pt; letter-spacing: 0.5px;">${car.vin}</span></div>
              <div class="field"><span class="label">البطاقة الجمركية:</span><span class="value">${car.cardNumber || '-'}</span></div>
              <div class="field"><span class="label">المورد:</span><span class="value">${car.supplier || '-'}</span></div>
              <div class="field"><span class="label">نوع الملكية:</span><span class="value">${car.ownershipType || '-'}</span></div>
              <div class="field"><span class="label">تاريخ الدخول:</span><span class="value">${car.entryDate || '-'}</span></div>
              <div class="field"><span class="label">حالة المخزون الحالية:</span><span class="value" style="color: ${car.status === 'مباعة' ? '#dc2626' : '#16a34a'}">${car.status}</span></div>
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
        vehicleName: `${car.brand} ${car.model} ${car.year}`,
        driverName: car.exitData?.receiverName || '',
        destination: car.supplier || car.customData?.entryTransportCompany || car.exitData?.transportCompany || '',
        htmlContent: html
      });
    }
  };

  const salesCars = useMemo(() => {
    // 1. Determine starting source list based on active card filter
    let sourceList = forStatsCars;
    if (cardFilter === 'reserved') {
      sourceList = forStatsCars.filter(car => car.status === CarStatus.RESERVED || String(car.status) === 'محجوزة' || String(car.status) === 'محجوز');
    } else if (cardFilter === 'pending') {
      sourceList = forStatsCars.filter(car => (car.status === CarStatus.SOLD || String(car.status) === 'مباعة' || String(car.status) === 'مباع') && car.isPresentInShowroom !== false);
    }

    // 2. Get filtered / ranked list using unified search if search term is active
    let candidates = debouncedSearchTerm.trim().length > 0 ? getUnifiedSearchResults(sourceList, debouncedSearchTerm) : sourceList;

    // 3. Filter key properties: subtab match and date range
    let matched = candidates.filter(car => {
      // If we don't have a card filter, enforce subtab constraint
      if (!cardFilter) {
        if (activeSalesSubTab === 'transfer') {
          if (!isTransferSale(car)) return false;
        } else if (activeSalesSubTab === 'stock') {
          const isOutbound = car.isOutbound || car.status === CarStatus.SOLD;
          if (!isOutbound || isTransferSale(car)) return false;
        } else {
          const isOutbound = car.isOutbound || car.status === CarStatus.SOLD || car.status === CarStatus.IN_TRANSFER || isTransferSale(car);
          if (!isOutbound) return false;
        }
      }

      if (startDate || endDate) {
        const exitDateStr = car.exitData?.exitDate || car.transferDate || (car.history && car.history.find(h => h.action.includes('تحويل') || h.action.includes('خروج'))?.timestamp.split('T')[0]);
        if (!exitDateStr) return false;
        
        if (startDate && exitDateStr < startDate) return false;
        if (endDate && exitDateStr > endDate) return false;
      }

      return true;
    });

    // 4. Sorting behavior: if there's no search term, use default branding sort.
    // If there is an active search term, retain the relevance-score sorted order!
    if (debouncedSearchTerm.trim().length > 0) {
      return matched;
    } else {
      return matched.sort(sortCarsUnderBrand);
    }
  }, [forStatsCars, debouncedSearchTerm, startDate, endDate, cardFilter, activeSalesSubTab]);

  const handleReturnToInventory = (car: Car) => {
    const isTransfer = isTransferSale(car);
    const typeLabel = isTransfer ? 'التحويل' : 'البيع';

    if (!car.isOutbound && car.status !== CarStatus.IN_TRANSFER && car.isPresentInShowroom !== false && !isTransfer) {
      alert('المركبة موجودة بالفعل في المخزون الفعلي!');
      return;
    }

    if (window.confirm(`هل أنت متأكد من إلغاء ${typeLabel} وإعادة المركبة (${car.brand} ${car.model} - شاصي: ${car.vin}) إلى المخزون الفعلي بالصالة؟`)) {
      onUpdate({
        ...car,
        status: CarStatus.AVAILABLE,
        isOutbound: false,
        isPresentInShowroom: true, // Return directly to ACTUAL inventory (الصالة / المخزون الفعلي) and NOT external inventory!
        rentalStatus: RentalStatus.NOT_RENTED,
        exitType: undefined,
        transferNo: undefined,
        transferDate: undefined,
        transferSender: undefined,
        transferReceiver: undefined,
        statusNote: undefined,
        seller: undefined,
        exitData: { 
          receiverName: '', 
          receiverPhone: '', 
          receiverId: '', 
          nationality: '', 
          deliveryType: DeliveryType.OWNER, 
          exitDate: new Date().toISOString().split('T')[0], 
          notes: '' 
        },
        lastModified: new Date().toISOString(),
        history: [
          ...(car.history || []),
          { 
            id: `h-${Date.now()}`, 
            action: `إعادة للمخزون الفعلي بالصالة (إلغاء ${typeLabel})`, 
            timestamp: new Date().toISOString(), 
            user: currentUser?.username || 'نظام' 
          }
        ]
      });

      if (addLog) {
        addLog(
          'إعادة للمخزون الفعلي',
          car.id,
          'car',
          `تم إلغاء ${typeLabel} للمركبة (${car.brand} ${car.model} - شاصي ${car.vin}) وإعادتها للمخزون الفعلي بالصالة`
        );
      }
    }
  };

  const handleExcelExport = async () => {
    const direction = localStorage.getItem('excel_export_direction') || 'RTL';
    const isRTL = direction === 'RTL';

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('المبيعات', {
      views: [{ rightToLeft: isRTL }]
    });

    worksheet.columns = [
      { header: 'نوع المركبة', key: 'brandModel', width: 32 },
      { header: 'رقم الهيكل', key: 'vin', width: 25 },
      { header: 'اللون والموديل', key: 'colorModel', width: 20 },
      { header: 'المورد', key: 'supplier', width: 15 },
      { header: 'رقم اللوحة', key: 'plateNumber', width: 15 },
      { header: 'العميل', key: 'receiverName', width: 20 },
      { header: 'المالك', key: 'ownerName', width: 20 },
      { header: 'هوية العميل', key: 'receiverId', width: 15 },
      { header: 'نوع المستلم', key: 'deliveryType', width: 15 },
      { header: 'البائع / المندوب', key: 'seller', width: 25 },
      { header: 'حالة المركبة', key: 'status', width: 15 },
      { header: 'المبلغ', key: 'price', width: 15 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
      cell.font = { color: { argb: 'FF000000' }, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center', readingOrder: isRTL ? 'rtl' : 'ltr' };
    });

    // Sort sales cars by brand and grade before export
    const sortedCars = [...salesCars].sort(sortCarsUnderBrand);

    const totalColumns = worksheet.columns.length;
    let lastBrand = '';
    sortedCars.forEach((car, idx) => {
      const cleanBrand = getCleanBrandName(car.brand);
      if (cleanBrand !== lastBrand) {
        lastBrand = cleanBrand;
        const brandRowIndex = worksheet.rowCount + 1;
        worksheet.mergeCells(brandRowIndex, 1, brandRowIndex, totalColumns);
        const brandRow = worksheet.getRow(brandRowIndex);
        brandRow.height = 32;
        const brandCell = brandRow.getCell(1);
        brandCell.value = `🚘 ${cleanBrand} 🚘`;
        brandCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FF1E3A8A' } };
        brandCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        brandCell.alignment = { vertical: 'middle', horizontal: 'center', readingOrder: isRTL ? 'rtl' : 'ltr' };
        
        for (let col = 1; col <= totalColumns; col++) {
          const cell = brandRow.getCell(col);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center', readingOrder: isRTL ? 'rtl' : 'ltr' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } }
          };
        }
      }

      const row = worksheet.addRow({
        brandModel: formatVehicleDisplay(car),
        vin: car.vin,
        colorModel: `${car.color} | ${car.year}`,
        supplier: car.supplier || '-',
        plateNumber: car.plateData?.plateNumber || '-',
        receiverName: car.exitData?.receiverName || '-',
        ownerName: car.plateData?.ownerName || car.ownershipType,
        receiverId: car.exitData?.receiverId || '-',
        deliveryType: car.exitData?.deliveryType || '-',
        seller: car.exitData?.seller || car.exitData?.representativeName || car.seller || (car.notes ? getCleanDelegateName(car.notes) : '') || '-',
        status: car.status,
        price: car.price,
      });

      row.height = 24;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.alignment = { 
          vertical: 'middle', 
          horizontal: colNumber === 1 ? 'center' : (isRTL ? 'right' : 'left'),
          readingOrder: isRTL ? 'rtl' : 'ltr'
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        };
      });

      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
      });
    });

    // Auto-Fit Columns (حساب العرض تلقائياً للأعمدة بشكل ذكي مع استثناء الخلايا المدمجة)
    worksheet.columns.forEach((column: any) => {
      let maxColumnLength = 0;
      if (column.header) {
        maxColumnLength = Math.max(maxColumnLength, String(column.header).length);
      }
      column.eachCell!({ includeEmpty: true }, (cell: any) => {
        const isMerged = cell.isMerged || (cell.master && cell.master.address !== cell.address);
        if (isMerged) return;
        if (cell.value !== null && cell.value !== undefined) {
          const valStr = cell.value instanceof Date ? cell.value.toLocaleDateString('ar-EG') : String(cell.value);
          const len = valStr.trim().length;
          if (len > maxColumnLength) maxColumnLength = len;
        }
      });
      const isIndexColumn = column.key === 'index' || (column.header && String(column.header) === 'م');
      let minWidth = isIndexColumn ? 6 : 10;
      let maxWidth = 45;
      let calculatedWidth = Math.ceil(maxColumnLength * 1.15) + 3;
      column.width = Math.min(maxWidth, Math.max(minWidth, calculatedWidth));
    });

    workbook.worksheets.forEach(ws => {
      ExcelService.formatWorksheet(ws, { isRTL: true });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `تقرير_المبيعات_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-32 text-right relative flex flex-col" dir="rtl">
      {/* تبديل القسم: مبيعات المخزون vs مبيعات التحويل */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-955 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800/60 print:hidden shadow-inner">
        <div className="flex flex-col text-start">
          <h2 className="text-lg font-black text-slate-800 dark:text-white">
            {activeSalesSubTab === 'stock' ? 'مبيعات المخزون' : activeSalesSubTab === 'transfer' ? 'مبيعات التحويل' : 'السجل الكلي للصادرات والمبيعات'}
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-1">
            {activeSalesSubTab === 'stock' ? 'عرض المركبات المباعة والمنصرفة كشريحة نهائية خارج المستودع.' : activeSalesSubTab === 'transfer' ? 'عرض المركبات المنقولة والمحولة بين الفروع والمعارض بموجب خطابات التحويل.' : 'عرض تفصيلي لجميع الحركات الصادرة والتحويلات الخارجية والمبيعات بقاعدة البيانات.'}
          </p>
        </div>
        <div className="flex bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm min-w-[320px]">
          <button 
            onClick={() => setActiveSalesSubTab('all')}
            className={`flex-1 px-4 py-2.5 text-xs font-black rounded-xl transition-all outline-none cursor-pointer ${
              activeSalesSubTab === 'all' 
                ? 'bg-slate-950 text-white dark:bg-slate-800' 
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            الكل
          </button>
          <button 
            onClick={() => setActiveSalesSubTab('stock')}
            className={`flex-1 px-4 py-2.5 text-xs font-black rounded-xl transition-all outline-none cursor-pointer ${
              activeSalesSubTab === 'stock' 
                ? 'bg-blue-600 text-white' 
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            مبيعات المخزون
          </button>
          <button 
            onClick={() => setActiveSalesSubTab('transfer')}
            className={`flex-1 px-4 py-2.5 text-xs font-black rounded-xl transition-all outline-none cursor-pointer ${
              activeSalesSubTab === 'transfer' 
                ? 'bg-indigo-600 text-white' 
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            مبيعات التحويل
          </button>
        </div>
      </div>

      {/* لوحة المبيعات الرئيسية */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 print:hidden">
        {/* البطاقة 1: مبيعات اليوم */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-5 shadow-sm hover:shadow-md transition-all duration-305 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black text-slate-400 dark:text-slate-500">إجمالي مبيعات اليوم</span>
            <div className="p-2.5 bg-blue-50 dark:bg-blue-500/10 text-blue-500 rounded-2xl">
              <Calendar size={18} />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-black text-slate-800 dark:text-white leading-none">
              {stats.numSalesToday} <span className="text-xs text-slate-400 dark:text-slate-500 font-bold">عمليات</span>
            </p>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
              القيمة: <span className="font-extrabold text-blue-600 dark:text-blue-400">{safeFormatNumber(stats.totalSalesToday)} {settings.currencyUsed || 'ر.س'}</span>
            </p>
          </div>
        </div>

        {/* البطاقة 2: مبيعات الشهر */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-5 shadow-sm hover:shadow-md transition-all duration-305 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black text-slate-400 dark:text-slate-500">مبيعات الشهر الحالي</span>
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 rounded-2xl">
              <Briefcase size={18} />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-black text-slate-800 dark:text-white leading-none">
              {stats.numSalesThisMonth} <span className="text-xs text-slate-400 dark:text-slate-500 font-bold">عمليات</span>
            </p>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
              القيمة: <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{safeFormatNumber(stats.totalSalesThisMonth)} {settings.currencyUsed || 'ر.س'}</span>
            </p>
          </div>
        </div>

        {/* البطاقة 3: إجمالي السيارات المباعة */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-5 shadow-sm hover:shadow-md transition-all duration-305 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black text-slate-400 dark:text-slate-500">عدد المركبات المباعة</span>
            <div className="p-2.5 bg-rose-50 dark:bg-rose-500/10 text-rose-500 rounded-2xl">
              <CarIcon size={18} />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-black text-slate-800 dark:text-white leading-none">
              {stats.totalSoldCars} <span className="text-xs text-slate-400 dark:text-slate-500 font-bold">سيارة</span>
            </p>
            <p className="text-[10px] font-bold text-slate-400 mt-1">
              المسجلة بالنظام ومكتملة الصرف
            </p>
          </div>
        </div>

        {/* البطاقة 4: الأرباح */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-4.5 shadow-sm hover:shadow-md transition-all duration-305 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black text-slate-400 dark:text-slate-500">الربح المالي الكلي</span>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 rounded-2xl">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="space-y-1 bg-emerald-50/20 dark:bg-emerald-500/5 p-2 rounded-2xl border border-emerald-50/50 dark:border-emerald-500/10">
            <div className="flex justify-between items-center text-[9px] font-bold text-slate-500 dark:text-slate-400">
              <span>اليومية:</span>
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{canViewFinancials ? `${safeFormatNumber(stats.dailyProfit)}` : '****'}</span>
            </div>
            <div className="flex justify-between items-center text-[9px] font-bold text-slate-500 dark:text-slate-400">
              <span>الشهرية:</span>
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{canViewFinancials ? `${safeFormatNumber(stats.monthlyProfit)}` : '****'}</span>
            </div>
            <div className="flex justify-between items-center text-[10px] font-black text-slate-700 dark:text-slate-200 border-t border-emerald-500/10 pt-1 mt-1">
              <span>الإجمالي:</span>
              <span>{canViewFinancials ? `${safeFormatNumber(stats.totalProfit)}` : '****'}</span>
            </div>
          </div>
        </div>

        {/* البطاقة 5: السيارات المحجوزة */}
        <button 
          onClick={() => setCardFilter(cardFilter === 'reserved' ? null : 'reserved')}
          className={`flex flex-col text-right justify-between w-full bg-white dark:bg-slate-900 border rounded-[2rem] p-5 shadow-sm transition-all duration-305 outline-none cursor-pointer ${
            cardFilter === 'reserved' 
              ? 'border-blue-500 dark:border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/10 dark:bg-blue-500/5 shadow-md' 
              : 'border-slate-100 dark:border-slate-800 hover:border-blue-450 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-3">
            <span className="text-xs font-black text-slate-400 dark:text-slate-500">المركبات المحجوزة</span>
            <div className={`p-2.5 rounded-2xl transition-colors ${
              cardFilter === 'reserved' ? 'bg-blue-500 text-white' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-500'
            }`}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="space-y-1 w-full">
            <p className="text-2xl font-black text-slate-800 dark:text-white leading-none">
              {stats.reservedCarsCount} <span className="text-xs text-slate-400 dark:text-slate-500 font-bold">مركبة</span>
            </p>
            <p className="text-[9px] font-bold text-slate-400 mt-1">
              {cardFilter === 'reserved' ? 'نشط: انقر للإلغاء' : 'انقر لتصفية قائمة المعرض'}
            </p>
          </div>
        </button>

        {/* البطاقة 6: السيارات المنتظر تسليمها */}
        <button 
          onClick={() => setCardFilter(cardFilter === 'pending' ? null : 'pending')}
          className={`flex flex-col text-right justify-between w-full bg-white dark:bg-slate-900 border rounded-[2rem] p-5 shadow-sm transition-all duration-305 outline-none cursor-pointer ${
            cardFilter === 'pending' 
              ? 'border-purple-500 dark:border-purple-500 ring-2 ring-purple-500/20 bg-purple-50/10 dark:bg-purple-500/5 shadow-md' 
              : 'border-slate-100 dark:border-slate-800 hover:border-purple-450 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-3">
            <span className="text-xs font-black text-slate-400 dark:text-slate-500">منتظر تسليمها</span>
            <div className={`p-2.5 rounded-2xl transition-colors ${
              cardFilter === 'pending' ? 'bg-purple-500 text-white' : 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-500'
            }`}>
              <Truck size={18} />
            </div>
          </div>
          <div className="space-y-1 w-full">
            <p className="text-2xl font-black text-slate-800 dark:text-white leading-none">
              {stats.pendingDeliveryCount} <span className="text-xs text-slate-400 dark:text-slate-500 font-bold">مركبة</span>
            </p>
            <p className="text-[9px] font-bold text-slate-400 mt-1">
              {cardFilter === 'pending' ? 'نشط: انقر للإلغاء' : 'انقر لتصفية قائمة المعرض'}
            </p>
          </div>
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 p-5 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl flex flex-col items-center gap-5 print:hidden">
        <div className="flex flex-col lg:flex-row items-center justify-between w-full gap-5">
          <div className="relative flex-2 w-full group">
            <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text" 
              placeholder="البحث في المبيعات (الماركة، الموديل، الهيكل)..."
              className="w-full pr-16 pl-6 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-[1.8rem] outline-none focus:border-blue-500 font-bold dark:text-white shadow-inner"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            {canExport && (
              <button onClick={handleExcelExport} className="px-6 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs shadow-lg flex items-center gap-2 hover:bg-emerald-700 transition-colors">
                <FileSpreadsheet size={18} /> 
                <span>تصدير النتائج</span>
              </button>
            )}
            <button onClick={() => window.print()} className="p-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl border border-slate-200 dark:border-slate-700">
               <Printer size={18} />
            </button>
          </div>
        </div>

        <div className="w-full flex flex-wrap items-center gap-4 p-4 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-blue-500" />
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">تصفية حسب الفترة:</span>
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
             {(startDate || endDate || searchTerm || cardFilter) && (
               <button 
                 onClick={() => { setStartDate(''); setEndDate(''); setSearchTerm(''); setCardFilter(null); }}
                 className="px-4 py-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl text-[10px] font-black uppercase transition-colors"
               >
                 مسح التصفية
               </button>
             )}
          </div>
          
          <div className="text-[10px] font-black text-slate-400 bg-white dark:bg-slate-950 px-3 py-2 rounded-lg border border-slate-100 dark:border-slate-800">
             عدد النتائج: <span className="text-blue-500">{salesCars.length}</span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-theme">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-right border-collapse min-w-[1200px]">
            <thead className="bg-slate-950 text-white text-[9px] font-black uppercase tracking-widest">
              <tr>
                <th className="px-4 py-6 text-right">نوع المركبة</th>
                <th className="px-4 py-6 text-center">رقم الهيكل</th>
                <th className="px-4 py-6 text-center">اللون والموديل</th>
                <th className="px-4 py-6 text-center">رقم اللوحة</th>
                <th className="px-4 py-6 text-center">العميل</th>
                <th className="px-4 py-6 text-center">المالك</th>
                <th className="px-4 py-6 text-center">هوية العميل</th>
                <th className="px-4 py-6 text-center">نوع المستلم</th>
                <th className="px-4 py-6 text-center">مندوب الحجز</th>
                <th className="px-4 py-6 text-center text-emerald-400">حالة المركبة</th>
                <th className="px-4 py-6 text-center text-blue-400">المبلغ</th>
                <th className="px-4 py-6 text-center">الملاحظات</th>
                <th className="px-6 py-6 text-center print:hidden">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {(() => {
                let lastBrand = '';
                let lastModel = '';
                let lastAttribution = '';
                return salesCars.map(car => {
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
                        <tr className="bg-slate-50 dark:bg-slate-950/60 border-y-2 border-slate-200/50 dark:border-slate-800/50">
                          <td colSpan={100} className="px-6 py-5 text-center">
                            <span className="text-lg md:text-xl font-black text-blue-600 dark:text-blue-400 tracking-wider uppercase inline-block font-sans">
                              🚘 {cleanBrand} 🚘
                            </span>
                          </td>
                        </tr>
                      )}
                      {showModelHeader && (
                        <tr className="bg-gray-200 dark:bg-gray-700 border-y border-gray-300 dark:border-gray-600 shadow-sm animate-fade-in">
                          <td colSpan={100} className="px-8 py-3.5 text-center">
                            <span className="text-[17px] md:text-[20px] font-black text-black dark:text-white tracking-wider inline-block">
                              {car.model || 'عام'}
                            </span>
                          </td>
                        </tr>
                      )}
                      {showAttributionHeader && (
                        <tr className="bg-sky-50 dark:bg-sky-950/40 border-y border-sky-100 dark:border-sky-900/60 shadow-sm animate-fade-in">
                          <td colSpan={100} className="px-10 py-2.5 text-center">
                            <span className="text-[12px] font-extrabold text-sky-700 dark:text-sky-300 tracking-wide inline-block">
                              📥 الوارد والمصدر: {attributionVal}
                            </span>
                          </td>
                        </tr>
                      )}
                      <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-black text-slate-800 dark:text-white text-sm leading-none">
                              {car.brand} {car.model}
                              {(car.carRemark || car.notes) && ` (${car.carRemark || car.notes})`}
                            </p>
                            {car.attributionSource && (
                              <span className="text-[9px] font-black bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700/60 shadow-none">
                                وارد: {car.attributionSource}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center font-mono font-black text-xs text-slate-600 dark:text-slate-400">{car.vin}</td>
                        <td className="px-4 py-4 text-center text-[10px] font-bold text-slate-500">
                          {car.color} | {car.year}
                        </td>
                        <td className="px-4 py-4 text-center font-black text-blue-600 text-xs">
                          {car.plateData?.plateNumber || '-'}
                        </td>
                        <td className="px-4 py-4 text-center font-bold text-slate-600 dark:text-slate-400 text-xs">{car.exitData?.receiverName || '-'}</td>
                        <td className="px-4 py-4 text-center font-bold text-slate-600 dark:text-slate-400 text-xs">
                          {car.ownershipType}
                        </td>
                        <td className="px-4 py-4 text-center font-mono text-slate-500 text-xs">{car.exitData?.receiverId || '-'}</td>
                        <td className="px-4 py-4 text-center">
                          <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-[9px] font-black">
                            {car.exitData?.deliveryType || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center font-bold text-slate-600 dark:text-slate-400 text-xs">{car.exitData?.seller || car.exitData?.representativeName || '-'}</td>
                        <td className="px-4 py-4 text-center">
                          <span className="px-2 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg text-[9px] font-black">
                            {car.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center font-black text-blue-600 text-base">
                          {canViewFinancials ? safeFormatNumber(car.price) : '****'}
                        </td>
                        <td className="px-4 py-4 text-center text-[10px] text-slate-500 max-w-[150px] truncate">
                          {car.exitData?.notes || car.notes || '-'}
                        </td>
                        <td className="px-6 py-4 text-center print:hidden">
                          <div className="flex justify-center gap-2">
                             {canManageInventory && (
                              <button 
                                onClick={() => { setEditingCar(car); setIsModalOpen(true); }} 
                                className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                title="تعديل بيانات المركبة والبيع بالكامل"
                              >
                                <Edit3 size={18} />
                              </button>
                            )}
                            {canManageInventory && (
                              <button 
                                onClick={() => handleReturnToInventory(car)} 
                                className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-blue-600 hover:text-white transition-all font-black text-xs"
                                title="إعادة للمخزون"
                              >
                                <LogIn size={16} />
                                <span>إرجاع للمخزن</span>
                              </button>
                            )}
                            <button 
                              onClick={() => handlePrintEntryPermit(car)} 
                              className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                              title="طباعة إذن استلام مخزني (دخول)"
                            >
                              <ArrowDownLeft size={18} />
                            </button>
                             <div className="relative inline-block">
                               <button 
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setActiveExitPermitCarId(activeExitPermitCarId === car.id ? null : car.id);
                                 }} 
                                 className={`p-3 rounded-xl transition-all ${
                                   activeExitPermitCarId === car.id 
                                     ? "text-emerald-600 bg-emerald-50 dark:bg-slate-800" 
                                     : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                                 }`}
                                 title="طباعة إذن خروج وتسليم"
                               >
                                 <IdCard size={18} />
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
                                       className="w-full text-right px-4 py-2.5 text-xs font-black text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
                                     >
                                       <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                       إذن خروج وتسليم سيارة ولوحة
                                     </button>
                                   </div>
                                 </>
                               )}
                             </div>
                            <button 
                              onClick={() => handlePrintPriceQuote(car)} 
                              className="p-3 text-emerald-600 dark:text-emerald-400 hover:text-white hover:bg-emerald-600 dark:hover:bg-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl transition-all font-bold shadow-sm"
                              title="إعداد وطباعة عرض سعر سيارة (Quotation)"
                            >
                              <FileText size={18} />
                            </button>
                            <button 
                              onClick={() => handlePrintCarrierLetter(car)} 
                              className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                              title="طباعة خطاب شاحن والناقل السريع"
                            >
                              <Truck size={18} />
                            </button>
                            <button 
                              onClick={() => handlePrintCarCard(car)} 
                              className="p-3 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-xl transition-all"
                              title="طباعة بطاقة المركبة تفصيلياً"
                            >
                              <Printer size={18} />
                            </button>
                            <button onClick={() => onDelete(car.id)} className="p-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                });
              })()}
              {salesCars.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-20 text-center text-slate-400 font-bold">لا يوجد مركبات مباعة حالياً.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {isModalOpen && editingCar && (
        <SoldCarEditModal
          car={editingCar}
          cars={cars}
          currentUser={currentUser}
          users={users}
          settings={settings}
          onClose={() => setIsModalOpen(false)}
          onSave={(data, detailedActionLog) => {
            if (addLog && detailedActionLog) {
              addLog('تعديل مبيعات', editingCar.id, 'car', detailedActionLog);
            }

            onUpdate({ 
              ...editingCar, 
              ...data, 
              lastModified: new Date().toISOString(),
              history: [
                ...(editingCar.history || []),
                { id: `h-${Date.now()}`, action: detailedActionLog, timestamp: new Date().toISOString(), user: currentUser?.username || 'نظام' }
              ]
            });
            setIsModalOpen(false);
          }}
        />
      )}

      {isPriceQuoteModalOpen && selectedPriceQuoteCar && (
        <PriceQuotationModal 
          settings={settings}
          car={selectedPriceQuoteCar}
          currentUser={currentUser}
          users={users}
          onClose={() => {
            setIsPriceQuoteModalOpen(false);
            setSelectedPriceQuoteCar(null);
          }}
          onPrintAndArchive={handleSavePriceQuote}
        />
      )}
    </div>
  );
};

// Custom Professional Modal for Modifying Vehicles Completely in Sales Section
const SoldCarEditModal: React.FC<{
  car: Car;
  cars?: Car[];
  currentUser: any;
  users?: User[];
  settings?: OrganizationSettings;
  onClose: () => void;
  onSave: (updatedFields: Partial<Car>, modificationsLog: string) => void;
}> = ({ car, cars = [], currentUser, users = [], settings, onClose, onSave }) => {
  const [activeTab, setActiveTab] = useState<'specs' | 'sale' | 'plate'>('specs');

  // Specs & Vehicle
  const [brand, setBrand] = useState(car.brand || '');
  const [model, setModel] = useState(car.model || '');
  const [color, setColor] = useState(car.color || '');
  const [year, setYear] = useState(car.year || new Date().getFullYear());
  const [vin, setVin] = useState(car.vin || '');
  const [cardNumber, setCardNumber] = useState(car.cardNumber || '');
  const [status, setStatus] = useState<string>(car.status || CarStatus.SOLD);
  const [rentalStatus, setRentalStatus] = useState<string>(car.rentalStatus || RentalStatus.NOT_RENTED);
  const [ownershipType, setOwnershipType] = useState<string>(car.ownershipType || OwnershipType.DIRECT);

  // Financials & Costs
  const [price, setPrice] = useState(car.price || 0);
  const [costPrice, setCostPrice] = useState(car.costPrice || 0);
  const [supplier, setSupplier] = useState(car.supplier || '');
  const [entryDate, setEntryDate] = useState(car.entryDate?.split('T')[0] || '');

  // Exit & Sale
  const [exitDate, setExitDate] = useState(car.exitData?.exitDate || new Date().toISOString().split('T')[0]);
  const [saleType, setSaleType] = useState(car.exitData?.saleType || '');
  const [bankName, setBankName] = useState(car.exitData?.bankName || '');
  const [seller, setSeller] = useState(car.exitData?.seller || car.exitData?.representativeName || car.seller || '');
  const [receiverName, setReceiverName] = useState(car.exitData?.receiverName || '');
  const [receiverPhone, setReceiverPhone] = useState(car.exitData?.receiverPhone || '');
  const [receiverId, setReceiverId] = useState(car.exitData?.receiverId || '');
  const [nationality, setNationality] = useState(car.exitData?.nationality || '');
  const [deliveryType, setDeliveryType] = useState<string>(car.exitData?.deliveryType || DeliveryType.OWNER);
  const [transportCompany, setTransportCompany] = useState(car.exitData?.transportCompany || '');
  const [carCondition, setCarCondition] = useState(car.exitData?.carCondition || 'ممتازة - خالية من العيوب');

  // Plate
  const [hasPlate, setHasPlate] = useState<boolean>(car.hasPlate || false);
  const [plateNumber, setPlateNumber] = useState(car.plateData?.plateNumber || '');
  const [plateOwnerName, setPlateOwnerName] = useState(car.plateData?.ownerName || '');
  const [plateSerialNumber, setPlateSerialNumber] = useState(car.plateData?.serialNumber || '');
  const [plateIssueDate, setPlateIssueDate] = useState(car.plateData?.issueDate || '');

  // Notes
  const [notes, setNotes] = useState(car.exitData?.notes || car.notes || '');
  const [carRemark, setCarRemark] = useState(car.carRemark || '');

  // Delegates list from users & settings
  const delegateOptions = useMemo(() => {
    const list = new Set<string>();
    if (users) {
      users.forEach(u => {
        const name = u.fullName || u.username;
        if (name) list.add(name);
      });
    }
    if (settings && (settings as any).delegates) {
      (settings as any).delegates.forEach((d: any) => {
        if (d.username) list.add(d.username);
      });
    }
    return Array.from(list).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [users, settings]);

  const handleSave = () => {
    const modifications: string[] = [];
    const fieldsToUpdate: Partial<Car> = {};

    if (car.brand !== brand) {
      modifications.push(`الماركة (من "${car.brand}" إلى "${brand}")`);
      fieldsToUpdate.brand = brand;
    }
    if (car.model !== model) {
      modifications.push(`الموديل (من "${car.model}" إلى "${model}")`);
      fieldsToUpdate.model = model;
    }
    if ((car.color || '') !== color) {
      modifications.push(`اللون (من "${car.color || '—'}" إلى "${color || '—'}")`);
      fieldsToUpdate.color = color;
    }
    if (car.year !== Number(year)) {
      modifications.push(`سنة التصنيع (من "${car.year}" إلى "${year}")`);
      fieldsToUpdate.year = Number(year);
    }
    if ((car.vin || '') !== vin) {
      modifications.push(`رقم الهيكل/الشاسي (من "${car.vin || '—'}" إلى "${vin || '—'}")`);
      fieldsToUpdate.vin = vin;
      fieldsToUpdate.vinMatching = vin.replace(/\s+/g, '').toUpperCase();
    }
    if ((car.cardNumber || '') !== cardNumber) {
      modifications.push(`رقم البطاقة الجمركية (من "${car.cardNumber || '—'}" إلى "${cardNumber || '—'}")`);
      fieldsToUpdate.cardNumber = cardNumber;
    }
    if (car.price !== Number(price)) {
      modifications.push(`سعر البيع (من "${car.price}" إلى "${price}")`);
      fieldsToUpdate.price = Number(price);
    }
    if ((car.costPrice || 0) !== Number(costPrice)) {
      modifications.push(`سعر التكلفة (من "${car.costPrice || 0}" إلى "${costPrice}")`);
      fieldsToUpdate.costPrice = Number(costPrice);
    }
    if ((car.supplier || '') !== supplier) {
      modifications.push(`المورد (من "${car.supplier || '—'}" إلى "${supplier || '—'}")`);
      fieldsToUpdate.supplier = supplier;
    }
    if ((car.ownershipType || '') !== ownershipType) {
      modifications.push(`نوع الملكية (من "${car.ownershipType || '—'}" إلى "${ownershipType || '—'}")`);
      fieldsToUpdate.ownershipType = ownershipType as OwnershipType;
    }
    if ((car.status || '') !== status) {
      modifications.push(`حالة المركبة (من "${car.status || '—'}" إلى "${status || '—'}")`);
      fieldsToUpdate.status = status as CarStatus;
      if (status !== CarStatus.SOLD) {
        fieldsToUpdate.isOutbound = false;
      }
    }
    if ((car.rentalStatus || '') !== rentalStatus) {
      modifications.push(`حالة التجير (من "${car.rentalStatus || '—'}" إلى "${rentalStatus || '—'}")`);
      fieldsToUpdate.rentalStatus = rentalStatus as RentalStatus;
    }
    if ((car.entryDate || '') !== entryDate) {
      modifications.push(`تاريخ الدخول (من "${car.entryDate || '—'}" إلى "${entryDate || '—'}")`);
      fieldsToUpdate.entryDate = entryDate;
    }
    if ((car.notes || '') !== notes) {
      modifications.push(`الملاحظات (من "${car.notes || '—'}" إلى "${notes || '—'}")`);
      fieldsToUpdate.notes = notes;
    }
    if ((car.carRemark || '') !== carRemark) {
      modifications.push(`ملاحظات السيارة (من "${car.carRemark || '—'}" إلى "${carRemark || '—'}")`);
      fieldsToUpdate.carRemark = carRemark;
    }

    const oldExit: any = car.exitData || {};
    const cleanSeller = seller.trim();
    const exitDataChanged = 
      (oldExit.saleType || '') !== saleType ||
      (oldExit.bankName || '') !== bankName ||
      (oldExit.exitDate || '') !== exitDate ||
      (oldExit.seller || oldExit.representativeName || '') !== cleanSeller ||
      (oldExit.receiverName || '') !== receiverName ||
      (oldExit.receiverPhone || '') !== receiverPhone ||
      (oldExit.receiverId || '') !== receiverId ||
      (oldExit.nationality || '') !== nationality ||
      (oldExit.deliveryType || '') !== deliveryType ||
      (oldExit.transportCompany || '') !== transportCompany ||
      (oldExit.carCondition || '') !== carCondition ||
      (oldExit.notes || '') !== notes;

    if (exitDataChanged) {
      modifications.push(`تفاصيل البيع والعميل`);
      fieldsToUpdate.exitData = {
        ...oldExit,
        exitDate: exitDate || oldExit.exitDate || new Date().toISOString().split('T')[0],
        saleType,
        bankName: saleType === 'عميل بنك' ? bankName : '',
        seller: cleanSeller,
        representativeName: cleanSeller,
        receiverName,
        receiverPhone,
        receiverId,
        nationality,
        deliveryType: deliveryType as DeliveryType,
        transportCompany: deliveryType === DeliveryType.TRANSPORT ? transportCompany : '',
        carCondition,
        notes
      };
    }

    const oldPlate: any = car.plateData || {};
    const plateChanged = car.hasPlate !== hasPlate ||
      (oldPlate.plateNumber || '') !== plateNumber ||
      (oldPlate.ownerName || '') !== plateOwnerName ||
      (oldPlate.serialNumber || '') !== plateSerialNumber ||
      (oldPlate.issueDate || '') !== plateIssueDate;

    if (plateChanged) {
      modifications.push(`بيانات اللوحة`);
      fieldsToUpdate.hasPlate = hasPlate;
      fieldsToUpdate.plateData = hasPlate ? {
        plateNumber,
        ownerName: plateOwnerName,
        serialNumber: plateSerialNumber,
        issueDate: plateIssueDate
      } : undefined;
    }

    if (modifications.length === 0) {
      onClose();
      return;
    }

    const logText = `تعديل شامل لبيانات المركبة في المبيعات: ${modifications.join(' ، ')}`;
    onSave(fieldsToUpdate, logText);
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200 p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] w-full max-w-4xl p-6 shadow-2xl relative flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="text-right">
            <h3 className="text-lg font-black text-slate-850 dark:text-white flex items-center gap-2">
              <Edit3 className="text-blue-600 shrink-0" size={20} />
              <span>تعديل بيانات المركبة والبيع بالكامل</span>
            </h3>
            <p className="text-[11px] text-slate-400 font-bold mt-0.5">
              تعديل كافة المواصفات، الأسعار، بيانات العميل، المندوب، واللوحة في سجلات المبيعات.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-rose-500 rounded-xl bg-slate-50 dark:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 gap-2 pt-3 pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('specs')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
              activeTab === 'specs'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <CarIcon size={16} />
            <span>المواصفات والأسعار والتكلفة</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sale')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
              activeTab === 'sale'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <UserCheck size={16} />
            <span>تفاصيل البيع والعميل</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('plate')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
              activeTab === 'plate'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <CreditCard size={16} />
            <span>اللوحة والملاحظات</span>
          </button>
        </div>

        {/* Modal Scroll Content */}
        <div className="flex-1 overflow-y-auto pr-1 my-4 space-y-5 custom-scrollbar text-right">
          
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-3 text-[11px] text-blue-700 dark:text-blue-300 font-extrabold flex items-start gap-2 leading-relaxed">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div>
              تأكيد الأرشفة: تُحدث التعديلات التغييرات في سجل الحركة وتقارير المبيعات وتُوثّق في سجل التغييرات باسم المستخدِم.
            </div>
          </div>

          {/* TAB 1: Specs, Pricing, Costs & Status */}
          {activeTab === 'specs' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-4">
                <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5 border-b border-slate-200/60 dark:border-slate-800 pb-2">
                  <CarIcon size={14} className="text-blue-500" />
                  بيانات الموديل والمواصفات
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 mb-1">الماركة (Brand)</label>
                    <input
                      type="text"
                      className="w-full text-xs font-bold p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 dark:text-white"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 mb-1">الموديل (Model)</label>
                    <input
                      type="text"
                      className="w-full text-xs font-bold p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 dark:text-white"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 mb-1">سنة الصنع (Year)</label>
                    <input
                      type="number"
                      className="w-full text-xs font-bold p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 dark:text-white"
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 mb-1">اللون (Color)</label>
                    <input
                      type="text"
                      className="w-full text-xs font-bold p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 dark:text-white"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 mb-1">رقم الهيكل (VIN/الشاسي)</label>
                    <input
                      type="text"
                      className="w-full text-xs font-bold font-mono p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 dark:text-white uppercase"
                      value={vin}
                      onChange={(e) => setVin(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 mb-1">رقم البطاقة الجمركية</label>
                    <input
                      type="text"
                      className="w-full text-xs font-bold font-mono p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 dark:text-white"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-4">
                <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5 border-b border-slate-200/60 dark:border-slate-800 pb-2">
                  <DollarSign size={14} className="text-emerald-500" />
                  أسعار البيع، التكلفة والملكية
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 mb-1">سعر البيع (المعتمد)</label>
                    <input
                      type="number"
                      className="w-full text-xs font-mono font-black p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 text-blue-600 dark:text-blue-400"
                      value={price}
                      onChange={(e) => setPrice(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 mb-1">سعر التكلفة</label>
                    <input
                      type="number"
                      className="w-full text-xs font-mono font-black p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 text-slate-700 dark:text-slate-300"
                      value={costPrice}
                      onChange={(e) => setCostPrice(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 mb-1">المورد / الوكيل</label>
                    <input
                      type="text"
                      className="w-full text-xs font-bold p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 dark:text-white"
                      value={supplier}
                      onChange={(e) => setSupplier(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 mb-1">حالة المركبة</label>
                    <select
                      className="w-full text-xs font-bold p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 dark:text-white"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value={CarStatus.SOLD}>مباعة</option>
                      <option value={CarStatus.AVAILABLE}>متوفره (مخزون)</option>
                      <option value={CarStatus.IN_YARD}>بالساحة</option>
                      <option value={CarStatus.RESERVED}>محجوزة</option>
                      <option value={CarStatus.RETURNED}>مرتجعة للمعرض</option>
                      <option value={CarStatus.NOT_ARRIVED_SHOWROOM}>لم تصل المعرض</option>
                      <option value={CarStatus.NOT_FOR_SALE}>غير معروضة للبيع</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 mb-1">نوع الملكية</label>
                    <select
                      className="w-full text-xs font-bold p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 dark:text-white"
                      value={ownershipType}
                      onChange={(e) => setOwnershipType(e.target.value)}
                    >
                      <option value={OwnershipType.DIRECT}>مباشر</option>
                      <option value={OwnershipType.DISTRIBUTION}>تصريف</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 mb-1">التجير</label>
                    <select
                      className="w-full text-xs font-bold p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 dark:text-white"
                      value={rentalStatus}
                      onChange={(e) => setRentalStatus(e.target.value)}
                    >
                      <option value={RentalStatus.NOT_RENTED}>لم يتم التجير</option>
                      <option value={RentalStatus.RENTED}>مجير</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 mb-1">تاريخ الدخول/التوريد</label>
                    <input
                      type="date"
                      className="w-full text-xs font-bold p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 dark:text-white"
                      value={entryDate}
                      onChange={(e) => setEntryDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Sales & Customer Details */}
          {activeTab === 'sale' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-4">
                <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5 border-b border-slate-200/60 dark:border-slate-800 pb-2">
                  <Briefcase size={14} className="text-indigo-500" />
                  المندوب والمسؤول عن البيع
                </h4>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 mb-1">المندوب / المسؤول عن البيع</label>
                    <input
                      type="text"
                      list="delegates-list-edit"
                      className="w-full text-xs font-bold p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 dark:text-white"
                      value={seller}
                      onChange={(e) => setSeller(e.target.value)}
                      placeholder="اختر أو اكتب اسم المندوب..."
                    />
                    <datalist id="delegates-list-edit">
                      {delegateOptions.map((name, i) => (
                        <option key={i} value={name} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 mb-1">تاريخ الخروج / البيع</label>
                    <input
                      type="date"
                      className="w-full text-xs font-bold p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 dark:text-white"
                      value={exitDate}
                      onChange={(e) => setExitDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 mb-1">حالة المركبة عند التسليم</label>
                    <input
                      type="text"
                      className="w-full text-xs font-bold p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 dark:text-white"
                      value={carCondition}
                      onChange={(e) => setCarCondition(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-4">
                <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5 border-b border-slate-200/60 dark:border-slate-800 pb-2">
                  <UserIcon size={14} className="text-cyan-500" />
                  بيانات العميل / المستلم والتسليم
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 mb-1">اسم العميل / المستلم</label>
                    <input
                      type="text"
                      className="w-full text-xs font-bold p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 dark:text-white"
                      value={receiverName}
                      onChange={(e) => setReceiverName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 mb-1">رقم جوال العميل</label>
                    <input
                      type="text"
                      className="w-full text-xs font-bold p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 dark:text-white"
                      value={receiverPhone}
                      onChange={(e) => setReceiverPhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 mb-1">رقم الهوية / السجل التجاري</label>
                    <input
                      type="text"
                      className="w-full text-xs font-bold font-mono p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 dark:text-white"
                      value={receiverId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setReceiverId(val);
                        if (val.trim()) {
                          const match = lookupCustomerById(val, cars);
                          if (match) {
                            if (match.phone) setReceiverPhone(match.phone);
                            if (match.name && !receiverName) setReceiverName(match.name);
                            if (match.nationality && !nationality) setNationality(match.nationality);
                          }
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 mb-1">الجنسية</label>
                    <input
                      type="text"
                      className="w-full text-xs font-bold p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 dark:text-white"
                      value={nationality}
                      onChange={(e) => setNationality(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 mb-1">طريقة التسليم</label>
                    <select
                      className="w-full text-xs font-bold p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 dark:text-white"
                      value={deliveryType}
                      onChange={(e) => setDeliveryType(e.target.value)}
                    >
                      <option value={DeliveryType.OWNER}>صاحبها (تسليم مباشر)</option>
                      <option value={DeliveryType.TRANSPORT}>نقليات (شحن وتوصيل)</option>
                      <option value={DeliveryType.OTHER}>مستلم اخر</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 mb-1">شركة النقليات (في حال الشحن)</label>
                    <input
                      type="text"
                      disabled={deliveryType !== DeliveryType.TRANSPORT}
                      placeholder={deliveryType === DeliveryType.TRANSPORT ? 'اسم شركة النقليات...' : 'ينطبق فقط مع النقل'}
                      className="w-full text-xs font-bold p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 dark:text-white disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800"
                      value={transportCompany}
                      onChange={(e) => setTransportCompany(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Plate Details & Notes */}
          {activeTab === 'plate' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2">
                  <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <CreditCard size={14} className="text-emerald-500" />
                    تفاصيل لوحة المركبة
                  </h4>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={hasPlate}
                      onChange={(e) => setHasPlate(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-black text-slate-700 dark:text-slate-300">تم إصدار/تركيب لوحة</span>
                  </label>
                </div>

                {hasPlate ? (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-black text-slate-500 mb-1">رقم اللوحة</label>
                      <input
                        type="text"
                        className="w-full text-xs font-black p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 text-blue-600 dark:text-blue-400"
                        value={plateNumber}
                        onChange={(e) => setPlateNumber(e.target.value)}
                        placeholder="مثال: أ ب ج 1234"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-black text-slate-500 mb-1">اسم المالك باللوحة</label>
                      <input
                        type="text"
                        className="w-full text-xs font-bold p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 dark:text-white"
                        value={plateOwnerName}
                        onChange={(e) => setPlateOwnerName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-black text-slate-500 mb-1">الرقم التسلسلي للوحة</label>
                      <input
                        type="text"
                        className="w-full text-xs font-bold font-mono p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 dark:text-white"
                        value={plateSerialNumber}
                        onChange={(e) => setPlateSerialNumber(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-black text-slate-500 mb-1">تاريخ الإصدار</label>
                      <input
                        type="date"
                        className="w-full text-xs font-bold p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 dark:text-white"
                        value={plateIssueDate}
                        onChange={(e) => setPlateIssueDate(e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 font-bold italic py-2">لم يتم تفعيل اللوحة لهذه المركبة حالياً. يمكنك تفعيل الخيار أعلاه لإدخال اللوحة.</p>
                )}
              </div>

              <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-4">
                <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5 border-b border-slate-200/60 dark:border-slate-800 pb-2">
                  <FileText size={14} className="text-amber-500" />
                  الملاحظات والقيود الإدارية
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 mb-1">ملاحظات وثيقة البيع والخروج</label>
                    <textarea
                      rows={3}
                      className="w-full text-xs font-bold p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 dark:text-white"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="أدخل ملاحظات عملية البيع والإخراج..."
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-500 mb-1">ملاحظات المركبة الخاصة</label>
                    <textarea
                      rows={3}
                      className="w-full text-xs font-bold p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 dark:text-white"
                      value={carRemark}
                      onChange={(e) => setCarRemark(e.target.value)}
                      placeholder="أدخل ملاحظات فنية أو إدارية تخص المركبة..."
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer Actions */}
        <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
          <div className="text-[11px] font-bold text-slate-400 hidden md:block">
            رقم الهيكل (VIN): <span className="font-mono text-slate-600 dark:text-slate-300">{car.vin || '—'}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs font-extrabold rounded-xl transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              إلغاء وتراجع
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-sm cursor-pointer transition-all flex items-center gap-2"
            >
              <Check size={16} />
              <span>حفظ وتوثيق التعديلات</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

const SalesManagerWithBoundary: React.FC<SalesManagerProps> = (props) => {
  return (
    <TempErrorBoundary>
      <SalesManager {...props} />
    </TempErrorBoundary>
  );
};

export default SalesManagerWithBoundary;
