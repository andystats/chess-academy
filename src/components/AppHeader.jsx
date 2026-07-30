import { Link, NavLink } from 'react-router-dom';
import clsx from 'clsx';

export default function AppHeader() {
  return (
    <header className="glass-panel sticky top-0 z-10 border-b-3 border-foreground">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-3 px-4 py-2 sm:h-16 sm:py-0">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden>♞</span>
          <span className="font-display text-xl font-extrabold uppercase tracking-tight text-foreground">
            <span className="hidden sm:inline">Chess </span>
            <span className="font-book italic font-semibold normal-case tracking-normal text-brand-500">Academy</span>
          </span>
        </Link>
        <nav className="ml-auto flex items-center gap-1 sm:gap-2" aria-label="Primary">
          {[
            { to: '/', label: 'Arena', end: true },
            { to: '/my-system', label: 'My System' },
            { to: '/study/engine-xray', label: 'X-Ray' },
          ].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  'inline-flex min-h-touch items-center border-2 px-2 font-mono text-[0.65rem] font-bold uppercase tracking-wide transition-colors sm:px-3 sm:text-xs',
                  isActive
                    ? 'border-foreground bg-foreground text-white'
                    : 'border-transparent text-gray-600 hover:border-foreground hover:bg-white hover:text-foreground',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
