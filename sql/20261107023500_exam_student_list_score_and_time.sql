DO $$
DECLARE v_def text; v_old text; v_new text;
BEGIN
 SELECT pg_get_functiondef('public.student_exam_list(text,text,uuid)'::regprocedure) INTO v_def;
 v_old := 'SELECT a.id,a.status,a.question_order FROM public.exam_attempts a';
 v_new := 'SELECT a.id,a.status,a.question_order,a.score,a.max_score,a.flagged_cheating,a.time_adjustment_seconds FROM public.exam_attempts a';
 IF position(v_old in v_def)=0 THEN RAISE EXCEPTION 'lateral attempt select not found'; END IF;
 v_def:=replace(v_def,v_old,v_new);
 v_old := '''duration_seconds'',(CASE WHEN at.id IS NOT NULL THEN jsonb_array_length(at.question_order) ELSE least((SELECT count(*) FROM public.exam_questions q WHERE q.exam_id=e.id),100,CASE WHEN coalesce((e.question_type_mix->>''mcq'')::integer,0)+coalesce((e.question_type_mix->>''truefalse'')::integer,0)>0 THEN coalesce((e.question_type_mix->>''mcq'')::integer,0)+coalesce((e.question_type_mix->>''truefalse'')::integer,0) ELSE 100 END) END)*15,';
 v_new := '''duration_seconds'',(CASE WHEN at.id IS NOT NULL THEN jsonb_array_length(at.question_order) ELSE least((SELECT count(*) FROM public.exam_questions q WHERE q.exam_id=e.id),100,CASE WHEN coalesce((e.question_type_mix->>''mcq'')::integer,0)+coalesce((e.question_type_mix->>''truefalse'')::integer,0)>0 THEN coalesce((e.question_type_mix->>''mcq'')::integer,0)+coalesce((e.question_type_mix->>''truefalse'')::integer,0) ELSE 100 END) END)*15+coalesce(at.time_adjustment_seconds,0),';
 IF position(v_old in v_def)=0 THEN RAISE EXCEPTION 'duration seconds expression not found'; END IF;
 v_def:=replace(v_def,v_old,v_new);
 v_old := '''duration_minutes'',ceil(((CASE WHEN at.id IS NOT NULL THEN jsonb_array_length(at.question_order) ELSE least((SELECT count(*) FROM public.exam_questions q WHERE q.exam_id=e.id),100,CASE WHEN coalesce((e.question_type_mix->>''mcq'')::integer,0)+coalesce((e.question_type_mix->>''truefalse'')::integer,0)>0 THEN coalesce((e.question_type_mix->>''mcq'')::integer,0)+coalesce((e.question_type_mix->>''truefalse'')::integer,0) ELSE 100 END) END)*15)::numeric/60),';
 v_new := '''duration_minutes'',ceil(((CASE WHEN at.id IS NOT NULL THEN jsonb_array_length(at.question_order) ELSE least((SELECT count(*) FROM public.exam_questions q WHERE q.exam_id=e.id),100,CASE WHEN coalesce((e.question_type_mix->>''mcq'')::integer,0)+coalesce((e.question_type_mix->>''truefalse'')::integer,0)>0 THEN coalesce((e.question_type_mix->>''mcq'')::integer,0)+coalesce((e.question_type_mix->>''truefalse'')::integer,0) ELSE 100 END) END)*15+coalesce(at.time_adjustment_seconds,0))::numeric/60),';
 IF position(v_old in v_def)=0 THEN RAISE EXCEPTION 'duration minutes expression not found'; END IF;
 v_def:=replace(v_def,v_old,v_new);
 EXECUTE v_def;
END $$;