import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import {
  isUci,
  uciToMove,
  applyMove,
  moveToLan,
  compileToLan,
  acceptableLans,
  legalTargets,
  mainlineIndexForPlayerMove,
} from './moves.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('isUci / uciToMove', () => {
  it('recognizes UCI strings and not SAN', () => {
    expect(isUci('e2e4')).toBe(true);
    expect(isUci('a7a8q')).toBe(true);
    expect(isUci('Nf3')).toBe(false);
    expect(isUci('O-O')).toBe(false);
  });

  it('parses a UCI string into a move object with promotion', () => {
    expect(uciToMove('a7a8q')).toEqual({ from: 'a7', to: 'a8', promotion: 'q' });
    expect(uciToMove('e2e4')).toEqual({ from: 'e2', to: 'e4', promotion: undefined });
  });
});

describe('applyMove', () => {
  it('applies SAN and UCI to the same result', () => {
    expect(applyMove(new Chess(START), 'e4').san).toBe('e4');
    expect(applyMove(new Chess(START), 'e2e4').san).toBe('e4');
    expect(applyMove(new Chess(START), 'Nf3').san).toBe('Nf3');
  });

  it('throws on an illegal move (chess.js never returns null)', () => {
    expect(() => applyMove(new Chess(START), 'e5')).toThrow();
    expect(() => applyMove(new Chess(START), 'e2e5')).toThrow();
  });
});

describe('LAN compilation', () => {
  it('moveToLan includes promotion', () => {
    const m = applyMove(new Chess(START), 'e4');
    expect(moveToLan(m)).toBe('e2e4');
  });

  it('compiles SAN to LAN at a position', () => {
    expect(compileToLan(START, 'e4')).toBe('e2e4');
    expect(compileToLan(START, 'Nf3')).toBe('g1f3');
  });

  it('acceptableLans turns a SAN list into a Set of LANs', () => {
    expect(acceptableLans(START, ['e4', 'd4'])).toEqual(new Set(['e2e4', 'd2d4']));
  });
});

describe('legalTargets', () => {
  it('lists destination squares for a piece', () => {
    const targets = legalTargets(new Chess(START), 'e2');
    expect(targets).toEqual(expect.arrayContaining(['e3', 'e4']));
    expect(legalTargets(new Chess(START), 'e4')).toEqual([]); // empty square
  });
});

describe('mainlineIndexForPlayerMove', () => {
  it('maps ordinals with and without a setup ply', () => {
    expect(mainlineIndexForPlayerMove(0, false)).toBe(0);
    expect(mainlineIndexForPlayerMove(2, false)).toBe(4);
    expect(mainlineIndexForPlayerMove(0, true)).toBe(1);
    expect(mainlineIndexForPlayerMove(1, true)).toBe(3);
  });
});
