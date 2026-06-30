# Security & integrity

Design Face-Off is built around a small set of integrity guarantees. These must all hold.

## Integrity checklist

1. **One token → at most one vote.** Enforced at the database level by a `UNIQUE` constraint
   on `votes.voter_id`, **and** by burning the token (`voters.voted_at` is set in the same
   atomic `app_cast_vote` transaction). A used or unknown token is rejected with a typed error.

2. **`anon` has zero base-table access.** RLS is enabled on every table with default-deny, and
   all base-table privileges are revoked from `anon`. The anonymous voter client talks **only**
   to the `get_ballot` / `cast_vote` Edge Functions — never to base tables or to the SQL RPCs
   directly (those are revoked from `anon`/`authenticated` and granted only to `service_role`).

3. **The service role key never reaches the client.** It lives only in the Edge Function
   runtime and in the server-side seed script. The frontend uses the publishable/anon key only.
   No `VITE_` variable contains the service role key.

4. **Signed Storage URLs only; bucket private.** The `designs` bucket is not public. Voters
   receive short-TTL signed URLs minted inside `get_ballot` with the service role. Admins
   access their own objects via owner-scoped Storage RLS.

5. **Position order is balanced, recorded, and server-derived.** The shown order is computed
   deterministically from the token (`sha256(token)` parity) inside the database. `cast_vote`
   recomputes it server-side and records `shown_first_variant_id` — the client-reported order is
   never trusted, so position-correction can't be spoofed. When `randomize_position` is off, the
   results view suppresses position correction instead of dividing by an empty cell.

6. **Voters never see the running tally.** `get_ballot` returns ballot data only; `cast_vote`
   returns success or a typed error. Neither returns aggregates. The post-vote screen shows a
   thank-you with no result (anti-herding).

7. **Activating a test locks variants and the panel.** Once a test is `active` (or `closed`),
   the UI blocks edits to designs, the panel, and the integrity-affecting toggles, and warns
   that post-activation edits would invalidate collected data.

## Access model

- **Admins** authenticate via Supabase Auth (email magic link). Authorization is **seed-only**:
  a `profiles` row with `role = 'admin'` is created only by the seed script or manually. A
  magic-link login by an email without an admin `profiles` row receives no access (RLS + a
  route guard both deny it). There is no self-service admin signup.

- **Voters** have no accounts. Each gets one cryptographically-random, URL-safe single-use
  token (256 bits of entropy), unique per `(test, email)` and globally unique.

## Reporting

This is an internal tool. Report any integrity concern to the repository owner.
