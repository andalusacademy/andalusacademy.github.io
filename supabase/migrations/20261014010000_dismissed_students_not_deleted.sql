-- Keep dismissed students in the system as archived records, not in the recycle bin.
-- Their active-list visibility is controlled by student_status.

CREATE OR REPLACE FUNCTION public.dismiss_student(
  p_student_id text,
  p_reason text DEFAULT NULL,
  p_decision_number text DEFAULT NULL,
  p_action_date date DEFAULT CURRENT_DATE,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
declare
  v_user uuid := auth.uid();
  v_created_by uuid;
  v_student public.students%rowtype;
begin
  if v_user is null or not exists(
    select 1 from public.user_profiles
    where id=v_user and role='admin' and coalesce(is_active,true)
  ) then raise exception 'admin_only'; end if;

  select * into v_student from public.students where id=p_student_id for update;
  if not found then raise exception 'student_not_found'; end if;
  if coalesce(v_student.student_status,'active') in ('dismissed','final_dismissed') then
    raise exception 'student_already_dismissed';
  end if;

  v_created_by := case when exists(select 1 from public.users where id=v_user) then v_user else null end;

  insert into public.student_disciplinary_actions
    (student_id,action_type,action_date,decision_number,reason,notes,created_by)
  values
    (p_student_id,'dismissal',p_action_date,p_decision_number,p_reason,p_notes,v_user);

  update public.students
  set student_status='dismissed',
      dismissed_at=now(),
      dismissed_by=v_user,
      deleted_at=null,
      deleted_by=null
  where id=p_student_id;

  if v_created_by is not null then
    insert into public.procedures(student_id,type,reference_number,date,details,result,created_by,created_at)
    values(p_student_id,'قرار فصل',p_decision_number,to_char(p_action_date,'YYYY-MM-DD'),p_reason,p_notes,v_created_by,now());
  else
    insert into public.procedures(student_id,type,reference_number,date,details,result,created_at)
    values(p_student_id,'قرار فصل',p_decision_number,to_char(p_action_date,'YYYY-MM-DD'),p_reason,p_notes,now());
  end if;

  return jsonb_build_object('success',true,'student_id',p_student_id,'status','dismissed');
end $function$;

-- If dismissal is recorded through the Procedures screen, apply the same rule.
CREATE OR REPLACE FUNCTION public.sync_student_status_when_procedure_is_dismissal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_user uuid := auth.uid();
begin
  if new.type = 'فصل' then
    update public.students
       set student_status = 'dismissed',
           dismissed_at = coalesce(dismissed_at, now()),
           dismissed_by = coalesce(v_user, dismissed_by),
           deleted_at = null,
           deleted_by = null
     where id = new.student_id
       and coalesce(student_status, 'active') not in ('dismissed','final_dismissed');

    if found then
      insert into public.student_disciplinary_actions
        (student_id, action_type, action_date, decision_number, reason, notes, created_by)
      values
        (new.student_id,
         'dismissal',
         case when new.date ~ '^\\d{4}-\\d{2}-\\d{2}$' then new.date::date else current_date end,
         new.reference_number,
         new.details,
         new.result,
         coalesce(v_user, new.created_by));
    end if;
  end if;
  return new;
end;
$$;

DROP TRIGGER IF EXISTS trg_sync_student_status_when_procedure_is_dismissal ON public.procedures;
CREATE TRIGGER trg_sync_student_status_when_procedure_is_dismissal
after insert on public.procedures
for each row execute function public.sync_student_status_when_procedure_is_dismissal();