import { useEffect, useRef, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { buildSquareStyles } from './boardSquareStyles.js';

// Wraps react-chessboard and translates the lesson/arena engines' overlays (teaching highlights,
// hint/annotation arrows, tap-to-move selection, and the Duck variants' duck/decay terrain) into the
// board's customSquareStyles/customArrows. The pure square-style mapping lives in boardSquareStyles.js.

const ARROW_COLORS = {
  good: 'rgb(34, 197, 94)',
  bad: 'rgb(220, 38, 38)',
  idea: 'rgb(47, 111, 237)',
};
const DEFAULT_ARROW = 'rgb(47, 111, 237)';

const BOARD_THEMES = {
  academy: {
    dark: '#7c9cc4',
    light: '#eaf0f8',
    shell: 'shadow-xl ring-1 ring-black/5',
  },
  book: {
    dark: '#1f2933',
    light: '#f7f3e8',
    shell: 'border border-black/20 shadow-sm',
  },
  arena: {
    dark: '#739552',
    light: '#ebecd0',
    shell: 'border-[3px] border-accent-ink shadow-[6px_6px_0_#1a1a1a]',
  },
};

function prefersReducedMotion() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

function buildArrows(arrows) {
  return arrows.map(([from, to, color]) => [from, to, ARROW_COLORS[color] ?? DEFAULT_ARROW]);
}

export default function BoardPanel({
  fen,
  orientation = 'white',
  arePiecesDraggable = false,
  onPieceDrop,
  onPromotionPieceSelect,
  onSquareClick,
  promotionTarget = null,
  arrows = [],
  highlights = [],
  selectedSquare = null,
  legalTargets = [],
  duckSquare = null,
  duckTargets = [],
  decaySquares = [],
  decayLevels = {},
  breakHits = null,
  brokenSquares = [],
  repairTargets = [],
  repairMode = false,
  variant = 'academy',
  className = 'w-full max-w-[34rem]',
  animationDuration = variant === 'arena' ? 520 : 320,
  captureSquare = null,
}) {
  const theme = BOARD_THEMES[variant] ?? BOARD_THEMES.academy;
  const reduceMotion = prefersReducedMotion();

  // One-shot glass animations: diff square-set membership across renders and fire `glass-shatter` on a
  // newly broken square and `glass-repair` on one that left every cracked tier (decayed/scar/broken).
  // snapshotView rebuilds the arrays each sync, so we compare by square string, not array identity.
  const [pulses, setPulses] = useState({});
  const prevSetsRef = useRef({ decay: new Set(), scar: new Set(), broken: new Set() });
  const pulseCounterRef = useRef(0);
  const timersRef = useRef({});

  useEffect(() => {
    const blocking = new Set([...decaySquares, ...brokenSquares]);
    const decay = new Set(decaySquares);
    const broken = new Set(brokenSquares);
    const scar = new Set(Object.keys(decayLevels).filter((sq) => !blocking.has(sq)));
    const prev = prevSetsRef.current;
    const gone = (sq, ...sets) => sets.every((s) => !s.has(sq));
    const triggered = [];
    for (const sq of broken) if (!prev.broken.has(sq)) triggered.push([sq, 'shatter']);
    for (const sq of prev.decay) if (gone(sq, decay, broken, scar)) triggered.push([sq, 'repair']);
    for (const sq of prev.scar) if (gone(sq, decay, broken, scar)) triggered.push([sq, 'repair']);
    for (const sq of prev.broken) if (gone(sq, decay, broken, scar)) triggered.push([sq, 'repair']);
    prevSetsRef.current = { decay, scar, broken };

    if (!triggered.length || reduceMotion) return;
    setPulses((current) => {
      const next = { ...current };
      for (const [sq, type] of triggered) {
        pulseCounterRef.current += 1;
        next[sq] = { type, n: pulseCounterRef.current };
        clearTimeout(timersRef.current[sq]);
        timersRef.current[sq] = setTimeout(() => {
          delete timersRef.current[sq];
          setPulses((p) => {
            const m = { ...p };
            delete m[sq];
            return m;
          });
        }, 640);
      }
      return next;
    });
  }, [decaySquares, brokenSquares, decayLevels, reduceMotion]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const id of Object.values(timers)) clearTimeout(id);
    };
  }, []);

  return (
    // No overflow-hidden: it would clip react-chessboard's promotion picker. Square corners also
    // suit the sharp tao-rwd treatment; the per-variant shell supplies the border/shadow/ring.
    <div className={`${className} aspect-square ${theme.shell}`}>
      <Chessboard
        position={fen}
        boardOrientation={orientation}
        arePiecesDraggable={arePiecesDraggable}
        onPieceDrop={onPieceDrop}
        onPromotionPieceSelect={onPromotionPieceSelect}
        onSquareClick={onSquareClick}
        // Tap-to-move promotions: the controller hooks stash the pending move and open the picker.
        showPromotionDialog={Boolean(promotionTarget)}
        promotionToSquare={promotionTarget}
        customArrows={buildArrows(arrows)}
        customSquareStyles={buildSquareStyles({
          highlights, selectedSquare, legalTargets, duckSquare, duckTargets,
          decaySquares, decayLevels, breakHits, brokenSquares, repairTargets, repairMode, pulses, reduceMotion,
          captureSquare,
        })}
        customBoardStyle={{ borderRadius: 0 }}
        customDarkSquareStyle={{ backgroundColor: theme.dark }}
        customLightSquareStyle={{ backgroundColor: theme.light }}
        animationDuration={animationDuration}
      />
    </div>
  );
}
