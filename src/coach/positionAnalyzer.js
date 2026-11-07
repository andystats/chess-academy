import { Chess } from 'chess.js';
import { applyMove, isUci, moveToLan } from '../lesson/moves.js';
import { formatEngineScore } from '../engine/xrayLearning.js';
import { getStrategyCard } from './strategyLibrary.js';

const PIECE_VALUES = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 99,
};

const PIECE_NAMES = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};

const STARTING_MINORS = {
  w: ['b1', 'c1', 'f1', 'g1'],
  b: ['b8', 'c8', 'f8', 'g8'],
};

const CENTER_SQUARES = new Set(['d4', 'e4', 'd5', 'e5']);
const EXTENDED_CENTER = new Set(['c3', 'd3', 'e3', 'f3', 'c4', 'd4', 'e4', 'f4', 'c5', 'd5', 'e5', 'f5', 'c6', 'd6', 'e6', 'f6']);
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

function oppositeColor(color) {
  return color === 'w' ? 'b' : 'w';
}

function colorName(color) {
  return color === 'b' ? 'Black' : 'White';
}

function flipFenTurn(fen) {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 4) return null;
  parts[1] = parts[1] === 'w' ? 'b' : 'w';
  parts[3] = '-'; // clear en-passant target on null move
  return parts.join(' ');
}

function listPieces(game) {
  const pieces = [];
  for (const row of game.board()) {
    for (const cell of row) {
      if (cell) pieces.push(cell);
    }
  }
  return pieces;
}

function findKingSquare(pieces, color) {
  return pieces.find((p) => p.color === color && p.type === 'k')?.square ?? null;
}

const SEE_PIECE_VALUES = Object.freeze({
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 100,
});

function lowestAttackerValue(game, attackers) {
  let min = Infinity;
  for (const sq of attackers) {
    const piece = game.get(sq);
    if (piece) {
      min = Math.min(min, PIECE_VALUES[piece.type] ?? 99);
    }
  }
  return min;
}

/**
 * Standard Static Exchange Evaluation (SEE) swap algorithm on sorted attacker/defender value arrays.
 * Returns the net material gain for the side initiating the capture on `targetVal`.
 */
function staticExchangeGain(targetVal, attackerVals, defenderVals) {
  if (attackerVals.length === 0) return 0;
  const gains = [targetVal];
  let trophy = attackerVals[0];
  let aIdx = 1;
  let dIdx = 0;
  let defenderTurn = true;

  while (defenderTurn ? dIdx < defenderVals.length : aIdx < attackerVals.length) {
    gains.push(trophy - gains[gains.length - 1]);
    trophy = defenderTurn ? defenderVals[dIdx++] : attackerVals[aIdx++];
    defenderTurn = !defenderTurn;
  }

  let i = gains.length - 1;
  while (i > 0) {
    gains[i - 1] = -Math.max(-gains[i - 1], gains[i]);
    i -= 1;
  }
  return gains[0];
}

/**
 * Exact legal-move Static Exchange Evaluation (SEE) from `gameAfterMove` on `targetSq`, where a
 * piece of value `trophyVal` currently sits on `targetSq`. Uses actual legal moves in `chess.js`
 * so pins, discovered checks, and X-ray batteries are respected.
 */
function seeRecaptureGain(gameAfterMove, targetSq, trophyVal, depth = 0) {
  if (depth >= 8) return 0;
  const turn = gameAfterMove.turn();
  if (gameAfterMove.attackers(targetSq, turn).length === 0) return 0;

  const legalCaptures = gameAfterMove
    .moves({ verbose: true })
    .filter((m) => m.to === targetSq);
  if (legalCaptures.length === 0) return 0;

  legalCaptures.sort(
    (a, b) => (SEE_PIECE_VALUES[a.piece] ?? 100) - (SEE_PIECE_VALUES[b.piece] ?? 100),
  );
  const bestCapture = legalCaptures[0];
  const nextGame = new Chess(gameAfterMove.fen());
  let applied;
  try {
    applied = nextGame.move(bestCapture);
  } catch {
    return 0;
  }
  if (nextGame.isCheckmate()) return 100;

  const promotionGain = applied.promotion ? (SEE_PIECE_VALUES[applied.promotion] ?? 9) - 1 : 0;
  const nextTrophyVal = SEE_PIECE_VALUES[applied.promotion ?? applied.piece] ?? 100;
  const counterGain = seeRecaptureGain(nextGame, targetSq, nextTrophyVal, depth + 1);
  return Math.max(0, trophyVal + promotionGain - counterGain);
}

/**
 * Returns the net material outcome for `gameAfterMove.turn()` if they immediately capture the
 * piece on `targetSq` (worth `trophyVal`). Returns `-Infinity` if no legal capture on `targetSq`
 * exists, `>= 0` if capturing on `targetSq` wins material or trades evenly, and `< 0` if capturing
 * on `targetSq` loses material because the piece is protected.
 */
function bestLegalRecaptureNet(gameAfterMove, targetSq, trophyVal) {
  const turn = gameAfterMove.turn();
  if (gameAfterMove.attackers(targetSq, turn).length === 0) return -Infinity;

  const legalCaptures = gameAfterMove
    .moves({ verbose: true })
    .filter((m) => m.to === targetSq);
  if (legalCaptures.length === 0) return -Infinity;

  legalCaptures.sort(
    (a, b) => (SEE_PIECE_VALUES[a.piece] ?? 100) - (SEE_PIECE_VALUES[b.piece] ?? 100),
  );
  const bestCapture = legalCaptures[0];
  const nextGame = new Chess(gameAfterMove.fen());
  let applied;
  try {
    applied = nextGame.move(bestCapture);
  } catch {
    return -Infinity;
  }
  if (nextGame.isCheckmate()) return 100;

  const promotionGain = applied.promotion ? (SEE_PIECE_VALUES[applied.promotion] ?? 9) - 1 : 0;
  const nextTrophyVal = SEE_PIECE_VALUES[applied.promotion ?? applied.piece] ?? 100;
  const counterGain = seeRecaptureGain(nextGame, targetSq, nextTrophyVal, 1);
  return trophyVal + promotionGain - counterGain;
}

/**
 * Determine whether a square owned by `targetColor` is tactically vulnerable in `game`.
 */
export function assessSquareVulnerability(game, square, targetColor) {
  const piece = game.get(square);
  if (!piece || piece.color !== targetColor || piece.type === 'k') return null;
  const enemyColor = oppositeColor(targetColor);
  const attackers = game.attackers(square, enemyColor);
  if (attackers.length === 0) return null;

  const defenders = game.attackers(square, targetColor);
  const pieceValue = PIECE_VALUES[piece.type] ?? 1;
  const attackerVals = attackers
    .map((sq) => SEE_PIECE_VALUES[game.get(sq)?.type] ?? 100)
    .sort((a, b) => a - b);
  const defenderVals = defenders
    .map((sq) => SEE_PIECE_VALUES[game.get(sq)?.type] ?? 100)
    .sort((a, b) => a - b);

  const minAttackerVal = lowestAttackerValue(game, attackers);
  const seeGain = staticExchangeGain(pieceValue, attackerVals, defenderVals);
  const isUndefended = defenders.length === 0;
  const isOutnumbered = !isUndefended && attackers.length > defenders.length && seeGain > 0;
  const isLowValueAttacked = minAttackerVal < pieceValue && seeGain > 0;

  if (!isUndefended && seeGain <= 0) return null;

  const leadAttackerSq = attackers[0];
  const leadAttacker = game.get(leadAttackerSq);

  return {
    square,
    pieceType: piece.type,
    pieceName: PIECE_NAMES[piece.type],
    pieceValue,
    attackers,
    defenders,
    isUndefended,
    isOutnumbered,
    isLowValueAttacked,
    leadAttackerSquare: leadAttackerSq,
    leadAttackerName: leadAttacker ? PIECE_NAMES[leadAttacker.type] : 'piece',
    severity: isUndefended
      ? pieceValue * 2
      : isLowValueAttacked
        ? (pieceValue - minAttackerVal) * 1.5
        : seeGain,
  };
}

/**
 * Simulate passing the turn (null move) to see what concrete captures or checks the opponent
 * threatens right now if the side to move does nothing. Filters out unsound captures and
 * "nonsense checks" where the checking piece can simply be captured or harmlessly blocked.
 */
export function detectOpponentThreats(game, fen) {
  if (game.inCheck() || game.isGameOver()) return [];
  const flipped = flipFenTurn(fen);
  if (!flipped) return [];

  let oppGame;
  try {
    oppGame = new Chess(flipped);
  } catch {
    return [];
  }

  const friendlyColor = game.turn();
  const enemyColor = oppositeColor(friendlyColor);
  const oppMoves = oppGame.moves({ verbose: true });
  const threats = [];

  for (const move of oppMoves) {
    const after = new Chess(flipped);
    let applied;
    try {
      applied = after.move(move);
    } catch {
      continue;
    }

    const givesCheck = after.inCheck();
    const givesMate = after.isCheckmate();

    if (givesMate) {
      threats.push({
        san: applied.san,
        uci: `${applied.from}${applied.to}${applied.promotion ?? ''}`,
        from: applied.from,
        to: applied.to,
        kind: 'mate',
        targetSquare: applied.to,
        description: `threatens checkmate with ${applied.san}`,
        priority: 100,
      });
      continue;
    }

    const attackerVal = PIECE_VALUES[applied.promotion ?? move.piece] ?? 1;

    if (move.captured) {
      const capturedVal = PIECE_VALUES[move.captured] ?? 1;
      const friendlyRecaptureGain = seeRecaptureGain(after, move.to, attackerVal);
      const netGain = capturedVal - friendlyRecaptureGain;

      // Only flag a capture as a threat if the opponent genuinely comes out ahead in the exchange
      if (netGain > 0) {
        const defenders = game.attackers(move.to, friendlyColor);
        const attackers = game.attackers(move.to, enemyColor);
        const undefended = defenders.length === 0 || friendlyRecaptureGain === 0;
        const outnumbered = !undefended && attackers.length > defenders.length;
        const targetLabel = `${PIECE_NAMES[move.captured]} on ${move.to}`;
        threats.push({
          san: applied.san,
          uci: `${applied.from}${applied.to}${applied.promotion ?? ''}`,
          from: applied.from,
          to: applied.to,
          kind: 'capture',
          targetSquare: move.to,
          targetPiece: move.captured,
          targetLabel,
          undefended,
          outnumbered,
          givesCheck,
          description: undefended
            ? `threatens ${applied.san}, winning the undefended ${targetLabel}`
            : `threatens ${applied.san} against the ${targetLabel}`,
          priority:
            (undefended ? capturedVal * 3 : netGain * 2.4) + (givesCheck ? 2 : 0),
        });
      }
    } else if (givesCheck) {
      // 1. If the player can simply capture the checking piece on `move.to` without losing material,
      // it is a blunder/trade check, NOT a threat!
      const recaptureNet = bestLegalRecaptureNet(after, move.to, attackerVal);
      if (recaptureNet >= 0) continue;

      // 2. Check whether this check forks a second vulnerable friendly piece or forces the King to move
      const friendlyPiecesAfter = listPieces(after).filter(
        (p) => p.color === friendlyColor && p.type !== 'k',
      );
      const forkedPiece = friendlyPiecesAfter.find((fp) => {
        const attackedFromChecker = after.attackers(fp.square, enemyColor).includes(move.to);
        if (!attackedFromChecker) return false;
        const fpVuln = assessSquareVulnerability(after, fp.square, friendlyColor);
        return Boolean(fpVuln);
      });

      const legalEvasions = after.moves({ verbose: true });
      const hasSafeBlock = legalEvasions.some((ev) => {
        if (ev.piece === 'k' || ev.to === move.to) return false;
        const afterBlock = new Chess(after.fen());
        try {
          afterBlock.move(ev);
        } catch {
          return false;
        }
        const blockerVal = PIECE_VALUES[ev.piece] ?? 1;
        return seeRecaptureGain(afterBlock, ev.to, blockerVal) === 0;
      });

      if (forkedPiece) {
        const forkLabel = `${PIECE_NAMES[forkedPiece.type]} on ${forkedPiece.square}`;
        threats.push({
          san: applied.san,
          uci: `${applied.from}${applied.to}${applied.promotion ?? ''}`,
          from: applied.from,
          to: applied.to,
          kind: 'check',
          targetSquare: forkedPiece.square,
          description: `threatens ${applied.san}, checking the king and forking the ${forkLabel}`,
          priority: (PIECE_VALUES[forkedPiece.type] ?? 1) * 2.5 + 3,
        });
      } else if (!hasSafeBlock) {
        threats.push({
          san: applied.san,
          uci: `${applied.from}${applied.to}${applied.promotion ?? ''}`,
          from: applied.from,
          to: applied.to,
          kind: 'check',
          targetSquare: applied.to,
          description: `threatens a forcing check with ${applied.san} that displaces your king`,
          priority: 3.5,
        });
      }
    }
  }

  // Deduplicate by targetSquare so the highest-priority threat on a given square wins
  const bySquare = new Map();
  for (const threat of threats.sort((a, b) => b.priority - a.priority)) {
    const key = `${threat.kind}:${threat.targetSquare}`;
    if (!bySquare.has(key)) bySquare.set(key, threat);
  }
  return [...bySquare.values()].slice(0, 4);
}

function detectPawnStructure(pieces, sideColor) {
  const friendlyPawns = pieces.filter((p) => p.color === sideColor && p.type === 'p');
  const enemyPawns = pieces.filter((p) => p.color !== sideColor && p.type === 'p');
  const friendlyFiles = new Set(friendlyPawns.map((p) => p.square[0]));
  const enemyFiles = new Set(enemyPawns.map((p) => p.square[0]));

  const openFiles = FILES.filter((f) => !friendlyFiles.has(f) && !enemyFiles.has(f));
  const halfOpenFiles = FILES.filter((f) => !friendlyFiles.has(f) && enemyFiles.has(f));

  const passedPawns = [];
  for (const pawn of friendlyPawns) {
    const fileIdx = FILES.indexOf(pawn.square[0]);
    const rank = Number(pawn.square[1]);
    const adjFiles = [FILES[fileIdx - 1], FILES[fileIdx], FILES[fileIdx + 1]].filter(Boolean);
    const hasBlocker = enemyPawns.some((ep) => {
      if (!adjFiles.includes(ep.square[0])) return false;
      const epRank = Number(ep.square[1]);
      return sideColor === 'w' ? epRank > rank : epRank < rank;
    });
    if (!hasBlocker) passedPawns.push(pawn.square);
  }

  const enemyPassedPawns = [];
  for (const pawn of enemyPawns) {
    const fileIdx = FILES.indexOf(pawn.square[0]);
    const rank = Number(pawn.square[1]);
    const adjFiles = [FILES[fileIdx - 1], FILES[fileIdx], FILES[fileIdx + 1]].filter(Boolean);
    const hasBlocker = friendlyPawns.some((fp) => {
      if (!adjFiles.includes(fp.square[0])) return false;
      const fpRank = Number(fp.square[1]);
      return sideColor === 'w' ? fpRank < rank : fpRank > rank;
    });
    if (!hasBlocker) enemyPassedPawns.push(pawn.square);
  }

  return { openFiles, halfOpenFiles, passedPawns, enemyPassedPawns };
}

function formatPieceLocations(pieces) {
  const formatSide = (color) => {
    const sidePieces = pieces.filter((p) => p.color === color);
    const majorsMinors = ['k', 'q', 'r', 'b', 'n']
      .flatMap((type) =>
        sidePieces
          .filter((p) => p.type === type)
          .map((p) => `${type.toUpperCase()}${p.square}`),
      );
    const pawns = sidePieces.filter((p) => p.type === 'p').map((p) => p.square);
    return [...majorsMinors, pawns.length ? `pawns(${pawns.join(',')})` : null]
      .filter(Boolean)
      .join(', ');
  };
  return {
    white: formatSide('w'),
    black: formatSide('b'),
  };
}

/**
 * Inspect a chess position and return structured tactical and positional facts.
 */
export function inspectPosition(fen) {
  const game = new Chess(fen);
  const turn = game.turn();
  const enemy = oppositeColor(turn);
  const pieces = listPieces(game);
  const legalMoves = game.moves({ verbose: true });
  const moveNumber = game.moveNumber();
  const pieceLocations = formatPieceLocations(pieces);

  const nonPawnMaterial = pieces
    .filter((p) => p.type !== 'p' && p.type !== 'k')
    .reduce((sum, p) => sum + (PIECE_VALUES[p.type] ?? 0), 0);

  let phase = 'middlegame';
  if (nonPawnMaterial <= 14) phase = 'endgame';
  else if (moveNumber <= 10) phase = 'opening';

  const kingSquare = findKingSquare(pieces, turn);
  const kingCastled =
    turn === 'w'
      ? kingSquare === 'g1' || kingSquare === 'c1' || kingSquare === 'h1' || kingSquare === 'b1'
      : kingSquare === 'g8' || kingSquare === 'c8' || kingSquare === 'h8' || kingSquare === 'b8';
  const canCastleMoves = legalMoves.filter((m) => m.san === 'O-O' || m.san === 'O-O-O');

  const undevelopedMinors = (STARTING_MINORS[turn] ?? []).filter((sq) => {
    const piece = game.get(sq);
    return piece && piece.color === turn && (piece.type === 'n' || piece.type === 'b');
  });

  const threatenedPieces = pieces
    .filter((p) => p.color === turn)
    .map((p) => assessSquareVulnerability(game, p.square, turn))
    .filter(Boolean)
    .sort((a, b) => b.severity - a.severity);

  const looseTargets = pieces
    .filter((p) => p.color === enemy)
    .map((p) => assessSquareVulnerability(game, p.square, enemy))
    .filter(Boolean)
    .sort((a, b) => b.severity - a.severity);

  const opponentThreats = detectOpponentThreats(game, fen);
  const structure = detectPawnStructure(pieces, turn);

  return {
    fen,
    turn,
    sideLabel: colorName(turn),
    opponentLabel: colorName(enemy),
    moveNumber,
    phase,
    inCheck: game.inCheck(),
    isGameOver: game.isGameOver(),
    kingSquare,
    kingCastled,
    canCastle: canCastleMoves.length > 0,
    castleMoves: canCastleMoves.map((m) => m.san),
    undevelopedMinors,
    threatenedPieces,
    looseTargets,
    opponentThreats,
    structure,
    pieceLocations,
  };
}

/**
 * Explain in concrete natural language WHY a specific candidate move (such as Stockfish's #1 move)
 * works in `fen`.
 */
export function explainEngineMove(fen, line, positionFacts = null) {
  const uci = line?.uciMoves?.[0];
  if (!uci || !isUci(uci)) return null;

  const facts = positionFacts ?? inspectPosition(fen);
  const beforeGame = new Chess(fen);
  const afterGame = new Chess(fen);

  let moveObj;
  try {
    moveObj = applyMove(afterGame, uci);
  } catch {
    return null;
  }

  const turn = beforeGame.turn();
  const enemy = oppositeColor(turn);
  const san = moveObj.san;
  const pieceLabel = PIECE_NAMES[moveObj.piece] ?? 'piece';
  const reasons = [];
  let primaryTag = 'strategy';

  // 1. Check whether this move neutralizes an active opponent threat or saves a hanging square!
  const resolvedSquares = [];
  for (const threat of facts.opponentThreats) {
    if (threat.kind === 'capture' && threat.targetSquare) {
      const sq = threat.targetSquare;
      if (moveObj.from === sq) {
        resolvedSquares.push({ sq, how: 'moves the threatened piece to safety' });
      } else {
        const afterVuln = assessSquareVulnerability(afterGame, sq, turn);
        // Also check if the threatening piece itself was captured or blocked
        const oppReplies = afterGame.moves({ verbose: true });
        const stillCapturable = oppReplies.some(
          (m) => m.from === threat.from && m.to === sq,
        );
        if (!stillCapturable || !afterVuln) {
          resolvedSquares.push({ sq, how: `neutralizes the current threat on ${sq}` });
        }
      }
    }
  }

  for (const vuln of facts.threatenedPieces) {
    if (resolvedSquares.some((r) => r.sq === vuln.square)) continue;
    if (moveObj.from === vuln.square) {
      resolvedSquares.push({
        sq: vuln.square,
        how: `sidesteps the attack on your ${vuln.pieceName} (${vuln.square})`,
      });
    } else if (!assessSquareVulnerability(afterGame, vuln.square, turn)) {
      resolvedSquares.push({
        sq: vuln.square,
        how: `neutralizes the current threat on ${vuln.square}`,
      });
    }
  }

  const isCastling = san === 'O-O' || san === 'O-O-O';
  if (isCastling) {
    primaryTag = 'king-safety';
    const neutralized = resolvedSquares[0];
    if (neutralized) {
      reasons.push(
        `Castling (${san}) ${neutralized.how} while tucking the king to safety and bringing the rook toward the center`,
      );
    } else {
      reasons.push(
        `Castling (${san}) evacuates the king from the center and activates the rook for central or open-file play`,
      );
    }
  } else if (resolvedSquares.length > 0) {
    primaryTag = 'prophylaxis';
    reasons.push(`${san} ${resolvedSquares[0].how}`);
  }

  // 2. Check if the move delivers checkmate, check, or a winning capture
  if (afterGame.isCheckmate()) {
    primaryTag = 'tactics';
    reasons.unshift(`${san} delivers immediate checkmate`);
  } else if (moveObj.captured) {
    const capturedName = PIECE_NAMES[moveObj.captured] ?? 'piece';
    const capturedVal = PIECE_VALUES[moveObj.captured] ?? 1;
    const moverVal = PIECE_VALUES[moveObj.piece] ?? 1;
    const wasUndefended = beforeGame.attackers(moveObj.to, enemy).length === 0;
    primaryTag = 'tactics';
    if (wasUndefended) {
      reasons.push(`captures the undefended ${capturedName} on ${moveObj.to}`);
    } else if (capturedVal > moverVal) {
      reasons.push(`wins material by capturing the ${capturedName} on ${moveObj.to}`);
    } else {
      reasons.push(`trades on ${moveObj.to} (${san}) to clarify the tension`);
    }
  }

  if (afterGame.inCheck() && !afterGame.isCheckmate()) {
    primaryTag = 'tactics';
    reasons.push(`checks the ${facts.opponentLabel} king with tempo`);
  }

  // 3. Check what new targets the moved piece (or discovered attackers) now threaten
  const afterEnemyPieces = listPieces(afterGame).filter((p) => p.color === enemy && p.type !== 'k');
  const newlyThreatened = [];
  for (const ep of afterEnemyPieces) {
    const beforeAttackers = beforeGame.attackers(ep.square, turn);
    const afterAttackers = afterGame.attackers(ep.square, turn);
    if (afterAttackers.length > beforeAttackers.length) {
      const epVal = PIECE_VALUES[ep.type] ?? 1;
      const moverVal = PIECE_VALUES[moveObj.piece] ?? 1;
      const afterDefenders = afterGame.attackers(ep.square, enemy);
      if (afterDefenders.length === 0 || epVal > moverVal) {
        newlyThreatened.push(`${PIECE_NAMES[ep.type]} on ${ep.square}`);
      }
    }
  }

  if (newlyThreatened.length >= 2) {
    primaryTag = 'tactics';
    reasons.push(
      `creates a double attack against the ${newlyThreatened[0]} and ${newlyThreatened[1]}`,
    );
  } else if (newlyThreatened.length === 1 && !moveObj.captured) {
    reasons.push(`puts direct pressure on the ${newlyThreatened[0]}`);
  }

  // 4. Positional and strategic motives (Center, Development, Open Files, Blockade, Endgame King)
  if (!isCastling) {
    if (
      moveObj.piece === 'p' &&
      (CENTER_SQUARES.has(moveObj.to) || ['c4', 'c5', 'f4', 'f5'].includes(moveObj.to))
    ) {
      const attacksEnemyPawn = afterEnemyPieces.some(
        (ep) => ep.type === 'p' && afterGame.attackers(ep.square, turn).includes(moveObj.to),
      );
      if (attacksEnemyPawn) {
        reasons.push(`strikes at the opponent's pawn structure with a timely pawn break`);
      } else if (CENTER_SQUARES.has(moveObj.to)) {
        reasons.push(`stakes a direct claim in the center (${moveObj.to})`);
      }
    } else if (
      (moveObj.piece === 'n' || moveObj.piece === 'b') &&
      (STARTING_MINORS[turn] ?? []).includes(moveObj.from)
    ) {
      reasons.push(
        `develops the ${pieceLabel} from its starting square toward active central squares`,
      );
    } else if (moveObj.piece === 'r') {
      const destFile = moveObj.to[0];
      const destRank = moveObj.to[1];
      if ((turn === 'w' && destRank === '7') || (turn === 'b' && destRank === '2')) {
        reasons.push(`invades the seventh rank (${moveObj.to}) to tie down enemy pawns and king`);
      } else if (facts.structure.openFiles.includes(destFile)) {
        reasons.push(`seizes the open ${destFile}-file (${moveObj.to})`);
      } else if (facts.structure.halfOpenFiles.includes(destFile)) {
        reasons.push(`places the rook on the half-open ${destFile}-file to pressure the opponent's pawn`);
      }
    } else if (facts.structure.enemyPassedPawns.length > 0) {
      // Check if move blockades an enemy passed pawn
      const blockaded = facts.structure.enemyPassedPawns.find((pawnSq) => {
        const file = pawnSq[0];
        const rank = Number(pawnSq[1]);
        const frontSq = `${file}${turn === 'w' ? rank - 1 : rank + 1}`;
        return moveObj.to === frontSq;
      });
      if (blockaded) {
        reasons.push(
          `establishes a Nimzowitsch blockade directly in front of the passed pawn on ${blockaded}`,
        );
      }
    } else if (facts.structure.passedPawns.includes(moveObj.from)) {
      reasons.push(`advances the passed pawn toward promotion`);
    } else if (facts.phase === 'endgame' && moveObj.piece === 'k' && EXTENDED_CENTER.has(moveObj.to)) {
      reasons.push(`activates the king toward the center for the endgame`);
    }
  }

  if (reasons.length === 0) {
    reasons.push(
      `improves the ${pieceLabel} to ${moveObj.to} while maintaining flexible piece coordination`,
    );
  }

  const replySan = line.sanMoves?.[1] ?? null;
  const followUpSan = line.sanMoves?.[2] ?? null;
  const continuation = replySan
    ? followUpSan
      ? `If ${facts.opponentLabel} replies ${replySan}, the continuation ${followUpSan} keeps the initiative.`
      : `Best expected reply from ${facts.opponentLabel}: ${replySan}.`
    : null;

  const explanation = `${reasons.slice(0, 2).join(', and ')}.`;

  return {
    rank: line.rank ?? 1,
    san,
    uci,
    from: moveObj.from,
    to: moveObj.to,
    score: line.score ?? null,
    mate: line.mate ?? null,
    bound: line.bound ?? 'exact',
    scoreLabel: formatEngineScore(line),
    primaryTag,
    why: explanation.charAt(0).toUpperCase() + explanation.slice(1),
    continuation,
    replySan,
    followUpSan,
    pvSan: line.sanMoves?.slice(0, 6) ?? [san],
    pvUci: line.uciMoves?.slice(0, 6) ?? [uci],
  };
}

/**
 * Select the most relevant literature/strategy concept card for the current position.
 */
export function selectRelevantStrategyCard(facts, staticEvaluation, topMoveExplanation) {
  if (
    topMoveExplanation?.primaryTag === 'king-safety' ||
    (facts.canCastle && !facts.kingCastled && facts.moveNumber >= 5) ||
    (staticEvaluation?.kingSafety?.advantage?.middleGame ?? 0) < -0.45
  ) {
    return getStrategyCard('king-safety-castling');
  }

  if (facts.threatenedPieces.length > 0 || facts.opponentThreats.length > 0) {
    if (topMoveExplanation?.primaryTag === 'prophylaxis') {
      return getStrategyCard('prophylaxis');
    }
    return getStrategyCard('checks-captures-threats');
  }

  if (facts.structure.enemyPassedPawns.length > 0 || facts.structure.passedPawns.length > 0) {
    return getStrategyCard('blockade');
  }

  if (facts.phase === 'endgame') {
    return getStrategyCard('endgame-king-and-two-weaknesses');
  }

  if (facts.phase === 'opening' || facts.undevelopedMinors.length >= 2) {
    return getStrategyCard('center-and-development');
  }

  if (facts.structure.openFiles.length > 0) {
    return getStrategyCard('open-files');
  }

  return getStrategyCard('prophylaxis');
}

function cpEquivalent(line) {
  if (!line) return null;
  if (Number.isFinite(line.mate)) {
    return line.mate > 0 ? 1500 - Math.abs(line.mate) * 20 : -1500 + Math.abs(line.mate) * 20;
  }
  return Number.isFinite(line.score) ? line.score : null;
}

/**
 * Evaluate the move just played by comparing the previous position's top engine line against the
 * current position's evaluation.
 */
export function evaluateLastMove({
  prevFen,
  prevAnalysis,
  moveSan,
  moveUci,
  currentFen,
  currentAnalysis,
}) {
  if (!prevFen || !moveSan || !currentFen) return null;

  let prevFacts;
  let currFacts;
  try {
    prevFacts = inspectPosition(prevFen);
    currFacts = inspectPosition(currentFen);
  } catch {
    return null;
  }

  const prevSnapshot = prevAnalysis?.depthSnapshots?.at?.(-1) ?? null;
  const currSnapshot = currentAnalysis?.depthSnapshots?.at?.(-1) ?? null;
  const prevBestLine = prevSnapshot?.lines?.[0] ?? null;
  const currBestLine = currSnapshot?.lines?.[0] ?? null;

  const matchedLine = prevSnapshot?.lines?.find(
    (line) => line.uciMoves?.[0] === moveUci || line.sanMoves?.[0] === moveSan,
  );
  const preferredExplanation = prevBestLine
    ? explainEngineMove(prevFen, prevBestLine, prevFacts)
    : null;

  let playedExplanation = null;
  if (moveUci) {
    playedExplanation = explainEngineMove(
      prevFen,
      { rank: matchedLine?.rank ?? 1, uciMoves: [moveUci], sanMoves: [moveSan] },
      prevFacts,
    );
  }

  // Compute centipawn loss if both snapshots are from the same learner perspective, or normalize via FEN
  let lossCp = null;
  if (prevBestLine && currBestLine) {
    const prevCp = cpEquivalent(prevBestLine);
    const currCp = cpEquivalent(currBestLine);
    if (prevCp != null && currCp != null) {
      // Note: useStockfishAnalysis normalizes line scores to `learnerSide`. If learnerSide was the
      // side to move in each FEN, currBestLine is from the opponent's perspective unless learnerSide is fixed.
      const samePerspective =
        prevAnalysis?.learnerSide &&
        currentAnalysis?.learnerSide &&
        prevAnalysis.learnerSide === currentAnalysis.learnerSide;
      const moverPerspectiveSign =
        prevAnalysis?.learnerSide === (prevFacts.turn === 'b' ? 'black' : 'white') ? 1 : -1;
      const prevMoverScore = prevCp * moverPerspectiveSign;
      const currMoverScore = samePerspective
        ? currCp * moverPerspectiveSign
        : -currCp * moverPerspectiveSign;
      lossCp = Math.max(0, prevMoverScore - currMoverScore);
    }
  }

  // Classify verdict
  let verdict = 'good';
  let badge = 'Solid Move';
  let tone = 'good';

  if (matchedLine?.rank === 1 || (lossCp != null && lossCp <= 20)) {
    verdict = 'best';
    badge = 'Optimal Move';
    tone = 'best';
  } else if (matchedLine?.rank === 2 || matchedLine?.rank === 3 || (lossCp != null && lossCp <= 55)) {
    verdict = 'good';
    badge = matchedLine ? `Top-${matchedLine.rank} Choice` : 'Playable Choice';
    tone = 'good';
  } else if (lossCp != null && lossCp > 200) {
    verdict = 'blunder';
    badge = 'Blunder — Tactical Alert';
    tone = 'blunder';
  } else if (lossCp != null && lossCp > 105) {
    verdict = 'mistake';
    badge = 'Mistake';
    tone = 'mistake';
  } else if (lossCp != null && lossCp > 55) {
    verdict = 'inaccuracy';
    badge = 'Inaccuracy';
    tone = 'inaccuracy';
  }

  // Build human summary of the played move
  let summary;
  const opponentPunishment = currBestLine
    ? explainEngineMove(currentFen, currBestLine, currFacts)
    : null;

  if (verdict === 'best') {
    summary = `${moveSan} matches Stockfish’s top recommendation. ${playedExplanation?.why ?? ''}`;
  } else if (verdict === 'good') {
    summary = `${moveSan} is a sound move (${playedExplanation?.why ?? 'keeps the position balanced'}).${
      preferredExplanation && preferredExplanation.san !== moveSan
        ? ` Stockfish slightly preferred ${preferredExplanation.san}: ${preferredExplanation.why}`
        : ''
    }`;
  } else {
    const punishmentText = opponentPunishment
      ? ` This allows ${currFacts.sideLabel} to answer with ${opponentPunishment.san} (${opponentPunishment.why.replace(/\.$/, '')}).`
      : '';
    const preferredText = preferredExplanation
      ? ` Stockfish preferred ${preferredExplanation.san}—${preferredExplanation.why}`
      : '';
    summary = `${moveSan} drops ${lossCp != null ? `${(lossCp / 100).toFixed(1)} pawns` : 'ground'}.${punishmentText}${preferredText}`;
  }

  return {
    moveSan,
    moveUci,
    moverLabel: prevFacts.sideLabel,
    verdict,
    badge,
    tone,
    lossPawns: lossCp != null ? Number((lossCp / 100).toFixed(2)) : null,
    summary: summary.trim(),
    preferredMove: preferredExplanation,
    opponentPunishment,
  };
}

/**
 * Build the complete real-time coaching brief for a position.
 */
export function buildCoachingBrief({
  fen,
  analysis,
  lastMoveReview = null,
  lastTakenBackReview = null,
}) {
  const facts = inspectPosition(fen);
  const latestSnapshot = analysis?.depthSnapshots?.at?.(-1) ?? null;
  const staticEval = analysis?.staticEvaluation ?? null;

  const optimalMoves = (latestSnapshot?.lines ?? [])
    .map((line) => explainEngineMove(fen, line, facts))
    .filter(Boolean);

  const topMove = optimalMoves[0] ?? null;
  const strategyCard = selectRelevantStrategyCard(facts, staticEval, topMove);

  // Build "What you should be thinking about in this position"
  const thoughts = [];

  // 1. Immediate threat / tactical awareness
  if (facts.inCheck) {
    thoughts.push({
      id: 'in-check',
      kind: 'urgent',
      label: 'King in check',
      text: `Your king on ${facts.kingSquare} is in check. Compare capturing the checking piece, interposing, or moving the king to a safe square.`,
    });
  } else if (facts.opponentThreats.length > 0) {
    const topThreat = facts.opponentThreats[0];
    thoughts.push({
      id: 'opponent-threat',
      kind: 'urgent',
      label: 'Opponent threat to neutralize',
      text: `If given a move, ${facts.opponentLabel} ${topThreat.description}. Look for a move that neutralizes ${topThreat.targetSquare} while improving your position.`,
    });
  } else if (facts.threatenedPieces.length > 0) {
    const vuln = facts.threatenedPieces[0];
    thoughts.push({
      id: 'hanging-piece',
      kind: 'warning',
      label: `Pressure on ${vuln.square}`,
      text: `Your ${vuln.pieceName} on ${vuln.square} is ${vuln.isUndefended ? 'undefended' : 'under pressure'} from ${facts.opponentLabel}'s ${vuln.leadAttackerName} on ${vuln.leadAttackerSquare}. Verify whether it needs defense or if a counter-attack is stronger.`,
    });
  }

  // 2. Tactical opportunity against opponent's loose pieces
  if (facts.looseTargets.length > 0 && thoughts.length < 3) {
    const target = facts.looseTargets[0];
    thoughts.push({
      id: 'tactical-target',
      kind: 'opportunity',
      label: `Target on ${target.square}`,
      text: `${facts.opponentLabel}'s ${target.pieceName} on ${target.square} is ${target.isUndefended ? 'undefended' : 'loosely guarded'}. Scan for checks, captures, or double attacks that exploit it.`,
    });
  }

  // 3. Phase & Positional Focus (King safety, Development, Open files, Passed pawns)
  if (facts.canCastle && !facts.kingCastled) {
    thoughts.push({
      id: 'castle-prompt',
      kind: 'positional',
      label: 'King safety & castling',
      text: `Your king is still on ${facts.kingSquare} and castling (${facts.castleMoves.join(' / ')}) is legal. Ask whether castling now secures your king and activates a rook while neutralizing flank threats.`,
    });
  } else if (facts.phase === 'opening' && facts.undevelopedMinors.length > 0) {
    thoughts.push({
      id: 'development-prompt',
      kind: 'positional',
      label: 'Complete development',
      text: `You still have ${facts.undevelopedMinors.length} minor piece${facts.undevelopedMinors.length > 1 ? 's' : ''} on ${facts.undevelopedMinors.join(', ')}. Bring your remaining pieces toward the center before launching a flank attack.`,
    });
  } else if (facts.structure.enemyPassedPawns.length > 0) {
    const passer = facts.structure.enemyPassedPawns[0];
    thoughts.push({
      id: 'blockade-prompt',
      kind: 'positional',
      label: `Restrain passed pawn (${passer})`,
      text: `${facts.opponentLabel} has a passed pawn on ${passer}. In Nimzowitsch’s spirit, look to blockade the square directly in front of it before it advances.`,
    });
  } else if (facts.structure.openFiles.length > 0) {
    const file = facts.structure.openFiles[0];
    thoughts.push({
      id: 'open-file-prompt',
      kind: 'positional',
      label: `Contest the open ${file}-file`,
      text: `The ${file}-file is open. Consider placing a rook on the file to control key invasion squares in ${facts.opponentLabel}'s camp.`,
    });
  } else if (facts.phase === 'endgame') {
    thoughts.push({
      id: 'endgame-king',
      kind: 'positional',
      label: 'Endgame king activity',
      text: `In the endgame, the king is an active fighting piece. Look to centralize your king and place rooks behind passed pawns.`,
    });
  }

  // 4. Classical evaluation insight if thoughts still have room
  if (staticEval && thoughts.length < 3) {
    const factors = [
      ['King safety', staticEval.kingSafety?.advantage?.middleGame],
      ['Mobility', staticEval.mobility?.advantage?.middleGame],
      ['Threats', staticEval.threats?.advantage?.middleGame],
      ['Passed pawns', staticEval.passedPawns?.advantage?.endgame],
      ['Space', staticEval.space?.advantage?.middleGame],
    ].filter(([, val]) => Number.isFinite(val));

    factors.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    const [topFactorLabel, topFactorVal] = factors[0] ?? [];
    if (topFactorLabel && Math.abs(topFactorVal) >= 0.25) {
      const favorsSide = topFactorVal > 0 ? 'favors you' : `favors ${facts.opponentLabel}`;
      thoughts.push({
        id: 'eval-factor',
        kind: 'positional',
        label: `Positional imbalance: ${topFactorLabel}`,
        text: `Stockfish’s classical evaluation highlights ${topFactorLabel.toLowerCase()} (${topFactorVal > 0 ? '+' : ''}${topFactorVal.toFixed(2)} pawns, ${favorsSide}) as the sharpest static imbalance on the board.`,
      });
    }
  }

  if (thoughts.length === 0) {
    thoughts.push({
      id: 'prophylaxis-default',
      kind: 'positional',
      label: 'Prophylaxis & piece improvement',
      text: `Ask what ${facts.opponentLabel} wants to play next, then choose a move that restricts their counterplay while improving your least active piece.`,
    });
  }

  return {
    fen,
    depth: latestSnapshot?.depth ?? null,
    facts,
    whatToThinkAbout: thoughts.slice(0, 3),
    optimalMoves,
    topMove,
    lastMoveReview,
    lastTakenBackReview,
    strategyCard,
    staticEvaluation: staticEval,
  };
}

/**
 * Simulate and analyze any hypothetical moves (SAN or coordinate notation) mentioned in a player's
 * natural-language question so the Coach can accurately reason about moves not currently on the board.
 */
export function analyzeHypotheticalMoves(fen, question) {
  if (!fen || !question || typeof question !== 'string') return [];

  let baseFacts;
  try {
    baseFacts = inspectPosition(fen);
  } catch {
    return [];
  }

  // Strip common punctuation around move tokens while keeping +, #, =, -
  const rawTokens = question
    .replace(/[?,!.;:"'()[\]]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^\d+\.+/, '').trim())
    .filter(Boolean);

  const MOVE_LIKE_REGEX =
    /^(?:O-O(?:-O)?|0-0(?:-0)?|[KQRBN][a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|[a-h]x[a-h][1-8](?:=[QRBN])?[+#]?|[a-h][1-8](?:=[QRBN])?[+#]?|[a-h][1-8]-?[a-h][1-8][qrbn]?)$/;

  const candidateTokens = [];
  const seen = new Set();
  for (const tok of rawTokens) {
    if (!MOVE_LIKE_REGEX.test(tok)) continue;
    const normalized = tok.replace(/^0-0-0$/, 'O-O-O').replace(/^0-0$/, 'O-O');
    if (!seen.has(normalized)) {
      seen.add(normalized);
      candidateTokens.push(normalized);
    }
  }

  if (candidateTokens.length === 0) return [];

  const results = [];

  for (let i = 0; i < candidateTokens.length && results.length < 4; i += 1) {
    const token = candidateTokens[i];
    const cleanToken = token.replace(/[+#]+$/, '');
    const coordToken = /^[a-h][1-8]-[a-h][1-8][qrbn]?$/.test(cleanToken)
      ? cleanToken.replace('-', '')
      : cleanToken;

    // 1. Try applying on the current board (side to move)
    const testGame = new Chess(fen);
    let applied = null;
    try {
      applied = applyMove(testGame, coordToken);
    } catch {
      try {
        applied = applyMove(testGame, token);
      } catch {
        applied = null;
      }
    }

    if (applied) {
      const uci = moveToLan(applied);
      const moveExp = explainEngineMove(
        fen,
        { rank: 1, uciMoves: [uci], sanMoves: [applied.san] },
        baseFacts,
      );

      // Inspect the opponent's immediate forcing replies in the resulting position
      const oppMoves = testGame.moves({ verbose: true });
      const forcingReplies = [];
      for (const reply of oppMoves) {
        const afterReply = new Chess(testGame.fen());
        let repApplied;
        try {
          repApplied = afterReply.move(reply);
        } catch {
          continue;
        }
        if (afterReply.isCheckmate()) {
          forcingReplies.push({
            san: repApplied.san,
            priority: 100,
            note: `${repApplied.san} delivers immediate checkmate`,
          });
        } else if (reply.captured) {
          const capVal = PIECE_VALUES[reply.captured] ?? 1;
          const attVal = PIECE_VALUES[repApplied.promotion ?? reply.piece] ?? 1;
          const recapGain = seeRecaptureGain(afterReply, reply.to, attVal);
          const netGain = capVal - recapGain;
          const undefended = recapGain === 0;
          if (netGain > 0 || (reply.to === applied.to && netGain >= 0)) {
            forcingReplies.push({
              san: repApplied.san,
              priority: (undefended ? capVal * 3 : Math.max(1, netGain) * 2) + (afterReply.inCheck() ? 2 : 0),
              note: undefended
                ? `${repApplied.san} captures the undefended ${PIECE_NAMES[reply.captured]} on ${reply.to}`
                : `${repApplied.san} captures the ${PIECE_NAMES[reply.captured]} on ${reply.to}${afterReply.inCheck() ? ' with check' : ''}`,
            });
          }
        } else if (afterReply.inCheck()) {
          const attVal = PIECE_VALUES[repApplied.promotion ?? reply.piece] ?? 1;
          if (bestLegalRecaptureNet(afterReply, reply.to, attVal) < 0) {
            forcingReplies.push({
              san: repApplied.san,
              priority: 3,
              note: `${repApplied.san} gives check`,
            });
          }
        }
      }
      forcingReplies.sort((a, b) => b.priority - a.priority);

      // Check if the next token in the question is a follow-up reply in this hypothetical line
      let followUpNote = null;
      const nextToken = candidateTokens[i + 1];
      if (nextToken) {
        const replyGame = new Chess(testGame.fen());
        try {
          const nextClean = nextToken.replace(/[+#]+$/, '').replace('-', '');
          const repMove = applyMove(replyGame, nextClean);
          followUpNote = `If followed by ${repMove.san}, resulting position is ${replyGame.fen()}`;
        } catch {
          // Next token is a separate alternative move, not a reply
        }
      }

      results.push({
        token,
        legal: true,
        side: baseFacts.sideLabel,
        san: applied.san,
        uci,
        from: applied.from,
        to: applied.to,
        resultingFen: testGame.fen(),
        summary: moveExp?.why ?? `Moves ${PIECE_NAMES[applied.piece]} from ${applied.from} to ${applied.to}.`,
        opponentReplies: forcingReplies.slice(0, 3).map((r) => r.note),
        followUpNote,
      });
      continue;
    }

    // 2. Check if the player is asking about an opponent's hypothetical move (if it were opponent's turn)
    const flippedFen = flipFenTurn(fen);
    if (flippedFen) {
      try {
        const oppGame = new Chess(flippedFen);
        const oppApplied = applyMove(oppGame, coordToken);
        if (oppApplied) {
          results.push({
            token,
            legal: true,
            side: baseFacts.opponentLabel,
            san: oppApplied.san,
            uci: moveToLan(oppApplied),
            from: oppApplied.from,
            to: oppApplied.to,
            resultingFen: oppGame.fen(),
            summary: `Hypothetical ${baseFacts.opponentLabel} move (${PIECE_NAMES[oppApplied.piece]} ${oppApplied.from}->${oppApplied.to}${oppApplied.captured ? `, capturing ${PIECE_NAMES[oppApplied.captured]}` : ''}).`,
            opponentReplies: [],
            followUpNote: null,
          });
          continue;
        }
      } catch {
        // Not a legal opponent move either
      }
    }

    // 3. Only flag as illegal if it looks unmistakably like an explicit algebraic move (piece prefix, capture, or castling)
    if (/^(?:O-O|[KQRBN][a-h]?[1-8]?x?[a-h][1-8]|[a-h]x[a-h][1-8])/.test(token)) {
      results.push({
        token,
        legal: false,
        side: baseFacts.sideLabel,
        summary: `"${token}" is not a legal move in the current board position.`,
      });
    }
  }

  return results;
}

/**
 * Helper to convert a move object or UCI string into a clean LAN string.
 */
export function normalizeMoveToUci(fen, moveInput) {
  try {
    const game = new Chess(fen);
    const m = applyMove(game, moveInput);
    return moveToLan(m);
  } catch {
    return null;
  }
}
