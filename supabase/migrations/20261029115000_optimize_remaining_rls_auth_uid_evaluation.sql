ALTER POLICY student_achievements_admin_insert ON public.student_achievements WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = (SELECT auth.uid()) AND up.role = 'admin' AND COALESCE(up.is_active, true) = true));
ALTER POLICY "expenses insert own" ON public.expenses WITH CHECK ((SELECT auth.uid()) = created_by);
