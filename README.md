# نظام مركز الاندلس للتدريب — v2.0 الآمن 🔒

نظام إدارة متكامل لمركز الاندلس للتدريب يعمل على **GitHub Pages** مع **Supabase** كقاعدة بيانات.

## ✨ الجديد في الإصدار 2.0

- ✅ **Supabase Auth** (تسجيل دخول آمن ببريد إلكتروني + كلمة مرور مشفّرة)
- ✅ **Row Level Security (RLS)** على كل الجداول — لا يمكن لأحد قراءة/كتابة بيانات خارج صلاحياته
- ✅ **حماية من XSS** — كل المُدخلات يتم تنظيفها قبل العرض
- ✅ **Validation** للأرقام (مصرية) والإيميلات
- ✅ **Charts** للداشبورد (Chart.js)
- ✅ **طباعة / PDF** لبروفايل الطالب
- ✅ **PWA** — يمكن تثبيت النظام على الموبايل كتطبيق
- ✅ **إدارة موظفين محسّنة** — مع إعادة تعيين كلمة المرور عبر إيميل

## 📁 محتويات المشروع

```
andalus-deploy/
├── index.html              # الملف الرئيسي للتطبيق
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker (offline cache)
├── supabase-setup.sql      # سكريبت إعداد قاعدة البيانات (يُشغّل مرة واحدة)
└── README.md               # هذا الملف
```

## 🚀 خطوات الرفع على GitHub Pages

### 1) جهّز قاعدة البيانات (مرة واحدة فقط)

1. ادخل [Supabase Dashboard](https://app.supabase.com)
2. افتح مشروعك → **SQL Editor** → **New Query**
3. افتح ملف `supabase-setup.sql` وانسخ محتواه كاملاً
4. الصقه في SQL Editor واضغط **Run**
5. لو ظهرت أخطاء "policy already exists" — عادي، السكربت يستخدم `DROP POLICY IF EXISTS`

### 2) أنشئ أول حساب Admin

1. في Supabase: **Authentication** → **Users** → **Add user** → **Create new user**
2. أدخل:
   - **Email**: مثلاً `admin@andalus.com`
   - **Password**: 6 أحرف على الأقل
3. اضغط **Create user**
4. بعد ما يتعمل، روح **SQL Editor** وشغّل:

```sql
INSERT INTO user_profiles (id, username, full_name, role, branch)
SELECT id, 'admin', 'المدير', 'admin', 'الكل'
FROM auth.users
WHERE email = 'admin@andalus.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin', branch = 'الكل';
```

### 3) ارفع الملفات على GitHub

**لو عندك repo موجود (`andalusacademy.github.io`):**

```bash
cd andalusacademy.github.io
# انسخ الملفات هنا
cp /path/to/andalus-deploy/* .
git add .
git commit -m "v2.0: Supabase Auth + RLS + XSS protection"
git push origin main
```

**لو بتعمل repo جديد:**

```bash
# على GitHub: New repository → andalusacademy/andalusacademy.github.io
git clone https://github.com/andalusacademy/andalusacademy.github.io.git
cd andalusacademy.github.io
cp /path/to/andalus-deploy/* .
git add . && git commit -m "Initial v2.0"
git push origin main
```

### 4) فعّل GitHub Pages

1. **Settings** → **Pages**
2. **Source**: `Deploy from a branch`
3. **Branch**: `main` → `/ (root)`
4. اضغط **Save**
5. خلال دقيقة، الموقع هيكون على: `https://andalusacademy.github.io/`

### 5) حدّث إعدادات Supabase للسماح بدومينك

1. Supabase → **Authentication** → **URL Configuration**
2. في **Site URL** حط: `https://andalusacademy.github.io`
3. في **Redirect URLs** ضيف: `https://andalusacademy.github.io/**`

## 🔐 تغيير الـ Anon Key (مهم جداً!)

الـ anon key القديم كان مكشوف في الكود. **بعد ما تعمل setup للـ RLS، غيّره**:

1. Supabase → **Settings** → **API**
2. اضغط **Generate new anon key**
3. افتح `index.html` وغيّر `SUPABASE_KEY` بالقيمة الجديدة
4. ارفع التغيير على GitHub

**ليه ده مهم؟** — حتى لو حد عرف الـ key القديم، الـ RLS policies اللي عملناها هتمنعه من قراءة/كتابة أي بيانات بدون تسجيل دخول.

## 👥 إدارة الموظفين

- الـ admin يدخل بحسابه، يروح **الموظفين** → **+ إضافة موظف**
- يدخل: اسم المستخدم، الاسم الكامل، **البريد الإلكتروني**، كلمة المرور، الصلاحية، الفرع
- الـ trigger في Supabase هيعمل `user_profiles` تلقائياً
- الموظف الجديد يقدر يسجل دخول من شاشة الـ login بإيميله وباسورد

## 🛡️ مستويات الصلاحيات

| الصلاحية | الصلاحيات |
|----------|----------|
| **admin** (مدير) | كل حاجة: إضافة موظفين، تصدير Excel، إدارة البرامج، عرض كل السجلات |
| **employee** (موظف) | قراءة/كتابة بس في فرعه (كفر الدوار أو فيكتوريا فقط) — مش هيقدر يعدّل جدول البرامج أو يشوف الموظفين |

## 📊 الجداول في قاعدة البيانات

| الجدول | الوصف |
|--------|-------|
| `user_profiles` | بيانات الموظفين (مرتبطة بـ `auth.users`) |
| `students` | بيانات الطلاب |
| `programs` | البرامج والكورسات |
| `subjects` | المواد الدراسية |
| `grades` | درجات الطلاب (دور 1 + دور 2) |
| `attendance` | سجل الحضور والغياب |
| `procedures` | الإجراءات (استدعاء، فصل، تأخر مصاريف...) |
| `payments` | المصروفات والأقساط |
| `leads` | الحجوزات والاستفسارات |
| `activity_log` | سجل نشاط الموظفين |
| `session_log` | سجل الدخول والخروج |

## 🐛 حل المشاكل الشائعة

### "row-level security policy violated"
- معناها إن المستخدم مش عنده صلاحية. تأكد إن الـ RLS policies اتعملت صح.

### "Invalid login credentials"
- تأكد إن الإيميل والباسورد صح.
- لو الموظف لسه جديد، اسأله لو عمل verify للإيميل (في Supabase → Auth → Users).

### "Auth session missing"
- امسح الـ cookies وجرب تاني.

### Charts مش بتظهر
- تأكد إنك متصل بالإنترنت (Chart.js بييجي من CDN).

### البيانات مش بتظهر
- افتح DevTools → Console وابحث عن errors.
- تأكد إن الـ anon key صحيح في `index.html`.

## 💡 نصائح

- **غيّر الـ anon key كل فترة** كإجراء أمان.
- **خد backup من قاعدة البيانات** أسبوعياً: Supabase → Database → Backups.
- **فعّل 2FA** على حساب Supabase نفسه.

## 📞 الدعم

- افتح issue على GitHub
- أو راسلنا على: admin@andalus.com

---

**صنع بـ ❤️ لمركز الاندلس للتدريب**
