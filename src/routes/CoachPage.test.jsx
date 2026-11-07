import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CoachPage from './CoachPage.jsx';

const analysisControls = vi.hoisted(() => ({
  state: null,
}));

vi.mock('../components/BoardPanel.jsx', () => ({
  default: ({ fen, arrows }) => (
    <div data-testid="coach-board" data-fen={fen} data-arrows={JSON.stringify(arrows)} />
  ),
}));

vi.mock('../engine/useStockfish.js', () => ({
  useStockfish: () => ({
    ready: true,
    error: null,
    requestMove: vi.fn(() => new Promise(() => {})),
    setStrength: vi.fn(),
    interrupt: vi.fn(),
  }),
}));

vi.mock('../engine/useStockfishAnalysis.js', () => ({
  useStockfishAnalysis: () => analysisControls.state,
}));

function readyAnalysis(fen) {
  return {
    fen,
    status: 'complete',
    learnerSide: 'black',
    depthSnapshots: [
      {
        depth: 11,
        lines: [
          {
            rank: 1,
            score: 20,
            bound: 'exact',
            uciMoves: ['a8b8', 'b3c2', 'c5b6'],
            sanMoves: ['Rb8', 'Qc2', 'Bb6'],
          },
          {
            rank: 2,
            score: -5,
            bound: 'exact',
            uciMoves: ['e8g8', 'b3b7'],
            sanMoves: ['O-O', 'Qxb7'],
          },
        ],
      },
    ],
    staticEvaluation: null,
    bestMove: 'a8b8',
    error: null,
    cached: false,
    cancel: vi.fn(),
    retry: vi.fn(),
  };
}

describe('CoachPage', () => {
  const b7Fen = 'r2qk2r/pppp1ppp/2n1bn2/2b1p3/4P3/1Q2B3/PPPP1PPP/RN2KBNR b KQkq - 3 5';

  beforeEach(() => {
    analysisControls.state = readyAnalysis(b7Fen);
  });

  afterEach(cleanup);

  it('renders the central board alongside theme tabs for Main Idea, Key Best Moves, State of the Board, and Ask Coach', () => {
    render(
      <MemoryRouter initialEntries={[`/coach?fen=${encodeURIComponent(b7Fen)}&orientation=black&side=both`]}>
        <CoachPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('coach-board')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /What to Think About Now/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Play Rb8/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/neutralizes the current threat on b7/i).length).toBeGreaterThan(0);

    // Switch to Key Best Moves tab
    fireEvent.click(screen.getByRole('tab', { name: /Key Best Moves/i }));
    expect(screen.getByRole('heading', { name: /Optimal Moves & Why/i })).toBeInTheDocument();

    // Switch to State of the Board tab
    fireEvent.click(screen.getByRole('tab', { name: /State of the Board/i }));
    expect(screen.getByRole('heading', { name: /State of the Board/i })).toBeInTheDocument();
  });

  it('allows switching to Guided Play mode to hide optimal move spoilers until requested', () => {
    render(
      <MemoryRouter initialEntries={[`/coach?fen=${encodeURIComponent(b7Fen)}&orientation=black&side=both`]}>
        <CoachPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Guided Play \(No Spoilers\)/i }));
    expect(screen.queryByText(/neutralizes the current threat on b7/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Reveal Optimal Move & Why/i }));
    expect(screen.getAllByText(/neutralizes the current threat on b7/i).length).toBeGreaterThan(0);
  });

  it('supports playing both sides or playing against the engine', () => {
    render(
      <MemoryRouter initialEntries={['/coach']}>
        <CoachPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Both Sides/i }));
    expect(screen.getByText(/Sandbox: White to move/i)).toBeInTheDocument();
  });
});
