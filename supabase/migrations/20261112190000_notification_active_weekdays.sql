-- Restrict scheduled portal notifications to selected recurring weekdays (Egypt local time).
-- An empty or missing metadata.active_days array keeps the existing all-days behavior.

CREATE OR REPLACE FUNCTION public.get_portal_notifications(p_student_id text, p_phone text, p_portal_type text DEFAULT 'student'::text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE st public.students%rowtype; items jsonb;
BEGIN
  IF p_portal_type NOT IN ('student','parent') OR NOT public.student_face_phone_matches(p_student_id,p_phone) THEN
    RETURN jsonb_build_object('verified',false,'notifications','[]'::jsonb);
  END IF;
  SELECT * INTO st FROM public.students
  WHERE id=btrim(p_student_id) AND deleted_at IS NULL AND coalesce(student_status,'active')='active' LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('verified',false,'notifications','[]'::jsonb); END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',n.id,'title',n.title,'body',n.body,'notification_type',n.notification_type,
    'priority',n.priority,'created_at',n.created_at,'published_at',n.published_at,
    'metadata',n.metadata,
    'show_on_login',(n.show_on_login IS TRUE OR n.priority='urgent'),
    'is_read',EXISTS(SELECT 1 FROM public.notification_receipts r
      WHERE r.notification_id=n.id AND r.student_id=st.id AND r.portal_type=p_portal_type)
  ) ORDER BY CASE n.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
    coalesce(n.published_at,n.created_at) DESC),'[]'::jsonb) INTO items
  FROM public.notifications n
  WHERE n.is_published IS TRUE
    AND (n.scheduled_for IS NULL OR n.scheduled_for<=now())
    AND (n.expires_at IS NULL OR n.expires_at>now() OR n.priority='urgent')
    AND CASE
      WHEN jsonb_typeof(n.metadata->'active_days')='array'
        AND jsonb_array_length(n.metadata->'active_days')>0
      THEN n.metadata->'active_days' @> jsonb_build_array(extract(dow from (now() at time zone 'Africa/Cairo'))::int)
      ELSE true
    END
    AND (
      n.audience='all'
      OR (n.audience='student' AND p_portal_type='student' AND (n.student_id IS NULL OR n.student_id=st.id))
      OR (n.audience='parent' AND p_portal_type='parent' AND (n.student_id IS NULL OR n.student_id=st.id))
      OR (n.audience='branch' AND n.branch=st.branch)
      OR (n.audience='program' AND n.program=st.program)
    );
  RETURN jsonb_build_object('verified',true,'notifications',items);
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_portal_notification_read(p_student_id text, p_phone text, p_portal_type text, p_notification_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE st public.students%rowtype;
BEGIN
  IF p_portal_type NOT IN ('student','parent')
     OR NOT public.student_face_phone_matches(p_student_id,p_phone) THEN
    RETURN jsonb_build_object('ok',false,'reason','identity_not_verified');
  END IF;
  SELECT * INTO st FROM public.students
  WHERE id=btrim(p_student_id) AND deleted_at IS NULL
    AND coalesce(student_status,'active')='active'
  LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','student_unavailable'); END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.id=p_notification_id
      AND (n.show_on_login IS TRUE OR n.priority='urgent')
      AND n.is_published IS TRUE
      AND (n.scheduled_for IS NULL OR n.scheduled_for<=now())
      AND (n.expires_at IS NULL OR n.expires_at>now())
      AND CASE
        WHEN jsonb_typeof(n.metadata->'active_days')='array'
          AND jsonb_array_length(n.metadata->'active_days')>0
        THEN n.metadata->'active_days' @> jsonb_build_array(extract(dow from (now() at time zone 'Africa/Cairo'))::int)
        ELSE true
      END
      AND (
        n.audience='all'
        OR (n.audience='student' AND p_portal_type='student' AND (n.student_id IS NULL OR n.student_id=st.id))
        OR (n.audience='parent' AND p_portal_type='parent' AND (n.student_id IS NULL OR n.student_id=st.id))
        OR (n.audience='branch' AND n.branch=st.branch)
        OR (n.audience='program' AND n.program=st.program)
      )
  ) THEN
    RETURN jsonb_build_object('ok',false,'reason','notification_unavailable');
  END IF;
  INSERT INTO public.notification_receipts(notification_id,student_id,portal_type,read_at)
  VALUES (p_notification_id,st.id,p_portal_type,now())
  ON CONFLICT (notification_id,student_id,portal_type) DO UPDATE SET read_at=excluded.read_at;
  RETURN jsonb_build_object('ok',true);
END;
$function$;
