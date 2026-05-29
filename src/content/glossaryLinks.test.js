import { describe, it, expect } from 'vitest';
import { findTermLinks, tokenizeTermLinks } from './glossaryLinks.js';

describe('findTermLinks', () => {
  it('extracts slugs and display text', () => {
    expect(findTermLinks('the [[center]] and a [[fork|forks]]')).toEqual([
      { slug: 'center', display: 'center' },
      { slug: 'fork', display: 'forks' },
    ]);
  });

  it('returns nothing when there are no links', () => {
    expect(findTermLinks('plain prose, no links')).toEqual([]);
  });
});

describe('tokenizeTermLinks', () => {
  it('splits prose into text and term segments in order', () => {
    expect(tokenizeTermLinks('a [[center|middle]] b')).toEqual([
      { type: 'text', value: 'a ' },
      { type: 'term', slug: 'center', display: 'middle' },
      { type: 'text', value: ' b' },
    ]);
  });

  it('handles a link at the very start', () => {
    expect(tokenizeTermLinks('[[pin]] is strong')).toEqual([
      { type: 'term', slug: 'pin', display: 'pin' },
      { type: 'text', value: ' is strong' },
    ]);
  });
});
