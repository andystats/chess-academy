import { useMemo, useState } from 'react';
import { BookOpen, Cpu, MessageCircle, Send, Sparkles } from 'lucide-react';
import { getCoachKnowledgeCard, retrieveCoachKnowledge } from '../coach/index.js';

const STARTER_TOPICS = [
  { cardId: 'prophylaxis', label: 'What does my opponent want?' },
  { cardId: 'blockade', label: 'How should I stop a passed pawn?' },
  { cardId: 'open-files', label: 'When is an open file useful?' },
];

function leadingLine(analysis, branch) {
  if (branch?.line?.sanMoves?.length) {
    return {
      depth: branch.depth,
      moves: branch.line.sanMoves.slice(0, 4),
      selected: true,
    };
  }
  const snapshots = analysis?.depthSnapshots ?? analysis?.snapshots ?? [];
  const latest = snapshots.at?.(-1) ?? snapshots[snapshots.length - 1];
  const line = latest?.lines?.[0];
  if (!line?.sanMoves?.length) return null;
  return {
    depth: latest.depth,
    moves: line.sanMoves.slice(0, 4),
    selected: false,
  };
}

function answerFrom(result, preferredCardId, analysis, branch) {
  const preferred = preferredCardId ? getCoachKnowledgeCard(preferredCardId) : null;
  const uncertain = result.confidence === 'low' || result.confidence === 'none';
  const card = uncertain && !preferred ? null : result.matches[0]?.card ?? preferred;
  const engine = leadingLine(analysis, branch);

  if (!card) {
    const weakMatch = result.confidence === 'low' && (result.matches[0]?.coverage ?? 0) < 0.5;
    const suggestedCardIds = weakMatch ? [] : result.fallback?.suggestedCardIds ?? [];
    const suggestions = suggestedCardIds
      .map((cardId) => getCoachKnowledgeCard(cardId))
      .filter(Boolean)
      .map((suggestion) => ({
        cardId: suggestion.id,
        label: suggestion.questions[0],
      }));

    return {
      confidence: 'none',
      text:
        (weakMatch
          ? 'I do not have a focused note for that yet. Try one of the suggested strategic topics.'
          : result.fallback?.message) ??
        'That lies beyond my present chapter notes. Ask me about a strategic feature you can point to on the board.',
      principles: [],
      citation: null,
      engine: null,
      followUps: suggestions.length ? suggestions : STARTER_TOPICS,
    };
  }

  return {
    confidence: uncertain ? 'nearest' : result.confidence,
    text: uncertain
      ? `The nearest idea in my notes is ${card.title.toLowerCase()}. ${card.summary}`
      : card.summary,
    principles: card.principles.slice(0, 2),
    citation: card.citation,
    engine: engine
      ? `Separately, Stockfish's ${engine.selected ? 'selected branch' : 'current leading line'} at depth ${engine.depth} begins ${engine.moves.join(' ')}.`
      : null,
    followUps: card.questions.slice(0, 3).map((label) => ({ cardId: card.id, label })),
  };
}

function topicPrompts(seedCardId) {
  const seed = seedCardId ? getCoachKnowledgeCard(seedCardId) : null;
  if (!seed) return STARTER_TOPICS;
  return seed.questions.slice(0, 3).map((label) => ({ cardId: seed.id, label }));
}

export default function NimzoCoach({
  analysis = null,
  branch = null,
  fen = null,
  seedCardId = null,
}) {
  const [query, setQuery] = useState('');
  const [exchange, setExchange] = useState(null);
  const prompts = useMemo(() => topicPrompts(seedCardId), [seedCardId]);
  const portraitUrl = `${import.meta.env.BASE_URL}nimzowitsch-ghost.webp`;

  const ask = (question, preferredCardId = null) => {
    const clean = question.trim();
    if (!clean) return;
    const result = retrieveCoachKnowledge(clean);
    setExchange({
      question: clean,
      answer: answerFrom(result, preferredCardId, analysis, branch),
    });
    setQuery('');
  };

  const submit = (event) => {
    event.preventDefault();
    ask(query);
  };

  const activePrompts = exchange?.answer?.followUps?.length ? exchange.answer.followUps : prompts;

  return (
    <section className="overflow-hidden border-2 border-foreground bg-[#fbfaf4]" aria-labelledby="nimzo-coach-title">
      <div className="grid border-b border-gray-300 sm:grid-cols-[9rem_minmax(0,1fr)]">
        <div className="relative min-h-40 overflow-hidden border-b border-gray-300 bg-brand-50 sm:min-h-full sm:border-b-0 sm:border-r">
          <img
            src={portraitUrl}
            alt="An original ink illustration of the fictional Ghost of Nimzowitsch"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
        <div className="p-5">
          <p className="font-mono text-xs font-bold uppercase tracking-wide text-brand-600">Nimzo Lens</p>
          <h2 id="nimzo-coach-title" className="mt-1 font-book text-3xl font-semibold text-foreground">
            The Ghost of Nimzowitsch
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            A fictional guide using original Chess Academy notes after <em>My System</em>. He cites
            chapters, not spirits—and leaves calculation to the engine. Opening questions get
            principles, not a memorized repertoire.
          </p>
          {fen && (
            <p className="mt-3 inline-flex items-center gap-1.5 border border-brand-300 bg-white px-2 py-1 font-mono text-[0.65rem] font-bold uppercase tracking-wide text-brand-700">
              <Sparkles size={13} /> Current board attached
            </p>
          )}
        </div>
      </div>

      <div className="space-y-5 p-5">
        {!exchange ? (
          <div className="flex gap-3" role="status">
            <MessageCircle className="mt-0.5 shrink-0 text-brand-500" size={20} />
            <p className="text-sm leading-6 text-gray-700">
              Show me the strategic feature that troubles you. I can discuss six reviewed ideas
              while the library is being built.
            </p>
          </div>
        ) : (
          <div className="space-y-4" aria-live="polite">
            <div className="ml-auto max-w-[90%] border border-gray-400 bg-white px-3 py-2 text-sm leading-6 text-gray-700">
              {exchange.question}
            </div>
            <div className="border-l-4 border-brand-400 pl-4">
              {exchange.answer.confidence === 'nearest' && (
                <p className="mb-2 font-mono text-[0.65rem] font-bold uppercase tracking-wide text-amber-700">
                  Nearest supported concept
                </p>
              )}
              <p className="text-sm leading-6 text-gray-700">{exchange.answer.text}</p>
              {exchange.answer.principles.length > 0 && (
                <ul className="mt-3 space-y-2 text-sm leading-5 text-gray-700">
                  {exchange.answer.principles.map((principle) => (
                    <li key={principle} className="flex gap-2">
                      <span className="font-bold text-brand-500" aria-hidden>→</span>
                      <span>{principle}</span>
                    </li>
                  ))}
                </ul>
              )}
              {exchange.answer.engine && (
                <p className="mt-4 flex gap-2 border border-gray-300 bg-white px-3 py-2 text-xs leading-5 text-gray-600">
                  <Cpu className="mt-0.5 shrink-0 text-gray-500" size={15} />
                  <span>
                    <strong className="text-gray-800">Engine note:</strong> {exchange.answer.engine}
                  </span>
                </p>
              )}
              {exchange.answer.citation && (
                <p className="mt-3 inline-flex items-start gap-1.5 font-mono text-[0.68rem] leading-5 text-gray-500">
                  <BookOpen className="mt-0.5 shrink-0" size={14} />
                  {exchange.answer.citation.label}
                </p>
              )}
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 font-mono text-[0.65rem] font-bold uppercase tracking-wide text-gray-500">
            Try asking
          </p>
          <div className="flex flex-wrap gap-2">
            {activePrompts.map((prompt) => (
              <button
                key={`${prompt.cardId}-${prompt.label}`}
                type="button"
                onClick={() => ask(prompt.label, prompt.cardId)}
                className="min-h-10 border border-gray-300 bg-white px-3 text-left text-xs font-semibold leading-4 text-gray-700 transition-colors hover:border-brand-400 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-300"
              >
                {prompt.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={submit} className="flex gap-2">
          <label htmlFor="nimzo-question" className="sr-only">Ask the Ghost of Nimzowitsch</label>
          <input
            id="nimzo-question"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ask about this position…"
            className="min-h-touch min-w-0 flex-1 border-2 border-gray-500 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
          <button type="submit" disabled={!query.trim()} className="tao-btn-primary px-4" aria-label="Ask the coach">
            <Send size={17} />
          </button>
        </form>
      </div>
    </section>
  );
}
