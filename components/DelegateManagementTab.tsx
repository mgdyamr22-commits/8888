import React, { useState } from 'react';
import { 
  Users, Search, UserPlus, Edit2, Power, Clock, X, Trash2,
  Copy, Check, Lock, Eye, EyeOff, Key, Loader2
} from 'lucide-react';
import { Car as CarType, User, Delegate, formatVehicleDisplay } from '../types';
import { DelegateApiService } from '../src/services/delegateApiService';

interface DelegateManagementTabProps {
  cars: CarType[];
  delegates: Delegate[];
  setDelegates?: React.Dispatch<React.SetStateAction<Delegate[]>>;
  onUpdateCars?: React.Dispatch<React.SetStateAction<CarType[]>>;
  addLog: (action: string, targetId: string, targetType: any, details: string) => void;
  currentUser: User | null;
  isRtl: boolean;
}

export const DelegateManagementTab: React.FC<DelegateManagementTabProps> = ({
  cars,
  delegates = [],
  setDelegates,
  onUpdateCars,
  addLog,
  currentUser,
  isRtl,
}) => {
  // States specifically for management tab
  const [showDelegateModal, setShowDelegateModal] = useState<boolean>(false);
  const [editingDelegate, setEditingDelegate] = useState<Delegate | null>(null);
  const [delegateForm, setDelegateForm] = useState({
    name: '',
    username: '',
    password: '',
    phone: '',
    email: '',
    specialty: 'مبيعات',
    status: 'active' as 'active' | 'inactive',
    target: 10,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [delegateSearchQuery, setDelegateSearchQuery] = useState('');
  const [isSavingDelegate, setIsSavingDelegate] = useState(false);

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let res = '';
    for (let i = 0; i < 8; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setDelegateForm(prev => ({ ...prev, password: res }));
  };

  // States specifically for editing documented sales
  const [showEditSaleModal, setShowEditSaleModal] = useState<boolean>(false);
  const [editingSaleCar, setEditingSaleCar] = useState<CarType | null>(null);
  const [saleForm, setSaleForm] = useState({
    price: 0,
    exitDate: '',
    seller: '',
    notes: '',
  });

  return (
    <div className="space-y-10 animate-in fade-in duration-300">
      {/* Create Delegate & Stats Header Panel */}
      <div className="bg-[#0b1329] dark:bg-[#070c17] border border-slate-800 rounded-[2rem] p-8 shadow-2xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
          {setDelegates && (
            <button
              onClick={() => {
                setEditingDelegate(null);
                const randomPw = Math.random().toString(36).slice(-8);
                setDelegateForm({ name: '', username: '', password: randomPw, phone: '', email: '', specialty: 'مبيعات', status: 'active', target: 10 });
                setShowDelegateModal(true);
              }}
              className="bg-[#2563eb] border-0 text-white rounded-2xl px-6 py-3.5 text-xs font-black hover:bg-blue-700 shadow-xl cursor-pointer transform hover:scale-[1.02] transition-all flex items-center gap-2 self-start md:self-center font-sans"
            >
              <UserPlus size={16} />
              {isRtl ? 'إضافة مندوب جديد' : 'Add New Delegate'}
            </button>
          )}
          <div className="flex items-center gap-4 text-right">
            <div className="text-right">
              <h4 className="text-2xl font-black text-white flex items-center gap-2.5 justify-end">
                {isRtl ? 'إدارة مناديب المبيعات كشخصيات مستقلة' : 'Sales Delegates Profile Administration'}
                <span className="p-2.5 bg-blue-900/40 rounded-full border border-blue-800 flex items-center justify-center">
                  <Users size={20} className="text-blue-400" />
                </span>
              </h4>
              <p className="text-xs text-slate-400 mt-1.5 max-w-[32rem]">
                {isRtl ? 'شاشة متكاملة لتهيئة وتوثيق ملفات المناديب كإحصائيات تتبع مبيعات حرة بدون الارتباط بحسابات الدخول.' : 'View, track & manage standalone delegates names, stats & records outside authorization flow.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards Grid */}
      {(() => {
        const safeDelegates = Array.isArray(delegates) ? delegates : [];
        const totalDelCount = safeDelegates.length;
        const activeDelCount = safeDelegates.filter(d => d && d.isActive !== false).length;
        const inactiveDelCount = safeDelegates.filter(d => d && d.isActive === false).length;

        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-sans">
            {/* Total Registered */}
            <div className="bg-[#0b1329] dark:bg-[#070c17] border-2 border-slate-800/60 rounded-[2rem] p-6 flex items-center justify-between shadow-lg relative min-h-[120px] text-right">
              <div className="p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-2xl flex items-center justify-center shrink-0">
                <Users size={20} className="text-blue-400" />
              </div>
              <div className="flex-1 pr-6 flex flex-col justify-between">
                <span className="text-xs font-bold text-slate-400 block">{isRtl ? 'إجمالي المناديب المسجلين' : 'Total Registered'}</span>
                <h3 className="text-3xl font-black text-white mt-1 font-mono tracking-wider">{totalDelCount}</h3>
              </div>
            </div>

            {/* Active Delegates */}
            <div className="bg-[#0b1329] dark:bg-[#070c17] border-2 border-slate-800/60 rounded-[2rem] p-6 flex items-center justify-between shadow-lg relative min-h-[120px] text-right">
              <div className="p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-2xl flex items-center justify-center shrink-0">
                <span className="text-emerald-500 font-bold text-lg leading-none">✓</span>
              </div>
              <div className="flex-1 pr-6 flex flex-col justify-between">
                <span className="text-xs font-bold text-slate-400 block">{isRtl ? 'المناديب النشطون حالياً' : 'Active Delegates'}</span>
                <h3 className="text-3xl font-black text-emerald-400 mt-1 font-mono tracking-wider">{activeDelCount}</h3>
              </div>
            </div>

            {/* Suspended/Inactive Accounts */}
            <div className="bg-[#0b1329] dark:bg-[#070c17] border-2 border-slate-800/60 rounded-[2rem] p-6 flex items-center justify-between shadow-lg relative min-h-[120px] text-right">
              <div className="p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-2xl flex items-center justify-center shrink-0">
                <span className="text-amber-500 font-bold text-lg leading-none">🛡️</span>
              </div>
              <div className="flex-1 pr-6 flex flex-col justify-between">
                <span className="text-xs font-bold text-slate-400 block">{isRtl ? 'الملفات الموقوفة مؤقتاً' : 'Inactive/Suspended'}</span>
                <h3 className="text-3xl font-black text-amber-500 mt-1 font-mono tracking-wider">{inactiveDelCount}</h3>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Search bar */}
      <div className="bg-[#0b1329] dark:bg-[#070c17] border border-slate-800 rounded-[2rem] p-2 shadow-lg">
        <div className="relative flex items-center">
          <input
            type="text"
            value={delegateSearchQuery}
            onChange={(e) => setDelegateSearchQuery(e.target.value)}
            placeholder={isRtl ? "ابدأ بالبحث عن الاسم، رقم الجوال أو البريد الإلكتروني للمندوب..." : "Search name, phone, email..."}
            className="w-full bg-[#050b18]/90 text-white border-2 border-slate-850 rounded-[1.8rem] py-4 pl-6 pr-12 text-xs font-black focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-right outline-none"
          />
          <Search className="absolute right-5 text-slate-450" size={16} />
        </div>
      </div>

      {/* Grid list of sales delegates */}
      <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-850 rounded-[2.5rem] p-8 shadow-xl space-y-6">
        <div className="border-b border-slate-100 dark:border-slate-850 pb-6 text-right">
          <h4 className="text-lg font-black text-slate-900 dark:text-white">{isRtl ? 'جدول ملفات مناديب المبيعات (أسماء تجميلية)' : 'Sales Delegates Registry'}</h4>
          <p className="text-xs text-slate-500 mt-1">{isRtl ? 'تعديل أسماء المناديب وبياناتهم الخاصة باحتساب المبيعات بدون التأثير على بيانات الدخول والبرمجة المشتركة' : 'Configure delegates list, phone directory and assignment labels seamlessly'}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-right">
          {(delegates || [])
            .filter(delegate => {
              if (!delegate) return false;
              if (!delegateSearchQuery.trim()) return true;
              const q = delegateSearchQuery.toLowerCase().trim();
              return (
                (delegate.username || '').toLowerCase().includes(q) ||
                (delegate.phone || '').toLowerCase().includes(q) ||
                (delegate.email || '').toLowerCase().includes(q) ||
                (delegate.id || '').toLowerCase().includes(q)
              );
            })
            .map(delegate => {
              if (!delegate) return null;
              const dUsername = delegate.username || 'بدون اسم';
              const dId = delegate.id || `del-${Math.random()}`;
              const salesCount = (cars || []).filter(c => c && c.isOutbound && ((c.exitData?.seller === dUsername || c.exitData?.representativeName === dUsername || c.seller === dUsername))).length;
              const isActive = delegate.isActive !== false;
              return (
                <div key={dId} className="bg-slate-50 dark:bg-slate-950/40 rounded-3xl border border-slate-150 dark:border-slate-850 p-6 space-y-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                  <div className={`absolute top-0 right-0 left-0 h-1.5 ${isActive ? 'bg-emerald-500' : 'bg-slate-500/40'}`} />
                  
                  <div className="flex justify-between items-start pt-2">
                    <div>
                      <h5 className="font-black text-lg text-slate-900 dark:text-white">{delegate.name || dUsername}</h5>
                      <span className="text-[11px] font-bold text-blue-500 mt-0.5 block font-mono">@{delegate.username}</span>
                    </div>
                    <span className={`px-2.5 py-1 text-[10px] font-black rounded-lg ${isActive ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                      {isActive ? '● نشط وملتزم' : '○ معطل/غير نشط'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs font-sans">
                    <div className="bg-white dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-850">
                      <span className="text-[10px] font-bold text-slate-400 block mb-0.5">{isRtl ? 'رقم الجوال' : 'Phone'}</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200 font-mono" dir="ltr">{delegate.phone || '—'}</span>
                    </div>
                    <div className="bg-white dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-850">
                      <span className="text-[10px] font-bold text-slate-400 block mb-0.5">{isRtl ? 'المبيعات الموثقة' : 'Recorded Sales'}</span>
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{salesCount} {isRtl ? 'سيارات' : 'Cars'}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-850/60">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingDelegate(delegate);
                          setDelegateForm({
                            name: delegate.name || delegate.username || '',
                            username: delegate.username,
                            password: delegate.password || '',
                            phone: delegate.phone || '',
                            email: delegate.email || '',
                            specialty: delegate.specialty || 'مبيعات',
                            status: delegate.isActive ? 'active' : 'inactive',
                            target: delegate.target || 10,
                          });
                          setShowDelegateModal(true);
                        }}
                        className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-xl transition-all cursor-pointer text-xs font-black flex items-center gap-1.5 border-0 bg-transparent"
                        title={isRtl ? 'تعديل المندوب' : 'Edit Delegate'}
                      >
                        <Edit2 size={13} />
                        <span>{isRtl ? 'تعديل' : 'Edit'}</span>
                      </button>

                      <button
                        onClick={() => {
                          const credText = `بيانات دخول المندوب:\nالاسم: ${delegate.name || delegate.username}\nاسم المستخدم: ${delegate.username}\nكلمة المرور: ${delegate.password || '(كلمة المرور المسجلة سابقاً)'}`;
                          navigator.clipboard.writeText(credText);
                          setCopiedId(delegate.id);
                          setTimeout(() => setCopiedId(null), 3000);
                        }}
                        className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl transition-all cursor-pointer text-xs font-black flex items-center gap-1.5 border-0 bg-transparent"
                        title="نسخ بيانات الدخول"
                      >
                        {copiedId === delegate.id ? <Check size={13} /> : <Copy size={13} />}
                        <span>{copiedId === delegate.id ? 'تم النسخ' : 'بيانات الدخول'}</span>
                      </button>

                      {setDelegates && (
                        <button
                          onClick={() => {
                            setDelegates(prev => prev.map(d => d.id === delegate.id ? { ...d, isActive: !isActive } : d));
                            addLog(
                              isRtl ? 'تنشيط مندوب' : 'Toggle Delegate',
                              delegate.id,
                              'USER',
                              isRtl 
                                ? `تم تعديل حالة نشاط المندوب ${delegate.username} إلى [${!isActive ? 'نشط' : 'معطل'}]`
                                : `Changed active state for delegate ${delegate.username} to ${!isActive}`
                            );
                          }}
                          className={`p-2 rounded-xl transition-all cursor-pointer text-xs font-black flex items-center gap-1.5 border-0 bg-transparent ${
                            isActive 
                              ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30' 
                              : 'text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30'
                          }`}
                        >
                          <Power size={13} />
                          <span>{isActive ? (isRtl ? 'تعطيل' : 'Deactivate') : (isRtl ? 'تفعيل' : 'Activate')}</span>
                        </button>
                      )}

                      {setDelegates && (
                        <button
                          onClick={async () => {
                            if (confirm(isRtl ? `هل أنت متأكد من حذف المندوب ${delegate.username} نهائياً من قاعدة البيانات؟` : `Are you sure you want to permanently delete delegate ${delegate.username} from database?`)) {
                              setDelegates(prev => prev.filter(d => d.id !== delegate.id));
                              try {
                                await DelegateApiService.deleteDelegate(delegate.id);
                              } catch (err) {
                                console.error('Delegate deletion error:', err);
                              }
                              addLog(
                                isRtl ? 'حذف مندوب' : 'Delete Delegate',
                                delegate.id,
                                'DELEGATE',
                                isRtl 
                                  ? `تم حذف ملف المندوب ${delegate.username} نهائياً من قاعدة البيانات`
                                  : `Permanently deleted delegate ${delegate.username} from database`
                              );
                            }
                          }}
                          className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all cursor-pointer text-xs font-black flex items-center gap-1.5 border-0 bg-transparent"
                          title={isRtl ? 'حذف ملف المندوب نهائياً' : 'Delete delegate permanently'}
                        >
                          <Trash2 size={13} />
                          <span>{isRtl ? 'حذف نهائياً' : 'Delete'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

          {(!delegates || delegates.length === 0) && (
            <div className="col-span-full py-12 text-center text-slate-400 dark:text-slate-550 border-2 border-dashed border-slate-150 dark:border-slate-800 rounded-3xl w-full">
              <Users size={40} className="mx-auto text-slate-350 mb-3" />
              <h6 className="font-extrabold text-sm mb-1">{isRtl ? 'لا يوجد مناديب مبيعات مسجلين حالياً' : 'No delegates registered'}</h6>
              <p className="text-xs">{isRtl ? 'اضغط على زر "إضافة مندوب جديد" بالأعلى لتهيئة المناديب وتفعيل أسمائهم.' : 'Click Add New Delegate to activate/initialize profiles'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Documented Sales Modifications Sub-panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-850 rounded-[2.5rem] shadow-xl overflow-hidden animate-in fade-in duration-300">
        <div className="p-8 border-b border-slate-100 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-950/20 font-sans">
          <div className="border-r-4 border-emerald-500 pr-3 text-right">
            <h4 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2 justify-end">
              {isRtl ? 'تعديل وتمديد المبيعات الموثقة (دورة حياة المبيعات)' : 'Sales Lifecycle Modifications'}
              <Clock size={20} className="text-emerald-500" />
            </h4>
            <p className="text-xs text-slate-500 mt-1">{isRtl ? 'تعديل قيمة وقنوات البيع والتواريخ الموثقة مسبقاً وتصحيح تخصيص المندوب المسؤول عن سحب وصرف المركبة' : 'Extend and update documented dates, pricing or salesperson details'}</p>
          </div>
        </div>

        <div className="overflow-x-auto text-right" dir="rtl">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-500/10 text-slate-800 dark:text-slate-350 border-b border-slate-150 dark:border-slate-850 text-xs font-black">
                <th className="p-4 text-center w-[50px]">#</th>
                <th className="p-4">{isRtl ? 'المركبة' : 'Car'}</th>
                <th className="p-4 text-center">{isRtl ? 'الموديل واللون' : 'Model & Color'}</th>
                <th className="p-4 text-center">{isRtl ? 'المندوب المسؤول' : 'Assigned Delegate'}</th>
                <th className="p-4 text-center">{isRtl ? 'تاريخ المبيعات الموثق' : 'Sales Date'}</th>
                <th className="p-4 text-center">{isRtl ? 'السعر الفني الموثق' : 'Recorded Revenue'}</th>
                <th className="p-4 text-center">{isRtl ? 'العميل المستلم' : 'Deliver To'}</th>
                <th className="p-4 text-center w-[160px] print:hidden">{isRtl ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {(cars || [])
                .filter(c => c && c.isOutbound)
                .filter(car => {
                  if (!car) return false;
                  if (!delegateSearchQuery.trim()) return true;
                  const q = delegateSearchQuery.toLowerCase().trim();
                  const delName = car.exitData?.seller || car.exitData?.representativeName || car.seller || '';
                  return (
                    (delName || '').toLowerCase().includes(q) ||
                    (car.brand || '').toLowerCase().includes(q) ||
                    (car.model || '').toLowerCase().includes(q) ||
                    (car.vin || '').toLowerCase().includes(q)
                  );
                })
                .map((car, idx) => {
                  const representative = car.exitData?.seller || car.exitData?.representativeName || car.seller || '—';
                  return (
                    <tr key={car.id} className="hover:bg-slate-500/5 transition-colors border-b border-slate-100 dark:border-slate-800/80 text-xs">
                      <td className="p-4 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="p-4 text-right">
                        <div className="flex flex-col">
                          <span className="font-extrabold text-slate-900 dark:text-white">{formatVehicleDisplay(car)}</span>
                          <span className="text-[10px] text-slate-450 font-mono tracking-wider">VIN: {car.vin}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center font-semibold text-slate-600 dark:text-slate-400">
                        {car.year} • {car.color}
                      </td>
                      <td className="p-4 text-center">
                        <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl font-black">
                          {representative}
                        </span>
                      </td>
                      <td className="p-4 text-center font-mono">
                        {car.exitData?.exitDate || '—'}
                      </td>
                      <td className="p-4 text-center font-black text-amber-600 dark:text-amber-400 font-mono">
                        {(car.price || 0).toLocaleString()} {isRtl ? 'ريال' : 'SAR'}
                      </td>
                      <td className="p-4 text-center font-semibold text-slate-700 dark:text-slate-300">
                        {car.exitData?.receiverName || '—'}
                      </td>
                      <td className="p-4 text-center print:hidden">
                        <button
                          onClick={() => {
                            setEditingSaleCar(car);
                            setSaleForm({
                              price: car.price || 0,
                              exitDate: car.exitData?.exitDate || new Date().toISOString().split('T')[0],
                              seller: representative === '—' ? '' : representative,
                              notes: car.exitData?.notes || '',
                            });
                            setShowEditSaleModal(true);
                          }}
                          className="px-4 py-1.5 bg-slate-150 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-[11px] font-black text-slate-600 dark:text-slate-200 transition-all flex items-center gap-1.5 mx-auto border-0 cursor-pointer"
                        >
                          <Edit2 size={12} />
                          <span>{isRtl ? 'تعديل المبيعات' : 'Edit Sale'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}

              {(!cars || cars.filter(c => c && c.isOutbound).length === 0) && (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-450 font-bold">
                    {isRtl ? 'لا توجد سيارات مباعة أو تم تسجيل صرفها بعد.' : 'No outbound processed sales present yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delegate creation/editing Modal */}
      {showDelegateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[1000] p-4 font-sans animate-in fade-in duration-200 text-right">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl w-full max-w-lg p-8 space-y-6 relative overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-850/80 pb-4">
              <h4 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>👥</span>
                {editingDelegate ? (isRtl ? 'تعديل بيانات المندوب' : 'Edit Representative Name') : (isRtl ? 'إضافة مندوب جديد' : 'Add New Delegate Profile')}
              </h4>
              <button
                onClick={() => setShowDelegateModal(false)}
                className="p-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-450 hover:text-slate-755 rounded-full transition-colors cursor-pointer border-0"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-right">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-500 block">{isRtl ? 'اسم المندوب الثلاثي / الكامل' : 'Delegate Full Name'}</label>
                <input
                  type="text"
                  value={delegateForm.name}
                  onChange={(e) => setDelegateForm({ ...delegateForm, name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950/66 border border-slate-200 dark:border-slate-805 rounded-2xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none text-right outline-none"
                  placeholder={isRtl ? "مثال: صالح بن محمد الودعاني" : "Example: Saleh Al-Wadani"}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-500 block">{isRtl ? 'اسم المستخدم لتسجيل الدخول (إنجليزي أو أرقام)' : 'Login Username'}</label>
                <input
                  type="text"
                  value={delegateForm.username}
                  onChange={(e) => setDelegateForm({ ...delegateForm, username: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  className="w-full bg-slate-50 dark:bg-slate-950/66 border border-slate-200 dark:border-slate-805 rounded-2xl px-4 py-3 text-xs font-bold font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none text-right outline-none"
                  placeholder={isRtl ? "مثال: saleh_delegate" : "e.g. saleh_delegate"}
                  dir="ltr"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black text-slate-500 block">{isRtl ? 'كلمة المرور لتسجيل دخول المندوب' : 'Delegate Password'}</label>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="text-[10px] font-black text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Key size={11} />
                    <span>{isRtl ? 'توليد كلمة سر عشوائية' : 'Generate Random Password'}</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={delegateForm.password}
                    onChange={(e) => setDelegateForm({ ...delegateForm, password: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950/66 border border-slate-200 dark:border-slate-805 rounded-2xl px-4 py-3 text-xs font-bold font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none text-right outline-none"
                    placeholder="••••••••"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-500 block">{isRtl ? 'رقم جوال المندوب (أو الاتصال)' : 'Delegate Phone Number'}</label>
                <input
                  type="text"
                  value={delegateForm.phone}
                  onChange={(e) => setDelegateForm({ ...delegateForm, phone: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950/66 border border-slate-200 dark:border-slate-805 rounded-2xl px-4 py-3 text-xs font-bold font-mono text-right focus:ring-2 focus:ring-blue-500 focus:outline-none outline-none"
                  placeholder={isRtl ? "مثال: 0555123456" : "E.g. 0555123456"}
                  dir="ltr"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-500 block">{isRtl ? 'حالة التنشيط والالتزام' : 'Activation & Commitment Status'}</label>
                <select
                  value={delegateForm.status}
                  onChange={(e) => setDelegateForm({ ...delegateForm, status: e.target.value as any })}
                  className="w-full bg-slate-50 dark:bg-slate-950/66 border border-slate-200 dark:border-slate-805 rounded-2xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none outline-none"
                >
                  <option value="active">{isRtl ? 'مفعّل ونشط بالمعرض' : 'Active and Authorized'}</option>
                  <option value="inactive">{isRtl ? 'معطّل مؤقتاً / مغلق' : 'Suspended / Deactivated'}</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-850">
              <button
                onClick={async () => {
                  const finalUsername = delegateForm.username.trim() || delegateForm.name.trim().toLowerCase().replace(/\s+/g, '_');
                  if (!finalUsername) return;
                  if (!setDelegates) return;

                  setIsSavingDelegate(true);

                  let targetDelegate: Delegate;
                  let updatedDelegates: Delegate[] = [];

                  if (editingDelegate) {
                    targetDelegate = {
                      ...editingDelegate,
                      name: delegateForm.name.trim() || finalUsername,
                      username: finalUsername,
                      password: delegateForm.password.trim() || editingDelegate.password,
                      phone: delegateForm.phone.trim(), 
                      email: delegateForm.email.trim(),
                      isActive: delegateForm.status === 'active',
                      target: delegateForm.target,
                    };
                    updatedDelegates = delegates.map(u => u.id === editingDelegate.id ? targetDelegate : u);
                    setDelegates(updatedDelegates);
                    addLog(
                      isRtl ? 'تعديل مندوب' : 'Edit Delegate',
                      editingDelegate.id,
                      'DELEGATE',
                      isRtl ? `تم تحديث بيانات ملف المندوب ${finalUsername} في قاعدة البيانات` : `Updated delegate profile for ${finalUsername} in database`
                    );
                  } else {
                    targetDelegate = {
                      id: 'delegate_' + Date.now().toString().slice(-6),
                      name: delegateForm.name.trim() || finalUsername,
                      username: finalUsername,
                      password: delegateForm.password.trim(),
                      phone: delegateForm.phone.trim(),
                      email: delegateForm.email.trim(),
                      isActive: delegateForm.status === 'active',
                      target: delegateForm.target,
                    };
                    updatedDelegates = [...delegates, targetDelegate];
                    setDelegates(updatedDelegates);
                    addLog(
                      isRtl ? 'إضافة مندوب' : 'Add Delegate',
                      targetDelegate.id,
                      'DELEGATE',
                      isRtl ? `تم تسجيل وتفعيل المندوب الجديد ${finalUsername} في قاعدة البيانات` : `Registered and activated brand new delegate ${finalUsername} in database`
                    );
                  }

                  // Authoritative persistence into MySQL database
                  try {
                    await DelegateApiService.saveDelegate(targetDelegate);
                    await DelegateApiService.syncDelegates(updatedDelegates);
                  } catch (err: any) {
                    console.error('Delegate sync error:', err);
                  } finally {
                    setIsSavingDelegate(false);
                    setShowDelegateModal(false);
                  }
                }}
                disabled={isSavingDelegate || (!delegateForm.username.trim() && !delegateForm.name.trim())}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-2xl py-3 text-xs font-black transition-all cursor-pointer text-center border-0 flex items-center justify-center gap-2"
              >
                {isSavingDelegate && <Loader2 size={15} className="animate-spin" />}
                <span>{isSavingDelegate ? (isRtl ? 'جاري الحفظ بقاعدة البيانات...' : 'Saving to DB...') : (isRtl ? 'حفظ وإرسال' : 'Save & Active')}</span>
              </button>
              <button
                onClick={() => setShowDelegateModal(false)}
                disabled={isSavingDelegate}
                className="flex-1 bg-slate-150 dark:bg-slate-850 text-slate-700 dark:text-slate-350 rounded-2xl py-3 text-xs font-black hover:bg-slate-200 transition-colors cursor-pointer text-center border-0"
              >
                {isRtl ? 'إلغاء الأمر' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sale editing details Modal */}
      {showEditSaleModal && editingSaleCar && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[1000] p-4 font-sans animate-in fade-in duration-200 text-right">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl w-full max-w-lg p-8 space-y-6 relative overflow-hidden animate-in zoom-in-95 duration-200 text-right">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-850/80 pb-4">
              <h4 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Clock size={20} className="text-emerald-500 animate-pulse" />
                {isRtl ? 'تمديد وتعديل المبيعات الموثقة' : 'Edit Documented Sale'}
              </h4>
              <button
                onClick={() => setShowEditSaleModal(false)}
                className="p-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-450 hover:text-slate-755 rounded-full transition-colors cursor-pointer border-0"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-150 dark:border-slate-850 space-y-1 text-right">
              <span className="text-[10px] font-bold text-slate-450 block">{isRtl ? 'المركبة المحددة' : 'Selected vehicle'}</span>
              <span className="font-extrabold text-slate-900 dark:text-white block text-sm">{editingSaleCar.brand} {editingSaleCar.model}</span>
              <span className="text-xs text-slate-500 font-mono block select-all">VIN: {editingSaleCar.vin}</span>
            </div>

            <div className="space-y-4 text-right">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-500 block">{isRtl ? 'سعر البيع والمخرج الموثق بدقة (ريال)' : 'True selling price (SAR)'}</label>
                <input
                  type="number"
                  value={saleForm.price}
                  onChange={(e) => setSaleForm({ ...saleForm, price: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-full bg-slate-50 dark:bg-slate-950/66 border border-slate-200 dark:border-slate-805 rounded-2xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-right outline-none"
                  placeholder="مثال: 95000"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-500 block font-bold">{isRtl ? 'تاريخ المبيعات والصرف الفعلي (📅 تمديد/تعديل)' : 'Date of discharge / Sale'}</label>
                <input
                  type="date"
                  value={saleForm.exitDate}
                  onChange={(e) => setSaleForm({ ...saleForm, exitDate: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950/66 border border-slate-200 dark:border-slate-805 rounded-2xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-right outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-500 block">{isRtl ? 'المندوب/البائع المسؤول عن هذه المركبة' : 'Assigned delegate / Seller'}</label>
                <select
                  value={saleForm.seller}
                  onChange={(e) => setSaleForm({ ...saleForm, seller: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950/66 border border-slate-200 dark:border-slate-805 rounded-2xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none outline-none text-right"
                >
                  <option value="">{isRtl ? 'غير محدد' : 'Unassigned'}</option>
                  {delegates.map(d => (
                    <option key={d.id} value={d.username}>{d.username}</option>
                  ))}
                  {!delegates.some(d => d.username === saleForm.seller) && saleForm.seller && (
                    <option value={saleForm.seller}>{saleForm.seller}</option>
                  )}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-500 block font-bold">{isRtl ? 'ملاحظات ومقررات الصرف الجديدة' : 'Lifecycle and delivery logs'}</label>
                <textarea
                  rows={2}
                  value={saleForm.notes}
                  onChange={(e) => setSaleForm({ ...saleForm, notes: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950/66 border border-slate-200 dark:border-slate-850 rounded-2xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none outline-none"
                  placeholder={isRtl ? "كتابة مبررات تمديد فترة المبيعات أو تفاصيل إضافية..." : "E.g. extensions details..."}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-850">
              <button
                onClick={() => {
                  if (!onUpdateCars) return;
                  onUpdateCars(prev => prev.map(c => {
                    if (c.id === editingSaleCar.id) {
                      return {
                        ...c,
                        price: saleForm.price,
                        seller: saleForm.seller,
                        exitData: c.exitData ? {
                          ...c.exitData,
                          exitDate: saleForm.exitDate,
                          seller: saleForm.seller,
                          representativeName: saleForm.seller,
                          notes: saleForm.notes,
                        } : {
                          receiverName: '',
                          receiverPhone: '',
                          receiverId: '',
                          deliveryType: 'فوري' as any,
                          exitDate: saleForm.exitDate,
                          seller: saleForm.seller,
                          representativeName: saleForm.seller,
                          notes: saleForm.notes,
                        },
                        history: [
                          ...(c.history || []),
                          {
                            id: 'hist-edit-sale-' + Date.now(),
                            action: isRtl 
                              ? `تعديل القيمة والمسؤول وتاريخ الصرف المالي لـ [${(saleForm.price ?? 0).toLocaleString()} ريال] بواسطة ${currentUser?.username}`
                              : `Updated sale price to [${saleForm.price}] and assignment by ${currentUser?.username}`,
                            timestamp: new Date().toISOString(),
                            user: currentUser?.username || 'System'
                          }
                        ]
                      };
                    }
                    return c;
                  }));
                  addLog(
                    isRtl ? 'تعديل مبيعات' : 'Modify Sale record',
                    editingSaleCar.id,
                    'CAR',
                    isRtl ? `تم تحديث حزمة بيانات البيع الموثقة للمركبة ${editingSaleCar.brand} ${editingSaleCar.model}` : `Updated sales logs for ${editingSaleCar.brand} ${editingSaleCar.model}`
                  );
                  setShowEditSaleModal(false);
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl py-3 text-xs font-black transition-all cursor-pointer text-center border-0"
              >
                {isRtl ? 'اعتماد التغييرات' : 'Apply Changes'}
              </button>
              <button
                onClick={() => setShowEditSaleModal(false)}
                className="flex-1 bg-slate-150 dark:bg-slate-850 text-slate-700 dark:text-slate-350 rounded-2xl py-3 text-xs font-black hover:bg-slate-200 transition-colors cursor-pointer text-center border-0"
              >
                {isRtl ? 'إلغاء الأمر' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
