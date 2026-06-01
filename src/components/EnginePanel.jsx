import clsx from 'clsx';
import { RotateCcw, Undo2, Flag, RefreshCw, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { ENGINE_LEVEL_MARKS, ENGINE_MAX_LEVEL, ENGINE_MIN_LEVEL, levelConfig } from '../engine/levels.js';
import { PIECE_SYMBOLS } from '../engine/gameState.js';

// The play column for the Practice Arena: status, move list, strength dial, and game controls.
// Driven entirely by the controller returned from useEngineGame. The board lives in the sibling
// column (see LessonLayout). When `onSkillLevelChange` is provided a strength selector is shown
// (free play); scenarios fix the strength and omit it.

function pairMoves(history) {
  const pairs = [];
  for (let i = 0; i < history.length; i += 2) {
    pairs.push({ num: i / 2 + 1, white: history[i], black: history[i + 1] ?? '' });
  }
  return pairs;
}

function resultHeadline(winner, playerSide) {
  if (winner === playerSide) return 'You won!';
  if (winner === 'draw') return 'Draw.';
  if (winner) return 'You lost.';
  return 'Game stopped.';
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
    >
      {correct ? <CheckCircle2 className="mt-0.5 shrink-0" size={18} /> : <XCircle className="mt-0.5 shrink-0" size={18} />}
      <span>{feedback.text}</span>
    </div>
  );
}

function formatEvaluation(evaluation, playerSide) {
  if (!evaluation) return 'No score yet';
  const raw = playerSide === 'white' ? evaluation.white : -evaluation.white;
  if (evaluation.type === 'mate') {
    const label = Math.abs(raw);
    return raw >= 0 ? `Mate in ${label}` : `Mated in ${label}`;
  }
  const pawns = raw / 100;
  return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(1)}`;
}

function CapturedPieces({ captured }) {
  const whiteLost = captured?.white ?? [];
  const blackLost = captured?.black ?? [];

  return (
    <div className="grid gap-3 border-3 border-foreground bg-white p-4 text-sm sm:grid-cols-2">
      <CapturedRow label="White lost" color="white" pieces={whiteLost} />
      <CapturedRow label="Black lost" color="black" pieces={blackLost} />
    </div>
  );
}

function CapturedRow({ label, color, pieces }) {
  return (
    <div>
      <p className="font-mono text-[0.65rem] font-bold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 min-h-7 text-2xl leading-none text-foreground" aria-label={`${label}: ${pieces.join(', ') || 'none'}`}>
        {pieces.length ? pieces.map((piece, index) => <span key={`${piece}-${index}`}>{PIECE_SYMBOLS[color][piece]}</span>) : '—'}
      </p>
    </div>
  );
}

function EvaluationCard({ evaluation, playerSide }) {
  return (
    <div className="border-3 border-foreground bg-brand-50/40 p-4">
      <p className="font-mono text-xs font-bold uppercase tracking-wide text-gray-500">Engine score for you</p>
      <p className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground">{formatEvaluation(evaluation, playerSide)}</p>
      <p className="mt-1 text-xs leading-5 text-gray-500">Estimate from the last position Stockfish searched.</p>
    </div>
  );
}

function StrengthSlider({ value, onChange }) {
  const config = levelConfig(value);
  return (
    <div className="border-3 border-foreground bg-white p-4">
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-mono text-xs font-bold uppercase tracking-wide text-gray-500">Engine strength</p>
        <p className="font-semibold text-foreground">
          {config.label} <span className="text-sm text-gray-500">{config.rating}</span>
        </p>
      </div>
      <input
        type="range"
        min={ENGINE_MIN_LEVEL}
        max={ENGINE_MAX_LEVEL}
        step="1"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-4 h-2 w-full accent-brand-600"
        aria-label="Engine strength"
      />
      <div className="mt-2 flex justify-between font-mono text-[0.65rem] font-bold uppercase tracking-wide text-gray-400">
        {ENGINE_LEVEL_MARKS.map((mark) => (
          <span key={mark.value}>{mark.label}</span>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-gray-500">
        Lower levels use shallower Stockfish searches and lower skill settings.
      </p>
    </div>
  );
}

function StatusLine({ game }) {
  if (game.engineError) {
    return <p className="font-semibold text-retry">The engine could not load. Try reloading the page.</p>;
  }
  if (game.status === 'over') {
    const { winner, reason } = game.result ?? {};
    const won = winner === game.playerSide;
    const drawn = winner === 'draw';
    return (
      <p
        className={clsx(
          'font-display text-xl font-bold uppercase tracking-tight',
          won && 'text-correct',
          drawn && 'text-gray-700',
          !won && !drawn && 'text-retry',
        )}
      >
        {resultHeadline(winner, game.playerSide)}
        {reason && <span className="ml-1 font-sans text-sm font-medium normal-case text-gray-500">({reason})</span>}
      </p>
    );
  }
  if (game.status === 'engine-thinking') {
    return (
      <p className="inline-flex items-center gap-2 font-semibold text-brand-600">
        <Loader2 className="animate-spin" size={16} /> Stockfish is thinking…
      </p>
    );
  }
  return <p className="font-semibold text-gray-700">Your move.</p>;
}

export default function EnginePanel({ game, eyebrow, title, children, skillLevel, onSkillLevelChange }) {
  const pairs = pairMoves(game.history);

  return (
    <div className="flex w-full max-w-xl flex-col gap-5">
      <div>
        {eyebrow && <p className="font-mono text-xs font-bold uppercase tracking-wide text-brand-600">{eyebrow}</p>}
        {title && <h1 className="mt-1 font-display text-3xl font-bold uppercase tracking-tight text-foreground">{title}</h1>}
      </div>

      {children}

      <Feedback feedback={game.feedback} />

      <StatusLine game={game} />

      {onSkillLevelChange && (
        <StrengthSlider value={skillLevel} onChange={onSkillLevelChange} />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <EvaluationCard evaluation={game.evaluation} playerSide={game.playerSide} />
        <CapturedPieces captured={game.captured} />
      </div>

      {pairs.length > 0 && (
        <ol className="max-h-48 overflow-y-auto border-3 border-foreground bg-brand-50/40 p-3 font-mono text-sm leading-7 text-gray-700">
          {pairs.map((p) => (
            <li key={p.num} className="flex gap-3">
              <span className="w-6 shrink-0 text-gray-400">{p.num}.</span>
              <span className="w-16">{p.white}</span>
              <span className="w-16">{p.black}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button type="button" onClick={game.newGame} className="tao-btn-primary">
          <RefreshCw size={18} /> New game
        </button>
        <button
          type="button"
          onClick={game.takeBack}
          disabled={game.history.length === 0 || game.status === 'over'}
          className="tao-btn-ghost"
        >
          <Undo2 size={18} /> Take back
        </button>
        <button type="button" onClick={game.resign} disabled={game.status === 'over'} className="tao-btn-ghost">
          <Flag size={18} /> Resign
        </button>
        <button type="button" onClick={game.flipBoard} className="tao-btn-ghost">
          <RotateCcw size={18} /> Flip
        </button>
      </div>

      <p className="text-xs text-gray-400">
        Powered by <a href="https://stockfishchess.org/" className="underline hover:text-brand-600">Stockfish</a> (GPL-3.0), running in your browser.
      </p>
    </div>
  );
}
