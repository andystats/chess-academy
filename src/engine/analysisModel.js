import { Chess } from 'chess.js';
import { applyMove, isUci } from '../lesson/moves.js';

export const ANALYSIS_MULTI_PV = 3;
export const ANALYSIS_DEFAULT_DEPTH = 12;

export function normalizeAnalysisDepth(depth) {
  return Math.max(1, Math.min(30, Math.round(Number(depth) || ANALYSIS_DEFAULT_DEPTH)));
}

/** Convert a legal UCI principal variation into the SAN labels shown to learners. */
export function uciMovesToSan(fen, uciMoves) {
  const game = new Chess(fen);
  return uciMoves.map((uci, index) => {
    if (!isUci(uci)) throw new Error(`Invalid UCI move at principal-variation ply ${index + 1}.`);
    try {
      return applyMove(game, uci).san;
    } catch {
      throw new Error(`Illegal UCI move "${uci}" at principal-variation ply ${index + 1}.`);
    }
  });
}

export function sideToMove(fen) {
  return new Chess(fen).turn() === 'b' ? 'black' : 'white';
}

function learnerSideFor(fen, learnerSide) {
  if (learnerSide == null) return sideToMove(fen);
  if (learnerSide !== 'white' && learnerSide !== 'black') {
    throw new Error('learnerSide must be "white" or "black".');
  }
  return learnerSide;
}

function reverseBound(bound) {
  if (bound === 'lower') return 'upper';
  if (bound === 'upper') return 'lower';
  return bound;
}

export function normalizeUciScore(score, rootSide, learnerSide) {
  if (!score) return { score: null, mate: null, bound: null };
  const sign = rootSide === learnerSide ? 1 : -1;
  return {
    score: score.type === 'cp' ? score.value * sign : null,
    mate: score.type === 'mate' ? score.value * sign : null,
    bound: sign === 1 ? score.bound : reverseBound(score.bound),
  };
}

function normalizePair(pair, sign) {
  if (!pair) return { middleGame: null, endgame: null };
  return {
    middleGame: pair.middleGame == null ? null : pair.middleGame * sign,
    endgame: pair.endgame == null ? null : pair.endgame * sign,
  };
}

function normalizeEvalRow(row, sign) {
  if (!row) return null;
  return {
    ...row,
    advantage: normalizePair(row.total, sign),
  };
}

/**
 * Add learner-relative advantages while preserving Stockfish's raw White, Black, and Total table
 * columns. A positive `advantage` is always favorable to `learnerSide`.
 */
export function normalizeClassicalEvaluation(evaluation, learnerSide) {
  if (!evaluation) return null;
  if (learnerSide !== 'white' && learnerSide !== 'black') {
    throw new Error('learnerSide must be "white" or "black".');
  }
  const sign = evaluation.sourcePerspective === learnerSide ? 1 : -1;
  const total = normalizeEvalRow(evaluation.total, sign);
  if (total) {
    total.final = evaluation.total.final;
    total.finalAdvantage =
      evaluation.total.final == null ? null : evaluation.total.final * sign;
  }
  return {
    sourcePerspective: evaluation.sourcePerspective,
    perspective: learnerSide,
    material: normalizeEvalRow(evaluation.material, sign),
    imbalance: normalizeEvalRow(evaluation.imbalance, sign),
    initiative: normalizeEvalRow(evaluation.initiative, sign),
    pawns: normalizeEvalRow(evaluation.pawns, sign),
    pieces: {
      knights: normalizeEvalRow(evaluation.pieces.knights, sign),
      bishops: normalizeEvalRow(evaluation.pieces.bishops, sign),
      rooks: normalizeEvalRow(evaluation.pieces.rooks, sign),
      queens: normalizeEvalRow(evaluation.pieces.queens, sign),
    },
    mobility: normalizeEvalRow(evaluation.mobility, sign),
    kingSafety: normalizeEvalRow(evaluation.kingSafety, sign),
    threats: normalizeEvalRow(evaluation.threats, sign),
    passedPawns: normalizeEvalRow(evaluation.passedPawns, sign),
    space: normalizeEvalRow(evaluation.space, sign),
    total,
  };
}

function maxMetric(lines, key) {
  const values = lines.map((line) => line[key]).filter((value) => value != null);
  return values.length > 0 ? Math.max(...values) : null;
}

function snapshotFrom(depth, linesByRank) {
  const lines = [...linesByRank.values()].sort((a, b) => a.rank - b.rank);
  return {
    depth,
    selectiveDepth: maxMetric(lines, 'selectiveDepth'),
    nodes: maxMetric(lines, 'nodes'),
    nps: maxMetric(lines, 'nps'),
    elapsedMs: maxMetric(lines, 'elapsedMs'),
    lines: lines.map((line) => ({
      rank: line.rank,
      score: line.score,
      mate: line.mate,
      bound: line.bound,
      uciMoves: line.uciMoves,
      sanMoves: line.sanMoves,
    })),
  };
}

/**
 * Accumulate MultiPV `info` records into exactly one final snapshot for every completed depth.
 * `onSnapshot` can receive replacements for a depth if Stockfish revises a rank before moving on;
 * callers should key progressive state by `snapshot.depth`.
 */
export function createDepthSnapshotCollector({
  fen,
  learnerSide,
  maxLines = ANALYSIS_MULTI_PV,
  onSnapshot,
}) {
  const game = new Chess(fen);
  const rootSide = game.turn() === 'b' ? 'black' : 'white';
  const perspective = learnerSideFor(fen, learnerSide);
  const expectedLines = Math.min(maxLines, game.moves().length);
  const linesByDepth = new Map();
  const snapshotsByDepth = new Map();

  function add(info) {
    if (
      expectedLines === 0 ||
      info?.depth == null ||
      !info.score ||
      info.rank < 1 ||
      info.rank > expectedLines ||
      info.uciMoves.length === 0
    ) {
      return null;
    }

    let sanMoves;
    try {
      sanMoves = uciMovesToSan(fen, info.uciMoves);
    } catch {
      return null;
    }

    const normalized = normalizeUciScore(info.score, rootSide, perspective);
    const line = {
      rank: info.rank,
      ...normalized,
      uciMoves: [...info.uciMoves],
      sanMoves,
      selectiveDepth: info.selectiveDepth,
      nodes: info.nodes,
      nps: info.nps,
      elapsedMs: info.elapsedMs,
    };
    const atDepth = linesByDepth.get(info.depth) ?? new Map();
    atDepth.set(info.rank, line);
    linesByDepth.set(info.depth, atDepth);

    for (let rank = 1; rank <= expectedLines; rank += 1) {
      if (!atDepth.has(rank)) return null;
    }

    const snapshot = snapshotFrom(info.depth, atDepth);
    snapshotsByDepth.set(info.depth, snapshot);
    onSnapshot?.(snapshot);
    return snapshot;
  }

  return {
    add,
    learnerSide: perspective,
    expectedLines,
    snapshots() {
      return [...snapshotsByDepth.values()].sort((a, b) => a.depth - b.depth);
    },
  };
}
