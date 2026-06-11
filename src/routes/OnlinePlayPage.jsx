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
// colour from localStorage; the joiner reads them from the ?v / ?host query. Those query values are
// load-bearing for seat assignment, so a mangled link is surfaced as broken instead of silently
// defaulting (a missing ?host used to make both players believe they were black).
const VARIANT_FROM_QUERY = { duck: 'duck', standard: 'standard' };
const COLOR_FROM_QUERY = { w: 'white', b: 'black' };

export default function OnlinePlayPage() {
  const { gameId } = useParams();
  const [searchParams] = useSearchParams();

  const config = useMemo(() => {
    const hostConfig = loadHostConfig(gameId);
    if (hostConfig) {
      const hostColor = hostConfig.hostColor ?? 'white';
      return { isHost: true, variant: hostConfig.variant ?? 'standard', hostColor, selfColor: hostColor, selfId: selfId() };
    }
    const variant = VARIANT_FROM_QUERY[searchParams.get('v')] ?? null;
    const hostColor = COLOR_FROM_QUERY[searchParams.get('host')] ?? null;
    if (!variant || !hostColor) return null; // mangled invite link
    return { isHost: false, variant, hostColor, selfColor: opposite(hostColor), selfId: selfId() };
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

  if (!config) {
    return (
      <div>
        <BackLink to="/arena" label="Practice Arena" />
        <section className="mx-auto max-w-2xl px-4 py-12 text-sm leading-6 text-gray-700">
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-foreground">This invite link looks broken</h1>
          <p className="mt-3">
            It&apos;s missing the game settings, so we can&apos;t tell which colour you&apos;d play. Ask your
            friend to copy the link again with the <strong>Invite</strong> button on their game screen.
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
