ALTER TABLE public.quiz_bank_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quiz_bank_questions_active_public_select ON public.quiz_bank_questions;
CREATE POLICY quiz_bank_questions_active_public_select
ON public.quiz_bank_questions
FOR SELECT
TO anon, authenticated
USING (active IS TRUE);