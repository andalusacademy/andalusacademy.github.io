-- Close expired electronic exam attempts on the server and provide an explicit admin stop action.
-- The per-attempt deadline is duration_minutes plus any admin-granted time.
-- Closing an attempt grades only answers already saved by the server.

CREATE OR REPLACE FUNCTION public.finalize_exam_attempt_internal(p_attempt_id uuid,p_final_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $function$
DECLARE
  att public.exam_attempts%rowtype; ex public.exams%rowtype; q public.exam_questions%rowtype;
  v_answers jsonb; v_now timestamptz; v_deadline timestamptz; v_elapsed integer; v_duration integer;
  v_raw_score numeric:=0; v_raw_max numeric:=0; v_score numeric:=0; v_max_score numeric:=100;
  v_correct integer:=0; v_incorrect integer:=0; v_unanswered integer:=0;
  v_subject public.subjects%rowtype; v_existing public.grades%rowtype; v_pass numeric;
BEGIN
  IF p_final_status NOT IN ('expired','abandoned') THEN RETURN jsonb_build_object('ok',false,'reason','invalid_final_status'); END IF;
  SELECT * INTO att FROM public.exam_attempts WHERE id=p_attempt_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','attempt_not_found'); END IF;
  IF att.status<>'in_progress' THEN RETURN jsonb_build_object('ok',false,'reason','attempt_not_in_progress','status',att.status); END IF;
  SELECT * INTO ex FROM public.exams WHERE id=att.exam_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','exam_not_found'); END IF;
  v_now:=clock_timestamp();
  v_duration:=greatest(1,coalesce(ex.duration_minutes,30))*60+greatest(coalesce(att.time_adjustment_seconds,0),0);
  v_deadline:=att.started_at+make_interval(secs=>v_duration);
  IF p_final_status='expired' AND v_now<v_deadline THEN RETURN jsonb_build_object('ok',false,'reason','not_due','deadline_at',v_deadline); END IF;
  v_answers:=coalesce(att.answers,'{}'::jsonb);
  v_max_score:=coalesce(ex.total_score,100);
  FOR q IN
    SELECT eq.* FROM public.exam_questions eq
    WHERE eq.exam_id=ex.id AND eq.id::text IN (SELECT jsonb_array_elements_text(coalesce(att.question_order,'[]'::jsonb)))
  LOOP
    v_raw_max:=v_raw_max+coalesce(q.points,1);
    IF v_answers->>q.id::text=q.correct_answer THEN
      v_raw_score:=v_raw_score+coalesce(q.points,1); v_correct:=v_correct+1;
    ELSIF nullif(v_answers->>q.id::text,'') IS NOT NULL THEN v_incorrect:=v_incorrect+1;
    ELSE v_unanswered:=v_unanswered+1;
    END IF;
  END LOOP;
  IF coalesce(att.flagged_cheating,false) THEN v_score:=0;
  ELSIF v_raw_max>0 THEN v_score:=round((v_raw_score/v_raw_max)*v_max_score,2); END IF;
  v_elapsed:=greatest(0,floor(extract(epoch FROM (least(v_now,v_deadline)-att.started_at)))::integer);
  UPDATE public.exam_attempts SET answers=v_answers,score=v_score,max_score=v_max_score,status=p_final_status,
    submitted_at=CASE WHEN p_final_status='expired' THEN v_deadline ELSE v_now END,
    time_taken_seconds=v_elapsed,correct_count=v_correct,incorrect_count=v_incorrect,
    unanswered_count=v_unanswered,result_persisted_at=clock_timestamp()
  WHERE id=att.id;
  IF att.student_id NOT IN ('0','1','2') AND NOT coalesce(ex.is_placement_test,false)
     AND NOT coalesce(ex.is_test,false) AND ex.subject_id IS NOT NULL THEN
    SELECT * INTO v_subject FROM public.subjects WHERE id::text=ex.subject_id::text LIMIT 1;
    IF coalesce(ex.round,1)=2 THEN
      SELECT * INTO v_existing FROM public.grades
      WHERE student_id=att.student_id AND subject_id::text=ex.subject_id::text LIMIT 1;
      v_pass:=coalesce(v_subject.pass_grade_1,v_subject.min_pass,25);
      IF v_existing.id IS NOT NULL AND v_existing.grade_1 IS NOT NULL AND v_existing.grade_1<v_pass THEN
        UPDATE public.grades SET grade_2=v_score,grade_2_source='electronic',
          grade_2_note=CASE WHEN coalesce(att.flagged_cheating,false) THEN 'غشاش' ELSE NULL END,updated_at=now()
        WHERE id=v_existing.id;
      END IF;
    ELSE
      INSERT INTO public.grades(student_id,subject_id,grade_1,grade_1_source,grade_1_note,updated_at)
      VALUES(att.student_id,ex.subject_id,v_score,'electronic',
        CASE WHEN coalesce(att.flagged_cheating,false) THEN 'غشاش' ELSE NULL END,now())
      ON CONFLICT(student_id,subject_id) DO UPDATE SET grade_1=EXCLUDED.grade_1,
        grade_1_source='electronic',grade_1_note=EXCLUDED.grade_1_note,updated_at=now();
    END IF;
  END IF;
  RETURN jsonb_build_object('ok',true,'attempt_id',att.id,'status',p_final_status,'score',v_score,
    'max_score',v_max_score,'correct_count',v_correct,'incorrect_count',v_incorrect,
    'unanswered_count',v_unanswered,'time_taken_seconds',v_elapsed);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_stop_exam_attempt(p_attempt_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $function$
DECLARE v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required' USING ERRCODE='42501'; END IF;
  v_result:=public.finalize_exam_attempt_internal(p_attempt_id,'abandoned');
  IF coalesce((v_result->>'ok')::boolean,false) THEN
    v_result:=v_result||jsonb_build_object('message','تم إيقاف المحاولة وحفظ نتيجتها من الإجابات المحفوظة حتى لحظة الإيقاف.');
  END IF;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.expire_overdue_exam_attempts()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $function$
DECLARE v_id uuid; v_result jsonb; v_count integer:=0;
BEGIN
  FOR v_id IN
    SELECT a.id FROM public.exam_attempts a JOIN public.exams e ON e.id=a.exam_id
    WHERE a.status='in_progress'
      AND clock_timestamp()>=a.started_at+make_interval(secs=>greatest(1,coalesce(e.duration_minutes,30))*60+greatest(coalesce(a.time_adjustment_seconds,0),0))
    ORDER BY a.started_at LIMIT 500 FOR UPDATE OF a SKIP LOCKED
  LOOP
    v_result:=public.finalize_exam_attempt_internal(v_id,'expired');
    IF coalesce((v_result->>'ok')::boolean,false) THEN v_count:=v_count+1; END IF;
  END LOOP;
  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_expire_overdue_exam_attempts()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'admin_required' USING ERRCODE='42501'; END IF;
  RETURN public.expire_overdue_exam_attempts();
END;
$function$;

REVOKE ALL ON FUNCTION public.finalize_exam_attempt_internal(uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.expire_overdue_exam_attempts() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_stop_exam_attempt(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_expire_overdue_exam_attempts() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_stop_exam_attempt(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_expire_overdue_exam_attempts() TO authenticated;

DO $schedule$
DECLARE v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname='andalus-expire-overdue-exam-attempts' LIMIT 1;
  IF v_job_id IS NOT NULL THEN PERFORM cron.unschedule(v_job_id); END IF;
  PERFORM cron.schedule('andalus-expire-overdue-exam-attempts','* * * * *','select public.expire_overdue_exam_attempts();');
END;
$schedule$;
