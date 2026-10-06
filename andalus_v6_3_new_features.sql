-- ============================================================
-- ANDALUS ACADEMY v6.3 — 4 ميزات جديدة: تهنئة الميلاد، كاشف التكرار،
-- QR للتحقق من الشهادات، تذكير الأقساط بالواتساب
-- نفّذ كل بلوك لوحده فى Supabase SQL Editor
-- ============================================================

-- 1) تاريخ ميلاد الطالب (لتهنئة أعياد الميلاد التلقائية)
ALTER TABLE students ADD COLUMN IF NOT EXISTS birth_date date;

-- 2) سجلات الشهادات الصادرة (للتحقق عبر QR)
CREATE TABLE IF NOT EXISTS certificate_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial text UNIQUE NOT NULL,
  student_id text NOT NULL,
  student_name text NOT NULL,
  program_name text,
  system_name text,
  branch text,
  issued_at timestamptz DEFAULT now()
);
ALTER TABLE certificate_records DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
