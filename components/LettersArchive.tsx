import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, Search, Calendar, Filter, Download, Printer, CheckCircle, 
  Trash2, Eye, Compass, Zap, HelpCircle, ShieldAlert, FileDown, ArrowUpDown,
  Check, Table
} from 'lucide-react';
import { LetterArchiveEntry, User, OrganizationSettings } from '../types';
import ExcelJS from 'exceljs';
import { ExcelService } from '../services/excelService';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { exportHTMLToDirectPDF } from '../services/exportService';

// 🚀 Indexer Engine for high performance O(1) searches on critical fields.
class LetterIndexer {
  private indexVin: Record<string, string[]> = {};
  private indexCard: Record<string, string[]> = {};
  private indexNo: Record<string, string[]> = {};
  private indexPlate: Record<string, string[]> = {};
  private indexDate: Record<string, string[]> = {};

  constructor(letters: LetterArchiveEntry[]) {
    this.rebuild(letters);
  }

  rebuild(letters: LetterArchiveEntry[]) {
    this.indexVin = {};
    this.indexCard = {};
    this.indexNo = {};
    this.indexPlate = {};
    this.indexDate = {};

    letters.forEach(letter => {
      const id = letter.id;
      
      // Index VIN
      if (letter.vin) {
        const vinClean = letter.vin.toString().trim().toUpperCase();
        if (!this.indexVin[vinClean]) this.indexVin[vinClean] = [];
        this.indexVin[vinClean].push(id);
      }
      
      // Index Card
      if (letter.cardNumber) {
        const cardClean = letter.cardNumber.toString().trim().toUpperCase();
        if (!this.indexCard[cardClean]) this.indexCard[cardClean] = [];
        this.indexCard[cardClean].push(id);
      }
      
      // Index No
      if (letter.letterNumber) {
        const numClean = letter.letterNumber.toString().trim().toUpperCase();
        if (!this.indexNo[numClean]) this.indexNo[numClean] = [];
        this.indexNo[numClean].push(id);
      }

      // Index Plate
      if (letter.plateNumber) {
        const plateClean = letter.plateNumber.toString().trim().toUpperCase();
        if (!this.indexPlate[plateClean]) this.indexPlate[plateClean] = [];
        this.indexPlate[plateClean].push(id);
      }

      // Index Date
      if (letter.letterDate) {
        const dateClean = letter.letterDate.toString().trim();
        if (!this.indexDate[dateClean]) this.indexDate[dateClean] = [];
        this.indexDate[dateClean].push(id);
      }
    });
  }

  lookupVin(vin: string): string[] | null {
    const vinClean = vin.trim().toUpperCase();
    return this.indexVin[vinClean] || null;
  }

  lookupCard(card: string): string[] | null {
    const cardClean = card.trim().toUpperCase();
    return this.indexCard[cardClean] || null;
  }

  lookupNo(no: string): string[] | null {
    const numClean = no.trim().toUpperCase();
    return this.indexNo[numClean] || null;
  }

  lookupPlate(plate: string): string[] | null {
    const plateClean = plate.trim().toUpperCase();
    return this.indexPlate[plateClean] || null;
  }

  lookupDate(dateStr: string): string[] | null {
    const dateClean = dateStr.trim();
    return this.indexDate[dateClean] || null;
  }
}

interface LettersArchiveProps {
  letters: LetterArchiveEntry[];
  onUpdateLetters: (letters: LetterArchiveEntry[]) => void;
  currentUser: User | null;
  settings: OrganizationSettings;
}

export const LettersArchive: React.FC<LettersArchiveProps> = ({
  letters = [],
  onUpdateLetters,
  currentUser,
  settings
}) => {
  // Search & Filter state
  const [quickSearch, setQuickSearch] = useState('');
  const [advNumber, setAdvNumber] = useState('');
  const [advType, setAdvType] = useState('');
  const [advVin, setAdvVin] = useState('');
  const [advCard, setAdvCard] = useState('');
  const [advPlate, setAdvPlate] = useState('');
  const [advVehicle, setAdvVehicle] = useState('');
  const [advDriver, setAdvDriver] = useState('');
  const [advDestination, setAdvDestination] = useState('');
  const [advUser, setAdvUser] = useState('');
  const [advDateFrom, setAdvDateFrom] = useState('');
  const [advDateTo, setAdvDateTo] = useState('');
  
  // Sort State
  const [sortField, setSortField] = useState<keyof LetterArchiveEntry>('createdAt');
  const [sortAsc, setSortAsc] = useState(false);

  // Active letter for modal details view
  const [activeLetter, setActiveLetter] = useState<LetterArchiveEntry | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Bulks ZIP Export properties
  const [showZipExport, setShowZipExport] = useState(false);
  const [zipDateFrom, setZipDateFrom] = useState('');
  const [zipDateTo, setZipDateTo] = useState('');
  const [zipFormat, setZipFormat] = useState<'doc' | 'html' | 'both'>('doc');
  const [isGeneratingZip, setIsGeneratingZip] = useState(false);
  const [zipMessage, setZipMessage] = useState('');
  const isRtl = true;

  // New multi-selection states
  const [selectedLetterIds, setSelectedLetterIds] = useState<string[]>([]);
  const [zipSource, setZipSource] = useState<'dateRange' | 'selected'>('dateRange');

  // Re-build Index Engine Reactively
  const indexer = useMemo(() => {
    return new LetterIndexer(letters);
  }, [letters]);

  // Accelerate lookups if user puts values directly in highly indexed advanced search fields
  const indexedLookups = useMemo(() => {
    let idsSet: Set<string> | null = null;

    const intersect = (ids: string[]) => {
      if (!idsSet) {
        idsSet = new Set(ids);
      } else {
        idsSet = new Set(ids.filter(x => idsSet!.has(x)));
      }
    };

    if (advNumber.trim()) {
      const match = indexer.lookupNo(advNumber);
      intersect(match || []);
    }
    if (advVin.trim()) {
      const match = indexer.lookupVin(advVin);
      intersect(match || []);
    }
    if (advCard.trim()) {
      const match = indexer.lookupCard(advCard);
      intersect(match || []);
    }
    if (advPlate.trim()) {
      const match = indexer.lookupPlate(advPlate);
      intersect(match || []);
    }

    return idsSet;
  }, [advNumber, advVin, advCard, advPlate, indexer]);

  // Main filter function
  const filteredLetters = useMemo(() => {
    let list = letters;

    // 1. If we have exact indexed matches, filter down to that subset first (extremely fast)
    if (indexedLookups !== null) {
      const matchSet = indexedLookups;
      list = list.filter(item => matchSet.has(item.id));
    }

    // 2. Filter remaining advanced search inputs
    if (advType) {
      list = list.filter(item => item.letterType === advType);
    }
    if (advVehicle.trim()) {
      const v = advVehicle.toLowerCase().trim();
      list = list.filter(item => item.vehicleName?.toLowerCase().includes(v));
    }
    if (advDriver.trim()) {
      const d = advDriver.toLowerCase().trim();
      list = list.filter(item => item.driverName?.toLowerCase().includes(d));
    }
    if (advDestination.trim()) {
      const dest = advDestination.toLowerCase().trim();
      list = list.filter(item => item.destination?.toLowerCase().includes(dest));
    }
    if (advUser.trim()) {
      const usr = advUser.toLowerCase().trim();
      list = list.filter(item => item.createdBy?.toLowerCase().includes(usr));
    }
    if (advDateFrom) {
      list = list.filter(item => {
        const docDate = item.letterDate || '';
        // Handles standard YYYY-MM-DD comparisons
        return docDate >= advDateFrom;
      });
    }
    if (advDateTo) {
      list = list.filter(item => {
        const docDate = item.letterDate || '';
        return docDate <= advDateTo;
      });
    }

    // 3. Handle quick global search across all fields
    if (quickSearch.trim()) {
      const query = quickSearch.toLowerCase().trim();
      list = list.filter(item => 
        (item.letterNumber || '').toLowerCase().includes(query) ||
        (item.letterType || '').toLowerCase().includes(query) ||
        (item.vin || '').toLowerCase().includes(query) ||
        (item.plateNumber || '').toLowerCase().includes(query) ||
        (item.cardNumber || '').toLowerCase().includes(query) ||
        (item.vehicleName || '').toLowerCase().includes(query) ||
        (item.driverName || '').toLowerCase().includes(query) ||
        (item.destination || '').toLowerCase().includes(query) ||
        (item.createdBy || '').toLowerCase().includes(query) ||
        (item.letterDate || '').includes(query)
      );
    }

    // Sort letters
    return [...list].sort((a, b) => {
      const valA = String(a[sortField] || '');
      const valB = String(b[sortField] || '');
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
  }, [letters, indexedLookups, advType, advVehicle, advDriver, advDestination, advUser, advDateFrom, advDateTo, quickSearch, sortField, sortAsc]);

  // Distinct types for select menus
  const letterTypes = useMemo(() => {
    const types = letters.map(l => l.letterType);
    return Array.from(new Set(types)).filter(Boolean);
  }, [letters]);

  // Toggle Sorting
  const requestSort = (field: keyof LetterArchiveEntry) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Reprint helper using iframe safely
  const handleReprint = (letter: LetterArchiveEntry) => {
    const previewHtml = letter.htmlContent.replace(/window\.close\(\);?/g, '').trim();
    if (typeof (window as any).showPrintPreview === 'function') {
      (window as any).showPrintPreview(previewHtml);
      return;
    }
    const iframeHtml = previewHtml.replace(/window\.print\(\);?/g, '');
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
        } catch (e) {
          console.error(e);
        }
        setTimeout(() => {
          try {
            if (iframe.parentNode) {
              document.body.removeChild(iframe);
            }
          } catch (err) {
            console.error(err);
          }
        }, 3000);
      }, 1000);
    } else {
      alert('حدث خطأ أثناء محاولة تهيئة نافذة الطباعة');
    }
  };

  // Export to Excel
  const handleExportExcel = async () => {
    const displayData = filteredLetters.map((l, index) => ({
      index: index + 1,
      'رقم الخطاب': l.letterNumber,
      'نوع الخطاب': l.letterType,
      'تاريخ الخطاب': l.letterDate,
      'رقم الهيكل (VIN)': l.vin,
      'رقم اللوحة': l.plateNumber || '',
      'رقم البطاقة': l.cardNumber || '',
      'اسم المركبة': l.vehicleName || '',
      'اسم السائق': l.driverName || '',
      'الجهة المعنية': l.destination || '',
      'منشئ الخطاب': l.createdBy || '',
      'تاريخ الأرشفة': new Date(l.createdAt).toLocaleString('ar-SA')
    }));

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('أرشيف الخطابات', { views: [{ rightToLeft: true }] });

    worksheet.columns = [
      { header: 'م', key: 'index', width: 8 },
      { header: 'رقم الخطاب', key: 'رقم الخطاب', width: 15 },
      { header: 'نوع الخطاب', key: 'نوع الخطاب', width: 15 },
      { header: 'تاريخ الخطاب', key: 'تاريخ الخطاب', width: 15 },
      { header: 'رقم الهيكل (VIN)', key: 'رقم الهيكل (VIN)', width: 22 },
      { header: 'رقم اللوحة', key: 'رقم اللوحة', width: 15 },
      { header: 'رقم البطاقة', key: 'رقم البطاقة', width: 15 },
      { header: 'اسم المركبة', key: 'اسم المركبة', width: 22 },
      { header: 'اسم السائق', key: 'اسم السائق', width: 18 },
      { header: 'الجهة المعنية', key: 'الجهة المعنية', width: 22 },
      { header: 'منشئ الخطاب', key: 'منشئ الخطاب', width: 18 },
      { header: 'تاريخ الأرشفة', key: 'تاريخ الأرشفة', width: 22 }
    ];

    displayData.forEach(item => {
      worksheet.addRow(item);
    });

    ExcelService.formatWorksheet(worksheet, { isRTL: true });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `أرشيف_الخطابات_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Safe delete archived item (with warning)
  const handleDeleteLetter = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('تنبيـه: هل أنت متأكد من حذف هذا الخطاب نهائياً من الأرشيف؟ لا يمكن التراجع عن هذا الإجراء.')) {
      onUpdateLetters(letters.filter(l => l.id !== id));
      if (activeLetter?.id === id) {
        setActiveLetter(null);
      }
    }
  };

  // 📄 Microsoft Word compatibility wrapper for pristine Arabic RTL styling
  const wrapForWord = (htmlContent: string) => {
    if (htmlContent.includes("urn:schemas-microsoft-com:office:word")) {
      return htmlContent;
    }
    return `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' 
            xmlns:w='urn:schemas-microsoft-com:office:word' 
            xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8">
        <title>Document</title>
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          @page {
            size: A4;
            margin: 1.5cm;
          }
          body {
            font-family: 'Arial', 'Calibri', 'Inter', sans-serif;
            direction: rtl;
            text-align: right;
          }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `;
  };

  // Export individual letter as editable Word Document (.doc) with full Arabic shaping support
  const handleExportSingleWord = (letter: LetterArchiveEntry, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const pageWordContent = wrapForWord(letter.htmlContent);
      const blob = new Blob([pageWordContent], { type: 'application/msword;charset=utf-8' });
      saveAs(blob, `خطاب_رقم_${letter.letterNumber}_${letter.letterType.replace(/\s+/g, '_')}.doc`);
    } catch (error) {
      console.error('Error exporting single Word document:', error);
      alert('حدث خطأ أثناء تصدير وثيقة الوورد.');
    }
  };

  // Export individual letter directly as PDF file
  const handleExportSinglePDF = async (letter: LetterArchiveEntry, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const filename = `خطاب_رقم_${letter.letterNumber}_${letter.letterType.replace(/\s+/g, '_')}`;
      await exportHTMLToDirectPDF(letter.htmlContent, {
        reportTitle: filename,
        filename: filename,
        orientation: 'portrait',
        delayMs: 300
      });
    } catch (error) {
      console.error('Error exporting single PDF document:', error);
      alert('حدث خطأ أثناء تصدير ملف الـ PDF المباشر.');
    }
  };

  // Toggle selection of a single letter ID
  const handleToggleSelect = (id: string) => {
    setSelectedLetterIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Select/Deselect all filtered letters currently displayed in the table
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedLetterIds(filteredLetters.map(l => l.id));
    } else {
      setSelectedLetterIds([]);
    }
  };

  // Perform bulk export of manually selected letters to compressed ZIP archive folder
  const handleExportSelectedZip = async (format: 'doc' | 'html' | 'both') => {
    if (selectedLetterIds.length === 0) {
      alert('الرجاء تحديد خطابات أولاً بالتأشير على مربعات الاختيار في الجدول.');
      return;
    }

    setIsGeneratingZip(true);
    try {
      const matchedLetters = letters.filter(item => selectedLetterIds.includes(item.id));
      const zip = new JSZip();

      matchedLetters.forEach(letter => {
        const sanitisedType = letter.letterType.replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, '_');
        const filenamePrefix = `خطاب_رقم_${letter.letterNumber}_${sanitisedType}`;

        if (format === 'doc' || format === 'both') {
          const docOutput = wrapForWord(letter.htmlContent);
          zip.file(`${filenamePrefix}.doc`, docOutput);
        }

        if (format === 'html' || format === 'both') {
          zip.file(`${filenamePrefix}.html`, letter.htmlContent);
        }
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `تصدير_محدد_خطابات_عدد_${matchedLetters.length}.zip`);
    } catch (err) {
      console.error('Error compiling selected folder zip archive:', err);
      alert('فشلت محاولة تجميع الملف المضغوط. يرجى مراجعة الدعم الفني.');
    } finally {
      setIsGeneratingZip(false);
    }
  };

  // Export only selected letters details to Excel file
  const handleExportSelectedExcel = async () => {
    if (selectedLetterIds.length === 0) return;
    const selectedLetters = letters.filter(item => selectedLetterIds.includes(item.id));
    
    const preparedData = selectedLetters.map((item, index) => ({
      index: index + 1,
      "رقم الخطاب": item.letterNumber,
      "نوع الخطاب": item.letterType,
      "تاريخ الخطاب": item.letterDate,
      "اسم السيارة": item.vehicleName || '',
      "رقم الهيكل": item.vin,
      "رقم اللوحة": item.plateNumber || '',
      "رقم الاستمارة": item.cardNumber || '',
      "اسم السائق/المستلم": item.driverName || '',
      "الجهة الموجه إليها": item.destination || '',
      "المستخدم المنشئ": item.createdBy,
      "تاريخ الإنشاء": item.createdAt ? new Date(item.createdAt).toLocaleString('ar-SA') : ''
    }));

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('الخطابات المحددة', { views: [{ rightToLeft: true }] });

    worksheet.columns = [
      { header: 'م', key: 'index', width: 8 },
      { header: 'رقم الخطاب', key: 'رقم الخطاب', width: 15 },
      { header: 'نوع الخطاب', key: 'نوع الخطاب', width: 15 },
      { header: 'تاريخ الخطاب', key: 'تاريخ الخطاب', width: 15 },
      { header: 'اسم السيارة', key: 'اسم السيارة', width: 22 },
      { header: 'رقم الهيكل', key: 'رقم الهيكل', width: 22 },
      { header: 'رقم اللوحة', key: 'رقم اللوحة', width: 15 },
      { header: 'رقم الاستمارة', key: 'رقم الاستمارة', width: 15 },
      { header: 'اسم السائق/المستلم', key: 'اسم السائق/المستلم', width: 18 },
      { header: 'الجهة الموجه إليها', key: 'الجهة الموجه إليها', width: 22 },
      { header: 'المستخدم المنشئ', key: 'المستخدم المنشئ', width: 18 },
      { header: 'تاريخ الإنشاء', key: 'تاريخ الإنشاء', width: 22 }
    ];

    preparedData.forEach(item => {
      worksheet.addRow(item);
    });

    ExcelService.formatWorksheet(worksheet, { isRTL: true });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `أرشيف_الخطابات_المحددة_عدد_${selectedLetters.length}.xlsx`);
  };

  // Perform bulk periodic export of matched letters to compressed ZIP archive folder
  const handleExportBulkZip = async () => {
    let matchedLetters: LetterArchiveEntry[] = [];

    if (zipSource === 'dateRange') {
      if (!zipDateFrom || !zipDateTo) {
        setZipMessage('يرجى تحديد نطاق التاريخ (من وإلى) أولاً لبدء عملية التجميع.');
        return;
      }
      matchedLetters = letters.filter(item => {
        const docDate = item.letterDate || '';
        return docDate >= zipDateFrom && docDate <= zipDateTo;
      });
    } else {
      if (selectedLetterIds.length === 0) {
        setZipMessage('يرجى تحديد بعض الخطابات من جدول الأرشيف بالأسفل أولاً.');
        return;
      }
      matchedLetters = letters.filter(item => selectedLetterIds.includes(item.id));
    }

    if (matchedLetters.length === 0) {
      setZipMessage('لم نعثر على أي خطابات أو وثائق مؤرشفة للمطابقة المحددة.');
      return;
    }

    setIsGeneratingZip(true);
    setZipMessage('');

    try {
      const zip = new JSZip();

      matchedLetters.forEach(letter => {
        const sanitisedType = letter.letterType.replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, '_');
        const filenamePrefix = `خطاب_رقم_${letter.letterNumber}_${sanitisedType}`;

        if (zipFormat === 'doc' || zipFormat === 'both') {
          const docOutput = wrapForWord(letter.htmlContent);
          zip.file(`${filenamePrefix}.doc`, docOutput);
        }

        if (zipFormat === 'html' || zipFormat === 'both') {
          zip.file(`${filenamePrefix}.html`, letter.htmlContent);
        }
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const currentLabel = zipSource === 'dateRange' ? `فترة_${zipDateFrom}_إلى_${zipDateTo}` : `محددة_عدد_${matchedLetters.length}`;
      saveAs(zipBlob, `أرشيف_خطابات_${currentLabel}.zip`);
      setZipMessage(`تم تجميع وتصدير ${matchedLetters.length} خطاباً بنجاح في ملف مضغوط.`);
    } catch (err) {
      console.error('Error compiling folder zip archive:', err);
      setZipMessage('فشلت محاولة تجميع الملف المضغوط. يرجى مراجعة الدعم الفني.');
    } finally {
      setIsGeneratingZip(false);
    }
  };

  return (
    <div className="space-y-8 text-right font-sans" dir="rtl">
      
      {/* Upper Status Panel */}
      <div className="flex md:flex-row flex-col justify-between items-start md:items-center border-b border-slate-100 dark:border-slate-800 pb-5 gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600" />
            <span>أرشيف الخطابات والوثائق الصادرة</span>
          </h2>
          <p className="text-slate-400 font-bold text-sm mt-1">
            مستند أوتوماتيكي متكامل وقاعدة بيانات مستقلة تؤرشف وثائق الدخول والخروج والتحويلات والبطاقات رسمياً.
          </p>
        </div>

        {/* Index Acceleration Alert */}
        <div className="flex items-center gap-2.5 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
          <Zap className="w-5.5 h-5.5 text-blue-500 animate-bounce" />
          <div className="text-right">
            <span className="text-xs font-black text-blue-500 block">فهرسة البحث المسرّعة نشطة</span>
            <span className="text-[10px] text-slate-400">O(1) VIN/Plate Indexes Active</span>
          </div>
        </div>
      </div>

      {/* Quick search and view control panel */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-85 shadow-sm space-y-4">
        
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text"
              placeholder="البحث السريع الذكي في جميع حقول الأرشيف دفعة واحدة..."
              className="w-full pr-14 pl-5 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/10 transition-all text-sm font-bold dark:text-white"
              value={quickSearch}
              onChange={e => setQuickSearch(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowAdvanced(!showAdvanced);
                setShowZipExport(false);
              }}
              className={`px-5 py-4 rounded-2xl border font-black text-xs flex items-center gap-2 transition-all ${showAdvanced ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100'}`}
            >
              <Filter size={16} />
              <span>البحث المتقدم والمحدد</span>
            </button>

            <button
              onClick={() => {
                setShowZipExport(!showZipExport);
                setShowAdvanced(false);
              }}
              className={`px-5 py-4 rounded-2xl border font-black text-xs flex items-center gap-2 transition-all ${showZipExport ? 'bg-blue-700 border-blue-700 text-white shadow-lg' : 'bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100'}`}
            >
              <FileDown size={16} />
              <span>التجميع والتصدير المجمّع (ZIP)</span>
            </button>
            
            <button
              onClick={handleExportExcel}
              disabled={filteredLetters.length === 0}
              className="px-5 py-4 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-black text-xs flex items-center gap-2 transition-all shadow-md"
            >
              <Download size={16} />
              <span>تصدير للأكسل (XLSX)</span>
            </button>
          </div>
        </div>

        {/* Bulk ZIP Export Panel */}
        <AnimatePresence>
          {showZipExport && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="p-6 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4 text-right">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 sm:flex-row flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-500">
                      <FileDown size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">تصدير وتجميع الخطابات في مجلد مضغوط (ZIP)</h4>
                      <p className="text-[11px] text-slate-400 font-bold">حدّد طريقة التجميع وصيغة الملفات لتنزيل حزمة مؤرشفة لكل خطاب على حدة.</p>
                    </div>
                  </div>

                  {/* Toggle Mode */}
                  <div className="flex bg-slate-200/60 dark:bg-slate-905 p-1 rounded-xl gap-1">
                    <button
                      type="button"
                      onClick={() => setZipSource('dateRange')}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${zipSource === 'dateRange' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      حسب الفترة الزمنية
                    </button>
                    <button
                      type="button"
                      onClick={() => setZipSource('selected')}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${zipSource === 'selected' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      الخطابات المحددة يدوياً ({selectedLetterIds.length})
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
                  {zipSource === 'dateRange' ? (
                    <>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase block mr-1">من تاريخ</label>
                        <input 
                          type="date" 
                          className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold dark:text-white"
                          value={zipDateFrom}
                          onChange={e => setZipDateFrom(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase block mr-1">إلى تاريخ</label>
                        <input 
                          type="date" 
                          className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold dark:text-white"
                          value={zipDateTo}
                          onChange={e => setZipDateTo(e.target.value)}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="col-span-1 sm:col-span-2 space-y-1 self-stretch flex flex-col justify-end">
                      <label className="text-[10px] font-black text-slate-500 uppercase block mr-1">الخطابات المختارة للتصدير</label>
                      <div className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-650 dark:text-slate-350 min-h-[46px] flex items-center">
                        {selectedLetterIds.length > 0 ? (
                          <span>سيتم تصدير <strong className="text-blue-600 dark:text-blue-400">{selectedLetterIds.length}</strong> خطابات قمت بتحديدها من الجدول.</span>
                        ) : (
                          <span className="text-rose-500 font-black">يرجى وضع علامة صح (✓) بجانب الخطابات المطلوبة في الجدول بالأسفل أولاً.</span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase block mr-1">صيغة الملفات المصدرة</label>
                    <select
                      className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold dark:text-white"
                      value={zipFormat}
                      onChange={e => setZipFormat(e.target.value as 'doc' | 'html' | 'both')}
                    >
                      <option value="doc">مستند Word (.doc) - يدعم التعديل والأصل</option>
                      <option value="html">مستند أرشيف الويب (.html) - عالي الدقة للطباعة</option>
                      <option value="both">كلا الملفين معاً (Word + HTML) لكل مادة</option>
                    </select>
                  </div>

                  <div>
                    <button
                      onClick={handleExportBulkZip}
                      disabled={isGeneratingZip || (zipSource === 'selected' && selectedLetterIds.length === 0)}
                      className="w-full px-5 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-800/80 text-white rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                    >
                      {isGeneratingZip ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          <span>جاري تجميع الملفات...</span>
                        </>
                      ) : (
                        <>
                          <FileDown size={14} />
                          <span>تصدير وتجميع الحزمة المضغوطة</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {zipMessage && (
                  <div className={`p-3 rounded-xl border text-xs font-bold ${
                    zipMessage.includes('بنجاح') 
                      ? 'bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-950/20 dark:border-emerald-800' 
                      : 'bg-amber-50 border-amber-100 text-amber-600 dark:bg-amber-950/20 dark:border-amber-800'
                  }`}>
                    {zipMessage}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Advanced Filters Panel */}
        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="p-6 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-right pt-6">
                
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mr-2">رقم الخطاب (مؤرشف)</label>
                  <input 
                    type="text" 
                    placeholder="رقم الخطاب..."
                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-bold dark:text-white"
                    value={advNumber}
                    onChange={e => setAdvNumber(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mr-2">نوع الخطاب المستهدف</label>
                  <select
                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-bold dark:text-white"
                    value={advType}
                    onChange={e => setAdvType(e.target.value)}
                  >
                    <option value="">كل الأنواع</option>
                    {letterTypes.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mr-2">رقم الهيكل (VIN)</label>
                  <input 
                    type="text" 
                    placeholder="رقم شاصي المركبة..."
                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-bold font-mono dark:text-white"
                    value={advVin}
                    onChange={e => setAdvVin(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mr-2">رقم البطاقة الجمركية</label>
                  <input 
                    type="text" 
                    placeholder="رقم البطاقة الجمركية..."
                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-bold dark:text-white"
                    value={advCard}
                    onChange={e => setAdvCard(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mr-2">رقم اللوحة</label>
                  <input 
                    type="text" 
                    placeholder="رقم لوحة السيارة..."
                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-bold dark:text-white"
                    value={advPlate}
                    onChange={e => setAdvPlate(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mr-2">اسم المركبة / الموديل</label>
                  <input 
                    type="text" 
                    placeholder="ماركة وموديل السيارة..."
                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-bold dark:text-white"
                    value={advVehicle}
                    onChange={e => setAdvVehicle(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mr-2">اسم السائق / المستلم</label>
                  <input 
                    type="text" 
                    placeholder="اسم السائق المقيد..."
                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-bold dark:text-white"
                    value={advDriver}
                    onChange={e => setAdvDriver(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mr-2">الجهة المعنية / المورد / المستلم</label>
                  <input 
                    type="text" 
                    placeholder="المكان أو الجهة الصادر إليها..."
                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-bold dark:text-white"
                    value={advDestination}
                    onChange={e => setAdvDestination(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mr-2">مستخدم منشئ المستند</label>
                  <input 
                    type="text" 
                    placeholder="اسم الموظف أو المدير..."
                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-bold dark:text-white"
                    value={advUser}
                    onChange={e => setAdvUser(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mr-2">تاريخ الخطاب (من)</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-bold dark:text-white"
                    value={advDateFrom}
                    onChange={e => setAdvDateFrom(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mr-2">تاريخ الخطاب (إلى)</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-bold dark:text-white"
                    value={advDateTo}
                    onChange={e => setAdvDateTo(e.target.value)}
                  />
                </div>

                {/* Reset Buttons */}
                <div className="flex items-end pb-0.5">
                  <button
                    onClick={() => {
                      setAdvNumber('');
                      setAdvType('');
                      setAdvVin('');
                      setAdvCard('');
                      setAdvPlate('');
                      setAdvVehicle('');
                      setAdvDriver('');
                      setAdvDestination('');
                      setAdvUser('');
                      setAdvDateFrom('');
                      setAdvDateTo('');
                    }}
                    className="w-full py-3 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-300 font-bold text-xs transition-colors"
                  >
                    تصفير كافة حقول الفلترة
                  </button>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Table Layout */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-85 shadow-sm rounded-[2.5rem] overflow-hidden">
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center sm:flex-row flex-col gap-4 min-h-[96px] transition-all">
          {selectedLetterIds.length > 0 ? (
            <div className="w-full flex sm:flex-row flex-col sm:items-center justify-between gap-4 animate-fadeIn">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-2xl">
                  <Check size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    تم تحديد <span className="text-blue-600 dark:text-blue-400 text-lg">{selectedLetterIds.length}</span> خطاباً من الأرشيف
                  </h3>
                  <p className="text-[11px] font-bold text-slate-400 mt-0.5">يمكنك تنزيلهم مجمّعين في ملف ZIP بصيغ مختلفة أو تصديرهم لجدول Excel مخصّص.</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleExportSelectedZip('doc')}
                  disabled={isGeneratingZip}
                  className="px-4 py-2.5 bg-emerald-650 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <FileDown size={14} />
                  <span>تصدير ZIP (Word)</span>
                </button>

                <button
                  onClick={() => handleExportSelectedZip('html')}
                  disabled={isGeneratingZip}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <FileDown size={14} />
                  <span>تصدير ZIP (HTML)</span>
                </button>

                <button
                  onClick={() => handleExportSelectedZip('both')}
                  disabled={isGeneratingZip}
                  className="px-4 py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <FileDown size={14} />
                  <span>كلاهما في ZIP</span>
                </button>

                <button
                  onClick={handleExportSelectedExcel}
                  className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Table size={14} />
                  <span>تصدير لإكسل</span>
                </button>

                <button
                  onClick={() => setSelectedLetterIds([])}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-xl text-xs font-black transition-all"
                >
                  إلغاء التحديد
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-right">
                <h3 className="text-xl font-black text-slate-900 dark:text-white">جدول الخطابات المؤرشفة</h3>
                <p className="text-xs font-bold text-slate-400 mt-1">عرض جميع السجلات المطابقة والمشاركة بالتوافق التام.</p>
              </div>
              <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-full text-xs font-black text-slate-600 dark:text-slate-400">
                إجمالي السجلات: {filteredLetters.length} من {letters.length}
              </span>
            </>
          )}
        </div>

        {filteredLetters.length === 0 ? (
          <div className="p-20 text-center flex flex-col items-center justify-center space-y-4">
            <Compass className="w-16 h-16 text-slate-300 dark:text-slate-700 animate-spin" style={{ animationDuration: '6s' }} />
            <div className="space-y-1">
              <h4 className="text-lg font-black text-slate-900 dark:text-white">لا توجد خطابات مؤرشفة حتى الآن</h4>
              <p className="text-xs font-bold text-slate-400">
                عند حفظ أو طباعة تراخيص الدخول أو الخروج أو النقل أو التسليم، ستنهمر السجلات تلقائياً هنا في الأرشيف.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-right text-xs whitespace-nowrap min-w-[700px] md:min-w-full">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 font-black border-b border-slate-100 dark:border-slate-800">
                  <th className="px-5 py-5 text-center w-12" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 dark:border-slate-800 text-blue-600 focus:ring-blue-500 cursor-pointer h-4 w-4 bg-white dark:bg-slate-900"
                      checked={filteredLetters.length > 0 && selectedLetterIds.length === filteredLetters.length}
                      ref={input => {
                        if (input) {
                          input.indeterminate = selectedLetterIds.length > 0 && selectedLetterIds.length < filteredLetters.length;
                        }
                      }}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th onClick={() => requestSort('letterNumber')} className="px-6 py-5 cursor-pointer selection:bg-none hover:text-blue-500 transition-colors">
                    <div className="flex items-center gap-2">
                      <span>رقم الخطاب</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th onClick={() => requestSort('letterType')} className="px-6 py-5 cursor-pointer hover:text-blue-500 transition-colors">
                    <div className="flex items-center gap-2">
                      <span>نوع الخطاب</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th onClick={() => requestSort('letterDate')} className="hidden sm:table-cell px-6 py-5 cursor-pointer hover:text-blue-500 transition-colors">
                    <div className="flex items-center gap-2">
                      <span>تاريخ الخطاب</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th onClick={() => requestSort('vehicleName')} className="px-6 py-5 cursor-pointer hover:text-blue-500 transition-colors">
                    <div className="flex items-center gap-2">
                      <span>اسم السيارة المركبة</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th onClick={() => requestSort('vin')} className="hidden md:table-cell px-6 py-5 cursor-pointer hover:text-blue-500 transition-colors">
                    <div className="flex items-center gap-2">
                      <span>رقم الهيكل (VIN)</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th onClick={() => requestSort('plateNumber')} className="hidden lg:table-cell px-6 py-5 cursor-pointer hover:text-blue-500 transition-colors">
                    <div className="flex items-center gap-2">
                      <span>رقم اللوحة</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th onClick={() => requestSort('driverName')} className="hidden sm:table-cell px-6 py-5 cursor-pointer hover:text-blue-500 transition-colors">
                    <div className="flex items-center gap-2">
                      <span>اسم السائق / المستلم</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th onClick={() => requestSort('createdBy')} className="hidden lg:table-cell px-6 py-5 cursor-pointer hover:text-blue-500 transition-colors">
                    <div className="flex items-center gap-2">
                      <span>المستخدم المنشئ</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th className="px-6 py-5 text-center">إجراءات التحكم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredLetters.map(letter => {
                  const isSelected = selectedLetterIds.includes(letter.id);
                  return (
                    <tr 
                      key={letter.id}
                      onClick={() => setActiveLetter(letter)}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-950/80 cursor-pointer transition-colors group font-bold text-slate-700 dark:text-slate-300 ${isSelected ? 'bg-blue-500/5 dark:bg-blue-500/10' : ''}`}
                    >
                      <td className="px-5 py-4 text-center" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 dark:border-slate-800 text-blue-600 focus:ring-blue-500 cursor-pointer h-4 w-4 bg-white dark:bg-slate-900"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(letter.id)}
                        />
                      </td>
                      <td className="px-6 py-4 font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                        {letter.letterNumber}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full font-black text-[11px]">
                          {letter.letterType}
                        </span>
                      </td>
                    <td className="hidden sm:table-cell px-6 py-4 text-slate-500 dark:text-slate-400">{letter.letterDate}</td>
                    <td className="px-6 py-4 text-slate-800 dark:text-white font-black">{letter.vehicleName}</td>
                    <td className="hidden md:table-cell px-6 py-4 font-mono text-xs">{letter.vin}</td>
                    <td className="hidden lg:table-cell px-6 py-4 text-slate-600 dark:text-slate-300 font-mono">{letter.plateNumber || '-'}</td>
                    <td className="hidden sm:table-cell px-6 py-4 truncate max-w-xs">{letter.driverName || '-'}</td>
                    <td className="hidden lg:table-cell px-6 py-4 text-xs font-black text-blue-600">{letter.createdBy}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center items-center gap-2" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setActiveLetter(letter)}
                          title="عرض بالتفصيل"
                          className="p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-500 dark:text-slate-350 rounded-xl transition-all"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => handleReprint(letter)}
                          title="إعادة طباعة الخطاب"
                          className="p-2.5 bg-sky-50 dark:bg-sky-950 hover:bg-sky-100 dark:hover:bg-sky-900 text-sky-600 dark:text-sky-400 rounded-xl transition-all"
                        >
                          <Printer size={14} />
                        </button>
                        <button
                          onClick={(e) => handleExportSinglePDF(letter, e)}
                          title="تصدير كملف PDF مباشر (.pdf)"
                          className="p-2.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-600 dark:text-rose-400 rounded-xl transition-all"
                        >
                          <FileText size={14} />
                        </button>
                        <button
                          onClick={(e) => handleExportSingleWord(letter, e)}
                          title="تصدير كملف Word (.doc)"
                          className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-600 dark:text-emerald-400 rounded-xl transition-all"
                        >
                          <FileDown size={14} />
                        </button>
                        {currentUser?.role === 'مدير' && (
                          <button
                            onClick={(e) => handleDeleteLetter(letter.id, e)}
                            title="حذف من الأرشيف"
                            className="p-2.5 bg-rose-50 dark:bg-rose-950 hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-650 dark:text-rose-400 rounded-xl transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Embedded Original Letter Preview Modal */}
      <AnimatePresence>
        {activeLetter && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveLetter(null)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 w-full max-w-5xl h-[85vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden relative z-10"
            >
              
              {/* Modal Header */}
              <div className="p-6 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center px-8">
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-rose-600 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-1 rounded-full uppercase tracking-wider">{activeLetter.letterNumber}</span>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white capitalize">{activeLetter.letterType}</h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">تاريخ الخطاب: {activeLetter.letterDate} / تم الأرشفة بواسطة: {activeLetter.createdBy}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExportSinglePDF(activeLetter)}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs flex items-center gap-2 shadow-md transition-all"
                  >
                    <FileText size={14} />
                    <span>تنزيل PDF مباشر (.pdf)</span>
                  </button>

                  <button
                    onClick={() => handleExportSingleWord(activeLetter)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs flex items-center gap-2 shadow-md transition-all"
                  >
                    <FileDown size={14} />
                    <span>تنزيل مستند Word (.doc)</span>
                  </button>

                  <button
                    onClick={() => handleReprint(activeLetter)}
                    className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl font-black text-xs flex items-center gap-2 shadow-md transition-all"
                  >
                    <Printer size={14} />
                    <span>طباعة الخطاب والتصدير لـ PDF</span>
                  </button>

                  <button
                    onClick={() => setActiveLetter(null)}
                    className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-rose-500 rounded-xl transition-colors"
                  >
                    إغلاق المعاينة
                  </button>
                </div>
              </div>

              {/* Modal Frame with original HTML inside */}
              <div className="flex-1 bg-slate-300 dark:bg-slate-950 p-6 flex items-center justify-center overflow-auto custom-scrollbar">
                <div className="w-[210mm] min-h-[297mm] bg-white text-slate-950 p-[15mm] shadow-2xl rounded-2xl relative border border-slate-200">
                  {/* Embedded Iframe sandboxed with the stored HTML content dynamically */}
                  <iframe
                    title="Letter original view"
                    className="w-full h-[75vh]"
                    srcDoc={activeLetter.htmlContent
                      ? activeLetter.htmlContent
                          .replace(/window\.onload\s*=\s*\(\)\s*=>\s*\{[\s\S]*?\};?/g, '')
                          .replace(/window\.print\(\);?/g, '')
                          .replace(/window\.close\(\);?/g, '')
                      : ''
                    }
                    style={{ border: 'none' }}
                  />
                </div>
              </div>

              {/* Footer specs details for quick lookups */}
              <div className="p-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 md:grid-cols-5 gap-4 text-center text-xs font-black">
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block mb-0.5">رقم الهيكل VIN</span>
                  <span className="font-mono text-slate-800 dark:text-slate-150">{activeLetter.vin || '-'}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block mb-0.5">رقم اللوحة</span>
                  <span className="text-slate-800 dark:text-slate-150">{activeLetter.plateNumber || '-'}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block mb-0.5">رقم البطاقة الجمركية</span>
                  <span className="text-slate-800 dark:text-slate-150">{activeLetter.cardNumber || '-'}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block mb-0.5">السائق المقيد</span>
                  <span className="text-slate-800 dark:text-slate-150 truncate block">{activeLetter.driverName || '-'}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block mb-0.5">الجهة المقصودة</span>
                  <span className="text-slate-800 dark:text-slate-150 truncate block">{activeLetter.destination || '-'}</span>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
