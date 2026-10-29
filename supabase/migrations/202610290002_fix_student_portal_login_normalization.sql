-- Student portal login compatibility: normalize Arabic/Persian digits and whitespace.
CREATE OR REPLACE FUNCTION public.normalize_student_login_digits(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT translate(
    coalesce(p_value, ''),
    '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
    '01234567890123456789'
  );
$$;

DO $migration$
DECLARE
  v_definition text;
  v_old_national text := $old$and btrim(coalesce(national_id, '')) = btrim(p_national_id)$old$;
  v_new_national text := $new$and regexp_replace(public.normalize_student_login_digits(national_id), '[^0-9]', '', 'g') = regexp_replace(public.normalize_student_login_digits(p_national_id), '[^0-9]', '', 'g')$new$;
  v_old_code text := $old$and (btrim(coalesce(enrollment_number, '')) = btrim(p_student_code)
             or btrim(id) = btrim(p_student_code))$old$;
  v_new_code text := $new$and (
          lower(regexp_replace(public.normalize_student_login_digits(coalesce(enrollment_number, '')), '\s+', '', 'g')) = lower(regexp_replace(public.normalize_student_login_digits(p_student_code), '\s+', '', 'g'))
          or lower(regexp_replace(public.normalize_student_login_digits(id), '\s+', '', 'g')) = lower(regexp_replace(public.normalize_student_login_digits(p_student_code), '\s+', '', 'g'))
        )$new$;
BEGIN
  SELECT pg_get_functiondef('public.student_device_auth(text,text,text)'::regprocedure)
  INTO v_definition;

  IF position(v_old_national in v_definition) = 0 THEN
    RAISE EXCEPTION 'Could not find national ID comparison in student_device_auth; migration aborted safely';
  END IF;
  IF position(v_old_code in v_definition) = 0 THEN
    RAISE EXCEPTION 'Could not find enrollment comparison in student_device_auth; migration aborted safely';
  END IF;

  v_definition := replace(v_definition, v_old_national, v_new_national);
  v_definition := replace(v_definition, v_old_code, v_new_code);
  EXECUTE v_definition;
END
$migration$;
