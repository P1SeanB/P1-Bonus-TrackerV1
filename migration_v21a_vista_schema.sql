-- migration_v21a_vista_schema.sql
-- P1 Bonus Tracker — Vista book, 2025 paid history, draws, SLA type, portfolio bonus.
-- SAFE TO RUN ANY TIME: only adds columns and tables. The live app ignores them until the new version is deployed.
-- Run once in Supabase > SQL Editor. Safe to re-run.

alter table public.rmr_agreements
  add column if not exists category text not null default 'rmr',          -- 'rmr' | 'sla'
  add column if not exists history_only boolean not null default false,    -- true = no new-sale commission (paid under the 2025 plan, pre-2026, transfer or consolidation)
  add column if not exists transfer_from text,                             -- agreement number this one continues (account move / replacement / SLA renewal)
  add column if not exists consolidated_into text,                         -- agreement number this one was folded into
  add column if not exists ended_date date,                                -- last day billed in Vista (churned / consolidated)
  add column if not exists original_start date,                            -- first month billed in Vista
  add column if not exists term_end date,                                  -- Vista expiration of the current term
  add column if not exists mrr_history jsonb,                              -- {"YYYY-MM": MRR} from Vista billing — drives gross/net retention
  add column if not exists vista_mrr numeric,
  add column if not exists vista_term integer,
  add column if not exists vista_start date,
  add column if not exists vista_status text,
  add column if not exists vista_customer text,
  add column if not exists vista_note text,
  add column if not exists vista_synced_at timestamptz;

-- Paid history from the signed quarterly bonus sheets (locked; never recalculated)
create table if not exists public.rmr_legacy_payouts (
  id bigserial primary key,
  owner_email text not null,
  year integer not null,
  quarter integer not null,
  amount numeric not null,
  plan_label text not null default '2025 plan — 2 × Monthly RMR (paid)',
  source_doc text,
  lines jsonb,
  created_at timestamptz not null default now(),
  unique (owner_email, year, quarter)
);

-- Draws / advances paid while a plan is being settled
create table if not exists public.rmr_draws (
  id bigserial primary key,
  owner_email text not null,
  plan_year integer not null,
  amount numeric not null,
  paid_date date,
  recoverable text not null default 'undecided' check (recoverable in ('recoverable','non-recoverable','undecided')),
  approved_by text,
  notes text,
  created_at timestamptz not null default now()
);

-- Same access rules as the other tracker tables: signed-in users read; Administrators/Executives write.
alter table public.rmr_legacy_payouts enable row level security;
alter table public.rmr_draws enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='rmr_legacy_payouts' and policyname='legacy read') then
    create policy "legacy read" on public.rmr_legacy_payouts for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='rmr_draws' and policyname='draws read') then
    create policy "draws read" on public.rmr_draws for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='rmr_draws' and policyname='draws admin write') then
    create policy "draws admin write" on public.rmr_draws for all to authenticated
      using (exists (select 1 from public.rmr_users u where lower(u.email)=lower(auth.jwt()->>'email') and u.role in ('Administrator','Executive')))
      with check (exists (select 1 from public.rmr_users u where lower(u.email)=lower(auth.jwt()->>'email') and u.role in ('Administrator','Executive')));
  end if;
end $$;
