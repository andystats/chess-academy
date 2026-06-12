import { useState } from 'react';
import clsx from 'clsx';
import { Link2, RefreshCw, RotateCcw, Flag } from 'lucide-react';
import { CapturedPieces, MoveList, pairMoves, resultText } from './gamePanelParts.jsx';
import ChatBox from './ChatBox.jsx';
import { VARIANTS } from '../online/rules.js';

// Control panel for an online game: a compact header + connection/turn status, captured pieces, a
// move list, and the chat box.

// Each online history entry is one player's completed turn — an OBJECT {pieceMove, san, duck}, not
// a SAN string — so the move list always needs this formatter (rendering the raw entry crashes React).
function moveLabel(entry) {
  if (!entry) return '';
  return entry.duck ? `${entry.san} 🦆${entry.duck}` : entry.san;
}

function statusText(game) {
  const { connection, result, currentTurn, selfColor, phase, isHost } = game;
  if (result) return resultText(result);
  if (connection.status === 'unconfigured') return 'Online play is not configured';
  if (connection.status === 'connecting') return 'Connecting…';
  if (connection.status === 'reconnecting') return 'Reconnecting…';
  if (connection.status === 'error') return 'Connection lost — try Resync';
  if (isHost && connection.hostPresent) return 'Game already open in another tab';
  if (connection.seatTaken) return 'Seat taken — watching as spectator';
  if (!connection.synced || !connection.liveSynced) return 'Waiting for host…';
  if (!connection.peerPresent) return 'Waiting for opponent…';
  const myTurn = currentTurn === selfColor;
  if (phase === 'duck' && myTurn) return 'Place the duck 🦆';
  return myTurn ? 'Your move' : "Opponent's move";
}

export default function OnlineGamePanel({ game }) {
  const [showCopySuccess, setShowCopySuccess] = useState(false);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setShowCopySuccess(true);
    setTimeout(() => setShowCopySuccess(false), 2000);
  };

  const status = game.connection.status;
  const pairs = pairMoves(game.history, moveLabel);

  return (
    <div className="flex h-full flex-col gap-6 p-4 lg:p-0">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold uppercase tracking-tight">
            {VARIANTS[game.variant]?.label}
          </h2>
          <div className="mt-1 flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-widest">
            <div
              className={clsx('h-2 w-2 rounded-full', {
                'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]': status === 'connected',
                'bg-yellow-500': status === 'connecting' || status === 'reconnecting',
                'bg-red-500': status === 'error' || status === 'unconfigured',
              })}
            />
            <span className="text-gray-500">{status}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={copyLink}
          className="group flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest text-gray-400 transition-colors hover:text-brand-600"
        >
          {showCopySuccess ? 'Link Copied!' : 'Copy Link'}
          <Link2 size={14} className="transition-transform group-hover:rotate-12" />
        </button>
      </div>

      <div className="flex flex-col gap-1 border-b-3 border-foreground pb-4">
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-gray-400">
          Turn status
        </p>
        <p className="font-display text-2xl font-bold uppercase tracking-tight">
          {statusText(game)}
        </p>
        {game.connection.seatTaken && (
          <p className="mt-1 text-xs font-bold text-red-500 underline decoration-red-500/30 underline-offset-2">
            SPECTATOR MODE (Seat Claimed)
          </p>
        )}
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto pr-1">
        {!game.result && status === 'connected' && game.connection.synced && !game.connection.peerPresent && (
          <p className="text-xs leading-5 text-gray-500">
            Your opponent isn&rsquo;t connected right now. Keep this tab open — the game resumes the
            moment they return — or re-send them the invite link above.
          </p>
        )}
        <CapturedPieces captured={game.captured} />
        <ChatBox messages={game.messages} onSend={game.sendChat} selfColor={game.selfColor} />
      </div>

      {pairs.length > 0 && (
        <details className="group border-t-3 border-foreground pt-4" open>
          <summary className="flex cursor-pointer list-none items-center justify-between font-mono text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-foreground">
            Move history
            <span className="transition-transform group-open:rotate-180">↓</span>
          </summary>
          <MoveList pairs={pairs} className="max-h-40 px-3 pb-3" columnClassName="w-24" />
        </details>
      )}

      <div className="flex flex-wrap items-center gap-2 text-left">
        <button type="button" onClick={game.resync} className="tao-btn-ghost text-sm">
          <RefreshCw size={16} /> Resync
        </button>
        <button type="button" onClick={game.flipBoard} className="tao-btn-ghost text-sm">
          <RotateCcw size={16} /> Flip
        </button>
        {!game.result && (
          <button type="button" onClick={game.resign} className="tao-btn-ghost text-sm">
            <Flag size={16} /> Resign
          </button>
        )}
        {game.isHost && (
          <button type="button" onClick={game.newGame} className="tao-btn-ghost text-sm">
            New game
          </button>
        )}
      </div>
    </div>
  );
}
