# CLAUDE.md

Guidance for working in this repo.

## What this is

**Design Face-Off** — an internal **stated-preference** testing tool. An admin uploads two
design variants (A/B) per test, imports an internal panel, mints one single-use token per
voter (`/vote/:token`), and reads results (split, position-corrected split, rationale,
segments, completion). It is **directional signal, not live-traffic A/B testing** — never
present vote share as a conversion or statistical-significance claim anywhere in the UI.

## Commands

```bash
npm install
npm run dev        # Vite dev server on :5173
npm run build      # tsc -b (typecheck) + vite build
npm run typecheck  # tsc -b --noEmit
npm run seed       # supabase/seed.mjs — needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env
```

There is no test runner. Verify changes with `npm run build` (it typechecks) and by running
the app. `strict` + `noUnusedLocals`/`noUnusedParameters` are on — unused imports fail the build.

## Stack

Vite + React 18 + TypeScript, Tailwind, shadcn-style UI primitives (hand-written in
`src/components/ui`), React Router, TanStack Query, Zod, Recharts. Backend is Supabase
(Postgres, Auth/magic-link, Storage, RLS, two Edge Functions). Deployed on Vercel.

## Architecture

Two hard-separated portals:

- **Admin** `/admin/*` — Supabase Auth + RLS. Gated by `AuthProvider` (`src/lib/auth.tsx`) +
  `AdminLayout`. Talks to base tables directly through the **anon** client (RLS scopes rows).
- **Voter** `/vote/:token` — public, token-gated, minimal shell. Talks **only** to the two
  Edge Functions, never to base tables.

Voter path: `get_ballot` / `cast_vote` Edge Functions (run with the **service role**) wrap
`SECURITY DEFINER` SQL (`app_ballot_data`, `app_cast_vote`) that holds the integrity rules.
`get_ballot` additionally mints short-TTL **signed Storage URLs** (the `designs` bucket is
private). The Edge functions are thin — put logic in the SQL functions.

```
src/
  lib/         supabase (anon client only), auth, ballotApi (edge fetch), config (leaning
               thresholds + upload limits), types, utils (csv/date/pct), queryClient
  components/  ui/ primitives + StatusBadge / LeaningBadge / Spinner
  features/admin/  LoginPage, DashboardPage, TestEditorPage, ResultsPage, + api.ts (all
                   Supabase reads/writes), results.ts (pure result math)
  features/voter/  BallotPage (state machine), DesignChoice, ConfirmStep, BallotStateScreen
  routes/      AdminLayout (auth guard), VoterLayout (minimal)
supabase/
  migrations/  0001 schema · 0002 RLS+grants · 0003 functions · 0004 storage · 0005 view
  functions/   get_ballot, cast_vote (Deno; self-contained, inline cors/json helpers)
  seed.mjs     demo admin + active test + generated placeholder PNGs + voters
```

The live Supabase project ref is `malnyatixnjtuzfswkfu`. Apply schema changes as new
migration files in `supabase/migrations/` (and via the Supabase MCP `apply_migration` /
`supabase db push`). Edge functions deploy via the MCP `deploy_edge_function` or
`supabase functions deploy <name>` (keep `verify_jwt` on — the client calls them with the
anon key).

## Invariants — do not break these (see SECURITY.md §13)

1. **One token → one vote.** Enforced by `UNIQUE(votes.voter_id)` **and** token burn
   (`voters.voted_at`) inside the atomic `app_cast_vote`. Don't add a vote path that bypasses it.
2. **`anon` has zero base-table access.** RLS default-deny everywhere; all base-table privileges
   revoked from `anon`. The voter path is Edge-Functions-only. Never grant anon table/RPC access.
3. **Service role key never reaches the client.** Client uses the publishable/anon key only
   (`src/lib/supabase.ts`). Service role lives only in Edge Functions + `seed.mjs`.
4. **Signed Storage URLs only; `designs` bucket stays private.** Minted in `get_ballot`.
5. **Shown order is derived server-side from the token** (`app_shown_first_variant`,
   `sha256(token)` parity) and recorded on the vote. Never trust a client-supplied order.
6. **Voters never see the tally.** `get_ballot`/`cast_vote` never return aggregates; the
   post-vote screen shows no result (anti-herding).
7. **Admins are seed-only.** A `profiles` row with `role='admin'` is the gate; there is no
   self-service signup. Adding an admin = create the `auth.users` row + a `profiles` row.

## Project-specific gotchas

- **pgcrypto lives in the `extensions` schema** on Supabase, not `public`. SQL functions pin
  `search_path`, so qualify calls (`extensions.digest(...)`). `app_gen_token` avoids pgcrypto
  entirely (two `gen_random_uuid()`s) to stay dependency-free.
- **`effective_is_open` is `SECURITY INVOKER`** and only called from the `SECURITY DEFINER`
  voter functions (so it inherits their access); it is not exposed to client roles.
- **Leaning thresholds and upload limits live in one place:** `src/lib/config.ts`
  (`classifyLeaning`, `LEANING_CONFIG`, `UPLOAD`). Tune there; never surface p-values.
- **v1 enforces exactly 2 variants.** Result math assumes it (runner-up tally =
  `decisive_n - top_count`). The schema is N-variant-friendly but the UI/stats are not.
- **`.env.production`** holds client-safe Supabase config so Vercel builds work without env
  setup; Vercel-set env vars override it. Never put the service role key in any `VITE_` var.
- Client env access is typed in `src/vite-env.d.ts`.

## Out of scope for v1 (schema left friendly, but don't build without asking)

Figma/prototype embeds, N>2 variants in the UI, heatmaps/pins, confidence sliders, a real
significance engine, multi-admin roles/permissions, in-app email sending, reusable cross-test
panels.
