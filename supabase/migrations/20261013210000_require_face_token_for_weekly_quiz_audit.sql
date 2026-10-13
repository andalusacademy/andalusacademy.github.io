-- Require a valid, unexpired face-verification token for every weekly-quiz audit write.
-- Tokens are one-use and bound to the student and weekly_quiz context.
DROP FUNCTION IF EXISTS public.weekly_quiz_log_entry(text, text, text, text, text, boolean);

CREATE OR REPLACE FUNCTION public.weekly_quiz_log_entry(
  p_student_id text,
  p_photo_path text,
  p_face_token uuid,
  p_user_agent text DEFAULT NULL,
  p_browser_name text DEFAULT NULL,
  p_device_label text DEFAULT NULL,
  p_photo_consent boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'storage'
AS $function$
DECLARE
  s record;
  consumed_token uuid;
BEGIN
  IF p_photo_consent IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'photo_consent_required');
  END IF;
  IF coalesce(btrim(p_student_id), '') = ''
     OR coalesce(p_photo_path, '') !~ '^audit/[A-Za-z0-9_-]+/[0-9a-fA-F-]{36}/[^/]+$'
     OR p_face_token IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_data');
  END IF;

  SELECT id, name INTO s
  FROM public.students
  WHERE id = btrim(p_student_id) AND deleted_at IS NULL
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'registration_not_found');
  END IF;

  -- Atomically consume the token: it must belong to this student, be for this
  -- weekly quiz flow, and still be within its 30-minute lifetime.
  DELETE FROM public.competition_face_verified_sessions
  WHERE token = p_face_token
    AND student_id = s.id
    AND competition_type = 'weekly_quiz'
    AND expires_at > now()
  RETURNING token INTO consumed_token;
  IF consumed_token IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'face_verification_required_or_expired');
  END IF;

  INSERT INTO public.weekly_quiz_access_audit
    (student_id, student_name, photo_path, user_agent, browser_name, device_label, photo_consent_at)
  VALUES
    (s.id, s.name, p_photo_path, left(p_user_agent, 1000),
     left(p_browser_name, 100), left(p_device_label, 100), now());

  INSERT INTO public.competition_security_logs
    (competition_type, enrollment_number, student_id, event_type, outcome, reason, user_agent, device_label, metadata)
  VALUES
    ('weekly_quiz', s.id, s.id, 'weekly_quiz_entry', 'success', 'face_token_and_photo_consent_verified',
     left(p_user_agent, 1000), left(p_device_label, 100),
     jsonb_build_object('browser', left(p_browser_name, 100), 'photo_path', p_photo_path,
                        'photo_consent', true, 'face_token_consumed', true));

  RETURN jsonb_build_object('ok', true, 'student_id', s.id, 'student_name', s.name);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'weekly_quiz_log_entry failed: %', SQLERRM;
  RETURN jsonb_build_object('ok', false, 'reason', 'audit_write_failed');
END;
$function$;

REVOKE ALL ON FUNCTION public.weekly_quiz_log_entry(text, text, uuid, text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.weekly_quiz_log_entry(text, text, uuid, text, text, text, boolean) TO anon, authenticated;

-- Restrict uploads to a path containing the same live face token.
CREATE OR REPLACE FUNCTION public.can_upload_weekly_quiz_audit(p_name text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'storage'
AS $function$
  SELECT coalesce(
    p_name ~ '^audit/[A-Za-z0-9_-]+/[0-9a-fA-F-]{36}/[^/]+$'
    AND EXISTS (
      SELECT 1
      FROM public.competition_face_verified_sessions v
      WHERE v.student_id = split_part(p_name, '/', 2)
        AND v.token::text = split_part(p_name, '/', 3)
        AND v.competition_type = 'weekly_quiz'
        AND v.expires_at > now()
    ),
    false
  );
$function$;

REVOKE ALL ON FUNCTION public.can_upload_weekly_quiz_audit(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_upload_weekly_quiz_audit(text) TO anon, authenticated;

DROP POLICY IF EXISTS weekly_quiz_audit_upload_anon ON storage.objects;
DROP POLICY IF EXISTS weekly_quiz_audit_upload_auth ON storage.objects;
CREATE POLICY weekly_quiz_audit_upload_anon
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'weekly-quiz-face-audit' AND public.can_upload_weekly_quiz_audit(name));
CREATE POLICY weekly_quiz_audit_upload_auth
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'weekly-quiz-face-audit' AND public.can_upload_weekly_quiz_audit(name));

NOTIFY pgrst, 'reload schema';
