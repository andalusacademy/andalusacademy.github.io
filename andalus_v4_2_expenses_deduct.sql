-- ============================================================
-- ANDALUS ACADEMY v4.2 — خيار "يخصم / لا يخصم من المصروفات" لكل بند
-- نفّذ فى Supabase SQL Editor
-- ============================================================

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS deduct boolean DEFAULT true;

NOTIFY pgrst, 'reload schema';
