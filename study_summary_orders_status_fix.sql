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

-- The INSERT trigger previously forced status='pending' (not allowed by the
-- CHECK constraint) and required a transfer reference before the student could
-- even create an order. The reference belongs to the later submission step.
CREATE OR REPLACE FUNCTION public.validate_study_summary_order()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_price numeric;
  v_package_id uuid;
BEGIN
  SELECT pi.package_id INTO v_package_id
  FROM public.study_summary_package_items pi
  WHERE pi.summary_id = NEW.summary_id
  LIMIT 1;

  IF v_package_id IS NOT NULL THEN
    SELECT p.price INTO v_price
    FROM public.study_summary_packages p
    WHERE p.id = v_package_id AND p.is_active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'الباقة غير متاحة للشراء';
    END IF;
  ELSE
    SELECT s.price INTO v_price
    FROM public.study_summaries s
    WHERE s.id = NEW.summary_id
      AND s.is_published = true
      AND s.is_approved = true
      AND (s.available_from IS NULL OR s.available_from <= now())
      AND (s.available_until IS NULL OR s.available_until > now());

    IF NOT FOUND THEN
      RAISE EXCEPTION 'الملخص غير متاح للشراء';
    END IF;
  END IF;

  -- Price is calculated server-side; never trust a client-supplied amount.
  NEW.amount := v_price;
  NEW.status := 'pending_payment';
  NEW.payment_method := coalesce(nullif(trim(NEW.payment_method), ''), 'manual_transfer');

  -- A transaction reference is intentionally optional at order creation.
  -- It is recorded later by student_submit_study_summary_payment_reference.
  NEW.payment_reference := nullif(trim(coalesce(NEW.payment_reference, '')), '');
  NEW.payment_number := nullif(trim(coalesce(NEW.payment_number, '')), '');

  RETURN NEW;
END;
$function$;
