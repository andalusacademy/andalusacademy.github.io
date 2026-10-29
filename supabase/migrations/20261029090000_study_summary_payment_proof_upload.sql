CREATE POLICY "study summary proof student upload"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (
  bucket_id = 'study-summary-pdfs'
  AND split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1
    FROM public.competition_face_verified_sessions s
    JOIN public.study_summary_orders o
      ON o.id::text = split_part(name, '/', 2)
     AND o.student_id = s.student_id
    JOIN public.students st ON st.id = s.student_id
    WHERE s.token::text = split_part(name, '/', 1)
      AND s.competition_type = 'student_portal'
      AND s.expires_at > now()
      AND st.deleted_at IS NULL
      AND coalesce(st.student_status, 'active') = 'active'
      AND o.status = 'pending_payment'
      AND (o.expires_at IS NULL OR o.expires_at > now())
  )
);

CREATE POLICY "study summary proof admin read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'study-summary-pdfs' AND public.is_admin());

CREATE OR REPLACE FUNCTION public.student_record_study_summary_payment_proof(
  p_session_token uuid,
  p_order_id uuid,
  p_proof_path text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_student_id text;
  v_order public.study_summary_orders%rowtype;
  v_expected_prefix text;
BEGIN
  SELECT s.student_id INTO v_student_id
  FROM public.competition_face_verified_sessions s
  JOIN public.students st ON st.id=s.student_id
  WHERE s.token=p_session_token
    AND s.competition_type='student_portal'
    AND s.expires_at>now()
    AND st.deleted_at IS NULL
    AND coalesce(st.student_status,'active')='active'
  LIMIT 1;
  IF v_student_id IS NULL THEN
    RETURN jsonb_build_object('ok',false,'reason','session_expired');
  END IF;

  SELECT * INTO v_order
  FROM public.study_summary_orders
  WHERE id=p_order_id AND student_id=v_student_id
  FOR UPDATE;
  IF NOT FOUND OR v_order.status <> 'pending_payment'
     OR (v_order.expires_at IS NOT NULL AND v_order.expires_at <= now()) THEN
    RETURN jsonb_build_object('ok',false,'reason','order_unavailable');
  END IF;

  v_expected_prefix := p_session_token::text || '/' || p_order_id::text || '/';
  IF p_proof_path IS NULL OR left(p_proof_path,length(v_expected_prefix)) <> v_expected_prefix
     OR length(p_proof_path) > 500 THEN
    RETURN jsonb_build_object('ok',false,'reason','invalid_proof_path');
  END IF;

  UPDATE public.study_summary_orders
     SET payment_proof_path=p_proof_path, updated_at=now()
   WHERE id=p_order_id;

  INSERT INTO public.study_summary_activity(student_id,summary_id,order_id,event_type,metadata)
  VALUES(v_student_id,v_order.summary_id,p_order_id,'payment_proof_submitted',
         jsonb_build_object('proof_path',p_proof_path,'order_code',v_order.order_code));

  RETURN jsonb_build_object('ok',true,'status','pending_payment');
END;
$function$;

REVOKE ALL ON FUNCTION public.student_record_study_summary_payment_proof(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_record_study_summary_payment_proof(uuid,uuid,text) TO anon, authenticated;