-- These views are not used by the web client and expose sensitive employee/auth metadata or financial aggregates.
ALTER VIEW public.employees_full_profile SET (security_invoker = true);
ALTER VIEW public.expense_totals SET (security_invoker = true);
REVOKE ALL ON TABLE public.employees_full_profile FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.expense_totals FROM PUBLIC, anon, authenticated;
