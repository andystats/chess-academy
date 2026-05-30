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
    dark: '#1c9ed3',
    light: '#edf6fc',
    shell: 'border-[3px] border-accent-ink shadow-[6px_6px_0_#1a1a1a]',
  },
};

function buildArrows(arrows) {
  return arrows.map(([from, to, color]) => [from, to, ARROW_COLORS[color] ?? DEFAULT_ARROW]);
}

function buildSquareStyles({ highlights, selectedSquare, legalTargets }) {
  const styles = {};
  for (const sq of highlights) styles[sq] = { ...HIGHLIGHT_STYLE };
  for (const sq of legalTargets) styles[sq] = { ...(styles[sq] ?? {}), ...TARGET_STYLE };
  if (selectedSquare) styles[selectedSquare] = { ...(styles[selectedSquare] ?? {}), ...SELECTED_STYLE };
  return styles;
}

export default function BoardPanel({
  fen,
  orientation = 'white',
  arePiecesDraggable = false,
  onPieceDrop,
  onPromotionPieceSelect,
  onSquareClick,
  arrows = [],
  highlights = [],
  selectedSquare = null,
  legalTargets = [],
  variant = 'academy',
  className = 'w-full max-w-[34rem]',
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
        customArrows={buildArrows(arrows)}
        customSquareStyles={buildSquareStyles({ highlights, selectedSquare, legalTargets })}
        customBoardStyle={{ borderRadius: 0 }}
        customDarkSquareStyle={{ backgroundColor: theme.dark }}
        customLightSquareStyle={{ backgroundColor: theme.light }}
        animationDuration={250}
      />
    </div>
  );
}
