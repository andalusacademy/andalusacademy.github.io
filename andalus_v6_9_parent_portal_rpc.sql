-- ANDALUS ACADEMY v6.9
-- بوابة ولي الأمر: بيانات كاملة للطالب + المدفوعات + الدور الأول/الثاني + حضور كل محاضرة
-- بوابة ولي الأمر: دخول آمن بدون فتح SELECT عام على جدول students
-- شغّل الملف كاملًا مرة واحدة في Supabase SQL Editor.

create or replace function public.parent_portal_get_data(
  p_student_id text,
  p_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.students%rowtype;
  phone_digits text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  student_phone_digits text;
  guardian_phone_digits text;
  v_week_start date;
  v_program_fees numeric;
begin
  -- التحقق من رقم القيد + هاتف الطالب أو ولي الأمر داخل قاعدة البيانات.
  select * into s
  from public.students st
  where st.id = p_student_id
    and (
      regexp_replace(coalesce(st.guardian_phone, ''), '[^0-9]', '', 'g') = phone_digits
      or regexp_replace(coalesce(st.phone, ''), '[^0-9]', '', 'g') = phone_digits
    )
  limit 1;

  if not found then
    return jsonb_build_object('student', null);
  end if;

  select p.fees into v_program_fees
  from public.programs p
  where p.id = s.program_id
  limit 1;

  v_week_start := date_trunc('week', current_date)::date;

  return jsonb_build_object(
    'student', to_jsonb(s),
    'program_fees', v_program_fees,
    'attendance', coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from public.attendance a where a.student_id = s.id), '[]'::jsonb),
    'sessions', coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from public.schedule_sessions x where x.branch = s.branch), '[]'::jsonb),
    'grades', coalesce((select jsonb_agg(to_jsonb(g) order by g.id) from public.grades g where g.student_id = s.id), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(to_jsonb(p) order by p.id) from public.payments p where p.student_id = s.id), '[]'::jsonb),
    'evaluations', coalesce((select jsonb_agg(to_jsonb(e) order by e.date desc) from public.student_evaluations e where e.student_id = s.id), '[]'::jsonb),
    'exam_attempts', coalesce((
      select jsonb_agg(
        jsonb_set(
          to_jsonb(ea),
          '{exams}',
          coalesce((select jsonb_build_object('title', ex.title, 'total_score', ex.total_score) from public.exams ex where ex.id = ea.exam_id), '{}'::jsonb),
          true
        ) order by ea.submitted_at desc
      )
      from public.exam_attempts ea
      where ea.student_id = s.id and ea.status = 'submitted'
    ), '[]'::jsonb),
    'weekly_score', coalesce((select to_jsonb(q) from public.quiz_weekly_scores q where q.student_id = s.id and q.week_start = v_week_start limit 1), 'null'::jsonb),
    'procedures', coalesce((select jsonb_agg(to_jsonb(pr) order by pr.date desc nulls last, pr.created_at desc) from public.procedures pr where pr.student_id = s.id), '[]'::jsonb),
    'subjects', coalesce((select jsonb_agg(to_jsonb(subj) order by subj.name) from public.subjects subj), '[]'::jsonb)
  );
end;
$$;

-- لا تسمح لأي مستخدم باستدعاء الدالة ببيانات عشوائية غير مرغوبة،
-- لكن نحتاج السماح للزائر العام (anon) لتسجيل الدخول إلى البوابة.
revoke all on function public.parent_portal_get_data(text, text) from public;
grant execute on function public.parent_portal_get_data(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
