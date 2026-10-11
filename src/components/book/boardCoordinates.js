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
