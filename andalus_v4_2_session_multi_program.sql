-- ============================================================
-- ANDALUS ACADEMY v4.2 — محاضرة واحدة لأكتر من برنامج (أساسي + احترافي لنفس المادة)
-- نفّذ فى Supabase SQL Editor
-- ============================================================

ALTER TABLE schedule_sessions ADD COLUMN IF NOT EXISTS program_combos jsonb DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
