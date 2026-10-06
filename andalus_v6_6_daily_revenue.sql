-- ============================================================
-- ANDALUS ACADEMY v6.6 — الإيراد اليومي (يحل محل دفتر الخزنة اليومي)
-- نفّذ فى Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS daily_revenue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_no serial,
  student_id text,
  student_name text,
  amount numeric NOT NULL,
  details text,
  branch text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE daily_revenue DISABLE ROW LEVEL SECURITY;

-- ملحوظة: صفحات "إحالات الطلاب" و"عمولات الفريق" و"دفتر الخزنة اليومي" اتشالت من الكود.
-- الجداول القديمة بتاعتهم (referrals, cash_register, لو موجودين) متمسّتش هنا احتياطًا لبياناتك،
-- لو عايز تمسحهم نهائيًا من قاعدة البيانات كمان قولّي.

NOTIFY pgrst, 'reload schema';
