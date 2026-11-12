-- Rebuild study-summary store: permanent access, atomic product settings, and one-time storage cleanup state.
ALTER TABLE public.study_summary_entitlements
  ALTER COLUMN expires_at DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.study_summary_store_state (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  storage_purge_pending boolean NOT NULL DEFAULT true,
  storage_purge_completed_at timestamptz,
  storage_purge_object_count integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.study_summary_store_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.study_summary_store_state FROM anon, authenticated;
INSERT INTO public.study_summary_store_state(id, storage_purge_pending)
VALUES (true, true)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_save_study_summary_product(
  p_summary_id uuid,
  p_price numeric,
  p_validity_days integer,
  p_payment_provider text,
  p_wallet_number text,
  p_target_all boolean,
  p_student_ids text[],
  p_publish boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_summary public.study_summaries%rowtype;
  v_count integer;
  v_batches jsonb;
  v_types jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  IF p_price IS NULL OR p_price < 0 THEN RAISE EXCEPTION 'السعر غير صالح'; END IF;
  IF p_validity_days IS NULL OR NOT (p_validity_days BETWEEN 1 AND 3650 OR p_validity_days = 36500) THEN
    RAISE EXCEPTION 'مدة الوصول غير صالحة';
  END IF;
  IF p_publish AND (nullif(btrim(coalesce(p_payment_provider,'')),'') IS NULL
      OR nullif(btrim(coalesce(p_wallet_number,'')),'') IS NULL) THEN
    RAISE EXCEPTION 'أدخل وسيلة التحويل ورقم المحفظة قبل النشر';
  END IF;
  SELECT * INTO v_summary FROM public.study_summaries WHERE id=p_summary_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الملخص غير موجود'; END IF;
  IF NOT coalesce(p_target_all,false) AND coalesce(array_length(p_student_ids,1),0)=0 THEN
    RAISE EXCEPTION 'حدد طالبًا واحدًا على الأقل أو اختر كل الطلاب';
  END IF;
  IF NOT coalesce(p_target_all,false) THEN
    SELECT count(*) INTO v_count
    FROM public.students st
    WHERE st.id = ANY(p_student_ids)
      AND st.deleted_at IS NULL
      AND coalesce(st.student_status,'active')='active';
    IF v_count <> (SELECT count(DISTINCT x) FROM unnest(p_student_ids) x) THEN
      RAISE EXCEPTION 'توجد أرقام طلاب غير صحيحة أو طلاب غير نشطين ضمن الجمهور المحدد';
    END IF;
  END IF;

  SELECT count(*), coalesce(jsonb_agg(DISTINCT q.batch_no), '[]'::jsonb),
         coalesce(jsonb_agg(DISTINCT q.question_type), '[]'::jsonb)
    INTO v_count, v_batches, v_types
  FROM public.study_summary_questions q
  WHERE q.summary_id=p_summary_id AND q.is_selected=true AND q.is_approved=true;

  IF v_summary.delivery_pdf_path IS NULL AND v_count=0 THEN
    RAISE EXCEPTION 'لا يوجد ملف PDF جاهز أو أسئلة معتمدة لهذا المنتج';
  END IF;
  IF v_summary.delivery_pdf_path IS NULL AND NOT v_summary.is_approved THEN
    RAISE EXCEPTION 'راجع الأسئلة واعتمدها قبل النشر';
  END IF;

  UPDATE public.study_summaries
  SET price=p_price,
      validity_days=p_validity_days,
      payment_provider=nullif(btrim(coalesce(p_payment_provider,'')),''),
      payment_wallet_number=nullif(btrim(coalesce(p_wallet_number,'')),''),
      target_all=coalesce(p_target_all,false),
      target_branch=NULL,
      target_system=NULL,
      target_batch=NULL,
      available_from=NULL,
      available_until=NULL,
      enabled_batches=CASE WHEN v_summary.delivery_pdf_path IS NOT NULL THEN '[]'::jsonb ELSE v_batches END,
      enabled_question_types=CASE WHEN v_summary.delivery_pdf_path IS NOT NULL THEN '[]'::jsonb ELSE v_types END,
      is_approved=CASE WHEN v_summary.delivery_pdf_path IS NOT NULL THEN true ELSE is_approved END,
      is_published=coalesce(p_publish,false),
      published_at=CASE WHEN coalesce(p_publish,false) THEN now() ELSE NULL END,
      updated_at=now()
  WHERE id=p_summary_id;

  DELETE FROM public.study_summary_target_students WHERE summary_id=p_summary_id;
  IF NOT coalesce(p_target_all,false) THEN
    INSERT INTO public.study_summary_target_students(summary_id,student_id)
    SELECT p_summary_id, x FROM (SELECT DISTINCT unnest(p_student_ids) AS x) ids;
  END IF;

  RETURN jsonb_build_object('ok',true,'summary_id',p_summary_id,'published',coalesce(p_publish,false),
    'target_all',coalesce(p_target_all,false),'target_student_count',CASE WHEN p_target_all THEN 0 ELSE coalesce(array_length(p_student_ids,1),0) END);
END;
$function$;
REVOKE ALL ON FUNCTION public.admin_save_study_summary_product(uuid,numeric,integer,text,text,boolean,text[],boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_study_summary_product(uuid,numeric,integer,text,text,boolean,text[],boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_review_study_summary_order(
  p_order_id uuid,
  p_status text,
  p_reason text DEFAULT NULL::text
) RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order public.study_summary_orders%rowtype;
  v_days integer;
  v_ent_id uuid;
  v_package_id uuid;
  v_summary_id uuid;
  v_expiry timestamptz;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  IF p_status NOT IN ('paid', 'pending_payment', 'rejected', 'cancelled') THEN
    RAISE EXCEPTION 'حالة غير صالحة';
  END IF;
  SELECT * INTO v_order FROM public.study_summary_orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'طلب الشراء غير موجود'; END IF;
  IF p_status='paid'
     AND nullif(btrim(coalesce(v_order.payment_reference,'')),'') IS NULL
     AND nullif(btrim(coalesce(v_order.payment_proof_path,'')),'') IS NULL THEN
    RAISE EXCEPTION 'لا يمكن تأكيد الدفع دون مرجع تحويل مسجل';
  END IF;
  UPDATE public.study_summary_orders
  SET status=p_status,reviewed_by=auth.uid(),reviewed_at=now(),
      reviewed_reason=NULLIF(trim(coalesce(p_reason,'')),''),
      updated_at=now()
  WHERE id=p_order_id;
  IF p_status<>'paid' THEN RETURN; END IF;

  SELECT pi.package_id INTO v_package_id
  FROM public.study_summary_package_items pi WHERE pi.summary_id=v_order.summary_id LIMIT 1;

  IF v_package_id IS NOT NULL THEN
    SELECT greatest(coalesce(p.validity_days,2),1) INTO v_days
    FROM public.study_summary_packages p WHERE p.id=v_package_id AND p.is_active=true;
    IF v_days IS NULL THEN RAISE EXCEPTION 'الباقة غير مفعلة أو غير موجودة'; END IF;
    v_expiry := CASE WHEN v_days>=36500 THEN NULL ELSE now()+make_interval(days=>v_days) END;
    FOR v_summary_id IN
      SELECT pi.summary_id FROM public.study_summary_package_items pi
      WHERE pi.package_id=v_package_id ORDER BY pi.summary_id
    LOOP
      SELECT e.id INTO v_ent_id FROM public.study_summary_entitlements e
      WHERE e.student_id=v_order.student_id AND e.summary_id=v_summary_id
      ORDER BY (e.revoked_at IS NULL) DESC,e.created_at DESC
      LIMIT 1 FOR UPDATE;
      IF v_ent_id IS NULL THEN
        INSERT INTO public.study_summary_entitlements
          (student_id,summary_id,order_id,starts_at,expires_at,created_at,revoked_at)
        VALUES(v_order.student_id,v_summary_id,v_order.id,now(),v_expiry,now(),NULL);
      ELSE
        UPDATE public.study_summary_entitlements
        SET order_id=v_order.id,starts_at=now(),expires_at=v_expiry,revoked_at=NULL
        WHERE id=v_ent_id;
      END IF;
      v_ent_id:=NULL;
    END LOOP;
    IF EXISTS (
      SELECT 1 FROM public.study_summary_package_items pi
      WHERE pi.package_id=v_package_id AND NOT EXISTS (
        SELECT 1 FROM public.study_summary_entitlements e
        WHERE e.student_id=v_order.student_id AND e.summary_id=pi.summary_id
          AND e.revoked_at IS NULL AND e.starts_at<=now()
          AND (e.expires_at IS NULL OR e.expires_at>now())
      )
    ) THEN RAISE EXCEPTION 'لم تكتمل إتاحة جميع أجزاء الباقة؛ أُلغيت العملية بالكامل'; END IF;
  ELSE
    SELECT greatest(coalesce(sm.validity_days,30),1) INTO v_days
    FROM public.study_summaries sm WHERE sm.id=v_order.summary_id;
    v_expiry := CASE WHEN v_days>=36500 THEN NULL ELSE now()+make_interval(days=>v_days) END;
    SELECT e.id INTO v_ent_id FROM public.study_summary_entitlements e
    WHERE e.student_id=v_order.student_id AND e.summary_id=v_order.summary_id
    ORDER BY (e.revoked_at IS NULL) DESC,e.created_at DESC
    LIMIT 1 FOR UPDATE;
    IF v_ent_id IS NULL THEN
      INSERT INTO public.study_summary_entitlements
        (student_id,summary_id,order_id,starts_at,expires_at,created_at,revoked_at)
      VALUES(v_order.student_id,v_order.summary_id,v_order.id,now(),v_expiry,now(),NULL);
    ELSE
      UPDATE public.study_summary_entitlements
      SET order_id=v_order.id,starts_at=now(),expires_at=v_expiry,revoked_at=NULL
      WHERE id=v_ent_id;
    END IF;
  END IF;

  INSERT INTO public.study_summary_activity(student_id,summary_id,order_id,event_type,metadata)
  VALUES(v_order.student_id,v_order.summary_id,v_order.id,'access_granted',
    jsonb_build_object('status','paid','order_code',v_order.order_code,
      'package_id',v_package_id,'granted_all_items',v_package_id IS NOT NULL));
END;
$function$;
