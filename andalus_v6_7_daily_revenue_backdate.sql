-- ============================================================
-- ANDALUS ACADEMY v6.7 — دعم إضافة إيرادات بتاريخ سابق
-- تاريخ الإيراد = التاريخ المحاسبي للعملية
-- created_at = تاريخ/وقت إدخال العملية فعليًا في النظام (سجل تدقيق)
-- نفّذ هذا الملف مرة واحدة في Supabase SQL Editor
-- ============================================================

ALTER TABLE daily_revenue
  ADD COLUMN IF NOT EXISTS revenue_date date;

-- ترحيل السجلات القديمة: تاريخ الإيراد = تاريخ إدخالها الحالي
UPDATE daily_revenue
SET revenue_date = created_at::date
WHERE revenue_date IS NULL;

ALTER TABLE daily_revenue
  ALTER COLUMN revenue_date SET DEFAULT CURRENT_DATE;

ALTER TABLE daily_revenue
  ALTER COLUMN revenue_date SET NOT NULL;

NOTIFY pgrst, 'reload schema';
