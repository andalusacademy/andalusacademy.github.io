-- Fix: allow authenticated administrators to record study-summary activity.
-- Scope is limited to INSERT; existing admin-only SELECT policy remains unchanged.
-- Keep the admin check in RLS rather than granting broad table access.
CREATE POLICY study_summary_activity_admin_insert
ON public.study_summary_activity
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());
