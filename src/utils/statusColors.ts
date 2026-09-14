import { Car, CarStatus, RentalStatus, OrganizationSettings, StatusColorsConfig, CustomStatusColorRule, CustomCarStatus } from '../../types';
import { DEFAULT_STATUS_COLORS } from '../../constants';

export function hexToArgb(hex?: string | null, defaultArgb = 'FFFFFFFF'): string {
  if (!hex || typeof hex !== 'string') return defaultArgb;
  let clean = hex.trim();
  if (clean.startsWith('rgba') || clean.startsWith('rgb')) {
    const parts = clean.match(/\d+/g);
    if (parts && parts.length >= 3) {
      const r = parseInt(parts[0], 10).toString(16).padStart(2, '0');
      const g = parseInt(parts[1], 10).toString(16).padStart(2, '0');
      const b = parseInt(parts[2], 10).toString(16).padStart(2, '0');
      const a = parts[3] !== undefined ? Math.round(parseFloat(parts[3]) * 255).toString(16).padStart(2, '0') : 'FF';
      return `${a}${r}${g}${b}`.toUpperCase();
    }
    return defaultArgb;
  }
  clean = clean.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  if (clean.length === 6) {
    return `FF${clean}`.toUpperCase();
  }
  if (clean.length === 8) {
    return clean.toUpperCase();
  }
  return defaultArgb;
}

export interface StatusColorInfo {
  bg: string;
  text: string;
  bgArgb: string;
  textArgb: string;
  isBold: boolean;
  statusType: 'mismatch' | 'not_for_sale' | 'sold' | 'reserved' | 'available' | 'returned' | 'not_arrived' | 'custom' | 'default';
  badgeBg: string;
  badgeColor: string;
  badgeBorder: string;
}

export function getCarStatusColorInfo(
  carOrStatus: Partial<Car> | string | null | undefined,
  settings?: OrganizationSettings
): StatusColorInfo {
  const colors = getResolvedStatusColors(settings);

  // If passed a string status directly or null/undefined
  if (typeof carOrStatus === 'string' || !carOrStatus) {
    const statusStr = String(carOrStatus || '').trim();
    const lower = statusStr.toLowerCase();

    // Check custom statuses first
    if (statusStr && colors.customStatuses && colors.customStatuses.length > 0) {
      const matched = colors.customStatuses.find(
        cs => cs.name.trim().toLowerCase() === lower || cs.id === lower
      );
      if (matched) {
        const text = matched.textColor || getContrastTextColor(matched.bgColor);
        return {
          bg: matched.bgColor,
          text,
          bgArgb: hexToArgb(matched.bgColor),
          textArgb: hexToArgb(text),
          isBold: true,
          statusType: 'custom',
          badgeBg: matched.bgColor,
          badgeColor: text,
          badgeBorder: matched.bgColor,
        };
      }
    }

    if (lower.includes('غير مطابق') || lower === 'mismatch' || lower.includes('غير متطابق')) {
      const text = colors.mismatchText || getContrastTextColor(colors.mismatchBg);
      return {
        bg: colors.mismatchBg,
        text,
        bgArgb: hexToArgb(colors.mismatchBg),
        textArgb: hexToArgb(text),
        isBold: true,
        statusType: 'mismatch',
        badgeBg: colors.mismatchBg,
        badgeColor: text,
        badgeBorder: colors.mismatchBg,
      };
    }

    if (lower.includes('غير معروض') || lower.includes('not for sale') || lower.includes('not_for_sale')) {
      const text = colors.notForSaleText || getContrastTextColor(colors.notForSaleBg);
      return {
        bg: colors.notForSaleBg,
        text,
        bgArgb: hexToArgb(colors.notForSaleBg),
        textArgb: hexToArgb(text),
        isBold: true,
        statusType: 'not_for_sale',
        badgeBg: colors.notForSaleBg,
        badgeColor: text,
        badgeBorder: colors.notForSaleBg,
      };
    }

    if (lower.includes('مباع') || lower.includes('مبيعات') || lower.includes('sold') || lower.includes('مبيعة') || lower.includes('مباعة')) {
      const text = colors.soldText || getContrastTextColor(colors.soldBg);
      return {
        bg: colors.soldBg,
        text,
        bgArgb: hexToArgb(colors.soldBg),
        textArgb: hexToArgb(text),
        isBold: true,
        statusType: 'sold',
        badgeBg: colors.soldBg,
        badgeColor: text,
        badgeBorder: colors.soldBg,
      };
    }

    if (lower.includes('محجوز') || lower.includes('حجز') || lower.includes('reserved') || lower.includes('محجوزة')) {
      const text = colors.reservedText || getContrastTextColor(colors.reservedBg);
      return {
        bg: colors.reservedBg,
        text,
        bgArgb: hexToArgb(colors.reservedBg),
        textArgb: hexToArgb(text),
        isBold: true,
        statusType: 'reserved',
        badgeBg: colors.reservedBg,
        badgeColor: text,
        badgeBorder: colors.reservedBg,
      };
    }

    if (lower.includes('متوفر') || lower.includes('متاح') || lower.includes('available') || lower.includes('موجود') || lower.includes('بالساحة') || lower.includes('متوفرة')) {
      const text = colors.availableText || getContrastTextColor(colors.availableBg);
      return {
        bg: colors.availableBg,
        text,
        bgArgb: hexToArgb(colors.availableBg),
        textArgb: hexToArgb(text),
        isBold: true,
        statusType: 'available',
        badgeBg: colors.availableBg,
        badgeColor: text,
        badgeBorder: colors.availableBg,
      };
    }

    if (lower.includes('مرتجع') || lower.includes('مرجع') || lower.includes('returned') || lower.includes('مسترجعة')) {
      const text = colors.returnedText || getContrastTextColor(colors.returnedBg);
      return {
        bg: colors.returnedBg,
        text,
        bgArgb: hexToArgb(colors.returnedBg),
        textArgb: hexToArgb(text),
        isBold: true,
        statusType: 'returned',
        badgeBg: colors.returnedBg,
        badgeColor: text,
        badgeBorder: colors.returnedBg,
      };
    }

    if (lower.includes('لم تصل') || lower.includes('تحويل') || lower.includes('not_arrived') || lower.includes('transfer')) {
      const text = colors.notArrivedText || getContrastTextColor(colors.notArrivedBg);
      return {
        bg: colors.notArrivedBg,
        text,
        bgArgb: hexToArgb(colors.notArrivedBg),
        textArgb: hexToArgb(text),
        isBold: true,
        statusType: 'not_arrived',
        badgeBg: colors.notArrivedBg,
        badgeColor: text,
        badgeBorder: colors.notArrivedBg,
      };
    }

    return {
      bg: '#ffffff',
      text: '#0f172a',
      bgArgb: 'FFFFFFFF',
      textArgb: 'FF0F172A',
      isBold: false,
      statusType: 'default',
      badgeBg: '#f1f5f9',
      badgeColor: '#475569',
      badgeBorder: '#cbd5e1',
    };
  }

  // car object evaluation
  const car = carOrStatus;
  const customRule = getCustomRuleForCar(car, settings);
  if (customRule && customRule.applyToRow !== false) {
    const text = customRule.textColor || getContrastTextColor(customRule.bgColor);
    return {
      bg: customRule.bgColor,
      text,
      bgArgb: hexToArgb(customRule.bgColor),
      textArgb: hexToArgb(text),
      isBold: true,
      statusType: 'custom',
      badgeBg: customRule.bgColor,
      badgeColor: text,
      badgeBorder: customRule.bgColor,
    };
  }

  const isReserved = car.status === CarStatus.RESERVED || String(car.status) === 'محجوزة' || String(car.status) === 'محجوز';
  const isSold = car.status === CarStatus.SOLD || String(car.status) === 'مباعة' || String(car.status) === 'مباع';
  const notForSale = car.status === CarStatus.NOT_FOR_SALE || String(car.status) === 'غير معروضة للبيع';
  const isAvailable = car.status === CarStatus.AVAILABLE || String(car.status) === 'متوفرة' || String(car.status) === 'متوفر';
  const isReturned = car.status === CarStatus.RETURNED || String(car.status) === 'مسترجعة' || String(car.status) === 'مرتجع' || String(car.status) === 'مرتجعة للمعرض';
  const isNotArrived = car.status === CarStatus.NOT_ARRIVED || String(car.status) === 'لم تصل بعد' || car.isPresentInShowroom === false;
  const isMismatch = Boolean(car.vinMatching && (String(car.vinMatching).trim() === 'غير مطابق' || String(car.vinMatching).trim() === 'غير متطابق' || String(car.vinMatching).trim() === 'mismatch'));

  if (isMismatch) {
    const text = colors.mismatchText || getContrastTextColor(colors.mismatchBg);
    return {
      bg: colors.mismatchBg,
      text,
      bgArgb: hexToArgb(colors.mismatchBg),
      textArgb: hexToArgb(text),
      isBold: true,
      statusType: 'mismatch',
      badgeBg: colors.mismatchBg,
      badgeColor: text,
      badgeBorder: colors.mismatchBg,
    };
  }

  if (notForSale) {
    const text = colors.notForSaleText || getContrastTextColor(colors.notForSaleBg);
    return {
      bg: colors.notForSaleBg,
      text,
      bgArgb: hexToArgb(colors.notForSaleBg),
      textArgb: hexToArgb(text),
      isBold: true,
      statusType: 'not_for_sale',
      badgeBg: colors.notForSaleBg,
      badgeColor: text,
      badgeBorder: colors.notForSaleBg,
    };
  }

  if (isSold) {
    const text = colors.soldText || getContrastTextColor(colors.soldBg);
    return {
      bg: colors.soldBg,
      text,
      bgArgb: hexToArgb(colors.soldBg),
      textArgb: hexToArgb(text),
      isBold: true,
      statusType: 'sold',
      badgeBg: colors.soldBg,
      badgeColor: text,
      badgeBorder: colors.soldBg,
    };
  }

  if (isReserved) {
    const text = colors.reservedText || getContrastTextColor(colors.reservedBg);
    return {
      bg: colors.reservedBg,
      text,
      bgArgb: hexToArgb(colors.reservedBg),
      textArgb: hexToArgb(text),
      isBold: true,
      statusType: 'reserved',
      badgeBg: colors.reservedBg,
      badgeColor: text,
      badgeBorder: colors.reservedBg,
    };
  }

  if (isAvailable) {
    const text = colors.availableText || getContrastTextColor(colors.availableBg);
    return {
      bg: colors.availableBg,
      text,
      bgArgb: hexToArgb(colors.availableBg),
      textArgb: hexToArgb(text),
      isBold: true,
      statusType: 'available',
      badgeBg: colors.availableBg,
      badgeColor: text,
      badgeBorder: colors.availableBg,
    };
  }

  if (isReturned) {
    const text = colors.returnedText || getContrastTextColor(colors.returnedBg);
    return {
      bg: colors.returnedBg,
      text,
      bgArgb: hexToArgb(colors.returnedBg),
      textArgb: hexToArgb(text),
      isBold: true,
      statusType: 'returned',
      badgeBg: colors.returnedBg,
      badgeColor: text,
      badgeBorder: colors.returnedBg,
    };
  }

  if (isNotArrived) {
    const text = colors.notArrivedText || getContrastTextColor(colors.notArrivedBg);
    return {
      bg: colors.notArrivedBg,
      text,
      bgArgb: hexToArgb(colors.notArrivedBg),
      textArgb: hexToArgb(text),
      isBold: true,
      statusType: 'not_arrived',
      badgeBg: colors.notArrivedBg,
      badgeColor: text,
      badgeBorder: colors.notArrivedBg,
    };
  }

  return {
    bg: '#ffffff',
    text: '#0f172a',
    bgArgb: 'FFFFFFFF',
    textArgb: 'FF0F172A',
    isBold: false,
    statusType: 'default',
    badgeBg: '#f1f5f9',
    badgeColor: '#475569',
    badgeBorder: '#cbd5e1',
  };
}

export function getCarRentalColorInfo(
  carOrRental: Partial<Car> | string | null | undefined,
  settings?: OrganizationSettings
): {
  bg: string;
  text: string;
  bgArgb: string;
  textArgb: string;
  isNotRented: boolean;
} {
  const colors = getResolvedStatusColors(settings);
  let isNotRented = false;

  if (typeof carOrRental === 'string') {
    const val = carOrRental.trim();
    isNotRented = val.includes('لم') || val.includes('غير') || val === 'NOT_RENTED';
  } else if (carOrRental) {
    isNotRented = carOrRental.rentalStatus !== RentalStatus.RENTED && String(carOrRental.rentalStatus) !== 'مجير' && String(carOrRental.rentalStatus) !== 'مجيرة';
  }

  const bg = colors.notRentedBg || '#1F4E79';
  const text = colors.notRentedText || '#FFFFFF';

  return {
    bg: isNotRented ? bg : 'transparent',
    text: isNotRented ? text : '#000000',
    bgArgb: isNotRented ? hexToArgb(bg) : 'FFFFFFFF',
    textArgb: isNotRented ? hexToArgb(text) : 'FF000000',
    isNotRented,
  };
}

export function getResolvedStatusColors(settings?: OrganizationSettings): Required<Omit<StatusColorsConfig, 'customRules' | 'customStatuses'>> & { 
  customRules: CustomStatusColorRule[];
  customStatuses: CustomCarStatus[];
} {
  return {
    availableBg: settings?.statusColors?.availableBg || DEFAULT_STATUS_COLORS.availableBg || '#e2e8f0',
    availableText: settings?.statusColors?.availableText || DEFAULT_STATUS_COLORS.availableText || '#0f172a',
    reservedBg: settings?.statusColors?.reservedBg || DEFAULT_STATUS_COLORS.reservedBg || '#D4AF37',
    reservedText: settings?.statusColors?.reservedText || DEFAULT_STATUS_COLORS.reservedText || '#000000',
    soldBg: settings?.statusColors?.soldBg || DEFAULT_STATUS_COLORS.soldBg || '#8B0000',
    soldText: settings?.statusColors?.soldText || DEFAULT_STATUS_COLORS.soldText || '#FFFFFF',
    notForSaleBg: settings?.statusColors?.notForSaleBg || DEFAULT_STATUS_COLORS.notForSaleBg || '#991B1B',
    notForSaleText: settings?.statusColors?.notForSaleText || DEFAULT_STATUS_COLORS.notForSaleText || '#FFFFFF',
    returnedBg: settings?.statusColors?.returnedBg || DEFAULT_STATUS_COLORS.returnedBg || '#F97316',
    returnedText: settings?.statusColors?.returnedText || DEFAULT_STATUS_COLORS.returnedText || '#FFFFFF',
    notArrivedBg: settings?.statusColors?.notArrivedBg || DEFAULT_STATUS_COLORS.notArrivedBg || '#9333EA',
    notArrivedText: settings?.statusColors?.notArrivedText || DEFAULT_STATUS_COLORS.notArrivedText || '#FFFFFF',
    mismatchBg: settings?.statusColors?.mismatchBg || DEFAULT_STATUS_COLORS.mismatchBg || '#CC0000',
    mismatchText: settings?.statusColors?.mismatchText || DEFAULT_STATUS_COLORS.mismatchText || '#FFFFFF',
    notRentedBg: settings?.statusColors?.notRentedBg || DEFAULT_STATUS_COLORS.notRentedBg || '#1F4E79',
    notRentedText: settings?.statusColors?.notRentedText || DEFAULT_STATUS_COLORS.notRentedText || '#FFFFFF',
    customStatuses: settings?.statusColors?.customStatuses || [],
    customRules: settings?.statusColors?.customRules || [],
  };
}

export function getCustomRuleForCar(
  car: Partial<Car>,
  settings?: OrganizationSettings
): CustomStatusColorRule | null {
  // Check if car.status matches a manually added custom status first
  if (car.status && settings?.statusColors?.customStatuses) {
    const carStatusStr = String(car.status).trim().toLowerCase();
    const matchedCustomStatus = settings.statusColors.customStatuses.find(
      cs => cs.name.trim().toLowerCase() === carStatusStr || cs.id === carStatusStr
    );
    if (matchedCustomStatus) {
      return {
        id: matchedCustomStatus.id,
        fieldKey: 'status',
        fieldLabel: 'حالة السيارة',
        matchValue: matchedCustomStatus.name,
        bgColor: matchedCustomStatus.bgColor,
        textColor: matchedCustomStatus.textColor,
        applyToRow: true,
        applyToBadge: true
      };
    }
  }

  const rules = settings?.statusColors?.customRules;
  if (!rules || !Array.isArray(rules) || rules.length === 0) return null;

  for (const rule of rules) {
    if (!rule.matchValue || !rule.fieldKey) continue;
    // CRITICAL: When card number is missing or customized, it applies ONLY to the card cell, never the row
    if (rule.fieldKey === 'cardNumber' || rule.fieldKey === 'card_number') {
      continue;
    }
    const targetMatch = String(rule.matchValue).trim().toLowerCase();

    // 1. Check direct car property
    let carVal: any = (car as any)[rule.fieldKey];

    // 2. Check customData
    if (carVal === undefined && car.customData) {
      carVal = car.customData[rule.fieldKey];
    }

    // 3. Special aliases
    if (carVal === undefined) {
      if (rule.fieldKey === 'plate' && car.plateData) {
        carVal = car.plateData.plateNumber;
      } else if (rule.fieldKey === 'car_info' || rule.fieldKey === 'brand_model') {
        carVal = `${car.brand || ''} ${car.model || ''}`;
      } else if (rule.fieldKey === 'cost_price') {
        carVal = car.costPrice;
      } else if (rule.fieldKey === 'notes' || rule.fieldKey === 'representative') {
        carVal = car.notes;
      }
    }

    if (carVal !== undefined && carVal !== null) {
      const valStr = String(carVal).trim().toLowerCase();
      if (valStr === targetMatch || (targetMatch && valStr.includes(targetMatch))) {
        return rule;
      }
    }
  }

  return null;
}

export function getCustomRuleForField(
  fieldKey: string,
  value: string | undefined | null,
  settings?: OrganizationSettings
): CustomStatusColorRule | null {
  if (!value) return null;
  const rules = settings?.statusColors?.customRules;
  if (!rules || !Array.isArray(rules) || rules.length === 0) return null;

  const targetVal = String(value).trim().toLowerCase();
  return rules.find(r => 
    r.fieldKey === fieldKey && 
    String(r.matchValue).trim().toLowerCase() === targetVal
  ) || null;
}

export function getContrastTextColor(bgColor?: string, fallbackLight = '#ffffff', fallbackDark = '#0f172a'): string {
  if (!bgColor || bgColor === 'transparent' || bgColor === 'inherit') return fallbackDark;
  let hex = bgColor.trim().replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  if (hex.length !== 6) return fallbackDark;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return fallbackDark;
  // Standard WCAG / YIQ formula for perceived luminance
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? fallbackDark : fallbackLight;
}

export function getCarRowStyleAndClass(
  car: Partial<Car>,
  settings?: OrganizationSettings,
  isSelected: boolean = false
): {
  rowStyle: React.CSSProperties;
  rowBgClass: string;
  titleTextColorClass: string;
  bodyTextColorClass: string;
  statusType: 'mismatch' | 'not_for_sale' | 'sold' | 'reserved' | 'available' | 'returned' | 'not_arrived' | 'custom' | 'default';
  bg: string;
  text: string;
} {
  // Check custom status/field color rules first
  const customRule = getCustomRuleForCar(car, settings);
  if (customRule && customRule.applyToRow !== false && customRule.fieldKey !== 'cardNumber' && customRule.fieldKey !== 'card_number') {
    const computedText = customRule.textColor || getContrastTextColor(customRule.bgColor);
    const isDark = computedText === '#ffffff';
    return {
      rowStyle: { backgroundColor: customRule.bgColor, color: computedText },
      rowBgClass: isDark ? 'text-white font-extrabold hover:opacity-90' : 'text-slate-950 font-black hover:opacity-90',
      titleTextColorClass: isDark ? 'text-white dark:text-white font-black' : 'text-slate-950 dark:text-slate-950 font-black',
      bodyTextColorClass: isDark ? 'text-white dark:text-white font-extrabold' : 'text-slate-900 dark:text-slate-900 font-bold',
      statusType: 'custom',
      bg: customRule.bgColor,
      text: computedText,
    };
  }

  const colors = getResolvedStatusColors(settings);

  const isReserved = car.status === CarStatus.RESERVED || String(car.status) === 'محجوزة' || String(car.status) === 'محجوز';
  const isSold = car.status === CarStatus.SOLD || String(car.status) === 'مباعة' || String(car.status) === 'مباع';
  const notForSale = car.status === CarStatus.NOT_FOR_SALE || String(car.status) === 'غير معروضة للبيع';
  const isAvailable = car.status === CarStatus.AVAILABLE || String(car.status) === 'متوفرة' || String(car.status) === 'متوفر';
  const isReturned = car.status === CarStatus.RETURNED || String(car.status) === 'مسترجعة' || String(car.status) === 'مرتجع' || String(car.status) === 'مرتجعة للمعرض';
  const isNotArrived = car.status === CarStatus.NOT_ARRIVED || String(car.status) === 'لم تصل بعد' || car.isPresentInShowroom === false;
  const isMismatch = Boolean(car.vinMatching && (String(car.vinMatching).trim() === 'غير مطابق' || String(car.vinMatching).trim() === 'غير متطابق' || String(car.vinMatching).trim() === 'mismatch'));

  if (isMismatch) {
    const text = colors.mismatchText || getContrastTextColor(colors.mismatchBg);
    const isDark = text === '#ffffff';
    return {
      rowStyle: { backgroundColor: colors.mismatchBg, color: text },
      rowBgClass: isDark ? 'text-white font-extrabold hover:opacity-90' : 'text-slate-950 font-black hover:opacity-90',
      titleTextColorClass: isDark ? 'text-white dark:text-white font-black' : 'text-slate-950 dark:text-slate-950 font-black',
      bodyTextColorClass: isDark ? 'text-white dark:text-white font-extrabold' : 'text-slate-900 dark:text-slate-900 font-bold',
      statusType: 'mismatch',
      bg: colors.mismatchBg,
      text: text,
    };
  }

  if (notForSale) {
    const text = colors.notForSaleText || getContrastTextColor(colors.notForSaleBg);
    const isDark = text === '#ffffff';
    return {
      rowStyle: { backgroundColor: colors.notForSaleBg, color: text },
      rowBgClass: isDark ? 'text-white font-extrabold hover:opacity-90' : 'text-slate-950 font-black hover:opacity-90',
      titleTextColorClass: isDark ? 'text-white dark:text-white font-black' : 'text-slate-950 dark:text-slate-950 font-black',
      bodyTextColorClass: isDark ? 'text-white dark:text-white font-extrabold' : 'text-slate-900 dark:text-slate-900 font-bold',
      statusType: 'not_for_sale',
      bg: colors.notForSaleBg,
      text: text,
    };
  }

  if (isSold) {
    const text = colors.soldText || getContrastTextColor(colors.soldBg);
    const isDark = text === '#ffffff';
    return {
      rowStyle: { backgroundColor: colors.soldBg, color: text },
      rowBgClass: isDark ? 'text-white font-extrabold hover:opacity-90' : 'text-slate-950 font-black hover:opacity-90',
      titleTextColorClass: isDark ? 'text-white dark:text-white font-black' : 'text-slate-950 dark:text-slate-950 font-black',
      bodyTextColorClass: isDark ? 'text-white dark:text-white font-extrabold' : 'text-slate-900 dark:text-slate-900 font-bold',
      statusType: 'sold',
      bg: colors.soldBg,
      text: text,
    };
  }

  if (isReserved) {
    const text = colors.reservedText || getContrastTextColor(colors.reservedBg);
    const isDark = text === '#ffffff';
    return {
      rowStyle: { backgroundColor: colors.reservedBg, color: text },
      rowBgClass: isDark ? 'text-white font-extrabold hover:opacity-90' : 'text-slate-950 font-black hover:opacity-90',
      titleTextColorClass: isDark ? 'text-white dark:text-white font-black' : 'text-slate-950 dark:text-slate-950 font-black',
      bodyTextColorClass: isDark ? 'text-white dark:text-white font-extrabold' : 'text-slate-900 dark:text-slate-900 font-bold',
      statusType: 'reserved',
      bg: colors.reservedBg,
      text: text,
    };
  }

  if (isAvailable) {
    const text = colors.availableText || getContrastTextColor(colors.availableBg);
    const isDark = text === '#ffffff';
    return {
      rowStyle: { backgroundColor: colors.availableBg, color: text },
      rowBgClass: isDark ? 'text-white font-extrabold hover:opacity-90' : 'text-slate-950 font-black hover:opacity-90',
      titleTextColorClass: isDark ? 'text-white dark:text-white font-black' : 'text-slate-950 dark:text-slate-950 font-black',
      bodyTextColorClass: isDark ? 'text-white dark:text-white font-extrabold' : 'text-slate-900 dark:text-slate-900 font-bold',
      statusType: 'available',
      bg: colors.availableBg,
      text: text,
    };
  }

  if (isReturned) {
    const text = colors.returnedText || getContrastTextColor(colors.returnedBg);
    const isDark = text === '#ffffff';
    return {
      rowStyle: { backgroundColor: colors.returnedBg, color: text },
      rowBgClass: isDark ? 'text-white font-extrabold hover:opacity-90' : 'text-slate-950 font-black hover:opacity-90',
      titleTextColorClass: isDark ? 'text-white dark:text-white font-black' : 'text-slate-950 dark:text-slate-950 font-black',
      bodyTextColorClass: isDark ? 'text-white dark:text-white font-extrabold' : 'text-slate-900 dark:text-slate-900 font-bold',
      statusType: 'returned',
      bg: colors.returnedBg,
      text: text,
    };
  }

  if (isNotArrived) {
    const text = colors.notArrivedText || getContrastTextColor(colors.notArrivedBg);
    const isDark = text === '#ffffff';
    return {
      rowStyle: { backgroundColor: colors.notArrivedBg, color: text },
      rowBgClass: isDark ? 'text-white font-extrabold hover:opacity-90' : 'text-slate-950 font-black hover:opacity-90',
      titleTextColorClass: isDark ? 'text-white dark:text-white font-black' : 'text-slate-950 dark:text-slate-950 font-black',
      bodyTextColorClass: isDark ? 'text-white dark:text-white font-extrabold' : 'text-slate-900 dark:text-slate-900 font-bold',
      statusType: 'not_arrived',
      bg: colors.notArrivedBg,
      text: text,
    };
  }

  if (isSelected) {
    return {
      rowStyle: {},
      rowBgClass: 'bg-blue-50/50 dark:bg-blue-500/10 hover:bg-slate-50 dark:hover:bg-slate-800/30',
      titleTextColorClass: 'text-slate-800 dark:text-white font-black',
      bodyTextColorClass: 'text-slate-700 dark:text-slate-300 font-bold',
      statusType: 'default',
      bg: '#ffffff',
      text: '#0f172a',
    };
  }

  return {
    rowStyle: {},
    rowBgClass: 'hover:bg-slate-50 dark:hover:bg-slate-800/30',
    titleTextColorClass: 'text-slate-800 dark:text-white font-black',
    bodyTextColorClass: 'text-slate-700 dark:text-slate-300 font-bold',
    statusType: 'default',
    bg: '#ffffff',
    text: '#0f172a',
  };
}

