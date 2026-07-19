// Stockfish.js v10 gives us Skill Level 0-20, not a true human Elo dial. The labels below are
// therefore estimates of practical feel, not promises. We deliberately avoid artificial random
// legal moves; every reply comes from Stockfish at a constrained skill/search setting.
export const ENGINE_MIN_LEVEL = 0;
export const ENGINE_MAX_LEVEL = 20;
export const ENGINE_DEFAULT_LEVEL = 6;

export const ENGINE_LEVEL_MARKS = [
  { value: 0, label: 'Learner', rating: '~600' },
  { value: 4, label: 'Casual', rating: '~1000' },
  { value: 8, label: 'Club', rating: '~1400' },
  { value: 14, label: 'Expert', rating: '~1800' },
  { value: 20, label: 'Master', rating: '2200+' },
];

function clampLevel(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return ENGINE_DEFAULT_LEVEL;
  return Math.max(ENGINE_MIN_LEVEL, Math.min(ENGINE_MAX_LEVEL, Math.round(n)));
}

function labelFor(level) {
  if (level <= 2) return { label: 'Learner', rating: '~600' };
  if (level <= 6) return { label: 'Casual', rating: '~1000' };
  if (level <= 11) return { label: 'Club', rating: '~1400' };
  if (level <= 16) return { label: 'Expert', rating: '~1800' };
  return { label: 'Master', rating: '2200+' };
}

function getDepth(level) {
  if (level <= 1) return 1;
  if (level <= 3) return 2;
  if (level <= 5) return 3;
  if (level <= 7) return 4;
  if (level <= 9) return 5;
  if (level <= 11) return 6;
  if (level <= 13) return 7;
  if (level <= 15) return 8;
  if (level <= 17) return 10;
  if (level <= 19) return 12;
  return undefined; // uncapped depth for master level
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
      depth: getDepth(level),
      movetime: 180 + level * 55,
    },
  };
}
