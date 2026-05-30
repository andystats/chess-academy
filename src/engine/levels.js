// Strength ladder for the Stockfish opponent.
//
// Reality of this engine (stockfish.js v10): it exposes only the "Skill Level" option (0–20), not
// UCI_Elo, and it can't be made to play like a beginner by any built-in setting. Skill Level mostly
// adds move-choice randomness but rarely hangs material, and limiting search depth doesn't help
// either — Stockfish's quiescence search still resolves captures and checks at the leaves, so it
// finds short tactics even at depth 1. Its practical floor is roughly ~1300–1400.
//
// So the easy rungs are weakened by INJECTING BLUNDERS: with probability `blunder`, the opponent
// plays a random legal move instead of the engine's choice (see useEngineGame). That's what makes a
// genuinely beatable beginner. The strong rungs use Skill Level + thinking time with no blunders.
//
// The `rating` figures are rough, for feel only — there's no Elo dial here and effective strength
// shifts with move time, so treat them as ballpark, not a gauge. `value` is a stable level id.
export const ENGINE_LEVELS = [
  { value: 1, label: 'Beginner', rating: '~700', skill: 0, blunder: 0.5, search: { movetime: 200 } },
  { value: 4, label: 'Casual', rating: '~1100', skill: 2, blunder: 0.22, search: { movetime: 300 } },
  { value: 8, label: 'Club', rating: '~1500', skill: 6, blunder: 0.06, search: { movetime: 500 } },
  { value: 14, label: 'Tough', rating: '~1900', skill: 12, blunder: 0, search: { movetime: 800 } },
  { value: 20, label: 'Brutal', rating: '~2300', skill: 20, blunder: 0, search: { movetime: 1200 } },
];

const DEFAULT = ENGINE_LEVELS[1]; // Casual

/** The level config for a level id, falling back to a sensible default. */
export function levelConfig(value) {
  return ENGINE_LEVELS.find((l) => l.value === value) ?? DEFAULT;
}
