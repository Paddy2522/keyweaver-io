-- Migration: captio auth additions
-- Run this in the Supabase SQL editor

-- ── 1. magic_link_tokens ─────────────────────────────────────────────────────
-- Short-lived tokens for passwordless sign-in

create table if not exists magic_link_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  used        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Index for fast lookup by token hash
create index if not exists magic_link_tokens_token_hash_idx
  on magic_link_tokens (token_hash);

-- Auto-clean expired tokens (requires pg_cron extension — optional)
-- select cron.schedule('clean-magic-tokens', '0 * * * *',
--   $$ delete from magic_link_tokens where expires_at < now() $$);

-- ── 2. stripe_customer_id on profiles ────────────────────────────────────────
-- Cache Stripe customer IDs to avoid repeated list() calls

alter table profiles
  add column if not exists stripe_customer_id text;

create index if not exists profiles_stripe_customer_id_idx
  on profiles (stripe_customer_id)
  where stripe_customer_id is not null;

-- ── 3. password fields on profiles ───────────────────────────────────────────
-- Only needed if profiles doesn't already have these from Keyweaver auth

alter table profiles
  add column if not exists password_hash text,
  add column if not exists password_salt text;

-- ── Row-level security ────────────────────────────────────────────────────────
-- magic_link_tokens: only the service role can read/write (all access via backend)
alter table magic_link_tokens enable row level security;

-- ── 4. Allow Cuemark monthly tier (optional — code also works via billing_cycle) ──
-- Run if you want profiles.tier = captio_monthly instead of spark + billing fields.

alter table profiles drop constraint if exists profiles_tier_check;
alter table profiles add constraint profiles_tier_check
  check (tier in ('spark', 'studio', 'director', 'team', 'agency', 'captio_monthly'));
