import { PIECE_SYMBOLS } from '../engine/gameState.js';

// Presentation helpers for the game control panel(s): the result line, the captured-pieces grid, and
// move-list pairing. Kept separate so they're easy to reuse if another panel is added later.

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

/** The paired move history as a scrollable numbered list (rows from pairMoves above). */
export function MoveList({ pairs, className = 'max-h-48', columnClassName = 'w-16' }) {
  return (
    <ol className={`${className} overflow-y-auto font-mono text-sm leading-7 text-gray-700`}>
      {pairs.map((p) => (
        <li key={p.num} className="flex gap-3">
          <span className="w-6 shrink-0 text-gray-400">{p.num}.</span>
          <span className={columnClassName}>{p.white}</span>
          <span className={columnClassName}>{p.black}</span>
        </li>
      ))}
    </ol>
  );
}

function CapturedRow({ label, color, pieces }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[0.65rem] font-bold uppercase tracking-wide text-gray-500">{label}</p>
      <div
        className="mt-2 flex min-h-16 flex-wrap content-start items-start gap-x-1 gap-y-2 text-2xl leading-none text-foreground"
        aria-label={`${label}: ${pieces.join(', ') || 'none'}`}
      >
        {pieces.length ? (
          pieces.map((piece, index) => (
            <span key={`${piece}-${index}`} className="inline-flex h-7 w-6 items-center justify-center">
              {PIECE_SYMBOLS[color][piece]}
            </span>
          ))
        ) : (
          <span className="inline-flex h-7 items-center">—</span>
        )}
      </div>
    </div>
  );
}

export function CapturedPieces({ captured }) {
  return (
    <div className="grid gap-4 border-3 border-foreground bg-white p-4 text-sm sm:grid-cols-2">
      <CapturedRow label="White lost" color="white" pieces={captured.white} />
      <CapturedRow label="Black lost" color="black" pieces={captured.black} />
    </div>
  );
}
