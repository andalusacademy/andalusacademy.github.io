-- Passkey-gated variant of the existing device context session RPC.
-- Devices without a platform authenticator continue using the existing 4-argument fallback.
create or replace function public.student_device_issue_context_token(
  p_student_id text,
  p_device_token text,
  p_context_type text,
  p_context_id uuid,
  p_passkey_session_token uuid
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
  v_passkey_ok boolean := false;
begin
  if coalesce(length(p_device_token), 0) < 40 or length(p_device_token) > 256 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_device');
  end if;
  if p_context_type not in ('exam_portal', 'weekly_quiz', 'public_competition')
     or (p_context_type = 'public_competition' and p_context_id is null)
     or (p_context_type <> 'public_competition' and p_context_id is not null) then
    return jsonb_build_object('ok', false, 'reason', 'invalid_context');
  end if;
  if p_passkey_session_token is null then
    return jsonb_build_object('ok', false, 'reason', 'passkey_required');
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

  select exists(
    select 1 from public.student_passkey_sessions ps
    where ps.token = p_passkey_session_token
      and ps.student_id = v_student.id
      and ps.device_token_hash = v_device_hash
      and ps.expires_at > now()
  ) into v_passkey_ok;
  if not v_passkey_ok then
    return jsonb_build_object('ok', false, 'reason', 'passkey_required');
  end if;

  update public.student_device_bindings set last_seen_at = now()
  where student_id = v_student.id and device_token_hash = v_device_hash;

  insert into public.competition_face_verified_sessions
    (student_id, competition_type, competition_id, expires_at, verification_method)
  values
    (v_student.id, p_context_type, p_context_id, now() + interval '2 hours', 'device_passkey')
  returning token into v_token;

  insert into public.student_portal_access_logs
    (student_id, enrollment_number, student_name, phone, competition_type, event_type, outcome, reason, provider, metadata)
  values
    (v_student.id, coalesce(v_student.enrollment_number, v_student.id), v_student.name, v_student.phone,
     p_context_type, 'device_context_session', 'success', 'device_passkey', 'device_passkey',
     jsonb_build_object('verification_method', 'device_passkey', 'competition_id', p_context_id));

  return jsonb_build_object('ok', true, 'token', v_token, 'expires_in_seconds', 7200,
    'context_type', p_context_type, 'context_id', p_context_id, 'verification_method', 'device_passkey');
end;
$$;

revoke all on function public.student_device_issue_context_token(text, text, text, uuid, uuid) from public;
grant execute on function public.student_device_issue_context_token(text, text, text, uuid, uuid) to anon, authenticated;
