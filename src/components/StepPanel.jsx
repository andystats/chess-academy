import clsx from 'clsx';
import { ChevronLeft, ChevronRight, RotateCcw, Lightbulb, CheckCircle2, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import Markdown from './Markdown.jsx';
import GlossaryLink from './GlossaryLink.jsx';

const renderTerm = ({ slug, display }) => <GlossaryLink slug={slug} display={display} />;

function ProgressBar({ current, total }) {
  return (
    <div className="flex items-center gap-3" aria-label={`Lesson step ${current} of ${total}`}>
      <div className="h-2 flex-1 overflow-hidden border border-foreground bg-gray-100">
        <div
          className="h-full bg-gradient-to-r from-brand-300 to-accent-teal transition-all"
          style={{ width: `${(current / Math.max(1, total)) * 100}%` }}
        />
      </div>
      <span className="font-mono text-xs font-bold text-gray-500">
        {current} / {total}
      </span>
    </div>
  );
}

function ChooseOptions({ options, chosenOptionId, onChoose }) {
  return (
    <div className="space-y-2">
      {options.map((option) => {
        const chosen = chosenOptionId === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChoose(option.id)}
            className={clsx(
              'min-h-touch w-full border-3 px-4 py-3 text-left transition-colors',
              chosen && option.correct && 'border-correct bg-green-50',
              chosen && !option.correct && 'border-retry bg-orange-50',
              !chosen && 'border-foreground hover:bg-brand-50',
            )}
          >
            <span className="font-semibold text-gray-800">{option.label}</span>
            {chosen && option.explain && <span className="mt-1 block text-sm text-gray-600">{option.explain}</span>}
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
        'flex items-start gap-2 border-3 px-4 py-3 text-sm font-medium',
        correct ? 'border-correct bg-green-50 text-green-800' : 'border-retry bg-orange-50 text-orange-800',
      )}
      role="status"
    >
      {correct ? <CheckCircle2 className="mt-0.5 shrink-0" size={18} /> : <RotateCcw className="mt-0.5 shrink-0" size={18} />}
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
    <div className="flex w-full max-w-xl flex-col gap-5">
      <div>
        {chapterTitle && (
          <p className="font-mono text-xs font-bold uppercase tracking-wide text-brand-600">{chapterTitle}</p>
        )}
        <h1 className="mt-1 font-display text-3xl font-bold uppercase tracking-tight text-foreground">{step.title}</h1>
      </div>

      <Markdown className="text-lg leading-8 text-gray-700" renderTerm={renderTerm}>
        {step.markdown}
      </Markdown>

      {step.mode === 'choose' && (
        <ChooseOptions options={step.options} chosenOptionId={chosenOptionId} onChoose={chooseOption} />
      )}

      <Feedback feedback={feedback} />

      {revealedHints > 0 && (
        <ul className="space-y-1">
          {hints.slice(0, revealedHints).map((hint, index) => (
            <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
              <Lightbulb className="mt-0.5 shrink-0 text-amber-500" size={16} />
              <span>{hint.text}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button type="button" onClick={prev} disabled={isFirstStep} className="tao-btn-ghost">
          <ChevronLeft size={20} /> Back
        </button>

        {step.mode === 'line' && (
          <button type="button" onClick={restartStep} className="tao-btn-ghost">
            <RotateCcw size={18} /> Start over
          </button>
        )}

        {hints.length > 0 && revealedHints < hints.length && isInteractive && (
          <button
            type="button"
            onClick={requestHint}
            className="inline-flex min-h-touch items-center justify-center gap-1.5 border-3 border-amber-400 bg-amber-50 px-4 font-semibold text-amber-700 transition-all hover:bg-amber-100"
          >
            <Lightbulb size={18} /> Hint
          </button>
        )}

        {isLastStep && canAdvance ? (
          <Link to="/my-system" className="tao-btn-primary ml-auto">
            Done <Sparkles size={18} />
          </Link>
        ) : (
          <button
            type="button"
            onClick={next}
            disabled={!canAdvance}
            className="tao-btn-primary ml-auto"
          >
            <>
              Next <ChevronRight size={20} />
            </>
          </button>
        )}
      </div>

      <ProgressBar current={stepIndex + 1} total={totalSteps} />
    </div>
  );
}
