import { describe, it, expect } from 'vitest';
import { createDuckDecayGame } from './duckChess.js';

describe('Duck Chess Decay', () => {
  it('leaves a temporary decayed square when the duck moves away', () => {
    const game = createDuckDecayGame();
    game.movePiece({ from: 'e2', to: 'e4' });
    expect(game.placeDuck('e3').ok).toBe(true);
    expect(game.decaySquares()).toEqual([]);
    expect(game.serialize()).not.toContain('decay=');

    game.movePiece({ from: 'e7', to: 'e5' });
    expect(game.placeDuck('d3').ok).toBe(true);

    expect(game.duckSquare()).toBe('d3');
    expect(game.decaySquares()).toEqual(['e3']);
    expect(game.legalDuckTargets()).not.toContain('e3');
    expect(game.serialize()).toContain('decay=e3:2');
  });

  it('treats decayed squares as blockers for pieces and duck placement', () => {
    const game = createDuckDecayGame('4k3/8/8/8/8/8/8/R3K3 w piece - - - 0 1 decay=a3:2');

    expect(game.legalPieceTargets('a1')).toEqual(expect.arrayContaining(['a2', 'b1', 'c1', 'd1']));
    expect(game.legalPieceTargets('a1')).not.toContain('a3');
    expect(game.legalPieceTargets('a1')).not.toContain('a4');
    expect(game.legalDuckTargets()).not.toContain('a3');
  });

  it('repairs decayed squares after two completed duck placements', () => {
    const game = createDuckDecayGame();
    game.movePiece({ from: 'e2', to: 'e4' });
    game.placeDuck('e3');

    game.movePiece({ from: 'e7', to: 'e5' });
    game.placeDuck('d3');
    expect(game.decaySquares()).toEqual(['e3']);

    game.movePiece({ from: 'g1', to: 'f3' });
    game.placeDuck('c3');
    expect(game.decaySquares()).toEqual(['d3', 'e3']);
    expect(game.legalDuckTargets()).not.toContain('e3');

    game.movePiece({ from: 'b8', to: 'c6' });
    game.placeDuck('b3');
    expect(game.decaySquares()).toEqual(['c3', 'd3']);
    expect(game.legalDuckTargets()).toContain('e3');
    expect(game.serialize()).not.toContain('e3');
  });

  it('round-trips decay through the variant extension field', () => {
    const game = createDuckDecayGame();
    game.movePiece({ from: 'e2', to: 'e4' });
    game.placeDuck('e3');
    game.movePiece({ from: 'e7', to: 'e5' });
    game.placeDuck('d3');

    const restored = createDuckDecayGame(game.serialize());
    expect(restored.getState()).toEqual(game.getState());
    expect(restored.decaySquares()).toEqual(['e3']);
  });

  it('rejects malformed decay extension data', () => {
    for (const wire of [
      '4k3/8/8/8/8/8/8/4K3 w piece - - - 0 1 decay=z9:1',
      '4k3/8/8/8/8/8/8/4K3 w piece - - - 0 1 decay=e3:0',
      '4k3/8/8/8/8/8/8/4K3 w piece - - - 0 1 decay=e3:3',
      '4k3/8/8/8/4P3/8/8/4K3 w piece - - - 0 1 decay=e4:1',
    ]) {
      expect(() => createDuckDecayGame(wire), wire).toThrow();
    }
  });
});
