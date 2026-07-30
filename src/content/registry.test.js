import { describe, it, expect } from 'vitest';
import { getContent, getGlossaryIndex, listByKind } from './registry.js';

// Exercises the import.meta.glob-backed registry against the real shipped content.

describe('content registry', () => {
  it('loads lessons and exposes them by id', () => {
    const lesson = getContent('classics/the-center');
    expect(lesson).toBeTruthy();
    expect(lesson.kind).toBe('lesson');
    expect(getContent('does/not-exist')).toBe(null);
  });

  it('does not surface the JSON schema file as content', () => {
    const ids = listByKind('lesson').map((l) => l.id);
    expect(ids).toContain('classics/the-center');
    expect(ids).toContain('habits/checks-captures-threats');
  });

  it('indexes canonical glossary terms and their aliases for lesson popovers', () => {
    const glossary = getGlossaryIndex();
    expect(glossary.get('center')?.term).toBe('center');
    expect(glossary.get('central squares')?.term).toBe('center');
  });
});
