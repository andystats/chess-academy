import LessonLayout from './LessonLayout.jsx';
import BoardPanel from './BoardPanel.jsx';

// Two-column play surface for the Practice Arena: the arena-themed board (driven by a useEngineGame
// controller) on one side, a caller-supplied panel on the other. Mirrors how LessonView composes
// BoardPanel + StepPanel, so the lesson and arena layouts stay symmetric.
export default function EngineGameView({ game, panel }) {
  const highlights = game.lastMove ? [game.lastMove.from, game.lastMove.to] : [];
  return (
    <LessonLayout
      board={
        <BoardPanel
          variant="arena"
          fen={game.fen}
          orientation={game.orientation}
          arePiecesDraggable={game.arePiecesDraggable}
          onPieceDrop={game.onPieceDrop}
          onPromotionPieceSelect={game.onPromotionPieceSelect}
          onSquareClick={game.onSquareClick}
          highlights={highlights}
          selectedSquare={game.selectedSquare}
          legalTargets={game.legalTargets}
          duckSquare={game.duckSquare}
          duckTargets={game.duckTargets}
        />
      }
      panel={panel}
    />
  );
}
