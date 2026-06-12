import { useState, useCallback, useEffect } from 'react';
import { isPromotion } from '../lesson/moves.js';

/**
 * Shared board interaction logic for selection, tap-to-move, and promotion pickers.
 * Consumed by useChessLesson, useEngineGame, and useOnlineGame to avoid duplicating the
 * selection state machine and the tap-path underpromotion picker.
 *
 * @param {string} fen - Current board FEN, used to clear selection on change.
 * @param {boolean} canMove - Whether the player is currently allowed to interact with pieces.
 * @param {function} attemptMove - Callback to commit a move: ({from, to, promotion}) => boolean.
 * @param {function} listTargets - Callback to get legal destinations for a square: (square) => string[].
 */
export function useBoardInput({ fen, canMove, attemptMove, listTargets }) {
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalTargets, setLegalTargets] = useState([]);
  const [pendingPromotion, setPendingPromotion] = useState(null);

  const clearSelection = useCallback(() => {
    setSelectedSquare(null);
    setLegalTargets([]);
    setPendingPromotion(null);
  }, []);

  // Clear selection whenever the board changes (move committed, undo, reset).
  useEffect(() => {
    clearSelection();
  }, [fen, clearSelection]);

  const onPieceDrop = useCallback(
    (from, to) => {
      if (!canMove) return false;
      return attemptMove({ from, to, promotion: 'q' });
    },
    [canMove, attemptMove],
  );

  const onPromotionPieceSelect = useCallback(
    (piece, from, to) => {
      const source = from && to ? { from, to } : pendingPromotion;
      clearSelection();
      if (!source || !piece || !canMove) return false;
      return attemptMove({ ...source, promotion: piece[1].toLowerCase() });
    },
    [pendingPromotion, canMove, attemptMove, clearSelection],
  );

  const onSquareClick = useCallback(
    (square) => {
      if (!canMove) return;

      if (selectedSquare) {
        if (square === selectedSquare) {
          clearSelection();
          return;
        }

        // A pawn reaching its last rank opens the promotion picker — never silently queen a tap.
        if (legalTargets.includes(square) && isPromotion(fen, selectedSquare, square)) {
          setPendingPromotion({ from: selectedSquare, to: square });
          setSelectedSquare(null);
          setLegalTargets([]);
          return;
        }

        const moved = attemptMove({ from: selectedSquare, to: square, promotion: 'q' });
        if (moved) {
          // Success: selection cleared by the fen useEffect.
          return;
        }

        // Illegal move or wrong-but-legal move in a lesson: re-select if they tapped another
        // of their own pieces; otherwise just clear.
        const targets = listTargets(square);
        if (targets.length) {
          setSelectedSquare(square);
          setLegalTargets(targets);
        } else {
          clearSelection();
        }
        return;
      }

      const targets = listTargets(square);
      if (targets.length) {
        setSelectedSquare(square);
        setLegalTargets(targets);
      }
    },
    [fen, canMove, selectedSquare, legalTargets, attemptMove, listTargets, clearSelection],
  );

  return {
    selectedSquare,
    legalTargets,
    promotionTarget: pendingPromotion?.to ?? null,
    onPieceDrop,
    onPromotionPieceSelect,
    onSquareClick,
    clearSelection,
  };
}
