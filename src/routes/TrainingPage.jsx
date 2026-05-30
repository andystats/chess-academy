import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronRight, Clock } from 'lucide-react';
import { listTracks } from '../content/registry.js';
import { useProfile } from '../profile/ProfileContext.jsx';

// A scannable pre-move checklist. The goal is fewer blunders: run through it before every move.
const CHECKLIST = [
  { rule: 'Is the king safe?', note: 'Check yours and his before anything else.' },
  { rule: 'What did his last move do?', note: 'Read the threat behind it before you reply.' },
  { rule: 'Scan checks, captures, threats.', note: 'Every forcing move, for both sides.' },
  { rule: "Don't hang pieces.", note: 'Is each of your pieces defended? Any loose ones?' },
  { rule: 'Is my move safe?', note: 'After it, what are his checks and captures?' },
  { rule: 'Look for a tactic.', note: 'Pin, fork, skewer, discovered attack.' },
  { rule: 'Trade with a reason.', note: 'Swap when ahead; never give a good piece for a bad one.' },
  { rule: 'Improve your worst piece.', note: 'No tactic? Upgrade the piece doing the least.' },
  { rule: 'Fight for the center and open files.', note: 'Pieces and rooks want open lines.' },
  { rule: 'Sit on your hands.', note: "Would you still play it after his best reply? Then move." },
];

function LessonCard({ lesson }) {
  const { getLessonProgress } = useProfile();
  const progress = getLessonProgress(lesson);
  const done = progress.status === 'complete';
  const started = !done && progress.completedStepIds.length > 0;

  return (
    <Link
      to={`/lesson/${lesson.id}`}
      className="tao-card tao-card-hover group flex min-h-[13rem] flex-col gap-3 p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-xl font-bold uppercase tracking-tight text-foreground group-hover:text-brand-600">{lesson.title}</h3>
        {done && <CheckCircle2 className="shrink-0 text-correct" size={20} aria-label="Completed" />}
      </div>
      {lesson.subtitle && <p className="text-sm font-semibold text-brand-600">{lesson.subtitle}</p>}
      {lesson.summary && <p className="text-sm leading-6 text-gray-600">{lesson.summary}</p>}
      <div className="mt-auto flex items-center gap-3 text-xs text-gray-500">
        {lesson.estMinutes != null && (
          <span className="inline-flex items-center gap-1">
            <Clock size={14} /> {lesson.estMinutes} min
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 font-semibold text-brand-600">
          {done ? 'Replay' : started ? 'Continue' : 'Start'} <ChevronRight size={14} />
        </span>
      </div>
    </Link>
  );
}

function ChecklistRow({ item, index }) {
  return (
    <li className="flex items-start gap-4 border-t border-gray-200 py-4">
      <span className="font-mono text-sm font-bold text-brand-500">{String(index + 1).padStart(2, '0')}</span>
      <div>
        <p className="font-display text-lg font-bold text-foreground">{item.rule}</p>
        <p className="mt-0.5 text-sm leading-6 text-gray-600">{item.note}</p>
      </div>
    </li>
  );
}

export default function TrainingPage() {
  const tracks = listTracks();

  return (
    <div className="bg-white">
      <section className="mx-auto max-w-6xl px-4 py-12">
        <p className="font-mono text-xs font-bold uppercase tracking-wide text-brand-600">Practical study path</p>
        <h1 className="mt-4 max-w-4xl font-display text-5xl font-extrabold uppercase leading-[1.05] tracking-tight text-foreground md:text-6xl">
          Quickest path to a{' '}
          <span className="font-book italic font-semibold normal-case tracking-normal text-brand-500">200 point gain.</span>
        </h1>
        <div className="gradient-divider mt-5 w-20" />
        <p className="mt-5 max-w-2xl text-lg leading-8 text-gray-700">
          Most rating jumps come from one thing: fewer blunders. Run this checklist before every move
          until it's automatic.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-10">
        <div className="tao-card max-w-3xl p-6 sm:p-8">
          <p className="font-mono text-xs font-bold uppercase tracking-wide text-brand-600">The pre-move checklist</p>
          <ol className="mt-4">
            {CHECKLIST.map((item, index) => (
              <ChecklistRow key={item.rule} item={item} index={index} />
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t-3 border-foreground bg-brand-50/40">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-wide text-brand-600">Practice lessons</p>
              <h2 className="mt-2 font-display text-3xl font-bold uppercase tracking-tight text-foreground">Train one idea at a time.</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-gray-600">
              The checklist gives the routine; the lessons make the habits playable.
            </p>
          </div>

          {tracks.map((track) => (
            <section key={track.id} className="mb-10">
              <h3 className="mb-4 font-display text-2xl font-bold uppercase tracking-tight text-foreground">{track.label}</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {track.lessons.map((lesson) => (
                  <LessonCard key={lesson.id} lesson={lesson} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
