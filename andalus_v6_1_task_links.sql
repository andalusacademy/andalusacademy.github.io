-- ============================================================
-- ANDALUS ACADEMY v6.1 — ربط المهام بمكان محدد فى النظام (طالب / حجز / صفحة)
-- نفّذ فى Supabase SQL Editor
-- ============================================================

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS link_type text;  -- 'student' | 'lead' | 'page' | null
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS link_value text; -- student_id أو lead_id أو اسم الصفحة

NOTIFY pgrst, 'reload schema';
