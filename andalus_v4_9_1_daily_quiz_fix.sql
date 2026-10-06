-- ============================================================
-- ANDALUS ACADEMY v4.9.1 — تشخيص وإصلاح السؤال اليومي (اللي مكانش بيتفعل)
-- نفّذ كل بلوك لوحده بالترتيب فى Supabase SQL Editor
-- ============================================================

-- 1) تشخيص: هل المهمة (cron job) مسجّلة أصلاً وشغّالة؟
SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'andalus-daily-quiz-7pm';

-- 2) تشخيص: هل اتنفذت فعلاً فى أي وقت، وإيه نتيجتها؟ (لو النتيجة فاضية يبقى دي المشكلة —
--    المهمة اتسجّلت بس السيرفر نفسه ما شغّلهاش خالص)
SELECT status, return_message, start_time
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'andalus-daily-quiz-7pm')
ORDER BY start_time DESC LIMIT 10;

-- 3) تعويض الأيام اللي فاتت (الخميس + الجمعة + النهاردة السبت) بأسئلة عشوائية مختلفة
--    من غير ما يكرر أي سؤال اتحط قبل كده، ومن غير ما يلمس أي يوم متسجل بيانات فيه بالفعل
DO $$
DECLARE
  d date;
  picked_id uuid;
BEGIN
  FOREACH d IN ARRAY ARRAY['2026-09-10'::date, '2026-09-11'::date, '2026-09-12'::date]
  LOOP
    IF NOT EXISTS (SELECT 1 FROM daily_quiz_schedule WHERE quiz_date = d) THEN
      SELECT id INTO picked_id FROM daily_quiz_questions
      WHERE active = true
        AND id NOT IN (SELECT question_id FROM daily_quiz_schedule WHERE question_id IS NOT NULL)
      ORDER BY random() LIMIT 1;

      IF picked_id IS NULL THEN
        SELECT id INTO picked_id FROM daily_quiz_questions WHERE active = true ORDER BY random() LIMIT 1;
      END IF;

      IF picked_id IS NOT NULL THEN
        INSERT INTO daily_quiz_schedule (quiz_date, question_id, activated_at) VALUES (d, picked_id, now());
      END IF;
    END IF;
  END LOOP;
END $$;

-- تأكيد إن الأيام التلاتة بقت موجودة دلوقتي
SELECT * FROM daily_quiz_schedule WHERE quiz_date IN ('2026-09-10','2026-09-11','2026-09-12') ORDER BY quiz_date;

-- 4) إعادة تسجيل الجدولة من الصفر احتياطًا (تحسّبًا لأي خلل فى التسجيل الأول)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'andalus-daily-quiz-7pm') THEN
    PERFORM cron.unschedule('andalus-daily-quiz-7pm');
  END IF;
END $$;

SELECT cron.schedule('andalus-daily-quiz-7pm', '0 17 * * *', $$SELECT activate_daily_quiz();$$);

-- 5) بعد بكرة الساعة 7 مساءً، رجّع نفّذ استعلام رقم (2) تاني وابعتلي النتيجة
--    عشان نتأكد إن المهمة فعلاً بقت شغّالة على السيرفر مش بس مسجّلة
