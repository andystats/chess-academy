import { useReducer, useRef, useEffect, useMemo, useCallback } from 'react';
import { Chess } from 'chess.js';
import { acceptableLans, moveToLan, applyMove, legalTargets } from './moves.js';
import {
  normalizeStep,
  expectedSansAt,
  opponentReplyAt,
  playerOrdinalCount,
} from './engine.js';

// React wrapper around the pure engine in engine.js. Holds the live chess.js game (in a ref, not
// state) and the opponent-reply timer; the reducer holds only derived, renderable state.
//
// Correctness choices:
//  - chess.js .move() THROWS on illegal moves, so every attempt is wrapped in try/catch.
//  - A wrong-but-legal move is classified on a CLONE and never applied to the live game, so the
//    line is preserved with zero undo bookkeeping (the live game stays at the decision position).
//  - The opponent reply is delayed with setTimeout; the timer is cleared on step change/unmount
//    and its callback is guarded by a run-id so a stale timer firing after navigation no-ops.

const OPPONENT_DELAY_MS = 450;
const DEFAULT_CORRECT = 'Nice move!';
const DEFAULT_WRONG = 'Not quite — have another look and try again.';

function initialStatusFor(d) {
  if (d.mode === 'read') return 'complete';
  if (d.mode === 'explore') return 'explore';
  return 'awaiting'; // line, choose
}

const initialState = {
  stepIndex: 0,
  reloadNonce: 0,
  status: 'awaiting',
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  playerPly: 0,
  feedback: null,
  selectedSquare: null,
  legalTargets: [],
  revealedHints: 0,
  chosenOptionId: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'load':
      return {
        ...state,
        status: action.status,
        fen: action.fen,
        playerPly: 0,
        feedback: null,
        selectedSquare: null,
        legalTargets: [],
        revealedHints: 0,
        chosenOptionId: null,
      };
    case 'explore-moved':
      return { ...state, fen: action.fen, selectedSquare: null, legalTargets: [] };
    case 'correct':
      return {
        ...state,
        status: action.status,
        fen: action.fen,
        feedback: { kind: 'correct', text: action.text },
        selectedSquare: null,
        legalTargets: [],
      };
    case 'opponent-next':
      return { ...state, status: 'awaiting', fen: action.fen, playerPly: action.playerPly };
    case 'opponent-complete':
      return { ...state, status: 'complete', fen: action.fen };
    case 'wrong':
      return { ...state, feedback: { kind: 'wrong', text: action.text }, selectedSquare: null, legalTargets: [] };
    case 'select':
      return { ...state, selectedSquare: action.square, legalTargets: action.targets };
    case 'deselect':
      return { ...state, selectedSquare: null, legalTargets: [] };
    case 'reveal-hint':
      return { ...state, revealedHints: Math.min(action.max, state.revealedHints + 1) };
    case 'choose':
      return {
        ...state,
        chosenOptionId: action.id,
        status: action.correct ? 'complete' : 'awaiting',
        feedback: { kind: action.correct ? 'correct' : 'wrong', text: action.text },
      };
    case 'set-step':
      return { ...state, stepIndex: action.stepIndex };
    case 'restart':
      return { ...state, reloadNonce: state.reloadNonce + 1 };
    default:
      return state;
  }
}

export function useChessLesson(envelope) {
  const steps = useMemo(
    () => (envelope?.body?.steps ?? []).map(normalizeStep),
    [envelope],
  );
  const gameRef = useRef(null);
  const timerRef = useRef(null);
  const runIdRef = useRef(0);
  const [state, dispatch] = useReducer(reducer, initialState);

  const descriptor = steps[state.stepIndex] ?? null;

  // Load / reload the current step: build a fresh game and reset per-step state.
  useEffect(() => {
    clearTimeout(timerRef.current);
    runIdRef.current += 1;
    const d = steps[state.stepIndex];
    if (!d) return undefined;
    const game = new Chess(d.fen || undefined);
    gameRef.current = game;
    // (Authored lessons have no setup move; an imported puzzle would apply d.mainline[0] here.)
    dispatch({ type: 'load', fen: game.fen(), status: initialStatusFor(d) });
    return () => clearTimeout(timerRef.current);
  }, [steps, state.stepIndex, state.reloadNonce]);

  // After a correct, non-terminal player move, play the opponent's reply on a guarded timer.
  const scheduleOpponent = useCallback((d, reply, ordinal) => {
    const myRun = runIdRef.current;
    timerRef.current = setTimeout(() => {
      if (myRun !== runIdRef.current) return; // stale: the step changed under us
      const game = gameRef.current;
      try {
        applyMove(game, reply);
      } catch {
        return; // validated content shouldn't reach here
      }
      const nextOrdinal = ordinal + 1;
      if (game.isGameOver() || nextOrdinal >= playerOrdinalCount(d)) {
        dispatch({ type: 'opponent-complete', fen: game.fen() });
      } else {
        dispatch({ type: 'opponent-next', fen: game.fen(), playerPly: nextOrdinal });
      }
    }, OPPONENT_DELAY_MS);
  }, []);

  // Classify and (if correct) apply the player's move in a `line`/`single-move` step.
  const attemptLineMove = useCallback(
    (move) => {
      const d = descriptor;
      const game = gameRef.current;
      if (!d || state.status !== 'awaiting') return false;

      const fenBefore = game.fen();
      let expected;
      let lan;
      try {
        expected = acceptableLans(fenBefore, expectedSansAt(d, state.playerPly));
        lan = moveToLan(applyMove(new Chess(fenBefore), move)); // classify on a clone
      } catch {
        return false; // illegal — react-chessboard snaps the piece back
      }

      if (!expected.has(lan)) {
        dispatch({ type: 'wrong', text: d.feedback.wrong || DEFAULT_WRONG });
        return false; // legal but wrong: live game untouched, piece snaps back
      }

      applyMove(game, move); // commit to the live game
      const ordinal = state.playerPly;
      const correctText = d.feedback.correct || DEFAULT_CORRECT;
      // Play the opponent's reply unless the move ended the game (e.g. a mid-line checkmate),
      // in which case the step is complete now — never schedule an illegal post-mate reply.
      const reply = game.isGameOver() ? null : opponentReplyAt(d, ordinal);
      if (reply) {
        dispatch({ type: 'correct', status: 'playing-opponent', fen: game.fen(), text: correctText });
        scheduleOpponent(d, reply, ordinal);
      } else {
        dispatch({ type: 'correct', status: 'complete', fen: game.fen(), text: correctText });
      }
      return true;
    },
    [descriptor, state.status, state.playerPly, scheduleOpponent],
  );

  // Free play in `free-explore`: apply any legal move, no validation.
  const attemptExploreMove = useCallback((move) => {
    const game = gameRef.current;
    try {
      applyMove(game, move);
    } catch {
      return false;
    }
    dispatch({ type: 'explore-moved', fen: game.fen() });
    return true;
  }, []);

  // Route a move to the right handler for the current step's mode (used by drag, promotion, tap).
  const attemptMove = useCallback(
    (move) => {
      if (!descriptor) return false;
      if (descriptor.mode === 'explore') return attemptExploreMove(move);
      if (descriptor.mode === 'line') return attemptLineMove(move);
      return false;
    },
    [descriptor, attemptExploreMove, attemptLineMove],
  );

  const onPieceDrop = useCallback(
    (from, to) => attemptMove({ from, to, promotion: 'q' }),
    [attemptMove],
  );

  // react-chessboard calls this when a promotion is chosen via the dialog.
  const onPromotionPieceSelect = useCallback(
    (piece, from, to) => {
      if (!from || !to) return false;
      return attemptMove({ from, to, promotion: piece ? piece[1].toLowerCase() : 'q' });
    },
    [attemptMove],
  );

  // Tap-to-move: first tap selects + highlights legal targets, second tap moves.
  const onSquareClick = useCallback(
    (square) => {
      const d = descriptor;
      const game = gameRef.current;
      if (!d || (d.mode !== 'line' && d.mode !== 'explore')) return;
      if (d.mode === 'line' && state.status !== 'awaiting') return;

      if (state.selectedSquare) {
        if (square === state.selectedSquare) {
          dispatch({ type: 'deselect' });
          return;
        }
        const moved = attemptMove({ from: state.selectedSquare, to: square, promotion: 'q' });
        if (!moved) {
          // Re-select if they tapped another of their own pieces; otherwise just clear.
          const targets = legalTargets(game, square);
          if (targets.length) dispatch({ type: 'select', square, targets });
          else dispatch({ type: 'deselect' });
        }
        return;
      }

      const targets = legalTargets(game, square);
      if (targets.length) dispatch({ type: 'select', square, targets });
    },
    [descriptor, state.status, state.selectedSquare, attemptMove],
  );

  const chooseOption = useCallback(
    (id) => {
      const d = descriptor;
      if (!d || d.mode !== 'choose' || state.status === 'complete') return; // resolved choices are sticky
      const opt = d.options.find((o) => o.id === id);
      if (!opt) return;
      dispatch({ type: 'choose', id, correct: opt.correct, text: opt.explain || '' });
    },
    [descriptor, state.status],
  );

  const requestHint = useCallback(() => {
    if (descriptor) dispatch({ type: 'reveal-hint', max: descriptor.hints.length });
  }, [descriptor]);

  const restartStep = useCallback(() => dispatch({ type: 'restart' }), []);
  const next = useCallback(
    () => dispatch({ type: 'set-step', stepIndex: Math.min(steps.length - 1, state.stepIndex + 1) }),
    [steps.length, state.stepIndex],
  );
  const prev = useCallback(
    () => dispatch({ type: 'set-step', stepIndex: Math.max(0, state.stepIndex - 1) }),
    [state.stepIndex],
  );

  // Merge authored annotation arrows with any revealed-hint arrows (tap-selection is kept
  // separate via selectedSquare/legalTargets so the board can style it distinctly).
  const { arrows, highlights } = useMemo(() => {
    const arr = [...(descriptor?.annotations?.arrows ?? [])];
    for (let i = 0; i < state.revealedHints; i++) {
      const h = descriptor?.hints?.[i];
      if (h?.arrows) arr.push(...h.arrows);
    }
    return { arrows: arr, highlights: descriptor?.annotations?.highlight ?? [] };
  }, [descriptor, state.revealedHints]);

  const arePiecesDraggable =
    descriptor?.mode === 'explore' || (descriptor?.mode === 'line' && state.status === 'awaiting');
  const canAdvance = state.status === 'complete' || state.status === 'explore';

  return {
    step: descriptor,
    stepIndex: state.stepIndex,
    totalSteps: steps.length,
    isFirstStep: state.stepIndex === 0,
    isLastStep: state.stepIndex === steps.length - 1,
    fen: state.fen,
    orientation: descriptor?.orientation ?? 'white',
    arePiecesDraggable,
    selectedSquare: state.selectedSquare,
    legalTargets: state.legalTargets,
    arrows,
    highlights,
    status: state.status,
    feedback: state.feedback,
    canAdvance,
    chosenOptionId: state.chosenOptionId,
    revealedHints: state.revealedHints,
    onPieceDrop,
    onPromotionPieceSelect,
    onSquareClick,
    chooseOption,
    requestHint,
    restartStep,
    next,
    prev,
  };
}
