-- Cover the foreign-key lookup when a question is removed from the shared bank.
CREATE INDEX IF NOT EXISTS golden_league_question_starts_question_id_idx
  ON public.golden_league_question_starts(question_id);
