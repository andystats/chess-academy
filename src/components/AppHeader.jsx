import { NavLink, Link } from 'react-router-dom';
import clsx from 'clsx';

const LINKS = [
  { to: '/', label: 'Atrium', end: true },
  { to: '/training', label: '200 Point Path' },
  { to: '/my-system', label: 'My System' },
  { to: '/glossary', label: 'Glossary' },
];

export default function AppHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 sm:h-16 sm:flex-nowrap sm:py-0">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden>♞</span>
          <span className="font-display text-xl font-bold text-gray-900">Chess Academy</span>
        </Link>
        <nav className="order-last w-full overflow-x-auto sm:order-none sm:ml-auto sm:w-auto">
          <ul className="flex items-center gap-1 whitespace-nowrap text-sm font-semibold">
            {LINKS.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    clsx(
                      'rounded-xl px-3 py-2 transition-colors',
                      isActive ? 'bg-accent-yellow text-gray-950' : 'text-gray-500 hover:bg-brand-50 hover:text-brand-600',
                    )
                  }
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
