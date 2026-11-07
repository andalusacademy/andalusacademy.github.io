-- Unified register for paper and electronic exam attempts.
create table if not exists public.exam_grade_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(id) on delete cascade,
  subject_id uuid not null references public.subjects(id),
  exam_type text not null check (exam_type in ('paper','electronic')),
  exam_round integer not null default 1 check (exam_round in (1,2)),
  attempt_number integer not null check (attempt_number >= 1),
  score numeric(8,2) not null check (score >= 0),
  max_score numeric(8,2) not null default 100 check (max_score > 0 and score <= max_score),
  exam_id uuid references public.exams(id) on delete set null,
  source_exam_attempt_id uuid unique references public.exam_attempts(id) on delete set null,
  branch text, program text, program_id text, system_name text, note text,
  recorded_at timestamptz not null default now(),
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists exam_grade_attempts_lookup_idx
  on public.exam_grade_attempts (exam_type, subject_id, exam_round, student_id, attempt_number);
alter table public.exam_grade_attempts enable row level security;
drop policy if exists exam_grade_attempts_admin_all on public.exam_grade_attempts;
create policy exam_grade_attempts_admin_all on public.exam_grade_attempts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.exam_grade_attempts to authenticated;
create or replace function public.capture_electronic_exam_grade_attempt()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_exam public.exams%rowtype; v_student public.students%rowtype; v_next integer;
begin
  if new.status <> 'submitted' or new.submitted_at is null or new.score is null then return new; end if;
  select * into v_exam from public.exams where id = new.exam_id;
  if not found or coalesce(v_exam.is_test,false) or v_exam.subject_id is null then return new; end if;
  select * into v_student from public.students where id = new.student_id;
  perform pg_advisory_xact_lock(hashtextextended(new.student_id || ':' || v_exam.subject_id::text || ':' || coalesce(v_exam.round,1)::text || ':electronic',0));
  if exists (select 1 from public.exam_grade_attempts where source_exam_attempt_id = new.id) then return new; end if;
  select coalesce(max(attempt_number),0)+1 into v_next from public.exam_grade_attempts
   where student_id=new.student_id and subject_id=v_exam.subject_id and exam_type='electronic' and exam_round=coalesce(v_exam.round,1);
  insert into public.exam_grade_attempts(student_id,subject_id,exam_type,exam_round,attempt_number,score,max_score,exam_id,source_exam_attempt_id,branch,program,program_id,system_name,note,recorded_at)
  values(new.student_id,v_exam.subject_id,'electronic',coalesce(v_exam.round,1),v_next,greatest(0,new.score),greatest(0.01,coalesce(new.max_score,v_exam.total_score,100)),new.exam_id,new.id,v_student.branch,v_student.program,v_student.program_id,v_student.system_name,'نتيجة امتحان إلكتروني — '||coalesce(v_exam.title,''),coalesce(new.submitted_at,now()));
  return new;
end; $$;
revoke all on function public.capture_electronic_exam_grade_attempt() from public, anon, authenticated;
drop trigger if exists trg_capture_electronic_exam_grade_attempt on public.exam_attempts;
create trigger trg_capture_electronic_exam_grade_attempt after insert or update of status, submitted_at, score on public.exam_attempts for each row execute function public.capture_electronic_exam_grade_attempt();

-- Preserve existing grades as the first historical attempt in each exam type/round.
insert into public.exam_grade_attempts(student_id,subject_id,exam_type,exam_round,attempt_number,score,max_score,branch,program,program_id,system_name,note,recorded_at)
select g.student_id,g.subject_id,case when g.grade_1_source='electronic' then 'electronic' else 'paper' end,1,1,g.grade_1,greatest(coalesce(s.max_grade_1,100),g.grade_1),st.branch,st.program,st.program_id,st.system_name,'درجة سابقة — تم نقلها من سجل الدرجات الحالي',coalesce(g.updated_at,g.created_at,now())
from public.grades g join public.students st on st.id=g.student_id left join public.subjects s on s.id=g.subject_id
where g.grade_1 is not null and not exists(select 1 from public.exam_grade_attempts x where x.student_id=g.student_id and x.subject_id=g.subject_id and x.exam_type=case when g.grade_1_source='electronic' then 'electronic' else 'paper' end and x.exam_round=1 and x.attempt_number=1 and x.source_exam_attempt_id is null);
insert into public.exam_grade_attempts(student_id,subject_id,exam_type,exam_round,attempt_number,score,max_score,branch,program,program_id,system_name,note,recorded_at)
select g.student_id,g.subject_id,case when g.grade_2_source='electronic' then 'electronic' else 'paper' end,2,1,g.grade_2,greatest(coalesce(s.max_grade_2,100),g.grade_2),st.branch,st.program,st.program_id,st.system_name,'درجة سابقة — تم نقلها من سجل الدرجات الحالي',coalesce(g.updated_at,g.created_at,now())
from public.grades g join public.students st on st.id=g.student_id left join public.subjects s on s.id=g.subject_id
where g.grade_2 is not null and not exists(select 1 from public.exam_grade_attempts x where x.student_id=g.student_id and x.subject_id=g.subject_id and x.exam_type=case when g.grade_2_source='electronic' then 'electronic' else 'paper' end and x.exam_round=2 and x.attempt_number=1 and x.source_exam_attempt_id is null);