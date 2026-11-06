-- Exam targeting: optional per-student allow-list with database enforcement.
-- Existing exams remain unrestricted because targeting_mode defaults to false.

ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS targeting_mode boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.enforce_exam_student_target()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.exams e
    WHERE e.id = NEW.exam_id AND coalesce(e.targeting_mode, false) = true
  ) AND NOT EXISTS (
    SELECT 1 FROM public.exam_student_targets t
    WHERE t.exam_id = NEW.exam_id AND t.student_id = NEW.student_id
  ) THEN
    RAISE EXCEPTION 'student_not_targeted' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_exam_student_target ON public.exam_attempts;
CREATE TRIGGER trg_enforce_exam_student_target
BEFORE INSERT ON public.exam_attempts
FOR EACH ROW EXECUTE FUNCTION public.enforce_exam_student_target();

ALTER TABLE public.exam_student_targets
  DROP CONSTRAINT IF EXISTS exam_student_targets_exam_id_fkey;
ALTER TABLE public.exam_student_targets
  ADD CONSTRAINT exam_student_targets_exam_id_fkey
  FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.student_exam_list(p_student_id text, p_phone text, p_face_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE st public.students%rowtype; result_data jsonb;
BEGIN
  SELECT * INTO st FROM public.students s
  WHERE s.id=btrim(coalesce(p_student_id,'')) AND s.deleted_at IS NULL AND coalesce(s.student_status,'active')='active'
    AND public.student_face_phone_matches(p_student_id,p_phone)
    AND EXISTS (SELECT 1 FROM public.competition_face_verified_sessions fs
      WHERE fs.token=p_face_token AND fs.student_id=s.id AND fs.competition_type='exam_portal' AND fs.expires_at>now())
  LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','verification_required'); END IF;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id',e.id,'title',e.title,'subject_id',e.subject_id,'subject_name',sub.name,
      'program_id',e.program_id,'system_name',e.system_name,'branch',e.branch,'round',e.round,
      'duration_seconds',(CASE WHEN at.id IS NOT NULL THEN jsonb_array_length(at.question_order) ELSE least((SELECT count(*) FROM public.exam_questions q WHERE q.exam_id=e.id),100) END)*15,
      'duration_minutes',ceil(((CASE WHEN at.id IS NOT NULL THEN jsonb_array_length(at.question_order) ELSE least((SELECT count(*) FROM public.exam_questions q WHERE q.exam_id=e.id),100) END)*15)::numeric/60),
      'available_from',e.available_from,'available_until',e.available_until,
      'is_easy_retake',e.is_easy_retake,'total_score',e.total_score,
      'show_answers_after_submit',e.show_answers_after_submit,'is_placement_test',e.is_placement_test,
      'program_combos',e.program_combos,'attempt_status',at.status,'attempt_id',at.id,
      'round2_eligible',true
    ) ORDER BY e.available_from
  ),'[]'::jsonb)
  INTO result_data
  FROM public.exams e
  LEFT JOIN public.subjects sub ON sub.id::text=e.subject_id::text
  LEFT JOIN LATERAL (
    SELECT a.id,a.status,a.question_order FROM public.exam_attempts a
    WHERE a.exam_id=e.id AND a.student_id=st.id
    ORDER BY a.started_at DESC LIMIT 1
  ) at ON true
  WHERE e.branch=st.branch AND e.available_from<=now() AND e.available_until>now()
    AND (coalesce(e.is_published,false)=true OR at.status='in_progress')
    AND (NOT coalesce(e.targeting_mode,false) OR EXISTS (
      SELECT 1 FROM public.exam_student_targets t WHERE t.exam_id=e.id AND t.student_id=st.id
    ))
    AND (
      (jsonb_typeof(e.program_combos)='array' AND jsonb_array_length(e.program_combos)>0
       AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(e.program_combos) c(value)
         WHERE split_part(c.value,'|',1)=coalesce(st.program_id::text,'')
           AND (split_part(c.value,'|',2)='' OR split_part(c.value,'|',2)=coalesce(st.system_name,''))))
      OR
      (coalesce(jsonb_array_length(e.program_combos),0)=0
       AND (e.program_id IS NULL OR e.program_id::text=st.program_id::text)
       AND (e.system_name IS NULL OR e.system_name=st.system_name))
    )
    AND (
      coalesce(e.round,1)<>2 OR coalesce(e.is_placement_test,false)=true
      OR EXISTS (SELECT 1 FROM public.grades g
        WHERE g.student_id=st.id AND g.subject_id::text=e.subject_id::text AND g.grade_1 IS NOT NULL
          AND g.grade_1 < coalesce(sub.pass_grade_1,sub.min_pass,25))
    );
  RETURN jsonb_build_object('ok',true,'exams',result_data);
END;
$function$;

CREATE OR REPLACE FUNCTION public.student_exam_resume_attempt(p_exam_id uuid, p_student_id text, p_phone text, p_face_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE st public.students%rowtype; ex public.exams%rowtype; att public.exam_attempts%rowtype; qs jsonb; sub public.subjects%rowtype;
BEGIN
  SELECT * INTO st FROM public.students s
  WHERE s.id=btrim(coalesce(p_student_id,'')) AND s.deleted_at IS NULL AND coalesce(s.student_status,'active')='active'
    AND public.student_face_phone_matches(p_student_id,p_phone)
    AND EXISTS (SELECT 1 FROM public.competition_face_verified_sessions fs WHERE fs.token=p_face_token AND fs.student_id=s.id AND fs.competition_type='exam_portal' AND fs.expires_at>now())
  LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','verification_required'); END IF;
  SELECT * INTO ex FROM public.exams WHERE id=p_exam_id LIMIT 1;
  SELECT * INTO att FROM public.exam_attempts WHERE exam_id=p_exam_id AND student_id=st.id ORDER BY started_at DESC LIMIT 1;
  IF ex.id IS NULL OR att.id IS NULL OR ex.branch IS DISTINCT FROM st.branch THEN
    RETURN jsonb_build_object('ok',false,'reason','attempt_not_found');
  END IF;
  IF coalesce(ex.targeting_mode,false) AND NOT EXISTS (
    SELECT 1 FROM public.exam_student_targets t WHERE t.exam_id=ex.id AND t.student_id=st.id
  ) THEN
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
  SELECT * INTO sub FROM public.subjects WHERE id::text=ex.subject_id::text LIMIT 1;
  IF coalesce(ex.round,1)=2 AND NOT coalesce(ex.is_placement_test,false) AND NOT EXISTS (
    SELECT 1 FROM public.grades g WHERE g.student_id=st.id AND g.subject_id::text=ex.subject_id::text
      AND g.grade_1 IS NOT NULL AND g.grade_1 < coalesce(sub.pass_grade_1,sub.min_pass,25)
  ) THEN RETURN jsonb_build_object('ok',false,'reason','round2_not_eligible'); END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'question_text',q.question_text,'question_type',q.question_type,
    'option_a',q.option_a,'option_b',q.option_b,'option_c',q.option_c,'option_d',q.option_d,
    'points',q.points,'order_num',q.order_num
  ) ORDER BY ord.n),'[]'::jsonb) INTO qs
  FROM jsonb_array_elements_text(att.question_order) WITH ORDINALITY ord(id,n)
  JOIN public.exam_questions q ON q.id::text=ord.id;
  RETURN jsonb_build_object('ok',true,'exam',to_jsonb(ex)||jsonb_build_object('subject_name',sub.name,'duration_seconds',jsonb_array_length(att.question_order)*15,'duration_minutes',ceil(jsonb_array_length(att.question_order)*15.0/60)),
    'attempt',to_jsonb(att),'questions',qs);
END;
$function$;
