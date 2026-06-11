import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import BackLink from '../components/ui/BackLink.jsx';
import RealtimeNotConfigured from '../components/RealtimeNotConfigured.jsx';
import SegmentedControl from '../components/ui/SegmentedControl.jsx';
import { isRealtimeConfigured } from '../lib/supabase.js';
import { newGameId, saveHostConfig } from '../online/localSnapshot.js';
import { VARIANTS } from '../online/rules.js';

// Create an online game: pick a variant and your colour, then we mint a game id, remember that this
// browser is the host, and jump to /play/:id with the variant + host colour encoded in the URL so the
// joiner can orient instantly (the host's first snapshot remains the source of truth).
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
  const [variant, setVariant] = useState('standard');
  const [hostColor, setHostColor] = useState('white');

  const createGame = () => {
    const gameId = newGameId();
    saveHostConfig(gameId, { variant, hostColor });
    navigate(`/play/${gameId}?v=${variant}&host=${hostColor[0]}`);
  };

  return (
    <div>
      <BackLink to="/arena" label="Practice Arena" />
      <section className="mx-auto max-w-2xl px-4 py-12">
        <p className="font-mono text-xs font-bold uppercase tracking-wide text-brand-600">Play a friend</p>
        <h1 className="mt-1 font-display text-4xl font-bold uppercase tracking-tight text-foreground">
          Start an online game
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          Pick a variant and your colour, then send the invite link to your friend. No accounts — the link
          is the game.
        </p>

        {!isRealtimeConfigured ? (
          <div className="mt-8">
            <RealtimeNotConfigured />
          </div>
        ) : (
          <div className="mt-8 flex flex-col gap-6">
            <div>
              <p className="mb-2 font-mono text-xs font-bold uppercase tracking-wide text-gray-500">Variant</p>
              <SegmentedControl options={VARIANT_OPTIONS} value={variant} onChange={setVariant} buttonClassName="flex-1" />
            </div>
            <div>
              <p className="mb-2 font-mono text-xs font-bold uppercase tracking-wide text-gray-500">Play as</p>
              <SegmentedControl options={COLOR_OPTIONS} value={hostColor} onChange={setHostColor} buttonClassName="flex-1" />
            </div>
            <button type="button" onClick={createGame} className="tao-btn-primary self-start">
              Create game <ArrowRight size={18} />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
