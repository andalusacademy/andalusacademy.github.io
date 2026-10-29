-- Admin RPC bodies also enforce the is_admin() check; this additionally removes
-- anonymous API exposure while preserving signed-in admin access.
REVOKE EXECUTE ON FUNCTION public.admin_archive_study_summary_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_archive_study_summary_order(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_identity_verification_report(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_identity_verification_report(integer, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_identity_verification_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_identity_verification_summary() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_reset_identity_registration(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_identity_registration(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_review_study_summary_order(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_study_summary_order(uuid, text, text) TO authenticated;
