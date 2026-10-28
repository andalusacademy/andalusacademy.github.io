-- Wallet and product-filter settings for the existing study-summary catalog.
begin;
alter table public.study_summaries
  add column if not exists payment_provider text,
  add column if not exists payment_wallet_number text,
  add column if not exists enabled_question_types jsonb not null default '["mcq","true_false","essay"]'::jsonb;
alter table public.study_summary_orders
  add column if not exists payment_reference text,
  add column if not exists order_code text;
create unique index if not exists study_summary_orders_order_code_unique
  on public.study_summary_orders (order_code)
  where order_code is not null and btrim(order_code) <> '';
alter table public.study_summaries
  drop constraint if exists study_summaries_payment_provider_check;
alter table public.study_summaries
  add constraint study_summaries_payment_provider_check
  check (payment_provider is null or length(btrim(payment_provider)) between 2 and 80);
alter table public.study_summaries
  drop constraint if exists study_summaries_payment_wallet_number_check;
alter table public.study_summaries
  add constraint study_summaries_payment_wallet_number_check
  check (payment_wallet_number is null or length(btrim(payment_wallet_number)) between 6 and 40);
alter table public.study_summaries
  drop constraint if exists study_summaries_enabled_question_types_check;
alter table public.study_summaries
  add constraint study_summaries_enabled_question_types_check
  check (jsonb_typeof(enabled_question_types)='array' and enabled_question_types <@ '["mcq","true_false","essay"]'::jsonb);
commit;
