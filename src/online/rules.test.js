import { describe, it, expect } from 'vitest';
import { createVariantGame, lastMoveOf, VARIANTS } from './rules.js';

const INTERFACE = [
  'serialize',
  'boardFen',
  'turnColor',
  'phase',
  'duckSquare',
  'legalPieceTargets',
  'legalDuckTargets',
  'movePiece',
  'placeDuck',
  'result',
  'history',
  'captured',
];

describe('rules adapter — shape parity', () => {
  it('exposes the same interface for both variants', () => {
    for (const variant of ['standard', 'duck']) {
      const game = createVariantGame(variant);
      for (const method of INTERFACE) expect(typeof game[method]).toBe('function');
    }
  });
});

describe('standard adapter', () => {
  it('completes a turn in one piece move and flips the side to move', () => {
    const game = createVariantGame('standard');
    expect(game.turnColor()).toBe('white');
    expect(game.phase()).toBe('piece');
    expect(game.movePiece({ from: 'e2', to: 'e4' }).ok).toBe(true);
    expect(game.phase()).toBe('piece'); // no duck phase
    expect(game.turnColor()).toBe('black');
    expect(game.history()).toHaveLength(1);
    expect(game.history()[0]).toEqual({ pieceMove: { from: 'e2', to: 'e4', promotion: null }, san: 'e4', duck: null });
    expect(lastMoveOf(game)).toEqual({ from: 'e2', to: 'e4' });
    expect(game.duckSquare()).toBeNull();
    expect(game.legalDuckTargets()).toEqual([]);
  });

  it('rejects an illegal move and round-trips through serialize', () => {
    const game = createVariantGame('standard');
    expect(game.movePiece({ from: 'e2', to: 'e5' }).ok).toBe(false);
    game.movePiece({ from: 'e2', to: 'e4' });
    const restored = createVariantGame('standard', game.serialize());
    expect(restored.boardFen()).toBe(game.boardFen());
    expect(restored.turnColor()).toBe('black');
  });
});

describe('duck adapter', () => {
  it('requires a duck placement to complete the turn', () => {
    const game = createVariantGame('duck');
    game.movePiece({ from: 'e2', to: 'e4' });
    expect(game.phase()).toBe('duck');
    expect(game.turnColor()).toBe('white');
    game.placeDuck('e3');
    expect(game.turnColor()).toBe('black');
    expect(game.duckSquare()).toBe('e3');
    expect(lastMoveOf(game)).toEqual({ from: 'e2', to: 'e4' });
  });
});

describe('variant registry', () => {
  it('rejects unknown variants instead of silently falling back to standard', () => {
    for (const variant of ['duckDecay', '', undefined, 'constructor', '__proto__']) {
      expect(() => createVariantGame(variant), `should reject: ${variant}`).toThrow(/Unknown variant/);
    }
  });

  it('defines a complete entry per variant — the lobby, panel, and parser all derive from it', () => {
    for (const [id, entry] of Object.entries(VARIANTS)) {
      expect(entry.label, id).toBeTruthy();
      expect(entry.pickerLabel, id).toBeTruthy();
      expect(entry.sublabel, id).toBeTruthy();
      expect(typeof entry.create, id).toBe('function');
      expect(() => createVariantGame(id)).not.toThrow();
    }
  });
});
