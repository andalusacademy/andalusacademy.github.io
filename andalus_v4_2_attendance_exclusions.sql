-- ============================================================
-- ANDALUS ACADEMY v4.2 — استبعاد طالب من محاضرة معينة (مش عام)
-- نفّذ فى Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS attendance_session_exclusions (
  session_id uuid NOT NULL REFERENCES schedule_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (session_id, student_id)
);
ALTER TABLE attendance_session_exclusions DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
