CREATE OR REPLACE FUNCTION public.can_upload_study_summary_payment_proof(p_session_token text,p_order_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $function$
 SELECT EXISTS (
   SELECT 1
   FROM public.competition_face_verified_sessions s
   JOIN public.study_summary_orders o ON o.id::text=p_order_id AND o.student_id=s.student_id
   JOIN public.students st ON st.id=s.student_id
   WHERE s.token::text=p_session_token
     AND s.competition_type='student_portal'
     AND s.expires_at>now()
     AND st.deleted_at IS NULL
     AND coalesce(st.student_status,'active')='active'
     AND o.status='pending_payment'
     AND (o.expires_at IS NULL OR o.expires_at>now())
 );
$function$;
REVOKE ALL ON FUNCTION public.can_upload_study_summary_payment_proof(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_upload_study_summary_payment_proof(text,text) TO anon,authenticated;
DROP POLICY IF EXISTS "study summary proof student upload" ON storage.objects;
CREATE POLICY "study summary proof student upload"
ON storage.objects FOR INSERT TO anon,authenticated
WITH CHECK (
 bucket_id='study-summary-pdfs'
 AND split_part(name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 AND split_part(name,'/',2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 AND public.can_upload_study_summary_payment_proof(split_part(name,'/',1),split_part(name,'/',2))
);