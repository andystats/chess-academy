import { Link } from 'react-router-dom';

// Placeholder for routes whose features land in later stages (Puzzles → Stage 2, Reference → 4).
export default function ComingSoonPage({ title, blurb }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="font-display text-3xl font-bold text-gray-900">{title}</h1>
      <p className="mt-2 text-gray-600">{blurb}</p>
      <Link to="/" className="mt-6 inline-flex min-h-touch items-center rounded-2xl border border-gray-200 px-6 font-semibold text-gray-700 hover:bg-gray-50">
        Back to atrium
      </Link>
    </div>
  );
}
