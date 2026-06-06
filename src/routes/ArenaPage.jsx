import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Swords, Cpu, Globe, Github } from 'lucide-react';
import { listScenarios, getContent } from '../content/registry.js';
import { useProfile } from '../profile/ProfileContext.jsx';
import Badge from '../components/ui/Badge.jsx';
import ArenaRoadmapFlipCard from '../components/ArenaRoadmapFlipCard.jsx';
import StylizedKingScene from '../components/StylizedKingScene.jsx';

// Strip the "scenarios/" id prefix to build the route, mirroring how lesson ids map to /lesson/*.
const scenarioSlug = (scenario) => scenario.id.replace(/^scenarios\//, '');

function ScenarioCard({ scenario }) {
  const { getLessonProgress } = useProfile();
  const done = getLessonProgress(scenario).status === 'complete';
  const lesson = scenario.body.relatedLesson ? getContent(scenario.body.relatedLesson) : null;

  return (
    <Link
      to={`/arena/scenario/${scenarioSlug(scenario)}`}
      className="tao-card tao-card-hover group flex min-h-[14rem] flex-col gap-3 p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-xl font-bold uppercase tracking-tight text-foreground group-hover:text-brand-600">
          {scenario.title}
        </h3>
        {done && <CheckCircle2 className="shrink-0 text-correct" size={20} aria-label="Completed" />}
      </div>
      {scenario.subtitle && <p className="text-sm font-semibold text-brand-600">{scenario.subtitle}</p>}
      {scenario.summary && <p className="text-sm leading-6 text-gray-600">{scenario.summary}</p>}
      <div className="mt-auto flex items-center justify-between gap-3">
        {lesson && <Badge tone="brand">{lesson.title}</Badge>}
        <span className="ml-auto inline-flex items-center gap-1 font-mono text-xs font-bold uppercase text-brand-600">
          {done ? 'Replay' : 'Play'} <ArrowRight size={14} />
        </span>
      </div>
    </Link>
  );
}

export default function ArenaPage() {
  const scenarios = listScenarios();

  return (
    <div className="bg-white">
      <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-8 md:py-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-wide text-brand-600">Open-source chess room</p>
          <h1 className="mt-2 font-display text-4xl font-extrabold uppercase leading-tight tracking-tight text-foreground md:text-6xl">
            Chess Academy <span className="font-book italic font-semibold normal-case tracking-normal text-brand-500">Arena</span>
          </h1>
          <div className="gradient-divider mt-5 w-24" />
          <p className="mt-5 max-w-3xl text-base leading-7 text-gray-700 md:text-lg md:leading-8">
            A convenient, playable chess space you can run in a browser: Stockfish free play, focused
            practice positions, and invite-link games with standard chess or Duck Chess. The code is
            public, small enough to fork, and built for quick experiments.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link to="/arena/free" className="tao-btn-primary">
              <Cpu size={18} /> Play engine
            </Link>
            <Link to="/arena/online" className="tao-btn-ghost">
              <Globe size={18} /> Play a friend
            </Link>
            <a
              href="https://github.com/andystats/chess-academy"
              className="tao-btn-ghost"
              target="_blank"
              rel="noreferrer"
            >
              <Github size={18} /> GitHub
            </a>
          </div>
        </div>
        <div className="mx-auto w-full max-w-64 overflow-hidden lg:justify-self-end">
          <StylizedKingScene className="h-44 w-full md:h-52" />
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-12 lg:grid-cols-2">
        <ArenaModeLink
          to="/arena/free"
          icon={<Cpu className="shrink-0 text-brand-500" size={36} />}
          title="Free Play vs Engine"
          text="Pick a side and strength, load any legal FEN, and play a complete game against Stockfish."
        />
        <ArenaModeLink
          to="/arena/online"
          icon={<Globe className="shrink-0 text-brand-500" size={36} />}
          title="Play a Friend Online"
          text="Real-time games over an invite link — standard chess or the Duck Chess variant, with chat."
        />
      </section>

      <section className="border-t-3 border-foreground bg-brand-50/40">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="mb-8 flex items-center gap-2">
            <Swords className="text-brand-500" size={22} />
            <h2 className="font-display text-3xl font-bold uppercase tracking-tight text-foreground">Practice positions</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {scenarios.map((scenario) => (
              <ScenarioCard key={scenario.id} scenario={scenario} />
            ))}
          </div>
        </div>
      </section>

      <ArenaRoadmapFlipCard />
    </div>
  );
}

function ArenaModeLink({ to, icon, title, text }) {
  return (
    <Link
      to={to}
      className="tao-card group flex items-center gap-5 p-6 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-brand"
    >
      {icon}
      <div className="flex-1">
        <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground group-hover:text-brand-600">
          {title}
        </h2>
        <p className="mt-1 text-sm leading-6 text-gray-600">{text}</p>
      </div>
      <ArrowRight className="shrink-0 text-gray-300 transition-colors group-hover:text-brand-500" size={24} />
    </Link>
  );
}
