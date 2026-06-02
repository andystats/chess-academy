import { PIECE_SYMBOLS } from '../engine/gameState.js';

// Presentation helpers shared by the two game control panels (LocalGamePanel, OnlineGamePanel): the
// result line, the captured-pieces grid, and move-list pairing. Kept here so the panels don't drift.

/** Human-readable outcome, or null while the game is ongoing. */
export function resultText(result) {
  if (!result) return null;
  if (result.winner === 'draw') return `Draw (${result.reason})`;
  return `${result.winner === 'white' ? 'White' : 'Black'} won (${result.reason})`;
}

/**
 * Pair a flat move history into {num, white, black} rows. `label` maps each entry to its display
 * string — identity for the local panel's SAN strings, a formatter for the online panel's turn entries.
 */
export function pairMoves(history, label = (entry) => entry ?? '') {
  const pairs = [];
  for (let i = 0; i < history.length; i += 2) {
    pairs.push({ num: i / 2 + 1, white: label(history[i]), black: label(history[i + 1]) });
  }
  return pairs;
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

export function CapturedPieces({ captured }) {
  return (
    <div className="grid gap-3 border-3 border-foreground bg-white p-4 text-sm sm:grid-cols-2">
      <CapturedRow label="White lost" color="white" pieces={captured.white} />
      <CapturedRow label="Black lost" color="black" pieces={captured.black} />
    </div>
  );
}
