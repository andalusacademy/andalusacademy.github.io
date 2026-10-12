-- Weekly quiz: consent-based photo audit and admin-only activity log.
create table if not exists public.weekly_quiz_access_audit (
  id uuid primary key default gen_random_uuid(),
  student_id text not null,
  student_name text not null,
  photo_path text not null,
  user_agent text,
  browser_name text,
  device_label text,
  entered_at timestamptz not null default now(),
  photo_consent_at timestamptz not null,
  event_type text not null default 'entry'
);
create index if not exists weekly_quiz_access_audit_entered_at_idx on public.weekly_quiz_access_audit (entered_at desc);
create index if not exists weekly_quiz_access_audit_student_id_idx on public.weekly_quiz_access_audit (student_id);
alter table public.weekly_quiz_access_audit enable row level security;
revoke all on public.weekly_quiz_access_audit from anon, authenticated, public;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('weekly-quiz-face-audit', 'weekly-quiz-face-audit', false, 1048576, array['image/jpeg'])
on conflict (id) do update set public=false, file_size_limit=1048576, allowed_mime_types=array['image/jpeg'];

drop policy if exists weekly_quiz_audit_upload_anon on storage.objects;
create policy weekly_quiz_audit_upload_anon on storage.objects for insert to anon
with check (bucket_id = 'weekly-quiz-face-audit' and name like 'audit/%');
drop policy if exists weekly_quiz_audit_upload_auth on storage.objects;
create policy weekly_quiz_audit_upload_auth on storage.objects for insert to authenticated
with check (bucket_id = 'weekly-quiz-face-audit' and name like 'audit/%');
drop policy if exists weekly_quiz_audit_admin_read on storage.objects;
create policy weekly_quiz_audit_admin_read on storage.objects for select to authenticated using (
  bucket_id = 'weekly-quiz-face-audit'
  and exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'admin' and p.is_active = true)
);

create or replace function public.weekly_quiz_log_entry(
  p_student_id text, p_photo_path text, p_user_agent text default null,
  p_browser_name text default null, p_device_label text default null,
  p_photo_consent boolean default false
) returns jsonb language plpgsql security definer set search_path = public, storage as $$
declare s record;
begin
  if p_photo_consent is distinct from true then return jsonb_build_object('ok', false, 'reason', 'photo_consent_required'); end if;
  if coalesce(p_student_id,'') = '' or coalesce(p_photo_path,'') not like 'audit/%' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_data');
  end if;
  select id, name into s from public.students where id = btrim(p_student_id) limit 1;
  if not found then return jsonb_build_object('ok', false, 'reason', 'registration_not_found'); end if;
  insert into public.weekly_quiz_access_audit
    (student_id, student_name, photo_path, user_agent, browser_name, device_label, photo_consent_at)
  values (s.id, s.name, p_photo_path, left(p_user_agent, 1000), left(p_browser_name, 100), left(p_device_label, 100), now());
  insert into public.competition_security_logs
    (competition_type, enrollment_number, student_id, event_type, outcome, reason, user_agent, device_label, metadata)
  values ('weekly_quiz', s.id, s.id, 'weekly_quiz_entry', 'success', 'registration_number_and_photo_consent',
    left(p_user_agent,1000), left(p_device_label,100),
    jsonb_build_object('browser',left(p_browser_name,100),'photo_path',p_photo_path,'photo_consent',true));
  return jsonb_build_object('ok', true, 'student_id', s.id, 'student_name', s.name);
exception when others then
  raise warning 'weekly_quiz_log_entry failed: %', sqlerrm;
  return jsonb_build_object('ok', false, 'reason', 'audit_write_failed');
end; $$;

create or replace function public.weekly_quiz_admin_audit(p_limit integer default 200)
returns table (id uuid, student_id text, student_name text, photo_path text, user_agent text,
  browser_name text, device_label text, entered_at timestamptz, photo_consent_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'admin' and p.is_active = true
  ) then raise exception 'admin_only'; end if;
  return query select a.id, a.student_id, a.student_name, a.photo_path, a.user_agent,
    a.browser_name, a.device_label, a.entered_at, a.photo_consent_at
  from public.weekly_quiz_access_audit a order by a.entered_at desc
  limit greatest(1, least(coalesce(p_limit,200),500));
end; $$;

revoke all on function public.weekly_quiz_log_entry(text,text,text,text,text,boolean) from public;
grant execute on function public.weekly_quiz_log_entry(text,text,text,text,text,boolean) to anon, authenticated;
revoke all on function public.weekly_quiz_admin_audit(integer) from public, anon;
grant execute on function public.weekly_quiz_admin_audit(integer) to authenticated;
