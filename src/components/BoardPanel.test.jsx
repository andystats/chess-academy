import { describe, it, expect } from 'vitest';
import { buildSquareStyles } from './boardSquareStyles.js';
import { BOARD_THEMES } from './boardThemes.js';

// Unit-test the pure tier-precedence logic that keeps the three Duck Decay crack states visually
// distinct (passable scar vs blocking decay vs shattered) — the part where an off-by-one is invisible
// to the eye but wrong. The component render (react-chessboard) is exercised elsewhere.

const base = {
  highlights: [], selectedSquare: null, legalTargets: [], duckSquare: null, duckTargets: [],
  decaySquares: [], decayLevels: {}, breakHits: 5, brokenSquares: [],
  repairTargets: [], repairMode: false, pulses: {}, reduceMotion: true,
};

function relativeLuminance(hex) {
  const channels = hex.match(/[0-9a-f]{2}/gi).map((channel) => Number.parseInt(channel, 16) / 255);
  const [red, green, blue] = channels.map((channel) => (
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

function contrastRatio(first, second) {
  const bright = Math.max(relativeLuminance(first), relativeLuminance(second));
  const dark = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (bright + 0.05) / (dark + 0.05);
}

describe('BoardPanel themes', () => {
  it('keeps black book pieces distinct from dark squares', () => {
    expect(contrastRatio(BOARD_THEMES.book.dark, '#000000')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(BOARD_THEMES.book.dark, '#ffffff')).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(BOARD_THEMES.book.dark, BOARD_THEMES.book.light)).toBeGreaterThanOrEqual(3);
  });
});

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

  it('applies the capture flash animation to a captured square', () => {
    const styles = buildSquareStyles({ ...base, captureSquare: 'd5', reduceMotion: false });
    expect(styles.d5.animation).toContain('capture-flash');
  });
});
