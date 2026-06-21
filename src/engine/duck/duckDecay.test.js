import { describe, it, expect } from 'vitest';
import { createDuckGame, createDuckDecayGame } from './duckChess.js';

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
    expect(game.serialize()).not.toContain('decay=e3');
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

  it('stores custom parameters and permanently breaks a square at the hit threshold', () => {
    const game = createDuckDecayGame(undefined, { decayTurns: 1, breakHits: 2 });
    expect(game.serialize()).toContain('decay-turns=1');
    expect(game.serialize()).toContain('break-hits=2');

    game.movePiece({ from: 'e2', to: 'e4' });
    game.placeDuck('e3');

    game.movePiece({ from: 'e7', to: 'e5' });
    game.placeDuck('d3');
    expect(game.decaySquares()).toEqual(['e3']);
    expect(game.brokenSquares()).toEqual([]);

    game.movePiece({ from: 'g1', to: 'f3' });
    game.placeDuck('c3'); // e3 repairs here, so the duck can return to it.
    expect(game.legalDuckTargets()).toContain('e3');

    game.movePiece({ from: 'b8', to: 'c6' });
    game.placeDuck('e3');

    game.movePiece({ from: 'f1', to: 'e2' });
    game.placeDuck('d4'); // second hit on e3: permanent break.

    expect(game.decaySquares()).not.toContain('e3');
    expect(game.brokenSquares()).toEqual(['e3']);
    expect(game.legalDuckTargets()).not.toContain('e3');
    expect(game.serialize()).toContain('broken=e3');

    const restored = createDuckDecayGame(game.serialize());
    expect(restored.getState()).toEqual(game.getState());
  });

  it('rejects malformed decay extension data', () => {
    for (const wire of [
      '4k3/8/8/8/8/8/8/4K3 w piece - - - 0 1 decay=z9:1',
      '4k3/8/8/8/8/8/8/4K3 w piece - - - 0 1 decay=e3:0',
      '4k3/8/8/8/8/8/8/4K3 w piece - - - 0 1 decay=e3:3',
      '4k3/8/8/8/4P3/8/8/4K3 w piece - - - 0 1 decay=e4:1',
      '4k3/8/8/8/8/8/8/4K3 w piece - - - 0 1 decay-turns=0',
      '4k3/8/8/8/8/8/8/4K3 w piece - - - 0 1 break-hits=10',
      '4k3/8/8/8/8/8/8/4K3 w piece - - - 0 1 hits=e3:5',
      '4k3/8/8/8/8/8/8/4K3 w piece - - - 0 1 broken=e1',
      '4k3/8/8/8/8/8/8/4K3 w piece - - - 0 1 prime=0',
      '4k3/8/8/8/8/8/8/4K3 w piece - - - 0 1 prime=true',
      '4k3/8/8/8/8/8/8/4K3 w piece - - - 0 1 prime=1 charges=0',
      '4k3/8/8/8/8/8/8/4K3 w piece - - - 0 1 prime=1 charges=10',
      '4k3/8/8/8/8/8/8/4K3 w piece - - - 0 1 prime=1 charges=3 charges-w=4',
      '4k3/8/8/8/8/8/8/4K3 w piece - - - 0 1 prime=1 charges=3 charges-w=-1',
    ]) {
      expect(() => createDuckDecayGame(wire), wire).toThrow();
    }
  });
});

describe('Duck Chess Decay — crack visibility', () => {
  it('defaults Breaks At to 5 and exposes a regrown scar that decaySquares omits', () => {
    const game = createDuckDecayGame();
    expect(game.serialize()).toContain('break-hits=5');
    expect(game.breakHitsValue()).toBe(5);

    game.movePiece({ from: 'e2', to: 'e4' });
    game.placeDuck('e3');
    game.movePiece({ from: 'e7', to: 'e5' });
    game.placeDuck('d3'); // e3 cracks (decay=2, hits=1)
    game.movePiece({ from: 'g1', to: 'f3' });
    game.placeDuck('c3'); // e3 decay ages to 1
    game.movePiece({ from: 'b8', to: 'c6' });
    game.placeDuck('b3'); // e3 regrows — passable again, but keeps its scar

    expect(game.decaySquares()).not.toContain('e3'); // no longer blocking
    expect(game.decayLevels().e3).toBe(1); // …yet still visibly cracked
  });

  it('reports no crack levels for plain Duck Chess (decay disabled)', () => {
    const plain = createDuckGame();
    expect(plain.breakHitsValue()).toBeNull();
    expect(plain.decayLevels()).toEqual({});
    expect(plain.primeEnabled()).toBe(false);
    expect(plain.chargesLeft()).toBeNull();
  });
});

describe('Duck Chess Decay — Prime', () => {
  it('lifts the duck off the board for a charge, leaving no new scar', () => {
    const game = createDuckDecayGame(undefined, { prime: true, charges: 2 });
    expect(game.chargesLeft()).toEqual({ white: 2, black: 2 });
    expect(game.serialize()).toContain('prime=1');

    game.movePiece({ from: 'e2', to: 'e4' });
    game.placeDuck('e3'); // duck on e3
    game.movePiece({ from: 'e7', to: 'e5' });
    expect(game.liftDuck().ok).toBe(true); // black lifts instead of placing

    expect(game.duckSquare()).toBeNull();
    expect(game.turnColor()).toBe('white');
    expect(game.chargesLeft()).toEqual({ white: 2, black: 1 });
    expect(game.decaySquares()).toEqual([]); // the vacated square did NOT decay
    expect(game.decayLevels()).toEqual({});
  });

  it('rejects a lift with no duck, in the piece phase, with no charges, or with prime off', () => {
    const fresh = createDuckDecayGame(undefined, { prime: true, charges: 1 });
    expect(fresh.liftDuck().ok).toBe(false); // piece phase
    fresh.movePiece({ from: 'e2', to: 'e4' });
    expect(fresh.liftDuck().ok).toBe(false); // duck phase but no duck on the board yet

    const spent = createDuckDecayGame('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w duck e3 KQkq - 0 1 charges=1 charges-b=1 charges-w=0 prime=1');
    expect(spent.liftDuck().ok).toBe(false); // white's pool is empty

    const noPrime = createDuckDecayGame();
    noPrime.movePiece({ from: 'e2', to: 'e4' });
    expect(noPrime.liftDuck().ok).toBe(false); // prime off
  });

  it('repairs a decayed or shattered square for a charge as the whole turn', () => {
    const decayed = createDuckDecayGame(undefined, { prime: true, charges: 2 });
    decayed.movePiece({ from: 'e2', to: 'e4' });
    decayed.placeDuck('e3');
    decayed.movePiece({ from: 'e7', to: 'e5' });
    decayed.placeDuck('d3'); // e3 cracks
    expect(decayed.decaySquares()).toEqual(['e3']);
    expect(decayed.repairSquare('e3').ok).toBe(true); // white spends its turn repairing
    expect(decayed.decaySquares()).toEqual([]);
    expect(decayed.decayLevels().e3).toBeUndefined(); // scar cleared too
    expect(decayed.turnColor()).toBe('black');
    expect(decayed.chargesLeft()).toEqual({ white: 1, black: 2 });

    const broken = createDuckDecayGame('4k3/8/8/8/8/8/8/4K3 w piece - - - 0 1 charges=2 charges-b=2 charges-w=2 prime=1 broken=e4');
    expect(broken.brokenSquares()).toEqual(['e4']);
    expect(broken.repairSquare('e4').ok).toBe(true); // a charge restores even a permanent shatter
    expect(broken.brokenSquares()).toEqual([]);
    expect(broken.chargesLeft()).toEqual({ white: 1, black: 2 });
  });

  it('rejects a repair with no target, in the duck phase, or with no charges', () => {
    const game = createDuckDecayGame(undefined, { prime: true, charges: 2 });
    expect(game.repairSquare('e4').ok).toBe(false); // nothing decayed or broken
    expect(game.repairSquare('z9').ok).toBe(false); // off-board

    game.movePiece({ from: 'e2', to: 'e4' });
    expect(game.repairSquare('e4').ok).toBe(false); // duck phase, not piece phase

    const spent = createDuckDecayGame('4k3/8/8/8/8/8/8/4K3 w piece - - - 0 1 charges=2 charges-b=2 charges-w=0 prime=1 broken=e4');
    expect(spent.repairSquare('e4').ok).toBe(false); // white's pool is empty
  });

  it('round-trips prime state (allotment + spent charges) through serialize', () => {
    const game = createDuckDecayGame(undefined, { prime: true, charges: 2 });
    game.movePiece({ from: 'e2', to: 'e4' });
    game.placeDuck('e3');
    game.movePiece({ from: 'e7', to: 'e5' });
    game.liftDuck(); // black now holds 1 of 2 charges

    const restored = createDuckDecayGame(game.serialize());
    expect(restored.getState()).toEqual(game.getState());
    expect(restored.chargesLeft()).toEqual({ white: 2, black: 1 }); // a non-default count survives
  });

  it('repairing a square resets its hidden break-hit count (a defused square takes full breakHits again)', () => {
    // e3 is decayed and one hit from shattering (hits=1 of break-hits=2). Repairing must clear the count.
    const game = createDuckDecayGame('4k3/8/8/8/8/8/8/4K3 w piece - - - 0 1 break-hits=2 decay-turns=2 decay=e3:2 hits=e3:1 charges=9 charges-b=9 charges-w=9 prime=1');
    expect(game.repairSquare('e3').ok).toBe(true); // white defuses e3; turn → black
    expect(game.decayLevels().e3).toBeUndefined();

    // The duck sits on e3 and leaves again → its hit count restarts at 1, not 2.
    game.movePiece({ from: 'e8', to: 'e7' });
    game.placeDuck('e3');
    game.movePiece({ from: 'e1', to: 'e2' });
    game.placeDuck('d4'); // duck leaves e3

    expect(game.brokenSquares()).toEqual([]); // would have shattered if the old count had persisted
    expect(game.decaySquares()).toContain('e3'); // merely decayed again
    expect(game.decayLevels().e3).toBe(1);
  });

  it('rejects a lift after a king-capturing move (the turn already ended in the piece phase)', () => {
    const game = createDuckDecayGame('4k3/8/8/8/8/8/4q3/4K3 b piece a3 - - 0 1 charges=2 charges-b=2 charges-w=2 prime=1');
    expect(game.movePiece({ from: 'e2', to: 'e1' }).kingCaptured).toBe(true); // black queen takes the king
    expect(game.result()).toEqual({ winner: 'black', reason: 'King captured' });
    expect(game.phase()).toBe('piece'); // no duck phase after a king capture
    expect(game.liftDuck().ok).toBe(false); // nothing to lift; the game is over
  });
});
