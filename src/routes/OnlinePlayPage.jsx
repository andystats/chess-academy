import { useMemo, useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import BackLink from '../components/ui/BackLink.jsx';
import EngineGameView from '../components/EngineGameView.jsx';
import OnlineGamePanel from '../components/OnlineGamePanel.jsx';
import { useOnlineGame } from '../online/useOnlineGame.js';
import { loadHostConfig, selfId } from '../online/localSnapshot.js';
import { ensureSessionAndProfile } from '../online/lobbyApi.js';
import { VARIANTS, variantOptionsFromSerialized } from '../online/rules.js';
import { isRealtimeConfigured, supabase } from '../lib/supabase.js';
import { Loader2 } from 'lucide-react';

function readDuckDecayOptions(searchParams) {
  const defaults = VARIANTS['duck-decay'].defaults;
  const numberParam = (name, fallback) => {
    const value = Number(searchParams.get(name));
    return Number.isSafeInteger(value) && value >= 1 && value <= 9 ? value : fallback;
  };
  return {
    decayTurns: numberParam('decay', defaults.decayTurns),
    breakHits: numberParam('break', defaults.breakHits),
  };
}

export default function OnlinePlayPage() {
  const { gameId } = useParams();
  const [searchParams] = useSearchParams();
  const [dbConfig, setDbConfig] = useState(null);
  const [loading, setLoading] = useState(isRealtimeConfigured);

  // 1. Authenticate (for direct links) and fetch the DB config. The profiles row matters here
  // too: the auto-join below writes joiner_id, a foreign key into profiles.
  useEffect(() => {
    if (!isRealtimeConfigured) return;

    async function initPlay() {
      const { user, error: sessionError } = await ensureSessionAndProfile();
      if (sessionError) console.error('Play session error:', sessionError);

      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (!error && data) {
        const isHost = data.host_id === user?.id;
        let variantOptions = {};
        try {
          variantOptions = variantOptionsFromSerialized(data.variant, data.state);
        } catch {
          variantOptions = data.variant === 'duck-decay' ? readDuckDecayOptions(searchParams) : {};
        }
        setDbConfig({
          variant: data.variant,
          hostColor: data.host_color,
          isHost,
          variantOptions,
        });

        // Auto-join if this is a waiting game and we are not the host. The realtime channel
        // still carries the game either way; a failed claim only leaves the lobby row open.
        if (!isHost && data.status === 'waiting' && !data.joiner_id && user) {
          const { error: joinError } = await supabase
            .from('games')
            .update({
              joiner_id: user.id,
              status: 'active',
            })
            .eq('id', gameId)
            .eq('status', 'waiting');
          if (joinError) console.error('Auto-join error:', joinError);
        }
      } else if (error) {
        console.error('Game lookup error:', error); // fall back to URL-param config below
      }
      setLoading(false);
    }

    initPlay();
  }, [gameId, searchParams]);

  // Orientation hints from the URL (legacy/instant) or local storage or the DB.
  const config = useMemo(() => {
    if (dbConfig) return dbConfig;

    const hostConfig = loadHostConfig(gameId);
    if (hostConfig && Object.hasOwn(VARIANTS, hostConfig.variant)) return { ...hostConfig, isHost: true };

    const variant = searchParams.get('v');
    const hostSideChar = searchParams.get('host');
    if (!variant || !hostSideChar) return null;
    if (!Object.hasOwn(VARIANTS, variant)) return null;

    const hostColor = hostSideChar === 'w' ? 'white' : 'black';
    const variantOptions = variant === 'duck-decay' ? readDuckDecayOptions(searchParams) : {};
    return { variant, hostColor, isHost: false, variantOptions };
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
