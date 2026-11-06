-- Require a persisted policy acknowledgement before accepting or grading exam answers.
CREATE OR REPLACE FUNCTION public.student_exam_save_answers(p_attempt_id uuid, p_student_id text, p_phone text, p_face_token uuid, p_answers jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE att public.exam_attempts%rowtype; kv record; q public.exam_questions%rowtype; v_now timestamptz; v_deadline timestamptz;
BEGIN
  IF NOT public.student_face_phone_matches(p_student_id,p_phone)
    OR NOT EXISTS (SELECT 1 FROM public.competition_face_verified_sessions fs WHERE fs.token=p_face_token
      AND fs.student_id=btrim(p_student_id) AND fs.competition_type='exam_portal' AND fs.expires_at>now()) THEN
    RETURN jsonb_build_object('ok',false,'reason','verification_required');
  END IF;
  SELECT * INTO att FROM public.exam_attempts WHERE id=p_attempt_id AND student_id=btrim(p_student_id) AND status='in_progress' LIMIT 1 FOR UPDATE;
  IF NOT FOUND OR jsonb_typeof(coalesce(p_answers,'{}'::jsonb))<>'object' THEN
    RETURN jsonb_build_object('ok',false,'reason','attempt_not_found');
  END IF;
  IF att.policy_accepted_at IS NULL OR NULLIF(btrim(att.policy_version),'') IS NULL THEN
    RETURN jsonb_build_object('ok',false,'reason','policy_not_accepted');
  END IF;
  SELECT least(
    att.started_at + make_interval(secs=>greatest(15,coalesce(jsonb_array_length(att.question_order),0)*15)),
    coalesce(ex.available_until,att.started_at + make_interval(secs=>greatest(15,coalesce(jsonb_array_length(att.question_order),0)*15)))
  ) INTO v_deadline
  FROM public.exams ex WHERE ex.id=att.exam_id;
  v_now:=clock_timestamp();
  IF v_deadline IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','exam_not_found'); END IF;
  IF v_now >= v_deadline THEN
    RETURN jsonb_build_object('ok',false,'reason','time_expired','deadline_at',v_deadline);
  END IF;
  FOR kv IN SELECT key,value FROM jsonb_each(coalesce(p_answers,'{}'::jsonb)) LOOP
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(att.question_order) ids(id) WHERE ids.id=kv.key) THEN
      RETURN jsonb_build_object('ok',false,'reason','question_not_in_attempt');
    END IF;
    SELECT * INTO q FROM public.exam_questions WHERE id::text=kv.key AND exam_id=att.exam_id LIMIT 1;
    IF NOT FOUND OR (q.question_type='truefalse' AND kv.value #>> '{}' NOT IN ('true','false'))
      OR (coalesce(q.question_type,'')<>'truefalse' AND kv.value #>> '{}' NOT IN ('a','b','c','d')) THEN
      RETURN jsonb_build_object('ok',false,'reason','invalid_answer');
    END IF;
  END LOOP;
  UPDATE public.exam_attempts SET answers=coalesce(p_answers,'{}'::jsonb) WHERE id=att.id;
  RETURN jsonb_build_object('ok',true);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.student_exam_submit_attempt(p_attempt_id uuid, p_student_id text, p_phone text, p_face_token uuid, p_answers jsonb, p_cheating boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  att public.exam_attempts%rowtype;
  ex public.exams%rowtype;
  q public.exam_questions%rowtype;
  kv record;
  v_answers jsonb:=coalesce(p_answers,'{}'::jsonb);
  raw_score numeric:=0;
  raw_max numeric:=0;
  v_final_score numeric:=0;
  v_max_score numeric:=100;
  v_now timestamptz;
  v_end timestamptz;
  v_time integer:=0;
  v_correct_data jsonb:='[]'::jsonb;
  v_subject public.subjects%rowtype;
  v_existing public.grades%rowtype;
  v_pass numeric;
BEGIN
  IF NOT public.student_face_phone_matches(p_student_id,p_phone)
    OR NOT EXISTS (SELECT 1 FROM public.competition_face_verified_sessions fs
      WHERE fs.token=p_face_token AND fs.student_id=btrim(p_student_id)
        AND fs.competition_type='exam_portal' AND fs.expires_at>now()) THEN
    RETURN jsonb_build_object('ok',false,'reason','verification_required');
  END IF;
  SELECT * INTO att FROM public.exam_attempts
    WHERE id=p_attempt_id AND student_id=btrim(p_student_id) AND status='in_progress' LIMIT 1 FOR UPDATE;
  IF NOT FOUND OR jsonb_typeof(v_answers)<>'object' THEN
    RETURN jsonb_build_object('ok',false,'reason','attempt_not_found');
  END IF;
  IF att.policy_accepted_at IS NULL OR NULLIF(btrim(att.policy_version),'') IS NULL THEN
    RETURN jsonb_build_object('ok',false,'reason','policy_not_accepted');
  END IF;
  v_now:=clock_timestamp();
  SELECT * INTO ex FROM public.exams WHERE id=att.exam_id LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','exam_not_found'); END IF;
  IF v_now < att.started_at THEN RETURN jsonb_build_object('ok',false,'reason','invalid_start_time'); END IF;
  v_end:=least(
    att.started_at+make_interval(secs=>greatest(15,coalesce(jsonb_array_length(att.question_order),0)*15)),
    coalesce(ex.available_until,att.started_at+make_interval(secs=>greatest(15,coalesce(jsonb_array_length(att.question_order),0)*15)))
  );
  v_time:=greatest(0,floor(extract(epoch from (least(v_now,v_end)-att.started_at)))::integer);
  v_max_score:=coalesce(ex.total_score,100); IF v_now >= v_end THEN v_answers:=coalesce(att.answers,'{}'::jsonb); END IF;

  FOR kv IN SELECT key,value FROM jsonb_each(v_answers) LOOP
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(att.question_order) ids(id) WHERE ids.id=kv.key) THEN
      RETURN jsonb_build_object('ok',false,'reason','question_not_in_attempt');
    END IF;
    SELECT * INTO q FROM public.exam_questions WHERE id::text=kv.key AND exam_id=ex.id LIMIT 1;
    IF NOT FOUND OR (q.question_type='truefalse' AND kv.value #>> '{}' NOT IN ('true','false'))
      OR (coalesce(q.question_type,'')<>'truefalse' AND kv.value #>> '{}' NOT IN ('a','b','c','d')) THEN
      RETURN jsonb_build_object('ok',false,'reason','invalid_answer');
    END IF;
  END LOOP;

  IF NOT coalesce(p_cheating,false) THEN
    FOR q IN
      SELECT eq.* FROM public.exam_questions eq
      WHERE eq.exam_id=ex.id AND eq.id::text IN (SELECT jsonb_array_elements_text(att.question_order))
    LOOP
      raw_max:=raw_max+coalesce(q.points,1);
      IF v_answers->>q.id::text=q.correct_answer THEN raw_score:=raw_score+coalesce(q.points,1); END IF;
      IF coalesce(ex.show_answers_after_submit,false) THEN
        v_correct_data:=v_correct_data||jsonb_build_array(jsonb_build_object(
          'id',q.id,'question_text',q.question_text,'question_type',q.question_type,
          'option_a',q.option_a,'option_b',q.option_b,'option_c',q.option_c,'option_d',q.option_d,
          'correct_answer',q.correct_answer,'points',q.points
        ));
      END IF;
    END LOOP;
    v_final_score:=CASE WHEN raw_max>0 THEN round((raw_score/raw_max)*v_max_score,2) ELSE 0 END;
  ELSE
    v_final_score:=0;
    v_correct_data:='[]'::jsonb;
  END IF;

  UPDATE public.exam_attempts SET answers=v_answers,score=v_final_score,max_score=v_max_score,
    submitted_at=v_now,status='submitted',flagged_cheating=coalesce(p_cheating,false),time_taken_seconds=v_time
  WHERE id=att.id;

  IF NOT coalesce(ex.is_placement_test,false) THEN
    SELECT * INTO v_subject FROM public.subjects WHERE id::text=ex.subject_id::text LIMIT 1;
    IF coalesce(ex.round,1)=2 THEN
      SELECT * INTO v_existing FROM public.grades WHERE student_id=att.student_id AND subject_id::text=ex.subject_id::text LIMIT 1;
      v_pass:=coalesce(v_subject.pass_grade_1,v_subject.min_pass,25);
      IF v_existing.id IS NOT NULL AND v_existing.grade_1 IS NOT NULL AND v_existing.grade_1<v_pass THEN
        UPDATE public.grades SET grade_2=v_final_score,grade_2_source='electronic',
          grade_2_note=CASE WHEN coalesce(p_cheating,false) THEN 'غشاش' ELSE NULL END,updated_at=now()
        WHERE id=v_existing.id;
      END IF;
    ELSE
      INSERT INTO public.grades(student_id,subject_id,grade_1,grade_1_source,grade_1_note,updated_at)
      VALUES(att.student_id,ex.subject_id,v_final_score,'electronic',
        CASE WHEN coalesce(p_cheating,false) THEN 'غشاش' ELSE NULL END,now())
      ON CONFLICT(student_id,subject_id) DO UPDATE SET grade_1=EXCLUDED.grade_1,
        grade_1_source='electronic',grade_1_note=EXCLUDED.grade_1_note,updated_at=now();
    END IF;
  END IF;
  RETURN jsonb_build_object('ok',true,'score',v_final_score,'max_score',v_max_score,
    'flagged_cheating',coalesce(p_cheating,false),'time_taken_seconds',v_time,
    'answers',v_answers,'correct_data',v_correct_data,'submitted_at',v_now);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'student_exam_submit_attempt failed: %',SQLERRM;
  RETURN jsonb_build_object('ok',false,'reason','submit_failed');
END;
$function$
;
