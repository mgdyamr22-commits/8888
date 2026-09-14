import React, { useState, useMemo } from 'react';
import { X, FileText, Printer, User, Calendar, Palette, Hash, ShieldAlert, Truck, Search, Settings, Sliders } from 'lucide-react';
import { Car, CarStatus, DeliveryType, OwnershipType, RentalStatus, OrganizationSettings, formatVehicleDisplay } from '../types';
import { InputField } from './CarFormModal';
import { getLogoDataUri, getStampDataUri } from './OfficialAssets';
import { lookupCustomerById } from '../services/customerLookupService';
import { getBilingualPrintHeaderHtml, getBilingualPrintHeaderCss } from '../src/utils/printHeaderHelper';

interface WithdrawalLetterModalProps {
  settings: OrganizationSettings;
  car?: Car;
  onClose: () => void;
  onSave: (carData: any, letterHtml: string, entryPermitHtml: string) => void;
  cars: Car[];
}

export const WithdrawalLetterModal: React.FC<WithdrawalLetterModalProps> = ({ settings, car, onClose, onSave, cars }) => {
  const [vehicleMode, setVehicleMode] = useState<'inventory' | 'external'>(car ? 'inventory' : 'external');

  const [formData, setFormData] = useState({
    brand: car?.brand || '',
    model: car?.model || '',
    year: car?.year || 2026,
    color: car?.color || '',
    vin: car?.vin || '',
    fuelType: car?.customData?.fuelType || '',
    plateNumber: car?.plateData?.plateNumber || '',
    otherSpecs: car?.customData?.otherSpecs || '',
    withdrawFrom: car?.customData?.withdrawFrom || '', // جهة السحب (السادة/...)
    transportCompany: car?.customData?.entryTransportCompany || car?.customData?.transportCompany || car?.exitData?.transportCompany || '', // شركة النقليات (تسليمها إلى)
    representativeName: car?.exitData?.receiverName || car?.customData?.representativeName || '', // ممثلة في
    representativeId: car?.exitData?.receiverId || car?.customData?.representativeId || '', // رقم هوية
    representativePhone: car?.exitData?.receiverPhone || car?.customData?.representativePhone || '', // الجوال
    notes: car?.notes || car?.exitData?.notes || 'المركبة لم تأتِ إلى المعرض بعد وتم تسلمها', // الملحوظة الافتراضية
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

  const representativeSuggestions = useMemo(() => {
    const list: string[] = [];
    cars.forEach(c => {
      if (c.customData?.entryDriverName) list.push(c.customData.entryDriverName);
      if (c.exitData?.receiverName) list.push(c.exitData.receiverName);
      if (c.customData?.representativeName) list.push(c.customData.representativeName);
    });
    return Array.from(new Set(list)).filter(Boolean);
  }, [cars]);

  // Stamp positioning state stored in localStorage
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

  // Custom vehicle search controls for auto-filling
  const [searchCarQuery, setSearchCarQuery] = useState(car ? `${car.brand} ${car.model} (الهيكل: ${car.vin || ''})` : '');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showWithdrawFrom, setShowWithdrawFrom] = useState<boolean>(
    car?.customData?.showWithdrawFrom !== undefined ? car.customData.showWithdrawFrom : true
  );
  const [showTransportCompany, setShowTransportCompany] = useState<boolean>(
    car?.customData?.showTransportCompany !== undefined ? car.customData.showTransportCompany : true
  );
  const [showRepresentativeName, setShowRepresentativeName] = useState<boolean>(
    car?.customData?.showRepresentativeName !== undefined ? car.customData.showRepresentativeName : true
  );
  const [showRepresentativeId, setShowRepresentativeId] = useState<boolean>(
    car?.customData?.showRepresentativeId !== undefined ? car.customData.showRepresentativeId : true
  );
  const [showRepresentativePhone, setShowRepresentativePhone] = useState<boolean>(
    car?.customData?.showRepresentativePhone !== undefined ? car.customData.showRepresentativePhone : true
  );

  const filteredCars = (cars || []).filter(c => {
    const query = searchCarQuery.toLowerCase();
    return (
      c.brand.toLowerCase().includes(query) ||
      c.model.toLowerCase().includes(query) ||
      (c.vin && c.vin.toLowerCase().includes(query))
    );
  });

  const handleSelectCar = (selected: Car) => {
    setFormData(prev => ({
      ...prev,
      brand: selected.brand || '',
      model: selected.model || '',
      year: selected.year || 2026,
      color: selected.color || '',
      vin: selected.vin || '',
      withdrawFrom: selected.customData?.withdrawFrom || '',
      transportCompany: selected.customData?.entryTransportCompany || selected.customData?.transportCompany || selected.exitData?.transportCompany || '',
      representativeName: selected.exitData?.receiverName || selected.customData?.representativeName || '',
      representativeId: selected.exitData?.receiverId || selected.customData?.representativeId || '',
      representativePhone: selected.exitData?.receiverPhone || selected.customData?.representativePhone || '',
      notes: selected.notes || selected.exitData?.notes || 'المركبة لم تأتِ إلى المعرض بعد وتم تسلمها'
    }));
    setSearchCarQuery(`${selected.brand} ${selected.model} (الهيكل: ${selected.vin || ''})`);
    setIsDropdownOpen(false);
  };

  const isVinDuplicate = () => {
    if (vehicleMode === 'external') return false; // Bypass duplicate check for external vehicles as requested ("إخفاء جميع القيود الخاصة بالمخزون")
    if (!formData.vin) return false;
    const cleanVin = formData.vin.replace(/\s+/g, '').toUpperCase();
    if (!cleanVin) return false;
    if (car) {
      return cars.some(c => c.id !== car.id && c.vin && c.vin.replace(/\s+/g, '').toUpperCase() === cleanVin);
    }
    return cars.some(c => c.vin && c.vin.replace(/\s+/g, '').toUpperCase() === cleanVin);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.brand || !formData.vin) {
      setError('يرجى ملء الحقول الإلزامية الأساسية للمركبة (ماركة السيارة ورقم الهيكل)');
      return;
    }

    if (isVinDuplicate()) {
      setError('رقم الشاصي (الهيكل) مسجل بالفعل في النظام لمركبة أخرى!');
      return;
    }

    // Capture the dates
    const currentDate = settings.exitPermitDateType === 'custom' && settings.exitPermitCustomDate
      ? new Date(settings.exitPermitCustomDate)
      : new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');

    const { generateQrCodeDataUrl: genQR, getEmbeddedQrHtml: getQRHtml } = await import('../src/utils/qrHelper');
    const { getDocumentSerial } = await import('../src/utils/documentSerialManager');
    const docSerialWithdrawal = getDocumentSerial('withdrawal_letter', formData.vin || '');
    const docSerialEntry = getDocumentSerial('entry_permit', (formData.vin || '') + '-withdrawal-entry');
    
    // Generate QR for Withdrawal Letter
    const qrResultWithdrawal = await genQR({
      documentType: 'خطاب سحب سيارة',
      serialNumber: docSerialWithdrawal,
      date: `${day} / ${month} / ${year} م`,
      orgName: settings.name || 'سما الفرسان للتجارة',
      orgCr: settings.commercialRegister || '',
      orgVat: settings.taxNumber || '',
      vehicleDetails: {
        brand: formData.brand,
        model: formData.model,
        year: String(formData.year),
        color: formData.color,
        vin: formData.vin,
        plateNumber: formData.plateNumber,
        cardNumber: '',
      },
      recipientDetails: {
        name: formData.representativeName,
        idNumber: formData.representativeId,
        phoneNumber: formData.representativePhone,
        destination: formData.withdrawFrom,
      }
    });

    // Generate QR for Entry Permit
    const qrResultEntryPermit = await genQR({
      documentType: 'إذن استلام مخزني (دخول)',
      serialNumber: docSerialEntry,
      date: `${day} / ${month} / ${year} م`,
      orgName: settings.name || 'سما الفرسان للتجارة',
      orgCr: settings.commercialRegister || '',
      orgVat: settings.taxNumber || '',
      vehicleDetails: {
        brand: formData.brand,
        model: formData.model,
        year: String(formData.year),
        color: formData.color,
        vin: formData.vin,
        plateNumber: formData.plateNumber,
        cardNumber: '',
      },
      recipientDetails: {
        name: formData.representativeName,
        idNumber: formData.representativeId,
        phoneNumber: formData.representativePhone,
        destination: formData.withdrawFrom,
      }
    });

    // Dynamically build the salutation and representative clause depending on which fields are enabled
    const salutationHtml = showWithdrawFrom
      ? `<div class="salutation">السادة / <span class="underline-field" style="min-width: 250px;">${formData.withdrawFrom || ''}</span> <span class="salutation-suffix">المحترمين</span></div>`
      : `<div class="salutation">السادة المحترمين</div>`;

    const clauseParts: string[] = [];
    if (showTransportCompany) {
      clauseParts.push(`وتسليمها الى / <span class="underline-field" style="min-width: 250px;">${formData.transportCompany || ''}</span>`);
    }
    if (showRepresentativeName) {
      clauseParts.push(`ممثلة في / <span class="underline-field" style="min-width: 200px;">${formData.representativeName || ''}</span>`);
    }
    if (showRepresentativeId) {
      clauseParts.push(`رقم هوية / <span class="underline-field" style="min-width: 150px; font-family: monospace;">${formData.representativeId || ''}</span>`);
    }
    if (showRepresentativePhone) {
      clauseParts.push(`جوال رقم / <span class="underline-field" style="min-width: 130px; font-family: monospace;">${formData.representativePhone || ''}</span>`);
    }

    const clauseHtml = `
      <div class="clause-text">
        ترغب في سحب السيارات الموضحة بياناتها أعلاه
        ${clauseParts.length > 0 ? clauseParts.join(' &nbsp;&nbsp; ') : ''}
        <br/><br/>
        وهي تحت مسؤوليتنا من تاريخه لحين إصدار اللوحات والاستمارة حسب النظام المتبع ،،،
      </div>
    `;

    // Generating the Withdrawal Letter HTML
    const withdrawalHtml = `
      <html dir="rtl">
        <head>
          <title>خطاب سحب - ${formatVehicleDisplay({ brand: formData.brand, model: formData.model })}</title>
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
              padding: 0;
            }
            .outer-border {
              border: 3px solid #000;
              padding: 10mm 10mm;
              height: 262mm;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              position: relative;
            }
            .header-container {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 15px;
              position: relative;
            }
            .org-details {
              text-align: right;
              font-size: 10pt;
              font-weight: 700;
              line-height: 1.45;
              color: #000;
            }
            .org-details .org-title {
              font-size: 13pt;
              font-weight: 950;
              margin-bottom: 4px;
            }
            .logo-container {
              text-align: left;
              position: relative;
              left: -55px;
            }
            .logo-img {
              max-height: 240px;
              max-width: 410px;
              object-fit: contain;
              filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.06));
            }
            .document-title {
              text-align: center;
              font-size: 18pt;
              font-weight: 950;
              margin: 12px 0;
              text-decoration: underline;
              letter-spacing: 1px;
            }
            .date-section {
              text-align: right;
              font-size: 11pt;
              font-weight: 700;
              margin-bottom: 12px;
              padding-right: 15px;
            }
            .salutation {
              font-size: 11.5pt;
              font-weight: 900;
              margin-bottom: 12px;
              padding-right: 15px;
            }
            .salutation-suffix {
              margin-right: 25px;
              font-weight: 900;
            }
            .intro-text {
              font-size: 11pt;
              font-weight: 900;
              margin-bottom: 10px;
              padding-right: 15px;
            }
            .car-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 15px;
              direction: rtl;
            }
            .car-table th {
              border: 1.5pt solid #000;
              background-color: #f1f5f9 !important;
              -webkit-print-color-adjust: exact;
              color: #000;
              padding: 6px;
              font-size: 10.5pt;
              font-weight: 900;
              text-align: center;
            }
            .car-table td {
              border: 1.5pt solid #000;
              padding: 8px;
              font-size: 10pt;
              font-weight: 700;
              text-align: center;
              background-color: #fff;
            }
            .clause-text {
              font-size: 11pt;
              font-weight: 700;
              line-height: 1.6;
              margin-bottom: 15px;
              padding-right: 15px;
              text-align: justify;
            }
            .underline-field {
              display: inline-block;
              border-bottom: 1px dotted #000;
              min-width: 140px;
              text-align: center;
              font-weight: 900;
              padding: 0 5px;
            }
            .thanks-clause {
              text-align: center;
              font-size: 11.5pt;
              font-weight: 900;
              margin-bottom: 20px;
            }
            .footer-sign {
              display: flex;
              flex-direction: column;
              align-items: flex-start;
              padding-right: 30px;
              margin-top: auto;
              font-size: 11pt;
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
            .bottom-bar {
              position: absolute;
              bottom: 8px;
              left: 8px;
              right: 8px;
              background-color: #1e3a8a !important;
              color: #fff !important;
              text-align: center;
              padding: 6px;
              font-size: 9pt;
              font-weight: bold;
              -webkit-print-color-adjust: exact;
              border-radius: 4px;
            }
            
            @media print {
              html, body { height: 100%; overflow: hidden; margin: 0; padding: 0; }
              .outer-border { height: 100% !important; width: 100% !important; border: 3px solid #000 !important; padding: 10mm !important; box-sizing: border-box !important; page-break-inside: avoid; }
            }
            .logo, .logo-img, .header-logo, .logo-area, .logo-header img, .logo-container img { 
              width: ${settings.logoWidth !== undefined ? settings.logoWidth : 120}px !important;
              max-width: none !important;
              max-height: none !important;
              height: auto !important;
              position: relative !important;
              transform: translate(${settings.logoPosX !== undefined ? settings.logoPosX : 0}px, ${settings.logoPosY !== undefined ? settings.logoPosY : 0}px) !important;
            }
            ${getBilingualPrintHeaderCss()}
          </style>
        </head>
        <body>
          <div class="outer-border">
            ${getBilingualPrintHeaderHtml(settings)}
            
            <div class="document-title">(خطــــــــاب سحــــــــب)</div>

            <div class="date-section" style="display: flex; justify-content: space-between; align-items: center; padding-left: 20px;">
              <div>التاريخ: &nbsp;&nbsp;&nbsp;&nbsp; ${day} &nbsp;&nbsp; / &nbsp;&nbsp; ${month} &nbsp;&nbsp; / &nbsp;&nbsp; ${year} م</div>
              <div style="font-weight: bold; font-size: 11pt; color: #1e293b;">رقم الخطاب: ${docSerialWithdrawal}</div>
            </div>

            ${salutationHtml}

            <div class="intro-text">
              إليكم بيانات السيارة الآتية:
            </div>

            <table class="car-table">
              <thead>
                <tr>
                  <th style="width: 35%">نوع السيارة / الطراز</th>
                  <th style="width: 25%">الهيكل / الشاصي</th>
                  <th style="width: 20%">اللون</th>
                  <th style="width: 20%">الموديل</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${formatVehicleDisplay({ brand: formData.brand, model: formData.model })}</td>
                  <td style="font-family: monospace; font-size: 11pt;">${formData.vin}</td>
                  <td>${formData.color || '—'}</td>
                  <td>${formData.year || '—'}</td>
                </tr>
              </tbody>
            </table>

            ${(formData.plateNumber || formData.fuelType || formData.otherSpecs) ? `
            <table class="car-table" style="margin-top: -15px;">
              <thead>
                <tr>
                  ${formData.plateNumber ? '<th>رقم اللوحة</th>' : ''}
                  ${formData.fuelType ? '<th>نوع الوقود</th>' : ''}
                  ${formData.otherSpecs ? '<th>مواصفات إضافية</th>' : ''}
                </tr>
              </thead>
              <tbody>
                <tr>
                  ${formData.plateNumber ? `<td>${formData.plateNumber}</td>` : ''}
                  ${formData.fuelType ? `<td>${formData.fuelType}</td>` : ''}
                  ${formData.otherSpecs ? `<td>${formData.otherSpecs}</td>` : ''}
                </tr>
              </tbody>
            </table>
            ` : ''}

            ${clauseHtml}

            <div class="thanks-clause">
              ولكم جزيل الشكر والعرفان ،،،
            </div>

            <!-- DIGITAL VERIFICATION QR CODE -->
            ${getQRHtml(qrResultWithdrawal.qrCodeDataUrl, qrResultWithdrawal.fingerprint)}

            <div class="footer-sign">
              <div>${settings.orgType || 'مؤسسة'} ${settings.name || 'سما الفرسان للتجارة'}</div>
              <img src="${settings.stampUrl || getStampDataUri(settings.name ? `${settings.orgType || 'مؤسسة'} ${settings.name}` : undefined, settings.commercialRegister, settings.orgType)}" class="stamp-img" style="max-height: 120px; max-width: 120px; mix-blend-mode: multiply;" alt="الختم الرسمي لـ ${settings.orgType || 'المؤسسة'}" />
            </div>

            <div class="bottom-bar">
               نجران - الصناعية - هاتف: 0535557203 - 0569050505
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

    // Generating the Entry Permit HTML (إذن استلام مخزني للسيارات)
    const formattedEntryDate = `${day} / ${month} / ${year} م (${year}-${month}-${day})`;
    const entryPermitHtml = `
      <html dir="rtl">
        <head>
          <title>إذن استلام مخزني - ${formData.brand} ${formData.model}</title>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
          <style>
            @page { size: A4 portrait; margin: 10mm; }
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
              border: 3px solid #000;
            }
            
            .header { 
              display: flex; 
              justify-content: space-between; 
              align-items: flex-start; 
              margin-bottom: 2px; 
              border-bottom: 1.5px solid #1e3a8a;
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
              width: 200px;
            }
            .logo { 
              width: 120px; 
              height: auto;
              max-height: 55px;
              object-fit: contain;
              filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.06));
              position: relative;
            }
            
            .title-section { 
              text-align: center; 
              margin-top: 4px;
              margin-bottom: 4px;
              border: none;
              padding: 0;
            }
            .title { 
              font-size: 18pt; 
              font-weight: 900; 
              display: inline-block; 
              margin: 0;
            }
            
            .date-row { 
              margin-top: 0px;
              margin-bottom: 4px; 
              font-weight: 950; 
              font-size: 10pt; 
              color: #334155;
            }
            
            table { width: 100%; border-collapse: collapse; margin-bottom: 6px; table-layout: fixed; }
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
              padding-top: 4px;
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
                padding: 4mm 6mm !important; 
                box-sizing: border-box !important; 
                page-break-inside: avoid; 
              }
            }
            .logo, .logo-img, .header-logo, .logo-area, .logo-header img, .logo-container img { 
              width: ${settings.logoWidth !== undefined ? settings.logoWidth : 120}px !important;
              max-width: none !important;
              max-height: none !important;
              height: auto !important;
              position: relative !important;
              transform: translate(${settings.logoPosX !== undefined ? settings.logoPosX : 0}px, ${settings.logoPosY !== undefined ? settings.logoPosY : 0}px) !important;
            }
          </style>
        </head>
        <body>
          <div class="content-wrapper">
            <img src="${settings.logoUrl || getLogoDataUri(settings.name, settings.orgType)}" class="watermark" />
            
            <div class="header">
              <div class="header-info">
                <div>${settings.orgType || 'مؤسسة'} ${settings.name || 'سما الفرسان للتجارة'}</div>
                <div>سجل تجاري : ${settings.commercialRegister || '5950007763'}</div>
                <div>الرقم الضريبي : ${settings.taxNumber || '311804654800003'}</div>
                <div>رقم التواصل : ${settings.contactNumber || ''}</div>
                <div>${settings.address || 'نجران - الصناعية'}</div>
              </div>
              <div class="logo-header">
                <img src="${settings.logoUrl || getLogoDataUri(settings.name, settings.orgType)}" class="logo" />
              </div>
            </div>

            <div class="title-section">
              <h1 class="title">إذن دخول واستلام مخزني (تلقائي - خطاب سحب)</h1>
              <div style="font-size: 10pt; font-weight: bold; margin-top: 2px; color: #475569;">رقم المستند: ${docSerialEntry}</div>
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
                  <td>${formData.brand} ${formData.model}</td>
                  <td style="font-family: monospace;">${formData.vin}</td>
                  <td>${formData.color || '—'} / ${formData.year}</td>
                  <td>${formData.withdrawFrom || '—'}</td>
                  <td>${formData.transportCompany || '—'}</td>
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

            <!-- DEDICATED ENTRY NOTES BOX -->
            <div style="border: 1.5pt solid #000; border-radius: 4px; padding: 6px 10px; margin-top: 4px; margin-bottom: 4px; background-color: #f8fafc; text-align: right;">
              <div style="font-weight: 900; font-size: 10pt; color: #0f172a; margin-bottom: 2px; display: flex; justify-content: space-between; align-items: center;">
                <span>📝 ملحوظة دخول واستلام السيارة:</span>
                ${formData.representativeName ? `<span style="font-size: 9.5pt; color: #334155;">سائق الناقلة: <strong>${formData.representativeName}</strong></span>` : ''}
              </div>
              <div style="font-weight: 800; font-size: 9.5pt; color: #1e293b; line-height: 1.4; white-space: pre-wrap;">${formData.notes || 'تم استلام السيارة وحفظها بالمخزن بموجب خطاب السحب.'}</div>
            </div>

            ${(formData.plateNumber || formData.fuelType || formData.otherSpecs) ? `
            <div style="font-size: 9pt; font-weight: bold; margin-bottom: 6px; border: 1.5pt solid #000; padding: 6px 10px; background-color: #fff; line-height: 1.5; text-align: right;">
              <span style="border-bottom: 1px solid #000; padding-bottom: 1px; display: inline-block; margin-bottom: 4px; font-weight: 900;">مواصفات المركبة الإضافية المعتمدة:</span> <br/>
              ${formData.plateNumber ? `• <strong>رقم اللوحة:</strong> ${formData.plateNumber} &nbsp;&nbsp;&nbsp;&nbsp;` : ''}
              ${formData.fuelType ? `• <strong>نوع الوقود:</strong> ${formData.fuelType} &nbsp;&nbsp;&nbsp;&nbsp;` : ''}
              ${formData.otherSpecs ? `• <strong>مواصفات إضافية:</strong> ${formData.otherSpecs}` : ''}
            </div>
            ` : ''}

            <!-- DIGITAL VERIFICATION QR CODE (PUSHED DOWN TO FOOTER) -->
            <div style="margin-top: auto; padding-bottom: 2px; text-align: center;">
              ${getQRHtml(qrResultEntryPermit.qrCodeDataUrl, qrResultEntryPermit.fingerprint, { size: 68 })}
            </div>

            <div class="management-section">
              <span>ادارة المخزون :</span>
              <img src="${settings.stampUrl || getStampDataUri(settings.name ? `${settings.orgType || 'مؤسسة'} ${settings.name}` : undefined, settings.commercialRegister, settings.orgType)}" class="stamp-img-small" style="max-height: ${stampSize * 0.8}px; max-width: ${stampSize * 0.8}px; margin-top: ${stampY * 0.8}px; transform: translateX(${-stampX * 0.8}px); mix-blend-mode: multiply;" />
              <span>ادارة الحسابات :</span>
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

    // Construct the formatted car structure
    const newCarData = {
      brand: formData.brand,
      model: formData.model,
      year: formData.year,
      color: formData.color,
      vin: formData.vin,
      vinMatching: 'مطابق',
      cardNumber: 'خطاب سحب - لم يرد البطاقة',
      price: 0,
      costPrice: 0,
      supplier: `موقع آخر (${formData.withdrawFrom})`,
      ownershipType: OwnershipType.DIRECT,
      status: CarStatus.AVAILABLE,
      rentalStatus: RentalStatus.NOT_RENTED,
      isOutbound: false,
      isPresentInShowroom: false, // لم تأت المعرض بعد
      exitData: {
        receiverName: formData.representativeName,
        receiverId: formData.representativeId,
        receiverPhone: formData.representativePhone,
        deliveryType: DeliveryType.OWNER,
        exitDate: currentDate.toISOString().split('T')[0],
        transportCompany: formData.transportCompany || formData.withdrawFrom,
        notes: formData.notes
      },
      hasPlate: !!formData.plateNumber,
      plateData: { 
        plateNumber: formData.plateNumber || '', 
        ownerName: '', 
        serialNumber: '', 
        issueDate: currentDate.toISOString().split('T')[0] 
      },
      notes: formData.notes, // الملحوظة الأساسية القابلة للتعديل
      customData: {
        isWithdrawal: true,
        withdrawFrom: formData.withdrawFrom,
        transportCompany: formData.transportCompany,
        representativeName: formData.representativeName,
        representativeId: formData.representativeId,
        representativePhone: formData.representativePhone,
        fuelType: formData.fuelType,
        otherSpecs: formData.otherSpecs,
        isExternalManual: vehicleMode === 'external',
        showWithdrawFrom,
        showTransportCompany,
        showRepresentativeName,
        showRepresentativeId,
        showRepresentativePhone
      }
    };

    onSave(newCarData, withdrawalHtml, entryPermitHtml);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-2 sm:p-4 md:p-6 animate-in fade-in overflow-y-auto overscroll-contain">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] my-auto border border-white/10 text-right" dir="rtl">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-inner">
              <Truck size={20} className="sm:w-6 sm:h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-xl md:text-2xl font-black text-slate-800 dark:text-white">إضافة مركبـة بخطاب سحب رسمي</h3>
              <p className="text-[11px] sm:text-xs text-slate-400 font-bold mt-0.5">تسجيل مركبة مسحوبة من جهة أخرى وإصدار خطاب سحـب وإذن دخول تلقائي</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 sm:p-3 text-slate-400 hover:text-rose-500 transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={20} />
          </button>
        </div>

        {/* Modal Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          {error && (
            <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 p-4 rounded-2xl text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center gap-3">
              <ShieldAlert size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* Mode Selector */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-6">
            <div className="text-right">
              <h4 className="text-sm font-black text-slate-800 dark:text-slate-200">طريقة إدخال بيانات السيارة</h4>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-1">
                اختر ما إذا كان الخطاب لسيارة مسجلة بمخزون النظام أو سيارة خارجية تماماً يتم تسجيلها يدوياً
              </p>
            </div>
            
            <div className="bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl flex border border-slate-150 dark:border-slate-850 w-fit gap-1 font-sans shadow-inner">
              <button
                type="button"
                onClick={() => setVehicleMode('inventory')}
                className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all duration-300 ${
                  vehicleMode === 'inventory'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                مركبة من المخزون
              </button>
              <button
                type="button"
                onClick={() => setVehicleMode('external')}
                className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all duration-300 ${
                  vehicleMode === 'external'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                مركبة خارجية (إدخال يدوي)
              </button>
            </div>
          </div>

          {/* Quick Vehicle Search & Auto-Fill Section */}
          <div className="p-5 bg-gradient-to-br from-blue-50 to-white dark:from-slate-950/90 dark:to-slate-900 rounded-3xl border border-blue-105 dark:border-slate-850 space-y-4">
            <h4 className="text-sm font-black text-blue-850 dark:text-sky-400 border-r-4 border-blue-500 pr-2 flex items-center gap-2">
              <Search size={16} />
              <span>البحث عن مركبة وتعبئة المواصفات تلقائياً (اختياري)</span>
            </h4>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold leading-relaxed">
              {vehicleMode === 'external'
                ? "يمكنك استخدام شريط البحث لنسخ بيانات مركبة مماثلة لتوفير وقت الكتابة اليدوية، أو واصل تعبئة الحقول بالأسفل مباشرة."
                : "اكتب ماركة السيارة أو طرازها أو رقم الهيكل للبحث عنها في مخزون المعرض وتنزيل بياناتها بالكامل للخطاب حالاً."
              }
            </p>
            
            <div className="relative">
              <div className="relative">
                <input
                  type="text"
                  placeholder={vehicleMode === 'external' ? "ابحث لنسخ المواصفات تلقائياً (اختياري)..." : "ابحث عن مركبة بالمخزون للربط (إلزامي)..."}
                  className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-blue-500 font-bold text-xs dark:text-white"
                  value={searchCarQuery}
                  onChange={(e) => {
                    setSearchCarQuery(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Search size={16} />
                </div>
              </div>

              {isDropdownOpen && filteredCars.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar text-right">
                  {filteredCars.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectCar(item)}
                      className="w-full text-right p-3 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors"
                    >
                      <div className="flex flex-col">
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-100 font-sans">
                          {item.brand} {item.model} ({item.year})
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 font-bold">
                          الهيكل: {item.vin || '—'}
                        </span>
                      </div>
                      {item.color && (
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-lg font-bold">
                          {item.color}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              
              {isDropdownOpen && filteredCars.length === 0 && searchCarQuery && (
                <div className="absolute z-50 left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl p-4 text-center text-xs text-slate-400 font-bold">
                  {vehicleMode === 'external' 
                    ? "لا توجد مركبة مطابقة. يمكنك تعبئة البيانات يدوياً بالكامل في الحقول بالأسفل."
                    : "لا توجد مركبات تطابق البحث. يرجى اختيار مركبة من المخزن المستورد أو التبديل للوضع المدخل يدوياً بالأعلى."
                  }
                </div>
              )}
            </div>
          </div>

          {/* Section 1: Vehicle Information */}
          <div className="space-y-4">
            <h4 className="text-sm font-black text-slate-900 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-sky-400 dark:to-blue-500 border-r-4 border-blue-500 pr-3 flex items-center justify-between">
              <span>مواصفات المركبة المسحوبة</span>
              {vehicleMode === 'external' && (
                <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-full font-black font-sans">وضع الإدخال اليدوي نشط</span>
              )}
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <InputField 
                label="ماركة السيارة (إلزامي)" 
                value={formData.brand} 
                onChange={(v) => setFormData({ ...formData, brand: v })} 
                required 
                icon={Truck} 
                disabled={vehicleMode === 'inventory'}
              />
              <InputField 
                label="طراز السيارة" 
                value={formData.model} 
                onChange={(v) => setFormData({ ...formData, model: v })} 
                icon={Truck} 
                disabled={vehicleMode === 'inventory'}
              />
              <InputField 
                label="الموديل (سنة الصنع)" 
                type="number" 
                value={formData.year.toString()} 
                onChange={(v) => setFormData({ ...formData, year: parseInt(v) || 2026 })} 
                icon={Calendar} 
                disabled={vehicleMode === 'inventory'}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <InputField 
                label="اللون" 
                value={formData.color} 
                onChange={(v) => setFormData({ ...formData, color: v })} 
                icon={Palette} 
                disabled={vehicleMode === 'inventory'}
              />
              <InputField 
                label="رقم الهيكل / الشاصي (إلزامي)" 
                value={formData.vin} 
                onChange={(v) => setFormData({ ...formData, vin: v.toUpperCase() })} 
                required 
                icon={Hash} 
                disabled={vehicleMode === 'inventory'}
              />
              <InputField 
                label="رقم اللوحة (إن وجد)" 
                value={formData.plateNumber} 
                onChange={(v) => setFormData({ ...formData, plateNumber: v })} 
                icon={Hash} 
                disabled={vehicleMode === 'inventory'}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InputField 
                label="نوع الوقود" 
                value={formData.fuelType || ''} 
                onChange={(v) => setFormData({ ...formData, fuelType: v })} 
                icon={Sliders} 
                disabled={vehicleMode === 'inventory'}
              />
              <InputField 
                label="أي مواصفات إضافية" 
                value={formData.otherSpecs || ''} 
                onChange={(v) => setFormData({ ...formData, otherSpecs: v })} 
                icon={Settings} 
                disabled={vehicleMode === 'inventory'}
              />
            </div>
          </div>

          {/* Section 2: Retrieval & Representative Info */}
          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-black text-slate-900 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-sky-400 dark:to-blue-500 border-r-4 border-blue-500 pr-3">
                بيانات جهة السحب والمندوب المستلم
              </h4>
              <p className="text-[10px] text-slate-450 dark:text-slate-500 font-bold leading-relaxed">
                انقر على اسم الحقل بالأسفل لإخفائه أو إظهاره في الخطاب المطبوع والمعاينة الرسمية بشكل مستقل:
              </p>
            </div>

            {/* Individual Field Toggles */}
            <div className="flex flex-wrap gap-2 bg-slate-50 dark:bg-slate-950/40 p-3 rounded-2xl border border-slate-150 dark:border-slate-850">
              <button
                type="button"
                onClick={() => setShowWithdrawFrom(!showWithdrawFrom)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all duration-300 border ${
                  showWithdrawFrom
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-600 border-transparent opacity-60 line-through'
                }`}
              >
                {showWithdrawFrom ? '👁️ جهة السحب' : '🙈 جهة السحب (مخفي)'}
              </button>

              <button
                type="button"
                onClick={() => setShowTransportCompany(!showTransportCompany)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all duration-300 border ${
                  showTransportCompany
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-600 border-transparent opacity-60 line-through'
                }`}
              >
                {showTransportCompany ? '👁️ شركة النقليات' : '🙈 شركة النقليات (مخفي)'}
              </button>

              <button
                type="button"
                onClick={() => setShowRepresentativeName(!showRepresentativeName)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all duration-300 border ${
                  showRepresentativeName
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-600 border-transparent opacity-60 line-through'
                }`}
              >
                {showRepresentativeName ? '👁️ اسم المندوب' : '🙈 اسم المندوب (مخفي)'}
              </button>

              <button
                type="button"
                onClick={() => setShowRepresentativeId(!showRepresentativeId)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all duration-300 border ${
                  showRepresentativeId
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-600 border-transparent opacity-60 line-through'
                }`}
              >
                {showRepresentativeId ? '👁️ هوية المندوب' : '🙈 هوية المندوب (مخفي)'}
              </button>

              <button
                type="button"
                onClick={() => setShowRepresentativePhone(!showRepresentativePhone)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all duration-300 border ${
                  showRepresentativePhone
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-600 border-transparent opacity-60 line-through'
                }`}
              >
                {showRepresentativePhone ? '👁️ جوال المندوب' : '🙈 جوال المندوب (مخفي)'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
              {showWithdrawFrom && (
                <div className="animate-in slide-in-from-top-1 duration-200">
                  <InputField 
                    label="السادة / جهة السحب (الموقع أو الشركة المسحوب منها)" 
                    value={formData.withdrawFrom} 
                    onChange={(v) => setFormData({ ...formData, withdrawFrom: v })} 
                    icon={Truck} 
                  />
                </div>
              )}
              {showTransportCompany && (
                <div className="animate-in slide-in-from-top-1 duration-200">
                  <InputField 
                    label="شركة النقليات (وتسليمها الى)" 
                    value={formData.transportCompany} 
                    onChange={(v) => setFormData({ ...formData, transportCompany: v })} 
                    icon={Truck} 
                    suggestions={transportSuggestions}
                  />
                </div>
              )}
              {showRepresentativeName && (
                <div className="animate-in slide-in-from-top-1 duration-200">
                  <InputField 
                    label="اسم المستلم / المندوب (ممثلة في)" 
                    value={formData.representativeName} 
                    onChange={(v) => setFormData({ ...formData, representativeName: v })} 
                    icon={User} 
                    suggestions={representativeSuggestions}
                  />
                </div>
              )}
              {showRepresentativeId && (
                <div className="animate-in slide-in-from-top-1 duration-200">
                  <InputField 
                    label="رقم هوية المندوب المستلم" 
                    value={formData.representativeId} 
                    onChange={(v) => {
                      const updatedForm = { ...formData, representativeId: v };
                      if (v.trim()) {
                        const match = lookupCustomerById(v, cars);
                        if (match) {
                          if (match.phone) updatedForm.representativePhone = match.phone;
                          if (match.name && !updatedForm.representativeName) updatedForm.representativeName = match.name;
                        }
                      }
                      setFormData(updatedForm);
                    }} 
                    icon={Hash} 
                  />
                </div>
              )}
              {showRepresentativePhone && (
                <div className="animate-in slide-in-from-top-1 duration-200">
                  <InputField 
                    label="رقم جوال المندوب المستلم" 
                    value={formData.representativePhone} 
                    onChange={(v) => setFormData({ ...formData, representativePhone: v })} 
                  />
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Note */}
          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-sm font-black text-slate-900 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-sky-400 dark:to-blue-500 border-r-4 border-blue-500 pr-3">ملحوظة تظهر للمركبة بالنظام (قابلة للتعديل بأي وقت)</h4>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-2">ملاحظة الدخول والتحقق</label>
              <textarea 
                className="w-full p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-blue-500 font-bold text-right shadow-sm dark:text-white transition-all h-24"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="اكتب أي ملاحظات إضافية تخص التسليم أو حالة السحب..."
              />
            </div>
          </div>

          {/* قسم التحكم بمكان الختم */}
          <div className="p-5 bg-slate-50 dark:bg-slate-900/40 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h4 className="text-sm font-black text-slate-800 dark:text-slate-300 border-r-4 border-blue-500 pr-2 flex items-center gap-2">
              <Settings size={16} className="text-blue-500" />
              <span>التحكم في حجم ومكان الختم في الخطاب المطبوع</span>
            </h4>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold leading-relaxed">
              يمكنك تحريك الختم أفقياً ورأسياً وتكبيره أو تصغيره ليتناسب تماماً مع النص والتوقيعات في مستندات الطباعة.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 block">حجم الختم (بكسل)</label>
                <input
                  type="range"
                  min="50"
                  max="200"
                  value={stampSize}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setStampSize(val);
                    localStorage.setItem('letter_stamp_size', val.toString());
                  }}
                  className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="text-left font-mono text-[10px] font-black text-slate-500">{stampSize}px</div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 block">الإزاحة الأفقية (يمين / يسار)</label>
                <input
                  type="range"
                  min="-200"
                  max="200"
                  value={stampX}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setStampX(val);
                    localStorage.setItem('letter_stamp_x', val.toString());
                  }}
                  className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="text-left font-mono text-[10px] font-black text-slate-500">{stampX}px</div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 block">الإزاحة الرأسية (أعلى / أسفل)</label>
                <input
                  type="range"
                  min="-100"
                  max="200"
                  value={stampY}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setStampY(val);
                    localStorage.setItem('letter_stamp_y', val.toString());
                  }}
                  className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="text-left font-mono text-[10px] font-black text-slate-500">{stampY}px</div>
              </div>
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="p-8 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-4 bg-slate-50 dark:bg-slate-950/80">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-6 py-3 font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all"
          >
            إلغاء
          </button>
          <button 
            type="button" 
            onClick={handleSubmit} 
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-lg hover:shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
          >
            <Printer size={18} />
            <span>تسجيل وطباعة وحفظ الكترونياً</span>
          </button>
        </div>
      </div>
    </div>
  );
};
