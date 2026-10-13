CREATE OR REPLACE FUNCTION public.admin_update_weekly_quiz_settings(
  p_daily_time text,
  p_questions_per_day integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_time time;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.is_active IS TRUE AND up.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF p_questions_per_day IS NULL OR p_questions_per_day < 1 OR p_questions_per_day > 50 THEN
    RETURN jsonb_build_object('ok',false,'reason','invalid_question_count');
  END IF;

  BEGIN
    v_time := btrim(coalesce(p_daily_time,''))::time;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok',false,'reason','invalid_time');
  END;

  UPDATE public.quiz_settings
  SET daily_time = v_time,
      questions_per_day = p_questions_per_day,
      updated_at = now()
  WHERE id = 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok',false,'reason','settings_row_missing');
  END IF;

  RETURN jsonb_build_object('ok',true);
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_update_weekly_quiz_settings(text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_weekly_quiz_settings(text,integer) TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE public.quiz_settings FROM anon, authenticated, PUBLIC;
GRANT SELECT (id, daily_time, questions_per_day, updated_at)
ON TABLE public.quiz_settings TO anon, authenticated;

ALTER TABLE public.quiz_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quiz_settings_public_read ON public.quiz_settings;
CREATE POLICY quiz_settings_public_read
ON public.quiz_settings
FOR SELECT
TO anon, authenticated
USING (true);