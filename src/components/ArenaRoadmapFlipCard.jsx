import { Code2, Github, Rocket, Settings2 } from 'lucide-react';

const STEPS = [
  {
    icon: Github,
    title: 'Clone it',
    text: 'Fork the GitHub repo, clone your fork, and install the app locally.',
    command: 'git clone <your-fork-url>\nnpm install',
  },
  {
    icon: Code2,
    title: 'Change the room',
    text: 'Edit the React components, add practice positions, tune the styling, or swap in your own chess variants.',
    command: 'npm run dev',
  },
  {
    icon: Rocket,
    title: 'Host it',
    text: 'Push to GitHub and connect the repo to Vercel. Static play works immediately; online rooms use Supabase Realtime env vars.',
    command: 'VITE_SUPABASE_URL=...\nVITE_SUPABASE_ANON_KEY=...',
  },
];

export default function ArenaRoadmapFlipCard() {
  return (
    <section id="make-your-own" className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-wide text-brand-600">Make your own</p>
          <h2 className="mt-2 font-display text-3xl font-bold uppercase tracking-tight text-foreground">
            Clone the room, change the rules
          </h2>
        </div>
        <a
          href="https://github.com/andystats/chess-academy"
          className="tao-btn-ghost self-start text-sm"
          target="_blank"
          rel="noreferrer"
        >
          <Github size={16} /> Open repo
        </a>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, text, command }) => (
          <article key={title} className="tao-card flex min-h-[17rem] flex-col p-5">
            <div className="flex items-start justify-between gap-4">
              <h3 className="font-display text-xl font-bold uppercase tracking-tight text-foreground">{title}</h3>
              <Icon className="shrink-0 text-brand-500" size={24} />
            </div>
            <p className="mt-3 text-sm leading-6 text-gray-600">{text}</p>
            <pre className="mt-auto overflow-x-auto border-2 border-foreground bg-foreground p-3 font-mono text-xs leading-5 text-brand-100">
              <code>{command}</code>
            </pre>
          </article>
        ))}
      </div>

      <div className="mt-5 border-3 border-foreground bg-brand-50/40 p-5">
        <div className="flex items-start gap-3">
          <Settings2 className="mt-1 shrink-0 text-brand-600" size={20} />
          <p className="text-sm leading-6 text-gray-700">
            The stack is intentionally ordinary: Vite, React, Tailwind, chess.js, Stockfish, Supabase
            Realtime for invite-link games, and Vercel for hosting. That keeps the Arena easy to read,
            easy to remix, and cheap to run.
          </p>
        </div>
      </div>
    </section>
  );
}
