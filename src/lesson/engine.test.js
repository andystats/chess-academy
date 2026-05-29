import { describe, it, expect } from 'vitest';
import {
  normalizeStep,
  playerOrdinalCount,
  expectedSansAt,
  opponentReplyAt,
} from './engine.js';

const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const singleMove = {
  id: 's',
  type: 'single-move',
  fen: FEN,
  markdown: 'x',
  solution: { san: ['e4', 'd4'] },
};

const line = {
  id: 'l',
  type: 'line',
  fen: FEN,
  markdown: 'x',
  mainline: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'],
  acceptableAt: { 2: ['Bc4'] },
};

describe('normalizeStep', () => {
  it('turns single-move into a one-ply line with all solutions acceptable', () => {
    const d = normalizeStep(singleMove);
    expect(d.mode).toBe('line');
    expect(d.mainline).toEqual(['e4']);
    expect(d.acceptableAt).toEqual({ 0: ['e4', 'd4'] });
  });

  it('preserves a line and defaults orientation', () => {
    const d = normalizeStep(line);
    expect(d.mode).toBe('line');
    expect(d.mainline).toEqual(line.mainline);
    expect(d.orientation).toBe('white');
    expect(d.hasSetupMove).toBe(false);
  });

  it('maps prose to a read step', () => {
    expect(normalizeStep({ id: 'p', type: 'prose', fen: FEN, markdown: 'x' }).mode).toBe('read');
  });
});

describe('line geometry', () => {
  const d = normalizeStep(line);

  it('counts the player moves', () => {
    expect(playerOrdinalCount(d)).toBe(3); // e4, Nf3, Bb5
  });

  it('returns acceptable SANs per ordinal, merging acceptableAt', () => {
    expect(expectedSansAt(d, 0)).toEqual(['e4']);
    expect(expectedSansAt(d, 2)).toEqual(['Bb5', 'Bc4']);
  });

  it('derives opponent replies from the interleaved mainline', () => {
    expect(opponentReplyAt(d, 0)).toBe('e5');
    expect(opponentReplyAt(d, 1)).toBe('Nc6');
    expect(opponentReplyAt(d, 2)).toBe(null); // last player move, no reply
  });

  it('honors an explicit opponentReplies override on the line', () => {
    const withOverride = normalizeStep({ ...line, opponentReplies: { 0: 'c5' } });
    expect(withOverride.opponentReplies).toEqual({ 0: 'c5' });
    expect(opponentReplyAt(withOverride, 0)).toBe('c5'); // override beats mainline 'e5'
    expect(opponentReplyAt(withOverride, 1)).toBe('Nc6'); // falls back to mainline
  });
});
