-- Prevent a closed/expired attempt from being resumed through the student RPC.
DO $guard$
DECLARE
  v_def text;
  v_old text;
  v_new text;
BEGIN
  v_def := pg_get_functiondef('public.student_exam_resume_attempt(uuid,text,text,uuid)'::regprocedure);
  v_old := E'  IF ex.id IS NULL OR att.id IS NULL THEN\n    RETURN jsonb_build_object(''ok'',false,''reason'',''attempt_not_found'');\n  END IF;';
  v_new := v_old || E'\n  IF att.status <> ''in_progress'' THEN\n    RETURN jsonb_build_object(''ok'',false,''reason'',CASE WHEN att.status=''expired'' THEN ''time_expired'' ELSE ''attempt_closed'' END);\n  END IF;\n  IF now() >= att.started_at + make_interval(secs=>greatest(1,coalesce(ex.duration_minutes,30))*60+greatest(coalesce(att.time_adjustment_seconds,0),0)) THEN\n    RETURN jsonb_build_object(''ok'',false,''reason'',''time_expired'');\n  END IF;';
  IF position(v_old in v_def)=0 THEN RAISE EXCEPTION 'resume attempt guard anchor not found'; END IF;
  v_def := replace(v_def,v_old,v_new);
  EXECUTE v_def;
END;
$guard$;
