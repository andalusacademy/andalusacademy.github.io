-- ============================================================
-- ANDALUS ACADEMY v5.0 — إعادة ضبط كاملة للسؤال اليومي + الميعاد بقى 8:30 مساءً
-- نفّذ كل بلوك لوحده بالترتيب فى Supabase SQL Editor، وابعتلي نتيجة القسم رقم 1 (التشخيص) مهما حصل
-- ============================================================

-- 1) تشخيص الحالة الحالية (مهم أوي نشوف نتيجته الأول)
SELECT
  (SELECT COUNT(*) FROM daily_quiz_questions) AS عدد_الأسئلة,
  (SELECT COUNT(*) FROM daily_quiz_schedule) AS عدد_الأيام_المفعّلة,
  (SELECT COUNT(*) FROM daily_quiz_answers) AS عدد_إجابات_الطلاب;

SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname LIKE 'andalus-daily-quiz%';

SELECT jr.status, jr.return_message, jr.start_time
FROM cron.job_run_details jr
JOIN cron.job j ON j.jobid = jr.jobid
WHERE j.jobname LIKE 'andalus-daily-quiz%'
ORDER BY jr.start_time DESC LIMIT 10;

-- 2) نسخة احتياطية لإجابات الطلاب فقط (البيانات المهمة الوحيدة) — اسم فيه توقيت عشان
--    السطر ده يبقى آمن تعيده تاني أي وقت من غير ما يتعارض مع نسخة سابقة
DO $$
DECLARE
  backup_name text := 'daily_quiz_answers_backup_' || to_char(now(), 'YYYYMMDD_HH24MISS');
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_quiz_answers') THEN
    EXECUTE format('ALTER TABLE daily_quiz_answers RENAME TO %I', backup_name);
  END IF;
END $$;

-- 3) امسح كل حاجة تانية (أسئلة، جدولة، والدالة) ونبنيها نضيفة تمامًا
DROP TABLE IF EXISTS daily_quiz_schedule CASCADE;
DROP TABLE IF EXISTS daily_quiz_questions CASCADE;
DROP FUNCTION IF EXISTS activate_daily_quiz();

CREATE TABLE daily_quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  option_a text NOT NULL,
  option_b text NOT NULL,
  option_c text NOT NULL,
  option_d text NOT NULL,
  correct_option text NOT NULL CHECK (correct_option IN ('a','b','c','d')),
  category text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE daily_quiz_questions DISABLE ROW LEVEL SECURITY;

CREATE TABLE daily_quiz_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_date date UNIQUE NOT NULL,
  question_id uuid,
  activated_at timestamptz DEFAULT now()
);
ALTER TABLE daily_quiz_schedule DISABLE ROW LEVEL SECURITY;

CREATE TABLE daily_quiz_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_date date NOT NULL,
  student_id text NOT NULL,
  student_name text,
  selected_option text,
  is_correct boolean,
  response_seconds numeric,
  answered_at timestamptz DEFAULT now(),
  UNIQUE(quiz_date, student_id)
);
ALTER TABLE daily_quiz_answers DISABLE ROW LEVEL SECURITY;

-- 4) دالة التفعيل (نفسها بالظبط، الوقت مش جواها — الوقت بيتحدد فى الكرون بس)
CREATE OR REPLACE FUNCTION activate_daily_quiz()
RETURNS void AS $$
DECLARE
  picked_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM daily_quiz_schedule WHERE quiz_date = CURRENT_DATE) THEN
    RETURN;
  END IF;

  SELECT id INTO picked_id FROM daily_quiz_questions
  WHERE active = true
    AND id NOT IN (
      SELECT question_id FROM daily_quiz_schedule
      WHERE quiz_date >= CURRENT_DATE - INTERVAL '30 days' AND question_id IS NOT NULL
    )
  ORDER BY random() LIMIT 1;

  IF picked_id IS NULL THEN
    SELECT id INTO picked_id FROM daily_quiz_questions WHERE active = true ORDER BY random() LIMIT 1;
  END IF;

  IF picked_id IS NOT NULL THEN
    INSERT INTO daily_quiz_schedule (quiz_date, question_id, activated_at)
    VALUES (CURRENT_DATE, picked_id, now());
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION activate_daily_quiz() TO anon, authenticated;

-- 5) امسح أي مهام كرون قديمة خاصة بالسؤال اليومي (بكل أسمائها اللي جربناها) وسجّل مهمة واحدة نضيفة
--    الساعة 8:30 مساءً بتوقيت مصر (UTC+2) = 18:30 UTC
DO $$
DECLARE
  j record;
BEGIN
  FOR j IN SELECT jobid FROM cron.job WHERE jobname LIKE 'andalus-daily-quiz%' LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule('andalus-daily-quiz-830pm', '30 18 * * *', $$SELECT activate_daily_quiz();$$);

-- 6) بنك الأسئلة (نفس الـ50 سؤال: 30 تمريض + 20 متنوع)
INSERT INTO daily_quiz_questions (question, option_a, option_b, option_c, option_d, correct_option, category) VALUES
('كام عدد ضربات القلب الطبيعية للإنسان البالغ فى الدقيقة؟', '40-60', '60-100', '110-140', '150-180', 'b', 'تمريض'),
('الجهاز المسؤول عن ضخ الدم فى الجسم هو؟', 'الكبد', 'القلب', 'الطحال', 'المعدة', 'b', 'تمريض'),
('درجة حرارة جسم الإنسان الطبيعية تقريبًا؟', '35 درجة', '37 درجة', '39 درجة', '41 درجة', 'b', 'تمريض'),
('أنبوب يُستخدم لسحب الدم أو إعطاء المحاليل يسمى؟', 'الكانيولا', 'الاستيتوسكوب', 'الثيرمومتر', 'الجبيرة', 'a', 'تمريض'),
('الجهاز المستخدم لقياس ضغط الدم يسمى؟', 'الأوتوسكوب', 'السفيجمومانومتر', 'الأوتوكلاف', 'المنظار', 'b', 'تمريض'),
('أول إجراء فى حالات النزيف الشديد هو؟', 'إعطاء الطعام', 'الضغط المباشر على الجرح', 'تحريك المصاب كتير', 'الانتظار فقط', 'b', 'تمريض'),
('الخلايا المسؤولة عن نقل الأكسجين فى الدم هى؟', 'الصفائح الدموية', 'كرات الدم البيضاء', 'كرات الدم الحمراء', 'البلازما', 'c', 'تمريض'),
('غسيل اليدين قبل أي إجراء تمريضي يهدف بالأساس إلى؟', 'توفير الوقت', 'منع انتقال العدوى', 'تبريد اليد', 'لا فائدة منه', 'b', 'تمريض'),
('ضغط الدم الطبيعي التقريبي للشخص البالغ هو؟', '90/60', '120/80', '160/100', '200/120', 'b', 'تمريض'),
('الجهاز التنفسي يبدأ من الأنف وينتهي فى؟', 'المعدة', 'الرئتين', 'الكبد', 'الكلى', 'b', 'تمريض'),
('عدد عظام جسم الإنسان البالغ تقريبًا؟', '106', '156', '206', '256', 'c', 'تمريض'),
('الهرمون المسؤول عن تنظيم مستوى السكر فى الدم هو؟', 'الأدرينالين', 'الإنسولين', 'الثيروكسين', 'الكورتيزول', 'b', 'تمريض'),
('الوضع الصحيح لمريض مصاب بصعوبة تنفس غالبًا يكون؟', 'مستلقي تمامًا', 'نصف جالس', 'على بطنه', 'مقلوب رأسًا لأسفل', 'b', 'تمريض'),
('أداة تُستخدم للاستماع لأصوات القلب والرئة تسمى؟', 'الأوتوسكوب', 'الاستيتوسكوب', 'المنظار الداخلي', 'الميزان الطبي', 'b', 'تمريض'),
('من علامات الحياة الأساسية (Vital Signs)؟', 'الطول والوزن', 'النبض والتنفس والحرارة والضغط', 'لون الشعر', 'فصيلة الدم فقط', 'b', 'تمريض'),
('الجهاز المسؤول عن تنقية الدم من الفضلات هو؟', 'الكلى', 'المعدة', 'الطحال', 'البنكرياس', 'a', 'تمريض'),
('عدد فصائل الدم الأساسية المعروفة هى؟', '2', '4', '8', '12', 'b', 'تمريض'),
('التطعيم يعمل على؟', 'علاج المرض بعد حدوثه فقط', 'تقوية مناعة الجسم ضد مرض معين', 'زيادة الوزن', 'خفض الحرارة فقط', 'b', 'تمريض'),
('من طرق قياس درجة الحرارة؟', 'من تحت الإبط أو الفم أو الأذن', 'من الأظافر فقط', 'من الشعر', 'لا توجد طريقة دقيقة', 'a', 'تمريض'),
('الإسعاف الأولي لحالة حرق بسيط يكون بـ؟', 'وضع معجون أسنان', 'تبريد المنطقة بماء جاري بارد', 'وضع زيت ساخن', 'تجاهل الحرق', 'b', 'تمريض'),
('العضو المسؤول عن إفراز الصفراء لهضم الدهون هو؟', 'الكبد', 'الطحال', 'المرارة فقط بدون الكبد', 'المعدة', 'a', 'تمريض'),
('حقنة تُعطى تحت الجلد مباشرة تسمى؟', 'وريدية', 'عضلية', 'تحت الجلد (Subcutaneous)', 'شرجية', 'c', 'تمريض'),
('من أهم أسباب انتقال العدوى فى المستشفيات؟', 'التهوية الجيدة', 'عدم غسل اليدين', 'ارتداء القفازات', 'التعقيم المستمر', 'b', 'تمريض'),
('الجهاز العصبي المركزي يتكون من؟', 'المخ والحبل الشوكي', 'القلب والرئتين', 'المعدة والأمعاء', 'الكلى والمثانة', 'a', 'تمريض'),
('معدل التنفس الطبيعي للبالغ فى الدقيقة تقريبًا؟', '4-8', '12-20', '30-40', '50-60', 'b', 'تمريض'),
('مرض السكري يرتبط أساسًا بخلل فى إفراز؟', 'الإنسولين', 'الأدرينالين', 'فيتامين د', 'الكالسيوم', 'a', 'تمريض'),
('من علامات الجفاف عند المريض؟', 'كثرة التبول الصافي', 'جفاف الفم والعطش الشديد', 'زيادة الوزن المفاجئة', 'احمرار العينين فقط', 'b', 'تمريض'),
('الأوتوكلاف فى المجال الطبي يُستخدم من أجل؟', 'تسخين الطعام', 'تعقيم الأدوات الطبية بالبخار', 'قياس الضغط', 'حفظ الأدوية', 'b', 'تمريض'),
('غيبوبة السكر (نقص السكر الحاد) من أعراضها؟', 'الشعور بالجوع الشديد والتعرق والارتجاف', 'زيادة النشاط والحيوية', 'تحسن فورى فى النظر', 'ارتفاع الحرارة فقط', 'a', 'تمريض'),
('من مهام الممرض/الممرضة الأساسية تجاه المريض؟', 'وصف الجرعة الدوائية بنفسه بدون طبيب', 'متابعة العلامات الحيوية وتنفيذ خطة الرعاية', 'إجراء العمليات الجراحية', 'تشخيص المرض النهائي', 'b', 'تمريض'),
('كام عدد لاعبي فريق كرة القدم الأساسي فى الملعب؟', '9', '10', '11', '12', 'c', 'رياضة'),
('البطولة الأشهر لكرة القدم بين المنتخبات كل 4 سنين اسمها؟', 'كأس العالم', 'دوري أبطال أوروبا', 'كأس السوبر', 'كأس الأمم', 'a', 'رياضة'),
('مصر فازت بكأس الأمم الأفريقية كام مرة (حتى وقت قريب)؟', '3 مرات', '5 مرات', '7 مرات', 'مرة واحدة', 'c', 'رياضة'),
('لعبة "الشطرنج" بتُلعب على رقعة مكوّنة من كام مربع؟', '32', '48', '64', '100', 'c', 'رياضة'),
('الرياضة اللي بيُستخدم فيها مضرب وكورة ريشة تسمى؟', 'التنس الأرضي', 'البادمنتون', 'الاسكواش', 'الجولف', 'b', 'رياضة'),
('عدد اللاعبين فى فريق كرة السلة داخل الملعب؟', '5', '6', '7', '9', 'a', 'رياضة'),
('من أشهر الرسامين اللي رسم لوحة "الموناليزا"؟', 'بابلو بيكاسو', 'ليوناردو دافنشي', 'فان جوخ', 'مايكل أنجلو', 'b', 'فن'),
('الآلة الموسيقية المعروفة بـ"ملكة الآلات" هى؟', 'الجيتار', 'البيانو', 'الكمان', 'الطبلة', 'b', 'فن'),
('هرم خوفو موجود فى؟', 'الأقصر', 'أسوان', 'الجيزة', 'الإسكندرية', 'c', 'ثقافة عامة'),
('نهر النيل يُعتبر من؟', 'أقصر أنهار العالم', 'أطول أنهار العالم', 'أنهار غير مصرية', 'بحيرات مصر', 'b', 'ثقافة عامة'),
('عاصمة جمهورية مصر العربية هى؟', 'الإسكندرية', 'القاهرة', 'الجيزة', 'أسوان', 'b', 'ثقافة عامة'),
('كام قارة فى العالم؟', '5', '6', '7', '8', 'c', 'ثقافة عامة'),
('اللغة الرسمية فى مصر هى؟', 'الإنجليزية', 'الفرنسية', 'العربية', 'التركية', 'c', 'ثقافة عامة'),
('من مؤلف رواية "الحرافيش"؟', 'نجيب محفوظ', 'طه حسين', 'توفيق الحكيم', 'يوسف إدريس', 'a', 'فن'),
('أشهر أنواع الرقص المصري الشعبي هو؟', 'الباليه', 'الرقص الشرقي', 'التانجو', 'السامبا', 'b', 'فن'),
('كام عدد أيام السنة الميلادية العادية (غير الكبيسة)؟', '360', '364', '365', '366', 'c', 'ثقافة عامة'),
('أكبر محيط فى العالم من حيث المساحة هو؟', 'المحيط الأطلسي', 'المحيط الهندي', 'المحيط الهادي', 'المحيط المتجمد الشمالي', 'c', 'ثقافة عامة'),
('رياضة "السباحة" تعتمد بشكل أساسي على؟', 'الجري السريع', 'التنفس والتحكم فى حركة الجسم بالماء', 'رفع الأثقال فقط', 'ركوب الخيل', 'b', 'رياضة'),
('من ألوان قوس قزح؟', 'الأحمر والأصفر والأزرق من ضمن ألوانه', 'الأبيض فقط', 'الأسود فقط', 'لونين فقط', 'a', 'ثقافة عامة'),
('محمد صلاح لاعب كرة قدم مصري معروف فى مركز؟', 'حراسة المرمى', 'الهجوم', 'الدفاع فقط', 'حكم مباريات', 'b', 'رياضة');

-- 7) فعّل سؤال النهاردة فورًا (اختبار مباشر — مش لازم تستنى الساعة 8:30)
SELECT activate_daily_quiz();

-- 8) تأكيد نهائي: شوف النتيجة دي وابعتهالي
SELECT s.quiz_date, q.question, q.category, s.activated_at
FROM daily_quiz_schedule s JOIN daily_quiz_questions q ON q.id = s.question_id
ORDER BY s.quiz_date DESC;

SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'andalus-daily-quiz-830pm';
