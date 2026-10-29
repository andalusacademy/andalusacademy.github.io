-- RLS policy system_settings_public_display_read limits anon to public display keys.
GRANT SELECT ON TABLE public.system_settings TO anon;
