-- Separate the admin archive action from permanent deletion so payment review history remains auditable.
ALTER TABLE public.study_summary_orders
  ADD COLUMN IF NOT EXISTS admin_deleted_at timestamptz;

CREATE OR REPLACE FUNCTION public.admin_archive_study_summary_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;

  UPDATE public.study_summary_orders
     SET admin_deleted_at = COALESCE(admin_deleted_at, now()),
         updated_at = now()
   WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'order_not_found');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_archive_study_summary_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_archive_study_summary_order(uuid) TO authenticated;
