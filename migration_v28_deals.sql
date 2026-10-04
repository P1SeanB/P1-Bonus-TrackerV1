-- P1 Bonus Tracker · migration v28 · Deals, Customers and the hunt list (P1RMR-62)
-- Run once in Supabase ▸ SQL Editor. Safe to run again.
--
--   1. Deals carry a Source, so lost-reason and win/loss reporting has something to group on.
--   2. Lost deals keep a coded reason and an optional revisit date (the hunt list).
--   3. Cancelled accounts keep a cancellation reason.
--   4. stage_dates records the day a deal entered each stage (quoted, lost) — win/loss and
--      days-to-close reporting is reliable from the day this ships.

alter table public.rmr_agreements
  add column if not exists source text,                 -- referral | existing | hunter | inbound | vista | other
  add column if not exists lost_reason_code text,       -- price | competitor | timing | no_response | scope | other
  add column if not exists revisit_date date,           -- the deal returns to Deals as an opportunity on this day
  add column if not exists cancel_reason text,          -- why a sold account ended, for churn reporting
  add column if not exists stage_dates jsonb not null default '{}'::jsonb;

-- Check: should return 5
select count(*)::text as new_columns from information_schema.columns
 where table_schema='public' and table_name='rmr_agreements'
   and column_name in ('source','lost_reason_code','revisit_date','cancel_reason','stage_dates');
