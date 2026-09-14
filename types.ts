
export enum CarStatus {
  AVAILABLE = 'متوفره',
  IN_YARD = 'بالساحة',
  IN_TRANSFER = 'قيد التحويل',
  NOT_ARRIVED_SHOWROOM = 'لم تصل المعرض',
  RESERVED = 'محجوزة',
  SOLD = 'مباعة',
  ARCHIVED = 'مؤرشفة',
  NOT_ARRIVED = 'لم تصل بعد',
  RETURNED = 'مرتجعة للمعرض',
  NOT_FOR_SALE = 'غير معروضة للبيع'
}

export enum RentalStatus {
  RENTED = 'مجير',
  NOT_RENTED = 'لم يتم التجير'
}

export enum OwnershipType {
  DIRECT = 'مباشر',
  DISTRIBUTION = 'تصريف'
}

export enum DeliveryType {
  OWNER = 'صاحبها',
  TRANSPORT = 'نقليات',
  OTHER = 'مستلم اخر'
}

export interface ExitData {
  receiverName: string;
  receiverPhone: string;
  receiverId: string;
  nationality?: string;
  deliveryType: DeliveryType | string;
  transportCompany?: string;
  exitDate: string;
  notes?: string;
  seller?: string;
  saleType?: string;
  bankName?: string;
  carCondition?: string;
  representativeName?: string;
}

export interface PlateData {
  plateNumber: string;
  ownerName: string;
  serialNumber: string;
  issueDate: string;
}

export interface CarHistoryEntry {
  id: string;
  action: string;
  timestamp: string;
  user: string;
}

export interface CustomField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea';
  required: boolean;
  options?: string[];
  placeholder?: string;
  defaultValue?: string;
  order?: number;
}

export interface Car {
  id: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  interiorColor?: string;
  vin: string;
  vinMatching: string;
  cardNumber: string;
  price: number;
  costPrice: number;
  supplier: string;
  ownershipType: OwnershipType | string;
  status: CarStatus;
  rentalStatus: RentalStatus;
  entryDate: string;
  lastModified: string;
  updatedAt?: string;
  history: CarHistoryEntry[];
  reservedByUserId?: string;
  attributionSource?: string;
  reservationDate?: string;
  isOutbound: boolean;
  exitData?: ExitData;
  hasPlate: boolean;
  plateData?: PlateData;
  notes?: string;
  carRemark?: string;
  isPresentInShowroom?: boolean;
  presenceDescription?: string;
  cardFile?: string;
  cardFileName?: string;
  customData?: Record<string, any>;
  seller?: string;
  modelYear?: string | number;
  exitType?: string;
  statusNote?: string;
  transferSender?: string;
  transferReceiver?: string;
  transferNo?: string;
  transferDate?: string;
}

export interface ActivityLog {
  id: string;
  user: string;
  action: string;
  targetId: string;
  targetType: 'car' | 'user' | 'backup' | 'settings' | 'system_update' | 'transfer';
  timestamp: string;
  details: string;
}

export interface SystemUpdate {
  version: string;
  date: string;
  description: string;
  features: string[];
}

export enum UserRole {
  ADMIN = 'مدير',
  EMPLOYEE = 'موظف',
  DELEGATE = 'مندوب'
}

export enum Permission {
  VIEW_DASHBOARD = 'view_dashboard',
  MANAGE_INVENTORY = 'manage_inventory',
  VIEW_REPORTS = 'view_reports',
  MANAGE_USERS = 'manage_users',
  MANAGE_SETTINGS = 'manage_settings',
  MANAGE_BACKUP = 'manage_backup',
  VIEW_FINANCIALS = 'view_financials',
  EXPORT_DATA = 'export_data',
  VIEW_SALES = 'view_sales',
}

export interface User {
  id: string;
  username: string;
  password?: string;
  role: UserRole;
  phone?: string;
  email?: string;
  fullName?: string;
  specialty?: string;
  lastLogin?: string;
  avatar?: string;
  permissions?: Permission[];
  companyId?: string;
  adminEmail?: string;
  branchId?: string;
  isActive?: boolean;
  accessToken?: string;
  refreshToken?: string;
  primaryAdmin?: boolean | number;
  
  // Account Recovery & Protection additions
  securityQuestions?: { question: string; answerHash: string }[];
  recoveryCodeHash?: string;
  recoveryCode?: string;
  questions?: any[];
  recoveryFileKey?: string;
  failedAttempts?: number;
  lockoutUntil?: string;
  trustedDevices?: string[];
}

export interface Delegate {
  id: string;
  name?: string;
  username: string; // Login username or display name
  password?: string;
  phone?: string;
  email?: string;
  specialty?: string;
  isActive: boolean;
  target?: number;
  notes?: string;
  createdAt?: string;
  token?: string;
}

export interface DashboardPreferences {
  showInventoryStats: boolean;
  showFinancialStats: boolean;
  showRentalStats: boolean;
  showInventoryList: boolean;
  showBrandChart: boolean;
  showStatusPie: boolean;
  showRecentActivity: boolean;
  showQuickActions: boolean;
  showMarketTrends: boolean;
  widgetOrder: string[];
}

export interface CustomCarStatus {
  id: string;
  name: string;
  bgColor: string;
  textColor: string;
}

export interface CustomStatusColorRule {
  id: string;
  fieldKey: string;
  fieldLabel?: string;
  matchValue: string;
  bgColor: string;
  textColor: string;
  applyToRow?: boolean;
  applyToBadge?: boolean;
}

export interface StatusColorsConfig {
  availableBg?: string;
  availableText?: string;
  reservedBg?: string;
  reservedText?: string;
  soldBg?: string;
  soldText?: string;
  notForSaleBg?: string;
  notForSaleText?: string;
  returnedBg?: string;
  returnedText?: string;
  notArrivedBg?: string;
  notArrivedText?: string;
  mismatchBg?: string;
  mismatchText?: string;
  notRentedBg?: string;
  notRentedText?: string;
  customStatuses?: CustomCarStatus[];
  customRules?: CustomStatusColorRule[];
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  iban: string;
}

export interface OrganizationSettings {
  name: string;
  nameEn?: string;
  orgType?: 'مؤسسة' | 'شركة' | string;
  orgTypeEn?: string;
  activityEn?: string;
  logoUrl?: string;
  logoWidth?: number;
  logoPosX?: number;
  logoPosY?: number;
  stampUrl?: string;
  description: string;
  contactNumber: string;
  contactNumberEn?: string;
  taxNumber?: string;
  taxNumberEn?: string;
  commercialRegister?: string;
  commercialRegisterEn?: string;
  address: string;
  addressEn?: string;
  currency: string;
  lowStockThreshold: number;
  systemVersion: string;
  autoBackupEnabled: boolean;
  lastBackupDate?: string;
  updateHistory: SystemUpdate[];
  cloudSyncEnabled: boolean;
  googleDriveToken?: string;
  googleDriveClientId?: string;
  googleDriveClientSecret?: string;
  googleDriveProjectId?: string;
  googleDriveRedirectUri?: string;
  googleDriveAuthMode?: 'gis_popup' | 'oauth_redirect' | 'firebase';
  integrityChecksum?: string;
  declarationText?: string;
  declarationTextPlural?: string;
  statusColors?: StatusColorsConfig;
  bankAccounts?: BankAccount[];
  customFields: CustomField[];
  inventoryCustomFields?: CustomField[];
  reportsCustomFields?: CustomField[];
  addCarCustomFields?: CustomField[];
  salesCustomFields?: CustomField[];
  gateCustomFields?: CustomField[];
  inventoryColumnsVisible?: Record<string, boolean>;
  reportsColumnsVisible?: Record<string, boolean>;
  addCarFieldsVisible?: Record<string, boolean>;
  salesFieldsVisible?: Record<string, boolean>;
  gateFieldsVisible?: Record<string, boolean>;
  addCarFieldsOrder?: string[];
  addCarFieldLabels?: Record<string, string>;
  inventoryColumnsOrder?: string[];
  inventoryColumnLabels?: Record<string, string>;
  reportsColumnsOrder?: string[];
  reportsColumnLabels?: Record<string, string>;
  web3formsKey1?: string;
  web3formsKey2?: string;
  currencyUsed?: string;
  
  // Advanced Document & Attachment Storage Options
  documentStorageType?: 'indexeddb' | 'localstorage' | 'cloud_drive_folder' | 'local_folder';
  documentStoragePath?: string;
  documentStoragePathCustoms?: string;
  documentStoragePathExitPermits?: string;
  documentStoragePathPlates?: string;
  documentStoragePathReports?: string;
  documentEncryptAttachments?: boolean;
  documentAutoBackupInterval?: 'none' | 'daily' | 'weekly';
  cloudBackupPath?: string;
  
  // Local Disk Scheduled Auto-Backup Properties
  localDiskAutoBackupEnabled?: boolean;
  localDiskAutoBackupIntervalMinutes?: number;
  localDiskAutoBackupDirName?: string;
  localDiskAutoBackupMaxFiles?: number;
  localDiskAutoBackupLastTime?: string;

  reservationConfirmPeriodDays?: number;
  exitPermitPadding?: number;
  exitPermitGap?: number;
  exitPermitTableRowHeight?: number;
  exitPermitFontSize?: number;
  exitPermitDottedFullHeight?: number;
  exitPermitStampSize?: number;
  exitPermitStampX?: number;
  exitPermitStampY?: number;
  exitPermitDateType?: 'today' | 'custom';
  exitPermitCustomDate?: string;
  updatedAt?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  nationalId: string;
  type: 'عميل' | 'مستلم';
  addedAt?: string;
}

export interface BackupData {
  cars: Car[];
  users: User[];
  logs: ActivityLog[];
  customers?: Customer[];
  settings: OrganizationSettings;
  exportDate: string;
  version: string;
  backupType?: string;
  localStorageData?: Record<string, string>;
  backendDatabase?: any;
  delegates?: Delegate[];
  vehicleCosts?: VehicleCost[];
  lettersArchive?: LetterArchiveEntry[];
  inventoryMovements?: InventoryMovement[];
  sisterCompanies?: any[];
  companyTransfers?: any[];
  companyTransfersSettings?: any;
}

export interface LetterArchiveEntry {
  id: string;
  letterNumber: string;
  letterType: string;
  letterDate: string;
  vin: string;
  plateNumber: string;
  cardNumber: string;
  vehicleName: string;
  driverName: string;
  destination: string;
  createdBy: string;
  createdAt: string;
  htmlContent: string;
  images?: string[];
  appendImagesToBottom?: boolean;
  manualCarBrand?: string;
  manualCarModel?: string;
  manualCarYear?: string;
  manualCarVin?: string;
  manualCarPlate?: string;
  manualCarCard?: string;
  manualCarPrice?: string;
}

export interface OrganizationTenant {
  id: string;
  name: string;
  logoUrl?: string; // base64 or empty
  stampUrl?: string;
  commercialRegistry?: string;
  taxNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  createdAt: string;
}

export interface MovementEvent {
  id: string;      // Event ID
  carId: string;   // Car ID
  type: 'IN' | 'OUT';
  timestamp: string; // ISO string with time
  brand: string;
  model: string;
  color: string;
  vin: string;
  cardNumber: string;
  price: number;
  costPrice: number;
  supplier: string;
  isOutbound: boolean;
  notes?: string;
  
  // Exit snapshot fields
  seller?: string;
  representativeName?: string;
  receiverName?: string;
  receiverPhone?: string;
  receiverId?: string;
  deliveryType?: any;
  transportCompany?: string;
  notesExit?: string;
  saleType?: string;
  bankName?: string;
}

export interface VehicleCost {
  id: string;
  carName: string;
  vin: string;
  purchasePrice: number;
  shippingExpense: number;
  clearanceExpense: number;
  transportExpense: number;
  otherExpense: number;
  totalCost: number;
  entryDate: string;
  notes?: string;
  supplier: string;
  isArchived: boolean;
}

export interface UnifiedBooking {
  id: string;
  vin: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  carStatus: CarStatus | string;
  bookingStatus: 'active' | 'expired' | 'sold';
  delegateName: string;
  reservationDate: string;
  isOutbound: boolean;
  car: Car;
}

export function getUnifiedBookings(cars: Car[]): UnifiedBooking[] {
  if (!Array.isArray(cars)) return [];
  
  return cars
    .filter(car => {
      if (!car) return false;
      const statusStr = String(car.status || '').trim();
      const isReserved = statusStr === 'محجوزة' || statusStr === 'محجوز' || statusStr === 'Reserved' || car.status === CarStatus.RESERVED;
      return isReserved;
    })
    .map(car => {
      let delegateName = (car.reservedByUserId || car.seller || car.exitData?.seller || car.exitData?.representativeName || '').trim();
      if (!delegateName || delegateName === '-') {
        if (car.statusNote) {
          const clean = car.statusNote.replace(/^[:\-–\s.]+/, '').replace(/[:\-–\s.]+$/, '').trim();
          if (clean && clean !== '-') delegateName = clean;
        }
      }
      if (!delegateName || delegateName === '-') {
        if (car.notes) {
          const rx = /(?:مندوب|محجوز باسم|بواسطة)\s*:\s*([^\s\d\-_:]+)/i;
          const match = car.notes.match(rx);
          if (match && match[1]) {
            delegateName = match[1].trim();
          } else {
            const trimmedNotes = car.notes.trim();
            if (trimmedNotes.length > 0 && trimmedNotes.length < 50 && !trimmedNotes.includes('\n')) {
              delegateName = trimmedNotes;
            }
          }
        }
      }
      if (!delegateName || delegateName === '-') {
        delegateName = 'غير مححدد'; // we will use unified 'غير محدد' inside the UI
      }
      if (delegateName === 'غير مححدد') {
        delegateName = 'غير محدد';
      }
      
      let bookingStatus: 'active' | 'expired' | 'sold' = 'active';
      if (car.reservationDate) {
        const date = new Date(car.reservationDate);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - date.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 3) {
          bookingStatus = 'expired';
        }
      }
      
      return {
        id: car.id,
        vin: car.vin || '',
        brand: car.brand || '',
        model: car.model || '',
        year: car.year || 0,
        price: car.price || 0,
        carStatus: car.status,
        bookingStatus,
        delegateName,
        reservationDate: car.reservationDate || car.entryDate || '',
        isOutbound: !!car.isOutbound,
        car
      };
    });
}

export interface InventoryMovement {
  id: string;
  vin: string;
  movementType: string;
  user: string;
  timestamp: string;
  prevStatus: string;
  newStatus: string;
  details?: string;
}

export function formatVehicleDisplay(car: { brand?: string; model?: string; customData?: any; attributionSource?: string; carRemark?: string; notes?: string } | null | undefined, includeNotes: boolean = false): string {
  if (!car) return '';
  const brand = (car.brand || '').trim();
  const model = (car.model || '').trim();
  const attribution = (car.attributionSource || '').trim();
  const carRemark = (car.carRemark || '').trim();
  const notes = (car.notes || '').trim();

  const parts: string[] = [];
  if (brand) parts.push(brand);
  if (model && model.toLowerCase() !== brand.toLowerCase()) parts.push(model);

  let name = parts.join(' ').replace(/\s+/g, ' ').trim();
  if (!name) name = 'مركبة غير محددة';

  if (attribution) {
    let cleanAttr = attribution;
    if (cleanAttr.startsWith('وارد ')) {
      cleanAttr = cleanAttr.replace(/^وارد\s+/, '').trim();
    } else if (cleanAttr.startsWith('وارد')) {
      cleanAttr = cleanAttr.replace(/^وارد/, '').trim();
    }
    name = `${name} - وارد ${cleanAttr}`;
  }

  if (includeNotes) {
    const registrationNotes = carRemark || notes;
    if (registrationNotes) {
      name = `${name} (${registrationNotes})`;
    }
  }

  return name;
}

export function getNormalizedSaleTypeAndBank(car: { exitData?: { saleType?: string; bankName?: string } } | null | undefined): { saleType: string; bankName: string } {
  if (!car || !car.exitData) {
    return { saleType: '-', bankName: '-' };
  }

  let saleType = (car.exitData.saleType || '').trim();
  let bankName = (car.exitData.bankName || '').trim();

  if (!saleType) {
    return { saleType: '-', bankName: '-' };
  }

  // Normalize different spellings and embedded values
  if (saleType.includes('بنك') || saleType.includes('البنك') || saleType.startsWith('عميل بنك')) {
    if (!bankName || bankName === '-' || bankName === '') {
      if (saleType.includes('(') && saleType.includes(')')) {
        const match = saleType.match(/\(([^)]+)\)/);
        if (match) {
          bankName = match[1].trim();
        }
      } else if (saleType.startsWith('عميل بنك ')) {
        bankName = saleType.substring(8).trim();
      } else if (saleType.startsWith('عميل بنك')) {
        bankName = saleType.substring(8).trim();
      } else if (saleType.startsWith('بنك ')) {
        bankName = saleType.substring(4).trim();
      } else {
        bankName = saleType.replace('عميل بنك', '').replace('بنك', '').trim();
      }
    }
    saleType = 'عميل بنك';
  }

  return {
    saleType: saleType || '-',
    bankName: bankName || '-'
  };
}

declare global {
  interface Window {
    electronAPI?: {
      // Stage 4 Enterprise Update IPC Channels
      updateCheck?: (packageBase64OrPath: string) => Promise<any>;
      updateInstall?: (packageBase64: string) => Promise<any>;
      updateBackup?: (payload: { filesToModify: string[]; fromVersion: string; targetVersion: string }) => Promise<any>;
      updateRollback?: (backupId: string) => Promise<any>;
      restartApp?: () => Promise<any>;

      // Native Dialogs & Handlers
      restartApplication?: () => Promise<any>;
      selectUpdatePackageDialog?: () => Promise<any>;
      inspectNativeUpdate?: (payload: string) => Promise<any>;
      applyNativeUpdate?: (payload: string) => Promise<any>;
      buildNativeUpdate?: (options: any) => Promise<any>;
      onUpdateAvailable?: (callback: (info: any) => void) => () => void;

      // Fingerprint & License
      getDeviceId?: () => void;
      onDeviceIdReply?: (callback: (id: string) => void) => () => void;
      saveLicense?: (licenseData: any) => void;
      onSaveLicenseReply?: (callback: (status: boolean) => void) => () => void;
      loadLicense?: () => void;
      onLoadLicenseReply?: (callback: (data: any) => void) => () => void;

      // Layout & Database
      saveUserLayoutSettings?: (data: any) => void;
      loadUserLayoutSettingsAsync?: () => Promise<any>;
      exportBackupFile?: (data: any) => Promise<any>;
      importBackupFile?: () => Promise<any>;
      saveDatabaseState?: (state: any) => Promise<any>;
      loadDatabaseState?: () => Promise<any>;
      exportNativeBackup?: () => Promise<any>;
      restoreNativeBackup?: (content: any) => Promise<any>;
    };
  }
}



