import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <p className="text-6xl" aria-hidden>♞</p>
      <h1 className="mt-4 font-display text-3xl font-bold text-gray-900">We couldn&apos;t find that page</h1>
      <p className="mt-2 text-gray-600">Maybe the knight moved it. Let&apos;s head back to the lessons.</p>
      <Link
        to="/"
        className="mt-6 inline-flex min-h-touch items-center rounded-2xl bg-brand-500 px-6 font-semibold text-white hover:bg-brand-600"
      >
        Back to lessons
      </Link>
    </div>
  );
}
