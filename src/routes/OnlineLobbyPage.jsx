import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, History, Plus, Users, Loader2 } from 'lucide-react';
import BackLink from '../components/ui/BackLink.jsx';
import RealtimeNotConfigured from '../components/RealtimeNotConfigured.jsx';
import SegmentedControl from '../components/ui/SegmentedControl.jsx';
import { isRealtimeConfigured, supabase } from '../lib/supabase.js';
import { useProfile } from '../profile/ProfileContext.jsx';
import { ensureSessionAndProfile, loadDisplayName, saveDisplayName } from '../online/lobbyApi.js';
import { VARIANTS } from '../online/rules.js';

const VARIANT_OPTIONS = Object.entries(VARIANTS).map(([value, { pickerLabel, sublabel }]) => ({
  value,
  label: pickerLabel,
  sublabel,
}));

const COLOR_OPTIONS = [
  { value: 'white', label: 'White' },
  { value: 'black', label: 'Black' },
];

// There is no reliable "host left" signal without server-side presence, so abandoned lobby
// entries simply age out of the open list; hosts can also cancel their own match explicitly.
const WAITING_SHELF_LIFE_MS = 60 * 60 * 1000; // open matches show for 1 hour
const MY_GAMES_WINDOW_MS = 24 * 60 * 60 * 1000; // your own games stay rejoinable for a day

export default function OnlineLobbyPage() {
  const navigate = useNavigate();
  const { activeProfile } = useProfile();
  const [variant, setVariant] = useState('standard');
  const [hostColor, setHostColor] = useState('white');
  const [displayName, setDisplayName] = useState(loadDisplayName);
  const [games, setGames] = useState([]);
  const [myGames, setMyGames] = useState([]); // your waiting/active games — the rejoin list
  const [loading, setLoading] = useState(isRealtimeConfigured);
  const [creating, setCreating] = useState(false);
  const [user, setUser] = useState(null);
  // The postgres_changes subscription outlives renders, so fetchGames reads the uid from a ref.
  const userRef = useRef(null);
  const [error, setError] = useState(null); // { context, message, hint } — shown above the lobby grid

  // 1. Authenticate and sync profile. The profiles row is mandatory, not cosmetic: games.host_id
  // is a foreign key into profiles, so without it Create Match is rejected outright.
  useEffect(() => {
    if (!isRealtimeConfigured) return;

    async function initLobby() {
      const { user: sessionUser, error: sessionError } = await ensureSessionAndProfile({
        username: loadDisplayName() || activeProfile?.name,
        avatar: activeProfile?.avatar,
      });
      userRef.current = sessionUser;
      setUser(sessionUser);
      setDisplayName((current) => current || activeProfile?.name || '');
      if (sessionError) {
        console.error('Lobby sign-in error:', sessionError);
        setError({ context: 'Lobby sign-in failed', ...sessionError });
        if (!sessionUser) {
          setLoading(false);
          return;
        }
      }

      fetchGames();
    }

    initLobby();

    // Subscribe to changes in the games table
    const subscription = supabase
      .channel('lobby-games')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, fetchGames)
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [activeProfile]);

  async function fetchGames() {
    const { data, error: listError } = await supabase
      .from('games')
      .select('*, host:host_id(username, avatar_url)')
      .eq('status', 'waiting')
      .gte('created_at', new Date(Date.now() - WAITING_SHELF_LIFE_MS).toISOString())
      .order('created_at', { ascending: false });

    if (listError) {
      console.error('Lobby list error:', listError);
      setError({ context: 'Could not load open matches', message: listError.message, hint: listError.hint });
    } else {
      setGames(data || []);
    }

    // Your own recent games (active ones leave the open list by design — this is how you get back in).
    const uid = userRef.current?.id;
    if (uid) {
      const { data: mine, error: mineError } = await supabase
        .from('games')
        .select('*, host:host_id(username), joiner:joiner_id(username)')
        .or(`host_id.eq.${uid},joiner_id.eq.${uid}`)
        .in('status', ['waiting', 'active'])
        .gte('updated_at', new Date(Date.now() - MY_GAMES_WINDOW_MS).toISOString())
        .order('updated_at', { ascending: false })
        .limit(5);
      if (mineError) console.error('My-games list error:', mineError);
      else setMyGames(mine || []);
    }
    setLoading(false);
  }

  // Re-upsert the profile with the name currently in the box, so opponents see what was typed —
  // not whatever the profile held at page load.
  const syncDisplayName = async () => {
    saveDisplayName(displayName.trim());
    const { error: nameError } = await ensureSessionAndProfile({
      username: displayName,
      avatar: activeProfile?.avatar,
    });
    return nameError;
  };

  const createGame = async () => {
    if (!user) return;
    setCreating(true);
    setError(null);

    const nameError = await syncDisplayName();
    if (nameError) {
      setError({ context: 'Create match failed', ...nameError });
      setCreating(false);
      return;
    }

    const initialState = VARIANTS[variant].create().serialize();

    const { data, error: createError } = await supabase
      .from('games')
      .insert({
        variant,
        host_id: user.id,
        host_color: hostColor,
        status: 'waiting',
        state: initialState,
        epoch: Date.now(),
      })
      .select()
      .single();

    if (createError) {
      console.error('Create match error:', createError);
      setError({ context: 'Create match failed', message: createError.message, hint: createError.hint });
      setCreating(false);
    } else {
      navigate(`/play/${data.id}?v=${variant}&host=${hostColor[0]}`);
    }
  };

  const joinGame = async (game) => {
    if (!user) return;
    setError(null);

    const nameError = await syncDisplayName();
    if (nameError) {
      setError({ context: 'Join match failed', ...nameError });
      return;
    }

    // The status guard makes this a compare-and-swap: only one joiner can win the seat.
    const { data, error: joinError } = await supabase
      .from('games')
      .update({
        joiner_id: user.id,
        status: 'active',
      })
      .eq('id', game.id)
      .eq('status', 'waiting')
      .select();

    if (joinError) {
      console.error('Join match error:', joinError);
      setError({ context: 'Join match failed', message: joinError.message, hint: joinError.hint });
    } else if (!data?.length) {
      setError({ context: 'Join match failed', message: 'That seat was just taken. Pick another match.' });
      fetchGames();
    } else {
      navigate(`/play/${game.id}?v=${game.variant}&host=${game.host_color[0]}`);
    }
  };

  // Host withdraws their own waiting match (the row just completes; nothing to clean up live).
  const cancelGame = async (game) => {
    if (!user) return;
    setError(null);

    const { error: cancelError } = await supabase
      .from('games')
      .update({ status: 'completed' })
      .eq('id', game.id)
      .eq('host_id', user.id)
      .eq('status', 'waiting');

    if (cancelError) {
      console.error('Cancel match error:', cancelError);
      setError({ context: 'Cancel failed', message: cancelError.message, hint: cancelError.hint });
    } else {
      fetchGames();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      <BackLink to="/arena" label="Practice Arena" />
      
      <section className="mx-auto max-w-5xl px-4 py-16">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          <div className="max-w-2xl text-left">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-700 ring-1 ring-inset ring-brand-700/10">
              <div className="h-1.5 w-1.5 rounded-full bg-brand-600 animate-pulse" />
              Live Matchmaking
            </div>
            <h1 className="mt-4 font-display text-5xl font-bold uppercase tracking-tight text-foreground sm:text-6xl">
              Online <span className="text-brand-600">Arena</span>
            </h1>
            <p className="mt-4 text-base leading-7 text-gray-600">
              Battle friends or find rivals in the lobby. Matches are persistent and 
              synced to your global study profile.
            </p>
          </div>
        </div>

        {!isRealtimeConfigured ? (
          <div className="mt-12">
            <RealtimeNotConfigured />
          </div>
        ) : loading ? (
          <div className="mt-32 flex flex-col items-center justify-center gap-6 text-gray-400">
            <Loader2 className="animate-spin" size={40} />
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em]">Entering Lobby Room…</p>
          </div>
        ) : (
          <>
          {error && (
            <div className="mt-10 rounded-2xl border-2 border-red-200 bg-red-50 p-5 text-left">
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-red-600">
                {error.context}
              </p>
              <p className="mt-2 text-sm font-bold text-red-700">{error.message}</p>
              {error.hint && <p className="mt-1 text-sm text-red-600/80">{error.hint}</p>}
            </div>
          )}
          <div className="mt-16 grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-start">
            {/* Game List */}
            <div className="lg:col-span-8">
              {myGames.length > 0 && (
                <div className="mb-12">
                  <div className="flex items-center justify-between border-b-2 border-gray-200 pb-4 mb-6">
                    <h2 className="font-display text-2xl font-bold uppercase tracking-tight flex items-center gap-3">
                      <History className="text-brand-600" size={24} />
                      Your Games
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {myGames.map((g) => {
                      const youAreHost = g.host_id === user?.id;
                      const opponent = youAreHost ? g.joiner?.username : g.host?.username;
                      return (
                        <div
                          key={g.id}
                          className="flex items-center justify-between gap-4 rounded-2xl border-2 border-gray-200 bg-white px-5 py-4"
                        >
                          <div className="flex min-w-0 items-center gap-4">
                            <span className="text-2xl">{g.variant === 'duck' ? '🦆' : '♔'}</span>
                            <div className="min-w-0">
                              <p className="truncate font-display text-sm font-bold uppercase tracking-tight text-foreground">
                                {opponent ? `vs ${opponent}` : 'Waiting for a challenger'}
                              </p>
                              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                {g.variant} · {g.status}
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {youAreHost && g.status === 'waiting' && (
                              <button
                                type="button"
                                onClick={() => cancelGame(g)}
                                className="rounded-lg border-2 border-red-200 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-red-600 transition-colors hover:bg-red-50"
                              >
                                Cancel
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => navigate(`/play/${g.id}?v=${g.variant}&host=${g.host_color[0]}`)}
                              className="tao-btn-primary px-4 py-1.5 text-xs"
                            >
                              Rejoin
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between border-b-2 border-gray-200 pb-4 mb-8">
                <h2 className="font-display text-2xl font-bold uppercase tracking-tight flex items-center gap-3">
                  <Users className="text-brand-600" size={24} /> 
                  Open Matches
                </h2>
                <div className="flex items-center gap-2 font-mono text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  {games.length} available
                </div>
              </div>

              {games.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white/50 p-16 text-center shadow-inner">
                  <div className="rounded-full bg-gray-100 p-4 mb-4">
                    <Plus className="text-gray-300" size={32} />
                  </div>
                  <p className="font-display text-lg font-bold text-gray-400 uppercase tracking-tight">No open games</p>
                  <p className="mt-1 text-sm text-gray-500">Be the first to create a match today!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {games.map((game) => (
                    <div
                      key={game.id}
                      className="group flex flex-col justify-between rounded-2xl border-2 border-gray-200 bg-white p-5 transition-all hover:border-brand-600 hover:shadow-xl hover:shadow-brand-900/5 hover:-translate-y-1"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50 text-3xl transition-transform group-hover:scale-110">
                          {game.variant === 'duck' ? '🦆' : '♔'}
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-gray-400">
                            {game.variant}
                          </p>
                          <div className="mt-1 flex items-center justify-end gap-1.5">
                             <div className={`h-2 w-2 rounded-full ${game.host_color === 'white' ? 'bg-white border border-gray-300' : 'bg-gray-900'}`} />
                             <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{game.host_color}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-6 border-t border-gray-100 pt-5">
                        <p className="text-xs text-gray-500">Host</p>
                        <p className="font-display text-lg font-bold uppercase tracking-tight text-foreground truncate">
                          {game.host?.username || 'Anonymous'}
                        </p>
                      </div>

                      {game.host_id === user?.id ? (
                        <button
                          type="button"
                          onClick={() => cancelGame(game)}
                          className="mt-6 w-full rounded-xl border-2 border-red-200 py-2.5 text-sm font-bold uppercase tracking-widest text-red-600 transition-colors hover:bg-red-50"
                        >
                          Cancel Match
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => joinGame(game)}
                          className="tao-btn-primary mt-6 w-full justify-center py-2.5 text-sm"
                        >
                          Join Match
                          <ArrowRight className="ml-2" size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Create Panel */}
            <div id="create-game-form" className="lg:col-span-4">
              <div className="sticky top-8 overflow-hidden rounded-3xl border-2 border-gray-900 bg-gray-900 p-1 shadow-2xl">
                <div className="rounded-[22px] bg-white p-6 sm:p-8">
                  <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-gray-900">
                    Host Match
                  </h2>
                  <p className="mt-2 text-sm text-gray-500">Configure your rules and wait for a challenger.</p>
                  
                  <div className="mt-10 flex flex-col gap-8 text-left">
                    <div>
                      <label htmlFor="lobby-display-name" className="mb-3 block font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                        Playing As
                      </label>
                      <input
                        id="lobby-display-name"
                        type="text"
                        value={displayName}
                        maxLength={20}
                        placeholder="Player"
                        onChange={(event) => setDisplayName(event.target.value)}
                        onBlur={() => saveDisplayName(displayName.trim())}
                        className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 font-display text-sm font-bold uppercase tracking-tight text-foreground placeholder:text-gray-300 focus:border-brand-600 focus:outline-none"
                      />
                      <p className="mt-2 text-[11px] leading-4 text-gray-400">
                        Shown to opponents when you host or join. No account needed.
                      </p>
                    </div>

                    <div>
                      <label className="mb-3 block font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                        Select Variant
                      </label>
                      <SegmentedControl options={VARIANT_OPTIONS} value={variant} onChange={setVariant} buttonClassName="flex-1" />
                    </div>
                    
                    <div>
                      <label className="mb-3 block font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                        Play Side
                      </label>
                      <SegmentedControl options={COLOR_OPTIONS} value={hostColor} onChange={setHostColor} buttonClassName="flex-1" />
                    </div>

                    <button
                      type="button"
                      onClick={createGame}
                      disabled={creating || !user}
                      className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-xl bg-gray-900 px-6 py-4 font-display text-sm font-bold uppercase tracking-widest text-white transition-all hover:bg-brand-600 disabled:opacity-50"
                    >
                      {creating ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} className="transition-transform group-hover:rotate-90" />}
                      <span>{creating ? 'Preparing Board…' : 'Create Match'}</span>
                    </button>
                  </div>

                  <div className="mt-8 rounded-xl bg-gray-50 p-4">
                    <p className="text-center text-[10px] leading-5 text-gray-400 uppercase font-bold tracking-wider">
                      Public matches are visible to all players in the lobby.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </>
        )}
      </section>
    </div>
  );
}
