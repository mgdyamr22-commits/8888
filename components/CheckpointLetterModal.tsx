import React, { useState, useMemo } from 'react';
import { X, FileText, Printer, User, Calendar, Palette, Hash, ShieldAlert, Truck, Shield, Search, ChevronDown, Settings } from 'lucide-react';
import { Car, OrganizationSettings, formatVehicleDisplay } from '../types';
import { getLogoDataUri, getStampDataUri } from './OfficialAssets';
import { lookupCustomerById } from '../services/customerLookupService';
import { getBilingualPrintHeaderHtml, getBilingualPrintHeaderCss } from '../src/utils/printHeaderHelper';

interface CheckpointLetterModalProps {
  settings: OrganizationSettings;
  cars?: Car[];
  car?: Car;
  selectedVehicles?: Car[];
  onClose: () => void;
  onSave: (letterHtml: string, info: { brand: string; model: string; year: string; vin: string; driverName: string; transitTo: string }) => void;
}

export const CheckpointLetterModal: React.FC<CheckpointLetterModalProps> = ({ settings, cars = [], car, selectedVehicles, onClose, onSave }) => {
  // Capture current dates
  const currentDate = settings.exitPermitDateType === 'custom' && settings.exitPermitCustomDate
    ? new Date(settings.exitPermitCustomDate)
    : new Date();
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
  const day = String(currentDate.getDate()).padStart(2, '0');

  const [formData, setFormData] = useState({
    dateStr: `${day} / ${month} / ${year} م`,
    companyName: settings.name ? `${settings.orgType || 'مؤسسة'} ${settings.name}` : `${settings.orgType || 'مؤسسة'} سما الفرسان للتجارة`,
    commercialRegister: settings.commercialRegister || '٥٩٥٠٠٧٧٦٣',
    taxNumber: settings.taxNumber || '٣١١٨٠٤٦٥٤٨٠٠٠٠٣',
    contactNumber: settings.contactNumber || '+966 500 000 000',
    title: 'خطاب شحن / نقل سيارة الى من يهمه الأمر : نقاط التفتيش',
    message: 'السلام عليكم ورحمه الله وبركاته وبعد ...... نفيدكم نحن معرض سما الفرسان للسيارات بنجران بتحميل السيارة ومواصفاتها الاتية',
    
    // Vehicle specifications
    brand: car?.brand || '',
    model: car?.model || '',
    year: car?.year?.toString() || '2026',
    color: car?.color || '',
    vin: car?.vin || '',
    
    // Driver & Transit details
    driverName: car?.exitData?.receiverName || '',
    idNumber: car?.exitData?.receiverId || '',
    transitFrom: 'نجران',
    transitTo: car?.customData?.entryTransportCompany || car?.exitData?.transportCompany || '',
  });

  const [error, setError] = useState<string | null>(null);

  const driverSuggestions = useMemo(() => {
    const list: string[] = [];
    cars.forEach(c => {
      if (c.customData?.entryDriverName) list.push(c.customData.entryDriverName);
      if (c.exitData?.receiverName) list.push(c.exitData.receiverName);
    });
    return Array.from(new Set(list)).filter(Boolean);
  }, [cars]);

  const finalCarsList = selectedVehicles && selectedVehicles.length > 0
    ? selectedVehicles
    : [{
        brand: formData.brand,
        model: formData.model,
        year: parseInt(formData.year) || 2026,
        color: formData.color,
        vin: formData.vin,
      }];
  
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
  
  // Custom vehicle search controls
  const [searchCarQuery, setSearchCarQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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
      year: selected.year?.toString() || '',
      color: selected.color || '',
      vin: selected.vin || '',
      driverName: selected.exitData?.receiverName || '',
      idNumber: selected.exitData?.receiverId || '',
      transitTo: selected.customData?.entryTransportCompany || selected.exitData?.transportCompany || ''
    }));
    setSearchCarQuery(`${selected.brand} ${selected.model} (الهيكل: ${selected.vin || ''})`);
    setIsDropdownOpen(false);
  };

  const handlePrint = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const finalCarsList = selectedVehicles && selectedVehicles.length > 0
      ? selectedVehicles
      : [{
          brand: formData.brand,
          model: formData.model,
          year: parseInt(formData.year) || 2026,
          color: formData.color,
          vin: formData.vin,
        }];

    if (finalCarsList.length === 0 || (!selectedVehicles && (!formData.brand || !formData.model || !formData.vin))) {
      setError('يرجى ملء مواصفات المركبة الأساسية (نوع السيارة ورقم الهيكل)');
      return;
    }

    const { generateQrCodeDataUrl: genQR, getEmbeddedQrHtml: getQRHtml } = await import('../src/utils/qrHelper');
    const { getDocumentSerial } = await import('../src/utils/documentSerialManager');
    const docSerial = getDocumentSerial('checkpoint_letter', (finalCarsList[0] as any)?.id || finalCarsList[0]?.vin || '');

    const qrResult = await genQR({
      documentType: 'خطاب نقاط التفتيش (إلى من يهمه الأمر)',
      serialNumber: docSerial,
      date: formData.dateStr,
      orgName: settings.name || 'سما الفرسان للتجارة',
      orgCr: settings.commercialRegister || '',
      orgVat: settings.taxNumber || '',
      vehicleDetails: {
        brand: finalCarsList[0]?.brand || '',
        model: finalCarsList[0]?.model || '',
        year: String(finalCarsList[0]?.year || ''),
        color: finalCarsList[0]?.color || '',
        vin: finalCarsList[0]?.vin || '',
        plateNumber: '',
        cardNumber: '',
      },
      recipientDetails: {
        name: formData.driverName,
        idNumber: formData.idNumber,
        phoneNumber: '',
        destination: formData.transitTo,
      }
    });

    const htmlContent = `
      <html dir="rtl">
        <head>
          <title>خطاب نقاط التفتيش - ${selectedVehicles && selectedVehicles.length > 1 ? 'مركبات متعددة ومجمعة' : formData.brand + ' ' + formData.model}</title>
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
              padding: 12mm 10mm;
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
              margin-bottom: 12px;
              padding-bottom: 8px;
              border-bottom: 1.5px solid #1e3a8a;
              position: relative;
            }
            .org-details {
              text-align: right;
              font-size: 11.5pt;
              font-weight: 700;
              line-height: 1.6;
              color: #000;
            }
            .org-details .org-title {
              font-size: 15pt;
              font-weight: 950;
              margin-bottom: 4px;
            }
            .logo-container {
              text-align: left;
              position: relative;
              left: -55px;
            }
            .logo-img {
              max-height: 145px;
              max-width: 270px;
              object-fit: contain;
              filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.06));
            }
            .basmala {
              text-align: center;
              font-size: 15pt;
              font-weight: bold;
              margin: 10px 0 5px 0;
            }
            .date-sec {
              text-align: right;
              font-size: 12pt;
              font-weight: bold;
              margin-bottom: 12px;
              padding-right: 10px;
            }
            .document-title {
              text-align: center;
              font-size: 17pt;
              font-weight: 950;
              margin: 10px 0 15px 0;
              text-decoration: underline;
              text-underline-offset: 6px;
            }
            .intro-text {
              font-size: 12.5pt;
              font-weight: 700;
              line-height: 1.8;
              margin-bottom: 25px;
              text-align: justify;
              padding: 0 10px;
            }
            .car-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
              direction: rtl;
            }
            .car-table th {
              border: 1.5pt solid #000;
              background-color: #fff !important;
              -webkit-print-color-adjust: exact;
              color: #000;
              padding: 12px;
              font-size: 12.5pt;
              font-weight: 900;
              text-align: center;
            }
            .car-table td {
              border: 1.5pt solid #000;
              padding: 15px 12px;
              font-size: 12pt;
              font-weight: 700;
              text-align: center;
              background-color: #fff;
            }
            .driver-section {
              font-size: 13pt;
              font-weight: bold;
              line-height: 2.2;
              margin-bottom: 45px;
              padding: 0 10px;
            }
            .underline-field {
              display: inline-block;
              border-bottom: 1.5px solid #000;
              min-width: 220px;
              text-align: center;
              font-weight: 900;
              padding: 0 5px;
            }
            .footer-sign {
              display: flex;
              flex-direction: column;
              align-items: center;
              margin-top: auto;
              align-self: flex-end;
              padding-left: 20px;
              font-size: 13pt;
              font-weight: 900;
              position: relative;
              width: 240px;
              text-align: center;
            }
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
              opacity: 0.25; 
              width: 70%; 
              pointer-events: none; 
              z-index: 9999; 
            }
            .outer-border {
              position: relative !important;
              z-index: 10 !important;
            }
            @media print {
              html, body { height: 100%; overflow: hidden; margin: 0; padding: 0; }
              .outer-border {
                height: 100% !important;
                width: 100% !important;
                border: 3px solid #000 !important;
                padding: 12mm 10mm !important;
                box-sizing: border-box !important;
                page-break-inside: avoid;
              }
            }
            .logo, .logo-img, .header-logo, .logo-area, .logo-header img, .logo-container img, .bilingual-logo, .bilingual-logo-img { 
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
            <img src="${settings.logoUrl || getLogoDataUri(settings.name, settings.orgType)}" class="watermark" alt="شعار الخلفية" />
            ${getBilingualPrintHeaderHtml(settings)}
            
            <div class="basmala">بسم الله الرحمن الرحيم</div>

            <div class="date-sec" style="display: flex; justify-content: space-between; align-items: center;">
              <div>التاريخ: &nbsp;&nbsp;&nbsp;&nbsp; <span style="font-family: monospace; font-size: 12.5pt;">${formData.dateStr}</span></div>
              <div style="font-weight: bold; font-size: 12.5pt; color: #1e293b;">رقم الخطاب: &nbsp; <span style="font-family: monospace;">${docSerial}</span></div>
            </div>

            <div class="document-title">${formData.title}</div>

            <div class="intro-text">
              ${formData.message}
            </div>

            <table class="car-table">
              <thead>
                <tr>
                  <th style="width: 30%">نوع السيارة</th>
                  <th style="width: 30%">رقم الهيكل</th>
                  <th style="width: 20%">موديل السيارة</th>
                  <th style="width: 20%">اللون</th>
                </tr>
              </thead>
              <tbody>
                ${finalCarsList.map(item => `
                  <tr>
                    <td>${formatVehicleDisplay(item)}</td>
                    <td style="font-family: monospace; font-size: 11.5pt; letter-spacing: 0.5px;">${item.vin || '—'}</td>
                    <td>${item.year || '—'}</td>
                    <td>${item.color || '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="driver-section">
              مع سائق السطحه: <span class="underline-field">${formData.driverName || ''}</span> &nbsp;&nbsp;&nbsp;&nbsp; أقامة رقم: <span class="underline-field" style="font-family: monospace;">${formData.idNumber || ''}</span> <br/>
              من نجران الى: <span class="underline-field">${formData.transitTo || ''}</span>
            </div>

            <!-- DIGITAL VERIFICATION QR CODE -->
            ${getQRHtml(qrResult.qrCodeDataUrl, qrResult.fingerprint)}

            <div class="footer-sign">
              <div>${formData.companyName}</div>
              <img src="${settings.stampUrl || getStampDataUri(settings.name ? `${settings.orgType || 'مؤسسة'} ${settings.name}` : undefined, settings.commercialRegister, settings.orgType)}" class="stamp-img" alt="الختم الرسمي" />
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
      driverName: formData.driverName,
      transitTo: formData.transitTo
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-2 sm:p-4 md:p-6 animate-in fade-in overflow-y-auto overscroll-contain">
      <div className="bg-white dark:bg-slate-900 w-full max-w-6xl rounded-2xl sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] my-auto border border-white/10 text-right" dir="rtl">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-inner">
              <Shield size={20} className="sm:w-6 sm:h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-xl md:text-2xl font-black text-slate-800 dark:text-white">إصدار خطاب نقاط التفتيش الرسمي</h3>
              <p className="text-[11px] sm:text-xs text-slate-400 font-bold mt-0.5">تعديل وتحرير بيانات خطاب شحن ونقل السيارة لنقاط التفتيش الأمني والتحميل</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 sm:p-3 text-slate-400 hover:text-rose-500 transition-colors rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={20} />
          </button>
        </div>

        {/* Modal Main Grid */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          
          {/* Left Side: Live Preview Layout (Classic Arabic Blueprint Mock) */}
          <div className="lg:col-span-6 bg-slate-100 dark:bg-slate-950/40 p-6 overflow-y-auto hidden lg:flex flex-col justify-start items-center border-l border-slate-200 dark:border-slate-800 custom-scrollbar">
            <div className="text-xs font-black text-slate-400 self-start mb-3 uppercase tracking-wider">معاينة تفاعلية حية (A4)</div>
            
            {/* The Printed Layout Template Mini-View */}
            <div className="aspect-[1/1.414] w-[450px] bg-white text-black p-8 shadow-md rounded-lg border-2 border-slate-300 relative select-none font-sans text-[10px]" style={{ direction: 'rtl' }}>
              <div className="border border-black p-4 h-full flex flex-col justify-between">
                
                {/* Header info */}
                <div className="flex justify-between items-start">
                  <div className="text-right leading-tight">
                    <div className="font-bold text-[11px]">{formData.companyName}</div>
                    <div className="text-[8px] text-slate-700">سجل تجاري: {formData.commercialRegister}</div>
                    <div className="text-[8px] text-slate-700">الرقم الضريبي: {formData.taxNumber}</div>
                    <div className="text-[8px] text-slate-700 font-sans">رقم التواصل: {formData.contactNumber}</div>
                  </div>
                  <div>
                    <img src={settings.logoUrl || getLogoDataUri(settings.name)} className="h-20 object-contain" alt="Logo" />
                  </div>
                </div>

                <div className="text-center font-bold text-[11px] mt-2">بسم الله الرحمن الرحيم</div>

                <div className="text-right mt-1">
                  التاريخ: <span className="font-mono font-bold text-[10px]">{formData.dateStr}</span>
                </div>

                <div className="text-center font-black text-[12px] underline my-2 decoration-1">{formData.title}</div>

                <div className="text-justify leading-relaxed font-semibold text-[10px] mb-2 px-1">
                  {formData.message}
                </div>

                {/* Table for Car specs */}
                <div className="overflow-x-auto custom-scrollbar w-full">
                <table className="w-full border-collapse my-2 text-center text-[9px]">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-black p-1 font-bold">نوع السيارة</th>
                      <th className="border border-black p-1 font-bold">رقم الهيكل</th>
                      <th className="border border-black p-1 font-bold">موديل السيارة</th>
                      <th className="border border-black p-1 font-bold">اللون</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finalCarsList.map((item, idx) => (
                      <tr key={idx}>
                        <td className="border border-black p-1 text-center bg-white font-bold">{formatVehicleDisplay(item)}</td>
                        <td className="border border-black p-1 text-center bg-white font-mono text-[8.5px]">{item.vin || '—'}</td>
                        <td className="border border-black p-1 text-center bg-white font-bold">{item.year || '—'}</td>
                        <td className="border border-black p-1 text-center bg-white font-bold">{item.color || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>

                {/* Driver / Transit */}
                <div className="leading-loose font-bold mt-2 text-[10px]">
                  <div>مع سائق السطحه: <span className="border-b border-black inline-block min-width-[120px] text-center px-1">{formData.driverName || ''}</span> &nbsp;&nbsp; أقامه رقم: <span className="border-b border-black inline-block min-width-[120px] text-center font-mono px-1">{formData.idNumber || ''}</span></div>
                  <div className="mt-1">من نجران الى: <span className="border-b border-black inline-block min-width-[150px] text-center px-1">{formData.transitTo || ''}</span></div>
                </div>

                {/* Seal space */}
                <div className="flex flex-col items-center align-self-end mt-auto pl-4 text-center">
                  <div className="font-bold text-[10px]">{formData.companyName}</div>
                  <img 
                    src={settings.stampUrl || getStampDataUri(settings.name ? `${settings.orgType || 'مؤسسة'} ${settings.name}` : undefined, settings.commercialRegister, settings.orgType)} 
                    className="object-contain mt-1 transition-all" 
                    style={{ 
                      mixBlendMode: 'multiply',
                      height: `${stampSize * 0.5}px`,
                      width: `${stampSize * 0.5}px`,
                      transform: `translate(${-stampX * 0.5}px, ${stampY * 0.5}px)`
                    }} 
                    alt="Seal" 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: The Editing Form (Inputs) */}
          <div className="lg:col-span-6 p-6 overflow-y-auto space-y-6 custom-scrollbar text-right">
            
            {error && (
              <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 p-4 rounded-2xl text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center gap-3">
                <ShieldAlert size={18} />
                <span>{error}</span>
              </div>
            )}

            {/* Quick Vehicle Search & Auto-Fill Section */}
            <div className="p-5 bg-gradient-to-br from-sky-50 to-white dark:from-slate-950/90 dark:to-slate-900 rounded-3xl border border-sky-100 dark:border-slate-850 space-y-4">
              <h4 className="text-sm font-black text-sky-800 dark:text-sky-400 border-r-4 border-sky-500 pr-2 flex items-center gap-2">
                <Search size={16} />
                <span>اختيار مركبة وتعبئة مواصفاتها تلقائياً</span>
              </h4>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold leading-relaxed">
                يمكنك كتابة اسم الماركة، الطراز، أو جزء من رقم الهيكل للبحث والاختيار. ستقوم هذه الخطوة بتعبئة بيانات السيارة والمعلمة في التقرير مع إبقاء ترويسة وهوية الخطاب دون تغيير.
              </p>
              
              <div className="relative">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="ابحث عن مركبة... (مثال: تويوتا، لاندكروزر)"
                    className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-sky-500 font-bold text-xs dark:text-white"
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
                            {formatVehicleDisplay(item)} ({item.year})
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
                    لا توجد مركبات تطابق البحث... يمكنك كتابة المواصفات يدوياً أدناه.
                  </div>
                )}
              </div>
            </div>

            {/* Section 1: Official Header Customization */}
            <div className="p-5 bg-slate-50 dark:bg-slate-950/80 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
               <h4 className="text-xs font-black text-slate-900 dark:text-sky-400 border-r-4 border-sky-500 pr-2">تخصيص ترويسة الخطاب وهويته الرسمية</h4>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase">اسم المؤسسة / الشركة</label>
                    <input 
                      type="text" 
                      className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-sky-500 font-bold text-xs dark:text-white"
                      value={formData.companyName} 
                      onChange={e => setFormData({...formData, companyName: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase">تاريخ الخطاب</label>
                    <input 
                      type="text" 
                      className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-sky-500 font-bold text-xs dark:text-white"
                      value={formData.dateStr} 
                      onChange={e => setFormData({...formData, dateStr: e.target.value})} 
                    />
                  </div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase">السجل التجاري (C.R)</label>
                    <input 
                      type="text" 
                      className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-sky-500 font-bold text-xs dark:text-white"
                      value={formData.commercialRegister} 
                      onChange={e => setFormData({...formData, commercialRegister: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase">الرقم الضريبي (VAT)</label>
                    <input 
                      type="text" 
                      className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-sky-500 font-bold text-xs dark:text-white"
                      value={formData.taxNumber} 
                      onChange={e => setFormData({...formData, taxNumber: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase">رقم التواصل</label>
                    <input 
                      type="text" 
                      className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-sky-500 font-bold text-xs dark:text-white"
                      value={formData.contactNumber} 
                      onChange={e => setFormData({...formData, contactNumber: e.target.value})} 
                    />
                  </div>
               </div>
            </div>

            {/* Section 2: Core Headers & Texts */}
            <div className="p-5 bg-slate-50 dark:bg-slate-950/80 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
              <h4 className="text-xs font-black text-slate-900 dark:text-sky-400 border-r-4 border-sky-500 pr-2">تحرير محتويات الخطاب ونصه</h4>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase">عنوان الخطاب الرئيسي</label>
                <input 
                  type="text" 
                  className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-sky-500 font-bold text-xs dark:text-white"
                  value={formData.title} 
                  onChange={e => setFormData({...formData, title: e.target.value})} 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase">خطاب التقديم والترحيب (المتن)</label>
                <textarea 
                  className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-sky-500 font-bold text-xs dark:text-white h-20 resize-none"
                  value={formData.message} 
                  onChange={e => setFormData({...formData, message: e.target.value})} 
                />
              </div>
            </div>

            {/* Section 3: Car Specifications */}
            {selectedVehicles && selectedVehicles.length > 1 ? (
              <div className="p-5 bg-amber-500/10 border border-amber-500/25 rounded-2xl space-y-4">
                <h4 className="text-sm font-black text-amber-600 dark:text-amber-400 border-r-4 border-amber-500 pr-2">
                  قائمة المركبات في الخطاب المجمع ({selectedVehicles.length} مركبة)
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                  {selectedVehicles.map((c, i) => (
                    <div key={i} className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-150 dark:border-slate-800 text-xs flex justify-between items-center">
                      <div>
                        <span className="font-bold text-slate-800 dark:text-white block">{c.brand} {c.model} ({c.year})</span>
                        <span className="text-[10px] text-slate-400 font-mono">الهيكل: {c.vin || '—'}</span>
                      </div>
                      {c.color && (
                        <span className="text-[10px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2 py-1 rounded font-black">
                          {c.color}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-5 bg-slate-50 dark:bg-slate-950/80 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                <h4 className="text-xs font-black text-slate-900 dark:text-sky-400 border-r-4 border-sky-500 pr-2">مواصفات المركبة المشحونة</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase">الماركة (الشركة المصنعة)</label>
                      <input 
                        type="text" 
                        className="w-full p-3 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl outline-none dark:text-slate-400 font-bold text-xs cursor-not-allowed"
                        value={formData.brand} 
                        onChange={e => setFormData({...formData, brand: e.target.value})} 
                        required
                        disabled={true}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase">الطراز (الموديل)</label>
                      <input 
                        type="text" 
                        className="w-full p-3 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl outline-none dark:text-slate-400 font-bold text-xs cursor-not-allowed"
                        value={formData.model} 
                        onChange={e => setFormData({...formData, model: e.target.value})} 
                        required
                        disabled={true}
                      />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase">سنة الصنع (الموديل)</label>
                      <input 
                        type="text" 
                        className="w-full p-3 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl outline-none dark:text-slate-400 font-bold text-xs cursor-not-allowed"
                        value={formData.year} 
                        onChange={e => setFormData({...formData, year: e.target.value})} 
                        disabled={true}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase">اللون الخارجي</label>
                      <input 
                        type="text" 
                        className="w-full p-3 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl outline-none dark:text-slate-400 font-bold text-xs cursor-not-allowed"
                        value={formData.color} 
                        onChange={e => setFormData({...formData, color: e.target.value})} 
                        disabled={true}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase">رقم الهيكل / الشاصي</label>
                      <input 
                        type="text" 
                        className="w-full p-3 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl outline-none dark:text-slate-400 font-bold text-xs cursor-not-allowed"
                        value={formData.vin} 
                        onChange={e => setFormData({...formData, vin: e.target.value.toUpperCase()})} 
                        required
                        disabled={true}
                      />
                    </div>
                </div>
              </div>
            )}

            {/* Section 4: Carrier & Logistics */}
            <div className="p-5 bg-slate-50 dark:bg-slate-950/80 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
              <h4 className="text-xs font-black text-slate-900 dark:text-sky-400 border-r-4 border-sky-500 pr-2">بيانات وسيلة النقل وسائق السطحة</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase">اسم سائق السطحة</label>
                    <input 
                      type="text" 
                      list="checkpoint-driver-suggestions"
                      className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-sky-500 font-bold text-xs dark:text-white"
                      value={formData.driverName} 
                      onChange={e => setFormData({...formData, driverName: e.target.value})} 
                      placeholder="حسين محمد..."
                    />
                    <datalist id="checkpoint-driver-suggestions">
                      {driverSuggestions.map((d, i) => (
                        <option key={i} value={d} />
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase">رقم الإقامة / الهوية</label>
                    <input 
                      type="text" 
                      className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-sky-500 font-bold text-xs dark:text-white font-mono"
                      value={formData.idNumber} 
                      onChange={e => {
                        const val = e.target.value;
                        const updated = { ...formData, idNumber: val };
                        if (val.trim()) {
                          const match = lookupCustomerById(val, cars);
                          if (match) {
                            if (match.name && !updated.driverName) updated.driverName = match.name;
                          }
                        }
                        setFormData(updated);
                      }} 
                      placeholder="٢٣٤٨٩٩..."
                    />
                  </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase">خط السير من</label>
                    <input 
                      type="text" 
                      className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-sky-500 font-bold text-xs dark:text-white"
                      value={formData.transitFrom} 
                      onChange={e => setFormData({...formData, transitFrom: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase">خط السير والوجهة إلى</label>
                    <input 
                      type="text" 
                      className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-sky-500 font-bold text-xs dark:text-white"
                      value={formData.transitTo} 
                      onChange={e => setFormData({...formData, transitTo: e.target.value})} 
                      placeholder="معرض سما الفرسان للتجارة بنجران..."
                    />
                  </div>
              </div>
            </div>

            {/* قسم التحكم بمكان الختم */}
            <div className="p-5 bg-slate-50 dark:bg-slate-900/40 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
              <h4 className="text-sm font-black text-slate-800 dark:text-slate-300 border-r-4 border-slate-500 pr-2 flex items-center gap-2">
                <Settings size={16} className="text-sky-500" />
                <span>التحكم في حجم ومكان الختم في الخطاب</span>
              </h4>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold leading-relaxed">
                يمكنك تحريك الختم أفقياً ورأسياً وتكبيره أو تصغيره ليتناسب تماماً مع النص والتوقيعات في الخطاب المطبوع.
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
                    className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-600"
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
                    className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-600"
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
                    className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-600"
                  />
                  <div className="text-left font-mono text-[10px] font-black text-slate-500">{stampY}px</div>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-950/80">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-6 py-3 font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all"
          >
            إلغاء وإغلاق
          </button>
          <button 
            type="button" 
            onClick={handlePrint} 
            className="px-8 py-3 bg-sky-600 hover:bg-sky-700 text-white font-black rounded-2xl shadow-lg hover:shadow-sky-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
          >
            <Printer size={18} />
            <span>طباعة الخطاب وحفظه رسمياً</span>
          </button>
        </div>
      </div>
    </div>
  );
};
