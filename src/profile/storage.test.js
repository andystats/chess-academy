import { describe, it, expect } from 'vitest';
import { createStore } from './storage.js';

// Runs in the node env (no indexedDB), so createStore returns the in-memory fallback. That's the
// path we need to verify for graceful degradation, plus the per-profile progress key isolation
// that prevents one learner's progress from leaking into another's.

describe('storage (in-memory fallback)', () => {
  it('falls back to a non-persistent store when IndexedDB is unavailable', async () => {
    const store = await createStore();
    expect(store.persistent).toBe(false);
  });

  it('round-trips profiles and progress', async () => {
    const store = await createStore();
    await store.putProfile({ id: 'p1', name: 'Leo' });
    expect(await store.listProfiles()).toEqual([{ id: 'p1', name: 'Leo' }]);

    await store.putProgress('p1', 'classics/the-center', { status: 'complete' });
    expect(await store.getProgress('p1', 'classics/the-center')).toEqual({ status: 'complete' });

    await store.deleteProfile('p1');
    expect(await store.listProfiles()).toEqual([]);
  });

  it('isolates progress between profiles by key prefix', async () => {
    const store = await createStore();
    await store.putProgress('p1', 'lesson-a', { status: 'complete' });
    await store.putProgress('p2', 'lesson-b', { status: 'in-progress' });

    expect(await store.listProgress('p1')).toEqual({ 'lesson-a': { status: 'complete' } });
    expect(await store.listProgress('p2')).toEqual({ 'lesson-b': { status: 'in-progress' } });
  });
});
