import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

// The top-of-page "back to <section>" link shared by the lesson and arena play pages.
export default function BackLink({ to, label }) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-4">
      <Link to={to} className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-brand-600">
        <ChevronLeft size={16} /> {label}
      </Link>
    </div>
  );
}
