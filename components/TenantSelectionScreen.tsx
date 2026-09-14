import React, { useState, useRef } from 'react';
import { 
  Building2, Plus, Trash2, Edit3, Phone, Mail, 
  MapPin, FileText, Upload, Shield, CheckCircle, X, LogIn
} from 'lucide-react';
import { OrganizationTenant } from '../types';

interface TenantSelectionScreenProps {
  tenants: OrganizationTenant[];
  onSelectTenant: (id: string) => void;
  onAddTenant: (tenant: Omit<OrganizationTenant, 'id' | 'createdAt'>) => void;
  onEditTenant: (id: string, updated: Partial<OrganizationTenant>) => void;
  onDeleteTenant: (id: string) => void;
  isRtl: boolean;
}

export const TenantSelectionScreen: React.FC<TenantSelectionScreenProps> = ({
  tenants,
  onSelectTenant,
  onAddTenant,
  onEditTenant,
  onDeleteTenant,
  isRtl
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null);
  
  // Form States
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [commercialRegistry, setCommercialRegistry] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setName('');
    setLogoUrl('');
    setCommercialRegistry('');
    setTaxNumber('');
    setPhone('');
    setEmail('');
    setAddress('');
    setNotes('');
    setEditingTenantId(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (tenant: OrganizationTenant, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTenantId(tenant.id);
    setName(tenant.name);
    setLogoUrl(tenant.logoUrl || '');
    setCommercialRegistry(tenant.commercialRegistry || '');
    setTaxNumber(tenant.taxNumber || '');
    setPhone(tenant.phone || '');
    setEmail(tenant.email || '');
    setAddress(tenant.address || '');
    setNotes(tenant.notes || '');
    setIsModalOpen(true);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const data = {
      name,
      logoUrl,
      commercialRegistry,
      taxNumber,
      phone,
      email,
      address,
      notes
    };

    if (editingTenantId) {
      onEditTenant(editingTenantId, data);
    } else {
      onAddTenant(data);
    }
    setIsModalOpen(false);
    resetForm();
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm(
      isRtl 
        ? "هل أنت متأكد من حذف هذه المؤسسة نهائياً؟ سيتم مسح كافة ملفاتها وبياناتها المخزنة على هذا الخط!" 
        : "Are you sure you want to permanently delete this organization? All its database and files will be erased!"
    );
    if (confirmed) {
      onDeleteTenant(id);
    }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 md:p-12 font-sans relative overflow-y-auto" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Background decorations */}
      <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-blue-900/25 to-transparent pointer-events-none" />
      <div className="absolute top-20 right-20 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 left-20 w-96 h-96 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />

      <div className="w-full max-w-5xl z-10 flex flex-col gap-8 my-auto">
        {/* Title and header */}
        <div className="text-center space-y-3">
          <div className="inline-flex p-4 rounded-[2rem] bg-indigo-500/10 border border-indigo-500/20 shadow-inner mb-2 animate-pulse">
            <Building2 className="text-indigo-400" size={48} />
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white drop-shadow-sm">
            {isRtl ? 'بوابة إدارة المستودع متعدد المؤسسات' : 'Multi-Enterprise Storage Portal'}
          </h1>
          <p className="text-sm md:text-base text-slate-400 font-bold max-w-2xl mx-auto">
            {isRtl 
              ? 'نظام معزول بالكامل ومؤمن لحماية وإدارة حركة الأسطول والمركبات لكل مؤسسة بشكل مستقل' 
              : 'A fully isolated, secure enterprise container for independent vehicle inventory & delegation logs'}
          </p>
        </div>

        {/* Action Bar */}
        <div className="flex justify-between items-center bg-slate-800/40 border border-slate-700/50 backdrop-blur-md rounded-3xl p-4 px-6 gap-4">
          <span className="text-sm font-black text-slate-300">
            {isRtl ? `المؤسسات المسجلة (${tenants.length})` : `Registered Institutions (${tenants.length})`}
          </span>
          <button 
            onClick={handleOpenAdd}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs md:text-sm font-black px-5 py-3 rounded-2xl shadow-xl transition-all duration-300 scale-100 hover:scale-105 active:scale-95 shrink-0"
          >
            <Plus size={16} />
            <span>{isRtl ? 'إضافة مؤسسة جديدة' : 'Add New Organization'}</span>
          </button>
        </div>

        {/* Enterprise Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tenants.map((tenant) => (
            <div 
              key={tenant.id}
              onClick={() => onSelectTenant(tenant.id)}
              className="group bg-slate-800/40 hover:bg-slate-850 border border-slate-700/40 hover:border-indigo-500/50 rounded-[2.5rem] p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/5 cursor-pointer relative overflow-hidden"
            >
              {/* Card top details */}
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  {/* Logo block */}
                  {tenant.logoUrl ? (
                    <div className="w-16 h-16 rounded-2xl border border-slate-700 bg-slate-900 flex items-center justify-center overflow-hidden shrink-0 shadow-lg">
                      <img src={tenant.logoUrl} alt={tenant.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-indigo-700 flex items-center justify-center text-white text-xl font-black shadow-lg uppercase shrink-0">
                      {tenant.name.substring(0, 2)}
                    </div>
                  )}

                  {/* Actions (Edit / Delete) */}
                  <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => handleOpenEdit(tenant, e)}
                      title={isRtl ? "تعديل" : "Edit"}
                      className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-sky-400 hover:text-sky-300 transition-all cursor-pointer"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button 
                      onClick={(e) => handleDelete(tenant.id, e)}
                      title={isRtl ? "حذف" : "Delete"}
                      className="p-2.5 rounded-xl bg-slate-800 hover:bg-red-950/40 text-rose-400 hover:text-rose-300 transition-all cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Info Text */}
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-white leading-snug group-hover:text-indigo-400 transition-colors">
                    {tenant.name}
                  </h3>
                  {tenant.taxNumber && (
                    <p className="text-[10px] text-slate-400 font-mono font-bold tracking-wider">
                      VAT: {tenant.taxNumber}
                    </p>
                  )}
                  {tenant.commercialRegistry && (
                    <p className="text-[10px] text-indigo-400 font-mono font-bold">
                      CR: {tenant.commercialRegistry}
                    </p>
                  )}
                </div>

                {/* Quick Info Grid */}
                <div className="pt-2 border-t border-slate-700/30 space-y-2 text-xs text-slate-400 font-bold">
                  {tenant.phone && (
                    <div className="flex items-center gap-2">
                      <Phone size={12} className="text-indigo-400 shrink-0" />
                      <span className="truncate">{tenant.phone}</span>
                    </div>
                  )}
                  {tenant.address && (
                    <div className="flex items-center gap-2">
                      <MapPin size={12} className="text-indigo-400 shrink-0" />
                      <span className="truncate">{tenant.address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Prompt */}
              <div className="mt-6 flex items-center justify-between text-xs text-indigo-400 font-black pt-4 border-t border-slate-700/25">
                <span>{isRtl ? 'دخول للمؤسسة' : 'Enter Enterprise'}</span>
                <LogIn size={14} className="transform translate-x-0 group-hover:translate-x-1 group-hover:-translate-x-1 transition-transform" />
              </div>
            </div>
          ))}
        </div>

        {/* Modal Form */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-lg">
            <div 
              className="bg-slate-900 border border-slate-800 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex justify-between items-center p-6 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-400">
                    <Building2 size={20} />
                  </div>
                  <h3 className="text-xl font-black text-white">
                    {editingTenantId 
                      ? (isRtl ? 'تعديل بيانات المؤسسة' : 'Edit Enterprise Settings') 
                      : (isRtl ? 'إضافة مؤسسة جديدة معزولة' : 'Provision Isolated Enterprise')}
                  </h3>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form Scroll Container */}
              <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[70vh] space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Name field */}
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs text-slate-450 font-black uppercase tracking-wider">{isRtl ? 'اسم المؤسسة المالي / المعرض' : 'Organization Name'} *</label>
                    <input 
                      type="text" 
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={isRtl ? "مثل: مؤسسة الفرسان للسيارات..." : "e.g., Al Forsan Motors..."}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white focus:border-indigo-500 focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Commercial Registry */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-450 font-black uppercase tracking-wider">{isRtl ? 'السجل التجاري (CR)' : 'Commercial Registry (CR)'}</label>
                    <input 
                      type="text" 
                      value={commercialRegistry}
                      onChange={(e) => setCommercialRegistry(e.target.value)}
                      placeholder="1010XXXXXX"
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white focus:border-indigo-500 focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Tax Number */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-450 font-black uppercase tracking-wider">{isRtl ? 'الرقم الضريبي العسكري (VAT)' : 'Tax VAT Number'}</label>
                    <input 
                      type="text" 
                      value={taxNumber}
                      onChange={(e) => setTaxNumber(e.target.value)}
                      placeholder="3000XXXXXXXXXXX"
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white focus:border-indigo-500 focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Phone */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-450 font-black uppercase tracking-wider">{isRtl ? 'رقم الهاتف / الجوال' : 'Contact Phone'}</label>
                    <input 
                      type="text" 
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="05XXXXXXXX"
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-0 transition-colors"
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-450 font-black uppercase tracking-wider">{isRtl ? 'البريد الإلكتروني' : 'Email Address'}</label>
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="enterprise@domain.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white focus:border-indigo-500 focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Address */}
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs text-slate-450 font-black uppercase tracking-wider">{isRtl ? 'العنوان الجغرافي' : 'Physical Address'}</label>
                    <input 
                      type="text" 
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder={isRtl ? "الرياض، منطقة الشفا، طريق المعارض" : "Riyadh, Al-Shifa District"}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white focus:border-indigo-500 focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Logo drag/upload */}
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs text-slate-450 font-black uppercase tracking-wider">{isRtl ? 'شعار المعرض / المؤسسة' : 'Brand Logo'}</label>
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="border border-dashed border-slate-700 bg-slate-950/60 hover:bg-slate-950/90 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
                    >
                      <input 
                        type="file" 
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden" 
                      />
                      {logoUrl ? (
                        <div className="relative">
                          <img src={logoUrl} alt="Preview" className="h-20 max-w-[200px] object-contain rounded-lg border border-slate-800 shadow-xl" referrerPolicy="no-referrer" />
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLogoUrl('');
                            }}
                            className="absolute -top-2 -right-2 p-1 bg-red-600 rounded-full hover:bg-red-500 text-white cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <Upload className="text-indigo-400 group-hover:scale-110 transition-transform" size={28} />
                          <p className="text-xs text-slate-400 font-bold">
                            {isRtl ? 'اضغط لتحميل الشعار بصيغة صورة (PNG, JPG)' : 'Drag & drop or click to upload business stamp (PNG, JPG)'}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs text-slate-450 font-black uppercase tracking-wider">{isRtl ? 'ملاحظات إضافية' : 'Internal Notes / Memo'}</label>
                    <textarea 
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder={isRtl ? "أي معلومات تنظيمية خاصة بهذه المؤسسة..." : "Any additional info..."}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white focus:border-indigo-500 focus:outline-none transition-colors resize-none"
                    />
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-black text-xs transition-colors cursor-pointer"
                  >
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button 
                    type="submit"
                    className="px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-xs hover:from-blue-500 hover:to-indigo-500 shadow-lg transition-all cursor-pointer"
                  >
                    {editingTenantId ? (isRtl ? 'حفظ التعديلات' : 'Save Changes') : (isRtl ? 'إنشاء المؤسسة وتأمينها' : 'Provision Enterprise')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
