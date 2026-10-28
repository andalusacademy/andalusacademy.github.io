-- Multi-select audience targeting for study summaries.
-- Safe to review in source control; do not apply to production until the migration is approved.

create or replace function public.study_summary_target_matches(p_target text, p_student_value text)
returns boolean
language plpgsql
immutable
set search_path = public
as $function$
declare
  v_targets jsonb;
begin
  if nullif(btrim(p_target), '') is null then
    return true;
  end if;

  if left(btrim(p_target), 1) = '[' then
    begin
      v_targets := p_target::jsonb;
      if jsonb_typeof(v_targets) = 'array' then
        return exists (
          select 1
          from jsonb_array_elements_text(v_targets) as target_value(value)
          where lower(btrim(target_value.value)) = lower(btrim(coalesce(p_student_value, '')))
        );
      end if;
    exception when others then
      -- Preserve compatibility with legacy plain-text targets.
      null;
    end;
  end if;

  return lower(btrim(p_target)) = lower(btrim(coalesce(p_student_value, '')));
end;
$function$;

create or replace function public.student_list_study_summaries(p_session_token uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
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
    and sm.is_approved = true
    and (sm.available_from is null or sm.available_from <= now())
    and (sm.available_until is null or sm.available_until > now())
    and (
      coalesce(sm.target_all, true)
      or (
        (nullif(btrim(sm.target_branch), '') is not null or nullif(btrim(sm.target_system), '') is not null or nullif(btrim(sm.target_batch), '') is not null)
        and public.study_summary_target_matches(sm.target_branch, st.branch)
        and public.study_summary_target_matches(sm.target_system, st.system_name)
        and public.study_summary_target_matches(sm.target_batch, st.program)
      )
    );

  insert into public.study_summary_activity(student_id, event_type, metadata)
  values (v_student_id, 'list', '{}'::jsonb);

  return jsonb_build_object('ok', true, 'summaries', v_result);
end;
$function$;
