import React, { useState, useEffect, useRef } from 'react';
import { Copy, Clipboard, Scissors, Trash2, Check, RefreshCw, Layers } from 'lucide-react';
import { useLanguage } from './LanguageContext.tsx';

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  targetElement: HTMLElement | null;
  selectedText: string;
  isInput: boolean;
}

export const MouseContextMenu: React.FC = () => {
  const { lang } = useLanguage();
  const [state, setState] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    targetElement: null,
    selectedText: '',
    isInput: false,
  });

  const [showPasteModal, setShowPasteModal] = useState<boolean>(false);
  const [pasteInputValue, setPasteInputValue] = useState<string>('');
  const [activePasteTarget, setActivePasteTarget] = useState<HTMLElement | null>(null);
  const pasteInputRef = useRef<HTMLTextAreaElement>(null);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showPasteModal && pasteInputRef.current) {
      setTimeout(() => {
        pasteInputRef.current?.focus();
      }, 100);
    }
  }, [showPasteModal]);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.id === 'secure-paste-area' || target.closest('#secure-paste-container'))) {
        return; // Allow native context menu to work for paste area
      }
      e.preventDefault();
      
      const selectedText = window.getSelection()?.toString() || '';
      
      // Determine if the target is an input or textarea
      const isInput = target.tagName === 'INPUT' || 
                      target.tagName === 'TEXTAREA' || 
                      target.isContentEditable;

      // Ensure menu stays within screen bounds
      let x = e.clientX;
      let y = e.clientY;
      const menuWidth = 220;
      const menuHeight = 260; // Approximate menu size

      if (x + menuWidth > window.innerWidth) {
        x = window.innerWidth - menuWidth - 10;
      }
      if (y + menuHeight > window.innerHeight) {
        y = window.innerHeight - menuHeight - 10;
      }

      setState({
        visible: true,
        x,
        y,
        targetElement: target,
        selectedText,
        isInput,
      });
    };

    const handleGlobalClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setState(prev => ({ ...prev, visible: false }));
      }
    };

    const handleScroll = () => {
      setState(prev => ({ ...prev, visible: false }));
    };

    const handleGlobalCopy = () => {
      let text = window.getSelection()?.toString() || '';
      if (!text) {
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
          const input = activeEl as HTMLInputElement;
          const start = input.selectionStart ?? 0;
          const end = input.selectionEnd ?? 0;
          text = input.value.substring(start, end);
        }
      }
      if (text) {
        localStorage.setItem('sys_mouse_clipboard', text);
      }
    };

    const handleGlobalCut = () => {
      let text = window.getSelection()?.toString() || '';
      if (!text) {
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
          const input = activeEl as HTMLInputElement;
          const start = input.selectionStart ?? 0;
          const end = input.selectionEnd ?? 0;
          text = input.value.substring(start, end);
        }
      }
      if (text) {
        localStorage.setItem('sys_mouse_clipboard', text);
      }
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('copy', handleGlobalCopy);
    window.addEventListener('cut', handleGlobalCut);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('copy', handleGlobalCopy);
      window.removeEventListener('cut', handleGlobalCut);
    };
  }, []);

  if (!state.visible && !showPasteModal) return null;

  // Helper to extract copyable text dynamically from target element
  const getElementText = (): string => {
    if (state.selectedText) return state.selectedText;
    if (state.isInput && state.targetElement) {
      return (state.targetElement as HTMLInputElement).value || '';
    }
    if (state.targetElement) {
      const text = (state.targetElement.innerText || state.targetElement.textContent || '');
      // Avoid copying useless long UI container text if they right-click general background
      if (text.length < 500) {
        return text.trim();
      }
    }
    return '';
  };

  const copyableText = getElementText();
  const canCopy = copyableText.length > 0;

  // 1. Copy Action
  const handleCopy = async () => {
    const textToCopy = getElementText();

    if (textToCopy) {
      // Save locally to persist within session/iframe constraints
      localStorage.setItem('sys_mouse_clipboard', textToCopy);
      try {
        await navigator.clipboard.writeText(textToCopy);
      } catch (err) {
        // Fallback using older execCommand
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
    }
    setState(prev => ({ ...prev, visible: false }));
  };

  // 2. Paste Action
  const handlePaste = async () => {
    if (!state.isInput || !state.targetElement) return;
    
    const localText = localStorage.getItem('sys_mouse_clipboard') || '';
    
    try {
      // Try native clipboard first
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          insertTextAtCursor(state.targetElement as HTMLInputElement, text);
          localStorage.setItem('sys_mouse_clipboard', text);
          setState(prev => ({ ...prev, visible: false }));
          return;
        }
      }
    } catch (err) {
      // Permission blocked or sandbox constraint
    }

    // Seamless fallback to our in-app synchronized clipboard
    if (localText) {
      insertTextAtCursor(state.targetElement as HTMLInputElement, localText);
    } else {
      // Force manual input modal only if there's absolutely no text copied yet
      setActivePasteTarget(state.targetElement);
      setPasteInputValue('');
      setShowPasteModal(true);
    }
    setState(prev => ({ ...prev, visible: false }));
  };

  // Helper to safely set input values programmatically and update React core states
  const insertTextAtCursor = (input: HTMLInputElement | HTMLTextAreaElement, text: string) => {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const oldVal = input.value;
    const newVal = oldVal.substring(0, start) + text + oldVal.substring(end);

    // React State double-tracker setter bypass
    const nativeValueSetter = Object.getOwnPropertyDescriptor(
      input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
      'value'
    )?.set;
    
    if (nativeValueSetter) {
      nativeValueSetter.call(input, newVal);
    } else {
      input.value = newVal;
    }

    // Move selection cursor
    input.focus();
    input.setSelectionRange(start + text.length, start + text.length);

    // Notify React tree
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  // 3. Cut Action
  const handleCut = async () => {
    const input = state.targetElement as HTMLInputElement;
    if (!state.isInput || !input) return;

    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    const selectedText = input.value.substring(start, end);

    if (selectedText) {
      localStorage.setItem('sys_mouse_clipboard', selectedText);
      try {
        await navigator.clipboard.writeText(selectedText);
        insertTextAtCursor(input, '');
      } catch (err) {
        // Fallback format
        document.execCommand('cut');
      }
    }
    setState(prev => ({ ...prev, visible: false }));
  };

  // 4. Select All Action
  const handleSelectAll = () => {
    if (state.isInput && state.targetElement) {
      const input = state.targetElement as HTMLInputElement;
      input.focus();
      input.select();
    } else {
      // Select the whole page body content
      const range = document.createRange();
      range.selectNodeContents(document.body);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
    setState(prev => ({ ...prev, visible: false }));
  };

  // 5. Clear Action (Input value wipe)
  const handleClear = () => {
    if (state.isInput && state.targetElement) {
      const input = state.targetElement as HTMLInputElement;
      // Triggers React State update
      const nativeValueSetter = Object.getOwnPropertyDescriptor(
        input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
        'value'
      )?.set;
      
      if (nativeValueSetter) {
        nativeValueSetter.call(input, '');
      } else {
        input.value = '';
      }
      input.focus();
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    setState(prev => ({ ...prev, visible: false }));
  };

  const confirmCustomPaste = () => {
    if (activePasteTarget && pasteInputValue) {
      insertTextAtCursor(activePasteTarget as HTMLInputElement, pasteInputValue);
      localStorage.setItem('sys_mouse_clipboard', pasteInputValue);
    }
    setShowPasteModal(false);
    setPasteInputValue('');
    setActivePasteTarget(null);
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      confirmCustomPaste();
    }
  };

  const isAr = lang === 'ar';

  return (
    <>
      {state.visible && (
        <div
          ref={menuRef}
          style={{ top: state.y, left: state.x }}
          className="fixed z-[10000] w-56 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2 select-none animate-in fade-in zoom-in-95 duration-100 text-right dir-rtl"
        >
          <div className="px-3 py-1.5 text-[10px] uppercase font-black tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 mb-1 flex items-center justify-between">
            <span>{isAr ? 'خيارات الفأرة الذكية' : 'Smart Mouse Controls'}</span>
            <Layers size={10} className="text-blue-500" />
          </div>

          <div className="space-y-0.5">
            {/* Copy (نسخ) */}
            <button
              onClick={handleCopy}
              disabled={!canCopy}
              className="w-full px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 rounded-lg flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all disabled:opacity-40 disabled:hover:bg-transparent group"
            >
              <div className="flex items-center gap-2 flex-grow min-w-0">
                <Copy size={13} className="text-slate-400 group-hover:text-slate-600 flex-shrink-0" />
                <span className="truncate">{isAr ? 'نسخ' : 'Copy'}</span>
              </div>
              {copyableText && (
                <span className="text-[9px] font-mono px-1 rounded bg-slate-100 dark:bg-slate-800 max-w-[100px] truncate block text-slate-500 flex-shrink-0">
                  {copyableText}
                </span>
              )}
            </button>

            {/* Paste (لصق) */}
            <button
              onClick={handlePaste}
              disabled={!state.isInput}
              className="w-full px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 rounded-lg flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <Clipboard size={13} className="text-slate-400" />
              <span>{isAr ? 'لصق بالكامل' : 'Paste'}</span>
            </button>

            {/* Cut (قص) */}
            <button
              onClick={handleCut}
              disabled={!state.isInput || !state.selectedText}
              className="w-full px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-205 rounded-lg flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <Scissors size={13} className="text-slate-400" />
              <span>{isAr ? 'قص' : 'Cut'}</span>
            </button>

            <div className="h-[1px] bg-slate-100 dark:bg-slate-800 my-1" />

            {/* Select All (تحديد الكل) */}
            <button
              onClick={handleSelectAll}
              className="w-full px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-202 rounded-lg flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all"
            >
              <Check size={13} className="text-slate-400" />
              <span>{isAr ? 'تحديد الكل' : 'Select All'}</span>
            </button>

            {/* Clear (مسح الحقل) */}
            {state.isInput && (
              <button
                onClick={handleClear}
                className="w-full px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg flex items-center gap-2 transition-all"
              >
                <Trash2 size={13} className="text-rose-500" />
                <span>{isAr ? 'مسح المدخلات' : 'Clear Line'}</span>
              </button>
            )}
          </div>

          {/* Electron build assistance footer */}
          <div className="mt-1 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[8.5px] font-black text-slate-450 dark:text-slate-500 text-center flex items-center justify-center gap-1">
            <RefreshCw size={9} className="animate-spin text-blue-500" />
            <span>{isAr ? 'تكامل الـ EXE الماوس مُفعّل' : 'EXE Wrapper Mouse Active'}</span>
          </div>
        </div>
      )}

      {showPasteModal && (
        <div id="secure-paste-container" className="fixed inset-0 z-[11000] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl text-right dir-rtl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Clipboard size={18} />
              </div>
              <div>
                <h3 className="font-black text-slate-800 dark:text-white text-sm leading-tight">{isAr ? 'بوابة اللصق الذكي والآمن' : 'Smart Secure Paste'}</h3>
                <p className="text-[9px] text-slate-400 font-bold mt-0.5">{isAr ? 'تجاوز قيود نظام المتصفحات بكفاءة' : 'Secure iframe bypass active'}</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-[11px] text-slate-500 dark:text-slate-450 font-bold leading-relaxed">
                {isAr 
                  ? 'يرجى لصق النص داخل الحقل أدناه (اضغط Ctrl+V أو انقر بزر الماوس الأيمن للّصق بالماوس) ثم اضغط موافقة:' 
                  : 'Please paste your text inside the field below (using Ctrl+V or mouse right-click context menu):'}
              </p>

              <textarea
                id="secure-paste-area"
                ref={pasteInputRef}
                value={pasteInputValue}
                onChange={(e) => setPasteInputValue(e.target.value)}
                onKeyDown={handleTextareaKeyDown}
                placeholder={isAr ? 'انقر هنا للّصق...' : 'Click here and paste...'}
                className="w-full h-24 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 dark:focus:ring-blue-900 text-right resize-none placeholder:text-slate-305 dark:placeholder:text-slate-700"
              />
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={confirmCustomPaste}
                disabled={!pasteInputValue.trim()}
                className="flex-1 py-3 px-4 bg-slate-900 dark:bg-blue-600 hover:bg-slate-950 dark:hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl font-bold text-xs transition-all active:scale-95"
              >
                {isAr ? 'موافق وإدخال النص' : 'Confirm'}
              </button>
              <button
                onClick={() => {
                  setShowPasteModal(false);
                  setPasteInputValue('');
                  setActivePasteTarget(null);
                }}
                className="px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs border border-slate-200 dark:border-slate-700 transition-colors"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
