import { Chess } from 'chess.js';

// Pure chess helpers shared by the lesson engine (src/lesson/useChessLesson.js) and the
// content validator (scripts/validate-content.mjs). No React or DOM here so the validator
// can import it under plain Node.

/** The standard chess starting position, as a FEN. */
export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** The opposing color for a 'white'/'black' side. */
export function opposite(side) {
  return side === 'white' ? 'black' : 'white';
}
//
// Design note: chess.js 1.x `.move()` THROWS on an illegal move (it never returns null), so
// every caller relies on try/catch. We compare moves by their long-algebraic form (LAN, e.g.
// "e2e4", "a7a8q") rather than chess.js's decorated SAN ("e4", "a8=Q+"), because authors won't
// reliably type the "+"/"#"/"=Q" decorations — comparing by LAN is formatting-proof.

/** True for a UCI/LAN move string like "e2e4" or "a7a8q". */
export function isUci(s) {
  return typeof s === 'string' && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(s);
}

/** Parse a UCI string into the object chess.js `.move()` accepts. */
export function uciToMove(uci) {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] };
}

/**
 * Apply an authored move (SAN string like "Nf3", a UCI string like "g1f3", or a
 * {from,to,promotion} object) to a game, returning the verbose move. Throws on illegality.
 */
export function applyMove(game, move) {
  return game.move(typeof move === 'string' && isUci(move) ? uciToMove(move) : move);
}

/** Canonical LAN for a chess.js verbose move object: from + to + optional promotion piece. */
export function moveToLan(move) {
  return move.from + move.to + (move.promotion || '');
}

/**
 * Compile an authored move (SAN like "Nf3", or UCI/LAN like "g1f3") at `fen` to its LAN form,
 * on a throwaway board so the caller's game is untouched. Throws if the move is illegal there.
 */
export function compileToLan(fen, move) {
  const probe = new Chess(fen);
  return moveToLan(applyMove(probe, move));
}

/** The set of acceptable LANs for the side to move at `fen`, given a list of authored SANs. */
export function acceptableLans(fen, sans) {
  return new Set(sans.map((san) => compileToLan(fen, san)));
}

/** Legal destination squares for the piece on `square` — drives tap-to-move highlighting. */
export function legalTargets(chess, square) {
  return chess.moves({ square, verbose: true }).map((m) => m.to);
}

/** The piece letter on `square` in a FEN's placement field, or null when the square is empty. */
function pieceAtFen(fen, square) {
  const row = fen.split(' ')[0].split('/')[8 - Number(square[1])];
  let file = square.charCodeAt(0) - 97;
  for (const ch of row ?? '') {
    if (ch >= '1' && ch <= '8') {
      file -= Number(ch);
      if (file < 0) return null; // inside an empty run
    } else if (file === 0) {
      return ch;
    } else {
      file -= 1;
    }
  }
  return null;
}

/**
 * True when moving `from` → `to` would promote a pawn — used by the tap-to-move paths to open the
 * promotion picker instead of silently defaulting to a queen. Pure FEN inspection, so it works for
 * any engine that renders a standard board FEN (chess.js and the duck variant alike).
 */
export function isPromotion(fen, from, to) {
  const rank = to[1];
  if (rank !== '8' && rank !== '1') return false;
  const piece = pieceAtFen(fen, from);
  return (piece === 'P' && rank === '8') || (piece === 'p' && rank === '1');
}

/**
 * For a `line` step, the mainline interleaves both sides starting with the player's move when
 * there is no setup ply (authored lessons), or with the opponent's setup move when there is one
 * (imported puzzles). This maps the player's 0-based move ordinal to its index in `mainline`.
 */
export function mainlineIndexForPlayerMove(ordinal, hasSetupMove) {
  return (hasSetupMove ? 1 : 0) + ordinal * 2;
}
