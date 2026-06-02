import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import BackLink from '../components/ui/BackLink.jsx';
import EngineGameView from '../components/EngineGameView.jsx';
import OnlineGamePanel from '../components/OnlineGamePanel.jsx';
import { opposite } from '../lesson/moves.js';
import { isRealtimeConfigured } from '../lib/supabase.js';
import { loadHostConfig, selfId } from '../online/localSnapshot.js';
import { useOnlineGame } from '../online/useOnlineGame.js';

// Join (or, if this browser created it, host) the game at /play/:gameId. The host reads its variant +
// colour from localStorage; the joiner reads the non-secret defaults from the ?v / ?host query (the
// host's first snapshot is authoritative regardless). Each player orients to their own colour.
const COLOR_FROM_QUERY = { w: 'white', b: 'black' };

export default function OnlinePlayPage() {
  const { gameId } = useParams();
  const [searchParams] = useSearchParams();

  const config = useMemo(() => {
    const hostConfig = loadHostConfig(gameId);
    const isHost = Boolean(hostConfig);
    const variant = hostConfig?.variant ?? (searchParams.get('v') === 'duck' ? 'duck' : 'standard');
    const hostColor = hostConfig?.hostColor ?? COLOR_FROM_QUERY[searchParams.get('host')] ?? 'white';
    const selfColor = isHost ? hostColor : opposite(hostColor);
    return { isHost, variant, hostColor, selfColor, selfId: selfId() };
  }, [gameId, searchParams]);

  if (!isRealtimeConfigured) {
    return (
      <div>
        <BackLink to="/arena" label="Practice Arena" />
        <section className="mx-auto max-w-2xl px-4 py-12 text-sm leading-6 text-gray-700">
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-foreground">Online play isn’t configured</h1>
          <p className="mt-3">
            This build has no Supabase credentials, so realtime games can’t connect. See{' '}
            <code className="font-mono">.env.example</code>.
          </p>
        </section>
      </div>
    );
  }

  return <OnlineGame gameId={gameId} config={config} />;
}

function OnlineGame({ gameId, config }) {
  const game = useOnlineGame({ gameId, ...config });
  return (
    <div>
      <BackLink to="/arena" label="Practice Arena" />
      <EngineGameView game={game} panel={<OnlineGamePanel game={game} />} />
    </div>
  );
}
