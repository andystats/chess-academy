import { mainlineIndexForPlayerMove } from './moves.js';

// Pure, React-free transition logic for a single lesson step. `useChessLesson` is a thin wrapper
// that holds the chess.js game + timers and calls into these functions, so the state machine can
// be unit-tested directly.
//
// All five authored step types normalize to one runtime descriptor. Interactive steps
// (`single-move`, `line`) become a `line`: a mainline interleaving the player's and opponent's
// moves, plus a map of extra acceptable player moves per ordinal. A `single-move` is just a
// one-ply line whose sole player move has all of `solution.san` acceptable.

const MODE_BY_TYPE = {
  prose: 'read',
  'single-move': 'line',
  line: 'line',
  choose: 'choose',
  'free-explore': 'explore',
};

/** Turn an authored step into the runtime descriptor the engine and UI consume. */
export function normalizeStep(step) {
  const base = {
    id: step.id,
    type: step.type,
    mode: MODE_BY_TYPE[step.type],
    title: step.title ?? '',
    markdown: step.markdown ?? '',
    orientation: step.orientation ?? 'white',
    fen: step.fen ?? null,
    annotations: step.annotations ?? null,
    hints: step.hints ?? [],
    feedback: step.feedback ?? {},
    options: step.options ?? null,
    // Authored lessons never auto-play a first move; imported puzzles set this true.
    hasSetupMove: step.hasSetupMove ?? false,
    mainline: [],
    acceptableAt: {},
    opponentReplies: null,
  };

  if (step.type === 'single-move') {
    base.mainline = [step.solution.san[0]];
    base.acceptableAt = { 0: step.solution.san };
  } else if (step.type === 'line') {
    base.mainline = step.mainline;
    base.acceptableAt = step.acceptableAt ?? {};
    base.opponentReplies = step.opponentReplies ?? null;
  }
  return base;
}

/** Number of moves the player must make in an interactive step. */
export function playerOrdinalCount(d) {
  if (d.mode !== 'line') return 0;
  const start = d.hasSetupMove ? 1 : 0;
  return Math.ceil((d.mainline.length - start) / 2);
}

/** Acceptable SAN moves for the player's `ordinal`-th move. */
export function expectedSansAt(d, ordinal) {
  const mi = mainlineIndexForPlayerMove(ordinal, d.hasSetupMove);
  const fromMainline = mi < d.mainline.length ? [d.mainline[mi]] : [];
  const alts = d.acceptableAt[ordinal] ?? d.acceptableAt[String(ordinal)] ?? [];
  return [...new Set([...fromMainline, ...alts])];
}

/** The opponent's reply move (SAN) that follows the player's `ordinal`-th move, or null. */
export function opponentReplyAt(d, ordinal) {
  const replyIndex = mainlineIndexForPlayerMove(ordinal, d.hasSetupMove) + 1;
  if (d.opponentReplies && d.opponentReplies[ordinal] != null) return d.opponentReplies[ordinal];
  return replyIndex < d.mainline.length ? d.mainline[replyIndex] : null;
}
