-- P1 Bonus Tracker · migration v25 · Administrator can revert one payout step, with a permanent record
-- Run once in Supabase ▸ SQL Editor (after v24). Safe to run again.
--
--   Paid & locked  → back to Approved        (removes the "paid" lines; payroll date cleared)
--   Approved       → back to Print packet    (removes the approval, its payable lines and the run)
--
-- Every revert is written to rmr_payout_reversals with the reason, who did it, and a copy of everything removed.
-- Only an Administrator can run it; locked payouts stay locked for everyone else.

create table if not exists public.rmr_payout_reversals (
  id bigserial primary key,
  run_id bigint not null,
  year integer, quarter integer,
  step text not null check (step in ('unlock_paid','undo_approval')),
  reason text not null,
  reverted_by text not null,
  reverted_at timestamptz not null default now(),
  run_snapshot jsonb,          -- the payout run exactly as it was
  removed_entries jsonb        -- every ledger line removed
);
alter table public.rmr_payout_reversals enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='rmr_payout_reversals' and policyname='reversals read') then
    create policy "reversals read" on public.rmr_payout_reversals for select to authenticated using (public.rmr_sees_all()); end if;
end $$;
drop trigger if exists trg_reversals_ro on public.rmr_payout_reversals;
create trigger trg_reversals_ro before update or delete on public.rmr_payout_reversals for each row execute function public.rmr_forbid_mutation();

create or replace function public.rmr_revert_payout_step(p_run bigint, p_reason text) returns text
language plpgsql security definer set search_path = public as $$
declare
  r public.rmr_payout_runs;
  removed jsonb;
  it jsonb;
  me text := coalesce(public.rmr_my_email(), 'unknown');
  result text;
begin
  if not public.rmr_is_admin() then raise exception 'Only an Administrator can revert a payout step.'; end if;
  if coalesce(length(trim(p_reason)), 0) < 10 then raise exception 'Give the reason (at least 10 characters).'; end if;
  select * into r from public.rmr_payout_runs where id = p_run for update;
  if not found then raise exception 'Payout run % not found.', p_run; end if;

  alter table public.rmr_ledger_entries disable trigger trg_ledger_ro;
  alter table public.rmr_payout_runs disable trigger trg_payout_run_guard;

  if r.locked_at is not null then
    -- Paid & locked → Approved
    select coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb) into removed
      from public.rmr_ledger_entries l where l.payout_run_id = p_run and l.stage = 'paid';
    delete from public.rmr_ledger_entries where payout_run_id = p_run and stage = 'paid';
    update public.rmr_payout_runs set paid_date = null, paid_by = null, locked_at = null where id = p_run;
    -- older-plan lines carry their paid flag on the agreement
    for it in select * from jsonb_array_elements(coalesce(r.packet->'items', '[]'::jsonb)) loop
      if coalesce(it->>'piece','') !~ '^Payment [0-9] of 2$' and coalesce(it->>'piece','') <> 'Adjustment' then
        update public.rmr_agreements set
          paid_initial   = case when coalesce(it->>'label','') ~* '^initial'   then false else paid_initial end,
          paid_immediate = case when coalesce(it->>'label','') ~* '^immediate' then false else paid_immediate end,
          paid_holdback  = case when coalesce(it->>'label','') ~* '^holdback'  then false else paid_holdback end
        where id::text = it->>'agreement_id';
      end if;
    end loop;
    result := 'unlock_paid';
  else
    -- Approved → Print packet
    select coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb) into removed
      from public.rmr_ledger_entries l where l.payout_run_id = p_run;
    delete from public.rmr_ledger_entries where payout_run_id = p_run;
    delete from public.rmr_payout_runs where id = p_run;
    result := 'undo_approval';
  end if;

  alter table public.rmr_ledger_entries enable trigger trg_ledger_ro;
  alter table public.rmr_payout_runs enable trigger trg_payout_run_guard;

  insert into public.rmr_payout_reversals (run_id, year, quarter, step, reason, reverted_by, run_snapshot, removed_entries)
  values (p_run, r.year, r.quarter, result, trim(p_reason), me, to_jsonb(r), removed);
  return result;
end $$;

revoke all on function public.rmr_revert_payout_step(bigint, text) from public;
grant execute on function public.rmr_revert_payout_step(bigint, text) to authenticated;

-- Check: should return the new table and function
select 'rmr_payout_reversals' as created where to_regclass('public.rmr_payout_reversals') is not null
union all select 'rmr_revert_payout_step' where exists (select 1 from pg_proc where proname = 'rmr_revert_payout_step');
