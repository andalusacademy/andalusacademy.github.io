-- ============================================================
-- السؤال اليومي — إصلاح التفعيل والتوقيت بتوقيت مصر
-- مهم: لا يحذف أسئلة أو إجابات الطلاب.
-- نفّذ الملف كاملًا في Supabase SQL Editor.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- الدالة الحالية ترجع void، لذلك يجب حذفها أولًا قبل إعادة تعريفها
-- إذا كانت نسخة سابقة لها نفس الاسم موجودة في قاعدة البيانات.
DROP FUNCTION IF EXISTS public.activate_daily_quiz();

CREATE OR REPLACE FUNCTION public.activate_daily_quiz()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  picked_id uuid;
  egypt_today date;
BEGIN
  -- التاريخ الرسمي للمسابقة هو تاريخ مصر، وليس تاريخ UTC.
  egypt_today := (now() AT TIME ZONE 'Africa/Cairo')::date;

  -- لا ننشئ سؤالًا ثانيًا لنفس اليوم.
  IF EXISTS (
    SELECT 1
    FROM public.daily_quiz_schedule
    WHERE quiz_date = egypt_today
  ) THEN
    RETURN;
  END IF;

  -- اختر سؤالًا نشطًا لم يُستخدم خلال آخر 30 يومًا.
  SELECT id INTO picked_id
  FROM public.daily_quiz_questions
  WHERE active = true
    AND id NOT IN (
      SELECT question_id
      FROM public.daily_quiz_schedule
      WHERE quiz_date >= egypt_today - INTERVAL '30 days'
        AND question_id IS NOT NULL
    )
  ORDER BY random()
  LIMIT 1;

  -- لو انتهت الأسئلة غير المستخدمة، اختر أي سؤال نشط.
  IF picked_id IS NULL THEN
    SELECT id INTO picked_id
    FROM public.daily_quiz_questions
    WHERE active = true
    ORDER BY random()
    LIMIT 1;
  END IF;

  IF picked_id IS NOT NULL THEN
    INSERT INTO public.daily_quiz_schedule (quiz_date, question_id, activated_at)
    VALUES (egypt_today, picked_id, now());
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_daily_quiz() TO anon, authenticated;

-- احذف أي وظائف كرون قديمة خاصة بالسؤال اليومي.
DO $$
DECLARE
  j record;
BEGIN
  FOR j IN
    SELECT jobid
    FROM cron.job
    WHERE jobname LIKE 'andalus-daily-quiz%'
  LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;

-- نشغّل الفحص كل دقيقة، والدالة نفسها تستخدم توقيت مصر.
-- بهذه الطريقة يظل 8:30 مساءً صحيحًا حتى عند تغيير التوقيت الصيفي/الشتوي.
SELECT cron.schedule(
  'andalus-daily-quiz-830pm',
  '* * * * *',
  $$SELECT public.activate_daily_quiz();$$
);

-- اختبار يدوي آمن: لو سؤال اليوم موجود بالفعل فلن ينشئ سؤالًا ثانيًا.
SELECT public.activate_daily_quiz();

-- تحقق من الوضع الحالي.
SELECT
  (now() AT TIME ZONE 'Africa/Cairo')::date AS egypt_date,
  now() AT TIME ZONE 'Africa/Cairo' AS egypt_now,
  s.question_id,
  s.activated_at,
  q.question
FROM public.daily_quiz_schedule s
LEFT JOIN public.daily_quiz_questions q ON q.id = s.question_id
WHERE s.quiz_date = (now() AT TIME ZONE 'Africa/Cairo')::date;

-- تحقق من مهمة الكرون.
SELECT jobid, jobname, schedule, active, command
FROM cron.job
WHERE jobname = 'andalus-daily-quiz-830pm';
