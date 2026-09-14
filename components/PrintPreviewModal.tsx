import React, { useRef, useEffect, useState } from 'react';
import { X, Printer, ShieldAlert, FileText, Settings, Sparkles, RefreshCw, Edit, Code, RotateCcw, Check, FileDown, CheckCircle2 } from 'lucide-react';
import { useLanguage } from './LanguageContext';
import { saveFileSafely } from '../services/downloadService';

interface PrintPreviewModalProps {
  html: string;
  onClose: () => void;
  settings?: any;
}

const getSettingsFromStorage = () => {
  try {
    const tenantId = localStorage.getItem('current_tenant_id') || 'default';
    const tenantPrefix = tenantId ? `tenant_${tenantId}_` : '';
    let raw = localStorage.getItem(`${tenantPrefix}settings_secure`) || 
              localStorage.getItem(`${tenantPrefix}app_settings`) || 
              localStorage.getItem('app_settings');
    if (raw && raw.startsWith('{')) {
      return JSON.parse(raw);
    }
  } catch {}
  return {};
};

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({ html, onClose, settings }) => {
  const { lang, t, isRtl } = useLanguage();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const activeSettings = settings || getSettingsFromStorage();
  const logoWidth = activeSettings.logoWidth !== undefined ? activeSettings.logoWidth : 120;
  const logoPosX = activeSettings.logoPosX !== undefined ? activeSettings.logoPosX : 0;
  const logoPosY = activeSettings.logoPosY !== undefined ? activeSettings.logoPosY : 0;

  // States for text editing
  const [currentHtml, setCurrentHtml] = useState(html);
  const [isVisualEdit, setIsVisualEdit] = useState(false);
  const [isCodeEdit, setIsCodeEdit] = useState(false);
  const [codeValue, setCodeValue] = useState(html);
  const [activeTab, setActiveTab] = useState<'visual' | 'code'>('visual');
  const [isCodeApplied, setIsCodeApplied] = useState(false);
  const [showPdfTip, setShowPdfTip] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [orientationOverride, setOrientationOverride] = useState<'landscape' | 'portrait' | null>(null);

  useEffect(() => {
    setCurrentHtml(html);
    setCodeValue(html);
    setOrientationOverride(null);
  }, [html]);

  const isLandscape = currentHtml.includes('landscape') || currentHtml.includes('Landscape');
  const detectedOrientation = orientationOverride !== null ? orientationOverride : (isLandscape ? 'landscape' : 'portrait');

  // Inject script & styles on HTML load/change
  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentWindow?.document || iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        
        // Clean dynamic styles
        const headStyles = `
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@200;300;400;500;600;700;800;900&display=swap');
            html, body {
              margin: 0;
              padding: 0;
              background-color: #ffffff !important;
              background: #ffffff !important;
              font-family: 'Cairo', sans-serif;
              direction: rtl;
              text-align: right;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            
            /* Visual editing guidelines */
            [contenteditable="true"]:hover {
              outline: 1px dashed #3b82f6 !important;
              background-color: rgba(59, 130, 246, 0.05) !important;
              cursor: text;
            }
            [contenteditable="true"]:focus {
              outline: 2px solid #2563eb !important;
              background-color: rgba(59, 130, 246, 0.08) !important;
            }

            /* Universal premium watermark class to make logo 4% opacity and behind text */
            .watermark {
              position: absolute !important;
              top: 50% !important;
              left: 50% !important;
              transform: translate(-50%, -50%) !important;
              opacity: 0.25 !important; /* Elegant 25% opacity */
              z-index: 1 !important; /* Sits elegantly in the background, never overlaying on top of dark text */
              pointer-events: none !important; /* Non-blocking for text selection & copy */
              user-select: none !important;
              -webkit-user-select: none !important;
              width: 50% !important;
              max-width: 500px !important;
            }
            
            /* Professional Logo Optimization matching user interactive logo control settings */
            .header-logo, .logo-img, .logo, .logo-area, .logo-header img, .logo-container img {
              width: ${logoWidth}px !important;
              max-width: none !important;
              max-height: none !important;
              height: auto !important;
              object-fit: contain !important;
              filter: drop-shadow(0px 2px 5px rgba(30, 58, 138, 0.05)) !important;
              transition: all 0.3s ease !important;
              position: relative !important;
              transform: translate(${logoPosX}px, ${logoPosY}px) !important;
            }

            /* Make sure header text doesn't wrap awkwardly */
            .header h1, .org-title, .header-right h1, .header-info div:first-child {
              white-space: nowrap !important;
              font-family: 'Cairo', sans-serif !important;
            }

            /* Elegant, solid, professional single blue line under the headers */
            .header {
              border-bottom: 1.5px solid #1e3a8a !important; /* Single line only */
              padding-bottom: 6px !important;
              margin-bottom: 0px !important; /* Removed heavy margin so title spacing is exact */
            }

            /* Override title sections to keep them compact, clean, and eliminate double lines */
            .title-section, .doc-title-sec, .title-sec, .letter-subject-sec {
              border: none !important;
              border-top: none !important;
              border-bottom: none !important;
              margin-top: 10px !important;    /* Distance from separator line: between 8 and 12px */
              margin-bottom: 12px !important; /* Distance to the content below: between 10 and 15px */
              padding: 0 !important;
            }
            .title, .document-title, .letter-subject {
              border: none !important;
              border-bottom: none !important;
              text-decoration: none !important; /* No underline or duplicate lines */
              margin: 0 !important;
              padding: 0 !important;
            }
            .date-row, .date-section, .date-sec {
              margin-top: 0px !important;
              margin-bottom: 6px !important;
              padding: 0 !important;
            }

            /* Make sure parent content wrappers don't block layout flow */
            .content-wrapper, .card {
              position: relative !important;
              z-index: 10 !important;
            }
            
            /* Ensure exported PDF/printed tables have readable row height and text formatting */
            tr {
              height: 21pt !important;
            }
            thead tr {
              height: 25pt !important;
            }
            th, td {
              vertical-align: middle !important;
              line-height: 1.4 !important;
            }
            /* Custom scrollbar matching container styling */
            ::-webkit-scrollbar {
              width: 6px;
              height: 6px;
            }
            ::-webkit-scrollbar-track {
              background: #f1f1f1;
            }
            ::-webkit-scrollbar-thumb {
              background: #3b82f6;
              border-radius: 4px;
            }
            ::-webkit-scrollbar-thumb:hover {
              background: #1d4ed8;
            }
            
            @page {
              size: A4 ${detectedOrientation} !important;
              margin: 6mm 8mm !important; /* Premium safe margins matching letter templates to prevent double-page spill */
            }
            
            @media print {
              html, body {
                width: 100% !important;
                height: auto !important;
                background-color: white !important;
                background: white !important;
                direction: rtl !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color: #000000 !important;
              }
              body {
                padding: 0 !important;
                margin: 0 !important;
              }
              .no-print, .print-hidden {
                display: none !important;
              }
              /* Hide editing outlines when printing */
              [contenteditable="true"] {
                outline: none !important;
                background-color: transparent !important;
              }
              
              /* Ensure tables don't split awkwardly across pages */
              tr {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              thead {
                display: table-header-group !important;
              }
              tfoot {
                display: table-footer-group !important;
              }
              
              /* Keep signature block on the same page */
              .signature-block, .signature-box, .basmala {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }

              /* Enhanced typography and readability on paper */
              table {
                page-break-inside: auto !important;
                /* Let columns size naturally by their content instead of being
                   force-squeezed into a fixed 100% width — squeezing is what
                   was causing column text to wrap/clip awkwardly. The whole
                   page is scaled down as one unit instead (see script below),
                   so every column keeps its natural, readable proportions. */
                table-layout: auto !important;
                width: auto !important;
                max-width: none !important;
              }
              td, th {
                page-break-inside: avoid !important;
                white-space: nowrap !important;
              }
            }
          </style>
          <script>
            (function () {
              // Auto-fit-to-page: if the printed content (e.g. a wide table with
              // many columns) is wider than one printable A4 page, shrink the
              // ENTIRE page uniformly (like zooming out) so every column stays
              // fully visible and every word stays intact — instead of each
              // column being individually squeezed, which is what caused text
              // to wrap/clip. Never shrinks past 40% (keeps text legible).
              function autoFitPrintScale() {
                try {
                  document.body.style.zoom = '';
                  var table = document.querySelector('table');
                  if (!table) return;
                  var naturalWidth = table.scrollWidth;
                  var pageWidth = document.body.clientWidth || document.documentElement.clientWidth;
                  if (naturalWidth > pageWidth && pageWidth > 0) {
                    var scale = Math.max(0.4, pageWidth / naturalWidth);
                    document.body.style.zoom = scale;
                  }
                } catch (e) {}
              }
              window.addEventListener('beforeprint', autoFitPrintScale);
              window.addEventListener('load', autoFitPrintScale);
              if (document.readyState === 'complete') autoFitPrintScale();
            })();
          </script>
        `;
        
        // Ensure we clean up tab side effects
        const sanitizedHtml = currentHtml
          .replace(/window\.close\(\);?/gi, '')
          .replace(/window\.print\(\);?/gi, '')
          .trim();

        // Inject styles at the end of the head safely or in body
        let finalHtml = sanitizedHtml;
        if (finalHtml.includes('</head>')) {
          finalHtml = finalHtml.replace('</head>', `${headStyles}</head>`);
        } else {
          finalHtml = `${headStyles}${finalHtml}`;
        }

        doc.write(finalHtml);
        doc.close();

        // Check if designMode / contenteditable should be on
        if (isVisualEdit) {
          doc.designMode = "on";
        } else {
          doc.designMode = "off";
        }
      }
    }
  }, [currentHtml, detectedOrientation]);

  // Handle visual edit mode toggle
  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentWindow?.document || iframeRef.current.contentDocument;
      if (doc) {
        if (isVisualEdit) {
          doc.designMode = "on";
        } else {
          doc.designMode = "off";
          // Sync visually modified HTML back to the state
          try {
            const currentDocHtml = doc.documentElement.outerHTML;
            setCodeValue(currentDocHtml);
          } catch (e) {
            console.error('Failed to sync visual edits:', e);
          }
        }
      }
    }
  }, [isVisualEdit]);

  const handlePrint = () => {
    if (iframeRef.current) {
      try {
        // Sync any active visual modifications before printing
        const doc = iframeRef.current.contentWindow?.document || iframeRef.current.contentDocument;
        if (doc) {
          // Temporarily turn design mode off to avoid printing edit outlines or carets
          doc.designMode = "off";
          setCodeValue(doc.documentElement.outerHTML);
        }

        // Trigger native print directly via embedded iframe
        if (iframeRef.current.contentWindow) {
          iframeRef.current.contentWindow.focus();
          iframeRef.current.contentWindow.print();
        }

        // Re-enable visual edit if it was enabled
        if (isVisualEdit && doc) {
          doc.designMode = "on";
        }
      } catch (err) {
        console.error('Print preview trigger failed:', err);
      }
    }
  };

  const handleExportPDF = async () => {
    // IMPORTANT: this now intentionally reuses the exact same mechanism as
    // handlePrint() — triggering the browser's native print on the live
    // iframe content — instead of the previous separate
    // exportHTMLToDirectPDF() pipeline (a different html2canvas-based
    // re-render). That separate pipeline could visually diverge from what
    // is actually shown in the preview (fonts, RTL layout, image timing),
    // producing what looked like "a different document". Printing the
    // live DOM directly guarantees the exported PDF (via the browser's own
    // "Save as PDF" print destination) is pixel-identical to the preview.
    if (iframeRef.current) {
      try {
        const doc = iframeRef.current.contentWindow?.document || iframeRef.current.contentDocument;
        if (doc) {
          doc.designMode = "off";
          setCodeValue(doc.documentElement.outerHTML);
        }

        if (iframeRef.current.contentWindow) {
          iframeRef.current.contentWindow.focus();
          iframeRef.current.contentWindow.print();
        }

        if (isVisualEdit && doc) {
          doc.designMode = "on";
        }
      } catch (err) {
        console.error('Direct PDF export (print-based) trigger failed:', err);
      }
    }
  };

  const handleDownloadHtml = async () => {
    if (iframeRef.current) {
      try {
        const doc = iframeRef.current.contentWindow?.document || iframeRef.current.contentDocument;
        const finalHtml = doc ? doc.documentElement.outerHTML : currentHtml;
        const fileName = `digital_document_${new Date().getTime()}.html`;
        await saveFileSafely(finalHtml, fileName, 'text/html;charset=utf-8');
      } catch (err) {
        console.error('Failed to download HTML:', err);
      }
    }
  };

  const handleApplyCodeValue = () => {
    setCurrentHtml(codeValue);
    setIsCodeApplied(true);
    setTimeout(() => setIsCodeApplied(false), 2000);
  };

  const handleReset = () => {
    if (confirm(lang === 'ar' ? 'هل أنت متأكد من إعادة تعيين المستند وحذف جميع تعديلاتك؟' : 'Are you sure you want to reset the document and delete all your edits?')) {
      setCurrentHtml(html);
      setCodeValue(html);
      setIsVisualEdit(false);
    }
  };

  return (
    <div id="print-preview-modal-overlay" className="fixed inset-0 z-[1000] flex items-stretch justify-end bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
      {isExportingPdf && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[110000] flex flex-col justify-center items-center text-white font-sans animate-in fade-in duration-200" dir="rtl">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl text-center shadow-2xl max-w-sm w-[90%] space-y-4">
            <div className="w-12 h-12 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin mx-auto" />
            <h3 className="text-lg font-black text-slate-100">جاري تصدير ملف PDF الاحترافي...</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-bold">
              يرجى الانتظار، يتم الآن توليد وحفظ الملف تلقائياً بجودة عالية وبدون استخدام نافذة الطباعة.
            </p>
          </div>
        </div>
      )}
      {/* Visual content viewer area (A4 simulation stage) */}
      <div className="flex-1 flex flex-col items-center justify-center p-2 md:p-8 overflow-y-auto custom-scrollbar">
        <div className="w-full max-w-4xl flex flex-col items-center gap-4">
          <div className="flex items-center justify-between w-full text-white/90 px-2">
            <span className="text-xs md:text-sm font-black flex items-center gap-2 bg-slate-900/45 px-4 py-2 rounded-2xl border border-slate-800/80">
              <Sparkles size={14} className="text-yellow-400 animate-pulse" />
              {lang === 'ar' ? 'معاينة حية وتعديل مباشر على الورقة A4' : 'A4 Official Live Match Preview & Editor'}
            </span>
            
            <button
              onClick={onClose}
              className="md:hidden flex items-center justify-center p-3 bg-rose-500 hover:bg-rose-600 active:scale-95 transition-all text-white rounded-2xl shadow-lg shadow-rose-500/10"
              title={lang === 'ar' ? 'إغلاق' : 'Close'}
            >
              <X size={18} />
            </button>
          </div>

          {/* Visual Editing Active Bar Indicator */}
          {isVisualEdit && (
            <div className="w-full bg-amber-500/90 text-white text-xs md:text-sm font-black py-2 px-4 rounded-xl text-center shadow-lg border border-amber-400 animate-pulse flex items-center justify-center gap-2">
              <Edit size={14} />
              <span>{lang === 'ar' ? 'وضع التعديل البصري نشط: انقر بـ الماوس على أي كلمة أو قيمة داخل المستند واكتب التعديل فوراً!' : 'Visual Edit Active: Click on any text inside the document to type edits directly!'}</span>
            </div>
          )}

          {/* PDF Direct Export Instructions Tip */}
          {showPdfTip && (
            <div className="w-full bg-rose-600 text-white text-xs md:text-sm font-black py-3 px-5 rounded-2xl text-center shadow-xl border border-rose-500/50 animate-in fade-in zoom-in duration-300 flex flex-col md:flex-row items-center justify-center gap-3">
              <div className="flex items-center gap-2 shrink-0">
                <span className="bg-white text-rose-650 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase animate-bounce">PDF GUIDE</span>
                <span>💡 {lang === 'ar' ? 'للتصدير والحفظ الفوري كـ PDF:' : 'To Export and Save as PDF:'}</span>
              </div>
              <p className="text-[11px] font-bold leading-relaxed text-rose-50">
                {lang === 'ar' 
                  ? 'من شاشة خيارات الطباعة القادمة، يرجى تغيير الوجهة (Destination) إلى "حفظ بتنسيق PDF" (Save as PDF) ثم اضغط "حفظ"!' 
                  : 'In the printing screen, please change the Destination to "Save as PDF" then click "Save"!'}
              </p>
              <button 
                onClick={() => setShowPdfTip(false)}
                className="text-white hover:text-rose-200 text-xs font-black underline cursor-pointer shrink-0 ml-auto bg-rose-700/30 px-3 py-1 rounded-lg"
              >
                {lang === 'ar' ? 'حسناً، جاري التصدير...' : 'Got it, exporting...'}
              </button>
            </div>
          )}

          <div 
            id="print-preview-frame-container" 
            className={`w-full ${isLandscape ? 'aspect-[1.4142/1]' : 'aspect-[1/1.4142]'} max-h-[82vh] bg-white rounded-[1.5rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] border border-slate-200 dark:border-slate-800 overflow-hidden relative group transition-all duration-300 hover:scale-[1.002]`}
          >
            <iframe
              ref={iframeRef}
              title="Print Preview Frame"
              className="w-full h-full border-0 bg-white"
            />
          </div>
        </div>
      </div>

      {/* Control panel sidebar and editor */}
      <div 
        id="print-preview-sidebar" 
        className="w-full max-w-sm bg-white dark:bg-slate-900 border-l border-slate-100 dark:border-slate-800/80 shadow-2xl flex flex-col p-6 text-start select-none justify-between animate-in slide-in-from-left duration-300"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <div className="space-y-6 flex-1 overflow-y-auto no-scrollbar pb-4">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500 animate-pulse">
                <Printer size={22} />
              </div>
              <div className="space-y-0.5">
                <h2 className="text-base font-black text-slate-800 dark:text-white leading-none">
                  {lang === 'ar' ? 'تعديل وتهيئة مستند الطباعة' : 'Edit & Configure Document'}
                </h2>
                <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase">
                  {lang === 'ar' ? 'محرر الخطابات الذكي' : 'SMART DOCUMENT EDITOR'}
                </span>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="p-2.5 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:scale-105 transition-all bg-slate-50 dark:bg-slate-800 rounded-xl cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Quick info status alert */}
          <div className="p-3.5 bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/10 rounded-2xl flex gap-3 text-start">
            <FileText size={18} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="text-[11px] font-bold leading-normal text-blue-800 dark:text-blue-300">
              {lang === 'ar' 
                ? 'يتيح لك هذا القسم التعديل الكامل على محتوى الخطاب بلمسة واحدة. إما بالنقر المباشر أو بتغيير كود HTML لضمان طباعة خالية من الأخطاء!' 
                : 'This system allows you to completely customize the document before printing. Use visual editor or raw HTML edits!'}
            </p>
          </div>

          {/* Page Orientation Selector */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-100 dark:border-slate-800/60 space-y-3 text-start">
            <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5 justify-start">
              <Settings size={14} className="text-blue-500" />
              {lang === 'ar' ? 'تحديد اتجاه طباعة الصفحة' : 'Document Orientation'}
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOrientationOverride('portrait')}
                className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                  detectedOrientation === 'portrait'
                    ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/15 font-black'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-650 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 font-bold'
                }`}
              >
                <span>📄 {lang === 'ar' ? 'رأسي (عمودي)' : 'Portrait'}</span>
              </button>
              <button
                type="button"
                onClick={() => setOrientationOverride('landscape')}
                className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                  detectedOrientation === 'landscape'
                    ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/15 font-black'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-650 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 font-bold'
                }`}
              >
                <span>📟 {lang === 'ar' ? 'أفقي (عريض)' : 'Landscape'}</span>
              </button>
            </div>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 leading-normal">
              {lang === 'ar' 
                ? '💡 تلميح: إذا ظهر التقرير مقلوباً أو غير منظم في ملف PDF، جرب تبديل هذا الخيار ليتطابق مع إعدادات صفحة الطباعة بمتصفحك!'
                : '💡 Tip: If the printed PDF appears rotated or cut off, toggle this option to match your web browser page settings!'}
            </p>
          </div>

          {/* Editor Tabs */}
          <div className="space-y-4">
            <div className="flex bg-slate-100 dark:bg-slate-850 p-1.5 rounded-xl gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('visual');
                  setIsVisualEdit(true);
                }}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'visual' 
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                <Edit size={14} />
                <span>{lang === 'ar' ? 'تعديل بصري مباشر' : 'Visual direct edit'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('code');
                  setIsVisualEdit(false);
                }}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'code' 
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                <Code size={14} />
                <span>{lang === 'ar' ? 'تعديل الكود برمجيًا' : 'Advanced HTML'}</span>
              </button>
            </div>

            {/* Tab Panels */}
            {activeTab === 'visual' ? (
              <div className="space-y-3.5 animate-in fade-in duration-200">
                <div className="p-4 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-100 dark:border-slate-800/60">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-amber-500" />
                      {lang === 'ar' ? 'التصحيح بالماوس والكتابة' : 'Click & Type Editing'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsVisualEdit(!isVisualEdit)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isVisualEdit ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          isVisualEdit ? (isRtl ? '-translate-x-5' : 'translate-x-5') : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-normal">
                    {lang === 'ar'
                      ? 'عند تفعيل الخيار، توجه إلى ورقة الخطاب على اليسار، انقر بـ الماوس على أي كلمة ترغب في تغييرها (مثل اسم السائق، الملاحظات، أو اسم الشركة) ثم اكتب كالعادة على كيبورد جهازك!'
                      : 'Just toggle this on, then click on any piece of text within the preview to type changes directly using your keyboard!'}
                  </p>
                </div>

                <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl text-[11px] font-bold text-emerald-800 dark:text-emerald-400">
                  <span>{lang === 'ar' ? '✓ التغييرات تطبع فوراً بدقة تامة ومطابقة 100%' : '✓ Edits are instantly formatted and perfectly print-ready.'}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3 animate-in fade-in duration-200">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-black text-slate-400">
                    {lang === 'ar' ? 'كود الـ HTML البرمجي للخطاب' : 'Raw Document Code'}
                  </label>
                  <textarea
                    value={codeValue}
                    onChange={(e) => setCodeValue(e.target.value)}
                    dir="ltr"
                    className="w-full h-48 p-3 text-[10px] font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200 custom-scrollbar resize-none"
                    placeholder="HTML Code..."
                  />
                </div>

                <button
                  type="button"
                  onClick={handleApplyCodeValue}
                  className="w-full py-2.5 px-4 bg-slate-800 dark:bg-slate-700 hover:bg-slate-950 dark:hover:bg-slate-600 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  {isCodeApplied ? <Check size={14} className="text-emerald-400 animate-ping" /> : <RefreshCw size={14} />}
                  <span>{lang === 'ar' ? (isCodeApplied ? 'تم تطبيق تعديلات كود الخطاب!' : 'تطبيق وتحديث ورقة المعاينة') : (isCodeApplied ? 'Applied Code Changes!' : 'Update Document Preview')}</span>
                </button>
              </div>
            )}
          </div>

          {/* Restore / Reset Section */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400">{lang === 'ar' ? 'هل تود العودة للأصل؟' : 'Revert to original?'}</span>
            <button
              onClick={handleReset}
              className="py-1.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw size={12} />
              <span>{lang === 'ar' ? 'إعادة التعيين الأصلية' : 'Reset changes'}</span>
            </button>
          </div>
        </div>

        {/* Print controls */}
        <div className="pt-6 space-y-2.5 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={handleExportPDF}
            className="w-full px-6 py-3.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white rounded-2xl font-black text-sm shadow-xl shadow-rose-500/15 flex items-center justify-center gap-3 transition-all cursor-pointer group"
          >
            <FileDown size={18} className="group-hover:translate-y-0.5 transition-transform" />
            <span>{lang === 'ar' ? 'تصدير PDF مباشر 📥' : 'Export Direct PDF 📥'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="w-full px-6 py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-2xl font-black text-sm shadow-xl shadow-blue-500/15 flex items-center justify-center gap-3 transition-all cursor-pointer group"
          >
            <Printer size={18} className="group-hover:rotate-12 transition-transform" />
            <span>{lang === 'ar' ? 'بدء عملية الطباعة' : 'Trigger System Print'}</span>
          </button>

          <button
            onClick={handleDownloadHtml}
            className="w-full px-6 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-2"
            title={lang === 'ar' ? 'تحميل كملف مستند HTML مستقل للأرشفة' : 'Download standalone HTML file'}
          >
            <FileText size={14} />
            <span>{lang === 'ar' ? 'تحميل نسخة رقمية (HTML)' : 'Download Digital Copy (HTML)'}</span>
          </button>

          <button
            onClick={onClose}
            className="w-full px-6 py-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-500 dark:text-slate-400 rounded-2xl font-black text-xs transition-all cursor-pointer text-center"
          >
            {lang === 'ar' ? 'إغلاق وإلغاء المعاينة' : 'Cancel & Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
