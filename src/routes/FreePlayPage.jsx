import { useState } from 'react';
import { Chess } from 'chess.js';
import { useEngineGame } from '../engine/useEngineGame.js';
import { START_FEN } from '../lesson/moves.js';
import EngineGameView from '../components/EngineGameView.jsx';
import EnginePanel from '../components/EnginePanel.jsx';
import BackLink from '../components/ui/BackLink.jsx';
import SegmentedControl from '../components/ui/SegmentedControl.jsx';

const SIDE_OPTIONS = [
  { value: 'white', label: 'White' },
  { value: 'black', label: 'Black' },
];

// Free play vs Stockfish: pick a side and strength, optionally load a FEN, and play a full game.
// Changing the side or loaded position restarts the game (useEngineGame resets on those inputs);
// changing strength takes effect on the engine's next move.
export default function FreePlayPage() {
  const [playerSide, setPlayerSide] = useState('white');
  const [skillLevel, setSkillLevel] = useState(4);
  const [startFen, setStartFen] = useState(START_FEN);

  const game = useEngineGame({ fen: startFen, playerSide, skillLevel });

  return (
    <div>
      <BackLink to="/arena" label="Practice Arena" />
      <EngineGameView
        game={game}
        panel={
          <EnginePanel
            game={game}
            eyebrow="Free play"
            title="Play the engine"
            skillLevel={skillLevel}
            onSkillLevelChange={setSkillLevel}
          >
            <SidePicker playerSide={playerSide} onChange={setPlayerSide} />
            <FenLoader startFen={startFen} onLoad={setStartFen} />
          </EnginePanel>
        }
      />
    </div>
  );
}

function SidePicker({ playerSide, onChange }) {
  return (
    <div>
      <p className="mb-2 font-mono text-xs font-bold uppercase tracking-wide text-gray-500">Play as</p>
      <SegmentedControl options={SIDE_OPTIONS} value={playerSide} onChange={onChange} buttonClassName="flex-1" />
    </div>
  );
}

function FenLoader({ startFen, onLoad }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(null);

  const load = () => {
    const fen = value.trim();
    if (!fen) {
      onLoad(START_FEN);
      setError(null);
      return;
    }
    try {
      new Chess(fen); // throws on an invalid FEN
    } catch {
      setError('That FEN is not a legal position.');
      return;
    }
    setError(null);
    onLoad(fen);
  };

  return (
    <div>
      <p className="mb-2 font-mono text-xs font-bold uppercase tracking-wide text-gray-500">Start from a position (optional)</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste a FEN, or leave blank for the start position"
          className="min-h-touch flex-1 border-3 border-foreground px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
        />
        <button type="button" onClick={load} className="tao-btn-ghost">
          Load
        </button>
      </div>
      {error && <p className="mt-1 text-sm text-retry">{error}</p>}
      {startFen !== START_FEN && !error && <p className="mt-1 text-xs text-gray-400">Playing from a custom position.</p>}
    </div>
  );
}
