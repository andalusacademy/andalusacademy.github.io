-- ============================================================
-- ANDALUS ACADEMY v4.0 — صلاحيات مخصصة لكل موظف + اسم نظام قابل للتخصيص
-- نفّذ كل بلوك لوحده، وتجاهل أي خطأ "already exists"
-- ============================================================

-- 1) عمود الصلاحيات المخصصة لكل موظف (JSON: قائمة أسماء الصفحات المسموح بها)
--    NULL = لا يوجد تخصيص (الموظف يرى كل شيء حسب الإعداد القديم العام)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS allowed_pages jsonb;

-- 2) عمود صريح لصلاحية الحذف (مستقل عن الصفحات، لأن المطلوب: "مينفعش يحذف")
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS can_delete boolean DEFAULT true;

-- 3) جدول إعدادات عامة للنظام (لتخزين اسم النظام القابل للتخصيص، وأي إعدادات عامة مستقبلية)
CREATE TABLE IF NOT EXISTS system_settings (
  key text PRIMARY KEY,
  value text
);

-- 4) القيمة الافتراضية لاسم النظام (لو غير موجودة بالفعل)
INSERT INTO system_settings (key, value)
VALUES ('system_name', 'مركز الاندلس للتدريب')
ON CONFLICT (key) DO NOTHING;

-- 5) السماح بالعمل دون قيود RLS صارمة (مطابق لباقي جداول النظام)
ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;

-- 6) إعادة تحميل schema cache فى PostgREST
NOTIFY pgrst, 'reload schema';
