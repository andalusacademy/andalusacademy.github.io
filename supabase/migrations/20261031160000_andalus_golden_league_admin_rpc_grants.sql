-- Keep administrative Golden League RPCs out of the anonymous/public role.
REVOKE ALL ON FUNCTION public.golden_league_get_settings_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.golden_league_update_settings(text,text,integer,integer,integer[],integer[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.golden_league_admin_report(date) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.golden_league_get_settings_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.golden_league_update_settings(text,text,integer,integer,integer[],integer[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.golden_league_admin_report(date) TO authenticated;
