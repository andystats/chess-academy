// The Duck Chess engine: a stateful game object, the variant's counterpart to driving a mutable
// chess.js instance. A turn is two phases — move a piece, then move the
// duck to an empty square — modelled by `state.phase` ('piece' → 'duck' → flip to opponent's 'piece').
// There is no check or checkmate; the ONLY terminal condition is capturing the enemy king, which ends
// the game immediately in the piece phase (the winner does not place a duck).
//
// `result()` and `captured()` derive from the board, not from a move log, so a game rebuilt from a
// serialized snapshot (the joiner adopting the host's state) reports the same thing as one played move
// by move — important for the host-authoritative multiplayer sync.

import { COLOR_NAME } from '../../lesson/moves.js';
import { capturedFromBoard } from '../gameState.js';
import { boardFen, colorOf, deserialize, initialState, serialize, squareToIndex } from './board.js';
import { generatePieceMoves, legalDuckTargets, legalPieceTargets } from './moves.js';

/** Winner (or draw) inferred from the board and legal moves — snapshot-safe. */
function deriveResult(state) {
  const { board } = state;
  if (!board.includes('K')) return { winner: 'black', reason: 'King captured' };
  if (!board.includes('k')) return { winner: 'white', reason: 'King captured' };

  // Stalemate: side to move has no legal piece moves. Only checked during the piece phase;
  // during the duck phase there is always a legal placement (any empty square except its own).
  if (state.phase === 'piece' && generatePieceMoves(state).length === 0) {
    return { winner: 'draw', reason: 'Stalemate' };
  }
  return null;
}

/** Match an input {from,to,promotion} against the generated legal moves (default promotion: queen). */
function findMove(state, { from, to, promotion }) {
  const wanted = promotion ? promotion.toLowerCase() : 'q';
  let fallback = null;
  for (const move of generatePieceMoves(state)) {
    if (move.from !== from || move.to !== to) continue;
    if (!move.promotion) return move; // non-promotion: exact match
    if (move.promotion === wanted) return move;
    fallback = fallback || move; // a promotion move exists; remember in case the wanted piece is odd
  }
  return fallback;
}

/** Compact SAN-ish label for the move list (no check/disambiguation — there is no check). */
function toSan(movingPiece, move, didCapture) {
  if (move.castleK) return 'O-O';
  if (move.castleQ) return 'O-O-O';
  const type = movingPiece.toUpperCase();
  const isPawn = type === 'P';
  const capture = didCapture || move.ep ? 'x' : '';
  const origin = isPawn && capture ? move.from[0] : isPawn ? '' : type;
  const promo = move.promotion ? `=${move.promotion.toUpperCase()}` : '';
  return `${origin}${capture}${move.to}${promo}`;
}

/** Drop the castling rights touched by a piece leaving/entering a corner or a king moving. */
function updateCastling(castling, movingPiece, from, capturedSquare) {
  let next = castling;
  const drop = (chars) => {
    for (const ch of chars) next = next.replace(ch, '');
  };
  const type = movingPiece.toUpperCase();
  if (type === 'K') drop(colorOf(movingPiece) === 'w' ? 'KQ' : 'kq');
  const cornerFlag = { a1: 'Q', h1: 'K', a8: 'q', h8: 'k' };
  if (type === 'R' && cornerFlag[from]) drop(cornerFlag[from]); // our rook left a corner
  if (capturedSquare && cornerFlag[capturedSquare]) drop(cornerFlag[capturedSquare]); // a corner rook fell
  return next;
}

export function createDuckGame(serialized) {
  const state = serialized ? deserialize(serialized) : initialState();
  // History is one entry per *turn*: the piece move plus the duck square placed after it.
  const turns = [];

  const turnColor = () => COLOR_NAME[state.turn];
  const result = () => deriveResult(state);

  function movePiece(input) {
    if (result() || state.phase !== 'piece') return { ok: false };
    const move = findMove(state, input);
    if (!move) return { ok: false };

    const board = state.board.slice();
    const fromIndex = squareToIndex(move.from);
    const toIndex = squareToIndex(move.to);
    const movingPiece = board[fromIndex];

    // Capture (en passant removes the pawn behind the destination, not on it).
    let capturedSquare = null;
    let capturedPiece = board[toIndex];
    if (move.ep) {
      const epCaptureIndex = squareToIndex(move.to[0] + move.from[1]);
      capturedPiece = board[epCaptureIndex];
      board[epCaptureIndex] = null;
    } else if (capturedPiece) {
      capturedSquare = move.to;
    }

    // Move the piece (promote if needed).
    board[fromIndex] = null;
    board[toIndex] = move.promotion
      ? (state.turn === 'w' ? move.promotion.toUpperCase() : move.promotion)
      : movingPiece;

    // Castling also shifts the rook.
    if (move.castleK || move.castleQ) {
      const rank = state.turn === 'w' ? '1' : '8';
      const [rookFrom, rookTo] = move.castleK ? [`h${rank}`, `f${rank}`] : [`a${rank}`, `d${rank}`];
      board[squareToIndex(rookTo)] = board[squareToIndex(rookFrom)];
      board[squareToIndex(rookFrom)] = null;
    }

    state.board = board;
    state.castling = updateCastling(state.castling, movingPiece, move.from, capturedSquare);
    // En passant target: only a double push offers one, valid for the opponent's next piece move.
    state.ep = move.double ? `${move.to[0]}${state.turn === 'w' ? '3' : '6'}` : null;
    const reset = movingPiece.toUpperCase() === 'P' || capturedPiece;
    state.halfmove = reset ? 0 : state.halfmove + 1;

    const kingCaptured = capturedPiece && capturedPiece.toUpperCase() === 'K';
    turns.push({ pieceMove: { from: move.from, to: move.to, promotion: move.promotion ?? null }, san: toSan(movingPiece, move, Boolean(capturedPiece)), duck: null });
    // King capture ends the game now — no duck placement. Otherwise advance to the duck phase.
    state.phase = kingCaptured ? 'piece' : 'duck';

    return { ok: true, kingCaptured: Boolean(kingCaptured), result: result() };
  }

  function placeDuck(square) {
    if (result() || state.phase !== 'duck') return { ok: false };
    // Membership in the generated targets rejects occupied squares, the current duck square, and
    // malformed input (off-board strings, aliased coordinates like "z9", non-strings) in one check.
    if (!legalDuckTargets(state).includes(square)) return { ok: false };

    state.duck = square;
    // A game resumed from a mid-turn snapshot starts with an empty history (the wire format drops
    // it), so there may be no turn entry to annotate — the duck still places; only the log skips.
    if (turns.length) turns[turns.length - 1].duck = square;
    if (state.turn === 'b') state.fullmove += 1; // a full move completes after Black's turn
    state.turn = state.turn === 'w' ? 'b' : 'w';
    state.phase = 'piece';

    return { ok: true, result: result() };
  }

  return {
    getState: () => ({ ...state, board: state.board.slice(), ext: { ...state.ext } }),
    serialize: () => serialize(state),
    boardFen: () => boardFen(state),
    turnColor,
    phase: () => state.phase,
    duckSquare: () => state.duck,
    legalPieceTargets: (square) => legalPieceTargets(state, square),
    legalDuckTargets: () => legalDuckTargets(state),
    movePiece,
    placeDuck,
    resign: (color) => {
      state.result = { winner: color === 'white' ? 'black' : 'white', reason: 'Resigned' };
    },
    result,
    history: () => turns.map((turn) => ({ ...turn })),
    captured: () => capturedFromBoard(state.board),
  };
}

