import { useState } from 'react';
import { getGlossaryIndex } from '../content/registry.js';

// Glossary index is built once from the content registry.
const GLOSSARY = getGlossaryIndex();

// Renders a [[term]] from lesson prose as a tappable link that pops up a short definition. Used
// as Markdown's `renderTerm`. Kept entirely inline (spans only) since it lives inside a <p>;
// example boards live on the full Glossary page where block layout is valid.
export default function GlossaryLink({ slug, display }) {
  const [open, setOpen] = useState(false);
  const entry = GLOSSARY.get(slug);

  // Unknown term (the validator blocks dangling links, so this is a safety net): plain text.
  if (!entry) return display;

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="font-semibold text-brand-600 underline decoration-dotted underline-offset-2 hover:text-brand-700"
        aria-expanded={open}
      >
        {display}
      </button>
      {open && (
        <span className="absolute left-0 top-full z-20 mt-1 block w-64 rounded-2xl border border-gray-200 bg-white p-3 text-left text-sm font-normal shadow-lg">
          <span className="block font-display font-bold capitalize text-gray-900">{entry.term}</span>
          <span className="mt-1 block text-gray-600">{entry.short}</span>
        </span>
      )}
    </span>
  );
}
