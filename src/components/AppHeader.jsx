import { Link } from 'react-router-dom';

export default function AppHeader() {
  return (
    <header className="glass-panel sticky top-0 z-10 border-b-3 border-foreground">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center px-4 py-2 sm:h-16 sm:py-0">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden>♞</span>
          <span className="font-display text-xl font-extrabold uppercase tracking-tight text-foreground">
            Chess <span className="font-book italic font-semibold normal-case tracking-normal text-brand-500">Academy</span>
          </span>
        </Link>
      </div>
    </header>
  );
}
