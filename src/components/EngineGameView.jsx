import { useState, useEffect, useRef } from 'react';
import LessonLayout from './LessonLayout.jsx';
import BoardPanel from './BoardPanel.jsx';
import CelebrationOverlay from './CelebrationOverlay.jsx';

function playSound(type = 'move') {
  if (typeof window === 'undefined') return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'capture') {
      // Deeper, wooden, organic capture sound
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(240, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else {
      // Subtle, high-quality wooden mechanical click sound
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    }
  } catch (e) {
    // Browser auto-play policies blocked or unsupported
  }
}

// Two-column play surface for the Practice Arena: the arena-themed board (driven by a useEngineGame
// controller) on one side, a caller-supplied panel on the other. Mirrors how LessonView composes
// BoardPanel + StepPanel, so the lesson and arena layouts stay symmetric.
export default function EngineGameView({ game, panel }) {
  const [captureSquare, setCaptureSquare] = useState(null);

  const whiteCaptured = game.captured?.white?.length ?? 0;
  const blackCaptured = game.captured?.black?.length ?? 0;
  const totalCaptured = whiteCaptured + blackCaptured;
  
  const lastFenRef = useRef(game.fen);
  const lastCapturedRef = useRef(totalCaptured);
  const captureTimerRef = useRef(null);

  useEffect(() => {
    if (game.fen !== lastFenRef.current) {
      const isCapture = totalCaptured > lastCapturedRef.current;
      if (isCapture) {
        playSound('capture');
        if (game.lastMove?.to) {
          setCaptureSquare(game.lastMove.to);
          if (captureTimerRef.current) clearTimeout(captureTimerRef.current);
          captureTimerRef.current = setTimeout(() => setCaptureSquare(null), 600);
        }
      } else {
        playSound('move');
      }
      lastFenRef.current = game.fen;
      lastCapturedRef.current = totalCaptured;
    }
    return () => {
      if (captureTimerRef.current) clearTimeout(captureTimerRef.current);
    };
  }, [game.fen, totalCaptured, game.lastMove]);

  const highlights = game.lastMove ? [game.lastMove.from, game.lastMove.to] : [];
  const showVictory = game.status === 'over' && game.result?.winner === game.playerSide;

  return (
    <LessonLayout
      board={
        <div className="relative w-full max-w-[34rem]">
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
