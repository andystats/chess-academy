import { describe, expect, it } from 'vitest';
import {
  buildCoachingBrief,
  formatStructuredBriefForPrompt,
  synthesizeDeterministicCoachReply,
} from './index.js';

const B7_THREAT_FEN = 'r2qk2r/pppp1ppp/2n1bn2/2b1p3/4P3/1Q6/PPPPBPPP/RNB1K1NR b KQkq - 3 5';

const mockAnalysis = {
  fen: B7_THREAT_FEN,
  learnerSide: 'black',
  depthSnapshots: [
    {
      depth: 11,
      lines: [
        {
          rank: 1,
          score: 15,
          uciMoves: ['a8b8', 'b3c2', 'c5b6'],
          sanMoves: ['Rb8', 'Qc2', 'Bb6'],
        },
      ],
    },
  ],
};

describe('llmCoachClient', () => {
  it('synthesizes a deterministic answer about threats and optimal moves', () => {
    const brief = buildCoachingBrief({ fen: B7_THREAT_FEN, analysis: mockAnalysis });
    const reply = synthesizeDeterministicCoachReply(
      'What is the opponent threatening right now?',
      brief,
      'live',
    );

    expect(reply.provider).toBe('builtin');
    expect(reply.text).toMatch(/b7/);
    expect(reply.text).toMatch(/Rb8/);
  });

  it('respects Guided Play mode by not spoiling the optimal move on general threat questions', () => {
    const brief = buildCoachingBrief({ fen: B7_THREAT_FEN, analysis: mockAnalysis });
    const reply = synthesizeDeterministicCoachReply(
      'What is the opponent threatening right now?',
      brief,
      'guided',
    );

    expect(reply.text).toMatch(/b7/);
    expect(reply.text).not.toMatch(/Stockfish’s top choice is \*\*Rb8\*\*/);
  });

  it('formats a structured brief for external LLM providers including piece coordinates, takeback context, and hypotheticals', () => {
    const lastTakenBackReview = {
      moveSan: 'a6',
      badge: 'Blunder',
      verdict: 'blunder',
      cpLoss: 240,
      bestMoveSan: 'Rb8',
      engineReplySan: 'Qxb7',
      summary: 'Your move a6 left b7 undefended, allowing Qxb7.',
    };
    const brief = buildCoachingBrief({
      fen: B7_THREAT_FEN,
      analysis: mockAnalysis,
      lastTakenBackReview,
    });
    const formatted = formatStructuredBriefForPrompt(
      brief,
      ['e4', 'e5', 'Be3', 'Be6', 'Qb3'],
      'live',
      {
        question: 'Why was my taken back move bad, and what if I play b6 instead?',
        conversationHistory: [
          { question: 'What is threatened?', answerText: 'White threatens Qxb7.' },
        ],
      },
    );

    expect(formatted).toContain(`FEN: ${B7_THREAT_FEN}`);
    expect(formatted).toContain('Exact piece squares — White:');
    expect(formatted).toContain('Qb3');
    expect(formatted).toContain('Recently taken-back (undone) move from this position: Black previously played a6 (Blunder)');
    expect(formatted).toContain('Verified Simulation of Hypothetical Move(s) Mentioned in Question:');
    expect(formatted).toContain('b6 (Black, b7->b6):');
    expect(formatted).toContain('Recent Coach Q&A History:');
    expect(formatted).toContain('#1: Rb8');
    expect(formatted).toContain('neutralizes the current threat on b7');

    // Also verify deterministic fallback handles takeback questions directly
    const takebackReply = synthesizeDeterministicCoachReply(
      'Why did I have to take back my last move?',
      brief,
      'live',
    );
    expect(takebackReply.text).toMatch(/took back \*\*a6\*\*/i);
    expect(takebackReply.text).toMatch(/Qxb7/);
  });
});
