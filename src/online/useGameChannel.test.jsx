import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// A hand-driven fake Supabase channel: records the handlers registered via `.on(...)` and lets the
// test emit broadcast/presence events into them. `.subscribe()` resolves synchronously to SUBSCRIBED.
const { fake } = vi.hoisted(() => {
  const handlers = {};
  const channel = {
    on(type, filter, cb) {
      handlers[`${type}:${filter.event}`] = cb;
      return channel;
    },
    subscribe(cb) {
      cb('SUBSCRIBED');
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
      emit: (type, event, payload) => handlers[`${type}:${event}`]?.(payload),
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
});

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
    act(() => result.current.requestSnapshot());
    act(() => result.current.sendChat({ id: 'm1', by: 'white', text: 'gg' }));

    expect(fake.channel.send).toHaveBeenCalledWith({ type: 'broadcast', event: 'move-intent', payload: { turnId: 7 } });
    expect(fake.channel.send).toHaveBeenCalledWith({ type: 'broadcast', event: 'snapshot', payload: { seq: 2 } });
    expect(fake.channel.send).toHaveBeenCalledWith({ type: 'broadcast', event: 'request-snapshot', payload: { by: 'me' } });
    expect(fake.channel.send).toHaveBeenCalledWith({ type: 'broadcast', event: 'chat', payload: { id: 'm1', by: 'white', text: 'gg' } });
  });
});
