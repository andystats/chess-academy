import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearStockfishAnalysisCache,
  useStockfishAnalysis,
} from './useStockfishAnalysis.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

const mocks = vi.hoisted(() => ({
  createStockfish: vi.fn(),
  engines: [],
  calls: [],
}));

vi.mock('./stockfishClient.js', () => ({
  createStockfish: mocks.createStockfish,
}));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function resultFor(fen, learnerSide) {
  return {
    fen,
    learnerSide,
    depthSnapshots: [
      {
        depth: 1,
        selectiveDepth: 1,
        nodes: 10,
        nps: 1000,
        elapsedMs: 10,
        lines: [],
      },
    ],
    staticEvaluation: { perspective: learnerSide },
    bestMove: learnerSide === 'white' ? 'e2e4' : 'e7e5',
  };
}

beforeEach(() => {
  clearStockfishAnalysisCache();
  mocks.createStockfish.mockReset();
  mocks.engines.length = 0;
  mocks.calls.length = 0;
  mocks.createStockfish.mockImplementation(() => {
    const engine = {
      init: vi.fn().mockResolvedValue(undefined),
      analyze: vi.fn((fen, options) => {
        const request = deferred();
        mocks.calls.push({ fen, options, request });
        options.onReady();
        return request.promise;
      }),
      dispose: vi.fn(),
    };
    mocks.engines.push(engine);
    return engine;
  });
});

describe('useStockfishAnalysis', () => {
  it('publishes progressive results, completes, and reuses the session cache', async () => {
    const first = renderHook(() =>
      useStockfishAnalysis({ fen: START, learnerSide: 'white', depth: 8 }),
    );
    await waitFor(() => expect(mocks.calls).toHaveLength(1));
    expect(first.result.current.status).toBe('searching');

    const final = resultFor(START, 'white');
    await act(async () => {
      mocks.calls[0].options.onStaticEvaluation(final.staticEvaluation);
      mocks.calls[0].options.onSnapshot(final.depthSnapshots[0]);
      mocks.calls[0].request.resolve(final);
    });
    expect(first.result.current).toMatchObject({
      status: 'complete',
      fen: START,
      bestMove: 'e2e4',
      cached: false,
    });
    first.unmount();
    expect(mocks.engines[0].dispose).toHaveBeenCalled();

    const second = renderHook(() =>
      useStockfishAnalysis({ fen: START, learnerSide: 'white', depth: 8 }),
    );
    await waitFor(() => expect(second.result.current.status).toBe('complete'));
    expect(second.result.current.cached).toBe(true);
    expect(mocks.createStockfish).toHaveBeenCalledTimes(1);
    second.unmount();
  });

  it('aborts and ignores an old FEN that resolves after a newer result', async () => {
    const { result, rerender, unmount } = renderHook(
      ({ fen }) => useStockfishAnalysis({ fen, depth: 8 }),
      { initialProps: { fen: START } },
    );
    await waitFor(() => expect(mocks.calls).toHaveLength(1));

    rerender({ fen: AFTER_E4 });
    await waitFor(() => expect(mocks.calls).toHaveLength(2));
    expect(mocks.calls[0].options.signal.aborted).toBe(true);

    await act(async () => {
      mocks.calls[1].request.resolve(resultFor(AFTER_E4, 'black'));
    });
    expect(result.current).toMatchObject({
      status: 'complete',
      fen: AFTER_E4,
      learnerSide: 'black',
      bestMove: 'e7e5',
    });

    await act(async () => {
      mocks.calls[0].request.resolve(resultFor(START, 'white'));
    });
    expect(result.current.fen).toBe(AFTER_E4);
    expect(result.current.bestMove).toBe('e7e5');
    unmount();
  });

  it('surfaces a recoverable error and retry creates a clean worker', async () => {
    const { result, unmount } = renderHook(() =>
      useStockfishAnalysis({ fen: START, depth: 8 }),
    );
    await waitFor(() => expect(mocks.calls).toHaveLength(1));
    await act(async () => {
      mocks.calls[0].request.reject(new Error('worker failed'));
    });
    expect(result.current.status).toBe('error');
    expect(result.current.error.message).toBe('worker failed');
    expect(mocks.engines[0].dispose).toHaveBeenCalled();

    act(() => result.current.retry());
    await waitFor(() => expect(mocks.calls).toHaveLength(2));
    expect(mocks.createStockfish).toHaveBeenCalledTimes(2);

    await act(async () => {
      mocks.calls[1].request.resolve(resultFor(START, 'white'));
    });
    expect(result.current.status).toBe('complete');
    unmount();
  });
});
