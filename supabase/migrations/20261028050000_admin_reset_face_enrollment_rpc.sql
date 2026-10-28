-- Admin-only reset of competition face enrollment. Direct client table writes stay blocked by RLS.
-- Preserves audit history and stored old image/history records; only clears the active descriptor/session.
create or replace function public.admin_reset_student_face_enrollment(p_student_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id text := btrim(coalesce(p_student_id, ''));
  v_updated integer := 0;
  v_sessions integer := 0;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if v_student_id = '' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_student_id');
  end if;
  if not exists (select 1 from public.students s where s.id = v_student_id and s.deleted_at is null) then
    return jsonb_build_object('ok', false, 'reason', 'student_not_found');
  end if;

  update public.competition_face_enrollments
     set active = false, face_descriptor = null, updated_at = now()
   where student_id = v_student_id;
  get diagnostics v_updated = row_count;

  delete from public.competition_face_verified_sessions
   where student_id = v_student_id;
  get diagnostics v_sessions = row_count;

  return jsonb_build_object('ok', true, 'student_id', v_student_id,
                            'enrollments_reset', v_updated, 'sessions_removed', v_sessions);
end;
$$;

create or replace function public.admin_reset_all_student_face_enrollments()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer := 0;
  v_sessions integer := 0;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  update public.competition_face_enrollments
     set active = false, face_descriptor = null, updated_at = now()
   where active = true;
  get diagnostics v_updated = row_count;

  delete from public.competition_face_verified_sessions;
  get diagnostics v_sessions = row_count;

  return jsonb_build_object('ok', true, 'enrollments_reset', v_updated, 'sessions_removed', v_sessions);
end;
$$;

revoke all on function public.admin_reset_student_face_enrollment(text) from public, anon;
revoke all on function public.admin_reset_all_student_face_enrollments() from public, anon;
grant execute on function public.admin_reset_student_face_enrollment(text) to authenticated;
grant execute on function public.admin_reset_all_student_face_enrollments() to authenticated;
