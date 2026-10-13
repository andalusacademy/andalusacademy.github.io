CREATE OR REPLACE FUNCTION public.admin_get_weekly_quiz_bank()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE result_data jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.is_active IS TRUE AND up.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', q.id, 'question', q.question, 'option_a', q.option_a,
    'option_b', q.option_b, 'option_c', q.option_c, 'option_d', q.option_d,
    'correct_option', q.correct_option, 'category', q.category,
    'points', q.points, 'active', q.active, 'created_at', q.created_at
  ) ORDER BY q.created_at DESC), '[]'::jsonb)
  INTO result_data FROM public.quiz_bank_questions q;
  RETURN result_data;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_add_weekly_quiz_question(
  p_question text, p_option_a text, p_option_b text, p_option_c text,
  p_option_d text, p_correct_option text, p_category text DEFAULT NULL,
  p_points integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE new_id uuid; correct_key text := lower(btrim(coalesce(p_correct_option, '')));
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.is_active IS TRUE AND up.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF btrim(coalesce(p_question,'')) = ''
     OR btrim(coalesce(p_option_a,'')) = ''
     OR btrim(coalesce(p_option_b,'')) = ''
     OR correct_key NOT IN ('a','b','c','d') THEN
    RETURN jsonb_build_object('ok',false,'reason','invalid_question');
  END IF;
  INSERT INTO public.quiz_bank_questions
    (question, option_a, option_b, option_c, option_d, correct_option, category, points)
  VALUES
    (btrim(p_question), btrim(p_option_a), btrim(p_option_b),
     COALESCE(NULLIF(btrim(p_option_c),''),'—'),
     COALESCE(NULLIF(btrim(p_option_d),''),'—'),
     correct_key, NULLIF(btrim(coalesce(p_category,'')),''), GREATEST(1,COALESCE(p_points,10)))
  RETURNING id INTO new_id;
  RETURN jsonb_build_object('ok',true,'id',new_id);
END;
$function$;

REVOKE ALL PRIVILEGES ON TABLE public.quiz_bank_questions FROM anon, authenticated, PUBLIC;
GRANT SELECT (id, question, option_a, option_b, option_c, option_d, category, points, active, created_at)
ON TABLE public.quiz_bank_questions TO anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_get_weekly_quiz_bank() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_weekly_quiz_bank() TO authenticated;
REVOKE ALL ON FUNCTION public.admin_add_weekly_quiz_question(text,text,text,text,text,text,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_add_weekly_quiz_question(text,text,text,text,text,text,text,integer) TO authenticated;