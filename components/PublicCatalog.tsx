
import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Car, 
  Sparkles, 
  Lock, 
  X, 
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Tag,
  Palette,
  Calendar,
  Hash,
  ChevronRight,
  MousePointer2,
  Check,
  Link as LinkIcon,
  Link2Off,
  Users,
  Briefcase,
  ShieldAlert,
  User as UserIcon
} from 'lucide-react';
import { Car as CarType, CarStatus, OrganizationSettings, User, RentalStatus } from '../types';
import { isCarMatchingQuery, getUnifiedSearchResults } from '../src/utils/searchEngine';
import { verifyPassword } from '../services/SecurityService';
import { sortCarsUnderBrand } from './Reports';
import { getLogoDataUri } from './OfficialAssets';

interface PublicCatalogProps {
  cars: CarType[];
  settings: OrganizationSettings;
  users: User[];
  onLogin: (user: User, rememberMe: boolean) => void;
}

const PublicCatalog: React.FC<PublicCatalogProps> = ({ cars, settings, users, onLogin }) => {
  const [query, setQuery] = useState('');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  const filteredCars = useMemo(() => {
    if (query.trim().length > 0) {
      return getUnifiedSearchResults(cars, query);
    } else {
      return [...cars].sort(sortCarsUnderBrand);
    }
  }, [cars, query]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginData.username.trim(),
          password: loginData.password.trim()
        })
      });
      const data = await response.json();
      if (data.success && data.user) {
        onLogin(data.user, rememberMe);
      } else {
        setError(data.message || 'يرجى التحقق من اسم المستخدم أو كلمة المرور.');
      }
    } catch (err) {
      setError('تعذر الاتصال بخادم المصادقة لتثبيت تسجيل الدخول.');
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto px-6 md:px-12 py-8 space-y-20 animate-in fade-in duration-1000">
      <nav className="flex items-center justify-between py-8">
        <div className="flex items-center gap-5">
          <div className="bg-slate-900 w-16 h-16 rounded-[1.8rem] text-white shadow-2xl shadow-slate-200 flex items-center justify-center overflow-hidden p-1.5">
            <img src={settings.logoUrl || getLogoDataUri(settings.name)} alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter block leading-none">{settings.name}</h1>
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1 inline-block">Premium Auto Inventory</span>
          </div>
        </div>
        <button 
          onClick={() => setIsLoginModalOpen(true)}
          className="flex items-center gap-3 px-10 py-5 bg-white border border-slate-200 text-slate-900 rounded-[2rem] hover:bg-slate-900 hover:text-white transition-all font-black shadow-sm group"
        >
          <Users size={18} className="group-hover:-rotate-12 transition-transform" />
          بوابة الموظفين والمناديب
        </button>
      </nav>

      <div className="relative overflow-hidden bg-slate-950 rounded-[5rem] p-16 md:p-32 text-white shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)]">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-blue-600/20 blur-[150px] rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-indigo-600/10 blur-[120px] rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10 max-w-5xl space-y-12">
          <div className="inline-flex items-center gap-4 bg-white/10 backdrop-blur-3xl px-8 py-4 rounded-full border border-white/20 text-xs font-black uppercase tracking-widest">
            <Sparkles size={18} className="text-yellow-400" />
            <span>نظام الجرد المباشر المعتمد</span>
          </div>
          <h2 className="text-7xl md:text-9xl font-black leading-[0.9] tracking-tighter">
            مخزون <br />
            بلا <span className="text-blue-500 italic">حدود.</span>
          </h2>
          <p className="text-slate-400 text-xl md:text-3xl font-bold max-w-3xl leading-relaxed">
            {settings.description}
          </p>
          
          <div className="max-w-4xl relative group">
            <div className="absolute inset-y-0 right-0 pr-10 flex items-center pointer-events-none">
              <Search className="h-10 w-10 text-slate-600 group-focus-within:text-blue-500 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="ابحث بالماركة، الموديل، أو رقم الشاسيه..."
              className="block w-full pr-24 pl-12 py-10 bg-white text-slate-900 border-none rounded-[3rem] focus:ring-[15px] focus:ring-blue-500/30 outline-none transition-all text-3xl font-black shadow-2xl"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-10">
        <PublicMetricCard label="المتوفر بالمخزن" count={cars.filter(c => c.status === CarStatus.AVAILABLE).length} color="bg-emerald-500" />
        <PublicMetricCard label="حجوزات نشطة" count={cars.filter(c => c.status === CarStatus.RESERVED).length} color="bg-amber-500" />
        <PublicMetricCard label="سيارات تم تجيرها" count={cars.filter(c => c.rentalStatus === RentalStatus.RENTED).length} color="bg-purple-600" />
        <PublicMetricCard label="إجمالي الوحدات" count={cars.length} color="bg-slate-900" />
      </div>

      <div className="space-y-16">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-100 pb-12">
          <div className="space-y-2">
             <h2 className="text-5xl font-black text-slate-900 tracking-tighter">المعروض حالياً</h2>
             <p className="text-slate-400 font-bold">تحديث فوري لكل البيانات التقنية والأسعار عرض حالة المخزون وحالة التجير</p>
          </div>
          <div className="flex items-center gap-4 bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100">
             <div className="w-3 h-3 rounded-full bg-blue-600 animate-pulse" />
             <span className="text-sm font-black text-slate-600 tracking-wide">وجدنا {filteredCars.length} نتيجة مطابقة</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-12 pb-40">
          {filteredCars.map((car) => (
            <CarPremiumCard key={car.id} car={car} settings={settings} users={users} />
          ))}
          {filteredCars.length === 0 && (
            <div className="col-span-full text-center py-40 space-y-6">
               <div className="bg-slate-50 p-10 rounded-full inline-block">
                  <Search size={64} className="text-slate-200" />
               </div>
               <p className="text-2xl font-black text-slate-300">لا توجد نتائج تطابق بحثك حالياً</p>
            </div>
          )}
        </div>
      </div>

      {isLoginModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/90 backdrop-blur-2xl p-6">
          <div className="bg-white w-full max-w-xl rounded-[4rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-12 space-y-10">
              <div className="flex justify-between items-start">
                <div className="space-y-3">
                  <h3 className="text-3xl font-black text-slate-900 tracking-tighter">دخول الموظفين والمناديب</h3>
                  <p className="text-lg font-bold text-slate-400">يرجى تسجيل الدخول للوصول لصلاحياتك</p>
                </div>
                <button onClick={() => setIsLoginModalOpen(false)} className="p-4 bg-slate-50 text-slate-400 hover:text-red-500 rounded-[1.5rem] transition-colors">
                  <X size={28} />
                </button>
              </div>

              {/* أيقونات الصلاحيات للتوضيح */}
              <div className="grid grid-cols-3 gap-4 pb-4">
                 <div className="flex flex-col items-center gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <ShieldAlert size={24} className="text-red-500" />
                    <span className="text-[10px] font-black">مدير</span>
                 </div>
                 <div className="flex flex-col items-center gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <Users size={24} className="text-blue-500" />
                    <span className="text-[10px] font-black">موظف</span>
                 </div>
                 <div className="flex flex-col items-center gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <Briefcase size={24} className="text-amber-500" />
                    <span className="text-[10px] font-black">مندوب</span>
                 </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-8">
                {error && (
                  <div className="p-6 bg-red-50 text-red-600 text-sm font-black rounded-[2rem] border border-red-100 flex items-center gap-4 animate-in">
                    <AlertCircle size={24} />
                    {error}
                  </div>
                )}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-4">اسم المستخدم</label>
                  <input 
                    type="text" required placeholder="أدخل اسمك أو كود المندوب"
                    className="w-full px-10 py-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] outline-none focus:ring-[10px] focus:ring-blue-100 focus:border-blue-500 transition-all font-black text-xl"
                    value={loginData.username}
                    onChange={e => setLoginData({...loginData, username: e.target.value})}
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-4">كلمة المرور</label>
                  <input 
                    type="password" required placeholder="••••••••"
                    className="w-full px-10 py-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] outline-none focus:ring-[10px] focus:ring-blue-100 focus:border-blue-500 transition-all font-black text-xl"
                    value={loginData.password}
                    onChange={e => setLoginData({...loginData, password: e.target.value})}
                  />
                </div>
                
                <div className="flex items-center gap-4 px-4">
                   <button 
                    type="button"
                    onClick={() => setRememberMe(!rememberMe)}
                    className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all ${rememberMe ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200'}`}
                   >
                     {rememberMe && <Check size={18} strokeWidth={4} />}
                   </button>
                   <span className="text-sm font-black text-slate-500">حفظ جلسة الدخول على هذا الجهاز</span>
                </div>

                <button type="submit" className="w-full py-7 bg-blue-600 text-white font-black rounded-[2.5rem] shadow-2xl shadow-blue-200 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all text-2xl flex items-center justify-center gap-5 group">
                  دخول النظام
                  <ArrowRight size={28} className="group-hover:translate-x-[-8px] transition-transform" />
                </button>
              </form>
            </div>
            <div className="p-10 bg-slate-50 border-t flex items-center justify-center gap-6 text-xs font-black text-slate-400">
               <div className="flex items-center gap-2"><ShieldCheck size={18} className="text-blue-500" /> حماية SSL نشطة</div>
               <div className="w-1 h-1 bg-slate-300 rounded-full" />
               <div className="flex items-center gap-2">نظام صلاحيات متطور</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PublicMetricCard: React.FC<{ label: string; count: number; color: string }> = ({ label, count, color }) => (
  <div className="bg-white p-12 rounded-[3.5rem] border border-slate-100 flex items-center gap-10 hover:shadow-2xl transition-all group overflow-hidden relative">
    <div className={`absolute top-0 right-0 w-2 h-full ${color}`} />
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</p>
      <p className="text-5xl font-black text-slate-900 tracking-tighter">{count}</p>
    </div>
    <div className={`p-4 rounded-3xl ${color} bg-opacity-10 text-slate-800 ml-auto group-hover:scale-110 transition-transform`}>
       <Car size={32} />
    </div>
  </div>
);

const CarPremiumCard: React.FC<{ car: CarType; settings: OrganizationSettings; users: User[] }> = ({ car, settings, users }) => {
  const isRented = car.rentalStatus === RentalStatus.RENTED;
  const reserver = users.find(u => u.id === car.reservedByUserId);
  
  const statusStyles: Record<string, string> = {
    [CarStatus.AVAILABLE]: 'bg-emerald-500 text-white shadow-emerald-200',
    [CarStatus.RESERVED]: 'bg-amber-500 text-white shadow-amber-200',
    [CarStatus.SOLD]: 'bg-red-500 text-white shadow-red-200',
    [CarStatus.NOT_ARRIVED]: 'bg-indigo-500 text-white shadow-indigo-200',
    [CarStatus.RETURNED]: 'bg-orange-500 text-white shadow-orange-200',
    [CarStatus.NOT_FOR_SALE]: 'bg-rose-500 text-white shadow-rose-200',
    [RentalStatus.RENTED]: 'bg-purple-600 text-white shadow-purple-200',
    [RentalStatus.NOT_RENTED]: 'bg-slate-400 text-white shadow-slate-100',
  };

  return (
    <div className="bg-white rounded-[4rem] shadow-sm border border-slate-100 overflow-hidden hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] hover:-translate-y-6 transition-all duration-700 group relative">
      <div className="p-12 space-y-10">
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex justify-between items-start">
            <span className={`px-5 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-xl transition-all ${statusStyles[car.status]}`}>
              {car.status}
            </span>
            
            <span className={`px-5 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-xl transition-all ${statusStyles[car.rentalStatus]}`}>
              {car.rentalStatus}
            </span>
          </div>

          {car.status === CarStatus.RESERVED && reserver && (
            <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-2 rounded-xl border border-amber-100 animate-in fade-in slide-in-from-top-1 duration-500">
               <UserIcon size={14} className="animate-pulse" />
               <span className="text-[10px] font-black">بواسطة: {reserver.username}</span>
            </div>
          )}
        </div>
        
        <div className="text-center space-y-2 mb-6">
          <h3 className="text-4xl font-black text-slate-900 group-hover:text-blue-600 transition-colors tracking-tighter">
            {car.brand}
          </h3>
          <span className="text-xl font-bold text-slate-400">{car.model}</span>
        </div>
        
        <div className="space-y-4">
           <div className="flex items-center gap-4 text-slate-500">
              <Palette size={18} className="text-blue-500" />
              <span className="text-sm font-black">اللون والموديل: {car.color} | {car.year}</span>
           </div>
           <div className="flex items-center gap-4 text-slate-500">
              <Hash size={18} className="text-blue-500" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider">VIN: {car.vin}</span>
           </div>
        </div>

        <div className="pt-10 border-t border-slate-100 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">السعر النهائي</span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-blue-700 tracking-tighter">{(car.price ?? 0).toLocaleString()}</span>
              <span className="text-sm font-black text-blue-400 uppercase">{settings.currency}</span>
            </div>
          </div>
          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-[2.2rem] flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner group-hover:rotate-[360deg] duration-1000">
            <Tag size={32} />
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 to-indigo-600 scale-x-0 group-hover:scale-x-100 transition-transform origin-right duration-500" />
    </div>
  );
};

export default PublicCatalog;
