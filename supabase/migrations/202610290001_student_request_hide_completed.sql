-- Student portal: allow hiding resolved/closed requests without deleting admin history.
ALTER TABLE public.student_requests
  ADD COLUMN IF NOT EXISTS student_hidden_at timestamptz;

CREATE OR REPLACE FUNCTION public.student_hide_completed_request(
  p_student_id text,
  p_phone text,
  p_request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  normalized_phone text := public.normalize_eg_phone(p_phone);
  student_row public.students%rowtype;
  request_row public.student_requests%rowtype;
BEGIN
  IF coalesce(btrim(p_student_id), '') = '' OR normalized_phone = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'identity_not_verified');
  END IF;

  SELECT st.* INTO student_row
  FROM public.students st
  WHERE st.id = btrim(p_student_id)
    AND st.deleted_at IS NULL
    AND public.normalize_eg_phone(st.phone) = normalized_phone
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'identity_not_verified');
  END IF;

  SELECT r.* INTO request_row
  FROM public.student_requests r
  WHERE r.id = p_request_id
    AND r.student_id = student_row.id
    AND r.requester_type = 'student'
    AND r.requester_phone = normalized_phone
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'request_not_found');
  END IF;

  IF request_row.status NOT IN ('resolved', 'closed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'request_not_completed');
  END IF;

  UPDATE public.student_requests
  SET student_hidden_at = coalesce(student_hidden_at, now())
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.student_hide_completed_request(text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_hide_completed_request(text, text, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_student_requests(p_student_id text, p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  s public.students%rowtype;
  normalized_phone text := public.normalize_eg_phone(p_phone);
  rows_json jsonb;
BEGIN
  IF coalesce(btrim(p_student_id),'') = '' OR normalized_phone = '' THEN
    RETURN jsonb_build_object('verified',false,'requests','[]'::jsonb);
  END IF;

  SELECT st.* INTO s
  FROM public.students st
  WHERE st.id = btrim(p_student_id)
    AND st.deleted_at IS NULL
    AND (
      public.normalize_eg_phone(st.phone) = normalized_phone
      OR public.normalize_eg_phone(st.guardian_phone) = normalized_phone
      OR public.normalize_eg_phone(st.parent_phone) = normalized_phone
    )
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('verified',false,'requests','[]'::jsonb);
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,
    'request_type',r.request_type,
    'title',r.title,
    'description',r.description,
    'priority',r.priority,
    'status',r.status,
    'admin_response',r.admin_response,
    'created_at',r.created_at,
    'updated_at',r.updated_at,
    'resolved_at',r.resolved_at
  ) ORDER BY r.created_at DESC),'[]'::jsonb)
  INTO rows_json
  FROM public.student_requests r
  WHERE r.student_id = s.id
    AND r.student_hidden_at IS NULL;

  RETURN jsonb_build_object('verified',true,'requests',rows_json);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_student_requests(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_student_requests(text, text) TO anon, authenticated;
