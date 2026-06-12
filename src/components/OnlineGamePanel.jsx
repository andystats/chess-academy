import { useState } from 'react';
import clsx from 'clsx';
import { Link2, RefreshCw, RotateCcw, Flag } from 'lucide-react';
import { CapturedPieces, MoveList, pairMoves, resultText } from './gamePanelParts.jsx';
import ChatBox from './ChatBox.jsx';
import { VARIANTS } from '../online/rules.js';

// Control panel for an online game: a compact header + connection/turn status, captured pieces, a
// chat box with your opponent, a collapsible move list, and the invite-link / resync / flip / new-game
// controls. Take-back is intentionally absent (cross-peer undo needs agreement).

// Each online history entry is one player's completed turn; show the duck square alongside the move.
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
    <div className="flex w-full max-w-md flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold uppercase tracking-tight text-foreground">
            {VARIANTS[game.variant]?.label ?? 'Online game'}
          </h1>
          <p className="font-mono text-xs font-bold uppercase tracking-wide text-gray-500">
            You&rsquo;re <span className="text-brand-600">{game.selfColor}</span>
          </p>
        </div>
        <button type="button" onClick={copyLink} className="tao-btn-ghost shrink-0 text-sm">
          <Link2 size={16} /> {copied ? 'Copied!' : 'Invite'}
        </button>
      </div>

      <div className="flex items-center gap-2 border-3 border-foreground bg-brand-50/40 px-3 py-2">
        <span
          className={clsx('h-2.5 w-2.5 shrink-0 rounded-full', game.connection.peerPresent ? 'bg-correct' : 'bg-gray-300')}
          aria-hidden="true"
        />
        <span className="font-display text-base font-bold uppercase tracking-tight text-foreground">
          {statusText(game)}
        </span>
      </div>

      {!game.result && game.connection.status === 'connected' && game.connection.synced && !game.connection.peerPresent && (
        <p className="text-xs leading-5 text-gray-500">
          Your opponent isn&rsquo;t connected right now. Keep this tab open — the game resumes the
          moment they return — or re-send them the invite link above.
        </p>
      )}

      <CapturedPieces captured={game.captured} />

      <ChatBox messages={game.messages} onSend={game.sendChat} selfColor={game.selfColor} />

      {pairs.length > 0 && (
        <details className="border-3 border-foreground bg-brand-50/40">
          <summary className="cursor-pointer px-3 py-2 font-mono text-xs font-bold uppercase tracking-wide text-gray-500">
            Moves ({pairs.length})
          </summary>
          <MoveList pairs={pairs} className="max-h-40 px-3 pb-3" columnClassName="w-24" />
        </details>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={game.resync} className="tao-btn-ghost text-sm">
          <RefreshCw size={16} /> Resync
        </button>
        <button type="button" onClick={game.flipBoard} className="tao-btn-ghost text-sm">
          <RotateCcw size={16} /> Flip
        </button>
        {game.isHost && (
          <button type="button" onClick={game.newGame} className="tao-btn-ghost text-sm">
            New game
          </button>
        )}
      </div>
    </div>
  );
}
 && (
          <button type="button" onClick={game.newGame} className="tao-btn-ghost text-sm">
            New game
          </button>
        )}
      </div>
    </div>
  );
}
