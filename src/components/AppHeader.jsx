import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import clsx from 'clsx';
import { ChevronDown, Users, Download } from 'lucide-react';
import { useProfile } from '../profile/ProfileContext.jsx';

const LINKS = [
  { to: '/', label: 'Lessons', end: true },
  { to: '/glossary', label: 'Glossary' },
  { to: '/puzzles', label: 'Puzzles' },
];

function ProfileMenu() {
  const { activeProfile, switchProfile, exportActiveProfile } = useProfile();
  const [open, setOpen] = useState(false);
  if (!activeProfile) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        className="flex items-center gap-1 rounded-xl px-2 py-1.5 hover:bg-gray-50"
      >
        <span className="text-xl" aria-hidden>{activeProfile.avatar}</span>
        <span className="hidden font-semibold text-gray-700 sm:inline">{activeProfile.name}</span>
        <ChevronDown size={16} className="text-gray-400" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-48 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            onClick={exportActiveProfile}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
          >
            <Download size={16} /> Export progress
          </button>
          <button
            type="button"
            onClick={switchProfile}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
          >
            <Users size={16} /> Switch player
          </button>
        </div>
      )}
    </div>
  );
}

export default function AppHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden>♞</span>
          <span className="font-display text-xl font-bold tracking-tight text-gray-900">Chess Academy</span>
        </Link>
        <nav className="ml-auto">
          <ul className="flex items-center gap-1 text-sm font-semibold">
            {LINKS.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    clsx(
                      'rounded-xl px-3 py-2 transition-colors',
                      isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:text-brand-600',
                    )
                  }
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <ProfileMenu />
      </div>
    </header>
  );
}
