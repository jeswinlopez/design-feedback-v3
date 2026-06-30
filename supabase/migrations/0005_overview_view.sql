-- 0005_overview_view.sql — admin dashboard aggregate per test.
-- invited/voted counts for completion, plus enough vote distribution to compute the
-- leaning indicator client-side: decisive_n (votes with a definite pick) and top_count
-- (largest single-variant tally). For v1's exactly-2 variants, the runner-up tally is
-- decisive_n - top_count. security_invoker=on keeps owner-only RLS in force.

create or replace view admin_test_overview
with (security_invoker = on) as
select
  t.*,
  coalesce(vi.invited, 0)      as invited_count,
  coalesce(vo.voted, 0)        as voted_count,
  coalesce(agg.decisive_n, 0)  as decisive_n,
  coalesce(agg.top_count, 0)   as top_count
from tests t
left join (select test_id, count(*) as invited from voters group by test_id) vi on vi.test_id = t.id
left join (select test_id, count(*) as voted   from votes  group by test_id) vo on vo.test_id = t.id
left join lateral (
  select coalesce(sum(cnt), 0) as decisive_n, coalesce(max(cnt), 0) as top_count
  from (
    select count(*) as cnt
    from votes v
    where v.test_id = t.id and v.no_preference = false and v.variant_id is not null
    group by v.variant_id
  ) per
) agg on true;

revoke all on admin_test_overview from anon;
grant select on admin_test_overview to authenticated;
