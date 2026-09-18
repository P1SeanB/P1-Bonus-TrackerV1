-- migration_v20_workbook_roles.sql
-- P1 Bonus Tracker — roles aligned to the Service Sales Planning Workbook (Hunter / Farmer / Hybrid)
-- Run once in Supabase ▸ SQL Editor. Safe to re-run.

-- 1) Term-conversion flag on agreements (Farmer / Hybrid one-time incentive, 12-mo → 36-mo+)
alter table public.rmr_agreements
  add column if not exists term_conversion boolean not null default false;

-- 2) Map legacy role values. 'Sales Representative' → Hybrid, 'Sales Manager' → Executive.
--    (The app also maps these on read, so nothing breaks before this runs.)
do $$ begin
  if exists (select 1 from pg_constraint where conname = 'rmr_users_role_check') then
    alter table public.rmr_users drop constraint rmr_users_role_check;
  end if;
end $$;
update public.rmr_users set role = 'Hybrid'    where role = 'Sales Representative';
update public.rmr_users set role = 'Executive' where role = 'Sales Manager';

-- 3) Check for any row-level-security policy that still names the old roles (none expected; fix by hand if any appear)
select policyname, tablename, qual, with_check
from pg_policies
where schemaname = 'public' and (coalesce(qual,'') ilike '%Sales %' or coalesce(with_check,'') ilike '%Sales %');
