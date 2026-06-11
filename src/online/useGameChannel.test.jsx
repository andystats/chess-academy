import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

// A hand-driven fake Supabase channel: records the handlers registered via `.on(...)` and lets the
// test emit broadcast/presence events into them. `.subscribe()` resolves to SUBSCRIBED while
// `state.autoSubscribe` is on; `drive(state)` feeds the latest subscribe callback by hand, so the
// reconnect machine can be walked through failures.
const { fake } = vi.hoisted(() => {
  const handlers = {};
  const state = { subscribeCb: null, subscribeCount: 0, autoSubscribe: true };
  const channel = {
    on(type, filter, cb) {
      handlers[`${type}:${filter.event}`] = cb;
      return channel;
    },
    subscribe(cb) {
      state.subscribeCb = cb;
      state.subscribeCount += 1;
      if (state.autoSubscribe) cb('SUBSCRIBED');
      return channel;
    },
    track: vi.fn(),
    send: vi.fn(),
    presenceState: vi.fn(() => ({})),
  };
  return {
    fake: {
      channel,
      handlers,
      state,
      emit: (type, event, payload) => handlers[`${type}:${event}`]?.(payload),
      drive: (subscribeState) => state.subscribeCb?.(subscribeState),
    },
  };
});

vi.mock('../lib/supabase.js', () => ({
  isRealtimeConfigured: true,
  supabase: { channel: vi.fn(() => fake.channel), removeChannel: vi.fn() },
}));

import { useGameChannel } from './useGameChannel.js';

beforeEach(() => {
  fake.channel.track.mockClear();
  fake.channel.send.mockClear();
  fake.channel.presenceState.mockReturnValue({});
  fake.state.subscribeCb = null;
  fake.state.subscribeCount = 0;
  fake.state.autoSubscribe = true;
});

// The hook listens on document/window (wake-up recovery), so a hook instance left mounted by an
// earlier test would react to the next test's dispatched events — unmount explicitly every time.
afterEach(() => cleanup());

function setup(handlers = {}) {
  return renderHook(() =>
    useGameChannel({ gameId: 'g1', selfId: 'me', isHost: true, handlers }),
  );
}

describe('useGameChannel', () => {
  it('subscribes and tracks presence with its own id', () => {
    const { result } = setup();
    expect(result.current.status).toBe('connected');
    expect(fake.channel.track).toHaveBeenCalledWith({ id: 'me', isHost: true });
  });

  it('fires onSubscribed on (re)connect so the controller can re-sync', () => {
    const onSubscribed = vi.fn();
    setup({ onSubscribed });
    expect(onSubscribed).toHaveBeenCalled();
  });

  it('routes incoming broadcasts to the matching handler', () => {
    const onSnapshot = vi.fn();
    const onMoveIntent = vi.fn();
    const onRequestSnapshot = vi.fn();
    const onChat = vi.fn();
    setup({ onSnapshot, onMoveIntent, onRequestSnapshot, onChat });

    act(() => fake.emit('broadcast', 'snapshot', { payload: { seq: 3 } }));
    act(() => fake.emit('broadcast', 'move-intent', { payload: { turnId: 1 } }));
    act(() => fake.emit('broadcast', 'request-snapshot', { payload: { by: 'them' } }));
    act(() => fake.emit('broadcast', 'chat', { payload: { id: 'm1', by: 'white', text: 'hi' } }));

    expect(onSnapshot).toHaveBeenCalledWith({ seq: 3 });
    expect(onMoveIntent).toHaveBeenCalledWith({ turnId: 1 });
    expect(onRequestSnapshot).toHaveBeenCalledWith({ by: 'them' });
    expect(onChat).toHaveBeenCalledWith({ id: 'm1', by: 'white', text: 'hi' });
  });

  it('reports a peer once a non-self presence appears, and fires onPeerJoin', () => {
    const onPeerJoin = vi.fn();
    const { result } = setup({ onPeerJoin });
    expect(result.current.peerPresent).toBe(false);

    fake.channel.presenceState.mockReturnValue({ me: [{}], them: [{}] });
    act(() => fake.emit('presence', 'sync'));
    expect(result.current.peerPresent).toBe(true);

    act(() => fake.emit('presence', 'join', { key: 'them' }));
    expect(onPeerJoin).toHaveBeenCalledWith({ id: 'them' });
  });

  it('sends move intents, snapshots, and resync requests as broadcasts', () => {
    const { result } = setup();
    act(() => result.current.sendMoveIntent({ turnId: 7 }));
    act(() => result.current.broadcastSnapshot({ seq: 2 }));
    act(() => result.current.requestSnapshot({ epoch: 4, seq: 9 }));
    act(() => result.current.sendChat({ id: 'm1', by: 'white', text: 'gg' }));

    expect(fake.channel.send).toHaveBeenCalledWith({ type: 'broadcast', event: 'move-intent', payload: { turnId: 7 } });
    expect(fake.channel.send).toHaveBeenCalledWith({ type: 'broadcast', event: 'snapshot', payload: { seq: 2 } });
    expect(fake.channel.send).toHaveBeenCalledWith({ type: 'broadcast', event: 'request-snapshot', payload: { by: 'me', epoch: 4, seq: 9 } });
    expect(fake.channel.send).toHaveBeenCalledWith({ type: 'broadcast', event: 'chat', payload: { id: 'm1', by: 'white', text: 'gg' } });
  });
});

describe('reconnect machine', () => {
  it('backs off, reconnects, and resets the attempt counter once subscribed', () => {
    vi.useFakeTimers();
    try {
      const { result } = setup();
      expect(result.current.status).toBe('connected');

      act(() => fake.drive('CHANNEL_ERROR'));
      expect(result.current.status).toBe('reconnecting');
      const before = fake.state.subscribeCount;
      act(() => vi.advanceTimersByTime(1000)); // first backoff step
      expect(fake.state.subscribeCount).toBe(before + 1);
      expect(result.current.status).toBe('connected');

      // The attempt counter reset on success: the next failure backs off at 1s again, not 2s.
      act(() => fake.drive('CHANNEL_ERROR'));
      const again = fake.state.subscribeCount;
      act(() => vi.advanceTimersByTime(999));
      expect(fake.state.subscribeCount).toBe(again);
      act(() => vi.advanceTimersByTime(1));
      expect(fake.state.subscribeCount).toBe(again + 1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('gives up with a terminal error after the attempt cap and recovers via reconnect()', () => {
    vi.useFakeTimers();
    try {
      const { result } = setup();
      fake.state.autoSubscribe = false; // every reconnect attempt now fails
      act(() => fake.drive('CHANNEL_ERROR'));
      for (let i = 0; i < 6; i += 1) {
        act(() => vi.advanceTimersByTime(10000)); // ≥ max backoff covers every step
        act(() => fake.drive('CHANNEL_ERROR'));
      }
      expect(result.current.status).toBe('error');

      const stuck = fake.state.subscribeCount;
      act(() => vi.advanceTimersByTime(60000));
      expect(fake.state.subscribeCount).toBe(stuck); // terminal: no more scheduled retries

      fake.state.autoSubscribe = true;
      act(() => result.current.reconnect()); // the panel's Resync button
      expect(result.current.status).toBe('connected');
      expect(fake.state.subscribeCount).toBe(stuck + 1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps last-known presence through a transient drop and clears it on terminal error', () => {
    vi.useFakeTimers();
    try {
      const { result } = setup();
      fake.channel.presenceState.mockReturnValue({ me: [{ isHost: true }], them: [{ isHost: true }] });
      act(() => fake.emit('presence', 'sync'));
      expect(result.current.peerPresent).toBe(true);
      expect(result.current.hostPresent).toBe(true); // a non-self presence tracks isHost

      act(() => fake.drive('CHANNEL_ERROR')); // transient: the indicator must not flap
      expect(result.current.status).toBe('reconnecting');
      expect(result.current.peerPresent).toBe(true);
      expect(result.current.hostPresent).toBe(true);

      fake.state.autoSubscribe = false;
      for (let i = 0; i < 6; i += 1) {
        act(() => vi.advanceTimersByTime(10000));
        act(() => fake.drive('CHANNEL_ERROR'));
      }
      expect(result.current.status).toBe('error'); // terminal: genuinely down
      expect(result.current.peerPresent).toBe(false);
      expect(result.current.hostPresent).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not reconnect after unmount', () => {
    vi.useFakeTimers();
    try {
      const { unmount } = setup();
      act(() => fake.drive('CHANNEL_ERROR')); // schedules a reconnect
      const before = fake.state.subscribeCount;
      unmount();
      act(() => vi.advanceTimersByTime(60000));
      expect(fake.state.subscribeCount).toBe(before);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('wake-up recovery', () => {
  const setVisibility = (value) => {
    Object.defineProperty(document, 'visibilityState', { value, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  };
  afterEach(() => setVisibility('visible'));

  it('reconnects immediately on wake when the connection is known-broken', () => {
    vi.useFakeTimers();
    try {
      const { result } = setup();
      act(() => fake.drive('CHANNEL_ERROR')); // down, backoff pending
      const before = fake.state.subscribeCount;
      act(() => setVisibility('hidden'));
      act(() => setVisibility('visible'));
      expect(fake.state.subscribeCount).toBe(before + 1); // no waiting out the backoff
      expect(result.current.status).toBe('connected');
    } finally {
      vi.useRealTimers();
    }
  });

  it('forces a fresh channel after a long suspension even when it looks healthy', () => {
    vi.useFakeTimers();
    try {
      setup();
      const before = fake.state.subscribeCount;
      act(() => setVisibility('hidden'));
      act(() => vi.advanceTimersByTime(31000)); // suspended past the wake threshold
      act(() => setVisibility('visible'));
      expect(fake.state.subscribeCount).toBe(before + 1); // the suspended socket is assumed dead
    } finally {
      vi.useRealTimers();
    }
  });

  it('re-syncs without tearing down after a short hide', () => {
    const onSubscribed = vi.fn();
    setup({ onSubscribed });
    onSubscribed.mockClear();
    const before = fake.state.subscribeCount;
    act(() => setVisibility('hidden'));
    act(() => setVisibility('visible'));
    expect(fake.state.subscribeCount).toBe(before); // the healthy channel is kept
    expect(onSubscribed).toHaveBeenCalledTimes(1); // but state re-syncs through the normal path
  });

  it('reconnects when the browser comes back online while down', () => {
    vi.useFakeTimers();
    try {
      const { result } = setup();
      fake.state.autoSubscribe = false;
      act(() => fake.drive('CHANNEL_ERROR'));
      const before = fake.state.subscribeCount;
      fake.state.autoSubscribe = true;
      act(() => window.dispatchEvent(new Event('online')));
      expect(fake.state.subscribeCount).toBe(before + 1);
      expect(result.current.status).toBe('connected');
    } finally {
      vi.useRealTimers();
    }
  });
});
