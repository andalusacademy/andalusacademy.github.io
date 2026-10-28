-- Fix status mismatch between study_summary_orders_status_check and admin review RPC.
-- Apply only after reviewing in the intended Supabase project.
CREATE OR REPLACE FUNCTION public.admin_review_study_summary_order(
  p_order_id uuid,
  p_status text,
  p_reason text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  v_order public.study_summary_orders%rowtype;
  v_days integer;
  v_ent_id uuid;
  v_package_id uuid;
  v_summary_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;

  -- Keep the RPC values aligned with the table CHECK constraint.
  IF p_status NOT IN ('paid', 'pending_payment', 'rejected', 'cancelled') THEN
    RAISE EXCEPTION 'حالة غير صالحة';
  END IF;

  SELECT * INTO v_order
  FROM public.study_summary_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'طلب الشراء غير موجود';
  END IF;

  UPDATE public.study_summary_orders
  SET status = p_status,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      reviewed_reason = NULLIF(trim(coalesce(p_reason, '')), ''),
      updated_at = now()
  WHERE id = p_order_id;

  IF p_status = 'paid' THEN
    SELECT pi.package_id INTO v_package_id
    FROM public.study_summary_package_items pi
    WHERE pi.summary_id = v_order.summary_id
    LIMIT 1;

    IF v_package_id IS NOT NULL THEN
      SELECT validity_days INTO v_days
      FROM public.study_summary_packages
      WHERE id = v_package_id AND is_active = true;

      FOR v_summary_id IN
        SELECT summary_id
        FROM public.study_summary_package_items
        WHERE package_id = v_package_id
      LOOP
        SELECT id INTO v_ent_id
        FROM public.study_summary_entitlements
        WHERE student_id = v_order.student_id
          AND summary_id = v_summary_id
        ORDER BY created_at DESC
        LIMIT 1;

        IF v_ent_id IS NULL THEN
          INSERT INTO public.study_summary_entitlements
            (student_id, summary_id, order_id, starts_at, expires_at, created_at)
          VALUES
            (v_order.student_id, v_summary_id, v_order.id, now(),
             now() + make_interval(days => greatest(coalesce(v_days, 2), 1)), now());
        ELSE
          UPDATE public.study_summary_entitlements
          SET order_id = v_order.id,
              starts_at = now(),
              expires_at = now() + make_interval(days => greatest(coalesce(v_days, 2), 1)),
              revoked_at = NULL
          WHERE id = v_ent_id;
        END IF;
      END LOOP;
    ELSE
      SELECT validity_days INTO v_days
      FROM public.study_summaries
      WHERE id = v_order.summary_id;

      SELECT id INTO v_ent_id
      FROM public.study_summary_entitlements
      WHERE student_id = v_order.student_id
        AND summary_id = v_order.summary_id
      ORDER BY created_at DESC
      LIMIT 1;

      IF v_ent_id IS NULL THEN
        INSERT INTO public.study_summary_entitlements
          (student_id, summary_id, order_id, starts_at, expires_at, created_at)
        VALUES
          (v_order.student_id, v_order.summary_id, v_order.id, now(),
           now() + make_interval(days => greatest(coalesce(v_days, 30), 1)), now());
      ELSE
        UPDATE public.study_summary_entitlements
        SET order_id = v_order.id,
            starts_at = now(),
            expires_at = now() + make_interval(days => greatest(coalesce(v_days, 30), 1)),
            revoked_at = NULL
        WHERE id = v_ent_id;
      END IF;
    END IF;
  END IF;
END;
$function$;
