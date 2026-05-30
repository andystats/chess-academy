import clsx from 'clsx';
import { RotateCcw, Undo2, Flag, RefreshCw, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import SegmentedControl from './ui/SegmentedControl.jsx';

// The play column for the Practice Arena: status, move list, strength dial, and game controls.
// Driven entirely by the controller returned from useEngineGame. The board lives in the sibling
// column (see LessonLayout). When `onSkillLevelChange` is provided a strength selector is shown
// (free play); scenarios fix the strength and omit it.

// Sublabels are rough Elo approximations — Stockfish Skill Level doesn't map cleanly to a rating,
// and the short move time here makes it play below its full strength. They're a feel guide, not a gauge.
const SKILL_LABELS = [
  { value: 1, label: 'Gentle', sublabel: '~800' },
  { value: 4, label: 'Casual', sublabel: '~1100' },
  { value: 8, label: 'Club', sublabel: '~1500' },
  { value: 14, label: 'Tough', sublabel: '~1900' },
  { value: 20, label: 'Brutal', sublabel: '~2200' },
];

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
        <div>
          <p className="mb-2 font-mono text-xs font-bold uppercase tracking-wide text-gray-500">Engine strength</p>
          <SegmentedControl options={SKILL_LABELS} value={skillLevel} onChange={onSkillLevelChange} className="flex-wrap" />
        </div>
      )}

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
