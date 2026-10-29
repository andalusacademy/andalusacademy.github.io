-- These legacy RPCs accept a student identifier without a verified portal session.
-- The current student portal uses session-token-based RPCs instead.
REVOKE EXECUTE ON FUNCTION public.get_student_summary_catalog(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_student_summary_content(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.student_face_resolve(text) FROM PUBLIC, anon, authenticated;
