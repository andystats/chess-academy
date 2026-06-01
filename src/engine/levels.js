// Stockfish.js v10 gives us Skill Level 0-20, not a true human Elo dial. The labels below are
// therefore estimates of practical feel, not promises. We deliberately avoid artificial random
// legal moves; every reply comes from Stockfish at a constrained skill/search setting.
export const ENGINE_MIN_LEVEL = 0;
export const ENGINE_MAX_LEVEL = 20;
export const ENGINE_DEFAULT_LEVEL = 6;

export const ENGINE_LEVEL_MARKS = [
  { value: 0, label: 'Learner', rating: '~1200' },
  { value: 4, label: 'Casual', rating: '~1350' },
  { value: 8, label: 'Club', rating: '~1550' },
  { value: 14, label: 'Expert', rating: '~1900' },
  { value: 20, label: 'Master', rating: '2200+' },
];

function clampLevel(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return ENGINE_DEFAULT_LEVEL;
  return Math.max(ENGINE_MIN_LEVEL, Math.min(ENGINE_MAX_LEVEL, Math.round(n)));
}

function labelFor(level) {
  if (level <= 2) return { label: 'Learner', rating: '~1200' };
  if (level <= 6) return { label: 'Casual', rating: '~1350' };
  if (level <= 11) return { label: 'Club', rating: '~1550' };
  if (level <= 16) return { label: 'Expert', rating: '~1900' };
  return { label: 'Master', rating: '2200+' };
}

/** The level config for a slider value, falling back to a sensible default. */
export function levelConfig(value) {
  const level = clampLevel(value);
  const identity = labelFor(level);
  return {
    value: level,
    ...identity,
    skill: level,
    search: {
      depth: level <= 2 ? 1 : level <= 5 ? 2 : level <= 8 ? 3 : undefined,
      movetime: 180 + level * 55,
    },
  };
}
