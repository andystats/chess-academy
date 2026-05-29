// Pure helpers for per-lesson progress. Kept free of storage and Date so they're easy to test;
// callers pass timestamps in. Progress is keyed by the stable lesson id and tagged with a content
// hash: if a lesson's content changes between releases, step-level progress is invalidated (so a
// child never skips new material or shows false completion) while the record itself is replaced.

// Lesson envelopes are stable module singletons (from the content registry glob), so we can
// memoize the hash per lesson object and skip re-stringifying on every render.
const hashCache = new WeakMap();

/** A small, stable string hash (djb2) of the parts of a lesson that affect playthrough. */
export function lessonContentHash(lesson) {
  if (lesson && hashCache.has(lesson)) return hashCache.get(lesson);
  const steps = lesson?.body?.steps ?? [];
  const signature = JSON.stringify(
    steps.map((s) => [
      s.id,
      s.type,
      s.fen,
      s.solution,
      s.mainline,
      s.acceptableAt,
      s.options?.map((o) => [o.id, o.correct]), // include the correct flag: changing the answer must invalidate
    ]),
  );
  let hash = 5381;
  for (let i = 0; i < signature.length; i++) {
    hash = ((hash << 5) + hash + signature.charCodeAt(i)) | 0;
  }
  const result = (hash >>> 0).toString(36);
  if (lesson) hashCache.set(lesson, result);
  return result;
}

export function freshProgress(contentHash) {
  return {
    status: 'in-progress',
    furthestStepId: null,
    completedStepIds: [],
    contentHash,
    hintsUsed: 0,
    updatedAt: 0,
  };
}

/** Return usable progress for `contentHash`, discarding step-level data if the content changed. */
export function reconcile(progress, contentHash) {
  if (!progress) return freshProgress(contentHash);
  if (progress.contentHash !== contentHash) return freshProgress(contentHash);
  return progress;
}

/**
 * Record that a step was completed. Tracks the furthest step reached (by stepId): revisiting an
 * already-completed earlier step (common on backward navigation) updates the timestamp but does
 * not rewind furthestStepId.
 */
export function withStepComplete(progress, stepId, now) {
  const alreadyDone = progress.completedStepIds.includes(stepId);
  return {
    ...progress,
    completedStepIds: alreadyDone ? progress.completedStepIds : [...progress.completedStepIds, stepId],
    furthestStepId: alreadyDone ? progress.furthestStepId : stepId,
    updatedAt: now,
  };
}

export function withLessonComplete(progress, now) {
  return { ...progress, status: 'complete', updatedAt: now };
}

/** Coerce an untrusted (imported) progress value into a well-formed record, or null to skip it. */
export function sanitizeProgress(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    status: value.status === 'complete' ? 'complete' : 'in-progress',
    completedStepIds: Array.isArray(value.completedStepIds)
      ? value.completedStepIds.filter((s) => typeof s === 'string')
      : [],
    furthestStepId: typeof value.furthestStepId === 'string' ? value.furthestStepId : null,
    contentHash: typeof value.contentHash === 'string' ? value.contentHash : '',
    hintsUsed: Number.isFinite(value.hintsUsed) ? value.hintsUsed : 0,
    updatedAt: Number.isFinite(value.updatedAt) ? value.updatedAt : 0,
  };
}
