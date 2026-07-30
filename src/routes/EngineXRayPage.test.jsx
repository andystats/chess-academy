import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, vi } from 'vitest';
import EngineXRayPage from './EngineXRayPage.jsx';

const analysisMocks = vi.hoisted(() => ({
  useStockfishAnalysis: vi.fn(),
}));

vi.mock('../engine/useStockfishAnalysis.js', () => ({
  useStockfishAnalysis: analysisMocks.useStockfishAnalysis,
}));

vi.mock('../components/BoardPanel.jsx', () => ({
  default: ({ fen, onPieceDrop }) => (
    <div data-testid="xray-board" data-fen={fen}>
      <button type="button" onClick={() => onPieceDrop?.('g8', 'f6')}>Choose Nf6</button>
    </div>
  ),
}));

const SNAPSHOTS = [
  {
    depth: 4,
    selectiveDepth: 6,
    nodes: 1200,
    nps: 50000,
    lines: [
      {
        rank: 1,
        score: 35,
        mate: null,
        bound: 'exact',
        uciMoves: ['g8f6', 'g1e2', 'd7d5'],
        sanMoves: ['Nf6', 'Ne2', 'd5'],
      },
      {
        rank: 2,
        score: 12,
        mate: null,
        bound: 'exact',
        uciMoves: ['d7d6', 'd2d4'],
        sanMoves: ['d6', 'd4'],
      },
      {
        rank: 3,
        score: -8,
        mate: null,
        bound: 'exact',
        uciMoves: ['b8c6', 'g1e2'],
        sanMoves: ['Nc6', 'Ne2'],
      },
    ],
  },
];

function analysisState(enabled) {
  return enabled
    ? {
        fen: '',
        status: 'complete',
        learnerSide: 'black',
        depthSnapshots: SNAPSHOTS,
        staticEvaluation: {
          material: null,
          imbalance: null,
          pawns: null,
          mobility: null,
          kingSafety: null,
          threats: null,
          passedPawns: null,
          space: null,
          total: { finalAdvantage: 0.35 },
        },
        bestMove: 'g8f6',
        error: null,
        cached: false,
        cancel: vi.fn(),
        retry: vi.fn(),
      }
    : {
        status: 'idle',
        learnerSide: null,
        depthSnapshots: [],
        staticEvaluation: null,
        cancel: vi.fn(),
        retry: vi.fn(),
      };
}

afterEach(() => {
  cleanup();
  analysisMocks.useStockfishAnalysis.mockReset();
});

describe('EngineXRayPage', () => {
  it('keeps the engine hidden until a learner supplies a candidate, then reveals the teaching tools', () => {
    analysisMocks.useStockfishAnalysis.mockImplementation(({ enabled }) => analysisState(enabled));
    render(
      <MemoryRouter>
        <EngineXRayPage />
      </MemoryRouter>,
    );

    const reveal = screen.getByRole('button', { name: /Reveal Stockfish's scan/i });
    expect(reveal).toBeDisabled();
    expect(analysisMocks.useStockfishAnalysis).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Choose Nf6' }));
    expect(screen.getByRole('button', { name: 'Remove Nf6' })).toBeInTheDocument();
    expect(reveal).toBeEnabled();

    fireEvent.click(reveal);
    expect(analysisMocks.useStockfishAnalysis).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: true }),
    );
    expect(screen.getByRole('heading', { name: 'Search Time Machine' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Search Bonsai' })).toBeInTheDocument();
    expect(screen.getByText(/Your scan found every branch/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Position X-Ray' })).toBeInTheDocument();
  });

  it('offers keyboard users a legal-move picker for the scan', () => {
    analysisMocks.useStockfishAnalysis.mockImplementation(({ enabled }) => analysisState(enabled));
    render(
      <MemoryRouter>
        <EngineXRayPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Choose a legal candidate move'), {
      target: { value: 'g8f6' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add candidate' }));

    expect(screen.getByRole('button', { name: 'Remove Nf6' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reveal Stockfish's scan/i })).toBeEnabled();
  });

  it('accepts a lesson position through the URL without starting Stockfish', () => {
    analysisMocks.useStockfishAnalysis.mockImplementation(({ enabled }) => analysisState(enabled));
    const fen = '8/8/8/8/8/8/4K3/7k w - - 0 1';
    render(
      <MemoryRouter
        initialEntries={[
          `/study/engine-xray?fen=${encodeURIComponent(fen)}&orientation=white&title=Endgame+study&coach=blockade`,
        ]}
      >
        <EngineXRayPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('option', { name: /From a lesson — Endgame study/i })).toBeInTheDocument();
    expect(screen.getByTestId('xray-board')).toHaveAttribute('data-fen', fen);
    expect(analysisMocks.useStockfishAnalysis).toHaveBeenLastCalledWith(
      expect.objectContaining({ fen, enabled: false }),
    );
  });
});
