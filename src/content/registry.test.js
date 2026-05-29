import { describe, it, expect } from 'vitest';
import { getContent, listByKind, listTracks, getGlossaryIndex, listGlossaryEntries } from './registry.js';

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

  it('groups lessons into known tracks', () => {
    const trackIds = listTracks().map((t) => t.id);
    expect(trackIds).toEqual(expect.arrayContaining(['classics', 'habits']));
    for (const track of listTracks()) expect(track.lessons.length).toBeGreaterThan(0);
  });

  it('builds a glossary index where aliases resolve to the same entry', () => {
    const index = getGlossaryIndex();
    const center = index.get('center');
    expect(center).toBeTruthy();
    expect(index.get('the center')).toBe(center); // alias
    expect(listGlossaryEntries().length).toBeGreaterThanOrEqual(10);
  });
});
