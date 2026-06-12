-- Fix for "Create match" silently failing (diagnosed 2026-06-12 with .turbo/probe-lobby-db.mjs).
-- Run once against the EXISTING project: Supabase dashboard -> SQL Editor -> paste -> Run.
-- (schema.sql has the same corrections baked in for fresh projects.)
--
-- Root causes, in the order the lobby hits them:
--   1. The tables were created without table-level grants, so every API call failed with
--      42501 "permission denied for table ..." before RLS was even consulted.
--   2. profiles had SELECT/UPDATE policies but no INSERT policy, so the lobby could never
--      create the profiles row that games.host_id / games.joiner_id reference.
--   3. username was UNIQUE, so the second anonymous "Player" would have been rejected.
--   4. The host persists the live seat map to a players column that schema.sql never created.

-- 1. Table-level grants (RLS still applies on top of these).
grant usage on schema public to anon, authenticated;
grant select, insert, update on public.profiles to anon, authenticated;
grant select, insert, update on public.games to anon, authenticated;

-- 2. profiles: allow users to create their own row (the INSERT half of the lobby's upsert).
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- 3. Display names don't need to be unique.
alter table public.profiles drop constraint if exists profiles_username_key;

-- 4. Live seat map ({white, black} per-tab session ids) the host writes with each move.
alter table public.games add column if not exists players jsonb;
