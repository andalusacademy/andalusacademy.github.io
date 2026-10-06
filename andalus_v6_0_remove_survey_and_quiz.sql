-- ============================================================
-- ANDALUS ACADEMY v6.0 — إزالة كاملة من قاعدة البيانات لاستبيان رضا
-- الطلاب والسؤال اليومي (تمهيدًا لنظام مسابقة جديد)
-- نفّذ كل بلوك لوحده فى Supabase SQL Editor
-- ============================================================

-- 1) إيقاف وحذف كل مهام الجدولة (cron) الخاصة بالسؤال اليومي — أي اسم جربناه
DO $$
DECLARE j record;
BEGIN
  FOR j IN SELECT jobid FROM cron.job WHERE jobname LIKE 'andalus-daily-quiz%' LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;

-- 2) حذف دالة تفعيل السؤال اليومي
DROP FUNCTION IF EXISTS activate_daily_quiz();

-- 3) حذف كل جداول السؤال اليومي (الحالية والنسخ الاحتياطية اللي اتعملت أثناء المحاولات السابقة)
DROP TABLE IF EXISTS daily_quiz_answers CASCADE;
DROP TABLE IF EXISTS daily_quiz_schedule CASCADE;
DROP TABLE IF EXISTS daily_quiz_questions CASCADE;
DROP TABLE IF EXISTS daily_quiz_questions_old_backup CASCADE;
DROP TABLE IF EXISTS daily_quiz_schedule_old_backup CASCADE;
DROP TABLE IF EXISTS daily_quiz_answers_old_backup CASCADE;

-- حذف أي نسخ احتياطية بتوقيت (اللي اتعملت فى إعادة الضبط v5.0) أيًا كان اسمها
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'daily_quiz_answers_backup_%' LOOP
    EXECUTE format('DROP TABLE IF EXISTS %I CASCADE', t.table_name);
  END LOOP;
END $$;

-- 4) حذف جدول استبيان رضا الطلاب بالكامل
DROP TABLE IF EXISTS satisfaction_surveys CASCADE;

-- 5) تأكيد نهائي: الاستعلام ده المفروض يطلع فاضي تمامًا (0 صفوف) لو كل حاجة اتمسحت صح
SELECT table_name FROM information_schema.tables
WHERE table_name LIKE 'daily_quiz%' OR table_name LIKE 'satisfaction_survey%';

SELECT jobname FROM cron.job WHERE jobname LIKE 'andalus-daily-quiz%';

NOTIFY pgrst, 'reload schema';
