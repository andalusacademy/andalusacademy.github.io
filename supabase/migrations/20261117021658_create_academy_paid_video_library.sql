-- Andalus Academy paid private video library.
-- Files live in Cloudflare R2; Postgres stores metadata and access rights only.

create table if not exists public.academy_videos (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 2 and 180),
  description text,
  category text,
  price numeric(10,2) not null default 0 check (price >= 0),
  validity_days integer not null default 36500 check (validity_days between 1 and 36500),
  payment_provider text,
  payment_wallet_number text,
  r2_object_key text not null unique,
  content_type text not null default 'video/mp4',
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  thumbnail_url text,
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.academy_video_orders (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(id) on delete restrict,
  video_id uuid not null references public.academy_videos(id) on delete restrict,
  amount numeric(10,2) not null check (amount >= 0),
  status text not null default 'pending_payment'
    check (status in ('pending_payment','paid','rejected','cancelled','expired')),
  payment_reference text,
  payment_method text not null default 'manual_transfer',
  order_code text not null unique,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  reviewed_reason text,
  expires_at timestamptz,
  hidden_from_student boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academy_video_entitlements (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(id) on delete restrict,
  video_id uuid not null references public.academy_videos(id) on delete restrict,
  order_id uuid references public.academy_video_orders(id) on delete set null,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.academy_video_settings (
  singleton boolean primary key default true check (singleton),
  gateway_url text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.academy_video_settings(singleton,gateway_url)
values(true,null) on conflict(singleton) do nothing;

create index if not exists academy_video_orders_student_created_idx
  on public.academy_video_orders(student_id, created_at desc);
create index if not exists academy_video_orders_video_status_idx
  on public.academy_video_orders(video_id, status);
create index if not exists academy_video_entitlements_lookup_idx
  on public.academy_video_entitlements(student_id, video_id, starts_at, expires_at)
  where revoked_at is null;
create index if not exists academy_videos_published_sort_idx
  on public.academy_videos(is_published, sort_order, created_at desc)
  where deleted_at is null;

alter table public.academy_videos enable row level security;
alter table public.academy_video_orders enable row level security;
alter table public.academy_video_entitlements enable row level security;
alter table public.academy_video_settings enable row level security;

grant select, insert, update, delete on public.academy_videos to authenticated;
grant select on public.academy_video_orders to authenticated;
grant select on public.academy_video_entitlements to authenticated;
grant select, insert, update on public.academy_video_settings to authenticated;

drop policy if exists academy_videos_admin_all on public.academy_videos;
create policy academy_videos_admin_all on public.academy_videos
for all to authenticated using ((select public.is_admin()))
with check ((select public.is_admin()));
drop policy if exists academy_video_orders_admin_select on public.academy_video_orders;
create policy academy_video_orders_admin_select on public.academy_video_orders
for select to authenticated using ((select public.is_admin()));
drop policy if exists academy_video_entitlements_admin_select on public.academy_video_entitlements;
create policy academy_video_entitlements_admin_select on public.academy_video_entitlements
for select to authenticated using ((select public.is_admin()));
drop policy if exists academy_video_settings_admin_all on public.academy_video_settings;
create policy academy_video_settings_admin_all on public.academy_video_settings
for all to authenticated using ((select public.is_admin()))
with check ((select public.is_admin()));

create or replace function public.student_create_academy_video_order(p_session_token uuid,p_video_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_student_id text; v_video public.academy_videos%rowtype; v_order public.academy_video_orders%rowtype;
begin
  select s.student_id into v_student_id from public.competition_face_verified_sessions s
  join public.students st on st.id=s.student_id
  where s.token=p_session_token and s.competition_type='student_portal' and s.expires_at>now()
    and st.deleted_at is null and coalesce(st.student_status,'active')='active' limit 1;
  if v_student_id is null then return jsonb_build_object('ok',false,'reason','session_expired'); end if;
  select * into v_video from public.academy_videos where id=p_video_id and is_published=true and deleted_at is null for share;
  if not found then return jsonb_build_object('ok',false,'reason','video_unavailable'); end if;
  if exists(select 1 from public.academy_video_entitlements e where e.student_id=v_student_id and e.video_id=p_video_id
    and e.revoked_at is null and e.starts_at<=now() and (e.expires_at is null or e.expires_at>now())) then
    return jsonb_build_object('ok',false,'reason','already_has_access');
  end if;
  select * into v_order from public.academy_video_orders where student_id=v_student_id and video_id=p_video_id
    and status='pending_payment' and (expires_at is null or expires_at>now()) order by created_at desc limit 1;
  if not found then
    insert into public.academy_video_orders(student_id,video_id,amount,status,payment_method,order_code,expires_at)
    values(v_student_id,p_video_id,v_video.price,'pending_payment','manual_transfer',
      'AND-VID-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),now()+interval '24 hours')
    returning * into v_order;
  end if;
  return jsonb_build_object('ok',true,'order',jsonb_build_object('id',v_order.id,'order_code',v_order.order_code,
    'amount',v_order.amount,'status',v_order.status,'payment_provider',v_video.payment_provider,
    'payment_wallet_number',v_video.payment_wallet_number,'expires_at',v_order.expires_at,'video_title',v_video.title));
end; $$;

create or replace function public.student_submit_academy_video_payment_reference(p_session_token uuid,p_order_id uuid,p_payment_reference text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_student_id text; v_order public.academy_video_orders%rowtype; v_reference text:=btrim(coalesce(p_payment_reference,''));
begin
  select s.student_id into v_student_id from public.competition_face_verified_sessions s join public.students st on st.id=s.student_id
  where s.token=p_session_token and s.competition_type='student_portal' and s.expires_at>now()
    and st.deleted_at is null and coalesce(st.student_status,'active')='active' limit 1;
  if v_student_id is null then return jsonb_build_object('ok',false,'reason','session_expired'); end if;
  if length(v_reference)<3 or length(v_reference)>120 then return jsonb_build_object('ok',false,'reason','invalid_reference'); end if;
  select * into v_order from public.academy_video_orders where id=p_order_id and student_id=v_student_id for update;
  if not found or v_order.status<>'pending_payment' or (v_order.expires_at is not null and v_order.expires_at<=now()) then
    return jsonb_build_object('ok',false,'reason','order_unavailable');
  end if;
  update public.academy_video_orders set payment_reference=v_reference,updated_at=now() where id=p_order_id;
  return jsonb_build_object('ok',true,'status','pending_payment');
end; $$;

create or replace function public.admin_review_academy_video_order(p_order_id uuid,p_status text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_order public.academy_video_orders%rowtype; v_video public.academy_videos%rowtype;
  v_expiry timestamptz; v_entitlement_id uuid;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'غير مصرح' using errcode='42501'; end if;
  if p_status not in ('paid','rejected','cancelled','pending_payment') then raise exception 'حالة غير صالحة'; end if;
  select * into v_order from public.academy_video_orders where id=p_order_id for update;
  if not found then raise exception 'طلب الشراء غير موجود'; end if;
  if v_order.status='paid' and p_status='paid' then return jsonb_build_object('ok',true,'status','paid','already_processed',true); end if;
  update public.academy_video_orders set status=p_status,reviewed_by=auth.uid(),reviewed_at=now(),
    reviewed_reason=nullif(btrim(coalesce(p_reason,'')),''),updated_at=now() where id=p_order_id;
  if p_status<>'paid' then return jsonb_build_object('ok',true,'status',p_status); end if;
  select * into v_video from public.academy_videos where id=v_order.video_id and deleted_at is null;
  if not found then raise exception 'الفيديو غير موجود'; end if;
  v_expiry:=case when v_video.validity_days>=36500 then null else now()+make_interval(days=>v_video.validity_days) end;
  select id into v_entitlement_id from public.academy_video_entitlements where student_id=v_order.student_id and video_id=v_order.video_id
    order by (revoked_at is null) desc,created_at desc limit 1 for update;
  if v_entitlement_id is null then
    insert into public.academy_video_entitlements(student_id,video_id,order_id,starts_at,expires_at)
    values(v_order.student_id,v_order.video_id,v_order.id,now(),v_expiry);
  else
    update public.academy_video_entitlements set order_id=v_order.id,starts_at=now(),expires_at=v_expiry,revoked_at=null where id=v_entitlement_id;
  end if;
  return jsonb_build_object('ok',true,'status','paid','expires_at',v_expiry);
end; $$;

create or replace function public.student_list_academy_videos(p_session_token uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_student_id text; v_videos jsonb; v_orders jsonb; v_gateway text;
begin
  select s.student_id into v_student_id from public.competition_face_verified_sessions s join public.students st on st.id=s.student_id
  where s.token=p_session_token and s.competition_type='student_portal' and s.expires_at>now()
    and st.deleted_at is null and coalesce(st.student_status,'active')='active' limit 1;
  if v_student_id is null then return jsonb_build_object('ok',false,'reason','session_expired'); end if;
  select gateway_url into v_gateway from public.academy_video_settings where singleton=true;
  select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'title',v.title,'description',v.description,'category',v.category,
    'price',v.price,'validity_days',v.validity_days,'content_type',v.content_type,'created_at',v.created_at,
    'has_access',exists(select 1 from public.academy_video_entitlements e where e.student_id=v_student_id and e.video_id=v.id
      and e.revoked_at is null and e.starts_at<=now() and (e.expires_at is null or e.expires_at>now())),
    'access_expires_at',(select max(e.expires_at) from public.academy_video_entitlements e where e.student_id=v_student_id and e.video_id=v.id
      and e.revoked_at is null and e.starts_at<=now() and (e.expires_at is null or e.expires_at>now()))
    ) order by v.sort_order,v.created_at desc),'[]'::jsonb) into v_videos
  from public.academy_videos v where v.is_published=true and v.deleted_at is null;
  select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'video_id',o.video_id,'order_code',o.order_code,'amount',o.amount,
    'status',o.status,'payment_reference',o.payment_reference,'created_at',o.created_at,'expires_at',o.expires_at,
    'video_title',v.title,'payment_provider',v.payment_provider,'payment_wallet_number',v.payment_wallet_number)
    order by o.created_at desc),'[]'::jsonb) into v_orders
  from public.academy_video_orders o join public.academy_videos v on v.id=o.video_id
  where o.student_id=v_student_id and not o.hidden_from_student and o.created_at>now()-interval '30 days';
  return jsonb_build_object('ok',true,'videos',v_videos,'orders',v_orders,'gateway_url',v_gateway);
end; $$;

revoke all on function public.student_create_academy_video_order(uuid,uuid) from public;
revoke all on function public.student_submit_academy_video_payment_reference(uuid,uuid,text) from public;
revoke all on function public.student_list_academy_videos(uuid) from public;
revoke all on function public.admin_review_academy_video_order(uuid,text,text) from public,anon;
grant execute on function public.student_create_academy_video_order(uuid,uuid) to anon,authenticated;
grant execute on function public.student_submit_academy_video_payment_reference(uuid,uuid,text) to anon,authenticated;
grant execute on function public.student_list_academy_videos(uuid) to anon,authenticated;
grant execute on function public.admin_review_academy_video_order(uuid,text,text) to authenticated;
