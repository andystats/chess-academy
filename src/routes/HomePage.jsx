import { Link } from 'react-router-dom';
import { Clock, ChevronRight, CheckCircle2 } from 'lucide-react';
import { listTracks } from '../content/registry.js';
import { useProfile } from '../profile/ProfileContext.jsx';

function LessonCard({ lesson }) {
  const { getLessonProgress } = useProfile();
  const progress = getLessonProgress(lesson);
  const done = progress.status === 'complete';
  const started = !done && progress.completedStepIds.length > 0;

  return (
    <Link
      to={`/lesson/${lesson.id}`}
      className="group flex flex-col gap-2 rounded-2xl border-2 border-gray-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-xl font-bold text-gray-900 group-hover:text-brand-700">{lesson.title}</h3>
        {done && <CheckCircle2 className="shrink-0 text-correct" size={20} aria-label="Completed" />}
      </div>
      {lesson.subtitle && <p className="text-sm font-semibold text-brand-600">{lesson.subtitle}</p>}
      {lesson.summary && <p className="text-sm text-gray-600">{lesson.summary}</p>}
      <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
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

export default function HomePage() {
  const tracks = listTracks();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <section className="mb-10">
        <h1 className="font-display text-4xl font-bold text-gray-900">Learn chess, one idea at a time.</h1>
        <p className="mt-2 max-w-2xl text-lg text-gray-600">
          Short, friendly lessons on a real board. Drag a piece — or tap it — and learn the ideas
          the best players use.
        </p>
      </section>

      {tracks.map((track) => (
        <section key={track.id} className="mb-10">
          <h2 className="mb-4 font-display text-2xl font-bold text-gray-800">{track.label}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {track.lessons.map((lesson) => (
              <LessonCard key={lesson.id} lesson={lesson} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
