import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
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
    to: '/arena',
    label: 'Practice Arena',
    blurb: 'Try the ideas against a live engine, or play a full game.',
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

        <div className="mt-2 max-w-3xl text-center">
          <p className="font-mono text-xs font-bold uppercase tracking-wide text-brand-600">An open chess study room</p>
          <h1 className="mt-3 font-display text-4xl font-extrabold uppercase leading-[1.05] tracking-tight text-foreground md:text-6xl">
            Learn the idea.{' '}
            <span className="font-book italic font-semibold normal-case tracking-normal text-brand-500">Then play it.</span>
          </h1>
          <div className="gradient-divider mx-auto mt-5 w-20" />
        </div>

        <nav className="mt-10 grid w-full max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HOME_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="tao-card tao-card-hover group flex min-h-[11rem] flex-col p-5"
            >
              <span className="font-display text-lg font-bold uppercase tracking-tight text-foreground group-hover:text-brand-600">
                {link.label}
              </span>
              <span className="mt-2 block text-sm leading-6 text-gray-600">{link.blurb}</span>
              <ArrowRight className="mt-auto text-gray-300 transition-colors group-hover:text-brand-500" size={20} />
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
