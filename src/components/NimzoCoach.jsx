import { useMemo, useState } from 'react';
import { BookOpen, Cpu, KeyRound, Loader2, MessageCircle, Send, Settings2, Sparkles } from 'lucide-react';
import {
  LLM_PROVIDERS,
  analyzeHypotheticalMoves,
  askCoachCompanion,
  getCoachKnowledgeCard,
  loadLlmSettings,
  retrieveCoachKnowledge,
  saveLlmSettings,
  synthesizeDeterministicCoachReply,
} from '../coach/index.js';

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

function answerFrom(result, preferredCardId, analysis, branch, brief, coachingMode, question = '') {
  const preferred = preferredCardId ? getCoachKnowledgeCard(preferredCardId) : null;
  const uncertain = result.confidence === 'low' || result.confidence === 'none';
  const card = uncertain && !preferred ? null : result.matches[0]?.card ?? preferred;
  const engine = leadingLine(analysis, branch);
  const topMove = brief?.topMove ?? null;
  const hypotheticals = brief?.fen && question ? analyzeHypotheticalMoves(brief.fen, question) : [];
  const asksAboutTakeback =
    brief?.lastTakenBackReview &&
    /take\s*back|took\s*back|undid|undo|previous move|last move|why.*bad|why.*mistake|why.*blunder|what went wrong/i.test(
      question,
    );

  if (brief && (hypotheticals.length > 0 || asksAboutTakeback)) {
    const synth = synthesizeDeterministicCoachReply(question, brief, coachingMode);
    return {
      confidence: 'high',
      text: synth.text,
      principles: synth.principles ?? [],
      citation: synth.citation ? { label: synth.citation } : null,
      engine: engine
        ? `Separately, Stockfish's ${engine.selected ? 'selected branch' : 'current leading line'} at depth ${engine.depth} begins ${engine.moves.join(' ')}.`
        : null,
      followUps: (synth.followUps ?? []).map((label) => ({ cardId: preferredCardId, label })),
    };
  }

  if (!card) {
    // If we have a live coaching brief and the player asked about the current board, answer from the brief!
    if (brief && (brief.topMove || brief.whatToThinkAbout?.length)) {
      const thought = brief.whatToThinkAbout?.[0];
      const textParts = [];
      if (thought) {
        textParts.push(`${thought.label}: ${thought.text}`);
      }
      if (topMove && coachingMode !== 'guided') {
        textParts.push(`Stockfish recommends ${topMove.san} (${topMove.scoreLabel}) — ${topMove.why}`);
      }
      if (textParts.length > 0) {
        return {
          confidence: 'high',
          text: textParts.join(' '),
          principles: brief.strategyCard?.principles?.slice(0, 2) ?? [],
          citation: brief.strategyCard?.citation ?? null,
          engine: engine
            ? `Separately, Stockfish's ${engine.selected ? 'selected branch' : 'current leading line'} at depth ${engine.depth} begins ${engine.moves.join(' ')}.`
            : null,
          followUps: STARTER_TOPICS,
        };
      }
    }

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

  let engineNote = null;
  if (topMove && coachingMode !== 'guided') {
    engineNote = `Stockfish's optimal move at depth ${brief?.depth ?? engine?.depth ?? '—'} is ${topMove.san} (${topMove.scoreLabel}): ${topMove.why}${
      engine ? ` Leading line: ${engine.moves.join(' ')}.` : ''
    }`;
  } else if (engine) {
    engineNote = `Separately, Stockfish's ${engine.selected ? 'selected branch' : 'current leading line'} at depth ${engine.depth} begins ${engine.moves.join(' ')}.`;
  }

  return {
    confidence: uncertain ? 'nearest' : result.confidence,
    text: uncertain
      ? `The nearest idea in my notes is ${card.title.toLowerCase()}. ${card.summary}`
      : card.summary,
    principles: card.principles.slice(0, 2),
    citation: card.citation,
    engine: engineNote,
    followUps: card.questions.slice(0, 3).map((label) => ({ cardId: card.id, label })),
  };
}

function topicPrompts(seedCardId, brief) {
  const seed =
    (seedCardId ? getCoachKnowledgeCard(seedCardId) : null) ??
    (brief?.strategyCard?.id ? getCoachKnowledgeCard(brief.strategyCard.id) : null);
  if (!seed) return STARTER_TOPICS;
  return seed.questions.slice(0, 3).map((label) => ({ cardId: seed.id, label }));
}

export default function NimzoCoach({
  analysis = null,
  branch = null,
  brief = null,
  history = [],
  coachingMode = 'live',
  fen = null,
  seedCardId = null,
  embedded = false,
}) {
  const [query, setQuery] = useState('');
  const [exchange, setExchange] = useState(null);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [loadingLlm, setLoadingLlm] = useState(false);
  const [llmError, setLlmError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [llmSettings, setLlmSettings] = useState(() => loadLlmSettings());

  const prompts = useMemo(() => topicPrompts(seedCardId, brief), [seedCardId, brief]);
  const portraitUrl = `${import.meta.env.BASE_URL}nimzowitsch-ghost.webp`;
  const activeProvider =
    LLM_PROVIDERS.find((p) => p.id === llmSettings.provider) ?? LLM_PROVIDERS[0];

  const updateSettings = (patch) => {
    setLlmSettings((prev) => {
      const next = { ...prev, ...patch };
      if (patch.provider) {
        const providerMeta = LLM_PROVIDERS.find((p) => p.id === patch.provider);
        if (providerMeta) next.model = providerMeta.defaultModel;
      }
      saveLlmSettings(next);
      return next;
    });
  };

  const ask = async (question, preferredCardId = null) => {
    const clean = question.trim();
    if (!clean) return;
    setQuery('');
    setLlmError(null);

    if (llmSettings.provider !== 'builtin' && brief) {
      setLoadingLlm(true);
      try {
        const reply = await askCoachCompanion({
          question: clean,
          brief,
          history,
          conversationHistory,
          coachingMode,
          settings: llmSettings,
        });
        const engine = leadingLine(analysis, branch);
        setConversationHistory((prev) => [
          ...prev.slice(-5),
          { question: clean, answerText: reply.text },
        ]);
        setExchange({
          question: clean,
          answer: {
            confidence: 'high',
            text: reply.text,
            principles: reply.principles ?? [],
            citation: reply.citation ? { label: reply.citation } : null,
            engine: engine
              ? `Stockfish's ${engine.selected ? 'selected branch' : 'current leading line'} at depth ${engine.depth} begins ${engine.moves.join(' ')}.`
              : null,
            followUps: (reply.followUps ?? []).map((label) => ({ cardId: preferredCardId, label })),
            providerLabel: activeProvider.label,
          },
        });
        setLoadingLlm(false);
        return;
      } catch (err) {
        setLlmError(err?.message || 'LLM request failed — showing built-in coach response.');
        setLoadingLlm(false);
      }
    }

    const result = retrieveCoachKnowledge(clean);
    const builtInAnswer = answerFrom(
      result,
      preferredCardId,
      analysis,
      branch,
      brief,
      coachingMode,
      clean,
    );
    setConversationHistory((prev) => [
      ...prev.slice(-5),
      { question: clean, answerText: builtInAnswer.text },
    ]);
    setExchange({
      question: clean,
      answer: builtInAnswer,
    });
  };

  const submit = (event) => {
    event.preventDefault();
    ask(query);
  };

  const activePrompts = exchange?.answer?.followUps?.length ? exchange.answer.followUps : prompts;

  return (
    <section
      className={
        embedded
          ? 'flex h-full min-h-0 flex-col bg-[#fbfaf4]'
          : 'overflow-hidden border-2 border-foreground bg-[#fbfaf4]'
      }
      aria-labelledby="nimzo-coach-title"
    >
      {embedded ? (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-gray-300 bg-white px-4 py-2.5">
          <div className="flex items-center gap-3">
            <img
              src={portraitUrl}
              alt="An original ink illustration of the fictional Ghost of Nimzowitsch"
              className="h-9 w-9 shrink-0 border border-gray-300 object-cover"
            />
            <div>
              <h2 id="nimzo-coach-title" className="font-display text-base font-bold uppercase tracking-tight text-foreground">
                Ask the Coach
              </h2>
              <p className="font-mono text-[0.6rem] font-bold uppercase tracking-wide text-brand-700">
                Stockfish + Classical Strategy Companion
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowSettings((s) => !s)}
            className="inline-flex items-center gap-1.5 border border-gray-400 bg-white px-2.5 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-wide text-gray-700 hover:border-brand-500 hover:text-brand-700"
            aria-expanded={showSettings}
          >
            <Settings2 size={13} />
            {llmSettings.provider === 'builtin' ? 'Built-in Coach' : activeProvider.label}
          </button>
        </div>
      ) : (
        <div className="grid border-b border-gray-300 sm:grid-cols-[8rem_minmax(0,1fr)]">
          <div className="relative min-h-36 overflow-hidden border-b border-gray-300 bg-brand-50 sm:min-h-full sm:border-b-0 sm:border-r">
            <img
              src={portraitUrl}
              alt="An original ink illustration of the fictional Ghost of Nimzowitsch"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
          <div className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-xs font-bold uppercase tracking-wide text-brand-600">
                AI & Strategy Companion
              </p>
              <button
                type="button"
                onClick={() => setShowSettings((s) => !s)}
                className="inline-flex items-center gap-1.5 border border-gray-400 bg-white px-2.5 py-1 font-mono text-[0.65rem] font-bold uppercase tracking-wide text-gray-700 hover:border-brand-500 hover:text-brand-700"
                aria-expanded={showSettings}
              >
                <Settings2 size={13} />
                {llmSettings.provider === 'builtin' ? 'Built-in Coach' : activeProvider.label}
              </button>
            </div>
            <h2 id="nimzo-coach-title" className="mt-1 font-book text-2xl font-semibold text-foreground sm:text-3xl">
              Ask the Coach
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-gray-600">
              Grounded in Stockfish’s live calculation and classical chess literature (<em>My System</em>,{' '}
              <em>Chess Fundamentals</em>, opening principles, and endgame technique).
            </p>
            {fen && (
              <p className="mt-3 inline-flex items-center gap-1.5 border border-brand-300 bg-white px-2 py-1 font-mono text-[0.65rem] font-bold uppercase tracking-wide text-brand-700">
                <Sparkles size={13} /> Live board & engine brief attached
              </p>
            )}
          </div>
        </div>
      )}

      {showSettings && (
        <div className="shrink-0 border-b border-gray-300 bg-white p-3.5">
          <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wide text-gray-700">
            <KeyRound size={14} className="text-brand-600" />
            <span>Companion Model Settings</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-gray-600">
            Choose Built-in, Local Ollama, or Hosted Cloud Coach (Supabase Edge Function).
          </p>
          <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
            <div>
              <label htmlFor="llm-provider-select" className="block font-mono text-[0.65rem] font-bold uppercase text-gray-600">
                Provider
              </label>
              <select
                id="llm-provider-select"
                value={llmSettings.provider}
                onChange={(e) => updateSettings({ provider: e.target.value })}
                className="mt-1 min-h-9 w-full border border-gray-400 bg-white px-2.5 text-xs font-semibold"
              >
                {LLM_PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            {llmSettings.provider !== 'builtin' && (
              <div>
                <label htmlFor="llm-model-input" className="block font-mono text-[0.65rem] font-bold uppercase text-gray-600">
                  Model
                </label>
                <input
                  id="llm-model-input"
                  type="text"
                  value={llmSettings.model || ''}
                  onChange={(e) => updateSettings({ model: e.target.value })}
                  className="mt-1 min-h-9 w-full border border-gray-400 bg-white px-2.5 text-xs"
                />
              </div>
            )}
          </div>
          {activeProvider.requiresKey && (
            <div className="mt-2.5">
              <label htmlFor="llm-api-key" className="block font-mono text-[0.65rem] font-bold uppercase text-gray-600">
                API Key ({activeProvider.label})
              </label>
              <input
                id="llm-api-key"
                type="password"
                value={llmSettings.apiKey || ''}
                onChange={(e) => updateSettings({ apiKey: e.target.value })}
                placeholder={activeProvider.placeholderKey || 'Paste API key…'}
                className="mt-1 min-h-9 w-full border border-gray-400 bg-white px-2.5 text-xs"
              />
            </div>
          )}
          {llmSettings.provider === 'ollama' && (
            <div className="mt-2.5">
              <label htmlFor="llm-endpoint-input" className="block font-mono text-[0.65rem] font-bold uppercase text-gray-600">
                Ollama Endpoint
              </label>
              <input
                id="llm-endpoint-input"
                type="text"
                value={llmSettings.endpoint || 'http://localhost:11434'}
                onChange={(e) => updateSettings({ endpoint: e.target.value })}
                className="mt-1 min-h-9 w-full border border-gray-400 bg-white px-2.5 text-xs"
              />
            </div>
          )}
        </div>
      )}

      <div
        className={
          embedded
            ? 'flex min-h-0 flex-1 flex-col justify-between gap-3 p-4'
            : 'space-y-5 p-5'
        }
      >
        <div
          className={
            embedded
              ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain border border-gray-300 bg-white p-3.5 [scrollbar-gutter:stable]'
              : 'space-y-4'
          }
        >
          {llmError && (
            <p className="mb-3 border border-amber-400 bg-amber-50 px-3 py-2 text-xs text-amber-900" role="alert">
              {llmError}
            </p>
          )}

          {loadingLlm ? (
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-700" role="status">
              <Loader2 className="animate-spin" size={18} />
              <span>Consulting {activeProvider.label} with Stockfish’s position brief…</span>
            </div>
          ) : !exchange ? (
            <div className="flex gap-3" role="status">
              <MessageCircle className="mt-0.5 shrink-0 text-brand-500" size={20} />
              <p className="text-sm leading-6 text-gray-700">
                Ask me why Stockfish prefers a move, what threat you need to neutralize, or how classical
                principles (prophylaxis, blockade, open files, king safety, endgames) apply to this board.
              </p>
            </div>
          ) : (
            <div className="space-y-3" aria-live="polite">
              <div className="ml-auto max-w-[90%] border border-gray-300 bg-[#fbfaf4] px-3 py-2 text-xs font-semibold leading-5 text-gray-800">
                {exchange.question}
              </div>
              <div className="border-l-4 border-brand-400 pl-3.5">
                {exchange.answer.confidence === 'nearest' && (
                  <p className="mb-1.5 font-mono text-[0.65rem] font-bold uppercase tracking-wide text-amber-700">
                    Nearest supported concept
                  </p>
                )}
                <p className="whitespace-pre-line text-sm leading-6 text-gray-700">{exchange.answer.text}</p>
                {exchange.answer.principles.length > 0 && (
                  <ul className="mt-2.5 space-y-1.5 text-xs leading-5 text-gray-700">
                    {exchange.answer.principles.map((principle) => (
                      <li key={principle} className="flex gap-2">
                        <span className="font-bold text-brand-500" aria-hidden>→</span>
                        <span>{principle}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {exchange.answer.engine && (
                  <p className="mt-3 flex gap-2 border border-gray-300 bg-[#fbfaf4] px-2.5 py-2 text-xs leading-5 text-gray-600">
                    <Cpu className="mt-0.5 shrink-0 text-gray-500" size={14} />
                    <span>
                      <strong className="text-gray-800">Engine note:</strong> {exchange.answer.engine}
                    </span>
                  </p>
                )}
                {exchange.answer.citation && (
                  <p className="mt-2.5 inline-flex items-start gap-1.5 font-mono text-[0.65rem] leading-5 text-gray-500">
                    <BookOpen className="mt-0.5 shrink-0" size={13} />
                    {exchange.answer.citation.label}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 space-y-2.5">
          <div>
            <p className="mb-1.5 font-mono text-[0.62rem] font-bold uppercase tracking-wide text-gray-500">
              Try asking
            </p>
            <div className="flex flex-wrap gap-1.5">
              {activePrompts.map((prompt) => (
                <button
                  key={`${prompt.cardId ?? 'q'}-${prompt.label}`}
                  type="button"
                  onClick={() => ask(prompt.label, prompt.cardId)}
                  className="min-h-8 border border-gray-300 bg-white px-2.5 py-1 text-left text-xs font-semibold leading-4 text-gray-700 transition-colors hover:border-brand-400 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-300"
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
              placeholder="Ask about a threat, candidate move, or plan…"
              className="min-h-10 min-w-0 flex-1 border-2 border-gray-500 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
            <button type="submit" disabled={!query.trim() || loadingLlm} className="tao-btn-primary min-h-10 px-4" aria-label="Ask the coach">
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
