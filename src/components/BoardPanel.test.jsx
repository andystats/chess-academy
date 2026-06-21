import { describe, it, expect } from 'vitest';
import { buildSquareStyles } from './boardSquareStyles.js';

// Unit-test the pure tier-precedence logic that keeps the three Duck Decay crack states visually
// distinct (passable scar vs blocking decay vs shattered) — the part where an off-by-one is invisible
// to the eye but wrong. The component render (react-chessboard) is exercised elsewhere.

const base = {
  highlights: [], selectedSquare: null, legalTargets: [], duckSquare: null, duckTargets: [],
  decaySquares: [], decayLevels: {}, breakHits: 5, brokenSquares: [],
  repairTargets: [], repairMode: false, pulses: {}, reduceMotion: true,
};

describe('buildSquareStyles — Duck Decay tiers', () => {
  it('distinguishes a blocking decayed square from a passable regrown scar', () => {
    const styles = buildSquareStyles({ ...base, decaySquares: ['e3'], decayLevels: { e3: 2, c4: 1 } });
    expect(styles.e3.boxShadow).toContain('inset'); // active decay → inset ring (reads as blocking)
    expect(styles.c4.boxShadow).toBeUndefined(); // scar (hit count only) → no ring, stays passable
    expect(styles.c4.backgroundImage).toBeTruthy(); // …but faintly cracked
  });

  it('shows the shatter style for a broken square regardless of any hit level', () => {
    const styles = buildSquareStyles({ ...base, decayLevels: { e3: 3 }, brokenSquares: ['e3'] });
    expect(styles.e3.backgroundColor).toBe('rgba(17, 24, 39, 0.62)'); // BROKEN_STYLE wins over scar
  });

  it('lets the duck overlay win its own square', () => {
    const styles = buildSquareStyles({ ...base, duckSquare: 'e3', decaySquares: ['e3'], decayLevels: { e3: 2 } });
    expect(styles.e3.backgroundImage).toContain('duck'); // duck art, not the crack gradient
  });

  it('highlights repair targets only while repair mode is armed', () => {
    const off = buildSquareStyles({ ...base, brokenSquares: ['e4'], repairTargets: ['e4'], repairMode: false });
    expect(off.e4.cursor).toBeUndefined();
    const on = buildSquareStyles({ ...base, brokenSquares: ['e4'], repairTargets: ['e4'], repairMode: true });
    expect(on.e4.cursor).toBe('pointer');
  });

  it('omits the pulse animation under reduced motion and keeps it otherwise', () => {
    const reduced = buildSquareStyles({ ...base, decaySquares: ['e3'], decayLevels: { e3: 1 }, reduceMotion: true });
    expect(reduced.e3.animation).toBeUndefined();
    const motion = buildSquareStyles({ ...base, decaySquares: ['e3'], decayLevels: { e3: 1 }, reduceMotion: false });
    expect(motion.e3.animation).toContain('duck-decay-pulse');
  });
});
