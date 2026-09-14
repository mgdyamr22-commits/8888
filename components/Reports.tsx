import React, { useMemo, useState, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ResilienceMonitor } from "./ResilienceMonitor.tsx";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import {
  Printer,
  FileSpreadsheet,
  FileText,
  CheckSquare,
  Square,
  FileDown,
  Car as CarIcon,
  BarChart3,
  Settings2,
  X,
  Eye,
  LayoutDashboard,
  Type,
  Table as TableIcon,
  Save,
  CheckCircle2,
  Calendar,
  Filter,
  RefreshCcw,
  ArrowRightLeft,
  ArrowUp,
  ArrowDown,
  Columns,
  PlusCircle,
  MinusCircle,
  Warehouse,
  Percent,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Award,
  Users,
  Building2,
  ChevronLeft,
  Search,
  HelpCircle,
  SlidersHorizontal,
  Trash2,
  Flame,
  ShieldCheck,
  Zap,
  ClipboardList,
  Lightbulb,
  Sliders,
  Power,
  Edit2,
  Clock,
  UserPlus,
  PieChart as PieChartIcon,
} from "lucide-react";
import {
  Car,
  CarStatus,
  OrganizationSettings,
  User,
  RentalStatus,
  UserRole,
  Permission,
  MovementEvent,
  OwnershipType,
  DeliveryType,
  Delegate,
  VehicleCost,
  formatVehicleDisplay,
  getNormalizedSaleTypeAndBank,
} from "../types";
import {
  getCleanDelegateName,
  getRepresentativeOrSeller,
  getReservationRepresentative,
} from "./CarManager";
import { ROLE_PERMISSIONS } from "../constants";
import {
  loadTableLayout,
  saveTableLayout,
} from "../services/layoutPersistenceService";
import { getLogoDataUri, getStampDataUri } from "./OfficialAssets";
import { documentStorageService } from "../services/documentStorageService";
import { ExcelService } from "../services/excelService";
import { exportHTMLToPDF } from "../services/exportService";
import { CarApiService } from "../src/services/carApiService";
import {
  DailyAutoCalculator,
  DailyInventorySummary,
  isCarExited,
} from "../services/DailyAutoCalculator";
import {
  getResolvedStatusColors,
  getCustomRuleForCar,
  getCarRowStyleAndClass,
  getCarStatusColorInfo,
  getCarRentalColorInfo,
  hexToArgb,
} from "../src/utils/statusColors";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  LabelList,
} from "recharts";

import { AnalyticsTabs } from "./AnalyticsTabs.tsx";

export const mapMovementEventToCar = (
  ev: MovementEvent,
  originalCars: Car[],
): Car => {
  const originalCar = originalCars.find((c) => c.id === ev.carId);
  return {
    id: ev.carId,
    brand: ev.brand,
    model: ev.model,
    year: originalCar?.year || new Date().getFullYear(),
    color: ev.color,
    vin: ev.vin,
    vinMatching: (() => {
      const raw = String(originalCar?.vinMatching || '').trim();
      return (raw === 'غير مطابق' || raw === 'غير متطابق' || raw === 'mismatch' || raw === 'غير_مطابق') ? 'غير متطابق' : 'متطابق';
    })(),
    cardNumber: ev.cardNumber,
    price: ev.price,
    costPrice: ev.costPrice,
    supplier: ev.supplier,
    ownershipType: originalCar?.ownershipType || OwnershipType.DIRECT,
    status:
      ev.type === "OUT"
        ? CarStatus.SOLD
        : originalCar?.status || CarStatus.AVAILABLE,
    rentalStatus: originalCar?.rentalStatus || RentalStatus.NOT_RENTED,
    entryDate:
      ev.type === "IN" ? ev.timestamp : originalCar?.entryDate || ev.timestamp,
    lastModified: originalCar?.lastModified || ev.timestamp,
    history: originalCar?.history || [],
    isOutbound: ev.type === "OUT",
    exitData:
      ev.type === "OUT"
        ? {
            receiverName: ev.receiverName || "",
            receiverPhone: ev.receiverPhone || "",
            receiverId: ev.receiverId || "",
            deliveryType: ev.deliveryType || DeliveryType.OWNER,
            exitDate: ev.timestamp.split("T")[0],
            notes: ev.notesExit || "",
            seller: ev.seller || ev.representativeName || "",
            representativeName: ev.representativeName || ev.seller || "",
            transportCompany: ev.transportCompany || "",
            saleType: ev.saleType || "",
            bankName: ev.bankName || "",
          }
        : undefined,
    hasPlate: originalCar?.hasPlate || false,
    plateData: originalCar?.plateData,
    notes: ev.notes || originalCar?.notes || "",
    isPresentInShowroom: originalCar?.isPresentInShowroom,
    customData: originalCar?.customData,
  };
};

export const isCarNotArrived = (car: any): boolean => {
  if (!car) return false;
  if (
    car.isOutbound ||
    car.status === CarStatus.SOLD ||
    car.status === CarStatus.IN_TRANSFER ||
    String(car.status) === "مباع" ||
    String(car.status) === "مباعة" ||
    String(car.status) === "تحويل" ||
    String(car.status) === "تم التحويل" ||
    !!car.exitData?.exitDate ||
    !!car.transferDate
  ) {
    return false;
  }
  const statusStr = String(car.status || "");
  return (
    car.status === CarStatus.NOT_ARRIVED ||
    car.status === CarStatus.NOT_ARRIVED_SHOWROOM ||
    statusStr === "لم تصل المعرض" ||
    statusStr === "لم تصل بعد" ||
    statusStr === "غير واصل"
  );
};

// Brand helper styling functions for custom thematic reports
export const getBrandStyling = (brandName: string) => {
  const clean = (brandName || "").trim().toLowerCase();

  if (clean.includes("تويوتا") || clean.includes("toyota")) {
    return {
      gradient: "from-rose-605 to-rose-700 dark:from-rose-800 dark:to-rose-950",
      accentColor: "text-rose-600 dark:text-rose-450",
      borderColor: "border-rose-100 dark:border-rose-900/50",
      borderAll: "border-rose-200 dark:border-rose-900/40",
      tableHeaderBg: "bg-rose-50 dark:bg-rose-950/50",
      tableHeaderTextColor: "text-rose-800 dark:text-rose-200",
      badgeBg:
        "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/20",
      valueBg: "bg-rose-500/10 text-rose-800 dark:text-rose-150",
      iconColor: "text-rose-600",
    };
  }
  if (clean.includes("هيونداي") || clean.includes("hyundai")) {
    return {
      gradient: "from-blue-600 to-blue-700 dark:from-blue-800 dark:to-blue-950",
      accentColor: "text-blue-600 dark:text-blue-450",
      borderColor: "border-blue-100 dark:border-blue-900/50",
      borderAll: "border-blue-200 dark:border-blue-900/40",
      tableHeaderBg: "bg-blue-50 dark:bg-blue-950/50",
      tableHeaderTextColor: "text-blue-800 dark:text-blue-200",
      badgeBg:
        "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20",
      valueBg: "bg-blue-500/10 text-blue-800 dark:text-blue-150",
      iconColor: "text-blue-600",
    };
  }
  if (clean.includes("كيا") || clean.includes("kia")) {
    return {
      gradient: "from-red-600 to-red-700 dark:from-red-800 dark:to-red-950",
      accentColor: "text-red-605 dark:text-red-450",
      borderColor: "border-red-100 dark:border-red-900/50",
      borderAll: "border-red-200 dark:border-red-900/40",
      tableHeaderBg: "bg-red-50 dark:bg-red-950/50",
      tableHeaderTextColor: "text-red-807 dark:text-red-200",
      badgeBg: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/20",
      valueBg: "bg-red-500/10 text-red-800 dark:text-red-150",
      iconColor: "text-red-600",
    };
  }
  if (clean.includes("نيسان") || clean.includes("nissan")) {
    return {
      gradient:
        "from-slate-600 to-slate-700 dark:from-slate-800 dark:to-slate-950",
      accentColor: "text-slate-600 dark:text-slate-400",
      borderColor: "border-slate-100 dark:border-slate-800",
      borderAll: "border-slate-200 dark:border-slate-800",
      tableHeaderBg: "bg-slate-50 dark:bg-slate-950/50",
      tableHeaderTextColor: "text-slate-800 dark:text-slate-200",
      badgeBg:
        "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/20",
      valueBg: "bg-slate-500/10 text-slate-800 dark:text-slate-150",
      iconColor: "text-slate-600",
    };
  }
  if (clean.includes("لكزس") || clean.includes("lexus")) {
    return {
      gradient:
        "from-amber-600 to-amber-700 dark:from-amber-805 dark:to-amber-950",
      accentColor: "text-amber-600 dark:text-amber-450",
      borderColor: "border-amber-100 dark:border-amber-900/50",
      borderAll: "border-amber-200 dark:border-amber-900/40",
      tableHeaderBg: "bg-amber-50 dark:bg-amber-950/50",
      tableHeaderTextColor: "text-amber-800 dark:text-amber-200",
      badgeBg:
        "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
      valueBg: "bg-amber-500/10 text-amber-800 dark:text-amber-150",
      iconColor: "text-amber-600",
    };
  }
  if (clean.includes("فورد") || clean.includes("ford")) {
    return {
      gradient:
        "from-indigo-600 to-indigo-700 dark:from-indigo-800 dark:to-indigo-950",
      accentColor: "text-indigo-600 dark:text-indigo-450",
      borderColor: "border-indigo-100 dark:border-indigo-900/50",
      borderAll: "border-indigo-200 dark:border-indigo-900/40",
      tableHeaderBg: "bg-indigo-50 dark:bg-indigo-950/50",
      tableHeaderTextColor: "text-indigo-800 dark:text-indigo-200",
      badgeBg:
        "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/20",
      valueBg: "bg-indigo-500/10 text-indigo-800 dark:text-indigo-150",
      iconColor: "text-indigo-600",
    };
  }
  if (clean.includes("شيري") || clean.includes("chery")) {
    return {
      gradient: "from-teal-600 to-teal-700 dark:from-teal-800 dark:to-teal-955",
      accentColor: "text-teal-600 dark:text-teal-450",
      borderColor: "border-teal-100 dark:border-teal-900/50",
      borderAll: "border-teal-200 dark:border-teal-900/40",
      tableHeaderBg: "bg-teal-50 dark:bg-teal-950/50",
      tableHeaderTextColor: "text-teal-850 dark:text-teal-205",
      badgeBg:
        "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/20",
      valueBg: "bg-teal-500/10 text-teal-800 dark:text-teal-150",
      iconColor: "text-teal-600",
    };
  }
  if (clean.includes("جيلي") || clean.includes("geely")) {
    return {
      gradient: "from-cyan-600 to-cyan-700 dark:from-cyan-805 dark:to-cyan-950",
      accentColor: "text-cyan-600 dark:text-cyan-450",
      borderColor: "border-cyan-100 dark:border-cyan-900/50",
      borderAll: "border-cyan-200 dark:border-cyan-900/40",
      tableHeaderBg: "bg-cyan-50 dark:bg-cyan-950/50",
      tableHeaderTextColor: "text-cyan-850 dark:text-cyan-205",
      badgeBg:
        "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/20",
      valueBg: "bg-cyan-500/10 text-cyan-800 dark:text-cyan-150",
      iconColor: "text-cyan-600",
    };
  }

  // Safe dynamic selection using simple arithmetic hash
  const sum = clean
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colorOptions = [
    {
      gradient:
        "from-slate-700 to-slate-800 dark:from-slate-800 dark:to-slate-900",
      accentColor: "text-slate-600 dark:text-slate-400",
      borderColor: "border-slate-150 dark:border-slate-800",
      borderAll: "border-slate-200 dark:border-slate-800",
      tableHeaderBg: "bg-slate-50 dark:bg-slate-950/60",
      tableHeaderTextColor: "text-slate-800 dark:text-slate-205",
      badgeBg:
        "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/10",
      valueBg: "bg-slate-500/10 text-slate-850 dark:text-slate-150",
      iconColor: "text-slate-650",
    },
    {
      gradient:
        "from-purple-600 to-purple-700 dark:from-purple-800 dark:to-purple-950",
      accentColor: "text-purple-600 dark:text-purple-450",
      borderColor: "border-purple-100 dark:border-purple-900/50",
      borderAll: "border-purple-200 dark:border-purple-900/40",
      tableHeaderBg: "bg-purple-50 dark:bg-purple-950/50",
      tableHeaderTextColor: "text-purple-800 dark:text-purple-200",
      badgeBg:
        "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/20",
      valueBg: "bg-purple-500/10 text-purple-800 dark:text-purple-150",
      iconColor: "text-purple-600",
    },
    {
      gradient:
        "from-violet-600 to-violet-700 dark:from-violet-800 dark:to-violet-950",
      accentColor: "text-violet-600 dark:text-violet-450",
      borderColor: "border-violet-100 dark:border-violet-900/50",
      borderAll: "border-violet-200 dark:border-violet-900/40",
      tableHeaderBg: "bg-violet-50 dark:bg-violet-950/50",
      tableHeaderTextColor: "text-violet-850 dark:text-violet-205",
      badgeBg:
        "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/20",
      valueBg: "bg-violet-500/10 text-violet-805 dark:text-violet-150",
      iconColor: "text-violet-600",
    },
    {
      gradient:
        "from-emerald-600 to-emerald-700 dark:from-emerald-800 dark:to-emerald-950",
      accentColor: "text-emerald-600 dark:text-emerald-450",
      borderColor: "border-emerald-100 dark:border-emerald-900/50",
      borderAll: "border-emerald-200 dark:border-emerald-900/40",
      tableHeaderBg: "bg-emerald-50 dark:bg-emerald-950/50",
      tableHeaderTextColor: "text-emerald-850 dark:text-emerald-205",
      badgeBg:
        "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
      valueBg: "bg-emerald-500/10 text-emerald-805 dark:text-emerald-150",
      iconColor: "text-emerald-600",
    },
  ];
  return colorOptions[sum % colorOptions.length];
};

export const getBrandColorInfoHtml = (brand: string) => {
  const clean = (brand || "").trim().toLowerCase();
  if (clean.includes("تويوتا") || clean.includes("toyota")) {
    return {
      primaryColor: "#e11d48",
      secondaryColor: "#fff1f2",
      textColor: "#9f1239",
      borderStyle: "border: 1.5px solid #fda4af;",
      cellBorder: "border: 1px solid #fecdd3;",
    };
  }
  if (clean.includes("هيونداي") || clean.includes("hyundai")) {
    return {
      primaryColor: "#1d4ed8",
      secondaryColor: "#eff6ff",
      textColor: "#1e40af",
      borderStyle: "border: 1.5px solid #93c5fd;",
      cellBorder: "border: 1px solid #bfdbfe;",
    };
  }
  if (clean.includes("كيا") || clean.includes("kia")) {
    return {
      primaryColor: "#dc2626",
      secondaryColor: "#fef2f2",
      textColor: "#991b1b",
      borderStyle: "border: 1.5px solid #fca5a5;",
      cellBorder: "border: 1px solid #ffccd5;",
    };
  }
  if (clean.includes("نيسان") || clean.includes("nissan")) {
    return {
      primaryColor: "#4b5563",
      secondaryColor: "#f3f4f6",
      textColor: "#1f2937",
      borderStyle: "border: 1.5px solid #cbd5e1;",
      cellBorder: "border: 1px solid #e5e7eb;",
    };
  }
  if (clean.includes("لكزس") || clean.includes("lexus")) {
    return {
      primaryColor: "#d97706",
      secondaryColor: "#fffbeb",
      textColor: "#92400e",
      borderStyle: "border: 1.5px solid #fcd34d;",
      cellBorder: "border: 1px solid #fde68a;",
    };
  }
  if (clean.includes("فورد") || clean.includes("ford")) {
    return {
      primaryColor: "#4f46e5",
      secondaryColor: "#e0e7ff",
      textColor: "#3730a3",
      borderStyle: "border: 1.5px solid #c7d2fe;",
      cellBorder: "border: 1px solid #e0e7ff;",
    };
  }
  if (clean.includes("شيري") || clean.includes("chery")) {
    return {
      primaryColor: "#0d9488",
      secondaryColor: "#f0fdfa",
      textColor: "#115e59",
      borderStyle: "border: 1.5px solid #99f6e4;",
      cellBorder: "border: 1px solid #ccfbf1;",
    };
  }
  if (clean.includes("جيلي") || clean.includes("geely")) {
    return {
      primaryColor: "#0891b2",
      secondaryColor: "#ecfeff",
      textColor: "#155e75",
      borderStyle: "border: 1.5px solid #a5f3fc;",
      cellBorder: "border: 1px solid #cffafe;",
    };
  }

  return {
    primaryColor: "#334155",
    secondaryColor: "#f8fafc",
    textColor: "#0f172a",
    borderStyle: "border: 1.5px solid #cbd5e1;",
    cellBorder: "border: 1px solid #e2e8f0;",
  };
};

export const getBrandColorInfoExcel = (brand: string) => {
  const clean = (brand || "").trim().toLowerCase();

  if (clean.includes("تويوتا") || clean.includes("toyota")) {
    return {
      headerFg: "FFFFFFFF",
      headerBg: "FFE11D48",
      rowBg: "FFFFF1F2",
      textColor: "FF9F1239",
      borderColor: "FFFDA4AF",
    };
  }
  if (clean.includes("هيونداي") || clean.includes("hyundai")) {
    return {
      headerFg: "FFFFFFFF",
      headerBg: "FF1D4ED8",
      rowBg: "FFEBF5FF",
      textColor: "FF1E40AF",
      borderColor: "FF93C5FD",
    };
  }
  if (clean.includes("كيا") || clean.includes("kia")) {
    return {
      headerFg: "FFFFFFFF",
      headerBg: "FFDC2626",
      rowBg: "FFFFF2F2",
      textColor: "FF991B1B",
      borderColor: "FFFCA5A5",
    };
  }
  if (clean.includes("نيسان") || clean.includes("nissan")) {
    return {
      headerFg: "FFFFFFFF",
      headerBg: "FF4B5563",
      rowBg: "FFF3F4F6",
      textColor: "FF1F2937",
      borderColor: "FFCBD5E1",
    };
  }
  if (clean.includes("لكزس") || clean.includes("lexus")) {
    return {
      headerFg: "FFFFFFFF",
      headerBg: "FFD97706",
      rowBg: "FFFFFBEB",
      textColor: "FF92400E",
      borderColor: "FFFCD34D",
    };
  }
  if (clean.includes("فورد") || clean.includes("ford")) {
    return {
      headerFg: "FFFFFFFF",
      headerBg: "FF4F46E5",
      rowBg: "FFE0E7FF",
      textColor: "FF3730A3",
      borderColor: "FFC7D2FE",
    };
  }
  if (clean.includes("شيري") || clean.includes("chery")) {
    return {
      headerFg: "FFFFFFFF",
      headerBg: "FF0D9488",
      rowBg: "FFF0FDFA",
      textColor: "FF115E59",
      borderColor: "FF99F6E4",
    };
  }
  if (clean.includes("جيلي") || clean.includes("geely")) {
    return {
      headerFg: "FFFFFFFF",
      headerBg: "FF0891B2",
      rowBg: "FFECFEFF",
      textColor: "FF155E75",
      borderColor: "FFA5F3FC",
    };
  }

  return {
    headerFg: "FFFFFFFF",
    headerBg: "FF475569",
    rowBg: "FFF8FAFC",
    textColor: "FF0F172A",
    borderColor: "FFCBD5E1",
  };
};

interface ReportsProps {
  cars: Car[];
  settings: OrganizationSettings;
  users?: User[];
  delegates?: Delegate[];
  currentUser: User | null;
  movementHistory?: MovementEvent[];
  onUpdateCars?: React.Dispatch<React.SetStateAction<Car[]>>;
  setUsers?: React.Dispatch<React.SetStateAction<User[]>>;
  vehicleCosts?: VehicleCost[];
}

interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
  width?: string;
}

type DateFilterType = "all" | "entry" | "exit";
type PrintOrientation = "landscape" | "portrait";
type ReportView =
  | "inventory"
  | "comprehensive-inventory"
  | "outside-showroom"
  | "monthly"
  | "monthly-entry"
  | "monthly-exit"
  | "daily-entry"
  | "daily-exit"
  | "daily-summary"
  | "daily-movement-statement"
  | "physical-inventory"
  | "physical-inventory-summary"
  | "comprehensive-inventory-summary"
  | "analytics"
  | "delegates"
  | "delegates-reports"
  | "non-rented"
  | "resilience-audit"
  | "delegates-inventory-summary"
  | "supplier-analysis"
  | "showroom-inventory-cost"
  | "transfers-general"
  | "transfers-daily"
  | "purchases";

export const toArabicDigits = (str: string): string => {
  const id = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return str.replace(/[0-9]/g, function (w) {
    return id[+w];
  });
};

export function numberToArabicWords(num: number): string {
  if (num === 0) return "صفر";

  // Split into integer and fraction (max 2 decimal places for halala)
  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  const units = [
    "",
    "واحد",
    "اثنان",
    "ثلاثة",
    "أربعة",
    "خمسة",
    "ستة",
    "سبعة",
    "ثمانية",
    "تسعة",
    "عشرة",
    "أحد عشر",
    "اثنا عشر",
    "ثلاثة عشر",
    "أربعة عشر",
    "خمسة عشر",
    "ستة عشر",
    "سبعة عشر",
    "ثمانية عشر",
    "تسعة عشر",
  ];
  const tens = [
    "",
    "",
    "عشرون",
    "ثلاثون",
    "أربعون",
    "خمسون",
    "ستون",
    "سبعون",
    "ثمانون",
    "تسعون",
  ];
  const hundreds = [
    "",
    "مائة",
    "مائتان",
    "ثلاثمائة",
    "أربعمائة",
    "خمسمائة",
    "ستمائة",
    "سبعمائة",
    "ثمانمائة",
    "تسعمائة",
  ];

  function convertGroup(n: number): string {
    let text = "";
    const h = Math.floor(n / 100);
    const t = Math.floor((n % 100) / 10);
    const u = n % 10;

    if (h > 0) {
      text += hundreds[h];
    }

    if (t > 0 || u > 0) {
      if (text !== "") text += " و";
      if (t === 0) {
        text += units[u];
      } else if (t === 1) {
        text += units[10 + u];
      } else {
        if (u > 0) {
          text += units[u] + " و" + tens[t];
        } else {
          text += tens[t];
        }
      }
    }
    return text;
  }

  function formatArabic(val: number): string {
    if (val === 0) return "";
    let result = "";

    const millions = Math.floor(val / 1000000);
    const thousands = Math.floor((val % 1000000) / 1000);
    const remainder = val % 1000;

    if (millions > 0) {
      if (millions === 1) {
        result += "مليون";
      } else if (millions === 2) {
        result += "مليونان";
      } else if (millions >= 3 && millions <= 10) {
        result += convertGroup(millions) + " ملايين";
      } else {
        result += convertGroup(millions) + " مليوناً";
      }
    }

    if (thousands > 0) {
      if (result !== "") result += " و";
      if (thousands === 1) {
        result += "ألف";
      } else if (thousands === 2) {
        result += "ألفان";
      } else if (thousands >= 3 && thousands <= 10) {
        result += convertGroup(thousands) + " آلاف";
      } else {
        result += convertGroup(thousands) + " ألفاً";
      }
    }

    if (remainder > 0) {
      if (result !== "") result += " و";
      result += convertGroup(remainder);
    }

    return result;
  }

  let arabicWords = formatArabic(integerPart);

  if (integerPart === 1) {
    arabicWords += " ريال سعودي";
  } else if (integerPart === 2) {
    arabicWords += " ريالان سعوديان";
  } else if (integerPart >= 3 && integerPart <= 10) {
    arabicWords += " ريالات سعودية";
  } else {
    arabicWords += " ريالاً سعودياً";
  }

  if (decimalPart > 0) {
    let halalaWords = "";
    if (decimalPart === 1) {
      halalaWords = "هللة واحدة";
    } else if (decimalPart === 2) {
      halalaWords = "هللتان";
    } else if (decimalPart >= 3 && decimalPart <= 10) {
      halalaWords = convertGroup(decimalPart) + " هللات";
    } else {
      halalaWords = convertGroup(decimalPart) + " هللة";
    }
    arabicWords += " و" + halalaWords;
  }

  return arabicWords;
}

export const getCleanBrandName = (brand: string): string => {
  if (!brand) return "غير محدد";

  // 1. Clean up whitespaces, non-breaking spaces, and hidden formatting styles
  let str = brand
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // remove zero-width spaces
    .replace(/[\s\u00A0]+/g, " ") // collapse all spaces & non-breaking spaces to a single standard space
    .trim()
    .toLowerCase();

  // Standardize common brand name typos & variations in Arabic showrooms
  if (str === "هوندا" || str.startsWith("هوندا ") || /^honda\b/i.test(str)) {
    // Ensure it is not Hyundai written as "هونداي" or "هونداى"
    if (!str.startsWith("هونداي") && !str.startsWith("هونداى")) {
      return "هوندا";
    }
  }
  if (
    str === "هيونداي" ||
    str === "هيونداى" ||
    str === "هونداي" ||
    str === "هونداى" ||
    str.startsWith("هيونداي") ||
    str.startsWith("هيونداى") ||
    str.startsWith("هونداي") ||
    str.startsWith("هونداى") ||
    /^(ه[وي]ن?د|هوان|hyun)/i.test(str)
  ) {
    // Ensure it is not Honda
    if (str !== "هوندا" && !str.startsWith("هوندا ")) {
      return "هيونداي";
    }
  }
  if (/^ت[وي]و/i.test(str)) {
    return "تويوتا";
  }
  if (/^لكز|لكس/i.test(str)) {
    return "لكزس";
  }
  if (/^نيص|نيس/i.test(str)) {
    return "نيسان";
  }
  if (/^مرس/i.test(str)) {
    return "مرسيدس";
  }
  if (/^بي\s*ام|^bmw/i.test(str)) {
    return "بي ام دبليو";
  }
  if (/^شفر|شيف/i.test(str)) {
    return "شفروليه";
  }
  if (/^جيل/i.test(str)) {
    return "جيلي";
  }
  if (/^شان|شنج/i.test(str)) {
    return "شانجان";
  }
  if (/^ميت|متس/i.test(str)) {
    return "ميتسوبيشي";
  }
  if (/^ام\s*ج|mg/i.test(str)) {
    return "ام جي";
  }
  if (/^إيس|ايس/i.test(str)) {
    return "ايسوزو";
  }

  // Normalize spelling of Alef, Yea, and Heh
  str = str
    .replace(/[أإآء]/g, "ا")
    .replace(/[ىي]/g, "ي")
    .replace(/ة/g, "ه");

  const parts = str.split(/\s+/);
  return parts[0] || "غير محدد";
};

export const getCleanModelKey = (
  model: string | undefined,
): string => {
  const m = (model || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[أإآ]/g, "ا")
    .replace(/[ى]/g, "ي")
    .replace(/ة/g, "ه");
  return m || "عام";
};

export const getCleanModelForSummary = (
  modelStr: string | undefined,
  car?: any,
): string => {
  let raw = "";
  if (car) {
    if (car.baseCategory) raw = car.baseCategory;
    else if (car.base_category) raw = car.base_category;
    else if (car.customData?.baseCategory) raw = car.customData.baseCategory;
    else if (car.customData?.base_category) raw = car.customData.base_category;
  }

  if (!raw && modelStr) {
    raw = modelStr;
  }

  if (!raw) return "طراز عام";

  // Strip parenthetical comments, brackets, and extra notes (e.g. "ملاحظة: ...") to group models and categories cleanly
  raw = raw
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\{.*?\}/g, "")
    .replace(/ملاحظه[\s\S]*/g, "")
    .replace(/ملاحظة[\s\S]*/g, "")
    .replace(/حجز[\s\S]*/g, "")
    .trim();

  if (!raw) {
    raw = modelStr || "طراز عام";
  }

  // 1. Clean up whitespaces, non-breaking spaces, and hidden formatting styles
  let cleanStr = raw
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // remove zero-width spaces
    .replace(/[\s\u00A0]+/g, " ") // collapse all spaces & non-breaking spaces to a single standard space
    .trim();

  // 2. Unify letter spelling variations for Arabic grouping consistency
  cleanStr = cleanStr
    .replace(/[أإآء]/g, "ا")
    .replace(/[ىي]/g, "ي")
    .replace(/ة/g, "ه");

  const normalizedLower = cleanStr.toLowerCase();

  const rules = [
    // تويوتا
    { base: "كامري", patterns: ["كامري", "camry"] },
    { base: "كورولا", patterns: ["كورولا", "كورلا", "corolla"] },
    { base: "يارس", patterns: ["يارس", "ياريس", "yaris"] },
    {
      base: "لاندكروزر",
      patterns: ["لاندكروزر", "لاند كروزر", "land cruiser", "landcruiser"],
    },
    { base: "هايلكس", patterns: ["هايلكس", "هايلوكس", "hilux"] },
    { base: "شاص", patterns: ["شاص", "shas", "شاصي"] },
    {
      base: "راف فور",
      patterns: ["راف فور", "راف ٤", "راف٤", "rav4", "rav 4"],
    },
    { base: "فيلوز", patterns: ["فيلوز", "veloz"] },
    { base: "HIACE", patterns: ["hiace", "هايس", "هاي اس"] },
    { base: "كراون", patterns: ["كراون", "crown"] },
    { base: "اوربان", patterns: ["اوربان", "urban"] },
    { base: "رايز", patterns: ["رايز", "raize"] },
    { base: "افالون", patterns: ["افالون", "avalon"] },
    { base: "برادو", patterns: ["برادو", "prado"] },
    { base: "فورتشنر", patterns: ["فورتشنر", "fortuner"] },

    // هيونداي
    { base: "أكسنت", patterns: ["اكسنت", "أكسنت", "accent"] },
    { base: "إلنترا", patterns: ["النترا", "إلنترا", "elantra"] },
    { base: "سوناتا", patterns: ["سوناتا", "sonata"] },
    { base: "أزيرا", patterns: ["ازيرا", "أزيرا", "azera"] },
    { base: "ستاريا", patterns: ["ستاريا", "staria"] },
    { base: "توسان", patterns: ["توسان", "tucson"] },
    {
      base: "سانتافي",
      patterns: ["سانتافي", "سانتا فيه", "santa fe", "santafe"],
    },
    { base: "آي 10", patterns: ["i10", "i 10", "اي 10", "آي 10"] },

    // لكزس
    { base: "LX600", patterns: ["lx600", "lx 600"] },
    { base: "ES350", patterns: ["es350", "es 350"] },
    { base: "ES300", patterns: ["es300", "es 300"] },
    { base: "LX570", patterns: ["lx570", "lx 570"] },

    // ام جي
    { base: "ZS", patterns: ["zs"] },
    { base: "GT", patterns: ["gt"] },
    { base: "M5", patterns: ["m5", "mg5", "mg 5", "ام جي 5", "جي 5", "جى 5"] },
    { base: "RX5", patterns: ["rx5"] },
    { base: "HS", patterns: ["hs"] },

    // شيري
    { base: "Tigo X", patterns: ["tiggo", "tigo", "تيجو"] },
    {
      base: "AREZO 5",
      patterns: ["arrizo 5", "arezo 5", "اريزو 5", "arezo5", "arrizo5"],
    },
    {
      base: "AREZO 6",
      patterns: ["arrizo 6", "arezo 6", "اريزو 6", "arezo6", "arrizo6"],
    },

    // فولف كار
    { base: "GOLF", patterns: ["golf", "جولف"] },

    // ماكسيوس
    { base: "T60", patterns: ["t60", "ماكسيوس t60"] },
    { base: "D60", patterns: ["d60", "ماكسيوس d60"] },

    // كيا
    { base: "Pegas", patterns: ["pegas", "بيجاس"] },
    { base: "k3", patterns: ["k3", "كيا k3"] },
    { base: "k5", patterns: ["k5", "كيا k5"] },
    { base: "سيراتو", patterns: ["cerato", "سيراتو"] },
    { base: "سبورتج", patterns: ["sportage", "سبورتج", "سبورتيج"] },

    // سوزوكي
    { base: "Dzire", patterns: ["dzire", "ديزاير"] },
    { base: "جمني", patterns: ["jimny", "جمني", "جيمس"] },

    // شانجان
    { base: "Alsvin", patterns: ["alsvin", "السفين", "سفن"] },
    { base: "CS35", patterns: ["cs35", "cs 35"] },
    { base: "CS75", patterns: ["cs75", "cs 75"] },
    { base: "CS95", patterns: ["cs95", "cs 95"] },

    // فورد
    { base: "Taurus", patterns: ["taurus", "توروس"] },
    { base: "Territory", patterns: ["territory", "تيريتوري", "تريتوري"] },
    { base: "Everest", patterns: ["everest", "إفرست", "افريست"] },

    // نيسان
    { base: "Sunny N18", patterns: ["sunny", "صني"] },
    { base: "Altima", patterns: ["altima", "التيما"] },
    {
      base: "X-Trail",
      patterns: ["x-trail", "xtrail", "اكس تريل", "اكس-تريل"],
    },
    { base: "kicks", patterns: ["kicks", "كيكس"] },
    { base: "MAGNITE", patterns: ["magnite", "ماجنيت"] },
    { base: "PATROL", patterns: ["patrol", "باترول"] },

    // مازدا
    { base: "MAZDA 6", patterns: ["mazda 6", "mazda6", "مازدا 6", "مازدا6"] },

    // شيفرولية
    { base: "Tahoe", patterns: ["tahoe", "تاهو"] },

    // ايسوزو
    { base: "D-MAX", patterns: ["d-max", "dmax", "ديماكس", "دي مكس"] },
    { base: "MUX", patterns: ["mux", "mu-x", "ام يو اكس"] },
    { base: "دينة", patterns: ["دينه", "دينة", "dyna"] },

    // هافال
    { base: "H-9", patterns: ["h-9", "h9", "هافال h9"] },
    { base: "Jolion", patterns: ["جوليان", "jolion"] },

    // جي ام سي
    { base: "Sierra", patterns: ["sierra", "سييرا"] },
    { base: "Yukon", patterns: ["yukon", "يوكن", "يوكون"] },
  ];

  let baseModel = "";
  let foundRule = false;

  for (const rule of rules) {
    for (const pat of rule.patterns) {
      const normPat = pat
        .toLowerCase()
        .replace(/[أإآء]/g, "ا")
        .replace(/[\s\u00A0]+/g, " ")
        .replace(/[ىي]/g, "ي")
        .replace(/ة/g, "ه");
      if (normalizedLower.includes(normPat)) {
        baseModel = rule.base;
        foundRule = true;
        break;
      }
    }
    if (foundRule) break;
  }

  if (!foundRule) {
    // Strip common suffixes
    let cleaned = cleanStr;
    const patternsObj = [
      /\s+فل\s+كامل$/i,
      /\s+فل$/i,
      /\s+كامل$/i,
      /\s+كاملة$/i,
      /\s+ستاندر$/i,
      /\s+ستاندرد$/i,
      /\s+استاندر$/i,
      /\s+استاندار$/i,
      /\s+نص\s+فل$/i,
      /\s+نصف\s+فل$/i,
      /\s+سوح$/i,
      /\s+سوبر$/i,
      /\s+سبورت$/i,
      /\s+ليميتد$/i,
      /\s+ليمتد$/i,
      /\s+نص$/i,
      /\s+نصف$/i,
      /\s+غماره$/i,
      /\s+غمارة$/i,
      /\s+غماريتين$/i,
      /\s+Double\s+Cab$/i,
      /\s+GLX$/i,
      /\s+GL$/i,
      /\s+XLE$/i,
      /\s+SE$/i,
      /\s+LE$/i,
      /\s+V6$/i,
      /\s+4x4$/i,
      /\s+4wd$/i,
    ];

    let previous = "";
    while (cleaned !== previous) {
      previous = cleaned;
      for (const pat of patternsObj) {
        cleaned = cleaned.replace(pat, "");
      }
      cleaned = cleaned.trim();
    }

    cleaned = cleaned.replace(/[\s\-\,\/]+$/, "").trim();
    baseModel = cleaned || cleanStr;
  }

  return baseModel;
};

export const normalizeYardName = (branchStr: string | undefined): string => {
  const b = (branchStr || "").trim();
  if (
    !b ||
    b === "الرئيسية" ||
    b === "الرئيسي" ||
    b === "الفرع الرئيسي" ||
    b === "المعرض الرئيسي" ||
    b === "صالة العرض الرئيسية" ||
    b === "صالة الرياض الرئيسية" ||
    b === "الساحة الرئيسية"
  ) {
    return "الساحة الرئيسية";
  }
  if (b.includes("شمال") || b.includes("الشمال") || b.includes("الشمالية")) {
    return "ساحة الشمال";
  }
  if (b.includes("جنوب") || b.includes("الجنوب") || b.includes("الجنوبية")) {
    return "ساحة الجنوب";
  }
  if (
    b.includes("ساحة") ||
    b.includes("المستودع") ||
    b.includes("مستودع") ||
    b.includes("صالة") ||
    b.includes("فرع")
  ) {
    return b;
  }
  return b;
};

export const getSpecScore = (car: any) => {
  const fullText =
    `${car.brand || ""} ${car.model || ""} ${car.notes || ""} ${car.attributionCustom || car.attributionCustom || ""} ${car.exitData?.notes || ""}`.toLowerCase();
  if (fullText.includes("سعودي") || fullText.includes("سعودى")) {
    return 1; // Saudi
  }
  if (
    fullText.includes("خليجي") ||
    fullText.includes("خليجى") ||
    fullText.includes("جليجي")
  ) {
    return 2; // Gulf
  }
  return 3; // Other
};

export const sortCarsUnderBrand = (a: any, b: any) => {
  // 1. Group by Brand (ماركة)
  const brandA = getCleanBrandName(a.brand || "");
  const brandB = getCleanBrandName(b.brand || "");
  const brandCompare = brandA.localeCompare(brandB, "ar");
  if (brandCompare !== 0) return brandCompare;

  // 2. Sort by Model (الموديل / طراز)
  const modelA = (a.model || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[أإآ]/g, "ا")
    .replace(/[ى]/g, "ي")
    .replace(/ة/g, "ه");
  const modelB = (b.model || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[أإآ]/g, "ا")
    .replace(/[ى]/g, "ي")
    .replace(/ة/g, "ه");
  const modelCompare = modelA.localeCompare(modelB, "ar");
  if (modelCompare !== 0) return modelCompare;

  // 3. Year (سنة الصنع) - Newer years first, directly after Model
  const yearA = Number(a.year) || 0;
  const yearB = Number(b.year) || 0;
  if (yearB !== yearA) return yearB - yearA;

  // 4. Sort by Import Source (وارد المركبة / attributionSource)
  const getImportScore = (car: any) => {
    const source = (car.attributionSource || "").trim().toLowerCase();
    if (!source) return 99; // Empty source goes to the bottom
    if (
      source.includes("سعودي") ||
      source.includes("سعودى") ||
      source.includes("الرسمي") ||
      source.includes("وكالة") ||
      source.includes("وكيل")
    ) {
      return 1; // Saudi official agency first
    }
    if (
      source.includes("خليجي") ||
      source.includes("خليجى") ||
      source.includes("بحرين") ||
      source.includes("امارات") ||
      source.includes("عمان") ||
      source.includes("قطر") ||
      source.includes("كويت")
    ) {
      return 2; // GCC/Gulf imports second
    }
    return 10; // Other custom resources/distributors
  };

  const scoreA = getImportScore(a);
  const scoreB = getImportScore(b);
  if (scoreA !== scoreB) return scoreA - scoreB;

  const attrA = a.attributionSource || "";
  const attrB = b.attributionSource || "";
  const attrCompare = attrA.localeCompare(attrB, "ar");
  if (attrCompare !== 0) return attrCompare;

  // 5. Stable fallback by VIN
  return (a.vin || "").localeCompare(b.vin || "");
};

const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const isRTL = true;
    return (
      <div
        className="bg-slate-900/95 dark:bg-slate-950/95 text-white p-3.5 rounded-2xl border border-slate-700/40 shadow-2xl text-xs space-y-1.5 min-w-[200px]"
        style={{
          direction: isRTL ? "rtl" : "ltr",
          textAlign: isRTL ? "right" : "left",
          fontFamily: "Cairo, sans-serif",
        }}
      >
        {label && (
          <p className="font-extrabold text-[#3b82f6] border-b border-slate-800/80 pb-2 mb-2">
            {label}
          </p>
        )}
        <div className="space-y-1.5">
          {payload.map((item: any, idx: number) => {
            let val = item.value;
            let formattedVal = "";
            const name = item.name || item.dataKey || "";

            if (
              name.includes("قيمة") ||
              name.includes("ريال") ||
              name.includes("مبيعات") ||
              name.includes("كلفة") ||
              name.includes("عمولة") ||
              name.includes("مشتريات") ||
              name.includes("سعر") ||
              name.includes("Revenue") ||
              name.includes("Amount") ||
              name.includes("Cost") ||
              name.includes("Price")
            ) {
              formattedVal = `${Number(val).toLocaleString("ar-SA")} ريال SA`;
            } else if (
              name.includes("أيام") ||
              name.includes("يوم") ||
              name.includes("زمن") ||
              name.includes("بقاء") ||
              name.includes("مدة") ||
              name.includes("Stay") ||
              name.includes("Duration")
            ) {
              formattedVal = `${Number(val).toLocaleString("ar-SA")} يوم`;
            } else if (
              name.includes("%") ||
              name.includes("معدل") ||
              name.includes("نسبة")
            ) {
              formattedVal = `${Number(val).toLocaleString("ar-SA")}%`;
            } else if (
              name.includes("سيارات") ||
              name.includes("سيارة") ||
              name.includes("مركبات") ||
              name.includes("مركبة") ||
              name.includes("عدد") ||
              name.includes("الكمية") ||
              name.includes("Count") ||
              name.includes("Sales") ||
              name.includes("Entries") ||
              name.includes("Exits")
            ) {
              formattedVal = `${Number(val).toLocaleString("ar-SA")} سيارة`;
            } else {
              formattedVal = `${Number(val).toLocaleString("ar-SA")}`;
            }

            return (
              <div
                key={idx}
                className="flex items-center justify-between gap-4 py-0.5"
                style={{ direction: "rtl" }}
              >
                <span className="text-slate-400 font-extrabold">{name}:</span>
                <span
                  className="font-sans font-black text-white"
                  style={{ color: item.color || item.fill || "#fff" }}
                >
                  {formattedVal}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

export const extractYYYYMMDD = (dateVal: any): string | null => {
  if (!dateVal) return null;
  if (typeof dateVal === "number") {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  const str = String(dateVal).trim();
  if (!str) return null;

  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, "0");
    const d = isoMatch[3].padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, "0");
    const m = dmyMatch[2].padStart(2, "0");
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return null;
};

export const checkDateRange = (
  dStr: string,
  startStr: string | null,
  endStr: string | null,
): boolean => {
  if (startStr && dStr < startStr) return false;
  if (endStr && dStr > endStr) return false;
  return true;
};

const Reports: React.FC<ReportsProps> = ({
  cars,
  settings,
  users = [],
  delegates = [],
  currentUser,
  movementHistory = [],
  onUpdateCars,
  setUsers,
  vehicleCosts = [],
}) => {
  const isAdmin =
    !currentUser ||
    currentUser?.role === UserRole.ADMIN ||
    String(currentUser?.role).toUpperCase() === "ADMIN";
  const hasPermission = (perm: Permission) =>
    currentUser?.permissions?.includes(perm) ||
    (isAdmin
      ? ROLE_PERMISSIONS[UserRole.ADMIN].includes(perm)
      : currentUser?.role === UserRole.EMPLOYEE ||
          String(currentUser?.role).toUpperCase() === "EMPLOYEE"
        ? ROLE_PERMISSIONS[UserRole.EMPLOYEE].includes(perm)
        : currentUser?.role === UserRole.DELEGATE ||
            String(currentUser?.role).toUpperCase() === "DELEGATE"
          ? ROLE_PERMISSIONS[UserRole.DELEGATE].includes(perm)
          : false);
  const canViewFinancials = hasPermission(Permission.VIEW_FINANCIALS);
  const canExport = hasPermission(Permission.EXPORT_DATA);

  const [searchParams, setSearchParams] = useSearchParams();
  const rawView = searchParams.get("view") as ReportView;
  const reportView: ReportView = [
    "inventory",
    "comprehensive-inventory",
    "outside-showroom",
    "monthly",
    "monthly-entry",
    "monthly-exit",
    "daily-entry",
    "daily-exit",
    "daily-summary",
    "daily-movement-statement",
    "physical-inventory",
    "physical-inventory-summary",
    "comprehensive-inventory-summary",
    "analytics",
    "delegates",
    "delegates-reports",
    "non-rented",
    "resilience-audit",
    "delegates-inventory-summary",
    "supplier-analysis",
    "showroom-inventory-cost",
    "transfers-general",
    "transfers-daily",
    "purchases",
  ].includes(rawView)
    ? rawView
    : "inventory";
  const setReportView = (newView: ReportView) => {
    setSearchParams({ view: newView });
  };

  const [selectedMonth, setSelectedMonth] = useState<number>(() =>
    new Date().getMonth(),
  );
  const [selectedYear, setSelectedYear] = useState<number>(() =>
    new Date().getFullYear(),
  );
  const [groupingMode, setGroupingMode] = useState<"detailed" | "grouped">(
    "detailed",
  );
  const monthlyMovementType = reportView === "monthly-exit" ? "OUT" : "IN";
  const [salesDateFilterType, setSalesDateFilterType] = useState<
    "all" | "custom" | "month"
  >("all");
  const [reportPeriodMode, setReportPeriodMode] = useState<
    "all" | "custom" | "month" | "year" | "week"
  >("all");

  const [startDate, setStartDate] = useState<string>(() => {
    try {
      const persisted =
        loadTableLayout(`reports_${reportView}`) || loadTableLayout("reports");
      return persisted?.filters?.startDate || "";
    } catch {
      return "";
    }
  });
  const [endDate, setEndDate] = useState<string>(() => {
    try {
      const persisted =
        loadTableLayout(`reports_${reportView}`) || loadTableLayout("reports");
      return persisted?.filters?.endDate || "";
    } catch {
      return "";
    }
  });
  const [dateType, setDateType] = useState<DateFilterType>(() => {
    try {
      const persisted =
        loadTableLayout(`reports_${reportView}`) || loadTableLayout("reports");
      return (persisted?.filters?.dateType as DateFilterType) || "all";
    } catch {
      return "all";
    }
  });

  const [selectedDelegateFilter, setSelectedDelegateFilter] = useState<string>(
    () => {
      try {
        const persisted =
          loadTableLayout(`reports_${reportView}`) ||
          loadTableLayout("reports");
        return persisted?.filters?.selectedDelegateFilter || "all";
      } catch {
        return "all";
      }
    },
  );

  const delegateNamesList = useMemo(() => {
    const list = new Set<string>();
    cars.forEach((car) => {
      const name =
        car.exitData?.seller || car.exitData?.representativeName || car.seller;
      if (name) {
        const trimmed = name.trim();
        if (trimmed) list.add(trimmed);
      }
    });
    return Array.from(list).sort((a, b) => a.localeCompare(b, "ar"));
  }, [cars]);

  const [analyticsPeriod, setAnalyticsPeriod] = useState<
    "this-month" | "last-30-days" | "this-quarter" | "this-year" | "custom"
  >("this-month");
  const todayStr = new Date().toISOString().split("T")[0];
  const firstDayOfMonthStr = (() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1)
      .toISOString()
      .split("T")[0];
  })();
  const [analyticsStartDate, setAnalyticsStartDate] =
    useState<string>(firstDayOfMonthStr);
  const [analyticsEndDate, setAnalyticsEndDate] = useState<string>(todayStr);

  // States for advanced analytics dashboard filtering & drill-down options
  const [drillDownBrand, setDrillDownBrand] = useState<string | null>(null);
  const [drillDownSupplier, setDrillDownSupplier] = useState<string | null>(
    null,
  );

  const [filterBrand, setFilterBrand] = useState<string>(() => {
    try {
      const persisted =
        loadTableLayout(`reports_${reportView}`) || loadTableLayout("reports");
      return persisted?.filters?.filterBrand || "";
    } catch {
      return "";
    }
  });
  const [filterModel, setFilterModel] = useState<string>(() => {
    try {
      const persisted =
        loadTableLayout(`reports_${reportView}`) || loadTableLayout("reports");
      return persisted?.filters?.filterModel || "";
    } catch {
      return "";
    }
  });
  const [filterSupplier, setFilterSupplier] = useState<string>(() => {
    try {
      const persisted =
        loadTableLayout(`reports_${reportView}`) || loadTableLayout("reports");
      return persisted?.filters?.filterSupplier || "";
    } catch {
      return "";
    }
  });
  const [filterExitType, setFilterExitType] = useState<string>(() => {
    try {
      const persisted =
        loadTableLayout(`reports_${reportView}`) || loadTableLayout("reports");
      return persisted?.filters?.filterExitType || "";
    } catch {
      return "";
    }
  });
  const [filterBranch, setFilterBranch] = useState<string>(() => {
    try {
      const persisted =
        loadTableLayout(`reports_${reportView}`) || loadTableLayout("reports");
      return persisted?.filters?.filterBranch || "";
    } catch {
      return "";
    }
  });

  const activeDateRange = useMemo(() => {
    let startStr: string | null = null;
    let endStr: string | null = null;

    if (reportPeriodMode === "custom") {
      startStr = startDate ? extractYYYYMMDD(startDate) : null;
      endStr = endDate ? extractYYYYMMDD(endDate) : null;
    } else if (reportPeriodMode === "week") {
      const today = new Date();
      const past7 = new Date();
      past7.setDate(today.getDate() - 7);
      startStr = extractYYYYMMDD(past7);
      endStr = extractYYYYMMDD(today);
    } else if (reportPeriodMode === "month") {
      const firstDay = new Date(selectedYear, selectedMonth, 1);
      const lastDay = new Date(selectedYear, selectedMonth + 1, 0);
      startStr = extractYYYYMMDD(firstDay);
      endStr = extractYYYYMMDD(lastDay);
    } else if (reportPeriodMode === "year") {
      startStr = `${selectedYear}-01-01`;
      endStr = `${selectedYear}-12-31`;
    }

    const isFiltering = reportPeriodMode !== "all" || !!startDate || !!endDate;

    return {
      isFiltering,
      reportPeriodMode,
      startStr,
      endStr,
      dateType,
    };
  }, [
    reportPeriodMode,
    startDate,
    endDate,
    selectedMonth,
    selectedYear,
    dateType,
  ]);

  const getCarTargetDate = useCallback(
    (car: Car): string | null => {
      if (!car) return null;
      if (reportView === "purchases") {
        return (
          extractYYYYMMDD(car.entryDate) ||
          extractYYYYMMDD((car as any).createdAt)
        );
      }
      if (
        reportView === "transfers-general" ||
        reportView === "transfers-daily"
      ) {
        return (
          extractYYYYMMDD(car.transferDate) ||
          extractYYYYMMDD(car.lastModified) ||
          extractYYYYMMDD(car.entryDate)
        );
      }
      if (reportView === "daily-entry") {
        return (
          extractYYYYMMDD(car.entryDate) ||
          extractYYYYMMDD((car as any).createdAt)
        );
      }
      if (reportView === "daily-exit") {
        return (
          extractYYYYMMDD(car.exitData?.exitDate) ||
          extractYYYYMMDD(car.lastModified)
        );
      }
      if (reportView === "showroom-inventory-cost") {
        return (
          extractYYYYMMDD(car.entryDate) ||
          extractYYYYMMDD((car as any).createdAt)
        );
      }
      if (dateType === "entry") {
        return (
          extractYYYYMMDD(car.entryDate) ||
          extractYYYYMMDD((car as any).createdAt)
        );
      }
      if (dateType === "exit") {
        return (
          extractYYYYMMDD(car.exitData?.exitDate) ||
          extractYYYYMMDD(car.entryDate) ||
          extractYYYYMMDD((car as any).createdAt)
        );
      }
      return car.isOutbound
        ? extractYYYYMMDD(car.exitData?.exitDate) ||
            extractYYYYMMDD(car.lastModified) ||
            extractYYYYMMDD(car.entryDate)
        : extractYYYYMMDD(car.entryDate) ||
            extractYYYYMMDD((car as any).createdAt) ||
            extractYYYYMMDD(car.lastModified);
    },
    [reportView, dateType],
  );

  const isCarInDateRange = useCallback(
    (car: Car): boolean => {
      if (!activeDateRange.isFiltering) return true;
      const targetDate = getCarTargetDate(car);
      if (!targetDate) {
        const fallback = extractYYYYMMDD(
          car.entryDate || car.lastModified || (car as any).createdAt,
        );
        if (!fallback) return false;
        return checkDateRange(
          fallback,
          activeDateRange.startStr,
          activeDateRange.endStr,
        );
      }
      return checkDateRange(
        targetDate,
        activeDateRange.startStr,
        activeDateRange.endStr,
      );
    },
    [activeDateRange, getCarTargetDate],
  );

  const computedMovementHistory = useMemo<MovementEvent[]>(() => {
    const events: MovementEvent[] = [];
    cars.forEach((car) => {
      // Exclude vehicles that have not arrived at the showroom yet from entry/exit history until confirmed
      const isNotArrived = isCarNotArrived(car);
      if (isNotArrived) return;

      const entryTs = car.entryDate || "2000-01-01T00:00:00.000Z";
      events.push({
        id: `in-${car.id}`,
        carId: car.id,
        type: "IN",
        timestamp: entryTs,
        brand: car.brand,
        model: car.model,
        color: car.color,
        vin: car.vin,
        cardNumber: car.cardNumber,
        price: car.price,
        costPrice: car.costPrice,
        supplier: car.supplier,
        isOutbound: false,
        notes: car.notes,
      });
      const isTransferVehicle = Boolean(
        car.transferNo ||
        car.transferDate ||
        (car as any).isTransfer ||
        car.status === CarStatus.IN_TRANSFER ||
        String(car.status) === "in_transfer" ||
        String(car.status) === "transferred" ||
        String(car.status) === "محولة" ||
        String(car.status) === "تحويل" ||
        car.exitData?.deliveryType === "TRANSPORT" ||
        String(car.exitData?.deliveryType) === "تحويل صادر" ||
        car.exitData?.saleType === "تحويل",
      );
      const isOutboundVehicle = Boolean(car.isOutbound || isTransferVehicle);
      const exitDateVal =
        car.exitData?.exitDate || car.transferDate || car.lastModified;
      if (isOutboundVehicle && exitDateVal) {
        const ts = exitDateVal.includes("T")
          ? exitDateVal
          : `${exitDateVal}T12:00:00.000Z`;
        events.push({
          id: `out-${car.id}`,
          carId: car.id,
          type: "OUT",
          timestamp: ts,
          brand: car.brand,
          model: car.model,
          color: car.color,
          vin: car.vin,
          cardNumber: car.cardNumber,
          price: car.price,
          costPrice: car.costPrice,
          supplier: car.supplier,
          isOutbound: true,
          notes: car.notes,
          seller: isTransferVehicle
            ? car.transferSender || car.exitData?.seller || "تحويل صادر"
            : car.exitData?.seller ||
              car.exitData?.representativeName ||
              car.seller ||
              "غير محدد",
          representativeName:
            car.exitData?.representativeName ||
            car.exitData?.seller ||
            car.seller ||
            car.transferSender ||
            "نظام",
          receiverName:
            car.exitData?.receiverName || car.transferReceiver || "جهة تحويل",
          receiverPhone: car.exitData?.receiverPhone,
          receiverId: car.exitData?.receiverId,
          deliveryType: isTransferVehicle
            ? "تحويل صادر"
            : car.exitData?.deliveryType || "مبيعات",
          transportCompany:
            car.exitData?.transportCompany ||
            (car as any).transportCompany ||
            car.transferNo ||
            "",
          notesExit:
            car.exitData?.notes ||
            (car.transferNo
              ? `تحويل بخطاب (${car.transferNo})`
              : isTransferVehicle
                ? "تحويل صادر"
                : ""),
          saleType: isTransferVehicle
            ? "تحويل"
            : car.exitData?.saleType || "مبيعات",
          bankName: car.exitData?.bankName || "",
        });
      }
    });
    return events.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  }, [cars]);

  const isCarNotForSale = (car: any): boolean => {
    return (
      car.status === CarStatus.NOT_FOR_SALE ||
      String(car.status) === "غير معروضة للبيع"
    );
  };

  const arabicMonths = useMemo(
    () => [
      "يناير (1)",
      "فبراير (2)",
      "مارس (3)",
      "أبريل (4)",
      "مايو (5)",
      "يونيو (6)",
      "يوليو (7)",
      "أغسطس (8)",
      "سبتمبر (9)",
      "أكتوبر (10)",
      "نوفمبر (11)",
      "ديسمبر (12)",
    ],
    [],
  );

  const yearsList = useMemo(() => {
    const current = new Date().getFullYear();
    const list = [];
    for (let y = current - 5; y <= current + 2; y++) {
      list.push(y);
    }
    return list;
  }, []);

  const exportMonthlyConsolidatedReport = async () => {
    const workbook = new ExcelJS.Workbook();
    const isRTL = excelDirection === "RTL";

    const formatHeaders = (ws: any) => {
      ws.getRow(1).height = 30;
      ws.getRow(1).eachCell((cell: any) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF1F2937" },
        };
        cell.font = {
          color: { argb: "FFFFFFFF" },
          bold: true,
          name: "Arial",
          size: 11,
        };
        cell.alignment = {
          vertical: "middle",
          horizontal: "center",
          readingOrder: isRTL ? "rtl" : "ltr",
        };
      });
    };

    if (monthlyMovementType === "IN") {
      // Sheet 1: Entries
      const worksheetEntries = workbook.addWorksheet("الوارد والدخول", {
        views: [{ rightToLeft: isRTL }],
      });

      worksheetEntries.columns = [
        { header: "م", key: "index", width: 6 },
        { header: "الماركة والموديل", key: "brandModel", width: 28 },
        { header: "اللون والموديل", key: "colorModel", width: 20 },
        { header: "رقم الهيكل", key: "vin", width: 20 },
        { header: "البطاقة الجمركية", key: "cardNumber", width: 18 },
        { header: "المورد", key: "supplier", width: 18 },
        { header: "تاريخ الدخول", key: "entryDate", width: 14 },
        { header: "ملاحظات", key: "notes", width: 25 },
      ];

      formatHeaders(worksheetEntries);

      monthlyStats.entries.forEach((car, index) => {
        worksheetEntries
          .addRow({
            index: index + 1,
            brandModel: formatVehicleDisplay(car),
            colorModel: `${car.color} | ${car.year}`,
            vin: car.vin,
            cardNumber: car.cardNumber || "-",
            supplier: car.supplier || "-",
            entryDate: car.entryDate ? car.entryDate.split("T")[0] : "-",
            notes: car.notes ? getCleanDelegateName(car.notes) : "-",
          })
          .eachCell((cell, colNumber) => {
            cell.alignment = {
              vertical: "middle",
              horizontal:
                colNumber === 1 || colNumber === 4 || colNumber === 7
                  ? "center"
                  : isRTL
                    ? "right"
                    : "left",
              readingOrder: isRTL ? "rtl" : "ltr",
            };
            cell.border = {
              top: { style: "thin", color: { argb: "FFE2E8F0" } },
              bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
              left: { style: "thin", color: { argb: "FFE2E8F0" } },
              right: { style: "thin", color: { argb: "FFE2E8F0" } },
            };
          });
      });
    } else {
      // Sheet 2: Exits
      const worksheetExits = workbook.addWorksheet("الصادر والخروج", {
        views: [{ rightToLeft: isRTL }],
      });

      worksheetExits.columns = [
        { header: "م", key: "index", width: 6 },
        { header: "الماركة والموديل", key: "brandModel", width: 28 },
        { header: "اللون والموديل", key: "colorModel", width: 20 },
        { header: "رقم الهيكل", key: "vin", width: 20 },
        { header: "العميل المستلم", key: "receiverName", width: 22 },
        { header: "تاريخ الخروج", key: "exitDate", width: 14 },
        { header: "المناديب/البائع", key: "seller", width: 18 },
        { header: "نوع الخروج وطريقة التوصيل", key: "deliveryType", width: 20 },
        { header: "ملاحظات الخروج", key: "exitNotes", width: 25 },
      ];

      formatHeaders(worksheetExits);

      monthlyStats.exits.forEach((car, index) => {
        worksheetExits
          .addRow({
            index: index + 1,
            brandModel: formatVehicleDisplay(car),
            colorModel: `${car.color} | ${car.year}`,
            vin: car.vin,
            receiverName:
              car.exitData?.receiverName || (car as any).receiverName || "-",
            exitDate: car.exitData?.exitDate || (car as any).exitDate || "-",
            seller:
              car.exitData?.seller ||
              car.exitData?.representativeName ||
              car.seller ||
              "-",
            deliveryType:
              car.exitData?.deliveryType || (car as any).deliveryType || "-",
            exitNotes: car.exitData?.notes || (car as any).exitNotes || "-",
          })
          .eachCell((cell, colNumber) => {
            cell.alignment = {
              vertical: "middle",
              horizontal:
                colNumber === 1 || colNumber === 4 || colNumber === 6
                  ? "center"
                  : isRTL
                    ? "right"
                    : "left",
              readingOrder: isRTL ? "rtl" : "ltr",
            };
            cell.border = {
              top: { style: "thin", color: { argb: "FFE2E8F0" } },
              bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
              left: { style: "thin", color: { argb: "FFE2E8F0" } },
              right: { style: "thin", color: { argb: "FFE2E8F0" } },
            };
          });
      });
    }

    workbook.worksheets.forEach((ws) => {
      ExcelService.formatWorksheet(ws, { isRTL });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const typeLabel =
      monthlyMovementType === "IN" ? "دخول_المركبات" : "خروج_المركبات";
    const fileName = `${settings.name}_تقرير_${typeLabel}_الشهري_${selectedYear}_${selectedMonth + 1}.xlsx`;
    const blob = new Blob([buffer]);
    saveAs(blob, fileName);
    try {
      await documentStorageService.verifyAndWriteToLocalFolder(
        fileName,
        blob,
        "reports",
      );
    } catch (err) {
      console.warn("Unified Storage Driver write error:", err);
    }
  };

  const getCarRowStyle = (car: any) => {
    const res = getCarRowStyleAndClass(car, settings);
    return {
      style: res.rowStyle,
      textClass: res.rowBgClass,
      ...res,
    };
  };

  const formatVehicleWithDelegate = (car: Car): string => {
    const baseName = formatVehicleDisplay(car);
    const rep = getReservationRepresentative(car);
    if (rep && rep !== "-" && rep !== "غير محدد" && !baseName.includes(rep)) {
      return `${baseName} (${rep})`;
    }
    return baseName;
  };

  const getCellValue = (car: Car, key: string): string => {
    if (key === "brand") return car.brand || "-";
    if (key === "model") return car.model || "-";
    if (key === "interiorColor" || key === "interior_color")
      return car.interiorColor || car.customData?.interiorColor || "-";
    if (key === "color") return car.color || "-";
    if (key === "year") return car.year ? String(car.year) : "-";
    if (key === "carRemark" || key === "car_remark") return car.carRemark || "-";
    if (key === "entry_transport_company")
      return (
        car.customData?.entryTransportCompany ||
        car.customData?.transportCompany ||
        "-"
      );
    if (key === "brand_model") {
      return formatVehicleWithDelegate(car);
    }
    if (key === "color_model") return `${car.color} | ${car.year}`;
    if (key === "vin") return car.vin;
    if (key === "vin_matching") {
      const raw = String(car.vinMatching || '').trim();
      return (raw === 'غير مطابق' || raw === 'غير متطابق' || raw === 'mismatch' || raw === 'غير_مطابق') ? 'غير متطابق' : 'متطابق';
    }
    if (key === "plateNumber") return car.plateData?.plateNumber || "-";
    if (key === "cardNumber") return car.cardNumber || "-";
    if (key === "owner") return car.ownershipType;
    if (key === "status") return car.status;
    if (key === "car_condition") return car.exitData?.carCondition || "-";
    if (key === "rental") return car.rentalStatus;
    if (key === "showroom")
      return car.isPresentInShowroom !== false ? "نعم" : "لا";
    if (key === "supplier") return car.supplier || "-";
    if (key === "entryDate")
      return car.entryDate
        ? new Date(car.entryDate).toLocaleDateString("ar-EG")
        : "-";
    if (key === "notes") {
      // "مندوب الحجز" merged column: previously this table had two separate
      // duplicate columns both labeled "مندوب الحجز" (key "notes" and key
      // "seller"), one only reading the reservation-time representative and
      // the other only reading the exit-time seller. They're now consolidated
      // into this single column, which draws from both data sources via
      // getRepresentativeOrSeller (reservation representative when the car is
      // reserved, exit seller/representative when it's sold, with car.notes
      // as a final fallback either way).
      return getRepresentativeOrSeller(car);
    }
    if (key === "attribution") return car.attributionSource || "-";
    if (key === "seller") return getRepresentativeOrSeller(car);
    if (key === "deliveryType") return car.exitData?.deliveryType || "-";
    if (key === "transport_company")
      return (
        car.customData?.entryTransportCompany ||
        car.exitData?.transportCompany ||
        "-"
      );
    if (key === "receiverName") return car.exitData?.receiverName || "-";
    if (key === "receiverId") return car.exitData?.receiverId || "-";
    if (key === "nationality") return car.exitData?.nationality || "-";
    if (key === "receiverPhone") return car.exitData?.receiverPhone || "-";
    if (key === "exitDate")
      return car.exitData?.exitDate
        ? new Date(car.exitData.exitDate).toLocaleDateString("ar-EG")
        : "-";
    if (key === "exitNotes") return car.exitData?.notes || "-";
    if (key === "costPrice")
      return !canViewFinancials
        ? "***"
        : car.costPrice !== undefined && car.costPrice !== null
          ? Number(car.costPrice).toLocaleString("en-US") + " ريال"
          : "0 ريال";
    if (key === "price")
      return !canViewFinancials
        ? "***"
        : car.price !== undefined && car.price !== null
          ? Number(car.price).toLocaleString("en-US") + " ريال"
          : "0 ريال";
    return car.customData?.[key] || "-";
  };

  const categoryOfReport: Record<ReportView, string> = {
    inventory: "inventory",
    "comprehensive-inventory": "inventory",
    "outside-showroom": "inventory",
    "physical-inventory": "inventory",
    "showroom-inventory-cost": "inventory",
    "non-rented": "inventory",
    "physical-inventory-summary": "inventory",
    "comprehensive-inventory-summary": "inventory",

    monthly: "movement",
    "monthly-entry": "movement",
    "monthly-exit": "movement",
    "daily-entry": "movement",
    "daily-exit": "movement",
    "daily-summary": "movement",
    "daily-movement-statement": "movement",

    analytics: "sales",
    delegates: "sales",
    "delegates-reports": "sales",
    "delegates-inventory-summary": "sales",

    purchases: "purchases_transfers",
    "supplier-analysis": "purchases_transfers",
    "transfers-general": "purchases_transfers",
    "transfers-daily": "purchases_transfers",
    "resilience-audit": "purchases_transfers",
  };

  const [activeCategory, setActiveCategory] = useState<
    "inventory" | "movement" | "sales" | "purchases_transfers"
  >(() => {
    return (categoryOfReport[reportView] as any) || "inventory";
  });

  React.useEffect(() => {
    if (categoryOfReport[reportView]) {
      setActiveCategory(categoryOfReport[reportView] as any);
    }
  }, [reportView]);

  // State hooks specifically for summary reports
  const [summarySearchQuery, setSummarySearchQuery] = useState("");
  const [summaryBrandOption, setSummaryBrandOption] = useState("all");
  const [summaryModelOption, setSummaryModelOption] = useState("all");
  const [summaryYardOption, setSummaryYardOption] = useState("all");
  const [summarySortBy, setSummarySortBy] = useState<
    "alpha-asc" | "alpha-desc" | "count-desc" | "count-asc"
  >("alpha-asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [columnsSaveSuccess, setColumnsSaveSuccess] = useState(false);
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [statementDate, setStatementDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const [dailyReportDate, setDailyReportDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const [summaryDaysCount, setSummaryDaysCount] = useState<number>(30);
  const [excelDirection, setExcelDirection] = useState<"RTL" | "LTR">(() => {
    try {
      const saved = localStorage.getItem("excel_export_direction");
      return saved === "LTR" ? "LTR" : "RTL";
    } catch {
      return "RTL";
    }
  });
  const parsedStatementSummary = useMemo(() => {
    return DailyAutoCalculator.calculateForDate(
      cars,
      statementDate,
      computedMovementHistory,
    );
  }, [cars, statementDate, computedMovementHistory]);
  const [orientation, setOrientation] = useState<PrintOrientation>(() => {
    try {
      const persisted =
        loadTableLayout(`reports_${reportView}`) || loadTableLayout("reports");
      return (persisted?.orientation as PrintOrientation) || "landscape";
    } catch {
      return "landscape";
    }
  });

  // CRITICAL: Ensure all reports fetch and reflect live, authoritative database values
  useEffect(() => {
    let isMounted = true;
    CarApiService.fetchCars().then((dbCars) => {
      if (isMounted && Array.isArray(dbCars) && dbCars.length > 0 && onUpdateCars) {
        onUpdateCars(dbCars);
      }
    }).catch((err) => {
      console.warn('[Reports] Database sync on report view:', err);
    });
    return () => {
      isMounted = false;
    };
  }, [reportView]);

  useEffect(() => {
    if (startDate) {
      const formatted = extractYYYYMMDD(startDate);
      if (formatted) {
        setDailyReportDate(formatted);
        setStatementDate(formatted);
      }
    }
  }, [startDate]);

  const [showPdfMenu, setShowPdfMenu] = useState(false);
  const [brandChartType, setBrandChartType] = useState<"bar" | "pie" | "trend">(
    "bar",
  );

  const uniqueBrands = useMemo(
    () => Array.from(new Set(cars.map((c) => c.brand).filter(Boolean))).sort(),
    [cars],
  );
  const uniqueModels = useMemo(() => {
    const list = filterBrand
      ? cars.filter((c) => c.brand === filterBrand)
      : cars;
    return Array.from(new Set(list.map((c) => c.model).filter(Boolean))).sort();
  }, [cars, filterBrand]);
  const uniqueSuppliers = useMemo(
    () =>
      Array.from(new Set(cars.map((c) => c.supplier).filter(Boolean))).sort(),
    [cars],
  );
  const uniqueBranches = useMemo(() => {
    const list = cars.map((c) => c.customData?.branch || "").filter(Boolean);
    return Array.from(new Set(list)).sort();
  }, [cars]);

  // Delegate statistics states & hook
  const [activeDelegatesTab, setActiveDelegatesTab] = useState<
    "analytics" | "management"
  >("analytics");
  const [delegateSearchQuery, setDelegateSearchQuery] = useState("");
  const [editingDelegate, setEditingDelegate] = useState<any | null>(null);
  const [showDelegateModal, setShowDelegateModal] = useState<boolean>(false);
  const [showEditSaleModal, setShowEditSaleModal] = useState<boolean>(false);
  const [editingSaleCar, setEditingSaleCar] = useState<Car | null>(null);
  const [saleForm, setSaleForm] = useState({
    price: 0,
    exitDate: "",
    seller: "",
    representativeName: "",
    notes: "",
    saleType: "",
    bankName: "",
  });
  const [delegateForm, setDelegateForm] = useState({
    username: "",
    phone: "",
    email: "",
    specialty: "مبيعات",
    status: "active",
    target: 10,
  });
  const [delegatePeriod, setDelegatePeriod] = useState<
    "this-month" | "this-quarter" | "all"
  >("this-month");
  const [selectedDelegate, setSelectedDelegate] = useState<string | null>(null);
  const [delegateChartType, setDelegateChartType] = useState<
    "sales" | "revenue" | "commissions"
  >("sales");
  const [defaultCommission, setDefaultCommission] = useState<number>(500);
  const [commissionType, setCommissionType] = useState<"fixed" | "percentage">(
    "fixed",
  );
  const [defaultPercent, setDefaultPercent] = useState<number>(0.5);
  const [salesTarget, setSalesTarget] = useState<number>(10);
  const [showroomTarget, setShowroomTarget] = useState<number>(35);

  const [supplierSearchQuery, setSupplierSearchQuery] = useState("");
  const [selectedSupplierDetail, setSelectedSupplierDetail] = useState<
    any | null
  >(null);

  const [inventoryCostDate, setInventoryCostDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const [inventoryCostBrandFilter, setInventoryCostBrandFilter] =
    useState<string>("all");

  // Interactive BI Redesigned Analytics States
  const [analyticsSubTab, setAnalyticsSubTab] = useState<string>("executive");
  const [analyticsBrandSort, setAnalyticsBrandSort] = useState<
    "high-to-low" | "low-to-high" | "exits" | "inventory" | "profitability"
  >("high-to-low");
  const [analyticsModelSort, setAnalyticsModelSort] = useState<
    "alpha" | "available-desc" | "sold-desc" | "stay-desc"
  >("alpha");
  const [analyticsSupplierSort, setAnalyticsSupplierSort] = useState<
    "supplied-desc" | "supplied-asc" | "sold-desc" | "profit-desc"
  >("supplied-desc");
  const [analyticsSearchQuery, setAnalyticsSearchQuery] = useState<string>("");
  const [stagnantLimitDays, setStagnantLimitDays] = useState<number>(60);

  const showroomCostData = useMemo(() => {
    const selDate = new Date(inventoryCostDate);
    selDate.setHours(23, 59, 59, 999);

    const filtered = cars.filter((car) => {
      if (!car.entryDate) return false;
      const entryDateObj = new Date(car.entryDate);
      if (entryDateObj > selDate) return false;

      const hasExited = car.isOutbound || car.exitData?.exitDate;
      if (hasExited) {
        const exitDateStr = car.exitData?.exitDate || (car as any).exitDate;
        if (exitDateStr) {
          const exitDateObj = new Date(exitDateStr);
          if (exitDateObj <= selDate) return false;
        }
      }

      if (inventoryCostBrandFilter !== "all") {
        const cleanB = getCleanBrandName(car.brand);
        const cleanF = getCleanBrandName(inventoryCostBrandFilter);
        if (cleanB !== cleanF) return false;
      }

      return true;
    });

    const groups: Record<
      string,
      { brand: string; count: number; totalCost: number; cars: Car[] }
    > = {};
    let totalAllCost = 0;

    filtered.forEach((car) => {
      const brandName = getCleanBrandName(car.brand) || "غير محدد";
      const cost = car.costPrice ? Number(car.costPrice) : 0;
      totalAllCost += cost;

      if (!groups[brandName]) {
        groups[brandName] = {
          brand: car.brand || "غير محدد",
          count: 0,
          totalCost: 0,
          cars: [],
        };
      }
      groups[brandName].count += 1;
      groups[brandName].totalCost += cost;
      groups[brandName].cars.push(car);
    });

    const brandList = Object.values(groups).filter((g) => g.count > 0);
    brandList.sort((a, b) => b.totalCost - a.totalCost);

    return {
      filteredCars: filtered,
      totalVehicles: filtered.length,
      totalCost: totalAllCost,
      avgCost:
        filtered.length > 0 ? Math.round(totalAllCost / filtered.length) : 0,
      brandList,
    };
  }, [cars, inventoryCostDate, inventoryCostBrandFilter]);

  const delegatesStats = useMemo(() => {
    let targetCars = cars.filter((c) => c.isOutbound && !isCarNotArrived(c)); // sold/exited cars

    if (activeDateRange.isFiltering) {
      targetCars = targetCars.filter((c) => {
        const exitDateStr =
          extractYYYYMMDD(c.exitData?.exitDate) ||
          extractYYYYMMDD(c.lastModified) ||
          extractYYYYMMDD(c.entryDate);
        if (!exitDateStr) return false;
        return checkDateRange(
          exitDateStr,
          activeDateRange.startStr,
          activeDateRange.endStr,
        );
      });
    } else {
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      const startOfQuarterMonth = Math.floor(today.getMonth() / 3) * 3;

      if (delegatePeriod === "this-month") {
        targetCars = targetCars.filter((c) => {
          const exitDateStr = extractYYYYMMDD(c.exitData?.exitDate);
          if (!exitDateStr) return false;
          const d = new Date(exitDateStr);
          return (
            d.getMonth() === currentMonth && d.getFullYear() === currentYear
          );
        });
      } else if (delegatePeriod === "this-quarter") {
        targetCars = targetCars.filter((c) => {
          const exitDateStr = extractYYYYMMDD(c.exitData?.exitDate);
          if (!exitDateStr) return false;
          const d = new Date(exitDateStr);
          return (
            d.getFullYear() === currentYear &&
            d.getMonth() >= startOfQuarterMonth
          );
        });
      }
    }

    const delegateGroups: Record<
      string,
      {
        name: string;
        cars: Car[];
        totalSales: number;
        totalAmount: number;
        cashSales: number;
        bankSales: number;
        financeSales: number;
        showroomSales: number;
      }
    > = {};

    targetCars.forEach((car) => {
      const delegateName =
        car.exitData?.seller ||
        car.exitData?.representativeName ||
        car.seller ||
        "غير محدد";
      if (!delegateGroups[delegateName]) {
        delegateGroups[delegateName] = {
          name: delegateName,
          cars: [],
          totalSales: 0,
          totalAmount: 0,
          cashSales: 0,
          bankSales: 0,
          financeSales: 0,
          showroomSales: 0,
        };
      }

      const group = delegateGroups[delegateName];
      group.cars.push(car);
      group.totalSales += 1;
      group.totalAmount += Number(car.price) || 0;

      const norm = getNormalizedSaleTypeAndBank(car);
      const saleType = norm.saleType;
      if (saleType === "عميل كاش") {
        group.cashSales += 1;
      } else if (saleType === "عميل بنك") {
        group.bankSales += 1;
      } else if (saleType === "شركة تمويل") {
        group.financeSales += 1;
      } else if (saleType === "معرض") {
        group.showroomSales += 1;
      }
    });

    const sortedDelegates = Object.values(delegateGroups).sort(
      (a, b) => b.totalSales - a.totalSales,
    );
    return {
      delegates: sortedDelegates,
      totalSalesInPeriod: targetCars.length,
      totalAmountInPeriod: targetCars.reduce(
        (acc, c) => acc + (Number(c.price) || 0),
        0,
      ),
    };
  }, [cars, delegatePeriod, activeDateRange]);

  const loadedReportViewRef = React.useRef<ReportView>(reportView);

  const [fontSize, setFontSize] = useState<number>(() => {
    try {
      const persisted =
        loadTableLayout(`reports_${reportView}`) || loadTableLayout("reports");
      return persisted?.fontSize !== undefined ? persisted.fontSize : 9;
    } catch {
      return 9;
    }
  });
  const [tableDensity, setTableDensity] = useState<
    "compact" | "normal" | "relaxed"
  >(() => {
    try {
      const persisted =
        loadTableLayout(`reports_${reportView}`) || loadTableLayout("reports");
      return persisted?.tableDensity || "compact";
    } catch {
      return "compact";
    }
  });
  const [showStampArea, setShowStampArea] = useState<boolean>(() => {
    try {
      const persisted =
        loadTableLayout(`reports_${reportView}`) || loadTableLayout("reports");
      return persisted?.showStampArea !== undefined
        ? persisted.showStampArea
        : true;
    } catch {
      return true;
    }
  });
  const [showOrgLogo, setShowOrgLogo] = useState<boolean>(() => {
    try {
      const persisted =
        loadTableLayout(`reports_${reportView}`) || loadTableLayout("reports");
      return persisted?.showOrgLogo !== undefined
        ? persisted.showOrgLogo
        : true;
    } catch {
      return true;
    }
  });

  const getReportsColumns = (rtView: ReportView = reportView) => {
    const isVisible = (key: string) => {
      if (!settings.reportsColumnsVisible) return true;
      return settings.reportsColumnsVisible[key] !== false;
    };

    const repCustomFields =
      settings.reportsCustomFields && settings.reportsCustomFields.length > 0
        ? settings.reportsCustomFields
        : settings.customFields;

    const defaultCols: ColumnConfig[] = [
      {
        key: "brand",
        label: "الماركة",
        visible: isVisible("brand"),
        width: "10%",
      },
      {
        key: "model",
        label: "الموديل",
        visible: isVisible("model"),
        width: "12%",
      },
      {
        key: "year",
        label: "سنة الصنع",
        visible: isVisible("year"),
        width: "6%",
      },
      {
        key: "interiorColor",
        label: "اللون الداخلي",
        visible: isVisible("interiorColor"),
        width: "8%",
      },
      {
        key: "color",
        label: "اللون الخارجي",
        visible: isVisible("color"),
        width: "8%",
      },
      {
        key: "vin",
        label: "رقم الهيكل",
        visible: isVisible("vin"),
        width: "12%",
      },
      {
        key: "cardNumber",
        label: "البطاقة الجمركية",
        visible: isVisible("cardNumber"),
        width: "10%",
      },
      {
        key: "vin_matching",
        label: "تطابق الهيكل",
        visible: isVisible("vin_matching"),
        width: "8%",
      },
      {
        key: "plateNumber",
        label: "رقم اللوحة",
        visible: isVisible("plateNumber"),
        width: "8%",
      },
      {
        key: "notes",
        label: "مندوب الحجز",
        visible: isVisible("notes"),
        width: "10%",
      },
      {
        key: "carRemark",
        label: "ملاحظات السيارة",
        visible: isVisible("carRemark"),
        width: "10%",
      },
      {
        key: "attribution",
        label: "وارد السيارة",
        visible: isVisible("attribution"),
        width: "8%",
      },
      {
        key: "owner",
        label: "المالك",
        visible: isVisible("owner"),
        width: "8%",
      },
      {
        key: "status",
        label: "حالة السيارة",
        visible: isVisible("status"),
        width: "8%",
      },
      {
        key: "rental",
        label: "حالة التجير",
        visible: isVisible("rental"),
        width: "8%",
      },
      {
        key: "showroom",
        label: "التواجد بالمعرض",
        visible: isVisible("showroom"),
        width: "8%",
      },
      {
        key: "supplier",
        label: "المورد",
        visible: isVisible("supplier"),
        width: "8%",
      },
      {
        key: "entryDate",
        label: "تاريخ الدخول",
        visible: isVisible("entryDate"),
        width: "10%",
      },
      {
        key: "entry_transport_company",
        label: "شركة نقليات الدخول",
        visible: isVisible("entry_transport_company"),
        width: "10%",
      },
      {
        key: "deliveryType",
        label: "نوع المستلم",
        visible: isVisible("deliveryType"),
        width: "8%",
      },
      {
        key: "transport_company",
        label: "شركة النقليات",
        visible: isVisible("transport_company"),
        width: "10%",
      },
      {
        key: "receiverName",
        label: "العميل",
        visible: isVisible("receiverName"),
        width: "10%",
      },
      {
        key: "receiverId",
        label: "هوية العميل",
        visible: isVisible("receiverId"),
        width: "10%",
      },
      {
        key: "nationality",
        label: "الجنسية",
        visible: isVisible("nationality"),
        width: "8%",
      },
      {
        key: "receiverPhone",
        label: "رقم الهاتف",
        visible: isVisible("receiverPhone"),
        width: "10%",
      },
      {
        key: "exitDate",
        label: "تاريخ الخروج",
        visible: isVisible("exitDate"),
        width: "10%",
      },
      {
        key: "exitNotes",
        label: "ملاحظات الخروج",
        visible: isVisible("exitNotes"),
        width: "12%",
      },
      ...(repCustomFields || []).map((f) => ({
        key: f.id,
        label: f.label,
        visible: true,
        width: "8%",
      })),
      {
        key: "costPrice",
        label: "التكلفة",
        visible: canViewFinancials && isVisible("costPrice"),
        width: "8%",
      },
      {
        key: "price",
        label: "السعر",
        visible: canViewFinancials && isVisible("price"),
        width: "8%",
      },
    ];

    try {
      const persisted = loadTableLayout(`reports_${rtView}`);
      const hasLegacyAggregatedCols =
        persisted &&
        Array.isArray(persisted.columns) &&
        persisted.columns.some(
          (pCol: any) =>
            pCol.key === "brand_model" ||
            pCol.key === "color_model" ||
            pCol.key === "grade" ||
            pCol.key === "saleType" ||
            pCol.key === "bankName" ||
            pCol.key === "sale_type" ||
            pCol.key === "bank_name",
        );
      if (persisted && Array.isArray(persisted.columns) && !hasLegacyAggregatedCols) {
        const reorderedCols: ColumnConfig[] = [];
        persisted.columns.forEach((pCol: any) => {
          if (
            pCol.key === "saleType" ||
            pCol.key === "bankName" ||
            pCol.key === "sale_type" ||
            pCol.key === "bank_name"
          )
            return;
          const match = defaultCols.find((d) => d.key === pCol.key);
          if (match) {
            reorderedCols.push({
              ...match,
              visible:
                pCol.visible !== undefined ? pCol.visible : match.visible,
              width: pCol.width || match.width,
            });
          }
        });
        defaultCols.forEach((dCol) => {
          if (!reorderedCols.some((rc) => rc.key === dCol.key)) {
            reorderedCols.push(dCol);
          }
        });

        // Ensure 'year' (سنة الصنع) is positioned immediately after 'model' (الموديل)
        const modelIdx = reorderedCols.findIndex((c) => c.key === "model");
        const yearIdx = reorderedCols.findIndex((c) => c.key === "year");
        if (modelIdx !== -1 && yearIdx !== -1 && yearIdx !== modelIdx + 1) {
          const [yearCol] = reorderedCols.splice(yearIdx, 1);
          const newModelIdx = reorderedCols.findIndex((c) => c.key === "model");
          reorderedCols.splice(newModelIdx + 1, 0, yearCol);
        }

        return reorderedCols.filter(
          (c) =>
            c.key !== "saleType" &&
            c.key !== "bankName" &&
            c.key !== "sale_type" &&
            c.key !== "bank_name" &&
            c.key !== "seq" &&
            c.key !== "index",
        );
      }
    } catch (e) {
      console.warn("[Reports] Failed to apply persisted reports columns:", e);
    }

    return defaultCols.filter(
      (c) =>
        c.key !== "saleType" &&
        c.key !== "bankName" &&
        c.key !== "sale_type" &&
        c.key !== "bank_name" &&
        c.key !== "seq" &&
        c.key !== "index",
    );
  };

  const [columns, setColumns] = useState<ColumnConfig[]>(() =>
    getReportsColumns(reportView),
  );

  React.useEffect(() => {
    setColumns(getReportsColumns(reportView));
  }, [
    settings.reportsColumnsVisible,
    settings.reportsCustomFields,
    settings.customFields,
    canViewFinancials,
  ]);

  // Handle loading and applying report-specific settings on tab change
  React.useEffect(() => {
    try {
      const layoutKey = `reports_${reportView}`;
      const persisted = loadTableLayout(layoutKey);
      const legacyPersisted = loadTableLayout("reports");
      const data = persisted || legacyPersisted;

      // Force columns to load for the specific reportView
      setColumns(getReportsColumns(reportView));

      setFontSize(data?.fontSize !== undefined ? data.fontSize : 9);
      setTableDensity(data?.tableDensity || "compact");
      setShowStampArea(
        data?.showStampArea !== undefined ? data.showStampArea : true,
      );
      setShowOrgLogo(data?.showOrgLogo !== undefined ? data.showOrgLogo : true);
      setOrientation((data?.orientation as PrintOrientation) || "landscape");

      if (data?.filters) {
        setStartDate(data.filters.startDate || "");
        setEndDate(data.filters.endDate || "");
        setDateType((data.filters.dateType as DateFilterType) || "all");
        setSelectedDelegateFilter(data.filters.selectedDelegateFilter || "all");
        setFilterBrand(data.filters.filterBrand || "");
        setFilterModel(data.filters.filterModel || "");
        setFilterSupplier(data.filters.filterSupplier || "");
        setFilterExitType(data.filters.filterExitType || "");
        setFilterBranch(data.filters.filterBranch || "");
        setSalesDateFilterType(data.filters.salesDateFilterType || "all");
        setReportPeriodMode(data.filters.reportPeriodMode || "all");
      } else {
        setStartDate("");
        setEndDate("");
        setDateType("all");
        setSelectedDelegateFilter("all");
        setFilterBrand("");
        setFilterModel("");
        setFilterSupplier("");
        setFilterExitType("");
        setFilterBranch("");
        setSalesDateFilterType("all");
        setReportPeriodMode("all");
      }

      // Mark that this reportView layout has finished initial loading
      loadedReportViewRef.current = reportView;
    } catch (e) {
      console.error(
        "[Reports] Failed to loaded layout on reportView switch:",
        e,
      );
    }
  }, [reportView]);

  // Auto-save reports table settings, printing details, orientation, and active filters immediately on state changes
  React.useEffect(() => {
    if (loadedReportViewRef.current !== reportView) {
      return; // prevent overwriting settings with stale previous states during tab switch
    }
    try {
      const layoutKey = `reports_${reportView}`;
      saveTableLayout(layoutKey, {
        columns: columns.map(({ key, label, visible, width }) => ({
          key,
          label,
          visible,
          width,
        })),
        fontSize,
        tableDensity,
        showStampArea,
        showOrgLogo,
        orientation,
        filters: {
          startDate,
          endDate,
          dateType,
          selectedDelegateFilter,
          filterBrand,
          filterModel,
          filterSupplier,
          filterExitType,
          filterBranch,
          salesDateFilterType,
          reportPeriodMode,
        },
      });
    } catch (e) {
      console.error("[Reports] Auto-persist error:", e);
    }
  }, [
    reportView,
    columns,
    fontSize,
    tableDensity,
    showStampArea,
    showOrgLogo,
    orientation,
    startDate,
    endDate,
    dateType,
    selectedDelegateFilter,
    filterBrand,
    filterModel,
    filterSupplier,
    filterExitType,
    filterBranch,
    salesDateFilterType,
    reportPeriodMode,
  ]);

  const activeColumns = useMemo(
    () => columns.filter((c) => c.visible),
    [columns],
  );

  const monthlyStats = useMemo(() => {
    const isFiltering = activeDateRange.isFiltering;

    const entries = computedMovementHistory
      .filter((m) => {
        if (m.type !== "IN") return false;
        if (isFiltering) {
          const dStr = extractYYYYMMDD(m.timestamp);
          if (!dStr) return false;
          return checkDateRange(
            dStr,
            activeDateRange.startStr,
            activeDateRange.endStr,
          );
        }
        const d = new Date(m.timestamp);
        return (
          d.getMonth() === selectedMonth && d.getFullYear() === selectedYear
        );
      })
      .map((m) => mapMovementEventToCar(m, cars))
      .sort(sortCarsUnderBrand);

    const exits = computedMovementHistory
      .filter((m) => {
        if (m.type !== "OUT") return false;
        if (isFiltering) {
          const dStr = extractYYYYMMDD(m.timestamp);
          if (!dStr) return false;
          return checkDateRange(
            dStr,
            activeDateRange.startStr,
            activeDateRange.endStr,
          );
        }
        const d = new Date(m.timestamp);
        return (
          d.getMonth() === selectedMonth && d.getFullYear() === selectedYear
        );
      })
      .map((m) => mapMovementEventToCar(m, cars))
      .sort(sortCarsUnderBrand);

    return { entries, exits };
  }, [
    cars,
    computedMovementHistory,
    selectedMonth,
    selectedYear,
    activeDateRange,
  ]);

  const dailyStats = useMemo(() => {
    const targetDate = dailyReportDate;

    const entries = computedMovementHistory
      .filter(
        (m) => m.type === "IN" && m.timestamp?.split("T")[0] === targetDate,
      )
      .map((m) => mapMovementEventToCar(m, cars))
      .sort(sortCarsUnderBrand);

    const exits = computedMovementHistory
      .filter(
        (m) => m.type === "OUT" && m.timestamp?.split("T")[0] === targetDate,
      )
      .map((m) => mapMovementEventToCar(m, cars))
      .sort(sortCarsUnderBrand);

    return { entries, exits };
  }, [cars, computedMovementHistory, dailyReportDate]);

  const toggleColumn = (key: string) => {
    setColumns((prev) =>
      prev.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)),
    );
  };

  const moveColumn = (index: number, direction: "up" | "down") => {
    setColumns((prev) => {
      const newCols = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newCols.length) return prev;

      const temp = newCols[index];
      newCols[index] = newCols[targetIndex];
      newCols[targetIndex] = temp;
      return newCols;
    });
  };

  const adjustColumnWidth = (key: string, amount: number) => {
    setColumns((prev) =>
      prev.map((c) => {
        if (c.key === key) {
          const currentVal = parseInt(c.width || "10", 10) || 10;
          const newVal = Math.max(4, Math.min(40, currentVal + amount));
          return { ...c, width: `${newVal}%` };
        }
        return c;
      }),
    );
  };

  const resetDefaultColumns = () => {
    try {
      const defaultCols = getReportsColumns(reportView);
      setColumns(defaultCols);

      const layoutKey = `reports_${reportView}`;
      saveTableLayout(layoutKey, {
        columns: defaultCols,
        fontSize,
        tableDensity,
        showStampArea,
        showOrgLogo,
        orientation,
        filters: {
          startDate,
          endDate,
          dateType,
          selectedDelegateFilter,
          filterBrand,
          filterModel,
          filterSupplier,
          filterExitType,
          filterBranch,
        },
      });

      setColumnsSaveSuccess(true);
      setTimeout(() => setColumnsSaveSuccess(false), 2000);
    } catch (e) {
      console.error("[Reports] Reset columns error:", e);
    }
  };

  const currentDaySummary = useMemo(() => {
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return DailyAutoCalculator.calculateForDate(
      cars,
      todayStr,
      computedMovementHistory,
    );
  }, [cars, computedMovementHistory]);

  const dailyHistory = useMemo(() => {
    return DailyAutoCalculator.generateHistory(
      cars,
      summaryDaysCount,
      computedMovementHistory,
    );
  }, [cars, summaryDaysCount, computedMovementHistory]);

  const movementPercent = useMemo(() => {
    if (currentDaySummary.openingBalance === 0) return 0;
    return (
      ((currentDaySummary.enteredCount + currentDaySummary.exitedCount) /
        currentDaySummary.openingBalance) *
      100
    );
  }, [currentDaySummary]);

  const activePeriodDates = useMemo(() => {
    if (
      activeDateRange.isFiltering &&
      (activeDateRange.startStr || activeDateRange.endStr)
    ) {
      return {
        startDate: activeDateRange.startStr || "",
        endDate: activeDateRange.endStr || "",
      };
    }

    const today = new Date();
    let start = new Date();
    let end = today;

    if (analyticsPeriod === "this-month") {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (analyticsPeriod === "last-30-days") {
      start = new Date();
      start.setDate(today.getDate() - 30);
    } else if (analyticsPeriod === "this-quarter") {
      const currentQuarterMonth = Math.floor(today.getMonth() / 3) * 3;
      start = new Date(today.getFullYear(), currentQuarterMonth, 1);
    } else if (analyticsPeriod === "this-year") {
      start = new Date(today.getFullYear(), 0, 1);
    } else if (analyticsPeriod === "custom") {
      return {
        startDate: analyticsStartDate,
        endDate: analyticsEndDate,
      };
    }

    return {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    };
  }, [activeDateRange, analyticsPeriod, analyticsStartDate, analyticsEndDate]);

  const analyticsData = useMemo(() => {
    const start = activePeriodDates.startDate
      ? new Date(activePeriodDates.startDate)
      : null;
    const end = activePeriodDates.endDate
      ? new Date(activePeriodDates.endDate)
      : null;

    const isWithinRange = (dateStr?: string) => {
      if (!dateStr) return false;
      const date = new Date(dateStr.split("T")[0]); // ignore time portion
      if (start && date < start) return false;
      if (end && date > end) return false;
      return true;
    };

    // Build lists of entered and exited cars in current range matching advanced filters
    const enteredCarsInPeriod = cars
      .filter((c) => {
        if (isCarNotArrived(c)) return false;
        if (!isWithinRange(c.entryDate)) return false;
        if (filterBrand && c.brand !== filterBrand) return false;
        if (filterModel && c.model !== filterModel) return false;
        if (filterSupplier && c.supplier !== filterSupplier) return false;
        const valBranch = c.customData?.branch || "";
        if (
          filterBranch &&
          valBranch.indexOf(filterBranch) === -1 &&
          (c.notes || "").indexOf(filterBranch) === -1
        )
          return false;
        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.entryDate || 0).getTime();
        const timeB = new Date(b.entryDate || 0).getTime();
        return (
          timeB - timeA ||
          a.brand.localeCompare(b.brand, "ar") ||
          a.model.localeCompare(b.model, "ar")
        );
      });

    const exitedCarsInPeriod = cars
      .filter((c) => {
        if (!c.isOutbound || !isWithinRange(c.exitData?.exitDate)) return false;
        if (filterBrand && c.brand !== filterBrand) return false;
        if (filterModel && c.model !== filterModel) return false;
        if (filterSupplier && c.supplier !== filterSupplier) return false;
        if (
          filterExitType &&
          getNormalizedSaleTypeAndBank(c).saleType !== filterExitType
        )
          return false;
        const valBranch = c.customData?.branch || "";
        if (
          filterBranch &&
          valBranch.indexOf(filterBranch) === -1 &&
          (c.notes || "").indexOf(filterBranch) === -1
        )
          return false;
        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.exitData?.exitDate || 0).getTime();
        const timeB = new Date(b.exitData?.exitDate || 0).getTime();
        return (
          timeB - timeA ||
          a.brand.localeCompare(b.brand, "ar") ||
          a.model.localeCompare(b.model, "ar")
        );
      });

    // --- PREVIOUS MONTH COMPARISON METRICS ---
    const prevStart = start ? new Date(start) : null;
    if (prevStart) prevStart.setMonth(prevStart.getMonth() - 1);
    const prevEnd = end ? new Date(end) : null;
    if (prevEnd) prevEnd.setMonth(prevEnd.getMonth() - 1);

    const isWithinPrevRange = (dateStr?: string) => {
      if (!dateStr) return false;
      const date = new Date(dateStr.split("T")[0]);
      if (prevStart && date < prevStart) return false;
      if (prevEnd && date > prevEnd) return false;
      return true;
    };

    const exitedCarsPrevPeriod = cars.filter((c) => {
      if (!c.isOutbound || !isWithinPrevRange(c.exitData?.exitDate))
        return false;
      if (filterBrand && c.brand !== filterBrand) return false;
      if (filterModel && c.model !== filterModel) return false;
      if (filterSupplier && c.supplier !== filterSupplier) return false;
      if (
        filterExitType &&
        getNormalizedSaleTypeAndBank(c).saleType !== filterExitType
      )
        return false;
      const valBranch = c.customData?.branch || "";
      if (
        filterBranch &&
        valBranch.indexOf(filterBranch) === -1 &&
        (c.notes || "").indexOf(filterBranch) === -1
      )
        return false;
      return true;
    });

    // Brand counts for previous month to do trend comparison
    const brandExitsPrev: Record<string, number> = {};
    exitedCarsPrevPeriod.forEach((car) => {
      const b = car.brand || "غير محدد";
      brandExitsPrev[b] = (brandExitsPrev[b] || 0) + 1;
    });

    // 1. TOP BRANDS DEMAND (Current period)
    const brandDemandCounts: Record<string, number> = {};
    exitedCarsInPeriod.forEach((car) => {
      const b = car.brand || "غير محدد";
      brandDemandCounts[b] = (brandDemandCounts[b] || 0) + 1;
    });

    const sortedBrandsDemand = Object.entries(brandDemandCounts)
      .map(([brand, count]) => {
        const prevCount = brandExitsPrev[brand] || 0;
        let trend: "up" | "down" | "stable" = "stable";
        if (count > prevCount) trend = "up";
        else if (count < prevCount) trend = "down";

        const diff = count - prevCount;
        const pctChange =
          prevCount > 0 ? (diff / prevCount) * 100 : count > 0 ? 100 : 0;
        return { brand, count, prevCount, trend, pctChange, diff };
      })
      .sort(
        (a, b) => b.count - a.count || a.brand.localeCompare(b.brand, "ar"),
      );

    // 2. TOP MODELS DEMAND (Current period)
    const modelDemandCounts: Record<
      string,
      {
        count: number;
        brand: string;
        model: string;
        stayDurations: number[];
      }
    > = {};
    exitedCarsInPeriod.forEach((car) => {
      const brand = car.brand || "غير محدد";
      const model = car.model || "طراز عام";
      const modelKey = `${brand} - ${model}`;

      if (!modelDemandCounts[modelKey]) {
        modelDemandCounts[modelKey] = {
          count: 0,
          brand,
          model,
          stayDurations: [],
        };
      }
      modelDemandCounts[modelKey].count += 1;

      // Calculate stay duration if entryDate and exitDate are available
      if (car.entryDate && car.exitData?.exitDate) {
        const entry = new Date(car.entryDate.split("T")[0]);
        const exit = new Date(car.exitData.exitDate);
        const stayDays = Math.max(
          1,
          Math.round(
            (exit.getTime() - entry.getTime()) / (1000 * 60 * 60 * 24),
          ),
        );
        modelDemandCounts[modelKey].stayDurations.push(stayDays);
      }
    });

    const sortedModelsDemand = Object.entries(modelDemandCounts)
      .map(([key, item]) => {
        const avgStay =
          item.stayDurations.length > 0
            ? Math.round(
                (item.stayDurations.reduce((a, b) => a + b, 0) /
                  item.stayDurations.length) *
                  10,
              ) / 10
            : null;
        return {
          key,
          brand: item.brand,
          model: item.model,
          count: item.count,
          avgStay,
          speedTag:
            avgStay !== null
              ? avgStay <= 4
                ? "سريعة جداً"
                : avgStay <= 10
                  ? "سريعة الدوران"
                  : "متوسطة"
              : "غير متوفر",
        };
      })
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, "ar"));

    // 3. EXIT TYPE ANALYSIS (Comparing Retail vs Showroom vs Financing)
    let retailCount = 0;
    let showroomCount = 0;
    let financeCount = 0;
    let otherExitCount = 0;

    exitedCarsInPeriod.forEach((car) => {
      const sType = getNormalizedSaleTypeAndBank(car).saleType;
      if (sType === "عميل كاش" || sType === "عميل بنك") {
        retailCount++;
      } else if (sType === "معرض") {
        showroomCount++;
      } else if (sType === "شركة تمويل") {
        financeCount++;
      } else {
        otherExitCount++;
      }
    });

    const exitTypesDistribution = [
      {
        name: "العملاء الأفراد (كاش وبنك)",
        value: retailCount,
        color: "#3b82f6",
      },
      { name: "المعارض والتجار", value: showroomCount, color: "#f59e0b" },
      { name: "شركات التمويل والشركاء", value: financeCount, color: "#10b981" },
      { name: "أخرى / غير مصنف", value: otherExitCount, color: "#6b7280" },
    ].filter((item) => item.value > 0);

    // 4. TOP SUPPLIERS (In entered cars)
    const supplierCounts: Record<string, number> = {};
    enteredCarsInPeriod.forEach((car) => {
      const sup = car.supplier || "مورد عام";
      supplierCounts[sup] = (supplierCounts[sup] || 0) + 1;
    });

    const sortedSuppliers = Object.entries(supplierCounts)
      .map(([supplier, count]) => ({ supplier, count }))
      .sort(
        (a, b) =>
          b.count - a.count || a.supplier.localeCompare(b.supplier, "ar"),
      );

    // 5. SUPPLIER - BRAND & MODEL MAPPINGS
    const activeSupplier =
      drillDownSupplier || sortedSuppliers[0]?.supplier || null;
    const supplierBrands: Record<string, number> = {};
    const supplierModels: Record<string, number> = {};
    let supplierTotalSupply = 0;

    if (activeSupplier) {
      cars.forEach((car) => {
        if (car.supplier === activeSupplier && isWithinRange(car.entryDate)) {
          const b = car.brand || "غير محدد";
          const m = car.model || "طراز عام";
          supplierBrands[b] = (supplierBrands[b] || 0) + 1;
          supplierModels[m] = (supplierModels[m] || 0) + 1;
          supplierTotalSupply++;
        }
      });
    }

    const supplierBrandsData = Object.entries(supplierBrands)
      .map(([brand, count]) => ({ name: brand, value: count }))
      .sort((a, b) => b.value - a.value);

    const supplierModelsData = Object.entries(supplierModels)
      .map(([model, count]) => ({ name: model, value: count }))
      .sort((a, b) => b.value - a.value);

    // Dynamic, deep analytics for ALL suppliers in this period
    const supplierDetailsMap: Record<
      string,
      {
        supplier: string;
        totalSupplied: number;
        soldCount: number;
        inventoryCount: number;
        totalCostValue: number;
        totalEstimatedSalesValue: number;
        stayDaysList: number[];
      }
    > = {};

    cars.forEach((car) => {
      const sup = car.supplier || "مورد عام";
      if (!supplierDetailsMap[sup]) {
        supplierDetailsMap[sup] = {
          supplier: sup,
          totalSupplied: 0,
          soldCount: 0,
          inventoryCount: 0,
          totalCostValue: 0,
          totalEstimatedSalesValue: 0,
          stayDaysList: [],
        };
      }
      const sd = supplierDetailsMap[sup];

      // Sourcing Entry in Period
      if (isWithinRange(car.entryDate)) {
        sd.totalSupplied++;
        const costVal =
          Number(car.costPrice) ||
          (Number(car.price) > 0 ? Number(car.price) * 0.85 : 0) ||
          0;
        sd.totalCostValue += costVal;
        sd.totalEstimatedSalesValue += Number(car.price) || 0;

        if (!car.isOutbound) {
          sd.inventoryCount++;
        }
      }

      // Exit / sold in Period
      if (car.isOutbound && isWithinRange(car.exitData?.exitDate)) {
        sd.soldCount++;
        if (car.entryDate) {
          const entry = new Date(car.entryDate.split("T")[0]);
          const exit = new Date(car.exitData?.exitDate);
          const stayDays = Math.round(
            (exit.getTime() - entry.getTime()) / (1000 * 60 * 60 * 24),
          );
          if (stayDays >= 0) {
            sd.stayDaysList.push(stayDays);
          }
        }
      }
    });

    const supplierDetailedList = Object.values(supplierDetailsMap)
      .map((sd) => {
        const avgStay =
          sd.stayDaysList.length > 0
            ? Math.round(
                sd.stayDaysList.reduce((a, b) => a + b, 0) /
                  sd.stayDaysList.length,
              )
            : null;
        const sellThrough =
          sd.totalSupplied > 0
            ? Math.round((sd.soldCount / sd.totalSupplied) * 100)
            : 0;

        let tier = "نشط ✅";
        let tierColor =
          "text-blue-600 bg-blue-50 dark:bg-blue-955/40 border-blue-200";
        if (sellThrough >= 60 && sd.totalSupplied >= 5) {
          tier = "شريك بلاتيني 💎";
          tierColor =
            "text-purple-600 bg-purple-50 dark:bg-purple-955/40 border-purple-200";
        } else if (sellThrough >= 35 || sd.totalSupplied >= 3) {
          tier = "مورد ذهبي 🌟";
          tierColor =
            "text-emerald-700 bg-emerald-50 dark:bg-emerald-955/40 border-emerald-200";
        }

        return {
          ...sd,
          avgStay,
          sellThrough,
          tier,
          tierColor,
        };
      })
      .filter((sd) => sd.totalSupplied > 0 || sd.soldCount > 0)
      .sort((a, b) => b.totalSupplied - a.totalSupplied);

    // Sales by seller rep
    const sellerStatsMap: Record<
      string,
      {
        seller: string;
        count: number;
        totalAmount: number;
        commission: number;
        cashCount: number;
        bankCount: number;
        financeCount: number;
        activeReservations: number;
      }
    > = {};

    exitedCarsInPeriod.forEach((car) => {
      const seller =
        car.exitData?.seller || car.exitData?.representativeName || "غير محدد";
      if (!sellerStatsMap[seller]) {
        sellerStatsMap[seller] = {
          seller,
          count: 0,
          totalAmount: 0,
          commission: 0,
          cashCount: 0,
          bankCount: 0,
          financeCount: 0,
          activeReservations: 0,
        };
      }

      const stat = sellerStatsMap[seller];
      stat.count += 1;
      const price = Number(car.price) || 0;
      stat.totalAmount += price;

      const norm = getNormalizedSaleTypeAndBank(car);
      const saleType = norm.saleType;
      if (saleType === "عميل كاش") {
        stat.cashCount += 1;
      } else if (saleType === "عميل بنك") {
        stat.bankCount += 1;
      } else if (saleType === "شركة تمويل" || saleType === "معرض") {
        stat.financeCount += 1;
      }
    });

    // Calculate commissions & reservations for each seller
    Object.keys(sellerStatsMap).forEach((seller) => {
      const stat = sellerStatsMap[seller];

      // Commission calculation
      if (commissionType === "fixed") {
        stat.commission = stat.count * defaultCommission;
      } else {
        stat.commission = Math.round(stat.totalAmount * (defaultPercent / 100));
      }

      // Count active reservations for this seller
      stat.activeReservations = cars.filter((c) => {
        const isReserved =
          (c.status as any) === CarStatus.RESERVED ||
          (c.status as any) === "محجوزة" ||
          (c.status as any) === "محجوز";
        if (!isReserved) return false;
        const resUser = c.reservedByUserId || "";
        return (
          resUser.trim().toLowerCase() === seller.trim().toLowerCase() ||
          (c.notes || "").includes(seller)
        );
      }).length;
    });

    // Also include other active delegates who might have active reservations but no sales yet in this period
    cars.forEach((c) => {
      const isReserved =
        (c.status as any) === CarStatus.RESERVED ||
        (c.status as any) === "محجوزة" ||
        (c.status as any) === "محجوز";
      if (isReserved && c.reservedByUserId) {
        const seller = c.reservedByUserId.trim();
        if (seller && !sellerStatsMap[seller]) {
          sellerStatsMap[seller] = {
            seller,
            count: 0,
            totalAmount: 0,
            commission: 0,
            cashCount: 0,
            bankCount: 0,
            financeCount: 0,
            activeReservations: cars.filter((carObj) => {
              const resTag =
                (carObj.status as any) === CarStatus.RESERVED ||
                (carObj.status as any) === "محجوزة" ||
                (carObj.status as any) === "محجوز";
              return resTag && carObj.reservedByUserId?.trim() === seller;
            }).length,
          };
        }
      }
    });

    const sortedSellers = Object.values(sellerStatsMap).sort(
      (a, b) =>
        b.count - a.count || b.activeReservations - a.activeReservations,
    );

    // Timeline entries vs exits
    const chartDataMap: Record<
      string,
      { date: string; entries: number; exits: number }
    > = {};
    if (start && end) {
      const curr = new Date(start);
      let safetyCounter = 0;
      while (curr <= end && safetyCounter < 100) {
        const dateStr = curr.toISOString().split("T")[0];
        chartDataMap[dateStr] = { date: dateStr, entries: 0, exits: 0 };
        curr.setDate(curr.getDate() + 1);
        safetyCounter++;
      }

      enteredCarsInPeriod.forEach((car) => {
        const dateStr = car.entryDate?.split("T")[0];
        if (dateStr && chartDataMap[dateStr]) {
          chartDataMap[dateStr].entries += 1;
        }
      });

      exitedCarsInPeriod.forEach((car) => {
        const dateStr = car.exitData?.exitDate;
        if (dateStr && chartDataMap[dateStr]) {
          chartDataMap[dateStr].exits += 1;
        }
      });
    }
    const chartTimeline = Object.values(chartDataMap).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    // Dynamic AI insights generation
    const insights: string[] = [];
    if (sortedBrandsDemand.length > 0) {
      insights.push(
        `علامة **${sortedBrandsDemand[0].brand}** تتصدر الماركات الأكثر طلباً وخروجاً بـ **${sortedBrandsDemand[0].count}** حركة صرف، بنسبة تبلغ **${((sortedBrandsDemand[0].count / (exitedCarsInPeriod.length || 1)) * 100).toFixed(0)}%** من إجمالي المخرجات.`,
      );
    }
    if (sortedModelsDemand.length > 0) {
      insights.push(
        `طراز **${sortedModelsDemand[0].key}** هو الأكثر مبيعاً ورغبةً ورواجاً بـ **${sortedModelsDemand[0].count}** سيارة من المخزون.`,
      );
      const averageStay = sortedModelsDemand[0].avgStay;
      if (averageStay !== null) {
        insights.push(
          `معدل دوران المخزون ممتاز، حيث تسجل المركبات الأكثر مبيعاً متوسط بقاء **${averageStay} أيام** فقط مخزّنة قبل خروجها.`,
        );
      }
    }
    if (showroomCount > retailCount) {
      insights.push(
        `قنوات صرف **المعارض والتجار كقناة جماعية** تستحوذ على السحب بنسبة تبلغ **${((showroomCount / (exitedCarsInPeriod.length || 1)) * 100).toFixed(0)}%** مقارنة بالأفراد.`,
      );
    } else if (retailCount > 0) {
      insights.push(
        `مبيعات الأفراد القنواتية (كاش وبنك) هي المحرك الأساسي لحركة الصرف بنسبة **${((retailCount / (exitedCarsInPeriod.length || 1)) * 100).toFixed(0)}%**.`,
      );
    }
    if (activeSupplier && supplierTotalSupply > 0) {
      const topSuppliedBrand = supplierBrandsData[0]?.name || "-";
      insights.push(
        `المورد الأكثر نشاطاً في التوريد **${activeSupplier}** يركز في الغالب على ماركة **${topSuppliedBrand}** بنسبة تبلغ **${((supplierBrandsData[0]?.value / supplierTotalSupply) * 100).toFixed(0)}%** من توريداته المتطابقة.`,
      );
    }

    const totalSalesCount = exitedCarsInPeriod.length;
    const totalSalesAmount = exitedCarsInPeriod.reduce(
      (sum, c) => sum + (Number(c.price) || 0),
      0,
    );
    const activeCarsNow = cars.filter(
      (c) => !c.isOutbound && c.status !== CarStatus.IN_TRANSFER,
    );
    const currentStockValue = activeCarsNow.reduce((sum, c) => {
      const costRec = (vehicleCosts || []).find(
        (vc) => vc.vin.toLowerCase() === c.vin.toLowerCase(),
      );
      return sum + (costRec ? costRec.totalCost : Number(c.costPrice) || 0);
    }, 0);
    const liquidableValue = activeCarsNow.reduce(
      (sum, c) => sum + (Number(c.price) || 0),
      0,
    );
    const newVehiclesCount = activeCarsNow.filter((c) => {
      const cond = (
        (c.notes || "") +
        " " +
        (c.carRemark || "") +
        " " +
        (c.customData?.condition || "")
      ).toLowerCase();
      return cond.includes("جديد") || cond.includes("new");
    }).length;
    const sharedVehiclesCount = activeCarsNow.filter((c) => {
      return (
        c.ownershipType === "تصريف" ||
        c.ownershipType === OwnershipType.DISTRIBUTION ||
        String(c.ownershipType).includes("تصريف")
      );
    }).length;

    const stagnantLimit = stagnantLimitDays || 60;
    const stagnantCars = activeCarsNow.filter((c) => {
      if (!c.entryDate) return false;
      const entry = new Date(c.entryDate.split("T")[0]);
      const diffDays = Math.round(
        (new Date().getTime() - entry.getTime()) / (1000 * 60 * 60 * 24),
      );
      return diffDays >= stagnantLimit;
    });

    const stagnantVehiclesCount = stagnantCars.length;
    const stagnantRiskRate =
      activeCarsNow.length > 0
        ? Math.round((stagnantVehiclesCount / activeCarsNow.length) * 100)
        : 0;
    const stockToSalesRatio =
      activeCarsNow.length > 0
        ? Math.round((totalSalesCount / activeCarsNow.length) * 100)
        : 0;

    let totalStayDays = 0;
    let countedExitsForStay = 0;
    exitedCarsInPeriod.forEach((c) => {
      if (c.entryDate && c.exitData?.exitDate) {
        const ent = new Date(c.entryDate.split("T")[0]);
        const exi = new Date(c.exitData.exitDate.split("T")[0]);
        const diff = Math.round(
          (exi.getTime() - ent.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (diff >= 0) {
          totalStayDays += diff;
          countedExitsForStay++;
        }
      }
    });
    const averageRetentionPeriod =
      countedExitsForStay > 0
        ? Math.round(totalStayDays / countedExitsForStay)
        : 14;

    return {
      enteredCount: enteredCarsInPeriod.length,
      exitedCount: exitedCarsInPeriod.length,
      topBrandsDemand: sortedBrandsDemand,
      topModelsDemand: sortedModelsDemand,
      topSellers: sortedSellers,
      chartTimeline,
      enteredCars: enteredCarsInPeriod,
      exitedCars: exitedCarsInPeriod,
      exitTypesDistribution,
      retailCount,
      showroomCount,
      financeCount,
      otherExitCount,
      topSuppliers: sortedSuppliers,
      activeSupplier,
      supplierBrandsData,
      supplierModelsData,
      supplierTotalSupply,
      supplierDetailedList,

      // Expanded Analytics Indicators
      totalSalesCount,
      totalSalesAmount,
      currentStockValue,
      liquidableValue,
      newVehiclesCount,
      sharedVehiclesCount,
      stagnantCars,
      stagnantVehiclesCount,
      stagnantRiskRate,
      stockToSalesRatio,
      averageRetentionPeriod,

      insights,
    };
  }, [
    cars,
    activePeriodDates,
    filterBrand,
    filterModel,
    filterSupplier,
    filterExitType,
    filterBranch,
    drillDownBrand,
    drillDownSupplier,
    vehicleCosts,
    stagnantLimitDays,
  ]);

  const transferStats = useMemo(() => {
    const inTransferCars = cars.filter(
      (c) => c.status === CarStatus.IN_TRANSFER,
    );

    const byBrand: Record<string, number> = {};
    const byModel: Record<string, number> = {};
    const byCompany: Record<string, number> = {};
    const byYard: Record<string, number> = {};

    inTransferCars.forEach((c) => {
      byBrand[c.brand] = (byBrand[c.brand] || 0) + 1;
      const modelKey = c.model || "غير محدد";
      byModel[modelKey] = (byModel[modelKey] || 0) + 1;
      const compKey = c.transferReceiver || "فرع مستقل";
      byCompany[compKey] = (byCompany[compKey] || 0) + 1;
      const yardKey = c.customData?.branch || "غير محدد";
      byYard[yardKey] = (byYard[yardKey] || 0) + 1;
    });

    return {
      total: inTransferCars.length,
      byBrand,
      byModel,
      byCompany,
      byYard,
    };
  }, [cars]);

  const renderInTransferCarsReportSection = () => {
    return null;
  };

  const filteredCarsData = useMemo(() => {
    let result = [...cars];

    if (reportView === "comprehensive-inventory") {
      // التقرير الشامل: جميع سيارات المخزون المتواجدة بالمعرض وخارج المعرض أو تحت الوصول
      result = result.filter(
        (c) =>
          !c.isOutbound &&
          (c.status as string) !== CarStatus.SOLD &&
          (c.status as string) !== "مباعة" &&
          (c.status as string) !== "مباع" &&
          (c.status as string) !== "مبيعة" &&
          (c.status as string) !== CarStatus.ARCHIVED &&
          String(c.status) !== "مؤرشفة",
      );
    } else if (reportView === "inventory") {
      // تسليم السيارات: أي سيارة دخلت المبيعات (تم تسليمها/إخراجها عبر المبيعات)
      result = result.filter((c) => c.isOutbound === true);
    } else if (reportView === "outside-showroom") {
      // تقرير سيارات لم تصل / خارج المعرض: يجلب فقط السيارات غير المتواجدة داخل المعرض أو التي لم تصل
      result = result.filter(
        (c) =>
          !c.isOutbound &&
          (c.status as string) !== CarStatus.SOLD &&
          (c.status as string) !== "مباعة" &&
          (c.status as string) !== "مباع" &&
          (c.status as string) !== "مبيعة" &&
          (c.status as string) !== CarStatus.ARCHIVED &&
          String(c.status) !== "مؤرشفة" &&
          (isCarNotArrived(c) ||
            c.isPresentInShowroom === false ||
            c.status === CarStatus.NOT_ARRIVED ||
            c.status === CarStatus.NOT_ARRIVED_SHOWROOM ||
            c.status === CarStatus.IN_YARD ||
            String(c.status).includes('لم تصل') ||
            String(c.status).includes('خارج المعرض') ||
            String(c.status).includes('غير واصل') ||
            String(c.status).includes('الساحة') ||
            String(c.status).includes('حوش') ||
            String(c.status).includes('مستودع') ||
            String(c.notes || '').includes('خارج المعرض') ||
            String(c.notes || '').includes('لم تصل')),
      );
    } else if (reportView === "delegates-inventory-summary") {
      // 1. Get all sold/exited and transferred cars (excluding non-arrived)
      result = result.filter(
        (c) =>
          (c.isOutbound ||
            (c.status as string) === CarStatus.SOLD ||
            (c.status as string) === "مباعة" ||
            (c.status as string) === "مباع" ||
            c.status === CarStatus.IN_TRANSFER ||
            String(c.status) === "تحويل" ||
            String(c.status) === "تم التحويل") &&
          !isCarNotArrived(c),
      );

      // 2. Filter by sales date period type
      if (activeDateRange.isFiltering) {
        result = result.filter((car) => isCarInDateRange(car));
      } else if (salesDateFilterType === "custom") {
        if (startDate || endDate) {
          result = result.filter((car) => isCarInDateRange(car));
        }
      } else if (salesDateFilterType === "month") {
        result = result.filter((car) => {
          const targetDateStr =
            extractYYYYMMDD(car.exitData?.exitDate) ||
            extractYYYYMMDD(car.entryDate);
          if (!targetDateStr) return false;
          const d = new Date(targetDateStr);
          return (
            d.getMonth() === selectedMonth && d.getFullYear() === selectedYear
          );
        });
      }

      // 3. Filter by Selected Delegate (Seller)
      if (selectedDelegateFilter && selectedDelegateFilter !== "all") {
        result = result.filter((car) => {
          const delegateName =
            car.exitData?.seller ||
            car.exitData?.representativeName ||
            car.seller ||
            "غير محدد";
          return delegateName === selectedDelegateFilter;
        });
      }

      // 4. Advanced filters for brand, model, supplier, branch, etc.
      if (filterBrand) {
        result = result.filter(
          (c) => getCleanBrandName(c.brand) === getCleanBrandName(filterBrand),
        );
      }
      if (filterModel) {
        result = result.filter((c) => c.model === filterModel);
      }
      if (filterSupplier) {
        result = result.filter((c) => c.supplier === filterSupplier);
      }
      if (filterBranch) {
        result = result.filter((c) => {
          const valBranch = c.customData?.branch || "";
          return (
            valBranch.indexOf(filterBranch) !== -1 ||
            (c.notes || "").indexOf(filterBranch) !== -1
          );
        });
      }
    } else if (reportView === "physical-inventory") {
      result = result.filter(
        (c) =>
          !c.isOutbound &&
          !isCarNotArrived(c) &&
          c.status !== CarStatus.IN_TRANSFER,
      );
    } else if (reportView === "non-rented") {
      result = result.filter(
        (c) =>
          !c.isOutbound &&
          c.rentalStatus !== RentalStatus.RENTED &&
          c.status !== CarStatus.IN_TRANSFER &&
          !isCarNotArrived(c),
      );
    } else if (reportView === "transfers-general") {
      result = result.filter(
        (c) =>
          (c.status === CarStatus.IN_TRANSFER ||
            String(c.status) === "تحويل" ||
            String(c.status) === "في التحويل" ||
            !!c.transferNo ||
            !!c.transferSender ||
            !!c.transferReceiver) &&
          !isCarNotArrived(c),
      );
    } else if (reportView === "transfers-daily") {
      const today = new Date().toISOString().split("T")[0];
      result = result.filter(
        (c) =>
          (c.status === CarStatus.IN_TRANSFER ||
            String(c.status) === "تحويل" ||
            String(c.status) === "في التحويل" ||
            !!c.transferNo ||
            !!c.transferSender ||
            !!c.transferReceiver) &&
          !isCarNotArrived(c),
      );
      if (reportPeriodMode === "all" && !startDate && !endDate) {
        result = result.filter((car) => {
          const targetDateStr =
            car.transferDate || car.lastModified?.split("T")[0];
          return targetDateStr === today;
        });
      }
    } else if (reportView === "purchases") {
      result = result.filter(
        (c) =>
          (c.costPrice !== undefined && c.costPrice > 0) ||
          !!c.supplier ||
          !!c.entryDate,
      );
    } else if (reportView === "resilience-audit") {
      result = [];
    } else if (reportView === "delegates-reports") {
      // Filter out cars that are sold and transferred to sales (isOutbound is true), but keep if sold and not outbound, or active (excluding non-arrived)
      result = result.filter(
        (c) =>
          !c.isOutbound &&
          c.status !== CarStatus.IN_TRANSFER &&
          !isCarNotArrived(c),
      );
      // Show cars matching the delegate (seller, representativeName, etc.)
      if (selectedDelegateFilter !== "all") {
        result = result.filter((c) => {
          const delegateName =
            c.exitData?.seller ||
            c.exitData?.representativeName ||
            c.seller ||
            "غير محدد";
          return delegateName === selectedDelegateFilter;
        });
      }
    } else if (reportView === "daily-entry") {
      const today = new Date().toISOString().split("T")[0];
      const matchingEvents = computedMovementHistory.filter(
        (m) => m.type === "IN",
      );
      result = matchingEvents.map((m) => mapMovementEventToCar(m, cars));

      if (reportPeriodMode === "all" && !startDate && !endDate) {
        result = result.filter((c) => c.entryDate?.split("T")[0] === today);
      }
    } else if (reportView === "daily-exit") {
      const today = new Date().toISOString().split("T")[0];
      const matchingEvents = computedMovementHistory.filter(
        (m) => m.type === "OUT",
      );
      result = matchingEvents.map((m) => mapMovementEventToCar(m, cars));

      if (reportPeriodMode === "all" && !startDate && !endDate) {
        result = result.filter((c) => c.exitData?.exitDate === today);
      }
    } else if (
      reportView === "monthly" ||
      reportView === "monthly-entry" ||
      reportView === "monthly-exit"
    ) {
      const matchingEvents = computedMovementHistory.filter((m) => {
        if (m.type !== monthlyMovementType) return false;
        const d = new Date(m.timestamp);
        return (
          d.getMonth() === selectedMonth && d.getFullYear() === selectedYear
        );
      });
      const carIds = Array.from(new Set(matchingEvents.map((m) => m.carId)));
      result = carIds
        .map((id) => cars.find((c) => c.id === id))
        .filter(Boolean) as Car[];
    } else if (
      reportView === "daily-summary" ||
      reportView === "daily-movement-statement" ||
      reportView === "analytics"
    ) {
      result = [];
    }

    if (selectedIds.size > 0)
      result = result.filter((c) => selectedIds.has(c.id));

    // Universal Period and Date Filtering for all applicable reports
    if (
      reportView !== "daily-summary" &&
      reportView !== "daily-movement-statement" &&
      reportView !== "analytics" &&
      reportView !== "delegates-inventory-summary" &&
      reportView !== "inventory" &&
      reportView !== "comprehensive-inventory" &&
      reportView !== "physical-inventory" &&
      reportView !== "outside-showroom"
    ) {
      if (activeDateRange.isFiltering) {
        result = result.filter((car) => isCarInDateRange(car));
      }
    } else if (
      (reportView === "inventory" ||
        reportView === "comprehensive-inventory" ||
        reportView === "physical-inventory" ||
        reportView === "outside-showroom") &&
      reportPeriodMode !== "all"
    ) {
      if (activeDateRange.isFiltering) {
        result = result.filter((car) => isCarInDateRange(car));
      }
    }
    return result.sort(sortCarsUnderBrand);
  }, [
    cars,
    selectedIds,
    startDate,
    endDate,
    dateType,
    reportView,
    selectedDelegateFilter,
    computedMovementHistory,
    selectedMonth,
    selectedYear,
    filterBrand,
    filterModel,
    filterSupplier,
    filterBranch,
    salesDateFilterType,
    reportPeriodMode,
    activeDateRange,
    isCarInDateRange,
  ]);

  const totals = useMemo(
    () => ({
      totalPrice: filteredCarsData.reduce(
        (acc, c) => acc + (Number(c.price) || 0),
        0,
      ),
      totalCars: filteredCarsData.length,
    }),
    [filteredCarsData],
  );

  const groupedData = useMemo(() => {
    const groups: Record<string, Record<string, Car[]>> = {};
    const sortedCars = [...filteredCarsData].sort(sortCarsUnderBrand);
    sortedCars.forEach((car) => {
      const brand = getCleanBrandName(car.brand);
      const model = car.model || "طراز عام";
      if (!groups[brand]) groups[brand] = {};
      if (!groups[brand][model]) groups[brand][model] = [];
      groups[brand][model].push(car);
    });
    return groups;
  }, [filteredCarsData]);

  const summaryReportsData = useMemo(() => {
    // 1. Get raw list based on reportView
    let rawCars: Car[] = [];
    if (reportView === "physical-inventory-summary") {
      // ملخص الجرد الفعلي الفئوي بالمعرض: جميع السيارات النشطة المتواجدة داخل المعرض فقط
      rawCars = cars.filter(
        (c) =>
          !c.isOutbound &&
          (c.status as string) !== CarStatus.SOLD &&
          (c.status as string) !== "مباعة" &&
          (c.status as string) !== "مباع" &&
          (c.status as string) !== "مبيعة" &&
          (c.status as string) !== CarStatus.ARCHIVED &&
          String(c.status) !== "مؤرشفة" &&
          c.status !== CarStatus.IN_TRANSFER &&
          !isCarNotArrived(c) &&
          c.isPresentInShowroom !== false &&
          c.status !== CarStatus.NOT_ARRIVED_SHOWROOM &&
          c.status !== CarStatus.NOT_ARRIVED,
      );
    } else if (reportView === "comprehensive-inventory-summary") {
      // ملخص المخزون الشامل للفئات والساحات: جميع السيارات النشطة بالمخزون والموجودة بالمعرض والساحات الخارجية وتحت الوصول
      rawCars = cars.filter(
        (c) =>
          !c.isOutbound &&
          (c.status as string) !== CarStatus.SOLD &&
          (c.status as string) !== "مباعة" &&
          (c.status as string) !== "مباع" &&
          (c.status as string) !== "مبيعة" &&
          (c.status as string) !== CarStatus.ARCHIVED &&
          String(c.status) !== "مؤرشفة",
      );
    } else {
      return {
        grouped: {},
        totalCount: 0,
        grandTotalPrice: 0,
        brands: [],
        models: [],
        yards: [],
        overallYardTotals: {},
      };
    }

    // 2. Perform Quick Search and selectors
    const filtered = rawCars.filter((c) => {
      // Search term
      if (summarySearchQuery.trim()) {
        const query = summarySearchQuery.toLowerCase();
        const brandMatch = (c.brand || "").toLowerCase().includes(query);
        const modelMatch = (c.model || "").toLowerCase().includes(query);
        if (!brandMatch && !modelMatch) return false;
      }

      // Brand select
      if (
        summaryBrandOption !== "all" &&
        getCleanBrandName(c.brand) !== summaryBrandOption
      ) {
        return false;
      }

      // Model select
      if (
        summaryModelOption !== "all" &&
        (c.model || "") !== summaryModelOption
      ) {
        return false;
      }

      // Yard select
      if (summaryYardOption !== "all") {
        const y = normalizeYardName(c.customData?.branch);
        if (y !== summaryYardOption) {
          return false;
        }
      }

      // Date Search (دعم البحث بالتاريخ) - Only filter when reportPeriodMode is not 'all'
      if (reportPeriodMode !== "all" && activeDateRange.isFiltering) {
        if (!isCarInDateRange(c)) return false;
      }

      return true;
    });

    // 3. Extract unique Brands, Models & Yards from rawCars subset (unfiltered by search/selectors)
    // to populate helper select dropdowns
    const availableBrandsSet = new Set<string>();
    rawCars.forEach((c) => {
      const b = getCleanBrandName(c.brand);
      if (b) availableBrandsSet.add(b);
    });
    const availableBrands = Array.from(availableBrandsSet).sort((a, b) =>
      a.localeCompare(b, "ar"),
    );

    const availableModelsSet = new Set<string>();
    rawCars.forEach((c) => {
      if (
        summaryBrandOption === "all" ||
        getCleanBrandName(c.brand) === summaryBrandOption
      ) {
        if (c.model) availableModelsSet.add(c.model);
      }
    });
    const availableModels = Array.from(availableModelsSet).sort((a, b) =>
      a.localeCompare(b, "ar"),
    );

    const availableYardsSet = new Set<string>();
    rawCars.forEach((c) => {
      const y = normalizeYardName(c.customData?.branch);
      if (y) availableYardsSet.add(y);
    });
    const availableYards = Array.from(availableYardsSet).sort((a, b) =>
      a.localeCompare(b, "ar"),
    );

    // 4. Group cars dynamically by Report Type
    const groups: any = {};

    if (reportView === "physical-inventory-summary") {
      // Report 1 structure: Brand -> Model_Year (dict of category/class + year)
      filtered.forEach((car) => {
        const brand = getCleanBrandName(car.brand);
        const model = getCleanModelForSummary(car.model, car);
        const year = car.year || car.modelYear || 2026;
        const price = Number(car.price) || 0;
        const groupKey = `${model}_${year}`;

        if (!groups[brand]) {
          groups[brand] = {
            brand,
            models: {},
            brandTotalCount: 0,
            brandTotalPrice: 0,
          };
        }

        if (!groups[brand].models[groupKey]) {
          groups[brand].models[groupKey] = {
            modelName: model,
            year: year,
            cars: [],
            count: 0,
            totalPrice: 0,
          };
        }

        const mGroup = groups[brand].models[groupKey];
        mGroup.cars.push(car);
        mGroup.count += 1;
        mGroup.totalPrice += price;

        groups[brand].brandTotalCount += 1;
        groups[brand].brandTotalPrice += price;
      });
    } else {
      // Report 2 structure: Brand -> Yard/Branch -> Model
      filtered.forEach((car) => {
        const brand = getCleanBrandName(car.brand);
        const yard = normalizeYardName(car.customData?.branch);
        const model = getCleanModelForSummary(car.model, car);
        const price = Number(car.price) || 0;

        if (!groups[brand]) {
          groups[brand] = {
            brand,
            yards: {},
            brandTotalCount: 0,
            brandTotalPrice: 0,
          };
        }

        if (!groups[brand].yards[yard]) {
          groups[brand].yards[yard] = {
            yardName: yard,
            models: {},
            yardTotalCount: 0,
            yardTotalPrice: 0,
          };
        }

        if (!groups[brand].yards[yard].models[model]) {
          groups[brand].yards[yard].models[model] = {
            modelName: model,
            cars: [],
            count: 0,
            totalPrice: 0,
          };
        }

        const mGroup = groups[brand].yards[yard].models[model];
        mGroup.cars.push(car);
        mGroup.count += 1;
        mGroup.totalPrice += price;

        groups[brand].yards[yard].yardTotalCount += 1;
        groups[brand].yards[yard].yardTotalPrice += price;

        groups[brand].brandTotalCount += 1;
        groups[brand].brandTotalPrice += price;
      });
    }

    // 5. Sort Brand groups based on summarySortBy
    const sortedBrandEntries = Object.entries(groups);
    if (summarySortBy === "alpha-asc") {
      sortedBrandEntries.sort((a, b) => a[0].localeCompare(b[0], "ar"));
    } else if (summarySortBy === "alpha-desc") {
      sortedBrandEntries.sort((a, b) => b[0].localeCompare(a[0], "ar"));
    } else if (summarySortBy === "count-desc") {
      sortedBrandEntries.sort(
        (a: any, b: any) => b[1].brandTotalCount - a[1].brandTotalCount,
      );
    } else if (summarySortBy === "count-asc") {
      sortedBrandEntries.sort(
        (a: any, b: any) => a[1].brandTotalCount - b[1].brandTotalCount,
      );
    }

    // 6. Sort sub-properties of Brand groups
    if (reportView === "physical-inventory-summary") {
      sortedBrandEntries.forEach(([_, bGroup]: any) => {
        const sortedM = Object.entries(bGroup.models).sort(
          (x: any, y: any) =>
            x[1].modelName.localeCompare(y[1].modelName, "ar") ||
            String(x[1].year).localeCompare(String(y[1].year), "ar"),
        );
        bGroup.models = Object.fromEntries(sortedM);
      });
    } else {
      sortedBrandEntries.forEach(([_, bGroup]: any) => {
        // Sort yards alphabetically but keep 'الساحة الرئيسية' first
        const sortedYards = Object.entries(bGroup.yards).sort(
          (x: any, y: any) => {
            if (x[0] === "الساحة الرئيسية") return -1;
            if (y[0] === "الساحة الرئيسية") return 1;
            return x[0].localeCompare(y[0], "ar");
          },
        );

        // Under each yard, sort models alphabetically
        sortedYards.forEach(([_, yGroup]: any) => {
          const sortedM = Object.entries(yGroup.models).sort((x: any, y: any) =>
            x[0].localeCompare(y[0], "ar"),
          );
          yGroup.models = Object.fromEntries(sortedM);
        });

        bGroup.yards = Object.fromEntries(sortedYards);
      });
    }

    const finalGrouped = Object.fromEntries(sortedBrandEntries);
    const totalCount = filtered.length;
    const grandTotalPrice = filtered.reduce(
      (acc, c) => acc + (Number(c.price) || 0),
      0,
    );

    // Compute Overall Yard Totals for the summary card
    const overallYardTotals: Record<string, number> = {};
    filtered.forEach((car) => {
      const yardName = normalizeYardName(car.customData?.branch);
      let shortName = yardName;
      if (yardName === "الساحة الرئيسية") shortName = "الرئيسية";
      else if (yardName === "ساحة الشمال") shortName = "الشمالية";
      else if (yardName === "ساحة الجنوب") shortName = "الجنوبية";
      else {
        shortName = yardName.replace("ساحة ", "").replace("الساحة ", "");
      }
      overallYardTotals[shortName] = (overallYardTotals[shortName] || 0) + 1;
    });

    return {
      grouped: finalGrouped,
      totalCount,
      grandTotalPrice,
      brands: availableBrands,
      models: availableModels,
      yards: availableYards,
      overallYardTotals,
      filteredCars: filtered,
    };
  }, [
    cars,
    reportView,
    summarySearchQuery,
    summaryBrandOption,
    summaryModelOption,
    summaryYardOption,
    summarySortBy,
    startDate,
    endDate,
    activeDateRange,
    isCarInDateRange,
  ]);

  const systemSchema = useMemo(() => {
    const schema: Record<string, string[]> = {};

    // Collect all unique brand-model combinations from the system cars array
    cars.forEach((car) => {
      const brand = getCleanBrandName(car.brand);
      const model = getCleanModelForSummary(car.model, car);
      if (brand && brand !== "غير محدد" && model && model !== "طراز عام") {
        if (!schema[brand]) {
          schema[brand] = [];
        }
        if (!schema[brand].includes(model)) {
          schema[brand].push(model);
        }
      }
    });

    // Sort models alphabetically for clean headers and predictable ordering
    Object.keys(schema).forEach((brand) => {
      schema[brand].sort((a, b) => a.localeCompare(b, "ar"));
    });

    return schema;
  }, [cars]);

  const orderedBrandNames = useMemo(() => {
    const actualBrands = Object.keys(systemSchema);
    return actualBrands.sort((a, b) => a.localeCompare(b, "ar"));
  }, [systemSchema]);

  const displayBrands = useMemo(() => {
    let list = [...orderedBrandNames];

    // Only display brands that have at least 1 car in the active filtered dataset!
    const activeBrands = new Set(
      (summaryReportsData.filteredCars || []).map((c: any) =>
        getCleanBrandName(c.brand),
      ),
    );
    list = list.filter((b) => activeBrands.has(b));

    if (summaryBrandOption !== "all") {
      list = list.filter((b) => b === summaryBrandOption);
    }

    if (summarySortBy === "alpha-asc") {
      list.sort((a, b) => a.localeCompare(b, "ar"));
    } else if (summarySortBy === "alpha-desc") {
      list.sort((a, b) => b.localeCompare(a, "ar"));
    } else if (summarySortBy === "count-desc") {
      list.sort((a, b) => {
        const countA = summaryReportsData.grouped[a]?.brandTotalCount || 0;
        const countB = summaryReportsData.grouped[b]?.brandTotalCount || 0;
        return countB - countA;
      });
    } else if (summarySortBy === "count-asc") {
      list.sort((a, b) => {
        const countA = summaryReportsData.grouped[a]?.brandTotalCount || 0;
        const countB = summaryReportsData.grouped[b]?.brandTotalCount || 0;
        return countA - countB;
      });
    }
    return list;
  }, [
    orderedBrandNames,
    summaryBrandOption,
    summarySortBy,
    summaryReportsData.grouped,
    summaryReportsData.filteredCars,
  ]);

  const getReportTitleByView = (
    view: string = reportView,
    filter: string = selectedDelegateFilter,
  ): string => {
    switch (view) {
      case "inventory":
        return "تقرير تسليم السيارات";
      case "comprehensive-inventory":
        return "التقرير الشامل لكافة سيارات المخزون (المتواجدة وخارج المعرض)";
      case "outside-showroom":
        return "تقرير السيارات غير المتواجدة بالمعرض (خارج المعرض / لم تصل)";
      case "physical-inventory":
        return "تقرير المخزون الفعلي المتواجد داخل المعرض حالياً";
      case "physical-inventory-summary":
        return "ملخص الجرد الفعلي الفئوي بالمعرض";
      case "comprehensive-inventory-summary":
        return "ملخص المخزون الشامل للفئات والساحات";
      case "delegates-inventory-summary":
        return "ملخص مبيعات المخزون";
      case "delegates-reports":
        return filter === "all"
          ? "تقرير المناديب المفصل - لكل المناديب"
          : `تقرير المناديب المفصل - للمندوب: ${filter}`;
      case "delegates":
        return "تقرير أداء المناديب وإحصائيات مبيعات المعرض";
      case "non-rented":
        return "تقرير الجرد لجميع السيارات المتبقية التي لم تجير (لم تؤجر)";
      case "monthly":
        return `التقرير الشهري لحركة المخزون - شهر ${selectedMonth + 1} / ${selectedYear}`;
      case "monthly-entry":
        return `التقرير الشهري لدخول المركبات (الوارد) - شهر ${selectedMonth + 1} / ${selectedYear}`;
      case "monthly-exit":
        return `التقرير الشهري لخروج المركبات (الصادر) - شهر ${selectedMonth + 1} / ${selectedYear}`;
      case "daily-entry":
        return `تقرير دخول المركبات اليومي (${dailyReportDate})`;
      case "daily-exit":
        return `تقرير خروج المركبات اليومي (${dailyReportDate})`;
      case "daily-summary":
        return `تقرير ملخص حركة المخزون اليومية (الدخول والخروج) (${dailyReportDate})`;
      case "daily-movement-statement":
        return `بيان حركة المخزون اليومي الصادر والوارد (${statementDate})`;
      case "transfers-general":
        return "التقرير العام للتحويلات الصادرة والداخلية بين الفروع والمعارض";
      case "transfers-daily":
        return "تقرير التحويلات اليومية بين الفروع والمعارض والمخازن الشقيقة";
      case "purchases":
        return "تقرير المشتريات والاستلام والتوريد العام للمركبات والموردين";
      case "showroom-inventory-cost":
        return "تقرير التكلفة الإجمالية وجرد القيمة المالية لمخزون المعرض";
      case "supplier-analysis":
        return "تقرير تحليل أداء الموردين والشركاء وتوزيع جهات التوريد";
      case "resilience-audit":
        return "لوحة مراقبة وتشخيص استقرار النظام وجودة البيانات";
      case "analytics":
        return "التقرير التحليلي الذكي لحركة مخزون المركبات والمبيعات المستهدفة";
      default:
        return "تقرير حركة مخزون السيارات";
    }
  };

  const handlePdfExportForActiveView = () => {
    if (reportView === "analytics") {
      generateProfessionalPDF("current");
    } else if (reportView === "supplier-analysis") {
      generateProfessionalPDF("supplier");
    } else if (reportView === "physical-inventory-summary") {
      generateProfessionalPDF("physical-summary");
    } else if (reportView === "comprehensive-inventory-summary") {
      generateProfessionalPDF("comprehensive-summary");
    } else if (reportView === "showroom-inventory-cost") {
      handlePrint();
    } else {
      // Route every other report type through the SAME professional
      // export pipeline (html2canvas + jsPDF with proper logo resolution)
      // used by the "Advanced PDF" menu, instead of falling back to the
      // browser's native print dialog — which renders the logo directly
      // from its raw URL/DOM and frequently produces a PDF with a blank
      // or missing logo. "full" builds its table from filteredCarsData,
      // so it already reflects whatever report/filters are active.
      generateProfessionalPDF("full");
    }
  };

  const handlePrint = () => {
    const getColWeight = (col: ColumnConfig) => {
      let rawW = parseFloat(col.width) || 10;
      if (
        col.key === "brand_model" ||
        col.key === "brandModel" ||
        col.key === "car_info"
      ) {
        rawW = Math.max(rawW, 35);
      }
      return rawW;
    };

    const sumActiveWidths = activeColumns.reduce(
      (sum, col) => sum + getColWeight(col),
      0,
    );
    const tableHeaders = activeColumns
      .map((col) => {
        const rawW = getColWeight(col);
        const normalizedW =
          sumActiveWidths > 0
            ? ((rawW / sumActiveWidths) * 100).toFixed(2) + "%"
            : `${rawW}%`;
        return `<th style="width: ${normalizedW}">${col.label}</th>`;
      })
      .join("");

    const tableColGroup = `
      <colgroup>
        ${activeColumns
          .map((col) => {
            const rawW = getColWeight(col);
            const normalizedW =
              sumActiveWidths > 0
                ? ((rawW / sumActiveWidths) * 100).toFixed(2) + "%"
                : `${rawW}%`;
            return `<col style="width: ${normalizedW};" />`;
          })
          .join("")}
      </colgroup>
    `;

    let reportTitle = "";
    let tableContentHtml = "";

    if (
      reportView === "inventory" ||
      reportView === "comprehensive-inventory" ||
      reportView === "outside-showroom" ||
      reportView === "delegates-reports" ||
      reportView === "physical-inventory" ||
      reportView === "non-rented" ||
      reportView === "delegates-inventory-summary" ||
      reportView === "transfers-general" ||
      reportView === "transfers-daily" ||
      reportView === "purchases"
    ) {
      reportTitle = getReportTitleByView(reportView, selectedDelegateFilter);
      tableContentHtml = `
        <table>
          ${tableColGroup}
          <thead>
            <tr>
              ${tableHeaders}
            </tr>
          </thead>
          <tbody>
      `;
      Object.entries(groupedData).forEach(([brand, models]) => {
        tableContentHtml += `
          <tr>
            <td colSpan="${activeColumns.length}" style="background-color: #f8fafc; color: #2563eb; font-weight: 1000; text-align: center; font-size: 15pt; padding: 12px; border: 2px solid #3b82f6; letter-spacing: normal;" class="brand-group-header">
               🚘 ${brand} 🚘
            </td>
          </tr>
        `;
        Object.values(models)
          .flat()
          .forEach((car) => {
            const rowStyleObj = getCarRowStyle(car);
            const bg = rowStyleObj.style.backgroundColor || "#ffffff";
            const fg = rowStyleObj.style.color || "#000000";
            const isBold =
              rowStyleObj.textClass?.includes("font-bold") ||
              rowStyleObj.textClass?.includes("font-extrabold") ||
              rowStyleObj.textClass?.includes("font-black") ||
              false;

            const cells = activeColumns
              .map((col) => {
                let cellBg = bg;
                let cellFg = fg;
                let cellBold = isBold;
                // Spécial styling for non-rented status aligning with Excel colors
                if (
                  (col.key === "rental" || col.key === "rentalStatus") &&
                  car.rentalStatus !== RentalStatus.RENTED
                ) {
                  cellBg = "rgba(47, 85, 151, 0.40)";
                  cellFg = "#000000";
                  cellBold = true;
                }
                // When card number is missing, ONLY this cell gets red background, not the row
                if (col.key === "cardNumber" || col.key === "card_number") {
                  const rawCard = String(car.cardNumber || "").trim();
                  const hasNoCard = !rawCard || rawCard === "-" || rawCard === "لم يرد البطاقه بعد" || rawCard === "لم يرد البطاقة بعد" || rawCard === "بدون" || rawCard === "غير متوفر" || rawCard === "لا يوجد" || rawCard === "غير مدرجة" || rawCard === "null";
                  if (hasNoCard) {
                    cellBg = "#dc2626";
                    cellFg = "#ffffff";
                    cellBold = true;
                  }
                }
                const isCarCol =
                  col.key === "brand_model" ||
                  col.key === "brandModel" ||
                  col.key === "car_info";
                const textAlign = isCarCol ? "right" : "center";
                const extraPad = isCarCol
                  ? "padding: 6px 10px;"
                  : "padding: 6px;";
                return `<td style="background-color: ${cellBg} !important; color: ${cellFg} !important; font-weight: ${cellBold ? "900" : "normal"}; border: 1px solid #94a3b8; ${extraPad} text-align: ${textAlign}; font-size: 8.5pt; direction: rtl;">${getCellValue(car, col.key)}</td>`;
              })
              .join("");

            tableContentHtml += `<tr>${cells}</tr>`;
          });
      });
      tableContentHtml += `</tbody></table>`;
    } else if (
      reportView === "physical-inventory-summary" ||
      reportView === "comprehensive-inventory-summary"
    ) {
      reportTitle =
        reportView === "physical-inventory-summary"
          ? "ملخص الجرد الفعلي الفئوي بالمعرض"
          : "ملخص المخزون الشامل للفئات والساحات";

      let blocksHtml = "";

      displayBrands.forEach((brandName, bIdx) => {
        const filteredCarsForBrand = (
          summaryReportsData.filteredCars || []
        ).filter((c: any) => getCleanBrandName(c.brand) === brandName);
        const activeModelsSet = new Set(
          filteredCarsForBrand.map((c: any) =>
            getCleanModelForSummary(c.model, c),
          ),
        );
        const models = (systemSchema[brandName] || []).filter((model) =>
          activeModelsSet.has(model),
        );
        activeModelsSet.forEach((model) => {
          if (!models.includes(model)) models.push(model);
        });
        if (models.length === 0) return;

        // Calculate brand total count based on current filtered dataset
        const brandTotalCount = filteredCarsForBrand.length;

        // Calculate counts for each model
        const modelCounts = models.map((model) => {
          return filteredCarsForBrand.filter(
            (c: any) => getCleanModelForSummary(c.model, c) === model,
          ).length;
        });

        blocksHtml += `
          <div style="width: 100%; border-bottom: 1.5px solid #475569; page-break-inside: avoid;">
            <table style="width: 100%; text-align: center; border-collapse: collapse; font-size: 7.5pt; font-weight: bold; font-family: 'Cairo', sans-serif;">
              <tbody>
                <!-- Row 1: Brand name banner -->
                <tr>
                  <td colSpan="${models.length + 1}" style="background-color: #cbdcf0; color: #0f172a; border: 1.5px solid #475569; font-weight: 950; padding: 3px 5px; text-align: center; font-size: 8.5pt;">
                    ${brandName}
                  </td>
                  <td style="background-color: #8ba5bf; color: #0f172a; border: 1.5px solid #475569; font-weight: 950; padding: 3px 5px; text-align: center; width: 75px; font-size: 8pt;">
                    الشركة
                  </td>
                </tr>

                <!-- Row 2: Header row with model names and "المجموع" -->
                <tr style="background-color: #ffffff;">
                  <td style="background-color: #cbdcf0; color: #0f172a; border: 1.5px solid #475569; font-weight: 900; padding: 2px 3px; width: 60px; text-align: center; font-size: 7.5pt;">
                    المجموع
                  </td>
                  ${models
                    .map(
                      (model) => `
                    <td style="border: 1.5px solid #475569; padding: 2px 3px; text-align: center; color: #1e293b; font-size: 7.5pt; font-weight: bold; min-width: 55px; word-break: keep-all; overflow-wrap: normal; white-space: normal; hyphens: none;">
                      ${model}
                    </td>
                  `,
                    )
                    .join("")}
                  <td rowSpan="2" style="background-color: #cbdcf0; color: #0f172a; border: 1.5px solid #475569; font-weight: 950; font-size: 8.5pt; vertical-align: middle; text-align: center; width: 75px;">
                    ${bIdx + 1}
                  </td>
                </tr>

                <!-- Row 3: Count row with count values -->
                <tr style="background-color: #ffffff;">
                  <td style="background-color: #f0f4f8; color: #000000; border: 1.5px solid #475569; font-weight: 950; padding: 2.5px 4px; text-align: center; font-size: 8pt;">
                    ${brandTotalCount}
                  </td>
                  ${modelCounts
                    .map(
                      (count) => `
                    <td style="border: 1.5px solid #475569; padding: 2.5px 4px; text-align: center; font-weight: 950; font-size: 8pt; color: #000000;">
                      ${count}
                    </td>
                  `,
                    )
                    .join("")}
                </tr>
              </tbody>
            </table>
          </div>
        `;
      });

      tableContentHtml = `
        <div style="font-family: 'Cairo', sans-serif; direction: rtl; padding: 10px;">
          <!-- Header block styled exactly as the image -->
          <div style="width: 100%; border: 1.5px solid #475569; border-radius: 8px; overflow: hidden; margin-bottom: 20px; background-color: white;">
            <table style="width: 100% !important; table-layout: auto !important; border-collapse: collapse !important; border: none !important; margin: 0 !important; font-family: 'Cairo', sans-serif;">
              <tbody>
                <tr style="background-color: #475569 !important; color: white !important;">
                  <td colSpan="2" style="padding: 12px 10px !important; font-size: 13pt !important; font-weight: 950 !important; text-align: center !important; border: none !important; color: white !important; background-color: #475569 !important;">
                    ${reportView === "physical-inventory-summary" ? "ملخص الجرد الفعلي الفئوي بالمعرض" : "ملخص المخزون الشامل للفئات والساحات الموحد"}
                  </td>
                </tr>
                <tr style="background-color: #ffffff !important; color: #0f172a !important;">
                  <td style="padding: 10px !important; border-top: 1.5px solid #cbd5e1 !important; border-left: 1.5px solid #cbd5e1 !important; border-right: none !important; border-bottom: none !important; text-align: center !important; font-weight: bold !important; font-size: 11pt !important; width: 80% !important; color: #0f172a !important; background-color: #ffffff !important;">
                    ${endDate ? new Date(endDate).toLocaleDateString("ar-EG") : new Date().toLocaleDateString("ar-EG")}
                  </td>
                  <td style="padding: 10px !important; border-top: 1.5px solid #cbd5e1 !important; border-right: none !important; border-left: none !important; border-bottom: none !important; text-align: center !important; font-weight: 900 !important; background-color: #e2e8f0 !important; width: 20% !important; font-size: 11pt !important; min-width: 100px !important; color: #0f172a !important;">
                    التاريخ
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Individual blocks list merged without gaps -->
          <div style="width: 100%; border: 1.5px solid #475569; border-radius: 6px; overflow: hidden; background-color: white;">
            ${blocksHtml}
          </div>

          <!-- Overall totals footer -->
          <div style="width: 100%; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; margin-top: 15px; page-break-inside: avoid;">
            <table style="width: 100%; text-align: center; border-collapse: collapse; font-size: 9pt; font-weight: bold;">
              <tbody>
                <tr style="background-color: #cbdcf0; color: #0f172a;">
                  <td style="padding: 10px; text-align: center; font-size: 11pt; font-weight: 900; border: 1px solid #cbd5e1; width: 70%;">
                    ${summaryReportsData.totalCount} سيارة
                  </td>
                  <td style="padding: 10px; text-align: center; font-size: 11pt; font-weight: 900; background-color: #94a3b8; color: #0f172a; border: 1px solid #cbd5e1; width: 30%;">
                    المجموع الكلي للأصناف
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
      `;

      if (reportView === "comprehensive-inventory-summary") {
        // Yard Overall Totals Table in Report 2
        tableContentHtml += `
          <div style="margin-top: 25px; page-break-inside: avoid; display: inline-block; width: 320px; float: left; border: 1.5px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #475569; padding: 6px 12px; color: white; display: block; font-weight: bold; font-size: 9.5pt; text-align: center;">
              📊 إجمالي المخزون الشامل للساحات
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 8.5pt;">
              <thead>
                <tr style="background-color: #f1f5f9; color: #1e293b; border-bottom: 2px solid #cbd5e1;">
                  <th style="padding: 8px; text-align: right; font-weight: 900; border: 1px solid #cbd5e1;">الساحة</th>
                  <th style="padding: 8px; text-align: center; font-weight: 900; border: 1px solid #cbd5e1; width: 110px;">العدد / الكمية</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(summaryReportsData.overallYardTotals)
                  .map(
                    ([yName, yCount]) => `
                  <tr style="background-color: #ffffff; border-bottom: 1px solid #cbd5e1;">
                    <td style="padding: 8px; text-align: right; font-weight: bold; border: 1px solid #cbd5e1; color: #0f172a;">${yName}</td>
                    <td style="padding: 8px; text-align: center; font-weight: 900; border: 1px solid #cbd5e1; color: #1e3a8a;">${yCount} سيارة</td>
                  </tr>
                `,
                  )
                  .join("")}
                <tr style="background-color: #cbdcf0; font-weight: bold;">
                  <td style="padding: 8px; text-align: right; border: 1px solid #cbd5e1; color: #0f172a;">الإجمالي الكلي لجميع الساحات</td>
                  <td style="padding: 8px; text-align: center; border: 1px solid #cbd5e1; color: #0f172a; font-weight: 900;">${summaryReportsData.totalCount} سيارة</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style="clear: both;"></div>
        `;
      }

      tableContentHtml += `</div>`;
    } else if (
      reportView === "monthly" ||
      reportView === "monthly-entry" ||
      reportView === "monthly-exit"
    ) {
      if (monthlyMovementType === "IN") {
        reportTitle = `التقرير الشهري لدخول المركبات - شهر ${selectedMonth + 1} / ${selectedYear}`;

        // Section 1: Entries
        tableContentHtml += `
          <h3 style="margin-top: 15px; margin-bottom: 10px; font-size: 13pt; color: #10b981; border-right: 4px solid #10b981; padding-right: 10px; font-weight: 900;">مركبات دخلت المخزون هذا الشهر (${monthlyStats.entries.length})</h3>
          <table>
            ${tableColGroup}
            <thead>
              <tr>
                ${tableHeaders}
              </tr>
            </thead>
            <tbody>
        `;
        if (monthlyStats.entries.length > 0) {
          let lastBrand = "";
          let lastModel = "";
          let lastAttribution = "";
          monthlyStats.entries.forEach((car, index) => {
            const cleanBrand = getCleanBrandName(car.brand);
            const showBrandHeader = cleanBrand !== lastBrand;
            if (showBrandHeader) {
              lastBrand = cleanBrand;
              lastModel = ""; // reset model header on new brand group
              lastAttribution = ""; // reset attribution
              tableContentHtml += `
                <tr>
                  <td colSpan="${activeColumns.length}" style="background-color: #f1f5f9; color: #1e3a8a; font-weight: 1000; text-align: center; font-size: 11.5pt; padding: 10px; border: 1px solid #cbd5e1;" class="brand-group-header">
                     🚘 ${cleanBrand} 🚘
                  </td>
                </tr>
              `;
            }
            const modelKey = getCleanModelKey(car.model);
            const showModelHeader = modelKey !== lastModel;
            if (showModelHeader) {
              lastModel = modelKey;
              lastAttribution = ""; // reset attribution
              tableContentHtml += `
                <tr>
                  <td colSpan="${activeColumns.length}" style="background-color: #cbd5e1; color: #000000; font-weight: 900; text-align: center; font-size: 11pt; padding: 8px; border: 1px solid #94a3b8;" class="model-group-header">
                    ${car.model || "عام"}
                  </td>
                </tr>
              `;
            }
            const attributionVal = car.attributionSource || "عام / غير محدد";
            const showAttributionHeader =
              showModelHeader || attributionVal !== lastAttribution;
            if (showAttributionHeader) {
              lastAttribution = attributionVal;
              tableContentHtml += `
                <tr>
                  <td colSpan="${activeColumns.length}" style="background-color: #e0f2fe; color: #0369a1; font-weight: 900; text-align: center; font-size: 9.5pt; padding: 6px; border: 1px solid #bae6fd;" class="attribution-group-header">
                     📥 الوارد والمصدر: ${attributionVal}
                  </td>
                </tr>
              `;
            }
            const cells = activeColumns
              .map((col) => {
                if (col.key === "cardNumber" || col.key === "card_number") {
                  const rawCard = String(car.cardNumber || "").trim();
                  const hasNoCard = !rawCard || rawCard === "-" || rawCard === "لم يرد البطاقه بعد" || rawCard === "لم يرد البطاقة بعد" || rawCard === "بدون" || rawCard === "غير متوفر" || rawCard === "لا يوجد" || rawCard === "غير مدرجة" || rawCard === "null";
                  if (hasNoCard) {
                    return `<td style="background-color: #dc2626 !important; color: #ffffff !important; font-weight: 900; text-align: center;">لم ترد البطاقة بعد</td>`;
                  }
                }
                return `<td>${getCellValue(car, col.key)}</td>`;
              })
              .join("");
            tableContentHtml += `<tr>${cells}</tr>`;
          });
        } else {
          tableContentHtml += `<tr><td colSpan="${activeColumns.length}" style="padding: 15px; color: #94a3b8; font-style: italic;">لا توجد عمليات دخول هذا الشهر</td></tr>`;
        }
        tableContentHtml += `</tbody></table>`;
      } else {
        reportTitle = `التقرير الشهري لخروج المركبات - شهر ${selectedMonth + 1} / ${selectedYear}`;

        // Section 2: Exits
        tableContentHtml += `
          <h3 style="margin-top: 15px; margin-bottom: 10px; font-size: 13pt; color: #3b82f6; border-right: 4px solid #3b82f6; padding-right: 10px; font-weight: 900;">مركبات بيعت/خرجت هذا الشهر (${monthlyStats.exits.length})</h3>
          <table>
            ${tableColGroup}
            <thead>
              <tr>
                ${tableHeaders}
              </tr>
            </thead>
            <tbody>
        `;
        if (monthlyStats.exits.length > 0) {
          let lastBrand = "";
          let lastModel = "";
          let lastAttribution = "";
          monthlyStats.exits.forEach((car, index) => {
            const cleanBrand = getCleanBrandName(car.brand);
            const showBrandHeader = cleanBrand !== lastBrand;
            if (showBrandHeader) {
              lastBrand = cleanBrand;
              lastModel = ""; // reset model header on new brand group
              lastAttribution = ""; // reset attribution
              tableContentHtml += `
                <tr>
                  <td colSpan="${activeColumns.length}" style="background-color: #f1f5f9; color: #1e3a8a; font-weight: 1000; text-align: center; font-size: 11.5pt; padding: 10px; border: 1px solid #cbd5e1;" class="brand-group-header">
                     🚘 ${cleanBrand} 🚘
                  </td>
                </tr>
              `;
            }
            const modelKey = getCleanModelKey(car.model);
            const showModelHeader = modelKey !== lastModel;
            if (showModelHeader) {
              lastModel = modelKey;
              lastAttribution = ""; // reset attribution
              tableContentHtml += `
                <tr>
                  <td colSpan="${activeColumns.length}" style="background-color: #cbd5e1; color: #000000; font-weight: 900; text-align: center; font-size: 11pt; padding: 8px; border: 1px solid #94a3b8;" class="model-group-header">
                    ${car.model || "عام"}
                  </td>
                </tr>
              `;
            }
            const attributionVal = car.attributionSource || "عام / غير محدد";
            const showAttributionHeader =
              showModelHeader || attributionVal !== lastAttribution;
            if (showAttributionHeader) {
              lastAttribution = attributionVal;
              tableContentHtml += `
                <tr>
                  <td colSpan="${activeColumns.length}" style="background-color: #e0f2fe; color: #0369a1; font-weight: 900; text-align: center; font-size: 9.5pt; padding: 6px; border: 1px solid #bae6fd;" class="attribution-group-header">
                     📤 تاريخ وتفاصيل الخروج: ${attributionVal}
                  </td>
                </tr>
              `;
            }
            const cells = activeColumns
              .map((col) => {
                if (col.key === "cardNumber" || col.key === "card_number") {
                  const rawCard = String(car.cardNumber || "").trim();
                  const hasNoCard = !rawCard || rawCard === "-" || rawCard === "لم يرد البطاقه بعد" || rawCard === "لم يرد البطاقة بعد" || rawCard === "بدون" || rawCard === "غير متوفر" || rawCard === "لا يوجد" || rawCard === "غير مدرجة" || rawCard === "null";
                  if (hasNoCard) {
                    return `<td style="background-color: #dc2626 !important; color: #ffffff !important; font-weight: 900; text-align: center;">لم ترد البطاقة بعد</td>`;
                  }
                }
                return `<td>${getCellValue(car, col.key)}</td>`;
              })
              .join("");
            tableContentHtml += `<tr>${cells}</tr>`;
          });
        } else {
          tableContentHtml += `<tr><td colSpan="${activeColumns.length}" style="padding: 15px; color: #94a3b8; font-style: italic;">لا توجد عمليات خروج هذا الشهر</td></tr>`;
        }
        tableContentHtml += `</tbody></table>`;
      }
    } else if (reportView === "daily-entry") {
      reportTitle = `تقرير دخول المركبات اليومي (${dailyReportDate})`;
      tableContentHtml = `
        <h3 style="margin-top: 15px; margin-bottom: 10px; font-size: 13pt; color: #10b981; border-right: 4px solid #10b981; padding-right: 10px; font-weight: 900;">مركبات دخلت المخزون ليوم ${dailyReportDate} (${dailyStats.entries.length})</h3>
        <table>
          ${tableColGroup}
          <thead>
            <tr>
              ${tableHeaders}
            </tr>
          </thead>
          <tbody>
      `;
      if (dailyStats.entries.length > 0) {
        let lastBrand = "";
        let lastModel = "";
        let lastAttribution = "";
        dailyStats.entries.forEach((car, index) => {
          const cleanBrand = getCleanBrandName(car.brand);
          const showBrandHeader = cleanBrand !== lastBrand;
          if (showBrandHeader) {
            lastBrand = cleanBrand;
            lastModel = ""; // reset model header on new brand group
            lastAttribution = ""; // reset attribution
            tableContentHtml += `
              <tr>
                <td colSpan="${activeColumns.length}" style="background-color: #f1f5f9; color: #1e3a8a; font-weight: 1000; text-align: center; font-size: 11.5pt; padding: 10px; border: 1px solid #cbd5e1;" class="brand-group-header">
                   🚘 ${cleanBrand} 🚘
                </td>
              </tr>
            `;
          }
          const modelKey = getCleanModelKey(car.model);
          const showModelHeader = modelKey !== lastModel;
          if (showModelHeader) {
            lastModel = modelKey;
            lastAttribution = ""; // reset attribution
            tableContentHtml += `
              <tr>
                <td colSpan="${activeColumns.length}" style="background-color: #cbd5e1; color: #000000; font-weight: 900; text-align: center; font-size: 11pt; padding: 8px; border: 1px solid #94a3b8;" class="model-group-header">
                  ${car.model || "عام"}
                </td>
              </tr>
            `;
          }
          const attributionVal = car.attributionSource || "عام / غير محدد";
          const showAttributionHeader =
            showModelHeader || attributionVal !== lastAttribution;
          if (showAttributionHeader) {
            lastAttribution = attributionVal;
            tableContentHtml += `
              <tr>
                <td colSpan="${activeColumns.length}" style="background-color: #e0f2fe; color: #0369a1; font-weight: 900; text-align: center; font-size: 9.5pt; padding: 6px; border: 1px solid #bae6fd;" class="attribution-group-header">
                   📥 الوارد والمصدر: ${attributionVal}
                </td>
              </tr>
            `;
          }
          const cells = activeColumns
            .map((col) => {
              if (col.key === "cardNumber" || col.key === "card_number") {
                const rawCard = String(car.cardNumber || "").trim();
                const hasNoCard = !rawCard || rawCard === "-" || rawCard === "لم يرد البطاقه بعد" || rawCard === "لم يرد البطاقة بعد" || rawCard === "بدون" || rawCard === "غير متوفر" || rawCard === "لا يوجد" || rawCard === "غير مدرجة" || rawCard === "null";
                if (hasNoCard) {
                  return `<td style="background-color: #dc2626 !important; color: #ffffff !important; font-weight: 900; text-align: center;">لم ترد البطاقة بعد</td>`;
                }
              }
              return `<td>${getCellValue(car, col.key)}</td>`;
            })
            .join("");
          tableContentHtml += `<tr>${cells}</tr>`;
        });
      } else {
        tableContentHtml += `<tr><td colSpan="${activeColumns.length}" style="padding: 15px; color: #94a3b8; font-style: italic;">لا توجد عمليات دخول مسجلة لهذا اليوم</td></tr>`;
      }
      tableContentHtml += `</tbody></table>`;
    } else if (reportView === "daily-exit") {
      reportTitle = `تقرير خروج المركبات اليومي (${dailyReportDate})`;
      tableContentHtml = `
        <h3 style="margin-top: 15px; margin-bottom: 10px; font-size: 13pt; color: #3b82f6; border-right: 4px solid #3b82f6; padding-right: 10px; font-weight: 900;">مركبات بيعت/خرجت ليوم ${dailyReportDate} (${dailyStats.exits.length})</h3>
        <table>
          ${tableColGroup}
          <thead>
            <tr>
              ${tableHeaders}
            </tr>
          </thead>
          <tbody>
      `;
      if (dailyStats.exits.length > 0) {
        let lastBrand = "";
        let lastModel = "";
        let lastAttribution = "";
        dailyStats.exits.forEach((car, index) => {
          const cleanBrand = getCleanBrandName(car.brand);
          const showBrandHeader = cleanBrand !== lastBrand;
          if (showBrandHeader) {
            lastBrand = cleanBrand;
            lastModel = ""; // reset model header on new brand group
            lastAttribution = ""; // reset attribution
            tableContentHtml += `
              <tr>
                <td colSpan="${activeColumns.length}" style="background-color: #f1f5f9; color: #1e3a8a; font-weight: 1000; text-align: center; font-size: 11.5pt; padding: 10px; border: 1px solid #cbd5e1;" class="brand-group-header">
                   🚘 ${cleanBrand} 🚘
                </td>
              </tr>
            `;
          }
          const modelKey = getCleanModelKey(car.model);
          const showModelHeader = modelKey !== lastModel;
          if (showModelHeader) {
            lastModel = modelKey;
            lastAttribution = ""; // reset attribution
            tableContentHtml += `
              <tr>
                <td colSpan="${activeColumns.length}" style="background-color: #cbd5e1; color: #000000; font-weight: 900; text-align: center; font-size: 11pt; padding: 8px; border: 1px solid #94a3b8;" class="model-group-header">
                  ${car.model || "عام"}
                </td>
              </tr>
            `;
          }
          const attributionVal = car.attributionSource || "عام / غير محدد";
          const showAttributionHeader =
            showModelHeader || attributionVal !== lastAttribution;
          if (showAttributionHeader) {
            lastAttribution = attributionVal;
            tableContentHtml += `
              <tr>
                <td colSpan="${activeColumns.length}" style="background-color: #e0f2fe; color: #0369a1; font-weight: 900; text-align: center; font-size: 9.5pt; padding: 6px; border: 1px solid #bae6fd;" class="attribution-group-header">
                   📥 الوارد والمصدر: ${attributionVal}
                </td>
              </tr>
            `;
          }
          const cells = activeColumns
            .map((col) => {
              if (col.key === "cardNumber" || col.key === "card_number") {
                const rawCard = String(car.cardNumber || "").trim();
                const hasNoCard = !rawCard || rawCard === "-" || rawCard === "لم يرد البطاقه بعد" || rawCard === "لم يرد البطاقة بعد" || rawCard === "بدون" || rawCard === "غير متوفر" || rawCard === "لا يوجد" || rawCard === "غير مدرجة" || rawCard === "null";
                if (hasNoCard) {
                  return `<td style="background-color: #dc2626 !important; color: #ffffff !important; font-weight: 900; text-align: center;">لم ترد البطاقة بعد</td>`;
                }
              }
              return `<td>${getCellValue(car, col.key)}</td>`;
            })
            .join("");
          tableContentHtml += `<tr>${cells}</tr>`;
        });
      } else {
        tableContentHtml += `<tr><td colSpan="${activeColumns.length}" style="padding: 15px; color: #94a3b8; font-style: italic;">لا توجد عمليات خروج مسجلة لهذا اليوم</td></tr>`;
      }
      tableContentHtml += `</tbody></table>`;
    } else if (reportView === "daily-movement-statement") {
      const daySummary = DailyAutoCalculator.calculateForDate(
        cars,
        statementDate,
        computedMovementHistory,
      );
      reportTitle = `بيان حركة المخزون اليومية (${statementDate})`;
      tableContentHtml = `
        <div style="font-family: 'Cairo', sans-serif; direction: rtl; text-align: right; max-width: 900px; margin: 0 auto; color: #1e293b;">
          
          <!-- Opening Balance Box -->
          <div style="background-color: #f8fafc; border: 2px solid #cbd5e1; border-radius: 12px; padding: 18px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 15pt; font-weight: 900; color: #334155;">الرصيد الافتتاحي للـيـوم:</span>
            <span style="font-size: 24pt; font-weight: 1000; color: #2563eb; font-family: monospace; border-bottom: 3px double #2563eb; padding-bottom: 2px;">${daySummary.openingBalance} مركبة</span>
          </div>

          <!-- Outbound section -->
          <div style="margin-bottom: 30px; border: 2px solid #fecaca; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
            <div style="background-color: #fee2e2; color: #991b1b; padding: 12px 18px; font-weight: 1000; font-size: 13pt; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #fecaca;">
              <span>🚨 المركبات الخارجة اليوم (مباع / صادر)</span>
              <span style="font-family: monospace; font-size: 14pt; font-weight: 900; background: #991b1b; color: #ffffff; padding: 2px 10px; border-radius: 6px;">العدد: ${daySummary.exitedCount}</span>
            </div>
            <div style="padding: 15px;">
              ${
                daySummary.exitedCars.length > 0
                  ? `
                <table style="width: 100%; border-collapse: collapse; font-size: 10.5pt; text-align: right;">
                  <thead>
                    <tr style="border-bottom: 2.5px solid #fee2e2; color: #7f1d1d; font-weight: 900; background-color: #fff5f5;">
                      <th style="padding: 10px 8px; width: 45px; text-align: center;">م</th>
                      <th style="padding: 10px 8px; text-align: right;">الماركة والطراز</th>
                      <th style="padding: 10px 8px; text-align: right;">رقم الهيكل / الشاصي</th>
                      <th style="padding: 10px 8px; text-align: right;">البائع / المندوب</th>
                      <th style="padding: 10px 8px; text-align: right;">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${daySummary.exitedCars
                      .map((car, idx) => {
                        const isTr = Boolean(car.isTransfer || car.transferNo);
                        return `
                      <tr style="border-bottom: 1px dashed #e2e8f0; font-size: 10pt;">
                        <td style="padding: 10px 8px; text-align: center; font-weight: 950; color: #b91c1c; background-color: #fffafb;">${idx + 1}</td>
                        <td style="padding: 10px 8px; font-weight: 950; color: #1e293b;">
                          ${formatVehicleDisplay(car)}
                          ${isTr ? `<span style="display: inline-block; background-color: #dbeafe; color: #1e40af; border: 1px solid #93c5fd; font-size: 8pt; font-weight: 900; padding: 2px 6px; border-radius: 4px; margin-right: 6px;">[🔄 تحويل - محولة]</span>` : ""}
                        </td>
                        <td style="padding: 10px 8px; font-family: monospace; font-size: 9.5pt; color: #334155; font-weight: bold;" dir="ltr">${car.vin}</td>
                        <td style="padding: 10px 8px; color: ${isTr ? "#1d4ed8" : "#b91c1c"}; font-weight: bold;">
                          ${isTr ? `🔄 ${car.seller || "تحويل صادر"}` : `👤 ${car.seller || "غير محدد"}`}
                        </td>
                        <td style="padding: 10px 8px; color: #64748b; font-size: 9pt;">${car.notes ? getCleanDelegateName(car.notes) : isTr ? "تحويل بخطاب" : '<span style="color:#cbd5e1;">-</span>'}</td>
                      </tr>
                    `;
                      })
                      .join("")}
                  </tbody>
                </table>
              `
                  : `
                <div style="text-align: center; color: #64748b; font-style: italic; padding: 25px 0; font-weight: bold;">لا توجد عمليات خروج مسجلة لهذا اليوم</div>
              `
              }
            </div>
          </div>

          <!-- Inbound section -->
          <div style="margin-bottom: 30px; border: 2px solid #bbf7d0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
            <div style="background-color: #dcfce7; color: #166534; padding: 12px 18px; font-weight: 1000; font-size: 13pt; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #bbf7d0;">
              <span>🌱 المركبات الداخلة اليوم (وارد جديد)</span>
              <span style="font-family: monospace; font-size: 14pt; font-weight: 900; background: #166534; color: #ffffff; padding: 2px 10px; border-radius: 6px;">العدد: ${daySummary.enteredCount}</span>
            </div>
            <div style="padding: 15px;">
              ${
                daySummary.enteredCars.length > 0
                  ? `
                <table style="width: 100%; border-collapse: collapse; font-size: 10.5pt; text-align: right;">
                  <thead>
                    <tr style="border-bottom: 2.5px solid #bbf7d0; color: #14532d; font-weight: 900; background-color: #f6fdf9;">
                      <th style="padding: 10px 8px; width: 45px; text-align: center;">م</th>
                      <th style="padding: 10px 8px; text-align: right;">الماركة والطراز</th>
                      <th style="padding: 10px 8px; text-align: right;">رقم الهيكل / الشاصي</th>
                      <th style="padding: 10px 8px; text-align: right;">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${daySummary.enteredCars
                      .map((car, idx) => {
                        const isTr = Boolean(car.isTransfer || car.transferNo);
                        return `
                      <tr style="border-bottom: 1px dashed #e2e8f0; font-size: 10pt;">
                        <td style="padding: 10px 8px; text-align: center; font-weight: 950; color: #15803d; background-color: #fafeff;">${idx + 1}</td>
                        <td style="padding: 10px 8px; font-weight: 950; color: #1e293b;">
                          ${formatVehicleDisplay(car)}
                          ${isTr ? `<span style="display: inline-block; background-color: #e0e7ff; color: #3730a3; border: 1px solid #a5b4fc; font-size: 8pt; font-weight: 900; padding: 2px 6px; border-radius: 4px; margin-right: 6px;">[📥 تحويل وارد]</span>` : ""}
                        </td>
                        <td style="padding: 10px 8px; font-family: monospace; font-size: 9.5pt; color: #334155; font-weight: bold;" dir="ltr">${car.vin}</td>
                        <td style="padding: 10px 8px; color: #64748b; font-size: 9pt;">${car.notes ? getCleanDelegateName(car.notes) : isTr ? "تحويل وارد بخطاب" : '<span style="color:#cbd5e1;">-</span>'}</td>
                      </tr>
                    `;
                      })
                      .join("")}
                  </tbody>
                </table>
              `
                  : `
                <div style="text-align: center; color: #64748b; font-style: italic; padding: 25px 0; font-weight: bold;">لا توجد عمليات دخول مسجلة لهذا اليوم</div>
              `
              }
            </div>
          </div>

          <!-- Closing Balance Box -->
          <div style="background-color: #faf5ff; border: 2.5px solid #d8b4fe; border-radius: 12px; padding: 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <span style="font-size: 15pt; font-weight: 950; color: #581c87;">🔐 رصيد اليوم المغلق (العدد المغلق النهائي):</span>
            <span style="font-size: 26pt; font-weight: 1000; color: #7e22ce; font-family: monospace; border-bottom: 4px double #7e22ce; padding-bottom: 2px;">${daySummary.closingBalance} مركبة</span>
          </div>

        </div>
      `;
    } else if (reportView === "daily-summary") {
      reportTitle = "تقرير ملخص حركة المخزون اليومية (الدخول والخروج)";

      const enteredCars = dailyStats.entries || [];
      const exitedCars = dailyStats.exits || [];

      tableContentHtml = `
        <h3 style="margin-top: 15px; margin-bottom: 20px; font-size: 14pt; color: #1e3a8a; border-right: 4px solid #1e3a8a; padding-right: 10px; font-weight: 900; text-align: right;">
          ملخص حركة المركبات اليومية ليوم: <span style="font-family: monospace; font-size: 13pt;">${dailyReportDate}</span>
        </h3>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; border: none;">
          <tbody>
            <tr>
              <!-- القسم الأول: دخول السيارات -->
              <td style="width: 50%; vertical-align: top; padding-left: 10px; border: none; background: transparent;">
                <div style="border: 2px solid #059669; border-radius: 12px; overflow: hidden; background-color: #f0fdf4; height: 100%;">
                  <div style="background-color: #059669; color: #ffffff; padding: 12px; font-weight: 900; font-size: 12pt; text-align: center;">
                    📥 حركة دخول السيارات (الدخول اليومي) - الإجمالي: ${enteredCars.length} سيارات
                  </div>
                  <div style="padding: 10px;">
                    <table style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
                      <thead>
                        <tr style="background-color: #e2e8f0; color: #1e293b; font-size: 9.5pt;">
                          <th style="border: 1px solid #cbd5e1; padding: 6px; width: 30px; text-align: center; font-weight: bold; font-size: 9pt;">م</th>
                          <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-weight: bold; font-size: 9pt;">المركبة وتفاصيلها</th>
                          <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; width: 130px; font-weight: bold; font-size: 9pt;">رقم الهيكل VIN</th>
                          <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-weight: bold; font-size: 9pt;">اللون / ملاحظات الدخول</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${
                          enteredCars.length > 0
                            ? enteredCars
                                .map(
                                  (car, idx) => `
                          <tr style="font-size: 9pt;">
                            <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold; color: #1e293b;">${idx + 1}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: 800; color: #014737;">${formatVehicleDisplay(car)} (${car.year || "-"})</td>
                            <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-family: monospace; font-size: 8.5pt; font-weight: bold; color: #334155; word-break: break-all;">${car.vin || "-"}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: #475569; font-size: 8.5pt;">
                              ${car.color ? `<span style="font-weight:bold;">اللون:</span> ${car.color} ${car.notes ? " | " : ""}` : ""}
                              ${car.notes || "لا توجد ملاحظات"}
                            </td>
                          </tr>
                        `,
                                )
                                .join("")
                            : `
                          <tr>
                            <td colspan="4" style="border: 1px solid #cbd5e1; padding: 35px; text-align: center; color: #94a3b8; font-style: italic; font-size: 10pt;">
                              لا توجد حركة دخول سيارات مسجلة لهذا اليوم ℹ️
                            </td>
                          </tr>
                        `
                        }
                      </tbody>
                    </table>
                    <div style="font-weight: 900; font-size: 11pt; color: #065f46; text-align: right; padding: 12px 5px 0 0; border-top: 1px solid #cbd5e1; margin-top: 10px;">
                      إجمالي السيارات الداخلة: <span style="font-size: 13pt; color: #047857;">${enteredCars.length}</span> سيارة
                    </div>
                  </div>
                </div>
              </td>
              
              <!-- القسم الثاني: خروج السيارات -->
              <td style="width: 50%; vertical-align: top; padding-right: 10px; border: none; background: transparent;">
                <div style="border: 2px solid #dc2626; border-radius: 12px; overflow: hidden; background-color: #fef2f2; height: 100%;">
                  <div style="background-color: #dc2626; color: #ffffff; padding: 12px; font-weight: 900; font-size: 12pt; text-align: center;">
                    📤 حركة خروج السيارات (الخروج اليومي) - الإجمالي: ${exitedCars.length} سيارات
                  </div>
                  <div style="padding: 10px;">
                    <table style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
                      <thead>
                        <tr style="background-color: #e2e8f0; color: #1e293b; font-size: 9.5pt;">
                          <th style="border: 1px solid #cbd5e1; padding: 6px; width: 30px; text-align: center; font-weight: bold; font-size: 9pt;">م</th>
                          <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-weight: bold; font-size: 9pt;">المركبة وتفاصيلها</th>
                          <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; width: 130px; font-weight: bold; font-size: 9pt;">رقم الهيكل VIN</th>
                          <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-weight: bold; font-size: 9pt;">البائع / ملاحظات الخروج</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${
                          exitedCars.length > 0
                            ? exitedCars
                                .map(
                                  (car, idx) => `
                          <tr style="font-size: 9pt;">
                            <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold; color: #1e293b;">${idx + 1}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-weight: 800; color: #7f1d1d;">${formatVehicleDisplay(car)} (${car.year || "-"})</td>
                            <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-family: monospace; font-size: 8.5pt; font-weight: bold; color: #334155; word-break: break-all;">${car.vin || "-"}</td>
                            <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; font-size: 8.5pt;">
                              <div style="margin-bottom: 2px;">👤 <span style="font-weight: bold; color: #991b1b;">المندوب:</span> ${car.seller || "غير محدد"}</div>
                              ${car.exitType ? `<div style="font-size: 8pt; color: #475569;"><span style="font-weight:bold;">نوع الصرف:</span> ${car.exitType}</div>` : ""}
                              ${car.notes ? `<div style="font-size: 8pt; color: #475569; margin-top:2px;">📝 ${car.notes}</div>` : ""}
                            </td>
                          </tr>
                        `,
                                )
                                .join("")
                            : `
                          <tr>
                            <td colspan="4" style="border: 1px solid #cbd5e1; padding: 35px; text-align: center; color: #94a3b8; font-style: italic; font-size: 10pt;">
                              لا توجد حركة خروج سيارات مسجلة لهذا اليوم ℹ️
                            </td>
                          </tr>
                        `
                        }
                      </tbody>
                    </table>
                    <div style="font-weight: 900; font-size: 11pt; color: #991b1b; text-align: right; padding: 12px 5px 0 0; border-top: 1px solid #cbd5e1; margin-top: 10px;">
                      إجمالي السيارات الخارجة: <span style="font-size: 13pt; color: #b91c1c;">${exitedCars.length}</span> سيارة
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      `;
    } else if (reportView === "analytics") {
      reportTitle = "التقرير التحليلي الذكي لحركة مخزون المركبات";
      tableContentHtml = `
        <div style="font-family: 'Cairo', sans-serif; line-height: 1.6;">
          <h3 style="margin-top: 15px; margin-bottom: 15px; font-size: 14pt; color: #1e3a8a; border-right: 4px solid #1e3a8a; padding-right: 10px; font-weight: 900;">ملخص أداء حركة المركبات طوال الفترة</h3>
          
          <!-- Key Indicators cards grid -->
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 25px;">
            <div style="border: 1px solid #cbd5e1; padding: 12px; border-radius: 10px; text-align: center; background-color: #f0fdf4;">
              <div style="font-size: 8.5pt; color: #15803d; font-weight: bold;">إجمالي الوارد (دخول)</div>
              <div style="font-size: 18pt; font-weight: 950; color: #166534; margin: 5px 0;">+${analyticsData.enteredCount}</div>
              <div style="font-size: 7.5pt; color: #475569;">بقعة المخزون الاحتياطي</div>
            </div>
            <div style="border: 1px solid #cbd5e1; padding: 12px; border-radius: 10px; text-align: center; background-color: #eff6ff;">
              <div style="font-size: 8.5pt; color: #1d4ed8; font-weight: bold;">إجمالي الصادر (خروج)</div>
              <div style="font-size: 18pt; font-weight: 950; color: #1e40af; margin: 5px 0;">-${analyticsData.exitedCount}</div>
              <div style="font-size: 7.5pt; color: #475569;">إشارة سحب الطلبيات</div>
            </div>
            <div style="border: 1px solid #cbd5e1; padding: 12px; border-radius: 10px; text-align: center; background-color: #fef3c7;">
              <div style="font-size: 8.5pt; color: #b45309; font-weight: bold;">صافي التغير الحركي</div>
              <div style="font-size: 18pt; font-weight: 950; color: #78350f; margin: 5px 0;">${analyticsData.enteredCount - analyticsData.exitedCount}</div>
              <div style="font-size: 7.5pt; color: #475569;">مستوى وفر الرصيد</div>
            </div>
            <div style="border: 1px solid #cbd5e1; padding: 12px; border-radius: 10px; text-align: center; background-color: #faf5ff;">
              <div style="font-size: 8.5pt; color: #7e22ce; font-weight: bold;">إجمالي الحركات الكلي</div>
              <div style="font-size: 18pt; font-weight: 950; color: #581c87; margin: 5px 0;">${analyticsData.enteredCount + analyticsData.exitedCount}</div>
              <div style="font-size: 7.5pt; color: #475569;">المرور الإجمالي للتسجيلات</div>
            </div>
          </div>

          <!-- Smart Insights -->
          <div style="border: 1px solid #cbd5e1; border-radius: 14px; padding: 16px; background-color: #f8fafc; margin-bottom: 25px;">
            <h4 style="margin: 0 0 10px 0; font-size: 11pt; color: #0f172a; font-weight: 900;">💡 التوصيات ونظام التحليل الذكي للبيانات</h4>
            <ul style="margin: 0; padding-right: 20px; font-size: 9pt; color: #334155; line-height: 1.7;">
              ${analyticsData.insights.map((i) => `<li style="margin-bottom: 6px;">${i.replace(/\*\*/g, "")}</li>`).join("")}
              ${analyticsData.insights.length === 0 ? '<li style="color: #94a3b8; font-style: italic;">لا توجد مؤشرات كافية لاستخلاص تحليلات لهذه الفترة.</li>' : ""}
            </ul>
          </div>

          <!-- Section 3: Brand Demands with previous month comparison -->
          <h3 style="margin-top: 20px; margin-bottom: 12px; font-size: 12pt; color: #0f172a; border-right: 4px solid #2563eb; padding-right: 8px; font-weight: 900;">1. الماركات الأكثر طلباً وحركة (صادر مبيعات) ومقارنة الشهر السابق</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
            <thead>
              <tr style="background-color: #0f172a; color: white;">
                <th style="width: 5%; font-size:9pt; padding:6px;">م</th>
                <th style="text-align: right; padding-right: 15px; font-size:9pt; padding:6px;">الماركة التجارية</th>
                <th style="width: 18%; font-size:9pt; padding:6px;">الكمية الخارجة</th>
                <th style="width: 15%; font-size:9pt; padding:6px;">المستحوذ %</th>
                <th style="width: 18%; font-size:9pt; padding:6px;">الشهر السابق</th>
                <th style="width: 25%; font-size:9pt; padding:6px;">الاتجاه العام والتغير</th>
              </tr>
            </thead>
            <tbody>
              ${analyticsData.topBrandsDemand
                .map((brand, idx) => {
                  const totalOut = analyticsData.exitedCount || 1;
                  const ratio = (brand.count / totalOut) * 100;
                  const trendIcon =
                    brand.trend === "up"
                      ? "📈 صعود"
                      : brand.trend === "down"
                        ? "📉 هبوط"
                        : "➡️ مستقر";
                  const trendColor =
                    brand.trend === "up"
                      ? "#16a34a"
                      : brand.trend === "down"
                        ? "#dc2626"
                        : "#475569";
                  return `
                  <tr style="font-size:8.5pt;">
                    <td style="padding:6px;">${idx + 1}</td>
                    <td style="text-align: right; padding-right: 15px; font-weight: bold; padding:6px;">${brand.brand}</td>
                    <td style="font-weight: bold; padding:6px;">${brand.count} سيارات</td>
                    <td style="padding:6px;">${ratio.toFixed(1)}%</td>
                    <td style="padding:6px;">${brand.prevCount} سيارات</td>
                    <td style="font-weight: bold; color: ${trendColor}; padding:6px;">${trendIcon} (${brand.pctChange.toFixed(0)}%)</td>
                  </tr>
                `;
                })
                .join("")}
              ${analyticsData.topBrandsDemand.length === 0 ? '<tr><td colSpan="6" style="padding: 15px; color: #94a3b8; font-style: italic;">لا توجد بيانات خروج في هذه الفترة</td></tr>' : ""}
            </tbody>
          </table>

          <!-- Section 4: Models & Velocity -->
          <h3 style="margin-top: 20px; margin-bottom: 12px; font-size: 12pt; color: #0f172a; border-right: 4px solid #6366f1; padding-right: 8px; font-weight: 900;">2. الموديلات الأكثر طلباً وسرعة دوران المخزون</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
            <thead>
              <tr style="background-color: #1e1b4b; color: white;">
                <th style="width: 5%; font-size:9pt; padding:6px;">م</th>
                <th style="text-align: right; padding-right: 15px; font-size:9pt; padding:6px;">الموديل</th>
                <th style="width: 20%; font-size:9pt; padding:6px;">كمية الخروج</th>
                <th style="width: 25%; font-size:9pt; padding:6px;">متوسط فترات البقاء (أيام)</th>
                <th style="width: 25%; font-size:9pt; padding:6px;">مستوى تصنيف الرواج</th>
              </tr>
            </thead>
            <tbody>
              ${analyticsData.topModelsDemand
                .slice(0, 10)
                .map(
                  (model, idx) => `
                <tr style="font-size:8.5pt;">
                  <td style="padding:6px;">${idx + 1}</td>
                  <td style="text-align: right; padding-right: 15px; font-weight: bold; padding:6px;">${model.key}</td>
                  <td style="font-weight: bold; padding:6px;">${model.count} سيارات</td>
                  <td style="font-family: monospace; padding:6px;">${model.avgStay !== null ? `${model.avgStay} أيام` : "غير متوفر"}</td>
                  <td style="font-weight: bold; color: ${model.speedTag === "سريعة جداً" ? "#059669" : model.speedTag === "سريعة الدوران" ? "#2563eb" : "#475569"}; padding:6px;">${model.speedTag}</td>
                </tr>
              `,
                )
                .join("")}
              ${analyticsData.topModelsDemand.length === 0 ? '<tr><td colSpan="5" style="padding: 15px; color: #94a3b8; font-style: italic;">لا توجد موديلات مخرجة مسجلة</td></tr>' : ""}
            </tbody>
          </table>

          <!-- Grid: Exits by customer type & suppliers -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top:20px;">
            <div>
              <h4 style="margin: 0 0 10px 0; font-size: 10.5pt; color: #0c0a09; border-right: 3px solid #f59e0b; padding-right: 5px; font-weight:900;">3. قنوات وصنف المخارج (عملاء ومبيعات)</h4>
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background-color: #7c2d12; color: white;">
                    <th style="text-align: right; padding-right: 10px; font-size:8.5pt; padding:5px;">نوع البيع الحركي</th>
                    <th style="font-size:8.5pt; padding:5px;">كمية الخروج</th>
                    <th style="font-size:8.5pt; padding:5px;">النسبة</th>
                  </tr>
                </thead>
                <tbody>
                  ${analyticsData.exitTypesDistribution
                    .map(
                      (item) => `
                    <tr style="font-size:8pt;">
                      <td style="text-align: right; padding-right: 10px; font-weight: bold; padding:5px;">${item.name}</td>
                      <td style="padding:5px;">${item.value} سيارات</td>
                      <td style="padding:5px;">${((item.value / (analyticsData.exitedCount || 1)) * 100).toFixed(1)}%</td>
                    </tr>
                  `,
                    )
                    .join("")}
                  ${analyticsData.exitTypesDistribution.length === 0 ? '<tr><td colSpan="3" style="padding: 10px; color: #94a3b8;">لا توجد بيانات نوع خروج مفرزة</td></tr>' : ""}
                </tbody>
              </table>
            </div>
            
            <div>
              <h4 style="margin: 0 0 10px 0; font-size: 10.5pt; color: #0c0a09; border-right: 3px solid #10b981; padding-right: 5px; font-weight:900;">4. الموردين وحجم التمويل (الوارد)</h4>
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background-color: #064e3b; color: white;">
                    <th style="text-align: right; padding-right: 10px; font-size:8.5pt; padding:5px;">المورد الشريك</th>
                    <th style="font-size:8.5pt; padding:5px;">المركبات الموردة</th>
                    <th style="font-size:8.5pt; padding:5px;">الحصة %</th>
                  </tr>
                </thead>
                <tbody>
                  ${analyticsData.topSuppliers
                    .slice(0, 5)
                    .map(
                      (item) => `
                    <tr style="font-size:8pt;">
                      <td style="text-align: right; padding-right: 10px; font-weight: bold; padding:5px;">${item.supplier}</td>
                      <td style="padding:5px;">${item.count} سيارات</td>
                      <td style="padding:5px;">${((((item.count / (analyticsData.enteredCount || 1)) * 105) / 105) * 100).toFixed(1)}%</td>
                    </tr>
                  `,
                    )
                    .join("")}
                  ${analyticsData.topSuppliers.length === 0 ? '<tr><td colSpan="3" style="padding: 10px; color: #94a3b8;">لا توجد توريدات مسجلة لهذه الفترة</td></tr>' : ""}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    }

    if (!reportTitle || !reportTitle.trim()) {
      reportTitle = getReportTitleByView(reportView, selectedDelegateFilter);
    }

    const htmlContent = `
      <html dir="rtl" lang="ar">
        <head>
          <title>${settings.orgType || "مؤسسة"} ${settings.name} - ${reportTitle}</title>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
          <style>
            @page { size: A4 ${orientation}; margin: 5mm; }
            body { font-family: 'Cairo', sans-serif; margin: 0; padding: 10px; direction: rtl; color: #0f172a; position: relative; }
            .watermark { 
              position: absolute; 
              top: 50%; 
              left: 50%; 
              transform: translate(-50%, -50%); 
              opacity: 0.25; 
              width: 50%; 
              pointer-events: none; 
              z-index: 9999; 
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 3px double #1e3a8a;
              padding-bottom: 15px;
              margin-bottom: 20px;
              position: relative;
              z-index: 10;
            }
            .header-right {
              text-align: right;
              flex: 1.2;
              padding-right: 45px;
            }
            .header-center {
              text-align: center;
              flex: 1;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            }
            .header-left {
              text-align: left;
              flex: 1.2;
              display: flex;
              flex-direction: column;
              align-items: flex-end;
              justify-content: space-between;
              height: 85px;
              padding-left: 45px;
            }
            .header-logo, .logo, .logo-img, .logo-area, .logo-header img, .logo-container img {
              width: ${settings.logoWidth !== undefined ? settings.logoWidth : 120}px !important;
              max-height: none !important;
              max-width: none !important;
              height: auto !important;
              object-fit: contain;
              filter: drop-shadow(0px 3px 6px rgba(0,0,0,0.06));
              position: relative !important;
              transform: translate(${settings.logoPosX !== undefined ? settings.logoPosX : 0}px, ${settings.logoPosY !== undefined ? settings.logoPosY : 0}px) !important;
            }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 15px; position: relative; z-index: 10; }
            th.col-counter, td.col-counter, .col-counter { width: 47px !important; min-width: 47px !important; max-width: 47px !important; }
            tr { height: 21pt !important; page-break-inside: avoid !important; }
            thead tr { height: 25pt !important; }
            th, td { border: 0.1pt solid #94a3b8; padding: 3px 2px; text-align: center; font-size: 7.5pt; word-break: keep-all; overflow-wrap: normal; white-space: normal; hyphens: none; line-height: 1.3 !important; vertical-align: middle !important; }
            th { background-color: #0f172a; color: white; font-weight: 900; }
            tr:nth-child(even) { background-color: #f1f5f9; }
            thead { display: table-header-group; }
            .signature-block { margin-top: 30px; display: flex; justify-content: space-between; font-size: 9pt; font-weight: bold; color: #334155; page-break-inside: avoid; position: relative; z-index: 10; }
            .signature-box { border-top: 1px dashed #94a3b8; width: 200px; text-align: center; margin-top: 35px; padding-top: 5px; }
            .footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 7pt; color: #64748b; padding: 5px; border-top: 0.1pt solid #e2e8f0; position: relative; z-index: 10; }
          </style>
        </head>
        <body>
          <img src="${settings.logoUrl || getLogoDataUri(settings.name)}" class="watermark" alt="شعار الخلفية" />
          <div class="header">
            <div class="header-right">
              <h1 style="margin: 0 0 5px 0; font-size: 21pt; font-weight: 900; color: #1e3a8a; letter-spacing: normal; line-height: 1.2;">
                ${settings.orgType || "مؤسسة"} ${settings.name || "سما الفرسان للتجارة"}
              </h1>
              <div style="font-size: 9.5pt; color: #334155; line-height: 1.6; font-weight: bold; margin-top: 5px;">
                <div style="display: flex; flex-direction: column; gap: 3px;">
                  <span>سجل تجاري رقم: <strong style="color: #0f172a; font-family: monospace; font-size: 10.5pt;">${settings.commercialRegister || "٥٩٥٠٠٢٧١٦٣"}</strong></span>
                  <span>الرقم الضريبي الموحد: <strong style="color: #0f172a; font-family: monospace; font-size: 10.5pt;">${settings.taxNumber || "٣١١٨٠٤٦٥٤٨٠٠٠٠٣"}</strong></span>
                  ${settings.contactNumber ? `<span>رقم التواصل والدعم: <strong style="color: #0f172a; font-family: monospace; font-size: 10.5pt;">${settings.contactNumber}</strong></span>` : ""}
                </div>
              </div>
            </div>
            
            <div class="header-center">
              ${showOrgLogo ? `<img src="${settings.logoUrl || getLogoDataUri(settings.name)}" class="header-logo" alt="شعار المؤسسة" />` : ""}
            </div>

            <div class="header-left">
              <span style="font-size: 9.5pt; color: #1e3a8a; font-weight: 900; border-bottom: 2px solid #cbd5e1; padding-bottom: 3px; display: inline-block; margin-bottom: 4px;">المملكة العربية السعودية</span>
              <div style="text-align: left; width: 100%;">
                <p style="margin: 4px 0 0 0; font-size: 9pt; color: #475569; font-weight: bold; text-align: left;">تاريخ الطباعة: <span style="font-family: monospace; color: #0f172a; font-weight: 900;">${new Date().toLocaleDateString("ar-EG")}</span></p>
              </div>
            </div>
          </div>

          <div style="text-align: center; margin: 15px 0 25px 0; width: 100%;">
            <span style="font-family: 'Cairo', sans-serif; font-weight: 900; font-size: 16pt; color: #1e3a8a; background-color: #f0f7ff; padding: 8px 30px; border-radius: 12px; border: 2px solid #bfdbfe; display: inline-block; box-shadow: 0 4px 10px rgba(30,58,138,0.06); letter-spacing: normal;">
              ${reportTitle || getReportTitleByView(reportView, selectedDelegateFilter)}
            </span>
          </div>

          ${tableContentHtml}
          
          <div class="signature-block">
            <div>
              <span>معد التقرير: __________________</span>
              <div class="signature-box">توقيع المسؤول الإداري</div>
            </div>
            <div style="position: relative; width: 220px;">
              <span>اعتماد المدير العام: __________________</span>
              <div class="signature-box">ختم وتوقيع الإدارة</div>
              <img src="${settings.stampUrl || getStampDataUri()}" style="position: absolute; bottom: -15px; left: 15px; max-height: 80px; max-width: 80px; mix-blend-mode: multiply;" alt="الختم الرسمي" />
            </div>
          </div>

          <div class="footer">طُبع بواسطة نظام ${settings.name}</div>
          <script>
            window.onload = () => {
              setTimeout(() => { window.print(); }, 1000);
            };
          </script>
        </body>
      </html>
    `;

    const previewHtml = htmlContent.replace(/window\.close\(\);?/g, "").trim();
    if (typeof (window as any).showPrintPreview === "function") {
      (window as any).showPrintPreview(previewHtml);
      return;
    }
    const iframeHtml = previewHtml.replace(/window\.print\(\);?/g, "");
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.bottom = "0";
    iframe.style.right = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.zIndex = "-9999";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(iframeHtml);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error("Print failed:", e);
        }
        setTimeout(() => {
          try {
            if (iframe.parentNode) {
              document.body.removeChild(iframe);
            }
          } catch (err) {
            console.error(err);
          }
        }, 3000);
      }, 1000);
    } else {
      alert("حدث خطأ أثناء محاولة تهيئة نافذة الطباعة");
    }
  };

  const generateProfessionalPDF = (
    pdfType:
      | "current"
      | "full"
      | "brand"
      | "supplier"
      | "timeline"
      | "physical-summary"
      | "comprehensive-summary",
  ) => {
    let reportTitle = "";
    let bodyHtml = "";
    let localOrientation = "landscape";

    if (pdfType === "current") {
      localOrientation = "portrait";
      reportTitle =
        "التقرير التحليلي الذكي لحركة مخزون السيارات والمبيعات المستهدفة";

      const topBrand = analyticsData.topBrandsDemand[0]?.brand || "غير متوفر";
      const topBrandCount = analyticsData.topBrandsDemand[0]?.count || 0;
      const topModel = analyticsData.topModelsDemand[0]?.model || "غير محدد";
      const topModelSpeed =
        analyticsData.topModelsDemand[0]?.speedTag || "طبيعي";
      const topSupplier =
        analyticsData.topSuppliers[0]?.supplier || "توريد عام";
      const topSupplierCount = analyticsData.topSuppliers[0]?.count || 0;
      const fastestDuration =
        analyticsData.topModelsDemand[0]?.avgStay !== null
          ? `${analyticsData.topModelsDemand[0]?.avgStay} أيام`
          : "غير متوفر";

      const totalVal =
        analyticsData.retailCount + analyticsData.showroomCount || 1;
      const retailRatio = Math.round(
        (analyticsData.retailCount / totalVal) * 100,
      );
      const showroomRatio = 100 - retailRatio;

      let bSvgHtml = "";
      if (analyticsData.topBrandsDemand.length > 0) {
        const top5 = analyticsData.topBrandsDemand.slice(0, 5);
        const maxExit = top5[0]?.count || 1;
        bSvgHtml = `
          <div style="margin-top: 15px; border: 1px solid #cbd5e1; padding: 15px; border-radius: 12px; background-color: #fafafa; flex: 1;">
            <h4 style="margin: 0 0 15px 0; font-size: 11pt; color: #1e3a8a; font-weight: 900;">📊 توزيع مبيعات الماركات (أعلى 5 ماركات مخرجة)</h4>
            <div style="display: flex; flex-direction: column; gap: 10px;">
        `;
        top5.forEach((b, idx) => {
          const ratio = (b.count / maxExit) * 100;
          bSvgHtml += `
            <div style="font-size: 8.5pt;">
              <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 4px;">
                <span>${b.brand}</span>
                <span style="color: #2563eb;">${b.count} سيارة (${((b.count / (analyticsData.exitedCount || 1)) * 100).toFixed(1)}%)</span>
              </div>
              <div style="width: 100%; height: 10px; background-color: #e2e8f0; border-radius: 5px; overflow: hidden; display: flex;">
                <div style="width: ${ratio}%; height: 100%; background: linear-gradient(to left, #2563eb, #6366f1); border-radius: 5px;"></div>
              </div>
            </div>
          `;
        });
        bSvgHtml += `</div></div>`;
      }

      const cSvgHtml = `
        <div style="margin-top: 15px; border: 1px solid #cbd5e1; padding: 15px; border-radius: 12px; background-color: #fafafa; flex: 1;">
          <h4 style="margin: 0 0 15px 0; font-size: 11pt; color: #1e3a8a; font-weight: 900;">📈 توزيع قنوات وحصص مخرجات الساحة</h4>
          <div style="display: flex; flex-direction: column; gap: 12px; font-size: 8.5pt;">
            <div>
              <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 2px;">
                <span>أفراد (بنك/كاش) - ${retailRatio}%</span>
                <span>${analyticsData.retailCount} سيارات</span>
              </div>
              <div style="width: 100%; height: 8px; background-color: #e2e8f0; border-radius: 4px; overflow: hidden;">
                <div style="width: ${retailRatio}%; height: 100%; background-color: #3b82f6; border-radius: 4px;"></div>
              </div>
            </div>
            <div>
              <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 2px;">
                <span>المعارض والتجار - ${showroomRatio}%</span>
                <span>${analyticsData.showroomCount} سيارات</span>
              </div>
              <div style="width: 100%; height: 8px; background-color: #e2e8f0; border-radius: 4px; overflow: hidden;">
                <div style="width: ${showroomRatio}%; height: 100%; background-color: #f59e0b; border-radius: 4px;"></div>
              </div>
            </div>
            <div>
              <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 2px;">
                <span>شركات تمويلية - ${Math.round((analyticsData.financeCount / totalVal) * 100)}%</span>
                <span>${analyticsData.financeCount} سيارات</span>
              </div>
              <div style="width: 100%; height: 8px; background-color: #e2e8f0; border-radius: 4px; overflow: hidden;">
                <div style="width: ${Math.round((analyticsData.financeCount / totalVal) * 100)}%; height: 100%; background-color: #10b981; border-radius: 4px;"></div>
              </div>
            </div>
          </div>
        </div>
      `;

      bodyHtml = `
        <div style="line-height: 1.5;">
          <div style="background-color: #f8fafc; border-right: 4px solid #2563eb; padding: 10px 15px; border-radius: 4px; margin-bottom: 20px; font-size: 8.5pt; color: #334155;">
            <strong>الفلاتر المطبقة في التقرير:</strong> 
            تاريخ الحركة: ${analyticsPeriod === "custom" ? `من ${analyticsStartDate} إلى ${analyticsEndDate}` : analyticsPeriod} |
            الماركة: ${filterBrand || "الكل"} |
            الموديل: ${filterModel || "الكل"} |
            المورد: ${filterSupplier || "الكل"} |
            نوع العميل: ${filterExitType || "الكل"} |
            الفرع: ${filterBranch || "الكل"}
          </div>

          <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 20px;">
            <div style="border: 0.5px solid #cbd5e1; padding: 10px; border-radius: 8px; background-color: #f0fdf4; text-align: right;">
              <span style="font-size: 7.5pt; color: #15803d; font-weight: bold; display:block; margin-bottom:5px;">الماركة الأكثر خروجاً 🏆</span>
              <strong style="font-size: 11pt; color: #123e1f; display:block; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${topBrand}</strong>
              <span style="font-size: 7pt; color: #15803d;">بعدد ${topBrandCount} سيارة</span>
            </div>
            
            <div style="border: 0.5px solid #cbd5e1; padding: 10px; border-radius: 8px; background-color: #eff6ff; text-align: right;">
              <span style="font-size: 7.5pt; color: #1e40af; font-weight: bold; display:block; margin-bottom:5px;">الموديل الأكثر مبيعاً 🔥</span>
              <strong style="font-size: 11pt; color: #1e3a8a; display:block; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${topModel}</strong>
              <span style="font-size: 7pt; color: #2563eb; font-weight: bold;">بمعدل حركة ${topModelSpeed}</span>
            </div>

            <div style="border: 0.5px solid #cbd5e1; padding: 10px; border-radius: 8px; background-color: #faf5ff; text-align: right;">
              <span style="font-size: 7.5pt; color: #6b21a8; font-weight: bold; display:block; margin-bottom:5px;">المورد النشط 📦</span>
              <strong style="font-size: 11pt; color: #3b0764; display:block; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${topSupplier}</strong>
              <span style="font-size: 7pt; color: #7e22ce;">ورد ${topSupplierCount} سيارة</span>
            </div>

            <div style="border: 0.5px solid #cbd5e1; padding: 10px; border-radius: 8px; background-color: #fef3c7; text-align: right;">
              <span style="font-size: 7.5pt; color: #78350f; font-weight: bold; display:block; margin-bottom:5px;">أسرع بقاء ودوران ⏱️</span>
              <strong style="font-size: 10.5pt; color: #451a03; display:block; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${topModel}</strong>
              <span style="font-size: 7pt; color: #b45309;">متوسط البقاء ${fastestDuration}</span>
            </div>

            <div style="border: 0.5px solid #cbd5e1; padding: 10px; border-radius: 8px; background-color: #fdf2f8; text-align: right;">
              <span style="font-size: 7.5pt; color: #9d174d; font-weight: bold; display:block; margin-bottom:5px;">توزيع الصرف (أفراد/معارض) 📊</span>
              <div style="width: 100%; background-color: #e2e8f0; height: 6px; border-radius: 3px; display: flex; margin: 4px 0 2px 0; overflow:hidden;">
                <div style="width: ${retailRatio}%; background-color: #3b82f6; height: 100%;"></div>
                <div style="width: ${showroomRatio}%; background-color: #f59e0b; height: 100%;"></div>
              </div>
              <span style="font-size: 7pt; color: #be185d; display:block;">أفراد ${retailRatio}% | تجار ${showroomRatio}%</span>
            </div>
          </div>

          <div style="border: 1px solid #cbd5e1; border-radius: 12px; padding: 15px; background-color: #f8fafc; margin-bottom: 20px;">
            <h4 style="margin: 0 0 10px 0; font-size: 11.5pt; color: #0f172a; font-weight: 900;">💡 التوصيات ونظام التحليل الذكي التلقائي للبيانات</h4>
            <ul style="margin: 0; padding-right: 20px; font-size: 9pt; color: #334155; line-height: 1.6;">
              ${analyticsData.insights.map((i) => `<li style="margin-bottom: 6px;">${i.replace(/\*\*/g, "")}</li>`).join("")}
              ${analyticsData.insights.length === 0 ? '<li style="color: #64748b; font-style: italic;">لا توجد مؤشرات كافية لتوليد تحليلات لهذه الفترة الزمنية.</li>' : ""}
            </ul>
          </div>

          <div style="display: flex; gap: 15px; margin-bottom: 25px;">
            ${bSvgHtml}
            ${cSvgHtml}
          </div>

          <h3 style="margin-top: 25px; margin-bottom: 12px; font-size: 11pt; color: #0f172a; border-right: 4px solid #2563eb; padding-right: 8px; font-weight: 900;">1. إحصائيات المبيعات والسرعة حسب موديل المركبة</h3>
          <table>
            <thead>
              <tr>
                <th style="text-align: right; padding-right: 15px;">الموديل</th>
                <th style="width: 18%">المركبات المصروفة</th>
                <th style="width: 25%">متوسط البقاء بالساحة (أيام)</th>
                <th style="width: 27%">تصنيف ومستوى الرواج</th>
              </tr>
            </thead>
            <tbody>
              ${analyticsData.topModelsDemand
                .slice(0, 15)
                .map(
                  (model, idx) => `
                <tr style="font-size: 8pt;">
                  <td style="text-align: right; padding-right: 15px; font-weight: bold;">${model.key}</td>
                  <td style="font-weight: bold;">${model.count} سيارة</td>
                  <td>${model.avgStay !== null ? `${model.avgStay} أيام` : "3 أيام"}</td>
                  <td style="font-weight: bold; color: ${model.speedTag === "سريعة جداً" ? "#059669" : model.speedTag === "سريعة الدوران" ? "#2563eb" : "#475569"}">${model.speedTag}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      `;
    } else if (pdfType === "full") {
      reportTitle = "تقرير الجرد الكامل وسجل ومخزن حركة السيارات النشط";
      bodyHtml = `
        <div style="font-size: 8.5pt;">
          <h3 style="margin-top: 5px; margin-bottom: 10px; font-size: 11pt; color: #011d33; border-right: 4px solid #0f172a; padding-right: 8px; font-weight: 900;">سجل مخزون جميع فئات السيارات بالساحة والمستودعات (${totals.totalCars} مركبة)</h3>
          <table>
            <thead>
              <tr>
                <th>نوع المركبة</th>
                <th>رقم الهيكل VIN</th>
                <th>الموديل واللون</th>
                <th>رقم اللوحة</th>
                <th>المورد</th>
                <th>مندوب الحجز</th>
                <th>الحالة</th>
                <th>السعر (ريال)</th>
              </tr>
            </thead>
            <tbody>
              ${(() => {
                let lastBrand = "";
                let lastModel = "";
                let lastAttribution = "";
                const sortedCarsDataForPdf = [...filteredCarsData].sort(
                  sortCarsUnderBrand,
                );
                return sortedCarsDataForPdf
                  .map((car, idx) => {
                    const cleanBrand = getCleanBrandName(car.brand);
                    const showBrandHeader = cleanBrand !== lastBrand;
                    if (showBrandHeader) {
                      lastBrand = cleanBrand;
                      lastModel = ""; // reset model header on new brand group
                      lastAttribution = ""; // reset attribution on new brand group
                    }
                    const modelKey =
                      (car.model || "").trim().toLowerCase();
                    const showModelHeader = modelKey !== lastModel;
                    if (showModelHeader) {
                      lastModel = modelKey;
                      lastAttribution = ""; // reset attribution on new model group
                    }
                    const attributionVal =
                      car.attributionSource || "عام / غير محدد";
                    const showAttributionHeader =
                      showModelHeader || attributionVal !== lastAttribution;
                    if (showAttributionHeader) {
                      lastAttribution = attributionVal;
                    }
                    const rowStyleObj = getCarRowStyle(car);
                    const bg = rowStyleObj.style.backgroundColor || "#ffffff";
                    const fg = rowStyleObj.style.color || "#000000";
                    const isBold =
                      rowStyleObj.textClass?.includes("font-bold") ||
                      rowStyleObj.textClass?.includes("font-extrabold") ||
                      rowStyleObj.textClass?.includes("font-black") ||
                      false;
                    const rowBoldStyle = isBold ? "font-weight: 900;" : "";

                    return `
                    ${
                      showBrandHeader
                        ? `
                      <tr>
                        <td colSpan="8" style="background-color: #1e3a8a; color: #ffffff; font-weight: 1000; text-align: center; font-size: 11pt; padding: 8px; border: 1px solid #1e3a8a;" class="brand-group-header">
                          🚘 ${cleanBrand} 🚘
                        </td>
                      </tr>
                    `
                        : ""
                    }
                    ${
                      showModelHeader
                        ? `
                      <tr>
                        <td colSpan="8" style="background-color: #cbd5e1; color: #000000; font-weight: 900; text-align: center; font-size: 11pt; padding: 8px; border: 1px solid #94a3b8;" class="model-group-header">
                          ${car.model || "عام"}
                        </td>
                      </tr>
                    `
                        : ""
                    }
                    ${
                      showAttributionHeader
                        ? `
                      <tr>
                        <td colSpan="8" style="background-color: #e0f2fe; color: #0369a1; font-weight: 900; text-align: center; font-size: 9.5pt; padding: 6px; border: 1px solid #bae6fd;" class="attribution-group-header">
                          📥 الوارد والمصدر: ${attributionVal}
                        </td>
                      </tr>
                    `
                        : ""
                    }
                    <tr style="font-size: 7.5pt; background-color: ${bg} !important; color: ${fg} !important; ${rowBoldStyle}">
                      <td style="font-weight: bold; border: 1px solid #94a3b8; padding: 4px;">${formatVehicleDisplay(car)}</td>
                      <td style="font-family: monospace; border: 1px solid #94a3b8; padding: 4px;">${car.vin}</td>
                      <td style="border: 1px solid #94a3b8; padding: 4px;">${car.color || ""} [${car.modelYear || ""}]</td>
                      <td style="font-weight: bold; border: 1px solid #94a3b8; padding: 4px;">${car.customData?.plateNumber || "—"}</td>
                      <td style="border: 1px solid #94a3b8; padding: 4px;">${car.supplier || "مورد عام"}</td>
                      <td style="border: 1px solid #94a3b8; padding: 4px;">${car.seller || "—"}</td>
                      <td style="font-weight: bold; border: 1px solid #94a3b8; padding: 4px;">
                        ${car.status}
                      </td>
                      <td style="font-weight: bold; font-family: monospace; border: 1px solid #94a3b8; padding: 4px;">${Number(car.price || 0).toLocaleString("ar-EG")}</td>
                    </tr>
                  `;
                  })
                  .join("");
              })()}
            </tbody>
          </table>
        </div>
      `;
    } else if (pdfType === "brand") {
      reportTitle =
        "ميزان مخرجات حركة المركبة والفرز الهيكلي حسب الماركات والبراندات";
      bodyHtml = `
        <div style="font-size: 8.5pt;">
          <h3 style="margin-top: 5px; margin-bottom: 15px; font-size: 11pt; color: #1e3a8a; font-weight: bold; border-right: 4px solid #1e3a8a; padding-right: 8px;">ميزان التوزيع حسب الماركة والطلب ومقارنة الشهر السابق</h3>
          <table>
            <thead>
              <tr>
                <th style="text-align: right; padding-right: 15px;">الماركة التجارية</th>
                <th>المبيعات (الخارجة)</th>
                <th>الشهر السابق</th>
                <th>الحصة الكلية المئوية %</th>
                <th>اتجاه الطلب ومساره</th>
              </tr>
            </thead>
            <tbody>
              ${analyticsData.topBrandsDemand
                .map((brandInfo, index) => {
                  const ratio = (
                    (brandInfo.count / (analyticsData.exitedCount || 1)) *
                    100
                  ).toFixed(1);
                  const trendIcon =
                    brandInfo.trend === "up"
                      ? "📈 صعود"
                      : brandInfo.trend === "down"
                        ? "📉 هبوط"
                        : "➡️ مستقر";
                  const trendColor =
                    brandInfo.trend === "up"
                      ? "#16a34a"
                      : brandInfo.trend === "down"
                        ? "#dc2626"
                        : "#475569";
                  return `
                  <tr style="font-size: 8pt;">
                    <td style="text-align: right; padding-right: 15px; font-weight: bold;">${brandInfo.brand}</td>
                    <td style="font-weight: bold;">${brandInfo.count} سيارة</td>
                    <td>${brandInfo.prevCount} سيارة</td>
                    <td style="font-weight: bold;">${ratio}%</td>
                    <td style="font-weight: bold; color: ${trendColor}">${trendIcon} (${brandInfo.pctChange.toFixed(0)}%)</td>
                  </tr>
                `;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      `;
    } else if (pdfType === "supplier") {
      reportTitle =
        "حقيبة التوريد ومؤشرات مساهمة الشركاء والموردين وتخصيص العلامة";
      bodyHtml = `
        <div style="font-size: 8.5pt;">
          <h3 style="margin-top: 5px; margin-bottom: 15px; font-size: 11pt; color: #064e3b; font-weight: bold; border-right: 4px solid #064e3b; padding-right: 8px;">قائمة الشركاء والموردين الأكثر فاعلية وحصصهم التوريدية</h3>
          <table>
            <thead>
              <tr>
                <th style="text-align: right; padding-right: 15px;">الشريك المورد</th>
                <th>إجمالي المركبات الموردة بالساحة</th>
                <th>الحصة التموينية للوارد %</th>
                <th>المستحوذ % من مجمل المورد وبطانة التوريد المفضلة</th>
              </tr>
            </thead>
            <tbody>
              ${analyticsData.topSuppliers
                .map((sup, index) => {
                  const ratio = (
                    (((sup.count / (analyticsData.enteredCount || 1)) * 105) /
                      105) *
                    100
                  ).toFixed(1);
                  return `
                  <tr style="font-size: 8pt;">
                    <td style="text-align: right; padding-right: 15px; font-weight: bold;">${sup.supplier}</td>
                    <td style="font-weight: bold; color: #059669;">+${sup.count} مركبة</td>
                    <td style="font-weight: bold;">${ratio}%</td>
                    <td style="font-weight: bold; color: #0284c7;">المجمل المورّد النشط</td>
                  </tr>
                `;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      `;
    } else if (pdfType === "timeline") {
      reportTitle = "تقرير المدى الزمني للتواريخ وحركات الدورة الحركية اليومية";
      bodyHtml = `
        <div style="font-size: 8.5pt;">
          <h3 style="margin-top: 5px; margin-bottom: 15px; font-size: 11pt; color: #4338ca; font-weight: bold; border-right: 4px solid #4338ca; padding-right: 8px;">سجل تسلسل التواريخ وحركات الدخول والخروج اليومية</h3>
          <table>
            <thead>
              <tr>
                <th style="width: 15%">تاريخ اليوم</th>
                <th>معاملات الدخول (وارد اليوم)</th>
                <th>معاملات الخروج (مبيعات اليوم)</th>
                <th style="width: 15%">الرصيد الافتتاحي</th>
                <th style="width: 15%">الرصيد الاغلاقي المقفل</th>
                <th style="width: 12%">حالة التوازن</th>
              </tr>
            </thead>
            <tbody>
              ${DailyAutoCalculator.generateHistory(cars, 15)
                .map((day) => {
                  const statusLabel =
                    day.status === "growth"
                      ? "زيادة وارد"
                      : day.status === "decline"
                        ? "سحب صرف"
                        : "مستقر";
                  const statusColor =
                    day.status === "growth"
                      ? "#16a34a"
                      : day.status === "decline"
                        ? "#dc2626"
                        : "#64748b";
                  return `
                  <tr style="font-size: 8pt;">
                    <td style="font-weight: bold;">${day.date}</td>
                    <td style="color: #059669; font-weight: bold;">+${day.enteredCount} سيارات</td>
                    <td style="color: #2563eb; font-weight: bold;">-${day.exitedCount} سيارات</td>
                    <td style="font-family: monospace;">${day.openingBalance}</td>
                    <td style="font-weight: bold; font-family: monospace;">${day.closingBalance}</td>
                    <td style="font-weight: bold; color: ${statusColor};">${statusLabel}</td>
                  </tr>
                `;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      `;
    } else if (
      pdfType === "physical-summary" ||
      pdfType === "comprehensive-summary"
    ) {
      localOrientation = "landscape";
      reportTitle =
        pdfType === "physical-summary"
          ? "ملخص الجرد الفعلي الفئوي بالمعرض"
          : "ملخص الجرد الشامل للفئات والساحات";

      let blocksHtml = "";

      displayBrands.forEach((brandName, bIdx) => {
        const filteredCarsForBrand = (
          summaryReportsData.filteredCars || []
        ).filter((c: any) => getCleanBrandName(c.brand) === brandName);
        const activeModelsSet = new Set(
          filteredCarsForBrand.map((c: any) =>
            getCleanModelForSummary(c.model, c),
          ),
        );
        const models = (systemSchema[brandName] || []).filter((model) =>
          activeModelsSet.has(model),
        );
        activeModelsSet.forEach((model) => {
          if (!models.includes(model)) models.push(model);
        });
        if (models.length === 0) return;

        // Calculate brand total count based on current filtered dataset
        const brandTotalCount = filteredCarsForBrand.length;

        // Calculate counts for each model
        const modelCounts = models.map((model) => {
          return filteredCarsForBrand.filter(
            (c: any) => getCleanModelForSummary(c.model, c) === model,
          ).length;
        });

        blocksHtml += `
          <div style="width: 100%; border-bottom: 0.5pt solid #cbd5e1; page-break-inside: avoid;">
            <table style="width: 100%; table-layout: auto !important; text-align: center; border-collapse: collapse; font-size: 7.5pt; font-family: 'Cairo', sans-serif;">
              <tbody>
                <!-- Row 1: Brand name banner -->
                <tr>
                   <td colSpan="${models.length + 1}" style="background-color: #f1f5f9; color: #1e3a8a; border: 0.5pt solid #cbd5e1; font-weight: 900; padding: 4px 6px; text-align: center; font-size: 8.5pt;">
                    ${brandName}
                  </td>
                  <td style="background-color: #e2e8f0; color: #0f172a; border: 0.5pt solid #cbd5e1; font-weight: 900; padding: 4px 6px; text-align: center; width: 70px; font-size: 8pt;">
                    الشركة
                  </td>
                </tr>

                <!-- Row 2: Header row with model names and "المجموع" -->
                <tr style="background-color: #ffffff;">
                   <td style="background-color: #f1f5f9; color: #1e3a8a; border: 0.5pt solid #cbd5e1; font-weight: 900; padding: 3px 4px; width: 55px; text-align: center; font-size: 7.5pt;">
                    المجموع
                  </td>
                  ${models
                    .map(
                      (model) => `
                    <td style="border: 0.5pt solid #cbd5e1; padding: 3px 4px; text-align: center; color: #334155; font-size: 7.5pt; font-weight: bold; min-width: 50px; word-break: keep-all; overflow-wrap: normal; white-space: normal; hyphens: none;">
                      ${model}
                    </td>
                  `,
                    )
                    .join("")}
                  <td rowSpan="2" style="background-color: #f8fafc; color: #475569; border: 0.5pt solid #cbd5e1; font-weight: 900; font-size: 8.5pt; vertical-align: middle; text-align: center; width: 70px;">
                    ${bIdx + 1}
                  </td>
                </tr>

                <!-- Row 3: Count row with count values -->
                <tr style="background-color: #ffffff;">
                  <td style="background-color: #f0f7ff; color: #1e3a8a; border: 0.5pt solid #cbd5e1; font-weight: 950; padding: 3.5px 5px; text-align: center; font-size: 8pt;">
                    ${brandTotalCount}
                  </td>
                  ${modelCounts
                    .map(
                      (count) => `
                    <td style="border: 0.5pt solid #cbd5e1; padding: 3.5px 5px; text-align: center; font-weight: 950; font-size: 8pt; color: #0f172a; ${count > 0 ? "background-color: #fdfdfd;" : "color: #94a3b8; font-weight: normal;"}">
                      ${count}
                    </td>
                  `,
                    )
                    .join("")}
                </tr>
              </tbody>
            </table>
          </div>
        `;
      });

      bodyHtml = `
        <div style="font-family: 'Cairo', sans-serif; line-height: 1.4; direction: rtl; padding: 5px;">
          <!-- Individual blocks list merged without gaps starting with the header rows -->
          <div style="width: 100%; border: 0.5pt solid #cbd5e1; border-radius: 12px; overflow: hidden; background-color: white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);">
            <!-- Integrated Header Table block styled exactly as the tables below it -->
            <table style="width: 100%; table-layout: auto !important; border-collapse: collapse !important; border: none !important; margin: 0 !important; font-family: 'Cairo', sans-serif; border-bottom: 0.5pt solid #cbd5e1;">
              <tbody>
                <tr style="background-color: #1e3a8a !important; color: white !important;">
                  <td colSpan="3" style="padding: 10px 12px !important; font-size: 11.5pt !important; font-weight: 900 !important; text-align: center !important; border: none !important; color: white !important; background-color: #1e3a8a !important;">
                    ${pdfType === "physical-summary" ? "ملخص الجرد الفعلي الفئوي بالمعرض" : "ملخص المخزون الشامل للفئات والساحات الموحد"}
                  </td>
                </tr>
                <tr style="background-color: #f8fafc !important; color: #334155 !important;">
                  <td style="padding: 8px 12px !important; border-top: none !important; border-bottom: none !important; border-left: 0.5pt solid #cbd5e1 !important; border-right: none !important; text-align: center !important; font-weight: bold !important; font-size: 8.5pt !important; width: 33.33% !important; color: #334155 !important; background-color: #f8fafc !important;">
                    إجمالي الماركات: ${displayBrands.length} ماركة
                  </td>
                  <td style="padding: 8px 12px !important; border-top: none !important; border-bottom: none !important; border-left: 0.5pt solid #cbd5e1 !important; border-right: none !important; text-align: center !important; font-weight: bold !important; font-size: 8.5pt !important; width: 33.33% !important; color: #334155 !important; background-color: #f8fafc !important;">
                    إجمالي المركبات العامة: ${summaryReportsData.totalCount} سيارة
                  </td>
                  <td style="padding: 8px 12px !important; border-top: none !important; border-bottom: none !important; border-left: none !important; border-right: none !important; text-align: center !important; font-weight: bold !important; font-size: 8.5pt !important; width: 33.33% !important; color: #334155 !important; background-color: #f8fafc !important;">
                    التاريخ: ${endDate ? new Date(endDate).toLocaleDateString("ar-EG") : new Date().toLocaleDateString("ar-EG")}
                  </td>
                </tr>
              </tbody>
            </table>

            ${blocksHtml}
          </div>

          <!-- Overall totals footer -->
          <div style="width: 100%; border: 0.5pt solid #cbd5e1; border-radius: 8px; overflow: hidden; margin-top: 10px; page-break-inside: avoid; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);">
            <table style="width: 100%; table-layout: auto !important; text-align: center; border-collapse: collapse; font-size: 8.5pt; font-family: 'Cairo', sans-serif;">
              <tbody>
                <tr style="background-color: #f8fafc; color: #1e3a8a;">
                  <td style="padding: 8px 12px; text-align: center; font-size: 10pt; font-weight: 950; border: 0.5pt solid #cbd5e1; width: 70%; background-color: #f1f5f9;">
                    ${summaryReportsData.totalCount} سيارة
                  </td>
                  <td style="padding: 8px 12px; text-align: center; font-size: 9.5pt; font-weight: 900; background-color: #e2e8f0; color: #0f172a; border: 0.5pt solid #cbd5e1; width: 30%;">
                    المجموع الكلي للأصناف
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
      `;

      if (pdfType === "comprehensive-summary") {
        // Yard Overall Totals Table in Report 2
        bodyHtml += `
          <div style="margin-top: 25px; page-break-inside: avoid; display: inline-block; width: 340px; float: left; border: 0.5pt solid #cbd5e1; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);">
            <div style="background-color: #1e3a8a; padding: 8px 12px; color: white; display: block; font-weight: 900; font-size: 10pt; text-align: center;">
              📊 إجمالي المخزون الشامل للساحات
            </div>
            <table style="width: 100%; table-layout: auto !important; border-collapse: collapse; font-size: 8.5pt; font-family: 'Cairo', sans-serif;">
              <thead>
                <tr style="background-color: #f8fafc; color: #334155; border-bottom: 0.5pt solid #cbd5e1;">
                  <th style="padding: 8px 12px; text-align: right; font-weight: 900; border: 0.5pt solid #cbd5e1;">الساحة</th>
                  <th style="padding: 8px 12px; text-align: center; font-weight: 900; border: 0.5pt solid #cbd5e1; width: 120px;">العدد / الكمية</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(summaryReportsData.overallYardTotals)
                  .map(
                    ([yName, yCount]) => `
                  <tr style="background-color: #ffffff; border-bottom: 0.5pt solid #cbd5e1;">
                    <td style="padding: 8px 12px; text-align: right; font-weight: bold; border: 0.5pt solid #cbd5e1; color: #334155;">${yName}</td>
                    <td style="padding: 8px 12px; text-align: center; font-weight: 900; border: 0.5pt solid #cbd5e1; color: #1e3a8a;">${yCount} سيارة</td>
                  </tr>
                `,
                  )
                  .join("")}
                <tr style="background-color: #f1f5f9; font-weight: bold;">
                  <td style="padding: 8px 12px; text-align: right; border: 0.5pt solid #cbd5e1; color: #1e3a8a; font-weight: 900;">الإجمالي الكلي لجميع الساحات</td>
                  <td style="padding: 8px 12px; text-align: center; border: 0.5pt solid #cbd5e1; color: #1e3a8a; font-weight: 950; font-size: 9pt;">${summaryReportsData.totalCount} سيارة</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style="clear: both;"></div>
        `;
      }

      bodyHtml += `</div>`;
    }

    const isSummary =
      pdfType === "physical-summary" || pdfType === "comprehensive-summary";

    if (!reportTitle || !reportTitle.trim()) {
      reportTitle = getReportTitleByView(reportView, selectedDelegateFilter);
    }

    const htmlContent = `
      <html dir="rtl" lang="ar">
        <head>
          <title>${settings.orgType || "مؤسسة"} ${settings.name} - ${reportTitle || getReportTitleByView(reportView, selectedDelegateFilter)}</title>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
          <style>
            @page { size: A4 ${localOrientation}; margin: ${isSummary ? "4mm" : "8mm"}; }
            body { font-family: 'Cairo', sans-serif; margin: 0; padding: ${isSummary ? "4px" : "10px"}; direction: rtl; color: #0f172a; background-color: white; position: relative; }
            .watermark { 
              position: absolute; 
              top: 50%; 
              left: 50%; 
              transform: translate(-50%, -50%); 
              opacity: 0.25; /* 25% transparency */
              width: 50%; 
              pointer-events: none; 
              z-index: 1; 
            }
            .header {
              display: grid;
              grid-template-columns: 1.5fr 1fr 1.5fr;
              align-items: start;
              border-bottom: 3px double #1e3a8a;
              padding-bottom: 12px;
              margin-bottom: 15px;
              position: relative;
              z-index: 10;
              width: 100%;
            }
            .header-right {
              text-align: right;
              padding-right: 45px;
            }
            .header-center {
              text-align: center;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            }
            .header-left {
              text-align: left;
              display: flex;
              flex-direction: column;
              align-items: flex-end;
              justify-content: flex-start;
              gap: 6px;
              padding-left: 45px;
            }
            .header-logo, .logo, .logo-img, .logo-area, .logo-header img, .logo-container img {
              width: ${settings.logoWidth !== undefined ? settings.logoWidth : 120}px !important;
              max-height: none !important;
              max-width: none !important;
              height: auto !important;
              object-fit: contain;
              filter: drop-shadow(0px 4px 10px rgba(30, 58, 138, 0.08));
              transition: all 0.3s ease;
              position: relative !important;
              transform: translate(${settings.logoPosX !== undefined ? settings.logoPosX : 0}px, ${settings.logoPosY !== undefined ? settings.logoPosY : 0}px) !important;
            }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: ${isSummary ? "4px" : "10px"}; margin-bottom: ${isSummary ? "8px" : "15px"}; position: relative; z-index: 10; }
            th.col-counter, td.col-counter, .col-counter { width: 47px !important; min-width: 47px !important; max-width: 47px !important; }
            tr { height: ${pdfType === "physical-summary" ? "18.75pt" : "21pt"} !important; page-break-inside: avoid !important; }
            thead tr { height: ${pdfType === "physical-summary" ? "18.75pt" : "25pt"} !important; }
            th, td { border: 0.5pt solid #94a3b8; padding: ${pdfType === "physical-summary" ? "2.5px 3px" : isSummary ? "3.5px 3px" : "6px 4px"}; text-align: center; font-size: ${isSummary ? "7.5pt" : "8pt"}; word-break: keep-all; overflow-wrap: normal; white-space: normal; hyphens: none; line-height: 1.3 !important; vertical-align: middle !important; }
            th { background-color: #0f172a; color: white; font-weight: 900; }
            tr:nth-child(even) { background-color: #f8fafc; }
            thead { display: table-header-group; }
            .signature-block { margin-top: ${isSummary ? "15px" : "40px"}; display: flex; justify-content: space-between; font-size: ${isSummary ? "8pt" : "9pt"}; font-weight: bold; color: #334155; page-break-inside: avoid; position: relative; z-index: 10; }
            .signature-box { border-top: 1px dashed #94a3b8; width: ${isSummary ? "160px" : "220px"}; text-align: center; margin-top: ${isSummary ? "25px" : "45px"}; padding-top: 5px; }
            .footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: ${isSummary ? "6.5pt" : "7.5pt"}; color: #64748b; padding-top: 3px; border-top: 0.5pt solid #e2e8f0; position: relative; z-index: 10; }
          </style>
        </head>
        <body>
          <img src="${settings.logoUrl || getLogoDataUri(settings.name)}" class="watermark" alt="شعار الخلفية" />
          <div class="header">
            <div class="header-right">
              <h1 style="margin: 0 0 4px 0; font-size: ${isSummary ? "16pt" : "20pt"}; font-weight: 900; color: #1e3a8a; letter-spacing: normal; line-height: 1.2;">
                ${settings.orgType || "مؤسسة"} ${settings.name || "سما الفرسان للتجارة"}
              </h1>
              <div style="font-size: ${isSummary ? "8.5pt" : "9.5pt"}; color: #334155; line-height: 1.5; font-weight: bold; margin-top: 4px;">
                <div style="display: flex; flex-direction: column; gap: 2px;">
                  <span>سجل تجاري رقم: <strong style="color: #0f172a; font-family: monospace; font-size: ${isSummary ? "9.5pt" : "10.5pt"};">${settings.commercialRegister || "٥٩٥٠٠٢٧١٦٣"}</strong></span>
                  <span>الرقم الضريبي الموحد: <strong style="color: #0f172a; font-family: monospace; font-size: ${isSummary ? "9.5pt" : "10.5pt"};">${settings.taxNumber || "٣١١٨٠٤٦٥٤٨٠٠٠٠٣"}</strong></span>
                  ${settings.contactNumber ? `<span>رقم التواصل والدعم: <strong style="color: #0f172a; font-family: monospace; font-size: ${isSummary ? "9.5pt" : "10.5pt"};">${settings.contactNumber}</strong></span>` : ""}
                </div>
              </div>
            </div>
            
            <div class="header-center">
              ${showOrgLogo ? `<img src="${settings.logoUrl || getLogoDataUri(settings.name)}" class="header-logo" alt="شعار المؤسسة" />` : ""}
            </div>

            <div class="header-left">
              <span style="font-size: 9.5pt; color: #1e3a8a; font-weight: 900; border-bottom: 2px solid #cbd5e1; padding-bottom: 3px; display: inline-block; margin-bottom: 4px;">المملكة العربية السعودية</span>
              <div style="text-align: left; width: 100%;">
                <p style="margin: 4px 0 0 0; font-size: 9pt; color: #475569; font-weight: bold; text-align: left; width: 100%;">تاريخ التصدير: <span style="font-family: monospace; color: #0f172a; font-weight: 900;">${new Date().toLocaleDateString("ar-EG")}</span></p>
              </div>
            </div>
          </div>

          <div style="text-align: center; margin: 15px 0 25px 0; width: 100%;">
            <span style="font-family: 'Cairo', sans-serif; font-weight: 900; font-size: 16pt; color: #1e3a8a; background-color: #f0f7ff; padding: 8px 30px; border-radius: 12px; border: 2px solid #bfdbfe; display: inline-block; box-shadow: 0 4px 10px rgba(30,58,138,0.06); letter-spacing: normal;">
              ${reportTitle || getReportTitleByView(reportView, selectedDelegateFilter)}
            </span>
          </div>

          ${bodyHtml}

          <div class="signature-block">
            <div>
              <span>معد التقرير: __________________</span>
              <div class="signature-box">توقيع المسؤول الإداري</div>
            </div>
            <div style="position: relative; width: 220px;">
              <span>اعتماد المدير العام: __________________</span>
              <div class="signature-box">ختم وتوقيع الإدارة</div>
              <img src="${settings.stampUrl || getStampDataUri()}" style="position: absolute; bottom: -20px; left: 15px; max-height: 90px; max-width: 90px; mix-blend-mode: multiply;" alt="الختم الرسمي للمؤسسة" />
            </div>
          </div>

          <div class="footer">طبع بالتصدير التلقائي الذكي من نظام ${settings.name}</div>
          <script>
            window.onload = () => {
              setTimeout(() => { window.print(); }, 1000);
            };
          </script>
        </body>
      </html>
    `;

    const previewHtml = htmlContent.replace(/window\.close\(\);?/g, "").trim();
    if (typeof (window as any).showPrintPreview === "function") {
      (window as any).showPrintPreview(previewHtml);
      setShowPdfMenu(false);
      return;
    }

    const fallbackToIframePrint = () => {
      const iframeHtml = previewHtml.replace(/window\.print\(\);?/g, "");
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.bottom = "0";
      iframe.style.right = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.style.zIndex = "-9999";
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(iframeHtml);
        doc.close();

        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (e) {
            console.error("Print failed:", e);
          }
          setTimeout(() => {
            try {
              if (iframe.parentNode) {
                document.body.removeChild(iframe);
              }
            } catch (err) {
              console.error(err);
            }
          }, 3000);
        }, 1000);
      } else {
        alert("حدث خطأ أثناء محاولة تهيئة نافذة الطباعة");
      }
    };

    // Show a beautiful, professional, localized loading overlay
    const loadingOverlay = document.createElement("div");
    loadingOverlay.style.position = "fixed";
    loadingOverlay.style.top = "0";
    loadingOverlay.style.left = "0";
    loadingOverlay.style.width = "100vw";
    loadingOverlay.style.height = "100vh";
    loadingOverlay.style.backgroundColor = "rgba(15, 23, 42, 0.75)";
    loadingOverlay.style.backdropFilter = "blur(4px)";
    loadingOverlay.style.display = "flex";
    loadingOverlay.style.flexDirection = "column";
    loadingOverlay.style.justifyContent = "center";
    loadingOverlay.style.alignItems = "center";
    loadingOverlay.style.zIndex = "99999";
    loadingOverlay.style.color = "white";
    loadingOverlay.style.fontFamily = "Cairo, sans-serif";
    loadingOverlay.style.direction = "rtl";
    loadingOverlay.innerHTML = `
      <div style="background: #1e293b; padding: 30px; border-radius: 20px; border: 1px solid #475569; text-align: center; box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.15); max-width: 400px; width: 90%;">
        <div class="pdf-spinner" style="border: 4px solid #f3f3f3; border-top: 4px solid #3b82f6; border-radius: 50%; width: 40px; height: 40px; animation: pdf-spin 1s linear infinite; margin: 0 auto 15px auto;"></div>
        <p style="margin: 0; font-size: 13pt; font-weight: bold; color: #f8fafc;">جاري تصدير ملف PDF الاحترافي المباشر...</p>
        <p style="margin: 8px 0 0 0; font-size: 10pt; color: #94a3b8;">يرجى الانتظار، يتم الآن توليد وحفظ الملف تلقائياً بدون استخدام نافذة الطباعة.</p>
      </div>
      <style>
        @keyframes pdf-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
    document.body.appendChild(loadingOverlay);

    exportHTMLToPDF(previewHtml, {
      reportTitle: reportTitle || getReportTitleByView(reportView, selectedDelegateFilter),
      settings: settings,
      orientation: localOrientation as "portrait" | "landscape",
      delayMs: 600,
    })
      .then(() => {
        if (loadingOverlay.parentNode) {
          document.body.removeChild(loadingOverlay);
        }
      })
      .catch((err) => {
        console.error("PDF export failed:", err);
        if (loadingOverlay.parentNode) {
          document.body.removeChild(loadingOverlay);
        }
        fallbackToIframePrint();
      });

    setShowPdfMenu(false);
  };

  const exportSingleDayToExcel = async (day: DailyInventorySummary) => {
    const workbook = new ExcelJS.Workbook();
    const isRTL = excelDirection === "RTL";
    const worksheet = workbook.addWorksheet(`حركة يوم ${day.date}`, {
      views: [{ rightToLeft: isRTL }],
    });

    // Reset worksheet columns to avoid conflict with manual merging
    worksheet.columns = [];

    // Row 1: Main Title Banner
    worksheet.mergeCells("A1:E1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = `بيان حركة المخزون اليومي الصادر والوارد - تاريخ 📅 ${day.date}`;
    titleCell.font = {
      name: "Arial",
      size: 14,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    titleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF5B21B6" },
    }; // Premium purple bg
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    worksheet.getRow(1).height = 42;

    // Row 2: 4-Column Beautiful Summary Block
    worksheet.getRow(2).height = 30;

    // Column A & B: Opening Balance
    worksheet.mergeCells("A2:B2");
    const opCell = worksheet.getCell("A2");
    opCell.value = `الرصيد الافتتاحي لليوم: ${day.openingBalance} سيارة`;
    opCell.font = {
      name: "Arial",
      size: 10,
      bold: true,
      color: { argb: "FF0369A1" },
    };
    opCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0F2FE" },
    }; // Sky Blue 50
    opCell.alignment = { vertical: "middle", horizontal: "center" };
    opCell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };

    // Column C: Entered Count
    const entCell = worksheet.getCell("C2");
    entCell.value = `📥 وارد اليوم: ${day.enteredCount} سيارات`;
    entCell.font = {
      name: "Arial",
      size: 10,
      bold: true,
      color: { argb: "FF15803D" },
    };
    entCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFDCFCE7" },
    }; // Green 50
    entCell.alignment = { vertical: "middle", horizontal: "center" };
    entCell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };

    // Column D: Exited Count
    const exCell = worksheet.getCell("D2");
    exCell.value = `📤 صادر اليوم: ${day.exitedCount} سيارات`;
    exCell.font = {
      name: "Arial",
      size: 10,
      bold: true,
      color: { argb: "FFB91C1C" },
    };
    exCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFEE2E2" },
    }; // Red 50
    exCell.alignment = { vertical: "middle", horizontal: "center" };
    exCell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };

    // Column E: Closing Balance
    const clCell = worksheet.getCell("E2");
    clCell.value = `🏁 الرصيد النهائي: ${day.closingBalance} سيارة`;
    clCell.font = {
      name: "Arial",
      size: 10,
      bold: true,
      color: { argb: "FF854D0E" },
    };
    clCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFEF9C3" },
    }; // Yellow 50
    clCell.alignment = { vertical: "middle", horizontal: "center" };
    clCell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };

    // Set borders for the merged A2:B2 cells correctly
    worksheet.getCell("B2").border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };

    worksheet.addRow([]); // Blank spacer line at Row 3

    // Row 4: Subsection 1 Title Banner (Entered Cars)
    worksheet.mergeCells("A4:E4");
    const s1TitleCell = worksheet.getCell("A4");
    s1TitleCell.value = `📥 القسم الأول: حركة دخول السيارات اليومية (الوارد الجديد)`;
    s1TitleCell.font = {
      name: "Arial",
      size: 11,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    s1TitleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF059669" },
    }; // Emerald 600 bg
    s1TitleCell.alignment = { vertical: "middle", horizontal: "center" };
    worksheet.getRow(4).height = 28;

    // Row 5: Column Headers for Entered Cars
    const s1HeaderRow = worksheet.addRow([
      "م",
      "تفاصيل السيارة (الماركة / الموديل / السنة)",
      "رقم الشاصي / الهيكل VIN",
      "اللون والمواصفات",
      "الملاحظات وتفاصيل التوريد",
    ]);
    s1HeaderRow.height = 25;
    s1HeaderRow.eachCell((cell) => {
      cell.font = {
        name: "Arial",
        size: 10,
        bold: true,
        color: { argb: "FF1F2937" },
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE2E8F0" },
      }; // Slate 100 bg
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
    });

    // Add entered cars rows
    if (day.enteredCars && day.enteredCars.length > 0) {
      day.enteredCars.forEach((car, index) => {
        const fullCar = cars?.find((c) => c.id === car.id || c.vin === car.vin);
        const modelYear = fullCar?.year || "-";
        const carColor = fullCar?.color || "-";
        const isTr = Boolean(car.isTransfer || car.transferNo);
        const trTag = isTr ? " [📥 تحويل وارد]" : "";
        const row = worksheet.addRow([
          index + 1,
          `${car.brand || "-"} ${car.model || ""} (${modelYear})${trTag}`,
          car.vin || "-",
          carColor,
          car.notes || (isTr ? "تحويل وارد بخطاب" : "لا توجد ملاحظات وصول"),
        ]);
        row.height = 48.75; // Standardize row height to 65px (65 * 0.75 = 48.75 points)
        row.eachCell((cell, colNum) => {
          cell.font = { name: "Arial", size: 10 };
          cell.alignment = {
            vertical: "middle",
            horizontal: colNum === 1 || colNum === 3 ? "center" : "right",
          };
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };
        });
      });
    } else {
      const emptyRowIdx = worksheet.rowCount + 1;
      worksheet.mergeCells(`A${emptyRowIdx}:E${emptyRowIdx}`);
      const emptyCell = worksheet.getCell(`A${emptyRowIdx}`);
      emptyCell.value = "لا توجد سيارات وارد أو حركة دخول مسجلة في هذا اليوم";
      emptyCell.font = {
        name: "Arial",
        size: 10,
        italic: true,
        color: { argb: "FF94A3B8" },
      };
      emptyCell.alignment = { vertical: "middle", horizontal: "center" };
      worksheet.getRow(emptyRowIdx).height = 25;
    }

    worksheet.addRow([]); // Blank spacer line

    // Subsection 2 Title Banner (Exited Cars)
    const s2TitleRowIdx = worksheet.rowCount + 1;
    worksheet.mergeCells(`A${s2TitleRowIdx}:E${s2TitleRowIdx}`);
    const s2TitleCell = worksheet.getCell(`A${s2TitleRowIdx}`);
    s2TitleCell.value = `📤 القسم الثاني: حركة خروج السيارات اليومية (المباعة والصادرة)`;
    s2TitleCell.font = {
      name: "Arial",
      size: 11,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    s2TitleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFDC2626" },
    }; // Crimson/Red 600 bg
    s2TitleCell.alignment = { vertical: "middle", horizontal: "center" };
    worksheet.getRow(s2TitleRowIdx).height = 28;

    // Column Headers for Exited Cars
    const s2HeaderRow = worksheet.addRow([
      "م",
      "تفاصيل السيارة (الماركة / الموديل / السنة)",
      "رقم الشاصي / الهيكل VIN",
      "البائع / المندوب ومستلم السيارة",
      "الملاحظات وتفاصيل الصرف والخروج",
    ]);
    s2HeaderRow.height = 25;
    s2HeaderRow.eachCell((cell) => {
      cell.font = {
        name: "Arial",
        size: 10,
        bold: true,
        color: { argb: "FF1F2937" },
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE2E8F0" },
      }; // Slate 100 bg
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
    });

    // Add exited cars rows
    if (day.exitedCars && day.exitedCars.length > 0) {
      day.exitedCars.forEach((car, index) => {
        const fullCar = cars?.find((c) => c.id === car.id || c.vin === car.vin);
        const isTr = Boolean(car.isTransfer || car.transferNo);
        const sellerStr = isTr
          ? `تحويل (${car.seller || "صادر"})`
          : car.seller ||
            (car.notes ? getCleanDelegateName(car.notes) : "غير محدد");
        const exitTypeVal = fullCar?.exitType || "";
        const exitDetails = exitTypeVal
          ? `مندوب الحجز: ${sellerStr} (${exitTypeVal})`
          : `مندوب الحجز: ${sellerStr}`;
        const modelYear = fullCar?.year || "-";
        const trTag = isTr ? " [🔄 تحويل / محولة]" : "";
        const row = worksheet.addRow([
          index + 1,
          `${car.brand || "-"} ${car.model || ""} (${modelYear})${trTag}`,
          car.vin || "-",
          exitDetails,
          car.notes ||
            (isTr ? "تحويل صادر بخطاب" : "لا توجد ملاحظات صرف إضافية"),
        ]);
        row.height = 48.75; // Standardize row height to 65px (65 * 0.75 = 48.75 points)
        row.eachCell((cell, colNum) => {
          cell.font = { name: "Arial", size: 10 };
          cell.alignment = {
            vertical: "middle",
            horizontal: colNum === 1 || colNum === 3 ? "center" : "right",
          };
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };
        });
      });
    } else {
      const emptyRowIdx = worksheet.rowCount + 1;
      worksheet.mergeCells(`A${emptyRowIdx}:E${emptyRowIdx}`);
      const emptyCell = worksheet.getCell(`A${emptyRowIdx}`);
      emptyCell.value = "لا توجد سيارات صادر أو مبيعات مسجلة في هذا اليوم";
      emptyCell.font = {
        name: "Arial",
        size: 10,
        italic: true,
        color: { argb: "FF94A3B8" },
      };
      emptyCell.alignment = { vertical: "middle", horizontal: "center" };
      worksheet.getRow(emptyRowIdx).height = 25;
    }

    // Adjust column widths to be perfect and professional
    worksheet.getColumn(1).width = 8; // Index
    worksheet.getColumn(2).width = 33.75; // Car Details (270px)
    worksheet.getColumn(3).width = 24; // VIN
    worksheet.getColumn(4).width = 28; // Seller / Details
    worksheet.getColumn(5).width = 38; // Notes

    // Set height of all rows to 65 pixels (48.75 points)
    worksheet.eachRow({ includeEmpty: true }, (row) => {
      row.height = 48.75; // 65 pixels
    });

    workbook.worksheets.forEach((ws) => {
      ExcelService.formatWorksheet(ws, { isRTL: true, skipRowHeights: true }); // Daily logs are RTL
    });

    // Write and Save
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `حركة_مخزون_يوم_${day.date}.xlsx`;
    const blob = new Blob([buffer]);
    saveAs(blob, fileName);
    try {
      await documentStorageService.verifyAndWriteToLocalFolder(
        fileName,
        blob,
        "reports",
      );
    } catch (err) {
      console.warn("Unified Storage Driver write error:", err);
    }
  };

  const exportToExcel = async (specificCars?: any, sheetName?: string) => {
    const workbook = new ExcelJS.Workbook();
    const isRTL = excelDirection === "RTL";

    // Ensure we handle when specificCars is a React event instead of custom array
    const carsArray = Array.isArray(specificCars) ? specificCars : undefined;
    const computedSheetName =
      typeof sheetName === "string" ? sheetName : undefined;

    // PREVENT SPLITTING HISTORICAL LISTS INTO FALSE "NOT ARRIVED" CATEGORIES FOR MONTHLY REPORTS
    if (
      (reportView === "monthly" ||
        reportView === "monthly-entry" ||
        reportView === "monthly-exit") &&
      carsArray
    ) {
      const isEntryReport = monthlyMovementType === "IN";
      const sheetTitle = isEntryReport
        ? "تقرير دخول المركبات الشهري"
        : "تقرير خروج المركبات الشهري";
      const worksheet = workbook.addWorksheet(sheetTitle, {
        views: [{ rightToLeft: isRTL }],
      });

      // 1. Title Row
      worksheet.mergeCells("A1:G1");
      const titleCell = worksheet.getCell("A1");
      titleCell.value = isEntryReport
        ? `تقرير دخول المركبات الشهري (الوارد الجديد) - لشهر 📅 ${selectedMonth + 1} / ${selectedYear}`
        : `تقرير خروج ومبيعات المركبات الشهري (الصادر) - لشهر 📅 ${selectedMonth + 1} / ${selectedYear}`;
      titleCell.font = {
        name: "Arial",
        size: 14,
        bold: true,
        color: { argb: "FFFFFFFF" },
      };
      titleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: isEntryReport ? "FF065F46" : "FF1E3A8A" }, // Emerald for IN, Indigo/Blue for OUT
      };
      titleCell.alignment = { vertical: "middle", horizontal: "center" };
      worksheet.getRow(1).height = 40;

      // 2. Metadata Block
      worksheet.mergeCells("A2:G2");
      const metaCell = worksheet.getCell("A2");
      metaCell.value = `المعرض: ${settings.name || "إدارة المستودع"}  |  إجمالي عدد المركبات: ${carsArray.length} سيارة  |  تاريخ الاستخراج: ${new Date().toLocaleDateString("ar-EG")}`;
      metaCell.font = {
        name: "Arial",
        size: 11,
        bold: true,
        color: { argb: "FF334155" },
      };
      metaCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF1F5F9" },
      }; // Slate 100 bg
      metaCell.alignment = { vertical: "middle", horizontal: "center" };
      worksheet.getRow(2).height = 25;

      worksheet.addRow([]); // Blank spacer line

      // 3. Column headers row (Row 4)
      const headers = isEntryReport
        ? [
            "م",
            "تفاصيل السيارة (الماركة / الموديل / السنة)",
            "رقم الشاصي VIN",
            "اللون والمواصفات",
            "تاريخ الدخول",
            "المورد / الشريك المورد",
            "ملاحظات وتفاصيل الدخول",
          ]
        : [
            "م",
            "تفاصيل السيارة (الماركة / الموديل / السنة)",
            "رقم الشاصي VIN",
            "البائع / المندوب",
            "تاريخ الخروج",
            "المستلم / ملاحظات الصرف",
          ];

      const headerRow = worksheet.addRow(headers);
      headerRow.height = 28;
      headerRow.eachCell((cell) => {
        cell.font = {
          name: "Arial",
          size: 11,
          bold: true,
          color: { argb: "FFFFFFFF" },
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: isEntryReport ? "FF059669" : "FF2563EB" }, // Emerald 600 or Blue 600
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        };
      });

      // 4. Fill data rows in standard chronological log format
      carsArray.forEach((car, rowIdx) => {
        const carDetails = `${formatVehicleDisplay(car)} (${car.year || "-"})`;
        const rowValues = isEntryReport
          ? [
              rowIdx + 1,
              carDetails,
              car.vin || "-",
              car.color || "-",
              car.entryDate ? car.entryDate.split("T")[0] : "-",
              car.supplier || "-",
              car.notes
                ? getCleanDelegateName(car.notes)
                : "لا توجد ملاحظات دخول",
            ]
          : [
              rowIdx + 1,
              carDetails,
              car.vin || "-",
              getRepresentativeOrSeller(car),
              car.exitData?.exitDate
                ? car.exitData.exitDate.split("T")[0]
                : "-",
              `المستلم: ${car.exitData?.receiverName || "-"} | ملاحظات: ${car.exitData?.notes || "-"}`,
            ];

        const row = worksheet.addRow(rowValues);
        row.height = 48.75; // Standardize row height to 65px (65 * 0.75 = 48.75 points)
        row.eachCell((cell, colNum) => {
          cell.font = { name: "Arial", size: 10, color: { argb: "FF000000" } };
          cell.alignment = {
            vertical: "middle",
            horizontal: colNum === 1 || colNum === 3 ? "center" : "right",
          };
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };
        });
      });

      // 5. Column Widths
      worksheet.getColumn(1).width = 6; // #
      worksheet.getColumn(2).width = 34; // Car Details
      worksheet.getColumn(3).width = 24; // VIN
      worksheet.getColumn(4).width = 24; // Color / Seller
      worksheet.getColumn(5).width = 16; // Date
      if (isEntryReport) {
        worksheet.getColumn(6).width = 28; // Supplier
        worksheet.getColumn(7).width = 38; // Notes
      } else {
        worksheet.getColumn(6).width = 45; // Receiver / Exit Notes
      }

      workbook.worksheets.forEach((ws) => {
        ExcelService.formatWorksheet(ws, { isRTL });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const fileName = isEntryReport
        ? `تقرير_دخول_المركبات_الشهري_${selectedYear}_${selectedMonth + 1}.xlsx`
        : `تقرير_خروج_المركبات_الشهري_${selectedYear}_${selectedMonth + 1}.xlsx`;
      const blob = new Blob([buffer]);
      saveAs(blob, fileName);
      try {
        await documentStorageService.verifyAndWriteToLocalFolder(
          fileName,
          blob,
          "reports",
        );
      } catch (err) {
        console.warn("Unified Storage Driver write error:", err);
      }
      return;
    }

    if (reportView === "supplier-analysis") {
      const worksheet = workbook.addWorksheet("تحليل أداء الموردين", {
        views: [{ rightToLeft: isRTL }],
      });
      worksheet.columns = [
        { header: "المورد الشريك", key: "supplier", width: 25 },
        { header: "مستوى التقييم", key: "tier", width: 20 },
        { header: "الكمية الموردة", key: "totalSupplied", width: 15 },
        { header: "المركبات المباعة", key: "soldCount", width: 15 },
        { header: "المتبقي بالمخزون", key: "inventoryCount", width: 15 },
        {
          header: "إجمالي قيمة المشتريات (ر.س)",
          key: "totalCostValue",
          width: 22,
        },
        {
          header: "القيمة البيعية المقدرة (ر.س)",
          key: "totalEstimatedSalesValue",
          width: 22,
        },
        { header: "معدل دوران الصرف (%)", key: "sellThrough", width: 20 },
        { header: "متوسط زمن التوريد (يوم)", key: "avgStay", width: 20 },
      ];

      const headerRow = worksheet.getRow(1);
      headerRow.font = {
        name: "Arial",
        size: 11,
        bold: true,
        color: { argb: "FFFFFFFF" },
      };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0D9488" },
      }; // elegant teal-600 bg
      headerRow.alignment = { vertical: "middle", horizontal: "center" };

      analyticsData.supplierDetailedList?.forEach((sd: any) => {
        worksheet.addRow({
          supplier: sd.supplier,
          tier:
            sd.tier?.replace(/[^\u0600-\u06FFa-zA-Z0-9 ]/g, "").trim() || "",
          totalSupplied: sd.totalSupplied || 0,
          soldCount: sd.soldCount || 0,
          inventoryCount: sd.inventoryCount || 0,
          totalCostValue: sd.totalCostValue || 0,
          totalEstimatedSalesValue: sd.totalEstimatedSalesValue || 0,
          sellThrough: `${sd.sellThrough?.toFixed(1) || 0}%`,
          avgStay: sd.avgStay !== null ? `${sd.avgStay} يوم` : "غير متوفر",
        });
      });

      worksheet.eachRow((row: any, rowNum: number) => {
        if (rowNum === 1) {
          row.height = 35;
          return;
        }
        row.height = 48.75; // Standardize row height to 65px (65 * 0.75 = 48.75 points)
        row.alignment = { vertical: "middle", horizontal: "center" };
        row.eachCell((cell: any) => {
          cell.border = {
            top: { style: "thin", color: { argb: "FFCBD5E1" } },
            bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
            left: { style: "thin", color: { argb: "FFCBD5E1" } },
            right: { style: "thin", color: { argb: "FFCBD5E1" } },
          };
        });
      });

      workbook.worksheets.forEach((ws) => {
        ExcelService.formatWorksheet(ws, { isRTL });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const fileName = `${settings.name}_تحليل_أداء_الموردين_${new Date().toISOString().split("T")[0]}.xlsx`;
      const blob = new Blob([buffer]);
      saveAs(blob, fileName);
      try {
        await documentStorageService.verifyAndWriteToLocalFolder(
          fileName,
          blob,
          "reports",
        );
      } catch (err) {
        console.warn("Unified Storage Driver write error:", err);
      }
      return;
    }

    if (reportView === "showroom-inventory-cost") {
      const sheetTitle = "تكلفة مخزون المعرض";
      const worksheet = workbook.addWorksheet(sheetTitle, {
        views: [{ rightToLeft: isRTL }],
      });

      const formattedDateStr = new Date(inventoryCostDate).toLocaleDateString(
        "ar-EG",
      );
      const arabicDateStr = toArabicDigits(formattedDateStr);

      // Title row
      worksheet.mergeCells("A1:D1");
      const titleCell = worksheet.getCell("A1");
      titleCell.value = `إجمالي تكلفة مخزون المعرض في تاريخ ${arabicDateStr}`;
      titleCell.font = {
        name: "Arial",
        size: 14,
        bold: true,
        color: { argb: "FF1E293B" },
      };
      titleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFB3D7F0" },
      };
      titleCell.alignment = { vertical: "middle", horizontal: "center" };
      worksheet.getRow(1).height = 36;

      // Column headers
      worksheet.addRow([]); // Blank spacer
      const headerRow = worksheet.addRow([
        "الرقم",
        "الشركة / الماركة",
        "إجمالي عدد السيارات",
        "إجمالي التكلفة (ر.س)",
      ]);
      headerRow.height = 26;
      headerRow.eachCell((cell) => {
        cell.font = {
          name: "Arial",
          size: 11,
          bold: true,
          color: { argb: "FFFFFFFF" },
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF1F2937" },
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = {
          top: { style: "thin", color: { argb: "FF94A3B8" } },
          bottom: { style: "thin", color: { argb: "FF94A3B8" } },
          left: { style: "thin", color: { argb: "FF94A3B8" } },
          right: { style: "thin", color: { argb: "FF94A3B8" } },
        };
      });

      // Calculate dynamic Brand Cost Data
      const selDate = new Date(inventoryCostDate);
      selDate.setHours(23, 59, 59, 999);

      const filteredCarsForCost = cars.filter((car) => {
        if (!car.entryDate) return false;
        const entryDateObj = new Date(car.entryDate);
        if (entryDateObj > selDate) return false;

        const hasExited = car.isOutbound || car.exitData?.exitDate;
        if (hasExited) {
          const exitDateStr = car.exitData?.exitDate || (car as any).exitDate;
          if (exitDateStr) {
            const exitDateObj = new Date(exitDateStr);
            if (exitDateObj <= selDate) return false;
          }
        }

        if (inventoryCostBrandFilter !== "all") {
          const cleanB = getCleanBrandName(car.brand);
          const cleanF = getCleanBrandName(inventoryCostBrandFilter);
          if (cleanB !== cleanF) return false;
        }

        return true;
      });

      const groups: Record<
        string,
        { brand: string; count: number; totalCost: number }
      > = {};
      filteredCarsForCost.forEach((car) => {
        const brandName = getCleanBrandName(car.brand) || "غير محدد";
        const cost = car.costPrice ? Number(car.costPrice) : 0;

        if (!groups[brandName]) {
          groups[brandName] = {
            brand: car.brand || "غير محدد",
            count: 0,
            totalCost: 0,
          };
        }
        groups[brandName].count += 1;
        groups[brandName].totalCost += cost;
      });

      const brandCostsData = Object.values(groups).filter((g) => g.count > 0);
      brandCostsData.sort((a, b) => b.totalCost - a.totalCost);

      // Rows
      brandCostsData.forEach((bg: any, idx: number) => {
        const isGreen =
          bg.brand.toLowerCase().includes("mg") ||
          bg.brand.toLowerCase().includes("قولف") ||
          bg.brand.toLowerCase().includes("golf") ||
          bg.brand.toLowerCase().includes("ماكسوس") ||
          bg.brand.toLowerCase().includes("maxus") ||
          bg.brand.toLowerCase().includes("كيا") ||
          bg.brand.toLowerCase().includes("kia") ||
          bg.totalCost < 200000;

        const row = worksheet.addRow([
          idx + 1,
          bg.brand,
          bg.count,
          bg.totalCost,
        ]);
        row.height = 48.75; // Standardize row height to 65px (65 * 0.75 = 48.75 points)
        row.getCell(1).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFECF4F7" },
        }; // Soft blue gray
        row.getCell(2).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFFFFF" },
        };
        row.getCell(3).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFFFFF" },
        };

        const costBgColor = isGreen ? "FFDCEFE0" : "FFFDF4CF";
        const costTextColor = isGreen ? "FF166534" : "FF9A3412";

        row.getCell(4).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: costBgColor },
        };
        row.getCell(4).font = {
          name: "Arial",
          size: 11,
          bold: true,
          color: { argb: costTextColor },
        };
        row.getCell(4).numFmt = "#,##0.00";

        row.eachCell((cell, colIndex) => {
          if (colIndex !== 4) {
            cell.font = {
              name: "Arial",
              size: 11,
              bold: colIndex === 1 ? true : false,
              color: { argb: "FF1E293B" },
            };
          }
          cell.alignment = { vertical: "middle", horizontal: "center" };
          cell.border = {
            top: { style: "thin", color: { argb: "FFCBD5E1" } },
            bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
            left: { style: "thin", color: { argb: "FFCBD5E1" } },
            right: { style: "thin", color: { argb: "FFCBD5E1" } },
          };
        });
      });

      // Total row
      const totalCars = brandCostsData.reduce((sum, g) => sum + g.count, 0);
      const totalCostVal = brandCostsData.reduce(
        (sum, g) => sum + g.totalCost,
        0,
      );

      const totalRow = worksheet.addRow([
        "",
        "الإجمالي",
        totalCars,
        totalCostVal,
      ]);
      totalRow.height = 28;
      totalRow.eachCell((cell, colIndex) => {
        cell.font = {
          name: "Arial",
          size: 11,
          bold: true,
          color: { argb: "FF000000" },
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = {
          top: { style: "medium", color: { argb: "FF000000" } },
          bottom: { style: "medium", color: { argb: "FF000000" } },
          left: { style: "thin", color: { argb: "FFCBD5E1" } },
          right: { style: "thin", color: { argb: "FFCBD5E1" } },
        };
        if (colIndex === 4) {
          cell.numFmt = "#,##0.00";
        }
      });

      // Arabic Tafqeet row
      const lastRowId = worksheet.lastRow.number + 1;
      worksheet.mergeCells(`A${lastRowId}:C${lastRowId}`);
      const tafqeetTextCell = worksheet.getCell(`A${lastRowId}`);
      tafqeetTextCell.value = numberToArabicWords(totalCostVal);
      tafqeetTextCell.font = {
        name: "Arial",
        size: 11,
        bold: true,
        color: { argb: "FF1F2937" },
      };
      tafqeetTextCell.alignment = { vertical: "middle", horizontal: "right" };
      tafqeetTextCell.border = {
        top: { style: "thin", color: { argb: "FF94A3B8" } },
        bottom: { style: "thin", color: { argb: "FF94A3B8" } },
        left: { style: "thin", color: { argb: "FF94A3B8" } },
        right: { style: "thin", color: { argb: "FF94A3B8" } },
      };

      const tafqeetLabelCell = worksheet.getCell(`D${lastRowId}`);
      tafqeetLabelCell.value = "الاجملي :"; // Typo in the image is matches "الاجملي :", let's use matching string
      tafqeetLabelCell.font = {
        name: "Arial",
        size: 11,
        bold: true,
        color: { argb: "FF1F2937" },
      };
      tafqeetLabelCell.alignment = { vertical: "middle", horizontal: "center" };
      tafqeetLabelCell.border = {
        top: { style: "thin", color: { argb: "FF94A3B8" } },
        bottom: { style: "thin", color: { argb: "FF94A3B8" } },
        left: { style: "thin", color: { argb: "FF94A3B8" } },
        right: { style: "thin", color: { argb: "FF94A3B8" } },
      };
      worksheet.getRow(lastRowId).height = 26;

      // Auto-fit columns
      worksheet.columns.forEach((col: any, j: number) => {
        if (j === 0) col.width = 12;
        else if (j === 1) col.width = 25;
        else if (j === 2) col.width = 22;
        else if (j === 3) col.width = 24;
      });

      workbook.worksheets.forEach((ws) => {
        ExcelService.formatWorksheet(ws, { isRTL });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const fileName = `${settings.name}_تكلفة_مخزون_المعرض_${inventoryCostDate}.xlsx`;
      const blob = new Blob([buffer]);
      saveAs(blob, fileName);
      try {
        await documentStorageService.verifyAndWriteToLocalFolder(
          fileName,
          blob,
          "reports",
        );
      } catch (err) {
        console.warn("Unified Storage Driver write error:", err);
      }
      return;
    }

    if (
      (reportView === "physical-inventory-summary" ||
        reportView === "comprehensive-inventory-summary") &&
      !carsArray
    ) {
      const sheetTitle =
        reportView === "physical-inventory-summary"
          ? "ملخص الجرد الفعلي"
          : "ملخص المخزون الشامل";
      const worksheet = workbook.addWorksheet(sheetTitle, {
        views: [{ rightToLeft: isRTL }],
      });

      // Reset worksheet columns to avoid conflict with manual merging
      worksheet.columns = [];

      // Individual Brand Matrix Blocks (Precompute column width)
      let maxModelsOfAll = 0;
      displayBrands.forEach((bName) => {
        const filteredCarsForBrand = (
          summaryReportsData.filteredCars || []
        ).filter((c: any) => getCleanBrandName(c.brand) === bName);
        const activeModelsSet = new Set(
          filteredCarsForBrand.map((c: any) =>
            getCleanModelForSummary(c.model, c),
          ),
        );
        const models = (systemSchema[bName] || []).filter((model) =>
          activeModelsSet.has(model),
        );
        activeModelsSet.forEach((model) => {
          if (!models.includes(model)) models.push(model);
        });
        if (models.length > maxModelsOfAll) {
          maxModelsOfAll = models.length;
        }
      });
      if (maxModelsOfAll < 1) maxModelsOfAll = 1;
      const maxCols = maxModelsOfAll + 1;

      // Merge Title Row (Merge strictly across the computed table columns width)
      worksheet.mergeCells(1, 1, 1, maxCols);
      worksheet.getRow(1).height = 36;
      for (let col = 1; col <= maxCols; col++) {
        const cell = worksheet.getRow(1).getCell(col);
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF475569" },
        };
        cell.font = {
          name: "Arial",
          size: 12,
          bold: true,
          color: { argb: "FFFFFFFF" },
        };
        cell.alignment = {
          vertical: "middle",
          horizontal: "center",
          readingOrder: isRTL ? "rtl" : "ltr",
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FF94A3B8" } },
          bottom: { style: "thin", color: { argb: "FF94A3B8" } },
          left: { style: "thin", color: { argb: "FF94A3B8" } },
          right: { style: "thin", color: { argb: "FF94A3B8" } },
        };
      }
      worksheet.getCell("A1").value =
        reportView === "physical-inventory-summary"
          ? "ملخص الجرد الفعلي الفئوي بالمعرض"
          : "ملخص المخزون الشامل للفئات والساحات الموحد";

      // Stats Row 2 (Formatted statistics strictly aligned with the table columns)
      worksheet.mergeCells(2, 1, 2, maxCols);
      worksheet.getRow(2).height = 26;
      for (let col = 1; col <= maxCols; col++) {
        const cell = worksheet.getRow(2).getCell(col);
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF1F5F9" },
        };
        cell.font = {
          name: "Arial",
          size: 10,
          bold: true,
          color: { argb: "FF1E293B" },
        };
        cell.alignment = {
          vertical: "middle",
          horizontal: "center",
          readingOrder: isRTL ? "rtl" : "ltr",
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FF94A3B8" } },
          bottom: { style: "thin", color: { argb: "FF94A3B8" } },
          left: { style: "thin", color: { argb: "FF94A3B8" } },
          right: { style: "thin", color: { argb: "FF94A3B8" } },
        };
      }
      worksheet.getCell("A2").value =
        `إجمالي الماركات: ${displayBrands.length}  |  إجمالي السيارات بالتقرير: ${summaryReportsData.totalCount} سيارة  |  التاريخ: ${endDate ? new Date(endDate).toLocaleDateString("ar-EG") : new Date().toLocaleDateString("ar-EG")}`;

      displayBrands.forEach((brandName, bIdx) => {
        const filteredCarsForBrand = (
          summaryReportsData.filteredCars || []
        ).filter((c: any) => getCleanBrandName(c.brand) === brandName);
        const activeModelsSet = new Set(
          filteredCarsForBrand.map((c: any) =>
            getCleanModelForSummary(c.model, c),
          ),
        );
        const models = (systemSchema[brandName] || []).filter((model) =>
          activeModelsSet.has(model),
        );
        activeModelsSet.forEach((model) => {
          if (!models.includes(model)) models.push(model);
        });
        if (models.length === 0) return;

        const brandTotalCount = filteredCarsForBrand.length;

        const modelCounts = models.map((model) => {
          return filteredCarsForBrand.filter(
            (c: any) => getCleanModelForSummary(c.model, c) === model,
          ).length;
        });

        const startRow = worksheet.lastRow ? worksheet.lastRow.number + 1 : 4;

        // 1. Brand name banner row
        const r1: any[] = [];
        r1[0] = brandName;
        const excelRow1 = worksheet.addRow(r1);
        excelRow1.height = 24;

        worksheet.mergeCells(startRow, 1, startRow, maxModelsOfAll + 1);

        const borderStyle = {
          style: "thin" as const,
          color: { argb: "FF94A3B8" },
        };

        // 2. Header row
        const r2: any[] = [];
        r2[0] = "المجموع";
        models.forEach((m, idx) => {
          r2[idx + 1] = m;
        });
        const excelRow2 = worksheet.addRow(r2);
        excelRow2.height = 20;

        if (models.length < maxModelsOfAll) {
          worksheet.mergeCells(
            startRow + 1,
            models.length + 2,
            startRow + 1,
            maxModelsOfAll + 1,
          );
        }

        // 3. Count row
        const r3: any[] = [];
        r3[0] = brandTotalCount;
        modelCounts.forEach((cnt, idx) => {
          r3[idx + 1] = cnt;
        });
        const excelRow3 = worksheet.addRow(r3);
        excelRow3.height = 48.75; // Standardize row height to 65px (65 * 0.75 = 48.75 points)

        if (models.length < maxModelsOfAll) {
          worksheet.mergeCells(
            startRow + 2,
            models.length + 2,
            startRow + 2,
            maxModelsOfAll + 1,
          );
        }

        // Styling the block cells
        for (let r = startRow; r <= startRow + 2; r++) {
          const rowObj = worksheet.getRow(r);
          for (let c = 1; c <= maxModelsOfAll + 1; c++) {
            const cell = rowObj.getCell(c);
            cell.border = {
              top: borderStyle,
              bottom: borderStyle,
              left: borderStyle,
              right: borderStyle,
            };

            if (r === startRow) {
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFCBDCF0" },
              };
              cell.font = {
                name: "Arial",
                size: 11,
                bold: true,
                color: { argb: "FF1E3A8A" },
              };
              cell.alignment = {
                vertical: "middle",
                horizontal: "center",
                readingOrder: isRTL ? "rtl" : "ltr",
              };
            } else if (r === startRow + 1) {
              if (c === 1) {
                cell.fill = {
                  type: "pattern",
                  pattern: "solid",
                  fgColor: { argb: "FFE2E8F0" },
                };
                cell.font = {
                  name: "Arial",
                  size: 10,
                  bold: true,
                  color: { argb: "FF0F172A" },
                };
              } else {
                cell.fill = {
                  type: "pattern",
                  pattern: "solid",
                  fgColor: { argb: "FFF1F5F9" },
                };
                cell.font = {
                  name: "Arial",
                  size: 9,
                  bold: true,
                  color: { argb: "FF334155" },
                };
              }
              cell.alignment = {
                vertical: "middle",
                horizontal: "center",
                readingOrder: isRTL ? "rtl" : "ltr",
              };
            } else if (r === startRow + 2) {
              if (c === 1) {
                cell.fill = {
                  type: "pattern",
                  pattern: "solid",
                  fgColor: { argb: "FFE2E8F0" },
                };
                cell.font = {
                  name: "Arial",
                  size: 10,
                  bold: true,
                  color: { argb: "FF1E3A8A" },
                };
              } else {
                cell.fill = {
                  type: "pattern",
                  pattern: "solid",
                  fgColor: { argb: "FFFFFFFF" },
                };
                cell.font = {
                  name: "Arial",
                  size: 10,
                  bold: true,
                  color: { argb: "FF000000" },
                };
              }
              cell.alignment = {
                vertical: "middle",
                horizontal: "center",
                readingOrder: isRTL ? "rtl" : "ltr",
              };
            }
          }
        }
      });

      // Overall totals footer
      const totalRowIndex = worksheet.lastRow
        ? worksheet.lastRow.number + 1
        : 4;
      const totalRowVal: any[] = [];
      totalRowVal[0] = summaryReportsData.totalCount;
      totalRowVal[1] = "المجموع الكلي للأصناف";

      const excelTotalRow = worksheet.addRow(totalRowVal);
      excelTotalRow.height = 22;
      worksheet.mergeCells(totalRowIndex, 2, totalRowIndex, maxCols);

      const cellGrandCount = excelTotalRow.getCell(1);
      cellGrandCount.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFCBDCF0" },
      };
      cellGrandCount.font = {
        name: "Arial",
        size: 11,
        bold: true,
        color: { argb: "FF0F172A" },
      };
      cellGrandCount.alignment = { vertical: "middle", horizontal: "center" };
      cellGrandCount.border = {
        top: { style: "medium", color: { argb: "FFCBD5E1" } },
        bottom: { style: "medium", color: { argb: "FFCBD5E1" } },
        left: { style: "medium", color: { argb: "FFCBD5E1" } },
        right: { style: "medium", color: { argb: "FFCBD5E1" } },
      };

      const cellGrandLabel = excelTotalRow.getCell(2);
      cellGrandLabel.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF94A3B8" },
      };
      cellGrandLabel.font = {
        name: "Arial",
        size: 11,
        bold: true,
        color: { argb: "FF0F172A" },
      };
      cellGrandLabel.alignment = { vertical: "middle", horizontal: "center" };
      cellGrandLabel.border = {
        top: { style: "medium", color: { argb: "FFCBD5E1" } },
        bottom: { style: "medium", color: { argb: "FFCBD5E1" } },
        left: { style: "medium", color: { argb: "FFCBD5E1" } },
        right: { style: "medium", color: { argb: "FFCBD5E1" } },
      };

      if (reportView === "comprehensive-inventory-summary") {
        // Add Yard Overall Totals block
        worksheet.addRow([]);
        worksheet.addRow([]);

        const yardTitleRowIndex = worksheet.lastRow.number + 1;
        const yardTitleRow = worksheet.addRow([
          "📊 إجمالي المخزون الشامل للساحات",
        ]);
        worksheet.mergeCells(yardTitleRowIndex, 1, yardTitleRowIndex, 4);
        yardTitleRow.getCell(1).font = {
          name: "Arial",
          size: 11,
          bold: true,
          color: { argb: "FF1F2937" },
        };

        const yardHeaderRowIndex = worksheet.lastRow.number + 1;
        const yardHeaderRow = worksheet.addRow([
          "الساحة",
          "",
          "العدد / الكمية",
        ]);
        worksheet.mergeCells(yardHeaderRowIndex, 1, yardHeaderRowIndex, 2);
        yardHeaderRow.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF3F4F6" },
          };
          cell.font = { name: "Arial", size: 10, bold: true };
          cell.border = {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" },
          };
        });

        Object.entries(summaryReportsData.overallYardTotals).forEach(
          ([yName, yCount]) => {
            const yardRowIndex = worksheet.lastRow.number + 1;
            const row = worksheet.addRow([yName, "", `${yCount} سيارة`]);
            worksheet.mergeCells(yardRowIndex, 1, yardRowIndex, 2);
            row.eachCell((cell) => {
              cell.font = { name: "Arial", size: 10 };
              cell.border = {
                top: { style: "thin" },
                bottom: { style: "thin" },
                left: { style: "thin" },
                right: { style: "thin" },
              };
            });
          },
        );

        const totalYardRowIndex = worksheet.lastRow.number + 1;
        const totalYardRow = worksheet.addRow([
          "الجمال الكلي لجميع الساحات",
          "",
          `${summaryReportsData.totalCount} سيارة`,
        ]);
        worksheet.mergeCells(totalYardRowIndex, 1, totalYardRowIndex, 2);
        totalYardRow.eachCell((cell) => {
          cell.font = { name: "Arial", size: 10, bold: true };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE5E7EB" },
          };
          cell.border = {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" },
          };
        });
      }

      // Set standard column widths
      for (let c = 1; c <= 25; c++) {
        worksheet.getColumn(c).width = c === 1 ? 12 : 12; // First column (المجموع) set to 12 (96px)
      }

      // Manually set height of all rows in this worksheet
      worksheet.eachRow({ includeEmpty: true }, (row) => {
        if (reportView === "physical-inventory-summary") {
          row.height = 18.75; // 25 pixels (25 * 0.75 = 18.75 points)
        } else {
          row.height = 21; // 28 pixels
        }
      });

      workbook.worksheets.forEach((ws) => {
        ExcelService.formatWorksheet(ws, { isRTL, skipRowHeights: true });
      });

      // Write and download
      const buffer = await workbook.xlsx.writeBuffer();
      const safeSheetName = sheetTitle.replace(/\s+/g, "_");
      const fileName = `${settings.name}_${safeSheetName}_${new Date().toISOString().split("T")[0]}.xlsx`;
      const blob = new Blob([buffer]);
      saveAs(blob, fileName);
      try {
        await documentStorageService.verifyAndWriteToLocalFolder(
          fileName,
          blob,
          "reports",
        );
      } catch (err) {
        console.warn("Unified Storage Driver write error:", err);
      }
      return;
    }

    if (reportView === "daily-summary" && !carsArray) {
      const worksheet = workbook.addWorksheet("ملخص حركة الدخول والخروج", {
        views: [{ rightToLeft: isRTL }],
      });

      // 1. Title Banner
      worksheet.mergeCells("A1:E1");
      const titleCell = worksheet.getCell("A1");
      titleCell.value = `تقرير ملخص حركة المخزون اليومية ليوم: ${dailyReportDate}`;
      titleCell.font = {
        name: "Arial",
        size: 14,
        bold: true,
        color: { argb: "FF1E3A8A" },
      };
      titleCell.alignment = { vertical: "middle", horizontal: "center" };
      worksheet.getRow(1).height = 40;

      // 2. Metadata row
      worksheet.mergeCells("A2:E2");
      const metaCell = worksheet.getCell("A2");
      metaCell.value = `المعرض: ${settings.name || "إدارة المستودع"}  |  تاريخ الاستخراج: ${new Date().toLocaleDateString("ar-EG")}  |  مسؤول الدخول والخروج: النظام المالي`;
      metaCell.font = {
        name: "Arial",
        size: 11,
        bold: true,
        color: { argb: "FF475569" },
      };
      metaCell.alignment = { vertical: "middle", horizontal: "center" };
      worksheet.getRow(2).height = 25;

      worksheet.addRow([]); // Blank spacer line at Row 3

      // 3. Section 1 header banner (Row 4)
      worksheet.mergeCells("A4:E4");
      const s1HeaderCell = worksheet.getCell("A4");
      s1HeaderCell.value = `📥 القسم الأول: حركة دخول السيارات اليومية (السيارات الواردة) - إجمالي: ${dailyStats.entries.length} سيارات`;
      s1HeaderCell.font = {
        name: "Arial",
        size: 12,
        bold: true,
        color: { argb: "FFFFFFFF" },
      };
      s1HeaderCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF059669" },
      }; // green-600
      s1HeaderCell.alignment = { vertical: "middle", horizontal: "center" };
      worksheet.getRow(4).height = 30;

      // Section 1 Column Headers (Row 5)
      const s1HeadersRow = worksheet.addRow([
        "م",
        "المركبة وتفاصيلها (الماركة/الموديل/السنة)",
        "رقم الهيكل VIN",
        "اللون والمواصفات",
        "ملاحظات وتفاصيل الدخول",
      ]);
      s1HeadersRow.height = 25;
      s1HeadersRow.eachCell((cell) => {
        cell.font = {
          name: "Arial",
          size: 10,
          bold: true,
          color: { argb: "FF1F2937" },
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE2E8F0" },
        };
        cell.border = {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });

      // Section 1 Rows
      if (dailyStats.entries && dailyStats.entries.length > 0) {
        dailyStats.entries.forEach((car, index) => {
          const r = worksheet.addRow([
            index + 1,
            `${formatVehicleDisplay(car)} (${car.year || "-"})`,
            car.vin || "-",
            car.color || "-",
            car.notes || "لا توجد ملاحظات",
          ]);
          r.height = 48.75; // Standardize row height to 65px (65 * 0.75 = 48.75 points)
          r.eachCell((cell, colNum) => {
            cell.font = { name: "Arial", size: 10 };
            cell.alignment = {
              vertical: "middle",
              horizontal: colNum === 3 ? "center" : "right",
            };
            cell.border = {
              top: { style: "thin", color: { argb: "FFE2E8F0" } },
              bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
              left: { style: "thin", color: { argb: "FFE2E8F0" } },
              right: { style: "thin", color: { argb: "FFE2E8F0" } },
            };
          });
        });
      } else {
        const emptyRowIndex = worksheet.lastRow.number + 1;
        worksheet.mergeCells(`A${emptyRowIndex}:E${emptyRowIndex}`);
        const emptyCell = worksheet.getCell(`A${emptyRowIndex}`);
        emptyCell.value = "لا توجد حركة دخول سيارات مسجلة لهذا اليوم";
        emptyCell.font = {
          name: "Arial",
          size: 10,
          italic: true,
          color: { argb: "FF94A3B8" },
        };
        emptyCell.alignment = { vertical: "middle", horizontal: "center" };
        worksheet.getRow(emptyRowIndex).height = 25;
      }

      // Section 1 Total Row
      const s1TotalRowIndex = worksheet.lastRow.number + 1;
      worksheet.mergeCells(`A${s1TotalRowIndex}:E${s1TotalRowIndex}`);
      const s1TotalCell = worksheet.getCell(`A${s1TotalRowIndex}`);
      s1TotalCell.value = `إجمالي حركة الدخول:   ${dailyStats.entries.length} سيارة`;
      s1TotalCell.font = {
        name: "Arial",
        size: 11,
        bold: true,
        color: { argb: "FF065F46" },
      };
      s1TotalCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFECFDF5" },
      };
      s1TotalCell.alignment = { vertical: "middle", horizontal: "center" };
      worksheet.getRow(s1TotalRowIndex).height = 25;

      worksheet.addRow([]); // Blank spacing line between sections

      // 4. Section 2 header banner
      const s2HeaderRowIndex = worksheet.lastRow.number + 1;
      worksheet.mergeCells(`A${s2HeaderRowIndex}:E${s2HeaderRowIndex}`);
      const s2HeaderCell = worksheet.getCell(`A${s2HeaderRowIndex}`);
      s2HeaderCell.value = `📤 القسم الثاني: حركة خروج السيارات اليومية (السيارات الصادرة) - إجمالي: ${dailyStats.exits.length} سيارات`;
      s2HeaderCell.font = {
        name: "Arial",
        size: 12,
        bold: true,
        color: { argb: "FFFFFFFF" },
      };
      s2HeaderCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFDC2626" },
      }; // red-600
      s2HeaderCell.alignment = { vertical: "middle", horizontal: "center" };
      worksheet.getRow(s2HeaderRowIndex).height = 30;

      // Section 2 Column Headers
      const s2HeadersRow = worksheet.addRow([
        "م",
        "المركبة وتفاصيلها (الماركة/الموديل/السنة)",
        "رقم الهيكل VIN",
        "اللون والمواصفات",
        "المستلم / المندوب وملاحظات الخروج",
      ]);
      s2HeadersRow.height = 25;
      s2HeadersRow.eachCell((cell) => {
        cell.font = {
          name: "Arial",
          size: 10,
          bold: true,
          color: { argb: "FF1F2937" },
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE2E8F0" },
        };
        cell.border = {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });

      // Section 2 Rows
      if (dailyStats.exits && dailyStats.exits.length > 0) {
        dailyStats.exits.forEach((car, index) => {
          const r = worksheet.addRow([
            index + 1,
            `${formatVehicleDisplay(car)} (${car.year || "-"})`,
            car.vin || "-",
            car.color || "-",
            `👤 البائع/المندوب: ${car.seller || "غير محدد"}${car.exitType ? ` (نوع الصرف: ${car.exitType})` : ""} | ملاحظات: ${car.notes || "بدون ملاحظات"}`,
          ]);
          r.height = 48.75; // Standardize row height to 65px (65 * 0.75 = 48.75 points)
          r.eachCell((cell, colNum) => {
            cell.font = { name: "Arial", size: 10 };
            cell.alignment = {
              vertical: "middle",
              horizontal: colNum === 3 ? "center" : "right",
            };
            cell.border = {
              top: { style: "thin", color: { argb: "FFE2E8F0" } },
              bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
              left: { style: "thin", color: { argb: "FFE2E8F0" } },
              right: { style: "thin", color: { argb: "FFE2E8F0" } },
            };
          });
        });
      } else {
        const emptyRowIndex = worksheet.lastRow.number + 1;
        worksheet.mergeCells(`A${emptyRowIndex}:E${emptyRowIndex}`);
        const emptyCell = worksheet.getCell(`A${emptyRowIndex}`);
        emptyCell.value = "لا توجد حركة خروج سيارات مسجلة لهذا اليوم";
        emptyCell.font = {
          name: "Arial",
          size: 10,
          italic: true,
          color: { argb: "FF94A3B8" },
        };
        emptyCell.alignment = { vertical: "middle", horizontal: "center" };
        worksheet.getRow(emptyRowIndex).height = 25;
      }

      // Section 2 Total Row
      const s2TotalRowIndex = worksheet.lastRow.number + 1;
      worksheet.mergeCells(`A${s2TotalRowIndex}:E${s2TotalRowIndex}`);
      const s2TotalCell = worksheet.getCell(`A${s2TotalRowIndex}`);
      s2TotalCell.value = `إجمالي حركة الخروج:   ${dailyStats.exits.length} سيارة`;
      s2TotalCell.font = {
        name: "Arial",
        size: 11,
        bold: true,
        color: { argb: "FF991B1B" },
      };
      s2TotalCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFEE2E2" },
      };
      s2TotalCell.alignment = { vertical: "middle", horizontal: "center" };
      worksheet.getRow(s2TotalRowIndex).height = 25;

      // Define column widths specifically for these 5 cols
      worksheet.getColumn(1).width = 8; // Index
      worksheet.getColumn(2).width = 32; // Car Details
      worksheet.getColumn(3).width = 22; // VIN
      worksheet.getColumn(4).width = 18; // Color
      worksheet.getColumn(5).width = 48; // Notes/Buyer

      workbook.worksheets.forEach((ws) => {
        ExcelService.formatWorksheet(ws, { isRTL });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const fileName = `${settings.name}_ملخص_حركة_المخزون_${dailyReportDate}.xlsx`;
      const blob = new Blob([buffer]);
      saveAs(blob, fileName);
      try {
        await documentStorageService.verifyAndWriteToLocalFolder(
          fileName,
          blob,
          "reports",
        );
      } catch (err) {
        console.warn("Unified Storage Driver write error:", err);
      }
      return;
    }

    const worksheet = workbook.addWorksheet(
      computedSheetName || "المخزون الكامل",
      {
        views: [{ rightToLeft: isRTL }],
      },
    );

    // إعداد الأعمدة النشطة فقط للتصدير المخصص (حسب تخصيص المستخدم للاعمدة)
    const excelColumns: Array<{ header: string; key: string; width: number }> = [
      // عمود التسلسل (م) ثابت دائمًا في كل تصدير، بغض النظر عن إعدادات
      // إظهار/إخفاء الأعمدة — كل صف أصلاً يحمل رقمه التسلسلي (index) لكنه
      // كان بدون عمود يُكتب فيه فيختفي من الملف المُصدَّر.
      { header: "م", key: "index", width: 6 },
    ];

    activeColumns.forEach((col) => {
      let excelKey = col.key;
      if (col.key === "brand_model") excelKey = "brandModel";
      else if (col.key === "color_model") excelKey = "colorModel";
      else if (col.key === "owner") excelKey = "ownerName";

      // الالتزام بمقاس احترافي ومحدد للأعمدة في ملفات الإكسيل لمنع تداخل النصوص
      let colWidth = 15;
      const k = col.key.toLowerCase();
      const l = col.label;
      if (k === "brand") colWidth = 20;
      else if (k === "model") colWidth = 22;
      else if (k === "interiorcolor" || k === "interior_color") colWidth = 16;
      else if (k === "color") colWidth = 16;
      else if (k === "year") colWidth = 12;
      else if (k === "carremark" || k === "car_remark") colWidth = 25;
      else if (k === "entry_transport_company") colWidth = 22;
      else if (k === "brand_model" || k === "brandmodel")
        colWidth = reportView === "delegates-reports" ? 60.75 : 32;
      else if (k === "color_model" || k === "colormodel") colWidth = 20;
      else if (k === "vin") colWidth = 24;
      else if (
        k.includes("notes") ||
        k.includes("note") ||
        l.includes("ملاحظات")
      )
        colWidth = 35;
      else if (k === "platenumber" || l.includes("لوحة")) colWidth = 18;
      else if (k === "cardnumber" || l.includes("جمرك")) colWidth = 18;
      else if (k === "owner" || l.includes("المالك")) colWidth = 22;
      else if (k === "supplier" || l.includes("المورد")) colWidth = 22;
      else if (k === "seller" || l.includes("البائع") || l.includes("مندوب"))
        colWidth = 20;
      else if (
        k === "receivername" ||
        l.includes("مستلم") ||
        l.includes("العميل")
      )
        colWidth = 22;
      else if (k === "receiverphone" || l.includes("جوال")) colWidth = 18;
      else if (
        k === "transport_company" ||
        l.includes("شحن") ||
        l.includes("نقل")
      )
        colWidth = 20;
      else if (
        k === "costprice" ||
        k === "price" ||
        l.includes("سعر") ||
        l.includes("تكلفة")
      )
        colWidth = 16;
      else if (l.length > 10) colWidth = 20;
      else colWidth = 15;

      excelColumns.push({
        header: col.label,
        key: excelKey,
        width: colWidth,
      });
    });

    worksheet.columns = excelColumns;
    const totalColumns = excelColumns.length;

    // تنسيق الرأس
    const headerRow = worksheet.getRow(1);
    headerRow.height = 35;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFFFFF" },
      }; // White background
      cell.font = {
        color: { argb: "FF0F172A" },
        bold: true,
        size: reportView === "delegates-reports" ? 22 : 12,
        name: "Arial",
      }; // Dark slate text
      cell.alignment = {
        vertical: "middle",
        horizontal: "center",
        readingOrder: isRTL ? "rtl" : "ltr",
      };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });

    const sourceCars = carsArray || filteredCarsData;

    // Sort cars: present first, then absent, and then by brand and grade (using sourceCars to respect current filters)
    const presentList = sourceCars
      .filter((car) => car.isPresentInShowroom !== false)
      .sort(sortCarsUnderBrand);
    const absentList = sourceCars
      .filter((car) => car.isPresentInShowroom === false)
      .sort(sortCarsUnderBrand);

    const addCarRow = (car: any, index: number) => {
      const notForSale = isCarNotForSale(car);

      const rawCondition = car.exitData?.carCondition || car.carCondition || "";
      const repVal = getReservationRepresentative(car);
      const rawNotes =
        repVal !== "-"
          ? repVal
          : car.notes
            ? getCleanDelegateName(car.notes)
            : "";
      const condVal = notForSale
        ? rawCondition
          ? `${rawCondition} - السياره غير معروضه للبيع`
          : "السياره غير معروضه للبيع"
        : rawCondition || "-";
      const notesVal = notForSale
        ? rawNotes
          ? `${rawNotes} - السياره غير معروضه للبيع`
          : "السياره غير معروضه للبيع"
        : rawNotes || "-";
      const exitNotesVal = car.exitData?.notes || "";
      const finalizedExitNotes = notForSale
        ? exitNotesVal
          ? `${exitNotesVal} - السياره غير معروضه للبيع`
          : "السياره غير معروضه للبيع"
        : exitNotesVal || "-";

      const rowData: any = {
        index: index,
        brand: car.brand || "-",
        model: car.model || "-",
        interiorColor:
          car.interiorColor || car.customData?.interiorColor || "-",
        color: car.color || "-",
        year: car.year ? String(car.year) : "-",
        carRemark: car.carRemark || "-",
        entry_transport_company:
          car.customData?.entryTransportCompany ||
          car.customData?.transportCompany ||
          "-",
        brandModel: formatVehicleWithDelegate(car),
        colorModel: `${car.color} | ${car.year}`,
        vin: car.vin,
        vin_matching: (() => {
          const raw = String(car.vinMatching || '').trim();
          return (raw === 'غير مطابق' || raw === 'غير متطابق' || raw === 'mismatch' || raw === 'غير_مطابق') ? 'غير متطابق' : 'متطابق';
        })(),
        plateNumber: car.plateData?.plateNumber || "-",
        cardNumber: car.cardNumber || "-",
        ownerName: car.ownershipType,
        status: car.status,
        car_condition: condVal,
        rental: car.rentalStatus,
        showroom: car.isPresentInShowroom !== false ? "نعم" : "لا",
        supplier: car.supplier || "-",
        entryDate: car.entryDate ? car.entryDate.split("T")[0] : "-",
        notes: notesVal,
        attribution: car.attributionSource || "-",
        seller: getRepresentativeOrSeller(car),
        deliveryType: car.exitData?.deliveryType || "-",
        transport_company:
          car.customData?.entryTransportCompany ||
          car.exitData?.transportCompany ||
          "-",
        receiverName: car.exitData?.receiverName || "-",
        receiverId: car.exitData?.receiverId || "-",
        nationality: car.exitData?.nationality || "-",
        receiverPhone: car.exitData?.receiverPhone || "-",
        exitDate: car.exitData?.exitDate || "-",
        exitNotes: finalizedExitNotes,
        costPrice: canViewFinancials ? car.costPrice : "***",
        price: canViewFinancials ? car.price : "***",
      };

      // Add custom fields
      (settings.reportsCustomFields && settings.reportsCustomFields.length > 0
        ? settings.reportsCustomFields
        : settings.customFields || []
      ).forEach((f) => {
        rowData[f.id] = car.customData?.[f.id] || "-";
      });

      const row = worksheet.addRow(rowData);

      row.height = 48.75; // Standardize row height to 65px (65 * 0.75 = 48.75 points)
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.alignment = {
          vertical: "middle",
          horizontal: colNumber === 1 ? "center" : isRTL ? "right" : "left",
          readingOrder: isRTL ? "rtl" : "ltr",
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };

        const statusInfo = getCarStatusColorInfo(car, settings);
        const bgArgb = statusInfo.bgArgb;
        const fgArgb = statusInfo.textArgb;
        const isBold = statusInfo.isBold;

        cell.font = {
          name: "Arial",
          size: reportView === "delegates-reports" ? 22 : 10,
          color: { argb: fgArgb },
          bold: isBold,
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: bgArgb },
        };

        // مربع التجيير لأي سيارة لم تجير
        const colDef = excelColumns[colNumber - 1];
        if (
          colDef &&
          (colDef.key === "rental" || colDef.header === "حالة التجير" || colDef.header?.includes("تجير"))
        ) {
          const rentalInfo = getCarRentalColorInfo(car, settings);
          if (rentalInfo.isNotRented) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: rentalInfo.bgArgb },
            };
            cell.font = {
              name: "Arial",
              size: reportView === "delegates-reports" ? 22 : 10,
              color: { argb: rentalInfo.textArgb },
              bold: true,
            };
          }
        }
      });
    };

    // 1. Export present cars first
    let lastBrand = "";
    let lastModel = "";
    let lastAttribution = "";
    presentList.forEach((car, idx) => {
      const cleanBrand = getCleanBrandName(car.brand);
      if (cleanBrand !== lastBrand) {
        lastBrand = cleanBrand;
        lastModel = ""; // reset model header on new brand group
        lastAttribution = ""; // reset attribution on new brand group
        const brandRowIndex = worksheet.rowCount + 1;
        worksheet.mergeCells(brandRowIndex, 1, brandRowIndex, totalColumns);
        const brandRow = worksheet.getRow(brandRowIndex);
        brandRow.height = 32;
        const brandCell = brandRow.getCell(1);
        brandCell.value = `🚘 ${cleanBrand} 🚘`;
        brandCell.font = {
          name: "Arial",
          size: reportView === "delegates-reports" ? 22 : 13,
          bold: true,
          color: { argb: "FF1E1B4B" },
        };
        brandCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFBCBBC9" },
        }; // Light indigo header background (30% intensity)
        brandCell.alignment = {
          vertical: "middle",
          horizontal: "center",
          readingOrder: isRTL ? "rtl" : "ltr",
        };

        for (let col = 1; col <= totalColumns; col++) {
          const cell = brandRow.getCell(col);
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFBCBBC9" },
          };
          cell.font = {
            name: "Arial",
            size: reportView === "delegates-reports" ? 22 : 13,
            bold: true,
            color: { argb: "FF1E1B4B" },
          };
          cell.alignment = {
            vertical: "middle",
            horizontal: "center",
            readingOrder: isRTL ? "rtl" : "ltr",
          };
          cell.border = {
            top: { style: "medium", color: { argb: "FF8C899B" } },
            bottom: { style: "medium", color: { argb: "FF8C899B" } },
          };
        }
      }

      const modelKey = getCleanModelKey(car.model);
      const isNewModel = modelKey !== lastModel;
      if (isNewModel) {
        lastModel = modelKey;
        lastAttribution = ""; // reset attribution on new model group
        const modelRowIndex = worksheet.rowCount + 1;
        worksheet.mergeCells(modelRowIndex, 1, modelRowIndex, totalColumns);
        const modelRow = worksheet.getRow(modelRowIndex);
        modelRow.height = 26;
        const modelCell = modelRow.getCell(1);
        modelCell.value = `${car.model || "عام"}`;
        modelCell.font = {
          name: "Arial",
          size: reportView === "delegates-reports" ? 22 : 12,
          bold: true,
          color: { argb: "FF374151" },
        }; // Dark slate gray text
        modelCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFC3C6CB" },
        }; // Light slate gray background (30% intensity)
        modelCell.alignment = {
          vertical: "middle",
          horizontal: "center",
          readingOrder: isRTL ? "rtl" : "ltr",
        };

        for (let col = 1; col <= totalColumns; col++) {
          const cell = modelRow.getCell(col);
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFC3C6CB" },
          };
          cell.font = {
            name: "Arial",
            size: reportView === "delegates-reports" ? 22 : 12,
            bold: true,
            color: { argb: "FF374151" },
          };
          cell.alignment = {
            vertical: "middle",
            horizontal: "center",
            readingOrder: isRTL ? "rtl" : "ltr",
          };
          cell.border = {
            top: { style: "thin", color: { argb: "FFAAAEB5" } },
            bottom: { style: "thin", color: { argb: "FFAAAEB5" } },
          };
        }
      }

      const attributionVal = car.attributionSource || "عام / غير محدد";
      const showAttributionHeader =
        isNewModel || attributionVal !== lastAttribution;
      if (showAttributionHeader) {
        lastAttribution = attributionVal;
        const attrRowIndex = worksheet.rowCount + 1;
        worksheet.mergeCells(attrRowIndex, 1, attrRowIndex, totalColumns);
        const attrRow = worksheet.getRow(attrRowIndex);
        attrRow.height = 22;
        const attrCell = attrRow.getCell(1);
        attrCell.value = `📥 الوارد / المصدر: ${attributionVal}`;
        attrCell.font = {
          name: "Arial",
          size: reportView === "delegates-reports" ? 22 : 11,
          bold: true,
          color: { argb: "FF082F49" },
        }; // deep dark sky-950 blue text
        attrCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFB5C1C8" },
        }; // Light sky blue background (30% intensity)
        attrCell.alignment = {
          vertical: "middle",
          horizontal: "center",
          readingOrder: isRTL ? "rtl" : "ltr",
        };

        for (let col = 1; col <= totalColumns; col++) {
          const cell = attrRow.getCell(col);
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFB5C1C8" },
          };
          cell.font = {
            name: "Arial",
            size: reportView === "delegates-reports" ? 22 : 11,
            bold: true,
            color: { argb: "FF082F49" },
          };
          cell.alignment = {
            vertical: "middle",
            horizontal: "center",
            readingOrder: isRTL ? "rtl" : "ltr",
          };
          cell.border = {
            top: { style: "thin", color: { argb: "FF99AAB3" } },
            bottom: { style: "thin", color: { argb: "FF99AAB3" } },
          };
        }
      }

      addCarRow(car, idx + 1);
    });

    // 2. Export absent cars with an incredibly distinctive, large, and colored section header row
    if (absentList.length > 0) {
      const spacerRow = worksheet.addRow([]);
      spacerRow.height = 15;

      const headerRowIndex = worksheet.rowCount + 1;

      worksheet.mergeCells(headerRowIndex, 1, headerRowIndex, totalColumns);
      const sectionRow = worksheet.getRow(headerRowIndex);
      sectionRow.height = 38;

      const headerCell = sectionRow.getCell(1);
      headerCell.value = `🛑 مركبات لم تصل المعرض ({${absentList.length}} مركبة) 🛑`;
      headerCell.font = {
        name: "Segoe UI",
        size: 15,
        bold: true,
        color: { argb: "FF991B1B" }, // Bold Deep Crimson
      };

      headerCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFFFFF" }, // White background
      };
      headerCell.alignment = {
        vertical: "middle",
        horizontal: "center",
        readingOrder: isRTL ? "rtl" : "ltr",
      };

      for (let c = 1; c <= totalColumns; c++) {
        const cell = sectionRow.getCell(c);
        if (c !== 1) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFFFFF" }, // White background
          };
        }
        cell.alignment = {
          vertical: "middle",
          horizontal: "center",
          readingOrder: isRTL ? "rtl" : "ltr",
        };
        cell.border = {
          top: { style: "medium", color: { argb: "FFFCA5A5" } },
          bottom: { style: "medium", color: { argb: "FFFCA5A5" } },
          left:
            c === 1
              ? { style: "medium", color: { argb: "FFFCA5A5" } }
              : undefined,
          right:
            c === totalColumns
              ? { style: "medium", color: { argb: "FFFCA5A5" } }
              : undefined,
        };
      }

      let lastAbsentBrand = "";
      let lastAbsentModel = "";
      let lastAbsentAttribution = "";
      absentList.forEach((car, idx) => {
        const cleanBrand = getCleanBrandName(car.brand);
        if (cleanBrand !== lastAbsentBrand) {
          lastAbsentBrand = cleanBrand;
          lastAbsentModel = ""; // reset model header on new brand group
          lastAbsentAttribution = ""; // reset attribution on new brand group
          const brandRowIndex = worksheet.rowCount + 1;
          worksheet.mergeCells(brandRowIndex, 1, brandRowIndex, totalColumns);
          const brandRow = worksheet.getRow(brandRowIndex);
          brandRow.height = 32;
          const brandCell = brandRow.getCell(1);
          brandCell.value = `🚘 ${cleanBrand} (لم تصل المعرض) 🚘`;
          brandCell.font = {
            name: "Arial",
            size: reportView === "delegates-reports" ? 22 : 13,
            bold: true,
            color: { argb: "FFFFFFFF" },
          };
          brandCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF881337" },
          }; // Dark rose-900 bg
          brandCell.alignment = {
            vertical: "middle",
            horizontal: "center",
            readingOrder: isRTL ? "rtl" : "ltr",
          };

          for (let col = 1; col <= totalColumns; col++) {
            const cell = brandRow.getCell(col);
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FF881337" },
            };
            cell.font = {
              name: "Arial",
              size: reportView === "delegates-reports" ? 22 : 13,
              bold: true,
              color: { argb: "FFFFFFFF" },
            };
            cell.alignment = {
              vertical: "middle",
              horizontal: "center",
              readingOrder: isRTL ? "rtl" : "ltr",
            };
            cell.border = {
              top: { style: "medium", color: { argb: "FFBE123C" } },
              bottom: { style: "medium", color: { argb: "FFBE123C" } },
            };
          }
        }

        const modelKey = getCleanModelKey(car.model);
        const isNewModel = modelKey !== lastAbsentModel;
        if (isNewModel) {
          lastAbsentModel = modelKey;
          lastAbsentAttribution = ""; // reset attribution on new model group
          const modelRowIndex = worksheet.rowCount + 1;
          worksheet.mergeCells(modelRowIndex, 1, modelRowIndex, totalColumns);
          const modelRow = worksheet.getRow(modelRowIndex);
          modelRow.height = 26;
          const modelCell = modelRow.getCell(1);
          modelCell.value = `${car.model || "عام"} (لم تصل المعرض)`;
          modelCell.font = {
            name: "Arial",
            size: reportView === "delegates-reports" ? 22 : 12,
            bold: true,
            color: { argb: "FFFFFFFF" },
          }; // white text
          modelCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF451A03" },
          }; // Dark brown bg for absent model
          modelCell.alignment = {
            vertical: "middle",
            horizontal: "center",
            readingOrder: isRTL ? "rtl" : "ltr",
          };

          for (let col = 1; col <= totalColumns; col++) {
            const cell = modelRow.getCell(col);
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FF451A03" },
            };
            cell.font = {
              name: "Arial",
              size: reportView === "delegates-reports" ? 22 : 12,
              bold: true,
              color: { argb: "FFFFFFFF" },
            };
            cell.alignment = {
              vertical: "middle",
              horizontal: "center",
              readingOrder: isRTL ? "rtl" : "ltr",
            };
            cell.border = {
              top: { style: "thin", color: { argb: "FF78350F" } },
              bottom: { style: "thin", color: { argb: "FF78350F" } },
            };
          }
        }

        const attributionVal = car.attributionSource || "عام / غير محدد";
        const showAttributionHeader =
          isNewModel || attributionVal !== lastAbsentAttribution;
        if (showAttributionHeader) {
          lastAbsentAttribution = attributionVal;
          const attrRowIndex = worksheet.rowCount + 1;
          worksheet.mergeCells(attrRowIndex, 1, attrRowIndex, totalColumns);
          const attrRow = worksheet.getRow(attrRowIndex);
          attrRow.height = 22;
          const attrCell = attrRow.getCell(1);
          attrCell.value = `📥 الوارد / المصدر: ${attributionVal} (لم تصل المعرض)`;
          attrCell.font = {
            name: "Arial",
            size: reportView === "delegates-reports" ? 22 : 11,
            bold: true,
            color: { argb: "FFFECDD3" },
          }; // light rose text
          attrCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF450A0A" },
          }; // deep red-950 bg
          attrCell.alignment = {
            vertical: "middle",
            horizontal: "center",
            readingOrder: isRTL ? "rtl" : "ltr",
          };

          for (let col = 1; col <= totalColumns; col++) {
            const cell = attrRow.getCell(col);
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FF450A0A" },
            };
            cell.font = {
              name: "Arial",
              size: reportView === "delegates-reports" ? 22 : 11,
              bold: true,
              color: { argb: "FFFECDD3" },
            };
            cell.alignment = {
              vertical: "middle",
              horizontal: "center",
              readingOrder: isRTL ? "rtl" : "ltr",
            };
            cell.border = {
              top: { style: "thin", color: { argb: "FF7F1D1D" } },
              bottom: { style: "thin", color: { argb: "FF7F1D1D" } },
            };
          }
        }

        addCarRow(car, presentList.length + idx + 1);
      });
    }

    // Auto-Fit Columns (حساب العرض تلقائياً للأعمدة بشكل ذكي مع استثناء الخلايا المدمجة)
    worksheet.columns.forEach((column: any) => {
      let maxColumnLength = 0;
      if (column.header) {
        maxColumnLength = Math.max(
          maxColumnLength,
          String(column.header).length,
        );
      }
      column.eachCell!({ includeEmpty: true }, (cell: any) => {
        const isMerged =
          cell.isMerged ||
          (cell.master && cell.master.address !== cell.address);
        if (isMerged) return;
        if (cell.value !== null && cell.value !== undefined) {
          const valStr =
            cell.value instanceof Date
              ? cell.value.toLocaleDateString("ar-EG")
              : String(cell.value);
          const len = valStr.trim().length;
          if (len > maxColumnLength) maxColumnLength = len;
        }
      });
      const isIndexColumn =
        column.key === "index" ||
        (column.header && String(column.header) === "م");
      let minWidth = isIndexColumn ? 6 : 10;
      let maxWidth = 45;
      let calculatedWidth = Math.ceil(maxColumnLength * 1.15) + 3;
      column.width = Math.min(maxWidth, Math.max(minWidth, calculatedWidth));
    });

    workbook.worksheets.forEach((ws) => {
      ExcelService.formatWorksheet(ws, {
        isRTL,
        skipRowHeights: reportView === "delegates-reports",
        settings,
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const safeSheetName = (computedSheetName || "المخزون_الكامل").replace(
      /\s+/g,
      "_",
    );
    const fileName = `${settings.name}_${safeSheetName}_${new Date().toISOString().split("T")[0]}.xlsx`;
    const blob = new Blob([buffer]);
    saveAs(blob, fileName);
    try {
      await documentStorageService.verifyAndWriteToLocalFolder(
        fileName,
        blob,
        "reports",
      );
    } catch (err) {
      console.warn("Unified Storage Driver write error:", err);
    }
  };

  const densityPadding = {
    compact: "3px 2px",
    normal: "6px 4px",
    relaxed: "10px 8px",
  };

  return (
    <div
      className={`space-y-6 pb-32 print:p-0 text-right font-['Cairo'] flex flex-col ${isPrintMode ? "bg-slate-50 min-h-screen" : ""}`}
      dir="rtl"
    >
      <style>{`
        @media print {
          @page { 
            size: A4 ${orientation}; 
            margin: 10mm 5mm 10mm 5mm; 
          }
          body { 
            background: #faf6e8 !important; 
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            overflow: visible !important;
            height: auto !important;
          }
          #root, main, .report-container {
            height: auto !important;
            overflow: visible !important;
            display: block !important;
          }
          .print-hidden, .no-print { display: none !important; }
          
          thead { display: table-header-group; }
          tr { page-break-inside: avoid !important; height: 21pt !important; }
          thead tr { height: 25pt !important; }
          
          th { 
            background-color: #0f172a !important; 
            color: white !important; 
            border: 1px solid #1e293b !important; 
            font-size: ${fontSize}pt !important; 
            padding: ${densityPadding[tableDensity]} !important;
            font-weight: 800 !important;
            vertical-align: middle !important;
          }
          
          td { 
            border: 1px solid #e2e8f0 !important; 
            padding: ${densityPadding[tableDensity]} !important; 
            font-size: ${fontSize - 0.5}pt !important; 
            text-align: center !important;
            color: #1e293b !important;
            vertical-align: middle !important;
          }
          .brand-group-header {
            background-color: #f1f5f9 !important;
            color: #1e293b !important;
            font-weight: 900 !important;
            text-transform: uppercase !important;
            letter-spacing: normal !important;
            border: 1px solid #cbd5e1 !important;
          }

          .report-header {
            border-bottom: 4px solid #0f172a !important;
            margin-bottom: 20px !important;
            padding-bottom: 10px !important;
          }

          /* Reduce whitespace */
          .report-container {
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>

      <div className="flex flex-col gap-6 print:hidden px-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="p-6 bg-slate-950 text-white rounded-[2rem] shadow-2xl">
              <FileText size={40} />
            </div>
            <div>
              <h2 className="text-4xl font-black text-slate-900 tracking-normal">
                تقارير الجرد المحدثة
              </h2>
              <p className="text-slate-500 font-bold">
                إدارة شاملة للمخزون مع بيانات لوحات المركبات
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4 w-full lg:w-auto">
            {/* Category selection tabs */}
            <div className="flex flex-wrap gap-1.5 bg-slate-100 dark:bg-slate-850 p-1.5 rounded-[1.5rem] border border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setActiveCategory("inventory")}
                className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${activeCategory === "inventory" ? "bg-white dark:bg-slate-900 text-blue-600 shadow-md ring-1 ring-slate-200 dark:ring-slate-800" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"}`}
              >
                📦 الجرد والمخازن
              </button>
              <button
                onClick={() => setActiveCategory("movement")}
                className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${activeCategory === "movement" ? "bg-white dark:bg-slate-900 text-emerald-600 shadow-md ring-1 ring-slate-200 dark:ring-slate-800" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"}`}
              >
                ⏱️ الحركة اليومية والشهرية
              </button>
              <button
                onClick={() => setActiveCategory("sales")}
                className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${activeCategory === "sales" ? "bg-white dark:bg-slate-900 text-purple-600 shadow-md ring-1 ring-slate-200 dark:ring-slate-800" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"}`}
              >
                💼 المبيعات والمناديب
              </button>
              <button
                onClick={() => setActiveCategory("purchases_transfers")}
                className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${activeCategory === "purchases_transfers" ? "bg-white dark:bg-slate-900 text-teal-600 shadow-md ring-1 ring-slate-200 dark:ring-slate-800" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"}`}
              >
                🛒 المشتريات والتحويلات والعمليات
              </button>
            </div>

            {/* Active category report views */}
            <div className="flex flex-wrap gap-2 bg-slate-50 dark:bg-slate-900/40 p-1.5 rounded-[1.5rem] border border-slate-200/50 dark:border-slate-800/50">
              {activeCategory === "inventory" && (
                <>
                  <button
                    onClick={() => setReportView("comprehensive-inventory")}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${reportView === "comprehensive-inventory" ? "bg-white dark:bg-slate-800 text-blue-600 shadow-sm border border-blue-500/10 ring-1 ring-blue-500/20" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"}`}
                  >
                    التقرير الشامل 🌐
                  </button>
                  <button
                    onClick={() => setReportView("physical-inventory")}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${reportView === "physical-inventory" ? "bg-white dark:bg-slate-800 text-emerald-600 shadow-sm border border-emerald-500/10" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"}`}
                  >
                    المخزون الفعلي بالمعرض 📍
                  </button>
                  <button
                    onClick={() => setReportView("outside-showroom")}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${reportView === "outside-showroom" ? "bg-white dark:bg-slate-800 text-purple-600 shadow-sm border border-purple-500/10" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"}`}
                  >
                    سيارات لم تصل / خارج المعرض 🚚
                  </button>
                  <button
                    onClick={() => setReportView("inventory")}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${reportView === "inventory" ? "bg-white dark:bg-slate-800 text-blue-600 shadow-sm border border-blue-500/10" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"}`}
                  >
                    تسليم السيارات 📋
                  </button>
                  <button
                    onClick={() => setReportView("showroom-inventory-cost")}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${reportView === "showroom-inventory-cost" ? "bg-white dark:bg-slate-800 text-teal-600 shadow-sm border border-teal-500/10" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"}`}
                  >
                    تكلفة مخزون المعرض 💵
                  </button>
                  <button
                    onClick={() => setReportView("non-rented")}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${reportView === "non-rented" ? "bg-white dark:bg-slate-800 text-amber-600 shadow-sm border border-amber-500/10" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"}`}
                  >
                    السيارات غير المجيرة 🚗
                  </button>
                </>
              )}

              {activeCategory === "movement" && (
                <>
                  <button
                    onClick={() => setReportView("monthly-entry")}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${reportView === "monthly-entry" ? "bg-white dark:bg-slate-800 text-emerald-600 shadow-sm border border-emerald-500/10" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    التقرير الشهري للدخول 📥
                  </button>
                  <button
                    onClick={() => setReportView("monthly-exit")}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${reportView === "monthly-exit" ? "bg-white dark:bg-slate-800 text-blue-600 shadow-sm border border-blue-500/10" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    التقرير الشهري للخروج 📤
                  </button>
                  <button
                    onClick={() => setReportView("daily-entry")}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${reportView === "daily-entry" ? "bg-white dark:bg-slate-800 text-blue-600 shadow-sm border border-blue-500/10" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    دخول اليوم
                  </button>
                  <button
                    onClick={() => setReportView("daily-exit")}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${reportView === "daily-exit" ? "bg-white dark:bg-slate-800 text-blue-600 shadow-sm border border-blue-500/10" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    خروج اليوم
                  </button>
                  <button
                    onClick={() => setReportView("daily-summary")}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${reportView === "daily-summary" ? "bg-white dark:bg-slate-800 text-blue-600 shadow-sm border border-blue-500/10" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    ملخص الحركة اليومية
                  </button>
                  <button
                    onClick={() => setReportView("daily-movement-statement")}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${reportView === "daily-movement-statement" ? "bg-white dark:bg-slate-850 text-purple-600 shadow-sm border-b-2 border-purple-500" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"}`}
                  >
                    بيان حركة اليوم 📋
                  </button>
                </>
              )}

              {activeCategory === "sales" && (
                <>
                  <button
                    onClick={() => setReportView("analytics")}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${reportView === "analytics" ? "bg-white dark:bg-slate-800 text-blue-600 shadow-sm border border-blue-500/10" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    تحليل وإحصائيات الحركة
                  </button>
                  <button
                    onClick={() => setReportView("delegates")}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${reportView === "delegates" ? "bg-white dark:bg-slate-800 text-blue-600 shadow-sm border border-blue-500/10" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    إحصائيات المناديب
                  </button>
                  <button
                    onClick={() => setReportView("delegates-reports")}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${reportView === "delegates-reports" ? "bg-white dark:bg-slate-800 text-blue-600 shadow-sm border border-blue-500/10" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    تقارير المناديب
                  </button>
                  <button
                    onClick={() => setReportView("delegates-inventory-summary")}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${reportView === "delegates-inventory-summary" ? "bg-white dark:bg-slate-800 text-purple-600 shadow-sm border border-purple-500/10" : "text-slate-500 hover:text-slate-707 dark:text-slate-400"}`}
                  >
                    ملخص مبيعات المخزون 📈
                  </button>
                </>
              )}

              {activeCategory === "purchases_transfers" && (
                <>
                  <button
                    onClick={() => setReportView("purchases")}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${reportView === "purchases" ? "bg-white dark:bg-slate-800 text-teal-600 shadow-sm border border-teal-500/10" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    تقرير المشتريات والاستلام 🛒
                  </button>
                  <button
                    onClick={() => setReportView("supplier-analysis")}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${reportView === "supplier-analysis" ? "bg-white dark:bg-slate-800 text-teal-600 shadow-sm border border-teal-500/10" : "text-slate-500 whitespace-nowrap hover:text-slate-700 dark:text-slate-400"}`}
                  >
                    تحليل الموردين 🤝
                  </button>
                  <button
                    onClick={() => setReportView("transfers-general")}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${reportView === "transfers-general" ? "bg-white dark:bg-slate-800 text-amber-600 shadow-sm border border-amber-500/10" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    التحويلات العامة 🔄
                  </button>
                  <button
                    onClick={() => setReportView("transfers-daily")}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${reportView === "transfers-daily" ? "bg-white dark:bg-slate-800 text-amber-600 shadow-sm border border-amber-500/10" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    التحويلات اليومية 🗓️
                  </button>
                  <button
                    onClick={() => setReportView("resilience-audit")}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${reportView === "resilience-audit" ? "bg-white dark:bg-slate-800 text-rose-600 shadow-sm border border-rose-500/10" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    الحماية والتشخيص الذكي 🛡️
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-150/80 dark:border-slate-800 shadow-sm">
          {/* Print Preview Button */}
          <button
            onClick={() => setIsPrintMode(!isPrintMode)}
            className={`flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-xs font-black transition-all shadow-sm border cursor-pointer ${
              isPrintMode
                ? "bg-blue-600 hover:bg-blue-700 text-white border-transparent"
                : "bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
            }`}
          >
            <LayoutDashboard size={16} />
            <span>{isPrintMode ? "إغلاق المعاينة" : "معاينة الطباعة"}</span>
          </button>

          {/* Excel Export & Orientation */}
          {canExport && (
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/40 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-750/65">
              <button
                onClick={exportToExcel}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm flex items-center gap-2 transition-colors cursor-pointer"
              >
                <FileSpreadsheet size={16} /> تصدير Excel
              </button>

              <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-700"></div>

              <div className="flex items-center gap-1">
                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 font-sans">
                  توجيه التصدير:
                </span>
                <button
                  onClick={() => {
                    localStorage.setItem("excel_export_direction", "RTL");
                    setExcelDirection("RTL");
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black transition-all ${
                    excelDirection === "RTL"
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  RTL 🇸🇦
                </button>
                <button
                  onClick={() => {
                    localStorage.setItem("excel_export_direction", "LTR");
                    setExcelDirection("LTR");
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black transition-all ${
                    excelDirection === "LTR"
                      ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25"
                      : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  LTR 🌐
                </button>
              </div>
            </div>
          )}

          {/* Direct PDF Export */}
          <button
            onClick={handlePdfExportForActiveView}
            className="px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-black shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
            title="تصدير هذا التقرير كـ PDF فوراً"
          >
            <FileDown size={16} /> تصدير PDF مباشر 📥
          </button>

          {/* Print Report */}
          <button
            onClick={handlePrint}
            className="px-5 py-3 bg-slate-900 hover:bg-slate-850 dark:bg-slate-800 dark:hover:bg-slate-750 text-white rounded-2xl text-xs font-black shadow-sm flex items-center justify-center gap-2 cursor-pointer border border-transparent"
          >
            <Printer size={16} /> طباعة التقرير
          </button>

          {/* Advanced PDF Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowPdfMenu(!showPdfMenu)}
              className="px-5 py-3 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 rounded-2xl text-xs font-black shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <FileText size={16} /> تصدير تقارير PDF المتقدمة
            </button>

            {showPdfMenu && (
              <div className="absolute left-0 mt-2 w-72 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xl z-50 p-3 space-y-2 text-right">
                <div className="text-[10px] text-slate-400 font-extrabold pb-1.5 border-b border-slate-100 dark:border-slate-800 pr-1 select-none">
                  اختر نوع تقرير الـ PDF لتنزيله:
                </div>
                <button
                  onClick={() => generateProfessionalPDF("current")}
                  className="w-full p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 justify-between"
                >
                  <span>التقرير التحليلي الذكي (كامل) 📈</span>
                  <span className="bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[9px] px-2 py-0.5 rounded-full">
                    اللوحة الحالية
                  </span>
                </button>
                <button
                  onClick={() => generateProfessionalPDF("full")}
                  className="w-full p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 justify-between"
                >
                  <span>تقرير جرد المخزون والسيارات 📋</span>
                  <span className="bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-[9px] px-2 py-0.5 rounded-full">
                    كامل الساحة
                  </span>
                </button>
                <button
                  onClick={() => generateProfessionalPDF("brand")}
                  className="w-full p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 justify-between"
                >
                  <span>تقرير تحليل حركة الماركات والبراندات 🏢</span>
                  <span className="bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 text-[9px] px-2 py-0.5 rounded-full">
                    مقارن بالنظام
                  </span>
                </button>
                <button
                  onClick={() => generateProfessionalPDF("supplier")}
                  className="w-full p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 justify-between"
                >
                  <span>تقرير توزيع وحصص الموردين والشركاء 📦</span>
                  <span className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 text-[9px] px-2 py-0.5 rounded-full">
                    حسب التوريد
                  </span>
                </button>
                <button
                  onClick={() => generateProfessionalPDF("timeline")}
                  className="w-full p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 justify-between"
                >
                  <span>تقرير سجل حركات تسلسل التواريخ ⏱️</span>
                  <span className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-[9px] px-2 py-0.5 rounded-full">
                    سجل الحركة
                  </span>
                </button>
                <button
                  onClick={() => generateProfessionalPDF("physical-summary")}
                  className="w-full p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 justify-between"
                >
                  <span>ملخص الجرد الفعلي الفئوي بالمعرض 🚘</span>
                  <span className="bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[9px] px-2 py-0.5 rounded-full">
                    الجرد المجمّع
                  </span>
                </button>
                <button
                  onClick={() =>
                    generateProfessionalPDF("comprehensive-summary")
                  }
                  className="w-full p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 justify-between"
                >
                  <span>ملخص المخزون الشامل للفئات والساحات 📦</span>
                  <span className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[9px] px-2 py-0.5 rounded-full">
                    المخزون الكلي
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters Specific to Summary Reports */}
      {reportView === "physical-inventory-summary" ||
      reportView === "comprehensive-inventory-summary" ? (
        <div className="mx-4 bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800/80 shadow-xl flex flex-wrap items-center gap-6 justify-between print:hidden">
          <div className="flex flex-wrap items-center gap-4 flex-1">
            {/* Quick Search */}
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 rounded-2xl border border-slate-100 dark:border-slate-800/60 focus-within:ring-2 focus-within:ring-blue-500 transition-all w-full md:max-w-xs">
              <Search size={18} className="text-blue-500 shrink-0" />
              <input
                type="text"
                placeholder="بحث سريع بالماركة أو الموديل..."
                value={summarySearchQuery}
                onChange={(e) => setSummarySearchQuery(e.target.value)}
                className="bg-transparent font-black text-xs outline-none w-full text-slate-800 dark:text-slate-100"
              />
              {summarySearchQuery && (
                <button
                  onClick={() => setSummarySearchQuery("")}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter by Brand */}
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 rounded-2xl border border-slate-100 dark:border-slate-800/60">
              <span className="text-[10px] font-black text-slate-400">
                الماركة:
              </span>
              <select
                value={summaryBrandOption}
                onChange={(e) => {
                  setSummaryBrandOption(e.target.value);
                  setSummaryModelOption("all");
                }}
                className="bg-transparent font-black text-xs outline-none cursor-pointer text-slate-800 dark:text-slate-100"
              >
                <option value="all">كل الماركات</option>
                {summaryReportsData.brands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter by Category/Model */}
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 rounded-2xl border border-slate-100 dark:border-slate-800/60">
              <span className="text-[10px] font-black text-slate-400">
                الموديل:
              </span>
              <select
                value={summaryModelOption}
                onChange={(e) => setSummaryModelOption(e.target.value)}
                className="bg-transparent font-black text-xs outline-none cursor-pointer text-slate-800 dark:text-slate-100"
              >
                <option value="all">كل الموديلات</option>
                {summaryReportsData.models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter by Yard */}
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 rounded-2xl border border-slate-100 dark:border-slate-800/60">
              <span className="text-[10px] font-black text-slate-400">
                الساحة:
              </span>
              <select
                value={summaryYardOption}
                onChange={(e) => setSummaryYardOption(e.target.value)}
                className="bg-transparent font-black text-xs outline-none cursor-pointer text-slate-800 dark:text-slate-100"
              >
                <option value="all">كل الساحات</option>
                {summaryReportsData.yards &&
                  summaryReportsData.yards.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
              </select>
            </div>

            {/* Date Range Start */}
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 rounded-2xl border border-slate-100 dark:border-slate-800/60">
              <span className="text-[10px] font-black text-slate-400 text-nowrap">
                من تاريخ:
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent font-black text-xs outline-none cursor-pointer text-slate-800 dark:text-slate-100"
              />
            </div>

            {/* Date Range End */}
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 rounded-2xl border border-slate-100 dark:border-slate-800/60">
              <span className="text-[10px] font-black text-slate-400 text-nowrap">
                إلى تاريخ:
              </span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent font-black text-xs outline-none cursor-pointer text-slate-800 dark:text-slate-100"
              />
            </div>

            {/* Sorting */}
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 rounded-2xl border border-slate-100 dark:border-slate-800/60">
              <span className="text-[10px] font-black text-slate-400">
                الترتيب:
              </span>
              <select
                value={summarySortBy}
                onChange={(e) => setSummarySortBy(e.target.value as any)}
                className="bg-transparent font-black text-xs outline-none cursor-pointer text-slate-800 dark:text-slate-100"
              >
                <option value="alpha-asc">أبجدي (من أ إلى ي)</option>
                <option value="alpha-desc">أبجدي (من ي إلى أ)</option>
                <option value="count-desc">العدد (الأكثر أولاً)</option>
                <option value="count-asc">العدد (الأقل أولاً)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Clear Filters Button */}
            {(summarySearchQuery ||
              summaryBrandOption !== "all" ||
              summaryModelOption !== "all" ||
              summaryYardOption !== "all" ||
              summarySortBy !== "alpha-asc" ||
              startDate ||
              endDate) && (
              <button
                onClick={() => {
                  setSummarySearchQuery("");
                  setSummaryBrandOption("all");
                  setSummaryModelOption("all");
                  setSummaryYardOption("all");
                  setSummarySortBy("alpha-asc");
                  setStartDate("");
                  setEndDate("");
                }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-350 rounded-xl font-black text-xs transition-all duration-200 flex items-center gap-1.5"
              >
                <RefreshCcw size={14} />
                <span>إعادة تعيين الفلاتر</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl flex flex-wrap items-center gap-6">
          {/* 1. Universal Period Selector */}
          <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 p-2 rounded-2xl border border-slate-100 dark:border-slate-800/60 transition-all">
            <Calendar className="text-blue-500" size={18} />
            <select
              value={reportPeriodMode}
              onChange={(e) => {
                setReportPeriodMode(e.target.value as any);
                if (e.target.value === "all") {
                  setStartDate("");
                  setEndDate("");
                }
              }}
              className="bg-transparent font-black text-xs outline-none cursor-pointer text-slate-800 dark:text-slate-100"
            >
              <option value="all">كل السجلات التاريخية</option>
              <option value="custom">تحديد فترة مخصصة (من - إلى)</option>
              <option value="month">تحديد شهر وسنة محددة 📅</option>
              <option value="year">تحديد سنة كاملة 🗓️</option>
              <option value="week">هذا الأسبوع (آخر 7 أيام) ⏳</option>
            </select>
          </div>

          {/* 2. Custom Date Range Fields (when 'custom' is selected) */}
          {reportPeriodMode === "custom" && (
            <>
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 rounded-2xl border border-slate-100 dark:border-slate-800/60 animate-in fade-in duration-200">
                <span className="text-[10px] font-black text-slate-400 text-nowrap">
                  من تاريخ:
                </span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent font-black text-xs outline-none cursor-pointer text-slate-800 dark:text-slate-100"
                />
              </div>
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 rounded-2xl border border-slate-100 dark:border-slate-800/60 animate-in fade-in duration-200">
                <span className="text-[10px] font-black text-slate-400 text-nowrap">
                  إلى تاريخ:
                </span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent font-black text-xs outline-none cursor-pointer text-slate-800 dark:text-slate-100"
                />
              </div>
            </>
          )}

          {/* 3. Specific Month Selector (when 'month' is selected) */}
          {reportPeriodMode === "month" && (
            <>
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 px-4 py-2 rounded-2xl border border-slate-100 dark:border-slate-800/60 animate-in fade-in duration-200">
                <span className="text-[10px] font-black text-slate-400 text-nowrap">
                  الشهر:
                </span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="bg-transparent font-black text-xs outline-none cursor-pointer text-slate-800 dark:text-slate-100"
                >
                  {arabicMonths.map((m, idx) => (
                    <option key={idx} value={idx}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 px-4 py-2 rounded-2xl border border-slate-100 dark:border-slate-800/60 animate-in fade-in duration-200">
                <span className="text-[10px] font-black text-slate-400 text-nowrap">
                  السنة:
                </span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="bg-transparent font-black text-xs outline-none cursor-pointer text-slate-800 dark:text-slate-100"
                >
                  {yearsList.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* 4. Specific Year Selector (when 'year' is selected) */}
          {reportPeriodMode === "year" && (
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 px-4 py-2 rounded-2xl border border-slate-100 dark:border-slate-800/60 animate-in fade-in duration-200">
              <span className="text-[10px] font-black text-slate-400 text-nowrap">
                السنة:
              </span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-transparent font-black text-xs outline-none cursor-pointer text-slate-800 dark:text-slate-100"
              >
                {yearsList.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 5. Date Field Type Option (e.g. Filter by Entry or Exit Date) */}
          {reportView !== "purchases" &&
            reportView !== "transfers-general" &&
            reportView !== "transfers-daily" && (
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 p-2 rounded-2xl border border-slate-100 dark:border-slate-800/60">
                <Filter size={18} className="text-blue-500" />
                <select
                  value={dateType}
                  onChange={(e) => setDateType(e.target.value as any)}
                  className="bg-transparent font-black text-xs outline-none cursor-pointer text-slate-800 dark:text-slate-100"
                >
                  <option value="all">تلقائي (حسب حالة السيارة)</option>
                  <option value="entry">تصفية بناءً على تاريخ الدخول</option>
                  <option value="exit">تصفية بناءً على تاريخ الخروج</option>
                </select>
              </div>
            )}

          {(reportView === "delegates-reports" ||
            reportView === "delegates-inventory-summary") && (
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 p-2 rounded-2xl border border-slate-100 dark:border-slate-800/60 animate-in fade-in duration-200">
              <Users size={18} className="text-blue-500" />
              <select
                value={selectedDelegateFilter}
                onChange={(e) => setSelectedDelegateFilter(e.target.value)}
                className="bg-transparent font-black text-xs outline-none cursor-pointer text-slate-800 dark:text-slate-100"
              >
                <option value="all">كل المناديب</option>
                {delegateNamesList.map((delName) => (
                  <option key={delName} value={delName}>
                    {delName}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-3 ml-auto">
            <ArrowRightLeft size={16} className="text-indigo-500" />
            <select
              value={orientation}
              onChange={(e) => setOrientation(e.target.value as any)}
              className="bg-transparent font-black text-xs outline-none"
            >
              <option value="landscape">أفقي (للجداول)</option>
              <option value="portrait">رأسي (للقوائم)</option>
            </select>
          </div>
          <button
            onClick={() => setShowColumnSelector(!showColumnSelector)}
            className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350 rounded-xl font-black text-[10px] flex items-center gap-2"
          >
            <Settings2 size={16} /> تخصيص الأعمدة
          </button>
        </div>
      )}

      {showColumnSelector && (
        <div className="mx-4 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl animate-in slide-in-from-top-4 print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h4 className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Settings2
                  className="text-blue-500 animate-spin-slow"
                  size={20}
                />
                <span>
                  تخصيص أعمدة التقرير المطبوع (
                  {reportView === "comprehensive-inventory"
                    ? "التقرير الشامل لكافة المخزون"
                    : reportView === "outside-showroom"
                      ? "سيارات لم تصل / خارج المعرض"
                      : reportView === "inventory"
                        ? "تسليم السيارات"
                    : reportView === "supplier-analysis"
                      ? "تحليل أداء الموردين والشركاء"
                      : reportView === "showroom-inventory-cost"
                        ? "إجمالي تكلفة مخزون المعرض"
                        : reportView === "delegates-inventory-summary"
                          ? "ملخص مبيعات المخزون"
                          : reportView === "physical-inventory"
                            ? "المخزون الفعلي بالمعرض"
                            : reportView === "physical-inventory-summary"
                              ? "الجرد الفئوي بالمعرض"
                              : reportView === "comprehensive-inventory-summary"
                                ? "المخزون الشامل للفئات والساحات"
                                : reportView === "non-rented"
                                  ? "السيارات غير المجيرة"
                                  : reportView === "delegates-reports"
                                    ? "تقرير المناديب المفصل"
                                    : reportView === "monthly" ||
                                        reportView === "monthly-entry" ||
                                        reportView === "monthly-exit"
                                      ? "التقرير الشهري لحركة المخزون"
                                      : reportView === "daily-entry"
                                        ? "تقرير دخول المركبات اليومي"
                                        : reportView === "daily-exit"
                                          ? "تقرير خروج المركبات اليومي"
                                          : reportView === "transfers-general"
                                            ? "التقرير العام للتحويلات"
                                            : reportView === "transfers-daily"
                                              ? "تقرير التحويلات اليومي"
                                              : reportView === "purchases"
                                                ? "تقرير المشتريات والاستلام"
                                                : reportView === "daily-summary"
                                                  ? "تقرير ملخص حركة المخزون اليومية"
                                                  : "تخصيص الخيارات"}
                  )
                </span>
              </h4>
              <p className="text-[10px] text-slate-400 font-bold mt-1">
                قم بإظهار وإخفاء الأعمدة، إعادة ترتيبها (تحريك لليمين أو
                لليسار)، وتعديل عرض كُل عمود (Width) وسيقوم النظام تلقائياً بحفظ
                الإعدادات لكل تقرير بشكل مستقل.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={resetDefaultColumns}
                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-955/20 text-rose-600 dark:text-rose-450 text-[10px] font-black rounded-lg transition-all flex items-center gap-1.5"
                title="استعادة الترتيب والأبعاد الافتراضية للعمود التابع لهذا التقرير"
              >
                <RefreshCcw size={12} />
                <span>استعادة الأعمدة الافتراضية</span>
              </button>

              {columnsSaveSuccess && (
                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 animate-fade-in">
                  ✓ تم الحفظ
                </span>
              )}

              <button
                onClick={() => setShowColumnSelector(false)}
                className="text-slate-400 hover:text-rose-500 p-1.5 bg-slate-50 dark:bg-slate-950 rounded-lg hover:scale-105 transition-all"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {columns.map((col, idx) => (
              <div
                key={col.key}
                className={`flex items-center justify-between p-3 border rounded-2xl transition-all ${col.visible ? "bg-blue-50/45 dark:bg-blue-950/35 border-blue-400 dark:border-blue-900/40" : "bg-slate-50/60 dark:bg-slate-900/50 border-slate-200/80 dark:border-slate-800"}`}
              >
                <button
                  onClick={() => toggleColumn(col.key)}
                  className={`flex items-center gap-2 text-right transition-all flex-1`}
                  title={col.visible ? "إخفاء العمود" : "إظهار العمود"}
                >
                  <span
                    className={col.visible ? "text-blue-500" : "text-slate-400"}
                  >
                    {col.visible ? (
                      <CheckSquare size={16} />
                    ) : (
                      <Square size={16} />
                    )}
                  </span>
                  <span className="text-[11px] font-black leading-tight text-slate-800 dark:text-slate-100">
                    {col.label}
                  </span>
                </button>

                <div className="flex items-center gap-2 border-r border-slate-200 dark:border-slate-800 pr-2 mr-2 shrink-0">
                  <div className="flex flex-col gap-0.5">
                    <button
                      disabled={idx === 0}
                      onClick={() => moveColumn(idx, "up")}
                      className="p-0.5 text-slate-400 hover:text-blue-500 hover:bg-white dark:hover:bg-slate-900 rounded disabled:opacity-20"
                      title="تحريك لأعلى (للأمام بالجدول)"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      disabled={idx === columns.length - 1}
                      onClick={() => moveColumn(idx, "down")}
                      className="p-0.5 text-slate-400 hover:text-blue-500 hover:bg-white dark:hover:bg-slate-900 rounded disabled:opacity-20"
                      title="تحريك لأسفل (للخلف بالجدول)"
                    >
                      <ArrowDown size={12} />
                    </button>
                  </div>

                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 font-mono">
                      العرض
                    </span>
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-950 px-1 py-0.5 rounded border border-slate-150 dark:border-slate-800 text-[9px]">
                      <button
                        onClick={() => adjustColumnWidth(col.key, -1)}
                        className="font-bold text-slate-550 hover:text-blue-500 px-0.5 select-none"
                        title="تقليل عرض العمود"
                      >
                        -
                      </button>
                      <span className="font-mono text-[9px] font-bold text-slate-700 dark:text-slate-300 w-5 text-center shrink-0">
                        {col.width || "10%"}
                      </span>
                      <button
                        onClick={() => adjustColumnWidth(col.key, 1)}
                        className="font-bold text-slate-550 hover:text-blue-500 px-0.5 select-none"
                        title="زيادة عرض العمود"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        id="printable-report"
        className={`mx-4 report-container bg-[#faf6e8] transition-all ${isPrintMode ? "max-w-[1100px] mx-auto shadow-2xl border border-slate-200 my-10 p-12" : "p-12 rounded-[3rem] shadow-2xl border border-slate-100"}`}
      >
        {isPrintMode && (
          <div className="mb-8 flex justify-between items-center border-b pb-6 no-print">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
              <span className="font-black text-slate-900">
                وضع معاينة الطباعة الحقيقي
              </span>
            </div>
            <button
              onClick={handlePrint}
              className="px-8 py-3 bg-blue-600 text-white rounded-xl font-black shadow-lg flex items-center gap-2 hover:scale-105 transition-transform"
            >
              <Printer size={18} /> طباعة الآن
            </button>
          </div>
        )}
        <div className="report-header bg-slate-50/50 dark:bg-slate-900/30 border-2 border-slate-200/60 dark:border-slate-800/80 rounded-[2.5rem] p-6 md:p-8 mb-8 space-y-6">
          {/* Header 3-Column Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center pb-6 border-b-2 border-dashed border-slate-200 dark:border-slate-800">
            {/* Right: Corporate Identification & Legal Info */}
            <div className="space-y-3 text-right">
              <div className="space-y-1">
                <span className="text-[10px] uppercase tracking-normal font-extrabold px-2.5 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 rounded-md">
                  {settings.orgType || "مؤسسة مرخصة"}
                </span>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-normal mt-1">
                  {settings.name}
                </h1>
              </div>
              <div className="space-y-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5 justify-start">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                  <span>سجل تجاري: </span>
                  <strong className="font-mono text-slate-800 dark:text-slate-200 text-xs">
                    {settings.commercialRegister || "٥٩٥٠٠٢٧١٦٣"}
                  </strong>
                </div>
                <div className="flex items-center gap-1.5 justify-start">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                  <span>الرقم الضريبي الموحد: </span>
                  <strong className="font-mono text-slate-800 dark:text-slate-200 text-xs">
                    {settings.taxNumber || "٣١١٨٠٤٦٥٤٨٠٠٠٠٣"}
                  </strong>
                </div>
                {settings.contactNumber && (
                  <div className="flex items-center gap-1.5 justify-start">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                    <span>رقم التواصل والدعم: </span>
                    <strong className="font-mono text-slate-800 dark:text-slate-200 text-xs">
                      {settings.contactNumber}
                    </strong>
                  </div>
                )}
              </div>
            </div>

            {/* Center: Official Brand Logo Container */}
            <div className="flex justify-center">
              {showOrgLogo && (
                <div className="relative group flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-850 shadow-md hover:shadow-xl transition-all duration-350 max-w-[220px] w-full h-28 shrink-0">
                  <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 to-transparent rounded-2xl pointer-events-none" />
                  <img
                    src={settings.logoUrl || getLogoDataUri(settings.name)}
                    alt="Logo"
                    className="max-h-20 max-w-[190px] object-contain transition-transform duration-350 group-hover:scale-105"
                  />
                </div>
              )}
            </div>

            {/* Left: Administrative Info & Geographic Domain */}
            <div className="space-y-2 text-center md:text-left md:items-start flex flex-col items-center md:items-start">
              <span className="text-xs font-black text-blue-900 dark:text-blue-300 border-b-2 border-blue-500/30 pb-1 inline-block">
                المملكة العربية السعودية
              </span>
              <div className="text-xs font-extrabold text-slate-500 dark:text-slate-400 space-y-1 text-center md:text-left">
                <p>تاريخ استخراج التقرير:</p>
                <p className="text-slate-800 dark:text-slate-200 font-black text-sm bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg inline-block">
                  {new Date().toLocaleDateString("ar-EG", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Row: Dynamic Report Title & Interactive Action Panel */}
          <div className="flex flex-col gap-4 items-center justify-between md:flex-row pt-2">
            <div className="text-right space-y-2 max-w-2xl">
              <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white leading-tight tracking-normal">
                {reportView === "inventory"
                  ? "تقرير تسليم السيارات"
                  : reportView === "delegates-inventory-summary"
                    ? "ملخص مبيعات المخزون"
                    : reportView === "physical-inventory"
                      ? "تقرير المخزون الفعلي المتواجد داخل المعرض حالياً"
                      : reportView === "physical-inventory-summary"
                        ? "ملخص الجرد الفعلي الفئوي بالمعرض"
                        : reportView === "comprehensive-inventory-summary"
                          ? "ملخص المخزون الشامل للفئات والساحات"
                          : reportView === "non-rented"
                            ? "تقرير الجرد لجميع السيارات المتبقية التي لم تجير (لم تؤجر)"
                            : reportView === "resilience-audit"
                              ? "لوحة مراقبة وتشخيص استقرار النظام وجودة البيانات"
                              : reportView === "delegates-reports"
                                ? `تقرير المناديب المفصل - ${selectedDelegateFilter === "all" ? "لكل المناديب" : `للمندوب: ${selectedDelegateFilter}`}`
                                : reportView === "monthly-entry"
                                  ? "التقرير الشهري لدخول المخزون (الوارد)"
                                  : reportView === "monthly-exit"
                                    ? "التقرير الشهري لخروج المخزون (الصادر)"
                                    : reportView === "monthly"
                                      ? "التقرير الشهري لحركة المخزون"
                                      : reportView === "daily-entry"
                                        ? "تقرير دخول المركبات اليومي"
                                        : reportView === "daily-exit"
                                          ? "تقرير خروج المركبات اليومي"
                                          : reportView === "transfers-general"
                                            ? "التقرير العام للتحويلات الصادرة والداخلية بين الفروع والمعارض"
                                            : reportView === "transfers-daily"
                                              ? "تقرير التحويلات اليومية بين الفروع والمعارض والمخازن الشقيقة"
                                              : reportView === "purchases"
                                                ? "تقرير المشتريات والاستلام والتوريد العام للمركبات والموردين"
                                                : reportView === "daily-summary"
                                                  ? "تقرير ملخص حركة المخزون اليومية"
                                                  : reportView ===
                                                      "daily-movement-statement"
                                                    ? `بيان حركة المخزون اليومي الصادر والوارد [تاريخ: ${statementDate}]`
                                                    : reportView === "analytics"
                                                      ? "تحليل وإحصائيات حركة المخزون والمبيعات المستهدفة"
                                                      : reportView ===
                                                          "delegates"
                                                        ? "تقرير أداء المناديب وإحصائيات مبيعات المعرض"
                                                        : "تقرير تفصيلي ببيانات المركبات واللوحات"}
              </h2>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">
                منظومة المخزون الذكي لإدارة المركبات - التقارير الإدارية
                المعتمدة والمدققة
              </p>
            </div>

            {/* Action Buttons & Statistics Badges */}
            <div className="flex flex-wrap items-center gap-3 justify-center md:justify-end">
              {(reportView === "inventory" ||
                reportView === "comprehensive-inventory" ||
                reportView === "outside-showroom" ||
                reportView === "delegates-reports" ||
                reportView === "physical-inventory" ||
                reportView === "non-rented" ||
                reportView === "physical-inventory-summary" ||
                reportView === "comprehensive-inventory-summary" ||
                reportView === "delegates-inventory-summary" ||
                reportView === "transfers-general" ||
                reportView === "transfers-daily" ||
                reportView === "purchases") && (
                <>
                  <span className="bg-slate-900 dark:bg-slate-800 text-white px-3.5 py-1.5 rounded-xl text-xs font-black shadow-xs border border-slate-700 dark:border-slate-600">
                    إجمالي الوحدات:{" "}
                    {reportView === "physical-inventory-summary" ||
                    reportView === "comprehensive-inventory-summary"
                      ? summaryReportsData.totalCount
                      : totals.totalCars}
                  </span>

                  {(reportView === "inventory" || reportView === "comprehensive-inventory") && (
                    <>
                      <span className="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700/80 px-3.5 py-1.5 rounded-xl text-xs font-black shadow-xs">
                        داخل المعرض:{" "}
                        {
                          filteredCarsData.filter((c) => c.isPresentInShowroom !== false && !isCarNotArrived(c))
                            .length
                        }{" "}
                        سيارة
                      </span>
                      <span className="bg-purple-100 dark:bg-purple-950/80 text-purple-900 dark:text-purple-200 border border-purple-300 dark:border-purple-700/80 px-3.5 py-1.5 rounded-xl text-xs font-black shadow-xs">
                        خارج المعرض / لم تصل:{" "}
                        {
                          filteredCarsData.filter((c) => c.isPresentInShowroom === false || isCarNotArrived(c))
                            .length
                        }{" "}
                        سيارة
                      </span>
                    </>
                  )}
                  {reportView === "outside-showroom" && (
                    <>
                      <span className="bg-purple-100 dark:bg-purple-950/80 text-purple-900 dark:text-purple-200 border border-purple-300 dark:border-purple-700/80 px-3.5 py-1.5 rounded-xl text-xs font-black shadow-xs">
                        لم تصل المعرض:{" "}
                        {
                          filteredCarsData.filter((c) => isCarNotArrived(c))
                            .length
                        }{" "}
                        سيارة
                      </span>
                      <span className="bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/80 px-3.5 py-1.5 rounded-xl text-xs font-black shadow-xs">
                        في الساحات / مستودع خارجي:{" "}
                        {
                          filteredCarsData.filter((c) => c.isPresentInShowroom === false && !isCarNotArrived(c))
                            .length
                        }{" "}
                        سيارة
                      </span>
                    </>
                  )}
                  {canExport && (
                    <button
                      onClick={() =>
                        exportToExcel(
                          undefined,
                          reportView === "comprehensive-inventory"
                            ? "التقرير_الشامل_لكافة_المخزون"
                            : reportView === "outside-showroom"
                              ? "سيارات_خارج_المعرض_ولم_تصل"
                              : reportView === "inventory"
                                ? "الجرد_الكامل"
                            : reportView === "delegates-inventory-summary"
                              ? "ملخص_مبيعات_المخزون"
                              : reportView === "physical-inventory"
                                ? "المخزون_الفعلي_بالمعرض"
                                : reportView === "physical-inventory-summary"
                                  ? "ملخص_الجرد_الفعلي"
                                  : reportView ===
                                      "comprehensive-inventory-summary"
                                    ? "ملخص_المخزون_الشامل"
                                    : reportView === "non-rented"
                                      ? "السيارات_غير_المجيرة"
                                      : reportView === "transfers-general"
                                        ? "التقرير_العام_للتحويلات"
                                        : reportView === "transfers-daily"
                                          ? "تقرير_التحويلات_اليومية"
                                          : reportView === "purchases"
                                            ? "تقرير_المشتريات_والاستلام"
                                            : `تقارير_المناديب_${selectedDelegateFilter}`,
                        )
                      }
                      className="print:hidden px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl flex items-center gap-1.5 font-black text-xs cursor-pointer shadow-sm transition-transform hover:scale-105"
                      title="تصدير هذا التقرير بمفرده إلى Excel"
                    >
                      <FileSpreadsheet size={14} />
                      <span>تصدير Excel 📊</span>
                    </button>
                  )}
                </>
              )}

              <button
                onClick={handlePdfExportForActiveView}
                className="print:hidden px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl flex items-center gap-1.5 font-black text-xs cursor-pointer shadow-sm transition-transform hover:scale-105"
                title="تصدير هذا التقرير بمفرده كـ PDF"
              >
                <FileDown size={14} />
                <span>تصدير PDF 📄</span>
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto print:overflow-visible text-slate-900">
          {reportView === "resilience-audit" ? (
            <ResilienceMonitor />
          ) : reportView === "physical-inventory-summary" ||
            reportView === "comprehensive-inventory-summary" ? (
            <div className="space-y-8 animate-in fade-in duration-300">
              {Object.keys(summaryReportsData.grouped).length === 0 ? (
                <div
                  role="status"
                  className="flex flex-col items-center justify-center p-20 bg-slate-50/55 dark:bg-slate-950/20 rounded-[2.2rem] border border-dashed border-slate-200 dark:border-slate-800"
                >
                  <Warehouse className="text-slate-300 dark:text-slate-700 w-16 h-16 mb-4 animate-bounce" />
                  <p className="text-slate-500 dark:text-slate-400 font-extrabold text-base">
                    لا توجد بيانات متاحة للتقرير
                  </p>
                  <p className="text-slate-400 dark:text-slate-500 text-xs font-bold mt-1">
                    جرب تعديل خيارات البحث أو الفلاتر المحددة
                  </p>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 shadow-md rounded-3xl overflow-hidden transition-all duration-300">
                  {/* Summary Overview Header Panel */}
                  <div className="bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-950 dark:to-slate-900 p-5 px-6 flex flex-wrap items-center justify-between gap-4 text-white">
                    <div className="flex items-center gap-3">
                      <span className="w-2.5 h-7 bg-blue-500 rounded-full animate-pulse" />
                      <h3 className="text-lg font-black tracking-normal text-white">
                        {reportView === "physical-inventory-summary"
                          ? "ملخص الجرد الفعلي الموحد لجميع الفئات بالمعرض"
                          : "ملخص المخزون الشامل للفئات والساحات الموحد"}
                      </h3>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-black">
                      <span className="bg-white/10 text-white px-4 py-1.5 rounded-xl backdrop-blur-md border border-white/10">
                        إجمالي المركبات العامة: {summaryReportsData.totalCount}{" "}
                        سيارة
                      </span>
                    </div>
                  </div>

                  <div className="p-6 bg-[#f8fafc] dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-6 overflow-x-auto">
                    {/* In Transfer Cars Statistical Card */}
                    {transferStats.total > 0 && (
                      <div className="p-5 bg-gradient-to-br from-amber-50 to-amber-100/30 dark:from-slate-900/40 dark:to-amber-950/10 rounded-2xl border border-amber-200/60 dark:border-amber-900/40 shadow-sm space-y-4 animate-in fade-in duration-300">
                        <div className="flex items-center gap-2 pb-2 border-b border-amber-200/50 dark:border-amber-900/30">
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                          </span>
                          <h4 className="text-sm font-black text-amber-850 dark:text-amber-400">
                            📊 سيارات تم تحويلها بخطاب (تُعامل معاملة المباع
                            وتدرج في تقارير الخروج الكاملة)
                          </h4>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs font-bold text-slate-700 dark:text-slate-300">
                          {/* 1. Total Transferred */}
                          <div className="bg-white/80 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-100 dark:border-slate-850 flex flex-col justify-between shadow-xs">
                            <span className="text-[10px] text-slate-400 font-extrabold">
                              إجمالي السيارات المحولة
                            </span>
                            <span className="text-xl font-extrabold text-amber-600 font-mono mt-1">
                              {transferStats.total} سيارة
                            </span>
                          </div>

                          {/* 2. By Brand */}
                          <div className="bg-white/80 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-100 dark:border-slate-850 space-y-1 shadow-xs">
                            <span className="text-[10px] text-slate-400 font-extrabold block">
                              حسب الماركة
                            </span>
                            <div className="space-y-0.5 max-h-16 overflow-y-auto pr-1">
                              {Object.entries(transferStats.byBrand).map(
                                ([brand, count]) => (
                                  <div
                                    key={brand}
                                    className="flex justify-between text-[10px] text-slate-600 dark:text-slate-350"
                                  >
                                    <span>{brand}</span>
                                    <span className="font-mono text-amber-600">
                                      ({count})
                                    </span>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>

                          {/* 3. By Category */}
                          <div className="bg-white/80 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-100 dark:border-slate-850 space-y-1 shadow-xs">
                            <span className="text-[10px] text-slate-400 font-extrabold block">
                              حسب الموديل
                            </span>
                            <div className="space-y-0.5 max-h-16 overflow-y-auto pr-1">
                              {Object.entries(transferStats.byModel).map(
                                ([model, count]) => (
                                  <div
                                    key={model}
                                    className="flex justify-between text-[10px] text-slate-600 dark:text-slate-350"
                                  >
                                    <span className="whitespace-normal break-words leading-tight">
                                      {model}
                                    </span>
                                    <span className="font-mono text-amber-600">
                                      ({count})
                                    </span>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>

                          {/* 4. By Company */}
                          <div className="bg-white/80 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-100 dark:border-slate-850 space-y-1 shadow-xs">
                            <span className="text-[10px] text-slate-400 font-extrabold block">
                              حسب الشركة المستقبلة
                            </span>
                            <div className="space-y-0.5 max-h-16 overflow-y-auto pr-1">
                              {Object.entries(transferStats.byCompany).map(
                                ([company, count]) => (
                                  <div
                                    key={company}
                                    className="flex justify-between text-[10px] text-slate-600 dark:text-slate-350"
                                  >
                                    <span className="whitespace-normal break-words leading-tight">
                                      {company}
                                    </span>
                                    <span className="font-mono text-amber-600">
                                      ({count})
                                    </span>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>

                          {/* 5. By Yard */}
                          <div className="bg-white/80 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-100 dark:border-slate-850 space-y-1 shadow-xs">
                            <span className="text-[10px] text-slate-400 font-extrabold block">
                              حسب الساحة الجارية
                            </span>
                            <div className="space-y-0.5 max-h-16 overflow-y-auto pr-1">
                              {Object.entries(transferStats.byYard).map(
                                ([yard, count]) => (
                                  <div
                                    key={yard}
                                    className="flex justify-between text-[10px] text-slate-600 dark:text-slate-350"
                                  >
                                    <span className="whitespace-normal break-words leading-tight">
                                      {yard}
                                    </span>
                                    <span className="font-mono text-amber-600">
                                      ({count})
                                    </span>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Individual Brand Matrix Blocks stacked as a single table starting with the header */}
                    <div className="w-full rounded-xl border border-slate-400 overflow-hidden shadow-sm bg-white dark:bg-slate-900 divide-y-2 divide-slate-400">
                      {/* Unified Header as the first section of the table block */}
                      <div className="w-full overflow-hidden">
                        <div className="overflow-x-auto custom-scrollbar w-full">
                        <table className="w-full text-center border-collapse text-xs font-bold font-sans">
                          <tbody>
                            {/* Row 1: Title */}
                            <tr className="bg-[#475569] text-white">
                              <td
                                colSpan={3}
                                className="py-3 px-4 font-black text-center text-base border-b border-slate-400"
                              >
                                {reportView === "physical-inventory-summary"
                                  ? "ملخص الجرد الفعلي الفئوي بالمعرض"
                                  : "ملخص المخزون الشامل للفئات والساحات الموحد"}
                              </td>
                            </tr>
                            {/* Row 2: Stats Grid */}
                            <tr className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold divide-x divide-slate-400 divide-x-reverse">
                              <td className="py-2.5 px-4 text-center">
                                إجمالي الماركات:{" "}
                                {Object.keys(summaryReportsData.grouped).length}{" "}
                                ماركة
                              </td>
                              <td className="py-2.5 px-4 text-center border-r border-slate-400">
                                إجمالي المركبات العامة:{" "}
                                {summaryReportsData.totalCount} سيارة
                              </td>
                              <td className="py-2.5 px-4 text-center border-r border-slate-400">
                                التاريخ:{" "}
                                {endDate
                                  ? new Date(endDate).toLocaleDateString(
                                      "ar-EG",
                                    )
                                  : new Date().toLocaleDateString("ar-EG")}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        </div>
                      </div>

                      {displayBrands.map((brandName, bIdx) => {
                        const filteredCarsForBrand = (
                          summaryReportsData.filteredCars || []
                        ).filter(
                          (c: any) => getCleanBrandName(c.brand) === brandName,
                        );
                        const activeModelsSet = new Set(
                          filteredCarsForBrand.map((c: any) =>
                            getCleanModelForSummary(c.model, c),
                          ),
                        );
                        const models = (systemSchema[brandName] || []).filter(
                          (model) => activeModelsSet.has(model),
                        );
                        activeModelsSet.forEach((model) => {
                          if (!models.includes(model)) models.push(model);
                        });
                        if (models.length === 0) return null;

                        // Calculate brand total count based on current filtered dataset
                        const brandTotalCount = filteredCarsForBrand.length;

                        // Calculate counts for each model
                        const modelCounts = models.map((model) => {
                          return filteredCarsForBrand.filter(
                            (c: any) =>
                              getCleanModelForSummary(c.model, c) === model,
                          ).length;
                        });

                        return (
                          <div
                            key={brandName}
                            className="w-full overflow-hidden"
                          >
                            <div className="overflow-x-auto custom-scrollbar w-full">
                            <table className="w-full text-center border-collapse text-[9px] font-bold">
                              <tbody>
                                {/* Row 1: Brand name banner */}
                                <tr>
                                  {/* Middle cell: centered brand name. Spans models count + 1 (المجموع) */}
                                  <td
                                    colSpan={models.length + 1}
                                    className="bg-[#cbdcf0] text-slate-900 border border-slate-400 font-extrabold py-1 text-center text-[10px]"
                                  >
                                    {brandName}
                                  </td>
                                  {/* Far right: "الشركة" */}
                                  <td className="bg-[#8ba5bf] text-slate-900 border border-slate-400 font-extrabold py-1 text-center w-16 text-[10px]">
                                    الشركة
                                  </td>
                                </tr>

                                {/* Row 2: Header row with model names and "المجموع" */}
                                <tr className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                                  {/* "المجموع" on the left */}
                                  <td className="bg-[#cbdcf0] text-slate-900 border border-slate-400 font-black p-0.5 w-14 text-center text-[8.5px]">
                                    المجموع
                                  </td>
                                  {/* Models */}
                                  {models.map((model) => (
                                    <td
                                      key={model}
                                      className="border border-slate-400 p-0.5 text-center text-[8px] font-bold min-w-[50px] max-w-[80px] whitespace-normal break-words"
                                    >
                                      {model}
                                    </td>
                                  ))}
                                  {/* Merged Company Index on the far right. Spans row 2 and 3 */}
                                  <td
                                    rowSpan={2}
                                    className="bg-[#cbdcf0] text-slate-900 border border-slate-400 font-black text-[10px] align-middle text-center w-16"
                                  >
                                    {bIdx + 1}
                                  </td>
                                </tr>

                                {/* Row 3: Count row with count values */}
                                <tr className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                                  {/* Total count */}
                                  <td className="bg-[#f0f4f8] text-slate-950 border border-slate-400 font-black p-0.5 w-14 text-center text-[8.5px]">
                                    {brandTotalCount}
                                  </td>
                                  {/* Model counts */}
                                  {modelCounts.map((count, mIdx) => (
                                    <td
                                      key={mIdx}
                                      className="border border-slate-400 p-0.5 text-center font-black text-[8.5px]"
                                    >
                                      {count}
                                    </td>
                                  ))}
                                </tr>
                              </tbody>
                            </table>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Overall Total Row styled exactly as the image bottom line */}
                    <div className="w-full rounded-xl border border-slate-400 overflow-hidden shadow-sm mt-3">
                      <div className="overflow-x-auto custom-scrollbar w-full">
                      <table className="w-full text-center border-collapse text-xs font-bold">
                        <tbody>
                          <tr className="bg-[#cbdcf0] text-slate-900">
                            <td
                              className="p-1 px-3 text-center text-xs font-black border border-slate-400"
                              style={{ width: "65%" }}
                            >
                              {summaryReportsData.totalCount}
                            </td>
                            <td
                              className="p-1 px-3 text-center text-xs font-black bg-[#94a3b8] text-slate-950 border border-slate-400"
                              style={{ width: "35%" }}
                            >
                              المجموع الكلي للأصناف
                            </td>
                          </tr>
                          {reportView === "comprehensive-inventory-summary" && (
                            <tr className="bg-amber-500/10 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 border-t border-slate-400">
                              <td
                                className="p-1.5 px-3 text-center text-xs font-black border border-slate-400 text-amber-700 dark:text-amber-400"
                                style={{ width: "65%" }}
                              >
                                {
                                  cars.filter(
                                    (c) => c.status === CarStatus.IN_TRANSFER,
                                  ).length
                                }{" "}
                                سيارة
                              </td>
                              <td
                                className="p-1.5 px-3 text-center text-xs font-black bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-slate-400"
                                style={{ width: "35%" }}
                              >
                                قيد التحويل (غير مدرج في المجاميع)
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Family-sized Yard Summary card for Report 2 */}
              {reportView === "comprehensive-inventory-summary" &&
                Object.keys(summaryReportsData.grouped).length > 0 && (
                  <div
                    id="comprehensive-yard-totals-card"
                    className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 shadow-md rounded-3xl overflow-hidden mt-8 max-w-sm ml-auto mr-0 print:break-inside-avoid"
                  >
                    <div className="bg-gradient-to-r from-slate-700 to-slate-800 dark:from-slate-950 dark:to-slate-900 p-4 text-white">
                      <h4 className="text-xs font-black flex items-center gap-2">
                        📊 إجمالي المخزون الشامل للساحات
                      </h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800">
                            <th className="p-3 font-extrabold">الساحة</th>
                            <th className="p-3 text-center font-extrabold max-w-[120px]">
                              العدد / الكمية
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {Object.entries(
                            summaryReportsData.overallYardTotals,
                          ).map(([yName, yCount]) => (
                            <tr key={yName} className="hover:bg-slate-50/40">
                              <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                                {yName}
                              </td>
                              <td className="p-3 text-center font-black text-blue-600 dark:text-blue-400">
                                {yCount} سيارة
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-slate-50 dark:bg-slate-950/50 font-black">
                            <td className="p-3 text-slate-700 dark:text-slate-200 font-extrabold">
                              المجموع الكلي
                            </td>
                            <td className="p-3 text-center text-blue-600 dark:text-blue-450 font-black">
                              {summaryReportsData.totalCount} سيارة
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              {renderInTransferCarsReportSection()}
            </div>
          ) : reportView === "monthly" ||
            reportView === "monthly-entry" ||
            reportView === "monthly-exit" ? (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2">
                {/* Card 1: Main Stats depends on active movement type */}
                {monthlyMovementType === "IN" ? (
                  <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border-2 border-emerald-100 dark:border-emerald-900/40 p-6 rounded-2xl flex items-center justify-between shadow-sm">
                    <div className="space-y-1">
                      <span className="text-xs font-black text-emerald-600 dark:text-emerald-450">
                        إجمالي الوحدات الداخلة
                      </span>
                      <h4 className="text-3xl font-extrabold text-emerald-800 dark:text-emerald-200">
                        {monthlyStats.entries.length}{" "}
                        <span className="text-sm font-bold">مركبة</span>
                      </h4>
                      <p className="text-[10px] text-slate-400 font-bold">
                        لشهر {arabicMonths[selectedMonth]} {selectedYear}
                      </p>
                    </div>
                    <div className="p-4 bg-emerald-500 text-white rounded-xl">
                      <ArrowDown size={24} />
                    </div>
                  </div>
                ) : (
                  <div className="bg-blue-50/60 dark:bg-blue-950/20 border-2 border-blue-100 dark:border-blue-900/40 p-6 rounded-2xl flex items-center justify-between shadow-sm">
                    <div className="space-y-1">
                      <span className="text-xs font-black text-blue-600 dark:text-blue-400">
                        إجمالي الوحدات الخارجة
                      </span>
                      <h4 className="text-3xl font-extrabold text-blue-800 dark:text-blue-200">
                        {monthlyStats.exits.length}{" "}
                        <span className="text-sm font-bold">مركبة</span>
                      </h4>
                      <p className="text-[10px] text-slate-400 font-bold">
                        لشهر {arabicMonths[selectedMonth]} {selectedYear}
                      </p>
                    </div>
                    <div className="p-4 bg-blue-500 text-white rounded-xl">
                      <ArrowUp size={24} />
                    </div>
                  </div>
                )}

                {/* Card 2: Distinct Brands & Types details depending on active movement type */}
                <div className="bg-slate-50/60 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl flex items-center justify-between shadow-sm">
                  {(() => {
                    const listToUse =
                      monthlyMovementType === "IN"
                        ? monthlyStats.entries
                        : monthlyStats.exits;
                    const brandsSet = new Set(
                      listToUse.map((car) => getCleanBrandName(car.brand)),
                    );
                    const modelsSet = new Set(
                      listToUse.map(
                        (car) => `${getCleanBrandName(car.brand)}-${car.model}`,
                      ),
                    );
                    return (
                      <div className="space-y-1 w-full flex justify-around">
                        <div className="text-center">
                          <span className="text-xs font-black text-slate-500 dark:text-slate-400">
                            عدد الماركات النشطة
                          </span>
                          <h4 className="text-2xl font-black text-slate-800 dark:text-slate-200">
                            {brandsSet.size}
                          </h4>
                        </div>
                        <div className="border-l border-slate-200 dark:border-slate-750 h-10 self-center"></div>
                        <div className="text-center">
                          <span className="text-xs font-black text-slate-500 dark:text-slate-400">
                            تنوع الفئات والطرازات
                          </span>
                          <h4 className="text-2xl font-black text-slate-800 dark:text-slate-200">
                            {modelsSet.size}
                          </h4>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* SECTION: Movement details */}
              <section className="space-y-4">
                <div
                  className={`flex items-center justify-between gap-3 border-r-4 ${monthlyMovementType === "IN" ? "border-emerald-500" : "border-blue-500"} pr-4 print:border-none`}
                >
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      {monthlyMovementType === "IN"
                        ? `مركبات دخلت المخزون (الوارد) (${monthlyStats.entries.length})`
                        : `مركبات خرجت من المخزون (الصادر) (${monthlyStats.exits.length})`}
                    </h3>
                  </div>
                  {canExport && (
                    <button
                      onClick={() => {
                        if (monthlyMovementType === "IN") {
                          exportToExcel(
                            monthlyStats.entries,
                            `مركبات دخلت المخزون لشهر ${selectedMonth + 1}`,
                          );
                        } else {
                          exportToExcel(
                            monthlyStats.exits,
                            `مركبات خرجت من المخزون لشهر ${selectedMonth + 1}`,
                          );
                        }
                      }}
                      className="print:hidden px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl flex items-center gap-1.5 text-xs font-black shadow-sm transition-all hover:scale-105 cursor-pointer"
                      title="تصدير هذا الجزء بمفرده إلى Excel"
                    >
                      <FileSpreadsheet size={15} />
                      <span>
                        {monthlyMovementType === "IN"
                          ? "تصدير وارد الشهر Excel"
                          : "تصدير صادر الشهر Excel"}
                      </span>
                    </button>
                  )}
                </div>

                {groupingMode === "grouped" ? (
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                    <table className="w-full text-center border-collapse bg-white dark:bg-slate-900">
                      <thead>
                        <tr className="bg-slate-900 text-white text-[11px] font-sans">
                          <th
                            className="p-3 w-[47px]"
                            style={{
                              width: "47px",
                              minWidth: "47px",
                              maxWidth: "47px",
                            }}
                          >
                            م
                          </th>
                          <th className="p-3" style={{ width: "35%" }}>
                            الماركة
                          </th>
                          <th className="p-3" style={{ width: "37%" }}>
                            الموديل
                          </th>
                          <th className="p-3" style={{ width: "20%" }}>
                            {monthlyMovementType === "IN"
                              ? "إجمالي الوحدات الداخلة"
                              : "إجمالي الوحدات الخارجة"}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const groups: Array<{
                            brand: string;
                            model: string;
                            count: number;
                          }> = [];
                          const brandMap: Record<
                            string,
                            Record<string, number>
                          > = {};
                          const listToUse =
                            monthlyMovementType === "IN"
                              ? monthlyStats.entries
                              : monthlyStats.exits;
                          listToUse.forEach((car) => {
                            const b = getCleanBrandName(car.brand);
                            const m = car.model || "طراز عام";
                            if (!brandMap[b]) brandMap[b] = {};
                            brandMap[b][m] = (brandMap[b][m] || 0) + 1;
                          });

                          Object.entries(brandMap).forEach(
                            ([brand, models]) => {
                              Object.entries(models).forEach(
                                ([model, count]) => {
                                  groups.push({ brand, model, count });
                                },
                              );
                            },
                          );

                          return groups.length > 0 ? (
                            groups.map((g, idx) => (
                              <tr
                                key={idx}
                                className="text-xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30"
                              >
                                <td className="p-3 border border-slate-200 dark:border-slate-850 font-bold">
                                  {idx + 1}
                                </td>
                                <td className="p-3 border border-slate-200 dark:border-slate-850 font-black text-slate-800 dark:text-slate-200">
                                  {g.brand}
                                </td>
                                <td className="p-3 border border-slate-200 dark:border-slate-850 font-bold text-slate-700 dark:text-slate-350">
                                  {g.model}
                                </td>
                                <td
                                  className={`p-3 border border-slate-200 dark:border-slate-850 ${monthlyMovementType === "IN" ? "text-emerald-600 dark:text-emerald-450" : "text-blue-600 dark:text-blue-450"} font-extrabold text-sm`}
                                >
                                  {g.count} مركبة
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan={4}
                                className="p-10 text-slate-400 font-bold italic"
                              >
                                {monthlyMovementType === "IN"
                                  ? "لا توجد عمليات لدخول المخزون"
                                  : "لا توجد عمليات لخروج المخزون"}
                              </td>
                            </tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                    <table className="w-full text-center border-collapse bg-white dark:bg-slate-900">
                      <thead>
                        <tr className="bg-slate-900 text-white text-[9px]">
                          <th
                            style={{
                              width: "47px",
                              minWidth: "47px",
                              maxWidth: "47px",
                            }}
                            className="w-[47px]"
                          >
                            م
                          </th>
                          {activeColumns.map((col) => (
                            <th key={col.key} style={{ width: col.width }}>
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          let lastBrand = "";
                          let lastModel = "";
                          let lastAttribution = "";
                          const listToUse =
                            monthlyMovementType === "IN"
                              ? monthlyStats.entries
                              : monthlyStats.exits;
                          return listToUse.length > 0 ? (
                            listToUse.map((car, idx) => {
                              const cleanBrand = getCleanBrandName(car.brand);
                              const showBrandHeader = cleanBrand !== lastBrand;
                              if (showBrandHeader) {
                                lastBrand = cleanBrand;
                                lastModel = "";
                                lastAttribution = "";
                              }
                              const modelKey = getCleanModelKey(
                                car.model,
                              );
                              const showModelHeader = modelKey !== lastModel;
                              if (showModelHeader) {
                                lastModel = modelKey;
                                lastAttribution = "";
                              }
                              const attributionVal =
                                car.attributionSource || "عام / غير محدد";
                              const showAttributionHeader =
                                showModelHeader ||
                                attributionVal !== lastAttribution;
                              if (showAttributionHeader) {
                                lastAttribution = attributionVal;
                              }
                              const notForSale = isCarNotForSale(car);
                              const rowColorClass = notForSale
                                ? "bg-red-50 hover:bg-red-100 dark:bg-rose-950/20 text-red-900 dark:text-red-350 font-bold"
                                : "hover:bg-slate-50 dark:hover:bg-slate-800/30";
                              return (
                                <React.Fragment key={car.id}>
                                  {showBrandHeader && (
                                    <tr className="bg-slate-50 dark:bg-slate-950/60 border-y-2 border-slate-200/50 dark:border-slate-800/50">
                                      <td
                                        colSpan={activeColumns.length + 1}
                                        className="px-6 py-4 text-center"
                                      >
                                        <span className="text-md md:text-lg font-black text-blue-600 dark:text-blue-400 tracking-normal inline-block font-sans">
                                          🚘 {cleanBrand} 🚘
                                        </span>
                                      </td>
                                    </tr>
                                  )}
                                  {showModelHeader && (
                                    <tr className="bg-gray-100 dark:bg-gray-800 border-y border-slate-200 dark:border-slate-700">
                                      <td
                                        colSpan={activeColumns.length + 1}
                                        className="px-8 py-2 text-center"
                                      >
                                        <span className="text-sm md:text-md font-black text-black dark:text-white inline-block">
                                          {car.model || "عام"}
                                        </span>
                                      </td>
                                    </tr>
                                  )}
                                  {showAttributionHeader && (
                                    <tr className="bg-sky-50 dark:bg-sky-950/40 border-y border-sky-100 dark:border-sky-900/60">
                                      <td
                                        colSpan={activeColumns.length + 1}
                                        className="px-10 py-1.5 text-center"
                                      >
                                        <span className="text-[11px] font-extrabold text-sky-700 dark:text-sky-305 inline-block">
                                          {monthlyMovementType === "IN"
                                            ? "📥 الوارد والمصدر:"
                                            : "📤 تاريخ وتفاصيل الخروج:"}{" "}
                                          {attributionVal}
                                        </span>
                                      </td>
                                    </tr>
                                  )}
                                  <tr
                                    className={`text-xs transition-colors ${rowColorClass}`}
                                  >
                                    <td
                                      className="p-3.5 border border-slate-200 dark:border-slate-800 font-mono text-[13px] text-center font-bold text-slate-600 dark:text-slate-300 w-[47px] min-w-[47px] max-w-[47px]"
                                      style={{
                                        width: "47px",
                                        minWidth: "47px",
                                        maxWidth: "47px",
                                      }}
                                    >
                                      {idx + 1}
                                    </td>
                                    {activeColumns.map((col) => {
                                      let cellVal = getCellValue(car, col.key);
                                      if (
                                        notForSale &&
                                        (col.key === "notes" ||
                                          col.key === "car_condition" ||
                                          col.key === "exitNotes")
                                      ) {
                                        if (
                                          !cellVal.includes(
                                            "السياره غير معروضه للبيع",
                                          ) &&
                                          cellVal !== "السياره غير معروضه للبيع"
                                        ) {
                                          cellVal =
                                            cellVal && cellVal !== "-"
                                              ? `${cellVal} | السيارة غير معروضة للبيع`
                                              : "السيارة غير معروضة للبيع";
                                        }
                                      }
                                      const isLongText =
                                        col.key === "brand_model" ||
                                        col.key === "notes" ||
                                        col.key === "exitNotes" ||
                                        col.key === "car_condition" ||
                                        col.key.toLowerCase().includes("notes");
                                      return (
                                        <td
                                          key={col.key}
                                          className={`p-3.5 border border-slate-200 dark:border-slate-800 text-[13px] tracking-normal font-bold text-slate-800 dark:text-slate-100 ${
                                            isLongText
                                              ? "whitespace-normal break-words max-w-[220px] min-w-[160px]"
                                              : "whitespace-nowrap"
                                          }`}
                                        >
                                          {cellVal}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                </React.Fragment>
                              );
                            })
                          ) : (
                            <tr>
                              <td
                                colSpan={activeColumns.length + 1}
                                className="p-10 text-slate-400 font-bold italic text-center"
                              >
                                {monthlyMovementType === "IN"
                                  ? "لا توجد عمليات لدخول المخزون هذا الشهر"
                                  : "لا توجد عمليات لخروج المخزون هذا الشهر"}
                              </td>
                            </tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          ) : reportView === "daily-entry" ? (
            <div className="space-y-12">
              {/* Date Selector Header Card */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-850 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 print:hidden">
                <div className="border-r-4 border-emerald-500 pr-4">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                    <span className="text-2xl">📥</span>
                    تقرير دخول المركبات اليومي (الوارد)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">
                    اختر أي يوم لاستعراض المركبات التي دخلت المخزون وسجلت في
                    النظام خلال ذلك اليوم
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Preset quick buttons */}
                  <div className="flex gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                    <button
                      onClick={() =>
                        setDailyReportDate(
                          new Date().toISOString().split("T")[0],
                        )
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        dailyReportDate ===
                        new Date().toISOString().split("T")[0]
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-900"
                      }`}
                    >
                      اليوم
                    </button>
                    <button
                      onClick={() => {
                        const yesterday = new Date();
                        yesterday.setDate(yesterday.getDate() - 1);
                        setDailyReportDate(
                          yesterday.toISOString().split("T")[0],
                        );
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        dailyReportDate ===
                        new Date(Date.now() - 86400000)
                          .toISOString()
                          .split("T")[0]
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-900"
                      }`}
                    >
                      الأمس
                    </button>
                    <button
                      onClick={() => {
                        const beforeYesterday = new Date();
                        beforeYesterday.setDate(beforeYesterday.getDate() - 2);
                        setDailyReportDate(
                          beforeYesterday.toISOString().split("T")[0],
                        );
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        dailyReportDate ===
                        new Date(Date.now() - 172800000)
                          .toISOString()
                          .split("T")[0]
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-900"
                      }`}
                    >
                      قبل الأمس
                    </button>
                  </div>

                  {/* Date Input */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-slate-500 border-none">
                      تاريخ مخصص:
                    </span>
                    <input
                      type="date"
                      value={dailyReportDate}
                      onChange={(e) => {
                        if (e.target.value) setDailyReportDate(e.target.value);
                      }}
                      className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <section className="space-y-4">
                <div className="flex items-center justify-between gap-3 border-r-4 border-emerald-500 pr-4 print:border-none">
                  <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">
                    مركبات دخلت المخزون ليوم {dailyReportDate} (
                    {dailyStats.entries.length})
                  </h3>
                  {canExport && (
                    <button
                      onClick={() =>
                        exportToExcel(
                          dailyStats.entries,
                          `مركبات دخلت المخزون ليوم ${dailyReportDate}`,
                        )
                      }
                      className="print:hidden px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl flex items-center gap-1.5 text-xs font-black shadow-sm transition-all hover:scale-105 cursor-pointer"
                      title="تصدير هذا التقرير بمفرده إلى Excel"
                    >
                      <FileSpreadsheet size={15} />
                      <span>تصدير Excel بمفرده</span>
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto custom-scrollbar w-full">
                <table className="w-full text-center border-collapse bg-white dark:bg-slate-900">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[9px]">
                      <th
                        style={{
                          width: "47px",
                          minWidth: "47px",
                          maxWidth: "47px",
                        }}
                        className="w-[47px]"
                      >
                        م
                      </th>
                      {activeColumns.map((col) => (
                        <th key={col.key} style={{ width: col.width }}>
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let lastBrand = "";
                      let lastModel = "";
                      let lastAttribution = "";
                      return dailyStats.entries.length > 0 ? (
                        dailyStats.entries.map((car, idx) => {
                          const cleanBrand = getCleanBrandName(car.brand);
                          const showBrandHeader = cleanBrand !== lastBrand;
                          if (showBrandHeader) {
                            lastBrand = cleanBrand;
                            lastModel = ""; // reset model header on new brand group
                            lastAttribution = ""; // reset attribution
                          }
                          const modelKey = getCleanModelKey(
                            car.model,
                          );
                          const showModelHeader = modelKey !== lastModel;
                          if (showModelHeader) {
                            lastModel = modelKey;
                            lastAttribution = ""; // reset attribution on model change
                          }
                          const attributionVal =
                            car.attributionSource || "عام / غير محدد";
                          const showAttributionHeader =
                            showModelHeader ||
                            attributionVal !== lastAttribution;
                          if (showAttributionHeader) {
                            lastAttribution = attributionVal;
                          }
                          return (
                            <React.Fragment key={car.id}>
                              {showBrandHeader && (
                                <tr className="bg-slate-50 dark:bg-slate-950/60 border-y-2 border-slate-200/50 dark:border-slate-800/50">
                                  <td
                                    colSpan={activeColumns.length + 1}
                                    className="px-6 py-5 text-center"
                                  >
                                    <span className="text-lg md:text-xl font-black text-blue-600 dark:text-blue-400 tracking-normal uppercase inline-block font-sans">
                                      🚘 {cleanBrand} 🚘
                                    </span>
                                  </td>
                                </tr>
                              )}
                              {showModelHeader && (
                                <tr className="bg-gray-250 dark:bg-gray-750 border-y border-gray-350 dark:border-gray-600 shadow-sm">
                                  <td
                                    colSpan={activeColumns.length + 1}
                                    className="px-8 py-3.5 text-center"
                                  >
                                    <span className="text-[17px] md:text-[20px] font-black text-black dark:text-white tracking-normal inline-block">
                                      {car.model || "عام"}
                                    </span>
                                  </td>
                                </tr>
                              )}
                              {showAttributionHeader && (
                                <tr className="bg-sky-50 dark:bg-sky-950/40 border-y border-sky-100 dark:border-sky-900/60 shadow-sm">
                                  <td
                                    colSpan={activeColumns.length + 1}
                                    className="px-10 py-2.5 text-center"
                                  >
                                    <span className="text-[12px] font-extrabold text-sky-700 dark:text-sky-300 tracking-wide inline-block">
                                      📥 الوارد والمصدر: {attributionVal}
                                    </span>
                                  </td>
                                </tr>
                              )}
                              {(() => {
                                const notForSale = isCarNotForSale(car);
                                const rowColorClass = notForSale
                                  ? "bg-rose-50/70 hover:bg-rose-100/70 dark:bg-rose-955/35 dark:hover:bg-rose-900/40 text-rose-950 dark:text-rose-100 font-bold"
                                  : "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-800 dark:text-slate-100";
                                return (
                                  <tr
                                    className={`text-xs transition-colors ${rowColorClass}`}
                                  >
                                    <td
                                      className="p-3.5 border border-slate-200 dark:border-slate-800 font-mono text-[13px] text-center font-bold text-slate-600 dark:text-slate-300 w-[47px] min-w-[47px] max-w-[47px]"
                                      style={{
                                        width: "47px",
                                        minWidth: "47px",
                                        maxWidth: "47px",
                                      }}
                                    >
                                      {idx + 1}
                                    </td>
                                    {activeColumns.map((col) => {
                                      let cellVal = getCellValue(car, col.key);
                                      if (
                                        notForSale &&
                                        (col.key === "notes" ||
                                          col.key === "car_condition" ||
                                          col.key === "exitNotes")
                                      ) {
                                        if (
                                          !cellVal.includes(
                                            "السياره غير معروضه للبيع",
                                          ) &&
                                          cellVal !== "السياره غير معروضه للبيع"
                                        ) {
                                          cellVal =
                                            cellVal && cellVal !== "-"
                                              ? `${cellVal} |  السيارة غير معروضة للبيع`
                                              : "السيارة غير معروضة للبيع";
                                        }
                                      }
                                      const isLongText =
                                        col.key === "brand_model" ||
                                        col.key === "notes" ||
                                        col.key === "exitNotes" ||
                                        col.key === "car_condition" ||
                                        col.key.toLowerCase().includes("notes");
                                      return (
                                        <td
                                          key={col.key}
                                          className={`p-3.5 border border-slate-200 dark:border-slate-800 text-[13px] tracking-normal font-bold text-slate-800 dark:text-slate-100 ${
                                            isLongText
                                              ? "whitespace-normal break-words max-w-[220px] min-w-[160px]"
                                              : "whitespace-nowrap"
                                          }`}
                                        >
                                          {cellVal}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })()}
                            </React.Fragment>
                          );
                        })
                      ) : (
                        <tr>
                          <td
                            colSpan={activeColumns.length + 1}
                            className="p-10 text-slate-400 font-bold italic text-center"
                          >
                            لا توجد عمليات دخول مسجلة لهذا اليوم
                          </td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
                </div>
              </section>
            </div>
          ) : reportView === "daily-exit" ? (
            <div className="space-y-12">
              {/* Date Selector Header Card */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-850 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 print:hidden">
                <div className="border-r-4 border-rose-500 pr-4">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                    <span className="text-2xl">📤</span>
                    تقرير خروج المركبات اليومي (الصادر والمنصرف)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">
                    اختر أي يوم لاستعراض المركبات التي بيعت أو خرجت من المخزون
                    وسجلت في النظام خلال ذلك اليوم
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Preset quick buttons */}
                  <div className="flex gap-1 bg-slate-105 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                    <button
                      onClick={() =>
                        setDailyReportDate(
                          new Date().toISOString().split("T")[0],
                        )
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        dailyReportDate ===
                        new Date().toISOString().split("T")[0]
                          ? "bg-rose-600 text-white shadow-sm"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-900"
                      }`}
                    >
                      اليوم
                    </button>
                    <button
                      onClick={() => {
                        const yesterday = new Date();
                        yesterday.setDate(yesterday.getDate() - 1);
                        setDailyReportDate(
                          yesterday.toISOString().split("T")[0],
                        );
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        dailyReportDate ===
                        new Date(Date.now() - 86400000)
                          .toISOString()
                          .split("T")[0]
                          ? "bg-rose-600 text-white shadow-sm"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-900"
                      }`}
                    >
                      الأمس
                    </button>
                    <button
                      onClick={() => {
                        const beforeYesterday = new Date();
                        beforeYesterday.setDate(beforeYesterday.getDate() - 2);
                        setDailyReportDate(
                          beforeYesterday.toISOString().split("T")[0],
                        );
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        dailyReportDate ===
                        new Date(Date.now() - 172800000)
                          .toISOString()
                          .split("T")[0]
                          ? "bg-rose-600 text-white shadow-sm"
                          : "text-slate-605 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-900"
                      }`}
                    >
                      قبل الأمس
                    </button>
                  </div>

                  {/* Date Input */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-slate-500 border-none">
                      تاريخ مخصص:
                    </span>
                    <input
                      type="date"
                      value={dailyReportDate}
                      onChange={(e) => {
                        if (e.target.value) setDailyReportDate(e.target.value);
                      }}
                      className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <section className="space-y-4">
                <div className="flex items-center justify-between gap-3 border-r-4 border-rose-500 pr-4 print:border-none">
                  <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">
                    مركبات بيعت/خرجت ليوم {dailyReportDate} (
                    {dailyStats.exits.length})
                  </h3>
                  {canExport && (
                    <button
                      onClick={() =>
                        exportToExcel(
                          dailyStats.exits,
                          `مركبات بيعت أو خرجت ليوم ${dailyReportDate}`,
                        )
                      }
                      className="print:hidden px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl flex items-center gap-1.5 text-xs font-black shadow-sm transition-all hover:scale-105 cursor-pointer"
                      title="تصدير هذا التقرير بمفرده إلى Excel"
                    >
                      <FileSpreadsheet size={15} />
                      <span>تصدير Excel بمفرده</span>
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto custom-scrollbar w-full">
                <table className="w-full text-center border-collapse bg-white dark:bg-slate-900">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[9px]">
                      <th
                        style={{
                          width: "47px",
                          minWidth: "47px",
                          maxWidth: "47px",
                        }}
                        className="w-[47px]"
                      >
                        م
                      </th>
                      {activeColumns.map((col) => (
                        <th key={col.key} style={{ width: col.width }}>
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let lastBrand = "";
                      let lastModel = "";
                      let lastAttribution = "";
                      return dailyStats.exits.length > 0 ? (
                        dailyStats.exits.map((car, idx) => {
                          const cleanBrand = getCleanBrandName(car.brand);
                          const showBrandHeader = cleanBrand !== lastBrand;
                          if (showBrandHeader) {
                            lastBrand = cleanBrand;
                            lastModel = ""; // reset model header on new brand group
                            lastAttribution = ""; // reset attribution
                          }
                          const modelKey = getCleanModelKey(
                            car.model,
                          );
                          const showModelHeader = modelKey !== lastModel;
                          if (showModelHeader) {
                            lastModel = modelKey;
                            lastAttribution = ""; // reset attribution on model change
                          }
                          const attributionVal =
                            car.attributionSource || "عام / غير محدد";
                          const showAttributionHeader =
                            showModelHeader ||
                            attributionVal !== lastAttribution;
                          if (showAttributionHeader) {
                            lastAttribution = attributionVal;
                          }
                          return (
                            <React.Fragment key={car.id}>
                              {showBrandHeader && (
                                <tr className="bg-slate-50 dark:bg-slate-950/60 border-y-2 border-slate-200/50 dark:border-slate-800/50">
                                  <td
                                    colSpan={activeColumns.length + 1}
                                    className="px-6 py-5 text-center"
                                  >
                                    <span className="text-lg md:text-xl font-black text-blue-600 dark:text-blue-400 tracking-normal uppercase inline-block font-sans">
                                      🚘 {cleanBrand} 🚘
                                    </span>
                                  </td>
                                </tr>
                              )}
                              {showModelHeader && (
                                <tr className="bg-gray-250 dark:bg-gray-750 border-y border-gray-350 dark:border-gray-600 shadow-sm">
                                  <td
                                    colSpan={activeColumns.length + 1}
                                    className="px-8 py-3.5 text-center"
                                  >
                                    <span className="text-[17px] md:text-[20px] font-black text-black dark:text-white tracking-normal inline-block">
                                      {car.model || "عام"}
                                    </span>
                                  </td>
                                </tr>
                              )}
                              {showAttributionHeader && (
                                <tr className="bg-sky-50 dark:bg-sky-950/40 border-y border-sky-100 dark:border-sky-900/60 shadow-sm">
                                  <td
                                    colSpan={activeColumns.length + 1}
                                    className="px-10 py-2.5 text-center"
                                  >
                                    <span className="text-[12px] font-extrabold text-sky-700 dark:text-sky-300 tracking-wide inline-block">
                                      📥 الوارد والمصدر: {attributionVal}
                                    </span>
                                  </td>
                                </tr>
                              )}
                              {(() => {
                                const notForSale = isCarNotForSale(car);
                                const rowColorClass = notForSale
                                  ? "bg-rose-50/70 hover:bg-rose-100/70 dark:bg-rose-955/35 dark:hover:bg-rose-900/40 text-rose-950 dark:text-rose-100 font-bold"
                                  : "bg-white dark:bg-slate-900 hover:bg-slate-55 dark:hover:bg-slate-800/50 text-slate-800 dark:text-slate-100";
                                return (
                                  <tr
                                    className={`text-xs transition-colors ${rowColorClass}`}
                                  >
                                    <td
                                      className="p-3.5 border border-slate-200 dark:border-slate-800 font-mono text-[13px] text-center font-bold text-slate-600 dark:text-slate-300 w-[47px] min-w-[47px] max-w-[47px]"
                                      style={{
                                        width: "47px",
                                        minWidth: "47px",
                                        maxWidth: "47px",
                                      }}
                                    >
                                      {idx + 1}
                                    </td>
                                    {activeColumns.map((col) => {
                                      let cellVal = getCellValue(car, col.key);
                                      if (
                                        notForSale &&
                                        (col.key === "notes" ||
                                          col.key === "car_condition" ||
                                          col.key === "exitNotes")
                                      ) {
                                        if (
                                          !cellVal.includes(
                                            "السياره غير معروضه للبيع",
                                          ) &&
                                          cellVal !== "السياره غير معروضه للبيع"
                                        ) {
                                          cellVal =
                                            cellVal && cellVal !== "-"
                                              ? `${cellVal} |  السيارة غير معروضة للبيع`
                                              : "السيارة غير معروضة للبيع";
                                        }
                                      }
                                      const isLongText =
                                        col.key === "brand_model" ||
                                        col.key === "notes" ||
                                        col.key === "exitNotes" ||
                                        col.key === "car_condition" ||
                                        col.key.toLowerCase().includes("notes");
                                      return (
                                        <td
                                          key={col.key}
                                          className={`p-3.5 border border-slate-200 dark:border-slate-800 text-[13px] tracking-normal font-bold text-slate-800 dark:text-slate-100 ${
                                            isLongText
                                              ? "whitespace-normal break-words max-w-[220px] min-w-[160px]"
                                              : "whitespace-nowrap"
                                          }`}
                                        >
                                          {cellVal}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })()}
                            </React.Fragment>
                          );
                        })
                      ) : (
                        <tr>
                          <td
                            colSpan={activeColumns.length + 1}
                            className="p-10 text-slate-400 font-bold italic text-center"
                          >
                            لا توجد عمليات خروج مسجلة لهذا اليوم
                          </td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
                </div>
              </section>
            </div>
          ) : reportView === "daily-summary" ? (
            <div className="space-y-8 text-slate-900 dark:text-slate-100 pb-16">
              {/* Header Selector Card with premium quick dates */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-850 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6 print:hidden">
                <div className="border-r-4 border-blue-600 pr-4">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                    <span className="text-2.5xl">📋</span>
                    تقرير ملخص حركة المخزون اليومية (دخول وخروج السيارات)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">
                    لوحة الحركة الفورية المقسمة لبيان دخول ومغادرة المركبات عن
                    اليوم المحدد بالتفصيل والعدد التراكمي
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  {/* Preset quick buttons */}
                  <div className="flex gap-1 bg-slate-105 p-1 rounded-xl border border-slate-200">
                    <button
                      onClick={() =>
                        setDailyReportDate(
                          new Date().toISOString().split("T")[0],
                        )
                      }
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        dailyReportDate ===
                        new Date().toISOString().split("T")[0]
                          ? "bg-blue-600 text-white shadow-md"
                          : "text-slate-605 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-900"
                      }`}
                    >
                      اليوم
                    </button>
                    <button
                      onClick={() =>
                        setDailyReportDate(
                          new Date(Date.now() - 86400000)
                            .toISOString()
                            .split("T")[0],
                        )
                      }
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        dailyReportDate ===
                        new Date(Date.now() - 86400000)
                          .toISOString()
                          .split("T")[0]
                          ? "bg-blue-600 text-white shadow-md"
                          : "text-slate-605 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-900"
                      }`}
                    >
                      الأمس
                    </button>
                    <button
                      onClick={() =>
                        setDailyReportDate(
                          new Date(Date.now() - 172800000)
                            .toISOString()
                            .split("T")[0],
                        )
                      }
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        dailyReportDate ===
                        new Date(Date.now() - 172800000)
                          .toISOString()
                          .split("T")[0]
                          ? "bg-blue-600 text-white shadow-md"
                          : "text-slate-605 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-900"
                      }`}
                    >
                      قبل الأمس
                    </button>
                  </div>

                  {/* Manual Date Input */}
                  <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
                    <Calendar size={14} className="text-slate-400" />
                    <input
                      type="date"
                      value={dailyReportDate}
                      onChange={(e) => setDailyReportDate(e.target.value)}
                      className="bg-transparent border-0 text-xs font-bold outline-none text-slate-800 dark:text-slate-200 focus:ring-0 p-0 cursor-pointer"
                    />
                  </div>

                  {canExport && (
                    <button
                      onClick={() =>
                        exportToExcel(undefined, "ملخص_حركة_المخزون")
                      }
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-2 transition-transform hover:scale-[1.02] cursor-pointer"
                      title="تصدير ملخص حركة المخزون لهذا اليوم إلى ملف Excel"
                    >
                      <FileSpreadsheet size={14} />
                      تصدير Excel 📥
                    </button>
                  )}
                </div>
              </div>

              {/* Day Quick Summary Headline Widget */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 dark:from-emerald-950/20 dark:to-slate-900 p-5 rounded-3xl border border-emerald-150/60 dark:border-emerald-900/30 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-450 font-extrabold uppercase tracking-normal block">
                      إجمالي سيارات الدخول اليوم
                    </span>
                    <h4 className="text-2xl font-black text-emerald-800 dark:text-emerald-300 mt-1">
                      {dailyStats.entries.length} سيارات واردة
                    </h4>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-650 dark:text-emerald-400">
                    <ArrowUp size={22} className="stroke-[2.5]" />
                  </div>
                </div>

                <div className="bg-gradient-to-br from-rose-50 to-rose-100/40 dark:from-rose-955/20 dark:to-slate-900 p-5 rounded-3xl border border-rose-154/60 dark:border-rose-955/30 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-rose-700 dark:text-rose-455 font-extrabold uppercase tracking-normal block">
                      إجمالي سيارات الخروج اليوم
                    </span>
                    <h4 className="text-2xl font-black text-rose-800 dark:text-rose-300 mt-1">
                      {dailyStats.exits.length} سيارات صادرة
                    </h4>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 flex items-center justify-center text-rose-650 dark:text-rose-455">
                    <ArrowDown size={22} className="stroke-[2.5]" />
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-blue-100/30 dark:from-blue-955/15 dark:to-slate-900 p-5 rounded-3xl border border-blue-150/40 dark:border-blue-900/30 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-blue-700 dark:text-blue-455 font-extrabold uppercase tracking-normal block">
                      اليوم المختار للتقرير
                    </span>
                    <h4 className="text-xl font-mono font-black text-blue-800 dark:text-blue-300 mt-1.5">
                      {dailyReportDate}
                    </h4>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center text-blue-650 dark:text-blue-400">
                    <Calendar size={20} />
                  </div>
                </div>
              </div>

              {/* Two-section split dashboards for entry and exits */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                {/* القسم الأول: دخول السيارات (الدخول اليومي) */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-emerald-100 dark:border-emerald-950/40 shadow-xl overflow-hidden">
                  <div className="bg-emerald-600/95 dark:bg-emerald-950 text-white px-6 py-5 flex items-center justify-between">
                    <div>
                      <h4 className="text-md font-black flex items-center gap-2">
                        <span>📥</span> قسم الدخول اليومي (الوارد)
                      </h4>
                      <p className="text-[10px] text-emerald-100 dark:text-slate-400 font-bold mt-1">
                        السيارات التي دخلت المخزون وسجلت في هذا التاريخ
                      </p>
                    </div>
                    <span className="bg-emerald-500/25 border border-emerald-400 px-3.5 py-1.5 rounded-xl font-mono text-xs font-black">
                      عدد: {dailyStats.entries.length} سيارات
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 text-[11px] font-black text-slate-500 dark:text-slate-400 h-11">
                          <th className="px-4 py-2 text-center w-[47px] min-w-[47px] max-w-[47px] border-b border-slate-100 dark:border-slate-800">
                            م
                          </th>
                          <th className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                            تفاصيل المركبة
                          </th>
                          <th className="px-4 py-2 text-center w-36 border-b border-slate-100 dark:border-slate-800">
                            رقم الهيكل VIN
                          </th>
                          <th className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                            المواصفات / اللون والملاحظات
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100/70 dark:divide-slate-800/60 text-[11px]">
                        {dailyStats.entries.length > 0 ? (
                          dailyStats.entries.map((car, idx) => {
                            const isTr =
                              Boolean((car as any).isTransfer) ||
                              Boolean(car.transferNo);
                            return (
                              <tr
                                key={car.id || idx}
                                className="hover:bg-slate-50/45 dark:hover:bg-slate-850/20 transition-colors"
                              >
                                <td
                                  className="px-4 py-4 text-center font-extrabold text-slate-450 font-mono w-[47px] min-w-[47px] max-w-[47px]"
                                  style={{
                                    width: "47px",
                                    minWidth: "47px",
                                    maxWidth: "47px",
                                  }}
                                >
                                  {idx + 1}
                                </td>
                                <td className="px-4 py-4">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-extrabold text-slate-900 dark:text-emerald-400 text-xs">
                                      {formatVehicleDisplay(car)}
                                    </span>
                                    {isTr && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-700">
                                        <span>📥</span>
                                        <span>تحويل وارد</span>
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-400 block mt-0.5">
                                    سنة الصنع: {car.year || "-"}
                                  </span>
                                </td>
                                <td className="px-4 py-4 text-center">
                                  <span className="font-mono text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 font-bold tracking-wide block select-all">
                                    {car.vin}
                                  </span>
                                </td>
                                <td className="px-4 py-4 space-y-1">
                                  {car.color && (
                                    <span className="inline-block bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md text-[10px] font-black text-slate-700 dark:text-slate-300">
                                      اللون: {car.color}
                                    </span>
                                  )}
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-sans">
                                    {car.notes || (
                                      <span className="text-slate-400 italic">
                                        لا توجد ملاحظات وصول
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td
                              colSpan={4}
                              className="px-6 py-14 text-center text-slate-400 dark:text-slate-550 italic"
                            >
                              <div className="text-xl mb-2">ℹ️</div>
                              لا توجد سيارات واردة مسجلة في هذا التاريخ.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-950 p-4 border-t border-slate-100 dark:border-slate-850 text-emerald-800 dark:text-emerald-400 font-black text-xs text-left">
                    إجمالي الدخول:{" "}
                    <span className="text-sm font-mono">
                      {dailyStats.entries.length}
                    </span>{" "}
                    سيارات واردة معتمدة
                  </div>
                </div>

                {/* القسم الثاني: خروج السيارات (الخروج اليومي) */}
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-rose-100 dark:border-rose-955/40 shadow-xl overflow-hidden">
                  <div className="bg-rose-600/95 dark:bg-rose-950 text-white px-6 py-5 flex items-center justify-between">
                    <div>
                      <h4 className="text-md font-black flex items-center gap-2">
                        <span>📤</span> قسم الخروج اليومي (الصادر)
                      </h4>
                      <p className="text-[10px] text-rose-100 dark:text-slate-400 font-bold mt-1">
                        السيارات التي تم تسليمها أو خرجت من الصالة في هذا
                        التاريخ
                      </p>
                    </div>
                    <span className="bg-rose-500/25 border border-rose-450 px-3.5 py-1.5 rounded-xl font-mono text-xs font-black">
                      عدد: {dailyStats.exits.length} سيارات
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-850 text-[11px] font-black text-slate-500 dark:text-slate-400 h-11">
                          <th className="px-4 py-2 text-center w-[47px] min-w-[47px] max-w-[47px] border-b border-slate-100 dark:border-slate-850">
                            م
                          </th>
                          <th className="px-4 py-2 border-b border-slate-100 dark:border-slate-850">
                            تفاصيل المركبة الخارجة
                          </th>
                          <th className="px-4 py-2 text-center w-36 border-b border-slate-100 dark:border-slate-850">
                            رقم الهيكل VIN
                          </th>
                          <th className="px-4 py-2 border-b border-slate-100 dark:border-slate-850">
                            البائع / المستلم وتفاصيل الصرف
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100/70 dark:divide-slate-800/60 text-[11px]">
                        {dailyStats.exits.length > 0 ? (
                          dailyStats.exits.map((car, idx) => (
                            <tr
                              key={car.id || idx}
                              className="hover:bg-slate-50/45 dark:hover:bg-slate-850/20 transition-colors"
                            >
                              <td
                                className="px-4 py-4 text-center font-extrabold text-slate-450 font-mono w-[47px] min-w-[47px] max-w-[47px]"
                                style={{
                                  width: "47px",
                                  minWidth: "47px",
                                  maxWidth: "47px",
                                }}
                              >
                                {idx + 1}
                              </td>
                              <td className="px-4 py-4">
                                <span className="font-extrabold text-slate-900 dark:text-rose-400 block text-xs">
                                  {formatVehicleDisplay(car)}
                                </span>
                                <span className="text-[10px] text-slate-400 block mt-0.5">
                                  سنة الصنع: {car.year || "-"}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-center">
                                <span className="font-mono text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 font-bold tracking-wide block select-all">
                                  {car.vin}
                                </span>
                              </td>
                              <td className="px-4 py-4 space-y-1.5">
                                <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                  👤 البائع المعتمد:{" "}
                                  <span className="text-rose-600 dark:text-rose-455">
                                    {car.seller || "غير محدد"}
                                  </span>
                                </div>
                                {car.exitType && (
                                  <span className="inline-block bg-purple-50 text-purple-700 bg-purple-950/40 text-purple-300 px-2 py-0.5 rounded-md text-[9px] font-extrabold border border-purple-100">
                                    نوع المخرج: {car.exitType}
                                  </span>
                                )}
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans leading-relaxed">
                                  {car.notes || (
                                    <span className="text-slate-400 italic">
                                      بدون ملاحظات إضافية
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan={4}
                              className="px-6 py-14 text-center text-slate-400 dark:text-slate-500 italic"
                            >
                              <div className="text-xl mb-2">ℹ️</div>
                              لا توجد سيارات صادرة أو تم بيعها في هذا التاريخ.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-950 p-4 border-t border-slate-100 dark:border-slate-850 text-rose-800 dark:text-rose-450 font-black text-xs text-left">
                                     إجمالي الخروج:{" "}
                    <span className="text-sm font-mono">
                      {dailyStats.exits.length}
                    </span>{" "}
                    سيارات صادرة مباعة
                  </div>
                </div>
              </div>
            </div>
          ) : reportView === "showroom-inventory-cost" ? (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Cost Summary Header Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-6 rounded-2xl shadow-lg space-y-2">
                  <div className="flex items-center justify-between opacity-90 text-sm font-bold">
                    <span>إجمالي تكلفة مخزون المعرض</span>
                    <Warehouse className="w-5 h-5" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black font-mono">
                    {showroomCostData.totalCost.toLocaleString("en-US")} <span className="text-xs font-normal">ر.س</span>
                  </div>
                  <div className="text-xs opacity-80">
                    محسوب حتى نهاية تاريخ: {inventoryCostDate}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-6 rounded-2xl shadow-lg space-y-2">
                  <div className="flex items-center justify-between opacity-90 text-sm font-bold">
                    <span>إجمالي عدد المركبات بالمعرض</span>
                    <CarIcon className="w-5 h-5" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black font-mono">
                    {showroomCostData.totalVehicles} <span className="text-xs font-normal">سيارة</span>
                  </div>
                  <div className="text-xs opacity-80">
                    في المخزون الفعلي (غير الصادر)
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-600 to-indigo-800 text-white p-6 rounded-2xl shadow-lg space-y-2">
                  <div className="flex items-center justify-between opacity-90 text-sm font-bold">
                    <span>متوسط تكلفة السيارة الواحدة</span>
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black font-mono">
                    {showroomCostData.avgCost.toLocaleString("en-US")} <span className="text-xs font-normal">ر.س</span>
                  </div>
                  <div className="text-xs opacity-80">
                    معدل التكلفة لكل مركبة
                  </div>
                </div>
              </div>

              {/* Brand Cost Breakdown Table */}
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 shadow-md rounded-3xl overflow-hidden">
                <div className="p-5 px-6 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4">
                  <h3 className="text-base font-black flex items-center gap-2">
                    <span className="w-2.5 h-6 bg-emerald-500 rounded-full" />
                    توزيع تكاليف المخزون حسب الماركة / الشركة
                  </h3>
                  <span className="text-xs bg-white/10 px-3 py-1 rounded-lg">
                    {showroomCostData.brandList.length} شركات وماركات
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-center border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-black border-b border-slate-200 dark:border-slate-700">
                        <th className="p-3 w-12 text-center">م</th>
                        <th className="p-3 text-right pr-6">الشركة / الماركة</th>
                        <th className="p-3 text-center">عدد السيارات</th>
                        <th className="p-3 text-center">نسبة الحصة</th>
                        <th className="p-3 text-left pl-6">إجمالي التكلفة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {showroomCostData.brandList.map((bg, idx) => {
                        const pct = showroomCostData.totalCost > 0
                          ? ((bg.totalCost / showroomCostData.totalCost) * 100).toFixed(1)
                          : "0.0";
                        return (
                          <tr key={bg.brand} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="p-3 text-center font-bold text-slate-400 font-mono">
                              {idx + 1}
                            </td>
                            <td className="p-3 text-right pr-6 font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                              {bg.brand}
                            </td>
                            <td className="p-3 text-center font-bold text-slate-700 dark:text-slate-300">
                              <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg font-mono">
                                {bg.count} سيارة
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <div className="inline-flex items-center gap-2">
                                <div className="w-20 bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, Number(pct))}%` }} />
                                </div>
                                <span className="font-mono text-xs font-bold text-slate-500">{pct}%</span>
                              </div>
                            </td>
                            <td className="p-3 text-left pl-6 font-black font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                              {bg.totalCost.toLocaleString("en-US")} ر.س
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-900 text-white font-black text-sm">
                        <td colSpan={2} className="p-4 text-right pr-6">الإجمالي الكلي</td>
                        <td className="p-4 text-center font-mono">{showroomCostData.totalVehicles} سيارة</td>
                        <td className="p-4 text-center">100%</td>
                        <td className="p-4 text-left pl-6 font-mono text-emerald-400">{showroomCostData.totalCost.toLocaleString("en-US")} ر.س</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          ) : reportView === "daily-movement-statement" ? (
            <div className="space-y-6 animate-in fade-in duration-300 max-w-6xl mx-auto">
              {/* Daily Statement KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm text-right space-y-1">
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400">الرصيد الافتتاحي</div>
                  <div className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
                    {parsedStatementSummary.openingBalance} <span className="text-xs text-slate-400">مركبة</span>
                  </div>
                  <div className="text-[11px] text-slate-400">بداية اليوم المحدد</div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/40 p-5 rounded-2xl shadow-sm text-right space-y-1">
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">الوارد الجديد (+)</div>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    +{parsedStatementSummary.enteredCount} <span className="text-xs text-slate-400">مركبة</span>
                  </div>
                  <div className="text-[11px] text-slate-400">دخول جديد للمخزون</div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/40 p-5 rounded-2xl shadow-sm text-right space-y-1">
                  <div className="text-xs font-bold text-rose-600 dark:text-rose-400">الصادر والمباع (-)</div>
                  <div className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
                    -{parsedStatementSummary.exitedCount} <span className="text-xs text-slate-400">مركبة</span>
                  </div>
                  <div className="text-[11px] text-slate-400">مبيعات وتحويلات صادرة</div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-900/40 p-5 rounded-2xl shadow-sm text-right space-y-1">
                  <div className="text-xs font-bold text-purple-600 dark:text-purple-400">رصيد الإغلاق النهائي</div>
                  <div className="text-2xl font-black text-purple-600 dark:text-purple-400 font-mono">
                    {parsedStatementSummary.closingBalance} <span className="text-xs text-slate-400">مركبة</span>
                  </div>
                  <div className="text-[11px] text-slate-400">الرصيد المتبقي الفعلي</div>
                </div>
              </div>

              {/* Exited Cars Section */}
              <div className="bg-white dark:bg-slate-900 border border-rose-100 dark:border-rose-900/30 rounded-3xl overflow-hidden shadow-sm">
                <div className="p-4 px-6 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-100 dark:border-rose-900/30 flex items-center justify-between text-rose-800 dark:text-rose-300">
                  <h4 className="font-extrabold text-sm flex items-center gap-2">
                    <span>🚨</span> المركبات الخارجة اليوم (مباع / صادر)
                  </h4>
                  <span className="font-mono font-black text-xs bg-rose-200/60 dark:bg-rose-900/60 px-3 py-1 rounded-lg">
                    {parsedStatementSummary.exitedCount} مركبة
                  </span>
                </div>
                {parsedStatementSummary.exitedCars.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-rose-50/50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200 font-black border-b border-rose-100 dark:border-rose-900/20">
                        <tr>
                          <th className="p-3 text-center w-12">م</th>
                          <th className="p-3">الماركة والطراز</th>
                          <th className="p-3">رقم الهيكل (الشاصي)</th>
                          <th className="p-3">البائع / المندوب</th>
                          <th className="p-3">ملاحظات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-50 dark:divide-rose-950/30">
                        {parsedStatementSummary.exitedCars.map((car, idx) => (
                          <tr key={car.id || idx} className="hover:bg-rose-50/30 dark:hover:bg-rose-950/20">
                            <td className="p-3 text-center font-bold font-mono text-rose-700">{idx + 1}</td>
                            <td className="p-3 font-extrabold text-slate-800 dark:text-slate-100">{formatVehicleDisplay(car)}</td>
                            <td className="p-3 font-mono text-slate-600 dark:text-slate-300" dir="ltr">{car.vin}</td>
                            <td className="p-3 font-bold text-rose-700 dark:text-rose-400">{car.seller || "غير محدد"}</td>
                            <td className="p-3 text-slate-500 dark:text-slate-400">{car.notes || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 text-xs font-bold">
                    لا توجد عمليات خروج أو مبيعات مسجلة في هذا اليوم
                  </div>
                )}
              </div>

              {/* Entered Cars Section */}
              <div className="bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/30 rounded-3xl overflow-hidden shadow-sm">
                <div className="p-4 px-6 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-100 dark:border-emerald-900/30 flex items-center justify-between text-emerald-800 dark:text-emerald-300">
                  <h4 className="font-extrabold text-sm flex items-center gap-2">
                    <span>🌱</span> المركبات الداخلة اليوم (وارد جديد)
                  </h4>
                  <span className="font-mono font-black text-xs bg-emerald-200/60 dark:bg-emerald-900/60 px-3 py-1 rounded-lg">
                    {parsedStatementSummary.enteredCount} مركبة
                  </span>
                </div>
                {parsedStatementSummary.enteredCars.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200 font-black border-b border-emerald-100 dark:border-emerald-900/20">
                        <tr>
                          <th className="p-3 text-center w-12">م</th>
                          <th className="p-3">الماركة والطراز</th>
                          <th className="p-3">رقم الهيكل (الشاصي)</th>
                          <th className="p-3">المورد</th>
                          <th className="p-3">ملاحظات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-emerald-50 dark:divide-emerald-950/30">
                        {parsedStatementSummary.enteredCars.map((car, idx) => (
                          <tr key={car.id || idx} className="hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20">
                            <td className="p-3 text-center font-bold font-mono text-emerald-700">{idx + 1}</td>
                            <td className="p-3 font-extrabold text-slate-800 dark:text-slate-100">{formatVehicleDisplay(car)}</td>
                            <td className="p-3 font-mono text-slate-600 dark:text-slate-300" dir="ltr">{car.vin}</td>
                            <td className="p-3 font-bold text-emerald-700 dark:text-emerald-400">{(car as any).supplier || car.seller || "غير محدد"}</td>
                            <td className="p-3 text-slate-500 dark:text-slate-400">{car.notes || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 text-xs font-bold">
                    لا توجد عمليات دخول أو واردات مسجلة في هذا اليوم
                  </div>
                )}
              </div>
            </div>
          ) : reportView === "analytics" ||
            reportView === "delegates" ||
            reportView === "supplier-analysis" ? (
            <AnalyticsTabs
              analyticsSubTab={
                reportView === "supplier-analysis"
                  ? "suppliers"
                  : reportView === "delegates"
                  ? "delegates"
                  : "overview"
              }
              analyticsData={analyticsData}
              showroomTarget={showroomTarget}
              setShowroomTarget={setShowroomTarget}
              salesTarget={salesTarget}
              setSalesTarget={setSalesTarget}
              canViewFinancials={canViewFinancials}
              stagnantLimitDays={stagnantLimitDays}
              setStagnantLimitDays={setStagnantLimitDays}
              analyticsBrandSort={analyticsBrandSort}
              setAnalyticsBrandSort={setAnalyticsBrandSort}
              analyticsModelSort={analyticsModelSort}
              setAnalyticsModelSort={setAnalyticsModelSort}
              analyticsSupplierSort={analyticsSupplierSort}
              setAnalyticsSupplierSort={setAnalyticsSupplierSort}
              analyticsSearchQuery={analyticsSearchQuery}
              setAnalyticsSearchQuery={setAnalyticsSearchQuery}
              drillDownBrand={drillDownBrand}
              setDrillDownBrand={setDrillDownBrand}
              drillDownSupplier={drillDownSupplier}
              setDrillDownSupplier={setDrillDownSupplier}
              brandChartType={brandChartType}
              setBrandChartType={setBrandChartType}
              cars={cars}
              vehicleCosts={vehicleCosts}
            />
          ) : (
            <div className="space-y-6 animate-in fade-in duration-300">
              {filteredCarsData.length === 0 ? (
                <div
                  role="status"
                  className="flex flex-col items-center justify-center p-20 bg-slate-50/55 dark:bg-slate-950/20 rounded-[2.2rem] border border-dashed border-slate-200 dark:border-slate-800"
                >
                  <Warehouse className="text-slate-300 dark:text-slate-700 w-16 h-16 mb-4 animate-bounce" />
                  <p className="text-slate-600 dark:text-slate-300 font-extrabold text-base">
                    لا توجد مركبات مطابقة لمعايير هذا التقرير حالياً
                  </p>
                  <p className="text-slate-400 dark:text-slate-500 text-xs font-bold mt-1">
                    تأكد من شروط الفلترة أو تاريخ الدخول/الخروج أو حالة المركبات في المخزون
                  </p>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 shadow-md rounded-3xl overflow-hidden transition-all duration-300">
                  <div className="overflow-x-auto">
                    <table className="w-full text-center border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-900 text-white font-black">
                          <th className="p-3 text-center border-b border-slate-700 w-[47px] min-w-[47px] max-w-[47px]">
                            م
                          </th>
                          {activeColumns.map((col) => {
                            const isCarCol =
                              col.key === "brand_model" ||
                              col.key === "brandModel" ||
                              col.key === "car_info";
                            return (
                              <th
                                key={col.key}
                                className={`p-3 border-b border-slate-700 whitespace-nowrap ${
                                  isCarCol ? "text-right pr-4" : "text-center"
                                }`}
                                style={{ width: col.width }}
                              >
                                {col.label}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {(() => {
                          let runningCounter = 1;
                          return Object.entries(groupedData).map(
                            ([brand, models]) => {
                              const brandCars = Object.values(models).flat();
                              if (brandCars.length === 0) return null;
                              return (
                                <React.Fragment key={brand}>
                                  {/* Brand Banner Header Row */}
                                  <tr className="bg-blue-50/80 dark:bg-blue-950/40 border-y-2 border-blue-200 dark:border-blue-900/50">
                                    <td
                                      colSpan={activeColumns.length + 1}
                                      className="py-3 px-4 text-center font-black text-sm text-blue-700 dark:text-blue-300"
                                    >
                                      <div className="flex items-center justify-center gap-2">
                                        <span>🚘</span>
                                        <span className="text-base font-extrabold">{brand}</span>
                                        <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2.5 py-0.5 rounded-full font-bold">
                                          {brandCars.length} سيارة
                                        </span>
                                        <span>🚘</span>
                                      </div>
                                    </td>
                                  </tr>
                                  {/* Car Rows */}
                                  {brandCars.map((car) => {
                                    const rowStyleObj = getCarRowStyle(car);
                                    const customRowStyle: React.CSSProperties = {
                                      backgroundColor:
                                        rowStyleObj.style?.backgroundColor ||
                                        undefined,
                                      color:
                                        rowStyleObj.style?.color || undefined,
                                    };
                                    const currentIndex = runningCounter++;

                                    return (
                                      <tr
                                        key={car.id || `${car.vin}_${currentIndex}`}
                                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                                        style={customRowStyle}
                                      >
                                        <td className="p-3 text-center font-bold text-slate-500 font-mono w-[47px] min-w-[47px] max-w-[47px] bg-slate-50/60 dark:bg-slate-800/40 border-l border-slate-100 dark:border-slate-800">
                                          {currentIndex}
                                        </td>
                                        {activeColumns.map((col) => {
                                          const isCarCol =
                                            col.key === "brand_model" ||
                                            col.key === "brandModel" ||
                                            col.key === "car_info";
                                          const val = getCellValue(car, col.key);

                                          // Highlight missing card numbers
                                          const isCardCol =
                                            col.key === "cardNumber" ||
                                            col.key === "card_number";
                                          const rawCard = String(
                                            car.cardNumber || "",
                                          ).trim();
                                          const hasNoCard =
                                            isCardCol &&
                                            (!rawCard ||
                                              rawCard === "-" ||
                                              rawCard === "لم يرد البطاقه بعد" ||
                                              rawCard === "لم يرد البطاقة بعد" ||
                                              rawCard === "بدون" ||
                                              rawCard === "غير متوفر" ||
                                              rawCard === "لا يوجد" ||
                                              rawCard === "غير مدرجة" ||
                                              rawCard === "null");

                                          // Status styling
                                          const isStatusCol =
                                            col.key === "status";
                                          const statusVal = String(
                                            car.status || "",
                                          );

                                          return (
                                            <td
                                              key={col.key}
                                              className={`p-3 ${
                                                isCarCol
                                                  ? "text-right pr-4 font-bold"
                                                  : "text-center"
                                              } ${
                                                hasNoCard
                                                  ? "bg-rose-500 text-white font-black"
                                                  : ""
                                              }`}
                                            >
                                              {isStatusCol ? (
                                                <span
                                                  className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-black ${
                                                    statusVal === "متوفره" ||
                                                    statusVal === "AVAILABLE"
                                                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
                                                      : statusVal === "مباعة" ||
                                                          statusVal === "SOLD"
                                                        ? "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300"
                                                        : statusVal === "محجوزة" ||
                                                            statusVal === "RESERVED"
                                                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
                                                          : "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
                                                  }`}
                                                >
                                                  {val}
                                                </span>
                                              ) : isCarCol ? (
                                                <div className="flex flex-col">
                                                  <span className="font-extrabold text-slate-800 dark:text-slate-100 text-xs">
                                                    {val}
                                                  </span>
                                                  {car.vin && (
                                                    <span className="font-mono text-[10px] text-slate-400 select-all">
                                                      {car.vin}
                                                    </span>
                                                  )}
                                                </div>
                                              ) : (
                                                <span className="font-medium">
                                                  {val}
                                                </span>
                                              )}
                                            </td>
                                          );
                                        })}
                                      </tr>
                                    );
                                  })}
                                </React.Fragment>
                              );
                            },
                          );
                        })()}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-900 text-white font-black text-xs">
                          <td
                            colSpan={activeColumns.length + 1}
                            className="p-4 text-center"
                          >
                            <div className="flex flex-wrap items-center justify-between px-4">
                              <span className="text-sm">
                                إجمالي عدد السيارات المطابقة:{" "}
                                <strong className="text-emerald-400 font-mono text-base">
                                  {filteredCarsData.length}
                                </strong>{" "}
                                سيارة
                              </span>
                              {canViewFinancials && totals.totalPrice > 0 && (
                                <span className="text-sm">
                                  إجمالي القيمة:{" "}
                                  <strong className="text-amber-300 font-mono text-base">
                                    {totals.totalPrice.toLocaleString("en-US")}
                                  </strong>{" "}
                                  ريال
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {(reportView === "inventory" ||
                reportView === "comprehensive-inventory" ||
                reportView === "transfers-general") &&
                renderInTransferCarsReportSection()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
