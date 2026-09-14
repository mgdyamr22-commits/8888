
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Users, 
  Shield, 
  Activity, 
  Search,
  Plus,
  Trash2,
  Edit3,
  X,
  UserPlus,
  ShieldAlert,
  Briefcase,
  Lock,
  Phone,
  Mail,
  Filter,
  Download,
  Calendar,
  RotateCcw,
  Car as CarIcon,
  Smartphone,
  KeyRound,
  Fingerprint,
  HelpCircle,
  Info,
  LockKeyhole,
  ClipboardList,
  Save,
  CheckCircle2,
  UserCheck,
  AlertTriangle
} from 'lucide-react';
import { User, ActivityLog, UserRole, Permission, Car } from '../types';
import { ROLE_PERMISSIONS } from '../constants';
import { isGeneralMatchingQuery, getUnifiedSearchResults } from '../src/utils/searchEngine';
import { UserApiService } from '../src/services/userApiService';

interface UserAdminProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  logs: ActivityLog[];
  addLog: (action: string, targetId: string, targetType: ActivityLog['targetType'], details: string) => void;
  currentUser: User | null;
  cars?: Car[];
  setCurrentUser?: React.Dispatch<React.SetStateAction<User | null>>;
  setCars?: React.Dispatch<React.SetStateAction<Car[]>>;
  usersLoadError?: string;
}

const UserAdmin: React.FC<UserAdminProps> = ({ users, setUsers, logs, addLog, currentUser, cars = [], setCurrentUser, setCars, usersLoadError = '' }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [alertMessage, setAlertMessage] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState(''); 
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.EMPLOYEE);
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>(ROLE_PERMISSIONS[UserRole.EMPLOYEE]);
  const [searchTerm, setSearchTerm] = useState('');

  // Server-backed CRUD error/loading states (no localStorage fallback)
  const [usersFetchError, setUsersFetchError] = useState('');
  const [actionError, setActionError] = useState('');
  const [isSavingUser, setIsSavingUser] = useState(false);

  const location = useLocation();

  // System Admin specialized states & sub-tabs
  const [adminSubTab, setAdminSubTab] = useState<'employees' | 'system_admin'>('employees');
  const [selectedAdminId, setSelectedAdminId] = useState<string>('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminFullName, setAdminFullName] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPermissions, setAdminPermissions] = useState<Permission[]>(ROLE_PERMISSIONS[UserRole.ADMIN]);
  const [adminSuccessMsg, setAdminSuccessMsg] = useState('');
  const [adminErrorMsg, setAdminErrorMsg] = useState('');
  const [isAdminSaving, setIsAdminSaving] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('tab') === 'system_admin') {
      setAdminSubTab('system_admin');
    }
  }, [location.search]);

  // Fetch 100% fresh user lists directly when entering the administrator setup tab
  useEffect(() => {
    if (adminSubTab === 'system_admin') {
      setUsersFetchError('');
      UserApiService.fetchUsers()
        .then(fetchedUsers => {
          setUsers(fetchedUsers);
        })
        .catch((err: any) => {
          setUsersFetchError(err?.message || 'تعذر جلب قائمة المستخدمين من الخادم.');
        });
    }
  }, [adminSubTab, setUsers]);

  // Identify all valid administrative users
  const adminUsers = users.filter(u => 
    u.role === UserRole.ADMIN || 
    String(u.role).toUpperCase() === 'ADMIN' || 
    u.primaryAdmin === true ||
    u.primaryAdmin === 1 ||
    u.id === 'u1'
  );

  // Auto-select administrative user of interest (primary admin or first admin found)
  useEffect(() => {
    if (adminSubTab === 'system_admin' && adminUsers.length > 0 && !selectedAdminId) {
      const primary = adminUsers.find(u => u.primaryAdmin === true || u.primaryAdmin === 1) || adminUsers[0];
      setSelectedAdminId(primary.id);
    }
  }, [adminSubTab, adminUsers, selectedAdminId]);

  // Sync state values with active selected administrator
  useEffect(() => {
    if (selectedAdminId) {
      const targetAdmin = users.find(u => u.id === selectedAdminId);
      if (targetAdmin) {
        setAdminUsername(targetAdmin.username);
        setAdminFullName(targetAdmin.fullName || '');
        setAdminPhone(targetAdmin.phone || '');
        setAdminEmail(targetAdmin.adminEmail || targetAdmin.email || '');
        setAdminPermissions(targetAdmin.permissions || ROLE_PERMISSIONS[UserRole.ADMIN]);
      }
    }
  }, [selectedAdminId, users]);

  const handleUpdateSystemAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminErrorMsg('');
    setAdminSuccessMsg('');
    setIsAdminSaving(true);

    if (!adminUsername.trim()) {
      setAdminErrorMsg('يرجى إدخال اسم مستخدم لمدير النظام');
      setIsAdminSaving(false);
      return;
    }

    const targetAdmin = users.find(u => u.id === selectedAdminId);
    if (!targetAdmin) {
      setAdminErrorMsg('تعذر تحديد حساب مدير النظام المطلوب تعديله.');
      setIsAdminSaving(false);
      return;
    }

    const existsForOther = users.find(
      u => u.username.toLowerCase().trim() === adminUsername.trim().toLowerCase() && u.id !== targetAdmin.id
    );
    if (existsForOther) {
      setAdminErrorMsg('اسم المستخدم هذا محجوز لحساب موظف آخر أو مسؤول آخر بالفعل');
      setIsAdminSaving(false);
      return;
    }

    try {
      const oldUsername = targetAdmin.username;
      const newUsername = adminUsername.trim();

      const updatedAdminUser: User = {
        ...targetAdmin,
        username: newUsername,
        fullName: adminFullName.trim(),
        phone: adminPhone.trim(),
        email: adminEmail.trim(),
        adminEmail: adminEmail.trim(),
        role: UserRole.ADMIN,
        permissions: adminPermissions
      };

      // Send the plaintext password (if changed) to the server so it can be
      // hashed there with Security::hashPassword — hashing it again on the
      // client first would double-hash it and break future logins.
      await UserApiService.updateUser(targetAdmin.id, {
        username: newUsername,
        fullName: adminFullName.trim(),
        email: adminEmail.trim(),
        phone: adminPhone.trim(),
        role: UserRole.ADMIN,
        permissions: adminPermissions,
        ...(adminPassword.trim() ? { password: adminPassword.trim() } as any : {})
      });

      const updatedUsersList = users.map(u => u.id === targetAdmin.id ? updatedAdminUser : u);

      // 1. Update users list
      setUsers(updatedUsersList);

      // 2. Update current active logged-in user context in React if they edited themselves
      if (currentUser && currentUser.id === targetAdmin.id && setCurrentUser) {
        const loggedUser: User = {
          ...updatedAdminUser,
          id: targetAdmin.id,
          accessToken: currentUser.accessToken,
          refreshToken: currentUser.refreshToken
        };
        setCurrentUser(loggedUser);
      }

      // 3. Propagate name change to cars db to prevent broken data and conflicts
      if (oldUsername !== newUsername && setCars) {
        setCars(prev => prev.map(car => {
          let updated = false;
          let newExitData = car.exitData;
          let newSeller = car.seller;

          if (car.seller === oldUsername) {
            newSeller = newUsername;
            updated = true;
          }

          if (car.exitData) {
            let exitDataUpdated = false;
            let exitSeller = car.exitData.seller;
            let exitRep = car.exitData.representativeName;

            if (car.exitData.seller === oldUsername) {
              exitSeller = newUsername;
              exitDataUpdated = true;
            }
            if (car.exitData.representativeName === oldUsername) {
              exitRep = newUsername;
              exitDataUpdated = true;
            }

            if (exitDataUpdated) {
              newExitData = {
                ...car.exitData,
                seller: exitSeller,
                representativeName: exitRep,
              };
              updated = true;
            }
          }

          if (updated) {
            return {
              ...car,
              seller: newSeller,
              exitData: newExitData,
            };
          }
          return car;
        }));
      }

      addLog(
        'تعديل مدير النظام',
        targetAdmin.id,
        'user',
        `تحديث شامل لبيانات المسؤول [${newUsername}] (بشكل فوري مباشر): الاسم الكامل [${adminFullName.trim()}] والبريد [${adminEmail.trim()}]`
      );

      setAdminSuccessMsg('تم تحديث بيانات حساب مدير النظام وحفظها مباشرة بجدول المستخدمين الحقيقي وتعميمها بنجاح!');
      setAdminPassword('');
    } catch (err: any) {
      setAdminErrorMsg(`حدث عطل في الاتصال: ${err.message || err}`);
    } finally {
      setIsAdminSaving(false);
    }
  };

  // Security Diagnostics & Automated Migration Center States
  const [diagReports, setDiagReports] = useState<any[]>([]);
  const [diagSummary, setDiagSummary] = useState<string>('');
  const [diagLoading, setDiagLoading] = useState<boolean>(false);
  const [diagFixLoading, setDiagFixLoading] = useState<boolean>(false);
  const [testSteps, setTestSteps] = useState<any[]>([]);
  const [testLoading, setTestLoading] = useState<boolean>(false);
  const [testMessage, setTestMessage] = useState<string>('');
  const [showDiagPanel, setShowDiagPanel] = useState<boolean>(false);

  const runDatabaseDiagnostics = async () => {
    setDiagLoading(true);
    setDiagReports([]);
    try {
      const res = await fetch('/api/auth/diagnostic');
      const data = await res.json();
      if (data.success) {
        setDiagReports(data.reports || []);
        setDiagSummary(data.summary || '');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDiagLoading(false);
    }
  };

  const applyDiagnosticsFixes = async () => {
    setDiagFixLoading(true);
    try {
      const res = await fetch('/api/auth/diagnostic-fix', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(data.message || 'تم تنظيف وتصحيح تراكمات الحسابات بنجاح.');
        runDatabaseDiagnostics();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDiagFixLoading(false);
    }
  };

  const runAutomatedCredentialsTest = async () => {
    setTestLoading(true);
    setTestSteps([]);
    setTestMessage('');
    try {
      const res = await fetch('/api/auth/test-credential-migration', { method: 'POST' });
      const data = await res.json();
      setTestSteps(data.steps || []);
      setTestMessage(data.message || '');
    } catch (err) {
      setTestMessage('❌ تعذر الاتصال بخادم فحص التحديث والمصادقة للتشغيل.');
    } finally {
      setTestLoading(false);
    }
  };

  // States for advanced log filtering
  const [logActionType, setLogActionType] = useState<'all' | 'add' | 'edit' | 'delete'>('all');
  const [logUserFilter, setLogUserFilter] = useState<string>('all');
  const [logStartDate, setLogStartDate] = useState<string>('');
  const [logEndDate, setLogEndDate] = useState<string>('');
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');

  // Unique users found in activities for the filter dropdown
  const uniqueLogUsers = Array.from(new Set(logs.map(l => l.user))).filter(Boolean);

  // Advanced log filtering logic
  const filteredLogs = logs.filter(log => {
    // 1. Action type filter (إضافة, تعديل, حذف)
    if (logActionType !== 'all') {
      const actionLower = log.action.toLowerCase();
      if (logActionType === 'add' && !(actionLower.includes('إضافة') || actionLower.includes('اضافة') || actionLower.includes('استيراد') || actionLower.includes('إنشاء') || actionLower.includes('انشاء'))) {
        return false;
      }
      if (logActionType === 'edit' && !(actionLower.includes('تعديل') || actionLower.includes('تحديث') || actionLower.includes('تغيير') || actionLower.includes('حفظ') || actionLower.includes('إرجاع') || actionLower.includes('ارجاع') || actionLower.includes('تحويل'))) {
        return false;
      }
      if (logActionType === 'delete' && !(actionLower.includes('حذف') || actionLower.includes('إزالة') || actionLower.includes('ازالة') || actionLower.includes('تفريغ') || actionLower.includes('مسح'))) {
        return false;
      }
    }

    // 2. User filter
    if (logUserFilter !== 'all' && log.user !== logUserFilter) {
      return false;
    }

    // 3. Date range filter
    if (logStartDate) {
      const start = new Date(logStartDate);
      start.setHours(0, 0, 0, 0);
      if (new Date(log.timestamp) < start) return false;
    }
    if (logEndDate) {
      const end = new Date(logEndDate);
      end.setHours(23, 59, 59, 999);
      if (new Date(log.timestamp) > end) return false;
    }

    // 4. Keyword search (action, details, user)
    if (logSearchQuery.trim()) {
      const q = logSearchQuery.toLowerCase().trim();
      const matchAction = log.action.toLowerCase().includes(q);
      const matchDetails = log.details.toLowerCase().includes(q);
      const matchUser = log.user.toLowerCase().includes(q);
      if (!matchAction && !matchDetails && !matchUser) return false;
    }

    return true;
  });

  // Handler for exporting logs to CSV
  const handleExportLogs = () => {
    if (filteredLogs.length === 0) {
      alert("لا توجد سجلات مطابقة لتصديرها");
      return;
    }

    const headers = ['معرف العملية', 'المستخدم المسئول', 'نوع العملية المنجزة', 'نوع الهدف المصنف', 'تاريخ ووقت العملية', 'تفاصيل العملية'];
    const rows = filteredLogs.map(log => [
      log.id,
      log.user,
      log.action,
      log.targetType,
      new Date(log.timestamp).toLocaleString('ar-EG'),
      log.details.replace(/"/g, '""') // Escape double quotes for CSV
    ]);

    const csvContent = "\uFEFF" + [
      headers.join(","),
      ...rows.map(e => e.map(val => `"${val}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.id = "download-audit-logs-csv-btn";
    link.setAttribute("href", url);
    link.setAttribute("download", `سجل_العمليات_الأمني_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Search across users, including checking if card number / chassis matches user linked transactions
  const filteredUsers = users.filter(user => {
    const combinedUserText = `${user.username} ${user.role} ${user.specialty || ''} ${user.phone || ''} ${user.email || ''}`;
    const mainMatch = isGeneralMatchingQuery(combinedUserText, searchTerm);
    if (mainMatch) return true;

    // Check link to matched vehicles (reservedByUserId or sellers)
    const hasQuery = searchTerm.trim().length > 0;
    if (hasQuery) {
      const matchedCars = getUnifiedSearchResults(cars, searchTerm);
      const isLinkedToMatchedCar = matchedCars.some(car => {
        const matchesReservations = car.reservedByUserId && car.reservedByUserId === user.id;
        const matchesSeller = car.exitData?.seller && car.exitData.seller.toLowerCase() === user.username.toLowerCase();
        return matchesReservations || matchesSeller;
      });

      if (isLinkedToMatchedCar) return true;
    }

    return false;
  });

  const openAddModal = () => {
    setEditingUser(null);
    setAlertMessage('');
    setUsername('');
    setPassword('');
    setPhone('');
    setEmail('');
    setSpecialty('');
    setRole(UserRole.EMPLOYEE);
    setSelectedPermissions(ROLE_PERMISSIONS[UserRole.EMPLOYEE]);
    setIsModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setAlertMessage('');
    setUsername(user.username);
    setPassword(''); // Empty representation for editing (meaning 'keep existing')
    setPhone(user.phone || '');
    setEmail(user.email || '');
    setSpecialty(user.specialty || '');
    setRole(user.role);
    setSelectedPermissions(user.permissions || ROLE_PERMISSIONS[user.role] || []);
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertMessage('');
    setActionError('');

    if (!username.trim()) {
      setAlertMessage("يرجى إدخال اسم المستخدم");
      return;
    }
    if (!editingUser && !password.trim()) {
      setAlertMessage("يرجى إدخال كلمة المرور");
      return;
    }

    const exists = users.find(u => 
      u.username.toLowerCase() === username.trim().toLowerCase() && 
      (!editingUser || u.id !== editingUser.id)
    );

    if (exists) {
      setAlertMessage("اسم المستخدم هذا موجود مسبقاً");
      return;
    }

    setIsSavingUser(true);

    // Passwords are sent to the server as plaintext (over HTTPS) so the
    // backend can hash them with Security::hashPassword — hashing on the
    // client first would double-hash and break future logins.
    if (editingUser) {
      const oldUsername = editingUser.username;
      const newUsername = username.trim();

      try {
        await UserApiService.updateUser(editingUser.id, {
          username: newUsername,
          role,
          phone: phone.trim(),
          email: email.trim(),
          specialty: specialty.trim(),
          permissions: selectedPermissions,
          ...(password.trim() ? { password: password.trim() } as any : {})
        });
      } catch (err: any) {
        setActionError(err?.message || 'فشل الخادم في تحديث بيانات المستخدم.');
        setIsSavingUser(false);
        return;
      }

      setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, username: newUsername, role, phone: phone.trim(), email: email.trim(), specialty: specialty.trim(), permissions: selectedPermissions } : u));
      
      // Update currently logged in user if they edited their own profile
      if (currentUser?.id === editingUser.id && setCurrentUser) {
        setCurrentUser({
          ...editingUser,
          username: newUsername,
          role,
          phone: phone.trim(),
          email: email.trim(),
          specialty: specialty.trim(),
          permissions: selectedPermissions
        });
      }

      // Propagate the name change to all cars (as delegates/sellers)
      if (oldUsername !== newUsername && setCars) {
        setCars(prev => prev.map(car => {
          let updated = false;
          let newExitData = car.exitData;
          let newSeller = car.seller;

          if (car.seller === oldUsername) {
            newSeller = newUsername;
            updated = true;
          }

          if (car.exitData) {
            let exitDataUpdated = false;
            let exitSeller = car.exitData.seller;
            let exitRep = car.exitData.representativeName;

            if (car.exitData.seller === oldUsername) {
              exitSeller = newUsername;
              exitDataUpdated = true;
            }
            if (car.exitData.representativeName === oldUsername) {
              exitRep = newUsername;
              exitDataUpdated = true;
            }

            if (exitDataUpdated) {
              newExitData = {
                ...car.exitData,
                seller: exitSeller,
                representativeName: exitRep,
              };
              updated = true;
            }
          }

          if (updated) {
            return {
              ...car,
              seller: newSeller,
              exitData: newExitData,
            };
          }
          return car;
        }));
      }

      addLog('تعديل مستخدم', editingUser.id, 'user', `تم تعديل بيانات المستخدم: ${newUsername} وتحديث الهاتف والبريد والصلاحيات`);
    } else {
      let createdUser: User;
      try {
        createdUser = await UserApiService.createUser({
          username: username.trim(),
          password: password.trim(),
          role: role,
          phone: phone.trim(),
          email: email.trim(),
          specialty: specialty.trim(),
          permissions: selectedPermissions
        });
      } catch (err: any) {
        setActionError(err?.message || 'فشل الخادم في إضافة المستخدم.');
        setIsSavingUser(false);
        return;
      }

      const newUser: User = {
        ...createdUser,
        username: username.trim(),
        role: role,
        phone: phone.trim(),
        email: email.trim(),
        specialty: specialty.trim(),
        permissions: selectedPermissions,
        lastLogin: new Date().toISOString()
      };
      setUsers(prev => [...prev, newUser]);
      addLog('إضافة مستخدم', newUser.id, 'user', `تمت إضافة مستخدم جديد: ${newUser.username} بصلاحيات مخصصة`);
    }

    setIsSavingUser(false);
    setIsModalOpen(false);
  };

  const handleDeleteUser = (userId: string) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;
    
    if (userId === currentUser?.id) {
      alertMessageForGlobal("لا يمكن حذف حسابك الحالي أثناء تسجيل الدخول");
      return;
    }

    if (users.length === 1) {
      alertMessageForGlobal("لا يمكن حذف آخر مستخدم في النظام");
      return;
    }

    setUserToDelete(target);
  };

  const alertMessageForGlobal = (msg: string) => {
    setAlertMessage(msg);
    setIsModalOpen(true); // Open panel to display the warning
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    setActionError('');
    try {
      await UserApiService.deleteUser(userToDelete.id);
    } catch (err: any) {
      setActionError(err?.message || 'فشل الخادم في حذف المستخدم.');
      return;
    }
    setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
    addLog('حذف مستخدم', userToDelete.id, 'user', `تم حذف المستخدم: ${userToDelete.username}`);
    setUserToDelete(null);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-right" dir="rtl">
      {(usersLoadError || usersFetchError || actionError) && (
        <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-400 rounded-2xl p-4 text-sm font-bold">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            {usersLoadError && <p>{usersLoadError}</p>}
            {usersFetchError && <p>{usersFetchError}</p>}
            {actionError && <p>{actionError}</p>}
          </div>
        </div>
      )}
      {/* Tab Switcher at the top of UserAdmin page */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-5 gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-850 dark:text-white flex items-center gap-2">
            <UserCheck className="text-blue-600 dark:text-blue-500 w-7 h-7 font-black" />
            بوابة الصلاحيات والحسابات العامة
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">
            إدارة حسابات الموظفين، تهيئة البيانات الافتراضية، ومطابقة بروتوكولات حماية مدير النظام
          </p>
        </div>
        
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-800/80 shrink-0 select-none">
          <button
            onClick={() => setAdminSubTab('employees')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              adminSubTab === 'employees'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-md border border-slate-200/20 dark:border-slate-700/30 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users size={14} />
            <span>إدارة حسابات الموظفين</span>
          </button>
          
          <button
            onClick={() => setAdminSubTab('system_admin')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              adminSubTab === 'system_admin'
                ? 'bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 shadow-md border border-slate-200/20 dark:border-slate-700/30 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ShieldAlert size={14} />
            <span>مدير النظام والبيانات الافتراضية</span>
          </button>
        </div>
      </div>

      {adminSubTab === 'employees' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Users className="text-blue-600" />
              المستخدمون
            </h2>
            <button 
              onClick={openAddModal}
              className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
              title="إضافة مستخدم جديد"
            >
              <Plus size={20} />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="ابحث بالاسم، الدور، أو التخصص..."
              className="w-full pr-10 pl-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            {filteredUsers.map(user => {
              const isUserAdmin = user.role === UserRole.ADMIN || String(user.role).toUpperCase() === 'ADMIN';
              const isUserDelegate = user.role === UserRole.DELEGATE || String(user.role).toUpperCase() === 'DELEGATE';
              return (
                <div key={user.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm flex items-center justify-between group hover:border-blue-200 dark:hover:border-blue-800 transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shrink-0 ${
                      isUserAdmin ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400' : 
                      isUserDelegate ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' : 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                    }`}>
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-white text-sm">{user.username}</h4>
                      <div className="flex flex-col gap-1 mt-1">
                        <div className="flex items-center gap-1.5">
                          <Shield size={12} className={isUserAdmin ? "text-red-500" : isUserDelegate ? "text-amber-500" : "text-blue-500"} />
                          <span className={`text-[10px] font-black uppercase tracking-tighter ${isUserAdmin ? "text-red-600 dark:text-red-400" : isUserDelegate ? "text-amber-600 dark:text-amber-400" : "text-blue-600 dark:text-blue-400"}`}>
                            {user.role} {user.specialty ? `| ${user.specialty}` : ''}
                          </span>
                        </div>
                        
                        {/* Phone and Email details */}
                        {(user.phone || user.email) && (
                          <div className="space-y-0.5 pt-0.5">
                            {user.phone && (
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                                <Phone size={10} className="text-slate-400 dark:text-slate-500" />
                                <span>{user.phone}</span>
                              </div>
                            )}
                            {user.email && (
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                                <Mail size={10} className="text-slate-400 dark:text-slate-500" />
                                <span className="font-mono text-slate-400 dark:text-slate-500">{user.email}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* طُرق استعادة كلمة المرور النشطة للمستخدم */}
                        <div className="mt-1.5 pt-1.5 border-t border-dashed border-slate-100 dark:border-slate-800 space-y-1 text-right">
                          <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 block">وسائل الاسترداد المتوفرة:</span>
                          <div className="flex flex-wrap gap-1">
                            <span 
                              className={`text-[8.5px] px-1.5 py-0.5 rounded font-bold transition-all ${
                                user.email 
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                                  : 'bg-slate-500/10 text-slate-400 dark:text-slate-500 border border-transparent'
                              }`}
                              title={user.email ? 'البريد للإرسال متاح ومكتمل' : 'البريد غير مدخل لتعميده'}
                            >
                              البريد {user.email ? '✓' : '✗'}
                            </span>
                            <span 
                              className={`text-[8.5px] px-1.5 py-0.5 rounded font-bold transition-all ${
                                user.securityQuestions && user.securityQuestions.length > 0 
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                                  : 'bg-slate-500/10 text-slate-400 dark:text-slate-500 border border-transparent'
                              }`}
                              title={user.securityQuestions && user.securityQuestions.length > 0 ? 'الأسئلة السرية مفعلة' : 'الأسئلة السرية غير مضبوطة'}
                            >
                              الأسئلة {user.securityQuestions && user.securityQuestions.length > 0 ? '✓' : '✗'}
                            </span>
                            <span 
                              className={`text-[8.5px] px-1.5 py-0.5 rounded font-bold transition-all ${
                                user.recoveryCodeHash 
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                                  : 'bg-slate-500/10 text-slate-400 dark:text-slate-500 border border-transparent'
                              }`}
                              title={user.recoveryCodeHash ? 'كود المفتاح وملف الاسترداد جاهز' : 'ينشط تلقائياً مع تفعيل أسئلة الحماية'}
                            >
                              كود ومفتاح {user.recoveryCodeHash ? '✓' : '✗'}
                            </span>
                            <span className="text-[8.5px] px-1.5 py-0.5 rounded font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 cursor-help" title="تجاوز الأدمن من لوحة الاسترداد بموجب كلمة مرور المشرف">
                              مدير النظام ✓
                            </span>
                          </div>
                        </div>

                        {user.lastLogin && (
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium pt-1 border-t border-slate-100 dark:border-slate-800/80 block">
                            آخر دخول: {new Date(user.lastLogin).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 opacity-15 group-hover:opacity-100 transition-all">
                    <button 
                      onClick={() => openEditModal(user)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-all"
                      title="تعديل المستخدم"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDeleteUser(user.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-all"
                      title="حذف المستخدم"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {/* مركز تشخيص وأمن الحسابات الاستباقي للتحقق الفوري */}
          <div className="bg-slate-900 text-white p-6 rounded-[2rem] border border-slate-800 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                  <ShieldAlert size={24} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="font-bold text-base">مركز تشخيص وأمن الحسابات الاستباقي (مستمر)</h3>
                  <p className="text-slate-400 text-xs font-semibold">فحص ومطابقة وتأمين بروتوكولات المصادقة ومزامنة الحسابات الأمنية</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowDiagPanel(!showDiagPanel);
                  if(!showDiagPanel) {
                    runDatabaseDiagnostics();
                    runAutomatedCredentialsTest();
                  }
                }}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-indigo-600/20 active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <span>{showDiagPanel ? 'إغلاق مركز التشخيص' : 'إطلاق مركز الأمان والتشخيص'}</span>
              </button>
            </div>

            {showDiagPanel && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-800 animate-in fade-in duration-300">
                {/* 1. Database Diagnostics */}
                <div className="space-y-4 bg-slate-950/70 p-5 rounded-2xl border border-slate-800">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-200">1. تشخيص حسابات قاعدة البيانات والملفات الأمنية</h4>
                    <button
                      type="button"
                      disabled={diagLoading}
                      onClick={runDatabaseDiagnostics}
                      className="text-[10px] text-blue-400 hover:text-blue-300 font-extrabold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <span>تحديث الفحص</span>
                    </button>
                  </div>

                  {diagLoading ? (
                    <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold py-4">
                      <span className="w-4 h-4 border-2 border-slate-600 border-t-indigo-400 rounded-full animate-spin"></span>
                      <span>جاري فحص وتدقيق الحسابات الأمنية...</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {diagSummary && (
                        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs font-black text-slate-300 text-right" dir="rtl">
                          {diagSummary}
                        </div>
                      )}
                      
                      <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 custom-scrollbar text-right" dir="rtl">
                        {diagReports.map((r) => (
                          <div key={r.id} className="p-2.5 bg-slate-900/50 border border-slate-850 rounded-xl text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-slate-300">{r.username} ({r.role})</span>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                                r.status === 'SECURE' ? 'bg-emerald-500/15 text-emerald-400' :
                                r.status === 'WARNING' ? 'bg-amber-400/15 text-amber-400' : 'bg-rose-500/15 text-rose-400'
                              }`}>
                                {r.status === 'SECURE' ? 'آمن ومتزامن' : r.status === 'WARNING' ? 'تنبيه' : 'بيانات قديمة تم الكشف عنها!'}
                              </span>
                            </div>
                            {r.issues && r.issues.length > 0 ? (
                              <ul className="text-[10px] text-slate-400 list-disc list-inside space-y-0.5 pt-1 border-t border-slate-800/40">
                                {r.issues.map((issue: string, idx: number) => (
                                  <li key={idx} className="font-bold">{issue}</li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-[10px] text-emerald-500 block font-bold">✓ متطابق تماماً بنسبة 100% مع مصدر الحقيقة الأمني.</span>
                            )}
                          </div>
                        ))}
                      </div>

                      {diagReports.some((r) => r.status === 'STALE') && (
                        <button
                          type="button"
                          disabled={diagFixLoading}
                          onClick={applyDiagnosticsFixes}
                          className="w-full mt-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all cursor-pointer"
                        >
                          {diagFixLoading ? 'جاري الإصلاح والمزامنة...' : 'مزامنة وتطهير البيانات القديمة فوراً'}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Automated Migration Test Verification */}
                <div className="space-y-4 bg-slate-950/70 p-5 rounded-2xl border border-slate-800">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-200">2. بروتوكول فحص ومطابقة التحديث المباشر</h4>
                    <button
                      type="button"
                      disabled={testLoading}
                      onClick={runAutomatedCredentialsTest}
                      className="text-[10px] text-blue-400 hover:text-blue-300 font-extrabold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <span>تشغيل الفحص الآلي</span>
                    </button>
                  </div>

                  {testLoading ? (
                    <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold py-4">
                      <span className="w-4 h-4 border-2 border-slate-600 border-t-indigo-400 rounded-full animate-spin"></span>
                      <span>جاري تشغيل محاكاة الاختبار التلقائي السحابي...</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {testMessage && (
                        <div className={`p-3 rounded-xl text-xs font-black text-right ${
                          testMessage.includes('✅') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`} dir="rtl">
                          {testMessage}
                        </div>
                      )}

                      <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1 text-right" dir="rtl">
                        {testSteps.map((step, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-slate-900/40 rounded-xl border border-slate-850 text-[11px]">
                            <span className="text-slate-300 font-semibold">{step.desc}</span>
                            <span className={`text-[10px] font-black ${step.passed ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {step.passed ? '✓ نجاح الفحص' : '✗ فشل الفحص'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-white">
              <Activity className="text-indigo-600 animate-pulse" />
              سجل النشاطات الكامل والتدقيق الأمني
            </h2>
          </div>

          {/* Advanced Audit Log Filters Dashboard */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center gap-2 text-sm font-black text-slate-700 dark:text-slate-300">
                <Filter size={16} className="text-indigo-500" />
                <span>خيارات التصفية والبحث المتقدم</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportLogs}
                  className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                  title="تصدير السجل المصفى حالياً إلى ملف CSV"
                >
                  <Download size={14} />
                  <span>تصدير السجل ({filteredLogs.length})</span>
                </button>
                {(logActionType !== 'all' || logUserFilter !== 'all' || logStartDate || logEndDate || logSearchQuery) && (
                  <button
                    type="button"
                    onClick={() => {
                      setLogActionType('all');
                      setLogUserFilter('all');
                      setLogStartDate('');
                      setLogEndDate('');
                      setLogSearchQuery('');
                    }}
                    className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs transition-all flex items-center gap-1"
                    title="إعادة تعيين كافة الفلاتر"
                  >
                    <RotateCcw size={12} />
                    <span>إعادة تعيين</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {/* Keyword Direct Search */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">بحث نصي مباشر</label>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    type="text"
                    placeholder="ابحث بالعملية أو التفاصيل..."
                    className="w-full pr-9 pl-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 text-slate-900 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-xs font-semibold placeholder:text-slate-400"
                    value={logSearchQuery}
                    onChange={(e) => setLogSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* Action Category Type */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">نوع العملية (تصنيف)</label>
                <select
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 text-slate-900 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-xs font-semibold cursor-pointer"
                  value={logActionType}
                  onChange={(e) => setLogActionType(e.target.value as any)}
                >
                  <option value="all">كل العمليات (الكل)</option>
                  <option value="add">إضافة (إضافة / استيراد / إنشاء)</option>
                  <option value="edit">تعديل (تعديل / تحديث / تغيير)</option>
                  <option value="delete">حذف (حذف / إزالة / إفراغ)</option>
                </select>
              </div>

              {/* User Selector Dropdown */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">المستخدم المسؤول</label>
                <select
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 text-slate-900 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-xs font-semibold cursor-pointer"
                  value={logUserFilter}
                  onChange={(e) => setLogUserFilter(e.target.value)}
                >
                  <option value="all">كل المستخدمين</option>
                  {uniqueLogUsers.map(uname => (
                    <option key={uname} value={uname}>{uname}</option>
                  ))}
                </select>
              </div>

              {/* Date Start & Date End Inputs */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">الفترة الزمنية</label>
                <div className="flex gap-1.5">
                  <div className="relative w-1/2">
                    <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={10} />
                    <input
                      type="date"
                      className="w-full pr-5 pl-1 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 text-slate-900 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-[10px] font-semibold"
                      value={logStartDate}
                      title="تاريخ البدء"
                      onChange={(e) => setLogStartDate(e.target.value)}
                    />
                  </div>
                  <div className="relative w-1/2">
                    <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={10} />
                    <input
                      type="date"
                      className="w-full pr-5 pl-1 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 text-slate-900 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-[10px] font-semibold"
                      value={logEndDate}
                      title="تاريخ الانتهاء"
                      onChange={(e) => setLogEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden text-slate-900 dark:text-white">
            <div className="max-h-[600px] overflow-y-auto">
              <div className="overflow-x-auto custom-scrollbar w-full">
              <table className="w-full text-right">
                <thead className="bg-slate-50 dark:bg-slate-950 sticky top-0 z-10">
                  <tr className="border-b border-slate-100 dark:border-slate-800/80">
                    <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">المستخدم</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">العملية</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">التفاصيل</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">الوقت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-sm font-bold text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-950/20">
                        لا توجد عمليات مطابقة لخيارات الفلترة والتصفية والبحث المحددة
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map(log => {
                      const isDelete = log.action.toLowerCase().includes('حذف') || log.action.toLowerCase().includes('إزالة');
                      const isAdd = log.action.toLowerCase().includes('إضافة') || log.action.toLowerCase().includes('اضافة');
                      const isEdit = log.action.toLowerCase().includes('تعديل') || log.action.toLowerCase().includes('تحديث');

                      return (
                        <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-950/50 transition-colors group">
                          <td className="px-6 py-4">
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{log.user}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-[10px] px-2.5 py-1 rounded-lg font-black uppercase ${
                              isDelete ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-450' : 
                              isAdd ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-450' : 
                              isEdit ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-450' : 
                              'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                            }`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{log.details}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                              {new Date(log.timestamp).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        </div>
      </div>
      ) : (
        /* System Admin portal tab renders when adminSubTab === 'system_admin' */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-300">
          <div className="lg:col-span-2 space-y-6">
            {/* Administrators Quick Selection Grid */}
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800/85 p-6 md:p-8 shadow-xl space-y-4 text-right">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/60">
                <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-650 dark:text-blue-400 rounded-xl border border-blue-100 dark:border-blue-900/30">
                  <Shield size={20} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-850 dark:text-white">قائمة مدراء النظام الموجودين فعلياً في قاعدة البيانات</h3>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">اختر أي مسؤول من القائمة الحقيقية لعرض بياناته بالكامل وتحديثها بشكل فوري</p>
                </div>
              </div>

              {adminUsers.length === 0 ? (
                <p className="text-xs text-rose-500 font-bold">لا يوجد أي مدراء نظام مسجلين حالياً في قاعدة البيانات!</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  {adminUsers.map((admin) => {
                    const isSelected = selectedAdminId === admin.id;
                    const isPrimary = admin.primaryAdmin === 1 || admin.primaryAdmin === true;
                    return (
                      <button
                        key={admin.id}
                        type="button"
                        onClick={() => setSelectedAdminId(admin.id)}
                        className={`p-4 rounded-2xl border text-right transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'border-red-500 bg-red-50/15 dark:bg-red-950/20 shadow-md ring-2 ring-red-100 dark:ring-red-900/10'
                            : 'border-slate-150 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl shrink-0 ${isSelected ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                            <Users size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 dark:text-white text-sm truncate">{admin.fullName || admin.username}</p>
                            <p className="text-[10px] text-slate-400 font-semibold truncate">@{admin.username} • {isPrimary ? 'مدير أساسي' : 'مدير نظام فرعي'}</p>
                          </div>
                        </div>
                        <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[10px] text-slate-500 flex justify-between items-center w-full font-sans">
                          <span className="truncate">{admin.phone || 'بدون هاتف مسجل'}</span>
                          <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[9px] shrink-0 font-bold text-slate-500">{admin.id}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Editing Form */}
            <form onSubmit={handleUpdateSystemAdmin} className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800/85 p-6 md:p-8 shadow-xl space-y-6 text-right">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800/60">
                <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-650 dark:text-red-400 rounded-2xl border border-red-100 dark:border-red-900/30">
                  <ShieldAlert size={24} />
                </div>
                <div>
                  <h3 className="font-black text-lg text-slate-850 dark:text-white font-sans">تهيئـة وتعديل بيانات حساب المدير المحدد</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold mt-0.5">تعديل فوري ومباشر لبيانات حساب المسؤول [معرف المستخدم: {selectedAdminId}] وتزامنها مع كافة السجلات الحقيقية</p>
                </div>
              </div>

              {adminSuccessMsg && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-400 rounded-2xl flex items-center gap-3 text-xs font-black">
                  <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
                  <span>{adminSuccessMsg}</span>
                </div>
              )}

              {adminErrorMsg && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-450 rounded-2xl flex items-center gap-3 text-xs font-black">
                  <ShieldAlert size={18} className="shrink-0 text-rose-600" />
                  <span>{adminErrorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-650 dark:text-slate-400 mr-1 block">اسم مستخدم الدخول</label>
                  <div className="relative group">
                    <Users className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-500 transition-colors" size={18} />
                    <input 
                      type="text" 
                      required
                      placeholder="اسم مستخدم الدخول لمدير النظام..."
                      className="w-full pr-12 pl-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:ring-4 focus:ring-red-100 dark:focus:ring-red-950/30 focus:border-red-500 transition-all font-black text-slate-800 dark:text-white"
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold mr-1">هذا هو اسم الحساب الحقيقي لولوج المسؤول للمنظومة.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-650 dark:text-slate-400 mr-1 block">الاسم الكامل للمسؤول</label>
                  <div className="relative group">
                    <UserCheck className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-500 transition-colors" size={18} />
                    <input 
                      type="text" 
                      required
                      placeholder="ادخل الاسم الكامل للمسؤول..."
                      className="w-full pr-12 pl-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:ring-4 focus:ring-red-100 dark:focus:ring-red-950/30 focus:border-red-500 transition-all font-black text-slate-800 dark:text-white font-sans"
                      value={adminFullName}
                      onChange={(e) => setAdminFullName(e.target.value)}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold mr-1">يُعرض في ترويسة الصفحة الشخصية والتقارير المعتمدة بالمبيعات.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-650 dark:text-slate-400 mr-1 block">كلمة المرور الجديدة</label>
                  <div className="relative group">
                    <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-500 transition-colors" size={18} />
                    <input 
                      type="text" 
                      placeholder="اتركها فارغة لإبقاء كلمة المرور الحالية..."
                      className="w-full pr-12 pl-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:ring-4 focus:ring-red-100 dark:focus:ring-red-950/30 focus:border-red-500 transition-all font-black text-slate-800 dark:text-white"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold mr-1">يمكن تعديل مرمز الدخول لمديـر النظام لمنع التدفقات والعشوائيات.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-650 dark:text-slate-400 mr-1 block">رقم جوال مدير النظام</label>
                  <div className="relative group">
                    <Phone className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-500 transition-colors" size={18} />
                    <input 
                      type="text" 
                      placeholder="رقم الهاتف الفعلي للتواصل والطباعة..."
                      className="w-full pr-12 pl-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:ring-4 focus:ring-red-100 dark:focus:ring-red-950/30 focus:border-red-500 transition-all font-black text-slate-800 dark:text-white text-right font-sans"
                      value={adminPhone}
                      onChange={(e) => setAdminPhone(e.target.value)}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold mr-1">يُعتمد في تذييل كشوف الحساب السنوية والفواتير الرسمية.</p>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-black text-slate-650 dark:text-slate-400 mr-1 block">البريد الإلكتروني المعتمد للمراسلات</label>
                  <div className="relative group">
                    <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-500 transition-colors" size={18} />
                    <input 
                      type="text" 
                      placeholder="بريد الحساب الفعلي الموجه إليه الإشعارات..."
                      className="w-full pr-12 pl-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-2xl outline-none focus:ring-4 focus:ring-red-100 dark:focus:ring-red-950/30 focus:border-red-500 transition-all font-black text-slate-800 dark:text-white"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold mr-1">ترسل إليه التقارير السنوية وإشعارات الأمان التلقائية.</p>
                </div>
              </div>

              {/* Administrative Permissions Configuration Block */}
              <div className="space-y-3 pt-6 border-t border-slate-100 dark:border-slate-800/60">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 mr-1 block font-sans">الصلاحيات والامتيازات النشطة للحساب الإداري</label>
                <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                  بصفتك مديراً للنظام، تتمتع بكافة الصلاحيات بشكل تلقائي. يمكنك تعطيل أو تمكين صلاحيات معينة لهذا الحساب لتعديل وتدقيق سلوك تداوله داخل التطوير:
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                  {Object.values(Permission).map((perm) => {
                    const isChecked = adminPermissions.includes(perm);
                    return (
                      <label key={perm} className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800/80 bg-slate-50/45 dark:bg-slate-950/20 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-950/40 transition-all select-none">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-slate-350 dark:border-slate-700 text-red-650 focus:ring-red-500 checked:bg-red-600"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAdminPermissions(prev => [...prev, perm]);
                            } else {
                              setAdminPermissions(prev => prev.filter(p => p !== perm));
                            }
                          }}
                        />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{perm}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isAdminSaving}
                  className="w-full md:w-auto px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl shadow-xl shadow-red-150 dark:shadow-none transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-xs"
                >
                  <Save size={18} />
                  <span>{isAdminSaving ? 'جاري مزامنة وتأمين البيانات لمدير النظام...' : 'حفظ وتطبيق تغييرات مدير النظام الشاملة'}</span>
                </button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-900 text-white p-6 rounded-[2rem] border border-slate-800 shadow-xl space-y-6 text-right">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center border border-red-500/20">
                  <LockKeyhole size={24} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="font-bold text-base">بروتوكول تفشي أذونات المشرف</h3>
                  <p className="text-slate-400 text-[10px] font-semibold">ضمان التطابق الشامل لعدم حدوث أي تعارض بالبيانات</p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 space-y-5 text-slate-300 text-xs font-semibold leading-relaxed">
                <p>
                  عند تعديل بيانات أو اسم دخول <strong className="text-red-400">مدير النظام</strong> الافتراضي، يتم تدويل وجدول هذا الأثر تلقائياً ليشمل:
                </p>

                <div className="space-y-3.5 pr-2 border-r-2 border-red-500/20">
                  <div className="flex gap-2">
                    <span className="text-red-400">❶</span>
                    <div>
                      <h4 className="font-black text-slate-200">الربط الآلي للمخازن والمعرض:</h4>
                      <p className="text-slate-400 text-[10px] mt-0.5">تعديل كافة حقول المسؤولين والبائعين ومندوبي جلب السيارات في الجرد بما يطابق الاسم الجديد.</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <span className="text-red-400">❷</span>
                    <div>
                      <h4 className="font-black text-slate-200">صلاحيات الجلسة النشطة:</h4>
                      <p className="text-slate-400 text-[10px] mt-0.5">إعادة التثبيت اللحظي لبيانات الجلسة للمتصفح الحالي لعدم إسقاط صلاحيات المشرف أو حدوث تعارض بالمسارات.</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <span className="text-red-400">❸</span>
                    <div>
                      <h4 className="font-black text-slate-200">سجل النشاط وسجلات الصادر:</h4>
                      <p className="text-slate-400 text-[10px] mt-0.5">مزامنة سجل تتبع العمليات مع الاسم المعدل لدقة تدقيق الحسابات التاريخي.</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-2xl text-[10.5px] leading-relaxed text-slate-400 animate-pulse">
                  📌 <strong className="text-slate-200 font-bold">نصيحة أمنية:</strong> يُنصح بتغيير اسم الدخول الافتراضي ومفتاح المرور دورياً لحفظ المعايير المحاسبية والمخزنية المتكاملة للمؤسسة.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300 overflow-y-auto overscroll-contain touch-pan-y" dir="rtl">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md md:max-w-lg rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh] sm:max-h-[88vh] my-auto">
            <div className="flex items-center justify-between p-4 sm:p-5 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-850 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-100 dark:bg-blue-950/45 text-blue-600 dark:text-blue-400 rounded-xl">
                  {editingUser ? <Edit3 size={18} /> : <UserPlus size={18} />}
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white tracking-tight">
                  {editingUser ? 'تعديل بيانات المستخدم' : 'إضافة مستخدم جديد'}
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-350 p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSaveUser} className="p-4 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1 text-right">
              
              {alertMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:border-rose-900 dark:text-rose-450 rounded-xl flex items-center gap-2 text-xs font-bold">
                  <ShieldAlert size={16} className="shrink-0 text-rose-600" />
                  <span>{alertMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mr-1">اسم المستخدم</label>
                  <div className="relative group">
                    <Users className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={16} />
                    <input 
                      type="text" 
                      required
                      placeholder="أدخل اسم المستخدم..."
                      className="w-full pr-10 pl-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-500 dark:focus:border-blue-500 transition-all font-bold text-xs sm:text-sm text-slate-850 dark:text-white"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mr-1">كلمة المرور</label>
                  <div className="relative group">
                    <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={16} />
                    <input 
                      type="text" 
                      required={!editingUser}
                      placeholder={editingUser ? "اتركها فارغة للتخطي..." : "أدخل كلمة المرور..."}
                      className="w-full pr-10 pl-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-500 dark:focus:border-blue-500 transition-all font-bold text-right text-xs sm:text-sm text-slate-850 dark:text-white"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mr-1">التخصص / القسم</label>
                <div className="relative group">
                  <Briefcase className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={16} />
                  <input 
                    type="text" 
                    placeholder="مثال: مبيعات، صيانة، مدير صالة..."
                    className="w-full pr-10 pl-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-500 dark:focus:border-blue-500 transition-all font-bold text-xs sm:text-sm text-slate-850 dark:text-white"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mr-1">رقم الهاتف</label>
                  <div className="relative group">
                    <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={16} />
                    <input 
                      type="tel" 
                      placeholder="05XXXXXXXX"
                      className="w-full pr-10 pl-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-500 dark:focus:border-blue-500 transition-all font-bold text-right font-mono text-xs sm:text-sm text-slate-850 dark:text-white"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mr-1">البريد الإلكتروني</label>
                  <div className="relative group">
                    <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={16} />
                    <input 
                      type="email" 
                      placeholder="user@example.com"
                      className="w-full pr-10 pl-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-500 dark:focus:border-blue-500 transition-all font-bold text-right font-mono text-xs sm:text-sm text-slate-850 dark:text-white"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mr-1">صلاحية النظام</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <RoleButton currentRole={role} targetRole={UserRole.EMPLOYEE} label="موظف" icon={Shield} color="blue" onClick={(r) => { setRole(r); setSelectedPermissions(ROLE_PERMISSIONS[r]); }} />
                  <RoleButton currentRole={role} targetRole={UserRole.ADMIN} label="مدير" icon={ShieldAlert} color="red" onClick={(r) => { setRole(r); setSelectedPermissions(ROLE_PERMISSIONS[r]); }} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mr-1">الأذونات التفصيلية</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800 max-h-40 overflow-y-auto custom-scrollbar">
                  {Object.values(Permission).map((perm) => (
                    <label key={perm} className="flex items-center gap-2 cursor-pointer group p-1 hover:bg-white dark:hover:bg-slate-900 rounded-lg transition-colors">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 shrink-0"
                        checked={selectedPermissions.includes(perm)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPermissions(prev => [...prev, perm]);
                          } else {
                            setSelectedPermissions(prev => prev.filter(p => p !== perm));
                          }
                        }}
                      />
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-350 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {getPermissionLabel(perm)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button type="submit" disabled={isSavingUser} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] text-xs sm:text-sm cursor-pointer">
                  {isSavingUser ? 'جارِ الحفظ...' : (editingUser ? 'حفظ التعديلات' : 'تأكيد الإضافة')}
                </button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-xs sm:text-sm cursor-pointer">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {userToDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300 overflow-y-auto overscroll-contain" dir="rtl">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200 my-auto">
            <div className="p-5 sm:p-8 space-y-5 text-center">
              <div className="mx-auto w-12 h-12 sm:w-14 sm:h-14 bg-red-100 dark:bg-red-950/45 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center">
                <Trash2 size={24} className="sm:w-7 sm:h-7" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-lg sm:text-xl font-black text-slate-850 dark:text-white">تأكيد حذف المستخدم</h3>
                <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 font-bold leading-relaxed px-2">
                  هل أنت متأكد تماماً من رغبتك في حذف الحساب التابع للمستخدم <strong className="text-slate-800 dark:text-slate-100">"{userToDelete.username}"</strong>؟ سيتم إلغاء وصوله الفوري للمنظومة بالكامل.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={confirmDeleteUser}
                  className="w-full py-3 bg-red-600 text-white font-black rounded-xl shadow-lg shadow-red-500/10 hover:bg-red-700 transition-all cursor-pointer text-xs sm:text-sm"
                >
                  نعم، احذف الحساب
                </button>
                <button 
                  onClick={() => setUserToDelete(null)}
                  className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-black rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer text-xs sm:text-sm"
                >
                  تراجع
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const getPermissionLabel = (perm: Permission): string => {
  const labels: Record<Permission, string> = {
    [Permission.VIEW_DASHBOARD]: 'عرض لوحة التحكم',
    [Permission.MANAGE_INVENTORY]: 'إدارة المخزون',
    [Permission.VIEW_REPORTS]: 'عرض التقارير',
    [Permission.MANAGE_USERS]: 'إدارة المستخدمين',
    [Permission.MANAGE_SETTINGS]: 'إدارة الإعدادات',
    [Permission.MANAGE_BACKUP]: 'إدارة النسخ الاحتياطي',
    [Permission.VIEW_FINANCIALS]: 'عرض البيانات المالية',
    [Permission.EXPORT_DATA]: 'تصدير البيانات',
    [Permission.VIEW_SALES]: 'عرض المبيعات',
  };
  return labels[perm] || perm;
};

const RoleButton: React.FC<{ currentRole: UserRole, targetRole: UserRole, label: string, icon: any, color: string, onClick: (r: UserRole) => void }> = ({ currentRole, targetRole, label, icon: Icon, color, onClick }) => {
  const isActive = currentRole === targetRole;
  const colorStyles: any = {
    blue: isActive 
      ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:border-blue-500 dark:text-blue-400 font-extrabold' 
      : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900',
    amber: isActive 
      ? 'border-amber-600 bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:border-amber-500 dark:text-amber-400 font-extrabold' 
      : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900',
    red: isActive 
      ? 'border-red-600 bg-red-50 text-red-700 dark:bg-red-950/50 dark:border-red-500 dark:text-red-400 font-extrabold' 
      : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900',
  };

  return (
    <button
      type="button"
      onClick={() => onClick(targetRole)}
      className={`flex items-center justify-center gap-2 p-2.5 sm:p-3 rounded-xl border-2 transition-all cursor-pointer ${colorStyles[color]}`}
    >
      <Icon size={18} />
      <span className="text-xs font-black">{label}</span>
    </button>
  );
};

export default UserAdmin;
