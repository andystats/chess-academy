import { NavLink, Link } from 'react-router-dom';
import clsx from 'clsx';

const LINKS = [
  { to: '/', label: 'Arena', end: true },
  { to: '/#make-your-own', label: 'Make Your Own', hash: true },
];

export default function AppHeader() {
  return (
    <header className="glass-panel sticky top-0 z-10 border-b-3 border-foreground">
      <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 sm:h-16 sm:flex-nowrap sm:py-0">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden>♞</span>
          <span className="font-display text-xl font-extrabold uppercase tracking-tight text-foreground">
            Chess <span className="font-book italic font-semibold normal-case tracking-normal text-brand-500">Academy</span>
          </span>
        </Link>
        <nav className="order-last w-full sm:order-none sm:ml-auto sm:w-auto">
          <ul className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1 font-mono text-xs font-bold uppercase tracking-wide sm:justify-end sm:gap-x-2">
            {LINKS.map((link) => (
              <li key={link.to}>
                {link.hash ? (
                  <Link
                    to={link.to}
                    className="border-b-2 border-transparent px-2 py-1.5 text-gray-500 transition-colors hover:text-brand-600"
                  >
                    {link.label}
                  </Link>
                ) : (
                  <NavLink
                    to={link.to}
                    end={link.end}
                    className={({ isActive }) =>
                      clsx(
                        'px-2 py-1.5 transition-colors',
                        isActive
                          ? 'border-b-2 border-foreground font-extrabold text-foreground'
                          : 'border-b-2 border-transparent text-gray-500 hover:text-brand-600',
                      )
                    }
                  >
                    {link.label}
                  </NavLink>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
