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

  return (
    <article className="grid gap-5 border-t-3 border-foreground py-7 lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-start">
      <div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
          <span className="font-mono text-xs font-bold text-gray-500">{chapter.number}</span>
          <h3 className="font-book text-2xl font-semibold text-foreground">{chapter.title}</h3>
          <span className="tao-badge bg-white text-gray-600">
            {chapter.status === 'planned' ? 'planned' : chapter.status === 'linked' ? 'linked study' : 'playable'}
          </span>
        </div>
        <p className="mt-3 max-w-2xl text-base leading-7 text-gray-700">{chapter.summary}</p>
        {lesson ? (
          <Link to={`/lesson/${lesson.id}`} className="tao-btn-primary mt-5">
            <Play size={17} /> Open study board <ChevronRight size={17} />
          </Link>
        ) : (
          <p className="mt-5 inline-flex min-h-touch items-center gap-2 border-3 border-gray-300 bg-white px-4 font-semibold text-gray-600">
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
          <div className="tao-card p-5 shadow-hard-lg">
            <p className="font-mono text-xs font-bold uppercase tracking-wide text-brand-600">Study room</p>
            <h1 className="mt-3 font-book text-4xl font-semibold leading-tight text-foreground">My System</h1>
            <p className="mt-3 text-sm leading-6 text-gray-700">
              A chapter-by-chapter path through Nimzowitsch&apos;s classic strategic ideas, with playable
              boards wherever a focused study is ready.
            </p>
            <nav className="mt-6 space-y-3 border-t-3 border-foreground pt-5" aria-label="My System parts">
              {MY_SYSTEM_PARTS.map((part) => (
                <a key={part.id} href={`#${part.id}`} className="block text-sm font-semibold text-gray-700 hover:text-brand-600">
                  {part.title}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        <main className="min-w-0">
          <div className="border-b-4 border-double border-foreground pb-7">
            <div className="flex items-center gap-3">
              <BookOpen size={24} className="text-foreground" />
              <p className="font-mono text-xs font-bold uppercase tracking-wide text-brand-600">Playable chess book</p>
            </div>
            <h2 className="mt-4 max-w-3xl font-book text-5xl font-semibold leading-tight text-foreground">
              The classic system, rebuilt as a study path.
            </h2>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-gray-700">
              The chapter order and strategic ideas provide the map. All explanations here are newly
              written, and each ready concept opens into an interactive board lesson.
            </p>
          </div>

          {MY_SYSTEM_PARTS.map((part) => (
            <section key={part.id} id={part.id} className="scroll-mt-24 py-10">
              <div className="mb-3 flex items-center gap-3">
                <Library size={20} className="text-brand-600" />
                <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground">{part.title}</h2>
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
