import { coachKnowledgeCards } from '../content/coach/knowledgeCards';

const DEFAULT_LIMIT = 3;
const MAX_LIMIT = coachKnowledgeCards.length;
const MINIMUM_SCORE = 5;
const DEFAULT_SUGGESTIONS = Object.freeze([
  'prophylaxis',
  'center-and-development',
  'open-files',
]);

const FIELD_WEIGHTS = Object.freeze({
  title: 8,
  aliases: 6,
  tags: 4,
  summary: 2,
  principles: 1,
  questions: 1,
});

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'can',
  'do',
  'does',
  'for',
  'how',
  'i',
  'in',
  'is',
  'it',
  'me',
  'my',
  'of',
  'on',
  'or',
  'should',
  'the',
  'their',
  'to',
  'what',
  'when',
  'where',
  'which',
  'with',
  'would',
  'you',
  'your',
]);

const CANONICAL_TOKENS = new Map(
  Object.entries({
    center: 'centre',
    centers: 'centre',
    central: 'centre',
    centres: 'centre',
    developed: 'develop',
    developing: 'develop',
    development: 'develop',
    develops: 'develop',
    files: 'file',
    rooks: 'rook',
    blockaded: 'blockade',
    blockader: 'blockade',
    blockaders: 'blockade',
    blockades: 'blockade',
    blockading: 'blockade',
    passer: 'passed',
    passers: 'passed',
    pawns: 'pawn',
    chains: 'chain',
    bases: 'base',
    prophylactic: 'prophylaxis',
    prevented: 'prevent',
    preventing: 'prevent',
    prevention: 'prevent',
    prevents: 'prevent',
    overprotected: 'overprotect',
    overprotecting: 'overprotect',
    overprotection: 'overprotect',
    overprotects: 'overprotect',
    protected: 'protect',
    protecting: 'protect',
    protection: 'protect',
    protects: 'protect',
    defenders: 'defender',
    squares: 'square',
    pieces: 'piece',
    openings: 'opening',
  }),
);

function canonicalToken(token) {
  const withoutPossessive = token.endsWith("'s") ? token.slice(0, -2) : token;
  return CANONICAL_TOKENS.get(withoutPossessive) ?? withoutPossessive;
}

function tokensFrom(value) {
  if (typeof value !== 'string') return [];
  const ascii = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘]/g, "'")
    .toLowerCase();
  const rawTokens = ascii.match(/[a-z0-9]+(?:'[a-z0-9]+)?/g) ?? [];
  return rawTokens.map(canonicalToken).filter((token) => token && !STOP_WORDS.has(token));
}

/** Normalize a coach query to the canonical, searchable token string used by the retriever. */
export function normalizeCoachQuery(query) {
  return [...new Set(tokensFrom(query))].join(' ');
}

function phraseFrom(value) {
  return tokensFrom(value).join(' ');
}

function tokenSet(values) {
  return new Set(values.flatMap((value) => tokensFrom(value)));
}

const indexedCards = coachKnowledgeCards.map((entry) => ({
  card: entry,
  phrases: {
    title: phraseFrom(entry.title),
    aliases: entry.aliases.map(phraseFrom),
  },
  fields: {
    title: tokenSet([entry.title]),
    aliases: tokenSet(entry.aliases),
    tags: tokenSet(entry.tags),
    summary: tokenSet([entry.summary]),
    principles: tokenSet(entry.principles),
    questions: tokenSet(entry.questions),
  },
}));

const documentFrequency = new Map();
for (const { fields } of indexedCards) {
  const allTokens = new Set(Object.values(fields).flatMap((field) => [...field]));
  for (const token of allTokens) {
    documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
  }
}

function inverseDocumentFrequency(token) {
  const frequency = documentFrequency.get(token) ?? 0;
  return 1 + Math.log((coachKnowledgeCards.length + 1) / (frequency + 1));
}

function containsPhrase(text, phrase) {
  if (!text || !phrase) return false;
  return ` ${text} `.includes(` ${phrase} `);
}

function scoreCard(indexed, queryTokens, normalizedQuery) {
  let score = 0;
  let exactPhrase = false;
  let phraseMatch = false;
  const matchedTerms = [];
  const matchedFields = new Set();

  for (const token of queryTokens) {
    let tokenMatched = false;
    const idf = inverseDocumentFrequency(token);
    for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
      if (!indexed.fields[field].has(token)) continue;
      score += weight * idf;
      tokenMatched = true;
      matchedFields.add(field);
    }
    if (tokenMatched) matchedTerms.push(token);
  }

  if (normalizedQuery === indexed.phrases.title) {
    score += 18;
    exactPhrase = true;
    phraseMatch = true;
    matchedFields.add('title');
  } else if (containsPhrase(normalizedQuery, indexed.phrases.title)) {
    score += 10;
    phraseMatch = true;
    matchedFields.add('title');
  }

  for (const alias of indexed.phrases.aliases) {
    if (normalizedQuery === alias) {
      score += 16;
      exactPhrase = true;
      phraseMatch = true;
      matchedFields.add('aliases');
      break;
    }
    if (alias.split(' ').length > 1 && containsPhrase(normalizedQuery, alias)) {
      score += 9;
      phraseMatch = true;
      matchedFields.add('aliases');
      break;
    }
  }

  return {
    card: indexed.card,
    score,
    coverage: queryTokens.length ? matchedTerms.length / queryTokens.length : 0,
    matchedTerms,
    matchedFields: Object.keys(FIELD_WEIGHTS).filter((field) => matchedFields.has(field)),
    exactPhrase,
    phraseMatch,
  };
}

function confidenceFor(top, second, queryTokens) {
  if (!top) return 'none';
  if (top.exactPhrase) return 'high';

  const discriminatingTerms = queryTokens.filter(
    (token) => (documentFrequency.get(token) ?? 0) <= 2,
  );
  const discriminatingCoverage = queryTokens.length
    ? discriminatingTerms.length / queryTokens.length
    : 0;
  const margin = second ? top.score - second.score : top.score;

  if (
    top.coverage >= 0.75 &&
    discriminatingCoverage >= 0.5 &&
    top.score >= 14 &&
    (top.phraseMatch || margin >= 3)
  ) {
    return 'high';
  }
  if (
    top.coverage >= 0.5 &&
    discriminatingCoverage > 0 &&
    top.score >= 8 &&
    margin >= 1
  ) {
    return 'medium';
  }
  return 'low';
}

function resultMatch(scored) {
  return Object.freeze({
    card: scored.card,
    score: Number(scored.score.toFixed(3)),
    coverage: Number(scored.coverage.toFixed(3)),
    matchedTerms: Object.freeze([...scored.matchedTerms]),
    matchedFields: Object.freeze([...scored.matchedFields]),
    exactPhrase: scored.exactPhrase,
  });
}

function normalizeLimit(limit) {
  if (!Number.isInteger(limit)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, limit));
}

function emptyResult(query, normalizedQuery, reason, message) {
  return Object.freeze({
    query,
    normalizedQuery,
    confidence: 'none',
    matches: Object.freeze([]),
    fallback: Object.freeze({
      reason,
      message,
      suggestedCardIds: DEFAULT_SUGGESTIONS,
    }),
  });
}

/**
 * Retrieve the most relevant coach cards for a free-text question.
 *
 * Returns `{ query, normalizedQuery, confidence, matches, fallback }`. Each match carries the
 * immutable card, a deterministic weighted score, query-term coverage, matched terms/fields, and
 * whether the query exactly matched its title or an alias. `fallback` is null for a confident
 * result and contains a reason/message/suggestions for empty, unmatched, or ambiguous queries.
 */
export function retrieveCoachKnowledge(query, options = {}) {
  const safeQuery = typeof query === 'string' ? query : '';
  const normalizedQuery = normalizeCoachQuery(safeQuery);
  const queryTokens = normalizedQuery ? normalizedQuery.split(' ') : [];

  if (!queryTokens.length) {
    return emptyResult(
      safeQuery,
      normalizedQuery,
      'empty-query',
      'Ask about a strategic feature or choose one of the suggested topics.',
    );
  }

  const ranked = indexedCards
    .map((indexed) => scoreCard(indexed, queryTokens, normalizedQuery))
    .filter((entry) => entry.score >= MINIMUM_SCORE)
    .sort(
      (a, b) =>
        b.score - a.score || b.coverage - a.coverage || a.card.id.localeCompare(b.card.id),
    );

  if (!ranked.length) {
    return emptyResult(
      safeQuery,
      normalizedQuery,
      'no-match',
      'I do not have a focused note for that yet. Try one of the suggested strategic topics.',
    );
  }

  const confidence = confidenceFor(ranked[0], ranked[1], queryTokens);
  const matches = Object.freeze(
    ranked.slice(0, normalizeLimit(options.limit)).map((entry) => resultMatch(entry)),
  );
  const fallback =
    confidence === 'low'
      ? Object.freeze({
          reason: 'ambiguous',
          message: 'That question could point to more than one idea. Choose a suggested topic.',
          suggestedCardIds: Object.freeze(matches.map((match) => match.card.id)),
        })
      : null;

  return Object.freeze({
    query: safeQuery,
    normalizedQuery,
    confidence,
    matches,
    fallback,
  });
}
