import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureSessionAndProfile, loadDisplayName, saveDisplayName } from './lobbyApi.js';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInAnonymously: vi.fn(),
  signOut: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('../lib/supabase.js', () => ({
  isRealtimeConfigured: true,
  supabase: {
    auth: {
      getSession: mocks.getSession,
      signInAnonymously: mocks.signInAnonymously,
      signOut: mocks.signOut,
    },
    from: vi.fn(() => ({ upsert: mocks.upsert })),
  },
}));

// Postgres foreign_key_violation, as PostgREST reports it — the signature of a session whose
// auth user no longer exists (e.g. after a free-project pause/restore dropped anonymous users).
const FK_VIOLATION = {
  code: '23503',
  message: 'insert or update on table "profiles" violates foreign key constraint "profiles_id_fkey"',
};

beforeEach(() => {
  mocks.getSession.mockReset().mockResolvedValue({ data: { session: null } });
  mocks.signInAnonymously.mockReset().mockResolvedValue({ data: { user: { id: 'anon-1' } }, error: null });
  mocks.signOut.mockReset().mockResolvedValue({ error: null });
  mocks.upsert.mockReset().mockResolvedValue({ error: null });
});

describe('ensureSessionAndProfile', () => {
  it('reuses an existing auth session without signing in again', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'existing-1' } } } });

    const { user, error } = await ensureSessionAndProfile({ username: 'Andy' });

    expect(error).toBeNull();
    expect(user.id).toBe('existing-1');
    expect(mocks.signInAnonymously).not.toHaveBeenCalled();
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'existing-1', username: 'Andy' }),
      { onConflict: 'id' },
    );
  });

  it('signs in anonymously when there is no session', async () => {
    const { user, error } = await ensureSessionAndProfile();

    expect(error).toBeNull();
    expect(user.id).toBe('anon-1');
    expect(mocks.signInAnonymously).toHaveBeenCalledOnce();
  });

  it('reports a sign-in failure with a config hint and no user', async () => {
    mocks.signInAnonymously.mockResolvedValue({
      data: { user: null },
      error: { message: 'Anonymous sign-ins are disabled' },
    });

    const { user, error } = await ensureSessionAndProfile();

    expect(user).toBeNull();
    expect(error.message).toBe('Anonymous sign-ins are disabled');
    expect(error.hint).toMatch(/anonymous sign-ins/i);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('surfaces a profile upsert failure instead of swallowing it', async () => {
    mocks.upsert.mockResolvedValue({
      error: { message: 'permission denied for table profiles', hint: 'GRANT INSERT ON public.profiles' },
    });

    const { user, error } = await ensureSessionAndProfile();

    expect(user.id).toBe('anon-1'); // auth succeeded; only the profile row failed
    expect(error.message).toMatch(/permission denied/);
    expect(error.hint).toMatch(/GRANT INSERT/);
  });

  it('falls back to the upsert fix-file hint when the API gives none', async () => {
    mocks.upsert.mockResolvedValue({ error: { message: 'permission denied for table profiles' } });

    const { error } = await ensureSessionAndProfile();

    expect(error.hint).toMatch(/fix-lobby-grants\.sql/);
  });

  it('heals a stale restored session: signs out and retries once when the auth user is gone', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'stale-1' } } } });
    mocks.upsert.mockResolvedValueOnce({ error: FK_VIOLATION });

    const { user, error } = await ensureSessionAndProfile({ username: 'Andy' });

    expect(error).toBeNull();
    expect(user.id).toBe('anon-1');
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(mocks.signInAnonymously).toHaveBeenCalledOnce();
    expect(mocks.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'anon-1', username: 'Andy' }),
      { onConflict: 'id' },
    );
  });

  it('surfaces a FK failure from a fresh sign-in instead of retrying', async () => {
    mocks.upsert.mockResolvedValue({ error: FK_VIOLATION });

    const { user, error } = await ensureSessionAndProfile();

    expect(user.id).toBe('anon-1');
    expect(error.message).toMatch(/foreign key/);
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.signInAnonymously).toHaveBeenCalledOnce();
  });

  it('reports the sign-in hint when the healing retry cannot sign back in', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'stale-1' } } } });
    mocks.upsert.mockResolvedValueOnce({ error: FK_VIOLATION });
    mocks.signInAnonymously.mockResolvedValue({
      data: { user: null },
      error: { message: 'Anonymous sign-ins are disabled' },
    });

    const { user, error } = await ensureSessionAndProfile();

    expect(user).toBeNull();
    expect(error.hint).toMatch(/anonymous sign-ins/i);
    expect(mocks.upsert).toHaveBeenCalledOnce(); // no second upsert without a fresh user
  });

  it('defaults blank usernames to Player and caps long ones', async () => {
    await ensureSessionAndProfile({ username: '   ' });
    expect(mocks.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({ username: 'Player' }),
      { onConflict: 'id' },
    );

    await ensureSessionAndProfile({ username: 'x'.repeat(40) });
    expect(mocks.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({ username: 'x'.repeat(20) }),
      { onConflict: 'id' },
    );
  });
});

describe('display name persistence', () => {
  // These tests run in the node environment, so stand in for the browser's localStorage.
  beforeEach(() => {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
    };
  });
  afterEach(() => {
    delete globalThis.localStorage;
  });

  it('round-trips the saved name and uses it when no explicit username is given', async () => {
    saveDisplayName('Hector');
    expect(loadDisplayName()).toBe('Hector');

    await ensureSessionAndProfile(); // the direct-link joiner path passes no name
    expect(mocks.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({ username: 'Hector' }),
      { onConflict: 'id' },
    );
  });

  it('an explicit username outranks the saved one', async () => {
    saveDisplayName('Hector');
    await ensureSessionAndProfile({ username: 'Andy' });
    expect(mocks.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({ username: 'Andy' }),
      { onConflict: 'id' },
    );
  });

  it('degrades to empty/no-op when storage is unavailable', () => {
    delete globalThis.localStorage;
    expect(loadDisplayName()).toBe('');
    expect(() => saveDisplayName('x')).not.toThrow();
  });
});
