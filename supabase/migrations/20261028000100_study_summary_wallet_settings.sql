-- Study summary wallet checkout settings and unique payment codes.
-- Prepared on a feature branch only; do not apply to the live database until reviewed.
begin;

alter table public.study_summaries
  add column if not exists payment_provider text not null default 'محفظة إلكترونية',
  add column if not exists payment_wallet_number text;

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
  check (length(btrim(payment_provider)) between 2 and 80);

alter table public.study_summaries
  drop constraint if exists study_summaries_payment_wallet_number_check;
alter table public.study_summaries
  add constraint study_summaries_payment_wallet_number_check
  check (payment_wallet_number is null or length(btrim(payment_wallet_number)) between 6 and 40);

commit;
