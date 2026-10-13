REVOKE ALL ON FUNCTION public.student_face_phone_matches(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_face_phone_matches(text,text) TO authenticated;