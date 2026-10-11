import { Play, Sparkles } from 'lucide-react';
import BoardPanel from '../BoardPanel.jsx';

export default function InlineDiagram({
  fen,
  orientation = 'white',
  title,
  caption,
  highlights = [],
  arrows = [],
  onLoadPosition,
  isCurrent = false,
}) {
  return (
    <figure className="my-6 overflow-hidden rounded-lg border border-amber-200/80 bg-white shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-6 p-4">
        {fen && (
          <div className="mx-auto w-44 shrink-0 sm:mx-0">
            <BoardPanel
              fen={fen}
              orientation={orientation}
              highlights={highlights}
              arrows={arrows}
              variant="book"
              className="w-full"
            />
          </div>
        )}
        <div className="mt-3 flex-1 min-w-0 sm:mt-0">
          {title && (
            <h4 className="font-display text-base font-bold text-foreground">
              {title}
            </h4>
          )}
          {caption && (
            <p className="mt-1 text-sm leading-6 text-gray-600">
              {caption}
            </p>
          )}
          {onLoadPosition && (
            <button
              type="button"
              onClick={onLoadPosition}
              className={`mt-3 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                isCurrent
                  ? 'bg-emerald-600 text-white'
                  : 'bg-foreground text-white hover:bg-brand-600'
              }`}
            >
              {isCurrent ? (
                <>
                  <Sparkles size={14} /> Active on Board
                </>
              ) : (
                <>
                  <Play size={14} /> Load to Main Board
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </figure>
  );
}
