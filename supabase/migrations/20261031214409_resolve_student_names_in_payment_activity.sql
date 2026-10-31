-- Resolve the trainee's display name for payment audit rows.
create or replace function public.audit_log_get_user(p_user_id uuid,p_page integer default 1,p_page_size integer default 100)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 v_offset integer:=greatest(coalesce(p_page,1)-1,0)*least(greatest(coalesce(p_page_size,100),1),200);
 v_size integer:=least(greatest(coalesce(p_page_size,100),1),200);
 v_total bigint; v_login bigint; v_change bigint; v_last timestamptz; v_events jsonb;
begin
 if not public.is_admin() then raise exception 'admin_required'; end if;
 if not exists(select 1 from public.user_profiles where id=p_user_id) then raise exception 'user_not_found'; end if;
 select count(*) into v_total from public.employee_activity_log where actor_user_id=p_user_id;
 select count(*) into v_login from public.employee_activity_log where actor_user_id=p_user_id and action_type in ('login','login_session');
 select count(*) into v_change from public.employee_activity_log where actor_user_id=p_user_id and action_type in ('insert','update','delete','create','edit','delete_record');
 select max(created_at) into v_last from public.employee_activity_log where actor_user_id=p_user_id;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_events
 from (
  select e.id,e.created_at,e.action_type,
   case e.action_type when 'login' then 'تسجيل دخول' when 'logout' then 'تسجيل خروج'
   when 'login_session' then 'بدء جلسة' when 'page_view' then 'فتح شاشة'
   when 'click' then 'ضغط / تنفيذ إجراء' when 'insert' then 'إضافة سجل'
   when 'update' then 'تعديل سجل' when 'delete' then 'حذف سجل'
   when 'create' then 'إنشاء' when 'edit' then 'تعديل'
   when 'delete_record' then 'حذف' when 'download' then 'تحميل'
   when 'export' then 'تصدير' else e.action_type end action_label,
   e.module,e.entity_table,e.entity_id,e.title,e.details,
   case when e.entity_table='payments' then
    coalesce(e.old_data,'{}'::jsonb) || jsonb_build_object('student_name',
     (select s.name from public.students s where s.id=coalesce(e.old_data->>'student_id',e.new_data->>'student_id') limit 1))
    else e.old_data end as old_data,
   case when e.entity_table='payments' then
    coalesce(e.new_data,'{}'::jsonb) || jsonb_build_object('student_name',
     (select s.name from public.students s where s.id=coalesce(e.new_data->>'student_id',e.old_data->>'student_id') limit 1))
    else e.new_data end as new_data
  from public.employee_activity_log e where e.actor_user_id=p_user_id
  order by e.created_at desc offset v_offset limit v_size
 ) x;
 v_events := (select coalesce(jsonb_agg(z order by (z->>'created_at')::timestamptz desc),'[]'::jsonb)
  from (
   select jsonb_build_object('id',-1,'created_at',u.created_at,'action_type','account_created',
    'action_label','إنشاء حساب الموظف','module','المستخدمون والصلاحيات','entity_table','user_profiles',
    'entity_id',u.id::text,'title','تم إنشاء حساب الموظف',
    'details',jsonb_build_object('username',u.username,'role',u.role,'branch',u.branch)) z
   from public.user_profiles u where u.id=p_user_id
   union all select value from jsonb_array_elements(v_events)
  ) z);
 return jsonb_build_object('total_count',v_total+1,'login_count',v_login,'change_count',v_change,
  'last_activity',coalesce(v_last,(select created_at from public.user_profiles where id=p_user_id)),'events',v_events);
end; $$;
revoke all on function public.audit_log_get_user(uuid,integer,integer) from public,anon;
grant execute on function public.audit_log_get_user(uuid,integer,integer) to authenticated;