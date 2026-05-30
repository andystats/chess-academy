import { indexGlossaryEntries } from './glossaryLinks.js';

// The content registry: a single source of truth derived from the files under src/content/.
// We eagerly import every content JSON via import.meta.glob (no separately generated manifest to
// keep in sync, and it works identically in dev/build/test). At Stage-1 scale eager loading is
// cheap; when the catalogue grows, the body load can switch to the glob's lazy importers.

const modules = import.meta.glob('./**/*.json', { eager: true });

// Each module's default export is the parsed JSON. Keep only real content envelopes (the JSON
// schema file under schema/ has no `kind`).
const envelopes = Object.values(modules)
  .map((m) => m.default ?? m)
  .filter((e) => e && typeof e === 'object' && e.kind);

const byId = new Map(envelopes.map((e) => [e.id, e]));

/** A content envelope by its stable id, or null. */
export function getContent(id) {
  return byId.get(id) ?? null;
}

/** All envelopes of a given kind. */
export function listByKind(kind) {
  return envelopes.filter((e) => e.kind === kind);
}

/** All practice-arena scenarios, in registry order. */
export function listScenarios() {
  return listByKind('scenario');
}

/** Lessons grouped by track, in a stable display order. */
export function listTracks() {
  const order = ['classics', 'habits'];
  const labels = { classics: 'Classics', habits: 'Thinking Habits' };
  const lessons = listByKind('lesson');
  return order
    .map((track) => ({
      id: track,
      label: labels[track] ?? track,
      lessons: lessons.filter((l) => l.track === track),
    }))
    .filter((t) => t.lessons.length > 0);
}

/**
 * A lookup of glossary term/alias -> entry, merged across all glossary files. Used by the
 * glossary page and by [[term]] links in lesson prose.
 */
export function getGlossaryIndex() {
  return indexGlossaryEntries(listByKind('glossary').flatMap((env) => env.body.entries));
}

/** All glossary entries, sorted by term, for the glossary index page. */
export function listGlossaryEntries() {
  const entries = listByKind('glossary').flatMap((env) => env.body.entries);
  return entries.sort((a, b) => a.term.localeCompare(b.term));
}
