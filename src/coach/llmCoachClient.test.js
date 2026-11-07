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

  it('formats a structured brief for external LLM providers', () => {
    const brief = buildCoachingBrief({ fen: B7_THREAT_FEN, analysis: mockAnalysis });
    const formatted = formatStructuredBriefForPrompt(brief, ['e4', 'e5', 'Be3', 'Be6', 'Qb3'], 'live');

    expect(formatted).toContain(`FEN: ${B7_THREAT_FEN}`);
    expect(formatted).toContain('#1: Rb8');
    expect(formatted).toContain('neutralizes the current threat on b7');
  });
});
