import { useMemo, useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import BackLink from '../components/ui/BackLink.jsx';
import EngineGameView from '../components/EngineGameView.jsx';
import OnlineGamePanel from '../components/OnlineGamePanel.jsx';
import { useOnlineGame } from '../online/useOnlineGame.js';
import { loadHostConfig, selfId } from '../online/localSnapshot.js';
import { isRealtimeConfigured, supabase } from '../lib/supabase.js';
import { Loader2 } from 'lucide-react';

export default function OnlinePlayPage() {
  const { gameId } = useParams();
  const [searchParams] = useSearchParams();
  const [dbConfig, setDbConfig] = useState(null);
  const [loading, setLoading] = useState(isRealtimeConfigured);
  const [user, setUser] = useState(null);

  // 1. Authenticate (for direct links) and Fetch DB Config
  useEffect(() => {
    if (!isRealtimeConfigured) return;

    async function initPlay() {
      const { data: { session } } = await supabase.auth.getSession();
      let currentUser = session?.user;

      if (!currentUser) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (!error) currentUser = data.user;
      }
      setUser(currentUser);

      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (!error && data) {
        const isHost = data.host_id === currentUser?.id;
        setDbConfig({
          variant: data.variant,
          hostColor: data.host_color,
          isHost,
        });

        // Auto-join if this is a waiting game and we are not the host
        if (!isHost && data.status === 'waiting' && !data.joiner_id && currentUser) {
          await supabase
            .from('games')
            .update({
              joiner_id: currentUser.id,
              status: 'active',
            })
            .eq('id', gameId);
        }
      }
      setLoading(false);
    }

    initPlay();
  }, [gameId]);

  // Orientation hints from the URL (legacy/instant) or local storage or the DB.
  const config = useMemo(() => {
    if (dbConfig) return dbConfig;

    const hostConfig = loadHostConfig(gameId);
    if (hostConfig) return { ...hostConfig, isHost: true };

    const variant = searchParams.get('v');
    const hostSideChar = searchParams.get('host');
    if (!variant || !hostSideChar) return null;

    const hostColor = hostSideChar === 'w' ? 'white' : 'black';
    return { variant, hostColor, isHost: false };
  }, [gameId, searchParams, dbConfig]);

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4 text-gray-500">
        <Loader2 className="animate-spin" size={32} />
        <p className="font-mono text-xs font-bold uppercase tracking-widest">Joining match…</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground">
          Invalid invite link
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          This link looks broken or expired. Ask your friend to send a new one.
        </p>
        <div className="mt-8">
          <BackLink to="/arena" label="Return to Arena" />
        </div>
      </div>
    );
  }

  // selfColor is your POV: host plays their color; joiner plays the other.
  const selfColor = config.isHost ? config.hostColor : (config.hostColor === 'white' ? 'black' : 'white');

  return (
    <OnlineGameWrapper
      gameId={gameId}
      config={{ ...config, selfColor, selfId: selfId() }}
    />
  );
}

function OnlineGameWrapper({ gameId, config }) {
  const game = useOnlineGame({ gameId, ...config });
  return (
    <div>
      <BackLink to="/arena" label="Practice Arena" />
      <EngineGameView game={game} panel={<OnlineGamePanel game={game} />} />
    </div>
  );
}
