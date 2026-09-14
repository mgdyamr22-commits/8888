import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'ar' | 'en';

export interface TranslationContextProps {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
  isRtl: boolean;
  dir: 'rtl' | 'ltr';
}

const translations: Record<Language, Record<string, string>> = {
  ar: {
    // Nav / Sidebar
    'nav.dashboard': 'لوحة التحكم',
    'nav.inventory': 'إدارة المخزون',
    'nav.sales': 'المبيعات',
    'nav.reports': 'التقارير',
    'nav.users': 'المستخدمين والأمان',
    'nav.customers': 'العملاء',
    'nav.backup': 'قاعدة البيانات',
    'nav.updates': 'الترقيات',
    'nav.settings': 'إعدادات المنصة',
    'nav.about': 'حول المنصة والمطور',
    'nav.logout': 'تسجيل الخروج الآمن',
    'nav.developer': 'تطوير: منصة كاريان الرقمية',

    // Shared UI
    'system.title': 'مخزوني برو',
    'system.subtitle': 'إدارة أصول السيارات',
    'system.aes_active': 'تشفير AES-256 نشط',
    'system.decryption': 'جاري فك تشفير البيانات الآمنة...',
    'system.military_encryption': 'تشفير عسكري AES-256 نشط',
    'system.admin_current': 'المسؤول الحالي',
    'system.system_bot': 'نظام ذكي',

    // Common Buttons & Actions
    'action.save': 'حفظ التغييرات',
    'action.cancel': 'إلغاء',
    'action.delete': 'حذف',
    'action.edit': 'تعديل',
    'action.add': 'إضافة جديد',
    'action.add_bulk': 'إستيراد جماعي',
    'action.search': 'بحث...',
    'action.export_excel': 'تصدير إكسل مجمع',
    'action.export_single': 'تصدير التقرير اليومي مجمع',
    'action.clear': 'مسح',
    'action.add_car': 'إضافة سيارة',
    'action.update': 'تحديث',
    'action.close': 'إغلاق',
    'action.copy_success': 'تم النسخ بنجاح!',
    'action.copy': 'نسخ',

    // Fields
    'field.brand': 'السيارة',
    'field.model': 'الطراز',
    'field.year': 'الموديل',
    'field.color': 'اللون',
    'field.vin': 'رقم الهيكل',
    'field.cardNumber': 'الرقم التسلسلي / البطاقة',
    'field.price': 'سعر البيع',
    'field.costPrice': 'سعر التكلفة',
    'field.supplier': 'المورد',
    'field.ownershipType': 'طبيعة الملكية',
    'field.status': 'حالة السيارة',
    'field.rentalStatus': 'حالة تجير البطاقة الجمركية',
    'field.entryDate': 'تاريخ الدخول',
    'field.notes': 'ملاحظات',
    'field.seller': 'البائع',
    'field.buyer': 'المشتري / المستلم',
    'field.telephone': 'الهاتف',
    'field.national_id': 'الهوية الوطنية / الإقامة',
    'field.exit_date': 'تاريخ الخروج',
    'field.delivery_type': 'طريقة الاستلام',
    'field.actions': 'الإجراءات',
    'field.no': 'م',

    // Car Status Values
    'status.available': 'متوفرة',
    'status.reserved': 'محجوزة',
    'status.sold': 'مباعة',
    'status.not_for_sale': 'غير معروضة للبيع',
    'status.rented': 'مجير',
    'status.not_rented': 'لم يتم التجير',
    'ownership.direct': 'مباشر',
    'ownership.distribution': 'تصريف',

    // Dashboard Items
    'dash.totals': 'الإحصائيات العامة للمستودع',
    'dash.total_cars': 'إجمالي السيارات بالمستودع',
    'dash.total_value': 'إجمالي قيمة المخزون الحالي',
    'dash.total_cost': 'إجمالي تكلفة المخزون',
    'dash.expected_profit': 'الأرباح المتوقعة عند البيع الكامل',
    'dash.available_cars': 'سيارات جاهزة للبيع ومكتملة',
    'dash.reserved_cars': 'سيارات محجوزة بدفعة أولى',
    'dash.sold_cars': 'مبيعات حرة وخارجة',
    'dash.rental_stats': 'إحصائيات تجير البطاقات',
    'dash.rented_percent': 'نسبة البطاقات المجيرة',
    'dash.recent_logs': 'سجل العمليات والتحقق الفوري',
    'dash.recent_logs_sub': 'نظام تدقيق متكامل لتتبع حركات الأمان والمخزون في الوقت الحقيقي',
    'dash.quick_actions': 'الوصول السريع والمهام الفورية',
    'dash.add_shortcut': 'إضافة مركبة جديدة',
    'dash.reports_shortcut': 'تنزيل تقارير حركة المخزون',
    'dash.users_shortcut': 'إدارة الموظفين والصلاحيات',
    'dash.backup_shortcut': 'إنشاء نسخة احتياطية آمنة',
    'dash.brand_distribution': 'توزيع المخزون بحسب الماركة التجارية',
    'dash.status_distribution': 'التحليل البياني لحالات المخزون',

    // Car Manager / Inventory
    'inv.title': 'المخازن ومستودع السيارات',
    'inv.subtitle': 'البحث عن السيارة، معالجة البيانات، والتحكم التام بالأعداد والأصول المتوفرة',
    'inv.all_cars': 'كل السيارات المتوفرة والمباعة',
    'inv.bulk_delete': 'حذف جماعي محدد',
    'inv.add_title': 'إضافة سيارة جديدة للمستودع',
    'inv.edit_title': 'تعديل تفاصيل السيارة',
    'inv.confirm_delete': 'هل أنت متأكد من رغبتك في حذف السيارة؟ لا يمكن التراجع عن هذا الإجراء.',
    'inv.confirm_bulk_delete': 'هل أنت متأكد من حذف السيارات المحددة؟ سيتم حذفها نهائياً.',
    'inv.success_add': 'تمت إضافة السيارة بنجاح في سجلات المستودع.',
    'inv.success_update': 'تم تعديل بيانات السيارة وتأمين تفاصيلها.',

    // Sales Manager
    'sales.title': 'المبيعات والخروج اليومي',
    'sales.subtitle': 'تنظيم وتوثيق عمليات البيع، الخروج، وتفاصيل المستلمين بشكل فوري وكامل',
    'sales.sell_car': 'إجراء عملية خروج / بيع',
    'sales.exit_details': 'تفاصيل المستلم والتسليم المعتمد',
    'sales.delivery_owner': 'صاحبها بنفسه',
    'sales.delivery_transport': 'شركة نقليات معتمدة',
    'sales.delivery_other': 'مستلم ووكيل آخر',

    // Reports Manager
    'reports.title': 'التقارير اليومية والمجمعة',
    'reports.subtitle': 'تتبع الحركات التاريخية ومقارنة الأرصدة الافتتاحية والمغلقة مع تفاصيل الصفقات وسجلات المشتريات والمبيعات مع المساعد الذكي',
    'reports.table_header': 'تاريخ حركة المستودع والتدقيق اليومي',
    'reports.opening': 'الرصيد الافتتاحي',
    'reports.closing': 'الرصيد المغلق',
    'reports.entered_details': 'التفاصيل الداخلة اليوم (الماركة والموديل | الهيكل | ملاحظات)',
    'reports.exited_details': 'التفاصيل الخارجة اليوم (الماركة والموديل | الهيكل | البائع | ملاحظات)',
    'reports.status_perfect': 'مطابق ومغلق',
    'reports.status_warning': 'يوجد حركة مرورية نشطة',
    'reports.no_entriess': 'لا توجد عمليات دخول اليوم',
    'reports.no_exitiess': 'لا توجد عمليات خروج اليوم',

    // Database / Maintenance
    'db.title': 'صيانة البيانات والنسخ الاحتياطي',
    'db.subtitle': 'أمان نظام مخزوني برو وقاعدة البيانات المشفرة والنسخ الاحتياطي السحابي التلقائي مع Drive',
    'db.backup_now': 'نسخة احتياطية على الكمبيوتر',
    'db.restore': 'استعادة البيانات من ملف خارجي',
    'db.cloud': 'المزامنة السحابية وشبكة الحماية',

    // Settings
    'settings.title': 'لوحة إعدادات النظام والهوية',
    'settings.subtitle': 'تخصيص الخيارات الافتراضية، رفع الشعار، تخصيص حقول الإدخال الإضافية للمركبات والمشترين والمستندات',
    'settings.org_details': 'بيانات الكيان والمعرض الأساسية',
    'settings.org_name': 'اسم المنشأة / المعرض',
    'settings.contact': 'رقم التواصل والاتصال المباشر',
    'settings.tax_no': 'الرقم الضريبي الموحد',
    'settings.comm_register': 'السجل التجاري التابع للمنشأة',
    'settings.currency': 'العملة المعيارية للنظام',
    'settings.low_stock': 'حد التحذير للأرصدة المنخفضة',
    'settings.custom_fields_m': 'إدارة وتخصيص الحقول المتقدمة المضافة للمركبات',

    // Language Toggle
    'lang.toggle_btn': 'English',
    'lang.current': 'العربية'
  },
  en: {
    // Nav / Sidebar
    'nav.dashboard': 'Control Dashboard',
    'nav.inventory': 'Inventory Depot',
    'nav.sales': 'Sales & Dispatch',
    'nav.reports': 'Business Reports',
    'nav.users': 'Users & Privileges',
    'nav.customers': 'Customers',
    'nav.backup': 'Database & Backup',
    'nav.updates': 'System Upgrades',
    'nav.settings': 'App Settings',
    'nav.about': 'About Platform & Dev',
    'nav.logout': 'Secure Sign Out',
    'nav.developer': 'Developer: Karian Digital Platform',

    // Shared UI
    'system.title': 'Makhzouni Pro',
    'system.subtitle': 'Vehicle Asset Management',
    'system.aes_active': 'AES-256 Encryption Active',
    'system.decryption': 'Decrypting secure vault data...',
    'system.military_encryption': 'Military AES-256 Encryption Active',
    'system.admin_current': 'Current Handler',
    'system.system_bot': 'Smart System',

    // Common Buttons & Actions
    'action.save': 'Save Changes',
    'action.cancel': 'Cancel',
    'action.delete': 'Delete',
    'action.edit': 'Edit',
    'action.add': 'Add New',
    'action.add_bulk': 'Bulk Import',
    'action.search': 'Search...',
    'action.export_excel': 'Export Consolidated Excel',
    'action.export_single': 'Export Daily Report',
    'action.clear': 'Clear',
    'action.add_car': 'Add Vehicle',
    'action.update': 'Update Details',
    'action.close': 'Close',
    'action.copy_success': 'Copied successfully!',
    'action.copy': 'Copy',

    // Fields
    'field.brand': 'Vehicle / Car',
    'field.model': 'Model / Trim',
    'field.year': 'Model Year',
    'field.color': 'Exterior Color',
    'field.vin': 'Chassis Number (VIN)',
    'field.cardNumber': 'Serial Card Number',
    'field.price': 'Selling Price',
    'field.costPrice': 'Cost Price',
    'field.supplier': 'Supplier / Vendor',
    'field.ownershipType': 'Ownership Model',
    'field.status': 'Vehicle Status',
    'field.rentalStatus': 'Endorsement Status',
    'field.entryDate': 'Entry Date',
    'field.notes': 'Observations / Notes',
    'field.seller': 'Sales Representative',
    'field.buyer': 'Customer Name (Receiver)',
    'field.telephone': 'Phone Number',
    'field.national_id': 'National ID / Iqama',
    'field.exit_date': 'Dispatch Date',
    'field.delivery_type': 'Handover Method',
    'field.actions': 'Actions',
    'field.no': 'No.',

    // Car Status Values
    'status.available': 'Available',
    'status.reserved': 'Reserved',
    'status.sold': 'Sold / Settled',
    'status.not_for_sale': 'Not for Sale',
    'status.rented': 'Commissioned',
    'status.not_rented': 'Uncommissioned',
    'ownership.direct': 'In-Stock Purchase',
    'ownership.distribution': 'Consignment Sale',

    // Dashboard Items
    'dash.totals': 'General Warehouse Statistics',
    'dash.total_cars': 'Total Vehicles in Warehouse',
    'dash.total_value': 'Total Current Stock Value',
    'dash.total_cost': 'Total Current Inventory Cost',
    'dash.expected_profit': 'Projected Revenue Margin',
    'dash.available_cars': 'Available and Ready Vehicles',
    'dash.reserved_cars': 'Vehicles Reserved with Deposit',
    'dash.sold_cars': 'Dispatched & Completed Sales',
    'dash.rental_stats': 'Endorsement Tracking',
    'dash.rented_percent': 'Endorsed Cards Percentage',
    'dash.recent_logs': 'System Activity Audit Log',
    'dash.recent_logs_sub': 'Real-time integrated audit logs for tracking database safety and item entries',
    'dash.quick_actions': 'Quick Shortcuts & Tasks',
    'dash.add_shortcut': 'Register New Vehicle',
    'dash.reports_shortcut': 'Generate Stock Reports',
    'dash.users_shortcut': 'Manage Guards & Staff',
    'dash.backup_shortcut': 'Secure Vault Backup',
    'dash.brand_distribution': 'Inventory Balance by Vehicle Brand',
    'dash.status_distribution': 'Analytical Status Charting',

    // Car Manager / Inventory
    'inv.title': 'Main Warehouse & Stock Yard',
    'inv.subtitle': 'Run intelligent searches, correct entries, and audit digital assets inside active stores',
    'inv.all_cars': 'Entire Active & Sales Records',
    'inv.bulk_delete': 'Delete Checked Rows',
    'inv.add_title': 'Add New Stock Vehicle',
    'inv.edit_title': 'Modify Vehicle Parameters',
    'inv.confirm_delete': 'Are you sure you want to remove this vehicle? This action cannot be undone.',
    'inv.confirm_bulk_delete': 'Are you sure you want to wipe the selected vehicles? This is absolute.',
    'inv.success_add': 'Vehicle has been successfully registered to warehouse inventories.',
    'inv.success_update': 'Vehicle details have been securely modified and synchronized.',

    // Sales Manager
    'sales.title': 'Sales Settlement & Cargo Out',
    'sales.subtitle': 'Log customer receipts, handle delivery authorizations and record sellers on the spot',
    'sales.sell_car': 'Establish Dispatch / Sale',
    'sales.exit_details': 'Receiver & Authorized Transport Data',
    'sales.delivery_owner': 'Owner In Person',
    'sales.delivery_transport': 'Registered Transport Fleet',
    'sales.delivery_other': 'Delegated Agent / Proxy',

    // Reports Manager
    'reports.title': 'Daily & Consolidated Records',
    'reports.subtitle': 'Track historical movements, compare opening balances, audit inbound and outbound vehicles',
    'reports.table_header': 'Warehouse Daily Audit History',
    'reports.opening': 'Opening Balance',
    'reports.closing': 'Closing Balance',
    'reports.entered_details': 'Daily Inbound Details (Make/Trim | VIN | Notes)',
    'reports.exited_details': 'Daily Outbound Details (Make/Trim | VIN | Seller | Notes)',
    'reports.status_perfect': 'Balanced & Settled',
    'reports.status_warning': 'Active Movements Recorded',
    'reports.no_entriess': 'No inbound activity',
    'reports.no_exitiess': 'No outbound activity',

    // Database / Maintenance
    'db.title': 'System Service & Encryption Vault',
    'db.subtitle': 'Secure cloud sync controls, local database formatting, and manual integrity validation keys',
    'db.backup_now': 'Download Archive File',
    'db.restore': 'Upload Restore Archive',
    'db.cloud': 'Cloud Synch & Resilience Network',

    // Settings
    'settings.title': 'Identity & Global Profiles',
    'settings.subtitle': 'Control currency markers, company info, store headers, low stock warnings, and custom fields',
    'settings.org_details': 'Enterprise Information & Profile',
    'settings.org_name': 'Establishment / Exhibition Name',
    'settings.contact': 'Corporate Contact Line',
    'settings.tax_no': 'Unified Value Added Tax (VAT)',
    'settings.comm_register': 'Government Commercial Registry',
    'settings.currency': 'Default System Currency',
    'settings.low_stock': 'Low Balance Alert Limit',
    'settings.custom_fields_m': 'Create Custom Dynamic Fields',

    // Language Toggle
    'lang.toggle_btn': 'العربية',
    'lang.current': 'English'
  }
};

const arabicToEnglishMap: Record<string, string> = {
  // Navigation / Sidebar and Core UI
  'لوحة التحكم': 'Control Dashboard',
  'إدارة المخزون': 'Inventory Depot',
  'المبيعات': 'Sales & Dispatch',
  'التقارير': 'Business Reports',
  'المالمستخدمين والأمان': 'Users & Privileges',
  'المستخدمين والأمان': 'Users & Privileges',
  'قاعدة البيانات': 'Database & Backup',
  'الترقيات': 'System Upgrades',
  'الإعدادات': 'App Settings',
  'حول المنصة والمطور': 'About Platform & Dev',
  'تسجيل الخروج الآمن': 'Secure Sign Out',
  'تطوير: منصة كاريان الرقمية': 'Developer: Karian Digital Platform',
  'مخزوني برو': 'Makhzouni Pro',
  'إدارة أصول السيارات': 'Vehicle Asset Management',
  'تشفير AES-256 نشط': 'AES-256 Encryption Active',
  'جاري فك تشفير البيانات الآمنة...': 'Decrypting secure vault data...',
  'تشفير عسكري AES-256 نشط': 'Military AES-256 Encryption Active',
  'المسؤول الحالي': 'Current Handler',
  'نظام ذكي': 'Smart System',

  // Common Buttons & Actions
  'حفظ التغييرات': 'Save Changes',
  'إلغاء': 'Cancel',
  'حذف': 'Delete',
  'تعديل': 'Edit',
  'إضافة جديد': 'Add New',
  'إستيراد جماعي': 'Bulk Import',
  'البحث عن السيارة...': 'Search for vehicle...',
  'بحث...': 'Search...',
  'تصدير إكسل مجمع': 'Export Consolidated Excel',
  'تصدير التقرير اليومي مجمع': 'Export Daily Report',
  'مسح': 'Clear',
  'إضافة سيارة': 'Add Vehicle',
  'تحديث': 'Update',
  'إغلاق': 'Close',
  'تم النسخ بنجاح!': 'Copied successfully!',
  'نسخ': 'Copy',
  'طباعة': 'Print',
  'السماح بالنوافذ المنبثقة': 'Allow popups',

  // Fields and General Labels
  'الماركة': 'Make / Brand',
  'الطراز': 'Model / Trim',
  'الموديل': 'Model Year',
  'الموديل / السنة': 'Model Year',
  'اللون': 'Exterior Color',
  'رقم الهيكل': 'Chassis Number (VIN)',
  'الرقم التسلسلي / البطاقة': 'Serial Card Number',
  'سعر البيع': 'Selling Price',
  'سعر التكلفة': 'Cost Price',
  'المورد': 'Supplier / Vendor',
  'طبيعة الملكية': 'Ownership Model',
  'حالة السيارة': 'Vehicle Status',
  'حالة الإيجار / التفويض': 'Commission/Rental Status',
  'تاريخ الدخول': 'Entry Date',
  'ملاحظات': 'Observations / Notes',
  'البائع': 'Sales Representative',
  'المشتري / المستلم': 'Customer Name (Receiver)',
  'الهاتف': 'Phone Number',
  'الهوية الوطنية / الإقامة': 'National ID / Iqama',
  'تاريخ الخروج': 'Dispatch Date',
  'طريقة الاستلام': 'Handover Method',
  'الإجراءات': 'Actions',
  'م': 'No.',
  'الخيارات الأسبوعية والتحويل المالي الأساسي': 'Weekly options and core financial transfers',

  // Status Values
  'متوفرة': 'Available',
  'محجوزة': 'Reserved',
  'مباعة': 'Sold / Settled',
  'غير معروضة للبيع': 'Not for Sale',
  'مجير': 'Commissioned',
  'لم يتم التجير': 'Uncommissioned',
  'مباشر': 'In-Stock Purchase',
  'تصريف': 'Consignment Sale',

  // Dashboard Specific Labels
  'الإحصائيات العامة للمستودع': 'General Warehouse Statistics',
  'إجمالي السيارات بالمستودع': 'Total Vehicles in Warehouse',
  'إجمالي قيمة المخزون الحالي': 'Total Current Stock Value',
  'إجمالي تكلفة المخزون': 'Total Current Inventory Cost',
  'الأرباح المتوقعة عند البيع الكامل': 'Projected Revenue Margin',
  'سيارات جاهزة للبيع ومكتملة': 'Available and Ready Vehicles',
  'سيارات محجوزة بدفعة أولى': 'Vehicles Reserved with Deposit',
  'مبيعات حرة وخارجة': 'Dispatched & Completed Sales',
  'إحصائيات التفويضات وحركة السير': 'Security Commission Tracking',
  'نسبة السيارات الـمجيرة للتفويض': 'Commissioned Vehicles Percentage',
  'سجل العمليات والتحقق الفوري': 'System Activity Audit Log',
  'نظام تدقيق متكامل لتتبع حركات الأمان والمخزون في الوقت الحقيقي': 'Real-time integrated audit logs for tracking database safety and item entries',
  'الوصول السريع والمهام الفورية': 'Quick Shortcuts & Tasks',
  'إضافة سيارة جديدة': 'Register New Vehicle',
  'تنزيل تقارير حركة المخزون': 'Generate Stock Reports',
  'إدارة الموظفين والصلاحيات': 'Manage Guards & Staff',
  'إنشاء نسخة احتياطية آمنة': 'Secure Vault Backup',
  'توزيع المخزون بحسب الماركة التجارية': 'Inventory Balance by Vehicle Brand',
  'التحليل البياني لحالات المخزون': 'Analytical Status Charting',
  'أهلاً بك في فترتك الليلية': 'Welcome to your night shift period',
  'صباح الخير واليُمن': 'Good morning',
  'طاب يومك بكل خير': 'Have a wonderful day',
  'مساء الخير والبركة': 'Good evening',
  'تحليل القيمة السوقية التدريجي': 'Incremental Market Value Analysis',
  'تطور قيمة مخزون المعرض': 'Exhibition Stock Value Trend',
  'الرصد الهندسي والتراكمي لغلة وقيمة الأصول': 'Cumulative and engineering tracking of asset values and yields',
  '6 أشهر ماضية': '6 Months Past',
  'متوفر للبيع': 'Available for Sale',
  'محجوز مؤقتاً': 'Temporarily Reserved',
  'مباع نهائياً': 'Permanently Sold',
  'تحت التجير': 'Under Endorsement',
  'قيمة المقدرة': 'Estimated Value',
  'اختصارات سريعة': 'Quick Shortcuts',
  'لوحة القيادة': 'Dashboard Panel',
  'تصدير جرد': 'Export Inventory',
  'صلاحيات المستخدم نشطة': 'Active User Privileges',
  'إجراءات سريعة واختصارات منسقة': 'Quick actions and structured shortcuts',

  // Inventory Depot Specific Labels
  'المخازن ومستودع السيارات': 'Main Warehouse & Stock Yard',
  'البحث عن السيارة، معالجة البيانات، والتحكم التام بالأعداد والأصول المتوفرة': 'Search, process data, and take complete control of available assets',
  'كل السيارات المتوفرة والمباعة': 'Entire Active & Sales Records',
  'حذف جماعي محدد': 'Delete Checked Rows',
  'إضافة سيارة جديدة للمستودع': 'Add New Stock Vehicle',
  'تعديل تفاصيل السيارة': 'Modify Vehicle Parameters',
  'البحث بحسب الماركة، رقم الهيكل، المورد أو مالك السيارة...': 'Search by brand, chassis number (VIN), supplier or owner...',
  'تصفية بحسب': 'Filter by',
  'حالة السيارة (الكل)': 'Vehicle Status (All)',
  'الملكية (الكل)': 'Ownership (All)',
  'ترتيب بحسب': 'Sort by',
  'الأحدث دخولاً': 'Recently Added',
  'الأعلى سعراً': 'Highest Price',
  'الأقل سعراً': 'Lowest Price',
  'الماركة تصاعدياً': 'Brand (A-Z)',
  'صورة السيارة': 'Vehicle Image',
  'تاريخ التسجيل': 'Registration Date',
  'سعر بيع': 'Retail Price',
  'القيمة التقديرية للأرباح': 'Estimated Profit Margin',
  'حالة ترخيص السير للتفويض': 'Vehicle Commission Status',
  'طبيعة ملكية': 'Ownership Type',
  'تاريخ الإدخال لفرع المعرض': 'Warehouse Admission Date',
  'سجل الملاحظات': 'Notes Register',
  'قائمة الحقول المخصصة الإضافية': 'Custom Appended Fields List',
  'لم تضف ملاحظات': 'No notes added',
  'مستخدم': 'User',
  'دور': 'Role',
  'نسخ الرقم': 'Copy No.',

  // Add Car Modal Labels
  'بيانات السيارة الفنية والأساسية': 'Basic & Technical Vehicle Info',
  'يرجى إدخال اسم الماركة التجارية المصنعة': 'Please enter manufacturer brand name',
  'مثال: كامري، لاندكروزر، ألتيما...': 'e.g. Camry, Land Cruiser, Altima...',
  'الذهاب لملء تفاصيل الموديل والنوع': 'Next: Enter model parameters',
  'موديل سنة الصنع': 'Model Year of Manufacture',
  'اللون الخارجي': 'Exterior Paint Color',
  'اللون الخارجي الدقيق للمركبة': 'Precise exterior color',
  'رقم الهيكل التسلسلي (VIN)': 'Chassis Serial Number (VIN)',
  'أدخل الـ VIN المكون من 17 حرفاً ورقماً': 'Input the 17-character VIN number',
  'بطاقة جمركية أو رقم اللوحة أو المعرف': 'Customs card, plate number or ID',
  'سعر تكلفة الشراء أو القيمة التقييمية': 'Purchase cost price / valuation',
  'سعر إعادة البيع والبيع المقترح': 'Suggested retail selling price',
  'مورد السيارة أو الجهة المالكة الأصلية': 'Original supplying entity or vendor',
  'ملاحظات إضافية، أعطال أو حوادث': 'Extra notes, damage or remarks',
  'إدارة الخيارات الحرة وحالة السيارة': 'Status & Model Free Fields',
  'السيارات المباعة والخارجة لا يمكن تعديل حالتها يدوياً': 'Manual status changes are locked for sold and dispatched vehicles',
  'حالة التفويض التجاري للسيارة': 'Commercial authorization commission status',
  'السيارة مجيرة': 'Vehicle Commissioned',
  'السيارة لم تجير': 'Vehicle Uncommissioned',

  // Sales and dispatch Specific Labels
  'المبيعات والخروج اليومي': 'Sales Settlement & Cargo Out',
  'تنظيم وتوثيق عمليات البيع، الخروج، وتفاصيل المستلمين بشكل فوري وكامل': 'Log customer receipts, handle delivery authorizations and record sellers',
  'إجراء عملية خروج / بيع': 'Establish Dispatch / Sale',
  'مكتمل المبيعات': 'Finished Sales & Dispatches',
  'البحث في السجلات بمشتري، بائع، ماركة أو رقم الهيكل...': 'Search records by buyer, seller, brand or chassis number (VIN)...',
  'تاريخ البداية': 'Start Date',
  'تاريخ النهاية': 'End Date',
  'تحميل تقرير مالي ومطابقة': 'Download Financial & Reconciliation Audit',
  'طباعة إذن استلام مخزني': 'Print Warehouse Intake Permit',
  'طباعة بطاقة حركة سيارة': 'Print Vehicle Dispatch Card',
  'تفاصيل المستلم والتسليم المعتمد': 'Receiver & Authorized Handover Details',
  'الاسم الرباعي للمستلم / المشتري': 'Full Name of Customer (Receiver)',
  'رقم الهاتف الجوال الفعال': 'Active Mobile Phone Number',
  'رقم الهوية الوطنية أو الإقامة': 'National ID or Resident Iqama Number',
  'تحديد طريقة وطبيعة استلام السيارة': 'Determine Handover & Delivery Model',
  'طريقة الاستلام الفورية': 'Immediate Delivery Method',
  'صاحبها بنفسه': 'Owner In Person',
  'شركة نقليات معتمدة': 'Registered Transport Fleet',
  'مستلم ووكيل آخر': 'Delegated Agent / Proxy',
  'تثبيت الخروج والبيع': 'Confirm Dispatch & Sale Settlement',
  'المستلم المعمّد': 'Authorized Customer',
  'رقم جوال': 'Mobile Phone',
  'طريقة التسليم': 'Delivery Method',
  'تأكيد إنهاء الصفقة': 'Confirm & Settle Sale Transaction',
  'تاريخ وتوقيت البيع': 'Date & Time of Sale',
  'تفاصيل الخروج والبيع بالتفصيل': 'Detailed Sales & Outbound logs',

  // Reports Specific Labels
  'التقارير اليومية والمجمعة': 'Daily & Consolidated Records',
  'تتبع الحركات التاريخية ومقارنة الأرصدة الافتتاحية والمغلقة مع تفاصيل الصفقات وسجلات المشتريات والمبيعات مع المساعد الذكي': 'Track historic movements, compare balances, audit inbound and outbound vehicles',
  'تاريخ حركة المستودع والتدقيق اليومي': 'Warehouse Daily Audit History',
  'الرصيد الافتتاحي': 'Opening Balance',
  'الرصيد المغلق': 'Closing Balance',
  'التفاصيل الداخلة اليوم': 'Entered Today',
  'التفاصيل الخارجة اليوم': 'Exited Today',
  'حالة السجلات': 'Audit Status',
  'آخر تحديث': 'Last Update',
  'تصدير التقرير اليومي الموحد': 'Export Consolidated Daily Audit',
  'مطابق لم يعثر على فروقات اليوم': 'Matched & Settled (No discrepancies)',
  'مغلق ومطابق': 'Closed and settled',
  'يوجد حركة مرورية نشطة': 'Active Movements Recorded',
  'لا توجد عمليات دخول اليوم': 'No inbound activity today',
  'لا توجد عمليات خروج اليوم': 'No outbound activity today',
  'الرصيد المقفل': 'Closing Balance',
  'حالة المخزون': 'Stock Status',
  'تاريخ التقرير': 'Report Date',
  'تحليل المساعد الذكي التلقائي للجرد المالي وحركات المخزون': 'AI Intelligence Assistant Financial and Inventory Audit Analysis',
  'يقوم النظام بتحليل حركات المخزون وتفصيل الصفقات لتقديم ملخص مهني دقيق للأسبوع الحالي': 'The system analyzes warehouse movements and transactions to generate weekly professional summaries',
  'توليد تقرير وتحليل ذكي': 'Generate Intelligent AI Summary',
  'تحليل المساعد الذكي': 'Smart AI Assistant Analysis',

  // Database Management Specific Labels
  'صيانة البيانات والنسخ الاحتياطي': 'System Service & Encryption Vault',
  'أمان نظام مخزوني برو وقاعدة البيانات المشفرة والنسخ الاحتياطي السحابي التلقائي مع Drive': 'Cloud sync, database formatting, local backup downloads and encryption integrity',
  'تخزين وتامين محلي': 'Local Archiving and Encryption',
  'نسخة احتياطية على الكمبيوتر': 'Download Archive File',
  'تنزيل نسخة احتياطية محلية مشفرة بـ AES تحتوي عل كافة سجلات السيارات والمبيعات والموظفين بالكامل': 'Download complete locally-encrypted AES archive containing cars, sales and user lists',
  'استعادة البيانات من ملف خارجي': 'Upload Restore Archive',
  'انقر لرفع ملف النسخة الاحتياطية وتحديث قاعدة بيانات النظام المشفرة على الفور': 'Upload previously exported system database backup and force immediate decryption overwrite',
  'تفعيل المزامنة السحابية': 'Cloud Synchronization Status',
  'مزامنة قوقل درايف': 'Google Drive Cloud Sync',
  'يرجى تفعيل المزامنة للمحافظة على أمان البيانات في السحابة ومقاومة الكوارث المادية للأجهزة': 'Please enable cloud synchronization to prevent data loss and ensure physical disaster resilience',
  'مزامنة سحابية غير مفعلة': 'Cloud synchronization not activated',
  'المزامنة السحابية غير نشطة': 'Cloud sync offline',
  'خدمات معتمدة': 'Certified Services',
  'استيراد': 'Import',
  'تصدير لتطبيق الجوال': 'Export Mobile App SQLite Db',

  // Language & App Settings Specific Labels
  'لوحة إعدادات النظام والهوية': 'Identity & Global Profiles',
  'تخصيص الخيارات الافتراضية، رفع الشعار، تخصيص حقول الإدخال الإضافية للمركبات والمشترين والمستندات': 'Currency markers, company info, store headers, low stock warning and custom fields',
  'بيانات الكيان والمعرض الأساسية': 'Enterprise Information & Profile',
  'اسم المنشأة / المعرض': 'Establishment / Exhibition Name',
  'رقم التواصل والاتصال المباشر': 'Corporate Contact Line',
  'الرقم الضريبي الموحد': 'Unified Value Added Tax (VAT)',
  'السجل التجاري التابع للمنشأة': 'Government Commercial Registry',
  'العملة المعيارية للنظام': 'Default System Currency',
  'حد التحذير للأرصدة المنخفضة': 'Low Stock Alert Limit',
  'إدارة وتخصيص الحقول المتقدمة المضافة للمركبات': 'Create Custom Dynamic Fields',
  'الحقل المخصص': 'Custom Field',
  'نوع البيانات': 'Data Type',
  'حذف الحقل': 'Remove Field',
  'إضافة حقل مخصص جديد': 'Add New Custom Dynamic Field',
  'نص قصير': 'Short Text',
  'رقم صحيح': 'Numeric Int',
  'تاريخ': 'Date',
  'اختيار منطقي (نعم/لا)': 'Checkbox Boolean (Yes/No)',

  // Users Management Specific Labels
  'المستخدمون والموظفون': 'User Accounts & Authorities',
  'إضافة موظف جديد': 'Register New Employee',
  'اسم المستخدم للدخول': 'User Name for Auth',
  'الاسم الكامل للموظف': 'Employee Full Name',
  'كلمة السر والأمان': 'Access Password',
  'صلاحيات وتفويضات الدور': 'Role & System Authority',
  'مسؤول عام': 'Administrator',
  'حارس بوابات / مخزن': 'Warehouse & Gates Guard',
  'موظف مبيعات': 'Sales Agent',
  'مدقق مالي ومحاسب': 'Accountant & Financial Auditor',
  'تمكين كافة تفويضات النظام': 'Grant Full Admin Access Role',
  'التحكم والتأمين الرقمي': 'Digital Control & Securing',

  // Security center and Activation center
  'مركز تفعيل ترخيص النظام': 'System Software Licensing Core',
  'كود التنشيط الفعال': 'Active License Activation Code',
  'التحقق والتفعيل الفوري': 'Verify and Activate License Now',
  'النظام مفعل بالكامل': 'System Fully Activated',
  'مدة الترخيص': 'Licensing Duration',
  'برمجية مسجلة ومرخصة لـ': 'Software legally registered to',
  'أدخل مفتاح التفعيل الفعال المكون من 32 حرفاً': 'Input the 32-character software activation license key',
  'تم التحقق من الترخيص': 'License Checked and Validated',

  // Alerts, Errors & Success
  'خطأ في اسم المستخدم أو كلمة المرور. يرجى المحاولة مرة أخرى.': 'Invalid username or password. Please try again.',
  'حدث خطأ أثناء محاولة الدخول. يرجى التواصل مع المسؤول برمجياً.': 'Error during sign in. Please contact the administrator.',
  'تم تسجيل الدخول بنجاح': 'Log in completed successfully',
  'أهلاً بك مجدداً': 'Welcome back',
  'سجلات الأمان': 'System Logs',
  'تصفية السجلات بحسب نوع المصدر': 'Filter logs by system source',
  'حذف السجل بالكامل': 'Clear all activities log',

  // Fallbacks and basic words
  'تم': 'Done',
  'إضافة': 'Added',
  'حذف سيارة': 'Deleted vehicle',
  'حذف جماعي': 'Bulk delete',
  'تفويض': 'Delegation',
  'سيارات': 'vehicles',
  'سيارة': 'vehicle',
  'مركبة': 'vehicle',
  'يوم': 'Day',
  'يوماً': 'days',
  'دخول': 'entry',
  'خروج': 'exit',
  'العمليات': 'operations',
  'تأمين': 'secured',
  'بنجاح': 'successfully',
  'المشترين': 'buyers',
  'المشترك': 'subscriber',
  'مركبات': 'vehicles',
  'المستودع': 'warehouse',
  'المعرض': 'exhibition',
  'أهلاً': 'Welcome',
  'التحويل': 'Switch',
  'عربي': 'Arabic',
  'انجليزى': 'English',
  'العربية': 'Arabic',
  'مرحبا': 'Hello',
  'تنزيل': 'Download',
  'عرض': 'View',
  'اخفاء': 'Hide',
  'نشط': 'Active',
  'غير نشط': 'Inactive',

  // Smart Search specific translations
  'مربع البحث الذكي للمخزون': 'Smart Inventory Search Engine',
  'البحث بحسب الماركة، الموديل، رقم الهيكل، المورد أو حتى الملاحظات...': 'Search by brand, trim, VIN, supplier, or notes...',
  'البحث الفوري عن السيارات': 'Instant Vehicle Search',
  'اكتب للبحث الفوري عن أي سيارة في المستودع...': 'Type to instantly search any vehicle in the warehouse...',
  'نتائج البحث السريع': 'Instant Search Results',
  'لم يتم العثور على نتائج تطابق المربع الحالي. يرجى تعديل معيار البحث.': 'No matching vehicles found. Please modify your search query.',
  'عرض تفاصيل السيارة': 'View Vehicle Details',
  'معاينة سريعة': 'Quick View',
  'سجل السيارة الفني والبيانات المعتمدة': 'Registered Vehicle Specifications & Log',
  'سعر وتكاليف الأصل': 'Asset Valuation & Costs',
  'الذهاب لصفحة المخزن بالتصفية الفعالة': 'Go to Inventory with Active Filters',
  'طبيعة الاستحواذ والمالك': 'Acquisition & Owner Status',
  'معلومات إضافية وملاحظات الصيانة': 'Extra Info & Service Notes',
  'جاهز للبيع ومكتمل': 'Settled & Ready to Sell',
  'محجوز بدفعة مادية': 'Reserved with Deposit',
  'مباع وتم التسليم': 'Dispatched & Sold',
  'سيارة مجيرة تحت التفويض': 'Commissioned under authorization',
  'سيارة غير مجيرة': 'Uncommissioned vehicle',
  'تصفية بـ': 'Filter by',
  'اختبارات سريعة واقتراحات': 'Quick Suggestions',
  'متوفرة بالمخزن': 'Available in stock',
  'محجوزة لعملاء': 'Reserved for clients',
  'مباعة نهائياً': 'Sold permanently',
  'سيارات مجيرة': 'Commissioned vehicles',
  'الرجوع للوحة القيادة': 'Return to Dashboard',
  'البائع المسؤول الحالي': 'Responsible Sales Representative',
  'المشتري / المستسلم الحالي': 'Current Settle Buyer',
  'رقم الجوال الخاص بالمستلم': 'Receiver Mobile Number',
  'رقم هوية أو إقامة المستلم': 'Receiver ID / Iqama',
  'طريقة وتاريخ التسلّم': 'Delivery Date & Handover Method',

  // Password recovery specific translations
  'نسيت كلمة السر؟': 'Forgot Password?',
  'استعادة كلمة المرور آلياً': 'Automated Password Recovery',
  'أدخل اسم المستخدم لتحديد الحساب المفقود': 'Enter username to identify the lost account',
  'البريد الإلكتروني المخصص للإرسال الموحد': 'Unified custom recipient emails',
  'تأكيد استعادة بيانات الدخول تلقائياً': 'Confirm automatic login data recovery',
  'إرسال كلمة المرور القديمة': 'Send Old Password',
  'طلب كود التحقق / تحديث كلمة المرور': 'Request Verification Code / Reset Password',
  'جاري التحقق من اسم المستخدم ومراجعة البيانات...': 'Verifying username and checking records...',
  'الرجاء إدخال اسم المستخدم الصحيح للتحقق...': 'Please enter core username to verify...',
  'الاسم المدخل غير موجود في السجل التابع للموظفين الآمن...': 'The entered username is not found in the secure system registers...',
  'تم إرسال البريد بنجاح!': 'Email sent successfully!',
  'بروتوكول SMTP مؤمن نشط الآن': 'Secure SMTP protocol is active now',
  'تم إرسال كلمة المرور القديمة المشفرة تلقائياً بنجاح إلى:': 'The encrypted old password has been automatically sent to:',
  'و تم تسجيل الحركة في سجل عمليات الأمان الموحد.': 'and the action is logged in the unified safety audit logs.',
  'التحقق من كود الأمان لتعديل كلمة المرور': 'Verify security code to change password',
  'كود التحقق الآمن مكوّن من 6 أرقام': 'Secure check code consist of 6 digits',
  'أدخل الكود': 'Enter core code',
  'كود التحقق خاطئ أو غير مطابق!': 'Verification code is invalid or incorrect!',
  'أدخل كلمة المرور الجديدة': 'Enter new password',
  'حفظ كلمة المرور الجديدة': 'Save New Password',
  'أهلاً بك، يرجى ملء بيانات اسم المستخدم أولاً': 'Welcome, please fill in username first',
  'رمز التحقق للتحقق الفوري هو': 'Immediate check verification code is',
  'تم تحديث كلمة المرور بنجاح! يمكن تسجيل الدخول بالجديدة': 'Password updated successfully! You can log in with the new one'
};

const sortedKeys = Object.keys(arabicToEnglishMap).sort((a, b) => b.length - a.length);

const translateText = (text: string): string => {
  let trimmed = text.trim();
  if (!trimmed) return text;

  // Exact match
  if (arabicToEnglishMap[trimmed]) {
    return text.replace(trimmed, arabicToEnglishMap[trimmed]);
  }

  // Exact match stripping typical leading/trailing emoji/icon
  const cleanAr = trimmed.replace(/[📅📥📤📊⚙️👤🔒🔑💾🔄🛒📦💵📉📈🚫⚠️✅💡🤖]/g, '').trim();
  if (arabicToEnglishMap[cleanAr]) {
    return text.replace(cleanAr, arabicToEnglishMap[cleanAr]);
  }

  let result = text;
  for (const key of sortedKeys) {
    if (result.includes(key)) {
      result = result.replaceAll(key, arabicToEnglishMap[key]);
    }
  }
  return result;
};

const translateDOM = () => {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null
  );

  let node;
  while ((node = walker.nextNode())) {
    const parent = node.parentNode as HTMLElement;
    if (parent) {
      const tagName = parent.tagName?.toLowerCase();
      // Skip script, style & code editors
      if (tagName === 'script' || tagName === 'style' || tagName === 'code' || tagName === 'textarea') {
        continue;
      }
    }

    const val = node.nodeValue || '';
    if (val.trim() && /[\u0600-\u06FF]/.test(val)) {
      node.nodeValue = translateText(val);
    }
  }

  // Handle placeholders
  const inputs = document.querySelectorAll('input[placeholder]');
  inputs.forEach(input => {
    const placeholder = input.getAttribute('placeholder') || '';
    if (placeholder && /[\u0600-\u06FF]/.test(placeholder)) {
      input.setAttribute('placeholder', translateText(placeholder));
    }
  });

  // Handle select options
  const options = document.querySelectorAll('option');
  options.forEach(opt => {
    const text = opt.textContent || '';
    if (text && /[\u0600-\u06FF]/.test(text)) {
      opt.textContent = translateText(text);
    }
  });
};

const LanguageContext = createContext<TranslationContextProps | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('app_lang');
    return (saved === 'en' || saved === 'ar') ? saved : 'ar';
  });

  useEffect(() => {
    localStorage.setItem('app_lang', lang);
    if (lang === 'ar') {
      document.body.dir = 'rtl';
      document.body.classList.remove('lang-en');
      document.body.classList.add('lang-ar');
    } else {
      document.body.dir = 'ltr';
      document.body.classList.remove('lang-ar');
      document.body.classList.add('lang-en');
    }

    if (lang === 'en') {
      // Run once
      translateDOM();

      const timer1 = setTimeout(translateDOM, 100);
      const timer2 = setTimeout(translateDOM, 500);
      const timer3 = setTimeout(translateDOM, 1500);

      // Setup MutationObserver
      const observer = new MutationObserver((mutations) => {
        let shouldTranslate = false;
        for (const m of mutations) {
          if (m.type === 'childList' && m.addedNodes.length > 0) {
            shouldTranslate = true;
            break;
          } else if (m.type === 'characterData') {
            const val = m.target.nodeValue || '';
            if (/[\u0600-\u06FF]/.test(val)) {
              shouldTranslate = true;
              break;
            }
          }
        }
        if (shouldTranslate) {
          observer.disconnect();
          translateDOM();
          observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
          });
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
        observer.disconnect();
      };
    }
  }, [lang]);

  const t = (key: string): string => {
    try {
      const rawVfs = localStorage.getItem('almakhzoun_vfs');
      if (rawVfs) {
        const vfsObj = JSON.parse(rawVfs);
        if (vfsObj['localization.json']) {
          const parsedLocal = JSON.parse(vfsObj['localization.json']);
          
          // 1. Check for legacy predefined localization key mappings
          const legacyMappings: Record<string, string[]> = {
            "dashboardTitle": ["nav.dashboard", "dash.totals"],
            "inventoryTitle": ["nav.inventory", "inv.title"],
            "salesTitle": ["nav.sales", "sales.title"],
            "reportsTitle": ["nav.reports", "reports.title"],
            "usersTitle": ["nav.users"],
            "backupTitle": ["nav.backup", "db.title"],
            "updatesTitle": ["nav.updates"]
          };
          
          for (const [legacyKey, mappedKeys] of Object.entries(legacyMappings)) {
            if (mappedKeys.includes(key) && parsedLocal[legacyKey] !== undefined) {
              return parsedLocal[legacyKey];
            }
          }

          // 2. Direct exact check (allows overriding any system translation keys, e.g. 'nav.about' or 'system.title')
          if (parsedLocal[key] !== undefined) {
            return parsedLocal[key];
          }

          // 3. Language prefixed check, e.g. "ar.nav.dashboard"
          const langPrefix = `${lang}.${key}`;
          if (parsedLocal[langPrefix] !== undefined) {
            return parsedLocal[langPrefix];
          }
        }
      }
    } catch (err) {
      console.error("VFS Translation lookup error:", err);
    }
    return translations[lang][key] || translations['ar'][key] || key;
  };

  const changeLang = (l: Language) => {
    setLang(l);
    localStorage.setItem('app_lang', l);
    // Reload dynamically to reset DOM rendering tree state
    window.location.reload();
  };

  const isRtl = lang === 'ar';
  const dir = isRtl ? 'rtl' : 'ltr';

  return (
    <LanguageContext.Provider value={{ lang, setLang: changeLang, t, isRtl, dir }}>
      <div dir={dir} className="h-full w-full">
        {children}
      </div>
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
