// Pseudo-legal move generation for Duck Chess. "Pseudo-legal" is the whole story here: Duck Chess has
// NO check and NO checkmate, so there is no "remove moves that leave the king attacked" pass — a king
// may move into or stay on an attacked square, and the game ends only when a king is actually captured.
// Capturing the enemy king is therefore a normal, generated move (we must NOT skip it the way ordinary
// chess does). The duck (state.duck) is an impassable blocker: nothing may land on it or slide through
// it, though knights still jump over it.

import { FILES, colorOf, fileRankToIndex, fileRankToSquare, indexToSquare, pieceAt, squareToIndex } from './board.js';

const BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const KING_DIRS = [...BISHOP_DIRS, ...ROOK_DIRS];
const KNIGHT_HOPS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];

/** True when the duck sits on this file/rank (so the square is impassable). */
function isDuck(duckIndex, file, rank) {
  return duckIndex !== null && duckIndex === fileRankToIndex(file, rank);
}

/** Empty for movement purposes: no piece AND not the duck. */
function isFree(board, duckIndex, file, rank) {
  return pieceAt(board, file, rank) === null && !isDuck(duckIndex, file, rank);
}

/** A move from one file/rank to another, with optional flags merged in. */
function mk(ff, fr, tf, tr, extra = {}) {
  return { from: fileRankToSquare(ff, fr), to: fileRankToSquare(tf, tr), ...extra };
}

function slideMoves(board, duckIndex, file, rank, dirs, turn, out) {
  for (const [df, dr] of dirs) {
    let f = file + df;
    let r = rank + dr;
    let target = pieceAt(board, f, r);
    while (target !== undefined && !isDuck(duckIndex, f, r)) {
      // off-board / the duck ends the ray (handled by the loop condition)
      if (target !== null) {
        if (colorOf(target) !== turn) out.push(mk(file, rank, f, r, { capture: true }));
        break; // any piece blocks the ray
      }
      out.push(mk(file, rank, f, r));
      f += df;
      r += dr;
      target = pieceAt(board, f, r);
    }
  }
}

function stepMoves(board, duckIndex, file, rank, dirs, turn, out) {
  for (const [df, dr] of dirs) {
    const f = file + df;
    const r = rank + dr;
    const target = pieceAt(board, f, r);
    if (target === undefined || isDuck(duckIndex, f, r)) continue; // off board or onto the duck
    if (target === null) out.push(mk(file, rank, f, r));
    else if (colorOf(target) !== turn) out.push(mk(file, rank, f, r, { capture: true }));
  }
}

function pawnMoves(board, duckIndex, file, rank, turn, ep, out) {
  const dir = turn === 'w' ? 1 : -1;
  const startRank = turn === 'w' ? 2 : 7;
  const promoRank = turn === 'w' ? 8 : 1;
  const epIndex = ep ? squareToIndex(ep) : null;

  // Pushes.
  const one = rank + dir;
  if (isFree(board, duckIndex, file, one)) {
    addPawnMove(file, rank, file, one, one === promoRank, out);
    const two = rank + 2 * dir;
    if (rank === startRank && isFree(board, duckIndex, file, two)) {
      out.push(mk(file, rank, file, two, { double: true }));
    }
  }

  // Captures (diagonal), including en passant.
  for (const cf of [file - 1, file + 1]) {
    if (isDuck(duckIndex, cf, one)) continue; // can't capture onto the duck
    const target = pieceAt(board, cf, one);
    if (target === undefined) continue;
    if (target && colorOf(target) !== turn) {
      addPawnMove(file, rank, cf, one, one === promoRank, out, { capture: true });
    } else if (target === null && epIndex !== null && epIndex === fileRankToIndex(cf, one)) {
      out.push(mk(file, rank, cf, one, { capture: true, ep: true }));
    }
  }
}

function addPawnMove(ff, fr, tf, tr, isPromotion, out, extra = {}) {
  if (isPromotion) {
    for (const promotion of ['q', 'r', 'b', 'n']) out.push(mk(ff, fr, tf, tr, { ...extra, promotion }));
  } else {
    out.push(mk(ff, fr, tf, tr, extra));
  }
}

function castlingMoves(board, duckIndex, turn, castling, out) {
  const rank = turn === 'w' ? 1 : 8;
  const [kingFlag, queenFlag] = turn === 'w' ? ['K', 'Q'] : ['k', 'q'];
  const e = FILES.indexOf('e');
  // No check filtering: only the squares the king and rook travel must be empty and duck-free. The
  // king/rook home-square occupancy is implied by the castling rights still being present.
  if (castling.includes(kingFlag) && isFree(board, duckIndex, 5, rank) && isFree(board, duckIndex, 6, rank)) {
    out.push(mk(e, rank, 6, rank, { castleK: true }));
  }
  if (
    castling.includes(queenFlag) &&
    isFree(board, duckIndex, 3, rank) &&
    isFree(board, duckIndex, 2, rank) &&
    isFree(board, duckIndex, 1, rank)
  ) {
    out.push(mk(e, rank, 2, rank, { castleQ: true }));
  }
}

/** All pseudo-legal piece moves for the side to move (the `piece` phase of a turn). */
export function generatePieceMoves(state) {
  const { board, turn, ep, castling } = state;
  const duckIndex = state.duck ? squareToIndex(state.duck) : null;
  const out = [];
  for (let rank = 1; rank <= 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const piece = board[fileRankToIndex(file, rank)];
      if (!piece || colorOf(piece) !== turn) continue;
      switch (piece.toUpperCase()) {
        case 'P':
          pawnMoves(board, duckIndex, file, rank, turn, ep, out);
          break;
        case 'N':
          stepMoves(board, duckIndex, file, rank, KNIGHT_HOPS, turn, out);
          break;
        case 'B':
          slideMoves(board, duckIndex, file, rank, BISHOP_DIRS, turn, out);
          break;
        case 'R':
          slideMoves(board, duckIndex, file, rank, ROOK_DIRS, turn, out);
          break;
        case 'Q':
          slideMoves(board, duckIndex, file, rank, KING_DIRS, turn, out);
          break;
        case 'K':
          stepMoves(board, duckIndex, file, rank, KING_DIRS, turn, out);
          castlingMoves(board, duckIndex, turn, castling, out);
          break;
        default:
          break;
      }
    }
  }
  return out;
}

/** Distinct destination squares for the piece on `square` — drives tap-to-move highlighting. */
export function legalPieceTargets(state, square) {
  const targets = new Set();
  for (const move of generatePieceMoves(state)) {
    if (move.from === square) targets.add(move.to);
  }
  return [...targets];
}

/** Every empty square the duck may move to: all empties except its current square (it must move). */
export function legalDuckTargets(state) {
  const targets = [];
  for (let i = 0; i < 64; i += 1) {
    if (state.board[i] !== null) continue;
    const square = indexToSquare(i);
    if (square !== state.duck) targets.push(square);
  }
  return targets;
}
