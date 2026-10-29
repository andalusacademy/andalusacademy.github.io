-- Repair study-summary bundle entitlements and prevent redundant purchases.
-- Preserves existing orders and student records.

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
  IF p_status = 'paid' AND nullif(btrim(coalesce(v_order.payment_reference,'')), '') IS NULL THEN
    RAISE EXCEPTION 'لا يمكن تأكيد الدفع دون مرجع تحويل مسجل';
  END IF;

  UPDATE public.study_summary_orders
  SET status = p_status,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      reviewed_reason = NULLIF(trim(coalesce(p_reason,'')), ''),
      updated_at = now()
  WHERE id = p_order_id;

  IF p_status <> 'paid' THEN
    RETURN;
  END IF;

  SELECT pi.package_id INTO v_package_id
  FROM public.study_summary_package_items pi
  WHERE pi.summary_id = v_order.summary_id
  LIMIT 1;

  IF v_package_id IS NOT NULL THEN
    SELECT greatest(coalesce(p.validity_days, 2), 1)
    INTO v_days
    FROM public.study_summary_packages p
    WHERE p.id = v_package_id AND p.is_active = true;

    IF v_days IS NULL THEN
      RAISE EXCEPTION 'الباقة غير مفعلة أو غير موجودة';
    END IF;

    FOR v_summary_id IN
      SELECT pi.summary_id
      FROM public.study_summary_package_items pi
      WHERE pi.package_id = v_package_id
      ORDER BY pi.summary_id
    LOOP
      SELECT e.id INTO v_ent_id
      FROM public.study_summary_entitlements e
      WHERE e.student_id = v_order.student_id
        AND e.summary_id = v_summary_id
      ORDER BY (e.revoked_at IS NULL) DESC, e.created_at DESC
      LIMIT 1
      FOR UPDATE;

      IF v_ent_id IS NULL THEN
        INSERT INTO public.study_summary_entitlements
          (student_id, summary_id, order_id, starts_at, expires_at, created_at, revoked_at)
        VALUES
          (v_order.student_id, v_summary_id, v_order.id, now(),
           now() + make_interval(days => v_days), now(), NULL);
      ELSE
        UPDATE public.study_summary_entitlements
        SET order_id = v_order.id,
            starts_at = now(),
            expires_at = now() + make_interval(days => v_days),
            revoked_at = NULL
        WHERE id = v_ent_id;
      END IF;
      v_ent_id := NULL;
    END LOOP;

    IF EXISTS (
      SELECT 1
      FROM public.study_summary_package_items pi
      WHERE pi.package_id = v_package_id
        AND NOT EXISTS (
          SELECT 1 FROM public.study_summary_entitlements e
          WHERE e.student_id = v_order.student_id
            AND e.summary_id = pi.summary_id
            AND e.revoked_at IS NULL
            AND e.starts_at <= now()
            AND (e.expires_at IS NULL OR e.expires_at > now())
        )
    ) THEN
      RAISE EXCEPTION 'لم تكتمل إتاحة جميع أجزاء الباقة؛ أُلغيت العملية بالكامل';
    END IF;
  ELSE
    SELECT greatest(coalesce(sm.validity_days, 30), 1)
    INTO v_days
    FROM public.study_summaries sm
    WHERE sm.id = v_order.summary_id;

    SELECT e.id INTO v_ent_id
    FROM public.study_summary_entitlements e
    WHERE e.student_id = v_order.student_id
      AND e.summary_id = v_order.summary_id
    ORDER BY (e.revoked_at IS NULL) DESC, e.created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_ent_id IS NULL THEN
      INSERT INTO public.study_summary_entitlements
        (student_id, summary_id, order_id, starts_at, expires_at, created_at, revoked_at)
      VALUES
        (v_order.student_id, v_order.summary_id, v_order.id, now(),
         now() + make_interval(days => greatest(coalesce(v_days,30),1)), now(), NULL);
    ELSE
      UPDATE public.study_summary_entitlements
      SET order_id = v_order.id,
          starts_at = now(),
          expires_at = now() + make_interval(days => greatest(coalesce(v_days,30),1)),
          revoked_at = NULL
      WHERE id = v_ent_id;
    END IF;
  END IF;

  INSERT INTO public.study_summary_activity(student_id, summary_id, order_id, event_type, metadata)
  VALUES (
    v_order.student_id, v_order.summary_id, v_order.id, 'access_granted',
    jsonb_build_object('status', 'paid', 'order_code', v_order.order_code,
                       'package_id', v_package_id, 'granted_all_items', v_package_id IS NOT NULL)
  );
END;
$function$;

-- Guard order creation server-side: if all items of a bundle (or the single summary)
-- already have a current entitlement, do not create another order.
DO $migration$
DECLARE
  v_definition text;
  v_old text := $old$IF v_package_id IS NOT NULL THEN$old$;
  v_new text := $new$IF v_package_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.study_summary_package_items pi
    WHERE pi.package_id = v_package_id
      AND NOT EXISTS (
        SELECT 1 FROM public.study_summary_entitlements e
        WHERE e.student_id = v_student_id AND e.summary_id = pi.summary_id
          AND e.revoked_at IS NULL AND e.starts_at <= now()
          AND (e.expires_at IS NULL OR e.expires_at > now())
      )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_has_access');
  END IF;
  IF v_package_id IS NULL AND EXISTS (
    SELECT 1 FROM public.study_summary_entitlements e
    WHERE e.student_id = v_student_id AND e.summary_id = p_summary_id
      AND e.revoked_at IS NULL AND e.starts_at <= now()
      AND (e.expires_at IS NULL OR e.expires_at > now())
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_has_access');
  END IF;

  IF v_package_id IS NOT NULL THEN$new$;
BEGIN
  SELECT pg_get_functiondef('public.student_create_paid_study_summary_order(uuid,uuid)'::regprocedure)
  INTO v_definition;
  IF position(v_old in v_definition) = 0 THEN
    RAISE EXCEPTION 'Could not locate order-creation insertion point; migration aborted safely';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);
  EXECUTE v_definition;
END
$migration$;

-- Repair the confirmed paid bundle for student 5038.
-- Use the latest paid order and grant all bundle members with the same validity window.
DO $repair$
DECLARE
  v_order public.study_summary_orders%rowtype;
  v_package_id uuid;
  v_days integer;
  v_summary_id uuid;
  v_ent_id uuid;
  v_start timestamptz;
BEGIN
  SELECT o.* INTO v_order
  FROM public.study_summary_orders o
  WHERE o.student_id = '5038'
    AND o.order_code IN ('AND-SUM-PKG-51F27B58A2', 'AND-SUM-PKG-4AA77B97E7')
    AND o.status = 'paid'
  ORDER BY o.reviewed_at DESC NULLS LAST, o.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expected paid order for student 5038 was not found; repair aborted';
  END IF;

  SELECT pi.package_id INTO v_package_id
  FROM public.study_summary_package_items pi
  WHERE pi.summary_id = v_order.summary_id
  LIMIT 1;

  IF v_package_id IS NULL THEN
    RAISE EXCEPTION 'Expected study-summary package was not found; repair aborted';
  END IF;

  SELECT greatest(coalesce(p.validity_days,2),1)
  INTO v_days
  FROM public.study_summary_packages p
  WHERE p.id = v_package_id AND p.is_active = true;

  IF v_days IS NULL THEN
    RAISE EXCEPTION 'Expected package is inactive; repair aborted';
  END IF;

  v_start := coalesce(v_order.reviewed_at, v_order.updated_at, now());

  FOR v_summary_id IN
    SELECT pi.summary_id
    FROM public.study_summary_package_items pi
    WHERE pi.package_id = v_package_id
    ORDER BY pi.summary_id
  LOOP
    SELECT e.id INTO v_ent_id
    FROM public.study_summary_entitlements e
    WHERE e.student_id = v_order.student_id
      AND e.summary_id = v_summary_id
    ORDER BY (e.revoked_at IS NULL) DESC, e.created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_ent_id IS NULL THEN
      INSERT INTO public.study_summary_entitlements
        (student_id, summary_id, order_id, starts_at, expires_at, created_at, revoked_at)
      VALUES
        (v_order.student_id, v_summary_id, v_order.id, v_start,
         v_start + make_interval(days => v_days), now(), NULL);
    ELSE
      UPDATE public.study_summary_entitlements
      SET order_id = v_order.id,
          starts_at = v_start,
          expires_at = v_start + make_interval(days => v_days),
          revoked_at = NULL
      WHERE id = v_ent_id;
    END IF;
    v_ent_id := NULL;
  END LOOP;
END
$repair$;

-- Final invariant: each active paid bundle must have an active entitlement for every item.
