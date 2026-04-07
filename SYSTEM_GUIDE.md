# نظام إدارة تأجير المعدات الثقيلة — Al Haidariya Hiring System

## نظرة عامة على النظام

**النظام**: تطبيق ويب واحد (`index.html`) يعمل على GitHub Pages. يدير:
- بطاقات تأجير المعدات (Hiring Cards)
- التقارير اليومية (Sales Reports)
- إدارة الأسطول والمعدات (Fleet & Ops)
- قوائم العملاء والفواتير
- كتالوج أنواع المعدات

---

## كيفية الاستخدام

### 1️⃣ تسجيل الدخول
```
البريد: البريد الإلكتروني المسجل
كلمة المرور: كلمة المرور المسجلة
```

**ملاحظة**: عند أول دخول:
- يتم تحميل جميع البيانات من قاعدة البيانات
- يتم إنشاء 177 عميل و 98 نوع معدة تلقائياً من البيانات المضمنة

---

## الميزات الرئيسية

### 📋 Master Cards (بطاقات رئيسية)
**الوصف**: كل بطاقة = طلب تأجير معدة من عميل

**المعلومات المطلوبة**:
- **رقم البطاقة** (auto-generated)
- **التاريخ**: تاريخ الطلب
- **العميل**: اسم الشركة المستأجرة
- **المعدة**: نوع المعدة
- **الموقع**: مكان التسليم
- **السعر**: السعر بالدينار (بدون VAT)
- **الشفت**: وقت البداية والنهاية
- **الحالة**: Running / Received / Off Hire / Cancel
- **المشرف**: الموظف المسؤول

---

### 📊 Sales Report (تقرير المبيعات)
**الوصف**: تحويل بطاقات التأجير إلى فاتورة نهائية

**الخطوات**:
1. اختر التاريخ
2. النظام يحمل جميع البطاقات النشطة لذلك اليوم
3. أضف الساعات الفعلية وساعات العمل الإضافي (OT)
4. أكمل/احفظ للفاتورة

**ملاحظة**: 
- يتم حساب VAT 10% تلقائياً
- يمكن حفظ التقرير كـ PDF

---

### 🚜 Fleet & Ops (إدارة الأسطول)
**الوصف**: تتبع:
- **المعدات**: بيانات كل معدة (الاسم، رقم اللوحة، المشرف)
- **الموظفين**: بيانات السائقين والعمال (الاسم، رقم الملف، المشرف)
- **سجل التعيينات**: أي معدة مع أي موظف في أي فترة

**من يرى البيانات**:
- **الإدارة**: جميع البيانات
- **المشرف**: فقط بيانات فريقه

---

### 👥 Customers (العملاء)
**البيانات المحفوظة**:
- الاسم
- الهاتف
- رقم التسجيل التجاري
- رقم الضريبة
- العنوان

**تحذير تلقائي**: إذا كان للعميل دين > 200 دينار، يظهر تحذير أحمر

---

### 📄 Invoices (الفواتير)
**التسلسل التلقائي**: `INV-YYYY-NNN` (مثال: INV-2026-001)

**تتضمن**:
- تفاصيل العميل
- تفاصيل المعدات
- الساعات والأجرة
- الضرائب (VAT 10%)
- المدفوعات (إن وجدت)
- الحالة (Pending / Partial / Paid)

---

### 🏷️ Machine Types Catalog (كتالوج أنواع المعدات)
**التصنيف التلقائي** (عند أول دخول):

#### العاقب (Al Aqib) — معدات الحفر والتسوية:
- JCB 1CX, JCB 3CX
- EXCAVATOR (جميع الأنواع)
- MINI EXCAVATOR
- WHEEL EXCAVATOR
- TELEHANDLER
- ROLLER, ROAD ROLLER
- WHEEL LOADER
- SKID LOADER (BOBCAT)
- GRADER
- ROCK BREAKER

#### محمد العجمي (Mohamed Al Ajmi) — رافعات وتحميل:
- CRANE (جميع الأوزان: 30-400 TON)
- FORKLIFT (جميع الأوزان: 2-16 TON)
- SCISSOR LIFT (جميع الارتفاعات)
- MANLIFT (جميع الارتفاعات: 10-43 MTR)
- COUNTERWEIGHT
- HAIB (رافعة الذراع)
- LOWBED, FLATBED (ناقلات)
- CABLE WINCH (رافعة سلكية)

#### هارون (Haroun) — شاحنات النقل:
- DUMP TRUCK (15 MTR, 20 MTR)
- DUMP SIXWHEEL
- RECOVERY VEHICLE

#### محمد سعيد (Mohamed Saeed) — معدات المرافق:
- GENERATOR (جميع الأوزان)
- VACUUM TANKER
- WATER TANKER
- WATER PUMP
- SWEET WATER TANKER
- AIR COMPRESSOR
- TOWER LIGHT

---

## البنية التقنية

### المنصة
- **Frontend**: Single Page App (SPA) — ملف HTML واحد
- **Hosting**: GitHub Pages (مجاني، سريع)
- **Database**: Supabase (PostgreSQL + API)
- **Authentication**: Supabase Auth

### البيانات المخزنة في Supabase
```json
{
  "key": "cards",
  "value": [البطاقات]
}
{
  "key": "customers",
  "value": [العملاء]
}
{
  "key": "machine_types",
  "value": [أنواع المعدات]
}
{
  "key": "fleet",
  "value": [المعدات والموظفين]
}
{
  "key": "invoices",
  "value": [الفواتير]
}
{
  "key": "notifications",
  "value": [الإشعارات]
}
```

---

## كيفية نسخ النظام (للايتي)

### الخطوة 1: إعداد Supabase
1. أنشئ حساب على supabase.com
2. أنشئ Project جديد
3. انسخ:
   - Project URL
   - Anon Key (للقراءة/الكتابة من الويب)
   - Service Role Key (للعمليات الإدارية)

### الخطوة 2: تحديث الكود
في ملف `index.html`، ابحث عن:
```javascript
var SUPA_URL  = 'https://YOUR_PROJECT.supabase.co';
var SUPA_ANON = 'YOUR_ANON_KEY';
var SUPA_SVC  = 'YOUR_SERVICE_ROLE_KEY';
```

### الخطوة 3: إنشاء جداول في Supabase
اذهب إلى SQL Editor وشغّل:
```sql
CREATE TABLE app_data (
  id BIGSERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name TEXT,
  role TEXT DEFAULT 'supervisor',
  supervisor_name TEXT
);

-- Enable Row Level Security
ALTER TABLE app_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read/write their own data
CREATE POLICY "Allow all authenticated users" ON app_data
  FOR ALL USING (auth.role() = 'authenticated');
```

### الخطوة 4: إنشاء المستخدمين
استخدم Supabase Auth Dashboard أو API:
```bash
curl -X POST 'https://YOUR_PROJECT.supabase.co/auth/v1/admin/users' \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword",
    "email_confirm": true,
    "user_metadata": {
      "full_name": "محمد الأجمي",
      "role": "supervisor"
    }
  }'
```

### الخطوة 5: رفع الملفات
1. أضف `index.html` و `cards-data.js` إلى repository GitHub
2. اذهب إلى Settings > Pages
3. اختر `main` branch كـ source
4. سيتم نشر الموقع تلقائياً

---

## ملاحظات تقنية مهمة

### حجم الملف
- `index.html`: 161 KB (مخزّن على GitHub)
- `cards-data.js`: 330 KB (بيانات البطاقات الأولية)
- **التأثير**: يتم تحميل الملفات مرة واحدة فقط في أول زيارة

### الأداء
- **First Load**: 1-2 ثانية (حسب السرعة)
- **بعد ذلك**: فوري (مخزن محلياً في المتصفح)
- **التزامن**: يتم الحفظ إلى Supabase تلقائياً كل 400ms

### الأمان
- ✅ جميع البيانات مشفرة عند النقل (HTTPS)
- ✅ المصادقة عبر Supabase Auth
- ✅ RLS (Row Level Security) في قاعدة البيانات
- ✅ لا توجد كلمات مرور في الكود

---

## استكشاف الأخطاء

### المشكلة: Sign In لا يعمل
**الحل**:
1. افتح DevTools (F12)
2. اذهب إلى Console
3. تحقق من الأخطاء
4. تأكد من أن Supabase URL و Keys صحيحة

### المشكلة: البيانات لا تظهر
**الحل**:
1. تحقق من وجود جدول `app_data` في Supabase
2. تأكد من تفعيل RLS بشكل صحيح
3. جرّب إعادة تحميل الصفحة (Ctrl+Shift+R)

### المشكلة: الفواتير لا تُطبع كـ PDF
**الحل**:
1. جرب متصفح مختلف
2. تأكد من عدم حجب النوافذ المنبثقة
3. تحقق من إصدار المتصفح (استخدم Chrome الأحدث)

---

## التطوير المستقبلي

### ميزات مخطط إضافتها:
- [ ] تطبيق موبايل (iOS/Android)
- [ ] تقارير متقدمة (PDF، Excel)
- [ ] إشعارات SMS/Email
- [ ] نظام الدفع الإلكتروني
- [ ] صيانة المعدات وسجل الإصلاحات
- [ ] تكامل مع نظام المحاسبة

---

## جهات الاتصال التقنية

**المطور**: Claude AI  
**المستودع**: https://github.com/Mohamed-Hiring/alhaidariya  
**قاعدة البيانات**: Supabase.com  
**الاستضافة**: GitHub Pages

---

**آخر تحديث**: أبريل 2026  
**الإصدار**: 1.0.0
