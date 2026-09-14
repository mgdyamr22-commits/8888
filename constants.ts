
import { Car, CarStatus, OwnershipType, RentalStatus, User, UserRole, Permission, OrganizationSettings, DashboardPreferences, DeliveryType, StatusColorsConfig } from './types';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: Object.values(Permission),
  [UserRole.EMPLOYEE]: [
    Permission.VIEW_DASHBOARD,
    Permission.MANAGE_INVENTORY,
    Permission.VIEW_REPORTS,
    Permission.VIEW_SALES
  ],
  [UserRole.DELEGATE]: [
    Permission.VIEW_DASHBOARD,
    Permission.MANAGE_INVENTORY,
    Permission.VIEW_SALES
  ]
};

export const INITIAL_CARS: Car[] = [
  {
    id: 'car-sample-1',
    brand: 'تويوتا',
    model: 'لاندكروزر',
    year: 2024,
    color: 'أبيض لؤلؤي',
    interiorColor: 'بيج',
    vin: 'JTEBU71J805123456',
    vinMatching: 'مطابق',
    cardNumber: 'CARD-2024-901',
    price: 325000,
    costPrice: 298000,
    supplier: 'شركة عبداللطيف جميل',
    ownershipType: OwnershipType.DIRECT,
    status: CarStatus.AVAILABLE,
    rentalStatus: RentalStatus.NOT_RENTED,
    entryDate: '2026-08-01',
    lastModified: '2026-08-10',
    history: [
      { id: 'h1', action: 'إضافة للمخزون الفعلي بالصالة', timestamp: '2026-08-01 10:00', user: 'مدير النظام' }
    ],
    isOutbound: false,
    hasPlate: true,
    plateData: {
      plateNumber: 'أ ب ج 1234',
      ownerName: 'معرض الفرسان للسيارات',
      serialNumber: 'SR-884021',
      issueDate: '2026-08-01'
    },
    isPresentInShowroom: true,
    notes: 'سيارة جديدة متوفرة بالصالة الرئيسية جاهزة للتسليم'
  },
  {
    id: 'car-sample-2',
    brand: 'لكزس',
    model: 'LX600',
    year: 2024,
    color: 'أسود ميتاليك',
    interiorColor: 'جملي',
    vin: 'JTJHY7AX302987654',
    vinMatching: 'مطابق',
    cardNumber: 'CARD-2024-902',
    price: 540000,
    costPrice: 495000,
    supplier: 'شركة الفطيم للسيارات',
    ownershipType: OwnershipType.DIRECT,
    status: CarStatus.RESERVED,
    rentalStatus: RentalStatus.NOT_RENTED,
    entryDate: '2026-08-02',
    lastModified: '2026-08-11',
    history: [
      { id: 'h2', action: 'حجز المركبة للعميل', timestamp: '2026-08-11 14:30', user: 'أحمد المبيعات' }
    ],
    reservedByUserId: 'u2',
    attributionSource: 'معرض الشفا',
    reservationDate: '2026-08-11',
    isOutbound: false,
    hasPlate: false,
    isPresentInShowroom: true,
    notes: 'محجوزة بدفع عربون - انتظار استكمال الإجراءات البنكية'
  },
  {
    id: 'car-sample-3',
    brand: 'هونداي',
    model: 'أكسنت',
    year: 2025,
    color: 'فضي',
    interiorColor: 'رمادي',
    vin: 'KMHD84LF2RU112233',
    vinMatching: 'مطابق',
    cardNumber: 'CARD-2025-103',
    price: 68000,
    costPrice: 61500,
    supplier: 'شركة الوعلان للسيارات',
    ownershipType: OwnershipType.DISTRIBUTION,
    status: CarStatus.SOLD,
    rentalStatus: RentalStatus.NOT_RENTED,
    entryDate: '2026-08-03',
    lastModified: '2026-08-12',
    history: [
      { id: 'h3', action: 'إصدار تصريح خروج وبيع', timestamp: '2026-08-12 11:15', user: 'مدير النظام' }
    ],
    isOutbound: true,
    exitData: {
      receiverName: 'سليمان خالد العتيبي',
      receiverPhone: '0551122334',
      receiverId: '1088776655',
      nationality: 'سعودي',
      deliveryType: DeliveryType.OWNER,
      exitDate: '2026-08-12',
      seller: 'محمد عبد الله',
      saleType: 'كاش',
      notes: 'تم التسليم وسند القبط جاهز'
    },
    hasPlate: true,
    plateData: {
      plateNumber: 'ر س ط 5544',
      ownerName: 'سليمان خالد العتيبي',
      serialNumber: 'SR-991200',
      issueDate: '2026-08-12'
    },
    isPresentInShowroom: false,
    notes: 'تم البيع والتسليم النهائي'
  },
  {
    id: 'car-sample-4',
    brand: 'نيسان',
    model: 'باترول',
    year: 2024,
    color: 'رمادي رمادي',
    interiorColor: 'أسود',
    vin: 'JN8AY2NC401556677',
    vinMatching: 'مطابق',
    cardNumber: 'CARD-2024-904',
    price: 295000,
    costPrice: 272000,
    supplier: 'شركة بترومين للسيارات',
    ownershipType: OwnershipType.DIRECT,
    status: CarStatus.IN_TRANSFER,
    rentalStatus: RentalStatus.NOT_RENTED,
    entryDate: '2026-08-05',
    lastModified: '2026-08-12',
    history: [
      { id: 'h4', action: 'إصدار خطاب تحويل صادر رقم TR-2026-1001', timestamp: '2026-08-12 09:00', user: 'مدير النظام' }
    ],
    isOutbound: false,
    hasPlate: false,
    isPresentInShowroom: false,
    notes: 'تحويل صادر برقم TR-2026-1001 إلى شركة سما الفرسان'
  },
  {
    id: 'car-sample-5',
    brand: 'فورد',
    model: 'توروس',
    year: 2025,
    color: 'كحلي ميتاليك',
    interiorColor: 'أوف وايت',
    vin: '1FA6P8CF5R5334455',
    vinMatching: 'مطابق',
    cardNumber: 'CARD-2025-105',
    price: 138000,
    costPrice: 124000,
    supplier: 'شركة توكيلات الجزيرة',
    ownershipType: OwnershipType.DIRECT,
    status: CarStatus.AVAILABLE,
    rentalStatus: RentalStatus.NOT_RENTED,
    entryDate: '2026-08-08',
    lastModified: '2026-08-08',
    history: [
      { id: 'h5', action: 'إضافة للمخزون الفعلي بالصالة', timestamp: '2026-08-08 16:20', user: 'مدير النظام' }
    ],
    isOutbound: false,
    hasPlate: false,
    isPresentInShowroom: true,
    notes: 'جاهزة بالصالة - مواصفات سعودية كاملة'
  }
];

export const INITIAL_USERS: User[] = [
  { id: 'u1', username: 'admin', password: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', role: UserRole.ADMIN, phone: '0501234567', email: 'admin@alforsancar.com', permissions: ROLE_PERMISSIONS[UserRole.ADMIN] },
  { id: 'u2', username: 'user', password: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', role: UserRole.EMPLOYEE, phone: '0507654321', email: 'user@alforsancar.com', permissions: ROLE_PERMISSIONS[UserRole.EMPLOYEE] }
];

export const DEFAULT_DASHBOARD_PREFS: DashboardPreferences = {
  showInventoryStats: true,
  showFinancialStats: true,
  showRentalStats: true,
  showInventoryList: true,
  showBrandChart: true,
  showStatusPie: true,
  showRecentActivity: true,
  showQuickActions: true,
  showMarketTrends: true,
  widgetOrder: [
    'securityStatus',
    'quickActions',
    'inventoryStats',
    'marketTrends',
    'financialStats',
    'rentalStats',
    'inventoryList',
    'brandChart',
    'statusPie',
    'recentActivity'
  ]
};

export const DEFAULT_STATUS_COLORS: StatusColorsConfig = {
  availableBg: '#e2e8f0',
  availableText: '#0f172a',
  reservedBg: '#D4AF37',
  reservedText: '#000000',
  soldBg: '#8B0000',
  soldText: '#FFFFFF',
  notForSaleBg: '#991B1B',
  notForSaleText: '#FFFFFF',
  returnedBg: '#F97316',
  returnedText: '#FFFFFF',
  notArrivedBg: '#9333EA',
  notArrivedText: '#FFFFFF',
  mismatchBg: '#CC0000',
  mismatchText: '#FFFFFF',
  notRentedBg: '#1F4E79',
  notRentedText: '#FFFFFF',
};

export const INITIAL_SETTINGS: OrganizationSettings = {
  name: 'مخزوني',
  nameEn: 'MAKHOUNI CARS',
  orgType: 'مؤسسة',
  orgTypeEn: 'Establishment',
  activityEn: 'Cars Exhibition & Trading',
  logoUrl: '',
  logoWidth: 120,
  logoPosX: 0,
  logoPosY: 0,
  stampUrl: '',
  description: 'منظومة متطورة للتحكم المخزوني وإدارة دورة حياة الأصول، توفر دقة متناهية في التتبع وأعلى مستويات الأمان الرقمي لدعم اتخاذ القرار المؤسسي.',
  contactNumber: '+966 500 000 000',
  contactNumberEn: '+966 500 000 000',
  taxNumber: '',
  taxNumberEn: '',
  commercialRegister: '5950007763',
  commercialRegisterEn: '5950007763',
  address: 'المملكة العربية السعودية',
  addressEn: 'Kingdom of Saudi Arabia',
  currency: 'ريال',
  lowStockThreshold: 2,
  systemVersion: 'v3.5.1 Pro Local',
  autoBackupEnabled: true,
  cloudSyncEnabled: false,
  exitPermitDateType: 'today',
  exitPermitCustomDate: '',
  statusColors: DEFAULT_STATUS_COLORS,
  declarationText: 'وقد تم استلام المركبة ومحتوياتها وجميع أوراقها وهي بحالة جيدة وحسب ما تم الاتفاق عليه ،\nولا يوجد بها أي خدوش ولا صدمات وأصبحت تحت مسؤوليتي من تاريخ وساعة الاستلام',
  declarationTextPlural: 'وقد تم استلام المركبات المذكورة أعلاه ومحتوياتها وجميع أوراقها وهي بحالة جيدة وحسب ما تم الاتفاق عليه ،\nولا يوجد بها أي خدوش ولا صدمات وأصبحت تحت مسؤوليتي من تاريخ وساعة الاستلام',
  customFields: [],
  inventoryCustomFields: [],
  reportsCustomFields: [],
  addCarCustomFields: [],
  salesCustomFields: [],
  gateCustomFields: [],
  inventoryColumnsVisible: {
    car_info: true,
    vin_matching: true,
    ownership: true,
    card_number: true,
    vin: true,
    plate: true,
    rental: true,
    status: true,
    supplier: true,
    cost_price: true,
    price: true
  },
  reportsColumnsVisible: {
    car_info: true,
    status: true,
    status_date: true,
    cost_price: true,
    price: true,
    profit: true,
    vin: true,
    card_number: true,
    supplier: true
  },
  addCarFieldsVisible: {
    brand: true,
    model: true,
    year: true,
    color: true,
    vin: true,
    vinMatching: true,
    cardNumber: true,
    ownershipType: true,
    costPrice: true,
    price: true,
    rentalStatus: true,
    supplier: true,
    hasPlate: true,
    plateNumber: true,
    notes: true
  },
  salesFieldsVisible: {
    brand: true,
    model: true,
    year: true,
    price: true,
    saleType: true,
    seller: true,
    exitDate: true
  },
  gateFieldsVisible: {
    receiverName: true,
    receiverPhone: true,
    receiverId: true,
    deliveryType: true,
    transportCompany: true,
    notes: true
  },
  updateHistory: [
    {
      version: 'v3.5.1',
      date: '2026-06-29',
      description: 'تحسينات الهيدر الفني الموحد لطباعة الخطابات والتقارير مع تفعيل وضع التشغيل المنفرد الآمن بالتطبيق.',
      features: ['تحسين وضغط رأس الخطاب وتقليل الهوامش البيضاء', 'خط فاصل مفرد واحترافي', 'تحديد دقيق للمسافات البينية لعناوين التقارير والخطابات والجدول', 'تحديث آلية منع التكرار ومنع تعارض العمليات بالتطبيق']
    },
    {
      version: 'v3.5.0',
      date: '2026-01-01',
      description: 'إطلاق نسخة "مخزوني" المتقدمة بنظام التخزين المحلي الآمن.',
      features: ['نظام تخزين محلي مشفر', 'محرك استيراد ذكي', 'تقارير جرد احترافية']
    }
  ],
  web3formsKey1: 'a96bc38e-1520-4162-b69b-d02173d61a83',
  web3formsKey2: 'a96bc38e-1520-4162-b69b-d02173d61a83',
  
  // Default values for advanced storage config
  documentStorageType: 'indexeddb',
  documentStoragePath: '/almakhzoun_secure_sandbox',
  documentEncryptAttachments: true,
  documentAutoBackupInterval: 'daily',
  cloudBackupPath: 'almakhzoun_backups_cloud',
  reservationConfirmPeriodDays: 4,

  // Local Disk Scheduled Auto-Backup Defaults
  localDiskAutoBackupEnabled: false,
  localDiskAutoBackupIntervalMinutes: 30,
  localDiskAutoBackupDirName: '',
  localDiskAutoBackupMaxFiles: 20
};
