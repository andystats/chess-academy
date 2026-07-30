import {
  coachKnowledgeCards,
  normalizeCoachQuery,
  retrieveCoachKnowledge,
} from './index';

describe('normalizeCoachQuery', () => {
  it('normalizes case, punctuation, possessives, spelling, and common word forms', () => {
    expect(normalizeCoachQuery("What's DEVELOPING in the centers?")).toBe('develop centre');
    expect(normalizeCoachQuery("Opponent’s pawns and ROOKS")).toBe('opponent pawn rook');
  });

  it('removes stop words and repeated terms while preserving first-seen order', () => {
    expect(normalizeCoachQuery('How should I use the file, the FILE, and a rook?')).toBe(
      'use file rook',
    );
  });

  it('returns an empty string for blank or non-string input', () => {
    expect(normalizeCoachQuery('  ')).toBe('');
    expect(normalizeCoachQuery(null)).toBe('');
    expect(normalizeCoachQuery({ query: 'blockade' })).toBe('');
  });
});

describe('retrieveCoachKnowledge aliases', () => {
  it.each([
    ['rapid development', 'center-and-development'],
    ['rook highway', 'open-files'],
    ['stop a passer', 'blockade'],
    ['attack the chain base', 'pawn-chains'],
    ['what does my opponent want', 'prophylaxis'],
    ['defend a strong point twice', 'overprotection'],
  ])('maps "%s" to %s with high confidence', (query, expectedId) => {
    const result = retrieveCoachKnowledge(query);

    expect(result.confidence).toBe('high');
    expect(result.fallback).toBeNull();
    expect(result.matches[0].card.id).toBe(expectedId);
    expect(result.matches[0].exactPhrase).toBe(true);
    expect(result.matches[0].coverage).toBe(1);
  });

  it('treats center and centre as the same search term', () => {
    const american = retrieveCoachKnowledge('center');
    const british = retrieveCoachKnowledge('centre');

    expect(american.normalizedQuery).toBe('centre');
    expect(british.normalizedQuery).toBe('centre');
    expect(american.matches[0].card.id).toBe('center-and-development');
    expect(british.matches[0].card.id).toBe('center-and-development');
    expect(american.matches[0].score).toBe(british.matches[0].score);
  });
});

describe('retrieveCoachKnowledge ranking', () => {
  it('ranks a natural multi-term question by weighted field evidence', () => {
    const result = retrieveCoachKnowledge('How should my rook enter an open file?');
    const top = result.matches[0];

    expect(top.card.id).toBe('open-files');
    expect(result.confidence).toMatch(/^(?:high|medium)$/);
    expect(top.matchedTerms).toEqual(expect.arrayContaining(['rook', 'open', 'file']));
    expect(top.matchedFields).toEqual(
      expect.arrayContaining(['title', 'aliases', 'tags', 'summary']),
    );
    expect(top.score).toBeGreaterThan(result.matches[1]?.score ?? 0);
  });

  it('uses canonical morphology for prose questions', () => {
    const result = retrieveCoachKnowledge(
      'Which piece should be blockading my opponent’s passed pawns?',
    );

    expect(result.matches[0].card.id).toBe('blockade');
    expect(result.matches[0].matchedTerms).toEqual(
      expect.arrayContaining(['blockade', 'passed', 'pawn']),
    );
  });

  it('honors a bounded result limit', () => {
    expect(retrieveCoachKnowledge('pawn', { limit: 1 }).matches).toHaveLength(1);
    expect(retrieveCoachKnowledge('pawn', { limit: 99 }).matches.length).toBeLessThanOrEqual(
      coachKnowledgeCards.length,
    );
    expect(retrieveCoachKnowledge('pawn', { limit: 0 }).matches).toHaveLength(1);
    expect(retrieveCoachKnowledge('pawn', { limit: 2.5 }).matches.length).toBeLessThanOrEqual(3);
  });

  it('is deterministic across repeated calls', () => {
    const first = retrieveCoachKnowledge('restrict counterplay before I attack');
    const second = retrieveCoachKnowledge('restrict counterplay before I attack');

    expect(second).toEqual(first);
  });

  it('matches tokens rather than substrings', () => {
    const result = retrieveCoachKnowledge('profile');

    expect(result.matches).toEqual([]);
    expect(result.confidence).toBe('none');
    expect(result.fallback.reason).toBe('no-match');
  });
});

describe('retrieveCoachKnowledge confidence and fallback', () => {
  it('returns an empty-query fallback with deterministic starting topics', () => {
    const result = retrieveCoachKnowledge('the and what');

    expect(result).toMatchObject({
      confidence: 'none',
      matches: [],
      fallback: {
        reason: 'empty-query',
        suggestedCardIds: ['prophylaxis', 'center-and-development', 'open-files'],
      },
    });
  });

  it('sanitizes non-string input into the same safe empty fallback', () => {
    const result = retrieveCoachKnowledge({ query: 'blockade' });

    expect(result.query).toBe('');
    expect(result.normalizedQuery).toBe('');
    expect(result.confidence).toBe('none');
    expect(result.fallback.reason).toBe('empty-query');
  });

  it('returns a no-match fallback instead of guessing', () => {
    const result = retrieveCoachKnowledge('banana telescope');

    expect(result.confidence).toBe('none');
    expect(result.matches).toEqual([]);
    expect(result.fallback.reason).toBe('no-match');
  });

  it('marks a broad, overlapping pawn query as ambiguous and keeps candidates as suggestions', () => {
    const result = retrieveCoachKnowledge('pawn');

    expect(result.confidence).toBe('low');
    expect(result.matches.length).toBeGreaterThan(1);
    expect(result.fallback.reason).toBe('ambiguous');
    expect(result.fallback.suggestedCardIds).toEqual(
      result.matches.map((match) => match.card.id),
    );
  });

  it('returns immutable result containers for safe reuse by UI state', () => {
    const result = retrieveCoachKnowledge('prophylaxis');

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.matches)).toBe(true);
    expect(Object.isFrozen(result.matches[0])).toBe(true);
    expect(Object.isFrozen(result.matches[0].matchedTerms)).toBe(true);
    expect(Object.isFrozen(result.matches[0].matchedFields)).toBe(true);
  });
});
