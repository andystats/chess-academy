import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEngineGame } from './useEngineGame.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// White to move, Qxf7# (Scholar's mate). Used to test player-wins detection.
const MATE_IN_ONE = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1';
// White to move, Qb6 stalemates Black (Kc7 + Qb1 vs lone Ka8). Used to test the draw branch.
const STALEMATE_IN_ONE = 'k7/2K5/8/8/8/8/8/1Q6 w - - 0 1';

// Mock the worker-backed engine. requestMove returns a promise we settle by hand (resolve OR reject)
// so we can drive the async reply — and settle it AFTER a reset to exercise the stale-reply guard.
const { requestMove, setStrength, interrupt, deferreds } = vi.hoisted(() => {
  const deferreds = [];
  return {
    deferreds,
    requestMove: vi.fn(() => new Promise((resolve, reject) => deferreds.push({ resolve, reject }))),
    setStrength: vi.fn(),
    interrupt: vi.fn(),
  };
});

vi.mock('./useStockfish.js', () => ({
  useStockfish: () => ({ ready: true, error: null, requestMove, setStrength, interrupt }),
}));

beforeEach(() => {
  requestMove.mockClear();
  setStrength.mockClear();
  interrupt.mockClear();
  deferreds.length = 0;
});

describe('useEngineGame', () => {
  it('plays the engine reply after a legal player move', async () => {
    const { result } = renderHook(() => useEngineGame({ fen: START, playerSide: 'white', skillLevel: 4 }));
    expect(result.current.status).toBe('player-turn');

    act(() => {
      result.current.onPieceDrop('e2', 'e4');
    });
    expect(result.current.status).toBe('engine-thinking');
    expect(requestMove).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferreds[0].resolve('e7e5');
    });
    expect(result.current.status).toBe('player-turn');
    expect(result.current.history).toEqual(['e4', 'e5']);
  });

  it('drops a stale engine reply that resolves after a new game', async () => {
    const { result } = renderHook(() => useEngineGame({ fen: START, playerSide: 'white', skillLevel: 4 }));
    act(() => {
      result.current.onPieceDrop('e2', 'e4');
    });
    // Reset before the engine answers — the in-flight reply must be discarded, not applied.
    act(() => {
      result.current.newGame();
    });
    expect(result.current.history).toEqual([]);

    await act(async () => {
      deferreds[0].resolve('e7e5');
    });
    expect(result.current.history).toEqual([]);
    expect(result.current.status).toBe('player-turn');
  });

  it('asks the engine to move first when the player is Black', async () => {
    const { result } = renderHook(() => useEngineGame({ fen: START, playerSide: 'black', skillLevel: 4 }));
    expect(result.current.status).toBe('engine-thinking');
    expect(requestMove).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferreds[0].resolve('d2d4');
    });
    expect(result.current.status).toBe('player-turn');
    expect(result.current.history).toEqual(['d4']);
  });

  it('records a loss when the player resigns', () => {
    const { result } = renderHook(() => useEngineGame({ fen: START, playerSide: 'white', skillLevel: 4 }));
    act(() => {
      result.current.resign();
    });
    expect(result.current.status).toBe('over');
    expect(result.current.result).toMatchObject({ winner: 'black' });
  });

  it('detects a player win by checkmate', () => {
    const { result } = renderHook(() => useEngineGame({ fen: MATE_IN_ONE, playerSide: 'white', skillLevel: 4 }));
    act(() => {
      result.current.onPieceDrop('h5', 'f7'); // Qxf7#
    });
    expect(result.current.status).toBe('over');
    expect(result.current.result).toMatchObject({ winner: 'white', reason: 'Checkmate' });
    expect(requestMove).not.toHaveBeenCalled(); // game ended — never asks the engine to reply
  });

  it('detects a draw by stalemate (not a player win)', () => {
    const { result } = renderHook(() => useEngineGame({ fen: STALEMATE_IN_ONE, playerSide: 'white', skillLevel: 4 }));
    act(() => {
      result.current.onPieceDrop('b1', 'b6'); // Qb6 stalemates Black
    });
    expect(result.current.status).toBe('over');
    expect(result.current.result).toMatchObject({ winner: 'draw' });
  });

  it('takes back a full move and returns to the player', async () => {
    const { result } = renderHook(() => useEngineGame({ fen: START, playerSide: 'white', skillLevel: 4 }));
    act(() => {
      result.current.onPieceDrop('e2', 'e4');
    });
    await act(async () => {
      deferreds[0].resolve('e7e5');
    });
    expect(result.current.history).toEqual(['e4', 'e5']);

    act(() => {
      result.current.takeBack();
    });
    expect(result.current.history).toEqual([]);
    expect(result.current.status).toBe('player-turn');
  });

  it('leaves the board untouched if the engine returns an unplayable move', async () => {
    const { result } = renderHook(() => useEngineGame({ fen: START, playerSide: 'white', skillLevel: 4 }));
    act(() => {
      result.current.onPieceDrop('e2', 'e4');
    });
    await act(async () => {
      deferreds[0].resolve('zzzz'); // garbage — must not corrupt the game
    });
    expect(result.current.history).toEqual(['e4']);
  });

  it('ends the game with an error when the engine is unavailable', async () => {
    const { result } = renderHook(() => useEngineGame({ fen: START, playerSide: 'white', skillLevel: 4 }));
    act(() => {
      result.current.onPieceDrop('e2', 'e4');
    });
    await act(async () => {
      deferreds[0].reject(new Error('boom'));
    });
    expect(result.current.status).toBe('over');
    expect(result.current.result).toMatchObject({ winner: null });
  });
});
