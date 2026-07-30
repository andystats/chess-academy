import { Chess } from 'chess.js';
import { getCoachKnowledgeCard } from './coach/knowledgeCards.js';
import { ENGINE_XRAY_POSITIONS, getEngineXrayPosition } from './engineXrayPositions.js';

describe('ENGINE_XRAY_POSITIONS', () => {
  it('contains six unique, playable teaching positions', () => {
    expect(ENGINE_XRAY_POSITIONS).toHaveLength(6);
    expect(new Set(ENGINE_XRAY_POSITIONS.map((position) => position.id))).toHaveLength(6);

    for (const position of ENGINE_XRAY_POSITIONS) {
      const game = new Chess(position.fen);
      expect(game.moves().length).toBeGreaterThan(0);
      expect(['white', 'black']).toContain(position.orientation);
      expect(position.prompt.length).toBeGreaterThan(50);
      expect(position.predictionPrompt.endsWith('?')).toBe(true);
      expect(position.recommendedDepth).toBeGreaterThanOrEqual(8);
      expect(position.recommendedDepth).toBeLessThanOrEqual(14);
      if (position.coachCardId) {
        expect(getCoachKnowledgeCard(position.coachCardId)).not.toBeNull();
      }
    }
  });

  it('falls back to the first curriculum position for an unknown id', () => {
    expect(getEngineXrayPosition('not-a-position')).toBe(ENGINE_XRAY_POSITIONS[0]);
  });
});
