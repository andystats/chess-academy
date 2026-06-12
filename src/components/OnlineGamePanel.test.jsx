import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import OnlineGamePanel from './OnlineGamePanel.jsx';

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
