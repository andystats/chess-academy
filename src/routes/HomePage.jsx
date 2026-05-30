import { Link } from 'react-router-dom';
import StylizedKingScene from '../components/StylizedKingScene.jsx';

const HOME_LINKS = [
  {
    to: '/training',
    label: '200 Point Path',
    blurb: 'Fast habits, short board examples, and practice lessons.',
  },
  {
    to: '/my-system',
    label: 'My System',
    blurb: 'A book-like study room for classic positional chess.',
  },
  {
    to: '/glossary',
    label: 'Glossary',
    blurb: 'Terms, examples, and board vocabulary.',
  },
];

export default function HomePage() {
  return (
    <section className="min-h-[calc(100vh-7.5rem)] bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center px-4 py-8 md:py-10">
        <div className="relative w-full max-w-4xl overflow-hidden">
          <div className="pointer-events-none absolute inset-x-8 bottom-12 top-10 bg-[linear-gradient(180deg,rgba(56,198,255,0.08),rgba(91,253,178,0.04)_45%,rgba(224,112,32,0.06))]" />
          <StylizedKingScene />
        </div>

        <nav className="mt-4 grid w-full max-w-4xl gap-0 border-y border-gray-200 md:grid-cols-3">
          {HOME_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="group border-b border-gray-200 px-0 py-5 transition-colors last:border-b-0 hover:bg-gray-50 md:border-b-0 md:border-r md:px-6 md:last:border-r-0"
            >
              <span className="font-display text-xl font-bold text-gray-950 group-hover:text-brand-600">{link.label}</span>
              <span className="mt-1 block max-w-xs text-sm leading-6 text-gray-600">{link.blurb}</span>
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
