-- ============================================================
-- ANDALUS ACADEMY v4.3 — فصيلة دم الطالب
-- نفّذ فى Supabase SQL Editor
-- ============================================================

ALTER TABLE students ADD COLUMN IF NOT EXISTS blood_type text;

NOTIFY pgrst, 'reload schema';
