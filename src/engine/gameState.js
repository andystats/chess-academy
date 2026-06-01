import { opposite } from '../lesson/moves.js';

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
