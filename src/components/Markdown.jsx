import { Fragment } from 'react';
import { tokenizeTermLinks } from '../content/glossaryLinks.js';

// Lightweight prose renderer for lesson/glossary text. Supports paragraphs, **bold**, and the
// custom [[term]] glossary syntax. `renderTerm({slug, display})` lets callers decide how a term
// renders — plain text by default (Stage 1a), a glossary popover link in Stage 1b.

const BOLD = /\*\*(.+?)\*\*/g;

function renderBold(text, keyPrefix, renderTerm) {
  let termKey = 0;
  const terms = (value) => tokenizeTermLinks(value).map((seg) =>
    <Fragment key={termKey++}>{seg.type === 'text' ? seg.value : renderTerm(seg)}</Fragment>);
  const nodes = [];
  let last = 0;
  for (const match of text.matchAll(BOLD)) {
    if (match.index > last) nodes.push(...terms(text.slice(last, match.index)));
    nodes.push(<strong key={`${keyPrefix}-b${match.index}`}>{terms(match[1])}</strong>);
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(...terms(text.slice(last)));
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
          {renderBold(para, `${pi}`, renderTerm)}
        </p>
      ))}
    </div>
  );
}
