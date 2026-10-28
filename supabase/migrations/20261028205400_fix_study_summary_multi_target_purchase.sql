-- Ensure the purchase and content-access RPCs use the same multi-target matching as the student catalog.
-- This keeps legacy plain-text targets working while supporting JSON arrays saved by the admin UI.

CREATE OR REPLACE FUNCTION public.student_create_paid_study_summary_order(p_session_token uuid, p_summary_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        (nullif(btrim(sm.target_branch), '') is not null or nullif(btrim(sm.target_system), '') is not null or nullif(btrim(sm.target_batch), '') is not null)
        and public.study_summary_target_matches(sm.target_branch, (select st.branch from public.students st where st.id = v_student_id))
        and public.study_summary_target_matches(sm.target_system, (select st.system_name from public.students st where st.id = v_student_id))
        and public.study_summary_target_matches(sm.target_batch, (select st.program from public.students st where st.id = v_student_id))
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

CREATE OR REPLACE FUNCTION public.student_get_study_summary_question(p_session_token uuid, p_summary_id uuid, p_question_number integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        where st.id = v_student_id
          and (nullif(btrim(sm.target_branch), '') is not null or nullif(btrim(sm.target_system), '') is not null or nullif(btrim(sm.target_batch), '') is not null)
          and public.study_summary_target_matches(sm.target_branch, st.branch)
          and public.study_summary_target_matches(sm.target_system, st.system_name)
          and public.study_summary_target_matches(sm.target_batch, st.program)
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
