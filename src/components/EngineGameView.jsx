import { useState, useEffect, useRef } from 'react';
import LessonLayout from './LessonLayout.jsx';
import BoardPanel from './BoardPanel.jsx';
import CelebrationOverlay from './CelebrationOverlay.jsx';

// Two-column play surface for the Practice Arena: the arena-themed board (driven by a useEngineGame
// controller) on one side, a caller-supplied panel on the other. Mirrors how LessonView composes
// BoardPanel + StepPanel, so the lesson and arena layouts stay symmetric.
export default function EngineGameView({ game, panel }) {
  const [captureSquare, setCaptureSquare] = useState(null);
  const [boardShake, setBoardShake] = useState(false);

  const whiteCaptured = game.captured?.white?.length ?? 0;
  const blackCaptured = game.captured?.black?.length ?? 0;
  const totalCaptured = whiteCaptured + blackCaptured;
  const lastCapturedRef = useRef(totalCaptured);

  useEffect(() => {
    if (totalCaptured > lastCapturedRef.current) {
      if (game.lastMove?.to) {
        setCaptureSquare(game.lastMove.to);
        setBoardShake(true);

        const timer1 = setTimeout(() => setCaptureSquare(null), 600);
        const timer2 = setTimeout(() => setBoardShake(false), 350);
        return () => {
          clearTimeout(timer1);
          clearTimeout(timer2);
        };
      }
    }
    lastCapturedRef.current = totalCaptured;
  }, [totalCaptured, game.lastMove]);

  const highlights = game.lastMove ? [game.lastMove.from, game.lastMove.to] : [];
  const showVictory = game.status === 'over' && game.result?.winner === game.playerSide;

  return (
    <LessonLayout
      board={
        <div className={`relative w-full max-w-[34rem] transition-transform ${boardShake ? 'animate-board-shake' : ''}`}>
          <BoardPanel
            variant="arena"
            fen={game.fen}
            orientation={game.orientation}
            arePiecesDraggable={game.arePiecesDraggable}
            onPieceDrop={game.onPieceDrop}
            onPromotionPieceSelect={game.onPromotionPieceSelect}
            onSquareClick={game.onSquareClick}
            promotionTarget={game.promotionTarget}
            highlights={highlights}
            selectedSquare={game.selectedSquare}
            legalTargets={game.legalTargets}
            duckSquare={game.duckSquare}
            duckTargets={game.duckTargets}
            decaySquares={game.decaySquares}
            decayLevels={game.decayLevels}
            breakHits={game.breakHits}
            brokenSquares={game.brokenSquares}
            repairTargets={game.repairTargets}
            repairMode={game.repairMode}
            captureSquare={captureSquare}
          />
          {showVictory && (
            <CelebrationOverlay
              onNewGame={game.newGame}
              reason={game.result?.reason}
            />
          )}
        </div>
      }
      panel={panel}
    />
  );
}
