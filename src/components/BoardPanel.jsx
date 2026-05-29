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
}) {
  return (
    <div className="w-full max-w-[34rem] aspect-square rounded-2xl overflow-hidden shadow-xl ring-1 ring-black/5">
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
        customDarkSquareStyle={{ backgroundColor: '#7c9cc4' }}
        customLightSquareStyle={{ backgroundColor: '#eaf0f8' }}
        animationDuration={250}
      />
    </div>
  );
}
