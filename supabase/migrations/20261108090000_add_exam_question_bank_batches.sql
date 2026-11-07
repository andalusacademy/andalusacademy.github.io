-- Persistent, isolated question-generation batches and reusable exam question bank.
-- This migration is intentionally additive: it does not alter or delete existing exam drafts/questions/attempts/grades.
create table if not exists public.exam_question_generation_batches (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid null references public.subjects(id) on delete set null,
  subject_name text not null,
  title text not null,
  question_type text not null check (question_type in ('mcq','true_false','essay')),
  requested_count integer not null check (requested_count > 0),
  saved_count integer not null default 0 check (saved_count >= 0),
  source_files jsonb not null default '[]'::jsonb check (jsonb_typeof(source_files) = 'array'),
  difficulty text not null default 'medium' check (difficulty in ('easy','medium','hard')),
  status text not null default 'processing' check (status in ('processing','completed','partial','failed')),
  error_message text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz null
);

create table if not exists public.exam_question_bank (
  id uuid primary key default gen_random_uuid(),
  generation_batch_id uuid not null references public.exam_question_generation_batches(id) on delete restrict,
  subject_id uuid null references public.subjects(id) on delete set null,
  subject_name text not null,
  question_text text not null,
  question_type text not null check (question_type in ('mcq','true_false','essay')),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  correct_answer text not null,
  explanation text null,
  difficulty text not null default 'medium' check (difficulty in ('easy','medium','hard')),
  is_active boolean not null default true,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists exam_question_batches_subject_created_idx
  on public.exam_question_generation_batches(subject_id, created_at desc);
create index if not exists exam_question_batches_type_status_idx
  on public.exam_question_generation_batches(question_type, status, created_at desc);
create index if not exists exam_question_bank_subject_type_active_idx
  on public.exam_question_bank(subject_id, question_type, is_active, created_at desc);
create index if not exists exam_question_bank_batch_idx
  on public.exam_question_bank(generation_batch_id);

alter table public.exam_question_generation_batches enable row level security;
alter table public.exam_question_bank enable row level security;

drop policy if exists exam_question_batches_admin_manage on public.exam_question_generation_batches;
create policy exam_question_batches_admin_manage
  on public.exam_question_generation_batches
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists exam_question_bank_admin_manage on public.exam_question_bank;
create policy exam_question_bank_admin_manage
  on public.exam_question_bank
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

comment on table public.exam_question_generation_batches is
  'One row per independent question-generation operation; batches are never merged.';
comment on table public.exam_question_bank is
  'Reusable question bank; each generated question is stored as its own row.';

-- Preserve provenance when a bank question is copied into a fixed exam/summary snapshot.
alter table public.exam_questions
  add column if not exists source_question_bank_id uuid null
  references public.exam_question_bank(id) on delete set null;
create index if not exists exam_questions_source_bank_idx
  on public.exam_questions(source_question_bank_id);

alter table public.study_summary_questions
  add column if not exists source_question_bank_id uuid null
  references public.exam_question_bank(id) on delete set null;
create index if not exists study_summary_questions_source_bank_idx
  on public.study_summary_questions(source_question_bank_id);

-- The summaries table has RLS enabled but no admin policy in the current schema.
-- Add the same admin-only boundary used by study_summary_questions.
drop policy if exists study_summaries_admin_all on public.study_summaries;
create policy study_summaries_admin_all
  on public.study_summaries
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
