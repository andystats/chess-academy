// Supabase client for the online arena. We use:
// 1. Realtime Broadcast + Presence for "live" game sync.
// 2. Database (Postgres) for the game lobby and persistence.
// 3. Auth for user profiles and seat locking.
//
// The anon key is public by design (it ships in the client bundle); security comes from
// Row-Level Security (RLS) policies defined in supabase/schema.sql.
//
// Both env vars are optional: when they're absent (local dev without a project, CI, unit tests) the
// client is null and `isRealtimeConfigured` is false, so the online UI degrades to a friendly notice
// instead of crashing and the rest of the app is unaffected.

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isRealtimeConfigured = Boolean(url && anonKey);

export const supabase = isRealtimeConfigured ? createClient(url, anonKey) : null;
