-- Simplified study-summary store: protected student targeting, PDF delivery, custom/permanent validity.
ALTER TABLE public.study_summaries ADD COLUMN IF NOT EXISTS delivery_pdf_path text;
CREATE TABLE IF NOT EXISTS public.study_summary_target_students (
  summary_id uuid NOT NULL REFERENCES public.study_summaries(id) ON DELETE CASCADE,
  student_id text NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (summary_id, student_id)
);
CREATE INDEX IF NOT EXISTS study_summary_target_students_student_idx ON public.study_summary_target_students(student_id, summary_id);
ALTER TABLE public.study_summary_target_students ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.study_summary_target_students FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_summary_target_students TO authenticated;
DROP POLICY IF EXISTS study_summary_target_students_admin_all ON public.study_summary_target_students;
CREATE POLICY study_summary_target_students_admin_all ON public.study_summary_target_students
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.study_summary_student_is_targeted(p_summary_id uuid, p_student_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.study_summaries sm
    JOIN public.students st ON st.id = p_student_id
    WHERE sm.id = p_summary_id
      AND st.deleted_at IS NULL
      AND coalesce(st.student_status, 'active') = 'active'
      AND (
        coalesce(sm.target_all, true)
        OR EXISTS (
          SELECT 1 FROM public.study_summary_target_students ts
          WHERE ts.summary_id = sm.id AND ts.student_id = p_student_id
        )
        OR (
          (nullif(btrim(sm.target_branch), '') IS NOT NULL
           OR nullif(btrim(sm.target_system), '') IS NOT NULL
           OR nullif(btrim(sm.target_batch), '') IS NOT NULL)
          AND (nullif(btrim(sm.target_branch), '') IS NULL OR public.study_summary_target_matches(sm.target_branch, st.branch))
          AND (nullif(btrim(sm.target_system), '') IS NULL OR public.study_summary_target_matches(sm.target_system, st.system_name))
          AND (nullif(btrim(sm.target_batch), '') IS NULL OR public.study_summary_target_matches(sm.target_batch, st.program))
        )
      )
  );
$function$

CREATE OR REPLACE FUNCTION public.get_student_summary_catalog(p_student_id text)
 RETURNS TABLE(id uuid, title text, description text, subject_name text, price numeric, validity_days integer, is_owned boolean, pending_status text, order_id uuid, order_reason text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH package_rows AS (
  SELECT p.id AS package_id,
         min(pi.summary_id::text)::uuid AS representative_id,
         p.name, p.price, p.validity_days,
         EXISTS (
           SELECT 1 FROM public.study_summary_entitlements e
           WHERE e.student_id=p_student_id
             AND e.summary_id=min(pi.summary_id::text)::uuid
             AND e.revoked_at IS NULL AND e.starts_at<=now()
             AND (e.expires_at IS NULL OR e.expires_at>now())
         ) AS all_owned
  FROM public.study_summary_packages p
  JOIN public.study_summary_package_items pi ON pi.package_id=p.id
  WHERE p.is_active=true
  GROUP BY p.id,p.name,p.price,p.validity_days
)
SELECT pr.representative_id,pr.name,
       'باقة ملخصات دراسية'::text,
       coalesce((SELECT s.subject_name FROM public.study_summaries s WHERE s.id=pr.representative_id),'مادة دراسية'),
       pr.price,pr.validity_days,pr.all_owned,
       (SELECT o.status FROM public.study_summary_orders o WHERE o.summary_id=pr.representative_id AND o.student_id=p_student_id AND o.admin_deleted_at IS NULL ORDER BY o.created_at DESC LIMIT 1),
       (SELECT o.id FROM public.study_summary_orders o WHERE o.summary_id=pr.representative_id AND o.student_id=p_student_id AND o.admin_deleted_at IS NULL ORDER BY o.created_at DESC LIMIT 1),
       (SELECT o.reviewed_reason FROM public.study_summary_orders o WHERE o.summary_id=pr.representative_id AND o.student_id=p_student_id AND o.admin_deleted_at IS NULL ORDER BY o.created_at DESC LIMIT 1)
FROM package_rows pr
WHERE EXISTS (
  SELECT 1 FROM public.study_summaries s
  WHERE s.id=pr.representative_id
    AND s.is_published=true AND s.is_approved=true
    AND (s.available_from IS NULL OR s.available_from<=now())
    AND (s.available_until IS NULL OR s.available_until>now())
    AND public.study_summary_student_is_targeted(s.id,p_student_id)
)
UNION ALL
SELECT s.id,s.title,s.description,s.subject_name,s.price,s.validity_days,
       EXISTS (
         SELECT 1 FROM public.study_summary_entitlements e
         WHERE e.summary_id=s.id AND e.student_id=p_student_id AND e.revoked_at IS NULL
           AND e.starts_at<=now() AND (e.expires_at IS NULL OR e.expires_at>now())
       ),
       (SELECT o.status FROM public.study_summary_orders o WHERE o.summary_id=s.id AND o.student_id=p_student_id AND o.admin_deleted_at IS NULL ORDER BY o.created_at DESC LIMIT 1),
       (SELECT o.id FROM public.study_summary_orders o WHERE o.summary_id=s.id AND o.student_id=p_student_id AND o.admin_deleted_at IS NULL ORDER BY o.created_at DESC LIMIT 1),
       (SELECT o.reviewed_reason FROM public.study_summary_orders o WHERE o.summary_id=s.id AND o.student_id=p_student_id AND o.admin_deleted_at IS NULL ORDER BY o.created_at DESC LIMIT 1)
FROM public.study_summaries s
WHERE s.is_published=true AND s.is_approved=true
  AND (s.available_from IS NULL OR s.available_from<=now())
  AND (s.available_until IS NULL OR s.available_until>now())
  AND NOT EXISTS (SELECT 1 FROM public.study_summary_package_items pi WHERE pi.summary_id=s.id)
  AND public.study_summary_student_is_targeted(s.id,p_student_id)
ORDER BY 1;
$function$

CREATE OR REPLACE FUNCTION public.student_list_study_summaries(p_session_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_student_id text; v_result jsonb;
BEGIN
  SELECT s.student_id INTO v_student_id
  FROM public.competition_face_verified_sessions s
  JOIN public.students st ON st.id=s.student_id
  WHERE s.token=p_session_token AND s.competition_type='student_portal'
    AND s.expires_at>now() AND st.deleted_at IS NULL
    AND coalesce(st.student_status,'active')='active'
  LIMIT 1;
  IF v_student_id IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','session_expired'); END IF;

  UPDATE public.study_summary_orders SET status='expired',updated_at=now()
  WHERE student_id=v_student_id AND status='pending_payment'
    AND expires_at IS NOT NULL AND expires_at<=now();

  SELECT coalesce(jsonb_agg(x.item ORDER BY x.created_at DESC),'[]'::jsonb) INTO v_result
  FROM (
    SELECT sm.created_at,
      jsonb_build_object(
        'id',coalesce(pkg.representative_id,sm.id),
        'title',coalesce(pkg.name,sm.title),
        'description',CASE WHEN pkg.package_id IS NOT NULL THEN 'باقة ملخصات دراسية' ELSE sm.description END,
        'subject_name',sm.subject_name,
        'price',coalesce(pkg.price,sm.price),
        'validity_days',coalesce(pkg.validity_days,sm.validity_days),
        'has_pdf',coalesce(sm.delivery_pdf_path IS NOT NULL,false),
        'question_count',CASE WHEN pkg.package_id IS NOT NULL THEN pkg.question_count ELSE (
          SELECT count(*) FROM public.study_summary_questions q
          WHERE q.summary_id=sm.id AND q.is_selected=true AND q.is_approved=true
            AND q.batch_no IN (SELECT value::integer FROM jsonb_array_elements_text(coalesce(sm.enabled_batches,'[1,2]'::jsonb)))
            AND q.question_type IN (SELECT value FROM jsonb_array_elements_text(coalesce(sm.enabled_question_types,'["mcq","true_false","essay"]'::jsonb)))
        ) END,
        'has_access',CASE WHEN pkg.package_id IS NOT NULL THEN pkg.has_representative_access ELSE EXISTS(
          SELECT 1 FROM public.study_summary_entitlements e
          WHERE e.student_id=v_student_id AND e.summary_id=sm.id AND e.revoked_at IS NULL
            AND e.starts_at<=now() AND (e.expires_at IS NULL OR e.expires_at>now())
        ) END,
        'expires_at',CASE WHEN pkg.package_id IS NOT NULL THEN pkg.expires_at ELSE (
          SELECT max(e.expires_at) FROM public.study_summary_entitlements e
          WHERE e.student_id=v_student_id AND e.summary_id=sm.id AND e.revoked_at IS NULL
            AND e.starts_at<=now() AND (e.expires_at IS NULL OR e.expires_at>now())
        ) END,
        'pending_order',EXISTS(
          SELECT 1 FROM public.study_summary_orders o
          WHERE o.student_id=v_student_id AND o.summary_id=coalesce(pkg.representative_id,sm.id)
            AND o.status='pending_payment' AND (o.expires_at IS NULL OR o.expires_at>now())
        )
      ) AS item
    FROM public.study_summaries sm
    LEFT JOIN LATERAL (
      SELECT p.id AS package_id,p.name,p.price,p.validity_days,
        (SELECT min(pi0.summary_id::text)::uuid FROM public.study_summary_package_items pi0 WHERE pi0.package_id=p.id) AS representative_id,
        (SELECT count(*) FROM public.study_summary_questions q
          JOIN public.study_summaries qsm ON qsm.id=q.summary_id
          WHERE q.summary_id IN (SELECT pi2.summary_id FROM public.study_summary_package_items pi2 WHERE pi2.package_id=p.id)
            AND q.is_selected=true AND q.is_approved=true
            AND q.batch_no IN (SELECT value::integer FROM jsonb_array_elements_text(coalesce(qsm.enabled_batches,'[1,2]'::jsonb)))
            AND q.question_type IN (SELECT value FROM jsonb_array_elements_text(coalesce(qsm.enabled_question_types,'["mcq","true_false","essay"]'::jsonb)))
        ) AS question_count,
        EXISTS(
          SELECT 1 FROM public.study_summary_entitlements e
          WHERE e.student_id=v_student_id
            AND e.summary_id=(SELECT min(pi0.summary_id::text)::uuid FROM public.study_summary_package_items pi0 WHERE pi0.package_id=p.id)
            AND e.revoked_at IS NULL AND e.starts_at<=now()
            AND (e.expires_at IS NULL OR e.expires_at>now())
        ) AS has_representative_access,
        (SELECT max(e.expires_at) FROM public.study_summary_entitlements e
          WHERE e.student_id=v_student_id
            AND e.summary_id=(SELECT min(pi0.summary_id::text)::uuid FROM public.study_summary_package_items pi0 WHERE pi0.package_id=p.id)
            AND e.revoked_at IS NULL AND e.starts_at<=now()
            AND (e.expires_at IS NULL OR e.expires_at>now())
        ) AS expires_at
      FROM public.study_summary_package_items pi
      JOIN public.study_summary_packages p ON p.id=pi.package_id AND p.is_active=true
      WHERE pi.summary_id=sm.id LIMIT 1
    ) pkg ON true
    WHERE sm.is_published=true AND sm.is_approved=true
      AND (sm.available_from IS NULL OR sm.available_from<=now())
      AND ((sm.available_until IS NULL OR sm.available_until>now()) OR EXISTS(
        SELECT 1 FROM public.study_summary_entitlements e
        WHERE e.student_id=v_student_id AND e.summary_id=sm.id AND e.revoked_at IS NULL
          AND e.starts_at<=now() AND (e.expires_at IS NULL OR e.expires_at>now())
      ))
      AND public.study_summary_student_is_targeted(sm.id,v_student_id)
      AND (pkg.package_id IS NULL OR sm.id=pkg.representative_id)
  ) x;

  INSERT INTO public.study_summary_activity(student_id,event_type,metadata)
  VALUES(v_student_id,'list','{}'::jsonb);
  RETURN jsonb_build_object('ok',true,'summaries',v_result);
END;
$function$

CREATE OR REPLACE FUNCTION public.student_create_paid_study_summary_order(p_session_token uuid, p_summary_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_student_id text;
  v_summary public.study_summaries%rowtype;
  v_order public.study_summary_orders%rowtype;
  v_package_id uuid;
  v_rep_id uuid;
  v_package public.study_summary_packages%rowtype;
BEGIN
  SELECT s.student_id INTO v_student_id
  FROM public.competition_face_verified_sessions s
  JOIN public.students st ON st.id=s.student_id
  WHERE s.token=p_session_token AND s.competition_type='student_portal'
    AND s.expires_at>now() AND st.deleted_at IS NULL
    AND coalesce(st.student_status,'active')='active'
  LIMIT 1;
  IF v_student_id IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','session_expired'); END IF;

  SELECT pi.package_id INTO v_package_id
  FROM public.study_summary_package_items pi WHERE pi.summary_id=p_summary_id LIMIT 1;

  IF v_package_id IS NOT NULL THEN
    SELECT * INTO v_package FROM public.study_summary_packages WHERE id=v_package_id AND is_active=true;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','summary_unavailable'); END IF;
    SELECT min(summary_id::text)::uuid INTO v_rep_id FROM public.study_summary_package_items WHERE package_id=v_package_id;
    IF p_summary_id<>v_rep_id THEN RETURN jsonb_build_object('ok',false,'reason','package_only'); END IF;
    SELECT * INTO v_summary FROM public.study_summaries sm
    WHERE sm.id=v_rep_id AND sm.is_published=true AND sm.is_approved=true
      AND (sm.available_from IS NULL OR sm.available_from<=now())
      AND (sm.available_until IS NULL OR sm.available_until>now());
    IF NOT FOUND OR NOT public.study_summary_student_is_targeted(v_rep_id,v_student_id) THEN
      RETURN jsonb_build_object('ok',false,'reason','summary_unavailable_or_not_targeted');
    END IF;
    IF EXISTS (SELECT 1 FROM public.study_summary_entitlements e
      WHERE e.student_id=v_student_id AND e.summary_id=v_rep_id AND e.revoked_at IS NULL
        AND e.starts_at<=now() AND (e.expires_at IS NULL OR e.expires_at>now())) THEN
      UPDATE public.study_summary_orders o SET status='cancelled',reviewed_at=now(),updated_at=now(),
        reviewed_reason='إلغاء تلقائي: الطالب لديه إتاحة فعالة للباقة بالفعل'
      WHERE o.student_id=v_student_id AND o.summary_id=v_rep_id
        AND o.status='pending_payment' AND o.admin_deleted_at IS NULL;
      RETURN jsonb_build_object('ok',false,'reason','already_has_access');
    END IF;
    IF nullif(btrim(v_summary.payment_provider),'') IS NULL OR nullif(btrim(v_summary.payment_wallet_number),'') IS NULL THEN
      RETURN jsonb_build_object('ok',false,'reason','payment_not_configured');
    END IF;
    UPDATE public.study_summary_orders SET status='expired',updated_at=now()
    WHERE student_id=v_student_id AND summary_id=v_rep_id AND status='pending_payment'
      AND expires_at IS NOT NULL AND expires_at<=now();
    SELECT * INTO v_order FROM public.study_summary_orders
    WHERE student_id=v_student_id AND summary_id=v_rep_id AND status='pending_payment'
      AND (expires_at IS NULL OR expires_at>now()) ORDER BY created_at DESC LIMIT 1;
    IF NOT FOUND THEN
      INSERT INTO public.study_summary_orders(student_id,summary_id,amount,status,payment_method,payment_number,order_code,expires_at,access_hours)
      VALUES(v_student_id,v_rep_id,v_package.price,'pending_payment',v_summary.payment_provider,v_summary.payment_wallet_number,
        'AND-SUM-PKG-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),now()+interval '24 hours',NULL)
      RETURNING * INTO v_order;
      INSERT INTO public.study_summary_activity(student_id,summary_id,order_id,event_type,metadata)
      VALUES(v_student_id,v_rep_id,v_order.id,'order_created',jsonb_build_object('amount',v_order.amount,'status',v_order.status,
        'order_code',v_order.order_code,'package_id',v_package_id));
    END IF;
    RETURN jsonb_build_object('ok',true,'order',jsonb_build_object('id',v_order.id,'order_number',v_order.order_code,
      'order_code',v_order.order_code,'summary_id',v_order.summary_id,'amount',v_order.amount,'status',v_order.status,
      'created_at',v_order.created_at,'expires_at',v_order.expires_at,'payment_provider',v_summary.payment_provider,
      'payment_wallet_number',v_summary.payment_wallet_number,'package_name',v_package.name));
  END IF;

  SELECT * INTO v_summary FROM public.study_summaries sm
  WHERE sm.id=p_summary_id AND sm.is_published=true AND sm.is_approved=true
    AND (sm.available_from IS NULL OR sm.available_from<=now())
    AND (sm.available_until IS NULL OR sm.available_until>now());
  IF NOT FOUND OR NOT public.study_summary_student_is_targeted(p_summary_id,v_student_id) THEN
    RETURN jsonb_build_object('ok',false,'reason','summary_unavailable_or_not_targeted');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.study_summary_questions q
    WHERE q.summary_id=p_summary_id AND q.is_selected=true AND q.is_approved=true)
    AND v_summary.delivery_pdf_path IS NULL THEN
    RETURN jsonb_build_object('ok',false,'reason','empty_summary');
  END IF;
  IF EXISTS (SELECT 1 FROM public.study_summary_entitlements e
    WHERE e.student_id=v_student_id AND e.summary_id=p_summary_id AND e.revoked_at IS NULL
      AND e.starts_at<=now() AND (e.expires_at IS NULL OR e.expires_at>now())) THEN
    UPDATE public.study_summary_orders o SET status='cancelled',reviewed_at=now(),updated_at=now(),
      reviewed_reason='إلغاء تلقائي: الطالب لديه إتاحة فعالة للملخص بالفعل'
    WHERE o.student_id=v_student_id AND o.summary_id=p_summary_id
      AND o.status='pending_payment' AND o.admin_deleted_at IS NULL;
    RETURN jsonb_build_object('ok',false,'reason','already_has_access');
  END IF;
  IF nullif(btrim(v_summary.payment_provider),'') IS NULL OR nullif(btrim(v_summary.payment_wallet_number),'') IS NULL THEN
    RETURN jsonb_build_object('ok',false,'reason','payment_not_configured');
  END IF;
  UPDATE public.study_summary_orders SET status='expired',updated_at=now()
  WHERE student_id=v_student_id AND summary_id=p_summary_id AND status='pending_payment'
    AND expires_at IS NOT NULL AND expires_at<=now();
  SELECT * INTO v_order FROM public.study_summary_orders
  WHERE student_id=v_student_id AND summary_id=p_summary_id AND status='pending_payment'
    AND (expires_at IS NULL OR expires_at>now()) ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN
    INSERT INTO public.study_summary_orders(student_id,summary_id,amount,status,payment_method,payment_number,order_code,expires_at,access_hours)
    VALUES(v_student_id,p_summary_id,v_summary.price,'pending_payment',v_summary.payment_provider,v_summary.payment_wallet_number,
      'AND-SUM-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),now()+interval '24 hours',NULL)
    RETURNING * INTO v_order;
    INSERT INTO public.study_summary_activity(student_id,summary_id,order_id,event_type,metadata)
    VALUES(v_student_id,p_summary_id,v_order.id,'order_created',jsonb_build_object('amount',v_order.amount,'status',v_order.status,'order_code',v_order.order_code));
  END IF;
  RETURN jsonb_build_object('ok',true,'order',jsonb_build_object('id',v_order.id,
    'order_number',coalesce(v_order.order_code,upper(left(replace(v_order.id::text,'-',''),12))),
    'order_code',v_order.order_code,'summary_id',v_order.summary_id,'amount',v_order.amount,'status',v_order.status,
    'created_at',v_order.created_at,'expires_at',v_order.expires_at,
    'payment_provider',v_summary.payment_provider,'payment_wallet_number',v_summary.payment_wallet_number));
END;
$function$

CREATE OR REPLACE FUNCTION public.admin_review_study_summary_order(p_order_id uuid, p_status text, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order public.study_summary_orders%rowtype;
  v_days integer;
  v_ent_id uuid;
  v_package_id uuid;
  v_summary_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'غير مصرح'; END IF;
  IF p_status NOT IN ('paid', 'pending_payment', 'rejected', 'cancelled') THEN
    RAISE EXCEPTION 'حالة غير صالحة';
  END IF;

  SELECT * INTO v_order FROM public.study_summary_orders
  WHERE id=p_order_id FOR UPDATE;
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
  FROM public.study_summary_package_items pi
  WHERE pi.summary_id=v_order.summary_id LIMIT 1;

  IF v_package_id IS NOT NULL THEN
    SELECT greatest(coalesce(p.validity_days,2),1) INTO v_days
    FROM public.study_summary_packages p
    WHERE p.id=v_package_id AND p.is_active=true;
    IF v_days IS NULL THEN RAISE EXCEPTION 'الباقة غير مفعلة أو غير موجودة'; END IF;

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
        VALUES(v_order.student_id,v_summary_id,v_order.id,now(),
          now()+make_interval(days=>v_days),now(),NULL);
      ELSE
        UPDATE public.study_summary_entitlements
        SET order_id=v_order.id,starts_at=now(),
            expires_at=now()+make_interval(days=>v_days),revoked_at=NULL
        WHERE id=v_ent_id;
      END IF;
      v_ent_id:=NULL;
    END LOOP;

    IF EXISTS (
      SELECT 1 FROM public.study_summary_package_items pi
      WHERE pi.package_id=v_package_id
        AND NOT EXISTS (
          SELECT 1 FROM public.study_summary_entitlements e
          WHERE e.student_id=v_order.student_id AND e.summary_id=pi.summary_id
            AND e.revoked_at IS NULL AND e.starts_at<=now()
            AND (e.expires_at IS NULL OR e.expires_at>now())
        )
    ) THEN RAISE EXCEPTION 'لم تكتمل إتاحة جميع أجزاء الباقة؛ أُلغيت العملية بالكامل'; END IF;
  ELSE
    SELECT greatest(coalesce(sm.validity_days,30),1) INTO v_days
    FROM public.study_summaries sm WHERE sm.id=v_order.summary_id;

    SELECT e.id INTO v_ent_id FROM public.study_summary_entitlements e
    WHERE e.student_id=v_order.student_id AND e.summary_id=v_order.summary_id
    ORDER BY (e.revoked_at IS NULL) DESC,e.created_at DESC
    LIMIT 1 FOR UPDATE;

    IF v_ent_id IS NULL THEN
      INSERT INTO public.study_summary_entitlements
        (student_id,summary_id,order_id,starts_at,expires_at,created_at,revoked_at)
      VALUES(v_order.student_id,v_order.summary_id, v_order.id,now(),
        CASE WHEN v_days>=36500 THEN NULL ELSE now()+make_interval(days=>greatest(coalesce(v_days,30),1)) END,
        now(),NULL);
    ELSE
      UPDATE public.study_summary_entitlements
      SET order_id=v_order.id,starts_at=now(),
          expires_at=CASE WHEN v_days>=36500 THEN NULL ELSE now()+make_interval(days=>greatest(coalesce(v_days,30),1)) END,
          revoked_at=NULL
      WHERE id=v_ent_id;
    END IF;
  END IF;

  INSERT INTO public.study_summary_activity(student_id,summary_id,order_id,event_type,metadata)
  VALUES(v_order.student_id,v_order.summary_id,v_order.id,'access_granted',
    jsonb_build_object('status','paid','order_code',v_order.order_code,
      'package_id',v_package_id,'granted_all_items',v_package_id IS NOT NULL));
END;
$function$
