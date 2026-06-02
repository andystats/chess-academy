import { useState } from 'react';
import clsx from 'clsx';
import { Link2, RefreshCw, RotateCcw, Wifi } from 'lucide-react';
import { CapturedPieces, pairMoves, resultText } from './gamePanelParts.jsx';

// Control panel for an online game — a sibling of LocalGamePanel (same layout/styling), adapted for
// two remote players: connection status, your fixed colour, a turn/duck prompt, the move list, an
// invite-link copier, and a Resync escape hatch. Take-back is intentionally absent (see plan scope).

const VARIANT_LABEL = { standard: 'Standard chess', duck: 'Duck Chess' };

// Each online history entry is one player's completed turn; show the duck square alongside the move.
function moveLabel(entry) {
  if (!entry) return '';
  return entry.duck ? `${entry.san} 🦆${entry.duck}` : entry.san;
}

function statusText(game) {
  const { connection, result, currentTurn, selfColor, phase } = game;
  if (result) return resultText(result);
  if (connection.status === 'unconfigured') return 'Online play is not configured';
  if (connection.status === 'connecting') return 'Connecting…';
  if (connection.status === 'error') return 'Connection lost — try Resync';
  if (!connection.synced) return 'Waiting for host…';
  if (!connection.peerPresent) return 'Waiting for opponent to join…';
  const myTurn = currentTurn === selfColor;
  if (phase === 'duck' && myTurn) return 'Place the duck 🦆';
  return myTurn ? 'Your move' : "Opponent's move";
}

export default function OnlineGamePanel({ game }) {
  const [copied, setCopied] = useState(false);
  const pairs = pairMoves(game.history, moveLabel);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex w-full max-w-xl flex-col gap-5">
      <div>
        <p className="font-mono text-xs font-bold uppercase tracking-wide text-brand-600">Play a friend</p>
        <h1 className="mt-1 font-display text-3xl font-bold uppercase tracking-tight text-foreground">
          {VARIANT_LABEL[game.variant] ?? 'Online game'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          You are <span className="font-bold text-foreground">{game.selfColor}</span>. Share the link below so your
          opponent can join this same game.
        </p>
      </div>

      <div className="flex items-center gap-2 border-3 border-foreground bg-brand-50/40 p-3 text-sm">
        <Wifi size={18} className={clsx(game.connection.peerPresent ? 'text-correct' : 'text-gray-400')} />
        <span className="font-mono text-xs font-bold uppercase tracking-wide text-gray-500">
          {game.connection.peerPresent ? 'Opponent connected' : 'No opponent yet'}
        </span>
      </div>

      <div className="border-3 border-foreground bg-brand-50/40 p-4">
        <p className="font-mono text-xs font-bold uppercase tracking-wide text-gray-500">Status</p>
        <p
          className={clsx(
            'mt-1 font-display text-3xl font-bold uppercase tracking-tight',
            game.currentTurn === 'white' ? 'text-gray-950' : 'text-gray-700',
          )}
        >
          {statusText(game)}
        </p>
      </div>

      <CapturedPieces captured={game.captured} />

      {pairs.length > 0 && (
        <ol className="max-h-48 overflow-y-auto border-3 border-foreground bg-brand-50/40 p-3 font-mono text-sm leading-7 text-gray-700">
          {pairs.map((p) => (
            <li key={p.num} className="flex gap-3">
              <span className="w-6 shrink-0 text-gray-400">{p.num}.</span>
              <span className="w-24">{p.white}</span>
              <span className="w-24">{p.black}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button type="button" onClick={copyLink} className="tao-btn-primary">
          <Link2 size={18} /> {copied ? 'Link copied!' : 'Copy invite link'}
        </button>
        <button type="button" onClick={game.resync} className="tao-btn-ghost">
          <RefreshCw size={18} /> Resync
        </button>
        <button type="button" onClick={game.flipBoard} className="tao-btn-ghost">
          <RotateCcw size={18} /> Flip
        </button>
        {game.isHost && (
          <button type="button" onClick={game.newGame} className="tao-btn-ghost">
            New game
          </button>
        )}
      </div>
    </div>
  );
}
