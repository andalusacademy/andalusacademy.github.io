-- ============================================================
-- ANDALUS ACADEMY v4.2 — استبعاد طالب من محاضرة معينة (مش عام)
-- نسخة ديناميكية: بتكتشف نوع العمود الحقيقي لـ students.id
-- و schedule_sessions.id تلقائيًا فتتفادى مشكلة uuid/text
-- نفّذ فى Supabase SQL Editor
-- ============================================================

DROP TABLE IF EXISTS attendance_session_exclusions;

DO $$
DECLARE
  student_id_type text;
  session_id_type text;
BEGIN
  SELECT data_type INTO student_id_type
  FROM information_schema.columns
  WHERE table_name = 'students' AND column_name = 'id';

  SELECT data_type INTO session_id_type
  FROM information_schema.columns
  WHERE table_name = 'schedule_sessions' AND column_name = 'id';

  EXECUTE format('
    CREATE TABLE attendance_session_exclusions (
      session_id %s NOT NULL REFERENCES schedule_sessions(id) ON DELETE CASCADE,
      student_id %s NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      created_at timestamptz DEFAULT now(),
      PRIMARY KEY (session_id, student_id)
    )',
    CASE WHEN session_id_type = 'uuid' THEN 'uuid' ELSE 'text' END,
    CASE WHEN student_id_type = 'uuid' THEN 'uuid' ELSE 'text' END
  );
END $$;

ALTER TABLE attendance_session_exclusions DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
