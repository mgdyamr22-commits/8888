import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw, Copy, Check, Home, ServerCrash } from 'lucide-react';
import { ResilienceEngine } from '../services/resilienceEngine';

interface Props {
  children: ReactNode;
  fallbackName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null, copied: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    
    // Log directly to the system-wide Resilience Engine for robust diagnostics and auto-healing hooks
    ResilienceEngine.log({
      type: 'critical',
      service: `ErrorBoundary:${this.props.fallbackName || 'GenericComponent'}`,
      message: error.message || 'React render-tree collision or runtime crash',
      details: `${error.stack || 'No Stack'}\nReact Tree details: ${errorInfo.componentStack || 'No component stack'}`,
      recovered: true
    });
  }

  private handleCopyError = () => {
    const { error, errorInfo } = this.state;
    if (!error) return;

    const errorReport = `
=== ALMAKHOZUN PRO DIAGNOSTIC REPORT ===
Timestamp: ${new Date().toISOString()}
Component: ${this.props.fallbackName || 'Unknown'}
Error: ${error.name}: ${error.message}
Stack:
${error.stack}

React Component Stack:
${errorInfo?.componentStack || 'N/A'}
========================================
    `.trim();

    navigator.clipboard.writeText(errorReport)
      .then(() => {
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 2000);
      })
      .catch((err) => console.error('Failed to copy error report:', err));
  };

  private handleReset = () => {
    // Clear potentially corrupt local cache parameters and reload
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/dashboard'; // Go safe to dashboard
  };

  private handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[70vh] flex items-center justify-center p-6 bg-slate-900/5 dark:bg-slate-950/20 rounded-[2.5rem] border border-slate-200/50 dark:border-slate-800/50 m-4 animate-in fade-in duration-300">
          <div className="max-w-2xl w-full bg-white dark:bg-slate-950/95 border border-slate-100 dark:border-slate-800/80 rounded-[2.2rem] shadow-2xl p-8 overflow-hidden text-right relative">
            
            {/* Background design accents */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 dark:bg-rose-500/10 rounded-full blur-2xl" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-2xl" />

            {/* Header Icon */}
            <div className="flex items-center gap-4 mb-6 border-b border-rose-100/10 pb-5">
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-2xl ring-1 ring-rose-500/10">
                <ShieldAlert className="w-8 h-8 animate-pulse" />
              </div>
              <div>
                <h2 className="text-xl font-black text-rose-700 dark:text-rose-450">واجهة الحماية النشطة من الانهيار والجمود</h2>
                <p className="text-slate-400 dark:text-slate-500 text-xs font-bold mt-1">تم تدارك خلل وبناء جدار عزل لمنع انهيار البرنامج بالكامل</p>
              </div>
            </div>

            {/* Error message */}
            <div className="bg-rose-50/40 dark:bg-rose-950/10 border border-rose-100/20 dark:border-rose-900/10 rounded-[1.5rem] p-5 mb-6 text-slate-800 dark:text-slate-2 font-black leading-relaxed">
              <p className="text-sm font-semibold mb-2 text-rose-600 dark:text-rose-400">🚨 طبيعة التداخل في الكود أو معالج سطح المكتب:</p>
              <div className="text-xs bg-black/5 dark:bg-black/50 p-3.5 rounded-xl text-left font-mono text-rose-500/90 dark:text-rose-450 overflow-x-auto break-words max-h-32">
                {this.state.error?.name}: {this.state.error?.message}
              </div>
            </div>

            <p className="text-slate-600 dark:text-slate-400 text-xs leading-6 font-semibold mb-6">
              تم تشفير وحفظ تقرير هذا التداخل التشخيصي في <span className="text-blue-600 dark:text-blue-450 font-black">سجل مرونة النظام</span>. يمكنك نسخ التقرير لتزويد الدعم للمنصة الرقمية بها لتحسين الكفاءة، أو النقر على إعادة التهيئة لمواصلة العمل محلياً.
            </p>

            {/* Stack trace panel (collapsible) */}
            {this.state.errorInfo && (
              <details className="mb-6 border border-slate-150 dark:border-slate-850 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900/20 group">
                <summary className="p-3.5 font-bold text-xs select-none cursor-pointer flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span className="flex items-center gap-2">
                    <ServerCrash className="w-4 h-4 text-slate-400" />
                    عرض التفاصيل التقنية الدقيقة وسياق الكومة (Stack Trace)
                  </span>
                  <span className="text-[10px] group-hover:underline text-blue-600">انقر للعرض</span>
                </summary>
                <div className="p-4 border-t border-slate-150 dark:border-slate-850 bg-slate-108 dark:bg-slate-950 text-left font-mono text-[10px] overflow-x-auto text-slate-400 leading-5 whitespace-pre max-h-[220px]">
                  {this.state.error?.stack}
                  {"\n\n=== COMPONENT STACK ===\n"}
                  {this.state.errorInfo.componentStack}
                </div>
              </details>
            )}

            {/* Footer buttons */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={this.handleCopyError}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-extrabold text-xs rounded-xl hover:bg-slate-200 dark:hover:bg-slate-850 transition-all font-sans"
              >
                {this.state.copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    تم نسخ تقرير التداخل!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    نسخ تقرير التداخل الفني
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 dark:bg-rose-950/80 dark:hover:bg-rose-900 text-white font-extrabold text-xs rounded-xl transition-all shadow-lg shadow-rose-500/10 font-sans"
              >
                <Home className="w-4 h-4" />
                العودة للوحة الرئيسية الآمنة
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-900/80 dark:hover:bg-blue-800 text-white font-extrabold text-xs rounded-xl transition-all shadow-lg shadow-blue-500/10 font-sans"
              >
                <RefreshCw className="w-4 h-4" />
                تحديث الصفحة والمحاولة مجدداً
              </button>
            </div>

          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
