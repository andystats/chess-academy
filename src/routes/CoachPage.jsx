import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Link, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Eye,
  EyeOff,
  Flag,
  Lightbulb,
  Loader2,
  MessageSquare,
  Play,
  RefreshCw,
  RotateCcw,
  ScanSearch,
  ShieldAlert,
  SlidersHorizontal,
  Swords,
  Target,
  Undo2,
  Users,
} from 'lucide-react';
import BoardPanel from '../components/BoardPanel.jsx';
import NimzoCoach from '../components/NimzoCoach.jsx';
import { MoveList, pairMoves, CapturedPieces } from '../components/gamePanelParts.jsx';
import { ENGINE_XRAY_POSITIONS } from '../content/engineXrayPositions.js';
import { useEngineGame } from '../engine/useEngineGame.js';
import { useStockfishAnalysis } from '../engine/useStockfishAnalysis.js';
import { ENGINE_MAX_LEVEL, ENGINE_MIN_LEVEL, levelConfig } from '../engine/levels.js';
import { playPvPrefix } from '../engine/xrayLearning.js';
import { START_FEN } from '../lesson/moves.js';
import { buildCoachingBrief, evaluateLastMove } from '../coach/index.js';

const COACH_PRESETS = [
  {
    id: 'standard-start',
    title: 'Standard Starting Position',
    eyebrow: 'Full Game',
    fen: START_FEN,
    orientation: 'white',
    recommendedDepth: 11,
    coachCardId: 'center-and-development',
  },
  {
    id: 'threat-on-b7',
    title: 'Neutralize the Threat on b7',
    eyebrow: 'King Safety & Tactics',
    // Black's b7 pawn is undefended and attacked by White's queen on b3; defending or counter-attacking resolves the threat
    fen: 'r2qk2r/pppp1ppp/2n1bn2/2b1p3/4P3/1Q6/PPPPBPPP/RNB1K1NR b KQkq - 3 5',
    orientation: 'black',
    recommendedDepth: 11,
    coachCardId: 'prophylaxis',
  },
  ...ENGINE_XRAY_POSITIONS,
];

const COACH_TABS = [
  { id: 'idea', label: 'Main Idea', icon: BrainCircuit },
  { id: 'moves', label: 'Key Best Moves', icon: Cpu },
  { id: 'state', label: 'State of the Board', icon: ScanSearch },
  { id: 'chat', label: 'Ask Coach', icon: MessageSquare },
];

const FACTORS = [
  ['Material', 'material'],
  ['Imbalance', 'imbalance'],
  ['Pawns', 'pawns'],
  ['Mobility', 'mobility'],
  ['King safety', 'kingSafety'],
  ['Threats', 'threats'],
  ['Passed pawns', 'passedPawns'],
  ['Space', 'space'],
];

function initialPresetFrom(searchParams) {
  const fen = searchParams.get('fen');
  if (fen) {
    try {
      new Chess(fen);
      const orientation = searchParams.get('orientation') === 'black' ? 'black' : 'white';
      return {
        id: 'custom-url-position',
        title: searchParams.get('title') || 'Custom Study Position',
        eyebrow: 'Loaded Position',
        fen,
        orientation,
        recommendedDepth: 11,
        coachCardId: searchParams.get('coach') || null,
      };
    } catch {
      // Fall back to default preset if URL FEN is invalid
    }
  }
  return COACH_PRESETS[0];
}

function EvalMeter({ label, phase, value }) {
  const magnitude = Math.min(50, Math.abs(value ?? 0) * 12.5);
  const favorable = (value ?? 0) >= 0;
  const readable = value == null ? 'unavailable' : `${value >= 0 ? '+' : ''}${value.toFixed(2)} pawns`;

  return (
    <div className="grid grid-cols-[2rem_minmax(0,1fr)_3.5rem] items-center gap-2">
      <span className="font-mono text-[0.62rem] font-bold uppercase text-gray-500">{phase}</span>
      <div
        className="relative h-2 overflow-hidden border border-gray-300 bg-gray-100"
        role="meter"
        aria-label={`${label}, ${phase}: ${readable}`}
        aria-valuemin="-4"
        aria-valuemax="4"
        aria-valuenow={value ?? 0}
      >
        <span className="absolute inset-y-0 left-1/2 w-px bg-gray-500" />
        {value != null && (
          <span
            className={`absolute inset-y-0 transition-all duration-300 ${favorable ? 'left-1/2 bg-brand-400' : 'right-1/2 bg-accent-orange'}`}
            style={{ width: `${magnitude}%` }}
          />
        )}
      </div>
      <span className="text-right font-mono text-[0.65rem] font-bold text-gray-600">
        {value == null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}`}
      </span>
    </div>
  );
}

/**
 * Permanent, fixed-height (`h-20`) move feedback slot below the board so playing a move never
 * mounts/unmounts a box or shifts the board layout.
 */
function LastMoveBanner({ review, takenBackReview, onTakeBack, canTakeBack }) {
  const styles = {
    idle: 'border-gray-300 bg-white text-gray-700',
    best: 'border-correct bg-green-50 text-green-900',
    good: 'border-brand-400 bg-brand-50 text-gray-800',
    inaccuracy: 'border-amber-500 bg-amber-50 text-amber-950',
    mistake: 'border-accent-orange bg-orange-50 text-orange-950',
    blunder: 'border-red-700 bg-red-50 text-red-950',
  };

  if (!review && takenBackReview) {
    return (
      <section
        className={clsx(
          'flex h-20 w-full min-w-0 flex-col justify-center overflow-y-auto overscroll-contain border-2 px-3.5 py-2 transition-colors duration-200 [scrollbar-gutter:stable]',
          styles[takenBackReview.tone] ?? styles.idle,
        )}
        aria-label="Last move feedback"
      >
        <div className="flex min-w-0 items-center gap-2">
          <Undo2 size={15} className="shrink-0 text-brand-600" aria-hidden="true" />
          <span className="truncate font-mono text-[0.68rem] font-bold uppercase tracking-wide">
            Took back {takenBackReview.moveSan} ({takenBackReview.badge}) · Try a stronger continuation
          </span>
        </div>
        <p className="mt-1 break-words text-xs leading-5">{takenBackReview.summary}</p>
      </section>
    );
  }

  if (!review) {
    return (
      <section
        className={clsx(
          'flex h-20 w-full min-w-0 flex-col justify-center overflow-y-auto overscroll-contain border px-3.5 py-2 transition-colors duration-200 [scrollbar-gutter:stable]',
          styles.idle,
        )}
        aria-label="Last move feedback"
      >
        <div className="flex min-w-0 items-center gap-2">
          <CheckCircle2 size={15} className="shrink-0 text-brand-500" aria-hidden="true" />
          <span className="font-mono text-[0.68rem] font-bold uppercase tracking-wide text-gray-600">
            Move Feedback · Ready
          </span>
        </div>
        <p className="mt-1 break-words text-xs leading-5 text-gray-600">
          Play a move on the board (or click a candidate move) to see real-time grading and tactical feedback here.
        </p>
      </section>
    );
  }

  const isSuboptimal =
    review.verdict === 'inaccuracy' || review.verdict === 'mistake' || review.verdict === 'blunder';

  return (
    <section
      className={clsx(
        'flex h-20 w-full min-w-0 flex-col justify-center overflow-y-auto overscroll-contain border-2 px-3.5 py-2 transition-colors duration-200 [scrollbar-gutter:stable]',
        styles[review.tone] ?? styles.good,
      )}
      aria-label="Last move feedback"
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {isSuboptimal ? (
            <AlertTriangle size={15} className="shrink-0 text-amber-700" aria-hidden="true" />
          ) : (
            <CheckCircle2 size={15} className="shrink-0 text-correct" aria-hidden="true" />
          )}
          <span className="truncate font-mono text-[0.68rem] font-bold uppercase tracking-wide">
            {review.moverLabel} played {review.moveSan} · {review.badge}
          </span>
        </div>
        {isSuboptimal && canTakeBack && (
          <button
            type="button"
            onClick={onTakeBack}
            className="inline-flex shrink-0 items-center gap-1 border border-current bg-white px-2 py-0.5 font-mono text-[0.62rem] font-bold uppercase hover:bg-gray-100"
          >
            <Undo2 size={11} aria-hidden="true" /> Take back &amp; try again
          </button>
        )}
      </div>
      <p className="mt-1 break-words text-xs leading-5">{review.summary}</p>
    </section>
  );
}

function ThoughtIcon({ kind }) {
  if (kind === 'urgent') return <ShieldAlert size={16} className="mt-0.5 shrink-0 text-red-600" aria-hidden="true" />;
  if (kind === 'warning') return <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />;
  if (kind === 'opportunity') return <Target size={16} className="mt-0.5 shrink-0 text-correct" aria-hidden="true" />;
  return <Lightbulb size={16} className="mt-0.5 shrink-0 text-brand-500" aria-hidden="true" />;
}

export default function CoachPage() {
  const [searchParams] = useSearchParams();
  const customPreset = useMemo(() => initialPresetFrom(searchParams), [searchParams]);

  const presets = useMemo(() => {
    if (customPreset.id === 'custom-url-position') {
      return [customPreset, ...COACH_PRESETS];
    }
    return COACH_PRESETS;
  }, [customPreset]);

  const [selectedPresetId, setSelectedPresetId] = useState(() => customPreset.id);
  const activePreset = presets.find((p) => p.id === selectedPresetId) ?? presets[0];

  // Play mode: 'both' (sandbox/two-sided), 'white' (vs engine as White), 'black' (vs engine as Black)
  const [playMode, setPlayMode] = useState(() => {
    const sideParam = searchParams.get('side');
    if (sideParam === 'white' || sideParam === 'black' || sideParam === 'both') return sideParam;
    return activePreset.id === 'standard-start' ? 'white' : 'both';
  });
  const [skillLevel, setSkillLevel] = useState(4);
  // Coaching mode: 'live' (always show optimal moves & why) vs 'guided' (warn on threats, hide best move until asked)
  const [coachingMode, setCoachingMode] = useState('live');
  const [guidedRevealed, setGuidedRevealed] = useState(false);
  const [showArrows, setShowArrows] = useState(true);
  const [customFenInput, setCustomFenInput] = useState('');
  const [customFenError, setCustomFenError] = useState(null);
  const [activeFenRoot, setActiveFenRoot] = useState(activePreset.fen);
  const [selectedRank, setSelectedRank] = useState(1);
  const [pvPly, setPvPly] = useState(0);
  const [pickedMoveUci, setPickedMoveUci] = useState('');
  const [activeTab, setActiveTab] = useState('idea');
  const tabRefs = useRef({});
  const fenDetailsRef = useRef(null);

  const game = useEngineGame({
    fen: activeFenRoot,
    playerSide: playMode,
    skillLevel,
  });

  const learnerPerspective = useMemo(() => {
    if (playMode === 'white' || playMode === 'black') return playMode;
    try {
      return new Chess(game.fen).turn() === 'b' ? 'black' : 'white';
    } catch {
      return 'white';
    }
  }, [playMode, game.fen]);

  const strengthConfig = levelConfig(skillLevel);
  const coachTargetDepth = useMemo(() => {
    const presetDepth = activePreset.recommendedDepth ?? 15;
    const oppDepth = strengthConfig.search.depth ?? 11;
    return Math.max(presetDepth, oppDepth + 4, 15);
  }, [activePreset.recommendedDepth, strengthConfig.search.depth]);

  const analysis = useStockfishAnalysis({
    fen: game.fen,
    learnerSide: learnerPerspective,
    depth: coachTargetDepth,
    enabled: game.status !== 'over',
  });

  // Stabilize progressive engine snapshots so shallow depths (1-5) don't cause rapid text flicker
  const settledAnalysisRef = useRef(analysis);
  const stabilizedAnalysis = useMemo(() => {
    const latestDepth = analysis?.depthSnapshots?.at?.(-1)?.depth ?? 0;
    if (
      analysis?.status === 'complete' ||
      analysis?.status === 'error' ||
      latestDepth >= 6 ||
      settledAnalysisRef.current?.fen !== analysis?.fen
    ) {
      if (latestDepth >= 6 || analysis?.status === 'complete' || analysis?.status === 'error') {
        settledAnalysisRef.current = analysis;
        return analysis;
      }
      // If we switched to a new FEN and only have shallow depth so far, use the first available snapshot
      // rather than re-rendering on every intermediate depth 1..5
      if (settledAnalysisRef.current?.fen !== analysis?.fen && latestDepth <= 2) {
        settledAnalysisRef.current = analysis;
      }
    }
    return settledAnalysisRef.current?.fen === game.fen ? settledAnalysisRef.current : analysis;
  }, [analysis, game.fen]);

  // Keep a map of completed or latest analyses by FEN so we can evaluate moves just played
  const analysisByFenRef = useRef(new Map());
  useEffect(() => {
    if (analysis.fen && analysis.depthSnapshots.length > 0) {
      analysisByFenRef.current.set(analysis.fen, {
        fen: analysis.fen,
        learnerSide: analysis.learnerSide,
        depthSnapshots: analysis.depthSnapshots,
        staticEvaluation: analysis.staticEvaluation,
      });
    }
  }, [analysis.fen, analysis.learnerSide, analysis.depthSnapshots, analysis.staticEvaluation]);

  // Reset PV preview and guided reveal when the live board position changes
  useEffect(() => {
    setPvPly(0);
    setSelectedRank(1);
    setGuidedRevealed(false);
    setPickedMoveUci('');
  }, [game.fen]);

  const selectPreset = (presetId) => {
    const found = presets.find((p) => p.id === presetId);
    if (!found) return;
    setSelectedPresetId(found.id);
    setActiveFenRoot(found.fen);
    setCustomFenError(null);
  };

  const loadCustomFen = (event) => {
    event.preventDefault();
    const trimmed = customFenInput.trim();
    if (!trimmed) return;
    try {
      new Chess(trimmed);
    } catch {
      setCustomFenError('That FEN is not a legal chess position.');
      return;
    }
    setCustomFenError(null);
    setActiveFenRoot(trimmed);
    if (fenDetailsRef.current) fenDetailsRef.current.open = false;
  };

  const lastMoveReview = useMemo(() => {
    const detail = game.lastMoveDetail;
    if (!detail || !detail.prevFen) return null;
    const prevAnalysis = analysisByFenRef.current.get(detail.prevFen) ?? null;
    return evaluateLastMove({
      prevFen: detail.prevFen,
      prevAnalysis,
      moveSan: detail.san,
      moveUci: detail.uci,
      currentFen: game.fen,
      currentAnalysis: stabilizedAnalysis,
    });
  }, [game.lastMoveDetail, game.fen, stabilizedAnalysis]);

  const lastTakenBackReview = useMemo(() => {
    const tb = game.takenBackDetail;
    if (!tb || !tb.prevFen) return null;
    const prevAnalysis = analysisByFenRef.current.get(tb.prevFen) ?? stabilizedAnalysis;
    const afterAnalysis = tb.afterFen ? (analysisByFenRef.current.get(tb.afterFen) ?? null) : null;
    const review = evaluateLastMove({
      prevFen: tb.prevFen,
      prevAnalysis,
      moveSan: tb.san,
      moveUci: tb.uci,
      currentFen: tb.afterFen || game.fen,
      currentAnalysis: afterAnalysis,
    });
    if (!review) return null;
    return {
      ...review,
      engineReplySan: tb.engineReplySan ?? null,
    };
  }, [game.takenBackDetail, game.fen, stabilizedAnalysis]);

  const brief = useMemo(
    () =>
      buildCoachingBrief({
        fen: game.fen,
        analysis: stabilizedAnalysis,
        lastMoveReview,
        lastTakenBackReview,
      }),
    [game.fen, stabilizedAnalysis, lastMoveReview, lastTakenBackReview],
  );

  const selectedOptimal =
    brief.optimalMoves.find((m) => m.rank === selectedRank) ?? brief.optimalMoves[0] ?? null;
  const pvPreview = useMemo(
    () => playPvPrefix(game.fen, selectedOptimal?.pvUci ?? [], pvPly),
    [game.fen, selectedOptimal, pvPly],
  );

  const showOptimalMoves = coachingMode === 'live' || guidedRevealed;

  const boardArrows = useMemo(() => {
    if (pvPly > 0) return pvPreview.arrows;
    if (!showArrows) return [];
    const arrows = [];
    // Show urgent opponent threat in red if present
    const urgentThreat = brief.facts.opponentThreats[0];
    if (urgentThreat?.from && urgentThreat?.to) {
      arrows.push([urgentThreat.from, urgentThreat.to, 'bad']);
    }
    if (showOptimalMoves && selectedOptimal) {
      arrows.push([
        selectedOptimal.from,
        selectedOptimal.to,
        selectedOptimal.rank === 1 ? 'good' : 'idea',
      ]);
    }
    return arrows;
  }, [pvPly, pvPreview.arrows, showArrows, brief.facts.opponentThreats, showOptimalMoves, selectedOptimal]);

  const legalMoveOptions = useMemo(() => {
    try {
      const c = new Chess(game.fen);
      return c.moves({ verbose: true }).map((move) => ({
        uci: `${move.from}${move.to}${move.promotion ?? ''}`,
        san: move.san,
      }));
    } catch {
      return [];
    }
  }, [game.fen]);

  const pairs = pairMoves(game.history);
  const isSearching = analysis.status === 'loading' || analysis.status === 'searching';

  const handleTabKeyDown = (event, index) => {
    let nextIndex = null;
    if (event.key === 'ArrowRight') {
      nextIndex = (index + 1) % COACH_TABS.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (index - 1 + COACH_TABS.length) % COACH_TABS.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = COACH_TABS.length - 1;
    }
    if (nextIndex !== null) {
      event.preventDefault();
      const nextTab = COACH_TABS[nextIndex];
      setActiveTab(nextTab.id);
      tabRefs.current[nextTab.id]?.focus();
    }
  };

  return (
    <div className="paper-texture min-h-[calc(100dvh-3.75rem)] border-t border-gray-200 bg-[#fbfaf4]">
      {/* Compact Top Control Bar — Fixed height on desktop so nothing shifts */}
      <header className="border-b border-gray-300 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2.5">
          {/* Left: Back link, Title & Scenario Selector */}
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <Link
              to="/"
              className="inline-flex min-h-8 items-center gap-1.5 font-mono text-xs font-bold uppercase text-gray-600 hover:text-brand-600"
            >
              <ArrowLeft size={14} aria-hidden="true" /> Arena
            </Link>
            <span className="text-gray-300" aria-hidden="true">|</span>
            <h1 className="font-display text-xl font-extrabold uppercase tracking-tight text-foreground">
              Live Chess <span className="text-brand-500">Coach</span>
            </h1>

            <div className="flex min-w-0 items-center gap-2">
              <label htmlFor="coach-preset-select" className="sr-only">
                Starting position or study scenario
              </label>
              <select
                id="coach-preset-select"
                value={activePreset.id}
                onChange={(e) => selectPreset(e.target.value)}
                className="min-h-8 max-w-[15rem] truncate border border-gray-400 bg-white px-2.5 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-300 sm:max-w-[19rem]"
              >
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.eyebrow} — {preset.title}
                  </option>
                ))}
              </select>

              {/* Compact Custom FEN Disclosure */}
              <details ref={fenDetailsRef} className="relative">
                <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1 border border-gray-400 bg-white px-2.5 font-mono text-[0.65rem] font-bold uppercase text-gray-700 hover:border-brand-500">
                  FEN
                </summary>
                <div className="absolute left-0 top-full z-30 mt-1.5 w-72 border-2 border-foreground bg-white p-3 shadow-lg sm:w-80">
                  <form onSubmit={loadCustomFen} className="space-y-2">
                    <label
                      htmlFor="custom-fen-input"
                      className="block font-mono text-[0.65rem] font-bold uppercase tracking-wide text-gray-600"
                    >
                      Load any custom FEN
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        id="custom-fen-input"
                        type="text"
                        value={customFenInput}
                        onChange={(e) => setCustomFenInput(e.target.value)}
                        placeholder="Paste FEN…"
                        className="min-h-8 min-w-0 flex-1 border border-gray-400 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-300"
                      />
                      <button type="submit" className="tao-btn-primary min-h-8 px-3 py-1 text-xs">
                        Load
                      </button>
                    </div>
                    {customFenError && (
                      <p className="text-xs font-semibold text-red-700">{customFenError}</p>
                    )}
                  </form>
                </div>
              </details>
            </div>
          </div>

          {/* Right: Play Mode, Opponent Strength & Coach Mode */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Play Mode Switcher */}
            <div className="inline-flex border border-foreground bg-white" role="group" aria-label="Play mode">
              <button
                type="button"
                onClick={() => setPlayMode('white')}
                aria-pressed={playMode === 'white'}
                className={clsx(
                  'inline-flex min-h-8 items-center gap-1 px-2.5 font-mono text-[0.68rem] font-bold uppercase transition-colors',
                  playMode === 'white' ? 'bg-foreground text-white' : 'text-gray-700 hover:bg-brand-50',
                )}
              >
                <Swords size={12} aria-hidden="true" /> Vs Engine (W)
              </button>
              <button
                type="button"
                onClick={() => setPlayMode('black')}
                aria-pressed={playMode === 'black'}
                className={clsx(
                  'inline-flex min-h-8 items-center gap-1 border-x border-foreground px-2.5 font-mono text-[0.68rem] font-bold uppercase transition-colors',
                  playMode === 'black' ? 'bg-foreground text-white' : 'text-gray-700 hover:bg-brand-50',
                )}
              >
                <Swords size={12} aria-hidden="true" /> Vs Engine (B)
              </button>
              <button
                type="button"
                onClick={() => setPlayMode('both')}
                aria-pressed={playMode === 'both'}
                className={clsx(
                  'inline-flex min-h-8 items-center gap-1 px-2.5 font-mono text-[0.68rem] font-bold uppercase transition-colors',
                  playMode === 'both' ? 'bg-foreground text-white' : 'text-gray-700 hover:bg-brand-50',
                )}
              >
                <Users size={12} aria-hidden="true" /> Both Sides
              </button>
            </div>

            {/* Always-present Engine Strength Popover (disabled in Sandbox so top bar width never shifts) */}
            <details className={clsx('relative', playMode === 'both' && 'pointer-events-none opacity-45')}>
              <summary className="inline-flex min-h-8 w-28 cursor-pointer list-none items-center justify-center gap-1.5 border border-gray-400 bg-white px-2 font-mono text-[0.65rem] font-bold uppercase text-gray-700 hover:border-brand-500">
                <SlidersHorizontal size={12} className="shrink-0" aria-hidden="true" />
                <span className="truncate">{strengthConfig.label}</span>
              </summary>
              <div className="absolute right-0 top-full z-30 mt-1.5 w-64 border-2 border-foreground bg-white p-3 shadow-lg">
                <div className="flex items-baseline justify-between gap-2">
                  <label
                    htmlFor="opponent-strength-slider"
                    className="font-mono text-[0.65rem] font-bold uppercase tracking-wide text-gray-500"
                  >
                    Engine Strength
                  </label>
                  <span className="text-xs font-semibold text-foreground">
                    {strengthConfig.label} ({strengthConfig.rating})
                  </span>
                </div>
                <input
                  id="opponent-strength-slider"
                  type="range"
                  min={ENGINE_MIN_LEVEL}
                  max={ENGINE_MAX_LEVEL}
                  step="1"
                  value={skillLevel}
                  onChange={(e) => setSkillLevel(Number(e.target.value))}
                  className="mt-2 h-2 w-full accent-brand-600"
                  aria-label="Opponent engine strength"
                />
              </div>
            </details>

            {/* Coaching Mode Switcher */}
            <div className="inline-flex border border-foreground bg-white" role="group" aria-label="Coaching mode">
              <button
                type="button"
                onClick={() => setCoachingMode('live')}
                aria-pressed={coachingMode === 'live'}
                className={clsx(
                  'min-h-8 px-2.5 font-mono text-[0.68rem] font-bold uppercase transition-colors',
                  coachingMode === 'live'
                    ? 'bg-brand-600 text-white'
                    : 'text-gray-700 hover:bg-brand-50',
                )}
              >
                Live Coach
              </button>
              <button
                type="button"
                onClick={() => setCoachingMode('guided')}
                aria-pressed={coachingMode === 'guided'}
                className={clsx(
                  'min-h-8 border-l border-foreground px-2.5 font-mono text-[0.68rem] font-bold uppercase transition-colors',
                  coachingMode === 'guided'
                    ? 'bg-brand-600 text-white'
                    : 'text-gray-700 hover:bg-brand-50',
                )}
              >
                Guided Play (No Spoilers)
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace: Fixed-geometry two-column grid so boxes never resize or jump */}
      <main className="mx-auto max-w-6xl px-4 py-4">
        <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[30rem_minmax(0,1fr)]">
          {/* Left Column: Locked 30rem Board Stage with 4 fixed-height rows */}
          <div className="mx-auto w-full max-w-[30rem] space-y-2">
            {/* Row 1: Fixed-Height (`h-10`) Status Strip Above the Board */}
            <div className="flex h-10 items-center justify-between gap-2 overflow-hidden border border-gray-300 bg-white px-3">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={clsx(
                    'h-2.5 w-2.5 shrink-0 border border-gray-500',
                    brief.facts.turn === 'w' ? 'bg-white' : 'bg-gray-900',
                  )}
                  aria-hidden="true"
                />
                {game.status === 'over' ? (
                  <span className="truncate font-display text-xs font-bold uppercase text-brand-700">
                    Game Over — {game.result?.reason ?? 'Complete'}
                  </span>
                ) : game.status === 'engine-thinking' ? (
                  <span className="inline-flex items-center gap-1.5 truncate text-xs font-semibold text-brand-600">
                    <Loader2 className=" shrink-0 animate-spin" size={13} aria-hidden="true" />
                    Opponent Stockfish is thinking…
                  </span>
                ) : (
                  <span className="truncate text-xs font-semibold text-gray-800">
                    {playMode === 'both'
                      ? `Sandbox: ${brief.facts.sideLabel} to move`
                      : `Your move as ${brief.facts.sideLabel}`}{' '}
                    <span className="font-mono text-[0.62rem] uppercase text-gray-500">
                      · {brief.facts.phase}
                    </span>
                  </span>
                )}
              </div>

              {/* Fixed-width Depth Status Pill so width never jitters during search */}
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={clsx(
                    'inline-flex h-6 w-28 items-center justify-center gap-1 border font-mono text-[0.6rem] font-bold uppercase transition-colors duration-200',
                    isSearching
                      ? 'border-brand-300 bg-brand-50 text-brand-700'
                      : 'border-correct bg-green-50 text-green-800',
                  )}
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="animate-spin" size={10} aria-hidden="true" />
                      <span>Depth {brief.depth ?? '…'}</span>
                    </>
                  ) : (
                    <span>Depth {brief.depth ?? 11} ready</span>
                  )}
                </span>
              </div>
            </div>

            {/* Row 2: The Chessboard — Exact 1:1 Square (`30rem x 30rem` on desktop) */}
            <BoardPanel
              fen={pvPly > 0 ? pvPreview.fen : game.fen}
              orientation={game.orientation}
              variant="book"
              arePiecesDraggable={pvPly === 0 && game.arePiecesDraggable}
              onPieceDrop={game.onPieceDrop}
              onPromotionPieceSelect={game.onPromotionPieceSelect}
              onSquareClick={game.onSquareClick}
              promotionTarget={game.promotionTarget}
              selectedSquare={game.selectedSquare}
              legalTargets={game.legalTargets}
              highlights={
                pvPly === 0 && game.lastMove ? [game.lastMove.from, game.lastMove.to] : []
              }
              arrows={boardArrows}
              className="w-full"
            />

            {/* Row 3: Permanent Fixed-Height (`h-11`) Board Control & Variation Bar (never unmounts) */}
            <div className="flex h-11 items-center justify-between gap-2 overflow-hidden border border-gray-300 bg-white px-2.5">
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={game.newGame}
                  className="tao-btn-primary h-7 px-2 py-0 text-[0.68rem]"
                >
                  <RefreshCw size={12} aria-hidden="true" /> Restart
                </button>
                <button
                  type="button"
                  onClick={game.takeBack}
                  disabled={game.history.length === 0}
                  className="tao-btn-ghost h-7 px-2 py-0 text-[0.68rem] disabled:opacity-40"
                >
                  <Undo2 size={12} aria-hidden="true" />{' '}
                  {playMode === 'both' ? 'Undo' : 'Take back'}
                </button>
                <button
                  type="button"
                  onClick={game.flipBoard}
                  className="tao-btn-ghost h-7 px-2 py-0 text-[0.68rem]"
                >
                  <RotateCcw size={12} aria-hidden="true" /> Flip
                </button>
                {playMode !== 'both' && (
                  <button
                    type="button"
                    onClick={game.resign}
                    disabled={game.status === 'over'}
                    className="tao-btn-ghost h-7 px-2 py-0 text-[0.68rem] disabled:opacity-40"
                  >
                    <Flag size={12} aria-hidden="true" /> Resign
                  </button>
                )}
              </div>

              {/* Right side: Fixed Variation Stepper + Arrows Toggle */}
              <div className="flex shrink-0 items-center gap-1.5">
                <div className="inline-flex items-center border border-gray-300 bg-gray-50">
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center text-gray-700 hover:bg-white disabled:opacity-35"
                    onClick={() => setPvPly((ply) => Math.max(0, ply - 1))}
                    disabled={!showOptimalMoves || !selectedOptimal || pvPly === 0}
                    aria-label="Previous move in variation"
                  >
                    <ChevronLeft size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPvPly(0)}
                    disabled={pvPly === 0}
                    className={clsx(
                      'h-7 w-16 border-x border-gray-300 font-mono text-[0.6rem] font-bold uppercase',
                      pvPly > 0
                        ? 'bg-amber-100 text-amber-950 hover:bg-amber-200'
                        : 'text-gray-500',
                    )}
                  >
                    {pvPly > 0 ? `Ply +${pvPly}` : 'Live'}
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center text-gray-700 hover:bg-white disabled:opacity-35"
                    onClick={() =>
                      setPvPly((ply) =>
                        selectedOptimal ? Math.min(selectedOptimal.pvUci.length, ply + 1) : 0,
                      )
                    }
                    disabled={
                      !showOptimalMoves ||
                      !selectedOptimal ||
                      pvPly >= (selectedOptimal?.pvUci?.length ?? 0)
                    }
                    aria-label="Next move in variation"
                  >
                    <ChevronRight size={14} aria-hidden="true" />
                  </button>
                </div>

                <label className="inline-flex cursor-pointer items-center gap-1 font-mono text-[0.6rem] font-bold uppercase text-gray-600">
                  <input
                    type="checkbox"
                    checked={showArrows}
                    onChange={(e) => setShowArrows(e.target.checked)}
                    className="accent-brand-600"
                  />
                  Arrows
                </label>
              </div>
            </div>

            {/* Row 4: Permanent Fixed-Height (`h-20`) Last-Move Feedback Box */}
            <LastMoveBanner
              review={lastMoveReview}
              takenBackReview={lastTakenBackReview}
              onTakeBack={game.takeBack}
              canTakeBack={game.history.length > 0 && game.status !== 'engine-thinking'}
            />
          </div>

          {/* Right Column: Locked `h-[39.25rem]` Tabbed Coach Panel matching the Board Stage height */}
          <div className="study-panel-strong flex h-[39.25rem] w-full min-w-0 flex-col overflow-hidden">
            {/* Fixed-Height (`h-11`) Theme Tablist */}
            <div
              role="tablist"
              aria-label="Coaching themes"
              className="grid h-11 shrink-0 grid-cols-4 border-b-2 border-foreground bg-white"
            >
              {COACH_TABS.map((tab, index) => {
                const Icon = tab.icon;
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    ref={(el) => {
                      tabRefs.current[tab.id] = el;
                    }}
                    id={`coach-tab-${tab.id}`}
                    role="tab"
                    type="button"
                    aria-selected={isSelected}
                    aria-controls={`coach-panel-${tab.id}`}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => setActiveTab(tab.id)}
                    onKeyDown={(e) => handleTabKeyDown(e, index)}
                    className={clsx(
                      'flex h-full min-w-0 items-center justify-center gap-1.5 border-r border-gray-200 px-2 font-mono text-[0.65rem] font-bold uppercase tracking-wide transition-colors last:border-r-0',
                      isSelected
                        ? 'bg-foreground text-white'
                        : 'bg-white text-gray-700 hover:bg-brand-50',
                    )}
                  >
                    <Icon size={14} className="shrink-0" aria-hidden="true" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Fixed-Height Tab Workspace (`min-h-0 min-w-0 flex-1 overflow-hidden p-4`) */}
            <div className="min-h-0 min-w-0 flex-1 overflow-hidden p-4">
              {/* TAB 1: MAIN IDEA — 3 Fixed-Track Boxes (`grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1.25fr)_7.25rem_minmax(0,1fr)]`) */}
              <div
                id="coach-panel-idea"
                role="tabpanel"
                aria-labelledby="coach-tab-idea"
                hidden={activeTab !== 'idea'}
                className={clsx(
                  'h-full min-h-0 min-w-0',
                  activeTab === 'idea' &&
                    'grid grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1.25fr)_7.25rem_minmax(0,1fr)] gap-3',
                )}
              >
                {/* Box 1: What to Think About Now (Fixed outer height, internal scroll) */}
                <section
                  className="flex min-h-0 min-w-0 flex-col border border-gray-300 bg-white p-3.5"
                  aria-labelledby="coach-thinking-title"
                >
                  <div className="flex shrink-0 min-w-0 items-center justify-between gap-2 border-b border-gray-200 pb-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <BrainCircuit className="shrink-0 text-brand-500" size={18} aria-hidden="true" />
                      <h2
                        id="coach-thinking-title"
                        className="truncate font-display text-base font-bold uppercase tracking-tight text-foreground"
                      >
                        What to Think About Now
                      </h2>
                    </div>
                    <span className="shrink-0 font-mono text-[0.6rem] font-bold uppercase text-brand-600">
                      {brief.facts.sideLabel} to move
                    </span>
                  </div>

                  <ul className="mt-2.5 min-h-0 min-w-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]">
                    {brief.whatToThinkAbout.map((thought) => (
                      <li
                        key={thought.id}
                        className="flex min-w-0 items-start gap-2.5 border border-gray-200 bg-[#fbfaf4] p-2.5"
                      >
                        <ThoughtIcon kind={thought.kind} />
                        <div className="min-w-0 flex-1">
                          <p className="break-words font-mono text-[0.68rem] font-bold uppercase tracking-wide text-gray-800">
                            {thought.label}
                          </p>
                          <p className="mt-0.5 break-words text-xs leading-5 text-gray-700">
                            {thought.text}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>

                {/* Box 2: Optimal Move Spotlight (Locked 7.25rem height, internal scroll) */}
                <section
                  className="flex h-[7.25rem] min-w-0 flex-col justify-between overflow-y-auto overscroll-contain border border-gray-300 bg-white p-3 [scrollbar-gutter:stable]"
                  aria-label="Top move summary"
                >
                  <div className="flex shrink-0 min-w-0 items-center justify-between gap-2">
                    <span className="font-mono text-[0.62rem] font-bold uppercase tracking-wide text-brand-600">
                      Optimal Move Spotlight
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('moves')}
                      className="inline-flex shrink-0 items-center gap-1 font-mono text-[0.62rem] font-bold uppercase text-brand-700 hover:underline"
                    >
                      All 3 moves <ArrowRight size={11} aria-hidden="true" />
                    </button>
                  </div>

                  {!showOptimalMoves ? (
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                      <p className="min-w-0 flex-1 break-words text-xs leading-5 text-gray-700">
                        <strong>Guided Play Mode:</strong> Best move hidden so you can calculate first.
                      </p>
                      <button
                        type="button"
                        onClick={() => setGuidedRevealed(true)}
                        className="tao-btn-primary h-8 shrink-0 px-3 py-0 text-xs"
                      >
                        <Eye size={13} aria-hidden="true" /> Reveal Optimal Move &amp; Why
                      </button>
                    </div>
                  ) : brief.topMove ? (
                    <div className="min-h-0 min-w-0 flex-1 pt-1">
                      <div className="flex min-w-0 items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="shrink-0 bg-correct px-1.5 py-0.5 font-mono text-[0.6rem] font-bold uppercase text-white">
                            Optimal #1
                          </span>
                          <span className="font-book text-lg font-bold text-foreground">
                            {brief.topMove.san}
                          </span>
                          <span className="font-mono text-xs font-bold text-brand-700">
                            ({brief.topMove.scoreLabel})
                          </span>
                        </div>
                        {game.status === 'player-turn' && (
                          <button
                            type="button"
                            onClick={() => {
                              setPvPly(0);
                              game.playMove(brief.topMove.uci);
                            }}
                            className="inline-flex h-6 shrink-0 items-center gap-1 border border-foreground bg-foreground px-2 font-mono text-[0.6rem] font-bold uppercase text-white hover:bg-brand-600"
                          >
                            <Play size={10} aria-hidden="true" /> Play {brief.topMove.san}
                          </button>
                        )}
                      </div>
                      <p className="mt-1 break-words text-xs leading-5 text-gray-800">
                        {brief.topMove.why}
                      </p>
                    </div>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-center">
                      <p className="text-xs text-gray-500">
                        {isSearching
                          ? 'Stockfish is calculating the top move…'
                          : 'No legal moves available.'}
                      </p>
                    </div>
                  )}
                </section>

                {/* Box 3: Strategic Principle in Play (Fixed outer height, internal scroll) */}
                <section
                  className="flex min-h-0 min-w-0 flex-col border border-gray-300 bg-white p-3.5"
                  aria-labelledby="strategy-lens-title"
                >
                  <div className="flex shrink-0 min-w-0 items-center justify-between gap-2 border-b border-gray-200 pb-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <BookOpen className="shrink-0 text-amber-700" size={17} aria-hidden="true" />
                      <h3
                        id="strategy-lens-title"
                        className="min-w-0 truncate font-display text-base font-bold uppercase tracking-tight text-foreground"
                      >
                        {brief.strategyCard?.title ?? 'Classical Strategy Principle'}
                      </h3>
                    </div>
                  </div>
                  <div className="mt-2 min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]">
                    {brief.strategyCard ? (
                      <>
                        <p className="break-words text-xs leading-5 text-gray-700">
                          {brief.strategyCard.summary}
                        </p>
                        <ul className="mt-2 space-y-1 text-xs leading-5 text-gray-700">
                          {brief.strategyCard.principles.slice(0, 2).map((p) => (
                            <li key={p} className="flex min-w-0 gap-2">
                              <span className="shrink-0 font-bold text-brand-600" aria-hidden="true">
                                →
                              </span>
                              <span className="min-w-0 flex-1 break-words">{p}</span>
                            </li>
                          ))}
                        </ul>
                        {brief.strategyCard.citation?.label && (
                          <p className="mt-2 break-words font-mono text-[0.58rem] text-gray-500">
                            Source: {brief.strategyCard.citation.label}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-gray-500">
                        Evaluating strategic themes for this pawn structure…
                      </p>
                    )}
                  </div>
                </section>
              </div>

              {/* TAB 2: KEY BEST MOVES — 3 Fixed-Height Move Slots + Fixed Bottom Picker */}
              <div
                id="coach-panel-moves"
                role="tabpanel"
                aria-labelledby="coach-tab-moves"
                hidden={activeTab !== 'moves'}
                className={clsx(
                  'h-full min-h-0 min-w-0',
                  activeTab === 'moves' && 'flex flex-col justify-between gap-2.5',
                )}
              >
                <div className="flex shrink-0 min-w-0 items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Cpu className="shrink-0 text-brand-500" size={18} aria-hidden="true" />
                    <h2
                      id="optimal-moves-title"
                      className="truncate font-display text-lg font-bold uppercase tracking-tight text-foreground"
                    >
                      Optimal Moves &amp; Why
                    </h2>
                  </div>
                  {coachingMode === 'guided' && showOptimalMoves && (
                    <button
                      type="button"
                      onClick={() => setGuidedRevealed(false)}
                      className="inline-flex shrink-0 items-center gap-1 font-mono text-[0.65rem] font-bold uppercase text-gray-600 hover:text-brand-600"
                    >
                      <EyeOff size={13} aria-hidden="true" /> Hide moves
                    </button>
                  )}
                </div>

                {analysis.status === 'error' ? (
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center border-2 border-red-700 bg-red-50 p-4 text-center" role="alert">
                    <p className="flex items-center gap-2 font-semibold text-red-800">
                      <AlertCircle size={18} aria-hidden="true" /> Stockfish could not finish analyzing this position.
                    </p>
                    <button type="button" className="tao-btn-ghost mt-3" onClick={analysis.retry}>
                      <RotateCcw size={16} aria-hidden="true" /> Retry analysis
                    </button>
                  </div>
                ) : !showOptimalMoves ? (
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center border border-dashed border-gray-400 bg-white p-6 text-center">
                    <p className="max-w-md break-words text-sm leading-6 text-gray-700">
                      <strong>Guided Play Mode:</strong> Use the Main Idea tab to choose your move
                      first, or reveal Stockfish’s candidate moves and explanations now.
                    </p>
                    <button
                      type="button"
                      onClick={() => setGuidedRevealed(true)}
                      className="tao-btn-primary mt-4"
                    >
                      <Eye size={17} aria-hidden="true" /> Reveal Optimal Move &amp; Why
                    </button>
                  </div>
                ) : (
                  /* 3 Fixed-Size Candidate Move Slots so cards never pop in/out or resize */
                  <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-3 gap-2.5">
                    {[1, 2, 3].map((slotRank) => {
                      const move = brief.optimalMoves.find((m) => m.rank === slotRank) ?? null;
                      const isSelected = move && (selectedOptimal?.rank ?? 1) === move.rank;
                      return (
                        <div
                          key={slotRank}
                          className={clsx(
                            'flex min-h-0 min-w-0 flex-col justify-between overflow-y-auto overscroll-contain border p-3 transition-colors duration-200 [scrollbar-gutter:stable]',
                            isSelected
                              ? 'border-2 border-brand-500 bg-brand-50/60'
                              : 'border-gray-300 bg-white',
                          )}
                        >
                          {move ? (
                            <>
                              <div className="flex shrink-0 min-w-0 flex-wrap items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  <span
                                    className={clsx(
                                      'shrink-0 px-2 py-0.5 font-mono text-[0.62rem] font-bold uppercase',
                                      move.rank === 1
                                        ? 'bg-correct text-white'
                                        : 'bg-gray-200 text-gray-800',
                                    )}
                                  >
                                    {move.rank === 1 ? 'Optimal #1' : `Option #${move.rank}`}
                                  </span>
                                  <span className="font-book text-lg font-bold text-foreground">
                                    {move.san}
                                  </span>
                                  <span className="font-mono text-xs font-bold text-brand-700">
                                    ({move.scoreLabel})
                                  </span>
                                </div>

                                <div className="flex shrink-0 items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedRank(move.rank);
                                      setPvPly(1);
                                    }}
                                    className="h-6 border border-gray-400 bg-white px-2 font-mono text-[0.6rem] font-bold uppercase text-gray-700 hover:border-brand-500 hover:text-brand-700"
                                  >
                                    Preview line
                                  </button>
                                  {game.status === 'player-turn' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPvPly(0);
                                        game.playMove(move.uci);
                                      }}
                                      className="inline-flex h-6 items-center gap-1 border border-foreground bg-foreground px-2 font-mono text-[0.6rem] font-bold uppercase text-white hover:bg-brand-600"
                                    >
                                      <Play size={10} aria-hidden="true" /> Play {move.san}
                                    </button>
                                  )}
                                </div>
                              </div>

                              <p className="mt-1.5 break-words text-xs font-medium leading-5 text-gray-800">
                                {move.why}
                              </p>
                              {move.continuation && (
                                <p className="mt-0.5 break-words font-mono text-[0.62rem] text-gray-500">
                                  {move.continuation}
                                </p>
                              )}
                            </>
                          ) : (
                            <div className="flex h-full min-w-0 items-center justify-between gap-2 text-xs text-gray-400">
                              <span className="shrink-0 font-mono text-[0.62rem] font-bold uppercase">
                                Candidate #{slotRank}
                              </span>
                              <span className="min-w-0 truncate">
                                {isSearching
                                  ? 'Calculating candidate line…'
                                  : 'No additional candidate move in this position.'}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Fixed-Height Keyboard Legal Move Bar */}
                <div className="shrink-0 min-w-0 border-t border-gray-300 pt-2">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                    <label htmlFor="coach-legal-move-picker" className="sr-only">
                      Play any legal move by keyboard
                    </label>
                    <select
                      id="coach-legal-move-picker"
                      value={pickedMoveUci}
                      onChange={(e) => setPickedMoveUci(e.target.value)}
                      disabled={game.status !== 'player-turn' || legalMoveOptions.length === 0}
                      className="h-8 w-full min-w-0 border border-gray-400 bg-white px-2.5 text-xs font-semibold disabled:opacity-50"
                    >
                      <option value="">Play any legal move by keyboard…</option>
                      {legalMoveOptions.map((m) => (
                        <option key={m.uci} value={m.uci}>
                          {m.san}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!pickedMoveUci || game.status !== 'player-turn'}
                      onClick={() => {
                        if (pickedMoveUci) {
                          setPvPly(0);
                          game.playMove(pickedMoveUci);
                          setPickedMoveUci('');
                        }
                      }}
                      className="tao-btn-ghost h-8 px-3 py-0 text-xs disabled:opacity-40"
                    >
                      Play move
                    </button>
                  </div>
                </div>
              </div>

              {/* TAB 3: STATE OF THE BOARD — Fixed-Track Grid */}
              <div
                id="coach-panel-state"
                role="tabpanel"
                aria-labelledby="coach-tab-state"
                hidden={activeTab !== 'state'}
                className={clsx(
                  'h-full min-h-0 min-w-0',
                  activeTab === 'state' &&
                    'grid grid-cols-[minmax(0,1fr)] grid-rows-[auto_3.75rem_4.75rem_5.5rem_minmax(0,1fr)] gap-2.5',
                )}
              >
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <ScanSearch className="shrink-0 text-brand-500" size={18} aria-hidden="true" />
                    <h2
                      id="board-state-heading"
                      className="truncate font-display text-lg font-bold uppercase tracking-tight text-foreground"
                    >
                      State of the Board
                    </h2>
                  </div>
                  {((game.captured?.white?.length ?? 0) > 0 ||
                    (game.captured?.black?.length ?? 0) > 0) && (
                    <CapturedPieces captured={game.captured} />
                  )}
                </div>

                {/* Track 2 (`3.75rem`): Phase & King Status */}
                <div className="grid h-[3.75rem] min-w-0 grid-cols-2 gap-2.5">
                  <div className="flex min-w-0 flex-col justify-center border border-gray-300 bg-white px-3">
                    <p className="font-mono text-[0.58rem] font-bold uppercase text-gray-500">
                      Phase &amp; Turn
                    </p>
                    <p className="truncate font-display text-sm font-bold uppercase text-foreground">
                      {brief.facts.phase} · {brief.facts.sideLabel}
                    </p>
                  </div>
                  <div className="flex min-w-0 flex-col justify-center border border-gray-300 bg-white px-3">
                    <p className="font-mono text-[0.58rem] font-bold uppercase text-gray-500">
                      King &amp; Structure
                    </p>
                    <p className="truncate font-display text-sm font-bold uppercase text-foreground">
                      {brief.facts.kingCastled
                        ? 'King Castled'
                        : brief.facts.canCastle
                          ? `Can Castle (${brief.facts.castleMoves.join('/')})`
                          : `King on ${brief.facts.kingSquare}`}
                    </p>
                  </div>
                </div>

                {/* Track 3 (`4.75rem`): Active Threats & Vulnerable Squares */}
                <div className="h-[4.75rem] min-w-0 space-y-1 overflow-y-auto overscroll-contain border border-gray-300 bg-white p-2.5 text-xs [scrollbar-gutter:stable]">
                  <div className="break-words">
                    <span className="font-mono text-[0.62rem] font-bold uppercase text-gray-600">
                      Opponent Threats:{' '}
                    </span>
                    {(brief.facts.opponentThreats ?? []).length === 0 ? (
                      <span className="text-gray-600">None detected on a free move.</span>
                    ) : (
                      <span className="font-semibold text-red-700">
                        {brief.facts.opponentThreats
                          .slice(0, 3)
                          .map((t) => `${t.san} (${t.targetLabel ?? t.targetSquare})`)
                          .join(', ')}
                      </span>
                    )}
                  </div>
                  <div className="break-words">
                    <span className="font-mono text-[0.62rem] font-bold uppercase text-gray-600">
                      Vulnerable Pieces:{' '}
                    </span>
                    {(brief.facts.threatenedPieces ?? []).length === 0 ? (
                      <span className="text-gray-600">All attacked friendly pieces are defended.</span>
                    ) : (
                      <span className="font-semibold text-amber-800">
                        {brief.facts.threatenedPieces
                          .map(
                            (v) =>
                              `${v.pieceName} on ${v.square} (${v.undefended ? 'undefended' : 'outnumbered'})`,
                          )
                          .join(', ')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Track 4 (`5.5rem`): Move History */}
                <section
                  className="flex h-[5.5rem] min-w-0 flex-col overflow-hidden border border-gray-300 bg-white p-2.5"
                  aria-label="Move history"
                >
                  <h3 className="shrink-0 font-mono text-[0.6rem] font-bold uppercase tracking-wide text-gray-500">
                    Move History ({game.history.length} plies)
                  </h3>
                  <div className="mt-1 min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
                    {pairs.length === 0 ? (
                      <p className="text-xs text-gray-400">
                        No moves played yet from this starting position.
                      </p>
                    ) : (
                      <MoveList pairs={pairs} className="text-xs" />
                    )}
                  </div>
                </section>

                {/* Track 5 (`minmax(0,1fr)`): Position X-Ray (8 permanent meter rows) */}
                <section
                  className="flex min-h-0 min-w-0 flex-col border border-gray-300 bg-white p-3"
                  aria-label="Position X-Ray"
                >
                  <div className="flex shrink-0 min-w-0 items-baseline justify-between gap-2">
                    <h3 className="truncate font-mono text-[0.62rem] font-bold uppercase tracking-wide text-gray-700">
                      Position X-Ray (Classical Evaluation)
                    </h3>
                    <span className="shrink-0 font-mono text-[0.58rem] text-gray-500">
                      Cyan: {learnerPerspective} · Orange: opponent
                    </span>
                  </div>
                  <div className="mt-2 min-h-0 min-w-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]">
                    {FACTORS.map(([label, key]) => {
                      const pair = stabilizedAnalysis?.staticEvaluation?.[key]?.advantage ?? null;
                      return (
                        <div
                          key={key}
                          className="grid min-w-0 items-center gap-1 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-2"
                        >
                          <span className="truncate text-xs font-semibold text-gray-700">
                            {label}
                          </span>
                          <div className="min-w-0 space-y-0.5">
                            <EvalMeter label={label} phase="MG" value={pair?.middleGame} />
                            <EvalMeter label={label} phase="EG" value={pair?.endgame} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>

              {/* TAB 4: ASK COACH — Fixed-Height Embedded Companion */}
              <div
                id="coach-panel-chat"
                role="tabpanel"
                aria-labelledby="coach-tab-chat"
                hidden={activeTab !== 'chat'}
                className="h-full min-h-0 min-w-0"
              >
                <NimzoCoach
                  embedded
                  analysis={stabilizedAnalysis}
                  branch={
                    selectedOptimal
                      ? {
                          depth: brief.depth,
                          line: {
                            sanMoves: selectedOptimal.pvSan,
                            uciMoves: selectedOptimal.pvUci,
                          },
                        }
                      : null
                  }
                  brief={brief}
                  history={game.history}
                  coachingMode={coachingMode}
                  fen={game.fen}
                  seedCardId={brief.strategyCard?.id ?? activePreset.coachCardId}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
