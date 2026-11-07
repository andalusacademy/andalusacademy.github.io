-- Andalus Academy: align all electronic-exam timers with the configured exam duration.
-- Active attempts keep their full duration even when the public availability window closes.
-- The removed student consent dialog is no longer a prerequisite for saving/submitting answers.
DO $repair$
DECLARE
  v text;
  old_text text;
BEGIN
  v := pg_get_functiondef('public.admin_adjust_exam_attempt_time(uuid,integer,boolean)'::regprocedure);
  old_text := 'v_seconds:=greatest(15,coalesce(jsonb_array_length(att.question_order),0)*15)+greatest(coalesce(att.time_adjustment_seconds,0),0);';
  IF position(old_text in v)=0 THEN RAISE EXCEPTION 'Expected admin_adjust duration expression not found'; END IF;
  v := replace(v,old_text,'v_seconds:=greatest(1,coalesce(ex.duration_minutes,30))*60+greatest(coalesce(att.time_adjustment_seconds,0),0);');
  old_text := 'v_deadline:=least(att.started_at+make_interval(secs=>v_seconds),coalesce(ex.available_until,att.started_at+make_interval(secs=>v_seconds)));';
  IF position(old_text in v)=0 THEN RAISE EXCEPTION 'Expected admin_adjust deadline expression not found'; END IF;
  v := replace(v,old_text,'v_deadline:=att.started_at+make_interval(secs=>v_seconds);');
  EXECUTE v;

  v := pg_get_functiondef('public.student_exam_list(text,text,uuid)'::regprocedure);
  old_text := '''duration_seconds'',(CASE WHEN at.id IS NOT NULL THEN jsonb_array_length(at.question_order) ELSE least((SELECT count(*) FROM public.exam_questions q WHERE q.exam_id=e.id),100,CASE WHEN coalesce((e.question_type_mix->>''mcq'')::integer,0)+coalesce((e.question_type_mix->>''truefalse'')::integer,0)>0 THEN coalesce((e.question_type_mix->>''mcq'')::integer,0)+coalesce((e.question_type_mix->>''truefalse'')::integer,0) ELSE 100 END) END)*15+coalesce(at.time_adjustment_seconds,0),';
  IF position(old_text in v)=0 THEN RAISE EXCEPTION 'Expected student_exam_list duration_seconds expression not found'; END IF;
  v := replace(v,old_text,'''duration_seconds'',greatest(1,coalesce(e.duration_minutes,30))*60+greatest(coalesce(at.time_adjustment_seconds,0),0),');
  old_text := '''duration_minutes'',ceil(((CASE WHEN at.id IS NOT NULL THEN jsonb_array_length(at.question_order) ELSE least((SELECT count(*) FROM public.exam_questions q WHERE q.exam_id=e.id),100,CASE WHEN coalesce((e.question_type_mix->>''mcq'')::integer,0)+coalesce((e.question_type_mix->>''truefalse'')::integer,0)>0 THEN coalesce((e.question_type_mix->>''mcq'')::integer,0)+coalesce((e.question_type_mix->>''truefalse'')::integer,0) ELSE 100 END) END)*15+coalesce(at.time_adjustment_seconds,0))::numeric/60),';
  IF position(old_text in v)=0 THEN RAISE EXCEPTION 'Expected student_exam_list duration_minutes expression not found'; END IF;
  v := replace(v,old_text,'''duration_minutes'',ceil((greatest(1,coalesce(e.duration_minutes,30))*60+greatest(coalesce(at.time_adjustment_seconds,0),0))::numeric/60),');
  EXECUTE v;

  v := pg_get_functiondef('public.student_exam_resume_attempt(uuid,text,text,uuid)'::regprocedure);
  old_text := '''duration_seconds'',jsonb_array_length(att.question_order)*15+greatest(coalesce(att.time_adjustment_seconds,0),0),';
  IF position(old_text in v)=0 THEN RAISE EXCEPTION 'Expected resume duration_seconds expression not found'; END IF;
  v := replace(v,old_text,'''duration_seconds'',greatest(1,coalesce(ex.duration_minutes,30))*60+greatest(coalesce(att.time_adjustment_seconds,0),0),');
  old_text := '''duration_minutes'',ceil((jsonb_array_length(att.question_order)*15.0+greatest(coalesce(att.time_adjustment_seconds,0),0))/60)';
  IF position(old_text in v)=0 THEN RAISE EXCEPTION 'Expected resume duration_minutes expression not found'; END IF;
  v := replace(v,old_text,'''duration_minutes'',ceil((greatest(1,coalesce(ex.duration_minutes,30))*60+greatest(coalesce(att.time_adjustment_seconds,0),0))::numeric/60)');
  EXECUTE v;

  v := pg_get_functiondef('public.student_exam_start_attempt(uuid,text,text,uuid)'::regprocedure);
  old_text := '''duration_seconds'',jsonb_array_length(v_order)*15,''duration_minutes'',ceil(jsonb_array_length(v_order)*15.0/60)';
  IF position(old_text in v)=0 THEN RAISE EXCEPTION 'Expected start duration expression not found'; END IF;
  v := replace(v,old_text,'''duration_seconds'',greatest(1,coalesce(ex.duration_minutes,30))*60,''duration_minutes'',greatest(1,coalesce(ex.duration_minutes,30))');
  EXECUTE v;

  v := pg_get_functiondef('public.student_exam_save_answers(uuid,text,text,uuid,jsonb)'::regprocedure);
  old_text := '  IF att.policy_accepted_at IS NULL OR NULLIF(btrim(att.policy_version),'''') IS NULL THEN' || chr(10) ||
              '    RETURN jsonb_build_object(''ok'',false,''reason'',''policy_not_accepted'');' || chr(10) ||
              '  END IF;' || chr(10);
  IF position(old_text in v)=0 THEN RAISE EXCEPTION 'Expected save_answers policy gate not found'; END IF;
  v := replace(v,old_text,'');
  old_text := '  SELECT least(' || chr(10) ||
              '    att.started_at + make_interval(secs=>greatest(15,coalesce(jsonb_array_length(att.question_order),0)*15) + greatest(coalesce(att.time_adjustment_seconds,0),0)),' || chr(10) ||
              '    coalesce(ex.available_until,att.started_at + make_interval(secs=>greatest(15,coalesce(jsonb_array_length(att.question_order),0)*15) + greatest(coalesce(att.time_adjustment_seconds,0),0)))' || chr(10) ||
              '  ) INTO v_deadline' || chr(10) ||
              '  FROM public.exams ex WHERE ex.id=att.exam_id;';
  IF position(old_text in v)=0 THEN RAISE EXCEPTION 'Expected save_answers deadline expression not found'; END IF;
  v := replace(v,old_text,'  SELECT att.started_at + make_interval(secs=>greatest(1,coalesce(ex.duration_minutes,30))*60+greatest(coalesce(att.time_adjustment_seconds,0),0)) INTO v_deadline' || chr(10) ||
                         '  FROM public.exams ex WHERE ex.id=att.exam_id;');
  EXECUTE v;

  v := pg_get_functiondef('public.student_exam_submit_attempt(uuid,text,text,uuid,jsonb,boolean)'::regprocedure);
  old_text := '  IF att.policy_accepted_at IS NULL OR NULLIF(btrim(att.policy_version),'''') IS NULL THEN' || chr(10) ||
              '    RETURN jsonb_build_object(''ok'',false,''reason'',''policy_not_accepted'');' || chr(10) ||
              '  END IF;' || chr(10);
  IF position(old_text in v)=0 THEN RAISE EXCEPTION 'Expected submit_attempt policy gate not found'; END IF;
  v := replace(v,old_text,'');
  old_text := '  v_end:=least(' || chr(10) ||
              '    att.started_at+make_interval(secs=>greatest(15,coalesce(jsonb_array_length(att.question_order),0)*15) + greatest(coalesce(att.time_adjustment_seconds,0),0)),' || chr(10) ||
              '    coalesce(ex.available_until,att.started_at+make_interval(secs=>greatest(15,coalesce(jsonb_array_length(att.question_order),0)*15) + greatest(coalesce(att.time_adjustment_seconds,0),0)))' || chr(10) ||
              '  );';
  IF position(old_text in v)=0 THEN RAISE EXCEPTION 'Expected submit_attempt deadline expression not found'; END IF;
  v := replace(v,old_text,'  v_end:=att.started_at+make_interval(secs=>greatest(1,coalesce(ex.duration_minutes,30))*60+greatest(coalesce(att.time_adjustment_seconds,0),0));');
  EXECUTE v;
END
$repair$;
