import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import {
  BookOpen,
  Dumbbell,
  Trophy,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Layers,
  Cpu,
  Bookmark,
  Share2,
  Menu,
  X,
  Volume2,
  VolumeX,
  Play,
  Pause,
  ScanSearch,
} from 'lucide-react';
import clsx from 'clsx';
import BoardPanel from '../BoardPanel.jsx';
import StepPanel from '../StepPanel.jsx';
import { useChessLesson } from '../../lesson/useChessLesson.js';
import { useProfile } from '../../profile/ProfileContext.jsx';
import { withStepComplete, withLessonComplete } from '../../profile/progress.js';
import StrategicBoardOverlays from './StrategicBoardOverlays.jsx';
import ClickableMove from './ClickableMove.jsx';
import InlineDiagram from './InlineDiagram.jsx';
import Markdown from '../Markdown.jsx';
import GlossaryLink from '../GlossaryLink.jsx';
import { MY_SYSTEM_PARTS } from '../../content/mySystem.js';

const renderTerm = ({ slug, display }) => <GlossaryLink slug={slug} display={display} />;

export default function MySystemReader({ chapter, initialMode = 'read' }) {
  const navigate = useNavigate();
  const { recordLessonProgress } = useProfile();

  const sections = useMemo(() => chapter?.body?.sections ?? [], [chapter]);
  const drills = useMemo(() => chapter?.body?.drills ?? [], [chapter]);
  const games = useMemo(() => chapter?.body?.illustrativeGames ?? [], [chapter]);

  const [activeMode, setActiveMode] = useState(initialMode); // 'read' | 'drills' | 'games'
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [activeGameIdx, setActiveGameIdx] = useState(0);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [showEngineLens, setShowEngineLens] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Strategic Overlays Toggle
  const [activeOverlays, setActiveOverlays] = useState({
    pawnChains: true,
    blockades: true,
    overprotection: true,
    outposts: true,
  });

  const activeSection = sections[activeSectionIdx] ?? sections[0] ?? null;
  const activeGame = games[activeGameIdx] ?? games[0] ?? null;

  // Board State for Reader Mode
  const [boardOrientation, setBoardOrientation] = useState(
    activeSection?.orientation ?? 'white'
  );
  const [currentFen, setCurrentFen] = useState(
    activeSection?.initialFen ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
  );
  const [currentMoveIdx, setCurrentMoveIdx] = useState(-1); // -1 = start of section/game
  const [activeHighlights, setActiveHighlights] = useState([]);
  const [activeArrows, setActiveArrows] = useState([]);

  // Compute game/section moves
  const moveList = useMemo(() => {
    if (activeMode === 'games' && activeGame) {
      return activeGame.moves ?? [];
    }
    return activeSection?.moves ?? [];
  }, [activeMode, activeGame, activeSection]);

  // Sync board position when section or mode changes
  useEffect(() => {
    if (activeMode === 'read' && activeSection) {
      setCurrentFen(activeSection.initialFen ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
      setBoardOrientation(activeSection.orientation ?? 'white');
      setActiveHighlights(activeSection.annotations?.highlight ?? []);
      setActiveArrows(activeSection.annotations?.arrows ?? []);
      setCurrentMoveIdx(-1);
    } else if (activeMode === 'games' && activeGame) {
      setCurrentFen(activeGame.initialFen ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
      setBoardOrientation('white');
      setActiveHighlights([]);
      setActiveArrows([]);
      setCurrentMoveIdx(-1);
    }
  }, [activeSection, activeGame, activeMode]);

  // Navigate moves forward / backward
  const goToMove = useCallback((targetIdx) => {
    const list = moveList;
    if (targetIdx < -1 || targetIdx >= list.length) return;

    if (targetIdx === -1) {
      const baseFen = (activeMode === 'games' ? activeGame?.initialFen : activeSection?.initialFen) ??
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      setCurrentFen(baseFen);
      setCurrentMoveIdx(-1);
      setActiveHighlights(activeSection?.annotations?.highlight ?? []);
      setActiveArrows(activeSection?.annotations?.arrows ?? []);
      return;
    }

    const startFen = (activeMode === 'games' ? activeGame?.initialFen : activeSection?.initialFen) ??
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const game = new Chess(startFen);

    for (let i = 0; i <= targetIdx; i++) {
      try {
        game.move(list[i].san);
      } catch (err) {
        console.error('Error playing move', list[i].san, err);
      }
    }

    const currentMove = list[targetIdx];
    const history = game.history({ verbose: true });
    const lastPlayed = history[history.length - 1];
    const moveArrows = currentMove?.annotations?.arrows ?? (lastPlayed ? [[lastPlayed.from, lastPlayed.to, 'good']] : []);
    const moveHighlights = currentMove?.annotations?.highlight ?? (lastPlayed ? [lastPlayed.from, lastPlayed.to] : []);

    setCurrentFen(game.fen());
    setCurrentMoveIdx(targetIdx);
    setActiveHighlights(moveHighlights);
    setActiveArrows(moveArrows);
  }, [moveList, activeMode, activeGame, activeSection]);

  const stepPrev = () => goToMove(currentMoveIdx - 1);
  const stepNext = () => goToMove(currentMoveIdx + 1);
  const resetBoard = () => goToMove(-1);
  const flipBoard = () => setBoardOrientation((o) => (o === 'white' ? 'black' : 'white'));

  // Drill / Workout Controller (wrapper around existing lesson engine)
  const drillEnvelope = useMemo(() => {
    if (!drills || drills.length === 0) return null;
    return {
      schemaVersion: 1,
      kind: 'lesson',
      id: chapter.id,
      title: `${chapter.title} — Practice Drills`,
      body: { steps: drills },
    };
  }, [chapter, drills]);

  const drillController = useChessLesson(drillEnvelope);

  // Record drill completion in profile
  useEffect(() => {
    if (!drillController || !drillController.canAdvance || !drillController.step?.id) return;
    recordLessonProgress(drillEnvelope, (progress, now) => {
      let next = withStepComplete(progress, drillController.step.id, now);
      if (drillController.isLastStep) next = withLessonComplete(next, now);
      return next;
    });
  }, [drillEnvelope, drillController, recordLessonProgress]);

  // Find all chapters in flat order for Next/Prev chapter navigation
  const allChapters = useMemo(() => {
    return MY_SYSTEM_PARTS.flatMap((p) => p.chapters);
  }, []);

  const currentChapterIdx = allChapters.findIndex((c) => c.id === chapter.id || c.lessonId === chapter.id);
  const prevChapter = currentChapterIdx > 0 ? allChapters[currentChapterIdx - 1] : null;
  const nextChapter = currentChapterIdx < allChapters.length - 1 ? allChapters[currentChapterIdx + 1] : null;

  return (
    <div className="min-h-screen bg-[#fbfaf4] text-gray-800 paper-texture">
      {/* 100th Anniversary Ribbon & Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-amber-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              to="/my-system"
              className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-brand-600 transition-colors"
            >
              <ChevronLeft size={18} />
              <span className="hidden sm:inline">My System</span>
            </Link>
            <span className="text-gray-300">/</span>
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded">
              Chapter {chapter.chapterNumber || 'I'}
            </span>
            <h1 className="hidden md:block max-w-xs truncate font-display text-sm font-bold text-foreground">
              {chapter.title}
            </h1>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-100/80 p-1">
            <button
              type="button"
              onClick={() => setActiveMode('read')}
              className={clsx(
                'flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-all',
                activeMode === 'read'
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-gray-600 hover:text-foreground'
              )}
            >
              <BookOpen size={14} />
              <span>Read</span>
            </button>

            {drills.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveMode('drills')}
                className={clsx(
                  'flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-all',
                  activeMode === 'drills'
                    ? 'bg-white text-foreground shadow-sm'
                    : 'text-gray-600 hover:text-foreground'
                )}
              >
                <Dumbbell size={14} />
                <span>Gym ({drills.length})</span>
              </button>
            )}

            {games.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveMode('games')}
                className={clsx(
                  'flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-all',
                  activeMode === 'games'
                    ? 'bg-white text-foreground shadow-sm'
                    : 'text-gray-600 hover:text-foreground'
                )}
              >
                <Trophy size={14} />
                <span>Master Games ({games.length})</span>
              </button>
            )}
          </div>

          {/* Table of Contents Toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsTocOpen(!isTocOpen)}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-sm"
              title="Table of Contents"
            >
              <Menu size={16} />
              <span className="hidden sm:inline">Contents</span>
            </button>
          </div>
        </div>
      </header>

      {/* Table of Contents Drawer */}
      {isTocOpen && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/40 backdrop-blur-sm">
          <aside className="h-full w-80 overflow-y-auto bg-white p-6 shadow-2xl border-l border-gray-200">
            <div className="flex items-center justify-between border-b pb-4">
              <h3 className="font-display text-lg font-bold text-foreground">Table of Contents</h3>
              <button
                type="button"
                onClick={() => setIsTocOpen(false)}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-6 space-y-6">
              {MY_SYSTEM_PARTS.map((part) => (
                <div key={part.id}>
                  <p className="font-mono text-xs font-bold uppercase tracking-wider text-amber-700">{part.title}</p>
                  <ul className="mt-2 space-y-1.5 border-l-2 border-amber-100 pl-3">
                    {part.chapters.map((ch) => (
                      <li key={ch.id}>
                        <Link
                          to={ch.lessonId ? `/lesson/${ch.lessonId}` : `/my-system`}
                          onClick={() => setIsTocOpen(false)}
                          className={clsx(
                            'block text-sm transition-colors',
                            ch.id === chapter.id || ch.lessonId === chapter.id
                              ? 'font-bold text-brand-600'
                              : 'text-gray-700 hover:text-brand-600'
                          )}
                        >
                          <span className="font-mono text-xs text-gray-400 mr-2">{ch.number}</span>
                          {ch.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}

      {/* Mode 1: READTHROUGH MODE (The Living Book) */}
      {activeMode === 'read' && (
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start">
            
            {/* Left Column: Narrative Prose */}
            <article className="min-w-0">
              {/* Centenary Header & Aphorism */}
              <div className="border-b border-amber-200/90 pb-8">
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                  <Sparkles size={14} className="text-amber-600" />
                  <span>100th Anniversary Centenary Edition • 1925–2025</span>
                </div>
                <h2 className="mt-4 font-display text-4xl font-extrabold uppercase tracking-tight text-foreground sm:text-5xl">
                  {chapter.title}
                </h2>
                {chapter.subtitle && (
                  <p className="mt-2 font-book italic text-xl text-gray-600">
                    {chapter.subtitle}
                  </p>
                )}

                {/* Nimzowitsch's Aphorism */}
                {(chapter.aphorism || chapter.body?.aphorism) && (
                  <blockquote className="mt-6 rounded-lg border-l-4 border-amber-500 bg-amber-50/70 p-4 text-base italic text-amber-950 shadow-inner">
                    &ldquo;{chapter.aphorism || chapter.body?.aphorism}&rdquo;
                    <footer className="mt-2 text-xs font-semibold not-italic uppercase tracking-wider text-amber-700">
                      — Aron Nimzowitsch
                    </footer>
                  </blockquote>
                )}
              </div>

              {/* Chapter Section Navigation Pills */}
              <div className="my-6 flex flex-wrap gap-2">
                {sections.map((sec, idx) => (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setActiveSectionIdx(idx)}
                    className={clsx(
                      'rounded-md px-3 py-1.5 text-xs font-semibold transition-all',
                      activeSectionIdx === idx
                        ? 'bg-foreground text-white shadow-sm'
                        : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    )}
                  >
                    § {idx + 1}. {sec.title}
                  </button>
                ))}
              </div>

              {/* Active Section Content */}
              {activeSection && (
                <div className="mt-6 rounded-xl border border-gray-200/80 bg-white p-6 sm:p-8 shadow-sm">
                  <div className="flex items-center justify-between border-b pb-4 mb-6">
                    <h3 className="font-display text-2xl font-bold text-foreground">
                      § {activeSectionIdx + 1}. {activeSection.title}
                    </h3>
                    {activeSection.initialFen && (
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentFen(activeSection.initialFen);
                          setCurrentMoveIdx(-1);
                          setActiveHighlights(activeSection.annotations?.highlight ?? []);
                          setActiveArrows(activeSection.annotations?.arrows ?? []);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-800"
                        title="Reset board to section start"
                      >
                        <RotateCcw size={14} /> Reset Board
                      </button>
                    )}
                  </div>

                  <Markdown
                    className="prose max-w-none text-lg leading-8 text-gray-700"
                    renderTerm={renderTerm}
                  >
                    {activeSection.markdown}
                  </Markdown>

                  {/* Clickable Moves Strip (if moves exist in section) */}
                  {activeSection.moves && activeSection.moves.length > 0 && (
                    <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                      <p className="font-mono text-xs font-bold uppercase tracking-wider text-amber-800 mb-2">
                        Interactive Variation (Click any move to play):
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => goToMove(-1)}
                          className={clsx(
                            'rounded px-2 py-0.5 text-xs font-mono font-semibold',
                            currentMoveIdx === -1
                              ? 'bg-brand-600 text-white'
                              : 'bg-white text-gray-700 hover:bg-gray-100'
                          )}
                        >
                          Start
                        </button>
                        {activeSection.moves.map((m, mIdx) => (
                          <ClickableMove
                            key={`move-${mIdx}`}
                            san={m.san}
                            ply={mIdx + 1}
                            comment={m.comment}
                            isActive={currentMoveIdx === mIdx}
                            onClick={() => goToMove(mIdx)}
                          />
                        ))}
                      </div>
                      {currentMoveIdx >= 0 && activeSection.moves[currentMoveIdx]?.comment && (
                        <p className="mt-3 text-sm italic text-gray-700 bg-white/80 p-2.5 rounded border border-amber-200/60">
                          {activeSection.moves[currentMoveIdx].comment}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Centenary Engine Lens Callout */}
                  {activeSection.engineLens && (
                    <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50/60 p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Cpu size={18} className="text-blue-600" />
                          <h4 className="font-display text-sm font-bold uppercase tracking-wider text-blue-900">
                            Centennial Computer Lens (Stockfish 17)
                          </h4>
                        </div>
                        {activeSection.engineLens.eval && (
                          <span className="font-mono text-xs font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                            Eval: {activeSection.engineLens.eval}
                          </span>
                        )}
                      </div>
                      {activeSection.engineLens.takeaway && (
                        <p className="mt-2 text-sm leading-6 text-blue-950">
                          {activeSection.engineLens.takeaway}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Section Bottom Next/Prev buttons */}
                  <div className="mt-8 flex items-center justify-between border-t pt-6">
                    <button
                      type="button"
                      disabled={activeSectionIdx === 0}
                      onClick={() => setActiveSectionIdx((i) => i - 1)}
                      className="tao-btn-ghost text-xs"
                    >
                      <ChevronLeft size={16} /> Previous Section
                    </button>

                    {activeSectionIdx < sections.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => setActiveSectionIdx((i) => i + 1)}
                        className="tao-btn-primary text-xs"
                      >
                        Next Section <ChevronRight size={16} />
                      </button>
                    ) : drills.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setActiveMode('drills')}
                        className="tao-btn-primary text-xs"
                      >
                        Enter Chapter Gym <Dumbbell size={16} />
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
            </article>

            {/* Right Column: Sticky Live Chessboard */}
            <aside className="lg:sticky lg:top-20 lg:self-start">
              <div className="rounded-xl border border-gray-300 bg-white p-5 shadow-md">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <h3 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
                      Living Chessboard
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={flipBoard}
                      className="rounded border border-gray-200 bg-gray-50 p-1.5 text-xs text-gray-600 hover:bg-gray-100"
                      title="Flip board orientation"
                    >
                      Flip
                    </button>
                    <button
                      type="button"
                      onClick={resetBoard}
                      className="rounded border border-gray-200 bg-gray-50 p-1.5 text-xs text-gray-600 hover:bg-gray-100"
                      title="Reset to initial position"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                </div>

                {/* Chessboard with Strategic Overlays */}
                <div className="relative mt-4 mx-auto w-full max-w-[28rem]">
                  <BoardPanel
                    fen={currentFen}
                    orientation={boardOrientation}
                    highlights={activeHighlights}
                    arrows={activeArrows}
                    variant="book"
                    className="w-full"
                  />
                  <StrategicBoardOverlays
                    overlays={activeSection?.strategicOverlays ?? {}}
                    orientation={boardOrientation}
                    activeOverlays={activeOverlays}
                  />
                </div>

                {/* Move Step Controller */}
                {moveList.length > 0 && (
                  <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => goToMove(-1)}
                        disabled={currentMoveIdx === -1}
                        className="rounded border p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                        title="Start of line"
                      >
                        ⏮
                      </button>
                      <button
                        type="button"
                        onClick={stepPrev}
                        disabled={currentMoveIdx === -1}
                        className="rounded border p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                        title="Previous move"
                      >
                        ◀
                      </button>
                      <button
                        type="button"
                        onClick={stepNext}
                        disabled={currentMoveIdx >= moveList.length - 1}
                        className="rounded border p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                        title="Next move"
                      >
                        ▶
                      </button>
                      <button
                        type="button"
                        onClick={() => goToMove(moveList.length - 1)}
                        disabled={currentMoveIdx >= moveList.length - 1}
                        className="rounded border p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                        title="End of line"
                      >
                        ⏭
                      </button>
                    </div>

                    <span className="font-mono text-xs font-semibold text-gray-600">
                      Move {currentMoveIdx + 1} / {moveList.length}
                    </span>
                  </div>
                )}

                {/* Strategic Visual Overlay Filter Pills */}
                {activeSection?.strategicOverlays && Object.keys(activeSection.strategicOverlays).length > 0 && (
                  <div className="mt-4 border-t border-gray-100 pt-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-2">
                      <Layers size={14} /> Hypermodern Layers:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {activeSection.strategicOverlays.pawnChains && (
                        <button
                          type="button"
                          onClick={() =>
                            setActiveOverlays((prev) => ({ ...prev, pawnChains: !prev.pawnChains }))
                          }
                          className={clsx(
                            'rounded px-2 py-0.5 text-[0.7rem] font-bold uppercase transition-all',
                            activeOverlays.pawnChains
                              ? 'bg-amber-500 text-white'
                              : 'bg-gray-100 text-gray-400'
                          )}
                        >
                          Pawn Chains
                        </button>
                      )}
                      {activeSection.strategicOverlays.blockades && (
                        <button
                          type="button"
                          onClick={() =>
                            setActiveOverlays((prev) => ({ ...prev, blockades: !prev.blockades }))
                          }
                          className={clsx(
                            'rounded px-2 py-0.5 text-[0.7rem] font-bold uppercase transition-all',
                            activeOverlays.blockades
                              ? 'bg-emerald-600 text-white'
                              : 'bg-gray-100 text-gray-400'
                          )}
                        >
                          Blockades
                        </button>
                      )}
                      {activeSection.strategicOverlays.overprotection && (
                        <button
                          type="button"
                          onClick={() =>
                            setActiveOverlays((prev) => ({
                              ...prev,
                              overprotection: !prev.overprotection,
                            }))
                          }
                          className={clsx(
                            'rounded px-2 py-0.5 text-[0.7rem] font-bold uppercase transition-all',
                            activeOverlays.overprotection
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-400'
                          )}
                        >
                          Overprotection
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Deep Analysis in Engine X-Ray link */}
                <div className="mt-5 border-t border-gray-100 pt-3">
                  <Link
                    to={`/study/engine-xray?fen=${encodeURIComponent(currentFen)}&orientation=${boardOrientation}&title=${encodeURIComponent(chapter.title)}`}
                    className="tao-btn-ghost w-full justify-center text-xs"
                  >
                    <ScanSearch size={15} /> Analyze in Engine X-Ray
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}

      {/* Mode 2: HYPERMODERN GYM / DRILLS MODE */}
      {activeMode === 'drills' && drillController && (
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="mb-6 flex items-center justify-between border-b pb-4">
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-amber-700">The Hypermodern Gym</p>
              <h2 className="font-display text-3xl font-bold text-foreground">{chapter.title} Drills</h2>
            </div>
            <button
              type="button"
              onClick={() => setActiveMode('read')}
              className="tao-btn-ghost text-xs"
            >
              <BookOpen size={16} /> Back to Reading
            </button>
          </div>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start">
            <div className="w-full max-w-[34rem]">
              <BoardPanel
                variant="book"
                fen={drillController.fen}
                orientation={drillController.orientation}
                arePiecesDraggable={drillController.arePiecesDraggable}
                onPieceDrop={drillController.onPieceDrop}
                onPromotionPieceSelect={drillController.onPromotionPieceSelect}
                onSquareClick={drillController.onSquareClick}
                promotionTarget={drillController.promotionTarget}
                arrows={drillController.arrows}
                highlights={drillController.highlights}
                selectedSquare={drillController.selectedSquare}
                legalTargets={drillController.legalTargets}
                className="w-full"
              />
            </div>
            <StepPanel lesson={drillController} chapterTitle={chapter.title} />
          </div>
        </div>
      )}

      {/* Mode 3: MASTER CASE FILES (Illustrative Games) */}
      {activeMode === 'games' && games.length > 0 && (
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="mb-6 flex items-center justify-between border-b pb-4">
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-amber-700">Part III Master Case Files</p>
              <h2 className="font-display text-3xl font-bold text-foreground">
                {activeGame.white} vs {activeGame.black} ({activeGame.year})
              </h2>
              <p className="text-sm text-gray-600 mt-1">{activeGame.event} • Result: {activeGame.result}</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveMode('read')}
              className="tao-btn-ghost text-xs"
            >
              <BookOpen size={16} /> Back to Reading
            </button>
          </div>

          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start">
            {/* Game Commentary Column */}
            <div>
              {activeGame.summary && (
                <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50/70 p-4 text-sm leading-6 text-amber-950">
                  {activeGame.summary}
                </div>
              )}

              {/* Move-by-move score sheet */}
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="font-display text-lg font-bold text-foreground mb-4">Annotated Move List</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {activeGame.moves.map((m, mIdx) => (
                    <button
                      key={`gmove-${mIdx}`}
                      type="button"
                      onClick={() => goToMove(mIdx)}
                      className={clsx(
                        'flex items-center justify-between rounded px-2.5 py-1.5 font-mono text-xs transition-all',
                        currentMoveIdx === mIdx
                          ? 'bg-brand-600 text-white font-bold'
                          : 'bg-gray-50 text-gray-800 hover:bg-amber-100/70'
                      )}
                    >
                      <span className="opacity-60">{Math.ceil(m.ply / 2)}{m.ply % 2 === 1 ? '.' : '...'}</span>
                      <span>{m.san}</span>
                    </button>
                  ))}
                </div>

                {/* Active Move Commentary */}
                {currentMoveIdx >= 0 && activeGame.moves[currentMoveIdx]?.comment && (
                  <div className="mt-6 rounded-lg border-l-4 border-brand-500 bg-brand-50/60 p-4 text-base text-gray-800">
                    <p className="font-mono text-xs font-bold text-brand-700 uppercase mb-1">
                      After {Math.ceil(activeGame.moves[currentMoveIdx].ply / 2)}{activeGame.moves[currentMoveIdx].ply % 2 === 1 ? '.' : '...'}{activeGame.moves[currentMoveIdx].san}:
                    </p>
                    <p className="leading-7">{activeGame.moves[currentMoveIdx].comment}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Board Column */}
            <aside className="lg:sticky lg:top-20 lg:self-start">
              <div className="rounded-xl border border-gray-300 bg-white p-5 shadow-md">
                <div className="relative mx-auto w-full max-w-[28rem]">
                  <BoardPanel
                    fen={currentFen}
                    orientation={boardOrientation}
                    highlights={activeHighlights}
                    arrows={activeArrows}
                    variant="book"
                    className="w-full"
                  />
                </div>

                {/* Move Controls */}
                <div className="mt-4 flex items-center justify-between border-t pt-3">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => goToMove(-1)}
                      disabled={currentMoveIdx === -1}
                      className="rounded border p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                    >
                      ⏮
                    </button>
                    <button
                      type="button"
                      onClick={stepPrev}
                      disabled={currentMoveIdx === -1}
                      className="rounded border p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                    >
                      ◀
                    </button>
                    <button
                      type="button"
                      onClick={stepNext}
                      disabled={currentMoveIdx >= activeGame.moves.length - 1}
                      className="rounded border p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                    >
                      ▶
                    </button>
                    <button
                      type="button"
                      onClick={() => goToMove(activeGame.moves.length - 1)}
                      disabled={currentMoveIdx >= activeGame.moves.length - 1}
                      className="rounded border p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                    >
                      ⏭
                    </button>
                  </div>
                  <span className="font-mono text-xs font-semibold text-gray-600">
                    Ply {currentMoveIdx + 1} / {activeGame.moves.length}
                  </span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}

      {/* Chapter Footer Navigation */}
      <footer className="border-t border-amber-200/90 bg-white py-10 mt-16">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6">
          {prevChapter ? (
            <Link
              to={prevChapter.lessonId ? `/lesson/${prevChapter.lessonId}` : `/my-system`}
              className="tao-btn-ghost text-xs"
            >
              <ChevronLeft size={16} /> Chapter {prevChapter.number}: {prevChapter.title}
            </Link>
          ) : (
            <div />
          )}

          {nextChapter && (
            <Link
              to={nextChapter.lessonId ? `/lesson/${nextChapter.lessonId}` : `/my-system`}
              className="tao-btn-primary text-xs"
            >
              Chapter {nextChapter.number}: {nextChapter.title} <ChevronRight size={16} />
            </Link>
          )}
        </div>
      </footer>
    </div>
  );
}
