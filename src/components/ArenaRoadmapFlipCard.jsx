import { useState } from 'react';
import { ChevronRight, RotateCcw } from 'lucide-react';

const PHASES = [
  'Local two-player standard chess: shared board, legal moves, history, captured pieces.',
  'Duck Chess local rules: move a piece, place the duck, block lines, then pass the turn.',
  'Invite-link rooms: create a room, join as White or Black, sync moves in realtime.',
  'Persistence and polish: clocks, rematches, game records, spectators, and variant study boards.',
];

export default function ArenaRoadmapFlipCard() {
  const [flipped, setFlipped] = useState(false);

  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <button
        type="button"
        onClick={() => setFlipped((value) => !value)}
        className="group block w-full text-left [perspective:1200px]"
        aria-pressed={flipped}
      >
        <div
          className={`relative min-h-[17rem] transition-transform duration-500 [transform-style:preserve-3d] ${
            flipped ? '[transform:rotateY(180deg)]' : ''
          }`}
        >
          <div className="tao-card absolute inset-0 flex flex-col justify-between p-6 [backface-visibility:hidden] sm:p-8">
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-wide text-brand-600">Work in progress</p>
              <h2 className="mt-3 font-display text-3xl font-bold uppercase tracking-tight text-foreground">
                Two-player and Duck Chess roadmap
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-gray-600">
                We are starting with the smallest playable loop, then adding the variant rules and online rooms once
                the local game state is solid.
              </p>
            </div>
            <span className="mt-6 inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wide text-brand-600">
              Flip for the build plan <ChevronRight size={16} />
            </span>
          </div>

          <div className="tao-card absolute inset-0 flex flex-col justify-between bg-foreground p-6 text-white [backface-visibility:hidden] [transform:rotateY(180deg)] sm:p-8">
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-wide text-brand-300">Phased plan</p>
              <ol className="mt-4 space-y-3">
                {PHASES.map((phase, index) => (
                  <li key={phase} className="flex gap-3 text-sm leading-6 text-gray-100">
                    <span className="font-mono font-bold text-brand-300">{String(index + 1).padStart(2, '0')}</span>
                    <span>{phase}</span>
                  </li>
                ))}
              </ol>
            </div>
            <span className="mt-6 inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wide text-brand-300">
              <RotateCcw size={16} /> Flip back
            </span>
          </div>
        </div>
      </button>
    </section>
  );
}
