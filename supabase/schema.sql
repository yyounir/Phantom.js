-- Phantom.js — Supabase schema for saved hunts ("the Grimoire").
-- Run once in your Supabase project's SQL editor (or `supabase db push`).
--
-- The full HuntResult (call graph + suspects + Hunter/Skeptic traces + FinOps)
-- is stored as jsonb so the detail view can reproduce it exactly. Summary
-- columns are projected for fast list rendering.

create extension if not exists "pgcrypto";

create table if not exists public.hunts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  repo_kind text not null,                -- "local" | "github"
  repo_ref text not null,                  -- branch/path or local path
  repo_url text,                            -- null for local scans

  files_scanned integer not null,
  dead_count integer not null,
  uncertain_count integer not null,
  alive_count integer not null,
  sandbox_safe boolean not null,
  projected_savings_usd numeric not null default 0,
  removed_bundle_kb numeric not null default 0,

  status text not null default 'saved',    -- "saved" | "approved" | "archived"
  notes text,

  result jsonb not null                     -- the full HuntResult
);

create index if not exists hunts_created_at_idx on public.hunts (created_at desc);

-- The Next.js API uses the SERVICE ROLE key, which bypasses RLS, so no policies
-- are required for server-side writes. If you'd rather call Supabase from the
-- browser with the anon key, enable RLS and add permissive policies:
--
-- alter table public.hunts enable row level security;
-- create policy "read all"   on public.hunts for select using (true);
-- create policy "insert all"  on public.hunts for insert with check (true);
-- create policy "update all"  on public.hunts for update using (true);
-- create policy "delete all"  on public.hunts for delete using (true);
