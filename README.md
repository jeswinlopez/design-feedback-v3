# Design Face-Off

An internal tool for running **preference tests** on design options. An admin uploads two
design variants (A/B) for a test, imports a known internal panel, and hands each panelist a
unique single-use link. Each panelist views both designs and picks one (with an optional
reason). The admin sees results: vote split, position-corrected split, reasons, completion
rate, and a per-segment breakdown.

> This is **stated-preference testing, not live-traffic A/B testing.** Treat results as
> directional signal. The UI never presents vote share as a conversion or significance claim.

## Stack

- **Frontend:** Vite + React + TypeScript, Tailwind, shadcn-style UI primitives, React Router,
  TanStack Query, Zod, Recharts.
- **Backend:** Supabase — Postgres, Auth (magic link), Storage, Row Level Security, two
  `SECURITY DEFINER` RPCs, and two Edge Functions for the voter path.
- **Hosting target:** Vercel (frontend) + Supabase cloud.

## Architecture at a glance

- **Admin portal** `/admin/*` — Supabase Auth + RLS. Seeded admins only.
- **Voter portal** `/vote/:token` — public, token-gated, minimal shell. Talks **only** to two
  Edge Functions; never to base tables.
- **Voter path:** `get_ballot` and `cast_vote` Edge Functions run with the service role. They
  call `SECURITY DEFINER` SQL (`app_ballot_data`, `app_cast_vote`) that holds the integrity
  rules, and `get_ballot` additionally mints short-TTL **signed Storage URLs** (the `designs`
  bucket is private). Shown order is derived from the token **server-side** and is never
  trusted from the client.

```
src/
  lib/         supabase client (anon only), auth, ballot API, config (leaning thresholds), types
  components/  UI primitives + shared badges/spinner/toast
  features/admin/   login, dashboard, test editor (settings, uploads, panel, lifecycle), results
  features/voter/   ballot (4 states), design choice, confirm step, thank-you
  routes/      AdminLayout (auth guard), VoterLayout (minimal)
supabase/
  migrations/  0001 schema · 0002 RLS+grants · 0003 functions · 0004 storage · 0005 overview view
  functions/   get_ballot, cast_vote (Deno Edge Functions)
  seed.mjs     demo admin + active test + 2 placeholder designs + ~8 voters
```

## 1. Supabase project setup

1. Create a Supabase project (or use an existing empty one).
2. Note the **Project URL**, the **publishable/anon key** (client-safe), and the
   **service role key** (server-only — never expose to the browser).

## 2. Run the migrations

Using the Supabase CLI from the repo root:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push          # applies supabase/migrations in order
```

Or paste each file in `supabase/migrations/` into the SQL editor in order. The migrations
create the schema, enable RLS with owner-scoped policies, revoke all base-table access from
`anon`, define the voter-path functions, create the private `designs` bucket, and add the
dashboard overview view.

## 3. Deploy the Edge Functions

```bash
supabase functions deploy get_ballot
supabase functions deploy cast_vote
```

Both keep `verify_jwt` on — the frontend calls them with the anon/publishable key. They read
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the function runtime (injected by Supabase).

## 4. Environment variables (frontend)

Copy `.env.example` to `.env.local` and fill in **client-safe** values only:

```
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

The service role key must **never** appear in any `VITE_` variable or in client code.

## 5. Seed demo data (optional)

Creates a demo admin you can log in as, an active test with two placeholder designs, and ~8
voters with links. Run it where Supabase is reachable, with server-only keys:

```bash
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY \
DEMO_ADMIN_EMAIL=you@yourcompany.com \
APP_ORIGIN=http://localhost:5173 \
npm run seed
```

It prints the `/vote/:token` links and the admin email. Sign in at `/login` with that email
via magic link.

> **Adding an admin without the seed:** admins are seed-only. Create the auth user (Supabase
> dashboard → Authentication → Add user, or `auth.admin.createUser`), then insert a matching
> `profiles` row with `role = 'admin'`. A magic-link login by an email without an admin
> `profiles` row gets no access.

## 6. Local development

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
```

## 7. Deploy to Vercel

1. Import the repo in Vercel. Framework preset: **Vite**.
2. Set env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Production + Preview).
3. Deploy. Add a rewrite so client-side routes resolve to `index.html` (see `vercel.json`).
4. In Supabase Auth → URL configuration, add your Vercel domain to the allowed redirect URLs
   so magic links return correctly.

## Notes

- Dark mode is not built for v1. The app is fully responsive; the voter ballot is mobile-first.
- Out of scope for v1 (schema left friendly to them): clickable-prototype/Figma embeds,
  N>2 variants in the UI, heatmaps/pins, confidence sliders, a real significance engine,
  multi-admin roles, in-app email sending, reusable cross-test panels.

See `SECURITY.md` for the integrity guarantees.
