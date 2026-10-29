-- Fix: allow the event emitted when an administrator grants summary access.
-- Preserve the existing allowed event types and add only access_granted.
ALTER TABLE public.study_summary_activity
DROP CONSTRAINT study_summary_activity_event_type_check;

ALTER TABLE public.study_summary_activity
ADD CONSTRAINT study_summary_activity_event_type_check
CHECK (
  event_type = ANY (
    ARRAY[
      'list'::text,
      'open'::text,
      'question'::text,
      'order_created'::text,
      'access_denied'::text,
      'payment_reference_submitted'::text,
      'access_granted'::text
    ]
  )
);
