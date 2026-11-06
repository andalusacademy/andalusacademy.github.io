DO $$
DECLARE v_def text; v_old text; v_new text;
BEGIN
 SELECT pg_get_functiondef('public.student_exam_list(text,text,uuid)'::regprocedure) INTO v_def;
 v_old := 'SELECT a.id,a.status,a.question_order,a.score,a.max_score,a.flagged_cheating,a.time_adjustment_seconds FROM public.exam_attempts a';
 v_new := 'SELECT a.id,a.status,a.question_order,a.score,a.max_score,a.flagged_cheating,a.time_adjustment_seconds,a.policy_accepted_at FROM public.exam_attempts a';
 IF position(v_old in v_def)=0 THEN RAISE EXCEPTION 'lateral attempt select not found'; END IF;
 v_def:=replace(v_def,v_old,v_new);
 v_old := '''attempt_flagged_cheating'',at.flagged_cheating';
 v_new := '''attempt_flagged_cheating'',at.flagged_cheating,''attempt_admin_reopened'',(at.id IS NOT NULL AND at.status=''in_progress'' AND at.policy_accepted_at IS NULL)';
 IF position(v_old in v_def)=0 THEN RAISE EXCEPTION 'attempt status fields not found'; END IF;
 v_def:=replace(v_def,v_old,v_new);
 EXECUTE v_def;
END $$;