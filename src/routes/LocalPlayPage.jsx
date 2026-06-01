import BackLink from '../components/ui/BackLink.jsx';
import EngineGameView from '../components/EngineGameView.jsx';
import LocalGamePanel from '../components/LocalGamePanel.jsx';
import ArenaRoadmapFlipCard from '../components/ArenaRoadmapFlipCard.jsx';
import { useLocalGame } from '../engine/useLocalGame.js';

export default function LocalPlayPage() {
  const game = useLocalGame();

  return (
    <div>
      <BackLink to="/arena" label="Practice Arena" />
      <EngineGameView game={game} panel={<LocalGamePanel game={game} />} />
      <ArenaRoadmapFlipCard />
    </div>
  );
}
