-- ============================================================
-- ANDALUS ACADEMY v3.9 — سجل نقاط التواصل مع ولي الأمر
-- نفّذ كل بلوك لوحده، وتجاهل أي خطأ "already exists"
-- ============================================================

-- 1) جدول سجل التواصل (مكالمة/رسالة فعلية تمت مع ولي الأمر أو الطالب)
CREATE TABLE IF NOT EXISTS contact_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL,
  contact_type text NOT NULL DEFAULT 'مكالمة', -- 'مكالمة' | 'رسالة واتساب' | 'زيارة شخصية' | 'أخرى'
  subject text NOT NULL, -- موضوع التواصل (نص قصير)
  notes text,
  created_by uuid,
  created_by_name text,
  created_at timestamptz DEFAULT now()
);

-- 2) فهرس لتسريع البحث عن سجل طالب معين
CREATE INDEX IF NOT EXISTS idx_contact_log_student ON contact_log(student_id);

-- 3) السماح بالعمل دون قيود RLS صارمة (مطابق لباقي جداول النظام)
ALTER TABLE contact_log DISABLE ROW LEVEL SECURITY;

-- 4) علامة اختبار تحديد المستوى (يُستخدم وقت تسجيل طالب جديد، غير مرتبط ببرنامج محدد بصرامة)
ALTER TABLE exams ADD COLUMN IF NOT EXISTS is_placement_test boolean DEFAULT false;

-- 5) كود دخول مبسط للمدرّس لوضع كشك تسجيل الحضور (مستقل عن اسمه، أكثر أمانًا قليلًا)
ALTER TABLE schedule_sessions ADD COLUMN IF NOT EXISTS trainer_code text;
CREATE INDEX IF NOT EXISTS idx_schedule_sessions_trainer_code ON schedule_sessions(trainer_code);
ALTER TABLE schedule_sessions DISABLE ROW LEVEL SECURITY;

-- 6) إعادة تحميل schema cache فى PostgREST
NOTIFY pgrst, 'reload schema';
