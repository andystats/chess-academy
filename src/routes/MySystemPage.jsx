import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight, CircleDashed, Library, Play } from 'lucide-react';
import BoardPanel from '../components/BoardPanel.jsx';
import { getContent } from '../content/registry.js';
import { MY_SYSTEM_PARTS } from '../content/mySystem.js';

function chapterLesson(chapter) {
  if (!chapter.lessonId) return null;
  const lesson = getContent(chapter.lessonId);
  return lesson?.kind === 'lesson' ? lesson : null;
}

function firstBoard(lesson) {
  return lesson?.body?.steps?.find((step) => step.fen) ?? null;
}

function ChapterStudy({ chapter }) {
  const lesson = chapterLesson(chapter);
  const board = firstBoard(lesson);
  const playable = Boolean(lesson);

  return (
    <article className="grid gap-5 border-t border-gray-300 py-7 lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-start">
      <div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono text-xs font-semibold text-gray-500">{chapter.number}</span>
          <h3 className="font-book text-2xl font-semibold text-gray-950">{chapter.title}</h3>
          <span className="tao-badge border-gray-700 text-gray-600">
            {chapter.status === 'planned' ? 'planned' : chapter.status === 'linked' ? 'linked study' : 'playable'}
          </span>
        </div>
        <p className="mt-3 max-w-2xl text-base leading-7 text-gray-700">{chapter.summary}</p>
        {playable ? (
          <Link to={`/lesson/${lesson.id}`} className="tao-btn-primary mt-5">
            <Play size={17} /> Open study board <ChevronRight size={17} />
          </Link>
        ) : (
          <p className="mt-5 inline-flex min-h-touch items-center gap-2 border-3 border-gray-300 px-4 font-semibold text-gray-600">
            <CircleDashed size={17} /> Chapter study to draft
          </p>
        )}
      </div>

      {board && (
        <div className="w-44 max-w-full lg:justify-self-end">
          <BoardPanel
            fen={board.fen}
            orientation={board.orientation ?? 'white'}
            highlights={board.annotations?.highlight ?? []}
            arrows={board.annotations?.arrows ?? []}
            variant="book"
            className="w-full max-w-[11rem]"
          />
        </div>
      )}
    </article>
  );
}

export default function MySystemPage() {
  return (
    <div className="paper-texture min-h-screen border-t border-gray-200 bg-[#fbfaf4]">
      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="border border-gray-950 bg-white p-5 shadow-[6px_6px_0_#1a1a1a]">
            <p className="font-mono text-xs font-semibold uppercase text-gray-500">Study room</p>
            <h1 className="mt-3 font-book text-4xl font-semibold leading-tight text-gray-950">My System</h1>
            <p className="mt-3 text-sm leading-6 text-gray-700">
              A close, original walkthrough of Nimzowitsch's structure with playable boards for the core scenarios.
            </p>
            <nav className="mt-6 space-y-3 border-t border-gray-300 pt-5">
              {MY_SYSTEM_PARTS.map((part) => (
                <a key={part.id} href={`#${part.id}`} className="block text-sm font-semibold text-gray-700 hover:text-brand-600">
                  {part.title}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        <main className="min-w-0">
          <div className="border-b-4 border-double border-gray-950 pb-7">
            <div className="flex items-center gap-3">
              <BookOpen size={24} className="text-gray-950" />
              <p className="font-mono text-xs font-semibold uppercase text-gray-500">Retro chess-book edition</p>
            </div>
            <h2 className="mt-4 max-w-3xl font-book text-5xl font-semibold leading-tight text-gray-950">
              The classic system, rebuilt as a playable study path.
            </h2>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-700">
              The goal is full conceptual fidelity: the order, dependencies, and chess meaning stay intact.
              The prose is newly written for this tool, and each suitable idea receives a board study.
            </p>
          </div>

          {MY_SYSTEM_PARTS.map((part) => (
            <section key={part.id} id={part.id} className="scroll-mt-24 py-10">
              <div className="mb-3 flex items-center gap-3">
                <Library size={20} className="text-brand-600" />
                <h2 className="font-display text-2xl font-bold text-gray-950">{part.title}</h2>
              </div>
              <p className="mb-5 max-w-3xl text-base leading-7 text-gray-700">{part.summary}</p>
              <div>
                {part.chapters.map((chapter) => (
                  <ChapterStudy key={chapter.id} chapter={chapter} />
                ))}
              </div>
            </section>
          ))}
        </main>
      </section>
    </div>
  );
}
