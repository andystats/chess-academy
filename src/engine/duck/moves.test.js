import { describe, it, expect } from 'vitest';
import { deserialize, initialState } from './board.js';
import { generatePieceMoves, legalDuckTargets, legalPieceTargets } from './moves.js';

describe('move generation — baseline', () => {
  it('generates the 20 opening piece moves from the start (no duck yet)', () => {
    expect(generatePieceMoves(initialState())).toHaveLength(20);
  });

  it('a duck on e3 removes exactly the e2 pawn pushes (single and double)', () => {
    const state = { ...initialState(), duck: 'e3' };
    expect(generatePieceMoves(state)).toHaveLength(18);
    expect(legalPieceTargets(state, 'e2')).toEqual([]);
  });
});

describe('move generation — duck as a blocker', () => {
  it('truncates a sliding ray and cannot pass through or land on the duck', () => {
    const state = deserialize('4k3/8/8/8/8/8/8/R3K3 w piece a4 - - 0 1');
    const targets = legalPieceTargets(state, 'a1');
    expect(targets).toEqual(expect.arrayContaining(['a2', 'a3', 'b1', 'c1', 'd1']));
    expect(targets).not.toContain('a4'); // the duck square
    expect(targets).not.toContain('a5'); // beyond the duck
  });

  it('lets a knight jump over the duck but not land on it', () => {
    const onLanding = deserialize('k7/8/8/8/4N3/8/8/K7 w piece f6 - - 0 1');
    const adjacent = deserialize('k7/8/8/4p3/4N3/8/8/K7 w piece e5 - - 0 1');
    expect(legalPieceTargets(onLanding, 'e4')).toHaveLength(7); // f6 landing square removed
    expect(legalPieceTargets(onLanding, 'e4')).not.toContain('f6');
    // The duck (and a pawn) sit directly in front of the knight, yet a knight never traverses
    // intervening squares — all 8 of its jumps remain available.
    expect(legalPieceTargets(adjacent, 'e4')).toHaveLength(8);
  });
});

describe('move generation — no check filtering', () => {
  it('lets the king move onto an attacked square', () => {
    const state = deserialize('k3r3/8/8/8/8/8/8/4K3 w piece - - - 0 1');
    // The black rook controls the whole e-file, but Duck Chess has no check — e2 is legal.
    expect(legalPieceTargets(state, 'e1')).toContain('e2');
  });
});

describe('move generation — castling', () => {
  it('offers both castles when the path is clear', () => {
    const state = deserialize('4k3/8/8/8/8/8/8/R3K2R w piece - KQ - 0 1');
    const targets = legalPieceTargets(state, 'e1');
    expect(targets).toEqual(expect.arrayContaining(['g1', 'c1']));
  });

  it('a duck on f1 blocks kingside castling but not queenside', () => {
    const state = deserialize('4k3/8/8/8/8/8/8/R3K2R w piece f1 KQ - 0 1');
    const targets = legalPieceTargets(state, 'e1');
    expect(targets).not.toContain('g1');
    expect(targets).toContain('c1');
  });

  it('still allows castling through an attacked square (no check rule)', () => {
    // Black rook on f8 attacks f1; ordinary chess would forbid O-O, Duck Chess allows it.
    const state = deserialize('5rk1/8/8/8/8/8/8/R3K2R w piece - KQ - 0 1');
    expect(legalPieceTargets(state, 'e1')).toContain('g1');
  });
});

describe('duck placement targets', () => {
  it('offers every empty square except the duck’s current square', () => {
    const state = { ...initialState(), duck: 'e3' };
    const targets = legalDuckTargets(state);
    expect(targets).not.toContain('e3'); // must move off its square
    expect(targets).not.toContain('e2'); // occupied by a pawn
    expect(targets).toContain('d3');
    // 64 squares − 32 starting pieces − 1 current duck square = 31 free squares.
    expect(targets).toHaveLength(31);
  });
});
