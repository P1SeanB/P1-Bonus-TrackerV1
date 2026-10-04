-- migration_v22_spec27.sql
-- P1 Bonus Tracker — Developer Specification v2.7 (3 Oct 2026)
-- ADDITIVE ONLY. No table or row is dropped, no existing value is rewritten.
-- Idempotent: safe to run more than once (second run creates nothing new).
-- Run once in Supabase > SQL Editor.

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. MIG-01 backup: point-in-time copies of every tracker table (first run only)
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['rmr_agreements','rmr_renewals','rmr_users','rmr_commission_plans','rmr_commission_events',
                           'rmr_draws','rmr_attachments','rmr_audit_log','rmr_legacy_payouts'] loop
    if to_regclass('public.'||t) is not null and to_regclass('public.bk_v22_'||t) is null then
      execute format('create table public.bk_v22_%s as select * from public.%I', t, t);
      execute format('alter table public.bk_v22_%s enable row level security', t);   -- no policies → API cannot read/write the backups
    end if;
  end loop;
end $$;

-- helper: current user's permission role (TEC-06) — reads the new column, falls back to the legacy one
alter table public.rmr_users add column if not exists permission_role text;
alter table public.rmr_users add column if not exists display_name text;
alter table public.rmr_users add column if not exists role_migrated_from text;

-- TEC-06: recorded mapping, never inferred at runtime. Plan-family values become Representative.
update public.rmr_users set role_migrated_from = role,
  permission_role = case
    when role in ('Administrator','Executive','Manager','Read Only','Representative') then role
    when role in ('Hunter','Farmer','Hybrid','Sales Representative') then 'Representative'
    when role = 'Sales Manager' then 'Executive'
    else 'Representative' end
where permission_role is null;

create or replace function public.rmr_my_role() returns text language sql stable security definer set search_path=public as $$
  select coalesce(u.permission_role, u.role) from public.rmr_users u where lower(u.email)=lower(auth.jwt()->>'email') limit 1
$$;
create or replace function public.rmr_is_admin() returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(public.rmr_my_role() = 'Administrator', false) or lower(auth.jwt()->>'email') = 'sean.bithell@point1.com'
$$;
create or replace function public.rmr_is_finance() returns boolean language sql stable security definer set search_path=public as $$
  select public.rmr_is_admin() or coalesce(public.rmr_my_role() in ('Executive','Manager'), false)
$$;

-- generic "no update / no delete" guard for append-only and immutable tables
create or replace function public.rmr_forbid_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'Table % is append-only: % is not permitted (spec v2.7 LED-01 / LED-03). Record a linked adjustment instead.', tg_table_name, tg_op;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Plan families and versions (CAT-01..07, COM-06, ADM-05/06, TEC-05)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.rmr_plan_versions (
  id uuid primary key default gen_random_uuid(),
  family text not null check (family in ('Hybrid','Hunter','Farmer')),
  version_no integer not null,
  label text not null,
  status text not null default 'draft' check (status in ('draft','published','retired')),
  rate_basis text check (rate_basis in ('mrr_multiple','tcv_percent')),
  config jsonb not null default '{}'::jsonb,
  effective_date date,
  approved_by text,
  approved_at timestamptz,
  preview_checked_at timestamptz,
  published_at timestamptz,
  published_by text,
  supersedes uuid references public.rmr_plan_versions(id),
  terms_text text,
  created_by text,
  created_at timestamptz not null default now(),
  modified_at timestamptz not null default now(),
  unique (family, version_no)
);
-- A published version is frozen: only status may move published → retired.
create or replace function public.rmr_plan_version_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then raise exception 'Published or retired plan versions cannot be deleted.'; end if;
    return old;
  end if;
  if old.status = 'published' then
    if new.status = 'retired' and new.config = old.config and new.rate_basis is not distinct from old.rate_basis
       and new.effective_date is not distinct from old.effective_date then return new; end if;
    raise exception 'Plan version % is published and immutable. Edit opens a new draft version.', old.label;
  end if;
  if old.status = 'retired' then raise exception 'Retired plan versions are read-only.'; end if;
  if new.status = 'published' then
    if new.rate_basis is null then raise exception 'Publication rejected: rate_basis is required.'; end if;
    if new.effective_date is null or new.approved_by is null or new.approved_at is null or new.preview_checked_at is null then
      raise exception 'Publication rejected: effective date, approval and a preview are required (ADM-06).'; end if;
    if new.rate_basis = 'mrr_multiple' and (new.config->'newMult') is null then
      raise exception 'Publication rejected: rate_basis mrr_multiple but no multiple fields are populated (COM-06).'; end if;
    if new.rate_basis = 'mrr_multiple' and (new.config ? 'newPct') then
      raise exception 'Publication rejected: rate_basis mrr_multiple but percentage fields are populated (COM-06).'; end if;
    if new.rate_basis = 'tcv_percent' and (new.config->'newPct') is null then
      raise exception 'Publication rejected: rate_basis tcv_percent but no percentage fields are populated (COM-06).'; end if;
    if new.family in ('Hunter','Farmer') and coalesce((new.config->>'placeholder')::boolean, true) then
      raise exception 'Publication rejected: % is a placeholder and is not configured.', new.family; end if;
    if exists (select 1 from public.rmr_plan_versions p where p.family = new.family and p.status = 'published'
               and p.id <> new.id and p.effective_date = new.effective_date) then
      raise exception 'Publication rejected: another published % version already starts on % (TEC-02).', new.family, new.effective_date; end if;
  end if;
  new.modified_at := now();
  return new;
end $$;
drop trigger if exists trg_plan_version_guard on public.rmr_plan_versions;
create trigger trg_plan_version_guard before update or delete on public.rmr_plan_versions
  for each row execute function public.rmr_plan_version_guard();

-- Seed: revised Hybrid v1 as a DRAFT (CAT-04 / CAT-05 / REL-03). Hunter & Farmer placeholders with null rates (ADM-05).
insert into public.rmr_plan_versions (family, version_no, label, status, rate_basis, config, terms_text, created_by)
select 'Hybrid', 1, 'Hybrid v1 (revised)', 'draft', 'mrr_multiple',
 '{"family":"Hybrid","placeholder":false,
   "allocation":{"hunter":0.25,"farmer":0.75},
   "salaryAssumption":110000,"quotaMonthlyMrr":1250,"accelMultiplier":"1.0",
   "targetMargin":"0.50","minMargin":"0.45",
   "marginGate":[{"min":"0.45","mult":"1.0"},{"min":"0","mult":"0"}],
   "newMult":{"12":"0.50","24":"0.75","36":"1.00","48":"1.125","60":"1.25"},
   "renewalMult":"0.25","newMultCapAbove60":"1.25",
   "slaNewMult":{"12":"0.36","24":"0.55","36":"0.72","48":"0.81","60":"0.90"},"slaRenewalMult":"0.25",
   "autoRenewalMult":"0","escalatorMult":"0","termConversionMult":"0",
   "tranche1Pct":"0.50","tranche2Pct":"0.50","releaseMode":"offset","releaseOffsetMonths":3,
   "requireCollection":true,"netProfitReleaseTest":false,"shortcut25Collected":false,
   "termMappings":{},
   "grrBonus":[{"min":"0.95","pct":"0.01"},{"min":"0.965","pct":"0.02"},{"min":"0.98","pct":"0.04"},{"min":"0.99","pct":"0.06"}],
   "nrrBonus":[{"min":"1.03","pct":"0.01"},{"min":"1.05","pct":"0.02"},{"min":"1.08","pct":"0.03"},{"min":"1.10","pct":"0.04"}],
   "bonusPeriod":"calendar_year","bonusPayBy":"02-15",
   "variableTarget":{"low":25000,"high":30000},"growthOpportunity":{"low":50000,"high":60000},
   "approvedTermNote48":"48-month 1.125x carried from the planning workbook; approve explicitly at publication (COM-06)"}'::jsonb,
 null, 'migration_v22'
where not exists (select 1 from public.rmr_plan_versions where family='Hybrid');

insert into public.rmr_plan_versions (family, version_no, label, status, rate_basis, config, created_by)
select f, 1, f||' (not configured)', 'draft', null,
 jsonb_build_object('family',f,'placeholder',true,'allocation',null,'salaryAssumption',null,'quotaMonthlyMrr',null,
   'newMult',null,'renewalMult',null,'minMargin',null,'tranche1Pct',null,'tranche2Pct',null), 'migration_v22'
from unnest(array['Hunter','Farmer']) f
where not exists (select 1 from public.rmr_plan_versions where family=f);

-- MIG-03: immutable snapshot of every historical rule set before presets leave the active catalog
create table if not exists public.rmr_plan_history (
  id bigserial primary key,
  source_plan_id uuid not null unique,
  label text,
  config jsonb not null,
  rate_basis text not null default 'tcv_percent',
  snapshotted_at timestamptz not null default now(),
  note text
);
insert into public.rmr_plan_history (source_plan_id, label, config, note)
select p.id, coalesce(p.config->>'planVersion', p.plan_name), p.config, 'Historical version — read-only evidence (CAT-02). Not an offered plan. Effective values = stored config plus the pre-v2.7 loader defaults (historicalEffectiveConfig in index.html, MIG-04).'
from public.rmr_commission_plans p
on conflict (source_plan_id) do nothing;
drop trigger if exists trg_plan_history_ro on public.rmr_plan_history;
create trigger trg_plan_history_ro before update or delete on public.rmr_plan_history for each row execute function public.rmr_forbid_mutation();

alter table public.rmr_commission_plans add column if not exists archived boolean not null default false;
-- CAT-01: old presets leave every offered list. Rows are kept (archive flag), never deleted.
update public.rmr_commission_plans set archived = true where archived = false;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Employees: plan assignment, salary, acknowledgement (NAV-05, COM-07, BON-03)
-- ─────────────────────────────────────────────────────────────────────────────
create extension if not exists btree_gist;
create table if not exists public.rmr_plan_assignments (
  id bigserial primary key,
  email text not null,
  plan_version_id uuid not null references public.rmr_plan_versions(id),
  effective_from date not null,
  effective_to date,                                  -- end-exclusive (TEC-02)
  approved_by text not null,
  approved_at timestamptz not null default now(),
  reason text,
  created_at timestamptz not null default now(),
  constraint no_overlap exclude using gist (lower(email) with =, daterange(effective_from, effective_to, '[)') with &&)
);
create or replace function public.rmr_assignment_guard() returns trigger language plpgsql as $$
declare v record;
begin
  select * into v from public.rmr_plan_versions where id = new.plan_version_id;
  if v.family in ('Hunter','Farmer') and coalesce((v.config->>'placeholder')::boolean,true) then
    raise exception 'Rejected: % is an unconfigured placeholder and cannot be assigned (ADM-05).', v.family; end if;
  if v.status <> 'published' then raise exception 'Rejected: only a published plan version can be assigned (%).', v.label; end if;
  return new;
end $$;
drop trigger if exists trg_assignment_guard on public.rmr_plan_assignments;
create trigger trg_assignment_guard before insert or update on public.rmr_plan_assignments for each row execute function public.rmr_assignment_guard();

create table if not exists public.rmr_salary_records (
  id bigserial primary key,
  email text not null,
  annual_salary numeric(12,2) not null,
  effective_from date not null,
  effective_to date,
  note text,
  created_by text,
  created_at timestamptz not null default now(),
  constraint salary_no_overlap exclude using gist (lower(email) with =, daterange(effective_from, effective_to, '[)') with &&)
);

create table if not exists public.rmr_plan_acknowledgements (
  id bigserial primary key,
  email text not null,
  plan_version_id uuid not null references public.rmr_plan_versions(id),
  text_shown text not null,
  acknowledged_at timestamptz not null default now(),
  user_agent text,
  signed_attachment_id bigint,
  unique (email, plan_version_id)
);
drop trigger if exists trg_ack_ro on public.rmr_plan_acknowledgements;
create trigger trg_ack_ro before update or delete on public.rmr_plan_acknowledgements for each row execute function public.rmr_forbid_mutation();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Commission ledger — append-only source of truth (LED-01..06, TEC-07)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.rmr_comm_events (
  id bigserial primary key,
  event_uid text not null unique,                       -- LED-04 unique source event identity
  agreement_id uuid,
  agreement_number text,
  event_type text not null check (event_type in ('new_sale','expansion','manual_renewal','sla_new','sla_renewal','win_back')),
  event_date date not null,                              -- execution / signature date: selects the plan (MIG-05, PAY-05)
  plan_version_id uuid references public.rmr_plan_versions(id),
  historical_plan_id uuid,                               -- events on a historical percentage version
  cost_version_id bigint,
  opportunity_number text,
  quote_ref text,                                        -- COM-08 dormant
  snapshot jsonb not null,                               -- LED-03 immutable calculation snapshot (cents, exact strings)
  formula_version text not null,
  cost_mode text not null default 'modelled',
  total_cents bigint not null,
  created_by text not null,
  created_at timestamptz not null default now()
);
drop trigger if exists trg_comm_events_ro on public.rmr_comm_events;
create trigger trg_comm_events_ro before update or delete on public.rmr_comm_events for each row execute function public.rmr_forbid_mutation();

create table if not exists public.rmr_credit_shares (
  id bigserial primary key,
  event_uid text not null references public.rmr_comm_events(event_uid),
  recipient_email text not null,
  share_bp integer not null check (share_bp > 0 and share_bp <= 10000),   -- basis points; validated to total 10000
  confirmed boolean not null default true,
  created_at timestamptz not null default now(),
  unique (event_uid, recipient_email)
);
drop trigger if exists trg_shares_ro on public.rmr_credit_shares;
create trigger trg_shares_ro before update or delete on public.rmr_credit_shares for each row execute function public.rmr_forbid_mutation();

create table if not exists public.rmr_ledger_entries (
  id bigserial primary key,
  entry_uid text not null unique,                        -- LED-04: event|tranche|stage|recipient — duplicates impossible
  event_uid text not null references public.rmr_comm_events(event_uid),
  tranche smallint check (tranche in (1,2)),
  stage text not null check (stage in ('qualified','earned','payable','paid','adjustment','cancelled','override')),
  recipient_email text not null,
  amount_cents bigint not null,
  earned_date date,                                      -- VIS-04: when the condition was actually met
  verified_at timestamptz,                               -- VIS-04: when evidence was reviewed
  payout_run_id bigint,
  payment_ref text,
  evidence jsonb,
  reason text,
  approver text,
  links_to text,                                         -- PAY-04 / LED-05 adjustments link to the original entry_uid
  actor text not null,
  created_at timestamptz not null default now()
);
drop trigger if exists trg_ledger_ro on public.rmr_ledger_entries;
create trigger trg_ledger_ro before update or delete on public.rmr_ledger_entries for each row execute function public.rmr_forbid_mutation();

-- Approved and frozen modelled cost versions (CST-12)
create table if not exists public.rmr_cost_versions (
  id bigserial primary key,
  agreement_id uuid not null,
  version_no integer not null,
  costs jsonb not null,
  annual_direct_cents bigint not null,
  approver text not null,
  approved_at timestamptz not null default now(),
  evidence text,
  unique (agreement_id, version_no)
);
drop trigger if exists trg_cost_versions_ro on public.rmr_cost_versions;
create trigger trg_cost_versions_ro before update or delete on public.rmr_cost_versions for each row execute function public.rmr_forbid_mutation();

-- Payout runs (NAV-04)
create table if not exists public.rmr_payout_runs (
  id bigserial primary key,
  year integer not null, quarter integer not null,
  approved_by text not null, approved_at timestamptz not null default now(),
  ready_cents bigint not null, excluded jsonb, export_file text,
  unique (year, quarter)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Vista feeds, receipts evidence, import health, worklist (VIS-01..16, BIL, NAV)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.rmr_import_batches (
  id bigserial primary key,
  feed text not null check (feed in ('invoices','receipts','agreement_terms','posted_cost','invoice_attribution')),
  route text not null default 'manual' check (route in ('manual','scheduled')),
  filename text, file_sha256 text,
  status text not null check (status in ('committed','held','failed','cancelled')),
  rows_read integer, matched integer, unmatched integer, duplicates integer,
  data_through date, param_echo text, param_flags jsonb, error text,
  created_by text, created_at timestamptz not null default now()
);
create table if not exists public.rmr_vista_invoices (
  invoice_number text primary key,                       -- VIS-05 stable key
  company integer not null default 2,
  status text, customer text, invoice_date date, post_month text, due_date date,
  amount numeric(14,2), tax numeric(14,2), total numeric(14,2), balance numeric(14,2),
  service_site text, work_order text, description text,
  agreement_number text, map_method text,
  first_batch_id bigint, last_batch_id bigint, raw jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.rmr_vista_receipts (
  receipt_key text primary key,                          -- receipt id + invoice allocation
  receipt_id text, invoice_number text, customer text,
  amount numeric(14,2), receipt_date date,
  batch_id bigint, raw jsonb, created_at timestamptz not null default now()
);
create table if not exists public.rmr_vista_agreement_terms (
  term_key text primary key,                             -- agreement|revision
  agreement_number text, revision text, previous_revision text, status text,
  effective_date date, activated_date date, cancelled_date date, terminated_date date, expiration_date date,
  term_price numeric(14,2), customer text, batch_id bigint, raw jsonb
);
create table if not exists public.rmr_vista_costs (
  line_key text primary key,
  work_order text, agreement_number text, line_type text, description text, post_date date,
  amount numeric(14,2), bucket text not null default 'unresolved' check (bucket in ('direct_unburdened','direct_burdened','overhead','unresolved')),
  batch_id bigint, raw jsonb
);
create table if not exists public.rmr_cost_class_rules (       -- CST-05: mapping lives in data, not code
  id bigserial primary key,
  match_field text not null default 'description', pattern text not null,
  bucket text not null check (bucket in ('direct_unburdened','direct_burdened','overhead','unresolved')),
  note text, created_at timestamptz not null default now(), unique (match_field, pattern)
);
insert into public.rmr_cost_class_rules (match_field, pattern, bucket, note) values
  ('description','(?i)applied overhead','overhead','Monthly routine (27%/28% of billings)'),
  ('description','(?i)agreement overhead revision','overhead','Agreement lump, variant 1'),
  ('description','(?i)agreement oh revision','overhead','Agreement lump, variant 2'),
  ('line_type','(?i)^labor$','direct_burdened','Labour burden cannot be split from labour in this export (CST-05 limitation)')
on conflict do nothing;

-- VIS-10 / VIS-16: documented collection evidence — manual verification against the SM Agreements Invoices tab
create table if not exists public.rmr_receipt_verifications (
  id bigserial primary key,
  verification_uid text not null unique,                 -- invoice|source — re-recording cannot double count (BIL-04)
  agreement_id uuid, agreement_number text,
  invoice_number text not null,
  invoice_date date,
  total_amount numeric(14,2), total_paid numeric(14,2), total_billed numeric(14,2), vista_status text,
  evidence_state text not null default 'Confirmed' check (evidence_state in ('Confirmed','Unverified','Disputed')),
  source text not null check (source in ('sm_invoices_tab','export_grid','receipt_import','override')),
  receipt_date date,                                     -- true cash date when known (report #94); null → earning date = verified date (VIS-10)
  evidence text, reason text, approver text,
  verified_by text not null, verified_at timestamptz not null default now()
);
drop trigger if exists trg_verif_ro on public.rmr_receipt_verifications;
create trigger trg_verif_ro before update or delete on public.rmr_receipt_verifications for each row execute function public.rmr_forbid_mutation();

create table if not exists public.rmr_worklist (
  id bigserial primary key,
  item_uid text not null unique,
  type text not null check (type in ('unmatched_vista','import_exception','cost_classification','cost_variance','cost_unverified',
                                     'recipient_unresolved','migration_exception','overdue_feed','plan_ack_missing')),
  record_ref text, title text not null, detail jsonb,
  owner_email text, due_date date,
  status text not null default 'open' check (status in ('open','closed')),
  closed_by text, closed_at timestamptz, close_basis text,
  created_at timestamptz not null default now()
);

create table if not exists public.rmr_settings (
  key text primary key, value jsonb not null, updated_by text, updated_at timestamptz not null default now()
);
insert into public.rmr_settings (key, value) values
  ('payout_calendar', '{"frequency":"quarterly","payWithinDays":30,"verifyWithinDays":15,"timezone":"America/Los_Angeles"}'),
  ('feed_owners', '{"invoices":{"owner":null,"backup":null,"cadence":"monthly"},"receipts":{"owner":null,"backup":null,"cadence":"monthly"},"agreement_terms":{"owner":null,"backup":null,"cadence":"monthly"},"posted_cost":{"owner":null,"backup":null,"cadence":"quarterly"},"invoice_attribution":{"owner":null,"backup":null,"cadence":"on demand"}}'),
  ('employer_cost_model', '{"baseSalary":110000,"salaryBurden":0.35,"incentiveBurden":0.35,"vehicle":9600,"fuel":2400,"otherOverhead":100000,"assumption":true}')
on conflict (key) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Agreement fields (section 7, COM-08, CST-13, TEC-08, MIG-07)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.rmr_agreements
  add column if not exists original_sale_date date,
  add column if not exists revision_id text,
  add column if not exists vista_ref text,
  add column if not exists quote_ref text,
  add column if not exists quote_expiration date,              -- COM-08: dormant, not evaluated
  add column if not exists predecessor_reason text,            -- renewal | transfer | consolidation | replacement
  add column if not exists grandfather_rule jsonb,             -- AGR-03 / TEC-08 explicit record
  add column if not exists cost_owner_email text,              -- CST-13
  add column if not exists cost_deadline date,
  add column if not exists cost_lines jsonb,
  add column if not exists cost_confirmed_zero boolean not null default false,   -- CST-04 explicit confirmed zero                   -- CST-04 per-line metadata (period, frequency, estimate/actual, verified)
  add column if not exists historical_import boolean not null default false;   -- MIG-07

-- MIG-07: Vista-loaded agreements are Historical import
update public.rmr_agreements set historical_import = true where history_only = true and historical_import = false;
-- TEC-08: replace runtime inference with an explicit record (only for rows that relied on it)
update public.rmr_agreements
   set grandfather_rule = jsonb_build_object('rule','pre-2026 full pay at activation','version','2026 v1.x (historical)',
         'effective_to','2026-01-01','reason','Activated before 1 Jan 2026 under the historical plan','approval','Recorded at v22 migration from activation_date; review','recorded_at',now())
 where grandfather_rule is null and activation_date < '2026-01-01' and deleted_at is null;

-- Billing audit: preserve every original billing-log status before the operational view reclassifies them (section 3)
create table if not exists public.rmr_billing_log_audit_v22 (
  agreement_id uuid primary key,
  agreement_number text,
  original_log jsonb,
  auto_past_rows integer, auto_past_amount numeric(14,2),
  captured_at timestamptz not null default now()
);
insert into public.rmr_billing_log_audit_v22 (agreement_id, agreement_number, original_log, auto_past_rows, auto_past_amount)
select a.id, a.agreement_number, a.billing_log,
  (select count(*) from jsonb_array_elements(coalesce(a.billing_log,'[]'::jsonb)) e where e->>'status'='auto' and (e->>'date')::date <= current_date),
  (select coalesce(sum((e->>'amount')::numeric),0) from jsonb_array_elements(coalesce(a.billing_log,'[]'::jsonb)) e where e->>'status'='auto' and (e->>'date')::date <= current_date)
from public.rmr_agreements a
where a.billing_log is not null and jsonb_typeof(a.billing_log)='array'
on conflict (agreement_id) do nothing;
drop trigger if exists trg_blog_audit_ro on public.rmr_billing_log_audit_v22;
create trigger trg_blog_audit_ro before update or delete on public.rmr_billing_log_audit_v22 for each row execute function public.rmr_forbid_mutation();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Row-level security: read for signed-in users; writes only for the right role (backend rejects unauthorized edits)
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['rmr_plan_versions','rmr_plan_history','rmr_plan_assignments','rmr_salary_records','rmr_plan_acknowledgements',
    'rmr_comm_events','rmr_credit_shares','rmr_ledger_entries','rmr_cost_versions','rmr_payout_runs','rmr_import_batches','rmr_vista_invoices',
    'rmr_vista_receipts','rmr_vista_agreement_terms','rmr_vista_costs','rmr_cost_class_rules','rmr_receipt_verifications','rmr_worklist',
    'rmr_settings','rmr_billing_log_audit_v22'] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (select 1 from pg_policies where tablename=t and policyname=t||' read') then
      execute format('create policy %I on public.%I for select to authenticated using (true)', t||' read', t);
    end if;
  end loop;
end $$;

do $$ begin
  -- plan configuration: Administrators only (ADM acceptance: unauthorized edits rejected by the backend)
  if not exists (select 1 from pg_policies where tablename='rmr_plan_versions' and policyname='plan admin write') then
    create policy "plan admin write" on public.rmr_plan_versions for all to authenticated using (public.rmr_is_admin()) with check (public.rmr_is_admin()); end if;
  if not exists (select 1 from pg_policies where tablename='rmr_plan_assignments' and policyname='assign admin write') then
    create policy "assign admin write" on public.rmr_plan_assignments for all to authenticated using (public.rmr_is_admin()) with check (public.rmr_is_admin()); end if;
  if not exists (select 1 from pg_policies where tablename='rmr_salary_records' and policyname='salary admin write') then
    create policy "salary admin write" on public.rmr_salary_records for all to authenticated using (public.rmr_is_admin()) with check (public.rmr_is_admin()); end if;
  if not exists (select 1 from pg_policies where tablename='rmr_settings' and policyname='settings admin write') then
    create policy "settings admin write" on public.rmr_settings for all to authenticated using (public.rmr_is_admin()) with check (public.rmr_is_admin()); end if;
  if not exists (select 1 from pg_policies where tablename='rmr_cost_class_rules' and policyname='rules admin write') then
    create policy "rules admin write" on public.rmr_cost_class_rules for all to authenticated using (public.rmr_is_admin()) with check (public.rmr_is_admin()); end if;
  -- a person may only acknowledge for themselves
  if not exists (select 1 from pg_policies where tablename='rmr_plan_acknowledgements' and policyname='ack self insert') then
    create policy "ack self insert" on public.rmr_plan_acknowledgements for insert to authenticated with check (lower(email)=lower(auth.jwt()->>'email')); end if;
  -- ledger, events, evidence, imports, worklist: finance roles (Administrator / Executive / Manager) insert; append-only triggers block edits
  if not exists (select 1 from pg_policies where tablename='rmr_comm_events' and policyname='events finance insert') then
    create policy "events finance insert" on public.rmr_comm_events for insert to authenticated with check (public.rmr_is_finance()); end if;
  if not exists (select 1 from pg_policies where tablename='rmr_credit_shares' and policyname='shares finance insert') then
    create policy "shares finance insert" on public.rmr_credit_shares for insert to authenticated with check (public.rmr_is_finance()); end if;
  if not exists (select 1 from pg_policies where tablename='rmr_ledger_entries' and policyname='ledger finance insert') then
    create policy "ledger finance insert" on public.rmr_ledger_entries for insert to authenticated with check (public.rmr_is_finance()); end if;
  if not exists (select 1 from pg_policies where tablename='rmr_cost_versions' and policyname='costv finance insert') then
    create policy "costv finance insert" on public.rmr_cost_versions for insert to authenticated with check (public.rmr_is_finance()); end if;
  if not exists (select 1 from pg_policies where tablename='rmr_receipt_verifications' and policyname='verif finance insert') then
    create policy "verif finance insert" on public.rmr_receipt_verifications for insert to authenticated with check (public.rmr_is_finance()); end if;
  if not exists (select 1 from pg_policies where tablename='rmr_payout_runs' and policyname='payout finance insert') then
    create policy "payout finance insert" on public.rmr_payout_runs for insert to authenticated with check (public.rmr_is_finance()); end if;
  if not exists (select 1 from pg_policies where tablename='rmr_import_batches' and policyname='batches finance write') then
    create policy "batches finance write" on public.rmr_import_batches for all to authenticated using (public.rmr_is_finance()) with check (public.rmr_is_finance()); end if;
  if not exists (select 1 from pg_policies where tablename='rmr_vista_invoices' and policyname='vinv finance write') then
    create policy "vinv finance write" on public.rmr_vista_invoices for all to authenticated using (public.rmr_is_finance()) with check (public.rmr_is_finance()); end if;
  if not exists (select 1 from pg_policies where tablename='rmr_vista_receipts' and policyname='vrec finance write') then
    create policy "vrec finance write" on public.rmr_vista_receipts for all to authenticated using (public.rmr_is_finance()) with check (public.rmr_is_finance()); end if;
  if not exists (select 1 from pg_policies where tablename='rmr_vista_agreement_terms' and policyname='vterm finance write') then
    create policy "vterm finance write" on public.rmr_vista_agreement_terms for all to authenticated using (public.rmr_is_finance()) with check (public.rmr_is_finance()); end if;
  if not exists (select 1 from pg_policies where tablename='rmr_vista_costs' and policyname='vcost finance write') then
    create policy "vcost finance write" on public.rmr_vista_costs for all to authenticated using (public.rmr_is_finance()) with check (public.rmr_is_finance()); end if;
  if not exists (select 1 from pg_policies where tablename='rmr_worklist' and policyname='worklist write') then
    create policy "worklist write" on public.rmr_worklist for all to authenticated using (true) with check (true); end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Migration exceptions into the Worklist (MIG-09, TEC-07, CST-13) — idempotent by item_uid
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.rmr_worklist (item_uid, type, record_ref, title, detail, owner_email, due_date)
select 'mig09:'||a.agreement_number, 'migration_exception', a.agreement_number,
       'Agreement '||a.agreement_number||': '||b.auto_past_rows||' past billing rows were auto-marked paid by date only — now Unverified',
       jsonb_build_object('rows',b.auto_past_rows,'amount',b.auto_past_amount,'note','No commission was paid on these rows (MIG-08). Reconcile against a Vista AR extract; do not reverse paid history.'),
       'sean.bithell@point1.com', current_date + 30
from public.rmr_billing_log_audit_v22 b join public.rmr_agreements a on a.id=b.agreement_id
where b.auto_past_rows > 0 and a.deleted_at is null and coalesce(a.history_only,false) = false
on conflict (item_uid) do nothing;

-- Grandfather rows recorded by migration are flagged for explicit approval (AGR-03)
insert into public.rmr_worklist (item_uid, type, record_ref, title, detail, owner_email, due_date)
select 'tec08:'||a.agreement_number, 'migration_exception', a.agreement_number,
       'Agreement '||a.agreement_number||': grandfathered treatment recorded from activation date — approve or correct',
       a.grandfather_rule, 'sean.bithell@point1.com', current_date + 60
from public.rmr_agreements a
where a.grandfather_rule is not null and a.deleted_at is null and coalesce(a.history_only,false)=false
on conflict (item_uid) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Control totals (compare with docs/v22_control_totals_before.md)
-- ─────────────────────────────────────────────────────────────────────────────
select 'agreements' k, count(*)::text v from public.rmr_agreements
union all select 'backup agreements', count(*)::text from public.bk_v22_rmr_agreements
union all select 'plan versions', count(*)::text from public.rmr_plan_versions
union all select 'historical plan snapshots', count(*)::text from public.rmr_plan_history
union all select 'auto-past rows (audit)', coalesce(sum(auto_past_rows),0)::text from public.rmr_billing_log_audit_v22
union all select 'auto-past amount (audit)', coalesce(sum(auto_past_amount),0)::text from public.rmr_billing_log_audit_v22
union all select 'users with permission_role', count(*)::text from public.rmr_users where permission_role is not null
union all select 'draws preserved', count(*)::text from public.rmr_draws
union all select 'worklist items', count(*)::text from public.rmr_worklist;
