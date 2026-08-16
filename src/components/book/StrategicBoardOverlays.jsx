import { useMemo } from 'react';

// Converts an algebraic square (e.g. 'e4') into percentage coordinates (0-100%) on the board
// taking board orientation into account.
export function squareToCoords(square, orientation = 'white') {
  if (!square || square.length < 2) return { x: 50, y: 50 };
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = parseInt(square[1], 10) - 1;

  if (file < 0 || file > 7 || rank < 0 || rank > 7) return { x: 50, y: 50 };

  const x = orientation === 'white' ? (file + 0.5) * 12.5 : (7 - file + 0.5) * 12.5;
  const y = orientation === 'white' ? (7 - rank + 0.5) * 12.5 : (rank + 0.5) * 12.5;

  return { x, y };
}

export default function StrategicBoardOverlays({
  overlays = {},
  orientation = 'white',
  activeOverlays = { pawnChains: true, blockades: true, overprotection: true, outposts: true },
}) {
  const {
    pawnChains = [], // Array of chains: [ { chain: ['f2', 'e3', 'd4'], base: 'f2', color: 'amber' } ]
    blockades = [],   // Array of blockades: [ { square: 'd5', pawnSquare: 'd4', color: 'blue' } ]
    overprotection = [], // Array of overprotection sets: [ { target: 'e5', defenders: ['c3', 'f3', 'd3', 'e1'] } ]
    outposts = [],    // Array of outposts: [ { square: 'd5', piece: 'N', color: 'emerald' } ]
    mysteriousRooks = [], // Array of mysterious rooks: [ { square: 'e1', targetFile: 'e' } ]
  } = overlays;

  // Compute SVG paths for pawn chains
  const renderedPawnChains = useMemo(() => {
    if (!activeOverlays.pawnChains || !pawnChains.length) return null;

    return pawnChains.map((item, idx) => {
      const { chain, base } = item;
      if (!chain || chain.length < 2) return null;

      const points = chain.map((sq) => squareToCoords(sq, orientation));
      const pathData = points.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x}% ${pt.y}%`, '');
      const baseCoord = base ? squareToCoords(base, orientation) : null;

      return (
        <g key={`pawn-chain-${idx}`} className="animate-fade-in">
          {/* Glowing under-line */}
          <path
            d={pathData}
            fill="none"
            stroke="rgba(245, 158, 11, 0.45)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Main chain spine */}
          <path
            d={pathData}
            fill="none"
            stroke="rgb(217, 119, 6)"
            strokeWidth="3.5"
            strokeDasharray="6 3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Chain node markers */}
          {points.map((pt, pIdx) => (
            <circle
              key={`node-${pIdx}`}
              cx={`${pt.x}%`}
              cy={`${pt.y}%`}
              r="4.5"
              fill="#fbbf24"
              stroke="#78350f"
              strokeWidth="2"
            />
          ))}
          {/* Base Target Reticle */}
          {baseCoord && (
            <g transform={`translate(0, 0)`}>
              <circle
                cx={`${baseCoord.x}%`}
                cy={`${baseCoord.y}%`}
                r="18"
                fill="none"
                stroke="rgba(239, 68, 68, 0.85)"
                strokeWidth="2.5"
                strokeDasharray="4 2"
                className="animate-spin"
                style={{ transformOrigin: `${baseCoord.x}% ${baseCoord.y}%`, animationDuration: '8s' }}
              />
              <circle
                cx={`${baseCoord.x}%`}
                cy={`${baseCoord.y}%`}
                r="5"
                fill="rgba(239, 68, 68, 0.3)"
              />
            </g>
          )}
        </g>
      );
    });
  }, [pawnChains, orientation, activeOverlays.pawnChains]);

  // Compute Overprotection Tension Rays
  const renderedOverprotection = useMemo(() => {
    if (!activeOverlays.overprotection || !overprotection.length) return null;

    return overprotection.map((item, idx) => {
      const { target, defenders = [] } = item;
      const targetCoord = squareToCoords(target, orientation);

      return (
        <g key={`overprotection-${idx}`} className="animate-fade-in">
          {/* Center anchor pulse */}
          <circle
            cx={`${targetCoord.x}%`}
            cy={`${targetCoord.y}%`}
            r="16"
            fill="rgba(59, 130, 246, 0.18)"
            stroke="rgba(37, 99, 235, 0.85)"
            strokeWidth="2.5"
          />
          <circle
            cx={`${targetCoord.x}%`}
            cy={`${targetCoord.y}%`}
            r="6"
            fill="rgb(37, 99, 235)"
          />

          {/* Defense Rays */}
          {defenders.map((defSq, dIdx) => {
            const defCoord = squareToCoords(defSq, orientation);
            return (
              <g key={`ray-${dIdx}`}>
                <line
                  x1={`${defCoord.x}%`}
                  y1={`${defCoord.y}%`}
                  x2={`${targetCoord.x}%`}
                  y2={`${targetCoord.y}%`}
                  stroke="rgba(37, 99, 235, 0.45)"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
                <line
                  x1={`${defCoord.x}%`}
                  y1={`${defCoord.y}%`}
                  x2={`${targetCoord.x}%`}
                  y2={`${targetCoord.y}%`}
                  stroke="rgba(96, 165, 250, 0.95)"
                  strokeWidth="2.5"
                  strokeDasharray="4 3"
                  strokeLinecap="round"
                />
                <circle
                  cx={`${defCoord.x}%`}
                  cy={`${defCoord.y}%`}
                  r="4"
                  fill="#3b82f6"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
              </g>
            );
          })}
        </g>
      );
    });
  }, [overprotection, orientation, activeOverlays.overprotection]);

  // Compute Blockade Shields
  const renderedBlockades = useMemo(() => {
    if (!activeOverlays.blockades || !blockades.length) return null;

    return blockades.map((item, idx) => {
      const { square } = item;
      const coord = squareToCoords(square, orientation);

      return (
        <g key={`blockade-${idx}`} className="animate-scale-up">
          {/* Blockade Shield Barrier */}
          <rect
            x={`calc(${coord.x}% - 16px)`}
            y={`calc(${coord.y}% - 16px)`}
            width="32"
            height="32"
            rx="6"
            fill="rgba(16, 185, 129, 0.15)"
            stroke="rgb(16, 185, 129)"
            strokeWidth="2.5"
          />
          <circle
            cx={`${coord.x}%`}
            cy={`${coord.y}%`}
            r="4"
            fill="rgb(16, 185, 129)"
          />
          {/* Barrier cross lines */}
          <line
            x1={`calc(${coord.x}% - 12px)`}
            y1={`calc(${coord.y}% + 12px)`}
            x2={`calc(${coord.x}% + 12px)`}
            y2={`calc(${coord.y}% + 12px)`}
            stroke="rgb(16, 185, 129)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </g>
      );
    });
  }, [blockades, orientation, activeOverlays.blockades]);

  // Compute Outpost Radars
  const renderedOutposts = useMemo(() => {
    if (!activeOverlays.outposts || !outposts.length) return null;

    return outposts.map((item, idx) => {
      const { square } = item;
      const coord = squareToCoords(square, orientation);

      return (
        <g key={`outpost-${idx}`} className="animate-fade-in">
          <circle
            cx={`${coord.x}%`}
            cy={`${coord.y}%`}
            r="20"
            fill="rgba(139, 92, 246, 0.12)"
            stroke="rgba(139, 92, 246, 0.75)"
            strokeWidth="2"
            strokeDasharray="5 3"
          />
          <circle
            cx={`${coord.x}%`}
            cy={`${coord.y}%`}
            r="12"
            fill="rgba(139, 92, 246, 0.2)"
            stroke="rgb(139, 92, 246)"
            strokeWidth="1.5"
          />
        </g>
      );
    });
  }, [outposts, orientation, activeOverlays.outposts]);

  // Mysterious Rooks Radar
  const renderedMysteriousRooks = useMemo(() => {
    if (!mysteriousRooks.length) return null;

    return mysteriousRooks.map((item, idx) => {
      const { square } = item;
      const coord = squareToCoords(square, orientation);
      const topY = orientation === 'white' ? '0%' : '100%';

      return (
        <g key={`mysterious-${idx}`} className="animate-fade-in">
          <line
            x1={`${coord.x}%`}
            y1={`${coord.y}%`}
            x2={`${coord.x}%`}
            y2={topY}
            stroke="rgba(99, 102, 241, 0.35)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <line
            x1={`${coord.x}%`}
            y1={`${coord.y}%`}
            x2={`${coord.x}%`}
            y2={topY}
            stroke="rgba(99, 102, 241, 0.85)"
            strokeWidth="2"
            strokeDasharray="4 4"
            strokeLinecap="round"
          />
        </g>
      );
    });
  }, [mysteriousRooks, orientation]);

  const hasAny =
    (activeOverlays.pawnChains && pawnChains.length > 0) ||
    (activeOverlays.overprotection && overprotection.length > 0) ||
    (activeOverlays.blockades && blockades.length > 0) ||
    (activeOverlays.outposts && outposts.length > 0) ||
    mysteriousRooks.length > 0;

  if (!hasAny) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[5] h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {renderedMysteriousRooks}
      {renderedPawnChains}
      {renderedOverprotection}
      {renderedOutposts}
      {renderedBlockades}
    </svg>
  );
}
