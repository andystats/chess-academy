import { describe, expect, it } from 'vitest';
import {
  buildCoachingBrief,
  detectOpponentThreats,
  evaluateLastMove,
  explainEngineMove,
  inspectPosition,
} from './positionAnalyzer.js';
import { Chess } from 'chess.js';

// Black's b7 pawn is attacked by White's queen on f3; castling or defending resolves the threat.
const THREAT_ON_B7_FEN = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/1P3Q2/PBPP1PPP/RN2K1NR b KQkq - 2 5';
// White's queen on f3 and bishop on c4 target f7 (Scholar's mate threat)
const THREAT_ON_F7_FEN = 'rnbqkbnr/pppp1ppp/8/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR b KQkq - 2 2';
// Position where White's knight on e5 is undefended and attacked by Black's knight on c6
const HANGING_E5_FEN = 'r1bqk2r/pppp1ppp/2n2n2/4N3/4P3/8/PPPP1PPP/RNBQKB1R b KQkq - 0 4';

describe('positionAnalyzer', () => {
  it('detects immediate opponent threats when passing the turn (null-move check)', () => {
    const game = new Chess(THREAT_ON_F7_FEN);
    const threats = detectOpponentThreats(game, THREAT_ON_F7_FEN);

    expect(threats.length).toBeGreaterThan(0);
    expect(threats[0]).toMatchObject({
      san: 'Qxf7#',
      kind: 'mate',
      targetSquare: 'f7',
    });
  });

  it('explains why castling or defending neutralizes an active threat', () => {
    // In THREAT_ON_B7_FEN, White's queen on f3 eyes f7/b7; if Black castles O-O (e8g8), f7 is defended by the rook and king is tucked away
    const facts = inspectPosition(THREAT_ON_B7_FEN);
    expect(facts.canCastle).toBe(true);

    const castleExplanation = explainEngineMove(
      THREAT_ON_B7_FEN,
      {
        rank: 1,
        score: 15,
        uciMoves: ['e8g8', 'g1e2', 'd7d6'],
        sanMoves: ['O-O', 'Ne2', 'd6'],
      },
      facts,
    );

    expect(castleExplanation).not.toBeNull();
    expect(castleExplanation.san).toBe('O-O');
    expect(castleExplanation.why).toMatch(/Castling \(O-O\)/i);
    expect(castleExplanation.continuation).toMatch(/Ne2/);
  });

  it('explains when a move neutralizes a direct capture threat on a square', () => {
    // White's queen on b3 attacks Black's undefended b7 pawn (Bc8 developed to e6); Rb8 defends b7
    const fenWithB7Threat = 'r2qk2r/pppp1ppp/2n1bn2/2b1p3/4P3/1Q2B3/PPPP1PPP/RN2KBNR b KQkq - 3 5';
    const facts = inspectPosition(fenWithB7Threat);

    expect(facts.opponentThreats.some((t) => t.targetSquare === 'b7')).toBe(true);

    const defendB7 = explainEngineMove(
      fenWithB7Threat,
      {
        rank: 1,
        score: 10,
        uciMoves: ['a8b8', 'b3c2', 'c5b6'],
        sanMoves: ['Rb8', 'Qc2', 'Bb6'],
      },
      facts,
    );

    expect(defendB7.why).toMatch(/neutralizes the current threat on b7/i);
  });

  it('evaluates the last played move and flags blunders with concrete refutations', () => {
    const prevAnalysis = {
      fen: THREAT_ON_F7_FEN,
      learnerSide: 'black',
      depthSnapshots: [
        {
          depth: 10,
          lines: [
            {
              rank: 1,
              score: 30,
              uciMoves: ['g8f6', 'd2d3'],
              sanMoves: ['Nf6', 'd3'],
            },
          ],
        },
      ],
    };

    // Suppose Black blunders with 2...a6?? allowing 3.Qxf7#
    const afterBlunderFen = 'rnbqkbnr/1ppp1ppp/p7/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 3';
    const currAnalysis = {
      fen: afterBlunderFen,
      learnerSide: 'white',
      depthSnapshots: [
        {
          depth: 10,
          lines: [
            {
              rank: 1,
              mate: 1,
              uciMoves: ['f3f7'],
              sanMoves: ['Qxf7#'],
            },
          ],
        },
      ],
    };

    const review = evaluateLastMove({
      prevFen: THREAT_ON_F7_FEN,
      prevAnalysis,
      moveSan: 'a6',
      moveUci: 'a7a6',
      currentFen: afterBlunderFen,
      currentAnalysis: currAnalysis,
    });

    expect(review.verdict).toBe('blunder');
    expect(review.summary).toMatch(/Qxf7#/);
    expect(review.summary).toMatch(/Stockfish preferred Nf6/);
  });

  it('builds a real-time coaching brief with prioritized thoughts and optimal moves', () => {
    const analysis = {
      fen: HANGING_E5_FEN,
      learnerSide: 'black',
      depthSnapshots: [
        {
          depth: 11,
          lines: [
            {
              rank: 1,
              score: 310,
              uciMoves: ['c6e5', 'd2d4'],
              sanMoves: ['Nxe5', 'd4'],
            },
          ],
        },
      ],
    };

    const brief = buildCoachingBrief({ fen: HANGING_E5_FEN, analysis });
    expect(brief.whatToThinkAbout.length).toBeGreaterThan(0);
    expect(brief.topMove.san).toBe('Nxe5');
    expect(brief.topMove.why).toMatch(/captures the undefended knight on e5/i);
  });
});
