// A single game-instance interface shared by both online variants, so the controller hook
// (useOnlineGame.js) is variant-agnostic. The Duck Chess engine (src/engine/duck/duckChess.js)
// already exposes this shape; here we wrap chess.js in the SAME shape for standard chess, reusing the
// existing helpers in src/lesson/moves.js and src/engine/gameState.js. Both factories return an
// object with: serialize, boardFen, turnColor, phase, duckSquare, decaySquares, decayLevels,
// breakHitsValue, brokenSquares, primeEnabled, chargeAllotment, chargesLeft, legalPieceTargets,
// legalDuckTargets, movePiece, placeDuck, result, history, captured (the decay/prime accessors are
// inert stubs for non-decay variants). The full list is asserted by INTERFACE in rules.test.js.
//
// A "turn" is two phases (move a piece, then move the duck). Standard chess has a degenerate duck
// phase: movePiece completes the turn immediately (chess.js flips the side to move), phase() never
// reports 'duck', and placeDuck is never called.

import { Chess } from 'chess.js';
import { applyMove, legalTargets, COLOR_NAME } from '../lesson/moves.js';
import { capturedPieces, gameResult } from '../engine/gameState.js';
import { DUCK_DECAY_DEFAULTS, DUCK_PRIME_DEFAULTS, createDuckDecayGame, createDuckGame } from '../engine/duck/duckChess.js';

/** Standard chess as a game instance with the shared interface, backed by chess.js. */
export function createStandardGame(fen) {
  const game = new Chess(fen || undefined);

  return {
    serialize: () => game.fen(),
    boardFen: () => game.fen(),
    turnColor: () => COLOR_NAME[game.turn()],
    phase: () => 'piece',
    duckSquare: () => null,
    decaySquares: () => [],
    decayLevels: () => ({}),
    breakHitsValue: () => null,
    brokenSquares: () => [],
    primeEnabled: () => false,
    chargeAllotment: () => null,
    chargesLeft: () => null,
    legalPieceTargets: (square) => legalTargets(game, square),
    legalDuckTargets: () => [],
    movePiece: ({ from, to, promotion }) => {
      try {
        applyMove(game, { from, to, promotion: promotion || 'q' });
      } catch {
        return { ok: false };
      }
      return { ok: true, kingCaptured: false, result: gameResult(game) };
    },
    // Degenerate for standard chess — the turn already completed in movePiece.
    placeDuck: () => ({ ok: true, result: gameResult(game) }),
    resign: (color) => ({ winner: color === 'white' ? 'black' : 'white', reason: 'Resigned' }),
    result: () => gameResult(game),
    history: () =>
      game.history({ verbose: true }).map((move) => ({
        pieceMove: { from: move.from, to: move.to, promotion: move.promotion ?? null },
        san: move.san,
        duck: null,
      })),
    captured: () => capturedPieces(game),
  };
}

/** Duck Chess as a game instance — the engine already matches the interface. */
export function createDuckChessGame(serialized) {
  const game = createDuckGame(serialized);
  return {
    ...game,
    // Like the standard adapter: resign just computes the result. The engine can't store it (the
    // wire format has no result field), so the online controller keeps it and ships it on snapshots.
    resign: (color) => ({ winner: color === 'white' ? 'black' : 'white', reason: 'Resigned' }),
  };
}

/** Duck Chess with temporary decayed squares left behind by the duck. */
export function createDuckDecayChessGame(serialized, options) {
  const game = createDuckDecayGame(serialized, options);
  return {
    ...game,
    resign: (color) => ({ winner: color === 'white' ? 'black' : 'white', reason: 'Resigned' }),
  };
}

/**
 * The variant registry — the single definition of a variant. Adding one (e.g. duck-decay) means an
 * entry here plus its engine; the lobby's picker, the game panel's label, the invite-link parser,
 * and game construction all derive from this table. Key order is the lobby's display order.
 */
export const VARIANTS = {
  standard: { label: 'Standard chess', pickerLabel: 'Standard', sublabel: 'classic chess', icon: '♔', create: createStandardGame },
  duck: { label: 'Duck Chess', pickerLabel: 'Duck Chess', sublabel: 'place the duck', icon: '🦆', create: createDuckChessGame },
  'duck-decay': { label: 'Duck Chess Decay', pickerLabel: 'Duck Decay', sublabel: 'duck trails block squares', icon: '🦆', defaults: { ...DUCK_DECAY_DEFAULTS, ...DUCK_PRIME_DEFAULTS, prime: false }, create: createDuckDecayChessGame },
};

/** Build the right game instance for a variant from an optional serialized state. */
export function createVariantGame(variant, serialized, options) {
  const entry = Object.hasOwn(VARIANTS, variant) ? VARIANTS[variant] : null;
  if (!entry) throw new Error(`Unknown variant '${variant}'`); // never silently fall back to standard
  return entry.create(serialized, options);
}

export function variantOptionsFromSerialized(variant, serialized) {
  if (variant !== 'duck-decay' || !serialized) return {};
  const state = createDuckDecayGame(serialized).getState();
  return {
    decayTurns: state.decayTurns,
    breakHits: state.breakHits,
    prime: state.primeEnabled ?? false,
    charges: state.chargeAllotment ?? DUCK_PRIME_DEFAULTS.charges,
  };
}

/** Last move {from,to} for board highlighting — the piece move of the most recent turn. */
export function lastMoveOf(instance) {
  const history = instance.history();
  if (history.length === 0) return null;
  const { pieceMove } = history[history.length - 1];
  if (!pieceMove) return null; // a Duck Prime repair turn has no piece move to highlight
  return { from: pieceMove.from, to: pieceMove.to };
}
