import { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Cpu,
  Eye,
  Gauge,
  GitBranch,
  Loader2,
  MessageCircle,
  RotateCcw,
  ScanSearch,
  Sparkles,
  Target,
  Trees,
  X,
} from 'lucide-react';
import BoardPanel from '../components/BoardPanel.jsx';
import NimzoCoach from '../components/NimzoCoach.jsx';
import {
  ENGINE_XRAY_POSITIONS,
  getEngineXrayPosition,
} from '../content/engineXrayPositions.js';
import { useStockfishAnalysis } from '../engine/useStockfishAnalysis.js';
import {
  candidateMoveFromSquares,
  compareCandidates,
  formatEngineScore,
  playPvPrefix,
} from '../engine/xrayLearning.js';

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

function scoreTone(line) {
  if (line?.mate != null) return line.mate > 0 ? 'text-correct' : 'text-red-700';
  if ((line?.score ?? 0) > 20) return 'text-correct';
  if ((line?.score ?? 0) < -20) return 'text-red-700';
  return 'text-gray-700';
}

function compactNumber(value) {
  if (value == null) return '—';
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function sideAtFen(fen) {
  try {
    return new Chess(fen).turn() === 'w' ? 'White' : 'Black';
  } catch {
    return 'The side to move';
  }
}

function customPositionFrom(searchParams) {
  const fen = searchParams.get('fen');
  if (!fen) return null;
  try {
    new Chess(fen);
  } catch {
    return null;
  }
  const orientation = searchParams.get('orientation') === 'black' ? 'black' : 'white';
  const coachCardId = searchParams.get('coach') || null;
  return {
    id: 'shared-study-position',
    title: searchParams.get('title') || 'Your study position',
    eyebrow: 'From a lesson',
    fen,
    orientation,
    prompt:
      'Pause before asking the engine. Name up to three legal candidates, then compare your scan with the search.',
    predictionPrompt: 'What is the opponent’s strongest reply to your favorite candidate?',
    coachCardId,
    recommendedDepth: 11,
  };
}

function factorPair(evaluation, key) {
  return evaluation?.[key]?.advantage ?? null;
}

function EvalMeter({ label, phase, value }) {
  const magnitude = Math.min(50, Math.abs(value ?? 0) * 12.5);
  const favorable = (value ?? 0) >= 0;
  const readable = value == null ? 'unavailable' : `${value >= 0 ? '+' : ''}${value.toFixed(2)} pawns`;

  return (
    <div className="grid grid-cols-[2rem_minmax(0,1fr)_3.5rem] items-center gap-2">
      <span className="font-mono text-[0.62rem] font-bold uppercase text-gray-500">{phase}</span>
      <div
        className="relative h-2.5 overflow-hidden border border-gray-300 bg-gray-100"
        role="meter"
        aria-label={`${label}, ${phase}: ${readable}`}
        aria-valuemin="-4"
        aria-valuemax="4"
        aria-valuenow={value ?? 0}
      >
        <span className="absolute inset-y-0 left-1/2 w-px bg-gray-500" />
        {value != null && (
          <span
            className={`absolute inset-y-0 ${favorable ? 'left-1/2 bg-brand-400' : 'right-1/2 bg-accent-orange'}`}
            style={{ width: `${magnitude}%` }}
          />
        )}
      </div>
      <span className="text-right font-mono text-[0.68rem] font-bold text-gray-600">
        {value == null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}`}
      </span>
    </div>
  );
}

function PositionXRay({ evaluation, learner }) {
  return (
    <section className="study-panel p-5" aria-labelledby="position-xray-title">
      <div className="flex items-start gap-3">
        <ScanSearch className="mt-1 shrink-0 text-brand-500" size={22} />
        <div>
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-wide text-brand-600">
            Static measurement
          </p>
          <h2 id="position-xray-title" className="font-display text-2xl font-bold uppercase tracking-tight">
            Position X-Ray
          </h2>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-gray-600">
        Stockfish 10 scores classical ingredients before searching. Cyan favors {learner}; orange
        favors the opponent. These terms measure the position—they do not explain why a move works.
      </p>

      {!evaluation ? (
        <div className="mt-5 border border-dashed border-gray-300 px-4 py-5 text-sm text-gray-500">
          The classical evaluation will appear when the engine is ready.
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {FACTORS.map(([label, key]) => {
            const pair = factorPair(evaluation, key);
            return (
              <div key={key} className="grid gap-1 md:grid-cols-[7rem_minmax(0,1fr)] md:gap-3">
                <span className="text-sm font-semibold text-gray-700">{label}</span>
                <div className="space-y-1">
                  <EvalMeter label={label} phase="MG" value={pair?.middleGame} />
                  <EvalMeter label={label} phase="EG" value={pair?.endgame} />
                </div>
              </div>
            );
          })}
          <div className="flex items-center justify-between border-t border-gray-300 pt-3">
            <span className="font-mono text-xs font-bold uppercase text-gray-600">Blended total</span>
            <span className="font-display text-2xl font-bold text-brand-600">
              {evaluation.total?.finalAdvantage == null
                ? '—'
                : `${evaluation.total.finalAdvantage >= 0 ? '+' : ''}${evaluation.total.finalAdvantage.toFixed(2)}`}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

function SearchBonsai({ snapshot, previousSnapshot, selectedRank, onSelect }) {
  const leaderChanged =
    previousSnapshot?.lines?.[0]?.uciMoves?.[0] &&
    snapshot?.lines?.[0]?.uciMoves?.[0] &&
    previousSnapshot.lines[0].uciMoves[0] !== snapshot.lines[0].uciMoves[0];

  return (
    <section className="study-panel p-5" aria-labelledby="bonsai-title">
      <div className="flex items-start gap-3">
        <Trees className="mt-1 shrink-0 text-brand-500" size={22} />
        <div className="min-w-0">
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-wide text-brand-600">
            Three current candidates
          </p>
          <h2 id="bonsai-title" className="font-display text-2xl font-bold uppercase tracking-tight">
            Search Bonsai
          </h2>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-gray-600">
        A tiny clipping from the search—not Stockfish&apos;s complete tree. Each branch is a principal
        variation the engine currently prefers.
      </p>

      {leaderChanged && (
        <p className="mt-4 inline-flex items-center gap-2 border border-accent-orange bg-orange-50 px-3 py-2 font-mono text-[0.68rem] font-bold uppercase text-orange-800">
          <GitBranch size={15} /> Leader changed since depth {previousSnapshot.depth}
        </p>
      )}

      {!snapshot?.lines?.length ? (
        <div className="mt-5 border border-dashed border-gray-300 px-4 py-5 text-sm text-gray-500">
          Candidate branches grow here as complete depths arrive.
        </div>
      ) : (
        <div className="relative mt-5 space-y-3 border-l border-gray-400 pl-6">
          <span className="absolute -left-[0.34rem] top-0 h-2.5 w-2.5 border border-gray-500 bg-accent-yellow" />
          {snapshot.lines.map((line) => (
            <button
              key={line.rank}
              type="button"
              onClick={() => onSelect(line.rank)}
              aria-pressed={selectedRank === line.rank}
              className={`relative block w-full border p-3 text-left transition-colors before:absolute before:-left-[1.55rem] before:top-6 before:h-px before:w-[1.45rem] before:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-300 ${
                selectedRank === line.rank
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-gray-300 bg-white hover:border-gray-500'
              }`}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="font-mono text-[0.65rem] font-bold uppercase text-gray-500">
                  Branch {line.rank}
                </span>
                <span className={`font-mono text-sm font-bold ${scoreTone(line)}`}>
                  {formatEngineScore(line)}
                </span>
              </span>
              <span className="mt-1 block truncate font-book text-lg font-semibold text-gray-800">
                {line.sanMoves.slice(0, 5).join(' ') || 'Waiting for a legal line…'}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function TimeMachine({ snapshots, snapshot, onDepthChange }) {
  const selectedIndex = Math.max(
    0,
    snapshots.findIndex((entry) => entry.depth === snapshot?.depth),
  );

  return (
    <section className="study-panel p-5" aria-labelledby="time-machine-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Gauge className="mt-1 shrink-0 text-brand-500" size={22} />
          <div>
            <p className="font-mono text-[0.65rem] font-bold uppercase tracking-wide text-brand-600">
              Iterative deepening
            </p>
            <h2 id="time-machine-title" className="font-display text-2xl font-bold uppercase tracking-tight">
              Search Time Machine
            </h2>
          </div>
        </div>
        <span className="study-chip border-yellow-400 bg-yellow-50 text-foreground">Depth {snapshot?.depth ?? '—'}</span>
      </div>

      <p className="mt-3 text-sm leading-6 text-gray-600">
        Scrub backward to watch candidate rankings change as Stockfish looks farther ahead.
      </p>
      <input
        className="mt-5 w-full accent-[#0077a8]"
        type="range"
        min="0"
        max={Math.max(0, snapshots.length - 1)}
        value={selectedIndex}
        disabled={snapshots.length < 2}
        onChange={(event) => onDepthChange(snapshots[Number(event.target.value)]?.depth)}
        aria-label="Search depth"
        aria-valuetext={snapshot ? `Depth ${snapshot.depth}` : 'No completed depth'}
      />
      <div className="mt-3 grid grid-cols-3 gap-3 border-t-2 border-gray-200 pt-3 text-center">
        <Metric label="Nodes" value={compactNumber(snapshot?.nodes)} />
        <Metric label="Speed" value={snapshot?.nps == null ? '—' : `${compactNumber(snapshot.nps)}/s`} />
        <Metric label="Selective" value={snapshot?.selectiveDepth ?? '—'} />
      </div>
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <span className="block font-mono text-[0.62rem] font-bold uppercase text-gray-500">{label}</span>
      <span className="mt-1 block font-display text-lg font-bold text-foreground">{value}</span>
    </div>
  );
}

function AnalysisStatus({ analysis, onCancel }) {
  if (analysis.status === 'error') {
    return (
      <div className="mt-4 border-2 border-red-700 bg-red-50 p-4" role="alert">
        <p className="flex items-center gap-2 font-semibold text-red-800">
          <AlertCircle size={18} /> Stockfish could not finish this scan.
        </p>
        <p className="mt-1 text-sm text-red-700">{analysis.error?.message || 'The worker stopped unexpectedly.'}</p>
        <button type="button" className="tao-btn-ghost mt-3" onClick={analysis.retry}>
          <RotateCcw size={16} /> Retry
        </button>
      </div>
    );
  }

  if (analysis.status === 'loading' || analysis.status === 'searching') {
    const depth = analysis.depthSnapshots.at(-1)?.depth;
    return (
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-2 border-foreground bg-brand-50 p-4" role="status">
        <p className="flex items-center gap-2 font-semibold text-gray-800">
          <Loader2 className="animate-spin motion-reduce:animate-none" size={18} />
          {analysis.status === 'loading'
            ? 'Waking Stockfish in your browser…'
            : `Searching${depth ? ` — depth ${depth}` : '…'}`}
        </p>
        <button type="button" className="tao-btn-ghost min-h-10 px-3" onClick={onCancel}>
          <X size={15} /> Stop
        </button>
      </div>
    );
  }

  if (analysis.status === 'complete') {
    return (
      <p className="mt-4 flex items-center gap-2 border border-correct bg-green-50 px-3 py-2 text-sm font-semibold text-green-800" role="status">
        <Sparkles size={17} /> Scan complete{analysis.cached ? ' — restored from this session' : ''}.
      </p>
    );
  }

  return null;
}

export default function EngineXRayPage() {
  const [searchParams] = useSearchParams();
  const customPosition = useMemo(
    () => customPositionFrom(searchParams),
    [searchParams],
  );
  const [selectedId, setSelectedId] = useState(
    () => customPosition?.id ?? ENGINE_XRAY_POSITIONS[0].id,
  );
  const position =
    selectedId === customPosition?.id ? customPosition : getEngineXrayPosition(selectedId);
  const [candidates, setCandidates] = useState([]);
  const [pickedCandidate, setPickedCandidate] = useState('');
  const [replyPrediction, setReplyPrediction] = useState('');
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalTargets, setLegalTargets] = useState([]);
  const [revealed, setRevealed] = useState(false);
  const [selectedDepth, setSelectedDepth] = useState(null);
  const [selectedRank, setSelectedRank] = useState(1);
  const [pvPly, setPvPly] = useState(0);

  const analysis = useStockfishAnalysis({
    fen: position.fen,
    depth: position.recommendedDepth,
    enabled: revealed,
  });
  const snapshots = analysis.depthSnapshots;
  const snapshot =
    snapshots.find((entry) => entry.depth === selectedDepth) ?? snapshots.at(-1) ?? null;
  const snapshotIndex = snapshot ? snapshots.findIndex((entry) => entry.depth === snapshot.depth) : -1;
  const previousSnapshot = snapshotIndex > 0 ? snapshots[snapshotIndex - 1] : null;
  const selectedLine =
    snapshot?.lines?.find((line) => line.rank === selectedRank) ?? snapshot?.lines?.[0] ?? null;
  const pvPreview = playPvPrefix(position.fen, selectedLine?.uciMoves ?? [], pvPly);
  const learner = analysis.learnerSide ?? position.orientation;
  const legalMoveOptions = useMemo(() => {
    const game = new Chess(position.fen);
    return game.moves({ verbose: true }).map((move) => ({
      uci: `${move.from}${move.to}${move.promotion ?? ''}`,
      san: move.san,
    }));
  }, [position.fen]);

  useEffect(() => {
    setCandidates([]);
    setPickedCandidate('');
    setReplyPrediction('');
    setSelectedSquare(null);
    setLegalTargets([]);
    setRevealed(false);
    setSelectedDepth(null);
    setSelectedRank(1);
    setPvPly(0);
  }, [position.id, position.fen]);

  useEffect(() => {
    const latest = snapshots.at(-1);
    if (latest && (selectedDepth == null || analysis.status === 'searching')) {
      setSelectedDepth(latest.depth);
    }
  }, [analysis.status, selectedDepth, snapshots]);

  useEffect(() => {
    setPvPly(0);
  }, [selectedRank, selectedDepth]);

  const addCandidate = (from, to, promotion = 'q') => {
    if (revealed || candidates.length >= 3) return false;
    let candidate;
    try {
      candidate = candidateMoveFromSquares(position.fen, from, to, promotion);
    } catch {
      return false;
    }
    setCandidates((current) => {
      if (current.some((entry) => entry.uci === candidate.uci)) return current;
      return [...current, candidate].slice(0, 3);
    });
    setSelectedSquare(null);
    setLegalTargets([]);
    setPickedCandidate('');
    return false;
  };

  const onSquareClick = (square) => {
    if (revealed || candidates.length >= 3) return;
    if (selectedSquare) {
      try {
        candidateMoveFromSquares(position.fen, selectedSquare, square);
        addCandidate(selectedSquare, square);
        return;
      } catch {
        // A different friendly piece may have been tapped; reselect it below.
      }
    }

    const game = new Chess(position.fen);
    const piece = game.get(square);
    if (!piece || piece.color !== game.turn()) {
      setSelectedSquare(null);
      setLegalTargets([]);
      return;
    }
    setSelectedSquare(square);
    setLegalTargets(game.moves({ square, verbose: true }).map((move) => move.to));
  };

  const matchedMoves = new Map(
    (snapshot?.lines ?? []).map((line) => [line.uciMoves[0], line.rank]),
  );
  const comparison = compareCandidates(candidates, snapshot ?? []);
  const candidateArrows = candidates.map((candidate) => [
    candidate.from,
    candidate.to,
    revealed && matchedMoves.has(candidate.uci) ? 'good' : 'idea',
  ]);
  const boardArrows = revealed
    ? [...pvPreview.arrows, ...(pvPly === 0 ? candidateArrows : [])]
    : candidateArrows;
  const matchingCandidate = candidates.find((candidate) => candidate.uci === selectedLine?.uciMoves?.[0]);

  const cancel = () => {
    analysis.cancel();
    setRevealed(false);
  };

  return (
    <div className="paper-texture min-h-screen border-t border-gray-200 bg-[#fbfaf4]">
      <section className="border-b border-gray-300 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
          <Link to="/" className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase text-gray-600 hover:text-brand-600">
            <ArrowLeft size={15} /> Arena
          </Link>
          <div className="mt-5 grid items-end gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-wide text-brand-600">
                Study Lab · Engine lens
              </p>
              <h1 className="mt-2 font-display text-4xl font-extrabold uppercase leading-none tracking-tight text-foreground md:text-6xl">
                Think like a <span className="text-brand-500">computer</span>
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-gray-700 md:text-lg">
                Make a human scan first. Then open Stockfish&apos;s hood: compare three candidate
                lines, rewind its changing judgment, and inspect the classical factors it measured.
              </p>
            </div>
            <ol className="grid grid-cols-4 divide-x divide-gray-300 border border-gray-300 bg-[#fbfaf4] text-center font-mono text-[0.62rem] font-bold uppercase text-gray-600">
              {['Scan', 'Reveal', 'Scrub', 'Ask'].map((step, index) => (
                <li key={step} className="px-2 py-3">
                  <span className="block text-brand-600">0{index + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8">
        <section className="study-panel mb-8 grid min-w-0 gap-4 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end" aria-labelledby="position-picker-title">
          <div className="min-w-0">
            <label id="position-picker-title" htmlFor="xray-position" className="font-mono text-xs font-bold uppercase tracking-wide text-gray-600">
              Training position
            </label>
            <select
              id="xray-position"
              value={position.id}
              onChange={(event) => setSelectedId(event.target.value)}
              className="mt-2 min-h-touch w-full border-2 border-gray-500 bg-white px-3 font-semibold focus:outline-none focus:ring-2 focus:ring-brand-300"
            >
              {customPosition && <option value={customPosition.id}>{customPosition.eyebrow} — {customPosition.title}</option>}
              {ENGINE_XRAY_POSITIONS.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.eyebrow} — {entry.title}</option>
              ))}
            </select>
          </div>
          <span className="study-chip w-fit border-brand-300 bg-brand-50 text-brand-700">
            {sideAtFen(position.fen)} to move
          </span>
        </section>

        <div className="grid min-w-0 items-start gap-8 xl:grid-cols-[minmax(0,34rem)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-6 xl:sticky xl:top-24">
            <BoardPanel
              fen={revealed ? pvPreview.fen : position.fen}
              orientation={position.orientation}
              variant="book"
              arePiecesDraggable={!revealed && candidates.length < 3}
              onPieceDrop={addCandidate}
              onSquareClick={onSquareClick}
              selectedSquare={selectedSquare}
              legalTargets={legalTargets}
              arrows={boardArrows}
              className="min-w-0 w-full max-w-full"
            />
            {revealed && selectedLine && (
              <div className="study-panel p-4">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    className="tao-btn-ghost min-h-10 px-3"
                    onClick={() => setPvPly((ply) => Math.max(0, ply - 1))}
                    disabled={pvPly === 0}
                    aria-label="Previous move in branch"
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <p className="text-center font-mono text-xs font-bold uppercase text-gray-600">
                    Branch {selectedLine.rank} · ply {pvPly}/{selectedLine.uciMoves.length}
                  </p>
                  <button
                    type="button"
                    className="tao-btn-ghost min-h-10 px-3"
                    onClick={() => setPvPly((ply) => Math.min(selectedLine.uciMoves.length, ply + 1))}
                    disabled={pvPly >= selectedLine.uciMoves.length}
                    aria-label="Next move in branch"
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Principal variation moves">
                  {selectedLine.sanMoves.map((san, index) => (
                    <button
                      key={`${index}-${san}`}
                      type="button"
                      onClick={() => setPvPly(index + 1)}
                      className={`border px-2 py-1 font-mono text-xs font-bold ${
                        pvPly === index + 1 ? 'border-foreground bg-foreground text-white' : 'border-gray-300 bg-white text-gray-700'
                      }`}
                    >
                      {san}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-6">
            <section className="study-panel-strong p-5" aria-labelledby="your-scan-title">
              <div className="flex items-start gap-3">
                <BrainCircuit className="mt-1 shrink-0 text-brand-500" size={23} />
                <div>
                  <p className="font-mono text-[0.65rem] font-bold uppercase tracking-wide text-brand-600">
                    Step 1 · before the engine
                  </p>
                  <h2 id="your-scan-title" className="font-display text-2xl font-bold uppercase tracking-tight">
                    Your Scan
                  </h2>
                </div>
              </div>
              <p className="mt-3 text-base leading-7 text-gray-700">{position.prompt}</p>
              <p className="mt-3 text-sm leading-6 text-gray-600">
                Drag a move, tap its start and destination, or use the legal-move picker. The board
                stays put so you can collect up to three candidates.
              </p>

              {!revealed && (
                <div className="mt-4 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="min-w-0">
                    <label htmlFor="candidate-picker" className="sr-only">Choose a legal candidate move</label>
                    <select
                      id="candidate-picker"
                      value={pickedCandidate}
                      onChange={(event) => setPickedCandidate(event.target.value)}
                      disabled={candidates.length >= 3}
                      className="min-h-touch w-full min-w-0 border-2 border-gray-500 bg-white px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:bg-gray-100"
                    >
                      <option value="">Choose a legal move…</option>
                      {legalMoveOptions.map((move) => (
                        <option key={move.uci} value={move.uci}>{move.san}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    className="tao-btn-ghost px-4"
                    disabled={!pickedCandidate || candidates.some((entry) => entry.uci === pickedCandidate)}
                    onClick={() => addCandidate(
                      pickedCandidate.slice(0, 2),
                      pickedCandidate.slice(2, 4),
                      pickedCandidate[4],
                    )}
                  >
                    Add candidate
                  </button>
                </div>
              )}

              <div className="mt-5 min-h-14">
                {candidates.length ? (
                  <div className="flex flex-wrap gap-2">
                    {candidates.map((candidate, index) => (
                      <span key={candidate.uci} className="inline-flex items-center border border-gray-500 bg-white">
                        <span className="border-r border-gray-500 bg-accent-yellow px-2 py-2 font-mono text-xs font-bold">
                          {index + 1}
                        </span>
                        <span className="px-3 py-2 font-book text-lg font-semibold">{candidate.san}</span>
                        {!revealed && (
                          <button
                            type="button"
                            onClick={() => setCandidates((current) => current.filter((entry) => entry.uci !== candidate.uci))}
                            className="min-h-10 border-l border-gray-500 px-2 hover:bg-red-50"
                            aria-label={`Remove ${candidate.san}`}
                          >
                            <X size={15} />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="border border-dashed border-gray-300 px-3 py-4 text-sm text-gray-500">
                    No candidates yet. Start with checks, captures, threats—or the position&apos;s
                    most urgent strategic feature.
                  </p>
                )}
              </div>

              <label htmlFor="reply-prediction" className="mt-5 block text-sm font-semibold text-gray-700">
                {position.predictionPrompt}
              </label>
              <input
                id="reply-prediction"
                value={replyPrediction}
                onChange={(event) => setReplyPrediction(event.target.value)}
                disabled={revealed}
                placeholder="Write a move or describe the idea…"
                className="mt-2 min-h-touch w-full border-2 border-gray-500 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:bg-gray-100"
              />

              {!revealed ? (
                <button
                  type="button"
                  onClick={() => setRevealed(true)}
                  disabled={candidates.length === 0}
                  className="tao-btn-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Eye size={18} /> Reveal Stockfish&apos;s scan
                </button>
              ) : (
                <button
                  type="button"
                  onClick={cancel}
                  className="tao-btn-ghost mt-5 w-full"
                >
                  <RotateCcw size={17} /> Hide engine and scan again
                </button>
              )}
              <AnalysisStatus analysis={analysis} onCancel={cancel} />
            </section>

            {revealed && (
              <>
                <TimeMachine
                  snapshots={snapshots}
                  snapshot={snapshot}
                  onDepthChange={setSelectedDepth}
                />
                <SearchBonsai
                  snapshot={snapshot}
                  previousSnapshot={previousSnapshot}
                  selectedRank={selectedLine?.rank ?? selectedRank}
                  onSelect={setSelectedRank}
                />

                <section className="study-panel p-5" aria-labelledby="radar-title">
                  <div className="flex items-start gap-3">
                    <Target className="mt-1 shrink-0 text-accent-orange" size={22} />
                    <div>
                      <p className="font-mono text-[0.65rem] font-bold uppercase tracking-wide text-accent-orange">
                        Strongest answer in this line
                      </p>
                      <h2 id="radar-title" className="font-display text-2xl font-bold uppercase tracking-tight">
                        Refutation Radar
                      </h2>
                    </div>
                  </div>
                  {selectedLine?.sanMoves?.[1] ? (
                    <p className="mt-4 text-base leading-7 text-gray-700">
                      After <strong>{selectedLine.sanMoves[0]}</strong>, Stockfish&apos;s current line
                      answers <strong className="text-accent-orange">{selectedLine.sanMoves[1]}</strong>
                      {selectedLine.sanMoves[2] ? `, and then ${selectedLine.sanMoves[2]}.` : '.'}
                    </p>
                  ) : (
                    <p className="mt-4 text-sm text-gray-500">Waiting for a branch long enough to show the best reply.</p>
                  )}
                  {replyPrediction && (
                    <div className="mt-4 border-l-4 border-brand-400 bg-brand-50 px-4 py-3">
                      <span className="font-mono text-[0.65rem] font-bold uppercase text-brand-700">Your forecast</span>
                      <p className="mt-1 text-sm leading-6 text-gray-700">{replyPrediction}</p>
                    </div>
                  )}
                </section>

                <section className="study-panel p-5" aria-labelledby="debrief-title">
                  <div className="flex items-start gap-3">
                    <Cpu className="mt-1 shrink-0 text-brand-500" size={22} />
                    <div>
                      <p className="font-mono text-[0.65rem] font-bold uppercase tracking-wide text-brand-600">
                        Human + machine
                      </p>
                      <h2 id="debrief-title" className="font-display text-2xl font-bold uppercase tracking-tight">
                        Debrief
                      </h2>
                    </div>
                  </div>
                  {snapshot?.lines?.length ? (
                    <div className="mt-4 space-y-3 text-sm leading-6 text-gray-700">
                      <p>
                        <strong>{comparison.debrief.headline}.</strong>{' '}
                        {comparison.debrief.detail} The current comparison is at depth {snapshot.depth}.
                      </p>
                      {matchingCandidate ? (
                        <p>
                          Your <strong>{matchingCandidate.san}</strong> is branch {selectedLine.rank}.
                          Replay it on the board and pay special attention to the opponent&apos;s first
                          answer.
                        </p>
                      ) : (
                        <p>
                          The selected engine branch begins <strong>{selectedLine?.sanMoves?.[0]}</strong>,
                          which was outside your list. Compare its urgency, target, and worst-case reply
                          with your candidates.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-gray-500">The debrief fills in after the first complete search depth.</p>
                  )}
                  <a href="#nimzo-coach" className="tao-btn-ghost mt-5 w-full">
                    <MessageCircle size={17} /> Ask the ghost about this branch
                  </a>
                </section>
              </>
            )}
          </div>
        </div>

        {revealed && (
          <div className="mt-8">
            <PositionXRay evaluation={analysis.staticEvaluation} learner={learner} />
          </div>
        )}

        <div className="mt-8" id="nimzo-coach">
          <NimzoCoach
            analysis={analysis}
            branch={selectedLine ? { depth: snapshot?.depth, line: selectedLine } : null}
            fen={position.fen}
            seedCardId={position.coachCardId}
          />
        </div>

        <aside className="mt-10 grid gap-4 border-t border-gray-300 py-6 md:grid-cols-3" aria-label="Engine X-Ray definitions">
          <Definition icon={<Gauge size={19} />} term="Depth" text="How many plies the engine has completed in its iterative search." />
          <Definition icon={<GitBranch size={19} />} term="PV" text="A current best line under perfect replies, not a prediction of what a person will play." />
          <Definition icon={<BookOpen size={19} />} term="Static eval" text="A classical ingredient table before deeper tactical search reshapes the verdict." />
          <p className="border-t-2 border-gray-200 pt-3 text-xs leading-5 text-gray-500 md:col-span-3">
            Analysis runs locally with{' '}
            <a className="font-semibold underline hover:text-brand-600" href="https://stockfishchess.org/">
              Stockfish 10
            </a>{' '}
            (GPL-3.0); no position or question is sent to an AI service.
          </p>
        </aside>
      </div>
    </div>
  );
}

function Definition({ icon, term, text }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-brand-500">{icon}</span>
      <p className="text-sm leading-6 text-gray-600">
        <strong className="text-foreground">{term}:</strong> {text}
      </p>
    </div>
  );
}
