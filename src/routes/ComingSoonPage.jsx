import { Link } from 'react-router-dom';

// Placeholder for routes whose features land in later stages (Puzzles → Stage 2, Reference → 4).
export default function ComingSoonPage({ title, blurb }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <p className="font-mono text-xs font-bold uppercase tracking-wide text-brand-600">Coming soon</p>
      <h1 className="mt-3 font-display text-4xl font-extrabold uppercase tracking-tight text-foreground">{title}</h1>
      <div className="gradient-divider mx-auto mt-4 w-16" />
      <p className="mt-5 text-gray-600">{blurb}</p>
      <Link to="/" className="tao-btn-ghost mt-7">
        Back to atrium
      </Link>
    </div>
  );
}
