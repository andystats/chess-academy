// Supabase client for the online arena. We use ONLY Realtime Broadcast + Presence on a public channel
// (no database, no Auth, no RLS) — see docs/future-multiplayer-and-duck-chess.md. The anon key is
// public by design (it ships in the client bundle); security for a two-friends game comes from the
// game id in the invite link, not from hiding the key.
//
// Both env vars are optional: when they're absent (local dev without a project, CI, unit tests) the
// client is null and `isRealtimeConfigured` is false, so the online UI degrades to a friendly notice
// instead of crashing and the rest of the app is unaffected.

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isRealtimeConfigured = Boolean(url && anonKey);

export const supabase = isRealtimeConfigured ? createClient(url, anonKey) : null;
