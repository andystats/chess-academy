import duckUrl from '../assets/duck.svg';

// Pure square-style logic for BoardPanel: it maps the lesson/arena engines' overlays (highlights,
// selection, tap-to-move targets, and the Duck variants' duck/decay terrain) to react-chessboard's
// customSquareStyles. Kept out of the component file so it stays a unit-testable pure function.

const HIGHLIGHT_STYLE = { backgroundColor: 'rgba(250, 204, 21, 0.45)' };
const SELECTED_STYLE = { background: 'rgba(47, 111, 237, 0.45)' };
const TARGET_STYLE = {
  background: 'radial-gradient(circle, rgba(47,111,237,0.5) 22%, transparent 24%)',
};

// Duck Chess overlay. react-chessboard's `Piece`/`CustomPieces` types are a closed union of standard
// piece codes, so the duck can't be a real piece — it's drawn as a square background instead. The
// amber fill marks the square even if the hand-drawn art fails to load; the image (src/assets/duck.svg)
// rides on top and scales to fit any aspect ratio.
const DUCK_STYLE = {
  backgroundColor: 'rgba(250, 204, 21, 0.85)',
  backgroundImage: `url("${duckUrl}")`,
  backgroundSize: 'contain',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'center',
};
const DUCK_TARGET_STYLE = {
  background: 'radial-gradient(circle, rgba(234,179,8,0.55) 24%, transparent 26%)',
};
// Duck Prime: squares a repair charge may heal, surfaced while repair mode is armed.
const REPAIR_TARGET_STYLE = {
  boxShadow: 'inset 0 0 0 3px rgba(16,185,129,0.9), inset 0 0 16px rgba(16,185,129,0.35)',
  cursor: 'pointer',
};

// Fractured-glass crack lines: a few hairline fractures at irregular angles. `intensity` (0..1, from
// a square's hit count over the break threshold) deepens the cracks and tint so a square visibly
// nears shattering — the legibility fix for "it shattered out of nowhere".
function crackImage(intensity) {
  const light = (0.25 + intensity * 0.5).toFixed(3);
  const light2 = (0.18 + intensity * 0.35).toFixed(3);
  const dark = (0.18 + intensity * 0.45).toFixed(3);
  const dark2 = (0.14 + intensity * 0.35).toFixed(3);
  return [
    `linear-gradient(63deg, transparent 0 46%, rgba(255,255,255,${light}) 46% 47.5%, transparent 47.5%)`,
    `linear-gradient(115deg, transparent 0 54%, rgba(17,24,39,${dark}) 54% 55.5%, transparent 55.5%)`,
    `linear-gradient(22deg, transparent 0 61%, rgba(17,24,39,${dark2}) 61% 62%, transparent 62%)`,
    `linear-gradient(158deg, transparent 0 38%, rgba(255,255,255,${light2}) 38% 39%, transparent 39%)`,
  ].join(',');
}

// Active decay (blocking): cracked glass with a tint + inset ring that grow with intensity; pulses
// (unless reduced motion). Scar (passable): the same hairline cracks, faint, NO ring or fill, so a
// regrown-but-fragile square still reads as walkable. Broken: a heavy shatter, also blocking.
function decayStyle(intensity, animation) {
  return {
    backgroundColor: `rgba(17, 24, 39, ${(0.1 + intensity * 0.22).toFixed(3)})`,
    backgroundImage: crackImage(intensity),
    boxShadow: `inset 0 0 0 2px rgba(17,24,39,${(0.25 + intensity * 0.3).toFixed(3)}), inset 0 0 18px rgba(234,179,8,${(0.2 + intensity * 0.25).toFixed(3)})`,
    ...(animation ? { animation } : {}),
  };
}
function scarStyle(intensity) {
  return { backgroundImage: crackImage(intensity * 0.5) };
}
const BROKEN_STYLE = {
  backgroundColor: 'rgba(17, 24, 39, 0.62)',
  backgroundImage:
    'linear-gradient(115deg, transparent 0 42%, rgba(250,204,21,0.78) 43% 47%, transparent 48% 100%), linear-gradient(25deg, transparent 0 52%, rgba(255,255,255,0.28) 53% 56%, transparent 57% 100%)',
  boxShadow: 'inset 0 0 0 3px rgba(17,24,39,0.62), inset 0 0 18px rgba(0,0,0,0.42)',
};
export const DECAY_PULSE = 'duck-decay-pulse 1.4s ease-in-out infinite';

export function buildSquareStyles({
  highlights, selectedSquare, legalTargets, duckSquare, duckTargets,
  decaySquares, decayLevels, breakHits, brokenSquares, repairTargets, repairMode, pulses, reduceMotion,
}) {
  const styles = {};
  // breakHits is always present for a decay variant (the only producer of decayLevels); the `|| 1`
  // is a divide-by-zero guard, not a real code path.
  const intensityOf = (sq) => Math.min(1, (decayLevels[sq] ?? 0) / (breakHits || 1));
  for (const sq of highlights) styles[sq] = { ...HIGHLIGHT_STYLE };
  for (const sq of legalTargets) styles[sq] = { ...(styles[sq] ?? {}), ...TARGET_STYLE };
  // Scar tier first (faintest): cracked squares that have regrown (a hit count but no active decay
  // or break) — passable, just visibly fragile.
  const blocking = new Set([...decaySquares, ...brokenSquares]);
  for (const sq of Object.keys(decayLevels)) {
    if (!blocking.has(sq)) styles[sq] = { ...(styles[sq] ?? {}), ...scarStyle(intensityOf(sq)) };
  }
  for (const sq of decaySquares) {
    styles[sq] = { ...(styles[sq] ?? {}), ...decayStyle(intensityOf(sq), reduceMotion ? null : DECAY_PULSE) };
  }
  for (const sq of brokenSquares) styles[sq] = { ...(styles[sq] ?? {}), ...BROKEN_STYLE };
  // One-shot heal/shatter animations on a square that just changed tier (tracked in BoardPanel).
  // Alternating the duration by parity (560/561ms) changes the `animation` string each fire, so a
  // rapid re-trigger restarts the keyframe instead of being deduped as an identical value.
  if (!reduceMotion) {
    for (const [sq, pulse] of Object.entries(pulses)) {
      const name = pulse.type === 'shatter' ? 'glass-shatter' : 'glass-repair';
      styles[sq] = { ...(styles[sq] ?? {}), animation: `${name} ${560 + (pulse.n % 2)}ms ease-out both` };
    }
  }
  if (selectedSquare) styles[selectedSquare] = { ...(styles[selectedSquare] ?? {}), ...SELECTED_STYLE };
  for (const sq of duckTargets) styles[sq] = { ...(styles[sq] ?? {}), ...DUCK_TARGET_STYLE };
  if (repairMode) for (const sq of repairTargets) styles[sq] = { ...(styles[sq] ?? {}), ...REPAIR_TARGET_STYLE };
  if (duckSquare) styles[duckSquare] = { ...(styles[duckSquare] ?? {}), ...DUCK_STYLE }; // duck wins its square
  return styles;
}
