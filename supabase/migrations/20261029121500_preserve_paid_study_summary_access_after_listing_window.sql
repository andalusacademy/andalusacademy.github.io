-- Expiry of the public listing/sales window must not hide content from students
-- who already have an active entitlement. Apply this exception both to the
-- student library and to question retrieval; existing target and entitlement
-- checks remain in place.
DO $fix$
DECLARE
  v_def text;
  v_old text := 'and (sm.available_until is null or sm.available_until>now())';
  v_new text;
BEGIN
  v_new := 'and ((sm.available_until is null or sm.available_until>now()) or exists (' ||
           'select 1 from public.study_summary_entitlements e ' ||
           'where e.student_id=v_student_id and e.summary_id=sm.id ' ||
           'and e.revoked_at is null and e.starts_at<=now() ' ||
           'and (e.expires_at is null or e.expires_at>now())))';

  v_def := pg_get_functiondef('public.student_list_study_summaries(uuid)'::regprocedure);
  IF position(v_old in v_def) = 0 THEN
    RAISE EXCEPTION 'Could not find availability condition in student_list_study_summaries';
  END IF;
  v_def := replace(v_def, v_old, v_new);
  EXECUTE v_def;

  v_def := pg_get_functiondef('public.student_get_study_summary_question(uuid,uuid,integer)'::regprocedure);
  IF position(v_old in v_def) = 0 THEN
    RAISE EXCEPTION 'Could not find availability condition in student_get_study_summary_question';
  END IF;
  v_def := replace(v_def, v_old, v_new);
  EXECUTE v_def;
END
$fix$;
