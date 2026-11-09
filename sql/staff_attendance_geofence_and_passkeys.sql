-- Independent staff attendance subsystem. Does not alter public.attendance or student records.
-- Branch geofence seed: 31.137440053548712, 30.131224610401542 (Kafr El Dawwar), initial radius 100m.
create extension if not exists pgcrypto;

create table if not exists public.staff_attendance_settings (
 id uuid primary key default gen_random_uuid(), branch text not null unique,
 latitude double precision not null, longitude double precision not null,
 radius_m integer not null default 100 check(radius_m between 25 and 500),
 max_accuracy_m integer not null default 50 check(max_accuracy_m between 10 and 200),
 is_active boolean not null default true, updated_at timestamptz not null default now(),
 updated_by uuid references public.user_profiles(id)
);
create table if not exists public.staff_attendance_credentials (
 id uuid primary key default gen_random_uuid(),
 employee_id uuid not null references public.user_profiles(id) on delete cascade,
 credential_id text not null unique, public_key_b64 text not null,
 sign_count bigint not null default 0, transports text[] not null default '{}',
 device_type text, backed_up boolean not null default false,
 created_at timestamptz not null default now(), last_used_at timestamptz
);
create index if not exists staff_attendance_credentials_employee_idx on public.staff_attendance_credentials(employee_id);
create table if not exists public.staff_attendance_challenges (
 id uuid primary key default gen_random_uuid(),
 employee_id uuid not null references public.user_profiles(id) on delete cascade,
 action text not null check(action in ('registration','authentication')),
 challenge text not null, expires_at timestamptz not null, created_at timestamptz not null default now()
);
create index if not exists staff_attendance_challenges_employee_idx on public.staff_attendance_challenges(employee_id,created_at desc);
create table if not exists public.staff_attendance_shifts (
 id uuid primary key default gen_random_uuid(), branch text not null, name text not null,
 starts_at time not null, ends_at time not null,
 grace_minutes integer not null default 0 check(grace_minutes between 0 and 180),
 is_active boolean not null default true, created_at timestamptz not null default now(),
 created_by uuid references public.user_profiles(id)
);
create table if not exists public.staff_attendance_sessions (
 id uuid primary key default gen_random_uuid(),
 employee_id uuid not null references public.user_profiles(id), branch text not null, work_date date not null,
 check_in_at timestamptz not null, check_in_lat double precision not null, check_in_lng double precision not null,
 check_in_accuracy_m double precision not null, check_in_distance_m double precision not null,
 check_in_credential_id text not null, check_out_at timestamptz,
 check_out_lat double precision, check_out_lng double precision,
 check_out_accuracy_m double precision, check_out_distance_m double precision,
 check_out_credential_id text,
 status text not null default 'present' check(status in ('present','completed','exception')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(employee_id,work_date),
 check((check_out_at is null and check_out_lat is null and check_out_lng is null)
    or (check_out_at is not null and check_out_lat is not null and check_out_lng is not null))
);
create index if not exists staff_attendance_sessions_date_idx on public.staff_attendance_sessions(work_date desc,branch);
create index if not exists staff_attendance_sessions_employee_date_idx on public.staff_attendance_sessions(employee_id,work_date desc);
create table if not exists public.staff_attendance_events (
 id uuid primary key default gen_random_uuid(), session_id uuid references public.staff_attendance_sessions(id) on delete set null,
 employee_id uuid not null references public.user_profiles(id), branch text not null,
 event_type text not null check(event_type in ('check_in','check_out','rejected')),
 occurred_at timestamptz not null default now(), latitude double precision, longitude double precision,
 accuracy_m double precision, distance_m double precision, credential_id text,
 outcome text not null default 'accepted', rejection_reason text, created_at timestamptz not null default now()
);
create index if not exists staff_attendance_events_employee_idx on public.staff_attendance_events(employee_id,occurred_at desc);
create index if not exists staff_attendance_events_date_idx on public.staff_attendance_events(occurred_at desc,branch);
create table if not exists public.staff_attendance_exceptions (
 id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.user_profiles(id),
 session_id uuid references public.staff_attendance_sessions(id) on delete set null,
 requested_event text not null check(requested_event in ('check_in','check_out','correction')),
 reason text not null, requested_at timestamptz not null default now(),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 reviewed_by uuid references public.user_profiles(id), reviewed_at timestamptz, admin_note text
);
create index if not exists staff_attendance_exceptions_employee_idx on public.staff_attendance_exceptions(employee_id,requested_at desc);

alter table public.staff_attendance_settings enable row level security;
alter table public.staff_attendance_credentials enable row level security;
alter table public.staff_attendance_challenges enable row level security;
alter table public.staff_attendance_shifts enable row level security;
alter table public.staff_attendance_sessions enable row level security;
alter table public.staff_attendance_events enable row level security;
alter table public.staff_attendance_exceptions enable row level security;

drop policy if exists staff_attendance_settings_read on public.staff_attendance_settings;
create policy staff_attendance_settings_read on public.staff_attendance_settings for select to authenticated
 using(exists(select 1 from public.user_profiles p where p.id=(select auth.uid()) and p.is_active=true));
drop policy if exists staff_attendance_settings_admin_update on public.staff_attendance_settings;
create policy staff_attendance_settings_admin_update on public.staff_attendance_settings for update to authenticated
 using(public.is_admin()) with check(public.is_admin());
drop policy if exists staff_attendance_shifts_read on public.staff_attendance_shifts;
create policy staff_attendance_shifts_read on public.staff_attendance_shifts for select to authenticated
 using(public.is_admin() or exists(select 1 from public.user_profiles p where p.id=(select auth.uid())
 and p.is_active=true and (p.branch='الكل' or p.branch=staff_attendance_shifts.branch)));
drop policy if exists staff_attendance_shifts_admin_manage on public.staff_attendance_shifts;
drop policy if exists staff_attendance_sessions_read on public.staff_attendance_sessions;
create policy staff_attendance_sessions_read on public.staff_attendance_sessions for select to authenticated
 using(employee_id=(select auth.uid()) or public.is_admin());
drop policy if exists staff_attendance_events_read on public.staff_attendance_events;
create policy staff_attendance_events_read on public.staff_attendance_events for select to authenticated
 using(employee_id=(select auth.uid()) or public.is_admin());
drop policy if exists staff_attendance_exceptions_read on public.staff_attendance_exceptions;
create policy staff_attendance_exceptions_read on public.staff_attendance_exceptions for select to authenticated
 using(employee_id=(select auth.uid()) or public.is_admin());
drop policy if exists staff_attendance_exceptions_insert_self on public.staff_attendance_exceptions;
create policy staff_attendance_exceptions_insert_self on public.staff_attendance_exceptions for insert to authenticated
 with check(employee_id=(select auth.uid()) and exists(select 1 from public.user_profiles p
 where p.id=(select auth.uid()) and p.role='employee' and p.is_active=true));
drop policy if exists staff_attendance_exceptions_admin_update on public.staff_attendance_exceptions;
create policy staff_attendance_exceptions_admin_update on public.staff_attendance_exceptions for update to authenticated
 using(public.is_admin()) with check(public.is_admin());

-- No direct client access to WebAuthn secrets/challenges or punch writes; Edge Function uses service role.
revoke all on public.staff_attendance_settings,public.staff_attendance_credentials,public.staff_attendance_challenges,
 public.staff_attendance_shifts,public.staff_attendance_sessions,public.staff_attendance_events,
 public.staff_attendance_exceptions from anon;
revoke all on public.staff_attendance_settings,public.staff_attendance_credentials,public.staff_attendance_challenges,
 public.staff_attendance_shifts,public.staff_attendance_sessions,public.staff_attendance_events,
 public.staff_attendance_exceptions from authenticated;
grant select,update on public.staff_attendance_settings to authenticated;
grant select on public.staff_attendance_shifts,public.staff_attendance_sessions,public.staff_attendance_events to authenticated;
grant select,insert,update on public.staff_attendance_exceptions to authenticated;

insert into public.staff_attendance_settings(branch,latitude,longitude,radius_m,max_accuracy_m,is_active)
values('كفر الدوار',31.137440053548712,30.131224610401542,100,50,true)
on conflict(branch) do update set latitude=excluded.latitude,longitude=excluded.longitude,
 radius_m=excluded.radius_m,max_accuracy_m=excluded.max_accuracy_m,is_active=true,updated_at=now();
