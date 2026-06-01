import clsx from 'clsx';
import { RotateCcw, Undo2, Flag, RefreshCw, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { ENGINE_LEVEL_MARKS, ENGINE_MAX_LEVEL, ENGINE_MIN_LEVEL, levelConfig } from '../engine/levels.js';

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

function playerRelativeScore(evaluation, playerSide) {
  if (!evaluation) return null;
  const raw = playerSide === 'white' ? evaluation.white : -evaluation.white;
  return { type: evaluation.type, pawns: raw / 100, mate: raw };
}

function qualitativeScore(evaluation, playerSide) {
  const score = playerRelativeScore(evaluation, playerSide);
  if (!score) {
    return {
      headline: 'No read yet',
      detail: 'The engine will give a qualitative position read after it searches.',
      raw: '—',
      scale: 0,
    };
  }

  if (score.type === 'mate') {
    const side = score.mate >= 0 ? 'You' : 'Opponent';
    const label = Math.abs(score.mate);
    return {
      headline: `${side} can force mate`,
      detail: label === 1 ? 'Mate is immediate.' : `Mate is estimated in ${label}.`,
      raw: score.mate >= 0 ? `M${label}` : `-M${label}`,
      scale: score.mate >= 0 ? 1 : -1,
    };
  }

  const abs = Math.abs(score.pawns);
  let phrase;
  if (abs <= 1.25) phrase = 'nearly equal';
  else if (abs < 2) phrase = 'slight advantage';
  else if (abs < 4) phrase = 'clear advantage';
  else if (abs < 7) phrase = 'big advantage';
  else if (abs < 9) phrase = 'winning advantage';
  else phrase = 'should win without trouble';

  const side = score.pawns >= 0 ? 'You have' : 'Opponent has';
  return {
    headline: abs <= 1.25 ? 'Nearly equal' : phrase === 'should win without trouble' ? `${side} enough to win without trouble` : `${side} a ${phrase}`,
    detail: 'Treat large winning scores as a practical verdict, not a precise measurement.',
    raw: `${score.pawns >= 0 ? '+' : ''}${score.pawns.toFixed(1)}`,
    scale: Math.max(-1, Math.min(1, score.pawns / 9)),
  };
}

function colorScaleStyle(scale) {
  const clamped = Math.max(-1, Math.min(1, scale ?? 0));
  if (clamped === 0) return { backgroundColor: '#ffffff' };
  const alpha = 0.08 + Math.abs(clamped) * 0.28;
  const color = clamped > 0 ? `rgba(22, 163, 74, ${alpha})` : `rgba(220, 38, 38, ${alpha})`;
  return {
    background: `linear-gradient(90deg, ${color}, #ffffff 78%)`,
  };
}

function formatEvaluation(evaluation, playerSide) {
  const score = playerRelativeScore(evaluation, playerSide);
  if (!score) return '—';
  if (evaluation.type === 'mate') {
    const label = Math.abs(score.mate);
    return score.mate >= 0 ? `M${label}` : `-M${label}`;
  }
  return `${score.pawns >= 0 ? '+' : ''}${score.pawns.toFixed(1)}`;
}

function EvaluationCard({ evaluation, playerSide }) {
  const read = qualitativeScore(evaluation, playerSide);
  return (
    <div
      className="border-3 border-foreground p-4 transition-colors duration-300"
      style={colorScaleStyle(read.scale)}
    >
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-mono text-xs font-bold uppercase tracking-wide text-gray-500">Position read</p>
        <p className="font-mono text-xs font-bold uppercase tracking-wide text-gray-400">{formatEvaluation(evaluation, playerSide)}</p>
      </div>
      <p className="mt-2 font-display text-2xl font-bold uppercase tracking-tight text-foreground">{read.headline}</p>
      <p className="mt-2 text-xs leading-5 text-gray-500">{read.detail}</p>
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

      <EvaluationCard evaluation={game.evaluation} playerSide={game.playerSide} />

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
