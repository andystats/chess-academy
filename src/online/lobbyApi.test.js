import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureSessionAndProfile } from './lobbyApi.js';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInAnonymously: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('../lib/supabase.js', () => ({
  isRealtimeConfigured: true,
  supabase: {
    auth: { getSession: mocks.getSession, signInAnonymously: mocks.signInAnonymously },
    from: vi.fn(() => ({ upsert: mocks.upsert })),
  },
}));

beforeEach(() => {
  mocks.getSession.mockReset().mockResolvedValue({ data: { session: null } });
  mocks.signInAnonymously.mockReset().mockResolvedValue({ data: { user: { id: 'anon-1' } }, error: null });
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
