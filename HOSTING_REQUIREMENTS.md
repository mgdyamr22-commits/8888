# دليل ومتطلبات الاستضافة والنشر لنظام المخزون برو (HOSTING REQUIREMENTS)

نظام **المخزون برو (Almakhzoun Inventory Pro)** مصمم بالكامل للعمل على **استضافة عادية تدعم Node.js و MySQL** دون الحاجة إلى حاويات (Docker)، أو Kubernetes، أو Google Cloud Run، أو بنية Serverless معقدة.

---

## 1. مخطط البنية التشغيلية (Architecture)

```text
Domain (https://domain.com)
   ↓
Node.js Web Server / Reverse Proxy
   ↓
Express Full-Stack Backend (server.cjs)
   ↓
MySQL Database (Local or Remote)
```

---

## 2. متطلبات الاستضافة والخادم (Hosting & System Requirements)

| المكون | الحد الأدنى المطلوب | الإصدار الموصى به | ملاحظات |
| :--- | :--- | :--- | :--- |
| **Node.js Engine** | `Node.js >= 18.0.0` | `Node.js 20.x LTS` أو `22.x LTS` | مدعوم في cPanel Node.js Selector و VPS |
| **npm Package Manager** | `npm >= 9.0.0` | `npm 10.x+` | لتثبيت الاعتماديات وبناء الحزمة |
| **قاعدة بيانات MySQL** | `MySQL 5.7+` أو `MariaDB 10.3+` | `MySQL 8.0+` | مع دعم ترميز `utf8mb4_unicode_ci` |
| **بروتوكول HTTPS** | مطلوب (SSL/TLS) | Let's Encrypt / cPanel AutoSSL | لتأمين الجلسات ورفع الملفات |
| **الذاكرة العشوائية (RAM)** | `512 MB` كحد أدنى | `1 GB` إلى `2 GB` | للأداء العالي وسرعة الاستجابة |
| **مساحة التخزين** | `500 MB` للنظام | `5 GB+` للمستندات والنسخ | حسب حجم مرفقات السيارات والبطاقات |

---

## 3. صلاحيات المجلدات والتخزين (Directory Write Permissions)

يجب أن يمتلك خادم Node.js صلاحيات القراءة والكتابة (`chmod 755` أو `775`) على المجلدات التالية:

```text
/uploads/             ← مجلد المرفقات والوثائق وصور السيارات وشعارات المؤسسة
/uploads/documents/   ← مجلد خطابات المرور والتفويضات
/uploads/cards/       ← مجلد البطاقات الجمركية والفحص الفني
/uploads/branding/    ← مجلد الشعار والختم الرسمي
/backups/             ← مجلد النسخ الاحتياطية المضغوطة ZIP و JSON
./.mysql_config.json  ← ملف إعدادات الاتصال (ينشئه المثبت التلقائي)
./.installed          ← ملف قفل التثبيت بعد الاكتمال
```

---

## 4. خطوات الرفع والتشغيل (Deployment Steps)

### الخطوة 1: رفع ملفات المشروع إلى الاستضافة
قم برفع ملفات المشروع إلى المجلد المخصص للتطبيق في الاستضافة (مثل مجلد التطبيق في cPanel أو `/var/www/almakhzoun` على السيرفر).

### الخطوة 2: تثبيت الحزم وبناء المشروع
من خلال لوحة تحكم الاستضافة (Terminal أو cPanel Node.js App UI):

```bash
# 1. تثبيت الاعتماديات
npm install

# 2. بناء واجهة React والخادم الإنتاجي
npm run build
```

ينتج عن أمر البناء مجلد `dist/` الذي يحتوي على واجهة React الثابتة وملف تشغيل الخادم `dist/server.cjs`.

### الخطوة 3: بدء تشغيل التطبيق (Production Start)

```bash
# تشغيل الخادم في بيئة الإنتاج
npm start
```

* ملاحظة: في لوحات التحكم مثل **cPanel Node.js App Setup**:
  - حدد **Application Root**: مسار المجلد المرفوع فيه المشروع.
  - حدد **Application Startup File**: `dist/server.cjs` (أو `server.ts` عند استخدام tsx).
  - حدد **Node.js Version**: `20.x` أو `18.x`.
  - انقر على **Start Application**.

---

## 5. التثبيت التلقائي الأول (Self-Installer Workflow)

عند فتح الدومين في المتصفح لأول مرة:
```text
https://yourdomain.com
```

إذا لم يتم تثبيت النظام، يكتشف النظام ذلك تلقائيًا ويعرض **معالج التثبيت الذاتي (Setup Wizard)**:

1. **فحص الخادم**: يقوم المعالج بالتحقق التلقائي من إصدار Node.js وصلاحيات المجلدات ودعم الترميز العربي.
2. **بيانات قاعدة بيانات MySQL**:
   - اسم المضيف (MySQL Host - عادة `localhost`).
   - المنفذ (MySQL Port - افتراضي `3306`).
   - اسم قاعدة البيانات (Database Name).
   - اسم مستخدم قاعدة البيانات (Database User).
   - كلمة مرور قاعدة البيانات (Database Password).
3. **اختبار الاتصال (Test Connection)**: انقر على زر "اختبار الاتصال" للتحقق من صحة البيانات.
4. **تهيئة حساب المشرف والمنشأة**: إدخال بيانات المدير العام ورمز الاسترداد.
5. **بدء التثبيت التلقائي**:
   - إنشاء هيكل قاعدة البيانات (Database Schema).
   - إنشاء كافة الجداول الـ 25 مع الفهارس والمفاتيح الأجنبية (Foreign Keys).
   - تطبيق جميع الترحيلات (Migrations 001 إلى 008).
   - تهيئة الصلاحيات والأدوار الافتراضية.
   - إنشاء حساب المدير العام فائق الصلاحيات.
   - تهيئة سجل إعدادات المنشأة الافتراضي.
   - إنشاء مجلدات التخزين والرفع.
   - قفل المعالج التلقائي بإنشاء ملف `.installed`.
6. **اكتمال التثبيت**: الانتقال مباشرة إلى صفحة تسجيل الدخول والدخول للنظام.

---

## 6. مسارات الـ API المدعومة على نفس الدومين

جميع مسارات الواجهة البرمجية تعمل داخل نفس المشروع وقابلة للوصول مباشرة:

- `https://domain.com/api/health` ← فحص حالة الخادم والاتصال
- `https://domain.com/api/install/status` ← فحص حالة التثبيت
- `https://domain.com/api/auth/login` ← تسجيل دخول المستخدمين
- `https://domain.com/api/cars` ← إدارة أصول وسيارات المخزون
- `https://domain.com/api/sales` ← إدارة المبيعات وسندات الخروج
- `https://domain.com/api/transfers` ← إدارة التحويلات اللوجستية بين الفروع
- `https://domain.com/api/customers` ← قاعدة بيانات العملاء والبحث
- `https://domain.com/api/costs` ← قيود التكاليف والمصروفات
- `https://domain.com/api/letters` ← أرشيف الخطابات والمكاتبات
- `https://domain.com/api/reports` ← التقارير والتحليلات المالية والمخزنية
- `https://domain.com/api/settings` ← إعدادات المنشأة والمستخدمين
- `https://domain.com/api/files/upload` ← رفع وإدارة المستندات والصور
- `https://domain.com/api/backups` ← النسخ الاحتياطي السحابي والاسترجاع

---

## 7. دعم التوجيه للواجهة (Single Page Application - SPA Routing)

تم ضبط خادم Express المدمج ليعيد توجيه كافة مسارات صفحات React غير الموجودة في مسارات الـ API إلى `index.html` تلقائيًا، مما يضمن عمل جميع الصفحات بدون خطأ 404 عند تحديث الصفحة (Page Refresh).

---

## 8. خلاصة سريعة: من الرفع إلى التشغيل

```text
Upload Files  →  npm install  →  npm run build  →  npm start  →  Open Domain  →  Setup Wizard  →  Ready!
```
