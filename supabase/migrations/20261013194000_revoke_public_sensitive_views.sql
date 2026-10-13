-- These views are not used by the web client and expose sensitive employee/auth metadata or financial aggregates.
REVOKE ALL ON TABLE public.employees_full_profile FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.expense_totals FROM PUBLIC, anon, authenticated;
