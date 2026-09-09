-- ============================================================
-- ANDALUS ACADEMY v4.4 — ربط استبيان رضا الطلاب بمحاضرة/مدرب محدد
-- نفّذ فى Supabase SQL Editor
-- ============================================================

-- بنخزن session_id + اسم المادة + اسم المدرب وقت الإرسال (denormalized)
-- عشان تفاصيل الاستبيان تفضل ثابتة حتى لو المحاضرة اتعدّلت أو اتحذفت بعدين.
-- text مش uuid عشان نتجنب مشاكل توافق النوع مع schedule_sessions.id
ALTER TABLE satisfaction_surveys ADD COLUMN IF NOT EXISTS session_id text;
ALTER TABLE satisfaction_surveys ADD COLUMN IF NOT EXISTS subject_name text;
ALTER TABLE satisfaction_surveys ADD COLUMN IF NOT EXISTS trainer_name text;

NOTIFY pgrst, 'reload schema';
