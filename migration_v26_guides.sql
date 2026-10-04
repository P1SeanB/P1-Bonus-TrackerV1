-- P1 Bonus Tracker · migration v26 · Private user guides, shown by role after sign-in
-- Run once in Supabase ▸ SQL Editor. Safe to run again.
--
--   guides/admin/…  → Administrators, Executives and Managers
--   guides/rep/…    → everyone signed in to the tracker (sales reps included)
--   Only an Administrator can upload or replace a guide. Nothing in this bucket is public.

insert into storage.buckets (id, name, public) values ('guides', 'guides', false)
on conflict (id) do update set public = false;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='guides read by role') then
    create policy "guides read by role" on storage.objects for select to authenticated
      using (bucket_id = 'guides' and (
              (name like 'admin/%' and public.rmr_sees_all())
           or (name like 'rep/%'   and public.rmr_is_member())));
  end if;
  -- restrictive: even if a broader storage rule exists, guides stay limited to these roles
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='guides only by role') then
    create policy "guides only by role" on storage.objects as restrictive for select to authenticated
      using (bucket_id <> 'guides' or (name like 'admin/%' and public.rmr_sees_all()) or (name like 'rep/%' and public.rmr_is_member()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='guides admin upload') then
    create policy "guides admin upload" on storage.objects for insert to authenticated
      with check (bucket_id = 'guides' and public.rmr_is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='guides admin replace') then
    create policy "guides admin replace" on storage.objects for update to authenticated
      using (bucket_id = 'guides' and public.rmr_is_admin()) with check (bucket_id = 'guides' and public.rmr_is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='guides admin delete') then
    create policy "guides admin delete" on storage.objects for delete to authenticated
      using (bucket_id = 'guides' and public.rmr_is_admin());
  end if;
end $$;

-- Check: the bucket is private and has five rules
select b.id, b.public, (select count(*) from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'guides%') as rules
from storage.buckets b where b.id = 'guides';
