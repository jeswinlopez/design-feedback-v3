-- 0004_storage.sql — private 'designs' bucket + admin-only object policies (§8)
-- Voters never read storage directly; signed URLs are minted by the get_ballot Edge
-- Function with the service role (which bypasses these policies). Bucket is never public.

insert into storage.buckets (id, name, public)
values ('designs', 'designs', false)
on conflict (id) do nothing;

-- Path scheme: tests/{test_id}/{variant_id}.{ext} — element 2 (1-based) is the test_id.
-- An admin may manage objects only under tests they own.
create policy designs_admin_all on storage.objects
  for all to authenticated
  using (
    bucket_id = 'designs'
    and exists (
      select 1 from public.tests t
      where t.id = (storage.foldername(name))[2]::uuid
        and t.owner_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'designs'
    and exists (
      select 1 from public.tests t
      where t.id = (storage.foldername(name))[2]::uuid
        and t.owner_id = auth.uid()
    )
  );
