CREATE OR REPLACE FUNCTION public.weekly_quiz_get_answered_questions(
  p_student_id text,
  p_face_token uuid,
  p_week_start date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  answers_data jsonb;
BEGIN
  IF coalesce(btrim(p_student_id),'') = '' OR p_face_token IS NULL OR p_week_start IS NULL
     OR extract(dow FROM p_week_start)::integer <> 6 THEN
    RETURN jsonb_build_object('ok',false,'reason','invalid_request');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = btrim(p_student_id)
      AND s.deleted_at IS NULL
      AND s.student_status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok',false,'reason','student_not_found');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.weekly_quiz_access_audit a
    WHERE a.student_id = btrim(p_student_id)
      AND split_part(a.photo_path,'/',3) = p_face_token::text
      AND a.photo_consent_at IS NOT NULL
      AND a.entered_at >= now() - interval '30 minutes'
  ) THEN
    RETURN jsonb_build_object('ok',false,'reason','face_verification_required');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'quiz_date', qa.quiz_date,
    'question_id', qa.question_id
  ) ORDER BY qa.quiz_date, qa.question_id), '[]'::jsonb)
  INTO answers_data
  FROM public.quiz_answers qa
  WHERE qa.student_id = btrim(p_student_id)
    AND qa.quiz_date >= p_week_start
    AND qa.quiz_date < p_week_start + 7;

  RETURN jsonb_build_object('ok',true,'answers',answers_data);
END;
$function$;

REVOKE ALL ON FUNCTION public.weekly_quiz_get_answered_questions(text,uuid,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.weekly_quiz_get_answered_questions(text,uuid,date) TO anon, authenticated;

REVOKE ALL PRIVILEGES ON TABLE public.quiz_answers FROM anon, authenticated, PUBLIC;
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;