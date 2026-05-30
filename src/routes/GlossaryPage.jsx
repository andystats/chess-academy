import { listGlossaryEntries } from '../content/registry.js';
import BoardPanel from '../components/BoardPanel.jsx';

export default function GlossaryPage() {
  const entries = listGlossaryEntries();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="font-mono text-xs font-bold uppercase tracking-wide text-brand-600">Board vocabulary</p>
      <h1 className="mt-3 font-display text-4xl font-extrabold uppercase tracking-tight text-foreground">Glossary</h1>
      <div className="gradient-divider mt-4 w-16" />
      <p className="mt-5 text-gray-600">Plain-language meanings for the chess terms used across lessons and book studies.</p>

      {entries.length === 0 ? (
        <p className="mt-8 text-gray-500">Definitions are on their way — check back soon!</p>
      ) : (
        <dl className="mt-8 space-y-6">
          {entries.map((entry) => (
            <div key={entry.term} className="flex flex-col gap-3 border-b border-gray-200 pb-6 sm:flex-row sm:items-start sm:gap-6">
              <div className="sm:flex-1">
                <dt className="font-display text-lg font-bold capitalize text-foreground">{entry.term}</dt>
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
