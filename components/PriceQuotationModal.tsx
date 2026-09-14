import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Printer, FileText, DollarSign, Calendar, Clock, 
  Building2, UserCheck, ShieldCheck, CreditCard, Plus, Trash2,
  Check, RefreshCw, Sparkles, Layers, Info, Edit3
} from 'lucide-react';
import { Car, OrganizationSettings, User, Delegate, formatVehicleDisplay } from '../types';
import { getLogoDataUri, getStampDataUri } from './OfficialAssets';
import { getBilingualPrintHeaderHtml, getBilingualPrintHeaderCss } from '../src/utils/printHeaderHelper';
import { getCleanDelegateName, getRepresentativeOrSeller, getReservationRepresentative } from './CarManager';

interface BankAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  iban: string;
}

interface PriceQuotationModalProps {
  settings: OrganizationSettings;
  car: Car;
  currentUser: User | null;
  users?: User[];
  delegates?: Delegate[];
  onClose: () => void;
  onPrintAndArchive: (htmlContent: string, quoteInfo: {
    quotationNumber: string;
    quotationDate: string;
    clientName: string;
    representativeName: string;
    finalTotal: number;
    vin: string;
    brand: string;
    model: string;
  }) => void;
}

// Arabic Tafqeet (Number to Arabic Words converter)
export function tafqeetArabic(numberInput: number | string): string {
  const num = typeof numberInput === 'number' ? numberInput : parseFloat(numberInput) || 0;
  if (isNaN(num) || num === 0) return 'صفر ريال سعودي فقط لا غير';

  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة'];
  const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

  function convertGroup(n: number): string {
    let result = '';
    const h = Math.floor(n / 100);
    const rem = n % 100;
    const t = Math.floor(rem / 10);
    const u = rem % 10;

    if (h > 0) {
      result += hundreds[h];
    }

    if (rem > 0) {
      if (result) result += ' و';
      if (rem >= 10 && rem <= 19) {
        result += teens[rem - 10];
      } else if (t > 0 && u === 0) {
        result += tens[t];
      } else if (t > 0 && u > 0) {
        result += `${ones[u]} و${tens[t]}`;
      } else if (u > 0) {
        result += ones[u];
      }
    }

    return result;
  }

  const integerPart = Math.floor(Math.abs(num));
  const decimalPart = Math.round((Math.abs(num) - integerPart) * 100);

  let parts: string[] = [];

  // Billions
  const billions = Math.floor(integerPart / 1000000000);
  const remBillions = integerPart % 1000000000;

  // Millions
  const millions = Math.floor(remBillions / 1000000);
  const remMillions = remBillions % 1000000;

  // Thousands
  const thousands = Math.floor(remMillions / 1000);
  const remainder = remMillions % 1000;

  if (billions > 0) {
    if (billions === 1) parts.push('مليار');
    else if (billions === 2) parts.push('ملياران');
    else if (billions >= 3 && billions <= 10) parts.push(`${convertGroup(billions)} مليارات`);
    else parts.push(`${convertGroup(billions)} مليار`);
  }

  if (millions > 0) {
    if (millions === 1) parts.push('مليون');
    else if (millions === 2) parts.push('مليونان');
    else if (millions >= 3 && millions <= 10) parts.push(`${convertGroup(millions)} ملايين`);
    else parts.push(`${convertGroup(millions)} مليون`);
  }

  if (thousands > 0) {
    if (thousands === 1) parts.push('ألف');
    else if (thousands === 2) parts.push('ألفان');
    else if (thousands >= 3 && thousands <= 10) parts.push(`${convertGroup(thousands)} آلاف`);
    else parts.push(`${convertGroup(thousands)} ألف`);
  }

  if (remainder > 0) {
    parts.push(convertGroup(remainder));
  }

  let words = parts.join(' و');
  if (!words) words = 'صفر';

  let currencyStr = `${words} ريال سعودي`;

  if (decimalPart > 0) {
    const decimalWords = convertGroup(decimalPart);
    currencyStr += ` و${decimalWords} هللة`;
  }

  return `${currencyStr} فقط لا غير`;
}

export const PriceQuotationModal: React.FC<PriceQuotationModalProps> = ({
  settings,
  car,
  currentUser,
  users = [],
  delegates = [],
  onClose,
  onPrintAndArchive
}) => {
  // Capture current date
  const today = new Date().toISOString().split('T')[0];

  // Auto-detect representative name
  const autoRepresentative = useMemo(() => {
    // 1. Try reservation note or status note
    const repNote = getReservationRepresentative(car);
    if (repNote && repNote !== '-' && repNote !== 'عام') return repNote;

    // 2. Try seller or exit data
    const seller = getRepresentativeOrSeller(car);
    if (seller && seller !== '-' && seller !== 'عام') return seller;

    // 3. Fallback to current logged in user
    return currentUser?.fullName || currentUser?.username || 'admin';
  }, [car, currentUser]);

  // Initial quotation number Q-YYYYMM-XXXX
  const defaultQuotationNo = useMemo(() => {
    const d = new Date();
    const yyyymm = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `Q-${yyyymm}-${rand}`;
  }, []);

  // Pricing calculations: Car price or default
  const initialCarPrice = Number(car.price) || 0;
  // If price includes VAT, calculate base or take directly
  const initialBasePrice = initialCarPrice > 0 ? Math.round(initialCarPrice / 1.15 * 100) / 100 : 0;
  const initialVatAmount = initialCarPrice > 0 ? Math.round((initialCarPrice - initialBasePrice) * 100) / 100 : 0;

  // Form State
  const [quotationNumber, setQuotationNumber] = useState(defaultQuotationNo);
  const [quotationDate, setQuotationDate] = useState(today);
  const [clientName, setClientName] = useState('السادة / شركة أعمال الرواد للتجارة');
  const [salutationText, setSalutationText] = useState('السلام عليكم ورحمة الله وبركاته،');
  const [subjectTitle, setSubjectTitle] = useState('عرض سعر سيارة رسمي');
  const [introText, setIntroText] = useState('يسرنا أن نتقدم لكم بعرض السعر الخاص بالسيارة الموضحة بياناتها أدناه:');

  // Representative state
  const [representativeName, setRepresentativeName] = useState(autoRepresentative);

  // Financials
  const [basePrice, setBasePrice] = useState<number>(initialBasePrice || 0);
  const [vatRate, setVatRate] = useState<number>(15);
  const [includeVat, setIncludeVat] = useState<boolean>(true);
  const [plateAndRegFees, setPlateAndRegFees] = useState<number>(0);
  const [customDiscount, setCustomDiscount] = useState<number>(0);
  const [manualTafqeet, setManualTafqeet] = useState<string>('');
  const [isCustomTafqeet, setIsCustomTafqeet] = useState<boolean>(false);

  // Computed totals
  const vatAmount = useMemo(() => {
    if (!includeVat) return 0;
    return Math.round((basePrice * (vatRate / 100)) * 100) / 100;
  }, [basePrice, vatRate, includeVat]);

  const finalTotal = useMemo(() => {
    const sum = basePrice + vatAmount + plateAndRegFees - customDiscount;
    return Math.max(0, Math.round(sum * 100) / 100);
  }, [basePrice, vatAmount, plateAndRegFees, customDiscount]);

  const autoTafqeet = useMemo(() => {
    return tafqeetArabic(finalTotal);
  }, [finalTotal]);

  const effectiveTafqeet = isCustomTafqeet && manualTafqeet ? manualTafqeet : autoTafqeet;

  // Validity Duration
  const [validityDays, setValidityDays] = useState<number>(7);
  const [validityText, setValidityText] = useState<string>(
    `مدة سريان العرض: يعتبر هذا العرض سارياً لمدة (7) يوماً من تاريخ إصداره، وتخضع عملية البيع للشروط والأحكام المتفق عليها بين الطرفين.`
  );

  // Sync validity text when days change
  const handleValidityDaysChange = (days: number) => {
    setValidityDays(days);
    setValidityText(
      `مدة سريان العرض: يعتبر هذا العرض سارياً لمدة (${days}) يوماً من تاريخ إصداره، وتخضع عملية البيع للشروط والأحكام المتفق عليها بين الطرفين.`
    );
  };

  // Conditions / Terms
  const [terms, setTerms] = useState<string[]>([
    'الأسعار الموضحة بالريال السعودي وتشمل ضريبة القيمة المضافة (15%).',
    'يتم تسليم المركبة فور استكمال إجراءات السداد ونقل الملكية.',
    'يسري هذا العرض للمدة المحددة أو حتى نفاد الكمية المتاحة في المخزون.'
  ]);
  const [newTermInput, setNewTermInput] = useState('');

  // Bank Accounts Management
  const [showBankAccounts, setShowBankAccounts] = useState<boolean>(true);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(() => {
    if (settings.bankAccounts && settings.bankAccounts.length > 0) {
      return settings.bankAccounts;
    }
    try {
      const saved = localStorage.getItem('quotation_bank_accounts');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return [
      {
        id: '1',
        bankName: 'مصرف الراجحي',
        accountName: settings.name || 'مؤسسة المخزون الذكي لتجارة السيارات',
        accountNumber: '482000012345678',
        iban: 'SA4880000482000012345678'
      },
      {
        id: '2',
        bankName: 'البنك الأهلي السعودي (SNB)',
        accountName: settings.name || 'مؤسسة المخزون الذكي لتجارة السيارات',
        accountNumber: '102000087654321',
        iban: 'SA03100000102000087654321'
      }
    ];
  });

  // Save bank accounts to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem('quotation_bank_accounts', JSON.stringify(bankAccounts));
    } catch {}
  }, [bankAccounts]);

  const [newBank, setNewBank] = useState<BankAccount>({
    id: '',
    bankName: '',
    accountName: settings.name || '',
    accountNumber: '',
    iban: ''
  });
  const [isAddingBank, setIsAddingBank] = useState(false);

  const handleAddBankAccount = () => {
    if (!newBank.bankName || !newBank.iban) {
      alert('يرجى كتابة اسم البنك ورقم الآيبان IBAN');
      return;
    }
    setBankAccounts(prev => [...prev, { ...newBank, id: `bank-${Date.now()}` }]);
    setNewBank({
      id: '',
      bankName: '',
      accountName: settings.name || '',
      accountNumber: '',
      iban: ''
    });
    setIsAddingBank(false);
  };

  const handleRemoveBankAccount = (id: string) => {
    setBankAccounts(prev => prev.filter(b => b.id !== id));
  };

  // Signatures
  const [companyName, setCompanyName] = useState(
    settings.name ? `${settings.orgType || 'مؤسسة'} ${settings.name}` : 'مؤسسة المخزون الذكي لتجارة السيارات'
  );
  const [includeOfficialStamp, setIncludeOfficialStamp] = useState(true);

  // Available delegates and users list for quick pick
  const availableRepOptions = useMemo(() => {
    const list = new Set<string>();
    if (currentUser?.fullName) list.add(currentUser.fullName);
    if (currentUser?.username) list.add(currentUser.username);
    users.forEach(u => {
      if (u.fullName) list.add(u.fullName);
      if (u.username) list.add(u.username);
    });
    delegates.forEach(d => {
      if (d.username) list.add(d.username);
    });
    const rep1 = getReservationRepresentative(car);
    if (rep1 && rep1 !== '-') list.add(rep1);
    const rep2 = getRepresentativeOrSeller(car);
    if (rep2 && rep2 !== '-') list.add(rep2);
    return Array.from(list).filter(Boolean);
  }, [currentUser, users, delegates, car]);

  // Generate Quotation HTML for Printing and Archiving (Matches exactly the attached document)
  const generateQuotationHtml = (): string => {
    const orgDisplayName = settings.name ? `${settings.orgType || 'مؤسسة'} ${settings.name}` : companyName;
    const crNumber = settings.commercialRegister || '1010000000';
    const vatNumber = settings.taxNumber || '300000000000003';
    const phone = settings.contactNumber || '0500000000';
    const address = settings.address || 'الرياض، المملكة العربية السعودية';
    const logoUrl = settings.logoUrl || getLogoDataUri();
    const stampUrl = settings.stampUrl || getStampDataUri(orgDisplayName, crNumber, settings.orgType);

    const carFullName = `${car.brand} - ${car.model}`;
    const carColor = car.color || 'أبيض';
    const carVin = car.vin || '-';
    const carPlate = car.plateData?.plateNumber || car.customData?.plateNumber || 'بطاقة جمركية';
    const repNote = car.notes ? `ملاحظات: ${car.notes}` : (representativeName ? `ملاحظات: ${representativeName}` : '');

    // Calculate expiration date based on validity days
    const calculateExpiryDate = (startDateStr: string, days: number): string => {
      try {
        const d = new Date(startDateStr);
        if (!isNaN(d.getTime())) {
          d.setDate(d.getDate() + days);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const dayNum = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${dayNum}`;
        }
      } catch {}
      return '';
    };

    const expiryDateStr = calculateExpiryDate(quotationDate, validityDays);

    const bankAccountsHtml = (showBankAccounts && bankAccounts.length > 0) ? `
      <div class="bank-accounts-section" style="margin-top: 12px; margin-bottom: 12px; border: 1.5px dashed #94a3b8; border-radius: 8px; padding: 10px 14px; background-color: #f8fafc;">
        <div style="font-weight: 900; color: #0f172a; margin-bottom: 6px; font-size: 11px; display: flex; align-items: center; gap: 6px;">
          <span>💳 الحسابات البنكية المعتمدة للمؤسسة للتحويل والإيداع:</span>
        </div>
        <div style="display: grid; grid-template-columns: ${bankAccounts.length > 1 ? '1fr 1fr' : '1fr'}; gap: 10px;">
          ${bankAccounts.map(b => `
            <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; font-size: 10.5px; line-height: 1.5;">
              <div style="font-weight: 800; color: #1e293b;">• بنك: <span style="color: #2563eb;">${b.bankName}</span></div>
              <div style="color: #475569; font-weight: 700;">اسم المستفيد: ${b.accountName || orgDisplayName}</div>
              ${b.accountNumber ? `<div style="color: #334155; font-family: monospace; font-weight: 700;">رقم الحساب: ${b.accountNumber}</div>` : ''}
              <div style="color: #0f172a; font-family: monospace; font-weight: 900; direction: ltr; text-align: right;">IBAN: ${b.iban}</div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';

    const termsHtml = terms.map((t, idx) => `
      <div style="margin-bottom: 4px; line-height: 1.6; font-size: 11px; color: #334155; font-weight: 700;">
        ${idx + 1}. ${t}
      </div>
    `).join('');

    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8" />
          <title>خطاب عرض سعر - ${quotationNumber}</title>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm 15mm 12mm 15mm;
            }
            * {
              box-sizing: border-box;
            }
            body {
              font-family: 'Cairo', sans-serif;
              direction: rtl;
              margin: 0;
              padding: 0;
              color: #0f172a;
              background-color: #ffffff;
              font-size: 11.5px;
              line-height: 1.5;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .outer-frame {
              width: 100%;
              border: 2px solid #0f172a;
              border-radius: 14px;
              padding: 22px 24px;
              box-sizing: border-box;
              background-color: #ffffff;
            }
            /* Header */
            .header-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 12px;
            }
            .header-table td {
              vertical-align: middle;
              border: none;
              padding: 0;
            }
            .org-title {
              font-size: 18px;
              font-weight: 900;
              color: #0f172a;
              margin: 0 0 4px 0;
              line-height: 1.25;
            }
            .org-meta {
              font-size: 10.5px;
              font-weight: 700;
              color: #334155;
              line-height: 1.6;
            }
            .logo-cell {
              text-align: center;
              width: 120px;
            }
            .logo-img {
              max-height: 70px;
              max-width: 100px;
              object-fit: contain;
            }
            .quote-meta-boxes {
              display: flex;
              flex-direction: column;
              gap: 8px;
              align-items: flex-end;
            }
            .quote-pill {
              background: #ffffff;
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              padding: 5px 12px;
              font-size: 11px;
              font-weight: 800;
              color: #0f172a;
              display: inline-flex;
              align-items: center;
              gap: 6px;
            }
            .quote-pill .quote-num-val {
              color: #1e3a8a;
              font-family: monospace;
              font-weight: 900;
            }
            .header-divider {
              border-bottom: 2px solid #0f172a;
              margin-top: 14px;
              margin-bottom: 16px;
            }
            /* Recipient */
            .recipient-box {
              background-color: #f8fafc;
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              padding: 12px 16px;
              margin-bottom: 12px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .recipient-content {
              border-right: 4px solid #1e3a8a;
              padding-right: 12px;
            }
            .client-name {
              font-size: 14px;
              font-weight: 900;
              color: #0f172a;
            }
            .client-attention {
              font-size: 11px;
              font-weight: 700;
              color: #475569;
              margin-top: 2px;
            }
            .salutation {
              font-size: 12px;
              font-weight: 800;
              color: #0f172a;
              margin-bottom: 10px;
            }
            /* Subject Bar */
            .subject-bar {
              background-color: #0f172a;
              color: #ffffff;
              text-align: center;
              font-weight: 900;
              font-size: 14.5px;
              padding: 8px 12px;
              border-radius: 8px;
              margin-bottom: 12px;
              letter-spacing: 0.5px;
            }
            .intro-text {
              font-size: 11.5px;
              font-weight: 800;
              color: #0f172a;
              margin-bottom: 10px;
            }
            /* Main Vehicle Table */
            .main-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 14px;
            }
            .main-table th {
              background-color: #0f172a;
              color: #ffffff;
              padding: 9px 6px;
              font-weight: 900;
              font-size: 11px;
              text-align: center;
              border: 1px solid #0f172a;
            }
            .main-table td {
              border: 1px solid #cbd5e1;
              padding: 10px 6px;
              font-size: 11.5px;
              text-align: center;
              font-weight: 700;
              vertical-align: middle;
            }
            .veh-desc {
              text-align: right !important;
              padding-right: 10px !important;
            }
            .veh-name {
              font-size: 13px;
              font-weight: 900;
              color: #0f172a;
            }
            .veh-details {
              font-size: 10px;
              color: #64748b;
              font-weight: 700;
              margin-top: 2px;
            }
            .veh-notes {
              font-size: 9.5px;
              color: #0284c7;
              font-weight: 800;
              margin-top: 2px;
            }
            /* Financial Totals & Tafqeet */
            .summary-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 12px;
            }
            .summary-table td {
              border: none;
              vertical-align: top;
              padding: 0;
            }
            .tafqeet-box {
              padding: 12px 14px;
              background-color: #ffffff;
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              height: 100%;
            }
            .tafqeet-title {
              font-weight: 800;
              color: #0f172a;
              font-size: 11px;
              margin-bottom: 4px;
            }
            .tafqeet-text {
              font-weight: 900;
              color: #1e3a8a;
              font-size: 12px;
              line-height: 1.5;
            }
            .currency-note {
              font-size: 9.5px;
              font-weight: 700;
              color: #64748b;
              margin-top: 6px;
            }
            .totals-grid {
              width: 100%;
              border-collapse: collapse;
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              overflow: hidden;
            }
            .totals-grid td {
              padding: 6px 10px;
              font-weight: 800;
              font-size: 11px;
              border: 1px solid #cbd5e1;
            }
            .totals-label {
              background-color: #ffffff;
              color: #334155;
              text-align: right;
              width: 60%;
            }
            .totals-val {
              text-align: center;
              font-weight: 900;
              color: #0f172a;
              font-family: monospace;
              font-size: 12px;
            }
            .grand-total-row td {
              background-color: #0f172a !important;
              color: #ffffff !important;
              font-size: 13px !important;
              font-weight: 900 !important;
              padding: 8px 10px !important;
            }
            /* Validity Box */
            .validity-box {
              border: 1.5px dashed #60a5fa;
              background-color: #f0f7ff;
              border-radius: 8px;
              padding: 9px 14px;
              margin: 12px 0;
              font-size: 11px;
              font-weight: 800;
              color: #1e3a8a;
              line-height: 1.5;
              text-align: center;
            }
            /* Conditions */
            .conditions-section {
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              padding: 12px 16px;
              margin: 12px 0 16px 0;
              background: #ffffff;
            }
            .conditions-title {
              font-size: 11.5px;
              font-weight: 900;
              color: #0f172a;
              margin-bottom: 6px;
            }
            /* Signatures */
            .sign-off-text {
              text-align: center;
              font-weight: 800;
              font-size: 12px;
              color: #0f172a;
              margin: 16px 0 14px 0;
              line-height: 1.6;
            }
            .signatures-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            .signatures-table td {
              vertical-align: top;
              border: none;
              padding: 0 10px;
            }
            .stamp-area {
              text-align: right;
            }
            .stamp-title {
              font-weight: 900;
              font-size: 11.5px;
              color: #0f172a;
              margin-bottom: 6px;
            }
            .stamp-img {
              max-height: 90px;
              max-width: 125px;
              object-fit: contain;
            }
            .rep-title {
              font-weight: 800;
              font-size: 11px;
              color: #334155;
              margin-bottom: 4px;
            }
            .rep-name {
              font-weight: 900;
              color: #0f172a;
              font-size: 12px;
            }
            ${getBilingualPrintHeaderCss()}
          </style>
        </head>
        <body>
          <div class="outer-frame">
            <!-- Header Table -->
            ${getBilingualPrintHeaderHtml(settings)}

            <div style="display: flex; justify-content: flex-end; margin-bottom: 12px;">
              <div class="quote-meta-boxes">
                <div class="quote-pill">
                  <span>رقم العرض:</span>
                  <span class="quote-num-val">${quotationNumber}</span>
                </div>
                <div class="quote-pill">
                  <span>التاريخ:</span>
                  <span style="font-family: monospace; font-weight: 900;">${quotationDate}</span>
                </div>
              </div>
            </div>

            <div class="header-divider"></div>

            <!-- Recipient Information Box -->
            <div class="recipient-box">
              <div class="recipient-content">
                <div class="client-name">${clientName}</div>
              </div>
              <div style="font-weight: 900; font-size: 13px; color: #1e3a8a;">المحترمين</div>
            </div>

            <div class="salutation">${salutationText}</div>

            <!-- Subject Banner -->
            <div class="subject-bar">
              الموضوع: ${subjectTitle}
            </div>

            <div class="intro-text">
              ${introText}
            </div>

            <!-- Main Quotation Table -->
            <table class="main-table">
              <thead>
                <tr>
                  <th style="width: 30px;">م</th>
                  <th>بيان المركبة والمواصفات واللوحة</th>
                  <th style="width: 65px;">الموديل</th>
                  <th style="width: 45px;">الكمية</th>
                  <th style="width: 105px;">السعر قبل الضريبة</th>
                  <th style="width: 95px;">الضريبة (${vatRate}%)</th>
                  <th style="width: 100px;">اللوحات والإصدار</th>
                  <th style="width: 105px;">الإجمالي شامل</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="font-weight: 900;">1</td>
                  <td class="veh-desc">
                    <div class="veh-name">${carFullName}</div>
                    <div class="veh-details">الخارجي: ${carColor}</div>
                    <div class="veh-details">الهيكل: <span style="font-family: monospace; font-weight: 800;">${carVin}</span> | لوحة: ${carPlate}</div>
                    ${repNote ? `<div class="veh-notes">${repNote}</div>` : ''}
                  </td>
                  <td>${car.year}</td>
                  <td>1</td>
                  <td style="font-family: monospace; font-weight: 900;">${basePrice > 0 ? Number(basePrice).toLocaleString('en-US') : '0'}</td>
                  <td style="font-family: monospace; font-weight: 900;">(${vatRate}%) ${vatAmount > 0 ? Number(vatAmount).toLocaleString('en-US') : '0'}</td>
                  <td>${plateAndRegFees > 0 ? `${Number(plateAndRegFees).toLocaleString('en-US')} ريال` : 'بدون رسوم'}</td>
                  <td style="font-family: monospace; font-weight: 900; color: #1e3a8a; font-size: 13.5px;">${finalTotal > 0 ? Number(finalTotal).toLocaleString('en-US') : '0'}</td>
                </tr>
              </tbody>
            </table>

            <!-- Financial Summary & Tafqeet -->
            <table class="summary-table">
              <tr>
                <td style="width: 55%; padding-left: 10px;">
                  <div class="tafqeet-box">
                    <div class="tafqeet-title">المبلغ الإجمالي كتابة وتفقيطاً:</div>
                    <div class="tafqeet-text">${effectiveTafqeet}</div>
                    <div class="currency-note">* الأسعار الموضحة بالريال السعودي (ريال) وتشمل ضريبة القيمة المضافة.</div>
                  </div>
                </td>
                <td style="width: 45%;">
                  <table class="totals-grid">
                    <tr>
                      <td class="totals-label">المجموع قبل الضريبة:</td>
                      <td class="totals-val">${basePrice > 0 ? Number(basePrice).toLocaleString('en-US') : '0'} ريال</td>
                    </tr>
                    <tr>
                      <td class="totals-label">ضريبة القيمة المضافة (${vatRate}%):</td>
                      <td class="totals-val">${vatAmount > 0 ? Number(vatAmount).toLocaleString('en-US') : '0'} ريال</td>
                    </tr>
                    ${plateAndRegFees > 0 ? `
                      <tr>
                        <td class="totals-label">رسوم اللوحات والإصدار:</td>
                        <td class="totals-val">${Number(plateAndRegFees).toLocaleString('en-US')} ريال</td>
                      </tr>
                    ` : ''}
                    ${customDiscount > 0 ? `
                      <tr>
                        <td class="totals-label" style="color: #dc2626;">الخصم التجاري الممنوح:</td>
                        <td class="totals-val" style="color: #dc2626;">-${Number(customDiscount).toLocaleString('en-US')} ريال</td>
                      </tr>
                    ` : ''}
                    <tr class="grand-total-row">
                      <td>الإجمالي النهائي المستحق:</td>
                      <td style="text-align: center;">${finalTotal > 0 ? Number(finalTotal).toLocaleString('en-US') : '0'} ريال</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Validity Period -->
            <div class="validity-box">
              ⏰ مدة سريان العرض: يعتبر هذا العرض سارياً لمدة (${validityDays}) يوماً من تاريخ إصداره ${expiryDateStr ? `(حتى تاريخ ${expiryDateStr})` : ''}، وتخضع عملية البيع للشروط والأحكام المتفق عليها بين الطرفين.
            </div>

            <!-- Bank Accounts (if enabled) -->
            ${bankAccountsHtml}

            <!-- Terms & Conditions -->
            <div class="conditions-section">
              <div class="conditions-title">الشروط والملاحظات العامة:</div>
              ${termsHtml}
            </div>

            <!-- Sign-off -->
            <div class="sign-off-text">
              شاكرين لكم حسن تعاونكم، ونأمل أن يحوز عرضنا على قبولكم.<br />
              وتفضلوا بقبول خالص التحية والتقدير،،
            </div>

            <!-- Signatures Section -->
            <table class="signatures-table">
              <tr>
                <td style="width: 50%;">
                  <div class="stamp-area">
                    <div class="stamp-title">الختم الرسمي والاعتماد:</div>
                    ${includeOfficialStamp && stampUrl ? `<img src="${stampUrl}" class="stamp-img" alt="Official Stamp" />` : '<div style="height: 60px;"></div>'}
                  </div>
                </td>
                <td style="width: 50%; text-align: left;">
                  <div style="display: inline-block; text-align: right; line-height: 1.8;">
                    <div class="rep-title">اسم مقدم العرض: <span class="rep-name">${representativeName}</span></div>
                    <div class="rep-title">اسم المؤسسة/الشركة: <span class="rep-name">${orgDisplayName}</span></div>
                    <div class="rep-title" style="margin-top: 8px;">التوقيع: <span style="font-family: 'Cairo', cursive; font-weight: 900; color: #1e3a8a; font-size: 13.5px;">${representativeName}</span></div>
                    <div style="color: #ef4444; font-size: 16px; line-height: 1; margin-top: 4px;">●</div>
                  </div>
                </td>
              </tr>
            </table>
          </div>
        </body>
      </html>
    `;
  };

  const handlePrint = () => {
    const letterHtml = generateQuotationHtml();
    onPrintAndArchive(letterHtml, {
      quotationNumber,
      quotationDate,
      clientName,
      representativeName,
      finalTotal,
      vin: car.vin,
      brand: car.brand,
      model: car.model
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto overscroll-contain" dir="rtl">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-6 md:p-8 max-w-4xl w-full shadow-2xl space-y-4 sm:space-y-6 max-h-[92vh] sm:max-h-[90vh] my-auto flex flex-col overflow-hidden text-right">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 sm:pb-4 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl sm:rounded-2xl flex items-center justify-center">
              <FileText size={22} className="sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg md:text-xl font-black text-slate-900 dark:text-white">إعداد وطباعة عرض سعر سيارة (Quotation)</h3>
                <span className="px-2 sm:px-2.5 py-0.5 bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-lg text-[10px] sm:text-xs font-mono font-black">
                  {quotationNumber}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs font-bold text-slate-500 mt-0.5">
                {car.brand} {car.model} - موديل {car.year} - VIN: {car.vin}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto space-y-6 flex-1 pr-1 pl-1 custom-scrollbar">
          
          {/* 1. Client & Quotation Meta */}
          <div className="bg-slate-50 dark:bg-slate-950/60 p-5 rounded-2xl border border-slate-200/70 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800 pb-2.5">
              <span className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-2">
                <Building2 size={16} className="text-blue-500" />
                بيانات الجهة / العميل المعمول إليها العرض والرقم التسلسلي
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-black text-slate-600 dark:text-slate-400 mb-1.5">
                  السادة / اسم العميل أو الشركة:
                </label>
                <input 
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="السادة / شركة أعمال الرواد للتجارة"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-black text-slate-900 dark:text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-600 dark:text-slate-400 mb-1.5">
                  رقم عرض السعر (Serial No):
                </label>
                <input 
                  type="text"
                  value={quotationNumber}
                  onChange={(e) => setQuotationNumber(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-black text-blue-600 dark:text-blue-400 outline-none focus:border-blue-500 font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-600 dark:text-slate-400 mb-1.5">
                  تاريخ العرض:
                </label>
                <input 
                  type="date"
                  value={quotationDate}
                  onChange={(e) => setQuotationDate(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                />
              </div>

              {/* Representative / Logged-in User */}
              <div>
                <label className="block text-[11px] font-black text-slate-600 dark:text-slate-400 mb-1.5 flex items-center justify-between">
                  <span>اسم المندوب / مسؤول العرض:</span>
                  <span className="text-[10px] text-blue-500 font-normal">(تلقائي بالحساب)</span>
                </label>
                <div className="flex gap-1.5">
                  <input 
                    type="text"
                    value={representativeName}
                    onChange={(e) => setRepresentativeName(e.target.value)}
                    placeholder="اسم المندوب"
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-black text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                  {availableRepOptions.length > 0 && (
                    <select
                      onChange={(e) => {
                        if (e.target.value) setRepresentativeName(e.target.value);
                      }}
                      value=""
                      className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                      title="اختر من المندوبين"
                    >
                      <option value="">اختر..</option>
                      {availableRepOptions.map((opt, i) => (
                        <option key={i} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 2. Financial Pricing & Calculations */}
          <div className="bg-slate-50 dark:bg-slate-950/60 p-5 rounded-2xl border border-slate-200/70 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800 pb-2.5">
              <span className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-2">
                <DollarSign size={16} className="text-emerald-500" />
                تفاصيل السعر والضريبة ورسوم اللوحات والتفقيط
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-black text-slate-600 dark:text-slate-400 mb-1.5">
                  السعر قبل الضريبة (ريال):
                </label>
                <input 
                  type="number"
                  min="0"
                  step="any"
                  value={basePrice || ''}
                  onChange={(e) => setBasePrice(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-black text-slate-900 dark:text-white outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-black text-slate-600 dark:text-slate-400">
                    ضريبة القيمة المضافة:
                  </label>
                  <label className="inline-flex items-center gap-1 cursor-pointer text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                    <input 
                      type="checkbox"
                      checked={includeVat}
                      onChange={(e) => setIncludeVat(e.target.checked)}
                      className="rounded"
                    />
                    <span>تفعيل ({vatRate}%)</span>
                  </label>
                </div>
                <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-black text-slate-700 dark:text-slate-300">
                  <span className="flex-1 font-mono">{vatAmount.toLocaleString('ar-SA')}</span>
                  <span className="text-[10px] text-slate-400 font-bold">ريال</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-600 dark:text-slate-400 mb-1.5">
                  رسوم اللوحات والإصدار (ريال):
                </label>
                <input 
                  type="number"
                  min="0"
                  step="any"
                  value={plateAndRegFees}
                  onChange={(e) => setPlateAndRegFees(parseFloat(e.target.value) || 0)}
                  placeholder="450"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-black text-slate-900 dark:text-white outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-600 dark:text-slate-400 mb-1.5">
                  خصم تجاري خاص (ريال):
                </label>
                <input 
                  type="number"
                  min="0"
                  step="any"
                  value={customDiscount || ''}
                  onChange={(e) => setCustomDiscount(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-rose-600 outline-none focus:border-rose-500 font-mono"
                />
              </div>
            </div>

            {/* Total Display & Tafqeet Box */}
            <div className="p-4 bg-gradient-to-r from-blue-900 to-slate-900 text-white rounded-2xl shadow-md space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                <span className="text-xs font-bold text-blue-200">الإجمالي النهائي المستحق شاملاً الضريبة واللوحات:</span>
                <span className="text-2xl font-black font-mono text-emerald-400 tracking-wider">
                  {finalTotal.toLocaleString('ar-SA')} <span className="text-sm font-sans text-white">ريال سعودي</span>
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-blue-200">المبلغ كتابة وتفقيطاً (بالحروف):</span>
                  <button 
                    type="button"
                    onClick={() => {
                      setIsCustomTafqeet(!isCustomTafqeet);
                      if (!isCustomTafqeet) setManualTafqeet(autoTafqeet);
                    }}
                    className="text-[10px] text-blue-300 hover:text-white underline font-bold"
                  >
                    {isCustomTafqeet ? 'العودة للتفقيط التلقائي' : 'تعديل النص يدوياً'}
                  </button>
                </div>
                {isCustomTafqeet ? (
                  <input 
                    type="text"
                    value={manualTafqeet}
                    onChange={(e) => setManualTafqeet(e.target.value)}
                    className="w-full bg-slate-800 border border-blue-400 rounded-xl px-3 py-2 text-xs font-black text-white outline-none"
                  />
                ) : (
                  <p className="text-xs font-black text-white leading-relaxed bg-white/10 p-2.5 rounded-xl border border-white/10">
                    {autoTafqeet}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 3. Validity Duration & Conditions Text */}
          <div className="bg-slate-50 dark:bg-slate-950/60 p-5 rounded-2xl border border-slate-200/70 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800 pb-2.5">
              <span className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-2">
                <Clock size={16} className="text-sky-500" />
                مدة سريان العرض والشروط والملاحظات العامة
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-black text-slate-600 dark:text-slate-400 mb-1.5">
                  مدة سريان العرض (بالأيام):
                </label>
                <div className="flex items-center gap-2">
                  <input 
                    type="number"
                    min="1"
                    max="90"
                    value={validityDays}
                    onChange={(e) => handleValidityDaysChange(parseInt(e.target.value, 10) || 7)}
                    className="w-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-black text-blue-600 outline-none focus:border-blue-500 font-mono text-center"
                  />
                  <div className="flex gap-1">
                    {[3, 7, 15, 30].map(d => (
                      <button 
                        key={d}
                        type="button"
                        onClick={() => handleValidityDaysChange(d)}
                        className={`px-2.5 py-2 rounded-lg text-[10px] font-bold transition-colors ${
                          validityDays === d 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300'
                        }`}
                      >
                        {d} أيام
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-black text-slate-600 dark:text-slate-400 mb-1.5">
                  نص عبارة مدة السريان:
                </label>
                <input 
                  type="text"
                  value={validityText}
                  onChange={(e) => setValidityText(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Terms List Management */}
            <div className="space-y-2">
              <label className="block text-[11px] font-black text-slate-600 dark:text-slate-400">
                الشروط والملاحظات العامة الواردة بالعرض:
              </label>
              <div className="space-y-2 max-h-36 overflow-y-auto">
                {terms.map((t, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-xs font-black text-blue-500 w-5">{idx + 1}.</span>
                    <input 
                      type="text"
                      value={t}
                      onChange={(e) => {
                        const newTerms = [...terms];
                        newTerms[idx] = e.target.value;
                        setTerms(newTerms);
                      }}
                      className="flex-1 bg-transparent border-0 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
                    />
                    <button 
                      type="button"
                      onClick={() => setTerms(terms.filter((_, i) => i !== idx))}
                      className="text-slate-400 hover:text-rose-500 p-1"
                      title="حذف هذا الشرط"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Term input */}
              <div className="flex gap-2 pt-1">
                <input 
                  type="text"
                  value={newTermInput}
                  onChange={(e) => setNewTermInput(e.target.value)}
                  placeholder="أضف شرطاً أو ملاحظة إضافية..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTermInput.trim()) {
                      setTerms(prev => [...prev, newTermInput.trim()]);
                      setNewTermInput('');
                    }
                  }}
                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-blue-500"
                />
                <button 
                  type="button"
                  onClick={() => {
                    if (newTermInput.trim()) {
                      setTerms(prev => [...prev, newTermInput.trim()]);
                      setNewTermInput('');
                    }
                  }}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-700 dark:text-slate-300 rounded-xl text-xs font-black transition-colors"
                >
                  إضافة شرط
                </button>
              </div>
            </div>
          </div>

          {/* 4. Bank Accounts Section */}
          <div className="bg-slate-50 dark:bg-slate-950/60 p-5 rounded-2xl border border-slate-200/70 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <CreditCard size={16} className="text-purple-500" />
                <span className="text-xs font-black text-slate-800 dark:text-white">الحسابات البنكية المعتمدة للتحويل</span>
              </div>
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-black text-blue-600 dark:text-blue-400">
                <input 
                  type="checkbox"
                  checked={showBankAccounts}
                  onChange={(e) => setShowBankAccounts(e.target.checked)}
                  className="rounded"
                />
                <span>تضمين الحسابات البنكية بالعرض</span>
              </label>
            </div>

            {showBankAccounts && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {bankAccounts.map((b) => (
                    <div key={b.id} className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1 relative group">
                      <button 
                        type="button"
                        onClick={() => handleRemoveBankAccount(b.id)}
                        className="absolute top-2.5 left-2.5 p-1 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                        title="حذف الحساب"
                      >
                        <Trash2 size={14} />
                      </button>
                      <div className="font-black text-xs text-blue-600 dark:text-blue-400">{b.bankName}</div>
                      <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300">المستفيد: {b.accountName}</div>
                      {b.accountNumber && (
                        <div className="text-[10.5px] font-mono text-slate-500">رقم الحساب: {b.accountNumber}</div>
                      )}
                      <div className="text-[11px] font-mono font-black text-slate-800 dark:text-slate-100" dir="ltr">
                        {b.iban}
                      </div>
                    </div>
                  ))}
                </div>

                {isAddingBank ? (
                  <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-purple-200 dark:border-purple-900/40 space-y-3">
                    <h4 className="text-xs font-black text-purple-700 dark:text-purple-300">إضافة حساب بنكي جديد:</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input 
                        type="text"
                        placeholder="اسم البنك (مثال: مصرف الراجحي / البنك الأهلي)"
                        value={newBank.bankName}
                        onChange={(e) => setNewBank(prev => ({ ...prev, bankName: e.target.value }))}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold"
                      />
                      <input 
                        type="text"
                        placeholder="اسم صاحب الحساب / المستفيد"
                        value={newBank.accountName}
                        onChange={(e) => setNewBank(prev => ({ ...prev, accountName: e.target.value }))}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold"
                      />
                      <input 
                        type="text"
                        placeholder="رقم الآيبان IBAN (SA...)"
                        value={newBank.iban}
                        onChange={(e) => setNewBank(prev => ({ ...prev, iban: e.target.value }))}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-mono font-bold"
                        dir="ltr"
                      />
                      <input 
                        type="text"
                        placeholder="رقم الحساب الداخلي (اختياري)"
                        value={newBank.accountNumber}
                        onChange={(e) => setNewBank(prev => ({ ...prev, accountNumber: e.target.value }))}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-mono font-bold"
                        dir="ltr"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button 
                        type="button"
                        onClick={() => setIsAddingBank(false)}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 rounded-lg text-xs font-bold"
                      >
                        إلغاء
                      </button>
                      <button 
                        type="button"
                        onClick={handleAddBankAccount}
                        className="px-4 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-black"
                      >
                        حفظ الحساب
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    type="button"
                    onClick={() => setIsAddingBank(true)}
                    className="flex items-center gap-1.5 text-xs font-black text-purple-600 dark:text-purple-400 hover:underline"
                  >
                    <Plus size={15} />
                    <span>إضافة حساب بنكي جديد</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600 dark:text-slate-400">
            <input 
              type="checkbox"
              checked={includeOfficialStamp}
              onChange={(e) => setIncludeOfficialStamp(e.target.checked)}
              className="rounded"
            />
            <span>تضمين الختم والاعتماد الرسمي بالخطاب</span>
          </label>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-5 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition-colors"
            >
              إلغاء
            </button>
            <button 
              type="button"
              onClick={handlePrint}
              className="flex-1 sm:flex-none px-7 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Printer size={17} />
              <span>معاينة وطباعة عرض السعر</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
