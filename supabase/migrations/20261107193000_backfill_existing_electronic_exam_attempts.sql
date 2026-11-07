-- Capture only real student submissions and reconcile the initial electronic register.
create or replace function public.capture_electronic_exam_grade_attempt()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_exam public.exams%rowtype; v_student public.students%rowtype; v_next integer;
begin
  if new.status <> 'submitted' or new.submitted_at is null or new.score is null or new.student_id in ('0','1','2') then return new; end if;
  select * into v_exam from public.exams where id = new.exam_id;
  if not found or coalesce(v_exam.is_test,false) or v_exam.subject_id is null then return new; end if;
  select * into v_student from public.students where id = new.student_id;
  perform pg_advisory_xact_lock(hashtextextended(new.student_id || ':' || v_exam.subject_id::text || ':' || coalesce(v_exam.round,1)::text || ':electronic',0));
  if exists (select 1 from public.exam_grade_attempts where source_exam_attempt_id = new.id) then return new; end if;
  select coalesce(max(attempt_number),0)+1 into v_next from public.exam_grade_attempts where student_id=new.student_id and subject_id=v_exam.subject_id and exam_type='electronic' and exam_round=coalesce(v_exam.round,1);
  insert into public.exam_grade_attempts(student_id,subject_id,exam_type,exam_round,attempt_number,score,max_score,exam_id,source_exam_attempt_id,branch,program,program_id,system_name,note,recorded_at)
  values(new.student_id,v_exam.subject_id,'electronic',coalesce(v_exam.round,1),v_next,greatest(0,new.score),greatest(0.01,coalesce(new.max_score,v_exam.total_score,100)),new.exam_id,new.id,v_student.branch,v_student.program,v_student.program_id,v_student.system_name,'نتيجة امتحان إلكتروني — '||coalesce(v_exam.title,''),coalesce(new.submitted_at,now()));
  return new;
end; $$;
revoke all on function public.capture_electronic_exam_grade_attempt() from public, anon, authenticated;
update public.exam_grade_attempts g set source_exam_attempt_id=a.id,exam_id=a.exam_id,note='نتيجة امتحان إلكتروني — '||coalesce(e.title,''),recorded_at=coalesce(a.submitted_at,g.recorded_at)
from public.exam_attempts a join public.exams e on e.id=a.exam_id
where g.exam_type='electronic' and g.source_exam_attempt_id is null and a.status='submitted' and not coalesce(e.is_test,false)
and a.student_id not in ('0','1','2') and g.student_id=a.student_id and g.subject_id=e.subject_id and g.exam_round=coalesce(e.round,1) and g.score=a.score;
insert into public.exam_grade_attempts(student_id,subject_id,exam_type,exam_round,attempt_number,score,max_score,exam_id,source_exam_attempt_id,branch,program,program_id,system_name,note,recorded_at)
select a.student_id,e.subject_id,'electronic',coalesce(e.round,1),coalesce((select max(x.attempt_number)+1 from public.exam_grade_attempts x where x.student_id=a.student_id and x.subject_id=e.subject_id and x.exam_type='electronic' and x.exam_round=coalesce(e.round,1)),1),greatest(0,a.score),greatest(0.01,coalesce(a.max_score,e.total_score,100)),a.exam_id,a.id,st.branch,st.program,st.program_id,st.system_name,'نتيجة امتحان إلكتروني — '||coalesce(e.title,''),coalesce(a.submitted_at,now())
from public.exam_attempts a join public.exams e on e.id=a.exam_id join public.students st on st.id=a.student_id
where a.status='submitted' and not coalesce(e.is_test,false) and a.student_id not in ('0','1','2') and e.subject_id is not null
and not exists(select 1 from public.exam_grade_attempts x where x.source_exam_attempt_id=a.id);