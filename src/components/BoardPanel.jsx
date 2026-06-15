import { Chessboard } from 'react-chessboard';

// Wraps react-chessboard and translates the lesson engine's overlays (teaching highlights,
// hint/annotation arrows, tap-to-move selection) into the board's customSquareStyles/customArrows.

const ARROW_COLORS = {
  good: 'rgb(34, 197, 94)',
  bad: 'rgb(220, 38, 38)',
  idea: 'rgb(47, 111, 237)',
};
const DEFAULT_ARROW = 'rgb(47, 111, 237)';

const HIGHLIGHT_STYLE = { backgroundColor: 'rgba(250, 204, 21, 0.45)' };
const SELECTED_STYLE = { background: 'rgba(47, 111, 237, 0.45)' };
const TARGET_STYLE = {
  background: 'radial-gradient(circle, rgba(47,111,237,0.5) 22%, transparent 24%)',
};

// Duck Chess overlay. react-chessboard's `Piece`/`CustomPieces` types are a closed union of standard
// piece codes, so the duck can't be a real piece — it's drawn as a square background instead. The
// amber fill marks the square even if the emoji glyph fails to render; the glyph rides on top via a
// data-URI SVG. Duck-target squares (where the duck may move this turn) get a softer amber dot.
const DUCK_GLYPH = `data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text x='50' y='54' font-size='66' text-anchor='middle' dominant-baseline='central'>🦆</text></svg>",
)}`;
const DUCK_STYLE = {
  backgroundColor: 'rgba(250, 204, 21, 0.85)',
  backgroundImage: `url("${DUCK_GLYPH}")`,
  backgroundSize: '80%',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'center',
};
const DUCK_TARGET_STYLE = {
  background: 'radial-gradient(circle, rgba(234,179,8,0.55) 24%, transparent 26%)',
};
const DECAY_STYLE = {
  backgroundColor: 'rgba(17, 24, 39, 0.22)',
  backgroundImage: 'repeating-linear-gradient(135deg, rgba(17,24,39,0.34) 0 5px, rgba(17,24,39,0.1) 5px 10px)',
};

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

function buildArrows(arrows) {
  return arrows.map(([from, to, color]) => [from, to, ARROW_COLORS[color] ?? DEFAULT_ARROW]);
}

function buildSquareStyles({ highlights, selectedSquare, legalTargets, duckSquare, duckTargets, decaySquares }) {
  const styles = {};
  for (const sq of highlights) styles[sq] = { ...HIGHLIGHT_STYLE };
  for (const sq of legalTargets) styles[sq] = { ...(styles[sq] ?? {}), ...TARGET_STYLE };
  for (const sq of decaySquares) styles[sq] = { ...(styles[sq] ?? {}), ...DECAY_STYLE };
  if (selectedSquare) styles[selectedSquare] = { ...(styles[selectedSquare] ?? {}), ...SELECTED_STYLE };
  for (const sq of duckTargets) styles[sq] = { ...(styles[sq] ?? {}), ...DUCK_TARGET_STYLE };
  if (duckSquare) styles[duckSquare] = { ...(styles[duckSquare] ?? {}), ...DUCK_STYLE }; // duck wins its square
  return styles;
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
  variant = 'academy',
  className = 'w-full max-w-[34rem]',
  animationDuration = variant === 'arena' ? 520 : 320,
}) {
  const theme = BOARD_THEMES[variant] ?? BOARD_THEMES.academy;

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
        customSquareStyles={buildSquareStyles({ highlights, selectedSquare, legalTargets, duckSquare, duckTargets, decaySquares })}
        customBoardStyle={{ borderRadius: 0 }}
        customDarkSquareStyle={{ backgroundColor: theme.dark }}
        customLightSquareStyle={{ backgroundColor: theme.light }}
        animationDuration={animationDuration}
      />
    </div>
  );
}
