create or replace function public.sync_student_status_when_procedure_is_dismissal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if new.type = 'فصل' then
    update public.students
       set student_status = 'dismissed',
           dismissed_at = coalesce(dismissed_at, now()),
           dismissed_by = coalesce(v_user, dismissed_by)
     where id = new.student_id
       and coalesce(student_status, 'active') not in ('dismissed','final_dismissed');

    if found then
      insert into public.student_disciplinary_actions
        (student_id, action_type, action_date, decision_number, reason, notes, created_by)
      values
        (new.student_id,
         'dismissal',
         case when new.date ~ '^\d{4}-\d{2}-\d{2}$' then new.date::date else current_date end,
         new.reference_number,
         new.details,
         new.result,
         coalesce(v_user, new.created_by));
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_student_status_when_procedure_is_dismissal on public.procedures;

create trigger trg_sync_student_status_when_procedure_is_dismissal
after insert on public.procedures
for each row
execute function public.sync_student_status_when_procedure_is_dismissal();
