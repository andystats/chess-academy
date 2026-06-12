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
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: currentUser.id,
            username: activeProfile.name || 'Anonymous',
            avatar_url: activeProfile.avatar || null,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });
        
        if (profileError) console.error('Profile sync error:', profileError);
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

    if (error) console.error('Fetch games error:', error);
    else setGames(data || []);
    setLoading(false);
  }

  const createGame = async () => {
    if (!user) return;
    setCreating(true);
    
    // Authored state for a fresh game is variant-specific
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
      console.error('Create game error:', error);
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

    if (error) {
      console.error('Join game error:', error);
    } else {
      navigate(`/play/${game.id}?v=${game.variant}&host=${game.host_color[0]}`);
    }
  };

  return (
    <div>
      <BackLink to="/arena" label="Practice Arena" />
      <section className="mx-auto max-w-4xl px-4 py-12">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="max-w-2xl">
            <p className="font-mono text-xs font-bold uppercase tracking-wide text-brand-600">Online Arena</p>
            <h1 className="mt-1 font-display text-4xl font-bold uppercase tracking-tight text-foreground">
              Multiplayer Lobby
            </h1>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              Join an open game or create your own. Games use anonymous accounts linked to your 
              local profile for ease of play.
            </p>
          </div>

          {isRealtimeConfigured && (
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => document.getElementById('create-game-form')?.scrollIntoView({ behavior: 'smooth' })}
                className="tao-btn-primary"
              >
                <Plus size={18} /> New Game
              </button>
            </div>
          )}
        </div>

        {!isRealtimeConfigured ? (
          <div className="mt-12">
            <RealtimeNotConfigured />
          </div>
        ) : loading ? (
          <div className="mt-20 flex flex-col items-center justify-center gap-4 text-gray-500">
            <Loader2 className="animate-spin" size={32} />
            <p className="font-mono text-xs font-bold uppercase tracking-widest">Entering lobby…</p>
          </div>
        ) : (
          <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between border-b-3 border-foreground pb-2 mb-6">
                <h2 className="font-display text-xl font-bold uppercase tracking-tight flex items-center gap-2">
                  <Users size={20} /> Open Games
                </h2>
                <span className="font-mono text-xs font-bold text-gray-500">{games.length} waiting</span>
              </div>

              {games.length === 0 ? (
                <div className="border-3 border-dashed border-gray-200 p-12 text-center">
                  <p className="text-gray-500 text-sm">No open games right now. Why not create one?</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {games.map((game) => (
                    <div
                      key={game.id}
                      className="group relative flex items-center justify-between border-3 border-foreground bg-white p-4 transition-transform hover:-translate-y-1"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center border-3 border-foreground bg-brand-50 text-2xl">
                          {game.variant === 'duck' ? '🦆' : '♔'}
                        </div>
                        <div>
                          <p className="font-display text-lg font-bold uppercase tracking-tight">
                            {VARIANTS[game.variant]?.label}
                          </p>
                          <p className="text-xs text-gray-500">
                            Hosted by <span className="font-bold text-foreground">{game.host?.username || 'Anonymous'}</span>
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => joinGame(game)}
                        disabled={game.host_id === user?.id}
                        className="tao-btn-primary py-2"
                      >
                        {game.host_id === user?.id ? 'Your Game' : 'Join'} <ArrowRight size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div id="create-game-form" className="flex flex-col gap-8 bg-brand-50/50 p-6 border-3 border-foreground">
              <h2 className="font-display text-xl font-bold uppercase tracking-tight">Create a Game</h2>
              
              <div className="flex flex-col gap-6">
                <div>
                  <p className="mb-2 font-mono text-xs font-bold uppercase tracking-wide text-gray-500 text-left">Variant</p>
                  <SegmentedControl options={VARIANT_OPTIONS} value={variant} onChange={setVariant} buttonClassName="flex-1" />
                </div>
                <div>
                  <p className="mb-2 font-mono text-xs font-bold uppercase tracking-wide text-gray-500 text-left">Play as</p>
                  <SegmentedControl options={COLOR_OPTIONS} value={hostColor} onChange={setHostColor} buttonClassName="flex-1" />
                </div>
                <button
                  type="button"
                  onClick={createGame}
                  disabled={creating}
                  className="tao-btn-primary w-full justify-center gap-2"
                >
                  {creating ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                  {creating ? 'Creating…' : 'Start Match'}
                </button>
              </div>

              <p className="text-xs leading-5 text-gray-500 text-center">
                Your game will be visible to everyone in the lobby. You can also send the link directly to a friend.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
