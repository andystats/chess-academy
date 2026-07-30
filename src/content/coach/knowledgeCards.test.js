import { coachKnowledgeCards, getCoachKnowledgeCard } from './knowledgeCards';

const EXPECTED_IDS = [
  'center-and-development',
  'open-files',
  'blockade',
  'pawn-chains',
  'prophylaxis',
  'overprotection',
];

describe('coachKnowledgeCards', () => {
  it('contains exactly the six pilot concepts with unique stable ids', () => {
    expect(coachKnowledgeCards.map((card) => card.id)).toEqual(EXPECTED_IDS);
    expect(new Set(coachKnowledgeCards.map((card) => card.id))).toHaveLength(
      coachKnowledgeCards.length,
    );
  });

  it('provides enough authored material for retrieval and coaching', () => {
    for (const card of coachKnowledgeCards) {
      expect(card.title.length).toBeGreaterThan(3);
      expect(card.aliases.length).toBeGreaterThanOrEqual(5);
      expect(card.tags.length).toBeGreaterThanOrEqual(4);
      expect(card.summary.length).toBeGreaterThan(140);
      expect(card.principles).toHaveLength(3);
      expect(card.questions).toHaveLength(3);
      expect(card.principles.every((principle) => principle.endsWith('.'))).toBe(true);
      expect(card.questions.every((question) => question.endsWith('?'))).toBe(true);
    }
  });

  it('uses chapter-level citations to the 1930 work', () => {
    for (const card of coachKnowledgeCards) {
      expect(card.citation).toMatchObject({
        author: 'Aron Nimzowitsch',
        title: 'My System',
        year: 1930,
      });
      expect(card.citation.part).toMatch(/^Part I{1,2}$/);
      expect(Number.isInteger(card.citation.chapter)).toBe(true);
      expect(card.citation.chapterTitle).toBeTruthy();
      expect(card.citation.label).toContain(`Chapter ${card.citation.chapter}`);
      expect(card.citation.label).not.toMatch(/\b(?:p|pp|page|pages)\.?\s*\d/i);
    }
  });

  it('contains no source files, OCR markers, page citations, or modern-edition references', () => {
    const publicText = JSON.stringify(coachKnowledgeCards);
    expect(publicText).not.toMatch(/materials(?:\/|\\\\)/i);
    expect(publicText).not.toMatch(/\.pdf\b/i);
    expect(publicText).not.toMatch(/\bOCR\b/i);
    expect(publicText).not.toMatch(/Quality Chess/i);
    expect(publicText).not.toMatch(/200[5-9]|201\d|202\d/);

    for (const card of coachKnowledgeCards) {
      expect(card).not.toHaveProperty('quote');
      expect(card).not.toHaveProperty('page');
      expect(card.citation).not.toHaveProperty('page');
    }
  });

  it('keeps every authored passage short enough to review rather than hide source-like excerpts', () => {
    const words = (passage) => passage.trim().split(/\s+/).length;

    for (const card of coachKnowledgeCards) {
      expect(words(card.summary)).toBeLessThanOrEqual(90);
      expect(card.principles.every((principle) => words(principle) <= 30)).toBe(true);
      expect(card.questions.every((question) => words(question) <= 24)).toBe(true);
    }
  });

  it('freezes the catalogue, cards, authored arrays, and citations', () => {
    expect(Object.isFrozen(coachKnowledgeCards)).toBe(true);
    for (const card of coachKnowledgeCards) {
      expect(Object.isFrozen(card)).toBe(true);
      expect(Object.isFrozen(card.aliases)).toBe(true);
      expect(Object.isFrozen(card.tags)).toBe(true);
      expect(Object.isFrozen(card.principles)).toBe(true);
      expect(Object.isFrozen(card.questions)).toBe(true);
      expect(Object.isFrozen(card.citation)).toBe(true);
    }
  });
});

describe('getCoachKnowledgeCard', () => {
  it('returns the canonical card singleton by id', () => {
    expect(getCoachKnowledgeCard('blockade')).toBe(coachKnowledgeCards[2]);
  });

  it('returns null for unknown or malformed ids', () => {
    expect(getCoachKnowledgeCard('unknown')).toBeNull();
    expect(getCoachKnowledgeCard()).toBeNull();
  });
});
