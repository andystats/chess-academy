import { describe, it, expect } from 'vitest';
import { squareToIndex } from './board.js';
import { createDuckGame } from './duckChess.js';

describe('turn machine', () => {
  it('runs piece → duck → flip, with no duck on the board for the opening move', () => {
    const game = createDuckGame();
    expect(game.turnColor()).toBe('white');
    expect(game.phase()).toBe('piece');
    expect(game.duckSquare()).toBeNull();

    expect(game.movePiece({ from: 'e2', to: 'e4' }).ok).toBe(true);
    expect(game.phase()).toBe('duck');
    expect(game.turnColor()).toBe('white'); // same player still places the duck

    expect(game.placeDuck('e6').ok).toBe(true);
    expect(game.phase()).toBe('piece');
    expect(game.turnColor()).toBe('black');
    expect(game.duckSquare()).toBe('e6');
  });

  it('rejects a duck placement before a piece move, and a piece move during the duck phase', () => {
    const game = createDuckGame();
    expect(game.placeDuck('e3').ok).toBe(false); // wrong phase
    game.movePiece({ from: 'e2', to: 'e4' });
    expect(game.movePiece({ from: 'd2', to: 'd4' }).ok).toBe(false); // must place the duck first
  });

  it('round-trips through serialize → createDuckGame', () => {
    const game = createDuckGame();
    game.movePiece({ from: 'e2', to: 'e4' });
    game.placeDuck('e6');
    const restored = createDuckGame(game.serialize());
    expect(restored.getState()).toEqual(game.getState());
  });

  it('places the duck on a game resumed from a mid-turn snapshot (refresh between move and duck)', () => {
    const game = createDuckGame();
    game.movePiece({ from: 'e2', to: 'e4' });
    const resumed = createDuckGame(game.serialize()); // the wire format drops history
    expect(resumed.phase()).toBe('duck');
    expect(resumed.placeDuck('e3').ok).toBe(true);
    expect(resumed.duckSquare()).toBe('e3');
    expect(resumed.turnColor()).toBe('black');
    expect(resumed.history()).toHaveLength(0); // nothing to annotate — the half-turn predates the resume
  });
});

describe('king capture wins immediately', () => {
  it('ends the game in the piece phase and rejects further actions', () => {
    const game = createDuckGame('3k4/8/8/8/8/8/8/3QK3 w piece - - - 0 1');
    const outcome = game.movePiece({ from: 'd1', to: 'd8' });
    expect(outcome.ok).toBe(true);
    expect(outcome.kingCaptured).toBe(true);
    expect(game.phase()).toBe('piece'); // never advances to the duck phase
    expect(game.result()).toEqual({ winner: 'white', reason: 'King captured' });
    expect(game.movePiece({ from: 'd8', to: 'd7' }).ok).toBe(false);
    expect(game.placeDuck('a1').ok).toBe(false);
  });
});

describe('en passant', () => {
  it('survives the duck placement and can be captured on the next turn', () => {
    const game = createDuckGame('4k3/3p4/8/4P3/8/8/8/4K3 b piece - - - 0 1');
    expect(game.movePiece({ from: 'd7', to: 'd5' }).ok).toBe(true); // double push sets ep = d6
    expect(game.getState().ep).toBe('d6');
    game.placeDuck('a6'); // turn flips to white, ep target still standing
    expect(game.getState().ep).toBe('d6');

    expect(game.legalPieceTargets('e5')).toContain('d6');
    expect(game.movePiece({ from: 'e5', to: 'd6' }).ok).toBe(true);
    const state = game.getState();
    expect(state.board[squareToIndex('d5')]).toBeNull(); // captured pawn removed
    expect(state.ep).toBeNull(); // not a double push, so the target clears
    expect(game.captured().black).toContain('p');
  });

  it('clears the en passant target when the opponent does not take it', () => {
    const game = createDuckGame('4k3/3p4/8/4P3/8/8/8/4K3 b piece - - - 0 1');
    game.movePiece({ from: 'd7', to: 'd5' });
    game.placeDuck('a6');
    game.movePiece({ from: 'e1', to: 'e2' }); // a quiet move instead of the ep capture
    expect(game.getState().ep).toBeNull();
  });
});

describe('promotion', () => {
  it('promotes to a queen by default and to the requested piece otherwise', () => {
    const queened = createDuckGame('7k/P7/8/8/8/8/8/4K3 w piece - - - 0 1');
    queened.movePiece({ from: 'a7', to: 'a8' });
    expect(queened.getState().board[0]).toBe('Q'); // a8

    const knighted = createDuckGame('7k/P7/8/8/8/8/8/4K3 w piece - - - 0 1');
    knighted.movePiece({ from: 'a7', to: 'a8', promotion: 'n' });
    expect(knighted.getState().board[0]).toBe('N');
  });
});

describe('duck placement rules', () => {
  it('allows any empty square first, then forbids staying put or landing on a piece', () => {
    const game = createDuckGame();
    game.movePiece({ from: 'e2', to: 'e4' });
    expect(game.placeDuck('d1').ok).toBe(false); // occupied
    expect(game.placeDuck('e3').ok).toBe(true); // first placement: any empty square

    game.movePiece({ from: 'e7', to: 'e5' });
    expect(game.placeDuck('e3').ok).toBe(false); // the duck must move off its square
    expect(game.placeDuck('e4').ok).toBe(false); // occupied by the white pawn
    expect(game.placeDuck('d3').ok).toBe(true);
  });
});

describe('history', () => {
  it('records one entry per turn, pairing the piece move with the duck square', () => {
    const game = createDuckGame();
    game.movePiece({ from: 'e2', to: 'e4' });
    game.placeDuck('e3');
    const history = game.history();
    expect(history).toHaveLength(1);
    expect(history[0].pieceMove).toEqual({ from: 'e2', to: 'e4', promotion: null });
    expect(history[0].san).toBe('e4');
    expect(history[0].duck).toBe('e3');
  });
});
