import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight, Library, Play, Sparkles, Dumbbell, Trophy, Award } from 'lucide-react';
import BoardPanel from '../components/BoardPanel.jsx';
import { getContent } from '../content/registry.js';
import { MY_SYSTEM_PARTS } from '../content/mySystem.js';

function getChapterContent(chapter) {
  if (!chapter.lessonId) return null;
  return getContent(chapter.lessonId);
}

function getFirstBoard(content) {
  if (!content) return null;
  if (content.kind === 'bookChapter') {
    const sec = content.body?.sections?.[0];
    if (sec?.initialFen) {
      return {
        fen: sec.initialFen,
        orientation: sec.orientation ?? 'white',
        annotations: sec.annotations ?? {},
      };
    }
  }
  const step = content.body?.steps?.find((s) => s.fen);
  if (step) {
    return {
      fen: step.fen,
      orientation: step.orientation ?? 'white',
      annotations: step.annotations ?? {},
    };
  }
  return null;
}

function ChapterStudy({ chapter }) {
  const content = getChapterContent(chapter);
  const board = getFirstBoard(content);
  const hasDrills = content?.kind === 'bookChapter' && (content.body?.drills?.length ?? 0) > 0;
  const hasGames = content?.kind === 'bookChapter' && (content.body?.illustrativeGames?.length ?? 0) > 0;

  return (
    <article className="grid gap-6 border-t border-amber-200/80 py-8 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-start">
      <div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
          <span className="font-mono text-xs font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded">
            Chapter {chapter.number}
          </span>
          <h3 className="font-display text-2xl font-bold text-foreground">{chapter.title}</h3>
          {chapter.estMinutes && (
            <span className="font-mono text-xs text-gray-500">
              ~{chapter.estMinutes} min
            </span>
          )}
        </div>

        <p className="mt-3 max-w-2xl text-base leading-7 text-gray-700">{chapter.summary}</p>

        {chapter.aphorism && (
          <p className="mt-3 max-w-2xl text-sm italic text-amber-900 border-l-2 border-amber-400 pl-3">
            &ldquo;{chapter.aphorism}&rdquo;
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            to={`/lesson/${chapter.lessonId}`}
            className="tao-btn-primary"
          >
            <BookOpen size={16} /> Read Chapter <ChevronRight size={16} />
          </Link>

          {hasDrills && (
            <Link
              to={`/lesson/${chapter.lessonId}?mode=drills`}
              className="tao-btn-ghost"
            >
              <Dumbbell size={16} /> Practice Drills
            </Link>
          )}

          {hasGames && (
            <Link
              to={`/lesson/${chapter.lessonId}?mode=games`}
              className="tao-btn-ghost"
            >
              <Trophy size={16} /> Master Games
            </Link>
          )}
        </div>
      </div>

      {board && (
        <div className="w-48 max-w-full lg:justify-self-end">
          <BoardPanel
            fen={board.fen}
            orientation={board.orientation}
            highlights={board.annotations?.highlight ?? []}
            arrows={board.annotations?.arrows ?? []}
            variant="book"
            className="w-full max-w-[12rem] shadow-sm rounded border border-amber-200"
          />
        </div>
      )}
    </article>
  );
}

export default function MySystemPage() {
  return (
    <div className="paper-texture min-h-screen bg-[#fbfaf4]">
      {/* 100th Anniversary Hero Header */}
      <section className="border-b border-amber-200/90 bg-gradient-to-b from-amber-100/40 via-amber-50/20 to-transparent py-12 px-4">
        <div className="mx-auto max-w-6xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-amber-800 shadow-sm">
            <Sparkles size={15} className="text-amber-600" />
            <span>100th Anniversary Centenary Edition • 1925–2025</span>
          </div>

          <h1 className="mt-5 max-w-4xl font-display text-4xl font-extrabold uppercase tracking-tight text-foreground sm:text-6xl">
            My System: The Living Interactive Experience
          </h1>

          <p className="mt-4 max-w-3xl text-lg leading-8 text-gray-700">
            Aron Nimzowitsch&apos;s 1925 revolutionary masterpiece, reimagined for its centenary as a living,
            interactive study path. Read the foundational ideas, click moves directly in the text, test yourself in the
            Hypermodern Gym, and step through master games with modern Stockfish 17 insights.
          </p>

          {/* Featured Highlight: The Immortal Zugzwang Game */}
          <div className="mt-8 rounded-xl border border-amber-300 bg-white p-6 shadow-md lg:flex lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Award className="text-amber-600" size={20} />
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-amber-800">
                  Featured Master Study
                </span>
              </div>
              <h3 className="mt-2 font-display text-xl font-bold text-foreground">
                Sämisch vs. Nimzowitsch (Copenhagen, 1923) — The Immortal Zugzwang Game
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-600">
                Experience the game where an entire army of pieces was brought to complete, helpless paralysis with 25...h6!
              </p>
            </div>
            <Link
              to="/lesson/my-system/16-immortal-zugzwang-and-revolution"
              className="tao-btn-primary mt-4 lg:mt-0 shrink-0"
            >
              <Play size={16} /> Explore Case File <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* Main Parts Grid */}
      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-12 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="study-panel p-5 rounded-xl border border-amber-200/90 shadow-sm">
            <p className="font-mono text-xs font-bold uppercase tracking-wide text-amber-700">Table of Contents</p>
            <h2 className="mt-2 font-display text-xl font-bold text-foreground">My System</h2>
            <p className="mt-2 text-xs leading-5 text-gray-600">
              15 complete chapters + Part III case files covering all elements of positional mastery.
            </p>
            <nav className="mt-5 space-y-3 border-t border-amber-200/60 pt-4" aria-label="My System parts">
              {MY_SYSTEM_PARTS.map((part) => (
                <a
                  key={part.id}
                  href={`#${part.id}`}
                  className="block text-sm font-semibold text-gray-700 hover:text-brand-600 transition-colors"
                >
                  {part.title}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        <main className="min-w-0">
          {MY_SYSTEM_PARTS.map((part) => (
            <section key={part.id} id={part.id} className="scroll-mt-20 mb-14 last:mb-0">
              <div className="mb-4 flex items-center gap-3 border-b border-amber-200/90 pb-3">
                <Library size={22} className="text-amber-700" />
                <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground">
                  {part.title}
                </h2>
              </div>
              <p className="mb-6 max-w-3xl text-base leading-7 text-gray-700">{part.summary}</p>
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

