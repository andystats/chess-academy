import { Chess } from 'chess.js';
import { applyMove, isUci, moveToLan } from '../lesson/moves.js';

const MAX_LEARNER_CANDIDATES = 3;

function cleanPromotion(promotion) {
  const token = String(promotion ?? 'q').toLowerCase();
  const piece = token.length === 2 ? token[1] : token[0];
  if (!['q', 'r', 'b', 'n'].includes(piece)) {
    throw new Error('Promotion must be queen, rook, bishop, or knight.');
  }
  return piece;
}

function moveView(move, ply) {
  return {
    ply,
    uci: moveToLan(move),
    san: move.san,
    from: move.from,
    to: move.to,
    promotion: move.promotion ?? null,
    color: move.color === 'b' ? 'black' : 'white',
  };
}

/**
 * Build one legal learner candidate on a throwaway board. The source FEN and caller-owned move
 * values are never changed.
 */
export function candidateMoveFromSquares(fen, from, to, promotion = 'q') {
  const game = new Chess(fen);
  const promotionPiece = cleanPromotion(promotion);
  let move;
  try {
    move = applyMove(game, { from, to, promotion: promotionPiece });
  } catch {
    throw new Error(`Illegal candidate move "${from ?? ''}${to ?? ''}".`);
  }
  return moveView(move, 1);
}

function safePrefixLength(plyCount, total) {
  const count = Number(plyCount);
  if (!Number.isFinite(count)) throw new Error('PV prefix length must be a finite number.');
  return Math.max(0, Math.min(total, Math.trunc(count)));
}

/**
 * Play the requested prefix of a legal UCI principal variation. `arrows` deliberately contains only
 * the current move, keeping board playback readable instead of drawing the entire variation at once.
 */
export function playPvPrefix(fen, uciMoves, plyCount = uciMoves?.length ?? 0) {
  if (!Array.isArray(uciMoves)) throw new Error('Principal variation must be an array of UCI moves.');
  const game = new Chess(fen);
  const prefixLength = safePrefixLength(plyCount, uciMoves.length);
  const appliedMoves = [];

  for (let index = 0; index < prefixLength; index += 1) {
    const uci = uciMoves[index];
    if (!isUci(uci)) throw new Error(`Invalid UCI move at principal-variation ply ${index + 1}.`);
    try {
      appliedMoves.push(moveView(applyMove(game, uci), index + 1));
    } catch {
      throw new Error(`Illegal UCI move "${uci}" at principal-variation ply ${index + 1}.`);
    }
  }

  const currentMove = appliedMoves.at(-1) ?? null;
  return {
    fen: game.fen(),
    arrows: currentMove ? [[currentMove.from, currentMove.to, 'idea']] : [],
    currentMove,
    appliedMoves,
    plyCount: prefixLength,
  };
}

function newestSnapshot(snapshots) {
  return snapshots
    .filter((snapshot) => snapshot && Array.isArray(snapshot.lines))
    .reduce((latest, snapshot) => {
      if (!latest) return snapshot;
      return Number(snapshot.depth) > Number(latest.depth) ? snapshot : latest;
    }, null);
}

function analysisLines(input) {
  if (Array.isArray(input)) {
    const snapshot = newestSnapshot(input);
    return snapshot
      ? { depth: snapshot.depth ?? null, lines: snapshot.lines }
      : { depth: null, lines: input };
  }

  if (!input || typeof input !== 'object') return { depth: null, lines: [] };
  const snapshots = input.depthSnapshots ?? input.snapshots;
  if (Array.isArray(snapshots)) {
    const snapshot = newestSnapshot(snapshots);
    if (snapshot) return { depth: snapshot.depth ?? null, lines: snapshot.lines };
  }
  return {
    depth: input.depth ?? null,
    lines: Array.isArray(input.lines) ? input.lines : [],
  };
}

function engineFirstMoves(input) {
  const { depth, lines } = analysisLines(input);
  const seen = new Set();
  const firstMoves = [];
  for (const line of [...lines].sort((a, b) => Number(a.rank) - Number(b.rank))) {
    const uci = line?.uciMoves?.[0];
    if (!isUci(uci) || seen.has(uci)) continue;
    seen.add(uci);
    firstMoves.push({
      rank: Number.isFinite(Number(line.rank)) ? Number(line.rank) : firstMoves.length + 1,
      uci,
      san: line.sanMoves?.[0] ?? null,
      score: line.score ?? null,
      mate: line.mate ?? null,
      bound: line.bound ?? null,
    });
  }
  return { depth, firstMoves };
}

function candidateView(candidate, index) {
  const value = typeof candidate === 'string' ? { uci: candidate } : candidate;
  if (!value || !isUci(value.uci)) {
    throw new Error(`Learner candidate #${index + 1} must contain a valid UCI move.`);
  }
  return {
    ...value,
    uci: value.uci,
    san: value.san ?? null,
  };
}

function comparisonDebrief(match, lineCount) {
  if (lineCount === 0) {
    return {
      tone: 'waiting',
      headline: 'Analysis pending',
      detail: 'The engine has not produced ranked candidate lines yet.',
    };
  }
  if (!match) {
    return {
      tone: 'outside',
      headline: `Outside the current top ${lineCount}`,
      detail: `This move is not among Stockfish’s ${lineCount} current leading lines at this depth.`,
    };
  }
  if (match.rank === 1) {
    return {
      tone: 'leading',
      headline: 'You found the current leader',
      detail: 'This candidate matches Stockfish’s current first-ranked line.',
    };
  }
  return {
    tone: 'matched',
    headline: `You found candidate #${match.rank}`,
    detail: `This candidate appears as Stockfish’s current line #${match.rank}.`,
  };
}

function overallDebrief(candidateCount, matchedCount, lineCount) {
  if (candidateCount === 0) {
    return {
      tone: 'prompt',
      headline: 'Make your scan first',
      detail: 'Choose up to three legal candidate moves before comparing them with the engine.',
    };
  }
  if (lineCount === 0) {
    return {
      tone: 'waiting',
      headline: 'Analysis pending',
      detail: 'Keep your candidates; the comparison will update when ranked engine lines arrive.',
    };
  }
  if (matchedCount === candidateCount) {
    return {
      tone: 'strong',
      headline: 'Your scan found every branch',
      detail: `All ${candidateCount} of your candidate${candidateCount === 1 ? '' : 's'} appear in the current engine lines.`,
    };
  }
  if (matchedCount > 0) {
    return {
      tone: 'partial',
      headline: 'Your scan found part of the bonsai',
      detail: `${matchedCount} of ${candidateCount} candidates appear in the current engine lines.`,
    };
  }
  return {
    tone: 'different',
    headline: 'The engine is looking elsewhere',
    detail: 'None of your candidates appear in its current leading lines. Inspect the strongest reply before judging them.',
  };
}

/**
 * Compare at most the first three learner candidates with the first move of the newest complete
 * MultiPV snapshot. `analysis` may be a full result, a snapshot, an array of snapshots, or lines.
 */
export function compareCandidates(candidates, analysis) {
  if (!Array.isArray(candidates)) throw new Error('Learner candidates must be an array.');
  const learnerCandidates = candidates
    .slice(0, MAX_LEARNER_CANDIDATES)
    .map((candidate, index) => candidateView(candidate, index));
  const { depth, firstMoves } = engineFirstMoves(analysis);
  const comparisons = learnerCandidates.map((candidate, index) => {
    const engineMove = firstMoves.find((line) => line.uci === candidate.uci) ?? null;
    return {
      index,
      candidate,
      uci: candidate.uci,
      san: candidate.san,
      matched: engineMove !== null,
      rank: engineMove?.rank ?? null,
      engineMove,
      debrief: comparisonDebrief(engineMove, firstMoves.length),
    };
  });
  const matchedCount = comparisons.filter((comparison) => comparison.matched).length;

  return {
    depth,
    comparisons,
    engineFirstMoves: firstMoves,
    matchedCount,
    debrief: overallDebrief(comparisons.length, matchedCount, firstMoves.length),
  };
}

/**
 * Format a learner-normalized analysis score. Centipawns become pawns; bounds stay visible so an
 * upper/lower bound is never presented as an exact evaluation.
 */
export function formatEngineScore({ score = null, mate = null, bound = 'exact' } = {}) {
  let label;
  if (Number.isFinite(mate)) {
    const distance = Math.abs(Math.trunc(mate));
    label = mate < 0 ? `-M${distance}` : `M${distance}`;
  } else if (Number.isFinite(score)) {
    const pawns = score / 100;
    if (Object.is(pawns, -0) || pawns === 0) label = '0.00';
    else label = `${pawns > 0 ? '+' : ''}${pawns.toFixed(2)}`;
  } else {
    return '—';
  }

  if (bound === 'lower') return `≥${label}`;
  if (bound === 'upper') return `≤${label}`;
  return label;
}
