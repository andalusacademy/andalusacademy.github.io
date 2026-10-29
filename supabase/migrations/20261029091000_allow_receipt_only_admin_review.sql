DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.admin_review_study_summary_order(uuid,text,text)'::regprocedure) INTO v_def;
  v_def := replace(
    v_def,
    'IF p_status = ''paid'' AND nullif(btrim(coalesce(v_order.payment_reference,'''')), '''') IS NULL THEN',
    'IF p_status = ''paid'' AND nullif(btrim(coalesce(v_order.payment_reference,'''')), '''') IS NULL AND nullif(btrim(coalesce(v_order.payment_proof_path,'''')), '''') IS NULL THEN'
  );
  IF position('v_order.payment_proof_path' in v_def)=0 THEN
    RAISE EXCEPTION 'Could not patch payment-proof approval guard';
  END IF;
  EXECUTE v_def;
END $$;