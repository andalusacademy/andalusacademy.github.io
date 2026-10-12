-- Fix face-enrollment audit check constraint and JSONB descriptor validation.
alter table public.competition_security_logs
  drop constraint if exists competition_security_logs_competition_type_check;
alter table public.competition_security_logs
  add constraint competition_security_logs_competition_type_check
  check (competition_type in ('weekly_quiz','public_competition','student_portal','exam_portal'));

create or replace function public.student_face_enroll(
  p_student_id text, p_phone text, p_descriptor jsonb, p_consent boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare valid_descriptor boolean;
begin
  if not public.student_face_phone_matches(p_student_id,p_phone) then
    insert into public.competition_security_logs(competition_type,enrollment_number,student_id,event_type,outcome,reason,metadata)
    values ('student_portal',btrim(coalesce(p_student_id,'')),btrim(coalesce(p_student_id,'')),'face_enroll','failure','phone_mismatch','{}'::jsonb);
    return jsonb_build_object('ok',false,'reason','phone_mismatch');
  end if;
  if exists (select 1 from public.competition_face_enrollments
    where student_id=btrim(p_student_id) and provider='face-api.js' and active=true and face_descriptor is not null) then
    insert into public.competition_security_logs(competition_type,enrollment_number,student_id,event_type,outcome,reason,metadata)
    values ('student_portal',btrim(p_student_id),btrim(p_student_id),'face_enroll','failure','already_enrolled','{}'::jsonb);
    return jsonb_build_object('ok',false,'reason','already_enrolled');
  end if;
  valid_descriptor := jsonb_typeof(p_descriptor)='array'
    and jsonb_array_length(p_descriptor)=128
    and not exists (select 1 from jsonb_array_elements(p_descriptor) as e(value) where jsonb_typeof(e.value) <> 'number');
  if not valid_descriptor or p_consent is distinct from true then
    insert into public.competition_security_logs(competition_type,enrollment_number,student_id,event_type,outcome,reason,metadata)
    values ('student_portal',btrim(p_student_id),btrim(p_student_id),'face_enroll','failure',
      case when not valid_descriptor then 'invalid_descriptor' else 'consent_required' end,'{}'::jsonb);
    return jsonb_build_object('ok',false,'reason',case when not valid_descriptor then 'invalid_descriptor' else 'consent_required' end);
  end if;
  insert into public.competition_face_enrollments(
    student_id,enrollment_number,provider,provider_subject_id,consent_at,consent_version,
    active,face_descriptor,model_version,updated_at
  ) values (btrim(p_student_id),btrim(p_student_id),'face-api.js','student:'||btrim(p_student_id),
    now(),'face-enrollment-v1',true,p_descriptor,'face-api.js-0.22.2',now())
  on conflict (student_id,provider) do update set
    enrollment_number=excluded.enrollment_number, provider_subject_id=excluded.provider_subject_id,
    consent_at=excluded.consent_at, consent_version=excluded.consent_version,
    active=true, face_descriptor=excluded.face_descriptor, model_version=excluded.model_version, updated_at=now();
  insert into public.competition_security_logs(competition_type,enrollment_number,student_id,event_type,outcome,reason,metadata)
  values ('student_portal',btrim(p_student_id),btrim(p_student_id),'face_enroll','success','enrolled',
    jsonb_build_object('model_version','face-api.js-0.22.2','descriptor_length',128));
  return jsonb_build_object('ok',true);
exception when others then
  raise warning 'Student face enrollment failed: %', SQLERRM;
  return jsonb_build_object('ok',false,'reason','enrollment_error');
end; $$;

create or replace function public.student_face_verify(
  p_student_id text, p_phone text, p_live_descriptor jsonb,
  p_competition_type text default 'student_portal', p_competition_id text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare stored_descriptor jsonb; distance double precision; valid_descriptor boolean;
  issued_token uuid; fail_reason text;
begin
  if p_competition_type not in ('student_portal','exam_portal','weekly_quiz','public_competition') then
    return jsonb_build_object('verified',false,'reason','invalid_context');
  end if;
  if not public.student_face_phone_matches(p_student_id,p_phone) then
    fail_reason := 'phone_mismatch';
  else
    valid_descriptor := jsonb_typeof(p_live_descriptor)='array'
      and jsonb_array_length(p_live_descriptor)=128
      and not exists (select 1 from jsonb_array_elements(p_live_descriptor) as e(value) where jsonb_typeof(e.value) <> 'number');
    if not valid_descriptor then fail_reason := 'invalid_descriptor';
    else
      select face_descriptor into stored_descriptor from public.competition_face_enrollments
      where student_id=btrim(p_student_id) and provider='face-api.js' and active=true limit 1;
      if stored_descriptor is null then fail_reason := 'face_not_enrolled';
      else
        select sqrt(sum(power((a.value::text::double precision)-(b.value::text::double precision),2)))
        into distance from jsonb_array_elements(stored_descriptor) with ordinality a(value,idx)
        join jsonb_array_elements(p_live_descriptor) with ordinality b(value,idx) using (idx);
        if distance is null or distance > 0.52 then fail_reason := 'face_mismatch'; end if;
      end if;
    end if;
  end if;
  if fail_reason is not null then
    insert into public.competition_security_logs(competition_type,competition_id,enrollment_number,student_id,event_type,outcome,reason,metadata)
    values (p_competition_type,p_competition_id,btrim(coalesce(p_student_id,'')),btrim(coalesce(p_student_id,'')),
      'face_verify','failure',fail_reason,jsonb_build_object('model_version','face-api.js-0.22.2'));
    return jsonb_build_object('verified',false,'reason',fail_reason);
  end if;
  if p_competition_type in ('weekly_quiz','public_competition') then
    insert into public.competition_face_verified_sessions(student_id,competition_type,competition_id,expires_at)
    values (btrim(p_student_id),p_competition_type,p_competition_id,now()+interval '30 minutes') returning token into issued_token;
  end if;
  insert into public.competition_security_logs(competition_type,competition_id,enrollment_number,student_id,event_type,outcome,reason,metadata)
  values (p_competition_type,p_competition_id,btrim(p_student_id),btrim(p_student_id),'face_verify','success','face_match',
    jsonb_build_object('distance',round(distance::numeric,4),'threshold',0.52,'model_version','face-api.js-0.22.2'));
  return jsonb_build_object('verified',true,'token',issued_token,'expires_in_seconds',1800);
end; $$;
