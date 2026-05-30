import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronRight, Clock } from 'lucide-react';
import BoardPanel from '../components/BoardPanel.jsx';
import { listTracks } from '../content/registry.js';
import { useProfile } from '../profile/ProfileContext.jsx';

const SNACKS = [
  {
    id: 'checks-captures-threats',
    title: 'Checks, Captures, Threats',
    line: 'For every candidate move, scan forcing moves first: checks, captures, then threats for both sides.',
    fen: '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1',
    arrows: [['a1', 'a8', 'good']],
    highlights: ['a8', 'g8'],
    lessonId: 'habits/checks-captures-threats',
  },
  {
    id: 'to-take',
    title: 'To Take Is a Mistake',
    line: 'Do not capture just because you can. Ask what changes after the recapture, the tempo, and the next threat.',
    fen: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
    arrows: [['c6', 'b4', 'bad'], ['c6', 'e5', 'idea']],
    highlights: ['c6', 'e5'],
    lessonId: 'habits/checks-captures-threats',
  },
  {
    id: 'threats',
    title: 'Make Threats Count',
    line: 'A useful threat either wins time, forces a concession, or improves your worst piece while the opponent responds.',
    fen: 'rnbqkbnr/pppp1ppp/8/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR b KQkq - 2 2',
    arrows: [['f3', 'f7', 'bad'], ['g8', 'f6', 'good']],
    highlights: ['f7', 'f6'],
    lessonId: 'classics/prophylaxis',
  },
  {
    id: 'optimize',
    title: 'Optimize the Worst Piece',
    line: 'When no tactic is available, improve the piece with the least future. One quiet improvement often changes the whole board.',
    fen: 'r1bqk2r/pppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
    arrows: [['b1', 'c3', 'good']],
    highlights: ['b1', 'c3'],
    lessonId: 'habits/optimize-worst-piece',
  },
];

function LessonCard({ lesson }) {
  const { getLessonProgress } = useProfile();
  const progress = getLessonProgress(lesson);
  const done = progress.status === 'complete';
  const started = !done && progress.completedStepIds.length > 0;

  return (
    <Link
      to={`/lesson/${lesson.id}`}
      className="group flex min-h-[13rem] flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-xl font-bold text-gray-950 group-hover:text-brand-600">{lesson.title}</h3>
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

function SnackCard({ snack, index }) {
  return (
    <article className="grid gap-5 border-t border-gray-200 py-7 md:grid-cols-[minmax(0,1fr)_13rem] md:items-start">
      <div>
        <p className="font-mono text-xs font-semibold text-brand-600">{String(index + 1).padStart(2, '0')}</p>
        <h3 className="mt-2 font-display text-2xl font-bold text-gray-950">{snack.title}</h3>
        <p className="mt-3 max-w-2xl text-base leading-7 text-gray-700">{snack.line}</p>
        <Link
          to={`/lesson/${snack.lessonId}`}
          className="mt-5 inline-flex text-sm font-semibold text-brand-600 hover:text-gray-950"
        >
          Try the board study
        </Link>
      </div>
      <div className="w-52 max-w-full md:justify-self-end">
        <BoardPanel
          fen={snack.fen}
          highlights={snack.highlights}
          arrows={snack.arrows}
          variant="book"
          className="w-full max-w-[13rem]"
        />
      </div>
    </article>
  );
}

export default function TrainingPage() {
  const tracks = listTracks();

  return (
    <div className="bg-white">
      <section className="mx-auto max-w-6xl px-4 py-12">
        <p className="font-mono text-xs font-semibold uppercase text-brand-600">Practical study path</p>
        <h1 className="mt-4 max-w-4xl font-display text-5xl font-extrabold leading-tight text-gray-950 md:text-6xl">
          Quickest path to a 200 point gain.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-gray-700">
          Most rating jumps come from fewer blunders, better forcing-move vision, and cleaner piece improvement.
          These snacks are short enough to repeat before a game.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-10">
        {SNACKS.map((snack, index) => (
          <SnackCard key={snack.id} snack={snack} index={index} />
        ))}
      </section>

      <section className="border-t border-gray-200 bg-gray-50/60">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-xs font-semibold uppercase text-brand-600">Practice lessons</p>
              <h2 className="mt-2 font-display text-3xl font-bold text-gray-950">Train one idea at a time.</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-gray-600">
              The snacks give the route; the lessons make the habits playable.
            </p>
          </div>

          {tracks.map((track) => (
            <section key={track.id} className="mb-10">
              <h3 className="mb-4 font-display text-2xl font-bold text-gray-800">{track.label}</h3>
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
