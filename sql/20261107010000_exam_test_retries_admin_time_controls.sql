-- Repeated test attempts for student 0 and administrator time controls.
ALTER TABLE public.exam_attempts
  ADD COLUMN IF NOT EXISTS time_adjustment_seconds integer NOT NULL DEFAULT 0;
ALTER TABLE public.exam_attempts DROP CONSTRAINT IF EXISTS exam_attempts_time_adjustment_seconds_check;
ALTER TABLE public.exam_attempts ADD CONSTRAINT exam_attempts_time_adjustment_seconds_check CHECK (time_adjustment_seconds >= 0);
ALTER TABLE public.exam_attempts DROP CONSTRAINT IF EXISTS exam_attempts_exam_id_student_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS exam_attempts_exam_student_once_nonzero
  ON public.exam_attempts(exam_id, student_id) WHERE student_id <> '0';

DO $$
DECLARE v_def text; v_old text; v_new text;
BEGIN
  SELECT pg_get_functiondef('public.student_exam_start_attempt(uuid,text,text,uuid)'::regprocedure) INTO v_def;
  v_old := 'IF EXISTS (SELECT 1 FROM public.exam_attempts a WHERE a.exam_id=ex.id AND a.student_id=st.id) THEN' || E'\n    RETURN jsonb_build_object(''ok'',false,''reason'',''attempt_exists'');\n  END IF;';
  v_new := 'IF st.id <> ''0'' AND EXISTS (SELECT 1 FROM public.exam_attempts a WHERE a.exam_id=ex.id AND a.student_id=st.id) THEN' || E'\n    RETURN jsonb_build_object(''ok'',false,''reason'',''attempt_exists'');\n  END IF;\n  IF st.id = ''0'' THEN\n    UPDATE public.exam_attempts SET status=''abandoned'', submitted_at=clock_timestamp() WHERE exam_id=ex.id AND student_id=st.id AND status=''in_progress'';\n  END IF;';
  IF position(v_old in v_def)=0 THEN RAISE EXCEPTION 'start-attempt guard pattern not found'; END IF;
  EXECUTE replace(v_def,v_old,v_new);

  SELECT pg_get_functiondef('public.student_exam_list(text,text,uuid)'::regprocedure) INTO v_def;
  v_old := '''attempt_status'',at.status,''attempt_id'',at.id';
  v_new := '''attempt_status'',CASE WHEN st.id=''0'' THEN NULL ELSE at.status END,''attempt_id'',CASE WHEN st.id=''0'' THEN NULL ELSE at.id END';
  IF position(v_old in v_def)=0 THEN RAISE EXCEPTION 'exam-list attempt status pattern not found'; END IF;
  EXECUTE replace(v_def,v_old,v_new);

  SELECT pg_get_functiondef('public.student_exam_resume_attempt(uuid,text,text,uuid)'::regprocedure) INTO v_def;
  v_old := '''duration_seconds'',jsonb_array_length(att.question_order)*15,';
  v_new := '''duration_seconds'',jsonb_array_length(att.question_order)*15+greatest(coalesce(att.time_adjustment_seconds,0),0),';
  IF position(v_old in v_def)=0 THEN RAISE EXCEPTION 'resume duration pattern not found'; END IF;
  v_def := replace(v_def,v_old,v_new);
  v_old := '''duration_minutes'',ceil(jsonb_array_length(att.question_order)*15.0/60)';
  v_new := '''duration_minutes'',ceil((jsonb_array_length(att.question_order)*15.0+greatest(coalesce(att.time_adjustment_seconds,0),0))/60)';
  IF position(v_old in v_def)=0 THEN RAISE EXCEPTION 'resume duration minutes pattern not found'; END IF;
  EXECUTE replace(v_def,v_old,v_new);

  SELECT pg_get_functiondef('public.student_exam_save_answers(uuid,text,text,uuid,jsonb)'::regprocedure) INTO v_def;
  v_old := 'att.started_at + make_interval(secs=>greatest(15,coalesce(jsonb_array_length(att.question_order),0)*15))';
  v_new := 'att.started_at + make_interval(secs=>greatest(15,coalesce(jsonb_array_length(att.question_order),0)*15) + greatest(coalesce(att.time_adjustment_seconds,0),0))';
  IF position(v_old in v_def)=0 THEN RAISE EXCEPTION 'save deadline pattern not found'; END IF;
  EXECUTE replace(v_def,v_old,v_new);

  SELECT pg_get_functiondef('public.student_exam_submit_attempt(uuid,text,text,uuid,jsonb,boolean)'::regprocedure) INTO v_def;
  v_old := 'att.started_at+make_interval(secs=>greatest(15,coalesce(jsonb_array_length(att.question_order),0)*15))';
  v_new := 'att.started_at+make_interval(secs=>greatest(15,coalesce(jsonb_array_length(att.question_order),0)*15) + greatest(coalesce(att.time_adjustment_seconds,0),0))';
  IF position(v_old in v_def)=0 THEN RAISE EXCEPTION 'submit deadline pattern not found'; END IF;
  v_def := replace(v_def,v_old,v_new);
  v_old := 'IF NOT coalesce(ex.is_placement_test,false) THEN';
  v_new := 'IF att.student_id <> ''0'' AND NOT coalesce(ex.is_placement_test,false) THEN';
  IF position(v_old in v_def)=0 THEN RAISE EXCEPTION 'grade persistence guard pattern not found'; END IF;
  EXECUTE replace(v_def,v_old,v_new);
END $$;

CREATE OR REPLACE FUNCTION public.admin_adjust_exam_attempt_time(p_attempt_id uuid,p_minutes integer DEFAULT 0,p_reset_full boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE att public.exam_attempts%rowtype; ex public.exams%rowtype; v_deadline timestamptz; v_seconds integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required' USING ERRCODE='42501'; END IF;
  SELECT * INTO att FROM public.exam_attempts WHERE id=p_attempt_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','attempt_not_found'); END IF;
  IF att.status <> 'in_progress' THEN RETURN jsonb_build_object('ok',false,'reason','attempt_not_in_progress'); END IF;
  SELECT * INTO ex FROM public.exams WHERE id=att.exam_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','exam_not_found'); END IF;
  IF coalesce(p_reset_full,false) THEN
    UPDATE public.exam_attempts SET started_at=clock_timestamp(),time_adjustment_seconds=0 WHERE id=att.id RETURNING * INTO att;
  ELSE
    IF p_minutes IS NULL OR p_minutes < 1 OR p_minutes > 180 THEN RETURN jsonb_build_object('ok',false,'reason','invalid_minutes'); END IF;
    UPDATE public.exam_attempts SET time_adjustment_seconds=coalesce(time_adjustment_seconds,0)+(p_minutes*60) WHERE id=att.id RETURNING * INTO att;
  END IF;
  v_seconds:=greatest(15,coalesce(jsonb_array_length(att.question_order),0)*15)+greatest(coalesce(att.time_adjustment_seconds,0),0);
  v_deadline:=least(att.started_at+make_interval(secs=>v_seconds),coalesce(ex.available_until,att.started_at+make_interval(secs=>v_seconds)));
  RETURN jsonb_build_object('ok',true,'attempt_id',att.id,'student_id',att.student_id,'started_at',att.started_at,'time_adjustment_seconds',att.time_adjustment_seconds,'deadline_at',v_deadline,
    'message',CASE WHEN coalesce(p_reset_full,false) THEN 'تمت إعادة الوقت كاملًا من البداية.' ELSE 'تمت إضافة الوقت المطلوب للمحاولة.' END);
END;
$function$;
REVOKE ALL ON FUNCTION public.admin_adjust_exam_attempt_time(uuid,integer,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_adjust_exam_attempt_time(uuid,integer,boolean) TO authenticated;
