import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, X, Send, Bot, FileText, BarChart3, HelpCircle, Copy, Check, Search, GripVertical } from 'lucide-react';
import { Car, OrganizationSettings } from '../types';

interface FloatingPromptBotProps {
  cars: Car[];
  settings: OrganizationSettings;
}

export const FloatingPromptBot: React.FC<FloatingPromptBotProps> = ({ cars = [], settings }) => {
  // Draggable floating button coordinate state (defaults to bottom-left)
  const [position, setPosition] = useState({ x: 24, y: 24 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // UI States
  const [isOpen, setIsOpen] = useState(false);
  const [promptQuery, setPromptQuery] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; text: string; data?: any }>>([
    {
      role: 'assistant',
      text: `أهلاً بك في **مساعد الحث الذكي للمخزون**! 👋\n\nأنا هنا لمساعدتك في صياغة الخطابات، تحليل المخزون، وتوليد تقارير سريعة باستخدام الحث الذكي.\n\nيمكنك اختيـار أحد الأوامر الجاهزة بالأسفل أو كتابة استفسارك مباشرة!`
    }
  ]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Smooth Dragging handlers (Desktop)
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.btn-interactive')) return;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: window.innerHeight - e.clientY - position.y,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      let newX = e.clientX - dragOffset.x;
      let newY = window.innerHeight - e.clientY - dragOffset.y;

      // Restrict within viewport boundaries
      const pad = 12;
      newX = Math.max(pad, Math.min(window.innerWidth - 68, newX));
      newY = Math.max(pad, Math.min(window.innerHeight - 68, newY));

      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // Touch handlers (Mobile)
  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('.btn-interactive')) return;
    setIsDragging(true);
    const touch = e.touches[0];
    setDragOffset({
      x: touch.clientX - position.x,
      y: window.innerHeight - touch.clientY - position.y,
    });
  };

  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      let newX = touch.clientX - dragOffset.x;
      let newY = window.innerHeight - touch.clientY - dragOffset.y;

      const pad = 12;
      newX = Math.max(pad, Math.min(window.innerWidth - 68, newX));
      newY = Math.max(pad, Math.min(window.innerHeight - 68, newY));

      setPosition({ x: newX, y: newY });
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
    }
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, dragOffset]);

  // Scroll chat window to bottom on update
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isOpen]);

  // Copy helper
  const handleCopyText = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Dynamic Prompt Parser & Executor (Local AI Engine)
  const executePrompt = (queryText: string) => {
    if (!queryText.trim()) return;

    const userMsg = queryText.trim();
    const promptLower = userMsg.toLowerCase();
    
    // Append user message
    const updatedHistory = [
      ...chatHistory,
      { role: 'user' as const, text: userMsg }
    ];
    setChatHistory(updatedHistory);
    setPromptQuery('');

    // Process intelligence context
    setTimeout(() => {
      let responseText = '';
      
      // Calculate real pool stats
      const totalCount = cars.length;
      const presentCount = cars.filter(c => c.isPresentInShowroom !== false).length;
      const outboundCount = cars.filter(c => c.isOutbound === true).length;
      const availableCount = cars.filter(c => c.isOutbound !== true).length;

      // Group by brands
      const brandsMap: Record<string, number> = {};
      cars.forEach(c => {
        if (c.brand) {
          const br = c.brand.trim();
          brandsMap[br] = (brandsMap[br] || 0) + 1;
        }
      });
      const topBrands = Object.entries(brandsMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      if (promptLower.includes('تحليل') || promptLower.includes('تقرير') || promptLower.includes('جرد') || promptLower.includes('المخلوف') || promptLower.includes('المخزن')) {
        responseText = `📊 **تقرير جرد المخزون والتحليلات الفورية:**\n\n` +
          `• **إجمالي المركبات المسجلة:** **${totalCount}** سيارة\n` +
          `• **السيارات المتاحة بالمخزن:** **${availableCount}** سيارة\n` +
          `• **منقولة لقسم المبيعات (مباعة):** **${outboundCount}** سيارة\n` +
          `• **متواجدة داخل المعرض حالياً:** **${presentCount}** سيارة\n\n` +
          `🎨 **أشهر المركبات المتوفرة لديك:**\n` +
          topBrands.map(([br, count]) => `  - **${br}**: ${count} سيارة (${Math.round((count/totalCount)*100)}% من المخزون)`).join('\n') +
          `\n\n*التقرير محدث ومستخرج تلقائياً حسب البيانات المسجلة على النظام.*`;
      } 
      else if (promptLower.includes('إعلان') || promptLower.includes('اعلان') || promptLower.includes('تسويق') || promptLower.includes('ترويج')) {
        const promoCars = cars.filter(c => c.isOutbound !== true).slice(0, 4);
        const carLines = promoCars.map(c => `🚗 **${c.brand} ${c.model} ${c.year}** - اللون: ${c.color || 'مميّز'} | هيكل رقم: ${c.vin ? c.vin.slice(-6) : '—'}`).join('\n');
        
        responseText = `📢 *عرض ترويجي مميز للمخزون - ${settings.name || 'معرض سما الفرسان'}* 📢\n\n` +
          `يسرنا أن نعرض عليكم أفخم السيارات المستوردة المتوفرة لدينا حالياً بالمعرض وبأسعار منافسة:\n\n` +
          `${carLines || 'لا توجد سيارات متاحة حالياً لجدولتها في الإعلان.'}\n\n` +
          `📍 **العنوان:** نجران - المملكة العربية السعودية\n` +
          `📞 **اتصل بنا الآن:** ${settings.contactNumber || 'يرجى تسجيل الهاتف عبر الإعدادات'}\n\n` +
          `*سارع بالحجز والتواصل معنا قبل نفاد الكمية!*`;
      }
      else if (promptLower.includes('تفتيش') || promptLower.includes('خطاب شحن') || promptLower.includes('سطحة') || promptLower.includes('سائق')) {
        responseText = `✍️ **صيغة خطاب الشحن المجمع لنقاط التفتيش الأمني:**\n\n` +
          `**بسم الله الرحمن الرحيم**\n` +
          `التاريخ: **${new Date().toLocaleDateString('ar-EG')}م**\n` +
          `جهة الصدور: **${settings.name || 'معرض سما الفرسان للتجارة'}**\n\n` +
          `**إلى من يهمه الأمر (نقاط التفتيش الأمني على الطرق والتحميل)**\n\n` +
          `نفيدكم نحن **${settings.name || 'معرض سما الفرسان'}** بسجل تجاري رقم (**${settings.commercialRegister || '—'}**) وبموجب هذا الخطاب الرسمي المصاحب، فقد تم التوجيه بتحميل ونقل المركبات الموصوفة في التقرير المرفق طيه تابعة لنا، على متن السطحة الناقلة:\n\n` +
          `• **اسم سائق السطحة:** [يرجى تحديد اسم السائق]\n` +
          `• **رقم الهوية / الإقامة:** [يرجى إدخال رقم الهوية]\n` +
          `• **خط السير والوجهة:** من نجران إلى [الجهة المقصودة]\n\n` +
          `يرجى تسهيل مروره ومطابقة البيانات المرفقة بموجب الأنظمة والتعليمات.\n\n` +
          `*معرض سما الفرسان للتجارة والسيارات* 📜✍️`;
      }
      else if (promptLower.includes('بحث') || promptLower.includes('تويوتا') || promptLower.includes('هيونداي') || promptLower.includes('كامري') || promptLower.includes('لكزس') || promptLower.includes('نيسان') || promptLower.includes('مستورد')) {
        // Look up brand or model match
        const searchMatches = cars.filter(c => 
          c.brand.toLowerCase().includes(promptLower) || 
          c.model.toLowerCase().includes(promptLower) ||
          (c.color && c.color.toLowerCase().includes(promptLower)) ||
          (c.vin && c.vin.toLowerCase().includes(promptLower))
        ).slice(0, 5);

        if (searchMatches.length > 0) {
          responseText = `🔍 **نتائج الحث الذكي لمطابقة البحث المباشر:**\n\n` +
            `لقد عثرت في المخزن على عدد **${searchMatches.length}** سيارات مطابقة لبحثك بالتفاصيل الآتية:\n\n` +
            searchMatches.map((c, i) => `${i+1}. **${c.brand} ${c.model}** (${c.year}) - اللون: **${c.color || '—'}** | حالة السيارة: **${c.status}**`).join('\n') +
            `\n\n*هل تود طبقة خطاب شحن أو إذن خروج لإحداها؟*`;
        } else {
          responseText = `🔍 **لم أجد نتائج مطابقة لمصطلح البحث في قاعدة البيانات الحالية.**\n\nتأكد من إدخال اسم الماركة بصيغة صحيحة (مثال: تويوتا، نيسان، هيونداي، فورد) لتلخيصها لك فوراً.`;
        }
      }
      else {
        // Fallback friendly reply holding inventory statistics
        responseText = `💡 **لقد تلقيت توجيه الحث الخاص بك بنجاح!**\n\nلقد قمت بتحليل طلبك، ولتسهيل الأمر عليك إليك ملخصاً فورياً عما يمكنك طلبه من مساعد الحث الآن:\n\n` +
          `1. اكتب **"تحليل جرد"** لمعرفة نسب العلامات التجارية وتوزع المخزون بالكامل.\n` +
          `2. اكتب **"إعلان ترويجي"** لتوليد برودكاست إعلاني جاهز لسيارات المعرض على واتساب.\n` +
          `3. اكتب **"خطاب نقاط تفتيش"** للحصول على صيغة تفويض شحن وتفويض السطحة.\n` +
          `4. يمكنك تعقب أي علامة تجارية فورياً بكتابة اسمها (مثلاً اكتب **"تويوتا"** أو **"كامري"**).\n\n` +
          `*قاعدة البيانات تحتوي حالياً على ${cars.length} مركبة مسجلة لحث البيانات.*`;
      }

      setChatHistory(prev => [
        ...prev,
        { role: 'assistant', text: responseText }
      ]);
    }, 800);
  };

  return (
    <>
      {/* Floating Sparkle Action Button */}
      <div 
        className="fixed z-[999] transition-shadow select-none cursor-grab active:cursor-grabbing print:hidden flex items-center justify-center"
        style={{
          left: `${position.x}px`,
          bottom: `${position.y}px`
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div className="relative group flex items-center justify-center">
          {/* Pulsing ring */}
          <span className="absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-60 animate-ping"></span>
          
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="btn-interactive w-14 h-14 bg-gradient-to-tr from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white rounded-full flex items-center justify-center shadow-xl border-2 border-white/20 transition-all hover:scale-110 active:scale-95 duration-200"
            title="مساعد الحث الذكي للمخزون"
          >
            {isOpen ? <X size={24} /> : <Sparkles size={24} className="animate-pulse" />}
          </button>

          {/* Draggable tooltip grip */}
          <div className="absolute -top-6 bg-slate-900/90 text-white text-[9px] px-2 py-0.5 rounded-full backdrop-blur-sm shadow border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1">
            <GripVertical size={10} />
            <span>اسحب للتحريك</span>
          </div>
        </div>
      </div>

      {/* Elegant Prompts & AI Overlay Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[998] flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4 animate-in fade-in py-12" dir="rtl">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl flex flex-col h-[80vh] max-h-[640px] overflow-hidden">
            
            {/* Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950 rounded-t-[2.5rem]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 rounded-xl flex items-center justify-center">
                  <Bot size={22} className="animate-bounce" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-850 dark:text-white flex items-center gap-1.5">
                    مساعد الحث الذكي والتقارير
                    <span className="text-[10px] bg-sky-500/10 text-sky-600 dark:text-sky-400 px-2 py-0.5 rounded-full font-black">نشط ⚡</span>
                  </h3>
                  <p className="text-[10.5px] text-slate-400 font-bold">صياغة الحث، توليد تقارير السيارات، صياغة المخطوطات والمنقولات يدوياً</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)} 
                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Chat Contents */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50 dark:bg-slate-950/20 custom-scrollbar flex flex-col">
              {chatHistory.map((item, idx) => (
                <div 
                  key={idx}
                  className={`flex flex-col max-w-[85%] ${item.role === 'user' ? 'self-start align-left mr-auto' : 'self-end ml-auto'}`}
                >
                  <div 
                    className={`p-4 rounded-2xl text-xs leading-relaxed space-y-2 relative border group/msg ${
                      item.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-tl-none border-blue-500 shadow-md' 
                        : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-tr-none border-slate-100 dark:border-slate-800 shadow-md'
                    }`}
                  >
                    {/* Copy Button for Assistant replies and outputs */}
                    {item.role === 'assistant' && (
                      <button
                        onClick={() => handleCopyText(item.text, idx)}
                        className="absolute left-2.5 top-2.5 p-1 text-slate-400 hover:text-sky-500 rounded bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-200"
                        title="نسخ صيغة الحث للذاكرة"
                      >
                        {copiedIndex === idx ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                      </button>
                    )}

                    <div className="whitespace-pre-line font-bold font-sans">
                      {item.text}
                    </div>
                  </div>
                  <span className="text-[9px] text-slate-400 font-bold mt-1 self-start px-1">
                    {item.role === 'user' ? 'أنت (توجيه الحث)' : 'المساعد المساعد'}
                  </span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Action prompts panel triggers */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-wide block mr-1">أوامر الحث والتقارير الجاهزة المسرّعة:</span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => executePrompt('جرد وتحليل المخزون بالكامل')}
                  className="px-3.5 py-2 bg-white hover:bg-slate-55 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-150 dark:border-slate-800 text-slate-705 dark:text-slate-200 rounded-xl text-[10.5px] font-black flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                >
                  <BarChart3 size={12} className="text-sky-500" />
                  <span>تحليل كامل للمخزون الجاري</span>
                </button>
                <button
                  onClick={() => executePrompt('صياغة إعلان ترويجي')}
                  className="px-3.5 py-2 bg-white hover:bg-slate-55 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-150 dark:border-slate-800 text-slate-705 dark:text-slate-200 rounded-xl text-[10.5px] font-black flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                >
                  <Sparkles size={12} className="text-amber-500 animate-pulse" />
                  <span>توليد إعلان واتساب للسيارات</span>
                </button>
                <button
                  onClick={() => executePrompt('خطاب شحن مجمع نقاط التفتيش')}
                  className="px-3.5 py-2 bg-white hover:bg-slate-55 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-150 dark:border-slate-800 text-slate-705 dark:text-slate-200 rounded-xl text-[10.5px] font-black flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                >
                  <FileText size={12} className="text-indigo-505" />
                  <span>صيغة تفويض شحن / سطحة</span>
                </button>
              </div>
            </div>

            {/* Chat input box */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                executePrompt(promptQuery);
              }}
              className="p-4 bg-white dark:bg-slate-900 border-t border-slate-105 dark:border-slate-800 flex gap-2 items-center"
            >
              <input 
                type="text" 
                className="flex-1 p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:border-sky-500 font-bold text-xs dark:text-white"
                value={promptQuery}
                onChange={(e) => setPromptQuery(e.target.value)}
                placeholder="اكتب شيئاً وحث المساعد... (مثال: جرد المعرض، سيارات تويوتا)..."
              />
              <button 
                type="submit"
                className="p-3.5 bg-sky-600 hover:bg-sky-700 text-white rounded-2xl shadow-md transition-colors flex items-center justify-center active:scale-95 cursor-pointer"
              >
                <Send size={18} />
              </button>
            </form>

          </div>
        </div>
      )}
    </>
  );
};
