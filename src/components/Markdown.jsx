import { Fragment } from 'react';
import { tokenizeTermLinks } from '../content/glossaryLinks.js';

// Lightweight prose renderer for lesson/glossary text. Supports paragraphs, **bold**, and the
// custom [[term]] glossary syntax. `renderTerm({slug, display})` lets callers decide how a term
// renders — plain text by default (Stage 1a), a glossary popover link in Stage 1b.

const BOLD = /\*\*(.+?)\*\*/g;

function renderBold(text, keyPrefix) {
  const nodes = [];
  let last = 0;
  for (const match of text.matchAll(BOLD)) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    nodes.push(<strong key={`${keyPrefix}-b${match.index}`}>{match[1]}</strong>);
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function defaultRenderTerm({ display }) {
  return display;
}

export default function Markdown({ children = '', renderTerm = defaultRenderTerm, className }) {
  const paragraphs = children.split(/\n{2,}/);
  return (
    <div className={className}>
      {paragraphs.map((para, pi) => (
        <p key={pi} className="mb-3 last:mb-0">
          {tokenizeTermLinks(para).map((seg, si) =>
            seg.type === 'text' ? (
              <Fragment key={si}>{renderBold(seg.value, `${pi}-${si}`)}</Fragment>
            ) : (
              <Fragment key={si}>{renderTerm(seg)}</Fragment>
            ),
          )}
        </p>
      ))}
    </div>
  );
}
