-- Persistent exam drafts and explicit student targeting for Andalus Academy
create table if not exists public.exam_drafts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject_id uuid references public.subjects(id) on delete set null,
  subject_name text,
  questions jsonb not null default '[]'::jsonb,
  source_files jsonb not null default '[]'::jsonb,
  source_material_ids jsonb not null default '[]'::jsonb,
  question_counts jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','approved','archived')),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exam_drafts_questions_array check (jsonb_typeof(questions) = 'array')
);
create index if not exists exam_drafts_status_updated_idx on public.exam_drafts(status, updated_at desc);
alter table public.exam_drafts enable row level security;
drop policy if exists exam_drafts_admin_manage on public.exam_drafts;
create policy exam_drafts_admin_manage on public.exam_drafts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.exam_student_targets (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  student_id text not null references public.students(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (exam_id, student_id)
);
create index if not exists exam_student_targets_student_idx on public.exam_student_targets(student_id, exam_id);
alter table public.exam_student_targets enable row level security;
drop policy if exists exam_student_targets_admin_manage on public.exam_student_targets;
create policy exam_student_targets_admin_manage on public.exam_student_targets
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.exam_attempts
  add column if not exists correct_count integer,
  add column if not exists incorrect_count integer,
  add column if not exists unanswered_count integer,
  add column if not exists result_persisted_at timestamptz;
