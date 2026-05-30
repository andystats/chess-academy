# Spec: Multiplayer (Vercel + Supabase), then Duck Chess

> **Status: PARKED (future work).** Not being actively pursued. Captured here so the architecture and
> setup steps are ready when/if we pick it up. Nothing in the app depends on this yet.

## Goal
Let two people play chess against each other in real time, with optional accounts. Standard chess
first; add the Duck Chess variant on top once the multiplayer foundation works.

## Decisions (locked)
- **Hosting:** Vercel (import the GitHub repo; production = `main`, preview deploys per branch/PR).
- **Backend:** Supabase — Auth + Postgres + Realtime + Edge Functions, all on the free tier.
- **Sequence:** standard-chess multiplayer first → Duck Chess variant second.
- The app stays a **Vite SPA** (no Next.js migration needed): Supabase is called from the browser
  via `@supabase/supabase-js`, and move validation runs in a Supabase Edge Function (Deno).
  GitHub Pages can stay as a mirror or be retired once Vercel is live.

## Architecture
- **Client:** existing React/Vite app. Add `@supabase/supabase-js`, a `src/lib/supabase.js` client
  built from `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (the anon key is public by design;
  Row-Level Security protects data). Reuse `BoardPanel` for the multiplayer board.
- **Auth:** Supabase Auth. Start with GitHub + Google OAuth and magic-link email. Multiplayer can
  also allow **guest play via invite link** (no account) to lower friction; accounts unlock history.
- **Data (Postgres):**
  - `profiles` (id → auth.users, display name, avatar, rating later)
  - `games` (id, white_id, black_id, `fen`, `pgn`, `turn`, `status` [waiting|active|over],
    `result`, `variant` ['standard'|'duck'], `duck_square` (for later), timestamps)
  - RLS: a player may read/write only games they're part of; anyone with the id can join a `waiting`
    game as the open color.
- **Realtime:** Supabase Realtime (Postgres change subscriptions on the `games` row) pushes the new
  position to both clients. One channel per game id.
- **Server-authoritative moves (anti-cheat):** an **Edge Function** `play-move(gameId, move)` loads
  the game, validates the move with chess.js, applies it, flips the turn, detects game end, and
  writes the row. Clients call the function (never write `fen` directly; RLS forbids it). This keeps
  the existing client-side `moves.js`/board for UX while the server is the source of truth.

## Implementation phases
1. **Foundations:** supabase client + env config; Auth (GitHub/Google/email) + `profiles`; a tiny
   "signed in as / sign out" header control. Guest mode allowed.
2. **Game lifecycle:** `games` table + RLS; "New game" creates a `waiting` game and an invite link
   (`/play/:gameId`); opening the link as a second player joins it and flips it to `active`.
3. **Realtime board:** `/play/:gameId` renders the board from the game row, subscribes to changes,
   enforces "only move on your turn / your color" client-side, shows both players + status.
4. **Server validation:** `play-move` Edge Function (chess.js) becomes the only writer of `fen`;
   client calls it; illegal/out-of-turn moves are rejected. Game-over detection + result.
5. **Polish:** resign/draw offer, reconnection (re-fetch + resubscribe), simple clocks, a "your
   games" list for signed-in users.
6. **Duck Chess variant:** custom variant logic (see below), reusing the same `games` model with
   `variant: 'duck'` and a `duck_square`. Human-vs-human only (Stockfish can't play it).

## Duck Chess notes (phase 6)
Rules: make a normal move, then place the duck on any empty square. The duck blocks all movement,
can't be captured or passed through, and must move each turn. No check/checkmate — you win by
**capturing the king**. This breaks chess.js's assumptions, so build a small variant engine:
generate piece moves treating the duck square as a universal blocker, drop the "can't move into
check" rule, add the duck-placement step, and set the win condition to king capture. The Edge
Function validates duck-chess moves with this engine instead of chess.js.

## What the owner sets up (prerequisites I can't do)
1. **Supabase project:** supabase.com → New project (free). Copy **Project URL** + **anon/public
   key** (Settings → API).
2. **Auth providers:** Auth → Providers — enable Email; for GitHub/Google, create an OAuth app and
   paste the client id/secret. Add the Vercel domain + `localhost:5173` to allowed redirect URLs.
3. **Vercel project:** import `andystats/chess-academy` (framework preset: Vite). Set env vars
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Production + Preview). The Vercel GitHub App
   needs access to this repo (separate from / no impact on the tao-rwd project).
4. Share the **Project URL + anon key** (or put them in a local `.env.local`) so I can scaffold and
   test against the live project. I provide the SQL schema + RLS + the Edge Function code to paste.

## Verification
- Two browser sessions (or two profiles) can create + join a game via the invite link and see each
  other's moves in real time.
- Illegal / out-of-turn moves are rejected by the Edge Function (verified by calling it directly).
- Game-over (checkmate/draw/resign) resolves on both clients.
- (Phase 6) A full duck-chess game can be played to a king capture.

## Risks / notes
- Vercel serverless/edge functions don't host long-lived WebSocket servers — realtime comes from
  Supabase Realtime, not a custom socket server. Good.
- The anon key in client code is expected; security comes from RLS + the validating Edge Function,
  not from hiding the key.
- Keep single-player (lessons/arena) fully working and backend-free; multiplayer is additive.
