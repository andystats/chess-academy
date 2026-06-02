import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import {
  boardFen,
  deserialize,
  indexToSquare,
  initialState,
  parsePlacement,
  placementToString,
  serialize,
  squareToIndex,
  START_PLACEMENT,
} from './board.js';

describe('board coordinates', () => {
  it('maps the corners and centre between squares and indices', () => {
    expect(squareToIndex('a8')).toBe(0);
    expect(squareToIndex('h8')).toBe(7);
    expect(squareToIndex('a1')).toBe(56);
    expect(squareToIndex('h1')).toBe(63);
    for (const square of ['a8', 'h1', 'e4', 'd5', 'b2']) {
      expect(indexToSquare(squareToIndex(square))).toBe(square);
    }
  });
});

describe('placement (de)serialization', () => {
  it('round-trips the standard starting placement', () => {
    expect(placementToString(parsePlacement(START_PLACEMENT))).toBe(START_PLACEMENT);
  });
});

describe('state (de)serialization', () => {
  it('round-trips the initial state', () => {
    const state = initialState();
    expect(deserialize(serialize(state))).toEqual(state);
  });

  it('round-trips a mid-game state with no duck yet, en passant, and full castling', () => {
    const wire = 'rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR b piece - KQkq d6 3 7';
    const state = deserialize(wire);
    expect(state.duck).toBeNull();
    expect(state.ep).toBe('d6');
    expect(serialize(state)).toBe(wire);
  });

  it('encodes the duck square and phase as a FEN superset', () => {
    const wire = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w duck e3 KQkq - 0 1';
    const state = deserialize(wire);
    expect(state.phase).toBe('duck');
    expect(state.duck).toBe('e3');
    expect(serialize(state)).toBe(wire);
  });

  it('boardFen drops phase + duck and parses under chess.js', () => {
    const state = deserialize('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w duck e3 KQkq - 0 1');
    const fen = boardFen(state);
    expect(fen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    expect(() => new Chess(fen)).not.toThrow();
  });
});
