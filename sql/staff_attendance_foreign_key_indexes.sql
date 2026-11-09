-- Cover staff attendance foreign keys to keep admin reports and exception reviews efficient.
create index if not exists staff_attendance_events_session_idx
  on public.staff_attendance_events(session_id);
create index if not exists staff_attendance_exceptions_session_idx
  on public.staff_attendance_exceptions(session_id);
create index if not exists staff_attendance_exceptions_reviewed_by_idx
  on public.staff_attendance_exceptions(reviewed_by);
create index if not exists staff_attendance_settings_updated_by_idx
  on public.staff_attendance_settings(updated_by);
create index if not exists staff_attendance_shifts_created_by_idx
  on public.staff_attendance_shifts(created_by);
