import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { BookOpen, Target, Lightbulb } from 'lucide-react';
import { getContent } from '../content/registry.js';
import { useEngineGame } from '../engine/useEngineGame.js';
import { useProfile } from '../profile/ProfileContext.jsx';
import { withLessonComplete } from '../profile/progress.js';
import EngineGameView from '../components/EngineGameView.jsx';
import EnginePanel from '../components/EnginePanel.jsx';
import BackLink from '../components/ui/BackLink.jsx';
import NotFoundPage from './NotFoundPage.jsx';

// Scenario ids contain slashes (e.g. "scenarios/exploit-the-pin"), so the route is /arena/scenario/*
// and the id is the splat param — same shape as LessonPage.
export default function ScenarioPage() {
  const id = useParams()['*'];
  const scenario = getContent(`scenarios/${id}`);
  if (!scenario || scenario.kind !== 'scenario') return <NotFoundPage />;

  return <ScenarioView key={scenario.id} scenario={scenario} />;
}

function ScenarioView({ scenario }) {
  const { body } = scenario;
  const [skillLevel, setSkillLevel] = useState(body.skillLevel ?? 1);
  // The authored key move + its explanation + diagnosed misplays drive the guided phase.
  const guided = useMemo(
    () =>
      body.solution
        ? { solution: body.solution.san, explain: body.explain, wrong: body.wrong, misplays: body.misplays }
        : null,
    [body],
  );
  const game = useEngineGame({ fen: body.fen, playerSide: body.playerSide, skillLevel, guided });
  const { recordLessonProgress } = useProfile();
  const [showHint, setShowHint] = useState(false);

  // A scenario is "done" once the player finds the key idea (guided solved), or — for scenarios with
  // no authored solution — once they win the game outright.
  const playerWon = game.status === 'over' && game.result?.winner === game.playerSide;
  const done = game.solved || playerWon;
  useEffect(() => {
    if (done) recordLessonProgress(scenario, (progress, now) => withLessonComplete(progress, now));
  }, [done, scenario, recordLessonProgress]);

  const relatedLesson = body.relatedLesson ? getContent(body.relatedLesson) : null;

  return (
    <div>
      <BackLink to="/arena" label="Practice Arena" />
      <EngineGameView
        game={game}
        panel={
          <EnginePanel
            game={game}
            eyebrow="Scenario"
            title={scenario.title}
            skillLevel={skillLevel}
            onSkillLevelChange={setSkillLevel}
          >
            {body.goal && (
              <div className="flex items-start gap-2 border-3 border-foreground bg-brand-50 px-4 py-3 text-sm text-gray-700">
                <Target className="mt-0.5 shrink-0 text-brand-500" size={18} />
                <span>{body.goal}</span>
              </div>
            )}
            {body.successHint &&
              (showHint ? (
                <p className="flex items-start gap-2 text-sm text-gray-600">
                  <Lightbulb className="mt-0.5 shrink-0 text-amber-500" size={16} />
                  <span>{body.successHint}</span>
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowHint(true)}
                  className="inline-flex items-center gap-1.5 self-start font-mono text-xs font-bold uppercase tracking-wide text-amber-600 hover:text-amber-700"
                >
                  <Lightbulb size={14} /> Show hint
                </button>
              ))}
            {relatedLesson && (
              <Link
                to={`/lesson/${relatedLesson.id}`}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700"
              >
                <BookOpen size={16} /> Review the lesson: {relatedLesson.title}
              </Link>
            )}
          </EnginePanel>
        }
      />
    </div>
  );
}
