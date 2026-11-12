-- Andalus AI Tutor: one monthly subscription (30 days / 2 hours daily)
-- Applied to Supabase production project uvwarprsghwvrfmdaaqv

alter table public.student_ai_plans
  add column if not exists payment_provider text,
  add column if not exists payment_wallet_number text;

update public.student_ai_plans
set payment_provider='محفظة اورانج', payment_wallet_number='01286868182', updated_at=now()
where code='student_ai_monthly';

update public.student_ai_plans
set title='المدرس الخصوصي AI', monthly_minutes=120, updated_at=now()
where code='student_ai_monthly';

create or replace function public.student_ai_approve_order(p_order_id uuid, p_reviewer uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare o public.student_ai_orders%rowtype; a public.student_ai_access%rowtype; v_start timestamptz:=now(); v_exp timestamptz;
begin
 if not coalesce(public.is_admin(),false) then return jsonb_build_object('ok',false,'reason','not_admin'); end if;
 select * into o from public.student_ai_orders where id=p_order_id for update;
 if not found then return jsonb_build_object('ok',false,'reason','order_not_found'); end if;
 if o.status not in ('pending_payment','payment_submitted') then return jsonb_build_object('ok',false,'reason','order_not_awaiting_approval'); end if;
 update public.student_ai_access set status='expired' where student_id=o.student_id and status='active' and expires_at<=now();
 update public.student_ai_access set status='revoked',expires_at=least(expires_at,now()) where student_id=o.student_id and status='active';
 v_exp:=v_start+interval '30 days';
 update public.student_ai_orders set status='approved',reviewed_by=coalesce(p_reviewer,auth.uid()),reviewed_at=now(),updated_at=now(),hidden_from_student=true where id=o.id;
 insert into public.student_ai_access(student_id,access_type,starts_at,expires_at,status,order_id) values(o.student_id,'subscription',v_start,v_exp,'active',o.id) returning * into a;
 return jsonb_build_object('ok',true,'access_id',a.id,'starts_at',a.starts_at,'expires_at',a.expires_at,'order_id',o.id);
end; $$;
revoke execute on function public.student_ai_approve_order(uuid,uuid) from public,anon;
grant execute on function public.student_ai_approve_order(uuid,uuid) to authenticated;

create or replace function public.student_ai_admin_subscription_report()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_plan jsonb; v_subs jsonb; v_orders jsonb;
begin
 if not coalesce(public.is_admin(),false) then return jsonb_build_object('ok',false,'reason','not_admin'); end if;
 select coalesce(to_jsonb(p),'{}'::jsonb) into v_plan from public.student_ai_plans p where p.code='student_ai_monthly' limit 1;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.starts_at desc),'[]'::jsonb) into v_subs from (
   select a.id,a.student_id,s.name student_name,s.enrollment_number,a.access_type,a.starts_at,a.expires_at,a.status,a.order_id,a.created_at,o.amount,o.payment_method,o.payment_reference,o.order_code,o.status order_status,o.reviewed_at,o.reviewed_reason
   from public.student_ai_access a join public.students s on s.id=a.student_id left join public.student_ai_orders o on o.id=a.order_id where s.deleted_at is null
 ) x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_orders from (
   select o.id,o.student_id,s.name student_name,s.enrollment_number,o.amount,o.status,o.payment_method,o.payment_reference,o.payment_proof_path,o.order_code,o.created_at,o.updated_at,o.reviewed_at,o.reviewed_reason,o.hidden_from_student
   from public.student_ai_orders o join public.students s on s.id=o.student_id where s.deleted_at is null
 ) x;
 return jsonb_build_object('ok',true,'plan',v_plan,'subscriptions',v_subs,'orders',v_orders);
end; $$;
revoke execute on function public.student_ai_admin_subscription_report() from public,anon;
grant execute on function public.student_ai_admin_subscription_report() to authenticated;
