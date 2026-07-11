-- ============================================================
-- ANDALUS ACADEMY v4.1 — CRM موسّع: حملات تسويقية + متابعات Leads
-- نفّذ كل بلوك لوحده، وتجاهل أي خطأ "already exists"
-- ============================================================

-- 1) جدول الحملات التسويقية
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  channel text,                 -- فيسبوك / انستجرام / واتساب / يافطة / أخرى...
  branch text,                  -- كفر الدوار / فيكتوريا / الكل
  start_date date,
  end_date date,
  budget numeric DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE marketing_campaigns DISABLE ROW LEVEL SECURITY;

-- 2) جدول متابعات الـ Leads (سجل كل مكالمة/رسالة متابعة)
CREATE TABLE IF NOT EXISTS lead_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  note text,
  next_followup_date date,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE lead_followups DISABLE ROW LEVEL SECURITY;

-- 3) أعمدة جديدة فى leads: ربط بالحملة + تاريخ المتابعة القادمة
ALTER TABLE leads ADD COLUMN IF NOT EXISTS campaign_id uuid;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_followup_date date;

-- 4) FK بين leads.campaign_id و marketing_campaigns (بدون IF NOT EXISTS لأن Postgres مش بيدعمها فى ADD CONSTRAINT — نستخدم DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_leads_campaign'
  ) THEN
    ALTER TABLE leads
      ADD CONSTRAINT fk_leads_campaign
      FOREIGN KEY (campaign_id) REFERENCES marketing_campaigns(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5) مراحل جديدة أدق فى قيمة status (تُستخدم كنص حر، مفيش ENUM، فمفيش حاجة تتنفذ هنا،
--    بس القيم الجديدة المتاحة من الواجهة: 'جديد' → 'تم التواصل' → 'مهتم' → 'تم تحديد موعد' → 'تحول لطالب' / 'ملغي'

-- 6) إعادة تحميل schema cache فى PostgREST
NOTIFY pgrst, 'reload schema';
