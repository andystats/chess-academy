import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import OnlineGamePanel from './OnlineGamePanel.jsx';

// Each test renders into the same jsdom document; clear it between tests so repeated labels (e.g. the
// Prime charge header) don't collide across renders.
afterEach(cleanup);

// A minimal game-object stub matching useOnlineGame's return contract — the panel is pure
// presentation, so no transport or engine is involved.
function fakeGame(overrides = {}) {
  return {
    variant: 'duck',
    isHost: true,
    result: null,
    currentTurn: 'white',
    selfColor: 'white',
    phase: 'piece',
    history: [],
    captured: { white: [], black: [] },
    messages: [],
    sendChat: vi.fn(),
    resync: vi.fn(),
    flipBoard: vi.fn(),
    resign: vi.fn(),
    newGame: vi.fn(),
    connection: {
      status: 'connected',
      peerPresent: true,
      hostPresent: false,
      synced: true,
      liveSynced: true,
      seatTaken: false,
    },
    ...overrides,
  };
}

describe('OnlineGamePanel', () => {
  it('renders object-shaped history entries as move text (post-first-move crash regression)', () => {
    // Online history entries are {pieceMove, san, duck} objects, NOT SAN strings. Rendering one
    // directly is a React error ("objects are not valid as a child") that took the whole app down
    // after the first move when the moveLabel formatter was dropped.
    const history = [
      { pieceMove: { from: 'e2', to: 'e4', promotion: null }, san: 'e4', duck: 'd5' },
      { pieceMove: { from: 'e7', to: 'e5', promotion: null }, san: 'e5', duck: null },
    ];
    render(<OnlineGamePanel game={fakeGame({ history })} />);
    expect(screen.getByText('e4 🦆d5')).toBeTruthy();
    expect(screen.getByText('e5')).toBeTruthy();
  });

  it('prompts for the duck on your duck phase', () => {
    render(<OnlineGamePanel game={fakeGame({ phase: 'duck' })} />);
    expect(screen.getByText('Place the duck 🦆')).toBeTruthy();
  });

  it('shows waiting status plus the keep-tab-open hint when the opponent is absent', () => {
    const game = fakeGame();
    game.connection.peerPresent = false;
    render(<OnlineGamePanel game={game} />);
    expect(screen.getByText('Waiting for opponent…')).toBeTruthy();
    expect(screen.getByText(/Keep this tab open/)).toBeTruthy();
  });

  it('shows the outcome once the game is over', () => {
    render(<OnlineGamePanel game={fakeGame({ result: { winner: 'black', reason: 'Resigned' } })} />);
    expect(screen.getByText('Black won (Resigned)')).toBeTruthy();
  });
});

describe('OnlineGamePanel — Duck Prime', () => {
  const primeGame = (overrides = {}) =>
    fakeGame({
      variant: 'duck-decay',
      primeEnabled: true,
      charges: { white: 2, black: 1 },
      canLiftDuck: false,
      repairTargets: [],
      repairMode: false,
      liftDuck: vi.fn(),
      repairSquare: vi.fn(),
      toggleRepairMode: vi.fn(),
      ...overrides,
    });

  it('formats repair and lift history entries instead of crashing on the new shapes', () => {
    const history = [
      { pieceMove: null, san: '⚒e4', duck: 'd5', repair: 'e4' },
      { pieceMove: { from: 'e7', to: 'e5', promotion: null }, san: 'e5', duck: null, lift: true },
    ];
    render(<OnlineGamePanel game={primeGame({ history })} />);
    expect(screen.getByText('⚒e4')).toBeTruthy();
    expect(screen.getByText('e5 🦆⤴')).toBeTruthy();
  });

  it('shows each side\'s remaining charges', () => {
    render(<OnlineGamePanel game={primeGame()} />);
    expect(screen.getByText('Prime charges (lift / repair)')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy(); // white
    expect(screen.getByText('1')).toBeTruthy(); // black
  });

  it('offers Lift duck on your duck phase when a charge is available', () => {
    render(<OnlineGamePanel game={primeGame({ phase: 'duck', canLiftDuck: true })} />);
    expect(screen.getByText('Place the duck 🦆 or Lift it')).toBeTruthy();
    expect(screen.getByText('Lift duck')).toBeTruthy();
  });

  it('prompts for a square and shows Cancel while repair mode is armed', () => {
    render(<OnlineGamePanel game={primeGame({ repairMode: true, repairTargets: ['e4'] })} />);
    expect(screen.getByText('Pick a square to repair ⚒')).toBeTruthy();
    expect(screen.getByText('Cancel repair')).toBeTruthy();
  });

  it('disables the repair button when nothing is repairable', () => {
    render(<OnlineGamePanel game={primeGame({ repairTargets: [] })} />);
    expect(screen.getByText('Repair square').closest('button').disabled).toBe(true);
  });
});
