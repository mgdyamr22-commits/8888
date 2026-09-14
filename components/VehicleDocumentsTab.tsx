import React, { useState, useEffect, useRef } from 'react';
import { 
  Folder, FileText, UploadCloud, Eye, Download, Trash2, 
  Archive, RotateCcw, Edit2, AlertCircle, FileImage, 
  CheckCircle, Plus, FileSpreadsheet, FileCode, Check, Loader2, X, Clipboard
} from 'lucide-react';
import { Car, User, UserRole, Permission, formatVehicleDisplay } from '../types';
import { documentStorageService, VehicleDocument } from '../services/documentStorageService';

interface VehicleDocumentsTabProps {
  car: Car;
  currentUser: User | null;
  settings: any;
}

const CATEGORIES = [
  { id: '1', key: 'registration', label: 'استمارة المركبة', icon: FileImage },
  { id: '2', key: 'plates', label: 'مستندات اللوحات', icon: FileText },
  { id: '3', key: 'exit_permit', label: 'إذن خروج المركبة', icon: FileText },
  { id: '4', key: 'purchase_contract', label: 'عقد الشراء', icon: Clipboard },
  { id: '5', key: 'sales_contract', label: 'عقد البيع والاتفاقيات', icon: Clipboard },
  { id: '6', key: 'customs', label: 'البطاقة الجمركية والمستندات', icon: FileText },
  { id: '7', key: 'insurance', label: 'مستند وثيقة التأمين', icon: CheckCircle },
  { id: '8', key: 'inspection', label: 'تقارير الفحص الفني والتقدير', icon: FileText },
  { id: '9', key: 'ownership_transfer', label: 'مستندات نقل الملكية', icon: FileText },
  { id: '10', key: 'invoice', label: 'الفواتير والبيانات المالية', icon: FileSpreadsheet },
  { id: '11', key: 'delivery', label: 'مستندات وبطاقة التسليم اليومي', icon: FileText },
  { id: '12', key: 'other', label: 'مرفقات ومستندات أخرى', icon: FileCode }
];

export const VehicleDocumentsTab: React.FC<VehicleDocumentsTabProps> = ({ car, currentUser, settings }) => {
  const [documents, setDocuments] = useState<VehicleDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all'); // 'all' or specific key or 'archived'
  
  // Modals / Overlays state
  const [previewDoc, setPreviewDoc] = useState<VehicleDocument | null>(null);
  const [editingDoc, setEditingDoc] = useState<VehicleDocument | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  
  // Drag and drop / uploads
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  
  // Replacement
  const [replacingDocId, setReplacingDocId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // Authenticate capabilities based on Roles/Permissions
  const isAdmin = !currentUser || currentUser?.role === UserRole.ADMIN || String(currentUser?.role).toUpperCase() === 'ADMIN';
  const isEmployee = currentUser?.role === UserRole.EMPLOYEE || String(currentUser?.role).toUpperCase() === 'EMPLOYEE';
  const isDelegate = currentUser?.role === UserRole.DELEGATE || String(currentUser?.role).toUpperCase() === 'DELEGATE';

  // Role Permissions mapping:
  // Admin: View, Upload, Edit, Delete, Admin access
  // Employee: View, Upload, Edit, No delete
  // Delegate: View only
  const canUpload = isAdmin || isEmployee;
  const canEdit = isAdmin || isEmployee;
  const canDelete = isAdmin; // Only admins can hard-delete files from the vehicle registry.

  const loadDocs = async () => {
    setIsLoading(true);
    try {
      // Get all documents for this car (including archived)
      const data = await documentStorageService.getDocumentsForCar(car.id, true);
      setDocuments(data);
    } catch (e) {
      console.error('Failed to load documents', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
  }, [car.id]);

  // Compute document counters per category
  const counters = React.useMemo(() => {
    const counts: Record<string, number> = {};
    counts['all'] = documents.filter(d => !d.isArchived).length;
    counts['archived'] = documents.filter(d => d.isArchived).length;
    
    CATEGORIES.forEach(cat => {
      counts[cat.key] = documents.filter(d => d.category === cat.key && !d.isArchived).length;
    });
    return counts;
  }, [documents]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (!canUpload) {
      setUploadError('عذراً، ليس لديك صلاحية رفع مستندات.');
      return;
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesUpload(e.dataTransfer.files);
    }
  };

  const triggerFileInput = () => {
    if (!canUpload) return;
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesUpload(e.target.files);
    }
  };

  const handleFilesUpload = async (files: FileList) => {
    setIsUploading(true);
    setUploadError('');
    try {
      const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'docx', 'xlsx'];
      const uploadPromises = Array.from(files).map(async (file) => {
        const extension = file.name.split('.').pop()?.toLowerCase() || '';
        if (!allowedExtensions.includes(extension)) {
          throw new Error(`نوع الملف غير مدعوم: ${file.name}`);
        }

        // Limit individual file size to 25MB to keep IndexedDB stable
        if (file.size > 25 * 1024 * 1024) {
          throw new Error(`حجم الملف كبير جداً (الأقصى 25 ميجابايت): ${file.name}`);
        }

        return new Promise<void>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = async (e) => {
            try {
              const fileData = e.target?.result as string;
              
              // If we are uploading from specific category tab, auto-assign it, else default to 'other'
              const assignedCategory = CATEGORIES.some(cat => cat.key === activeCategory) 
                ? activeCategory 
                : 'other';

              await documentStorageService.addDocument({
                carId: car.id,
                vin: car.vin,
                category: assignedCategory,
                fileName: file.name,
                fileType: file.type || 'application/octet-stream',
                fileData: fileData,
                notes: '',
                isArchived: false,
                uploadDate: new Date().toISOString(),
                uploadedBy: currentUser?.username || 'موظف',
                lastModifiedDate: new Date().toISOString()
              });
              resolve();
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = () => reject(new Error('خطأ في قراءة محتوى الملف'));
          reader.readAsDataURL(file);
        });
      });

      await Promise.all(uploadPromises);
      await loadDocs(); // reload documents
    } catch (err: any) {
      setUploadError(err.message || 'حدث خطأ أثناء رفع الملفات');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Replacement Flow
  const triggerReplacementInput = (docId: string) => {
    if (!canEdit) return;
    setReplacingDocId(docId);
    setTimeout(() => {
      replaceInputRef.current?.click();
    }, 50);
  };

  const handleReplacementChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!replacingDocId || !e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    const docToReplace = documents.find(d => d.id === replacingDocId);
    if (!docToReplace) return;

    setIsUploading(true);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'docx', 'xlsx'];
      
      if (!allowedExtensions.includes(extension)) {
        throw new Error('نوع ملف الاستبدال غير مدعوم!');
      }

      if (file.size > 25 * 1024 * 1024) {
        throw new Error('حجم ملف الاستبدال كبير جداً (الأقصى 25 ميجابايت)');
      }

      const reader = new FileReader();
      reader.onload = async (eEvent) => {
        try {
          const fileData = eEvent.target?.result as string;
          const updatedDoc: VehicleDocument = {
            ...docToReplace,
            fileName: file.name,
            fileType: file.type || 'application/octet-stream',
            fileData: fileData,
            lastModifiedDate: new Date().toISOString()
          };
          await documentStorageService.updateDocument(updatedDoc);
          setReplacingDocId(null);
          await loadDocs();
        } catch (err) {
          alert('فشل استبدال المستند');
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء استبدال الملف');
    } finally {
      setIsUploading(false);
      if (replaceInputRef.current) replaceInputRef.current.value = '';
    }
  };

  // Archive Doc
  const handleToggleArchive = async (doc: VehicleDocument) => {
    if (!canEdit) return;
    try {
      const updated: VehicleDocument = {
        ...doc,
        isArchived: !doc.isArchived,
        lastModifiedDate: new Date().toISOString()
      };
      await documentStorageService.updateDocument(updated);
      await loadDocs();
    } catch (e) {
      console.error('Failed to archive document', e);
    }
  };

  // Save Notes
  const handleOpenEditNotes = (doc: VehicleDocument) => {
    if (!canEdit) return;
    setEditingDoc(doc);
    setEditNotes(doc.notes || '');
  };

  const handleSaveNotes = async () => {
    if (!editingDoc) return;
    try {
      const updated: VehicleDocument = {
        ...editingDoc,
        notes: editNotes,
        lastModifiedDate: new Date().toISOString()
      };
      await documentStorageService.updateDocument(updated);
      setEditingDoc(null);
      await loadDocs();
    } catch (e) {
      alert('فشل حفظ الملاحظات');
    }
  };

  // Delete Doc with Confirmation
  const confirmDelete = async (id: string) => {
    if (!canDelete) return;
    try {
      await documentStorageService.deleteDocument(id);
      setIsDeletingId(null);
      await loadDocs();
    } catch (e) {
      alert('فشل حذف الملف');
    }
  };

  // File type formatter helpers
  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return <span className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-500 rounded-xl"><FileText size={24} /></span>;
    if (fileType.includes('image')) return <span className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 rounded-xl"><FileImage size={24} /></span>;
    if (fileType.includes('excel') || fileType.includes('spreadsheet') || fileType.includes('sheet')) {
      return <span className="p-3 bg-teal-50 dark:bg-teal-950/40 text-teal-500 rounded-xl"><FileSpreadsheet size={24} /></span>;
    }
    return <span className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl"><FileCode size={24} /></span>;
  };

  // Filter documents to show
  const filteredDocs = React.useMemo(() => {
    if (activeCategory === 'all') {
      return documents.filter(d => !d.isArchived);
    }
    if (activeCategory === 'archived') {
      return documents.filter(d => d.isArchived);
    }
    return documents.filter(d => d.category === activeCategory && !d.isArchived);
  }, [documents, activeCategory]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-50/50 dark:bg-slate-950/10 p-2 md:p-4 rounded-[2.5rem] text-slate-900 dark:text-slate-100" dir="rtl">
      
      {/* Hidden input tags */}
      <input type="file" ref={fileInputRef} onChange={handleFileInputChange} className="hidden" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx" />
      <input type="file" ref={replaceInputRef} onChange={handleReplacementChange} className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx" />

      {/* 1. Category Sidebar */}
      <div className="lg:col-span-3 space-y-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-5 rounded-3xl shadow-md">
        <h4 className="text-sm font-black text-slate-500 dark:text-slate-400 mr-2 mb-3 mt-1 pb-2 border-b border-slate-100 dark:border-slate-800">أقسام الملفات والوثائق</h4>
        
        <div className="space-y-1">
          {/* All files button */}
          <button
            onClick={() => setActiveCategory('all')}
            className={`w-full text-right flex items-center justify-between px-4 py-3 rounded-xl transition-all font-bold text-xs cursor-pointer ${
              activeCategory === 'all' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-350'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Folder size={16} />
              <span>جميع مستندات المركبة</span>
            </span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${activeCategory === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
              {counters['all']}
            </span>
          </button>

          {/* Individual folders list */}
          <div className="my-2 border-t border-slate-100 dark:border-slate-800/80 my-2 pt-2 space-y-1 max-h-[45vh] overflow-y-auto custom-scrollbar">
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  className={`w-full text-right flex items-center justify-between px-3 py-2.5 rounded-lg transition-all text-xs cursor-pointer ${
                    isActive 
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-extrabold border-r-4 border-blue-500 pr-2' 
                      : 'hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-650 dark:text-slate-400'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <Icon size={14} className={isActive ? 'text-blue-500' : 'text-slate-400'} />
                    <span className="truncate">{cat.label}</span>
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 font-mono">
                    {counters[cat.key] || 0}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Archived files button */}
          <div className="border-t border-slate-100 dark:border-slate-800/80 pt-2">
            <button
              onClick={() => setActiveCategory('archived')}
              className={`w-full text-right flex items-center justify-between px-4 py-3 rounded-xl transition-all font-bold text-xs cursor-pointer ${
                activeCategory === 'archived' 
                  ? 'bg-purple-600 text-white shadow-md' 
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-350'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Archive size={16} />
                <span>المستندات المؤرشفة</span>
              </span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${activeCategory === 'archived' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                {counters['archived'] || 0}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Main Files Workspace Area */}
      <div className="lg:col-span-9 space-y-6">
        
        {/* Upload bar (Drag & Drop Zone) */}
        {canUpload ? (
          <div 
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-[2rem] p-6 text-center transition-all ${
              dragActive 
                ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/20' 
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-400 bg-white dark:bg-slate-900 shadow-sm'
            }`}
          >
            <div className="flex flex-col items-center justify-center space-y-2 cursor-pointer" onClick={triggerFileInput}>
              {isUploading ? (
                <Loader2 size={36} className="text-blue-500 animate-spin" />
              ) : (
                <UploadCloud size={36} className="text-slate-400 dark:text-slate-650" />
              )}
              <p className="text-xs font-black text-slate-700 dark:text-slate-350">
                {isUploading ? 'جاري قراءة ورفع الملفات الآن...' : 'قم بسحب وإفلات المستندات هنا أو اضغط للاختيار من جهازك'}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                يدعم صيغ PDF, PNG, JPG, WEBP, DOCX, XLSX (الحجم الأقصى للمستند: 25 ميجابايت)
              </p>
            </div>
            
            {uploadError && (
              <div className="mt-3 text-xs font-black text-rose-500 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-xl border border-rose-100 dark:border-rose-900/30 inline-flex items-center gap-1.5">
                <AlertCircle size={14} />
                <span>{uploadError}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-amber-55/10 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-200/50 dark:border-amber-900/30 flex items-center gap-3 text-amber-700 dark:text-amber-400 text-xs font-bold leading-normal">
            <AlertCircle size={16} />
            <span>الحساب الحالي يمتلك صلاحية استعراض وتنزيل المستندات فقط (View only).</span>
          </div>
        )}

        {/* Workspace Title & Actions */}
        <div className="flex items-center justify-between px-2">
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Folder size={20} className="text-blue-500" />
              {activeCategory === 'all' && 'جميع المستندات النشطة'}
              {activeCategory === 'archived' && 'أرشيف المستندات الملغاة'}
              {CATEGORIES.find(c => c.key === activeCategory)?.label && CATEGORIES.find(c => c.key === activeCategory)?.label}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-450 font-bold mt-0.5">تاريخ المركبة: {formatVehicleDisplay(car)} — هيكل {car.vin}</p>
          </div>
          
          <div className="text-xs font-bold text-slate-400">
            عدد الملفات: {filteredDocs.length}
          </div>
        </div>

        {/* Files Grid List */}
        {isLoading ? (
          <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="animate-spin text-blue-500" size={30} />
            <span className="text-xs font-black">جاري جلب الملفات والوثائق الخاصة بالهيكل...</span>
          </div>
        ) : filteredDocs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredDocs.map(doc => {
              const fileExt = doc.fileName.split('.').pop()?.toUpperCase() || '';
              return (
                <div 
                  key={doc.id} 
                  className={`bg-white dark:bg-slate-900 border rounded-3xl p-5 hover:shadow-lg transition-all flex flex-col justify-between group relative overflow-hidden ${
                    doc.isArchived 
                      ? 'border-purple-200 dark:border-purple-900/40' 
                      : 'border-slate-100 dark:border-slate-850'
                  }`}
                >
                  <div>
                    {/* Header: File type thumbnail & Action bar */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {getFileIcon(doc.fileType)}
                        <div>
                          <p className="font-mono text-[9px] font-black tracking-wider text-slate-400 dark:text-slate-500 leading-none">صيغة {fileExt}</p>
                          <span className="text-[10px] font-black inline-block px-1.5 py-0.5 rounded mt-1 bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-300">
                            {CATEGORIES.find(c => c.key === doc.category)?.label || 'غير محدد'}
                          </span>
                        </div>
                      </div>

                      {/* Top Action buttons */}
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setPreviewDoc(doc)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-801 dark:hover:bg-slate-800 text-blue-500 rounded-lg cursor-pointer transition-colors"
                          title="معاينة المستند"
                        >
                          <Eye size={15} />
                        </button>
                        <a 
                          href={doc.fileData} 
                          download={doc.fileName}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-emerald-500 rounded-lg cursor-pointer transition-colors"
                          title="تحميل الملف"
                        >
                          <Download size={15} />
                        </a>
                      </div>
                    </div>

                    {/* Meta Section */}
                    <div className="space-y-2">
                      <h4 
                        className="font-bold text-xs text-slate-800 dark:text-white truncate cursor-pointer hover:text-blue-500 transition-colors" 
                        onClick={() => setPreviewDoc(doc)}
                        title={doc.fileName}
                      >
                        {doc.fileName}
                      </h4>
                      
                      <div className="flex items-center justify-between text-[9px] font-black text-slate-400 dark:text-slate-500">
                        <span>📅 المرفوع: {new Date(doc.uploadDate).toLocaleDateString('ar-EG')}</span>
                        <span>بواسطة: {doc.uploadedBy}</span>
                      </div>
                    </div>

                    {/* Notes Field */}
                    <div className="mt-3.5 bg-slate-50 dark:bg-slate-950/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-850 relative">
                      <div className="flex justify-between items-start">
                        <span className="text-[9px] font-black text-slate-400 block mb-1">الملاحظات والشروحات:</span>
                        {canEdit && (
                          <button 
                            onClick={() => handleOpenEditNotes(doc)}
                            className="text-slate-400 hover:text-blue-500 transition-colors cursor-pointer"
                          >
                            <Edit2 size={10} />
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] font-bold text-slate-600 dark:text-slate-350 min-h-[16px]">
                        {doc.notes ? doc.notes : <span className="text-slate-400 italic font-medium">لا توجد ملاحظات مسجلة...</span>}
                      </p>
                    </div>
                  </div>

                  {/* Footer Action items */}
                  {canEdit && (
                    <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-850 flex items-center justify-between gap-1 text-[10.5px] font-black">
                      <div className="flex gap-2">
                        {/* Replace Button */}
                        <button
                          onClick={() => triggerReplacementInput(doc.id)}
                          className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw size={12} />
                          <span>استبدال</span>
                        </button>

                        {/* Archive / Unarchive Button */}
                        <button
                          onClick={() => handleToggleArchive(doc)}
                          className="text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Archive size={12} />
                          <span>{doc.isArchived ? 'إلغاء أرشفة' : 'أرشفة'}</span>
                        </button>
                      </div>

                      {/* Delete button (Admins only) */}
                      {canDelete && (
                        <button
                          onClick={() => setIsDeletingId(doc.id)}
                          className="text-rose-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 size={12} />
                          <span>حذف نهائي</span>
                        </button>
                      )}
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-20 text-center text-slate-400 dark:text-slate-550 border-2 border-dashed border-slate-150 dark:border-slate-850 rounded-[2.5rem] flex flex-col items-center justify-center gap-2">
            <Clipboard size={44} className="text-slate-300 mb-2" />
            <span className="text-xs font-black">لا توجد مستندات مرفوعة في هذا المجلد للمركبة الحالية!</span>
            {canUpload && <span className="text-[10px] font-bold">بإمكانك البدء بسحب الملفات ووضعها هنا لرفعها فوراً.</span>}
          </div>
        )}
      </div>

      {/* 3. IMAGES / PDF PREVIEW PANEL OVERLAY */}
      {previewDoc && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in" dir="rtl">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/5">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
              <div className="border-r-4 border-blue-600 pr-3">
                <h4 className="text-sm font-black text-slate-900 dark:text-white truncate max-w-[400px]">معاينة المستند: {previewDoc.fileName}</h4>
                <p className="text-[10px] text-slate-400 font-bold">المجلد: {CATEGORIES.find(c => c.key === previewDoc.category)?.label || 'عام'} | المرفوع بواسطة {previewDoc.uploadedBy}</p>
              </div>
              <button 
                onClick={() => setPreviewDoc(null)} 
                className="p-3 text-slate-400 hover:text-rose-500 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-755 rounded-full cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 bg-slate-100 dark:bg-slate-950/80 p-6 flex items-center justify-center overflow-auto min-h-[350px]">
              {(() => {
                if (previewDoc.fileType.startsWith('image/')) {
                  return (
                    <img 
                      src={previewDoc.fileData} 
                      alt={previewDoc.fileName} 
                      className="max-w-full max-h-[60vh] object-contain rounded-2xl shadow-lg border border-slate-200" 
                      referrerPolicy="no-referrer"
                    />
                  );
                } else if (previewDoc.fileType.includes('pdf')) {
                  return (
                    <iframe 
                      src={previewDoc.fileData} 
                      title={previewDoc.fileName} 
                      className="w-full h-[60vh] rounded-2xl border-0 shadow-lg bg-white" 
                    />
                  );
                } else {
                  return (
                    <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-150 rounded-3xl max-w-md shadow-md">
                      {getFileIcon(previewDoc.fileType)}
                      <h5 className="font-black text-sm mt-4 text-slate-800 dark:text-slate-100">معاينة الملفات النصية أو الجداول غير مدعومة مباشرة</h5>
                      <p className="text-xs text-slate-500 mt-1 pb-4 leading-normal">تتطلب ملفات الـ Word والـ Excel تحميلاً محلياً لتشغيلها من خلال التطبيقات الخاصة بجهازك.</p>
                      <a 
                        href={previewDoc.fileData}
                        download={previewDoc.fileName}
                        className="px-6 py-3 bg-blue-600 text-white rounded-xl text-xs font-black inline-flex items-center gap-2 cursor-pointer transition-all hover:bg-blue-700 hover:shadow"
                      >
                        <Download size={14} />
                        <span>تحميل وتنزيل الملف الآن</span>
                      </a>
                    </div>
                  );
                }
              })()}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950 flex justify-between items-center text-xs">
              <span className="text-slate-500 font-bold">رفع في: {new Date(previewDoc.uploadDate).toLocaleString('ar-EG')}</span>
              <a 
                href={previewDoc.fileData} 
                download={previewDoc.fileName}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-black inline-flex items-center gap-1.5 cursor-pointer transition-all hover:bg-emerald-700"
              >
                <Download size={12} />
                <span>تحميل المستند</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 4. EDIT NOTES MODAL OVERLAY */}
      {editingDoc && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in" dir="rtl">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl border border-white/5 overflow-hidden">
            <div className="p-6 border-b border-sidebar-divider flex justify-between items-center">
              <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Edit2 size={16} className="text-blue-500" />
                تعديل ملاحظات المستند
              </h4>
              <button onClick={() => setEditingDoc(null)} className="text-slate-450 hover:text-rose-500 transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 block mr-2">ملاحظات وشروحات للملف</span>
                <textarea
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-2xl p-4 text-xs font-bold font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 h-28 outline-none resize-none"
                  placeholder="مثال: هذا المستند هو تحديث للمباعة الأخيرة المعتمدة..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSaveNotes}
                  className="flex-1 py-3.5 bg-blue-600 text-white font-black rounded-2xl text-xs hover:bg-blue-700 hover:shadow transition-all cursor-pointer"
                >
                  حفظ الملاحظات
                </button>
                <button
                  onClick={() => setEditingDoc(null)}
                  className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black rounded-2xl text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
                >
                  إلغاء الأمر
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. DELETE CONFIRMATION POPUP OVERLAY */}
      {isDeletingId && (
        <div className="fixed inset-0 z-[301] flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4 animate-in fade-in" dir="rtl">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl border border-white/5 space-y-5">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/45 text-rose-500 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                <Trash2 size={26} />
              </div>
              <h4 className="font-black text-base text-slate-950 dark:text-white">هل أنت متأكد من الحذف تماماً؟</h4>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-normal">تحذير! سيتم حذف هذا المستند وملف المرفقات تماماً من قاعدة البيانات والسيستم ولن تتمكن من التراجع أو استعادة الملف لاحقاً.</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => confirmDelete(isDeletingId)}
                className="flex-1 py-3.5 bg-rose-600 text-white font-black rounded-2xl text-xs hover:bg-rose-700 hover:shadow transition-all cursor-pointer"
              >
                نعم، احذف الملف نهائياً
              </button>
              <button
                onClick={() => setIsDeletingId(null)}
                className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-350 font-black rounded-2xl text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
              >
                إلغاء الحفظ
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
