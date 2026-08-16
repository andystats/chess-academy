import { render } from '@testing-library/react';
import StrategicBoardOverlays, { squareToCoords } from './StrategicBoardOverlays.jsx';

describe('StrategicBoardOverlays', () => {
  it('correctly maps algebraic squares to percentage coordinates', () => {
    // e4 from white perspective: file e is 4 (x = 4.5 * 12.5 = 56.25), rank 4 is 3 (y = 4.5 * 12.5 = 56.25)
    const whiteCoords = squareToCoords('e4', 'white');
    expect(whiteCoords.x).toBeCloseTo(56.25);
    expect(whiteCoords.y).toBeCloseTo(56.25);

    // e4 from black perspective
    const blackCoords = squareToCoords('e4', 'black');
    expect(blackCoords.x).toBeCloseTo(43.75);
    expect(blackCoords.y).toBeCloseTo(43.75);
  });

  it('renders pawn chains, blockades, and overprotection SVGs without errors', () => {
    const overlays = {
      pawnChains: [{ chain: ['c2', 'd4', 'e5'], base: 'c2' }],
      blockades: [{ square: 'd4', pawnSquare: 'd5' }],
      overprotection: [{ target: 'e5', defenders: ['f3', 'b2'] }],
      outposts: [{ square: 'd5', piece: 'N' }],
      mysteriousRooks: [{ square: 'd1', targetFile: 'd' }],
    };

    const { container } = render(
      <StrategicBoardOverlays overlays={overlays} orientation="white" />
    );

    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.querySelectorAll('circle').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('path').length).toBeGreaterThan(0);
  });
});
