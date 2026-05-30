import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { Chess } from 'chess.js';
import { useChessLesson } from '../lesson/useChessLesson.js';
import { normalizeStep, playerOrdinalCount, expectedSansAt } from '../lesson/engine.js';
import { mainlineIndexForPlayerMove } from '../lesson/moves.js';
import { listByKind } from './registry.js';

// Closes the loop between authored content and the engine: for EVERY shipped lesson, drive the
// REAL useChessLesson hook from the start of every step to STEP_COMPLETE using the step's own
// declared solution. Catches orientation / setup-ply / acceptableAt mismatches the static
// validator can't see, and automatically covers new lessons as they're added.

const lessons = listByKind('lesson');

function sanToDrop(fen, san) {
  const m = new Chess(fen).move(san);
  return [m.from, m.to];
}

function driveStep(result, rawStep) {
  const d = normalizeStep(rawStep);
  if (d.mode === 'read' || d.mode === 'explore') return;
  if (d.mode === 'choose') {
    const correct = rawStep.options.find((o) => o.correct);
    act(() => result.current.chooseOption(correct.id));
    return;
  }
  for (let k = 0; k < playerOrdinalCount(d); k++) {
    const [from, to] = sanToDrop(result.current.fen, expectedSansAt(d, k)[0]);
    act(() => {
      result.current.onPieceDrop(from, to);
    });
    act(() => vi.advanceTimersByTime(600)); // resolve the opponent reply if any
  }
}

function fenAfterMoves(fen, moves) {
  const game = new Chess(fen);
  for (const move of moves) game.move(move);
  return game.fen();
}

describe('content ↔ engine', () => {
  it('declares only legal authored moves', () => {
    for (const lesson of lessons) {
      for (const step of lesson.body.steps) {
        if (!step.fen) continue;
        expect(() => new Chess(step.fen), `${lesson.id}/${step.id} has a valid FEN`).not.toThrow();

        if (step.type === 'single-move') {
          for (const san of step.solution.san) {
            expect(() => new Chess(step.fen).move(san), `${lesson.id}/${step.id} accepts ${san}`).not.toThrow();
          }
        }

        if (step.type === 'line') {
          expect(() => fenAfterMoves(step.fen, step.mainline), `${lesson.id}/${step.id} mainline is legal`).not.toThrow();

          for (const [ordinal, sans] of Object.entries(step.acceptableAt ?? {})) {
            const moveIndex = mainlineIndexForPlayerMove(Number(ordinal), step.hasSetupMove ?? false);
            const fen = fenAfterMoves(step.fen, step.mainline.slice(0, moveIndex));
            for (const san of sans) {
              expect(() => new Chess(fen).move(san), `${lesson.id}/${step.id} accepts alternate ${san}`).not.toThrow();
            }
          }
        }
      }
    }
  });

  for (const lesson of lessons) {
    it(`drives every step of "${lesson.id}" to completion`, () => {
      vi.useFakeTimers();
      try {
        const { result } = renderHook(() => useChessLesson(lesson));
        const steps = lesson.body.steps;
        for (let i = 0; i < steps.length; i++) {
          expect(result.current.stepIndex).toBe(i);
          driveStep(result, steps[i]);
          expect(result.current.canAdvance).toBe(true);
          if (i < steps.length - 1) act(() => result.current.next());
        }
      } finally {
        vi.useRealTimers();
      }
    });
  }
});
