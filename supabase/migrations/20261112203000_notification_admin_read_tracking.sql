-- Admin-only notification readership analytics and consistent urgent receipt validation.
CREATE OR REPLACE FUNCTION public.get_notification_admin_stats(p_notification_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok',false,'reason','admin_only');
  END IF;
  WITH target AS (
    SELECT n.id AS notification_id, s.id AS student_id, s.name,
           CASE WHEN n.audience='parent' THEN 'parent' ELSE 'student' END AS portal_type
    FROM public.notifications n
    JOIN public.students s
      ON s.deleted_at IS NULL AND coalesce(s.student_status,'active')='active'
     AND (
       n.audience='all'
       OR (n.audience='student' AND (n.student_id IS NULL OR n.student_id=s.id))
       OR (n.audience='parent' AND (n.student_id IS NULL OR n.student_id=s.id))
       OR (n.audience='branch' AND n.branch=s.branch)
       OR (n.audience='program' AND n.program=s.program)
     )
    WHERE (p_notification_id IS NULL OR n.id=p_notification_id)
      AND n.audience <> 'staff'
  ),
  counts AS (
    SELECT t.notification_id,
      count(*)::int AS target_count,
      count(*) FILTER (WHERE r.notification_id IS NOT NULL)::int AS read_count,
      coalesce(jsonb_agg(jsonb_build_object('id',t.student_id,'name',t.name))
        FILTER (WHERE r.notification_id IS NULL), '[]'::jsonb) AS unread_students,
      coalesce(jsonb_agg(jsonb_build_object('id',t.student_id,'name',t.name))
        FILTER (WHERE r.notification_id IS NOT NULL), '[]'::jsonb) AS read_students
    FROM target t
    LEFT JOIN public.notification_receipts r
      ON r.notification_id=t.notification_id
     AND r.student_id=t.student_id
     AND r.portal_type=t.portal_type
    GROUP BY t.notification_id
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',n.id,
    'target_count',coalesce(c.target_count,0),
    'read_count',coalesce(c.read_count,0),
    'unread_count',greatest(coalesce(c.target_count,0)-coalesce(c.read_count,0),0),
    'unread_students',CASE WHEN p_notification_id IS NULL THEN '[]'::jsonb ELSE coalesce(c.unread_students,'[]'::jsonb) END,
    'read_students',CASE WHEN p_notification_id IS NULL THEN '[]'::jsonb ELSE coalesce(c.read_students,'[]'::jsonb) END
  ) ORDER BY n.created_at DESC), '[]'::jsonb)
  INTO result
  FROM public.notifications n
  LEFT JOIN counts c ON c.notification_id=n.id
  WHERE (p_notification_id IS NULL OR n.id=p_notification_id);
  RETURN jsonb_build_object('ok',true,'items',coalesce(result,'[]'::jsonb));
END;
$function$;

REVOKE ALL ON FUNCTION public.get_notification_admin_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_notification_admin_stats(uuid) TO authenticated;

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
