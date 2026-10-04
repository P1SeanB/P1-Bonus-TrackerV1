-- P1 Bonus Tracker · migration v24 · Layout B payouts, rep questions, file uploads
-- Run once in Supabase ▸ SQL Editor. Safe to run again.

-- 1. Payout runs carry the signed approval packet and the paid-and-locked state
alter table public.rmr_payout_runs add column if not exists packet_no text;
alter table public.rmr_payout_runs add column if not exists packet jsonb;           -- the exact lines the Executive signed
alter table public.rmr_payout_runs add column if not exists signed_on date;
alter table public.rmr_payout_runs add column if not exists signed_scan_path text;  -- storage path of the signed scan
alter table public.rmr_payout_runs add column if not exists recorded_by text;
alter table public.rmr_payout_runs add column if not exists paid_date date;
alter table public.rmr_payout_runs add column if not exists paid_by text;
alter table public.rmr_payout_runs add column if not exists locked_at timestamptz;

-- finance roles may update a run only to mark it paid; once locked it can never change
create or replace function public.rmr_payout_run_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'Payout runs cannot be deleted.'; end if;
  if old.locked_at is not null then raise exception 'This payout is paid and locked. Record a correction in a later payout.'; end if;
  if new.year <> old.year or new.quarter <> old.quarter or new.ready_cents <> old.ready_cents
     or new.approved_by <> old.approved_by or coalesce(new.packet_no,'') <> coalesce(old.packet_no,'')
     or coalesce(new.packet::text,'') <> coalesce(old.packet::text,'') or coalesce(new.signed_scan_path,'') <> coalesce(old.signed_scan_path,'') then
    raise exception 'An approved payout cannot be edited — only marked paid.';
  end if;
  return new;
end $$;
drop trigger if exists trg_payout_run_guard on public.rmr_payout_runs;
create trigger trg_payout_run_guard before update or delete on public.rmr_payout_runs for each row execute function public.rmr_payout_run_guard();

do $$ begin
  if not exists (select 1 from pg_policies where tablename='rmr_payout_runs' and policyname='payout finance update') then
    create policy "payout finance update" on public.rmr_payout_runs for update to authenticated using (public.rmr_is_finance()) with check (public.rmr_is_finance()); end if;
  if not exists (select 1 from pg_policies where tablename='rmr_payout_runs' and policyname='v23 scope update') then
    create policy "v23 scope update" on public.rmr_payout_runs as restrictive for update to authenticated using (public.rmr_sees_all()) with check (public.rmr_sees_all()); end if;
end $$;

-- 2. Reps can question a payment from My pay; the answer shows on their screen
alter table public.rmr_worklist drop constraint if exists rmr_worklist_type_check;
alter table public.rmr_worklist add constraint rmr_worklist_type_check check (type in ('unmatched_vista','import_exception','cost_classification',
  'cost_variance','cost_unverified','recipient_unresolved','migration_exception','overdue_feed','plan_ack_missing','deal_won','sale_unrecorded','rep_question'));

-- 3. Uploads: signed contracts (reps, on Mark won) and signed approval scans (finance) go to the opportunity-files bucket
insert into storage.buckets (id, name, public) values ('opportunity-files','opportunity-files', false) on conflict (id) do nothing;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='v24 members upload files') then
    create policy "v24 members upload files" on storage.objects for insert to authenticated
      with check (bucket_id='opportunity-files' and public.rmr_is_member() and (name not like 'payouts/%' or public.rmr_is_finance())); end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='v24 members read files') then
    create policy "v24 members read files" on storage.objects for select to authenticated
      using (bucket_id='opportunity-files' and public.rmr_is_member() and (name not like 'payouts/%' or public.rmr_sees_all())); end if;
end $$;

-- the attachment record for a signed contract: anyone may attach to an agreement they can see (reps: only their own)
do $$ begin
  if to_regclass('public.rmr_attachments') is not null and not exists (select 1 from pg_policies where tablename='rmr_attachments' and policyname='v24 attach to visible agreement') then
    create policy "v24 attach to visible agreement" on public.rmr_attachments for insert to authenticated
      with check (exists (select 1 from public.rmr_agreements a where a.id = agreement_id)); end if;
end $$;

-- 4. Check: should list the new columns and policies
select column_name from information_schema.columns where table_schema='public' and table_name='rmr_payout_runs' order by ordinal_position;
