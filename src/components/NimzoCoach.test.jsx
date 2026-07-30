import { afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import NimzoCoach from './NimzoCoach.jsx';

describe('NimzoCoach', () => {
  afterEach(cleanup);

  it('answers a suggested question with an original card and chapter citation', () => {
    render(<NimzoCoach seedCardId="prophylaxis" fen="8/8/8/8/8/8/4K3/7k w - - 0 1" />);

    fireEvent.click(screen.getByRole('button', { name: 'What would the opponent play if given a free move?' }));

    expect(screen.getByText(/Prophylactic thinking begins/i)).toBeInTheDocument();
    expect(screen.getByText(/Part II, Chapter 1: Prophylaxis and the Centre/i)).toBeInTheDocument();
  });

  it('fails honestly when no reviewed concept matches', () => {
    render(<NimzoCoach />);

    fireEvent.change(screen.getByLabelText('Ask the Ghost of Nimzowitsch'), {
      target: { value: 'Explain quantum castling on a hexagonal board' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask the coach' }));

    expect(screen.getByText(/do not have a focused note for that yet/i)).toBeInTheDocument();
  });

  it('keeps engine output visibly separate from the book-grounded answer', () => {
    const analysis = {
      depthSnapshots: [
        {
          depth: 9,
          lines: [{ sanMoves: ['Nf6', 'Qb3', 'd5', 'exd5'] }],
        },
      ],
    };
    render(<NimzoCoach analysis={analysis} seedCardId="prophylaxis" />);

    fireEvent.click(screen.getByRole('button', { name: 'What would the opponent play if given a free move?' }));

    expect(screen.getByText('Engine note:')).toBeInTheDocument();
    expect(screen.getByText(/Stockfish's current leading line at depth 9 begins Nf6 Qb3 d5 exd5/i)).toBeInTheDocument();
  });
});
