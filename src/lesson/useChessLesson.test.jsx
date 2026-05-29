import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChessLesson } from './useChessLesson.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const wrap = (steps) => ({ body: { steps } });

const proseStep = { id: 'p', type: 'prose', fen: START, markdown: 'read me' };
const singleStep = {
  id: 'sm',
  type: 'single-move',
  fen: START,
  markdown: 'x',
  solution: { san: ['e4', 'd4'] },
  feedback: { correct: 'C', wrong: 'W' },
  hints: [{ text: 'h1' }, { text: 'h2' }],
};
const lineStep = {
  id: 'ln',
  type: 'line',
  fen: START,
  markdown: 'x',
  mainline: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'],
  acceptableAt: { 2: ['Bc4'] },
};
const chooseStep = {
  id: 'ch',
  type: 'choose',
  fen: START,
  markdown: 'x',
  options: [
    { id: 'a', label: 'A', correct: true, explain: 'yes' },
    { id: 'b', label: 'B', correct: false, explain: 'no' },
  ],
};

// Stable envelope objects. The hook keys its load effect on the envelope identity, so the
// argument must NOT be reconstructed on every render (doing so re-fires the effect each render
// → infinite loop). The real app always passes a stable object from the content registry.
const proseEnv = wrap([proseStep]);
const singleEnv = wrap([singleStep]);
const lineEnv = wrap([lineStep]);
const lineThenProseEnv = wrap([lineStep, proseStep]);
const chooseEnv = wrap([chooseStep]);

describe('useChessLesson — loading & prose', () => {
  it('loads the first step and auto-completes prose', () => {
    const { result } = renderHook(() => useChessLesson(proseEnv));
    expect(result.current.step.id).toBe('p');
    expect(result.current.status).toBe('complete');
    expect(result.current.canAdvance).toBe(true);
    expect(result.current.arePiecesDraggable).toBe(false);
  });
});

describe('useChessLesson — single-move classification', () => {
  it('accepts a correct move and completes', () => {
    const { result } = renderHook(() => useChessLesson(singleEnv));
    let ret;
    act(() => {
      ret = result.current.onPieceDrop('e2', 'e4');
    });
    expect(ret).toBe(true);
    expect(result.current.status).toBe('complete');
    expect(result.current.feedback).toEqual({ kind: 'correct', text: 'C' });
  });

  it('rejects a legal-but-wrong move without disturbing the position', () => {
    const { result } = renderHook(() => useChessLesson(singleEnv));
    let ret;
    act(() => {
      ret = result.current.onPieceDrop('e2', 'e3'); // legal, not a solution
    });
    expect(ret).toBe(false);
    expect(result.current.status).toBe('awaiting');
    expect(result.current.feedback).toEqual({ kind: 'wrong', text: 'W' });
    expect(result.current.fen).toBe(START); // live game untouched
  });

  it('rejects an illegal move via try/catch', () => {
    const { result } = renderHook(() => useChessLesson(singleEnv));
    let ret;
    act(() => {
      ret = result.current.onPieceDrop('e2', 'e5'); // illegal
    });
    expect(ret).toBe(false);
    expect(result.current.feedback).toBe(null);
    expect(result.current.fen).toBe(START);
  });

  it('reveals hints up to the limit', () => {
    const { result } = renderHook(() => useChessLesson(singleEnv));
    act(() => result.current.requestHint());
    expect(result.current.revealedHints).toBe(1);
    act(() => result.current.requestHint());
    act(() => result.current.requestHint());
    expect(result.current.revealedHints).toBe(2); // capped at hints.length
  });
});

describe('useChessLesson — tap-to-move', () => {
  it('selects a piece then moves on the second tap', () => {
    const { result } = renderHook(() => useChessLesson(singleEnv));
    act(() => result.current.onSquareClick('e2'));
    expect(result.current.selectedSquare).toBe('e2');
    expect(result.current.legalTargets).toEqual(expect.arrayContaining(['e3', 'e4']));

    act(() => result.current.onSquareClick('e4')); // correct target
    expect(result.current.status).toBe('complete');
    expect(result.current.selectedSquare).toBe(null);
  });

  it('deselects when tapping the same square twice', () => {
    const { result } = renderHook(() => useChessLesson(singleEnv));
    act(() => result.current.onSquareClick('e2'));
    act(() => result.current.onSquareClick('e2'));
    expect(result.current.selectedSquare).toBe(null);
  });

  it('reselects when tapping a different own piece', () => {
    const { result } = renderHook(() => useChessLesson(singleEnv));
    act(() => result.current.onSquareClick('e2'));
    act(() => result.current.onSquareClick('d2')); // not a legal e2 move → reselect d2
    expect(result.current.selectedSquare).toBe('d2');
  });
});

describe('useChessLesson — multi-move line', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const playMove = (result, from, to) => {
    act(() => {
      result.current.onPieceDrop(from, to);
    });
  };
  const letOpponentReply = (result) => {
    act(() => {
      vi.advanceTimersByTime(600);
    });
  };

  it('walks the mainline, auto-playing the opponent, to completion', () => {
    const { result } = renderHook(() => useChessLesson(lineEnv));
    playMove(result, 'e2', 'e4');
    expect(result.current.status).toBe('playing-opponent');
    letOpponentReply(result);
    expect(result.current.status).toBe('awaiting');

    playMove(result, 'g1', 'f3');
    letOpponentReply(result);
    expect(result.current.status).toBe('awaiting');

    playMove(result, 'f1', 'b5'); // last player move, no reply
    expect(result.current.status).toBe('complete');
    expect(result.current.canAdvance).toBe(true);
  });

  it('accepts a converging alternative (Bc4) at the final move', () => {
    const { result } = renderHook(() => useChessLesson(lineEnv));
    playMove(result, 'e2', 'e4');
    letOpponentReply(result);
    playMove(result, 'g1', 'f3');
    letOpponentReply(result);
    playMove(result, 'f1', 'c4'); // acceptableAt[2]
    expect(result.current.status).toBe('complete');
  });

  it('restartStep returns to the start position', () => {
    const { result } = renderHook(() => useChessLesson(lineEnv));
    playMove(result, 'e2', 'e4');
    letOpponentReply(result);
    expect(result.current.fen).not.toBe(START);
    act(() => result.current.restartStep());
    expect(result.current.fen).toBe(START);
    expect(result.current.status).toBe('awaiting');
  });

  it('does not apply a stale opponent reply after navigating away', () => {
    const { result } = renderHook(() => useChessLesson(lineThenProseEnv));
    playMove(result, 'e2', 'e4'); // schedules opponent reply for step 0
    act(() => result.current.next()); // move to the prose step before the timer fires
    expect(result.current.step.id).toBe('p');
    expect(() => act(() => vi.advanceTimersByTime(600))).not.toThrow();
    expect(result.current.step.id).toBe('p'); // unaffected by the stale timer
    expect(result.current.fen).toBe(START);
  });
});

describe('useChessLesson — choose', () => {
  it('stays awaiting on a wrong option, completes on the right one', () => {
    const { result } = renderHook(() => useChessLesson(chooseEnv));
    act(() => result.current.chooseOption('b'));
    expect(result.current.status).toBe('awaiting');
    expect(result.current.feedback.kind).toBe('wrong');

    act(() => result.current.chooseOption('a'));
    expect(result.current.status).toBe('complete');
    expect(result.current.feedback.kind).toBe('correct');
    expect(result.current.canAdvance).toBe(true);
  });

  it('keeps a resolved (correct) choice sticky', () => {
    const { result } = renderHook(() => useChessLesson(chooseEnv));
    act(() => result.current.chooseOption('a')); // correct → complete
    expect(result.current.status).toBe('complete');
    act(() => result.current.chooseOption('b')); // further taps ignored once resolved
    expect(result.current.status).toBe('complete');
    expect(result.current.chosenOptionId).toBe('a');
  });
});
