import { describe, it, expect } from 'vitest';
import {
  lessonContentHash,
  freshProgress,
  reconcile,
  withStepComplete,
  withLessonComplete,
  sanitizeProgress,
} from './progress.js';

const lesson = {
  body: {
    steps: [
      { id: 'a', type: 'prose', fen: 'x' },
      { id: 'b', type: 'single-move', fen: 'y', solution: { san: ['e4'] } },
    ],
  },
};

describe('lessonContentHash', () => {
  it('is stable for the same content and changes when steps change', () => {
    const h1 = lessonContentHash(lesson);
    expect(lessonContentHash(lesson)).toBe(h1);
    const changed = { body: { steps: [...lesson.body.steps, { id: 'c', type: 'prose', fen: 'z' }] } };
    expect(lessonContentHash(changed)).not.toBe(h1);
  });
});

describe('reconcile', () => {
  it('creates fresh progress when none exists', () => {
    expect(reconcile(null, 'h')).toEqual(freshProgress('h'));
  });

  it('keeps progress when the content hash matches', () => {
    const p = withStepComplete(freshProgress('h'), 'a', 100);
    expect(reconcile(p, 'h')).toBe(p);
  });

  it('discards step-level progress when the content hash changed', () => {
    const p = withStepComplete(freshProgress('old'), 'a', 100);
    expect(reconcile(p, 'new')).toEqual(freshProgress('new'));
  });
});

describe('progress transitions', () => {
  it('tracks completed steps and does not rewind furthest on revisit', () => {
    let p = freshProgress('h');
    p = withStepComplete(p, 'a', 1);
    p = withStepComplete(p, 'b', 2);
    p = withStepComplete(p, 'a', 3); // revisit an earlier step
    expect(p.completedStepIds).toEqual(['a', 'b']);
    expect(p.furthestStepId).toBe('b'); // not rewound to 'a'
    expect(p.updatedAt).toBe(3); // timestamp still advances
  });

  it('marks a lesson complete', () => {
    const p = withLessonComplete(freshProgress('h'), 9);
    expect(p.status).toBe('complete');
    expect(p.updatedAt).toBe(9);
  });
});

describe('sanitizeProgress', () => {
  it('rejects non-objects', () => {
    expect(sanitizeProgress(null)).toBe(null);
    expect(sanitizeProgress('nope')).toBe(null);
  });

  it('coerces malformed fields to safe defaults', () => {
    const clean = sanitizeProgress({
      status: 'complete',
      completedStepIds: ['a', 42, 'b'], // 42 dropped
      furthestStepId: 99, // wrong type → null
      contentHash: 'abc',
      hintsUsed: 'x', // wrong type → 0
      updatedAt: 5,
    });
    expect(clean).toEqual({
      status: 'complete',
      completedStepIds: ['a', 'b'],
      furthestStepId: null,
      contentHash: 'abc',
      hintsUsed: 0,
      updatedAt: 5,
    });
  });

  it('defaults a non-array completedStepIds to []', () => {
    expect(sanitizeProgress({ completedStepIds: 'x' }).completedStepIds).toEqual([]);
  });
});
