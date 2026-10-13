-- Weekly quiz: answer submission and score calculation must be server-authoritative.
CREATE OR REPLACE FUNCTION public.weekly_quiz_submit_answer(
  p_quiz_date date,
  p_student_id text,
  p_question_id uuid,
  p_selected_option text,
  p_face_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_question record;
  v_student record;
  v_correct boolean := false;
  v_points integer := 0;
  v_inserted uuid;
  v_week_start date;
  v_total integer := 0;
  v_correct_count integer := 0;
BEGIN
  IF p_quiz_date IS NULL OR coalesce(btrim(p_student_id),'') = ''
     OR p_question_id IS NULL OR p_face_token IS NULL
     OR (p_selected_option IS NOT NULL AND p_selected_option NOT IN ('a','b','c','d')) THEN
    RETURN jsonb_build_object('ok',false,'reason','invalid_data');
  END IF;
  SELECT id, name INTO v_student FROM public.students
  WHERE id = btrim(p_student_id) AND deleted_at IS NULL AND student_status = 'active' LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','student_not_found'); END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.weekly_quiz_access_audit a
    WHERE a.student_id = v_student.id
      AND split_part(a.photo_path, '/', 3) = p_face_token::text
      AND a.photo_consent_at IS NOT NULL
  ) THEN RETURN jsonb_build_object('ok',false,'reason','face_verification_required'); END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.quiz_daily_sessions ds WHERE ds.quiz_date = p_quiz_date
      AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(ds.question_ids) q(id) WHERE q.id = p_question_id::text)
  ) THEN RETURN jsonb_build_object('ok',false,'reason','question_not_scheduled'); END IF;
  SELECT id, correct_option, coalesce(points,10) AS points INTO v_question
  FROM public.quiz_bank_questions WHERE id = p_question_id AND coalesce(active,true) = true LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','question_unavailable'); END IF;
  v_correct := p_selected_option IS NOT NULL AND p_selected_option = v_question.correct_option;
  v_points := CASE WHEN v_correct THEN greatest(0,least(v_question.points,1000)) ELSE 0 END;
  INSERT INTO public.quiz_answers
    (quiz_date,student_id,question_id,selected_option,is_correct,points_earned,face_verification_token)
  VALUES (p_quiz_date,v_student.id,p_question_id,p_selected_option,v_correct,v_points,p_face_token)
  ON CONFLICT (quiz_date,student_id,question_id) DO NOTHING RETURNING id INTO v_inserted;
  IF v_inserted IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','already_answered'); END IF;
  v_week_start := current_date - ((extract(dow FROM current_date)::integer + 1) % 7);
  SELECT coalesce(sum(points_earned),0), count(*) FILTER (WHERE is_correct = true)
    INTO v_total, v_correct_count FROM public.quiz_answers
    WHERE student_id = v_student.id AND quiz_date >= v_week_start AND quiz_date < v_week_start + 7;
  INSERT INTO public.quiz_weekly_scores
    (student_id,student_name,week_start,total_points,correct_count,updated_at)
  VALUES (v_student.id,v_student.name,v_week_start,v_total,v_correct_count,now())
  ON CONFLICT (student_id,week_start) DO UPDATE SET student_name=EXCLUDED.student_name,
    total_points=EXCLUDED.total_points,correct_count=EXCLUDED.correct_count,updated_at=now();
  RETURN jsonb_build_object('ok',true,'is_correct',v_correct,'points_earned',v_points,
    'correct_option',v_question.correct_option,'total_points',v_total,'correct_count',v_correct_count);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'weekly_quiz_submit_answer failed: %', SQLERRM;
  RETURN jsonb_build_object('ok',false,'reason','submission_failed');
END;
$function$;
REVOKE ALL ON FUNCTION public.weekly_quiz_submit_answer(date,text,uuid,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.weekly_quiz_submit_answer(date,text,uuid,text,uuid) TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.quiz_answers FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.quiz_weekly_scores FROM anon, authenticated;
NOTIFY pgrst, 'reload schema';
