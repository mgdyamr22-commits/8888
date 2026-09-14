import React, { useState, useMemo, useEffect } from 'react';
import { X, FileText, Printer, Truck, User, Settings, ArrowRightLeft, ShieldAlert, Building2 } from 'lucide-react';
import { Car, OrganizationSettings, formatVehicleDisplay } from '../types';
import { getLogoDataUri, getStampDataUri } from './OfficialAssets';
import { lookupCustomerById } from '../services/customerLookupService';
import { getBilingualPrintHeaderHtml, getBilingualPrintHeaderCss } from '../src/utils/printHeaderHelper';

export interface CompanyInfo {
  id: string;
  name: string;
  city?: string;
  phone?: string;
  crNumber?: string;
  commercialRegister?: string;
  address?: string;
  logo?: string;
  taxNumber?: string;
}

interface CarrierLetterModalProps {
  settings: OrganizationSettings;
  cars?: Car[]; // Support all cars in the system for autocomplete or search (optional)
  car?: Car; // Target single car (selected context)
  selectedVehicles?: Car[]; // Support bulk selection print
  companies?: CompanyInfo[]; // Companies for auto-filling transport data & logos
  onClose: () => void;
  onSave: (letterHtml: string, info: { 
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
  }) => void;
}

export const CarrierLetterModal: React.FC<CarrierLetterModalProps> = ({ 
  settings, 
  cars = [], 
  car, 
  selectedVehicles, 
  companies: companiesProp,
  onClose, 
  onSave 
}) => {
  // Capture current dates
  const currentDate = settings.exitPermitDateType === 'custom' && settings.exitPermitCustomDate
    ? new Date(settings.exitPermitCustomDate)
    : new Date();
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
  const day = String(currentDate.getDate()).padStart(2, '0');

  // Load companies list
  const [sisterCompanies, setSisterCompanies] = useState<CompanyInfo[]>([]);

  useEffect(() => {
    let list: CompanyInfo[] = [];
    if (companiesProp && companiesProp.length > 0) {
      list = companiesProp;
    } else {
      try {
        const saved = localStorage.getItem('company_sister_companies_secure');
        if (saved) {
          list = JSON.parse(saved) as CompanyInfo[];
        }
      } catch (e) {
        console.error('Error loading sister companies in CarrierLetterModal:', e);
      }
    }

    if (!list || list.length === 0) {
      list = [
        { 
          id: '1', 
          name: 'شركة اتحاد الفرسان الحديثة', 
          city: 'الرياض', 
          phone: '0538000863', 
          crNumber: '7054521393', 
          commercialRegister: '7054521393', 
          address: 'الرياض، حي السلي - المنطقة الصناعية', 
          logo: '', 
          taxNumber: '314836376100003' 
        },
        { 
          id: '2', 
          name: settings.name ? `${settings.orgType || 'شركة'} ${settings.name}` : 'سما الفرسان للتجارة', 
          city: 'نجران', 
          phone: settings.contactNumber || '0569050505', 
          crNumber: settings.commercialRegister || '7006605716', 
          commercialRegister: settings.commercialRegister || '7006605716', 
          address: settings.address || 'نجران ، الصناعية . حي المعارض', 
          logo: settings.logoUrl || '', 
          taxNumber: settings.taxNumber || '311804654800003' 
        }
      ];
    }

    setSisterCompanies(list);
  }, [companiesProp, settings]);

  // Determine initial values
  // "السادة/" field initially pulls from entry transport company or exit transport company, or empty (OPTIONAL)
  const initialSalutation = car?.customData?.entryTransportCompany || car?.exitData?.transportCompany || '';
  
  // "وتسليمها إلى/" field initially pulls from exit receiver name, or empty (OPTIONAL)
  const initialDeliveryTo = car?.exitData?.receiverName || '';
  
  // Driver details initial values
  const initialDriverName = car?.customData?.entryDriverName || car?.exitData?.representativeName || car?.exitData?.receiverName || '';
  const initialDriverId = car?.exitData?.receiverId || '';
  const initialDriverPhone = car?.exitData?.receiverPhone || '';
  const initialTruckPlate = car?.exitData?.transportCompany || car?.customData?.entryTransportCompany || '';

  const [formData, setFormData] = useState({
    dateStr: `${year}-${month}-${day}`,
    companyName: settings.name ? `${settings.orgType || 'شركة'} ${settings.name}` : `سما الفرسان للتجارة`,
    commercialRegister: settings.commercialRegister || '7006605716',
    taxNumber: settings.taxNumber || '311804654800003',
    contactNumber: settings.contactNumber || '0569050505',

    // Transfer Companies Header Details (Auto-filled from sister companies / settings)
    senderCompany: 'شركة اتحاد الفرسان الحديثة',
    senderCr: '7054521393',
    senderVat: '314836376100003',
    senderAddress: 'الرياض، حي السلي - المنطقة الصناعية',
    senderPhone: '0538000863',
    senderLogo: '',

    receiverCompany: settings.name ? `${settings.orgType || 'شركة'} ${settings.name}` : 'سما الفرسان للتجارة',
    receiverCr: settings.commercialRegister || '7006605716',
    receiverVat: settings.taxNumber || '311804654800003',
    receiverAddress: settings.address || 'نجران ، الصناعية . حي المعارض',
    receiverPhone: settings.contactNumber || '0569050505',
    receiverLogo: settings.logoUrl || '',

    fileNo: `TR-${year}-0003`,
    responsiblePerson: 'عمرو',
    
    // Core optional editable fields requested by the user
    salutation: initialSalutation, // السادة / ... المحترمين (اختياري)
    deliveryTo: initialDeliveryTo, // وتسليمها إلي / ... (اختياري)

    // Driver details
    driverName: initialDriverName || 'نقليات ابن خماس سهيل / موحد عارف عارف',
    nationality: car?.exitData?.nationality || 'هندي',
    driverId: initialDriverId || '2579335148',
    driverPhone: initialDriverPhone,
    truckPlate: initialTruckPlate,
    
    // Single vehicle fallback fields (if not bulk)
    brand: car?.brand || '',
    model: car?.model || '',
    year: car?.year?.toString() || '2026',
    color: car?.color || '',
    vin: car?.vin || '',
    plateNumber: car?.plateData?.plateNumber || car?.customData?.plateNumber || '',
  });

  const [error, setError] = useState<string | null>(null);

  const transportSuggestions = useMemo(() => {
    const list: string[] = [];
    cars.forEach(c => {
      if (c.customData?.entryTransportCompany) list.push(c.customData.entryTransportCompany);
      if (c.exitData?.transportCompany) list.push(c.exitData.transportCompany);
    });
    return Array.from(new Set(list)).filter(Boolean);
  }, [cars]);

  const driverSuggestions = useMemo(() => {
    const list: string[] = [];
    cars.forEach(c => {
      if (c.customData?.entryDriverName) list.push(c.customData.entryDriverName);
      if (c.exitData?.receiverName) list.push(c.exitData.receiverName);
    });
    return Array.from(new Set(list)).filter(Boolean);
  }, [cars]);

  // Stamp positioning state stored in localStorage (synchronized with general letters settings)
  const [stampSize, setStampSize] = useState<number>(() => {
    const saved = localStorage.getItem('letter_stamp_size');
    return saved ? parseInt(saved, 10) : 110;
  });
  const [stampX, setStampX] = useState<number>(() => {
    const saved = localStorage.getItem('letter_stamp_x');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [stampY, setStampY] = useState<number>(() => {
    const saved = localStorage.getItem('letter_stamp_y');
    return saved ? parseInt(saved, 10) : -15;
  });

  const finalVehiclesList = selectedVehicles && selectedVehicles.length > 0
    ? selectedVehicles
    : [{
        brand: formData.brand,
        model: formData.model,
        year: parseInt(formData.year) || 2026,
        color: formData.color,
        vin: formData.vin,
        plateNumber: formData.plateNumber,
      }];

  const handlePrint = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (finalVehiclesList.length === 0 || (!selectedVehicles && (!formData.brand || !formData.model || !formData.vin))) {
      setError('يرجى ملء مواصفات المركبة الأساسية (نوع السيارة ورقم الهيكل)');
      return;
    }

    const firstVehicle: any = finalVehiclesList[0] || {};
    const vehiclePlateNumber = firstVehicle.plateNumber || firstVehicle.plateData?.plateNumber || firstVehicle.customData?.plateNumber || '';

    const { generateQrCodeDataUrl: genQR, getEmbeddedQrHtml: getQRHtml } = await import('../src/utils/qrHelper');
    const { getDocumentSerial } = await import('../src/utils/documentSerialManager');
    const docSerial = getDocumentSerial('carrier_letter', firstVehicle.id || firstVehicle.vin || '');

    const qrResult = await genQR({
      documentType: 'خطاب شاحن الناقل (مندوب الشحن)',
      serialNumber: docSerial,
      date: formData.dateStr,
      orgName: settings.name || 'سما الفرسان للتجارة',
      orgCr: settings.commercialRegister || '',
      orgVat: settings.taxNumber || '',
      vehicleDetails: {
        brand: firstVehicle.brand || '',
        model: firstVehicle.model || '',
        year: String(firstVehicle.year || ''),
        color: firstVehicle.color || '',
        vin: firstVehicle.vin || '',
        plateNumber: vehiclePlateNumber,
        cardNumber: '',
      },
      recipientDetails: {
        name: formData.deliveryTo,
        idNumber: '',
        phoneNumber: '',
        destination: formData.salutation,
      }
    });

    const htmlContent = `
      <html dir="rtl">
        <head>
          <title>خطاب تحويل مركبات صادر رسمي - ${selectedVehicles && selectedVehicles.length > 1 ? `مجمع (${finalVehiclesList.length} مركبة)` : 'مركبة'}</title>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
          <style>
            @page { size: A4 portrait; margin: 8mm; }
            html, body { height: 100%; margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Cairo', sans-serif; 
              direction: rtl; 
              color: #000; 
              background: #fff; 
              -webkit-print-color-adjust: exact;
              padding: 5px;
            }
            .outer-border {
              border: 2px solid #1e293b;
              border-radius: 6px;
              padding: 10mm;
              box-sizing: border-box;
              min-height: 280mm;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              position: relative;
            }
            
            /* TOP THREE BOXES HEADER */
            .top-header-grid {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border: 1.5px solid #000;
              border-radius: 8px;
              padding: 8px 12px;
              background: #fff;
              margin-bottom: 12px;
            }
            .company-header-box {
              font-size: 8.5pt;
              line-height: 1.45;
              font-weight: 700;
              color: #000;
              width: 38%;
            }
            .company-header-box h3 {
              margin: 0 0 2px 0;
              font-size: 10.5pt;
              font-weight: 900;
              color: #000;
            }
            .center-doc-pill {
              width: 22%;
              border: 1.5px solid #000;
              border-radius: 12px;
              padding: 6px 4px;
              text-align: center;
              background: #fafafa;
            }
            .center-pill-title { font-size: 10.5pt; font-weight: 900; color: #000; margin-bottom: 2px; }
            .center-pill-sub { font-size: 8.5pt; font-weight: 700; color: #334155; }

            /* METADATA BAR GRID */
            .metadata-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 8px 20px;
              border: 1.5px solid #000;
              border-radius: 8px;
              padding: 10px 16px;
              background: #f8fafc;
              margin-bottom: 14px;
              font-size: 10pt;
              font-weight: 700;
            }
            .meta-item { display: flex; align-items: center; gap: 8px; }
            .meta-label { color: #334155; font-weight: 800; }
            .meta-val { color: #000; font-weight: 900; }

            /* DOC TITLE */
            .doc-title-container {
              text-align: center;
              margin: 10px 0 14px 0;
            }
            .doc-title {
              font-size: 15pt;
              font-weight: 950;
              color: #000;
              margin: 0;
              display: inline-block;
              border-bottom: 2px dashed #000;
              padding-bottom: 4px;
              letter-spacing: 0.5px;
            }

            /* STATEMENT */
            .statement-text {
              font-size: 11pt;
              font-weight: 700;
              line-height: 1.6;
              color: #000;
              margin-bottom: 14px;
              text-align: justify;
            }

            /* DRIVER & RECEIVER BOX */
            .driver-card {
              border: 1.5px solid #000;
              border-radius: 8px;
              padding: 10px 14px;
              background: #fafafa;
              margin-bottom: 16px;
            }
            .driver-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 10.5pt;
              font-weight: 800;
              margin-bottom: 10px;
            }
            .driver-row:last-child { margin-bottom: 0; }
            .id-digits-container {
              display: inline-flex;
              gap: 3px;
              direction: ltr;
              vertical-align: middle;
              margin-right: 6px;
            }
            .id-digit-box {
              border: 1px solid #000;
              width: 19px;
              height: 22px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              font-weight: 900;
              font-size: 10.5pt;
              font-family: monospace;
              background: #fff;
            }

            /* CARS TABLE */
            .cars-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            .cars-table th {
              border: 1.5px solid #000;
              background: #f1f5f9;
              font-size: 10.5pt;
              font-weight: 900;
              padding: 8px 6px;
              text-align: center;
              color: #000;
            }
            .cars-table td {
              border: 1.5px solid #000;
              font-size: 10pt;
              font-weight: 700;
              padding: 8px 6px;
              text-align: center;
              background: #fff;
              color: #000;
            }

            /* SIGNATURES BOTTOM */
            .signatures-section {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              margin-top: auto;
              padding-top: 15px;
            }
            .sig-col {
              width: 48%;
              font-size: 10.5pt;
              font-weight: 900;
            }

            /* STAMP & WATERMARK */
            .stamp-img {
              max-height: ${stampSize}px;
              max-width: ${stampSize}px;
              object-fit: contain;
              margin-top: ${stampY}px;
              transform: translateX(${-stampX}px);
              mix-blend-mode: multiply;
            }
            .watermark { 
              position: absolute; 
              top: 50%; 
              left: 50%; 
              transform: translate(-50%, -50%); 
              opacity: 0.12; 
              width: 65%; 
              pointer-events: none; 
              z-index: 1; 
            }
            @media print {
              html, body { height: 100%; overflow: hidden; margin: 0; padding: 0; }
              .outer-border { 
                height: 100% !important; 
                width: 100% !important;
                border: 2px solid #000 !important; 
                padding: 10mm !important; 
                box-sizing: border-box !important; 
                page-break-inside: avoid; 
              }
            }
            ${getBilingualPrintHeaderCss()}
          </style>
        </head>
        <body>
          <div class="outer-border">
            <img src="${settings.logoUrl || getLogoDataUri(settings.name, settings.orgType)}" class="watermark" alt="خلفية الشعار" />
            
            <!-- BILINGUAL ORGANIZATION HEADER -->
            ${getBilingualPrintHeaderHtml(settings)}

            <!-- METADATA BAR GRID MATCHING IMAGE -->
            <div class="metadata-grid">
              <div class="meta-item">
                <span class="meta-label">رقم الفايل والخطاب:</span>
                <span class="meta-val" style="font-family: monospace;">${formData.fileNo || docSerial}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">تاريخ المعاملة الكلي:</span>
                <span class="meta-val">${formData.dateStr}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">الجهة المحولة:</span>
                <span class="meta-val">${formData.senderCompany}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">الجهة المستلمة:</span>
                <span class="meta-val">${formData.receiverCompany}</span>
              </div>
              <div class="meta-item" style="grid-column: span 2;">
                <span class="meta-label">المسؤول والموقع بالملف:</span>
                <span class="meta-val">${formData.responsiblePerson}</span>
              </div>
            </div>

            <!-- TITLE -->
            <div class="doc-title-container">
              <h1 class="doc-title">خطاب تحويل مركبات صادر رسمي</h1>
            </div>

            <!-- SALUTATION & STATEMENT -->
            <div style="margin-bottom: 12px; font-size: 11pt; font-weight: 800;">
              السادة / <strong style="text-decoration: underline;">${formData.salutation || formData.receiverCompany}</strong> المحترمين
            </div>

            <div class="statement-text">
              نفيدكم بأنه قد تم تحويل ونقل المركبات الموضحة أدناه من مخزون فرع/مخزن (<strong>${formData.senderCompany}</strong>) إلى فرع/مخزن (<strong>${formData.receiverCompany}</strong>) بناءً على طلب النقل والتوزيع الرسمي${formData.deliveryTo ? ` وتسليمها إلى/ <strong>${formData.deliveryTo}</strong>` : ''}، وتعتبر هذه الوثيقة مستنداً رسمياً معتمداً للحركة والتحويل:
            </div>

            <!-- DRIVER / RECEIVER CARD MATCHING IMAGE -->
            <div class="driver-card">
              <div class="driver-row">
                <div>
                  <strong>استلمت انا (المستلم) /</strong>
                  <span style="border-bottom: 1px dotted #000; padding: 0 10px; font-weight: 900;">${formData.driverName || formData.deliveryTo || 'نقليات ابن خماس سهيل / موحد عارف عارف'}</span>
                </div>
                <div>
                  <strong>الجنسية /</strong>
                  <span style="border-bottom: 1px dotted #000; padding: 0 10px; font-weight: 900;">${formData.nationality || 'هندي'}</span>
                </div>
              </div>

              <div class="driver-row" style="margin-top: 10px;">
                <div>
                  <strong>حامل هوية رقم</strong>
                  <div class="id-digits-container">
                    ${(formData.driverId || '2579335148').replace(/\D/g, '').split('').map(digit => `<span class="id-digit-box">${digit}</span>`).join('')}
                  </div>
                </div>
                <div>
                  <strong>توقيع سائق الشاحنة /</strong>
                  <span style="display: inline-block; min-width: 150px; border-bottom: 1px dotted #000; margin-right: 6px;">&nbsp;</span>
                </div>
              </div>
            </div>

            <!-- VEHICLES TABLE MATCHING IMAGE -->
            <table class="cars-table">
              <thead>
                <tr>
                  <th style="width: 5%;">م</th>
                  <th style="width: 28%;">السيارة</th>
                  <th style="width: 15%;">لون وموديل السيارة</th>
                  <th style="width: 17%;">رقم الهيكل (VIN)</th>
                  <th style="width: 13%;">المورد</th>
                  <th style="width: 11%;">رقم اللوحة</th>
                  <th style="width: 11%;">البطاقة الجمركية</th>
                </tr>
              </thead>
              <tbody>
                ${finalVehiclesList.map((item, idx) => `
                  <tr>
                    <td style="font-weight: 900;">${idx + 1}</td>
                    <td style="text-align: right; font-weight: 800; padding-right: 8px;">${formatVehicleDisplay(item)}</td>
                    <td>${item.color || 'أبيض'} / ${item.year || '2026'}</td>
                    <td style="font-family: monospace; font-size: 10.5pt; font-weight: 900; letter-spacing: 0.5px;">${item.vin || '—'}</td>
                    <td>${item.supplier || '—'}</td>
                    <td>${(item.plateNumber || item.plateData?.plateNumber || item.customData?.plateNumber || '').trim() || 'بطاقة جمركية'}</td>
                    <td style="font-family: monospace; font-size: 9.5pt;">${item.cardNumber || item.customData?.cardNumber || '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <!-- SIGNATURES FOOTER MATCHING IMAGE -->
            <div class="signatures-section">
              <div class="sig-col" style="text-align: right;">
                <div style="font-weight: 900; font-size: 11pt; margin-bottom: 8px;">الجهة المصادقة والمرسلة:</div>
                <div style="font-weight: 800; margin-bottom: 12px; color: #334155;">مدير شؤون المخازن والحركة والمعارض</div>
                <div style="position: relative; height: 70px;">
                  <img src="${settings.stampUrl || getStampDataUri(settings.name, settings.commercialRegister, settings.orgType)}" class="stamp-img" alt="ختم المصادقة" />
                </div>
              </div>

              <div class="sig-col" style="text-align: left;">
                <div style="font-weight: 900; font-size: 11pt; margin-bottom: 8px;">الطرف الأول المفوض (المستلم):</div>
                <div style="margin-top: 35px; border-bottom: 1px dashed #000; width: 80%; display: inline-block;"></div>
                <div style="font-size: 9pt; font-weight: 700; color: #64748b; margin-top: 4px;">(التوقيع والختم)</div>
              </div>
            </div>

            <!-- BOTTOM ELECTRONIC FOOTER MATCHING IMAGE -->
            <div style="text-align: center; font-size: 8.5pt; font-weight: 700; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 15px;">
              وثيقة إلكترونية معتمدة ومسجلة في نظام المخزون الموحد للشركات الشقيقة.
            </div>
          </div>

            <!-- DIGITAL VERIFICATION QR CODE -->
            ${getQRHtml(qrResult.qrCodeDataUrl, qrResult.fingerprint)}

            <div class="footer-sign">
              <div>${formData.companyName}</div>
              <img src="${settings.stampUrl || getStampDataUri(settings.name ? `${settings.orgType || 'مؤسسة'} ${settings.name}` : undefined, settings.commercialRegister, settings.orgType)}" class="stamp-img" alt="ختم ${settings.orgType || 'المؤسسة'}" />
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

    onSave(htmlContent, {
      brand: selectedVehicles && selectedVehicles.length > 1 ? `خطاب مجمع (${selectedVehicles.length} مركبة)` : formData.brand,
      model: selectedVehicles && selectedVehicles.length > 1 ? 'مجمع' : formData.model,
      year: selectedVehicles && selectedVehicles.length > 1 ? 'مجمع' : formData.year,
      vin: selectedVehicles && selectedVehicles.length > 1 ? `مجمع - ${selectedVehicles.length}` : formData.vin,
      salutation: formData.salutation,
      deliveryTo: formData.deliveryTo,
      driverName: formData.driverName,
      driverId: formData.driverId,
      driverPhone: formData.driverPhone,
      truckPlate: formData.truckPlate,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-2 sm:p-4 md:p-6 animate-in fade-in duration-200 overflow-y-auto overscroll-contain">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl sm:rounded-[1.5rem] shadow-2xl border border-slate-150 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] my-auto animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 bg-slate-50 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800/60 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl sm:rounded-2xl animate-pulse">
              <Truck size={20} className="sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-white">
                {selectedVehicles && selectedVehicles.length > 1 
                  ? `إصدار خطاب شحن مجمع (${selectedVehicles.length} سيارات)`
                  : 'تجهيز وتعبيئة خطاب شاحن الناقل'}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400 font-bold dark:text-slate-500 mt-0.5 sm:mt-1">
                تعديل وتحديد جهة الشحن والجهات المعنية قبل المعاينة والطباعة
              </p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-rose-500 transition-colors bg-slate-100 dark:bg-slate-800 rounded-xl cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handlePrint} className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar text-right" dir="rtl">
          
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/15 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-black flex items-center gap-2 animate-bounce">
              <ShieldAlert size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Section 0: Sister Companies & Header Entities (Auto-fetching logos & metadata) */}
          <div className="p-4 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-2xl border border-indigo-500/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 size={18} className="text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 tracking-wider uppercase">
                  إدارة التحويلات بين الشركات الشقيقة (تحديد الشعار والبيانات تلقائياً)
                </h3>
              </div>
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-full">
                الشركات المعتمدة
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Sender Company */}
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-2">
                  الجهة المحولة الشاحنة (الشركة المرسلة)
                </label>
                <select
                  value={formData.senderCompany}
                  onChange={(e) => {
                    const selectedName = e.target.value;
                    const found = sisterCompanies.find(c => c.name === selectedName);
                    if (found) {
                      setFormData(prev => ({
                        ...prev,
                        senderCompany: found.name,
                        senderCr: found.crNumber || found.commercialRegister || prev.senderCr,
                        senderVat: found.taxNumber || prev.senderVat,
                        senderAddress: found.address || prev.senderAddress,
                        senderPhone: found.phone || prev.senderPhone,
                        senderLogo: found.logo || prev.senderLogo,
                      }));
                    } else {
                      setFormData(prev => ({ ...prev, senderCompany: selectedName }));
                    }
                  }}
                  className="w-full p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  {sisterCompanies.map(c => (
                    <option key={c.id} value={c.name}>
                      🏢 {c.name} {c.city ? `(${c.city})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Receiver Company */}
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-2">
                  الجهة المستلمة (الشركة المستقبلة)
                </label>
                <select
                  value={formData.receiverCompany}
                  onChange={(e) => {
                    const selectedName = e.target.value;
                    const found = sisterCompanies.find(c => c.name === selectedName);
                    if (found) {
                      setFormData(prev => ({
                        ...prev,
                        receiverCompany: found.name,
                        receiverCr: found.crNumber || found.commercialRegister || prev.receiverCr,
                        receiverVat: found.taxNumber || prev.receiverVat,
                        receiverAddress: found.address || prev.receiverAddress,
                        receiverPhone: found.phone || prev.receiverPhone,
                        receiverLogo: found.logo || prev.receiverLogo,
                      }));
                    } else {
                      setFormData(prev => ({ ...prev, receiverCompany: selectedName }));
                    }
                  }}
                  className="w-full p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  {sisterCompanies.map(c => (
                    <option key={c.id} value={c.name}>
                      🏢 {c.name} {c.city ? `(${c.city})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 1: Core Carrier Letter Details requested by the user */}
          <div className="p-4 bg-blue-500/5 dark:bg-blue-500/10 rounded-2xl border border-blue-500/10 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-blue-600 dark:text-blue-400 tracking-wider uppercase">
                البيانات الرئيسية للخطاب (الجهة وتفاصيل التسليم)
              </h3>
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-full">
                اختياري - يتم الجلب تلقائياً إن تُرِكت فارغة
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-350 mb-2">
                  الجهة المطلوب منها الشحن (السادة / ...) <span className="text-slate-400 font-bold">(اختياري)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    list="carrier-salutation-suggestions"
                    value={formData.salutation}
                    onChange={(e) => setFormData({ ...formData, salutation: e.target.value })}
                    className="w-full p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-bold text-slate-800 dark:text-slate-200 pr-10"
                    placeholder="مثال: شركة البسامي لـ النقليات (اختياري)"
                  />
                  <datalist id="carrier-salutation-suggestions">
                    {transportSuggestions.map((t, i) => (
                      <option key={i} value={t} />
                    ))}
                  </datalist>
                  <div className="absolute inset-y-0 right-3 flex items-center text-slate-400">
                    <User size={16} />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 font-bold">
                  * اختياري - في حال تركه فارغاً يتم جلب اسم الجهة المستلمة تلقائياً
                </p>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-350 mb-2">
                  الجهة المطلوب الشحن إليها وتسليمها (وتسليمها إلي / ...) <span className="text-slate-400 font-bold">(اختياري)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    list="carrier-delivery-suggestions"
                    value={formData.deliveryTo}
                    onChange={(e) => setFormData({ ...formData, deliveryTo: e.target.value })}
                    className="w-full p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-bold text-slate-800 dark:text-slate-200 pr-10"
                    placeholder="مثال: صالح محمد المري (اختياري)"
                  />
                  <datalist id="carrier-delivery-suggestions">
                    {driverSuggestions.map((d, i) => (
                      <option key={i} value={d} />
                    ))}
                  </datalist>
                  <div className="absolute inset-y-0 right-3 flex items-center text-slate-400">
                    <ArrowRightLeft size={16} />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 font-bold">
                  * اختياري - في حال تركه فارغاً يتم جلب بيانات المستلم أو السائق تلقائياً
                </p>
              </div>
            </div>
          </div>

          {/* Section 1.5: Driver and Truck Information (Requested by User) */}
          <div className="p-4 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-2xl border border-emerald-500/10 space-y-4">
            <div className="flex items-center gap-2">
              <Truck size={18} className="text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-xs font-black text-emerald-600 dark:text-emerald-400 tracking-wider uppercase">
                بيانات سائق الشاحنة الناقلة والتريلة (بيانات السائق والهوية والتوقيع)
              </h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-350 mb-2">
                  اسم سائق الشاحنة الناقلة
                </label>
                <input
                  type="text"
                  list="carrier-driver-name-list"
                  value={formData.driverName}
                  onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
                  className="w-full p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-bold text-slate-800 dark:text-slate-200"
                  placeholder="اسم السائق الثلاثي/الرباعي"
                />
                <datalist id="carrier-driver-name-list">
                  {driverSuggestions.map((d, i) => (
                    <option key={i} value={d} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-350 mb-2">
                  رقم الهوية الوطنية / الإقامة للسائق
                </label>
                <input
                  type="text"
                  value={formData.driverId}
                  onChange={(e) => {
                    const val = e.target.value;
                    const updated = { ...formData, driverId: val };
                    if (val.trim()) {
                      const match = lookupCustomerById(val, cars);
                      if (match) {
                        if (match.phone) updated.driverPhone = match.phone;
                        if (match.name && !updated.driverName) updated.driverName = match.name;
                      }
                    }
                    setFormData(updated);
                  }}
                  className="w-full p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-mono font-bold text-slate-800 dark:text-slate-200"
                  placeholder="مثال: 2458991204"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-350 mb-2">
                  رقم جوال سائق الشاحنة
                </label>
                <input
                  type="text"
                  value={formData.driverPhone}
                  onChange={(e) => setFormData({ ...formData, driverPhone: e.target.value })}
                  className="w-full p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-mono font-bold text-slate-800 dark:text-slate-200"
                  placeholder="مثال: 0501234567"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-350 mb-2">
                  رقم اللوحة / الشاحنة الناقلة (التريلة)
                </label>
                <input
                  type="text"
                  value={formData.truckPlate}
                  onChange={(e) => setFormData({ ...formData, truckPlate: e.target.value })}
                  className="w-full p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-bold text-slate-800 dark:text-slate-200"
                  placeholder="مثال: أ ب ج 1234"
                />
              </div>
            </div>

            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800/40 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 flex flex-col gap-1">
              <span className="font-extrabold text-xs text-emerald-900 dark:text-emerald-200">✍️ الإقرار والتوقيع المعروض في الخطاب:</span>
              <span>«أقر أنا سائق الشاحنة الموضح بياناتي أعلاه بأني استلمت المركبات الموضحة في جدول المحمول أعلاه بحالة سليمة وخالية من التلفيات، وأتعهد بنقلها وإيصالها وتسليمها للجهة المحولة إليها.»</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-2">
                تاريخ إصدار الخطاب
              </label>
              <input
                type="text"
                value={formData.dateStr}
                onChange={(e) => setFormData({ ...formData, dateStr: e.target.value })}
                className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-bold text-slate-800 dark:text-slate-200"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-2">
                رقم للتواصل (تلقائي)
              </label>
              <input
                type="text"
                value={formData.contactNumber}
                onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                placeholder={settings.contactNumber || 'لا يوجد'}
                className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-bold text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          {/* Section 3: Document Vehicles Summary */}
          <div className="space-y-3">
            <h3 className="text-xs font-black text-slate-400 tracking-wider uppercase">
              المركبات المشمولة بالخطاب ({finalVehiclesList.length})
            </h3>
            
            <div className="border border-slate-150 dark:border-slate-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto custom-scrollbar w-full">
              <table className="w-full text-xs font-bold text-slate-700 dark:text-slate-350">
                <thead className="bg-slate-50 dark:bg-slate-950/20 text-slate-900 dark:text-slate-100 border-b border-slate-150 dark:border-slate-800">
                  <tr>
                    <th className="p-3 text-center">نوع المركبة</th>
                    <th className="p-3 text-center">اللون والموديل</th>
                    <th className="p-3 text-center">رقم الهيكل (VIN)</th>
                    <th className="p-3 text-center">اللوحة / الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 bg-white dark:bg-slate-900/40">
                  {finalVehiclesList.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/10 transition-colors">
                      <td className="p-3 text-center">{formatVehicleDisplay(item)}</td>
                      <td className="p-3 text-center">{item.color || '—'} / {item.year || '—'}</td>
                      <td className="p-3 text-center font-mono text-[11px] text-slate-500">{item.vin || '—'}</td>
                      <td className="p-3 text-center font-bold">
                        {(item.plateNumber || item.plateData?.plateNumber || item.customData?.plateNumber || '').trim() || 'بطاقة جمركية'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>

          {/* Settings Section (Stamps dimensions setting) */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-150 dark:border-slate-800/80 space-y-4">
            <div className="flex items-center gap-2 text-xs font-black text-slate-700 dark:text-slate-300">
              <Settings size={14} className="text-slate-400" />
              <span>تعديل تموضع الختم الرسمي في الخطاب (اختياري)</span>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1.5">حجم الختم</label>
                <input
                  type="number"
                  value={stampSize}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setStampSize(value);
                    localStorage.setItem('letter_stamp_size', String(value));
                  }}
                  className="w-full p-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-center text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1.5">إزاحة يمين/يسار</label>
                <input
                  type="number"
                  value={stampX}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setStampX(value);
                    localStorage.setItem('letter_stamp_x', String(value));
                  }}
                  className="w-full p-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-center text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1.5">إزاحة أعلى/أسفل</label>
                <input
                  type="number"
                  value={stampY}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setStampY(value);
                    localStorage.setItem('letter_stamp_y', String(value));
                  }}
                  className="w-full p-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-center text-xs font-mono font-bold"
                />
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex flex-col md:flex-row gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="submit"
              className="flex-1 py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
            >
              <Printer size={16} />
              <span>تحرير ومعاينة الخطاب</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-6 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-2xl font-black text-xs transition-colors cursor-pointer"
            >
              إلغاء
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
