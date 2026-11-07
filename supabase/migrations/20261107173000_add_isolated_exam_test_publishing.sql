ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS test_source_exam_id uuid;

CREATE INDEX IF NOT EXISTS exams_test_source_idx
  ON public.exams(test_source_exam_id)
  WHERE is_test = true;

DO $migration$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef('public.student_exam_list(text,text,uuid)'::regprocedure) INTO v_def;
  IF position('AND (NOT coalesce(e.is_test,false) OR st.id IN (''0'',''1'',''2''))' IN v_def)=0 THEN
    IF position('WHERE (coalesce(e.targeting_mode,false) OR e.branch=st.branch OR e.branch=''الفرعين'')' IN v_def)=0 THEN
      RAISE EXCEPTION 'Could not locate student_exam_list targeting clause';
    END IF;
    v_def:=replace(v_def,
      'WHERE (coalesce(e.targeting_mode,false) OR e.branch=st.branch OR e.branch=''الفرعين'')',
      'WHERE (coalesce(e.targeting_mode,false) OR e.branch=st.branch OR e.branch=''الفرعين'')' || E'\n    AND (NOT coalesce(e.is_test,false) OR st.id IN (''0'',''1'',''2''))');
    v_def:=replace(v_def,
      'AND (coalesce(e.is_published,false)=true OR at.status IN (''in_progress'',''submitted''))',
      'AND (coalesce(e.is_published,false)=true OR at.status IN (''in_progress'',''submitted''))' || E'\n    AND (NOT coalesce(e.is_test,false) OR e.is_published OR at.status=''in_progress'')');
    EXECUTE v_def;
  END IF;

  SELECT pg_get_functiondef('public.student_exam_start_attempt(uuid,text,text,uuid)'::regprocedure) INTO v_def;
  IF position('(coalesce(ex.is_test,false) AND st.id NOT IN (''0'',''1'',''2''))' IN v_def)=0 THEN
    IF position('IF NOT FOUND OR NOT coalesce(ex.is_published,false)' IN v_def)=0 THEN
      RAISE EXCEPTION 'Could not locate student_exam_start_attempt publication guard';
    END IF;
    v_def:=replace(v_def,
      'IF NOT FOUND OR NOT coalesce(ex.is_published,false)',
      'IF NOT FOUND OR (coalesce(ex.is_test,false) AND st.id NOT IN (''0'',''1'',''2'')) OR NOT coalesce(ex.is_published,false)');
    EXECUTE v_def;
  END IF;

  SELECT pg_get_functiondef('public.student_exam_resume_attempt(uuid,text,text,uuid)'::regprocedure) INTO v_def;
  IF position('IF coalesce(ex.is_test,false) AND st.id NOT IN (''0'',''1'',''2'') THEN' IN v_def)=0 THEN
    IF position('  IF ex.id IS NULL OR att.id IS NULL THEN' || E'\n    RETURN jsonb_build_object(''ok'',false,''reason'',''attempt_not_found'');' || E'\n  END IF;' IN v_def)=0 THEN
      RAISE EXCEPTION 'Could not locate student_exam_resume_attempt existence guard';
    END IF;
    v_def:=replace(v_def,
      '  IF ex.id IS NULL OR att.id IS NULL THEN' || E'\n    RETURN jsonb_build_object(''ok'',false,''reason'',''attempt_not_found'');' || E'\n  END IF;',
      '  IF ex.id IS NULL OR att.id IS NULL THEN' || E'\n    RETURN jsonb_build_object(''ok'',false,''reason'',''attempt_not_found'');' || E'\n  END IF;' || E'\n  IF coalesce(ex.is_test,false) AND st.id NOT IN (''0'',''1'',''2'') THEN' || E'\n    RETURN jsonb_build_object(''ok'',false,''reason'',''student_not_targeted'');' || E'\n  END IF;');
    EXECUTE v_def;
  END IF;

  SELECT pg_get_functiondef('public.student_exam_submit_attempt(uuid,text,text,uuid,jsonb,boolean)'::regprocedure) INTO v_def;
  IF position('AND NOT coalesce(ex.is_test,false)' IN v_def)=0 THEN
    IF position('IF att.student_id <> ''0'' AND NOT coalesce(ex.is_placement_test,false) THEN' IN v_def)=0 THEN
      RAISE EXCEPTION 'Could not locate student_exam_submit_attempt grade persistence guard';
    END IF;
    v_def:=replace(v_def,
      'IF att.student_id <> ''0'' AND NOT coalesce(ex.is_placement_test,false) THEN',
      'IF att.student_id <> ''0'' AND NOT coalesce(ex.is_placement_test,false) AND NOT coalesce(ex.is_test,false) THEN');
    EXECUTE v_def;
  END IF;
END;
$migration$;