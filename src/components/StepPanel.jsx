import clsx from 'clsx';
import { ChevronLeft, ChevronRight, RotateCcw, Lightbulb, CheckCircle2, Sparkles } from 'lucide-react';
import Markdown from './Markdown.jsx';
import GlossaryLink from './GlossaryLink.jsx';

// The teaching column: title, prose, choose options, feedback, hints, and step navigation.
// Driven entirely by the object returned from useChessLesson.

const renderTerm = ({ slug, display }) => <GlossaryLink slug={slug} display={display} />;

function ProgressBar({ current, total }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
        <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${(current / Math.max(1, total)) * 100}%` }} />
      </div>
      <span className="text-sm font-medium text-gray-400">{current} / {total}</span>
    </div>
  );
}

function ChooseOptions({ options, chosenOptionId, onChoose }) {
  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const chosen = chosenOptionId === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChoose(opt.id)}
            className={clsx(
              'w-full text-left rounded-2xl border-2 px-4 py-3 min-h-touch transition-colors',
              chosen && opt.correct && 'border-correct bg-green-50',
              chosen && !opt.correct && 'border-retry bg-orange-50',
              !chosen && 'border-gray-200 hover:border-brand-500 hover:bg-brand-50',
            )}
          >
            <span className="font-semibold text-gray-800">{opt.label}</span>
            {chosen && opt.explain && <span className="block mt-1 text-sm text-gray-600">{opt.explain}</span>}
          </button>
        );
      })}
    </div>
  );
}

function Feedback({ feedback }) {
  if (!feedback) return null;
  const correct = feedback.kind === 'correct';
  return (
    <div
      className={clsx(
        'flex items-start gap-2 rounded-2xl px-4 py-3 text-sm font-medium',
        correct ? 'bg-green-50 text-green-800' : 'bg-orange-50 text-orange-800',
      )}
    >
      {correct ? <CheckCircle2 className="shrink-0 mt-0.5" size={18} /> : <RotateCcw className="shrink-0 mt-0.5" size={18} />}
      <span>{feedback.text}</span>
    </div>
  );
}

export default function StepPanel({ lesson, chapterTitle }) {
  const {
    step,
    stepIndex,
    totalSteps,
    isFirstStep,
    isLastStep,
    feedback,
    canAdvance,
    chosenOptionId,
    revealedHints,
    chooseOption,
    requestHint,
    restartStep,
    next,
    prev,
  } = lesson;

  if (!step) return null;
  const hints = step.hints ?? [];
  const isInteractive = step.mode === 'line' || step.mode === 'choose';

  return (
    <div className="flex flex-col gap-5 w-full max-w-xl">
      <div>
        {chapterTitle && (
          <p className="text-sm font-bold uppercase tracking-wide text-brand-600">{chapterTitle}</p>
        )}
        <h1 className="text-3xl font-display font-bold text-gray-900">{step.title}</h1>
      </div>

      <Markdown className="text-lg leading-relaxed text-gray-700" renderTerm={renderTerm}>
        {step.markdown}
      </Markdown>

      {step.mode === 'choose' && (
        <ChooseOptions options={step.options} chosenOptionId={chosenOptionId} onChoose={chooseOption} />
      )}

      <Feedback feedback={feedback} />

      {revealedHints > 0 && (
        <ul className="space-y-1">
          {hints.slice(0, revealedHints).map((h, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
              <Lightbulb className="shrink-0 mt-0.5 text-amber-500" size={16} />
              <span>{h.text}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="button"
          onClick={prev}
          disabled={isFirstStep}
          className="inline-flex items-center gap-1 rounded-2xl border-2 border-gray-200 px-4 min-h-touch font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={20} /> Back
        </button>

        {step.mode === 'line' && (
          <button
            type="button"
            onClick={restartStep}
            className="inline-flex items-center gap-1 rounded-2xl border-2 border-gray-200 px-4 min-h-touch font-semibold text-gray-700 hover:bg-gray-50"
          >
            <RotateCcw size={18} /> Start over
          </button>
        )}

        {hints.length > 0 && revealedHints < hints.length && isInteractive && (
          <button
            type="button"
            onClick={requestHint}
            className="inline-flex items-center gap-1 rounded-2xl border-2 border-amber-200 bg-amber-50 px-4 min-h-touch font-semibold text-amber-700 hover:bg-amber-100"
          >
            <Lightbulb size={18} /> Hint
          </button>
        )}

        <button
          type="button"
          onClick={next}
          disabled={isLastStep || !canAdvance}
          className="ml-auto inline-flex items-center gap-1 rounded-2xl bg-brand-500 px-6 min-h-touch font-semibold text-white shadow-sm hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isLastStep ? <>Done <Sparkles size={18} /></> : <>Next <ChevronRight size={20} /></>}
        </button>
      </div>

      <ProgressBar current={stepIndex + 1} total={totalSteps} />
    </div>
  );
}
