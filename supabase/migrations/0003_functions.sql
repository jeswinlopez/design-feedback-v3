-- 0003_functions.sql — voter-path logic in SECURITY DEFINER functions (§7)
-- These hold the integrity rules. The Edge Functions call them with the service role
-- and add only signed-URL minting on top. Shown order is ALWAYS derived here from the
-- token — never trusted from the client.

-- Which variant is shown first, deterministically from the token (§4).
-- randomize_position=false => fixed A-then-B (by sort_index). Balanced across the panel.
create or replace function app_shown_first_variant(p_token text, p_test_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_randomize boolean;
  v_ids       uuid[];
  v_parity    int;
begin
  select randomize_position into v_randomize from tests where id = p_test_id;
  select array_agg(id order by sort_index) into v_ids from variants where test_id = p_test_id;

  if v_ids is null or array_length(v_ids, 1) < 2 then
    return v_ids[1];
  end if;

  if not coalesce(v_randomize, true) then
    return v_ids[1];
  end if;

  -- first byte of sha256(token), parity decides order. Identical computation is not
  -- needed anywhere else: only the DB derives order, so there is nothing to diverge.
  v_parity := get_byte(extensions.digest(p_token, 'sha256'), 0) % 2;
  if v_parity = 0 then
    return v_ids[1];
  else
    return v_ids[2];
  end if;
end;
$$;

-- Effective open state: same rule used by the voter path and the admin dashboard (§9/§10).
-- Active, not past auto-close time, and under the vote threshold (counts all votes).
-- SECURITY INVOKER: only ever called from the SECURITY DEFINER functions above (which
-- run as their owner), so it inherits their access there. Not exposed to signed-in users.
create or replace function effective_is_open(p_test_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select t.status = 'active'
     and (t.auto_close_at is null or now() < t.auto_close_at)
     and (t.close_vote_threshold is null
          or (select count(*) from votes v where v.test_id = t.id) < t.close_vote_threshold)
  from tests t
  where t.id = p_test_id;
$$;

-- Ballot data (no signed URLs — the Edge Function mints those). Variants are returned
-- in token-deterministic order. Never leaks other voters, emails, or the tally.
create or replace function app_ballot_data(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_voter    voters;
  v_test     tests;
  v_first    uuid;
  v_variants jsonb;
begin
  select * into v_voter from voters where token = p_token;
  if not found then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  select * into v_test from tests where id = v_voter.test_id;
  v_first := app_shown_first_variant(p_token, v_test.id);

  select jsonb_agg(
           jsonb_build_object(
             'id', id, 'label', label, 'image_path', image_path, 'caption', caption
           )
           order by (case when id = v_first then 0 else 1 end), sort_index
         )
    into v_variants
    from variants
   where test_id = v_test.id;

  return jsonb_build_object(
    'test', jsonb_build_object(
      'title', v_test.title,
      'description', v_test.description,
      'status', v_test.status,
      'forced_choice', v_test.forced_choice,
      'collect_rationale', v_test.collect_rationale
    ),
    'variants', coalesce(v_variants, '[]'::jsonb),
    'already_voted', v_voter.voted_at is not null,
    'is_open', effective_is_open(v_test.id)
  );
end;
$$;

-- Cast a vote atomically. Validates token/state/choice, derives shown order from the
-- token, inserts the vote and burns the token. Returns ok or a typed error.
create or replace function app_cast_vote(
  p_token         text,
  p_variant_id    uuid,
  p_no_preference boolean,
  p_rationale     text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_voter voters;
  v_test  tests;
  v_first uuid;
  v_var   uuid := p_variant_id;
begin
  select * into v_voter from voters where token = p_token for update;
  if not found then
    return jsonb_build_object('status', 'error', 'code', 'invalid_token');
  end if;

  select * into v_test from tests where id = v_voter.test_id for update;

  if v_voter.voted_at is not null
     or exists (select 1 from votes where voter_id = v_voter.id) then
    return jsonb_build_object('status', 'error', 'code', 'already_voted');
  end if;

  if not effective_is_open(v_test.id) then
    return jsonb_build_object('status', 'error', 'code', 'test_closed');
  end if;

  -- choice validation
  if coalesce(p_no_preference, false) then
    if v_test.forced_choice then
      return jsonb_build_object('status', 'error', 'code', 'invalid_choice');
    end if;
    v_var := null;
  else
    if v_var is null
       or not exists (select 1 from variants where id = v_var and test_id = v_test.id) then
      return jsonb_build_object('status', 'error', 'code', 'invalid_choice');
    end if;
  end if;

  v_first := app_shown_first_variant(p_token, v_test.id);

  insert into votes (test_id, voter_id, variant_id, no_preference, rationale, shown_first_variant_id)
  values (v_test.id, v_voter.id, v_var, coalesce(p_no_preference, false),
          nullif(btrim(coalesce(p_rationale, '')), ''), v_first);

  update voters set voted_at = now() where id = v_voter.id;

  return jsonb_build_object('status', 'ok');
end;
$$;

-- Defense in depth: the voter functions are only ever called by the service role
-- (Edge Functions). Keep them off the client roles entirely.
revoke all on function app_ballot_data(text)            from anon, authenticated, public;
revoke all on function app_cast_vote(text, uuid, boolean, text) from anon, authenticated, public;
revoke all on function app_shown_first_variant(text, uuid)      from anon, authenticated, public;
revoke all on function effective_is_open(uuid)          from anon, authenticated, public;

grant execute on function app_ballot_data(text)                 to service_role;
grant execute on function app_cast_vote(text, uuid, boolean, text) to service_role;
grant execute on function app_shown_first_variant(text, uuid)   to service_role;
grant execute on function effective_is_open(uuid)               to service_role;
