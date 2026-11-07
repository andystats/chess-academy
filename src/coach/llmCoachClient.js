import { retrieveCoachKnowledge } from './retrieveKnowledge.js';
import { EXTENDED_STRATEGY_CARDS } from './strategyLibrary.js';
import { supabase, isRealtimeConfigured } from '../lib/supabase.js';

const STORAGE_KEY = 'chess-academy:llm-settings:v1';

export const LLM_PROVIDERS = Object.freeze([
  {
    id: 'builtin',
    label: 'Built-in Engine + Strategy Synthesizer (Instant, No Key)',
    requiresKey: false,
    defaultModel: 'stockfish-nimzo-hybrid',
  },
  {
    id: 'ollama',
    label: 'Local Ollama (http://localhost:11434 — Offline & Free)',
    requiresKey: false,
    defaultModel: 'llama3.2',
    defaultEndpoint: 'http://localhost:11434',
  },
  {
    id: 'supabase-edge',
    label: 'Hosted Cloud Coach (Supabase Edge Function Proxy)',
    requiresKey: false,
    defaultModel: 'server-configured',
  },
  {
    id: 'anthropic',
    label: 'Anthropic Claude API (Direct / BYOK)',
    requiresKey: true,
    defaultModel: 'claude-haiku-5-5',
    placeholderKey: 'sk-ant-...',
  },
  {
    id: 'openai',
    label: 'OpenAI API (Direct / BYOK)',
    requiresKey: true,
    defaultModel: 'gpt-4o-mini',
    placeholderKey: 'sk-...',
  },
  {
    id: 'gemini',
    label: 'Google Gemini API (Direct / BYOK)',
    requiresKey: true,
    defaultModel: 'gemini-2.5-flash',
    placeholderKey: 'AIza...',
  },
]);

function envDefaultSettings() {
  const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
  if (env.VITE_COACH_EDGE_FUNCTION === 'true' && isRealtimeConfigured) {
    return {
      provider: 'supabase-edge',
      apiKey: '',
      model: 'server-configured',
      endpoint: '',
    };
  }
  if (env.VITE_GEMINI_API_KEY) {
    return {
      provider: 'gemini',
      apiKey: env.VITE_GEMINI_API_KEY,
      model: 'gemini-2.5-flash',
      endpoint: '',
    };
  }
  if (env.VITE_OPENAI_API_KEY) {
    return {
      provider: 'openai',
      apiKey: env.VITE_OPENAI_API_KEY,
      model: 'gpt-4o-mini',
      endpoint: '',
    };
  }
  if (env.VITE_ANTHROPIC_API_KEY) {
    return {
      provider: 'anthropic',
      apiKey: env.VITE_ANTHROPIC_API_KEY,
      model: 'claude-haiku-5-5',
      endpoint: '',
    };
  }
  return {
    provider: 'builtin',
    apiKey: '',
    model: 'stockfish-nimzo-hybrid',
    endpoint: 'http://localhost:11434',
  };
}

export function loadLlmSettings() {
  const defaults = envDefaultSettings();
  if (typeof window === 'undefined' || !window.localStorage) return defaults;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      ...defaults,
      ...parsed,
    };
  } catch {
    return defaults;
  }
}

export function saveLlmSettings(settings) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Format the verified engine + board brief so an LLM never has to guess which piece is on which
 * square or hallucinate legal moves.
 */
export function formatStructuredBriefForPrompt(brief, history = [], coachingMode = 'live') {
  if (!brief) return 'No board position loaded.';
  const { facts, optimalMoves, whatToThinkAbout, lastMoveReview, strategyCard } = brief;

  const linesSummary = optimalMoves.length
    ? optimalMoves
        .map(
          (m) =>
            `  #${m.rank}: ${m.san} (${m.scoreLabel}) — ${m.why} [PV: ${m.pvSan.join(' ')}]`,
        )
        .join('\n')
    : '  (Engine search still in progress)';

  const threatsSummary =
    facts.opponentThreats.length > 0
      ? facts.opponentThreats.map((t) => `${t.san} (${t.description})`).join('; ')
      : 'No immediate forcing capture or mate threat if pass.';

  const hangingSummary =
    facts.threatenedPieces.length > 0
      ? facts.threatenedPieces
          .map(
            (v) =>
              `${v.pieceName} on ${v.square} (${v.isUndefended ? 'undefended' : 'pressured'} by ${v.leadAttackerName} on ${v.leadAttackerSquare})`,
          )
          .join('; ')
      : 'None';

  return [
    `FEN: ${brief.fen}`,
    `Side to move: ${facts.sideLabel} (Move ${facts.moveNumber}, Phase: ${facts.phase})`,
    `Recent moves: ${history.slice(-10).join(' ') || 'Game start'}`,
    `Coaching mode: ${coachingMode === 'guided' ? 'Guided Play (do NOT spoil the exact best move unless the player explicitly asks for the move)' : 'Live Coach (explain optimal moves and why)'}`,
    `Opponent threats if ${facts.sideLabel} passes: ${threatsSummary}`,
    `Vulnerable ${facts.sideLabel} squares: ${hangingSummary}`,
    `Open files: ${facts.structure.openFiles.join(', ') || 'none'} | Passed pawns: ${facts.structure.passedPawns.join(', ') || 'none'} (Opponent: ${facts.structure.enemyPassedPawns.join(', ') || 'none'})`,
    lastMoveReview ? `Last move played: ${lastMoveReview.moveSan} (${lastMoveReview.badge}) — ${lastMoveReview.summary}` : null,
    `Stockfish Top Candidate Lines (Depth ${brief.depth ?? '—'}):\n${linesSummary}`,
    `Key thoughts:\n${whatToThinkAbout.map((t) => `  - ${t.label}: ${t.text}`).join('\n')}`,
    strategyCard ? `Relevant literary concept: ${strategyCard.title} (${strategyCard.citation.label}) — ${strategyCard.summary}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

const SYSTEM_PROMPT = `You are the Chess Academy Grandmaster Coach—an insightful, warm, and deeply practical chess teacher who pairs real-time Stockfish engine calculation with classical strategic wisdom (Aron Nimzowitsch's My System, José Raúl Capablanca's Chess Fundamentals, Siegbert Tarrasch, and modern opening, middlegame, and endgame theory).

CRITICAL RULES:
1. NEVER invent moves or board facts that contradict the verified Stockfish & Board Brief provided to you.
2. Connect concrete tactics to strategic ideas—for example: "Castling (O-O) neutralizes the current threat on b7 while tucking your king to safety and bringing your rook into the game."
3. Keep responses concise (2 to 4 short paragraphs or bullet points), clear, and directly actionable for the player.
4. When Coaching Mode is "Guided Play", warn about threats, explain what to think about, and discuss strategic plans WITHOUT naming the exact top move unless the user explicitly asks "what is the best move?".`;

/**
 * Deterministic natural-language answer synthesizer that combines live board + Stockfish facts
 * with the strategy library when running in built-in mode (or as a fallback).
 */
export function synthesizeDeterministicCoachReply(question, brief, coachingMode = 'live') {
  const clean = (question ?? '').trim();
  const lower = clean.toLowerCase();
  const retrieval = retrieveCoachKnowledge(clean);

  // Also check extended strategy cards by keyword
  const matchedExtended = EXTENDED_STRATEGY_CARDS.find((card) =>
    card.aliases.some((alias) => lower.includes(alias.toLowerCase())) ||
    lower.includes(card.title.toLowerCase()),
  );
  const card =
    (retrieval.confidence === 'high' || retrieval.confidence === 'medium'
      ? retrieval.matches[0]?.card
      : null) ??
    matchedExtended ??
    brief?.strategyCard ??
    EXTENDED_STRATEGY_CARDS[0];

  const topMove = brief?.topMove;
  const secondMove = brief?.optimalMoves?.[1];
  const facts = brief?.facts;
  const thoughts = brief?.whatToThinkAbout ?? [];
  const asksForBestMove =
    /best move|optimal|what should i play|recommend|what move|hint|show move|engine like/i.test(lower);
  const asksAboutThreat =
    /threat|danger|watch out|opponent want|hanging|attacked|why.*bad|blunder|mistake/i.test(lower);
  const asksAboutPlan =
    /think about|plan|strategy|idea|why|evaluate|position|how should i/i.test(lower);

  const paragraphs = [];

  if (asksAboutThreat && facts) {
    if (facts.opponentThreats.length > 0) {
      const t = facts.opponentThreats[0];
      paragraphs.push(
        `Right now, ${facts.opponentLabel} ${t.description}. Addressing ${t.targetSquare} is your first priority before launching a new plan.`,
      );
      if (topMove && (coachingMode === 'live' || asksForBestMove)) {
        paragraphs.push(
          `Stockfish’s top choice is **${topMove.san}** (${topMove.scoreLabel}): ${topMove.why}`,
        );
      }
    } else if (facts.threatenedPieces.length > 0) {
      const v = facts.threatenedPieces[0];
      paragraphs.push(
        `Keep an eye on ${v.square}: your ${v.pieceName} is ${v.isUndefended ? 'undefended' : 'pressured'} by ${facts.opponentLabel}’s ${v.leadAttackerName} on ${v.leadAttackerSquare}.`,
      );
    } else {
      paragraphs.push(
        `There is no immediate forcing capture against your position if you pass, which gives you a tempo to improve piece coordination or initiate a plan.`,
      );
    }
  } else if (asksForBestMove && topMove) {
    paragraphs.push(
      `Stockfish’s optimal move here is **${topMove.san}** (${topMove.scoreLabel} at depth ${brief.depth ?? '—'}). ${topMove.why}`,
    );
    if (topMove.continuation) {
      paragraphs.push(topMove.continuation);
    }
    if (secondMove) {
      paragraphs.push(
        `A playable alternative is **${secondMove.san}** (${secondMove.scoreLabel}): ${secondMove.why}`,
      );
    }
  } else if (asksAboutPlan && thoughts.length > 0) {
    paragraphs.push(
      `In this ${facts?.phase ?? 'position'} (${facts?.sideLabel ?? 'side'} to move), focus on: **${thoughts[0].label}**—${thoughts[0].text}`,
    );
    if (topMove && coachingMode === 'live') {
      paragraphs.push(
        `Concretely, the engine favors **${topMove.san}** (${topMove.scoreLabel}): ${topMove.why}`,
      );
    }
  } else if (card) {
    paragraphs.push(card.summary);
    if (topMove && coachingMode === 'live') {
      paragraphs.push(
        `On the current board, Stockfish leads with **${topMove.san}** (${topMove.scoreLabel}): ${topMove.why}`,
      );
    }
  }

  return {
    provider: 'builtin',
    text: paragraphs.join('\n\n'),
    principles: card?.principles?.slice(0, 2) ?? [],
    citation: card?.citation?.label ?? null,
    followUps: [
      'What is the opponent threatening right now?',
      'What move does Stockfish think is optimal, and why?',
      ...(card?.questions?.slice(0, 2) ?? ['How should I improve my worst piece?']),
    ].slice(0, 3),
  };
}

/**
 * Query an external, server-proxied, or local LLM with the verified Stockfish + Board Coaching Brief.
 */
export async function askCoachCompanion({
  question,
  brief,
  history = [],
  coachingMode = 'live',
  settings = loadLlmSettings(),
  signal,
}) {
  if (!settings || settings.provider === 'builtin') {
    return synthesizeDeterministicCoachReply(question, brief, coachingMode);
  }

  const structuredBrief = formatStructuredBriefForPrompt(brief, history, coachingMode);
  const userPrompt = `Verified Position & Engine Brief:\n${structuredBrief}\n\nPlayer question: ${question}`;

  if (settings.provider === 'supabase-edge') {
    if (!supabase) {
      throw new Error(
        'Supabase is not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing). Deploy supabase/functions/coach-chat or choose Local Ollama / BYOK.',
      );
    }
    const { data, error } = await supabase.functions.invoke('coach-chat', {
      body: { structuredBrief, question, coachingMode },
    });
    if (error || data?.error) {
      throw new Error(error?.message || data?.error || 'Supabase Edge Function coach-chat failed.');
    }
    return {
      provider: 'supabase-edge',
      text: data?.text || 'No response returned from Cloud Coach.',
      principles: brief?.strategyCard?.principles?.slice(0, 2) ?? [],
      citation: brief?.strategyCard?.citation?.label ?? null,
      followUps: [
        'What is the opponent threatening right now?',
        'Why is the top engine move better than my alternative?',
        'What is the long-term plan in this pawn structure?',
      ],
    };
  }

  if (settings.provider === 'gemini') {
    if (!settings.apiKey?.trim()) {
      throw new Error('Please add your Gemini API key in Coach Settings, or switch to Local Ollama / Built-in Coach.');
    }
    const model = settings.model || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(settings.apiKey.trim())}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.35, maxOutputTokens: 450 },
      }),
    });
    if (!response.ok) {
      throw new Error(`Gemini API returned ${response.status}. Check your API key or model name.`);
    }
    const data = await response.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('\n').trim() ||
      'No response returned from Gemini.';
    return {
      provider: 'gemini',
      text,
      principles: brief?.strategyCard?.principles?.slice(0, 2) ?? [],
      citation: brief?.strategyCard?.citation?.label ?? null,
      followUps: [
        'What is the opponent threatening right now?',
        'Why is the top engine move better than my alternative?',
        'What is the long-term plan in this pawn structure?',
      ],
    };
  }

  if (settings.provider === 'openai') {
    if (!settings.apiKey?.trim()) {
      throw new Error('Please add your OpenAI API key in Coach Settings, or switch to Local Ollama / Built-in Coach.');
    }
    const model = settings.model || 'gpt-4o-mini';
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey.trim()}`,
      },
      signal,
      body: JSON.stringify({
        model,
        temperature: 0.35,
        max_tokens: 450,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
    if (!response.ok) {
      throw new Error(`OpenAI API returned ${response.status}. Check your API key.`);
    }
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content?.trim() || 'No response returned from OpenAI.';
    return {
      provider: 'openai',
      text,
      principles: brief?.strategyCard?.principles?.slice(0, 2) ?? [],
      citation: brief?.strategyCard?.citation?.label ?? null,
      followUps: [
        'What is the opponent threatening right now?',
        'Why is the top engine move better than my alternative?',
        'What is the long-term plan in this pawn structure?',
      ],
    };
  }

  if (settings.provider === 'anthropic') {
    if (!settings.apiKey?.trim()) {
      throw new Error('Please add your Anthropic API key in Coach Settings, or switch to Local Ollama / Built-in Coach.');
    }
    const model = settings.model || 'claude-haiku-5-5';
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey.trim(),
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      signal,
      body: JSON.stringify({
        model,
        max_tokens: 600,
        thinking: { type: 'disabled' },
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!response.ok) {
      throw new Error(`Anthropic API returned ${response.status}. Check your API key.`);
    }
    const data = await response.json();
    const text =
      data?.content
        ?.filter((block) => typeof block.text === 'string')
        .map((block) => block.text)
        .join('\n')
        .trim() ||
      'No response returned from Claude.';
    return {
      provider: 'anthropic',
      text,
      principles: brief?.strategyCard?.principles?.slice(0, 2) ?? [],
      citation: brief?.strategyCard?.citation?.label ?? null,
      followUps: [
        'What is the opponent threatening right now?',
        'Why is the top engine move better than my alternative?',
        'What is the long-term plan in this pawn structure?',
      ],
    };
  }

  if (settings.provider === 'ollama') {
    const base = (settings.endpoint || 'http://localhost:11434').replace(/\/+$/, '');
    const model = settings.model || 'llama3.2';
    const response = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
    if (!response.ok) {
      throw new Error(`Ollama returned ${response.status}. Make sure Ollama is running at ${base}.`);
    }
    const data = await response.json();
    const text = data?.message?.content?.trim() || 'No response returned from Ollama.';
    return {
      provider: 'ollama',
      text,
      principles: brief?.strategyCard?.principles?.slice(0, 2) ?? [],
      citation: brief?.strategyCard?.citation?.label ?? null,
      followUps: [
        'What is the opponent threatening right now?',
        'Why is the top engine move better than my alternative?',
        'What is the long-term plan in this pawn structure?',
      ],
    };
  }

  return synthesizeDeterministicCoachReply(question, brief, coachingMode);
}
