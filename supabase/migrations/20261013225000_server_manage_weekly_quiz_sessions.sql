CREATE OR REPLACE FUNCTION public.ensure_weekly_quiz_session()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_settings public.quiz_settings%rowtype;
  v_question_ids jsonb;
  v_inserted date;
  v_today date := current_date;
BEGIN
  SELECT * INTO v_settings FROM public.quiz_settings WHERE id = 1 LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok',false,'reason','settings_missing');
  END IF;

  IF (now() AT TIME ZONE 'Africa/Cairo')::time < COALESCE(v_settings.daily_time, time '19:00') THEN
    RETURN jsonb_build_object('ok',false,'reason','not_started');
  END IF;

  IF EXISTS (SELECT 1 FROM public.quiz_daily_sessions WHERE quiz_date = v_today) THEN
    RETURN jsonb_build_object('ok',true,'created',false,'quiz_date',v_today);
  END IF;

  SELECT jsonb_agg(chosen.id ORDER BY chosen.random_key)
  INTO v_question_ids
  FROM (
    SELECT q.id, random() AS random_key
    FROM public.quiz_bank_questions q
    WHERE q.active IS TRUE
    ORDER BY random_key
    LIMIT greatest(1, least(COALESCE(v_settings.questions_per_day,5),50))
  ) chosen;

  IF v_question_ids IS NULL OR jsonb_array_length(v_question_ids) = 0 THEN
    RETURN jsonb_build_object('ok',false,'reason','no_active_questions');
  END IF;

  INSERT INTO public.quiz_daily_sessions(quiz_date,question_ids)
  VALUES (v_today,v_question_ids)
  ON CONFLICT (quiz_date) DO NOTHING
  RETURNING quiz_date INTO v_inserted;

  RETURN jsonb_build_object(
    'ok',true,
    'created',v_inserted IS NOT NULL,
    'quiz_date',v_today
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.ensure_weekly_quiz_session() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_weekly_quiz_session() TO anon, authenticated;

REVOKE ALL PRIVILEGES ON TABLE public.quiz_daily_sessions FROM anon, authenticated, PUBLIC;
GRANT SELECT (id, quiz_date, question_ids, activated_at)
ON TABLE public.quiz_daily_sessions TO anon, authenticated;

ALTER TABLE public.quiz_daily_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quiz_daily_sessions_public_read ON public.quiz_daily_sessions;
CREATE POLICY quiz_daily_sessions_public_read
ON public.quiz_daily_sessions
FOR SELECT
TO anon, authenticated
USING (quiz_date <= current_date);