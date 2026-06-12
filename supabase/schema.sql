-- SQL Schema for Chess Academy Online Arena (Supabase)
-- This implements the "planned lobby" described in docs/future-multiplayer-and-duck-chess.md

-- 1. Profiles: Linked to Supabase Auth users
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  avatar_url text,
  updated_at timestamp with time zone default now()
);

-- RLS for Profiles
alter table public.profiles enable row level security;
create policy "Public profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- 2. Games: The core game state and lifecycle
create type game_status as enum ('waiting', 'active', 'completed');
create type chess_variant as enum ('standard', 'duck');

create table public.games (
  id uuid primary key default gen_random_uuid(),
  variant chess_variant not null default 'standard',
  host_id uuid references public.profiles(id) not null,
  joiner_id uuid references public.profiles(id),
  host_color text not null check (host_color in ('white', 'black')),
  status game_status not null default 'waiting',
  
  -- Autoritative state: wire-serialized string (FEN superset)
  state text not null,
  seq bigint not null default 1,
  epoch bigint not null default 0,
  
  -- Metadata
  result jsonb, -- { winner: 'white' | 'black' | 'draw', reason: string }
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- RLS for Games
alter table public.games enable row level security;
create policy "Games are viewable by everyone" on public.games for select using (true);
create policy "Authenticated users can create games" on public.games for insert with check (auth.uid() = host_id);
create policy "Joiners can join waiting games" on public.games for update
  using (status = 'waiting' and joiner_id is null)
  with check (auth.uid() = joiner_id);

-- Note: Move updates should ideally go through a Supabase Edge Function to prevent spoofing,
-- but for a trust-based "play a friend" model, we can allow the current side-to-move to update.
-- This policy is simplified:
create policy "Players can update their own games" on public.games for update
  using (auth.uid() in (host_id, joiner_id));

-- 3. Presence & Realtime: 
-- We still use Realtime for the "live" feel, but the Database is the source of truth.
-- Enabling Realtime for the 'games' table allows clients to subscribe to row changes.
alter publication supabase_realtime add table games;
