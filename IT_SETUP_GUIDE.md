# IT Setup Guide — نظام Al Haidariya

## Quick Start (للايتي)

### المطلوب:
- GitHub Account
- Supabase Account
- المستندات التقنية (توجد في هذا المجلد)

---

## خطوات النسخ

### 1. عمل Fork من Repository
```bash
# من GitHub
1. اذهب إلى: https://github.com/Mohamed-Hiring/alhaidariya
2. اضغط Fork
3. انسخ الـ URL الجديد
```

### 2. تحضير Supabase

#### أ. إنشاء Project
```
1. اذهب إلى supabase.com
2. New Project
3. Name: "AlHaidariya-[YourName]"
4. Database Password: (احفظها آمنة)
5. Region: استخدم الأقرب لديك
```

#### ب. نسخ المفاتيح
```
Project Settings → API → انسخ:
- Project URL (مثال: https://xxx.supabase.co)
- anon public key
- service_role secret key
```

#### ج. إنشاء الجداول
```
1. اذهب إلى SQL Editor
2. اضغط New Query
3. انسخ وشغّل الـ SQL من أسفل
```

**SQL Script**:
```sql
-- جدول البيانات الرئيسي
CREATE TABLE IF NOT EXISTS app_data (
  id BIGSERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- ملفات المستخدمين
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'supervisor',
  supervisor_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- تفعيل الأمان
ALTER TABLE app_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can read all data" ON app_data
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can write data" ON app_data
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update data" ON app_data
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can read profiles" ON user_profiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- جدول السجل (للمراجعة)
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT,
  table_name TEXT,
  record_id TEXT,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. تحديث الملف الرئيسي
```bash
# في المستودع المحلي
1. افتح index.html في محرر نصوص
2. ابحث عن:
   var SUPA_URL  = '...';
   var SUPA_ANON = '...';
   var SUPA_SVC  = '...';
3. استبدل بقيمك من Supabase
4. احفظ الملف
```

### 4. إنشاء المستخدمين الأوليين

**الخيار أ**: من Supabase Dashboard
```
Authentication → Users → Add user
- Email
- Password
- Email Confirmed ✓
```

**الخيار ب**: من Command Line
```bash
curl -X POST 'https://YOUR_PROJECT.supabase.co/auth/v1/admin/users' \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d {
    "email": "supervisor@example.com",
    "password": "SecurePassword123!",
    "email_confirm": true
  }
```

### 5. إضافة بيانات الملف الشخصي

```bash
# استخدم Supabase API
curl -X POST 'https://YOUR_PROJECT.supabase.co/rest/v1/user_profiles' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "USER_UUID",
    "full_name": "محمد العجمي",
    "role": "supervisor",
    "supervisor_name": "محمد العجمي"
  }'
```

### 6. نشر على GitHub Pages

```bash
# في المستودع
1. اضغط على Settings
2. اختر Pages
3. Source: main branch
4. سيتم النشر تلقائياً على: https://yourusername.github.io/alhaidariya
```

---

## اختبار النظام

### اختبار اللوقن
```
1. افتح الموقع
2. جرّب البريد وكلمة المرور
3. إذا ظهرت لك الصفحة الرئيسية = ✓ نجح
```

### اختبار البيانات
```
1. أنشئ بطاقة جديدة (+ New Card)
2. املأ المعلومات
3. اضغط Save
4. توجه إلى Data/Import
5. يجب أن تظهر البيانات = ✓ نجح
```

### اختبار Supabase
```
في Supabase Dashboard:
1. Database → app_data
2. يجب أن تظهر الصفوف المحفوظة = ✓ نجح
```

---

## استكشاف الأخطاء الشائعة

| المشكلة | السبب | الحل |
|--------|------|------|
| "Cannot load the app" | Supabase CDN لم يحمّل | تحقق من SUPA_URL و SUPA_ANON |
| Sign In لا يعمل | المستخدم غير موجود | أنشئ حساب في Supabase Auth |
| البيانات لا تُحفظ | جداول غير موجودة | شغّل الـ SQL script في Supabase |
| الصفحة فارغة | RLS مفعّل بشكل خاطئ | تحقق من الـ Policies |

---

## الملفات المهمة

```
repository/
├── index.html              # الملف الرئيسي (161 KB)
├── cards-data.js           # البيانات الأولية (330 KB)
├── SYSTEM_GUIDE.md         # شرح النظام (هذا)
├── IT_SETUP_GUIDE.md       # دليل التسطيب (هذا الملف)
└── README.md               # معلومات عامة
```

---

## الدعم والصيانة

### النسخ الاحتياطية
```bash
# تصدير البيانات من Supabase
1. Database → Export
2. اختر app_data
3. اختر JSON format
4. احفظ في مكان آمن
```

### التحديثات
```
عند إصدار نسخة جديدة:
1. Pull من main branch
2. تحديث المفاتيح إذا تغيرت
3. اختبر على staging قبل production
```

---

## مراجع مفيدة

- Supabase Docs: https://supabase.com/docs
- GitHub Pages: https://pages.github.com
- Supabase Auth: https://supabase.com/docs/guides/auth

---

**آخر تحديث**: أبريل 2026
