import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Plus, Users, Loader2 } from 'lucide-react';
import BackLink from '../components/ui/BackLink.jsx';
import RealtimeNotConfigured from '../components/RealtimeNotConfigured.jsx';
import SegmentedControl from '../components/ui/SegmentedControl.jsx';
import { isRealtimeConfigured, supabase } from '../lib/supabase.js';
import { useProfile } from '../profile/ProfileContext.jsx';
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

export default function OnlineLobbyPage() {
  const navigate = useNavigate();
  const { activeProfile } = useProfile();
  const [variant, setVariant] = useState('standard');
  const [hostColor, setHostColor] = useState('white');
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(isRealtimeConfigured);
  const [creating, setCreating] = useState(false);
  const [user, setUser] = useState(null);

  // 1. Authenticate and Sync Profile
  useEffect(() => {
    if (!isRealtimeConfigured) return;

    async function initLobby() {
      const { data: { session } } = await supabase.auth.getSession();
      let currentUser = session?.user;

      if (!currentUser) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) {
          console.error('Auth error:', error);
          setLoading(false);
          return;
        }
        currentUser = data.user;
      }
      setUser(currentUser);

      // Upsert profile based on local activeProfile
      if (activeProfile && currentUser) {
        await supabase
          .from('profiles')
          .upsert({
            id: currentUser.id,
            username: activeProfile.name || 'Anonymous',
            avatar_url: activeProfile.avatar || null,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });
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
    const { data, error } = await supabase
      .from('games')
      .select('*, host:host_id(username, avatar_url)')
      .eq('status', 'waiting')
      .order('created_at', { ascending: false });

    if (!error) setGames(data || []);
    setLoading(false);
  }

  const createGame = async () => {
    if (!user) return;
    setCreating(true);
    
    const initialState = VARIANTS[variant].create().serialize();

    const { data, error } = await supabase
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

    if (error) {
      setCreating(false);
    } else {
      navigate(`/play/${data.id}?v=${variant}&host=${hostColor[0]}`);
    }
  };

  const joinGame = async (game) => {
    if (!user) return;
    
    const { error } = await supabase
      .from('games')
      .update({
        joiner_id: user.id,
        status: 'active',
      })
      .eq('id', game.id)
      .eq('status', 'waiting');

    if (!error) {
      navigate(`/play/${game.id}?v=${game.variant}&host=${game.host_color[0]}`);
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
          <div className="mt-16 grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-start">
            {/* Game List */}
            <div className="lg:col-span-8">
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

                      <button
                        type="button"
                        onClick={() => joinGame(game)}
                        disabled={game.host_id === user?.id}
                        className="tao-btn-primary mt-6 w-full justify-center py-2.5 text-sm"
                      >
                        {game.host_id === user?.id ? 'Your Match' : 'Join Match'} 
                        {game.host_id !== user?.id && <ArrowRight className="ml-2" size={16} />}
                      </button>
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
                      disabled={creating}
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
        )}
      </section>
    </div>
  );
}
