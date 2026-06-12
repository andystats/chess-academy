// Auth + profile glue for the database-backed lobby (OnlineLobbyPage, OnlinePlayPage).
//
// Every lobby write hangs off a Supabase auth user: games.host_id and games.joiner_id are foreign
// keys into public.profiles, which itself references auth.users. So before touching the games
// table a page must (1) hold an auth session — anonymous sign-in, reused across reloads from
// localStorage — and (2) own a profiles row, or the foreign key rejects the games write outright.
// Step 2 failing silently was exactly the "Create match does nothing" bug; callers must surface
// the returned error, never swallow it.

import { supabase } from '../lib/supabase.js';

const USERNAME_MAX = 20; // mirrors the local profile-name cap in ProfileContext

/**
 * Ensure an authenticated (anonymous) session and a matching profiles row.
 * Returns { user, error }: `user` is null only when sign-in itself failed; `error` is a
 * { message, hint } pair ready for the UI — `hint` says how to fix the project config.
 */
export async function ensureSessionAndProfile({ username, avatar } = {}) {
  const { data } = await supabase.auth.getSession();
  let user = data?.session?.user ?? null;

  if (!user) {
    const { data: signIn, error } = await supabase.auth.signInAnonymously();
    if (error) {
      return {
        user: null,
        error: {
          message: error.message,
          hint: 'Enable anonymous sign-ins in the Supabase dashboard under Authentication.',
        },
      };
    }
    user = signIn.user;
  }

  const { error } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      username: (username || '').trim().slice(0, USERNAME_MAX) || 'Player',
      avatar_url: avatar || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  if (error) {
    return {
      user,
      error: {
        message: error.message,
        hint: error.hint || 'Run supabase/fix-lobby-grants.sql in the Supabase SQL editor.',
      },
    };
  }

  return { user, error: null };
}
