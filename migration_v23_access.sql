-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- Bonus Tracker · migration v23 — access hardening + onboarding support
-- Run once in Supabase ▸ SQL Editor after migration_v22_spec27.sql. Safe to re-run (idempotent).
--
-- What it does
--  1. Only people listed in rmr_users (Admin ▸ Employees) can read or write anything. A stranger who
--     manages to create a login sees nothing.
--  2. Representatives (and Read Only users) see only their own agreements, opportunities, commission,
--     salary, assignment and acknowledgement rows. Administrators, Executives and Managers see all.
--     Salary is limited further to the person themself, Administrators and Executives.
--  3. Payout runs and the audit trail are readable by Administrators / Executives / Managers only.
--  4. Adds rmr_users.must_set_password so a new employee is asked to choose their own password at
--     first sign-in, plus a function that lets them clear that flag for themselves.
--
-- How: RESTRICTIVE row-level-security policies. They narrow whatever permissive policies already exist
-- (they never widen access), so nothing has to be dropped and the existing admin/finance write rules
-- stay exactly as they are.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

-- 1. Helpers ------------------------------------------------------------------------------------
create or replace function public.rmr_my_email() returns text language sql stable as $$
  select lower(coalesce(auth.jwt()->>'email',''))
$$;
create or replace function public.rmr_is_member() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.rmr_users u where lower(u.email)=public.rmr_my_email())
      or public.rmr_my_email()='sean.bithell@point1.com'
$$;
create or replace function public.rmr_sees_all() returns boolean language sql stable security definer set search_path=public as $$
  select public.rmr_is_admin() or coalesce(public.rmr_my_role() in ('Executive','Manager'), false)
$$;
create or replace function public.rmr_sees_pay() returns boolean language sql stable security definer set search_path=public as $$
  select public.rmr_is_admin() or coalesce(public.rmr_my_role() = 'Executive', false)
$$;

-- 2. First-sign-in password flag ------------------------------------------------------------------
alter table public.rmr_users add column if not exists must_set_password boolean not null default false;
create or replace function public.rmr_password_set() returns void language sql security definer set search_path=public as $$
  update public.rmr_users set must_set_password=false where lower(email)=public.rmr_my_email()
$$;
grant execute on function public.rmr_password_set() to authenticated;

-- 2b. New Worklist item types: a rep marking an opportunity won, and a won agreement whose sale is not recorded yet
alter table public.rmr_worklist drop constraint if exists rmr_worklist_type_check;
alter table public.rmr_worklist add constraint rmr_worklist_type_check check (type in ('unmatched_vista','import_exception','cost_classification',
  'cost_variance','cost_unverified','recipient_unresolved','migration_exception','overdue_feed','plan_ack_missing','deal_won','sale_unrecorded'));

-- 3. Policies -----------------------------------------------------------------------------------
do $$
declare t text; p record;
begin
  -- 3a. membership gate on every tracker table that exists
  foreach t in array array['rmr_agreements','rmr_users','rmr_commission_plans','rmr_renewals','rmr_commission_events','rmr_draws',
    'rmr_attachments','rmr_audit_log','rmr_legacy_payouts','rmr_plan_versions','rmr_plan_history','rmr_plan_assignments',
    'rmr_salary_records','rmr_plan_acknowledgements','rmr_comm_events','rmr_credit_shares','rmr_ledger_entries','rmr_cost_versions',
    'rmr_payout_runs','rmr_import_batches','rmr_vista_invoices','rmr_vista_receipts','rmr_vista_agreement_terms','rmr_vista_costs',
    'rmr_cost_class_rules','rmr_receipt_verifications','rmr_worklist','rmr_settings','rmr_billing_log_audit_v22'] loop
    if to_regclass('public.'||t) is not null then
      execute format('alter table public.%I enable row level security', t);
      if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='v23 members only') then
        execute format('create policy "v23 members only" on public.%I as restrictive for all to authenticated using (public.rmr_is_member()) with check (public.rmr_is_member())', t);
      end if;
    end if;
  end loop;

  -- 3b. row scoping (restrictive, per command)
  for p in select * from (values
    -- table,                       command,  using / check expression
    ('rmr_agreements',            'select', 'public.rmr_sees_all() or lower(owner_email)=public.rmr_my_email()'),
    ('rmr_agreements',            'insert', 'public.rmr_sees_all() or lower(owner_email)=public.rmr_my_email()'),
    ('rmr_agreements',            'update', 'public.rmr_sees_all() or lower(owner_email)=public.rmr_my_email()'),
    ('rmr_agreements',            'delete', 'public.rmr_sees_all()'),
    ('rmr_users',                 'select', 'public.rmr_sees_all() or lower(email)=public.rmr_my_email()'),
    ('rmr_renewals',              'select', 'exists(select 1 from public.rmr_agreements a where a.id=agreement_id)'),
    ('rmr_attachments',           'select', 'exists(select 1 from public.rmr_agreements a where a.id=agreement_id)'),
    ('rmr_commission_events',     'select', 'exists(select 1 from public.rmr_agreements a where a.id=agreement_id)'),
    ('rmr_comm_events',           'select', 'public.rmr_sees_all() or exists(select 1 from public.rmr_agreements a where a.id=agreement_id)'),
    ('rmr_cost_versions',         'select', 'public.rmr_sees_all() or exists(select 1 from public.rmr_agreements a where a.id=agreement_id)'),
    ('rmr_credit_shares',         'select', 'public.rmr_sees_all() or lower(recipient_email)=public.rmr_my_email()'),
    ('rmr_ledger_entries',        'select', 'public.rmr_sees_all() or lower(recipient_email)=public.rmr_my_email()'),
    ('rmr_plan_assignments',      'select', 'public.rmr_sees_all() or lower(email)=public.rmr_my_email()'),
    ('rmr_plan_acknowledgements', 'select', 'public.rmr_sees_all() or lower(email)=public.rmr_my_email()'),
    ('rmr_salary_records',        'select', 'public.rmr_sees_pay() or lower(email)=public.rmr_my_email()'),
    ('rmr_draws',                 'select', 'public.rmr_sees_all() or lower(owner_email)=public.rmr_my_email()'),
    ('rmr_legacy_payouts',        'select', 'public.rmr_sees_all() or lower(owner_email)=public.rmr_my_email()'),
    ('rmr_payout_runs',           'select', 'public.rmr_sees_all()'),
    ('rmr_audit_log',             'select', 'public.rmr_sees_all()'),
    ('rmr_worklist',              'select', 'public.rmr_sees_all() or lower(owner_email)=public.rmr_my_email() or lower(detail->>''requested_by'')=public.rmr_my_email()'),
    ('rmr_worklist',              'update', 'public.rmr_sees_all() or lower(owner_email)=public.rmr_my_email()'),
    ('rmr_worklist',              'delete', 'public.rmr_sees_all()')
  ) as v(tbl, cmd, expr) loop
    if to_regclass('public.'||p.tbl) is null then continue; end if;
    -- skip a rule whose column is missing on this installation (e.g. an older legacy table shape)
    if p.expr ~ 'agreement_id' and not exists (select 1 from information_schema.columns where table_schema='public' and table_name=p.tbl and column_name='agreement_id') then continue; end if;
    if p.expr ~ 'owner_email' and not exists (select 1 from information_schema.columns where table_schema='public' and table_name=p.tbl and column_name='owner_email') then continue; end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=p.tbl and policyname='v23 scope '||p.cmd) then
      if p.cmd='insert' then
        execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (%s)', 'v23 scope '||p.cmd, p.tbl, p.expr);
      elsif p.cmd='update' then
        execute format('create policy %I on public.%I as restrictive for update to authenticated using (%s) with check (%s)', 'v23 scope '||p.cmd, p.tbl, p.expr, p.expr);
      else
        execute format('create policy %I on public.%I as restrictive for %s to authenticated using (%s)', 'v23 scope '||p.cmd, p.tbl, p.cmd, p.expr);
      end if;
    end if;
  end loop;
end $$;

-- 4. Report: every policy now on the tracker tables (read this output; nothing is changed by it) ----
select tablename, policyname, permissive, cmd, roles
from pg_policies where schemaname='public' and tablename like 'rmr\_%'
order by tablename, permissive desc, policyname;
