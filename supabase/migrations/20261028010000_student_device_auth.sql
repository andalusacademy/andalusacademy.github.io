-- Device-bound authentication for the student portal.
-- A per-install random secret is stored by the client; only its SHA-256 hash is stored here.
create table if not exists public.student_device_bindings (
  student_id text primary key references public.students(id) on delete cascade,
  device_token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.student_device_bindings enable row level security;
revoke all on public.student_device_bindings from anon, authenticated;
grant select, insert, update, delete on public.student_device_bindings to service_role;

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
  v_bound_hash text;
begin
  if coalesce(length(p_device_token), 0) < 40 or length(p_device_token) > 256 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_device');
  end if;
  v_hash := encode(extensions.digest(convert_to(p_device_token, 'UTF8'), 'sha256'), 'hex');

  -- Resume an already authenticated installation after app/browser restart.
  if coalesce(btrim(p_student_code), '') = '' and coalesce(btrim(p_national_id), '') = '' then
    select s.* into v_student
    from public.student_device_bindings b
    join public.students s on s.id = b.student_id
    where b.device_token_hash = v_hash
      and s.deleted_at is null
      and coalesce(s.student_status, 'active') = 'active'
    limit 1;
    if not found then
      return jsonb_build_object('ok', false, 'reason', 'session_not_found');
    end if;
    update public.student_device_bindings set last_seen_at = now()
      where student_id = v_student.id and device_token_hash = v_hash;
  else
    if coalesce(btrim(p_student_code), '') = '' or coalesce(btrim(p_national_id), '') = '' then
      return jsonb_build_object('ok', false, 'reason', 'invalid_credentials');
    end if;

    select * into v_student
    from public.students
    where deleted_at is null
      and coalesce(student_status, 'active') = 'active'
      and btrim(coalesce(national_id, '')) = btrim(p_national_id)
      and (btrim(coalesce(enrollment_number, '')) = btrim(p_student_code)
           or btrim(id) = btrim(p_student_code))
    limit 1;

    if not found then
      return jsonb_build_object('ok', false, 'reason', 'invalid_credentials');
    end if;

    -- Serialize first-time binding and reject credentials presented from another device.
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
      return jsonb_build_object('ok', false, 'reason', 'device_mismatch');
    end if;
    update public.student_device_bindings set last_seen_at = now()
      where student_id = v_student.id;
  end if;

  return jsonb_build_object(
    'ok', true,
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
