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

  it('round-trips variant extension fields opaquely, sorted by name', () => {
    const wire = `${START_PLACEMENT} w duck e3 KQkq - 0 1 decay=e4:2,d5:1 repair=12`;
    const state = deserialize(wire);
    expect(state.ext).toEqual({ decay: 'e4:2,d5:1', repair: '12' });
    expect(serialize(state)).toBe(wire); // emitted in sorted name order
    expect(boardFen(state)).not.toContain('decay'); // extensions never leak into the render FEN
  });

  it('keeps parsing plain 8-field strings (no extensions) with an empty ext', () => {
    const state = deserialize(`${START_PLACEMENT} w piece - KQkq - 0 1`);
    expect(state.ext).toEqual({});
    expect(serialize(state)).toBe(`${START_PLACEMENT} w piece - KQkq - 0 1`); // none emitted
  });

  it('rejects malformed extension fields', () => {
    for (const wire of [
      `${START_PLACEMENT} w piece - KQkq - 0 1 nonsense`, // no name=value shape
      `${START_PLACEMENT} w piece - KQkq - 0 1 BAD=1`, // uppercase name
      `${START_PLACEMENT} w piece - KQkq - 0 1 9lives=1`, // name can't start with a digit
    ]) {
      expect(() => deserialize(wire), `should reject: ${wire}`).toThrow();
    }
  });
});

describe('hostile wire input', () => {
  it('deserialize throws on malformed state instead of producing corrupt state', () => {
    const bad = [
      42, // non-string
      '', // empty
      'rnbq w piece -', // too few fields
      `${START_PLACEMENT} x piece - KQkq - 0 1`, // bad turn
      `${START_PLACEMENT} w flying - KQkq - 0 1`, // bad phase
      `${START_PLACEMENT} w duck z9 KQkq - 0 1`, // off-board duck square
      `${START_PLACEMENT} w piece - XYZW - 0 1`, // bad castling field
      `${START_PLACEMENT} w piece - KQkq j9 0 1`, // bad en-passant square
      `${START_PLACEMENT} w piece - KQkq - x 1`, // non-numeric halfmove
      `${START_PLACEMENT} w piece - KQkq - 0 -3`, // negative fullmove
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNRR w piece - KQkq - 0 1', // 65th square
      'rnbqkbnr/pppppppp5/8/8/8/8/PPPPPPPP/RNBQKBNR w piece - KQkq - 0 1', // overfull rank
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBN w piece - KQkq - 0 1', // 63 squares
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNZ w piece - KQkq - 0 1', // bad piece letter
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBKR w piece - KQkq - 0 1', // two white kings
    ];
    for (const wire of bad) {
      expect(() => deserialize(wire), `should reject: ${wire}`).toThrow();
    }
  });

  it('squareToIndex maps non-squares (including non-strings) to -1', () => {
    for (const input of ['z9', 'a9', 'i1', 'aa', '', 'e44', 42, null, undefined, {}]) {
      expect(squareToIndex(input)).toBe(-1);
    }
  });
});
