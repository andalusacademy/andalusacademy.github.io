CREATE OR REPLACE FUNCTION public.parent_portal_get_data(p_student_id text, p_phone text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s public.students%rowtype;
  phone_digits text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  normalized_phone text;
  v_week_start date;
  v_program_fees numeric;
BEGIN
  normalized_phone := CASE
    WHEN phone_digits LIKE '0020%' THEN '0' || substr(phone_digits, 5)
    WHEN phone_digits LIKE '20%' AND length(phone_digits) = 12 THEN '0' || substr(phone_digits, 3)
    WHEN phone_digits LIKE '1%' AND length(phone_digits) = 10 THEN '0' || phone_digits
    ELSE phone_digits
  END;

  IF coalesce(btrim(p_student_id), '') = '' OR normalized_phone = '' THEN
    RETURN jsonb_build_object('student', null);
  END IF;

  SELECT * INTO s
  FROM public.students st
  WHERE st.id = btrim(p_student_id)
    AND (
      (CASE
        WHEN regexp_replace(coalesce(st.guardian_phone, ''), '[^0-9]', '', 'g') LIKE '0020%' THEN '0' || substr(regexp_replace(coalesce(st.guardian_phone, ''), '[^0-9]', '', 'g'), 5)
        WHEN regexp_replace(coalesce(st.guardian_phone, ''), '[^0-9]', '', 'g') LIKE '20%' AND length(regexp_replace(coalesce(st.guardian_phone, ''), '[^0-9]', '', 'g')) = 12 THEN '0' || substr(regexp_replace(coalesce(st.guardian_phone, ''), '[^0-9]', '', 'g'), 3)
        WHEN regexp_replace(coalesce(st.guardian_phone, ''), '[^0-9]', '', 'g') LIKE '1%' AND length(regexp_replace(coalesce(st.guardian_phone, ''), '[^0-9]', '', 'g')) = 10 THEN '0' || regexp_replace(coalesce(st.guardian_phone, ''), '[^0-9]', '', 'g')
        ELSE regexp_replace(coalesce(st.guardian_phone, ''), '[^0-9]', '', 'g')
      END) = normalized_phone
      OR
      (CASE
        WHEN regexp_replace(coalesce(st.parent_phone, ''), '[^0-9]', '', 'g') LIKE '0020%' THEN '0' || substr(regexp_replace(coalesce(st.parent_phone, ''), '[^0-9]', '', 'g'), 5)
        WHEN regexp_replace(coalesce(st.parent_phone, ''), '[^0-9]', '', 'g') LIKE '20%' AND length(regexp_replace(coalesce(st.parent_phone, ''), '[^0-9]', '', 'g')) = 12 THEN '0' || substr(regexp_replace(coalesce(st.parent_phone, ''), '[^0-9]', '', 'g'), 3)
        WHEN regexp_replace(coalesce(st.parent_phone, ''), '[^0-9]', '', 'g') LIKE '1%' AND length(regexp_replace(coalesce(st.parent_phone, ''), '[^0-9]', '', 'g')) = 10 THEN '0' || regexp_replace(coalesce(st.parent_phone, ''), '[^0-9]', '', 'g')
        ELSE regexp_replace(coalesce(st.parent_phone, ''), '[^0-9]', '', 'g')
      END) = normalized_phone
      OR
      (CASE
        WHEN regexp_replace(coalesce(st.phone, ''), '[^0-9]', '', 'g') LIKE '0020%' THEN '0' || substr(regexp_replace(coalesce(st.phone, ''), '[^0-9]', '', 'g'), 5)
        WHEN regexp_replace(coalesce(st.phone, ''), '[^0-9]', '', 'g') LIKE '20%' AND length(regexp_replace(coalesce(st.phone, ''), '[^0-9]', '', 'g')) = 12 THEN '0' || substr(regexp_replace(coalesce(st.phone, ''), '[^0-9]', '', 'g'), 3)
        WHEN regexp_replace(coalesce(st.phone, ''), '[^0-9]', '', 'g') LIKE '1%' AND length(regexp_replace(coalesce(st.phone, ''), '[^0-9]', '', 'g')) = 10 THEN '0' || regexp_replace(coalesce(st.phone, ''), '[^0-9]', '', 'g')
        ELSE regexp_replace(coalesce(st.phone, ''), '[^0-9]', '', 'g')
      END) = normalized_phone
    )
  LIMIT 1;

  IF NOT FOUND THEN RETURN jsonb_build_object('student', null); END IF;

  SELECT p.fees INTO v_program_fees
  FROM public.programs p WHERE p.id = s.program_id LIMIT 1;
  v_week_start := (current_date - ((extract(dow from current_date)::integer + 1) % 7))::date; -- أسبوع المسابقة يبدأ يوم السبت

  RETURN jsonb_build_object(
    'student', jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'age', s.age,
      'edu', s.edu,
      'phone', s.phone,
      'guardian_name', s.guardian_name,
      'guardian_phone', s.guardian_phone,
      'branch', s.branch,
      'program_id', s.program_id,
      'program', s.program,
      'system_name', s.system_name,
      'date', s.date,
      'photo_url', s.photo_url,
      'enrollment_number', s.enrollment_number,
      'enrollment_date', s.enrollment_date,
      'qualification', s.qualification,
      'parent_name', s.parent_name,
      'total_due', s.total_due,
      'blood_type', s.blood_type
    ),
    'program_fees', v_program_fees,
    'attendance', coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM public.attendance a WHERE a.student_id = s.id), '[]'::jsonb),
    'sessions', coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.schedule_sessions x WHERE x.branch = s.branch), '[]'::jsonb),
    'grades', coalesce((SELECT jsonb_agg(to_jsonb(g) ORDER BY g.id) FROM public.grades g WHERE g.student_id = s.id), '[]'::jsonb),
    'payments', coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM public.payments p WHERE p.student_id = s.id), '[]'::jsonb),
    'evaluations', coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.date DESC) FROM public.student_evaluations e WHERE e.student_id = s.id), '[]'::jsonb),
    'achievements', coalesce((SELECT jsonb_agg(to_jsonb(sa) ORDER BY sa.achievement_date DESC, sa.created_at DESC) FROM public.student_achievements sa WHERE sa.student_id = s.id), '[]'::jsonb),
    'exam_attempts', coalesce((
      SELECT jsonb_agg(
        jsonb_set(to_jsonb(ea), '{exams}',
          coalesce((SELECT jsonb_build_object('title', ex.title, 'total_score', ex.total_score) FROM public.exams ex WHERE ex.id = ea.exam_id), '{}'::jsonb),
          true
        ) ORDER BY ea.submitted_at DESC
      )
      FROM public.exam_attempts ea
      WHERE ea.student_id = s.id AND ea.status = 'submitted'
    ), '[]'::jsonb),
    'weekly_score', coalesce((SELECT to_jsonb(q) FROM public.quiz_weekly_scores q WHERE q.student_id = s.id AND q.week_start = v_week_start LIMIT 1), 'null'::jsonb),
    'procedures', coalesce((SELECT jsonb_agg(to_jsonb(pr) ORDER BY pr.date DESC NULLS LAST, pr.created_at DESC) FROM public.procedures pr WHERE pr.student_id = s.id), '[]'::jsonb),
    'subjects', coalesce((SELECT jsonb_agg(to_jsonb(subj) ORDER BY subj.name) FROM public.subjects subj), '[]'::jsonb)
  );
END;
$function$
