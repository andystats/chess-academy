import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ScanSearch } from 'lucide-react';
import { useChessLesson } from '../lesson/useChessLesson.js';
import { useProfile } from '../profile/ProfileContext.jsx';
import { withStepComplete, withLessonComplete } from '../profile/progress.js';
import LessonLayout from './LessonLayout.jsx';
import BoardPanel from './BoardPanel.jsx';
import StepPanel from './StepPanel.jsx';

const COACH_CARD_BY_LESSON = {
  'classics/the-center': 'center-and-development',
  'classics/open-files': 'open-files',
  'classics/blockade': 'blockade',
  'classics/pawn-chain': 'pawn-chains',
  'classics/prophylaxis': 'prophylaxis',
  'classics/overprotection': 'overprotection',
};

// Drives one lesson envelope through the existing engine, renders the board and teaching panel, and
// records local profile progress as each step becomes complete.
export default function LessonView({ lesson }) {
  const controller = useChessLesson(lesson);
  const { recordLessonProgress } = useProfile();

  const { step, canAdvance, isLastStep } = controller;
  const stepId = step?.id;

  useEffect(() => {
    if (!canAdvance || !stepId) return;
    recordLessonProgress(lesson, (progress, now) => {
      let next = withStepComplete(progress, stepId, now);
      if (isLastStep) next = withLessonComplete(next, now);
      return next;
    });
  }, [lesson, stepId, canAdvance, isLastStep, recordLessonProgress]);

  const analysisParams = new URLSearchParams({
    fen: controller.fen,
    orientation: controller.orientation,
    title: lesson.title,
  });
  const coachCardId = COACH_CARD_BY_LESSON[lesson.id];
  if (coachCardId) analysisParams.set('coach', coachCardId);

  return (
    <LessonLayout
      board={
        <div className="w-full max-w-[34rem]">
          <BoardPanel
            variant="book"
            fen={controller.fen}
            orientation={controller.orientation}
            arePiecesDraggable={controller.arePiecesDraggable}
            onPieceDrop={controller.onPieceDrop}
            onPromotionPieceSelect={controller.onPromotionPieceSelect}
            onSquareClick={controller.onSquareClick}
            promotionTarget={controller.promotionTarget}
            arrows={controller.arrows}
            highlights={controller.highlights}
            selectedSquare={controller.selectedSquare}
            legalTargets={controller.legalTargets}
            className="w-full"
          />
          <Link
            to={`/study/engine-xray?${analysisParams.toString()}`}
            className="tao-btn-ghost mt-5 w-full bg-white"
          >
            <ScanSearch size={17} /> Analyze this position
          </Link>
        </div>
      }
      panel={<StepPanel lesson={controller} chapterTitle={lesson.title} />}
    />
  );
}
