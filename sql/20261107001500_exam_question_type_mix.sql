-- Configure per-student question type counts and keep the student portal's
-- pre-start duration estimate consistent with the actual selected question count.
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS question_type_mix jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.exams
  DROP CONSTRAINT IF EXISTS exams_question_type_mix_object_check;
ALTER TABLE public.exams
  ADD CONSTRAINT exams_question_type_mix_object_check
  CHECK (jsonb_typeof(question_type_mix) = 'object');

-- Start attempts with an independent random draw for each student.
-- A configured type count is treated as a target; if that type has fewer
-- available questions, the remaining slots are filled from unused questions.
CREATE OR REPLACE FUNCTION public.student_exam_start_attempt(p_exam_id uuid, p_student_id text, p_phone text, p_face_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  st public.students%rowtype; ex public.exams%rowtype; v_order jsonb; att public.exam_attempts%rowtype;
  qs jsonb; v_subject public.subjects%rowtype; v_total integer; v_easy integer; v_medium integer; v_hard integer;
  v_mcq integer:=0; v_truefalse integer:=0;
BEGIN
  SELECT * INTO st FROM public.students s
  WHERE s.id=btrim(coalesce(p_student_id,'')) AND s.deleted_at IS NULL AND coalesce(s.student_status,'active')='active'
    AND public.student_face_phone_matches(p_student_id,p_phone)
    AND EXISTS (SELECT 1 FROM public.competition_face_verified_sessions fs WHERE fs.token=p_face_token AND fs.student_id=s.id AND fs.competition_type='exam_portal' AND fs.expires_at>now())
  LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','verification_required'); END IF;
  SELECT * INTO ex FROM public.exams e WHERE e.id=p_exam_id LIMIT 1;
  IF NOT FOUND OR NOT coalesce(ex.is_published,false) OR ex.branch IS DISTINCT FROM st.branch OR ex.available_from>now() OR ex.available_until<=now() THEN
    RETURN jsonb_build_object('ok',false,'reason','exam_unavailable');
  END IF;
  IF coalesce(ex.targeting_mode,false) AND NOT EXISTS (SELECT 1 FROM public.exam_student_targets t WHERE t.exam_id=ex.id AND t.student_id=st.id) THEN
    RETURN jsonb_build_object('ok',false,'reason','student_not_targeted');
  END IF;
  IF jsonb_typeof(ex.program_combos)='array' AND jsonb_array_length(ex.program_combos)>0 THEN
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(ex.program_combos) c(value)
      WHERE split_part(c.value,'|',1)=coalesce(st.program_id::text,'')
      AND (split_part(c.value,'|',2)='' OR split_part(c.value,'|',2)=coalesce(st.system_name,''))) THEN
      RETURN jsonb_build_object('ok',false,'reason','program_not_allowed');
    END IF;
  ELSIF (ex.program_id IS NOT NULL AND ex.program_id::text<>st.program_id::text)
     OR (ex.system_name IS NOT NULL AND ex.system_name<>st.system_name) THEN
    RETURN jsonb_build_object('ok',false,'reason','program_not_allowed');
  END IF;
  SELECT * INTO v_subject FROM public.subjects WHERE id::text=ex.subject_id::text LIMIT 1;
  IF coalesce(ex.round,1)=2 AND NOT coalesce(ex.is_placement_test,false) AND NOT EXISTS (
    SELECT 1 FROM public.grades g WHERE g.student_id=st.id AND g.subject_id::text=ex.subject_id::text
      AND g.grade_1 IS NOT NULL AND g.grade_1 < coalesce(v_subject.pass_grade_1,v_subject.min_pass,25)
  ) THEN RETURN jsonb_build_object('ok',false,'reason','round2_not_eligible'); END IF;
  IF EXISTS (SELECT 1 FROM public.exam_attempts a WHERE a.exam_id=ex.id AND a.student_id=st.id) THEN
    RETURN jsonb_build_object('ok',false,'reason','attempt_exists');
  END IF;

  SELECT least(count(*),100)::integer INTO v_total FROM public.exam_questions q WHERE q.exam_id=ex.id;
  IF coalesce(v_total,0)=0 THEN RETURN jsonb_build_object('ok',false,'reason','no_questions'); END IF;
  v_mcq:=least(v_total,greatest(0,coalesce((ex.question_type_mix->>'mcq')::integer,0)));
  v_truefalse:=least(greatest(v_total-v_mcq,0),greatest(0,coalesce((ex.question_type_mix->>'truefalse')::integer,0)));

  IF v_mcq+v_truefalse=0 THEN
    v_easy := floor(v_total * coalesce((ex.question_mix->>'easy')::numeric,20) / 100)::integer;
    v_medium := floor(v_total * coalesce((ex.question_mix->>'medium')::numeric,60) / 100)::integer;
    v_hard := greatest(v_total-v_easy-v_medium,0);
    WITH ranked AS (
      SELECT q.id,q.difficulty,row_number() over(partition by q.difficulty order by random()) rn
      FROM public.exam_questions q WHERE q.exam_id=ex.id
    ), picked AS (
      SELECT r.id,random() random_key FROM ranked r
      WHERE (r.difficulty='easy' AND r.rn<=v_easy)
         OR (r.difficulty='medium' AND r.rn<=v_medium)
         OR (r.difficulty='hard' AND r.rn<=v_hard)
    ), remaining AS (
      SELECT q.id,random() random_key FROM public.exam_questions q
      WHERE q.exam_id=ex.id AND NOT EXISTS (SELECT 1 FROM picked p WHERE p.id=q.id)
      ORDER BY random() LIMIT greatest(v_total-(SELECT count(*) FROM picked),0)
    )
    SELECT jsonb_agg(sampled.id ORDER BY sampled.random_key) INTO v_order
    FROM (SELECT id,random_key FROM picked UNION ALL SELECT id,random_key FROM remaining) sampled;
  ELSE
    WITH typed AS (
      SELECT q.id,q.question_type FROM public.exam_questions q WHERE q.exam_id=ex.id
    ), picked AS (
      SELECT id FROM (SELECT id FROM typed WHERE question_type='truefalse' ORDER BY random() LIMIT v_truefalse) tf
      UNION ALL
      SELECT id FROM (SELECT id FROM typed WHERE question_type<>'truefalse' ORDER BY random() LIMIT v_mcq) mc
    ), remaining AS (
      SELECT t.id FROM typed t WHERE NOT EXISTS (SELECT 1 FROM picked p WHERE p.id=t.id)
      ORDER BY random() LIMIT greatest(v_total-(SELECT count(*) FROM picked),0)
    )
    SELECT jsonb_agg(sampled.id ORDER BY sampled.random_key) INTO v_order
    FROM (
      SELECT p.id,random() random_key FROM picked p
      UNION ALL
      SELECT r.id,random() random_key FROM remaining r
    ) sampled;
  END IF;

  INSERT INTO public.exam_attempts(exam_id,student_id,question_order,started_at,status,max_score)
  VALUES(ex.id,st.id,v_order,now(),'in_progress',coalesce(ex.total_score,100))
  RETURNING * INTO att;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'question_text',q.question_text,'question_type',q.question_type,
    'option_a',q.option_a,'option_b',q.option_b,'option_c',q.option_c,'option_d',q.option_d,
    'points',q.points,'order_num',q.order_num
  ) ORDER BY ord.n),'[]'::jsonb) INTO qs
  FROM jsonb_array_elements_text(att.question_order) WITH ORDINALITY ord(id,n)
  JOIN public.exam_questions q ON q.id::text=ord.id;
  RETURN jsonb_build_object('ok',true,'exam',to_jsonb(ex)||jsonb_build_object('subject_name',v_subject.name,'duration_seconds',jsonb_array_length(v_order)*15,'duration_minutes',ceil(jsonb_array_length(v_order)*15.0/60)),
    'attempt',to_jsonb(att),'questions',qs);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok',false,'reason','attempt_exists');
END;
$function$;

-- Keep the available-exams card's duration aligned with the requested type mix.
DO $$
DECLARE
  v_def text;
  v_old text := 'least((SELECT count(*) FROM public.exam_questions q WHERE q.exam_id=e.id),100)';
  v_new text := 'least((SELECT count(*) FROM public.exam_questions q WHERE q.exam_id=e.id),100,CASE WHEN coalesce((e.question_type_mix->>''mcq'')::integer,0)+coalesce((e.question_type_mix->>''truefalse'')::integer,0)>0 THEN coalesce((e.question_type_mix->>''mcq'')::integer,0)+coalesce((e.question_type_mix->>''truefalse'')::integer,0) ELSE 100 END)';
BEGIN
  v_def := pg_get_functiondef('public.student_exam_list(text,text,uuid)'::regprocedure);
  IF position(v_old in v_def)=0 THEN RAISE EXCEPTION 'duration expression anchor missing'; END IF;
  v_def := replace(v_def,v_old,v_new);
  EXECUTE v_def;
END $$;
