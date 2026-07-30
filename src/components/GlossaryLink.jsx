import { useState } from 'react';
import { getGlossaryIndex } from '../content/registry.js';

// The registry is static for the lifetime of the bundle, so build the alias-aware lookup once.
const GLOSSARY = getGlossaryIndex();

// Renders a [[term]] from lesson prose as an inline definition popover. It deliberately uses only
// inline elements because Markdown nests it inside a paragraph.
export default function GlossaryLink({ slug, display }) {
  const [open, setOpen] = useState(false);
  const entry = GLOSSARY.get(slug);

  // The content validator prevents dangling links; plain text remains a safe runtime fallback.
  if (!entry) return display;

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="font-semibold text-brand-600 underline decoration-dotted underline-offset-2 hover:text-brand-700"
        aria-expanded={open}
      >
        {display}
      </button>
      {open && (
        <span className="absolute left-0 top-full z-20 mt-1 block w-64 border-3 border-foreground bg-white p-3 text-left text-sm font-normal shadow-hard">
          <span className="block font-display font-bold capitalize text-foreground">{entry.term}</span>
          <span className="mt-1 block leading-5 text-gray-600">{entry.short}</span>
        </span>
      )}
    </span>
  );
}
