-- ====================================================================
-- ANDALUS ACADEMY — Supabase Setup Script
-- شغّل هذا الملف مرة واحدة في: Supabase Dashboard → SQL Editor → New Query
-- ====================================================================

-- ====================================================================
-- PART 1: امسح جدول users القديم (اختياري — بعد ما تنقل كل اللي فيه)
-- لو عندك مستخدمين قدامى، خد نسخة من بياناتهم الأول:
--    SELECT * FROM users;
-- احفظهم في ملف Excel، وبعدين امسح الجدول
-- ====================================================================

-- DROP TABLE IF EXISTS users CASCADE;

-- ====================================================================
-- PART 2: user_profiles — بديل users القديم، مربوط بـ Supabase Auth
-- ====================================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
  branch TEXT NOT NULL DEFAULT 'الكل' CHECK (branch IN ('الكل', 'كفر الدوار', 'فيكتوريا')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index للبحث السريع
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- ====================================================================
-- PART 3: Triggers — إنشاء profile تلقائياً عند تسجيل أي مستخدم جديد
-- ====================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username TEXT;
  v_full_name TEXT;
BEGIN
  v_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
  v_full_name := NEW.raw_user_meta_data->>'full_name';
  
  INSERT INTO public.user_profiles (id, username, full_name, role, branch)
  VALUES (
    NEW.id,
    v_username,
    v_full_name,
    COALESCE(NEW.raw_user_meta_data->>'role', 'employee'),
    COALESCE(NEW.raw_user_meta_data->>'branch', 'الكل')
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ====================================================================
-- PART 4: Helper functions تُستخدم في الـ RLS Policies
-- ====================================================================

-- هل المستخدم الحالي admin؟
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  );
$$;

-- هل المستخدم الحالي نشط؟
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND is_active = true
  );
$$;

-- جلب فرع المستخدم الحالي
CREATE OR REPLACE FUNCTION public.get_user_branch()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(branch, 'الكل') FROM user_profiles WHERE id = auth.uid() AND is_active = true;
$$;

-- جلب role المستخدم الحالي
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(role, 'employee') FROM user_profiles WHERE id = auth.uid() AND is_active = true;
$$;

-- هل الطالب تابع لفرع المستخدم الحالي؟
CREATE OR REPLACE FUNCTION public.student_in_user_branch(p_branch TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.get_user_branch() = 'الكل' OR p_branch = public.get_user_branch();
$$;

-- ====================================================================
-- PART 5: فعّل RLS على كل الجداول
-- ====================================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE students       ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects       ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades         ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance     ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedures     ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads          ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_log    ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- PART 6: Policies — user_profiles
-- ====================================================================

DROP POLICY IF EXISTS "user_profiles_self_read" ON user_profiles;
CREATE POLICY "user_profiles_self_read" ON user_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "user_profiles_admin_all" ON user_profiles;
CREATE POLICY "user_profiles_admin_all" ON user_profiles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ====================================================================
-- PART 7: Policies — students (admin: الكل | employee: فرعه فقط)
-- ====================================================================

DROP POLICY IF EXISTS "students_admin_all" ON students;
CREATE POLICY "students_admin_all" ON students
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "employees_read_branch" ON students;
CREATE POLICY "employees_read_branch" ON students
  FOR SELECT TO authenticated
  USING (public.is_active_user() AND public.student_in_user_branch(branch));

DROP POLICY IF EXISTS "employees_modify_branch" ON students;
CREATE POLICY "employees_modify_branch" ON students
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user() AND public.student_in_user_branch(branch));

DROP POLICY IF EXISTS "employees_update_branch" ON students;
CREATE POLICY "employees_update_branch" ON students
  FOR UPDATE TO authenticated
  USING (public.is_active_user() AND public.student_in_user_branch(branch))
  WITH CHECK (public.is_active_user() AND public.student_in_user_branch(branch));

DROP POLICY IF EXISTS "employees_delete_branch" ON students;
CREATE POLICY "employees_delete_branch" ON students
  FOR DELETE TO authenticated
  USING (public.is_active_user() AND public.student_in_user_branch(branch));

-- ====================================================================
-- PART 8: Programs & Subjects — admin يدير، الكل يقرأ
-- ====================================================================

DROP POLICY IF EXISTS "programs_admin_all" ON programs;
CREATE POLICY "programs_admin_all" ON programs
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "programs_read_all" ON programs;
CREATE POLICY "programs_read_all" ON programs
  FOR SELECT TO authenticated
  USING (public.is_active_user());

DROP POLICY IF EXISTS "subjects_admin_all" ON subjects;
CREATE POLICY "subjects_admin_all" ON subjects
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "subjects_read_all" ON subjects;
CREATE POLICY "subjects_read_all" ON subjects
  FOR SELECT TO authenticated
  USING (public.is_active_user());

-- ====================================================================
-- PART 9: Grades / Attendance / Procedures / Payments / Leads
-- كلهم مربوطين بفرع الطالب (عبر JOIN)
-- ====================================================================

-- Helper: جلب فرع طالب معين
CREATE OR REPLACE FUNCTION public.get_student_branch(p_student_id TEXT)
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT branch FROM students WHERE id = p_student_id;
$$;

CREATE OR REPLACE FUNCTION public.can_access_student(p_student_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.is_admin() OR public.student_in_user_branch(public.get_student_branch(p_student_id));
$$;

-- grades
DROP POLICY IF EXISTS "grades_admin_all" ON grades;
CREATE POLICY "grades_admin_all" ON grades
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "grades_employee" ON grades;
CREATE POLICY "grades_employee" ON grades
  FOR ALL TO authenticated
  USING (public.can_access_student(student_id))
  WITH CHECK (public.can_access_student(student_id));

-- attendance
DROP POLICY IF EXISTS "attendance_admin_all" ON attendance;
CREATE POLICY "attendance_admin_all" ON attendance
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "attendance_employee" ON attendance;
CREATE POLICY "attendance_employee" ON attendance
  FOR ALL TO authenticated
  USING (public.can_access_student(student_id))
  WITH CHECK (public.can_access_student(student_id));

-- procedures
DROP POLICY IF EXISTS "procedures_admin_all" ON procedures;
CREATE POLICY "procedures_admin_all" ON procedures
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "procedures_employee" ON procedures;
CREATE POLICY "procedures_employee" ON procedures
  FOR ALL TO authenticated
  USING (public.can_access_student(student_id))
  WITH CHECK (public.can_access_student(student_id));

-- payments
DROP POLICY IF EXISTS "payments_admin_all" ON payments;
CREATE POLICY "payments_admin_all" ON payments
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "payments_employee" ON payments;
CREATE POLICY "payments_employee" ON payments
  FOR ALL TO authenticated
  USING (public.can_access_student(student_id))
  WITH CHECK (public.can_access_student(student_id));

-- leads
DROP POLICY IF EXISTS "leads_admin_all" ON leads;
CREATE POLICY "leads_admin_all" ON leads
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "leads_employee_branch" ON leads;
CREATE POLICY "leads_employee_branch" ON leads
  FOR ALL TO authenticated
  USING (public.is_active_user() AND (branch IS NULL OR public.student_in_user_branch(branch)))
  WITH CHECK (public.is_active_user() AND (branch IS NULL OR public.student_in_user_branch(branch)));

-- ====================================================================
-- PART 10: Logs — الكل يضيف، الأدمن فقط يقرأ
-- ====================================================================

-- activity_log
DROP POLICY IF EXISTS "activity_log_insert" ON activity_log;
CREATE POLICY "activity_log_insert" ON activity_log
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user());

DROP POLICY IF EXISTS "activity_log_read" ON activity_log;
CREATE POLICY "activity_log_read" ON activity_log
  FOR SELECT TO authenticated
  USING (public.is_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS "activity_log_no_update" ON activity_log;
CREATE POLICY "activity_log_no_update" ON activity_log
  FOR UPDATE TO authenticated
  USING (false);

DROP POLICY IF EXISTS "activity_log_no_delete" ON activity_log;
CREATE POLICY "activity_log_no_delete" ON activity_log
  FOR DELETE TO authenticated
  USING (false);

-- session_log
DROP POLICY IF EXISTS "session_log_insert" ON session_log;
CREATE POLICY "session_log_insert" ON session_log
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user());

DROP POLICY IF EXISTS "session_log_update_self" ON session_log;
CREATE POLICY "session_log_update_self" ON session_log
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "session_log_read" ON session_log;
CREATE POLICY "session_log_read" ON session_log
  FOR SELECT TO authenticated
  USING (public.is_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS "session_log_no_delete" ON session_log;
CREATE POLICY "session_log_no_delete" ON session_log
  FOR DELETE TO authenticated
  USING (false);

-- ====================================================================
-- PART 11: Storage Policies (Buckets)
-- شغّل ده بعد ما تنشئ الـ buckets: student-photos, student-files
-- ====================================================================

-- Photos bucket
DROP POLICY IF EXISTS "photos_read_authenticated" ON storage.objects;
CREATE POLICY "photos_read_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'student-photos');

DROP POLICY IF EXISTS "photos_insert_authenticated" ON storage.objects;
CREATE POLICY "photos_insert_authenticated" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'student-photos');

DROP POLICY IF EXISTS "photos_update_authenticated" ON storage.objects;
CREATE POLICY "photos_update_authenticated" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'student-photos');

DROP POLICY IF EXISTS "photos_delete_admin" ON storage.objects;
CREATE POLICY "photos_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'student-photos' AND public.is_admin());

-- Files bucket
DROP POLICY IF EXISTS "files_read_authenticated" ON storage.objects;
CREATE POLICY "files_read_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'student-files');

DROP POLICY IF EXISTS "files_insert_authenticated" ON storage.objects;
CREATE POLICY "files_insert_authenticated" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'student-files');

DROP POLICY IF EXISTS "files_update_authenticated" ON storage.objects;
CREATE POLICY "files_update_authenticated" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'student-files');

DROP POLICY IF EXISTS "files_delete_admin" ON storage.objects;
CREATE POLICY "files_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'student-files' AND public.is_admin());

-- ====================================================================
-- PART 12: إنشاء أول admin user
-- ====================================================================
-- بعد تشغيل السكربت، روح Supabase Dashboard → Authentication → Users
-- → Add user → Add new user (أدخل email + password)
-- بعدين شغّل الكود ده مرة واحدة علشان تخلّيه admin:

-- INSERT INTO user_profiles (id, username, full_name, role, branch)
-- SELECT id, 'admin', 'المدير', 'admin', 'الكل'
-- FROM auth.users
-- WHERE email = 'admin@andalus.local'
-- ON CONFLICT (id) DO UPDATE SET role = 'admin', branch = 'الكل';

-- ملحوظة: الإيميل أعلاه مجرد مثال، استخدم إيميلك الحقيقي
-- وأي باسورد تختاره، وسجّل دخول بيه أول مرة

-- ====================================================================
-- PART 13: منح صلاحيات
-- ====================================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ====================================================================
-- ✅ تم! دلوقتي روح للخطوة اللي بعدها: شغّل index.html
-- ====================================================================
