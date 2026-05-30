import clsx from 'clsx';

// A section's eyebrow + heading, with the cyan-to-teal gradient rule beneath it. The accent word of
// a heading can be passed via `accent` to render it in Fraunces (the tao-rwd serif accent voice).
export default function SectionHeader({ eyebrow, title, accent, children, className, size = 'lg' }) {
  return (
    <div className={className}>
      {eyebrow && <p className="font-mono text-xs font-bold uppercase tracking-wide text-brand-600">{eyebrow}</p>}
      <h2
        className={clsx(
          'mt-3 font-display font-extrabold leading-tight text-foreground',
          size === 'xl' && 'text-5xl md:text-6xl',
          size === 'lg' && 'text-3xl md:text-4xl',
          size === 'md' && 'text-2xl',
        )}
      >
        {title}
        {accent && <span className="font-book italic font-semibold text-brand-500"> {accent}</span>}
      </h2>
      <div className="gradient-divider mt-4 w-16" />
      {children && <div className="mt-5 max-w-2xl text-lg leading-8 text-gray-700">{children}</div>}
    </div>
  );
}
