ALTER FUNCTION public.admin_review_study_summary_order(uuid, text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.study_summary_questions_default_selected() SET search_path = public, pg_temp;
ALTER FUNCTION public.validate_study_summary_order() SET search_path = public, pg_temp;
