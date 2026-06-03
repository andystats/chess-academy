import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createVariantGame } from './rules.js';
import { saveSnapshot } from './localSnapshot.js';

// Mock the transport: capture the handlers the controller registers, and expose spies the test can
// assert on / drive. Mirrors the deferred-callback pattern from useEngineGame.test.jsx.
const { transport } = vi.hoisted(() => ({
  transport: {
    handlers: null,
    status: 'connected',
    peerPresent: false,
    broadcastSnapshot: vi.fn(),
    sendMoveIntent: vi.fn(),
    requestSnapshot: vi.fn(),
    sendChat: vi.fn(),
  },
}));

vi.mock('./useGameChannel.js', () => ({
  useGameChannel: ({ handlers }) => {
    transport.handlers = handlers;
    return {
      status: transport.status,
      peerPresent: transport.peerPresent,
      broadcastSnapshot: transport.broadcastSnapshot,
      sendMoveIntent: transport.sendMoveIntent,
      requestSnapshot: transport.requestSnapshot,
      sendChat: transport.sendChat,
    };
  },
}));

import { useOnlineGame } from './useOnlineGame.js';

function fenAfter(variant, ...moves) {
  const game = createVariantGame(variant);
  for (const move of moves) game.movePiece(move);
  return game.serialize();
}

beforeEach(() => {
  localStorage.clear();
  transport.handlers = null;
  transport.status = 'connected';
  transport.broadcastSnapshot.mockClear();
  transport.sendMoveIntent.mockClear();
  transport.requestSnapshot.mockClear();
  transport.sendChat.mockClear();
});

describe('host (standard)', () => {
  const hostProps = { gameId: 'g1', variant: 'standard', selfColor: 'white', isHost: true, hostColor: 'white', selfId: 'host' };

  it('moves on its turn, broadcasts an authoritative snapshot, then is locked off-turn', () => {
    const { result } = renderHook(() => useOnlineGame(hostProps));
    expect(result.current.arePiecesDraggable).toBe(true);

    act(() => {
      result.current.onPieceDrop('e2', 'e4');
    });
    expect(transport.broadcastSnapshot).toHaveBeenCalledTimes(1);
    const snapshot = transport.broadcastSnapshot.mock.calls[0][0];
    expect(snapshot.seq).toBe(2); // host starts at seq 1, a move bumps it
    expect(snapshot.players.white).toBe('host');
    expect(result.current.currentTurn).toBe('black');
    expect(result.current.arePiecesDraggable).toBe(false); // not the host's turn now

    act(() => {
      result.current.onPieceDrop('e7', 'e5');
    });
    expect(transport.broadcastSnapshot).toHaveBeenCalledTimes(1); // off-turn move rejected
  });

  it('applies a valid move-intent from the joiner and broadcasts the result', () => {
    const { result } = renderHook(() => useOnlineGame(hostProps));
    act(() => {
      result.current.onPieceDrop('e2', 'e4'); // host's turn → now black to move
    });
    transport.broadcastSnapshot.mockClear();
    act(() => {
      transport.handlers.onMoveIntent({ by: 'joiner', pieceMove: { from: 'e7', to: 'e5', promotion: 'q' }, duckSquare: null });
    });
    expect(transport.broadcastSnapshot).toHaveBeenCalledTimes(1);
    expect(result.current.currentTurn).toBe('white');
  });
});

describe('joiner (standard)', () => {
  const joinerProps = { gameId: 'g2', variant: 'standard', selfColor: 'black', isHost: false, hostColor: 'white', selfId: 'joiner' };

  it('waits for a snapshot, then plays optimistically and sends an intent on its turn', () => {
    const { result } = renderHook(() => useOnlineGame(joinerProps));
    expect(result.current.arePiecesDraggable).toBe(false); // not synced yet
    expect(transport.requestSnapshot).toHaveBeenCalled();

    // Host's opening move arrives → black to move.
    act(() => {
      transport.handlers.onSnapshot({ seq: 2, variant: 'standard', hostColor: 'white', players: { white: 'host', black: 'joiner' }, state: fenAfter('standard', { from: 'e2', to: 'e4' }) });
    });
    expect(result.current.connection.synced).toBe(true);
    expect(result.current.currentTurn).toBe('black');
    expect(result.current.arePiecesDraggable).toBe(true);

    act(() => {
      result.current.onPieceDrop('e7', 'e5');
    });
    expect(transport.sendMoveIntent).toHaveBeenCalledWith({ by: 'joiner', pieceMove: { from: 'e7', to: 'e5', promotion: 'q' }, duckSquare: null });
    expect(result.current.currentTurn).toBe('white'); // optimistic
    expect(transport.broadcastSnapshot).not.toHaveBeenCalled(); // joiner never broadcasts
  });

  it('reconciles to a higher-seq snapshot and ignores stale ones', () => {
    const { result } = renderHook(() => useOnlineGame(joinerProps));
    act(() => {
      transport.handlers.onSnapshot({ seq: 5, variant: 'standard', hostColor: 'white', players: { white: 'host', black: 'joiner' }, state: fenAfter('standard', { from: 'd2', to: 'd4' }) });
    });
    const fenAtSeq5 = result.current.fen;
    act(() => {
      transport.handlers.onSnapshot({ seq: 3, variant: 'standard', hostColor: 'white', players: {}, state: fenAfter('standard', { from: 'e2', to: 'e4' }) });
    });
    expect(result.current.fen).toBe(fenAtSeq5); // stale snapshot ignored
  });
});

describe('duck two-phase turn (host)', () => {
  const duckProps = { gameId: 'g3', variant: 'duck', selfColor: 'white', isHost: true, hostColor: 'white', selfId: 'host' };

  it('enters the duck phase after the piece move and commits only after duck placement', () => {
    const { result } = renderHook(() => useOnlineGame(duckProps));
    act(() => {
      result.current.onPieceDrop('e2', 'e4');
    });
    expect(result.current.phase).toBe('duck');
    expect(result.current.currentTurn).toBe('white'); // same player still placing the duck
    expect(result.current.duckTargets.length).toBeGreaterThan(0);
    expect(transport.broadcastSnapshot).not.toHaveBeenCalled(); // turn not yet complete

    act(() => {
      result.current.onSquareClick('e3');
    });
    expect(transport.broadcastSnapshot).toHaveBeenCalledTimes(1);
    const snapshot = transport.broadcastSnapshot.mock.calls[0][0];
    expect(snapshot.state.split(' ')[3]).toBe('e3'); // the duck field of the wire format
    expect(result.current.currentTurn).toBe('black');
    expect(result.current.duckSquare).toBe('e3');
  });
});

describe('king capture (duck, host resumes from a seeded snapshot)', () => {
  it('reports the winner and locks the board', () => {
    const props = { gameId: 'g4', variant: 'duck', selfColor: 'white', isHost: true, hostColor: 'white', selfId: 'host' };
    saveSnapshot('g4', {
      seq: 9,
      variant: 'duck',
      hostColor: 'white',
      players: { white: 'host', black: 'joiner' },
      state: '3k4/8/8/8/8/8/8/3QK3 w piece - - - 0 1',
    });
    const { result } = renderHook(() => useOnlineGame(props));
    act(() => {
      result.current.onPieceDrop('d1', 'd8'); // queen captures the black king
    });
    expect(result.current.result).toEqual({ winner: 'white', reason: 'King captured' });
    expect(result.current.status).toBe('over');
    expect(result.current.arePiecesDraggable).toBe(false);
  });
});

describe('chat', () => {
  const props = { gameId: 'gc', variant: 'standard', selfColor: 'white', isHost: true, hostColor: 'white', selfId: 'host' };

  it('appends + broadcasts your own message, appends a received one, and ignores blanks', () => {
    const { result } = renderHook(() => useOnlineGame(props));

    act(() => result.current.sendChat('  hello  '));
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toMatchObject({ by: 'white', text: 'hello' }); // trimmed
    expect(transport.sendChat).toHaveBeenCalledTimes(1);

    act(() => transport.handlers.onChat({ id: 'x', by: 'black', text: 'hi back' }));
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1]).toMatchObject({ by: 'black', text: 'hi back' });

    act(() => result.current.sendChat('   '));
    expect(result.current.messages).toHaveLength(2); // whitespace-only is dropped
    expect(transport.sendChat).toHaveBeenCalledTimes(1);
  });
});
