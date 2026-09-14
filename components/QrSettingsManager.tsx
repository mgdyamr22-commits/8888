import React, { useState, useEffect } from 'react';
import { 
  QrCode, 
  ShieldCheck, 
  CheckCircle2, 
  Sliders, 
  RefreshCcw, 
  Activity, 
  Layers, 
  Sparkles, 
  Copy, 
  Info,
  Download,
  AlertTriangle
} from 'lucide-react';
import { 
  QrSettings, 
  QrDiagnosticReport, 
  DEFAULT_QR_SETTINGS, 
  getStoredQrSettings, 
  saveQrSettings, 
  generateQrCodeDataUrl, 
  DocumentQrData 
} from '../src/utils/qrHelper';

export const QrSettingsManager: React.FC<{
  onClose?: () => void;
}> = ({ onClose }) => {
  const [settings, setSettings] = useState<QrSettings>(getStoredQrSettings());
  const [previewDataUrl, setPreviewDataUrl] = useState<string>('');
  const [fingerprint, setFingerprint] = useState<string>('');
  const [report, setReport] = useState<QrDiagnosticReport | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [showSaveAlert, setShowSaveAlert] = useState<boolean>(false);
  const [testDocument, setTestDocument] = useState<DocumentQrData>({
    documentType: 'إذن خروج مركبة رسمي',
    serialNumber: 'LTR-2026-991',
    date: new Date().toLocaleDateString('ar-SA'),
    orgName: 'شركة المخزون للسيارات',
    orgCr: '1010884432',
    vehicleDetails: {
      brand: 'تويوتا',
      model: 'كامري GLE',
      year: '2025',
      vin: '4T1B11HK5JU982103',
      plateNumber: 'أ ب ج 1234'
    }
  });

  const updatePreview = async (currentSettings: QrSettings) => {
    setIsGenerating(true);
    try {
      const res = await generateQrCodeDataUrl(testDocument, currentSettings);
      setPreviewDataUrl(res.qrCodeDataUrl);
      setFingerprint(res.fingerprint);
      setReport(res.report);
    } catch (e) {
      console.error('Failed to update QR preview:', e);
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    updatePreview(settings);
  }, []);

  const handleChange = <K extends keyof QrSettings>(key: K, value: QrSettings[K]) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    updatePreview(updated);
  };

  const handleSave = () => {
    saveQrSettings(settings);
    setShowSaveAlert(true);
    setTimeout(() => setShowSaveAlert(false), 3000);
  };

  const handleReset = () => {
    setSettings(DEFAULT_QR_SETTINGS);
    saveQrSettings(DEFAULT_QR_SETTINGS);
    updatePreview(DEFAULT_QR_SETTINGS);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 md:p-8 space-y-8 max-w-4xl mx-auto text-slate-900 dark:text-white">
      {/* Title Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-2xl border border-blue-100 dark:border-blue-900">
            <QrCode size={28} />
          </div>
          <div>
            <h2 className="text-xl font-extrabold flex items-center gap-2">
              إعدادات كود QR والتحقق الرقمي (ISO/IEC 18004)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5">
              مبني وفق أعلى المعايير الصناعية للطباعة عالية الدقة والمسح السريع للكاميرات وأجهزة الليزر
            </p>
          </div>
        </div>

        {showSaveAlert && (
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs font-black animate-in fade-in">
            <CheckCircle2 size={16} />
            تم حفظ الإعدادات بنجاح
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Side: Interactive Preview & Scan Quality Report */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center space-y-4 text-center">
            <div className="text-xs font-extrabold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Sparkles size={14} className="text-blue-500" />
              المعاينة التفاعلية المباشرة (100% نسبة 1:1)
            </div>

            {/* Live QR Canvas Frame */}
            <div className="p-4 bg-white border-2 border-slate-900 rounded-2xl shadow-sm inline-block">
              {isGenerating ? (
                <div className="w-48 h-48 flex items-center justify-center text-slate-400">
                  <RefreshCcw className="animate-spin" size={28} />
                </div>
              ) : (
                <img 
                  src={previewDataUrl} 
                  alt="QR Code Preview" 
                  className="w-48 h-48 object-contain block mx-auto"
                  style={{
                    imageRendering: 'pixelated',
                  }}
                />
              )}
            </div>

            <div className="text-xs font-mono font-black text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-3 py-1 rounded-lg border border-blue-100 dark:border-blue-900">
              رمز التوثيق: {fingerprint || 'AMP-SYS-982103'}
            </div>
          </div>

          {/* Quality Diagnostic Report Card */}
          {report && (
            <div className="bg-slate-900 text-white p-5 rounded-3xl space-y-4 border border-slate-800 shadow-md">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs font-bold flex items-center gap-2 text-slate-300">
                  <Activity size={16} className="text-emerald-400" />
                  تقرير جودة المسح والتوافق الرقمي
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                  report.scanQualityScore >= 90 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                    : report.scanQualityScore >= 70 
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}>
                  {report.scanQualityScore} / 100
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-800/60 p-2.5 rounded-xl">
                  <div className="text-slate-400 text-[10px]">إصدار الرمز (Version):</div>
                  <div className="font-mono font-bold text-slate-100">Version {report.version} ({report.moduleCount}x{report.moduleCount})</div>
                </div>
                <div className="bg-slate-800/60 p-2.5 rounded-xl">
                  <div className="text-slate-400 text-[10px]">مستوى تصحيح الأخطاء:</div>
                  <div className="font-bold text-slate-100">Level {report.errorCorrectionLevel}</div>
                </div>
                <div className="bg-slate-800/60 p-2.5 rounded-xl">
                  <div className="text-slate-400 text-[10px]">حجم المربع (Module):</div>
                  <div className="font-mono font-bold text-emerald-400">{report.pixelSize}px / مربع</div>
                </div>
                <div className="bg-slate-800/60 p-2.5 rounded-xl">
                  <div className="text-slate-400 text-[10px]">منطقة الأمان (Quiet Zone):</div>
                  <div className="font-bold text-slate-100">{report.quietZone} Modules</div>
                </div>
              </div>

              <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <ShieldCheck size={14} />
                  {report.isVerified ? 'تم التحقق من قابلية المسح محلياً (jsQR Decoded 100%)' : 'تم اختيار النمط التلقائي للمسح'}
                </span>
                <span>{report.dataSize} بكت</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Form Controls */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Payload Mode & Density */}
          <div className="space-y-3">
            <label className="text-sm font-black flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <Layers size={18} className="text-blue-500" />
              كثافة البيانات ونمط التوثيق (Payload Density)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleChange('payloadMode', 'ultra_compact')}
                className={`p-3 rounded-2xl text-right border transition-all ${
                  settings.payloadMode === 'ultra_compact'
                    ? 'bg-blue-50 dark:bg-blue-950 border-blue-500 text-blue-700 dark:text-blue-300 font-black shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-bold">فائق السرعة (المفضل)</div>
                <div className="text-[10px] opacity-75 mt-0.5">أصغر كثافة، أضخم مربعات، مسح فوري</div>
              </button>

              <button
                type="button"
                onClick={() => handleChange('payloadMode', 'compact')}
                className={`p-3 rounded-2xl text-right border transition-all ${
                  settings.payloadMode === 'compact'
                    ? 'bg-blue-50 dark:bg-blue-950 border-blue-500 text-blue-700 dark:text-blue-300 font-black shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-bold">مختصر متوازن</div>
                <div className="text-[10px] opacity-75 mt-0.5">يتضمن الهيكل ورقم المستند والجهة</div>
              </button>

              <button
                type="button"
                onClick={() => handleChange('payloadMode', 'full')}
                className={`p-3 rounded-2xl text-right border transition-all ${
                  settings.payloadMode === 'full'
                    ? 'bg-blue-50 dark:bg-blue-950 border-blue-500 text-blue-700 dark:text-blue-300 font-black shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-bold">كامل البيانات</div>
                <div className="text-[10px] opacity-75 mt-0.5">يتضمن جميع الحقول والتفاصيل</div>
              </button>
            </div>
          </div>

          {/* 2. Error Correction Level (ISO Standard) */}
          <div className="space-y-3">
            <label className="text-sm font-black flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <ShieldCheck size={18} className="text-emerald-500" />
              مستوى تصحيح الأخطاء (Error Correction Level)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['L', 'M', 'Q', 'H'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => handleChange('errorCorrectionLevel', lvl)}
                  className={`py-2.5 px-3 rounded-xl text-center text-xs font-black border transition-all ${
                    settings.errorCorrectionLevel === lvl
                      ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Level {lvl}
                  <span className="block text-[9px] font-normal text-slate-400 mt-0.5">
                    {lvl === 'L' ? '7% تعافي' : lvl === 'M' ? '15% تعافي' : lvl === 'Q' ? '25% (افتراضي)' : '30% تعافي'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Quiet Zone & Output Resolution */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                منطقة الأمان (Quiet Zone)
              </label>
              <select
                value={settings.quietZone}
                onChange={(e) => handleChange('quietZone', Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold"
              >
                <option value={4}>4 Modules (قياسي معتمد ISO)</option>
                <option value={5}>5 Modules (أمان إضافي)</option>
                <option value={6}>6 Modules (طباعة حرارية عريضة)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                دقة الصورة والتصدير (PNG Resolution)
              </label>
              <select
                value={settings.resolution}
                onChange={(e) => handleChange('resolution', Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold"
              >
                <option value={512}>512 × 512px (قياسي)</option>
                <option value={1024}>1024 × 1024px (عالي الدقة Ultra-HD)</option>
                <option value={2048}>2048 × 2048px (طباعة متقدمة 300 DPI)</option>
              </select>
            </div>
          </div>

          {/* 4. Action Buttons */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 flex items-center gap-1.5"
            >
              <RefreshCcw size={14} />
              استعادة الافتراضي
            </button>

            <div className="flex items-center gap-3">
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold"
                >
                  إغلاق
                </button>
              )}

              <button
                type="button"
                onClick={handleSave}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md shadow-blue-500/20 transition-all flex items-center gap-2"
              >
                <CheckCircle2 size={16} />
                حفظ وحفظ الإعدادات
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
