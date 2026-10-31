-- Andalus Golden League: four-week monthly competition, fixed daily window and server-timed answers.
-- Apply only after review; this migration is intentionally stored in the feature branch and is not applied to production.

CREATE TABLE IF NOT EXISTS public.golden_league_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  title text NOT NULL DEFAULT 'دوري الأندلس الذهبي',
  timezone text NOT NULL DEFAULT 'Africa/Cairo',
  daily_start time NOT NULL DEFAULT time '19:00',
  daily_end time NOT NULL DEFAULT time '20:00',
  allowed_days integer[] NOT NULL DEFAULT ARRAY[6,0,1,2,3,4],
  questions_per_day integer NOT NULL DEFAULT 5 CHECK (questions_per_day = 5),
  points_per_question integer NOT NULL DEFAULT 10 CHECK (points_per_question = 10),
  weekly_thresholds integer[] NOT NULL DEFAULT ARRAY[200,230,260,280],
  weekly_seconds integer[] NOT NULL DEFAULT ARRAY[20,15,10,5],
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT golden_league_thresholds_valid CHECK (
    cardinality(weekly_thresholds)=4 AND weekly_thresholds[1]>=0 AND weekly_thresholds[1]<=300
    AND weekly_thresholds[2]>=0 AND weekly_thresholds[2]<=300
    AND weekly_thresholds[3]>=0 AND weekly_thresholds[3]<=300
    AND weekly_thresholds[4]>=0 AND weekly_thresholds[4]<=300
  ),
  CONSTRAINT golden_league_seconds_valid CHECK (
    cardinality(weekly_seconds)=4 AND weekly_seconds[1] BETWEEN 1 AND 60
    AND weekly_seconds[2] BETWEEN 1 AND 60 AND weekly_seconds[3] BETWEEN 1 AND 60
    AND weekly_seconds[4] BETWEEN 1 AND 60
  )
);
INSERT INTO public.golden_league_settings(id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.golden_league_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS golden_league_settings_admin_only ON public.golden_league_settings;
CREATE POLICY golden_league_settings_admin_only ON public.golden_league_settings
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.golden_league_question_starts (
  student_id text NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  quiz_date date NOT NULL,
  question_id uuid NOT NULL REFERENCES public.quiz_bank_questions(id) ON DELETE CASCADE,
  face_token uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(student_id, quiz_date, question_id)
);
ALTER TABLE public.golden_league_question_starts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS golden_league_question_starts_admin_only ON public.golden_league_question_starts;
CREATE POLICY golden_league_question_starts_admin_only ON public.golden_league_question_starts
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.golden_league_cycle_start(p_date date DEFAULT (now() AT TIME ZONE 'Africa/Cairo')::date)
RETURNS date
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $
  WITH anchors AS (
    SELECT
      (date_trunc('month',p_date)::date + ((6-extract(dow FROM date_trunc('month',p_date)::date)::integer+7)%7))::date AS current_anchor,
      (date_trunc('month',p_date - interval '1 month')::date
        + ((6-extract(dow FROM date_trunc('month',p_date - interval '1 month')::date)::integer+7)%7))::date AS previous_anchor
  )
  SELECT CASE WHEN p_date>=current_anchor THEN current_anchor ELSE previous_anchor END FROM anchors;
$;

CREATE OR REPLACE FUNCTION public.golden_league_week_number(p_date date)
RETURNS integer
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN p_date < public.golden_league_cycle_start(p_date)
      OR p_date >= public.golden_league_cycle_start(p_date) + 28 THEN 0
    ELSE ((p_date - public.golden_league_cycle_start(p_date)) / 7) + 1
  END;
$$;

CREATE OR REPLACE FUNCTION public.golden_league_update_settings(
  p_daily_start text DEFAULT '19:00',
  p_daily_end text DEFAULT '20:00',
  p_questions_per_day integer DEFAULT 5,
  p_points_per_question integer DEFAULT 10,
  p_weekly_thresholds integer[] DEFAULT ARRAY[200,230,260,280],
  p_weekly_seconds integer[] DEFAULT ARRAY[20,15,10,5]
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_start time; v_end time;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id=auth.uid() AND up.is_active IS TRUE AND up.role='admin'
  ) THEN RAISE EXCEPTION 'not authorized' USING ERRCODE='42501'; END IF;
  IF p_questions_per_day<>5 OR p_points_per_question<>10
     OR cardinality(p_weekly_thresholds)<>4 OR cardinality(p_weekly_seconds)<>4
     OR EXISTS (SELECT 1 FROM unnest(p_weekly_thresholds) x WHERE x<0 OR x>300)
     OR EXISTS (SELECT 1 FROM unnest(p_weekly_seconds) x WHERE x<1 OR x>60)
  THEN RETURN jsonb_build_object('ok',false,'reason','invalid_league_settings'); END IF;
  BEGIN v_start:=p_daily_start::time; v_end:=p_daily_end::time;
  EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('ok',false,'reason','invalid_time'); END;
  IF v_start>=v_end THEN RETURN jsonb_build_object('ok',false,'reason','invalid_time_window'); END IF;
  UPDATE public.golden_league_settings SET daily_start=v_start,daily_end=v_end,
    questions_per_day=5,points_per_question=10,
    weekly_thresholds=p_weekly_thresholds,weekly_seconds=p_weekly_seconds,updated_at=now()
  WHERE id=1;
  RETURN jsonb_build_object('ok',true);
END;
$$;

CREATE OR REPLACE FUNCTION public.golden_league_get_student_dashboard(p_student_id text,p_face_token uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_student public.students%rowtype;
  v_settings public.golden_league_settings%rowtype;
  v_today date := (now() AT TIME ZONE 'Africa/Cairo')::date;
  v_now time := (now() AT TIME ZONE 'Africa/Cairo')::time;
  v_cycle date; v_week integer; v_week_start date; v_threshold integer; v_seconds integer;
  v_my_week integer:=0; v_month integer:=0; v_correct integer:=0; v_week_breakdown jsonb; v_completed_weeks integer:=0;
  v_board jsonb; v_window text; v_eligible boolean:=true; v_i integer; v_points integer;
BEGIN
  SELECT * INTO v_student FROM public.students WHERE id=btrim(coalesce(p_student_id,'')) AND deleted_at IS NULL AND student_status='active';
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','student_not_found'); END IF;
  IF p_face_token IS NULL OR NOT (
    EXISTS (SELECT 1 FROM public.competition_face_verified_sessions s WHERE s.token=p_face_token
      AND s.student_id=v_student.id AND s.competition_type='weekly_quiz' AND s.expires_at>now()
      AND coalesce(s.verification_method,'') IN ('device','passkey','device_passkey'))
    OR EXISTS (SELECT 1 FROM public.weekly_quiz_access_audit a WHERE a.student_id=v_student.id
      AND split_part(a.photo_path,'/',3)=p_face_token::text AND a.photo_consent_at IS NOT NULL
      AND a.entered_at>=now()-interval '30 minutes')
  ) THEN RETURN jsonb_build_object('ok',false,'reason','face_verification_required'); END IF;
  SELECT * INTO v_settings FROM public.golden_league_settings WHERE id=1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','settings_missing'); END IF;
  v_cycle:=public.golden_league_cycle_start(v_today);
  v_week:=public.golden_league_week_number(v_today);
  v_week_start:=CASE WHEN v_week BETWEEN 1 AND 4 THEN v_cycle+(v_week-1)*7 ELSE NULL END;
  v_threshold:=CASE WHEN v_week BETWEEN 1 AND 4 THEN v_settings.weekly_thresholds[v_week] ELSE 0 END;
  v_seconds:=CASE WHEN v_week BETWEEN 1 AND 4 THEN v_settings.weekly_seconds[v_week] ELSE 0 END;
  IF NOT v_settings.active OR v_week=0 THEN v_window:='off_cycle';
  ELSIF NOT (extract(dow FROM v_today)::integer=ANY(v_settings.allowed_days)) THEN v_window:='closed_day';
  ELSIF v_now<v_settings.daily_start THEN v_window:='not_started';
  ELSIF v_now>=v_settings.daily_end THEN v_window:='ended';
  ELSE v_window:='open'; END IF;

  IF v_week BETWEEN 1 AND 4 THEN
    SELECT coalesce(sum(points_earned),0),count(*) FILTER(WHERE is_correct)
      INTO v_my_week,v_correct FROM public.quiz_answers
      WHERE student_id=v_student.id AND quiz_date>=v_week_start AND quiz_date<v_week_start+7;
    SELECT coalesce(sum(total_points),0) INTO v_month FROM public.quiz_weekly_scores
      WHERE student_id=v_student.id AND week_start>=v_cycle AND week_start<v_cycle+28;
    v_month:=v_month+v_my_week-COALESCE((SELECT total_points FROM public.quiz_weekly_scores
      WHERE student_id=v_student.id AND week_start=v_week_start),0);
  ELSE
    SELECT coalesce(sum(total_points),0) INTO v_month FROM public.quiz_weekly_scores
      WHERE student_id=v_student.id AND week_start>=v_cycle AND week_start<v_cycle+28;
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object('week',w,'points',coalesce(q.total_points,0),
    'threshold',v_settings.weekly_thresholds[w],'qualified',coalesce(q.total_points,0)>=v_settings.weekly_thresholds[w])
    ORDER BY w),'[]'::jsonb)
  INTO v_week_breakdown
  FROM generate_series(1,4) w
  LEFT JOIN public.quiz_weekly_scores q ON q.student_id=v_student.id AND q.week_start=v_cycle+(w-1)*7;

  v_completed_weeks:=CASE
    WHEN v_week=0 AND v_today>=v_cycle+28 THEN 4
    WHEN v_week BETWEEN 1 AND 4 THEN greatest(0,v_week-1)+CASE WHEN v_today>=v_week_start+6 THEN 1 ELSE 0 END
    ELSE 0 END;
  FOR v_i IN 1..v_completed_weeks LOOP
    SELECT coalesce(total_points,0) INTO v_points FROM public.quiz_weekly_scores
      WHERE student_id=v_student.id AND week_start=v_cycle+(v_i-1)*7;
    IF coalesce(v_points,0)<v_settings.weekly_thresholds[v_i] THEN v_eligible:=false; END IF;
  END LOOP;

  SELECT coalesce(jsonb_agg(jsonb_build_object('rank',r.rn,'student_name',r.student_name,
    'total_points',r.month_points,'week_points',r.week_points,'is_me',r.student_id=v_student.id,
    'eligible',r.eligible) ORDER BY r.rn),'[]'::jsonb)
  INTO v_board
  FROM (
    SELECT row_number() OVER(ORDER BY a.month_points DESC,a.week_points DESC,a.student_name) rn,
      a.student_id,a.student_name,a.month_points,a.week_points,a.eligible
    FROM (
      SELECT s.id student_id,s.name student_name,
        (SELECT coalesce(sum(q.total_points),0) FROM public.quiz_weekly_scores q
          WHERE q.student_id=s.id AND q.week_start>=v_cycle AND q.week_start<v_cycle+28) +
        CASE WHEN v_week BETWEEN 1 AND 4 THEN
          coalesce((SELECT sum(qa.points_earned) FROM public.quiz_answers qa
            WHERE qa.student_id=s.id AND qa.quiz_date>=v_week_start AND qa.quiz_date<v_week_start+7),0) -
          coalesce((SELECT q2.total_points FROM public.quiz_weekly_scores q2
            WHERE q2.student_id=s.id AND q2.week_start=v_week_start),0)
        ELSE 0 END AS month_points,
        CASE WHEN v_week BETWEEN 1 AND 4 THEN
          coalesce((SELECT sum(qa.points_earned) FROM public.quiz_answers qa
            WHERE qa.student_id=s.id AND qa.quiz_date>=v_week_start AND qa.quiz_date<v_week_start+7),0)
        ELSE 0 END AS week_points,
        NOT EXISTS (
          SELECT 1 FROM generate_series(1,v_completed_weeks) w
          WHERE (SELECT coalesce(q3.total_points,0) FROM public.quiz_weekly_scores q3
            WHERE q3.student_id=s.id AND q3.week_start=v_cycle+(w-1)*7)
            < v_settings.weekly_thresholds[w]
        ) AS eligible
      FROM public.students s WHERE s.deleted_at IS NULL AND s.student_status='active'
        AND EXISTS (SELECT 1 FROM public.quiz_answers qa0 WHERE qa0.student_id=s.id
          AND qa0.quiz_date>=v_cycle AND qa0.quiz_date<v_cycle+28)
    ) a
  ) r WHERE r.rn<=50 OR r.student_id=v_student.id;

  RETURN jsonb_build_object('ok',true,'cycle_start',v_cycle,'week_number',v_week,
    'week_start',v_week_start,'week_points',v_my_week,'month_points',v_month,
    'correct_count',v_correct,'weekly_threshold',v_threshold,'question_seconds',v_seconds,
    'week_breakdown',v_week_breakdown,'eligible',v_eligible,'window_status',v_window,
    'daily_start',v_settings.daily_start,'daily_end',v_settings.daily_end,
    'questions_per_day',v_settings.questions_per_day,'points_per_question',v_settings.points_per_question,
    'leaderboard',v_board);
END;
$$;

CREATE OR REPLACE FUNCTION public.golden_league_admin_report(p_cycle_start date DEFAULT public.golden_league_cycle_start((now() AT TIME ZONE 'Africa/Cairo')::date))
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path TO 'public'
AS $
DECLARE v_settings public.golden_league_settings%rowtype; v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_profiles up WHERE up.id=auth.uid() AND up.is_active IS TRUE AND up.role='admin'
  ) THEN RAISE EXCEPTION 'not authorized' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_settings FROM public.golden_league_settings WHERE id=1;
  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.total_points DESC,r.student_name),'[]'::jsonb)
  INTO v_result
  FROM (
    SELECT s.id AS student_id,s.name AS student_name,
      coalesce(max(q.total_points) FILTER(WHERE q.week_start=p_cycle_start),0) AS week1,
      coalesce(max(q.total_points) FILTER(WHERE q.week_start=p_cycle_start+7),0) AS week2,
      coalesce(max(q.total_points) FILTER(WHERE q.week_start=p_cycle_start+14),0) AS week3,
      coalesce(max(q.total_points) FILTER(WHERE q.week_start=p_cycle_start+21),0) AS week4,
      coalesce(sum(q.total_points),0) AS total_points,
      (coalesce(max(q.total_points) FILTER(WHERE q.week_start=p_cycle_start),0)>=v_settings.weekly_thresholds[1]
       AND coalesce(max(q.total_points) FILTER(WHERE q.week_start=p_cycle_start+7),0)>=v_settings.weekly_thresholds[2]
       AND coalesce(max(q.total_points) FILTER(WHERE q.week_start=p_cycle_start+14),0)>=v_settings.weekly_thresholds[3]
       AND coalesce(max(q.total_points) FILTER(WHERE q.week_start=p_cycle_start+21),0)>=v_settings.weekly_thresholds[4]) AS qualified
    FROM public.students s
    LEFT JOIN public.quiz_weekly_scores q ON q.student_id=s.id AND q.week_start>=p_cycle_start AND q.week_start<p_cycle_start+28
    WHERE s.deleted_at IS NULL AND s.student_status='active'
    GROUP BY s.id,s.name
    HAVING coalesce(sum(q.total_points),0)>0
  ) r;
  RETURN jsonb_build_object('ok',true,'cycle_start',p_cycle_start,'leaderboard',v_result);
END;
$;

CREATE OR REPLACE FUNCTION public.weekly_quiz_start_question(
  p_student_id text,p_quiz_date date,p_question_id uuid,p_face_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_settings public.golden_league_settings%rowtype;
  v_student public.students%rowtype;
  v_now timestamptz:=now();
  v_local_date date:=(now() AT TIME ZONE 'Africa/Cairo')::date;
  v_local_time time:=(now() AT TIME ZONE 'Africa/Cairo')::time;
  v_week integer; v_seconds integer; v_started timestamptz; v_existing uuid;
BEGIN
  SELECT * INTO v_settings FROM public.golden_league_settings WHERE id=1;
  IF NOT FOUND OR NOT v_settings.active THEN RETURN jsonb_build_object('ok',false,'reason','league_inactive'); END IF;
  IF p_quiz_date<>v_local_date OR NOT (extract(dow FROM v_local_date)::integer=ANY(v_settings.allowed_days)) THEN
    RETURN jsonb_build_object('ok',false,'reason','closed_day');
  END IF;
  IF v_local_time<v_settings.daily_start OR v_local_time>=v_settings.daily_end THEN
    RETURN jsonb_build_object('ok',false,'reason',CASE WHEN v_local_time<v_settings.daily_start THEN 'not_started' ELSE 'ended' END);
  END IF;
  SELECT * INTO v_student FROM public.students WHERE id=btrim(p_student_id) AND deleted_at IS NULL AND student_status='active';
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','student_not_found'); END IF;
  IF p_face_token IS NULL OR NOT (
    EXISTS(SELECT 1 FROM public.competition_face_verified_sessions s WHERE s.token=p_face_token AND s.student_id=v_student.id
      AND s.competition_type='weekly_quiz' AND s.expires_at>v_now AND coalesce(s.verification_method,'') IN ('device','passkey','device_passkey'))
    OR EXISTS(SELECT 1 FROM public.weekly_quiz_access_audit a WHERE a.student_id=v_student.id
      AND split_part(a.photo_path,'/',3)=p_face_token::text AND a.photo_consent_at IS NOT NULL AND a.entered_at>=v_now-interval '30 minutes')
  ) THEN RETURN jsonb_build_object('ok',false,'reason','session_expired'); END IF;
  v_week:=public.golden_league_week_number(v_local_date);
  IF v_week NOT BETWEEN 1 AND 4 THEN RETURN jsonb_build_object('ok',false,'reason','off_cycle'); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.quiz_daily_sessions ds WHERE ds.quiz_date=p_quiz_date
    AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(ds.question_ids) q(id) WHERE q.id=p_question_id::text))
  THEN RETURN jsonb_build_object('ok',false,'reason','question_not_scheduled'); END IF;
  IF EXISTS(SELECT 1 FROM public.quiz_answers a WHERE a.student_id=v_student.id AND a.quiz_date=p_quiz_date AND a.question_id=p_question_id)
  THEN RETURN jsonb_build_object('ok',false,'reason','already_answered'); END IF;
  v_seconds:=v_settings.weekly_seconds[v_week];
  INSERT INTO public.golden_league_question_starts(student_id,quiz_date,question_id,face_token,started_at)
  VALUES(v_student.id,p_quiz_date,p_question_id,p_face_token,v_now)
  ON CONFLICT(student_id,quiz_date,question_id) DO NOTHING;
  SELECT started_at INTO v_started FROM public.golden_league_question_starts
    WHERE student_id=v_student.id AND quiz_date=p_quiz_date AND question_id=p_question_id AND face_token=p_face_token;
  IF v_started IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','question_session_conflict'); END IF;
  RETURN jsonb_build_object('ok',true,'started_at',v_started,'seconds',v_seconds,
    'remaining_seconds',greatest(0,ceil(v_seconds-extract(epoch FROM (v_now-v_started)))::integer));
END;
$$;

CREATE OR REPLACE FUNCTION public.weekly_quiz_submit_answer(
  p_quiz_date date,p_student_id text,p_question_id uuid,p_selected_option text,p_face_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_question record; v_student record; v_correct boolean:=false; v_points integer:=0; v_inserted uuid;
  v_week_start date; v_total integer:=0; v_correct_count integer:=0; v_session_ok boolean:=false;
  v_settings public.golden_league_settings%rowtype; v_start timestamptz; v_seconds integer;
  v_local_date date:=(now() AT TIME ZONE 'Africa/Cairo')::date;
  v_local_time time:=(now() AT TIME ZONE 'Africa/Cairo')::time; v_week integer;
BEGIN
  IF p_quiz_date IS NULL OR coalesce(btrim(p_student_id),'')='' OR p_question_id IS NULL OR p_face_token IS NULL
    OR (p_selected_option IS NOT NULL AND p_selected_option NOT IN ('a','b','c','d')) THEN
    RETURN jsonb_build_object('ok',false,'reason','invalid_data');
  END IF;
  SELECT id,name INTO v_student FROM public.students WHERE id=btrim(p_student_id) AND deleted_at IS NULL AND student_status='active' LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','student_not_found'); END IF;
  SELECT * INTO v_settings FROM public.golden_league_settings WHERE id=1;
  IF NOT FOUND OR NOT v_settings.active THEN RETURN jsonb_build_object('ok',false,'reason','league_inactive'); END IF;
  IF p_quiz_date<>v_local_date OR NOT (extract(dow FROM v_local_date)::integer=ANY(v_settings.allowed_days))
    OR v_local_time<v_settings.daily_start OR v_local_time>=v_settings.daily_end THEN
    RETURN jsonb_build_object('ok',false,'reason','outside_time_window');
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.competition_face_verified_sessions s
    WHERE s.token=p_face_token AND s.student_id=v_student.id AND s.competition_type='weekly_quiz'
      AND s.expires_at>now() AND coalesce(s.verification_method,'') IN ('device','passkey','device_passkey')
  ) INTO v_session_ok;
  IF NOT v_session_ok THEN
    SELECT EXISTS (SELECT 1 FROM public.weekly_quiz_access_audit a WHERE a.student_id=v_student.id
      AND split_part(a.photo_path,'/',3)=p_face_token::text AND a.photo_consent_at IS NOT NULL
      AND a.entered_at>=now()-interval '30 minutes') INTO v_session_ok;
  END IF;
  IF NOT v_session_ok THEN RETURN jsonb_build_object('ok',false,'reason','session_expired'); END IF;
  v_week:=public.golden_league_week_number(v_local_date);
  IF v_week NOT BETWEEN 1 AND 4 THEN RETURN jsonb_build_object('ok',false,'reason','off_cycle'); END IF;
  v_seconds:=v_settings.weekly_seconds[v_week];
  SELECT started_at INTO v_start FROM public.golden_league_question_starts
    WHERE student_id=v_student.id AND quiz_date=p_quiz_date AND question_id=p_question_id AND face_token=p_face_token;
  IF v_start IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','question_not_started'); END IF;
  IF extract(epoch FROM (now()-v_start))>v_seconds+1 AND p_selected_option IS NOT NULL THEN
    RETURN jsonb_build_object('ok',false,'reason','time_expired');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.quiz_daily_sessions ds WHERE ds.quiz_date=p_quiz_date
    AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(ds.question_ids) q(id) WHERE q.id=p_question_id::text))
  THEN RETURN jsonb_build_object('ok',false,'reason','question_not_scheduled'); END IF;
  SELECT id,correct_option INTO v_question FROM public.quiz_bank_questions
    WHERE id=p_question_id AND coalesce(active,true)=true LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','question_unavailable'); END IF;
  v_correct:=p_selected_option IS NOT NULL AND p_selected_option=v_question.correct_option;
  v_points:=CASE WHEN v_correct THEN v_settings.points_per_question ELSE 0 END;
  INSERT INTO public.quiz_answers(quiz_date,student_id,question_id,selected_option,is_correct,points_earned,face_verification_token)
  VALUES(p_quiz_date,v_student.id,p_question_id,p_selected_option,v_correct,v_points,p_face_token)
  ON CONFLICT(quiz_date,student_id,question_id) DO NOTHING RETURNING id INTO v_inserted;
  IF v_inserted IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','already_answered'); END IF;
  v_week_start:=p_quiz_date-((extract(dow FROM p_quiz_date)::integer+1)%7);
  SELECT coalesce(sum(points_earned),0),count(*) FILTER(WHERE is_correct=true) INTO v_total,v_correct_count
    FROM public.quiz_answers WHERE student_id=v_student.id AND quiz_date>=v_week_start AND quiz_date<v_week_start+7;
  INSERT INTO public.quiz_weekly_scores(student_id,student_name,week_start,total_points,correct_count,updated_at)
  VALUES(v_student.id,v_student.name,v_week_start,v_total,v_correct_count,now())
  ON CONFLICT(student_id,week_start) DO UPDATE SET student_name=EXCLUDED.student_name,total_points=EXCLUDED.total_points,
    correct_count=EXCLUDED.correct_count,updated_at=now();
  RETURN jsonb_build_object('ok',true,'is_correct',v_correct,'points_earned',v_points,'correct_option',v_question.correct_option,
    'total_points',v_total,'correct_count',v_correct_count,'seconds',v_seconds);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'weekly_quiz_submit_answer failed: %',SQLERRM;
  RETURN jsonb_build_object('ok',false,'reason','submission_failed');
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_weekly_quiz_session()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_settings public.golden_league_settings%rowtype;
  v_question_ids jsonb; v_inserted date;
  v_today date := (now() AT TIME ZONE 'Africa/Cairo')::date;
  v_now time := (now() AT TIME ZONE 'Africa/Cairo')::time;
BEGIN
  SELECT * INTO v_settings FROM public.golden_league_settings WHERE id=1;
  IF NOT FOUND OR NOT v_settings.active THEN RETURN jsonb_build_object('ok',false,'reason','league_inactive'); END IF;
  IF NOT (extract(dow FROM v_today)::integer=ANY(v_settings.allowed_days)) THEN
    RETURN jsonb_build_object('ok',false,'reason','closed_day');
  END IF;
  IF v_now<v_settings.daily_start THEN RETURN jsonb_build_object('ok',false,'reason','not_started'); END IF;
  IF v_now>=v_settings.daily_end THEN RETURN jsonb_build_object('ok',false,'reason','ended'); END IF;
  IF public.golden_league_week_number(v_today)=0 THEN RETURN jsonb_build_object('ok',false,'reason','off_cycle'); END IF;
  IF EXISTS (SELECT 1 FROM public.quiz_daily_sessions WHERE quiz_date=v_today) THEN
    RETURN jsonb_build_object('ok',true,'created',false,'quiz_date',v_today);
  END IF;
  SELECT jsonb_agg(chosen.id ORDER BY chosen.random_key) INTO v_question_ids
  FROM (SELECT q.id,random() random_key FROM public.quiz_bank_questions q
    WHERE q.active IS TRUE ORDER BY random_key LIMIT 5) chosen;
  IF v_question_ids IS NULL OR jsonb_array_length(v_question_ids)<>5 THEN
    RETURN jsonb_build_object('ok',false,'reason','need_five_active_questions');
  END IF;
  INSERT INTO public.quiz_daily_sessions(quiz_date,question_ids) VALUES(v_today,v_question_ids)
    ON CONFLICT(quiz_date) DO NOTHING RETURNING quiz_date INTO v_inserted;
  RETURN jsonb_build_object('ok',true,'created',v_inserted IS NOT NULL,'quiz_date',v_today);
END;
$$;

CREATE OR REPLACE FUNCTION public.weekly_quiz_get_public_questions()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',q.id,'question',q.question,'option_a',q.option_a,'option_b',q.option_b,
    'option_c',q.option_c,'option_d',q.option_d,'category',q.category,'points',10,
    'active',q.active,'created_at',q.created_at) ORDER BY q.created_at DESC),'[]'::jsonb)
  FROM public.quiz_bank_questions q
  WHERE q.active IS TRUE AND EXISTS (
    SELECT 1 FROM public.quiz_daily_sessions ds
    CROSS JOIN LATERAL jsonb_array_elements_text(ds.question_ids) scheduled(id)
    WHERE scheduled.id=q.id::text
      AND ds.quiz_date >= ((now() AT TIME ZONE 'Africa/Cairo')::date - ((extract(dow FROM (now() AT TIME ZONE 'Africa/Cairo')::date)::integer+1)%7))
      AND ds.quiz_date <= (now() AT TIME ZONE 'Africa/Cairo')::date
  );
$$;

REVOKE ALL ON FUNCTION public.golden_league_cycle_start(date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.golden_league_week_number(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.golden_league_get_student_dashboard(text,uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.weekly_quiz_start_question(text,date,uuid,uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.weekly_quiz_submit_answer(date,text,uuid,text,uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_weekly_quiz_session() TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.weekly_quiz_get_public_questions() TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.golden_league_update_settings(text,text,integer,integer,integer[],integer[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.golden_league_admin_report(date) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_portal_notifications(p_student_id text,p_phone text,p_portal_type text DEFAULT 'student')
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $
DECLARE st public.students%rowtype; items jsonb;
BEGIN
  IF p_portal_type NOT IN ('student','parent') OR NOT public.student_face_phone_matches(p_student_id,p_phone) THEN
    RETURN jsonb_build_object('verified',false,'notifications','[]'::jsonb);
  END IF;
  SELECT * INTO st FROM public.students
  WHERE id=btrim(p_student_id) AND deleted_at IS NULL AND coalesce(student_status,'active')='active' LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('verified',false,'notifications','[]'::jsonb); END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',n.id,'title',n.title,'body',n.body,'notification_type',n.notification_type,
    'priority',n.priority,'created_at',n.created_at,'published_at',n.published_at,
    'metadata',n.metadata,
    'show_on_login',(n.show_on_login IS TRUE OR n.priority='urgent'),
    'is_read',EXISTS(SELECT 1 FROM public.notification_receipts r
      WHERE r.notification_id=n.id AND r.student_id=st.id AND r.portal_type=p_portal_type)
  ) ORDER BY CASE n.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
    coalesce(n.published_at,n.created_at) DESC),'[]'::jsonb) INTO items
  FROM public.notifications n
  WHERE n.is_published IS TRUE
    AND (n.scheduled_for IS NULL OR n.scheduled_for<=now())
    AND (n.expires_at IS NULL OR n.expires_at>now() OR n.priority='urgent')
    AND (
      n.audience='all'
      OR (n.audience='student' AND p_portal_type='student' AND (n.student_id IS NULL OR n.student_id=st.id))
      OR (n.audience='parent' AND p_portal_type='parent' AND (n.student_id IS NULL OR n.student_id=st.id))
      OR (n.audience='branch' AND n.branch=st.branch)
      OR (n.audience='program' AND n.program=st.program)
    );
  RETURN jsonb_build_object('verified',true,'notifications',items);
END;
$;

-- One-time mandatory login notice. Students must explicitly acknowledge it in the existing portal notice flow.
INSERT INTO public.notifications(
  title,body,notification_type,priority,audience,is_published,published_at,show_on_login,metadata,created_at,updated_at
)
SELECT
  '🏆 دوري الأندلس الذهبي – Andalus Golden League',
  'انطلقت منظومة دوري الأندلس الذهبي! المسابقة يوميًا من السبت إلى الخميس من 7:00 إلى 8:00 مساءً. كل يوم 5 أسئلة، كل سؤال 10 نقاط (50 نقطة يوميًا و300 أسبوعيًا). شروط التأهل الأسبوعية: 200 ثم 230 ثم 260 ثم 280 نقطة. زمن السؤال يتدرج: 20 ثم 15 ثم 10 ثم 5 ثوانٍ. يوم الجمعة لإعلان النتائج الأسبوعية، وفي نهاية الأسابيع الأربعة نعلن بطل الشهر والمراكز الثلاثة الأولى. اضغط «قرأت الإشعار» لتأكيد الاطلاع.',
  'competition','urgent','student',true,now(),true,
  jsonb_build_object('system_key','andalus_golden_league_2026_v1','mandatory_read',true),
  now(),now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.notifications n
  WHERE n.metadata->>'system_key'='andalus_golden_league_2026_v1'
);
