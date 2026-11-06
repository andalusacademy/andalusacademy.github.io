DO $$
DECLARE v_def text; v_old text; v_new text;
BEGIN
 SELECT pg_get_functiondef('public.admin_adjust_exam_attempt_time(uuid,integer,boolean)'::regprocedure) INTO v_def;
 v_old := 'UPDATE public.exam_attempts SET started_at=clock_timestamp(),time_adjustment_seconds=0 WHERE id=att.id RETURNING * INTO att;';
 v_new := 'UPDATE public.exam_attempts SET started_at=clock_timestamp(),time_adjustment_seconds=0,policy_accepted_at=NULL,policy_version=NULL WHERE id=att.id RETURNING * INTO att;';
 IF position(v_old in v_def)=0 THEN RAISE EXCEPTION 'full reset update not found'; END IF;
 v_def:=replace(v_def,v_old,v_new);
 v_old := 'UPDATE public.exam_attempts SET time_adjustment_seconds=coalesce(time_adjustment_seconds,0)+(p_minutes*60)' || E'\n    WHERE id=att.id RETURNING * INTO att;';
 v_new := 'UPDATE public.exam_attempts SET time_adjustment_seconds=coalesce(time_adjustment_seconds,0)+(p_minutes*60),policy_accepted_at=NULL,policy_version=NULL' || E'\n    WHERE id=att.id RETURNING * INTO att;';
 IF position(v_old in v_def)=0 THEN RAISE EXCEPTION 'add time update not found'; END IF;
 v_def:=replace(v_def,v_old,v_new);
 EXECUTE v_def;
END $$;