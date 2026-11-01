-- Student-visible answer review for Andalus Golden League.
-- Draft migration: keep in feature branch until explicitly approved for production.
CREATE OR REPLACE FUNCTION public.weekly_quiz_get_answered_questions(
  p_student_id text,p_face_token uuid,p_week_start date
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path TO 'public'
AS $$
DECLARE answers_data jsonb; session_ok boolean:=false;
BEGIN
  IF coalesce(btrim(p_student_id),'')='' OR p_face_token IS NULL OR p_week_start IS NULL
    OR extract(dow FROM p_week_start)::integer<>6 THEN
    RETURN jsonb_build_object('ok',false,'reason','invalid_request');
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.students s WHERE s.id=btrim(p_student_id)
    AND s.deleted_at IS NULL AND s.student_status='active') THEN
    RETURN jsonb_build_object('ok',false,'reason','student_not_found');
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.competition_face_verified_sessions s
    WHERE s.token=p_face_token AND s.student_id=btrim(p_student_id)
      AND s.competition_type='weekly_quiz' AND s.expires_at>now()
      AND coalesce(s.verification_method,'') IN ('device','passkey','device_passkey'))
  INTO session_ok;
  IF NOT session_ok THEN
    SELECT EXISTS(SELECT 1 FROM public.weekly_quiz_access_audit a
      WHERE a.student_id=btrim(p_student_id) AND split_part(a.photo_path,'/',3)=p_face_token::text
        AND a.photo_consent_at IS NOT NULL AND a.entered_at>=now()-interval '30 minutes')
    INTO session_ok;
  END IF;
  IF NOT session_ok THEN RETURN jsonb_build_object('ok',false,'reason','session_expired'); END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'quiz_date',qa.quiz_date,'question_id',qa.question_id,
    'selected_option',qa.selected_option,'is_correct',qa.is_correct,
    'points_earned',qa.points_earned,'correct_option',q.correct_option,
    'question_text',q.question,'option_a',q.option_a,'option_b',q.option_b,
    'option_c',q.option_c,'option_d',q.option_d
  ) ORDER BY qa.quiz_date DESC,qa.question_id),'[]'::jsonb)
  INTO answers_data
  FROM public.quiz_answers qa
  LEFT JOIN public.quiz_bank_questions q ON q.id=qa.question_id
  WHERE qa.student_id=btrim(p_student_id)
    AND qa.quiz_date>=p_week_start AND qa.quiz_date<p_week_start+7;

  RETURN jsonb_build_object('ok',true,'answers',answers_data);
END;
$$;
GRANT EXECUTE ON FUNCTION public.weekly_quiz_get_answered_questions(text,uuid,date) TO anon,authenticated;
