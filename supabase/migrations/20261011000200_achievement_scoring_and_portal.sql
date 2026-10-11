-- Andalus Academy: achievement scoring, admin-only management, and student portal read.
alter table public.student_achievements
  add column if not exists points integer not null default 0,
  add column if not exists activity_points integer not null default 0;

alter table public.student_achievements
  drop constraint if exists student_achievements_points_nonnegative;
alter table public.student_achievements
  add constraint student_achievements_points_nonnegative
  check (points >= 0 and activity_points >= 0);

-- Authenticated administrators manage records; public/anonymous clients cannot write directly.
drop policy if exists student_achievements_admin_select on public.student_achievements;
drop policy if exists student_achievements_admin_insert on public.student_achievements;
drop policy if exists student_achievements_admin_update on public.student_achievements;
drop policy if exists student_achievements_admin_delete on public.student_achievements;

create policy student_achievements_admin_select
on public.student_achievements for select to authenticated
using (exists (
  select 1 from public.user_profiles up
  where up.id = auth.uid() and up.role = 'admin' and coalesce(up.is_active, true) = true
));

create policy student_achievements_admin_insert
on public.student_achievements for insert to authenticated
with check (exists (
  select 1 from public.user_profiles up
  where up.id = auth.uid() and up.role = 'admin' and coalesce(up.is_active, true) = true
));

create policy student_achievements_admin_update
on public.student_achievements for update to authenticated
using (exists (
  select 1 from public.user_profiles up
  where up.id = auth.uid() and up.role = 'admin' and coalesce(up.is_active, true) = true
))
with check (exists (
  select 1 from public.user_profiles up
  where up.id = auth.uid() and up.role = 'admin' and coalesce(up.is_active, true) = true
));

create policy student_achievements_admin_delete
on public.student_achievements for delete to authenticated
using (exists (
  select 1 from public.user_profiles up
  where up.id = auth.uid() and up.role = 'admin' and coalesce(up.is_active, true) = true
));

grant select, insert, update, delete on public.student_achievements to authenticated;

create or replace function public.student_portal_get_achievements(p_student_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_student_id is null or btrim(p_student_id) = '' then
    return '[]'::jsonb;
  end if;

  if not exists (select 1 from public.students s where s.id = p_student_id) then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id,
      'achievement_type', a.achievement_type,
      'title', a.title,
      'description', a.description,
      'achievement_date', a.achievement_date,
      'points', a.points,
      'activity_points', a.activity_points
    ) order by a.achievement_date desc, a.created_at desc)
    from public.student_achievements a
    where a.student_id = p_student_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.student_portal_get_achievements(text) from public;
grant execute on function public.student_portal_get_achievements(text) to anon, authenticated;
notify pgrst, 'reload schema';
