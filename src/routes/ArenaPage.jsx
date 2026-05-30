import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Swords, Cpu } from 'lucide-react';
import { listScenarios, getContent } from '../content/registry.js';
import { useProfile } from '../profile/ProfileContext.jsx';
import SectionHeader from '../components/ui/SectionHeader.jsx';
import Badge from '../components/ui/Badge.jsx';

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
      <section className="mx-auto max-w-6xl px-4 py-12">
        <SectionHeader
          eyebrow="Practice arena"
          title="Try the ideas against a"
          accent="real engine."
          size="xl"
        >
          Lessons teach the idea; here you apply it. Each scenario sets up a position straight from a
          lesson — make the key move, then convert against Stockfish. Or just play a full game at the
          strength you choose.
        </SectionHeader>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12">
        <Link
          to="/arena/free"
          className="tao-card group flex items-center gap-5 p-6 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-brand"
        >
          <Cpu className="shrink-0 text-brand-500" size={36} />
          <div className="flex-1">
            <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground group-hover:text-brand-600">
              Free Play vs Engine
            </h2>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              Pick a side and a strength, optionally start from any position, and play a full game.
            </p>
          </div>
          <ArrowRight className="shrink-0 text-gray-300 transition-colors group-hover:text-brand-500" size={24} />
        </Link>
      </section>

      <section className="border-t-3 border-foreground bg-brand-50/40">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="mb-8 flex items-center gap-2">
            <Swords className="text-brand-500" size={22} />
            <h2 className="font-display text-3xl font-bold uppercase tracking-tight text-foreground">Lesson scenarios</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {scenarios.map((scenario) => (
              <ScenarioCard key={scenario.id} scenario={scenario} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
