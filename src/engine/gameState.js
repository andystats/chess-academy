import { opposite } from '../lesson/moves.js';
import { colorOf } from './duck/board.js';

export const PIECE_SYMBOLS = {
  white: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕' },
  black: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' },
};

export function gameResult(game) {
  if (!game.isGameOver()) return null;
  if (game.isCheckmate()) {
    const winner = opposite(game.turn() === 'w' ? 'white' : 'black');
    return { winner, reason: 'Checkmate' };
  }
  if (game.isStalemate()) return { winner: 'draw', reason: 'Stalemate' };
  if (game.isInsufficientMaterial()) return { winner: 'draw', reason: 'Insufficient material' };
  if (game.isThreefoldRepetition()) return { winner: 'draw', reason: 'Threefold repetition' };
  return { winner: 'draw', reason: 'Draw' };
}

export function capturedPieces(game) {
  const captured = { white: [], black: [] };
  for (const move of game.history({ verbose: true })) {
    if (!move.captured) continue;
    captured[move.color === 'w' ? 'black' : 'white'].push(move.captured);
  }
  return captured;
}

// Full starting material per color (kings excluded), used to derive captured pieces from a board.
// The king is omitted on purpose: capturing it ends the game (Duck Chess), which the result banner
// conveys — and there is no king glyph in PIECE_SYMBOLS, so listing it would render blank.
const INITIAL_COUNTS = { p: 8, n: 2, b: 2, r: 2, q: 1 };

/**
 * Captured pieces derived from a flat 64-cell board array, in the same shape as `capturedPieces`.
 * Snapshot-safe — a game rebuilt from a serialized state reports the same as one played move by
 * move, which the online sync relies on; any board-array variant (Duck Chess or Duck Decay) can
 * reuse it. Promotions can make it cosmetically off (a promoted pawn reads as
 * captured), which is acceptable for a casual game.
 */
export function capturedFromBoard(board) {
  const present = { w: {}, b: {} };
  for (const piece of board) {
    if (!piece) continue;
    const color = colorOf(piece);
    const type = piece.toLowerCase();
    present[color][type] = (present[color][type] || 0) + 1;
  }
  const captured = { white: [], black: [] };
  for (const [color, name] of [['w', 'white'], ['b', 'black']]) {
    for (const [type, count] of Object.entries(INITIAL_COUNTS)) {
      const missing = count - (present[color][type] || 0);
      for (let i = 0; i < missing; i += 1) captured[name].push(type);
    }
  }
  return captured;
}
