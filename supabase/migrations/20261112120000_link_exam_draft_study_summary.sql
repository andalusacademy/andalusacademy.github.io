-- Link a converted study summary to its source exam draft exactly once.
ALTER TABLE public.study_summaries
  ADD COLUMN IF NOT EXISTS source_exam_draft_id uuid
  REFERENCES public.exam_drafts(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS study_summaries_source_exam_draft_id_uidx
  ON public.study_summaries (source_exam_draft_id)
  WHERE source_exam_draft_id IS NOT NULL;

COMMENT ON COLUMN public.study_summaries.source_exam_draft_id IS
  'Source exam draft converted into this study summary; unique to prevent duplicate conversions.';
