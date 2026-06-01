import { useCallback, useReducer, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { applyMove, legalTargets, opposite, START_FEN } from '../lesson/moves.js';
import { capturedPieces, gameResult } from './gameState.js';

const initialState = {
  fen: START_FEN,
  status: 'player-turn',
  result: null,
  history: [],
  lastMove: null,
  captured: { white: [], black: [] },
  selectedSquare: null,
  legalTargets: [],
};

function sideToMove(game) {
  return game.turn() === 'w' ? 'white' : 'black';
}

function reducer(state, action) {
  switch (action.type) {
    case 'sync':
      return {
        ...state,
        fen: action.fen,
        history: action.history,
        captured: action.captured,
        lastMove: action.lastMove ?? null,
        status: action.status,
        result: action.result ?? null,
        selectedSquare: null,
        legalTargets: [],
      };
    case 'select':
      return { ...state, selectedSquare: action.square, legalTargets: action.targets };
    case 'deselect':
      return { ...state, selectedSquare: null, legalTargets: [] };
    default:
      return state;
  }
}

export function useLocalGame({ fen = START_FEN } = {}) {
  const gameRef = useRef(new Chess(fen));
  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    fen: gameRef.current.fen(),
    history: gameRef.current.history(),
    captured: capturedPieces(gameRef.current),
  });
  const [orientation, setOrientation] = useState('white');

  const syncGame = useCallback((lastMove = null) => {
    const game = gameRef.current;
    const result = gameResult(game);
    dispatch({
      type: 'sync',
      fen: game.fen(),
      history: game.history(),
      captured: capturedPieces(game),
      lastMove,
      status: result ? 'over' : 'player-turn',
      result,
    });
  }, []);

  const applyPlayerMove = useCallback(
    (move) => {
      if (state.status !== 'player-turn') return false;
      const game = gameRef.current;
      let applied;
      try {
        applied = applyMove(game, move);
      } catch {
        return false;
      }
      syncGame({ from: applied.from, to: applied.to });
      return true;
    },
    [state.status, syncGame],
  );

  const onPieceDrop = useCallback(
    (from, to) => applyPlayerMove({ from, to, promotion: 'q' }),
    [applyPlayerMove],
  );

  const onPromotionPieceSelect = useCallback(
    (piece, from, to) => {
      if (!from || !to) return false;
      return applyPlayerMove({ from, to, promotion: piece ? piece[1].toLowerCase() : 'q' });
    },
    [applyPlayerMove],
  );

  const onSquareClick = useCallback(
    (square) => {
      if (state.status !== 'player-turn') return;
      const game = gameRef.current;
      if (state.selectedSquare) {
        if (square === state.selectedSquare) {
          dispatch({ type: 'deselect' });
          return;
        }
        const moved = applyPlayerMove({ from: state.selectedSquare, to: square, promotion: 'q' });
        if (!moved) {
          const targets = legalTargets(game, square);
          if (targets.length) dispatch({ type: 'select', square, targets });
          else dispatch({ type: 'deselect' });
        }
        return;
      }
      const targets = legalTargets(game, square);
      if (targets.length) dispatch({ type: 'select', square, targets });
    },
    [state.status, state.selectedSquare, applyPlayerMove],
  );

  const newGame = useCallback(() => {
    gameRef.current = new Chess(fen);
    setOrientation('white');
    syncGame();
  }, [fen, syncGame]);

  const takeBack = useCallback(() => {
    if (state.history.length === 0) return;
    gameRef.current.undo();
    syncGame();
  }, [state.history.length, syncGame]);

  const flipBoard = useCallback(() => {
    setOrientation(opposite);
  }, []);

  const currentTurn = sideToMove(gameRef.current);

  return {
    fen: state.fen,
    orientation,
    playerSide: currentTurn,
    currentTurn,
    status: state.status,
    result: state.result,
    history: state.history,
    lastMove: state.lastMove,
    captured: state.captured,
    selectedSquare: state.selectedSquare,
    legalTargets: state.legalTargets,
    arePiecesDraggable: state.status === 'player-turn',
    onPieceDrop,
    onPromotionPieceSelect,
    onSquareClick,
    newGame,
    takeBack,
    flipBoard,
  };
}
