import { describe, expect, it } from 'vitest';
import { parseClassicalEvalTrace, parseUciInfo } from './analysisParsers.js';

const TRACE = `
     Term    |    White    |    Black    |    Total
             |   MG    EG  |   MG    EG  |   MG    EG
 ------------+-------------+-------------+------------
    Material |  ----  ---- |  ----  ---- |  3.64  4.06
   Imbalance |  ----  ---- |  ----  ---- |  0.82  0.82
  Initiative |  ----  ---- |  ----  ---- |  0.00  0.03
       Pawns |  0.30 -0.07 |  0.30 -0.07 |  0.00  0.00
     Knights | -0.07 -0.17 | -0.12 -0.13 |  0.05 -0.03
     Bishops | -0.44 -1.12 | -0.21 -0.68 | -0.23 -0.44
       Rooks | -0.26 -0.02 | -0.26 -0.02 |  0.00  0.00
      Queens |  0.00  0.00 |  0.00  0.00 |  0.00  0.00
    Mobility | -0.22 -0.05 | -0.28  0.18 |  0.07 -0.24
 King safety |  0.52 -0.08 |  0.52 -0.08 |  0.00  0.00
     Threats |  0.39  0.44 |  0.66  0.63 | -0.27 -0.19
      Passed |  0.00  0.00 |  0.00  0.00 |  0.00  0.00
       Space |  0.62  0.00 |  0.54  0.00 |  0.08  0.00
 ------------+-------------+-------------+------------
       Total |  ----  ---- |  ----  ---- |  4.14  4.00

Total evaluation: 4.24 (white side)
`;

describe('parseUciInfo', () => {
  it('parses centipawns, MultiPV metadata, search counters, and the PV', () => {
    expect(
      parseUciInfo(
        'info depth 12 seldepth 19 multipv 2 score cp 35 nodes 21013 nps 350216 time 60 pv g1f3 d7d5 b2b3',
      ),
    ).toEqual({
      depth: 12,
      selectiveDepth: 19,
      rank: 2,
      score: { type: 'cp', value: 35, bound: 'exact' },
      nodes: 21013,
      nps: 350216,
      elapsedMs: 60,
      uciMoves: ['g1f3', 'd7d5', 'b2b3'],
    });
  });

  it('parses mate scores and upper/lower bounds', () => {
    expect(parseUciInfo('info depth 7 multipv 1 score mate -3 lowerbound pv h7h8q')).toMatchObject({
      depth: 7,
      rank: 1,
      score: { type: 'mate', value: -3, bound: 'lower' },
      uciMoves: ['h7h8q'],
    });
    expect(parseUciInfo('info depth 5 score cp 482 upperbound pv d2d3')).toMatchObject({
      score: { type: 'cp', value: 482, bound: 'upper' },
    });
  });

  it('keeps valid partial info lines but rejects non-info and malformed PV lines', () => {
    expect(parseUciInfo('bestmove e2e4')).toBeNull();
    expect(parseUciInfo('info depth 4 currmove e2e4 currmovenumber 2')).toEqual({
      depth: 4,
      selectiveDepth: null,
      rank: 1,
      score: null,
      nodes: null,
      nps: null,
      elapsedMs: null,
      uciMoves: [],
    });
    expect(parseUciInfo('info depth nope score cp 12 pv e2e4')).toMatchObject({ depth: null });
    expect(parseUciInfo('info depth 4 score cp 12 pv not-a-move')).toBeNull();
    expect(parseUciInfo('info depth -1 score cp 12 pv e2e4')).toBeNull();
  });
});

describe('parseClassicalEvalTrace', () => {
  it('parses Stockfish 10 term rows, missing cells, grouped pieces, and final evaluation', () => {
    const result = parseClassicalEvalTrace(TRACE);
    expect(result.sourcePerspective).toBe('white');
    expect(result.material).toEqual({
      white: { middleGame: null, endgame: null },
      black: { middleGame: null, endgame: null },
      total: { middleGame: 3.64, endgame: 4.06 },
    });
    expect(result.pieces.knights.total).toEqual({ middleGame: 0.05, endgame: -0.03 });
    expect(result.mobility.black).toEqual({ middleGame: -0.28, endgame: 0.18 });
    expect(result.kingSafety.total).toEqual({ middleGame: 0, endgame: 0 });
    expect(result.passedPawns.total).toEqual({ middleGame: 0, endgame: 0 });
    expect(result.total.total).toEqual({ middleGame: 4.14, endgame: 4 });
    expect(result.total.final).toBe(4.24);
  });

  it('ignores unknown and malformed rows and returns null for unrelated output', () => {
    const partial = parseClassicalEvalTrace([
      'Unknown thing | 1.0 2.0 | 3.0 4.0 | 5.0 6.0',
      'Mobility | malformed',
      'Total evaluation: -1.25 (black side)',
    ]);
    expect(partial.sourcePerspective).toBe('black');
    expect(partial.mobility).toBeNull();
    expect(partial.total.final).toBe(-1.25);
    expect(parseClassicalEvalTrace(['readyok', 'info depth 1'])).toBeNull();
    expect(parseClassicalEvalTrace(null)).toBeNull();
  });
});
