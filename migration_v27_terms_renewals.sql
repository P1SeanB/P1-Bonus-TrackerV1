-- P1 Bonus Tracker · migration v27 · Vista contract terms, renewals and rate changes (P1RMR-60)
-- Run once in Supabase ▸ SQL Editor. Safe to run again.
--
--   1. Vista Agreement List rows keep the contract term each revision belongs to, so a new term (renewal)
--      can be told apart from a change inside a term (rate change).
--   2. Agreements hold the current term start, and an Administrator's auto/manual switch for the current term.
--   3. Commission events can be auto-renewal increases and rate increases (Hybrid v2).

alter table public.rmr_vista_agreement_terms
  add column if not exists description text,
  add column if not exists term_start date,
  add column if not exists term_end date,
  add column if not exists term_status text,
  add column if not exists term_total_price numeric(14,2),
  add column if not exists amount_billed numeric(14,2);

alter table public.rmr_agreements
  add column if not exists term_start date,                    -- current contract term start (from Vista)
  add column if not exists renewal_type_override text,         -- 'auto' | 'manual' when an Administrator switched it
  add column if not exists renewal_override_term_start date;   -- the term the switch applies to; it lapses at the next term

do $$ begin
  if exists (select 1 from pg_constraint where conname = 'rmr_comm_events_event_type_check') then
    alter table public.rmr_comm_events drop constraint rmr_comm_events_event_type_check;
  end if;
  alter table public.rmr_comm_events add constraint rmr_comm_events_event_type_check
    check (event_type in ('new_sale','expansion','manual_renewal','sla_new','sla_renewal','win_back','auto_renewal','rate_increase'));
end $$;

-- Check: should list the six new columns and the widened event types
select 'agreement terms columns' as item, count(*)::text as value from information_schema.columns
 where table_schema='public' and table_name='rmr_vista_agreement_terms' and column_name in ('description','term_start','term_end','term_status','term_total_price','amount_billed')
union all
select 'agreement columns', count(*)::text from information_schema.columns
 where table_schema='public' and table_name='rmr_agreements' and column_name in ('term_start','renewal_type_override','renewal_override_term_start')
union all
select 'event types', pg_get_constraintdef(oid) from pg_constraint where conname='rmr_comm_events_event_type_check';
