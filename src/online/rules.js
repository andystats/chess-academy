// A single game-instance interface shared by both online variants, so the controller hook
// (useOnlineGame.js) is variant-agnostic. The Duck Chess engine (src/engine/duck/duckChess.js)
// already exposes this shape; here we wrap chess.js in the SAME shape for standard chess, reusing the
// existing helpers in src/lesson/moves.js and src/engine/gameState.js. Both factories return an
// object with: serialize, boardFen, turnColor, phase, duckSquare, legalPieceTargets, legalDuckTargets,
// movePiece, placeDuck, result, history, captured.
//
// A "turn" is two phases (move a piece, then move the duck). Standard chess has a degenerate duck
// phase: movePiece completes the turn immediately (chess.js flips the side to move), phase() never
// reports 'duck', and placeDuck is never called.

import { Chess } from 'chess.js';
import { applyMove, legalTargets } from '../lesson/moves.js';
import { capturedPieces, gameResult } from '../engine/gameState.js';
import { createDuckGame } from '../engine/duck/duckChess.js';

const COLOR_NAME = { w: 'white', b: 'black' };

/** Standard chess as a game instance with the shared interface, backed by chess.js. */
export function createStandardGame(fen) {
  const game = new Chess(fen || undefined);

  return {
    serialize: () => game.fen(),
    boardFen: () => game.fen(),
    turnColor: () => COLOR_NAME[game.turn()],
    phase: () => 'piece',
    duckSquare: () => null,
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
  return createDuckGame(serialized);
}

/** Build the right game instance for a variant from an optional serialized state. */
export function createVariantGame(variant, serialized) {
  return variant === 'duck' ? createDuckChessGame(serialized) : createStandardGame(serialized);
}

/** Last move {from,to} for board highlighting — the piece move of the most recent turn. */
export function lastMoveOf(instance) {
  const history = instance.history();
  if (history.length === 0) return null;
  const { pieceMove } = history[history.length - 1];
  return { from: pieceMove.from, to: pieceMove.to };
}
