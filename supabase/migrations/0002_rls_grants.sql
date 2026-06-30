-- 0002_rls_grants.sql — RLS, default deny, owner-scoped policies, revoke anon (§6)

alter table profiles enable row level security;
alter table tests    enable row level security;
alter table variants enable row level security;
alter table voters   enable row level security;
alter table votes    enable row level security;

-- profiles: a user can read/update only their own row. No insert/delete from client
-- (admin rows are seeded). This is what gates the admin app: no profile => not an admin.
create policy profiles_select_own on profiles
  for select using (id = auth.uid());
create policy profiles_update_own on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- tests: full access only to the owner.
create policy tests_all on tests
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- child tables: access where the parent test is owned by the caller (join via test_id).
create policy variants_all on variants
  for all
  using (exists (select 1 from tests t where t.id = variants.test_id and t.owner_id = auth.uid()))
  with check (exists (select 1 from tests t where t.id = variants.test_id and t.owner_id = auth.uid()));

create policy voters_all on voters
  for all
  using (exists (select 1 from tests t where t.id = voters.test_id and t.owner_id = auth.uid()))
  with check (exists (select 1 from tests t where t.id = voters.test_id and t.owner_id = auth.uid()));

create policy votes_all on votes
  for all
  using (exists (select 1 from tests t where t.id = votes.test_id and t.owner_id = auth.uid()))
  with check (exists (select 1 from tests t where t.id = votes.test_id and t.owner_id = auth.uid()));

-- The anonymous voter client must never touch base tables. Revoke every privilege.
-- (Supabase grants table privileges to anon/authenticated by default.)
revoke all on profiles, tests, variants, voters, votes from anon;
