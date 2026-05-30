import { useEffect } from 'react';
import { useChessLesson } from '../lesson/useChessLesson.js';
import { useProfile } from '../profile/ProfileContext.jsx';
import { withStepComplete, withLessonComplete } from '../profile/progress.js';
import LessonLayout from './LessonLayout.jsx';
import BoardPanel from './BoardPanel.jsx';
import StepPanel from './StepPanel.jsx';

// Drives a single lesson envelope through the engine, renders the board + teaching panel, and
// records profile progress as each step is completed.
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

  return (
    <LessonLayout
      board={
        <BoardPanel
          fen={controller.fen}
          orientation={controller.orientation}
          arePiecesDraggable={controller.arePiecesDraggable}
          onPieceDrop={controller.onPieceDrop}
          onPromotionPieceSelect={controller.onPromotionPieceSelect}
          onSquareClick={controller.onSquareClick}
          arrows={controller.arrows}
          highlights={controller.highlights}
          selectedSquare={controller.selectedSquare}
          legalTargets={controller.legalTargets}
        />
      }
      panel={<StepPanel lesson={controller} chapterTitle={lesson.title} />}
    />
  );
}
