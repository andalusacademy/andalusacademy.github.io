-- Paid study-summary products: wallet details, audience filters, and guarded student RPCs.
begin;

alter table public.study_summaries
  add column if not exists payment_provider text,
  add column if not exists payment_wallet_number text,
  add column if not exists enabled_question_types jsonb not null default '["mcq","true_false","essay"]'::jsonb;

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
  check (payment_provider is null or length(btrim(payment_provider)) between 2 and 80);

alter table public.study_summaries
  drop constraint if exists study_summaries_payment_wallet_number_check;
alter table public.study_summaries
  add constraint study_summaries_payment_wallet_number_check
  check (payment_wallet_number is null or length(btrim(payment_wallet_number)) between 6 and 40);

alter table public.study_summaries
  drop constraint if exists study_summaries_enabled_question_types_check;
alter table public.study_summaries
  add constraint study_summaries_enabled_question_types_check
  check (
    jsonb_typeof(enabled_question_types) = 'array'
    and enabled_question_types <@ '["mcq","true_false","essay"]'::jsonb
  );

create or replace function public.student_create_paid_study_summary_order(
  p_session_token uuid,
  p_summary_id uuid
) returns jsonb
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
  join public.students st on st.id = s.student_id
  where s.token = p_session_token
    and s.competition_type = 'student_portal'
    and s.expires_at > now()
    and st.deleted_at is null
    and coalesce(st.student_status, 'active') = 'active'
  limit 1;

  if v_student_id is null then
    return jsonb_build_object('ok', false, 'reason', 'session_expired');
  end if;

  select * into v_summary
  from public.study_summaries sm
  where sm.id = p_summary_id
    and sm.is_published = true
    and sm.is_approved = true
    and (sm.available_from is null or sm.available_from <= now())
    and (sm.available_until is null or sm.available_until > now())
    and (
      coalesce(sm.target_all, true)
      or (
        (nullif(btrim(sm.target_branch), '') is not null and lower(btrim(sm.target_branch)) = lower(btrim(coalesce((select st.branch from public.students st where st.id = v_student_id), ''))))
        or (nullif(btrim(sm.target_system), '') is not null and lower(btrim(sm.target_system)) = lower(btrim(coalesce((select st.system_name from public.students st where st.id = v_student_id), ''))))
        or (nullif(btrim(sm.target_batch), '') is not null and lower(btrim(sm.target_batch)) = lower(btrim(coalesce((select st.program from public.students st where st.id = v_student_id), ''))))
      )
    );

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'summary_unavailable');
  end if;

  if nullif(btrim(v_summary.payment_provider), '') is null
     or nullif(btrim(v_summary.payment_wallet_number), '') is null then
    return jsonb_build_object('ok', false, 'reason', 'payment_not_configured');
  end if;

  if not exists (
    select 1 from public.study_summary_questions q
    where q.summary_id = p_summary_id
      and q.is_selected = true
      and q.is_approved = true
      and q.batch_no in (
        select value::integer
        from jsonb_array_elements_text(coalesce(v_summary.enabled_batches, '[1,2]'::jsonb))
      )
      and q.question_type in (
        select value
        from jsonb_array_elements_text(coalesce(v_summary.enabled_question_types, '["mcq","true_false","essay"]'::jsonb))
      )
  ) then
    return jsonb_build_object('ok', false, 'reason', 'empty_summary');
  end if;

  if exists (
    select 1 from public.study_summary_entitlements e
    where e.student_id = v_student_id
      and e.summary_id = p_summary_id
      and e.revoked_at is null
      and e.starts_at <= now()
      and e.expires_at > now()
  ) then
    return jsonb_build_object('ok', false, 'reason', 'already_has_access');
  end if;

  update public.study_summary_orders
  set status = 'expired', updated_at = now()
  where student_id = v_student_id
    and summary_id = p_summary_id
    and status = 'pending_payment'
    and expires_at is not null
    and expires_at <= now();

  select * into v_order
  from public.study_summary_orders
  where student_id = v_student_id
    and summary_id = p_summary_id
    and status = 'pending_payment'
    and (expires_at is null or expires_at > now())
  order by created_at desc
  limit 1;

  if not found then
    v_code := 'AND-SUM-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    insert into public.study_summary_orders (
      student_id, summary_id, amount, status, payment_method,
      payment_number, order_code, expires_at, access_hours
    ) values (
      v_student_id, p_summary_id, v_summary.price, 'pending_payment',
      v_summary.payment_provider, v_summary.payment_wallet_number,
      v_code, now() + interval '24 hours', null
    )
    returning * into v_order;

    insert into public.study_summary_activity (
      student_id, summary_id, order_id, event_type, metadata
    ) values (
      v_student_id, p_summary_id, v_order.id, 'order_created',
      jsonb_build_object('amount', v_order.amount, 'status', v_order.status, 'order_code', v_order.order_code)
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'order', jsonb_build_object(
      'id', v_order.id,
      'order_number', coalesce(v_order.order_code, upper(left(replace(v_order.id::text, '-', ''), 12))),
      'order_code', v_order.order_code,
      'summary_id', v_order.summary_id,
      'amount', v_order.amount,
      'status', v_order.status,
      'created_at', v_order.created_at,
      'expires_at', v_order.expires_at,
      'payment_provider', v_summary.payment_provider,
      'payment_wallet_number', v_summary.payment_wallet_number
    )
  );
end;
$function$;

create or replace function public.student_submit_study_summary_payment_reference(
  p_session_token uuid,
  p_order_id uuid,
  p_payment_reference text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_student_id text;
  v_order public.study_summary_orders%rowtype;
  v_reference text := btrim(coalesce(p_payment_reference, ''));
begin
  select s.student_id into v_student_id
  from public.competition_face_verified_sessions s
  join public.students st on st.id = s.student_id
  where s.token = p_session_token
    and s.competition_type = 'student_portal'
    and s.expires_at > now()
    and st.deleted_at is null
    and coalesce(st.student_status, 'active') = 'active'
  limit 1;

  if v_student_id is null then
    return jsonb_build_object('ok', false, 'reason', 'session_expired');
  end if;

  if length(v_reference) < 3 or length(v_reference) > 120 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_reference');
  end if;

  select * into v_order
  from public.study_summary_orders
  where id = p_order_id and student_id = v_student_id
  for update;

  if not found or v_order.status <> 'pending_payment'
     or (v_order.expires_at is not null and v_order.expires_at <= now()) then
    return jsonb_build_object('ok', false, 'reason', 'order_unavailable');
  end if;

  update public.study_summary_orders
  set payment_reference = v_reference, updated_at = now()
  where id = p_order_id;

  insert into public.study_summary_activity (
    student_id, summary_id, order_id, event_type, metadata
  ) values (
    v_student_id, v_order.summary_id, p_order_id, 'payment_reference_submitted',
    jsonb_build_object('order_code', v_order.order_code, 'payment_reference', v_reference)
  );

  return jsonb_build_object('ok', true, 'status', 'pending_payment');
end;
$function$;

create or replace function public.student_list_study_summaries(p_session_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_student_id text;
  v_result jsonb;
begin
  select s.student_id into v_student_id
  from public.competition_face_verified_sessions s
  join public.students st on st.id = s.student_id
  where s.token = p_session_token
    and s.competition_type = 'student_portal'
    and s.expires_at > now()
    and st.deleted_at is null
    and coalesce(st.student_status, 'active') = 'active'
  limit 1;

  if v_student_id is null then
    return jsonb_build_object('ok', false, 'reason', 'session_expired');
  end if;

  update public.study_summary_orders
  set status = 'expired', updated_at = now()
  where student_id = v_student_id
    and status = 'pending_payment'
    and expires_at is not null
    and expires_at <= now();

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', sm.id,
    'title', sm.title,
    'description', sm.description,
    'subject_name', sm.subject_name,
    'price', sm.price,
    'validity_days', sm.validity_days,
    'question_count', (
      select count(*) from public.study_summary_questions q
      where q.summary_id = sm.id and q.is_selected = true and q.is_approved = true
        and q.batch_no in (select value::integer from jsonb_array_elements_text(coalesce(sm.enabled_batches, '[1,2]'::jsonb)))
        and q.question_type in (select value from jsonb_array_elements_text(coalesce(sm.enabled_question_types, '["mcq","true_false","essay"]'::jsonb)))
    ),
    'has_access', exists (
      select 1 from public.study_summary_entitlements e
      where e.student_id = v_student_id and e.summary_id = sm.id
        and e.revoked_at is null and e.starts_at <= now() and e.expires_at > now()
    ),
    'expires_at', (
      select max(e.expires_at) from public.study_summary_entitlements e
      where e.student_id = v_student_id and e.summary_id = sm.id
        and e.revoked_at is null and e.starts_at <= now() and e.expires_at > now()
    ),
    'pending_order', exists (
      select 1 from public.study_summary_orders o
      where o.student_id = v_student_id and o.summary_id = sm.id
        and o.status = 'pending_payment' and (o.expires_at is null or o.expires_at > now())
    )
  ) order by sm.created_at desc), '[]'::jsonb)
  into v_result
  from public.study_summaries sm
  join public.students st on st.id = v_student_id
  where sm.is_published = true
    and (sm.available_from is null or sm.available_from <= now())
    and (sm.available_until is null or sm.available_until > now())
    and (
      coalesce(sm.target_all, true)
      or (
        (nullif(btrim(sm.target_branch), '') is not null and lower(btrim(sm.target_branch)) = lower(btrim(coalesce(st.branch, ''))))
        or (nullif(btrim(sm.target_system), '') is not null and lower(btrim(sm.target_system)) = lower(btrim(coalesce(st.system_name, ''))))
        or (nullif(btrim(sm.target_batch), '') is not null and lower(btrim(sm.target_batch)) = lower(btrim(coalesce(st.program, ''))))
      )
    );

  insert into public.study_summary_activity(student_id, event_type, metadata)
  values (v_student_id, 'list', '{}'::jsonb);

  return jsonb_build_object('ok', true, 'summaries', v_result);
end;
$function$;

create or replace function public.student_list_study_summary_orders(p_session_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_student_id text;
  v_result jsonb;
begin
  select s.student_id into v_student_id
  from public.competition_face_verified_sessions s
  join public.students st on st.id = s.student_id
  where s.token = p_session_token
    and s.competition_type = 'student_portal'
    and s.expires_at > now()
    and st.deleted_at is null
    and coalesce(st.student_status, 'active') = 'active'
  limit 1;

  if v_student_id is null then
    return jsonb_build_object('ok', false, 'reason', 'session_expired');
  end if;

  update public.study_summary_orders
  set status = 'expired', updated_at = now()
  where student_id = v_student_id
    and status = 'pending_payment'
    and expires_at is not null
    and expires_at <= now();

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id,
    'order_number', coalesce(o.order_code, upper(left(replace(o.id::text, '-', ''), 12))),
    'order_code', o.order_code,
    'summary_title', sm.title,
    'amount', o.amount,
    'status', o.status,
    'created_at', o.created_at,
    'expires_at', o.expires_at,
    'access_hours', o.access_hours,
    'payment_reference', o.payment_reference,
    'payment_provider', sm.payment_provider,
    'payment_wallet_number', sm.payment_wallet_number
  ) order by o.created_at desc), '[]'::jsonb)
  into v_result
  from public.study_summary_orders o
  join public.study_summaries sm on sm.id = o.summary_id
  where o.student_id = v_student_id
    and o.created_at > now() - interval '30 days';

  return jsonb_build_object('ok', true, 'orders', v_result);
end;
$function$;

create or replace function public.student_get_study_summary_question(
  p_session_token uuid,
  p_summary_id uuid,
  p_question_number integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_student_id text;
  v_summary public.study_summaries%rowtype;
  v_question jsonb;
  v_total integer;
begin
  select s.student_id into v_student_id
  from public.competition_face_verified_sessions s
  join public.students st on st.id = s.student_id
  where s.token = p_session_token
    and s.competition_type = 'student_portal'
    and s.expires_at > now()
    and st.deleted_at is null
    and coalesce(st.student_status, 'active') = 'active'
  limit 1;

  if v_student_id is null then
    return jsonb_build_object('ok', false, 'reason', 'session_expired');
  end if;

  select * into v_summary
  from public.study_summaries sm
  where sm.id = p_summary_id
    and sm.is_published = true
    and sm.is_approved = true
    and (sm.available_from is null or sm.available_from <= now())
    and (sm.available_until is null or sm.available_until > now())
    and (
      coalesce(sm.target_all, true)
      or exists (
        select 1 from public.students st
        where st.id = v_student_id and (
          (nullif(btrim(sm.target_branch), '') is not null and lower(btrim(sm.target_branch)) = lower(btrim(coalesce(st.branch, ''))))
          or (nullif(btrim(sm.target_system), '') is not null and lower(btrim(sm.target_system)) = lower(btrim(coalesce(st.system_name, ''))))
          or (nullif(btrim(sm.target_batch), '') is not null and lower(btrim(sm.target_batch)) = lower(btrim(coalesce(st.program, ''))))
        )
      )
    );

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'summary_unavailable');
  end if;

  if not exists (
    select 1 from public.study_summary_entitlements e
    where e.student_id = v_student_id and e.summary_id = p_summary_id
      and e.revoked_at is null and e.starts_at <= now() and e.expires_at > now()
  ) then
    insert into public.study_summary_activity(student_id, summary_id, event_type, metadata)
    values (v_student_id, p_summary_id, 'access_denied', jsonb_build_object('reason', 'no_active_entitlement'));
    return jsonb_build_object('ok', false, 'reason', 'not_purchased');
  end if;

  select count(*) into v_total
  from public.study_summary_questions q
  where q.summary_id = p_summary_id
    and q.is_selected = true and q.is_approved = true
    and q.batch_no in (select value::integer from jsonb_array_elements_text(coalesce(v_summary.enabled_batches, '[1,2]'::jsonb)))
    and q.question_type in (select value from jsonb_array_elements_text(coalesce(v_summary.enabled_question_types, '["mcq","true_false","essay"]'::jsonb)));

  if v_total = 0 then return jsonb_build_object('ok', false, 'reason', 'empty_summary'); end if;
  if p_question_number < 1 or p_question_number > v_total then
    return jsonb_build_object('ok', false, 'reason', 'question_out_of_range', 'total', v_total);
  end if;

  select jsonb_build_object(
    'id', q.id,
    'question_text', q.question_text,
    'answer_text', q.answer_text,
    'explanation', q.explanation,
    'question_type', q.question_type,
    'options', q.options,
    'order_num', q.order_num
  ) into v_question
  from public.study_summary_questions q
  where q.summary_id = p_summary_id
    and q.is_selected = true and q.is_approved = true
    and q.batch_no in (select value::integer from jsonb_array_elements_text(coalesce(v_summary.enabled_batches, '[1,2]'::jsonb)))
    and q.question_type in (select value from jsonb_array_elements_text(coalesce(v_summary.enabled_question_types, '["mcq","true_false","essay"]'::jsonb)))
  order by q.batch_no, q.order_num, q.id
  offset (p_question_number - 1) limit 1;

  insert into public.study_summary_activity(student_id, summary_id, event_type, metadata)
  values (v_student_id, p_summary_id, 'question', jsonb_build_object('question_number', p_question_number));

  return jsonb_build_object(
    'ok', true,
    'summary', jsonb_build_object('id', v_summary.id, 'title', v_summary.title, 'subject_name', v_summary.subject_name),
    'question', v_question,
    'question_number', p_question_number,
    'total', v_total
  );
end;
$function$;

revoke all on function public.student_create_paid_study_summary_order(uuid, uuid) from public;
revoke all on function public.student_submit_study_summary_payment_reference(uuid, uuid, text) from public;
revoke all on function public.student_list_study_summaries(uuid) from public;
revoke all on function public.student_list_study_summary_orders(uuid) from public;
revoke all on function public.student_get_study_summary_question(uuid, uuid, integer) from public;
grant execute on function public.student_create_paid_study_summary_order(uuid, uuid) to anon, authenticated;
grant execute on function public.student_submit_study_summary_payment_reference(uuid, uuid, text) to anon, authenticated;
grant execute on function public.student_list_study_summaries(uuid) to anon, authenticated;
grant execute on function public.student_list_study_summary_orders(uuid) to anon, authenticated;
grant execute on function public.student_get_study_summary_question(uuid, uuid, integer) to anon, authenticated;

commit;
