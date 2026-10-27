-- Harden device-bound student portal authentication.
-- Failed attempts are rate-limited by a one-way hash of the submitted identifiers.
create table if not exists public.student_device_auth_attempts (
  id bigint generated always as identity primary key,
  credential_hash text not null,
  device_hash text,
  succeeded boolean not null default false,
  reason text,
  attempted_at timestamptz not null default now()
);
create index if not exists student_device_auth_attempts_recent_idx
  on public.student_device_auth_attempts (credential_hash, attempted_at desc);
alter table public.student_device_auth_attempts enable row level security;
revoke all on public.student_device_auth_attempts from public, anon, authenticated;
grant select, insert, update, delete on public.student_device_auth_attempts to service_role;

create or replace function public.student_device_auth(
  p_student_code text,
  p_national_id text,
  p_device_token text
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_student public.students%rowtype;
  v_hash text;
  v_credential_hash text;
  v_bound_hash text;
  v_session_token uuid;
  v_failed_count integer := 0;
  v_reason text;
  v_is_resume boolean;
begin
  if coalesce(length(p_device_token), 0) < 40 or length(p_device_token) > 256 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_device');
  end if;
  v_hash := encode(extensions.digest(convert_to(p_device_token, 'UTF8'), 'sha256'), 'hex');
  v_is_resume := coalesce(btrim(p_student_code), '') = '' and coalesce(btrim(p_national_id), '') = '';
  v_credential_hash := encode(
    extensions.digest(convert_to(
      lower(btrim(coalesce(p_student_code, ''))) || ':' || btrim(coalesce(p_national_id, '')),
      'UTF8'
    ), 'sha256'), 'hex');

  -- Limit repeated credential guesses to five failed attempts per 15-minute window.
  if not v_is_resume then
    select count(*)::integer into v_failed_count
    from public.student_device_auth_attempts
    where credential_hash = v_credential_hash
      and succeeded = false
      and attempted_at > now() - interval '15 minutes';
    if v_failed_count >= 5 then
      insert into public.student_device_auth_attempts(credential_hash, device_hash, succeeded, reason)
      values (v_credential_hash, v_hash, false, 'rate_limited');
      return jsonb_build_object('ok', false, 'reason', 'rate_limited');
    end if;
  end if;

  if v_is_resume then
    select s.* into v_student
    from public.student_device_bindings b
    join public.students s on s.id = b.student_id
    where b.device_token_hash = v_hash
      and s.deleted_at is null
      and coalesce(s.student_status, 'active') = 'active'
    limit 1;

    if not found then
      insert into public.student_device_auth_attempts(credential_hash, device_hash, succeeded, reason)
      values (v_credential_hash, v_hash, false, 'session_not_found');
      return jsonb_build_object('ok', false, 'reason', 'session_not_found');
    end if;
    update public.student_device_bindings set last_seen_at = now()
      where student_id = v_student.id and device_token_hash = v_hash;
  else
    if coalesce(btrim(p_student_code), '') = '' or coalesce(btrim(p_national_id), '') = '' then
      v_reason := 'invalid_credentials';
    else
      select * into v_student
      from public.students
      where deleted_at is null
        and coalesce(student_status, 'active') = 'active'
        and btrim(coalesce(national_id, '')) = btrim(p_national_id)
        and (btrim(coalesce(enrollment_number, '')) = btrim(p_student_code)
             or btrim(id) = btrim(p_student_code))
      limit 1;

      if not found then
        v_reason := 'invalid_credentials';
      else
        perform pg_advisory_xact_lock(hashtext(v_student.id));
        select device_token_hash into v_bound_hash
        from public.student_device_bindings
        where student_id = v_student.id
        for update;

        if not found then
          insert into public.student_device_bindings(student_id, device_token_hash)
          values (v_student.id, v_hash)
          on conflict (student_id) do nothing;
          select device_token_hash into v_bound_hash
          from public.student_device_bindings where student_id = v_student.id;
        end if;

        if v_bound_hash is distinct from v_hash then
          v_reason := 'device_mismatch';
        else
          update public.student_device_bindings set last_seen_at = now()
          where student_id = v_student.id;
        end if;
      end if;
    end if;

    if v_reason is not null then
      insert into public.student_device_auth_attempts(credential_hash, device_hash, succeeded, reason)
      values (v_credential_hash, v_hash, false, v_reason);
      insert into public.student_portal_access_logs
        (student_id, enrollment_number, student_name, phone, competition_type, event_type, outcome, reason, provider, metadata)
      values
        (case when v_student.id is not null then v_student.id else null end,
         case when v_student.id is not null then coalesce(v_student.enrollment_number, v_student.id) else null end,
         case when v_student.id is not null then v_student.name else null end,
         case when v_student.id is not null then v_student.phone else null end,
         'student_portal', 'device_login', 'failed', v_reason, 'device_binding',
         jsonb_build_object('mode', 'credentials'));
      return jsonb_build_object('ok', false, 'reason', v_reason);
    end if;
  end if;

  insert into public.student_device_auth_attempts(credential_hash, device_hash, succeeded, reason)
  values (v_credential_hash, v_hash, true, case when v_is_resume then 'session_resume' else 'credentials' end);

  insert into public.competition_face_verified_sessions
    (student_id, competition_type, competition_id, expires_at, verification_method)
  values (v_student.id, 'student_portal', null, now() + interval '12 hours', 'device')
  returning token into v_session_token;

  insert into public.student_portal_access_logs
    (student_id, enrollment_number, student_name, phone, competition_type, event_type, outcome, reason, provider, metadata)
  values
    (v_student.id, coalesce(v_student.enrollment_number, v_student.id), v_student.name, v_student.phone,
     'student_portal', 'device_login', 'success',
     case when v_is_resume then 'session_resume' else 'credentials' end,
     'device_binding', jsonb_build_object('verification_method', 'device'));

  return jsonb_build_object(
    'ok', true,
    'token', v_session_token,
    'student', jsonb_build_object(
      'id', v_student.id, 'name', v_student.name, 'phone', coalesce(v_student.phone, ''),
      'branch', v_student.branch, 'program_id', v_student.program_id,
      'program', v_student.program, 'system_name', v_student.system_name,
      'photo_url', v_student.photo_url, 'date', v_student.date,
      'enrollment_number', coalesce(v_student.enrollment_number, v_student.id)
    )
  );
end;
$$;
revoke all on function public.student_device_auth(text, text, text) from public;
grant execute on function public.student_device_auth(text, text, text) to anon, authenticated;

-- Only an authenticated administrator can release a student's device binding.
create or replace function public.admin_reset_student_device_binding(p_student_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student public.students%rowtype;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into v_student
  from public.students
  where deleted_at is null
    and (btrim(id) = btrim(p_student_code)
      or btrim(coalesce(enrollment_number, '')) = btrim(p_student_code))
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'student_not_found');
  end if;

  delete from public.student_device_bindings where student_id = v_student.id;
  delete from public.competition_face_verified_sessions
    where student_id = v_student.id and competition_type = 'student_portal';

  insert into public.student_portal_access_logs
    (student_id, enrollment_number, student_name, phone, competition_type, event_type, outcome, reason, provider, metadata)
  values
    (v_student.id, coalesce(v_student.enrollment_number, v_student.id), v_student.name, v_student.phone,
     'student_portal', 'device_rebind_reset', 'success', 'admin_reset',
     'admin', jsonb_build_object('admin_user_id', auth.uid()));

  return jsonb_build_object('ok', true, 'student_id', v_student.id, 'student_name', v_student.name);
end;
$$;
revoke all on function public.admin_reset_student_device_binding(text) from public, anon;
grant execute on function public.admin_reset_student_device_binding(text) to authenticated;
