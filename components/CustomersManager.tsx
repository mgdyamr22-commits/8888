import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, UserPlus, Search, Filter, Download, Upload, Trash2, Edit3, X, 
  Phone, Hash, FileSpreadsheet, UserCheck, ShieldCheck, Check, AlertCircle,
  BarChart3, TrendingUp
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip } from 'recharts';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { ExcelService } from '../services/excelService';
import { Customer, User, OrganizationSettings, Permission, UserRole, Car } from '../types';
import { CustomerImportWizard } from './CustomerImportWizard';
import { isGeneralMatchingQuery, getUnifiedSearchResults } from '../src/utils/searchEngine';

interface CustomersManagerProps {
  customers: Customer[];
  onUpdateCustomers: (c: Customer[]) => void;
  currentUser: User | null;
  settings: OrganizationSettings;
  addLog: (action: string, targetId: string, targetType: any, details: string) => void;
  cars?: Car[];
}

export const CustomersManager: React.FC<CustomersManagerProps> = ({
  customers,
  onUpdateCustomers,
  currentUser,
  settings,
  addLog,
  cars = [],
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Debounce state to optimize search performance, avoid lag during typing
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 180);
    return () => clearTimeout(handler);
  }, [searchTerm]);
  const [filterType, setFilterType] = useState<'all' | 'عميل' | 'مستلم'>('all');
  const [showReportsCenter, setShowReportsCenter] = useState(true);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  
  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [type, setType] = useState<'عميل' | 'مستلم'>('عميل');
  
  const [importStatus, setImportStatus] = useState<{ success: boolean; count: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPhoneDuplicate = useMemo(() => {
    if (!phone || !phone.trim()) return false;
    const cleanPhone = phone.trim();
    return customers.some(c => 
      c.phone && 
      c.phone.trim() === cleanPhone && 
      (!editingCustomer || c.id !== editingCustomer.id)
    );
  }, [phone, customers, editingCustomer]);

  // Reports Calculations
  const statsSummary = useMemo(() => {
    const total = customers.length;
    const clientCount = customers.filter(c => c.type === 'عميل').length;
    const recipientCount = customers.filter(c => c.type === 'مستلم').length;
    const clientPercent = total > 0 ? Math.round((clientCount / total) * 100) : 0;
    const recipientPercent = total > 0 ? Math.round((recipientCount / total) * 100) : 0;

    return {
      total,
      clientCount,
      recipientCount,
      clientPercent,
      recipientPercent
    };
  }, [customers]);

  const chartData = useMemo(() => {
    return [
      { name: 'عميل مبيعات', value: statsSummary.clientCount, color: '#2563eb', percent: statsSummary.clientPercent },
      { name: 'مستلم مركبة', value: statsSummary.recipientCount, color: '#4f46e5', percent: statsSummary.recipientPercent }
    ].filter(item => item.value > 0);
  }, [statsSummary]);

  // Filter permission check
  const canModify = currentUser?.role === UserRole.ADMIN || String(currentUser?.role).toUpperCase() === 'ADMIN' || currentUser?.permissions?.includes(Permission.VIEW_SALES);

  // Setup form for editing or adding
  const openAddModal = () => {
    setEditingCustomer(null);
    setName('');
    setPhone('');
    setNationalId('');
    setType('عميل');
    setIsModalOpen(true);
  };

  const openEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setName(c.name);
    setPhone(c.phone);
    setNationalId(c.nationalId);
    setType(c.type);
    setIsModalOpen(true);
  };

  // Safe deduplicated addition helper
  const saveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (isPhoneDuplicate) {
      alert('خطأ: رقم الهاتف مكرر ومسجل بالفعل لعميل آخر بالكامل! يرجى إدخال رقم هاتف فريد ولا يمكن التكرار.');
      return;
    }

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedId = nationalId.trim();

    let updatedList = [...customers];

    if (editingCustomer) {
      // Modify existing customer
      updatedList = updatedList.map(item => {
        if (item.id === editingCustomer.id) {
          return {
            ...item,
            name: trimmedName,
            phone: trimmedPhone,
            nationalId: trimmedId,
            type: type
          };
        }
        return item;
      });
      addLog('تعديل عميل', editingCustomer.id, 'user' as any, `تعديل بيانات العميل/المستلم: ${trimmedName}`);
    } else {
      // Prevent duplicates: ID list first, then Phone check
      let duplicateIndex = -1;
      
      if (trimmedId) {
        duplicateIndex = updatedList.findIndex(x => x.nationalId && x.nationalId.trim() === trimmedId);
      }
      
      if (duplicateIndex === -1 && trimmedPhone) {
        duplicateIndex = updatedList.findIndex(x => x.phone && x.phone.trim() === trimmedPhone);
      }

      if (duplicateIndex !== -1) {
        // Overlay/Merge existing
        updatedList[duplicateIndex] = {
          ...updatedList[duplicateIndex],
          name: trimmedName,
          phone: trimmedPhone || updatedList[duplicateIndex].phone,
          nationalId: trimmedId || updatedList[duplicateIndex].nationalId,
          type: type
        };
        addLog('تحديث عميل مكرر', updatedList[duplicateIndex].id, 'user' as any, `تحديث مكرر للعميل: ${trimmedName}`);
      } else {
        // Create brand new
        const newCustomer: Customer = {
          id: 'cust-' + Date.now() + Math.random().toString(36).substring(2, 5),
          name: trimmedName,
          phone: trimmedPhone,
          nationalId: trimmedId,
          type: type,
          addedAt: new Date().toISOString()
        };
        updatedList = [newCustomer, ...updatedList];
        addLog('إضافة عميل', newCustomer.id, 'user' as any, `إضافة عميل/مستلم جديد باسم: ${trimmedName}`);
      }
    }

    onUpdateCustomers(updatedList);
    setIsModalOpen(false);
  };

  const handleDeleteClick = (c: Customer) => {
    setCustomerToDelete(c);
  };

  const confirmDelete = () => {
    if (!customerToDelete) return;
    const updated = customers.filter(c => c.id !== customerToDelete.id);
    onUpdateCustomers(updated);
    addLog('حذف عميل', customerToDelete.id, 'user' as any, `تم حذف العميل/المستلم: ${customerToDelete.name}`);
    setCustomerToDelete(null);
  };

  // Search and Filtering Computation
  const filteredCustomers = useMemo(() => {
    const queryActive = debouncedSearchTerm.trim().length > 0;
    const matchingCarOwnerAndReceiverNames = new Set<string>();

    if (queryActive) {
      const matchingCars = getUnifiedSearchResults(cars, debouncedSearchTerm);
      matchingCars.forEach(car => {
        if (car.plateData?.ownerName) {
          matchingCarOwnerAndReceiverNames.add(car.plateData.ownerName.trim().toLowerCase());
        }
        if (car.exitData?.receiverName) {
          matchingCarOwnerAndReceiverNames.add(car.exitData.receiverName.trim().toLowerCase());
        }
        if (car.exitData?.representativeName) {
          matchingCarOwnerAndReceiverNames.add(car.exitData.representativeName.trim().toLowerCase());
        }
      });
    }

    return customers.filter(c => {
      const matchType = filterType === 'all' || c.type === filterType;
      if (!matchType) return false;

      const fullContactText = `${c.name} ${c.phone} ${c.nationalId} ${c.type || ''}`;
      const matchMainSearch = isGeneralMatchingQuery(fullContactText, debouncedSearchTerm);
        
      if (matchMainSearch) return true;

      if (queryActive && matchingCarOwnerAndReceiverNames.size > 0) {
        const normCustomerName = c.name.trim().toLowerCase();
        const isLinkedToVehicle = Array.from(matchingCarOwnerAndReceiverNames).some(vName => {
          return vName.includes(normCustomerName) || normCustomerName.includes(vName);
        });

        if (isLinkedToVehicle) return true;
      }

      return false;
    });
  }, [customers, debouncedSearchTerm, filterType, cars]);

  // ExcelJS Export Method
  const exportToExcel = async () => {
    const direction = localStorage.getItem('excel_export_direction') || 'RTL';
    const isRTL = direction === 'RTL';

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('سجل الملاك والمستلمين', {
      views: [{ rightToLeft: isRTL }]
    });

    worksheet.columns = [
      { header: 'م', key: 'index', width: 6 },
      { header: 'الاسم كامل', key: 'name', width: 30 },
      { header: 'رقم الهاتف / الجوال', key: 'phone', width: 22 },
      { header: 'رقم الهوية الوطنية / الإقامة', key: 'nationalId', width: 25 },
      { header: 'نوع السجل (عميل / مستلم)', key: 'type', width: 18 }
    ];

    // Format headers with beautiful dark slate
    const headerRow = worksheet.getRow(1);
    headerRow.height = 32;
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11, name: 'Cairo' };
      cell.alignment = { vertical: 'middle', horizontal: 'center', readingOrder: isRTL ? 'rtl' : 'ltr' };
    });

    filteredCustomers.forEach((c, index) => {
      const row = worksheet.addRow({
        index: index + 1,
        name: c.name,
        phone: c.phone || 'غير مسجل',
        nationalId: c.nationalId || 'غير مسجل',
        type: c.type
      });
      
      row.height = 24;
      row.eachCell((cell, colNumber) => {
        cell.alignment = { 
          vertical: 'middle', 
          horizontal: colNumber === 1 ? 'center' : (isRTL ? 'right' : 'left'),
          readingOrder: isRTL ? 'rtl' : 'ltr' 
        };
        cell.font = { size: 10, name: 'Cairo' };
      });
    });

    // Auto-Fit Columns (حساب العرض تلقائياً للأعمدة بشكل ذكي مع استثناء الخلايا المدمجة)
    worksheet.columns.forEach((column: any) => {
      let maxColumnLength = 0;
      if (column.header) {
        maxColumnLength = Math.max(maxColumnLength, String(column.header).length);
      }
      column.eachCell!({ includeEmpty: true }, (cell: any) => {
        const isMerged = cell.isMerged || (cell.master && cell.master.address !== cell.address);
        if (isMerged) return;
        if (cell.value !== null && cell.value !== undefined) {
          const valStr = cell.value instanceof Date ? cell.value.toLocaleDateString('ar-EG') : String(cell.value);
          const len = valStr.trim().length;
          if (len > maxColumnLength) maxColumnLength = len;
        }
      });
      const isIndexColumn = column.key === 'index' || (column.header && String(column.header) === 'م');
      let minWidth = isIndexColumn ? 6 : 10;
      let maxWidth = 45;
      let calculatedWidth = Math.ceil(maxColumnLength * 1.15) + 3;
      column.width = Math.min(maxWidth, Math.max(minWidth, calculatedWidth));
    });

    workbook.worksheets.forEach(ws => {
      ExcelService.formatWorksheet(ws, { isRTL: true });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `سجل_العملاء_والمستلمين_${new Date().toISOString().split('T')[0]}.xlsx`);
    addLog('تصدير إكسل للعملاء', 'bulk', 'user' as any, `تصدير عدد ${filteredCustomers.length} عميل ومستلم بنجاح`);
  };

  // CSV Export Method
  const exportToCSV = () => {
    // Incorporate UTF-8 BOM representation for MS Excel compliance
    let csvContent = '\uFEFF';
    csvContent += 'الاسم,رقم الهاتف,رقم الهوية,نوع السجل\n';

    filteredCustomers.forEach(c => {
      csvContent += `"${c.name.replace(/"/g, '""')}","${c.phone || ''}","${c.nationalId || ''}","${c.type}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `سجل_العملاء_والمستلمين_${new Date().toISOString().split('T')[0]}.csv`);
    addLog('تصدير CSV للعملاء', 'bulk', 'user' as any, `تصدير ملف CSV للعملاء بنجاح`);
  };

  // VCF (vCard) Export Method
  const exportToVCF = () => {
    let vcfContent = '';
    filteredCustomers.forEach(c => {
      vcfContent += 'BEGIN:VCARD\n';
      vcfContent += 'VERSION:3.0\n';
      vcfContent += `FN:${c.name}\n`;
      if (c.phone) {
        vcfContent += `TEL;TYPE=CELL:${c.phone}\n`;
      }
      if (c.nationalId) {
        vcfContent += `NOTE:رقم الهوية: ${c.nationalId} | النوع: ${c.type}\n`;
      }
      vcfContent += `REV:${new Date().toISOString()}\n`;
      vcfContent += 'END:VCARD\n';
    });

    const blob = new Blob([vcfContent], { type: 'text/vcard;charset=utf-8;' });
    saveAs(blob, `جهات_اتصال_العملاء_${new Date().toISOString().split('T')[0]}.vcf`);
    addLog('تصدير كروت الاتصال VCF', 'bulk', 'user' as any, `تصدير ملف VCF لجهات اتصال الهواتف بنجاح`);
  };

  // Excel / CSV Import Parser
  const handleImportWizardComplete = (imported: Customer[], duplicateMode: 'overwrite' | 'skip') => {
    let updatedList = [...customers];
    let addedCount = 0;
    let updatedCount = 0;

    imported.forEach(item => {
      // Find matching customer by Phone or NationalId
      const duplicateIndex = updatedList.findIndex(x => 
        (x.phone && item.phone && x.phone.trim() === item.phone.trim()) || 
        (x.nationalId && item.nationalId && x.nationalId.trim() === item.nationalId.trim())
      );

      if (duplicateIndex !== -1) {
        if (duplicateMode === 'overwrite') {
          updatedList[duplicateIndex] = {
            ...updatedList[duplicateIndex],
            name: item.name,
            phone: item.phone || updatedList[duplicateIndex].phone,
            nationalId: item.nationalId || updatedList[duplicateIndex].nationalId,
            type: item.type
          };
          updatedCount++;
        }
      } else {
        const freshCust: Customer = {
          id: 'cust-' + Date.now() + Math.random().toString(36).substring(2, 5),
          name: item.name,
          phone: item.phone,
          nationalId: item.nationalId,
          type: item.type,
          addedAt: new Date().toISOString()
        };
        updatedList = [freshCust, ...updatedList];
        addedCount++;
      }
    });

    onUpdateCustomers(updatedList);
    setIsImportWizardOpen(false);
    addLog('استيراد جماعي للعملاء', 'bulk', 'user' as any, `استيراد ذكي لعدد ${addedCount} عميل جديد مع تحديث ${updatedCount} مكرر`);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Header and Title Section */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="space-y-2 text-start">
          <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            <Users className="text-indigo-600 dark:text-indigo-400" size={32} />
            إدارة العملاء والمستلمين المعتمدين
          </h2>
          <p className="text-sm font-bold text-slate-400 dark:text-slate-500">
            سجل مجمع للعملاء والمستلمين يتغذى تلقائيًا فقط من عمليات الخروج وتسليم المركبات لمنع التكرار والحفاظ على الخصوصية.
          </p>
        </div>

        {/* Quick Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowReportsCenter(prev => !prev)}
            className={`flex items-center gap-2 px-5 py-3.5 rounded-2xl text-xs font-black transition-all cursor-pointer ${
              showReportsCenter 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/10 border border-indigo-650' 
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-820 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <BarChart3 size={16} />
            {showReportsCenter ? 'إخفاء التقارير البيانية' : 'عرض تقارير وتوزيع العملاء'}
          </button>

          {canModify && (
            <>
              <button
                onClick={() => setIsImportWizardOpen(true)}
                className="flex items-center gap-2 px-5 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-820 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-black text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
                title="يتم استيراد الاسم والهاتف والهوية بشكل ذكي وبوابة متكاملة"
              >
                <Upload size={16} />
                استيراد ملف عملاء
              </button>

              {/* Export Dropdown options */}
              <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pr-3 pl-1 py-1 gap-2 shadow-sm">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">تصدير الحالي:</span>
                <button 
                  onClick={exportToExcel}
                  className="p-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-xl hover:scale-105 transition-all"
                  title="تصدير إلى Excel"
                >
                  <FileSpreadsheet size={16} />
                </button>
                <button 
                  onClick={exportToCSV}
                  className="p-2 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-xl hover:scale-105 transition-all text-xs font-black px-2.5"
                  title="تصدير إلى CSV"
                >
                  CSV
                </button>
                <button 
                  onClick={exportToVCF}
                  className="p-2 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 rounded-xl hover:scale-105 transition-all text-xs font-black px-2.5"
                  title="تصدير جهات اتصال للهواتف VCF"
                >
                  VCF (جوال)
                </button>
              </div>

              <button
                onClick={openAddModal}
                className="flex items-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black shadow-lg shadow-blue-500/10 transition-all cursor-pointer"
              >
                <UserPlus size={16} />
                إضافة يدوية
              </button>
            </>
          )}
        </div>
      </div>

      {/* Customer Reports Overview Section */}
      <AnimatePresence>
        {showReportsCenter && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-50 dark:bg-slate-950 p-6 rounded-3xl border border-slate-150 dark:border-slate-800/80 shadow-inner">
              
              {/* Pie Chart Section - taking 5/12 cols on large screens */}
              <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                    <TrendingUp className="text-blue-600 dark:text-blue-400" size={16} />
                    نسبة توزيع العملاء والمستلمين
                  </h3>
                  <p className="text-[11px] text-slate-400 font-bold mt-1">توزيع نسبي مئوي طبقاً لنوع السجل الحالي</p>
                </div>

                {statsSummary.total > 0 ? (
                  <div className="h-[200px] w-full relative z-10 my-4 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie 
                          data={chartData} 
                          cx="50%" 
                          cy="50%" 
                          innerRadius={55} 
                          outerRadius={75} 
                          paddingAngle={6} 
                          dataKey="value" 
                          stroke="none"
                        >
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <ReTooltip 
                          contentStyle={{ 
                            borderRadius: '16px', 
                            border: 'none', 
                            background: '#0f172a', 
                            color: '#fff', 
                            padding: '12px', 
                            fontFamily: 'Cairo',
                            direction: 'rtl',
                            textAlign: 'right'
                          }} 
                          itemStyle={{ fontWeight: '900', fontSize: '11px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-bold leading-none animate-pulse">الإجمالي</span>
                      <span className="text-2xl font-black text-slate-800 dark:text-white leading-none mt-1 block">{statsSummary.total}</span>
                    </div>
                  </div>
                ) : (
                  <div className="h-[200px] flex flex-col items-center justify-center text-center p-4">
                    <AlertCircle className="text-slate-350 dark:text-slate-600 mb-2 animate-bounce" size={32} />
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 font-bold">لا يوجد عملاء حالياً للمقارنة</p>
                  </div>
                )}

                {/* Legend display */}
                <div className="flex justify-center gap-4 mt-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#2563eb' }}></div>
                    <span className="text-xs font-black text-slate-600 dark:text-slate-350">عملاء مبيعات ({statsSummary.clientPercent}%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#4f46e5' }}></div>
                    <span className="text-xs font-black text-slate-600 dark:text-slate-350">مستلم مركبة ({statsSummary.recipientPercent}%)</span>
                  </div>
                </div>
              </div>

              {/* Analytical Numbers & Indicators Section - taking 7/12 cols */}
              <div className="lg:col-span-7 flex flex-col justify-between gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-full">
                  
                  {/* Total Card */}
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">سجل النشاط المجمع</span>
                      <h4 className="text-base font-black text-slate-800 dark:text-white mt-1">العدد الكلي والنشاط</h4>
                    </div>
                    <div className="flex items-baseline gap-2 mt-4">
                      <span className="text-4xl font-extrabold text-slate-900 dark:text-white">{statsSummary.total}</span>
                      <span className="text-xs font-bold text-slate-400">سجل معتمد</span>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-50 dark:border-slate-850 text-right">
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold leading-relaxed">
                        يتم تغذية جهات الاتصال ديناميكياً لضمان سلامة العمليات وحفظ بيانات العملاء والمستلمين تلقائياً من المبيعات.
                      </p>
                    </div>
                  </div>

                  {/* Clients vs Recipients detail */}
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">تفاصيل جهات الاتصال</span>
                      <h4 className="text-base font-black text-slate-800 dark:text-white mt-1">توزيع الفئات المعتمدة</h4>
                    </div>
                    
                    <div className="space-y-3 mt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 bg-blue-600 rounded-full"></div>
                          <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">عملاء مبيعات</span>
                        </div>
                        <span className="text-sm font-black text-slate-900 dark:text-white">{statsSummary.clientCount} سجل</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full"></div>
                          <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">مستلم مركبة</span>
                        </div>
                        <span className="text-sm font-black text-slate-900 dark:text-white">{statsSummary.recipientCount} سجل</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-50 dark:border-slate-850 text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                      يمثل نسبة عملاء المبيعات من الإجمالي <span className="text-blue-600 dark:text-blue-400 font-extrabold">{statsSummary.clientPercent}%</span> ومستلمي السيارات <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{statsSummary.recipientPercent}%</span>.
                    </div>
                  </div>

                </div>

                {/* Analytical advice banner */}
                <div className="bg-indigo-50/50 dark:bg-indigo-950/10 p-4 rounded-2xl border border-indigo-200/50 dark:border-indigo-900/30 text-slate-755 dark:text-slate-300 flex items-center justify-between gap-4 text-xs font-bold">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-950/45 text-indigo-600 dark:text-indigo-400 rounded-lg shrink-0">
                      <BarChart3 size={16} />
                    </div>
                    <span className="leading-relaxed">
                      الرسم البياني أعلاه يحلل نسبة المستلمين الفعليين للسيارات مقارنة بالمشترين الفعليين لحوكمة أفضل لعمليات المعارض والتسليم.
                    </span>
                  </div>
                </div>

              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notification Banner for Import */}
      {importStatus && (
        <div className={`p-4 rounded-2xl border ${importStatus.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-400' : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/20 dark:border-red-900 dark:text-red-400'} flex items-center gap-3 text-xs font-bold leading-relaxed`}>
          {importStatus.success ? (
            <>
              <ShieldCheck size={18} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>تم استيراد ومعالجة الملف بنجاح! تم استخلاص وإضافة <strong>{importStatus.count}</strong> عميل جديد متفاديًا للتكرار والتزاحم.</span>
            </>
          ) : (
            <>
              <AlertCircle size={18} className="shrink-0 text-red-600 dark:text-red-400" />
              <span>نأسف، حدث خطأ فني أثناء قراءة وتحليل الملف المستورد. يرجى التأكد من احتوائه على أعمدة (الاسم، الهاتف، الهوية).</span>
            </>
          )}
        </div>
      )}

      {/* Filter and Search Bar Section */}
      <div className="flex flex-col lg:flex-row items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        
        {/* Real-time Search Integration */}
        <div className="relative flex-1 w-full">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="البحث بالاسم كامل، رقم الجوال، أو رقم الهوية..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-12 pl-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/10 focus:border-blue-500 dark:focus:border-blue-500 transition-all font-bold text-sm text-slate-800 dark:text-white"
          />
        </div>

        {/* Filter Selection Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-150 dark:border-slate-800/80 w-full lg:w-auto shrink-0">
          <button
            onClick={() => setFilterType('all')}
            className={`flex-1 lg:flex-none px-5 py-2 rounded-xl text-xs font-black transition-all ${
              filterType === 'all'
                ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            الكل ({customers.length})
          </button>
          
          <button
            onClick={() => setFilterType('عميل')}
            className={`flex-1 lg:flex-none px-5 py-2 rounded-xl text-xs font-black transition-all ${
              filterType === 'عميل'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            عملاء ({customers.filter(c => c.type === 'عميل').length})
          </button>

          <button
            onClick={() => setFilterType('مستلم')}
            className={`flex-1 lg:flex-none px-5 py-2 rounded-xl text-xs font-black transition-all ${
              filterType === 'مستلم'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            مستلمين ({customers.filter(c => c.type === 'مستلم').length})
          </button>
        </div>
      </div>

      {/* Main Records Table with Conversion to Cards layout on mobile devices */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden text-slate-900 dark:text-white">
        
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800/80">
              <tr>
                <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center w-16">م</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">الاسم كامل</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">رقم الهاتف</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">رقم الهوية الوطنية / الإقامة</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center w-36">نوع السجل</th>
                {canModify && <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center w-32">الإجراءات</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((c, idx) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/30 transition-colors group">
                    <td className="px-6 py-4 text-center text-xs font-bold text-slate-400">{idx + 1}</td>
                    <td className="px-6 py-4">
                      <div className="font-extrabold text-slate-800 dark:text-slate-100">{c.name}</div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs font-medium text-slate-600 dark:text-slate-350">{c.phone || '-'}</td>
                    <td className="px-6 py-4 font-mono text-xs font-medium text-slate-600 dark:text-slate-350">{c.nationalId || '-'}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-black rounded-full ${
                        c.type === 'عميل' 
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' 
                          : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400'
                      }`}>
                        <UserCheck size={12} />
                        {c.type}
                      </span>
                    </td>
                    {canModify && (
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openEditModal(c)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/45 rounded-xl transition-all"
                            title="تعديل"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(c)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/45 rounded-xl transition-all"
                            title="حذف"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={canModify ? 6 : 5} className="px-6 py-16 text-center text-slate-400 dark:text-slate-500 font-bold">
                    لا يوجد عملاء مطبقين حاليًا.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Grid/Cards View */}
        <div className="block md:hidden p-4 space-y-4">
          {filteredCustomers.length > 0 ? (
            filteredCustomers.map((c, idx) => (
              <div 
                key={c.id} 
                className="p-5 rounded-2xl border border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 text-right space-y-4"
              >
                <div className="flex items-start justify-between">
                  <span className="text-xs font-black text-slate-400">#{idx + 1}</span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-black rounded-full ${
                    c.type === 'عميل' 
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' 
                      : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400'
                  }`}>
                    {c.type}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-bold text-slate-400">الاسم الكامل</div>
                  <div className="font-black text-slate-800 dark:text-white text-base">{c.name}</div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1">
                    <div className="text-[11px] font-bold text-slate-400">الهاتف</div>
                    <div className="font-mono text-xs text-slate-700 dark:text-slate-300">{c.phone || '-'}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[11px] font-bold text-slate-400">رقم الهوية</div>
                    <div className="font-mono text-xs text-slate-700 dark:text-slate-300">{c.nationalId || '-'}</div>
                  </div>
                </div>

                {canModify && (
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <button
                      onClick={() => openEditModal(c)}
                      className="flex items-center gap-1 px-4 py-2 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 text-blue-600 dark:text-blue-400 text-xs font-black rounded-xl transition-all"
                    >
                      <Edit3 size={13} />
                      تعديل
                    </button>
                    <button
                      onClick={() => handleDeleteClick(c)}
                      className="flex items-center gap-1 px-4 py-2 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 text-red-600 dark:text-red-400 text-xs font-black rounded-xl transition-all"
                    >
                      <Trash2 size={13} />
                      حذف
                    </button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500 font-bold text-sm">
              لا يوجد عملاء مطبقين حاليًا.
            </div>
          )}
        </div>
      </div>

      {/* Entry/Editor Modal Dialog */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300 overflow-y-auto overscroll-contain touch-pan-y" dir="rtl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md sm:max-w-lg rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh] sm:max-h-[90vh] my-auto"
            >
              <div className="flex items-center justify-between p-4 sm:p-6 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-850 shrink-0">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-950/45 text-blue-600 dark:text-blue-400 rounded-xl">
                    <UserCheck size={18} className="sm:w-5 sm:h-5" />
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white tracking-tight">
                    {editingCustomer ? 'تعديل بيانات العميل' : 'إضافة عميل يدوياً'}
                  </h3>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)} 
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-350 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={saveCustomer} className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6 overflow-y-auto custom-scrollbar flex-1">
                
                {/* Name field */}
                <div className="space-y-1.5 text-start">
                  <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mr-1">الاسم الكامل والرباعي</label>
                  <div className="relative group">
                    <Users className="absolute right-3.5 sm:right-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={16} />
                    <input 
                      type="text"
                      required
                      placeholder="أدخل الاسم الكامل للعميل..."
                      className="w-full pr-11 pl-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-xl sm:rounded-2xl outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/20 focus:border-blue-500 dark:focus:border-blue-500 transition-all font-bold text-xs sm:text-sm text-slate-800 dark:text-white text-right"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                </div>

                {/* Phone field */}
                <div className="space-y-1.5 text-start">
                  <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mr-1">رقم الهاتف / الجوال</label>
                  <div className="relative group">
                    <Phone className="absolute right-3.5 sm:right-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={16} />
                    <input 
                      type="text"
                      placeholder="مثال: 05XXXXXXXX"
                      className="w-full pr-11 pl-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-xl sm:rounded-2xl outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/20 focus:border-blue-500 dark:focus:border-blue-500 transition-all font-bold text-slate-850 dark:text-white text-right font-mono text-xs sm:text-sm"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  {isPhoneDuplicate && (
                    <div className="text-xs font-black text-rose-500 dark:text-rose-400 mt-1 mr-1 flex items-center gap-1 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/30 animate-pulse">
                      <span>⚠️ رقم الهاتف مكرر ومسجل لعميل آخر بالكامل!</span>
                    </div>
                  )}
                </div>

                {/* National ID / Iqama field */}
                <div className="space-y-1.5 text-start">
                  <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mr-1">رقم الهوية الوطنية / الإقامة</label>
                  <div className="relative group">
                    <Hash className="absolute right-3.5 sm:right-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={16} />
                    <input 
                      type="text"
                      placeholder="مثال: 10XXXXXXXX"
                      className="w-full pr-11 pl-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-xl sm:rounded-2xl outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/20 focus:border-blue-500 dark:focus:border-blue-500 transition-all font-bold text-slate-850 dark:text-white text-right font-mono text-xs sm:text-sm"
                      value={nationalId}
                      onChange={(e) => setNationalId(e.target.value)}
                    />
                  </div>
                </div>

                {/* Record type toggle */}
                <div className="space-y-2 text-start">
                  <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mr-1">تصنيف نوع السجل</label>
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => setType('عميل')}
                      className={`py-3 sm:py-3.5 rounded-xl sm:rounded-2xl font-black text-xs border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        type === 'عميل'
                          ? 'bg-blue-50 border-blue-600 text-blue-700 dark:bg-blue-950/40 dark:border-blue-500 dark:text-blue-400'
                          : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300 dark:bg-slate-950 dark:border-slate-800'
                      }`}
                    >
                      <Check className={`w-4 h-4 transition-transform ${type === 'عميل' ? 'scale-100' : 'scale-0 opacity-0'}`} />
                      عميل مبيعات
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setType('مستلم')}
                      className={`py-3 sm:py-3.5 rounded-xl sm:rounded-2xl font-black text-xs border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        type === 'مستلم'
                          ? 'bg-indigo-50 border-indigo-600 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-500 dark:text-indigo-400'
                          : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300 dark:bg-slate-950 dark:border-slate-800'
                      }`}
                    >
                      <Check className={`w-4 h-4 transition-transform ${type === 'مستلم' ? 'scale-100' : 'scale-0 opacity-0'}`} />
                      مستلم مركبة
                    </button>
                  </div>
                </div>

                {/* Form CTA Actions */}
                <div className="pt-2 sm:pt-4 flex gap-3">
                  <button 
                    type="submit" 
                    className="flex-1 py-3.5 bg-blue-600 text-white font-black rounded-xl sm:rounded-2xl shadow-lg shadow-blue-500/10 hover:bg-blue-700 transition-all active:scale-[0.98] cursor-pointer text-xs sm:text-sm"
                  >
                    {editingCustomer ? 'حفظ التغييرات' : 'تأكيد الإضافة'}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)} 
                    className="px-5 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black rounded-xl sm:rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer text-xs sm:text-sm"
                  >
                    إلغاء
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}

        {customerToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300 overflow-y-auto overscroll-contain" dir="rtl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200 my-auto"
            >
              <div className="p-5 sm:p-8 space-y-5 text-center">
                <div className="mx-auto w-12 h-12 sm:w-14 sm:h-14 bg-red-100 dark:bg-red-950/45 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center">
                  <Trash2 size={24} className="sm:w-7 sm:h-7" />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-lg sm:text-xl font-black text-slate-850 dark:text-white">تأكيد حذف السجل</h3>
                  <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 font-bold leading-relaxed px-2">
                    هل أنت متأكد تماماً من رغبتك في حذف العميل/المستلم <strong className="text-slate-800 dark:text-slate-100">"{customerToDelete.name}"</strong>؟ هذا الإجراء فوري ولا يمكن التراجع عنه.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button 
                    onClick={confirmDelete}
                    className="w-full py-3 bg-red-600 text-white font-black rounded-xl shadow-lg shadow-red-500/10 hover:bg-red-700 transition-all cursor-pointer text-xs sm:text-sm"
                  >
                    نعم، احذف السجل
                  </button>
                  <button 
                    onClick={() => setCustomerToDelete(null)}
                    className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-black rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer text-xs sm:text-sm"
                  >
                    تراجع
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {isImportWizardOpen && (
        <CustomerImportWizard
          existingCustomers={customers}
          currentUser={currentUser}
          onImportComplete={handleImportWizardComplete}
          onClose={() => setIsImportWizardOpen(false)}
        />
      )}

    </div>
  );
};
