-- Three-part nursing practical summary package: 40 EGP total.
-- Package items: true/false 40, MCQ 40, essay 20.
-- Applied to Supabase production as migration study_summary_three_part_package_40_egp.

create table if not exists public.study_summary_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 180),
  price numeric not null default 0 check (price >= 0),
  validity_days integer not null default 2 check (validity_days between 1 and 3650),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.study_summary_package_items (
  package_id uuid not null references public.study_summary_packages(id) on delete cascade,
  summary_id uuid not null unique references public.study_summaries(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (package_id, summary_id)
);

alter table public.study_summary_packages enable row level security;
alter table public.study_summary_package_items enable row level security;

insert into public.study_summary_packages(name,price,validity_days,is_active)
select 'اسس التمريض عملى — الباقة الكاملة',40,2,true
where not exists(select 1 from public.study_summary_packages where name='اسس التمريض عملى — الباقة الكاملة');

insert into public.study_summary_package_items(package_id,summary_id)
select p.id,s.id
from public.study_summary_packages p
cross join public.study_summaries s
where p.name='اسس التمريض عملى — الباقة الكاملة'
  and s.id in ('df9706ea-dc3b-4e3e-9fd3-8f873a42b438','a9012eec-ad7d-4cd4-9091-794bd0977918','1e368c6b-79ac-4d2a-aaa2-6a5644071810')
on conflict(package_id,summary_id) do nothing;

-- Keep the production function definitions in sync with the applied migration.
-- The live database migration contains the full catalog/order/content/review package logic.
