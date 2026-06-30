-- 0001_schema.sql — Design Face-Off core schema (§5)
-- N-variant-friendly, but v1 enforces exactly 2 variants per test in the app layer.

create extension if not exists pgcrypto;

-- URL-safe single-use voter token (>= 32 bytes entropy). Used as a column default
-- so tokens are minted server-side; runs as the inserting (authenticated admin) role.
-- 256 bits of entropy as URL-safe hex (two random v4 UUIDs). Uses only core
-- gen_random_uuid(), so it runs fine as the inserting (authenticated) role with no
-- extension-schema or SECURITY DEFINER concerns.
create or replace function app_gen_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
$$;
revoke all on function app_gen_token() from anon, public;
grant execute on function app_gen_token() to authenticated;

-- profiles — one row per admin (seed-only; no self-signup trigger).
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  name       text,
  role       text not null default 'admin',
  created_at timestamptz not null default now()
);

-- tests
create table tests (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null references profiles(id) on delete cascade,
  title                text not null,
  description          text,
  status               text not null default 'draft' check (status in ('draft', 'active', 'closed')),
  forced_choice        boolean not null default true,
  collect_rationale    boolean not null default true,
  randomize_position   boolean not null default true,
  recruitment_note     text,
  auto_close_at        timestamptz,
  close_vote_threshold int,
  created_at           timestamptz not null default now(),
  activated_at         timestamptz,
  closed_at            timestamptz
);

-- variants (exactly 2 per test in v1: labels 'A' and 'B')
create table variants (
  id         uuid primary key default gen_random_uuid(),
  test_id    uuid not null references tests(id) on delete cascade,
  label      text check (label in ('A', 'B')),
  image_path text,
  caption    text,
  sort_index int not null default 0,
  created_at timestamptz not null default now()
);

-- voters (no accounts; one minted token each)
create table voters (
  id         uuid primary key default gen_random_uuid(),
  test_id    uuid not null references tests(id) on delete cascade,
  email      text not null,
  name       text,
  segment    text,
  token      text not null unique default app_gen_token(),
  invited_at timestamptz,
  voted_at   timestamptz,
  created_at timestamptz not null default now(),
  unique (test_id, email)
);

-- votes (one per voter, enforced unique; choice/no-preference invariant enforced)
create table votes (
  id                     uuid primary key default gen_random_uuid(),
  test_id                uuid not null references tests(id) on delete cascade,
  voter_id               uuid not null unique references voters(id) on delete cascade,
  variant_id             uuid references variants(id),
  no_preference          boolean not null default false,
  rationale              text,
  shown_first_variant_id uuid references variants(id),
  created_at             timestamptz not null default now(),
  constraint vote_choice_chk check (
    (no_preference and variant_id is null) or
    (not no_preference and variant_id is not null)
  )
);

create index voters_test_id_idx on voters(test_id);
create index variants_test_id_idx on variants(test_id);
create index votes_test_id_idx on votes(test_id);
create index votes_variant_id_idx on votes(variant_id);
