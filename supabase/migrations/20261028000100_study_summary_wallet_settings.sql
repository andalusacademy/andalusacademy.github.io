-- Study summary wallet checkout settings and unique payment codes.
-- Prepared on a feature branch only; do not apply to the live database until reviewed.
begin;

alter table public.study_summaries
  add column if not exists payment_provider text not null default 'محفظة إلكترونية',
  add column if not exists payment_wallet_number text;

alter table public.study_summary_orders
  add column if not exists payment_reference text,
  add column if not exists order_code text;

create unique index if not exists study_summary_orders_order_code_unique
  on public.study_summary_orders (order_code)
  where order_code is not null and btrim(order_code) <> '';

alter table public.study_summaries
  drop constraint if exists study_summaries_payment_provider_check;
alter table public.study_summaries
  add constraint study_summaries_payment_provider_check
  check (length(btrim(payment_provider)) between 2 and 80);

alter table public.study_summaries
  drop constraint if exists study_summaries_payment_wallet_number_check;
alter table public.study_summaries
  add constraint study_summaries_payment_wallet_number_check
  check (payment_wallet_number is null or length(btrim(payment_wallet_number)) between 6 and 40);


-- Student checkout: snapshot the published price and expose wallet instructions only for that order.
create or replace function public.student_create_study_summary_order(p_session_token uuid, p_summary_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_student_id text;
  v_summary public.study_summaries%rowtype;
  v_order public.study_summary_orders%rowtype;
  v_code text;
begin
  select s.student_id into v_student_id
  from public.competition_face_verified_sessions s
  join public.students st on st.id=s.student_id
  where s.token=p_session_token and s.competition_type='student_portal'
    and s.expires_at>now() and st.deleted_at is null
    and coalesce(st.student_status,'active')='active'
  limit 1;
  if v_student_id is null then return jsonb_build_object('ok',false,'reason','session_expired'); end if;

  select * into v_summary from public.study_summaries
  where id=p_summary_id and is_published=true and is_approved=true
    and (available_from is null or available_from<=now())
    and (available_until is null or available_until>now());
  if not found then return jsonb_build_object('ok',false,'reason','summary_unavailable'); end if;
  if nullif(btrim(v_summary.payment_wallet_number),'') is null then
    return jsonb_build_object('ok',false,'reason','payment_not_configured');
  end if;
  if not exists(select 1 from public.study_summary_questions q where q.summary_id=p_summary_id and q.is_selected=true and q.is_approved=true and q.batch_no in (select value::integer from jsonb_array_elements_text(coalesce(v_summary.enabled_batches,'[1,2]'::jsonb)))) then
    return jsonb_build_object('ok',false,'reason','empty_summary');
  end if;
  if exists(select 1 from public.study_summary_entitlements e where e.student_id=v_student_id and e.summary_id=p_summary_id and e.revoked_at is null and e.starts_at<=now() and e.expires_at>now()) then
    return jsonb_build_object('ok',false,'reason','already_has_access');
  end if;

  update public.study_summary_orders set status='expired',updated_at=now()
  where student_id=v_student_id and summary_id=p_summary_id and status='pending_payment' and expires_at<=now();
  select * into v_order from public.study_summary_orders
  where student_id=v_student_id and summary_id=p_summary_id and status='pending_payment' and expires_at>now()
  order by created_at desc limit 1;
  if not found then
    v_code := 'AND-SUM-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
    insert into public.study_summary_orders(student_id,summary_id,amount,status,payment_method,order_code,expires_at)
    values(v_student_id,p_summary_id,v_summary.price,'pending_payment','manual_wallet_transfer',v_code,now()+interval '24 hours')
    returning * into v_order;
    insert into public.study_summary_activity(student_id,summary_id,order_id,event_type,metadata)
    values(v_student_id,p_summary_id,v_order.id,'order_created',jsonb_build_object('amount',v_order.amount,'status',v_order.status,'order_code',v_order.order_code,'payment_method','manual_wallet_transfer'));
  end if;
  return jsonb_build_object('ok',true,'order',jsonb_build_object(
    'id',v_order.id,'order_number',coalesce(v_order.order_code,upper(left(replace(v_order.id::text,'-',''),12))),
    'order_code',coalesce(v_order.order_code,upper(left(replace(v_order.id::text,'-',''),12))),
    'summary_id',v_order.summary_id,'amount',v_order.amount,'status',v_order.status,
    'created_at',v_order.created_at,'expires_at',v_order.expires_at,
    'payment_provider',v_summary.payment_provider,'payment_wallet_number',v_summary.payment_wallet_number
  ));
end;
$function$;

create or replace function public.student_submit_study_summary_payment_reference(
  p_session_token uuid, p_order_id uuid, p_payment_reference text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare v_student_id text; v_order public.study_summary_orders%rowtype; v_ref text;
begin
  v_ref := nullif(btrim(p_payment_reference),'');
  if v_ref is null or length(v_ref)<3 or length(v_ref)>120 then
    return jsonb_build_object('ok',false,'reason','invalid_reference');
  end if;
  select s.student_id into v_student_id
  from public.competition_face_verified_sessions s
  join public.students st on st.id=s.student_id
  where s.token=p_session_token and s.competition_type='student_portal'
    and s.expires_at>now() and st.deleted_at is null
    and coalesce(st.student_status,'active')='active'
  limit 1;
  if v_student_id is null then return jsonb_build_object('ok',false,'reason','session_expired'); end if;
  select * into v_order from public.study_summary_orders
  where id=p_order_id and student_id=v_student_id and status='pending_payment' and (expires_at is null or expires_at>now());
  if not found then return jsonb_build_object('ok',false,'reason','order_unavailable'); end if;
  update public.study_summary_orders set payment_reference=v_ref,updated_at=now() where id=v_order.id;
  insert into public.study_summary_activity(student_id,summary_id,order_id,event_type,metadata)
  values(v_student_id,v_order.summary_id,v_order.id,'payment_reference_submitted',jsonb_build_object('order_code',v_order.order_code));
  return jsonb_build_object('ok',true,'order_code',v_order.order_code);
end;
$function$;

revoke all on function public.student_create_study_summary_order(uuid,uuid) from public;
grant execute on function public.student_create_study_summary_order(uuid,uuid) to anon, authenticated;
revoke all on function public.student_submit_study_summary_payment_reference(uuid,uuid,text) from public;
grant execute on function public.student_submit_study_summary_payment_reference(uuid,uuid,text) to anon, authenticated;

commit;
