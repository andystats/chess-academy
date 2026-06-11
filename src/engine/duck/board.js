// Board representation + (de)serialization for the Duck Chess variant. Pure JS, no React/DOM, so
// the engine and its tests run under plain Node like src/lesson/moves.js.
//
// chess.js cannot model Duck Chess (it can't treat an arbitrary square as a universal blocker, and
// it enforces check/checkmate, which Duck Chess forbids — you win by *capturing* the king). So we
// keep a tiny board of our own here and a focused move generator in ./moves.js.
//
// Layout: a flat 64-cell array in FEN reading order — index 0 = a8 (top-left), index 63 = h1. Each
// cell holds a piece letter (white UPPERCASE `PNBRQK`, black lowercase) or `null` when empty. The
// duck is NOT stored in this array; it lives in `state.duck` as a square string and is consulted by
// the generator as a blocker. That keeps `boardFen()` a normal FEN the chessboard can render.

/** Files a–h, indexable by 0–7. */
export const FILES = 'abcdefgh';

/** Standard chess starting placement (the piece-placement field of a FEN). */
export const START_PLACEMENT = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';

const SQUARE_RE = /^[a-h][1-8]$/;

/** True for a real square string ("a1"–"h8"); false for anything else, including non-strings. */
export function isSquare(value) {
  return typeof value === 'string' && SQUARE_RE.test(value);
}

/** Square string like "e4" → flat board index (a8 = 0 … h1 = 63), or -1 for a non-square. */
export function squareToIndex(square) {
  if (!isSquare(square)) return -1; // board[-1] is undefined, matching pieceAt's off-board contract
  const file = square.charCodeAt(0) - 97; // 'a' → 0
  const rank = square.charCodeAt(1) - 48; // '1' → 1
  return (8 - rank) * 8 + file;
}

/** Flat board index → square string. */
export function indexToSquare(index) {
  return FILES[index % 8] + (8 - Math.floor(index / 8));
}

/** Square string for a 0-based file and 1-based rank. */
export function fileRankToSquare(file, rank) {
  return FILES[file] + rank;
}

/**
 * Piece on a 0-based file / 1-based rank: a piece letter, `null` when empty, or `undefined` when the
 * coordinate is off the board (lets the generator stop a ray without a separate bounds check).
 */
export function pieceAt(board, file, rank) {
  if (file < 0 || file > 7 || rank < 1 || rank > 8) return undefined;
  return board[(8 - rank) * 8 + file];
}

/** 'w' for an UPPERCASE (white) piece, 'b' for lowercase (black), `null` for an empty/absent cell. */
export function colorOf(piece) {
  if (!piece) return null;
  return piece === piece.toUpperCase() ? 'w' : 'b';
}

/**
 * Parse a FEN placement field into the flat 64-cell board. Throws on malformed input — this sits on
 * the multiplayer wire-decode boundary, so a bad field is rejected rather than silently mis-sized.
 */
export function parsePlacement(placement) {
  const board = new Array(64).fill(null);
  let i = 0;
  for (const ch of placement) {
    if (ch === '/') {
      if (i % 8 !== 0) throw new Error(`Malformed placement rank: ${placement}`);
      continue;
    }
    if (ch >= '1' && ch <= '8') i += Number(ch);
    else if ('pnbrqk'.includes(ch.toLowerCase())) {
      board[i] = ch;
      i += 1;
    } else {
      throw new Error(`Invalid placement character '${ch}': ${placement}`);
    }
    if (i > 64) throw new Error(`Placement overflows the board: ${placement}`);
  }
  if (i !== 64) throw new Error(`Placement covers ${i} squares, not 64: ${placement}`);
  // At most one king per side; zero is valid (a captured king is the variant's terminal state).
  for (const king of ['K', 'k']) {
    if (board.filter((cell) => cell === king).length > 1) {
      throw new Error(`More than one '${king}' on the board: ${placement}`);
    }
  }
  return board;
}

/** Serialize the flat board back to a FEN placement field. */
export function placementToString(board) {
  const rows = [];
  for (let r = 0; r < 8; r += 1) {
    let row = '';
    let empty = 0;
    for (let f = 0; f < 8; f += 1) {
      const piece = board[r * 8 + f];
      if (piece) {
        if (empty) {
          row += empty;
          empty = 0;
        }
        row += piece;
      } else {
        empty += 1;
      }
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return rows.join('/');
}

/** A fresh standard starting state: White to move, no duck on the board yet. */
export function initialState() {
  return {
    board: parsePlacement(START_PLACEMENT),
    turn: 'w',
    phase: 'piece',
    duck: null,
    castling: 'KQkq',
    ep: null,
    halfmove: 0,
    fullmove: 1,
  };
}

// The wire format is a FEN superset: the six standard FEN fields with `phase` and `duck` inserted
// after the side-to-move, so the whole turn machine round-trips in one string for broadcasting.
//   <placement> <turn> <phase> <duck|-> <castling|-> <ep|-> <halfmove> <fullmove>

/** Serialize full game state to the wire string. */
export function serialize(state) {
  return [
    placementToString(state.board),
    state.turn,
    state.phase,
    state.duck ?? '-',
    state.castling || '-',
    state.ep ?? '-',
    state.halfmove,
    state.fullmove,
  ].join(' ');
}

/**
 * Parse a wire string back into full game state. Throws on malformed input: snapshots arrive over
 * the public realtime channel, so every field is validated rather than trusted (threat model 3.3).
 */
export function deserialize(str) {
  if (typeof str !== 'string') throw new Error('State must be a string');
  const fields = str.split(' ');
  if (fields.length !== 8) throw new Error(`Expected 8 wire fields, got ${fields.length}: ${str}`);
  const [placement, turn, phase, duck, castling, ep, halfmove, fullmove] = fields;
  if (turn !== 'w' && turn !== 'b') throw new Error(`Invalid turn '${turn}': ${str}`);
  if (phase !== 'piece' && phase !== 'duck') throw new Error(`Invalid phase '${phase}': ${str}`);
  if (duck !== '-' && !isSquare(duck)) throw new Error(`Invalid duck square '${duck}': ${str}`);
  if (castling !== '-' && !/^[KQkq]{1,4}$/.test(castling)) throw new Error(`Invalid castling '${castling}': ${str}`);
  if (ep !== '-' && !isSquare(ep)) throw new Error(`Invalid en-passant square '${ep}': ${str}`);
  if (!/^\d+$/.test(halfmove) || !/^\d+$/.test(fullmove)) throw new Error(`Invalid move clocks: ${str}`);
  return {
    board: parsePlacement(placement),
    turn,
    phase,
    duck: duck === '-' ? null : duck,
    castling: castling === '-' ? '' : castling,
    ep: ep === '-' ? null : ep,
    halfmove: Number(halfmove),
    fullmove: Number(fullmove),
  };
}

/**
 * A plain (standard) FEN for the board component — the duck and phase are dropped, so react-chessboard
 * renders the pieces and the duck is layered on as an overlay. chess.js can parse this without throwing.
 */
export function boardFen(state) {
  return [
    placementToString(state.board),
    state.turn,
    state.castling || '-',
    state.ep ?? '-',
    state.halfmove,
    state.fullmove,
  ].join(' ');
}
