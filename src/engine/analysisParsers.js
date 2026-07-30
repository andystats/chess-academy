import { isUci } from '../lesson/moves.js';

const EVAL_TERM_KEYS = {
  Material: 'material',
  Imbalance: 'imbalance',
  Initiative: 'initiative',
  Pawns: 'pawns',
  Knights: 'knights',
  Bishops: 'bishops',
  Rooks: 'rooks',
  Queens: 'queens',
  Mobility: 'mobility',
  'King safety': 'kingSafety',
  Threats: 'threats',
  Passed: 'passedPawns',
  Space: 'space',
  Total: 'total',
};

const EVAL_VALUE = '(?:----|[-+]?\\d+(?:\\.\\d+)?)';
const EVAL_ROW = new RegExp(
  `^\\s*([A-Za-z][A-Za-z ]*?)\\s*\\|\\s*(${EVAL_VALUE})\\s+(${EVAL_VALUE})\\s*` +
    `\\|\\s*(${EVAL_VALUE})\\s+(${EVAL_VALUE})\\s*\\|\\s*(${EVAL_VALUE})\\s+(${EVAL_VALUE})\\s*$`,
);

function integerAfter(tokens, name) {
  const index = tokens.indexOf(name);
  if (index < 0 || index + 1 >= tokens.length) return null;
  const value = Number(tokens[index + 1]);
  return Number.isSafeInteger(value) ? value : null;
}

function scoreFrom(tokens) {
  const index = tokens.indexOf('score');
  if (index < 0 || index + 2 >= tokens.length) return null;
  const type = tokens[index + 1];
  const value = Number(tokens[index + 2]);
  if ((type !== 'cp' && type !== 'mate') || !Number.isSafeInteger(value)) return null;

  let bound = 'exact';
  if (tokens.includes('lowerbound')) bound = 'lower';
  else if (tokens.includes('upperbound')) bound = 'upper';
  return { type, value, bound };
}

/**
 * Parse one iterative UCI `info` line. Unrecognized fields are ignored so this remains compatible
 * with the fixed Stockfish 10 worker as well as engines that add their own UCI extensions.
 */
export function parseUciInfo(line) {
  if (typeof line !== 'string' || !line.startsWith('info ')) return null;
  const tokens = line.trim().split(/\s+/);
  const pvIndex = tokens.indexOf('pv');
  const header = pvIndex >= 0 ? tokens.slice(0, pvIndex) : tokens;
  const uciMoves = pvIndex >= 0 ? tokens.slice(pvIndex + 1) : [];
  if (uciMoves.some((move) => !isUci(move))) return null;

  const depth = integerAfter(header, 'depth');
  const selectiveDepth = integerAfter(header, 'seldepth');
  const rank = integerAfter(header, 'multipv') ?? 1;
  const nodes = integerAfter(header, 'nodes');
  const nps = integerAfter(header, 'nps');
  const elapsedMs = integerAfter(header, 'time');

  if (
    (depth != null && depth < 0) ||
    (selectiveDepth != null && selectiveDepth < 0) ||
    rank < 1 ||
    (nodes != null && nodes < 0) ||
    (nps != null && nps < 0) ||
    (elapsedMs != null && elapsedMs < 0)
  ) {
    return null;
  }

  return {
    depth,
    selectiveDepth,
    rank,
    score: scoreFrom(header),
    nodes,
    nps,
    elapsedMs,
    uciMoves,
  };
}

function evalNumber(token) {
  return token === '----' ? null : Number(token);
}

function evalPair(middleGame, endgame) {
  return {
    middleGame: evalNumber(middleGame),
    endgame: evalNumber(endgame),
  };
}

function emptyEvaluation() {
  return {
    sourcePerspective: 'white',
    material: null,
    imbalance: null,
    initiative: null,
    pawns: null,
    pieces: {
      knights: null,
      bishops: null,
      rooks: null,
      queens: null,
    },
    mobility: null,
    kingSafety: null,
    threats: null,
    passedPawns: null,
    space: null,
    total: null,
  };
}

function setEvaluationTerm(evaluation, key, row) {
  if (['knights', 'bishops', 'rooks', 'queens'].includes(key)) {
    evaluation.pieces[key] = row;
  } else {
    evaluation[key] = row;
  }
}

/**
 * Parse Stockfish 10's non-standard classical `eval` trace. The source columns are preserved; the
 * analysis model adds a learner-relative `advantage` field later without rewriting these facts.
 */
export function parseClassicalEvalTrace(input) {
  const lines = Array.isArray(input) ? input : typeof input === 'string' ? input.split(/\r?\n/) : [];
  const evaluation = emptyEvaluation();
  let found = false;
  let final = null;

  for (const line of lines) {
    const rowMatch = line.match(EVAL_ROW);
    if (rowMatch) {
      const key = EVAL_TERM_KEYS[rowMatch[1].trim()];
      if (!key) continue;
      setEvaluationTerm(evaluation, key, {
        white: evalPair(rowMatch[2], rowMatch[3]),
        black: evalPair(rowMatch[4], rowMatch[5]),
        total: evalPair(rowMatch[6], rowMatch[7]),
      });
      found = true;
      continue;
    }

    const finalMatch = line.match(
      /^\s*Total evaluation:\s*([-+]?\d+(?:\.\d+)?)\s*\((white|black) side\)\s*$/i,
    );
    if (finalMatch) {
      final = Number(finalMatch[1]);
      evaluation.sourcePerspective = finalMatch[2].toLowerCase();
      found = true;
    }
  }

  if (!found) return null;
  if (!evaluation.total) {
    evaluation.total = {
      white: evalPair('----', '----'),
      black: evalPair('----', '----'),
      total: evalPair('----', '----'),
    };
  }
  evaluation.total.final = final;
  return evaluation;
}
