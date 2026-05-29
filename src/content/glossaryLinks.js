// Glossary cross-link syntax shared by the validator and the runtime Markdown renderer.
// Authors write `[[slug]]` or `[[slug|display text]]` inside lesson/glossary prose.

const TERM_LINK = /\[\[([^\]]+)\]\]/g;

/** All glossary term links in `markdown`, as { slug, display } in document order. */
export function findTermLinks(markdown) {
  return tokenizeTermLinks(markdown)
    .filter((seg) => seg.type === 'term')
    .map(({ slug, display }) => ({ slug, display }));
}

/**
 * Split `markdown` into an ordered list of segments for rendering: plain text runs and term
 * links. Each segment is { type: 'text', value } or { type: 'term', slug, display }. The single
 * place the [[term]] syntax is parsed (findTermLinks derives from this).
 */
export function tokenizeTermLinks(markdown) {
  const segments = [];
  let lastIndex = 0;
  for (const match of markdown.matchAll(TERM_LINK)) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: markdown.slice(lastIndex, match.index) });
    }
    const [slug, display] = match[1].split('|');
    segments.push({ type: 'term', slug: slug.trim(), display: (display ?? slug).trim() });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < markdown.length) {
    segments.push({ type: 'text', value: markdown.slice(lastIndex) });
  }
  return segments;
}

/**
 * Build a Map of term/alias -> entry from glossary entries. This is the single rule for what
 * makes a term resolvable (its `term` plus each trimmed `alias`), shared by the runtime registry
 * and the content validator so the two can never drift.
 */
export function indexGlossaryEntries(entries) {
  const index = new Map();
  for (const entry of entries) {
    index.set(entry.term, entry);
    for (const alias of entry.aliases ?? []) index.set(alias.trim(), entry);
  }
  return index;
}
