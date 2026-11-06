DO $$
DECLARE v_def text; v_old text; v_new text;
BEGIN
  SELECT pg_get_functiondef('public.student_exam_start_attempt(uuid,text,text,uuid)'::regprocedure) INTO v_def;
  v_old := 'IF st.id <> ''0'' AND EXISTS (SELECT 1 FROM public.exam_attempts a WHERE a.exam_id=ex.id AND a.student_id=st.id) THEN' || E'\n    RETURN jsonb_build_object(''ok'',false,''reason'',''attempt_exists'');\n  END IF;';
  v_new := 'IF EXISTS (SELECT 1 FROM public.exam_attempts a WHERE a.exam_id=ex.id AND a.student_id=st.id AND a.status IN (''in_progress'',''submitted'')) THEN' || E'\n    RETURN jsonb_build_object(''ok'',false,''reason'',''attempt_exists'');\n  END IF;';
  IF position(v_old in v_def)=0 THEN RAISE EXCEPTION 'start guard pattern not found'; END IF;
  v_def := replace(v_def,v_old,v_new);
  v_old := E'  IF st.id = ''0'' THEN\n    UPDATE public.exam_attempts SET status=''abandoned'', submitted_at=clock_timestamp()\n    WHERE exam_id=ex.id AND student_id=st.id AND status=''in_progress'';\n  END IF;\n';
  IF position(v_old in v_def)>0 THEN v_def:=replace(v_def,v_old,''); END IF;
  EXECUTE v_def;

  SELECT pg_get_functiondef('public.student_exam_list(text,text,uuid)'::regprocedure) INTO v_def;
  v_old := '''attempt_status'',CASE WHEN st.id=''0'' THEN NULL ELSE at.status END,''attempt_id'',CASE WHEN st.id=''0'' THEN NULL ELSE at.id END';
  v_new := '''attempt_status'',at.status,''attempt_id'',at.id,''attempt_score'',at.score,''attempt_max_score'',at.max_score,''attempt_flagged_cheating'',at.flagged_cheating';
  IF position(v_old in v_def)=0 THEN RAISE EXCEPTION 'student list attempt fields pattern not found'; END IF;
  v_def := replace(v_def,v_old,v_new);
  v_old := 'AND e.available_from<=now() AND e.available_until>now()';
  v_new := 'AND e.available_from<=now() AND (e.available_until>now() OR at.status IN (''in_progress'',''submitted''))';
  IF position(v_old in v_def)=0 THEN RAISE EXCEPTION 'student list availability pattern not found'; END IF;
  v_def := replace(v_def,v_old,v_new);
  v_old := 'AND (coalesce(e.is_published,false)=true OR at.status=''in_progress'')';
  v_new := 'AND (coalesce(e.is_published,false)=true OR at.status IN (''in_progress'',''submitted''))';
  IF position(v_old in v_def)=0 THEN RAISE EXCEPTION 'student list published pattern not found'; END IF;
  v_def := replace(v_def,v_old,v_new);
  EXECUTE v_def;
END $$;

CREATE OR REPLACE FUNCTION public.admin_reopen_exam_attempt(p_attempt_id uuid,p_extra_minutes integer DEFAULT 0,p_restart boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE att public.exam_attempts%rowtype;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required' USING ERRCODE='42501'; END IF;
  SELECT * INTO att FROM public.exam_attempts WHERE id=p_attempt_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','attempt_not_found'); END IF;
  IF att.status <> 'submitted' THEN RETURN jsonb_build_object('ok',false,'reason','attempt_not_submitted'); END IF;
  IF coalesce(p_restart,false) THEN
    UPDATE public.exam_attempts SET status='in_progress',started_at=clock_timestamp(),submitted_at=NULL,
      answers='{}'::jsonb,score=NULL,flagged_cheating=false,time_taken_seconds=NULL,
      correct_count=0,incorrect_count=0,unanswered_count=0,result_persisted_at=NULL,
      time_adjustment_seconds=0,policy_accepted_at=NULL,policy_version=NULL,
      violation_log='[]'::jsonb,violation_count=0
    WHERE id=att.id RETURNING * INTO att;
  ELSE
    IF p_extra_minutes IS NULL OR p_extra_minutes < 1 OR p_extra_minutes > 180 THEN
      RETURN jsonb_build_object('ok',false,'reason','invalid_minutes');
    END IF;
    UPDATE public.exam_attempts SET status='in_progress',started_at=clock_timestamp(),submitted_at=NULL,
      score=NULL,flagged_cheating=false,time_taken_seconds=NULL,correct_count=0,incorrect_count=0,
      unanswered_count=0,result_persisted_at=NULL,time_adjustment_seconds=p_extra_minutes*60,
      policy_accepted_at=NULL,policy_version=NULL
    WHERE id=att.id RETURNING * INTO att;
  END IF;
  RETURN jsonb_build_object('ok',true,'attempt_id',att.id,'student_id',att.student_id,
    'started_at',att.started_at,'time_adjustment_seconds',att.time_adjustment_seconds,
    'message',CASE WHEN coalesce(p_restart,false)
      THEN 'تمت إعادة الامتحان من البداية، وتم مسح إجابات المحاولة السابقة.'
      ELSE 'تمت إعادة فتح المحاولة مع الوقت الإضافي، مع الاحتفاظ بالإجابات المحفوظة.' END);
END;
$function$;
REVOKE ALL ON FUNCTION public.admin_reopen_exam_attempt(uuid,integer,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reopen_exam_attempt(uuid,integer,boolean) TO authenticated;