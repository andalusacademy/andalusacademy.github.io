-- Complaints/requests workflow for the student and parent portals.
CREATE TABLE IF NOT EXISTS public.student_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL,
  requester_type text NOT NULL CHECK (requester_type IN ('student','parent')),
  requester_name text,
  requester_phone text NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('complaint','request','academic','financial','technical','other')),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 150),
  description text NOT NULL CHECK (length(btrim(description)) BETWEEN 5 AND 3000),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','high','urgent')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','waiting_student','resolved','closed')),
  branch text,
  program text,
  admin_response text,
  assigned_to uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS student_requests_student_created_idx ON public.student_requests(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS student_requests_status_created_idx ON public.student_requests(status, created_at DESC);
ALTER TABLE public.student_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY student_requests_admin_all ON public.student_requests FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
REVOKE ALL ON TABLE public.student_requests FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.student_requests TO authenticated;

CREATE OR REPLACE FUNCTION public.normalize_eg_phone(p_phone text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  WITH d AS (SELECT regexp_replace(coalesce(p_phone,''), '[^0-9]', '', 'g') AS v)
  SELECT CASE
    WHEN v LIKE '0020%' THEN '0' || substr(v, 5)
    WHEN v LIKE '20%' AND length(v) = 12 THEN '0' || substr(v, 3)
    WHEN v LIKE '1%' AND length(v) = 10 THEN '0' || v
    ELSE v
  END
  FROM d;
$function$

CREATE OR REPLACE FUNCTION public.submit_student_request(p_student_id text, p_phone text, p_requester_type text, p_request_type text, p_title text, p_description text, p_priority text DEFAULT 'normal'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s public.students%rowtype;
  normalized_phone text := public.normalize_eg_phone(p_phone);
  new_id uuid;
  daily_count integer;
  requester_name_value text;
BEGIN
  p_requester_type := lower(btrim(coalesce(p_requester_type,'')));
  p_request_type := lower(btrim(coalesce(p_request_type,'')));
  p_priority := lower(btrim(coalesce(p_priority,'normal')));

  IF coalesce(btrim(p_student_id),'') = '' OR normalized_phone = '' THEN
    RETURN jsonb_build_object('success',false,'error','identity_required');
  END IF;
  IF p_requester_type NOT IN ('student','parent') THEN
    RETURN jsonb_build_object('success',false,'error','invalid_requester_type');
  END IF;
  IF p_request_type NOT IN ('complaint','request','academic','financial','technical','other') THEN
    RETURN jsonb_build_object('success',false,'error','invalid_request_type');
  END IF;
  IF p_priority NOT IN ('normal','high','urgent') THEN
    RETURN jsonb_build_object('success',false,'error','invalid_priority');
  END IF;
  IF length(btrim(coalesce(p_title,''))) NOT BETWEEN 3 AND 150
     OR length(btrim(coalesce(p_description,''))) NOT BETWEEN 5 AND 3000 THEN
    RETURN jsonb_build_object('success',false,'error','invalid_content');
  END IF;

  SELECT st.* INTO s
  FROM public.students st
  WHERE st.id = btrim(p_student_id)
    AND st.deleted_at IS NULL
    AND (
      (p_requester_type = 'student' AND public.normalize_eg_phone(st.phone) = normalized_phone)
      OR
      (p_requester_type = 'parent' AND (
        public.normalize_eg_phone(st.guardian_phone) = normalized_phone
        OR public.normalize_eg_phone(st.parent_phone) = normalized_phone
        OR public.normalize_eg_phone(st.phone) = normalized_phone
      ))
    )
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success',false,'error','identity_not_verified');
  END IF;

  SELECT count(*) INTO daily_count
  FROM public.student_requests r
  WHERE r.student_id = s.id
    AND r.requester_phone = normalized_phone
    AND r.created_at >= now() - interval '24 hours';
  IF daily_count >= 5 THEN
    RETURN jsonb_build_object('success',false,'error','daily_limit');
  END IF;

  requester_name_value := CASE
    WHEN p_requester_type = 'student' THEN s.name
    ELSE coalesce(s.guardian_name, s.parent_name, 'ولي الأمر')
  END;

  INSERT INTO public.student_requests(
    student_id, requester_type, requester_name, requester_phone,
    request_type, title, description, priority, branch, program
  ) VALUES (
    s.id, p_requester_type, requester_name_value, normalized_phone,
    p_request_type, btrim(p_title), btrim(p_description), p_priority,
    s.branch, s.program
  ) RETURNING id INTO new_id;

  RETURN jsonb_build_object('success',true,'id',new_id,'status','new');
END;
$function$

CREATE OR REPLACE FUNCTION public.get_student_requests(p_student_id text, p_phone text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
  WHERE r.student_id = s.id;

  RETURN jsonb_build_object('verified',true,'requests',rows_json);
END;
$function$

REVOKE EXECUTE ON FUNCTION public.normalize_eg_phone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_eg_phone(text) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_student_request(text,text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_student_request(text,text,text,text,text,text,text) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_student_requests(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_student_requests(text,text) TO anon, authenticated;
