-- Issue short-lived, device-bound sessions for exam and competition workflows.
-- The device secret is never returned to the database caller; only its SHA-256 hash is compared.
create or replace function public.student_device_issue_context_token(
  p_student_id text,
  p_device_token text,
  p_context_type text,
  p_context_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_student public.students%rowtype;
  v_device_hash text;
  v_bound_hash text;
  v_token uuid;
begin
  if coalesce(length(p_device_token), 0) < 40 or length(p_device_token) > 256 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_device');
  end if;
  if p_context_type not in ('exam_portal', 'weekly_quiz', 'public_competition')
     or (p_context_type = 'public_competition' and p_context_id is null)
     or (p_context_type <> 'public_competition' and p_context_id is not null) then
    return jsonb_build_object('ok', false, 'reason', 'invalid_context');
  end if;

  v_device_hash := encode(extensions.digest(convert_to(p_device_token, 'UTF8'), 'sha256'), 'hex');
  select s.* into v_student
  from public.students s
  join public.student_device_bindings b on b.student_id = s.id
  where s.id = p_student_id
    and s.deleted_at is null
    and coalesce(s.student_status, 'active') = 'active'
    and b.device_token_hash = v_device_hash
  limit 1;

  if not found then
    select device_token_hash into v_bound_hash
    from public.student_device_bindings where student_id = p_student_id;
    if found and v_bound_hash is distinct from v_device_hash then
      return jsonb_build_object('ok', false, 'reason', 'device_mismatch');
    end if;
    return jsonb_build_object('ok', false, 'reason', 'student_inactive');
  end if;

  update public.student_device_bindings
  set last_seen_at = now()
  where student_id = v_student.id and device_token_hash = v_device_hash;

  insert into public.competition_face_verified_sessions
    (student_id, competition_type, competition_id, expires_at, verification_method)
  values
    (v_student.id, p_context_type, p_context_id, now() + interval '2 hours', 'device')
  returning token into v_token;

  insert into public.student_portal_access_logs
    (student_id, enrollment_number, student_name, phone, competition_type, event_type, outcome, reason, provider, metadata)
  values
    (v_student.id, coalesce(v_student.enrollment_number, v_student.id), v_student.name, v_student.phone,
     p_context_type, 'device_context_session', 'success', 'device_binding', 'device_binding',
     jsonb_build_object('verification_method', 'device', 'competition_id', p_context_id));

  return jsonb_build_object('ok', true, 'token', v_token, 'expires_in_seconds', 7200,
    'context_type', p_context_type, 'context_id', p_context_id);
end;
$$;

revoke all on function public.student_device_issue_context_token(text, text, text, uuid) from public;
grant execute on function public.student_device_issue_context_token(text, text, text, uuid) to anon, authenticated;
