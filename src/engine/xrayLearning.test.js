import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import {
  candidateMoveFromSquares,
  compareCandidates,
  formatEngineScore,
  playPvPrefix,
} from './xrayLearning.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('candidateMoveFromSquares', () => {
  it('creates UCI and decorated SAN on a throwaway board', () => {
    const before = START;
    expect(candidateMoveFromSquares(START, 'e2', 'e4')).toEqual({
      ply: 1,
      uci: 'e2e4',
      san: 'e4',
      from: 'e2',
      to: 'e4',
      promotion: null,
      color: 'white',
    });
    expect(START).toBe(before);
  });

  it('supports castling and underpromotion notation', () => {
    const castling = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
    expect(candidateMoveFromSquares(castling, 'e1', 'g1').san).toBe('O-O');

    const promotion = candidateMoveFromSquares('7k/P7/8/8/8/8/8/7K w - - 0 1', 'a7', 'a8', 'wN');
    expect(promotion.uci).toBe('a7a8n');
    expect(promotion.san).toBe('a8=N');
  });

  it('rejects illegal moves and invalid promotion pieces', () => {
    expect(() => candidateMoveFromSquares(START, 'e2', 'e5')).toThrow(/Illegal candidate/);
    expect(() => candidateMoveFromSquares(START, 'e2', 'e4', 'king')).toThrow(/Promotion must/);
  });
});

describe('playPvPrefix', () => {
  const pv = ['e2e4', 'e7e5', 'g1f3', 'b8c6'];

  it('returns the position, current move, and one readable arrow at a selected ply', () => {
    const original = [...pv];
    const playback = playPvPrefix(START, pv, 3);
    const expected = new Chess(START);
    expected.move('e4');
    expected.move('e5');
    expected.move('Nf3');

    expect(playback.fen).toBe(expected.fen());
    expect(playback.currentMove).toMatchObject({ ply: 3, uci: 'g1f3', san: 'Nf3', color: 'white' });
    expect(playback.arrows).toEqual([['g1', 'f3', 'idea']]);
    expect(playback.appliedMoves.map((move) => move.san)).toEqual(['e4', 'e5', 'Nf3']);
    expect(pv).toEqual(original);
  });

  it('supports the root position and clamps a scrubber beyond the line', () => {
    const root = playPvPrefix(START, pv, 0);
    expect(root).toMatchObject({ fen: START, currentMove: null, arrows: [], plyCount: 0 });
    expect(playPvPrefix(START, pv, 99).plyCount).toBe(pv.length);
  });

  it('validates only the selected prefix and identifies a bad PV ply', () => {
    const withBadTail = ['e2e4', 'e7e6', 'e4e6'];
    expect(() => playPvPrefix(START, withBadTail, 1)).not.toThrow();
    expect(() => playPvPrefix(START, withBadTail, 3)).toThrow(/e4e6.*ply 3/);
    expect(() => playPvPrefix(START, ['not-uci'], 1)).toThrow(/Invalid UCI.*ply 1/);
  });
});

describe('compareCandidates', () => {
  const snapshots = [
    {
      depth: 12,
      lines: [
        { rank: 1, score: 48, mate: null, bound: 'exact', uciMoves: ['e2e4'], sanMoves: ['e4'] },
        { rank: 2, score: 31, mate: null, bound: 'exact', uciMoves: ['d2d4'], sanMoves: ['d4'] },
        { rank: 3, score: 18, mate: null, bound: 'lower', uciMoves: ['g1f3'], sanMoves: ['Nf3'] },
      ],
    },
    {
      depth: 8,
      lines: [
        { rank: 1, score: 20, mate: null, bound: 'exact', uciMoves: ['c2c4'], sanMoves: ['c4'] },
      ],
    },
  ];

  it('uses the newest depth and reports match, rank, and learner debrief data', () => {
    const candidates = [
      candidateMoveFromSquares(START, 'd2', 'd4'),
      candidateMoveFromSquares(START, 'b1', 'c3'),
      'e2e4',
    ];
    const result = compareCandidates(candidates, { depthSnapshots: snapshots });

    expect(result.depth).toBe(12);
    expect(result.matchedCount).toBe(2);
    expect(result.comparisons).toEqual([
      expect.objectContaining({
        uci: 'd2d4',
        matched: true,
        rank: 2,
        debrief: expect.objectContaining({ tone: 'matched' }),
      }),
      expect.objectContaining({
        uci: 'b1c3',
        matched: false,
        rank: null,
        debrief: expect.objectContaining({ tone: 'outside' }),
      }),
      expect.objectContaining({
        uci: 'e2e4',
        matched: true,
        rank: 1,
        debrief: expect.objectContaining({ tone: 'leading' }),
      }),
    ]);
    expect(result.debrief).toMatchObject({ tone: 'partial' });
    expect(result.engineFirstMoves.map((move) => move.uci)).toEqual(['e2e4', 'd2d4', 'g1f3']);
  });

  it('accepts a snapshot or lines directly and compares at most three candidates', () => {
    const four = ['a2a3', 'b2b3', 'c2c3', 'd2d3'];
    expect(compareCandidates(four, snapshots[0]).comparisons).toHaveLength(3);
    expect(compareCandidates(['e2e4'], snapshots[0].lines).comparisons[0].rank).toBe(1);
  });

  it('provides stable prompt and pending states without mutating inputs', () => {
    const candidates = [{ uci: 'e2e4', san: 'e4', note: 'mine' }];
    const before = structuredClone(candidates);
    const pending = compareCandidates(candidates, null);
    expect(pending.comparisons[0]).toMatchObject({
      matched: false,
      rank: null,
      debrief: { tone: 'waiting', headline: 'Analysis pending', detail: expect.any(String) },
    });
    expect(pending.debrief.tone).toBe('waiting');
    expect(compareCandidates([], snapshots).debrief.tone).toBe('prompt');
    expect(candidates).toEqual(before);
  });

  it('rejects malformed candidate inputs', () => {
    expect(() => compareCandidates(null, snapshots)).toThrow(/must be an array/);
    expect(() => compareCandidates([{ uci: 'e2e9' }], snapshots)).toThrow(/valid UCI/);
  });
});

describe('formatEngineScore', () => {
  it('formats exact centipawns as signed pawn values', () => {
    expect(formatEngineScore({ score: 48 })).toBe('+0.48');
    expect(formatEngineScore({ score: -125 })).toBe('-1.25');
    expect(formatEngineScore({ score: 0 })).toBe('0.00');
  });

  it('formats mate distances and preserves bounds', () => {
    expect(formatEngineScore({ mate: 3 })).toBe('M3');
    expect(formatEngineScore({ mate: -2 })).toBe('-M2');
    expect(formatEngineScore({ score: 75, bound: 'lower' })).toBe('≥+0.75');
    expect(formatEngineScore({ mate: -4, bound: 'upper' })).toBe('≤-M4');
  });

  it('uses an em dash for unavailable or non-finite scores', () => {
    expect(formatEngineScore()).toBe('—');
    expect(formatEngineScore({ score: Number.NaN })).toBe('—');
  });
});
