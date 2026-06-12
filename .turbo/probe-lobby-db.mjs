// Diagnostic probe for the database-backed lobby (node .turbo/probe-lobby-db.mjs).
// Exercises the exact calls OnlineLobbyPage makes — anonymous sign-in, profile upsert,
// game insert — against the live Supabase project using the anon key from .env.local,
// and prints each raw response so RLS/schema failures are visible instead of swallowed.
import { readFileSync } from 'node:fs';

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(
  envText
    .split('\n')
    .filter((line) => line.includes('='))
    .map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim()]),
);

const BASE = env.VITE_SUPABASE_URL;
const ANON = env.VITE_SUPABASE_ANON_KEY;
if (!BASE || !ANON) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

async function step(label, path, options) {
  const res = await fetch(`${BASE}${path}`, options);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  console.log(`\n--- ${label} -> HTTP ${res.status}`);
  console.log(JSON.stringify(body, null, 2).slice(0, 1200));
  return { status: res.status, body };
}

// 1. Anonymous sign-in (what supabase.auth.signInAnonymously() does under the hood).
const signup = await step('1. anonymous sign-in', '/auth/v1/signup', {
  method: 'POST',
  headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({}),
});
const token = signup.body?.access_token;
const uid = signup.body?.user?.id;
if (!token) {
  console.log('\nRESULT: anonymous sign-in FAILED — enable it under Auth > Sign In / Up > Anonymous.');
  process.exit(0);
}

const authed = {
  apikey: ANON,
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
};

// 2. Profile upsert (what initLobby does).
await step('2. profiles upsert', '/rest/v1/profiles?on_conflict=id', {
  method: 'POST',
  headers: { ...authed, Prefer: 'resolution=merge-duplicates,return=representation' },
  body: JSON.stringify({ id: uid, username: `probe-${uid.slice(0, 8)}` }),
});

// 3. Game insert (what createGame does).
const game = await step('3. games insert', '/rest/v1/games', {
  method: 'POST',
  headers: { ...authed, Prefer: 'return=representation' },
  body: JSON.stringify({
    variant: 'standard',
    host_id: uid,
    host_color: 'white',
    status: 'waiting',
    state: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    epoch: Date.now(),
  }),
});

// 4. Cleanup — don't leave a probe game in everyone's lobby list.
const gameId = Array.isArray(game.body) ? game.body[0]?.id : game.body?.id;
if (gameId) {
  await step('4. cleanup (mark probe game completed)', `/rest/v1/games?id=eq.${gameId}`, {
    method: 'PATCH',
    headers: { ...authed, Prefer: 'return=representation' },
    body: JSON.stringify({ status: 'completed' }),
  });
}

// 5. The lobby list query (what fetchGames does), including the FK embed.
await step(
  '5. lobby list query (FK embed)',
  '/rest/v1/games?select=*,host:host_id(username,avatar_url)&status=eq.waiting&order=created_at.desc',
  { method: 'GET', headers: authed },
);
