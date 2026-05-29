import { listGlossaryEntries } from '../content/registry.js';
import BoardPanel from '../components/BoardPanel.jsx';

export default function GlossaryPage() {
  const entries = listGlossaryEntries();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold text-gray-900">Glossary</h1>
      <p className="mt-2 text-gray-600">Plain-language meanings for the chess words you'll meet in lessons.</p>

      {entries.length === 0 ? (
        <p className="mt-8 text-gray-500">Definitions are on their way — check back soon!</p>
      ) : (
        <dl className="mt-8 space-y-6">
          {entries.map((entry) => (
            <div key={entry.term} className="flex flex-col gap-3 border-b border-gray-100 pb-6 sm:flex-row sm:items-start sm:gap-6">
              <div className="sm:flex-1">
                <dt className="font-display text-lg font-bold capitalize text-gray-900">{entry.term}</dt>
                <dd className="mt-1 text-gray-700">{entry.short}</dd>
              </div>
              {entry.example && (
                <div className="w-40 shrink-0">
                  <BoardPanel
                    fen={entry.example.fen}
                    orientation={entry.example.orientation ?? 'white'}
                    highlights={entry.example.annotations?.highlight ?? []}
                    arrows={entry.example.annotations?.arrows ?? []}
                  />
                </div>
              )}
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
