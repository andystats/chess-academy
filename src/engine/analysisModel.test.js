import { describe, expect, it, vi } from 'vitest';
import {
  createDepthSnapshotCollector,
  normalizeClassicalEvaluation,
  normalizeUciScore,
  sideToMove,
  uciMovesToSan,
} from './analysisModel.js';
import { parseClassicalEvalTrace, parseUciInfo } from './analysisParsers.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('principal-variation model', () => {
  it('converts a legal UCI line to decorated SAN without changing the source position', () => {
    expect(
      uciMovesToSan(START, [
        'e2e4',
        'e7e5',
        'g1f3',
        'b8c6',
        'f1b5',
        'a7a6',
        'b5a4',
        'g8f6',
        'e1g1',
      ]),
    ).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O']);
    expect(sideToMove(START)).toBe('white');
  });

  it('rejects malformed and illegal UCI lines', () => {
    expect(() => uciMovesToSan(START, ['nope'])).toThrow(/Invalid UCI/);
    expect(() => uciMovesToSan(START, ['e2e5'])).toThrow(/Illegal UCI/);
  });

  it('normalizes scores, mate distances, and score bounds to the learner side', () => {
    expect(normalizeUciScore({ type: 'cp', value: 42, bound: 'upper' }, 'white', 'black')).toEqual({
      score: -42,
      mate: null,
      bound: 'lower',
    });
    expect(normalizeUciScore({ type: 'mate', value: -3, bound: 'lower' }, 'black', 'black')).toEqual({
      score: null,
      mate: -3,
      bound: 'lower',
    });
  });

  it('preserves one ranked snapshot per fully emitted depth and drops illegal PVs', () => {
    const onSnapshot = vi.fn();
    const collector = createDepthSnapshotCollector({
      fen: START,
      learnerSide: 'black',
      onSnapshot,
    });

    collector.add(
      parseUciInfo(
        'info depth 1 seldepth 2 multipv 1 score cp 30 nodes 100 nps 10000 time 10 pv e2e4 e7e5',
      ),
    );
    collector.add(
      parseUciInfo(
        'info depth 1 seldepth 3 multipv 2 score cp 20 nodes 110 nps 11000 time 10 pv d2d4 d7d5',
      ),
    );
    expect(onSnapshot).not.toHaveBeenCalled();
    collector.add(
      parseUciInfo(
        'info depth 1 seldepth 2 multipv 3 score mate 5 lowerbound nodes 120 nps 12000 time 11 pv g1f3 g8f6',
      ),
    );
    collector.add(
      parseUciInfo('info depth 2 multipv 1 score cp 40 nodes 200 time 20 pv e2e5'),
    );

    expect(collector.snapshots()).toEqual([
      {
        depth: 1,
        selectiveDepth: 3,
        nodes: 120,
        nps: 12000,
        elapsedMs: 11,
        lines: [
          {
            rank: 1,
            score: -30,
            mate: null,
            bound: 'exact',
            uciMoves: ['e2e4', 'e7e5'],
            sanMoves: ['e4', 'e5'],
          },
          {
            rank: 2,
            score: -20,
            mate: null,
            bound: 'exact',
            uciMoves: ['d2d4', 'd7d5'],
            sanMoves: ['d4', 'd5'],
          },
          {
            rank: 3,
            score: null,
            mate: -5,
            bound: 'upper',
            uciMoves: ['g1f3', 'g8f6'],
            sanMoves: ['Nf3', 'Nf6'],
          },
        ],
      },
    ]);
    expect(onSnapshot).toHaveBeenCalledTimes(1);
  });
});

describe('classical evaluation model', () => {
  it('keeps source columns and adds learner-relative term advantages', () => {
    const parsed = parseClassicalEvalTrace(`
      Material | ---- ---- | ---- ---- | 1.20 1.50
      Knights  | 0.10 0.20 | -0.10 -0.20 | 0.20 0.40
      Total    | ---- ---- | ---- ---- | 1.40 1.90
      Total evaluation: 1.65 (white side)
    `);
    const result = normalizeClassicalEvaluation(parsed, 'black');

    expect(result.perspective).toBe('black');
    expect(result.material.total).toEqual({ middleGame: 1.2, endgame: 1.5 });
    expect(result.material.advantage).toEqual({ middleGame: -1.2, endgame: -1.5 });
    expect(result.pieces.knights.advantage).toEqual({ middleGame: -0.2, endgame: -0.4 });
    expect(result.total.final).toBe(1.65);
    expect(result.total.finalAdvantage).toBe(-1.65);
  });
});
