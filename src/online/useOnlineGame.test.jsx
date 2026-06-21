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
    peerIds: [],
    hostPresent: false,
    broadcastSnapshot: vi.fn(),
    sendMoveIntent: vi.fn(),
    sendResignIntent: vi.fn(),
    requestSnapshot: vi.fn(),
    sendChat: vi.fn(),
    reconnect: vi.fn(),
  },
}));

vi.mock('../lib/supabase.js', () => ({
  isRealtimeConfigured: true,
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
      signInAnonymously: vi.fn(() => Promise.resolve({ data: { user: { id: 'anon' } } })),
    },
    from: () => ({
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
    }),
  },
}));

vi.mock('./useGameChannel.js', () => ({
  useGameChannel: ({ handlers }) => {
    transport.handlers = handlers;
    return {
      status: transport.status,
      peerPresent: transport.peerPresent,
      peerIds: transport.peerIds,
      hostPresent: transport.hostPresent,
      reconnect: transport.reconnect,
      broadcastSnapshot: transport.broadcastSnapshot,
      sendMoveIntent: transport.sendMoveIntent,
      sendResignIntent: transport.sendResignIntent,
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
  transport.peerPresent = false;
  transport.peerIds = [];
  transport.hostPresent = false;
  transport.broadcastSnapshot.mockClear();
  transport.sendMoveIntent.mockClear();
  transport.sendResignIntent.mockClear();
  transport.requestSnapshot.mockClear();
  transport.sendChat.mockClear();
  transport.reconnect.mockClear();
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

describe('robustness', () => {
  const hostProps = { gameId: 'rh', variant: 'standard', selfColor: 'white', isHost: true, hostColor: 'white', selfId: 'host' };
  const joinerProps = { gameId: 'rj', variant: 'standard', selfColor: 'black', isHost: false, hostColor: 'white', selfId: 'joiner' };

  it('re-syncs on (re)connect: host re-publishes, joiner re-requests', () => {
    const host = renderHook(() => useOnlineGame(hostProps));
    transport.broadcastSnapshot.mockClear();
    act(() => transport.handlers.onSubscribed());
    expect(transport.broadcastSnapshot).toHaveBeenCalledTimes(1);

    const joiner = renderHook(() => useOnlineGame(joinerProps));
    transport.requestSnapshot.mockClear();
    act(() => transport.handlers.onSubscribed());
    expect(transport.requestSnapshot).toHaveBeenCalled();
    joiner.unmount();
    host.unmount();
  });

  it('host re-publishes (without re-applying) when a known player resends a stale move', () => {
    const { result } = renderHook(() => useOnlineGame(hostProps));
    act(() => result.current.onPieceDrop('e2', 'e4')); // seq 2, black to move
    act(() => transport.handlers.onMoveIntent({ by: 'joiner', pieceMove: { from: 'e7', to: 'e5', promotion: 'q' }, duckSquare: null })); // seq 3, white to move
    transport.broadcastSnapshot.mockClear();

    act(() => transport.handlers.onMoveIntent({ by: 'joiner', pieceMove: { from: 'e7', to: 'e5', promotion: 'q' }, duckSquare: null })); // stale duplicate
    expect(transport.broadcastSnapshot).toHaveBeenCalledTimes(1);
    expect(transport.broadcastSnapshot.mock.calls[0][0].seq).toBe(3); // re-published, not re-applied
    expect(result.current.currentTurn).toBe('white');
  });

  it('rejects a remote turn whose duck placement is invalid without committing the piece move', () => {
    const duckHost = { gameId: 'ra', variant: 'duck', selfColor: 'white', isHost: true, hostColor: 'white', selfId: 'host' };
    const { result } = renderHook(() => useOnlineGame(duckHost));
    act(() => result.current.onPieceDrop('e2', 'e4'));
    act(() => result.current.onSquareClick('d3')); // host's turn commits: duck on d3, black to move
    const fenBefore = result.current.fen;
    transport.broadcastSnapshot.mockClear();

    // The joiner's chosen duck square (e4) is occupied on the host's board → reject the whole turn.
    act(() => transport.handlers.onMoveIntent({ by: 'joiner', pieceMove: { from: 'e7', to: 'e5', promotion: 'q' }, duckSquare: 'e4' }));
    expect(result.current.fen).toBe(fenBefore); // piece move not committed
    expect(result.current.phase).toBe('piece'); // not stranded in the duck phase
    expect(result.current.currentTurn).toBe('black'); // still the joiner's turn
    expect(result.current.history).toHaveLength(1); // the host's own move list survives the rejection
    expect(transport.broadcastSnapshot).toHaveBeenCalledTimes(1); // corrective resync sent

    // A legal duck square completes the same turn — the game is not wedged.
    act(() => transport.handlers.onMoveIntent({ by: 'joiner', pieceMove: { from: 'e7', to: 'e5', promotion: 'q' }, duckSquare: 'e6' }));
    expect(result.current.currentTurn).toBe('white');
    expect(result.current.duckSquare).toBe('e6');
  });

  it('joiner resends an unconfirmed move-intent until a newer snapshot clears it', () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useOnlineGame(joinerProps));
      act(() => transport.handlers.onSnapshot({ seq: 2, variant: 'standard', hostColor: 'white', players: { white: 'host', black: 'joiner' }, state: fenAfter('standard', { from: 'e2', to: 'e4' }) }));
      act(() => result.current.onPieceDrop('e7', 'e5'));
      expect(transport.sendMoveIntent).toHaveBeenCalledTimes(1);

      act(() => vi.advanceTimersByTime(2600));
      const afterRetry = transport.sendMoveIntent.mock.calls.length;
      expect(afterRetry).toBeGreaterThan(1); // resent while unconfirmed

      act(() => transport.handlers.onSnapshot({ seq: 3, variant: 'standard', hostColor: 'white', players: { white: 'host', black: 'joiner' }, state: fenAfter('standard', { from: 'e2', to: 'e4' }, { from: 'e7', to: 'e5' }) }));
      act(() => vi.advanceTimersByTime(5200));
      expect(transport.sendMoveIntent.mock.calls.length).toBe(afterRetry); // confirmed → no more resends
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('tap-path promotion', () => {
  it('opens the picker instead of silently queening, then sends the chosen piece', () => {
    const props = { gameId: 'tp', variant: 'standard', selfColor: 'white', isHost: true, hostColor: 'white', selfId: 'host' };
    const players = { white: 'host', black: 'joiner' };
    saveSnapshot('tp', { epoch: 1, seq: 1, variant: 'standard', hostColor: 'white', players, state: '7k/P7/8/8/8/8/8/7K w - - 0 1' });
    const { result } = renderHook(() => useOnlineGame(props));
    const fenBefore = result.current.fen;

    act(() => result.current.onSquareClick('a7'));
    act(() => result.current.onSquareClick('a8'));
    expect(result.current.promotionTarget).toBe('a8'); // picker open, nothing moved or sent
    expect(result.current.fen).toBe(fenBefore);
    expect(transport.broadcastSnapshot).not.toHaveBeenCalled();

    act(() => result.current.onPromotionPieceSelect('wN')); // manual dialog: no from/to args
    expect(result.current.promotionTarget).toBe(null);
    expect(result.current.fen.split(' ')[0]).toContain('N'); // under-promoted, not auto-queened
    expect(transport.broadcastSnapshot).toHaveBeenCalledTimes(1);
  });
});

describe('seats & identity', () => {
  const hostProps = { gameId: 's1', variant: 'standard', selfColor: 'white', isHost: true, hostColor: 'white', selfId: 'host' };

  it('ignores a stray third party while the claimed player is present', () => {
    transport.peerIds = ['joiner', 'intruder'];
    const { result } = renderHook(() => useOnlineGame(hostProps));
    act(() => result.current.onPieceDrop('e2', 'e4'));
    act(() => transport.handlers.onMoveIntent({ by: 'joiner', pieceMove: { from: 'e7', to: 'e5', promotion: 'q' }, duckSquare: null })); // claims black
    act(() => result.current.onPieceDrop('d2', 'd4')); // black to move again
    const fenBefore = result.current.fen;
    transport.broadcastSnapshot.mockClear();

    act(() => transport.handlers.onMoveIntent({ by: 'intruder', pieceMove: { from: 'd7', to: 'd5', promotion: 'q' }, duckSquare: null }));
    expect(result.current.fen).toBe(fenBefore); // not applied
    expect(transport.broadcastSnapshot).not.toHaveBeenCalled(); // ignored outright, no re-publish
  });

  it('re-seats a color when its claimant is no longer connected (per-tab id changed)', () => {
    transport.peerIds = ['joiner-new-tab']; // the original claimant is gone
    const { result } = renderHook(() => useOnlineGame(hostProps));
    act(() => result.current.onPieceDrop('e2', 'e4'));
    act(() => transport.handlers.onMoveIntent({ by: 'joiner', pieceMove: { from: 'e7', to: 'e5', promotion: 'q' }, duckSquare: null }));
    act(() => result.current.onPieceDrop('d2', 'd4'));
    transport.broadcastSnapshot.mockClear();

    act(() => transport.handlers.onMoveIntent({ by: 'joiner-new-tab', pieceMove: { from: 'd7', to: 'd5', promotion: 'q' }, duckSquare: null }));
    expect(transport.broadcastSnapshot).toHaveBeenCalledTimes(1); // applied — the seat followed presence
    expect(result.current.currentTurn).toBe('white');
  });

  it("never re-seats the host's own color", () => {
    transport.peerIds = ['intruder'];
    const { result } = renderHook(() => useOnlineGame(hostProps));
    const fenBefore = result.current.fen; // white (the host) to move
    transport.broadcastSnapshot.mockClear();

    act(() => transport.handlers.onMoveIntent({ by: 'intruder', pieceMove: { from: 'e2', to: 'e4', promotion: 'q' }, duckSquare: null }));
    expect(result.current.fen).toBe(fenBefore); // the host's seat cannot be taken over
    expect(transport.broadcastSnapshot).not.toHaveBeenCalled();
  });

  it("flags seatTaken when the joiner's color is claimed by another id, and self-heals", () => {
    const joinerProps = { gameId: 's4', variant: 'standard', selfColor: 'black', isHost: false, hostColor: 'white', selfId: 'joiner' };
    const { result } = renderHook(() => useOnlineGame(joinerProps));
    act(() => transport.handlers.onSnapshot({ epoch: 1, seq: 2, variant: 'standard', hostColor: 'white', players: { white: 'host', black: 'rival' }, state: fenAfter('standard', { from: 'e2', to: 'e4' }) }));
    expect(result.current.connection.seatTaken).toBe(true);
    expect(result.current.arePiecesDraggable).toBe(false); // spectator despite it being black's move

    act(() => transport.handlers.onSnapshot({ epoch: 1, seq: 3, variant: 'standard', hostColor: 'white', players: { white: 'host', black: 'joiner' }, state: fenAfter('standard', { from: 'e2', to: 'e4' }) }));
    expect(result.current.connection.seatTaken).toBe(false); // the seat re-bound to us
    expect(result.current.arePiecesDraggable).toBe(true);
  });

  it('keeps a storage-restored joiner read-only until the host speaks this session', () => {
    const joinerProps = { gameId: 's5', variant: 'standard', selfColor: 'black', isHost: false, hostColor: 'white', selfId: 'joiner' };
    const players = { white: 'host', black: 'joiner' };
    saveSnapshot('s5', { epoch: 4, seq: 8, variant: 'standard', hostColor: 'white', players, state: fenAfter('standard', { from: 'e2', to: 'e4' }) });
    const { result } = renderHook(() => useOnlineGame(joinerProps));
    expect(result.current.connection.synced).toBe(true); // the board restores and renders…
    expect(result.current.connection.liveSynced).toBe(false);
    expect(result.current.arePiecesDraggable).toBe(false); // …but stays read-only: the host is silent

    act(() => transport.handlers.onSnapshot({ epoch: 4, seq: 9, variant: 'standard', hostColor: 'white', players, state: fenAfter('standard', { from: 'e2', to: 'e4' }) }));
    expect(result.current.connection.liveSynced).toBe(true);
    expect(result.current.arePiecesDraggable).toBe(true);
  });
});

describe('hostile wire input', () => {
  it('host ignores malformed move-intents without crashing, mutating, or broadcasting', () => {
    const props = { gameId: 'w1', variant: 'duck', selfColor: 'white', isHost: true, hostColor: 'white', selfId: 'host' };
    const { result } = renderHook(() => useOnlineGame(props));
    act(() => result.current.onPieceDrop('e2', 'e4'));
    act(() => result.current.onSquareClick('d3')); // turn committed → the wire side (black) to move
    const fenBefore = result.current.fen;
    transport.broadcastSnapshot.mockClear();

    const garbage = [
      null,
      'not an intent',
      { by: 'joiner' }, // no pieceMove
      { by: 'joiner', pieceMove: 42 },
      { by: 'joiner', pieceMove: { from: 7, to: 'e5' } },
      { by: 'joiner', pieceMove: { from: 'e7', to: 'z9' } },
      { by: 'joiner', pieceMove: { from: 'e7', to: 'e5', promotion: 13 } },
      { by: 'joiner', pieceMove: { from: 'e7', to: 'e5', promotion: 'king' } },
      { by: 'joiner', pieceMove: { from: 'e7', to: 'e5' }, duckSquare: 42 },
      { by: 'joiner', pieceMove: { from: 'e7', to: 'e5' }, duckSquare: {} },
      { by: 'joiner', pieceMove: { from: 'e7', to: 'e5' }, duckSquare: 'z9' },
    ];
    for (const intent of garbage) act(() => transport.handlers.onMoveIntent(intent));
    expect(result.current.fen).toBe(fenBefore);
    expect(transport.broadcastSnapshot).not.toHaveBeenCalled(); // shape-garbage is dropped silently
  });

  it('joiner drops snapshots that fail validation and still adopts the next good one', () => {
    const props = { gameId: 'w2', variant: 'standard', selfColor: 'black', isHost: false, hostColor: 'white', selfId: 'joiner' };
    const { result } = renderHook(() => useOnlineGame(props));
    const players = { white: 'host', black: 'joiner' };
    act(() => transport.handlers.onSnapshot({ epoch: 1, seq: 2, variant: 'standard', hostColor: 'white', players, state: fenAfter('standard', { from: 'e2', to: 'e4' }) }));
    const fenBefore = result.current.fen;

    const garbage = [
      { epoch: 9, seq: 9, variant: 'standard', players, state: 42 }, // non-string state
      { epoch: 9, seq: 9, variant: 'standard', players, state: '' }, // would silently reset the board
      { epoch: 9, seq: 9, variant: 'standard', players, state: 'total garbage' }, // unparseable FEN
      { epoch: 9, seq: 9, variant: 'duck', players, state: fenAfter('duck', { from: 'e2', to: 'e4' }) }, // wrong variant
    ];
    for (const snapshot of garbage) act(() => transport.handlers.onSnapshot(snapshot));
    expect(result.current.fen).toBe(fenBefore); // nothing adopted

    // (epoch, seq) advance only on adoption, so the rejected seq-9 snapshots can't block a real one.
    act(() => transport.handlers.onSnapshot({ epoch: 1, seq: 3, variant: 'standard', hostColor: 'white', players, state: fenAfter('standard', { from: 'e2', to: 'e4' }, { from: 'e7', to: 'e5' }) }));
    expect(result.current.fen).not.toBe(fenBefore); // healthy adoption resumed
  });
});

describe('epoch — new game and stuck-joiner recovery', () => {
  const hostProps = { gameId: 'e1', variant: 'standard', selfColor: 'white', isHost: true, hostColor: 'white', selfId: 'host' };
  const joinerProps = { gameId: 'e2', variant: 'standard', selfColor: 'black', isHost: false, hostColor: 'white', selfId: 'joiner' };

  it('newGame broadcasts a fresh-epoch snapshot at seq 1 with a reset board', () => {
    const { result } = renderHook(() => useOnlineGame(hostProps));
    act(() => result.current.onPieceDrop('e2', 'e4')); // (epoch E, seq 2)
    const finished = transport.broadcastSnapshot.mock.calls.at(-1)[0];

    act(() => result.current.newGame());
    const fresh = transport.broadcastSnapshot.mock.calls.at(-1)[0];
    expect(fresh.epoch).toBeGreaterThan(finished.epoch); // new instance outranks any joiner seq
    expect(fresh.seq).toBe(1); // seq restarts within the new epoch
    expect(result.current.currentTurn).toBe('white'); // board reset
  });

  it('joiner adopts a higher-epoch snapshot even at a lower seq (host restarted without storage)', () => {
    const { result } = renderHook(() => useOnlineGame(joinerProps));
    const players = { white: 'host', black: 'joiner' };
    act(() => transport.handlers.onSnapshot({ epoch: 10, seq: 40, variant: 'standard', hostColor: 'white', players, state: fenAfter('standard', { from: 'd2', to: 'd4' }) }));
    expect(result.current.connection.synced).toBe(true);

    act(() => transport.handlers.onSnapshot({ epoch: 11, seq: 1, variant: 'standard', hostColor: 'white', players, state: fenAfter('standard') }));
    expect(result.current.fen).toBe(createVariantGame('standard').boardFen()); // fresh board adopted despite seq 1 < 40

    act(() => transport.handlers.onSnapshot({ epoch: 10, seq: 99, variant: 'standard', hostColor: 'white', players, state: fenAfter('standard', { from: 'e2', to: 'e4' }) }));
    expect(result.current.fen).toBe(createVariantGame('standard').boardFen()); // old-epoch stragglers stay ignored
  });

  it('host answers a stuck requester with a fresh epoch even at the same seq', () => {
    const { result } = renderHook(() => useOnlineGame(hostProps));
    act(() => result.current.onPieceDrop('e2', 'e4'));
    const { epoch, seq } = transport.broadcastSnapshot.mock.calls.at(-1)[0];
    transport.broadcastSnapshot.mockClear();

    act(() => transport.handlers.onRequestSnapshot({ by: 'joiner', epoch, seq, stuck: true }));
    const healed = transport.broadcastSnapshot.mock.calls.at(-1)[0];
    expect(healed.epoch).toBeGreaterThan(epoch); // unconditionally adoptable by the diverged joiner
    expect(healed.seq).toBe(seq + 1);
  });

  it('escalates a stuck move-intent to an epoch heal instead of retrying forever', () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useOnlineGame(joinerProps));
      const players = { white: 'host', black: 'joiner' };
      act(() => transport.handlers.onSnapshot({ epoch: 2, seq: 2, variant: 'standard', hostColor: 'white', players, state: fenAfter('standard', { from: 'e2', to: 'e4' }) }));
      act(() => result.current.onPieceDrop('e7', 'e5')); // optimistic; the host never answers
      expect(transport.sendMoveIntent).toHaveBeenCalledTimes(1);
      transport.requestSnapshot.mockClear();

      act(() => vi.advanceTimersByTime(7800)); // three silent retries
      expect(transport.sendMoveIntent.mock.calls.length).toBe(4); // initial send + 3 resends
      act(() => vi.advanceTimersByTime(2600)); // the next tick gives up and asks for a heal
      expect(transport.requestSnapshot).toHaveBeenCalledWith(expect.objectContaining({ stuck: true }));
      act(() => vi.advanceTimersByTime(5200));
      expect(transport.sendMoveIntent.mock.calls.length).toBe(4); // the intent was dropped — no more resends

      // The heal arrives as a fresh epoch (always adoptable) and rolls the optimistic board back.
      act(() => transport.handlers.onSnapshot({ epoch: 3, seq: 3, variant: 'standard', hostColor: 'white', players, state: fenAfter('standard', { from: 'e2', to: 'e4' }) }));
      expect(result.current.currentTurn).toBe('black'); // back on the authoritative board, unfrozen
    } finally {
      vi.useRealTimers();
    }
  });

  it('host heals a stuck-ahead requester by minting a fresh epoch, but answers a routine poll without bumping', () => {
    const { result } = renderHook(() => useOnlineGame(hostProps));
    act(() => result.current.onPieceDrop('e2', 'e4'));
    const { epoch, seq } = transport.broadcastSnapshot.mock.calls.at(-1)[0];

    transport.broadcastSnapshot.mockClear();
    act(() => transport.handlers.onRequestSnapshot({ by: 'joiner', epoch, seq: seq + 50 })); // joiner ran ahead
    const healed = transport.broadcastSnapshot.mock.calls.at(-1)[0];
    expect(healed.epoch).toBeGreaterThan(epoch); // fresh epoch → unconditionally adoptable
    expect(healed.seq).toBe(seq + 1);

    transport.broadcastSnapshot.mockClear();
    act(() => transport.handlers.onRequestSnapshot({ by: 'joiner', epoch: healed.epoch, seq: healed.seq }));
    const replied = transport.broadcastSnapshot.mock.calls.at(-1)[0];
    expect(replied.epoch).toBe(healed.epoch); // plain re-publish: no epoch churn...
    expect(replied.seq).toBe(healed.seq); // ...and no bump, so it can't clear an in-flight intent
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

  it('caps and sanitizes incoming chat from the wire', () => {
    const { result } = renderHook(() => useOnlineGame(props));
    act(() => transport.handlers.onChat({ id: 'n1', by: 'black', text: 42 })); // non-string — dropped
    act(() => transport.handlers.onChat({ id: 'n2', by: 'black', text: 'x'.repeat(5000) }));
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].text).toHaveLength(2000); // truncated on receive

    act(() => {
      for (let i = 0; i < 250; i += 1) transport.handlers.onChat({ id: `m${i}`, by: 'black', text: `m${i}` });
    });
    expect(result.current.messages).toHaveLength(200); // bounded against a flood
    expect(result.current.messages.at(-1).text).toBe('m249'); // newest kept
  });
});

describe('resign', () => {
  const hostProps = { gameId: 'rs1', variant: 'standard', selfColor: 'white', isHost: true, hostColor: 'white', selfId: 'host' };
  const joinerProps = { gameId: 'rs2', variant: 'standard', selfColor: 'black', isHost: false, hostColor: 'white', selfId: 'joiner' };

  it('host resign ends the game locally and ships the result on the snapshot', () => {
    const { result } = renderHook(() => useOnlineGame(hostProps));
    act(() => result.current.resign());
    expect(result.current.result).toEqual({ winner: 'black', reason: 'Resigned' });
    expect(result.current.arePiecesDraggable).toBe(false);
    expect(transport.broadcastSnapshot.mock.calls.at(-1)[0].result).toEqual({ winner: 'black', reason: 'Resigned' });

    const broadcasts = transport.broadcastSnapshot.mock.calls.length;
    act(() => result.current.resign());
    expect(transport.broadcastSnapshot.mock.calls.length).toBe(broadcasts); // resigning twice is a no-op
  });

  it('joiner resign sends an intent (no optimistic end) and adopts the outcome from the snapshot', () => {
    const { result } = renderHook(() => useOnlineGame(joinerProps));
    act(() => result.current.resign());
    expect(transport.sendResignIntent).toHaveBeenCalledWith({ by: 'joiner' });
    expect(result.current.result).toBeNull(); // the host's snapshot is what ends it

    act(() => transport.handlers.onSnapshot({ epoch: 1, seq: 2, variant: 'standard', hostColor: 'white', players: { white: 'host', black: 'joiner' }, state: fenAfter('standard'), result: { winner: 'white', reason: 'Resigned' } }));
    expect(result.current.result).toEqual({ winner: 'white', reason: 'Resigned' });
    expect(result.current.arePiecesDraggable).toBe(false);
  });

  it("host applies a seated joiner's resignation but never one for an unknown id or its own seat", () => {
    const { result } = renderHook(() => useOnlineGame(hostProps));
    act(() => result.current.onPieceDrop('e2', 'e4'));
    act(() => transport.handlers.onMoveIntent({ by: 'joiner', pieceMove: { from: 'e7', to: 'e5', promotion: 'q' }, duckSquare: null })); // claims black

    act(() => transport.handlers.onResignIntent({ by: 'stranger' })); // holds no seat
    act(() => transport.handlers.onResignIntent({ by: 'host' })); // the host's seat resigns locally only
    expect(result.current.result).toBeNull();

    act(() => transport.handlers.onResignIntent({ by: 'joiner' }));
    expect(result.current.result).toEqual({ winner: 'white', reason: 'Resigned' });

    const fen = result.current.fen;
    act(() => transport.handlers.onMoveIntent({ by: 'joiner', pieceMove: { from: 'g8', to: 'f6', promotion: null }, duckSquare: null }));
    expect(result.current.fen).toBe(fen); // a resigned game accepts no further moves
  });

  it('drops garbage results from the wire instead of ending the game', () => {
    const { result } = renderHook(() => useOnlineGame(joinerProps));
    const players = { white: 'host', black: 'joiner' };
    act(() => transport.handlers.onSnapshot({ epoch: 1, seq: 2, variant: 'standard', hostColor: 'white', players, state: fenAfter('standard'), result: { winner: 'purple', reason: 'hax' } }));
    expect(result.current.result).toBeNull(); // unknown winner → stripped, play continues

    act(() => transport.handlers.onSnapshot({ epoch: 1, seq: 3, variant: 'standard', hostColor: 'white', players, state: fenAfter('standard'), result: { winner: 'white', reason: { evil: true } } }));
    expect(result.current.result).toEqual({ winner: 'white', reason: 'Resigned' }); // non-string reason defaulted
  });

  it('newGame clears a resignation', () => {
    const { result } = renderHook(() => useOnlineGame(hostProps));
    act(() => result.current.resign());
    expect(result.current.result).not.toBeNull();

    act(() => result.current.newGame());
    expect(result.current.result).toBeNull();
    expect(transport.broadcastSnapshot.mock.calls.at(-1)[0].result).toBeNull();
  });
});

describe('duck-decay prime', () => {
  const seatedHost = (gameId, state) => {
    saveSnapshot(gameId, { epoch: 1, seq: 5, variant: 'duck-decay', hostColor: 'white', players: { white: 'host', black: 'joiner' }, state });
    return { gameId, variant: 'duck-decay', selfColor: 'white', isHost: true, hostColor: 'white', selfId: 'host' };
  };
  // A starting position with a duck already on e3 (white placed it) and black to move, prime on.
  const DUCK_ON_E3 = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b piece e3 KQkq - 0 1 break-hits=5 charges=2 charges-b=2 charges-w=2 prime=1';

  it('host applies a valid lift intent: duck removed, charge spent, turn passes', () => {
    const { result } = renderHook(() => useOnlineGame(seatedHost('p1', DUCK_ON_E3)));
    expect(result.current.charges).toEqual({ white: 2, black: 2 });
    transport.broadcastSnapshot.mockClear();

    act(() => transport.handlers.onMoveIntent({ by: 'joiner', pieceMove: { from: 'e7', to: 'e5', promotion: 'q' }, duckSquare: null, prime: { action: 'lift' } }));
    expect(transport.broadcastSnapshot).toHaveBeenCalledTimes(1);
    expect(result.current.duckSquare).toBeNull();
    expect(result.current.currentTurn).toBe('white');
    expect(result.current.charges).toEqual({ white: 2, black: 1 });
  });

  it('host applies a valid repair intent: square healed, charge spent, turn passes', () => {
    const { result } = renderHook(() => useOnlineGame(seatedHost('p2', '4k3/8/8/8/8/8/8/4K3 b piece - - - 0 1 break-hits=5 broken=e4 charges=2 charges-b=2 charges-w=2 prime=1')));
    expect(result.current.brokenSquares).toEqual(['e4']);
    transport.broadcastSnapshot.mockClear();

    act(() => transport.handlers.onMoveIntent({ by: 'joiner', pieceMove: null, duckSquare: null, prime: { action: 'repair', square: 'e4' } }));
    expect(transport.broadcastSnapshot).toHaveBeenCalledTimes(1);
    expect(result.current.brokenSquares).toEqual([]);
    expect(result.current.currentTurn).toBe('white');
    expect(result.current.charges).toEqual({ white: 2, black: 1 });
  });

  it('host rejects a lift with no charges, leaving the board untouched (corrective resync)', () => {
    const { result } = renderHook(() => useOnlineGame(seatedHost('p3', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b piece e3 KQkq - 0 1 break-hits=5 charges=2 charges-b=0 charges-w=2 prime=1')));
    const fenBefore = result.current.fen;
    transport.broadcastSnapshot.mockClear();

    act(() => transport.handlers.onMoveIntent({ by: 'joiner', pieceMove: { from: 'e7', to: 'e5', promotion: 'q' }, duckSquare: null, prime: { action: 'lift' } }));
    expect(result.current.fen).toBe(fenBefore); // piece move not committed
    expect(result.current.currentTurn).toBe('black'); // still the joiner's turn
    expect(result.current.duckSquare).toBe('e3'); // duck not lifted
    expect(transport.broadcastSnapshot).toHaveBeenCalledTimes(1); // corrective resync
  });

  it('host rejects a no-target repair and drops hostile prime shapes', () => {
    const { result } = renderHook(() => useOnlineGame(seatedHost('p4', '4k3/8/8/8/8/8/8/4K3 b piece - - - 0 1 break-hits=5 charges=2 charges-b=2 charges-w=2 prime=1')));
    const fenBefore = result.current.fen;
    transport.broadcastSnapshot.mockClear();

    act(() => transport.handlers.onMoveIntent({ by: 'joiner', pieceMove: null, duckSquare: null, prime: { action: 'repair', square: 'e4' } }));
    expect(transport.broadcastSnapshot).toHaveBeenCalledTimes(1); // no decayed/broken target → resync
    expect(result.current.currentTurn).toBe('black');
    expect(result.current.charges).toEqual({ white: 2, black: 2 });
    transport.broadcastSnapshot.mockClear();

    for (const prime of [42, { action: 'nuke' }, { action: 'repair', square: 'z9' }]) {
      act(() => transport.handlers.onMoveIntent({ by: 'joiner', pieceMove: null, duckSquare: null, prime }));
    }
    expect(result.current.fen).toBe(fenBefore);
    expect(transport.broadcastSnapshot).not.toHaveBeenCalled(); // hostile shapes dropped silently
  });

  it('a lift intent whose piece move captures the king ends the game with no strand', () => {
    const { result } = renderHook(() => useOnlineGame(seatedHost('p5', '4k3/8/8/8/8/8/4q3/4K3 b piece a3 - - 0 1 break-hits=5 charges=2 charges-b=2 charges-w=2 prime=1')));
    act(() => transport.handlers.onMoveIntent({ by: 'joiner', pieceMove: { from: 'e2', to: 'e1', promotion: 'q' }, duckSquare: null, prime: { action: 'lift' } }));
    expect(result.current.result).toEqual({ winner: 'black', reason: 'King captured' });
    expect(result.current.status).toBe('over');
  });

  it('joiner optimistically lifts the duck and sends the right intent shape', () => {
    const props = { gameId: 'p6', variant: 'duck-decay', selfColor: 'black', isHost: false, hostColor: 'white', selfId: 'joiner' };
    const { result } = renderHook(() => useOnlineGame(props));
    act(() => transport.handlers.onSnapshot({ epoch: 1, seq: 5, variant: 'duck-decay', hostColor: 'white', players: { white: 'host', black: 'joiner' }, state: DUCK_ON_E3 }));
    expect(result.current.primeEnabled).toBe(true);

    act(() => result.current.onPieceDrop('e7', 'e5')); // optimistic piece move → duck phase
    expect(result.current.phase).toBe('duck');
    expect(result.current.canLiftDuck).toBe(true);
    act(() => result.current.liftDuck());
    expect(transport.sendMoveIntent).toHaveBeenLastCalledWith({ by: 'joiner', pieceMove: { from: 'e7', to: 'e5', promotion: 'q' }, duckSquare: null, prime: { action: 'lift' } });
    expect(result.current.duckSquare).toBeNull(); // optimistic
    expect(result.current.charges).toEqual({ white: 2, black: 1 });
  });

  it('joiner repairs a square via repair mode and sends a repair intent', () => {
    const props = { gameId: 'p7', variant: 'duck-decay', selfColor: 'black', isHost: false, hostColor: 'white', selfId: 'joiner' };
    const { result } = renderHook(() => useOnlineGame(props));
    act(() => transport.handlers.onSnapshot({ epoch: 1, seq: 5, variant: 'duck-decay', hostColor: 'white', players: { white: 'host', black: 'joiner' }, state: '4k3/8/8/8/8/8/8/4K3 b piece - - - 0 1 break-hits=5 broken=e4 charges=2 charges-b=2 charges-w=2 prime=1' }));
    expect(result.current.repairTargets).toEqual(['e4']);

    act(() => result.current.toggleRepairMode());
    expect(result.current.repairMode).toBe(true);
    act(() => result.current.onSquareClick('e4'));
    expect(transport.sendMoveIntent).toHaveBeenLastCalledWith({ by: 'joiner', pieceMove: null, duckSquare: null, prime: { action: 'repair', square: 'e4' } });
    expect(result.current.brokenSquares).toEqual([]); // optimistic heal
    expect(result.current.repairMode).toBe(false); // mode exits after a repair
  });

  it('joiner resends an unconfirmed repair intent until a snapshot clears it', () => {
    vi.useFakeTimers();
    try {
      const props = { gameId: 'p8', variant: 'duck-decay', selfColor: 'black', isHost: false, hostColor: 'white', selfId: 'joiner' };
      const { result } = renderHook(() => useOnlineGame(props));
      act(() => transport.handlers.onSnapshot({ epoch: 1, seq: 5, variant: 'duck-decay', hostColor: 'white', players: { white: 'host', black: 'joiner' }, state: '4k3/8/8/8/8/8/8/4K3 b piece - - - 0 1 break-hits=5 broken=e4 charges=2 charges-b=2 charges-w=2 prime=1' }));
      act(() => result.current.toggleRepairMode());
      act(() => result.current.onSquareClick('e4'));
      expect(transport.sendMoveIntent).toHaveBeenCalledTimes(1);

      act(() => vi.advanceTimersByTime(2600));
      expect(transport.sendMoveIntent.mock.calls.length).toBeGreaterThan(1); // resent while unconfirmed
      expect(transport.sendMoveIntent.mock.calls.at(-1)[0]).toMatchObject({ pieceMove: null, prime: { action: 'repair', square: 'e4' } });
    } finally {
      vi.useRealTimers();
    }
  });

  it('newGame resets charges to full and ships a prime snapshot', () => {
    const props = { gameId: 'p9', variant: 'duck-decay', variantOptions: { prime: true, charges: 2 }, selfColor: 'white', isHost: true, hostColor: 'white', selfId: 'host' };
    const { result } = renderHook(() => useOnlineGame(props));
    expect(result.current.charges).toEqual({ white: 2, black: 2 });

    act(() => result.current.newGame());
    const snap = transport.broadcastSnapshot.mock.calls.at(-1)[0];
    expect(snap.state).toContain('prime=1');
    expect(snap.state).toContain('charges=2');
    expect(result.current.charges).toEqual({ white: 2, black: 2 });
  });
});
