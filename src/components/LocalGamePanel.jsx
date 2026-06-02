import clsx from 'clsx';
import { RefreshCw, RotateCcw, Undo2 } from 'lucide-react';
import { CapturedPieces, pairMoves, resultText } from './gamePanelParts.jsx';

export default function LocalGamePanel({ game }) {
  const pairs = pairMoves(game.history);
  const over = game.status === 'over';

  return (
    <div className="flex w-full max-w-xl flex-col gap-5">
      <div>
        <p className="font-mono text-xs font-bold uppercase tracking-wide text-brand-600">Work in progress</p>
        <h1 className="mt-1 font-display text-3xl font-bold uppercase tracking-tight text-foreground">Local Two-Player</h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          Standard chess on one shared board. This is the first slice toward online rooms and Duck Chess.
        </p>
      </div>

      <div className="border-3 border-foreground bg-brand-50/40 p-4">
        <p className="font-mono text-xs font-bold uppercase tracking-wide text-gray-500">Turn</p>
        <p
          className={clsx(
            'mt-1 font-display text-3xl font-bold uppercase tracking-tight',
            game.currentTurn === 'white' ? 'text-gray-950' : 'text-gray-700',
          )}
        >
          {over ? resultText(game.result) : `${game.currentTurn} to move`}
        </p>
      </div>

      <div>
        <p className="mb-2 font-mono text-xs font-bold uppercase tracking-wide text-gray-500">Variant</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" className="tao-btn-primary justify-start">
            Standard chess
          </button>
          <button type="button" className="tao-btn-ghost justify-start opacity-60" disabled>
            Duck Chess next
          </button>
        </div>
      </div>

      <CapturedPieces captured={game.captured} />

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
          disabled={game.history.length === 0}
          className="tao-btn-ghost"
        >
          <Undo2 size={18} /> Take back
        </button>
        <button type="button" onClick={game.flipBoard} className="tao-btn-ghost">
          <RotateCcw size={18} /> Flip
        </button>
      </div>
    </div>
  );
}
