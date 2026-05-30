import { useReducer, useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { Chess } from 'chess.js';
import { applyMove, legalTargets, opposite, START_FEN } from '../lesson/moves.js';
import { useStockfish } from './useStockfish.js';

// React wrapper for free play / scenario play against Stockfish. Mirrors useChessLesson: the live
// chess.js game lives in a ref (gameRef), the reducer holds only derived, renderable state.
//
// The opponent reply is an ASYNC engine request (hundreds of ms to seconds), not a fixed timer, so
// the stale-reply guard matters more here than in lessons: while the engine thinks, the user can hit
// New game / Take back / Resign / change strength / unmount. We bump a monotonic runIdRef on every
// such action; the reply captured before the request is dropped if the runId moved under it —
// otherwise a late bestmove would apply an illegal-or-wrong move and corrupt the board.

const SIDE_CHAR = { white: 'w', black: 'b' };

// Weaker settings think for less time too, so low levels feel snappy as well as beatable.
function movetimeFor(skillLevel) {
  return 300 + Math.max(0, Math.min(20, skillLevel)) * 35;
}

// Translate a finished game into a result banner, or null while it's still going.
function gameResult(game) {
  if (!game.isGameOver()) return null;
  if (game.isCheckmate()) {
    // The side NOT to move delivered mate.
    const winner = opposite(game.turn() === 'w' ? 'white' : 'black');
    return { winner, reason: 'Checkmate' };
  }
  if (game.isStalemate()) return { winner: 'draw', reason: 'Stalemate' };
  if (game.isInsufficientMaterial()) return { winner: 'draw', reason: 'Insufficient material' };
  if (game.isThreefoldRepetition()) return { winner: 'draw', reason: 'Threefold repetition' };
  return { winner: 'draw', reason: 'Draw' };
}

const initialState = {
  fen: START_FEN,
  status: 'player-turn', // 'player-turn' | 'engine-thinking' | 'over'
  result: null,
  history: [],
  lastMove: null,
  selectedSquare: null,
  legalTargets: [],
};

function reducer(state, action) {
  switch (action.type) {
    case 'sync':
      return {
        ...state,
        fen: action.fen,
        history: action.history,
        lastMove: action.lastMove ?? null,
        status: action.status,
        result: action.result ?? null,
        selectedSquare: null,
        legalTargets: [],
      };
    case 'thinking':
      return { ...state, status: 'engine-thinking', selectedSquare: null, legalTargets: [] };
    case 'select':
      return { ...state, selectedSquare: action.square, legalTargets: action.targets };
    case 'deselect':
      return { ...state, selectedSquare: null, legalTargets: [] };
    default:
      return state;
  }
}

export function useEngineGame({ fen, playerSide = 'white', skillLevel = 10 }) {
  const { ready, error, requestMove, setStrength, interrupt } = useStockfish(skillLevel);
  const gameRef = useRef(null);
  const runIdRef = useRef(0);
  const [state, dispatch] = useReducer(reducer, initialState);
  const [orientation, setOrientation] = useState(playerSide);
  const [resetNonce, setResetNonce] = useState(0);

  const playerChar = SIDE_CHAR[playerSide] ?? 'w';
  const movetime = useMemo(() => movetimeFor(skillLevel), [skillLevel]);
  const startFen = fen || START_FEN;

  // Ask the engine for a move from the current position and apply it, unless the run was superseded.
  const scheduleEngineMove = useCallback(async () => {
    const myRun = runIdRef.current;
    dispatch({ type: 'thinking' });
    let uci;
    try {
      uci = await requestMove(gameRef.current.fen(), { movetime });
    } catch {
      if (myRun !== runIdRef.current) return; // stale failure
      dispatch({
        type: 'sync',
        fen: gameRef.current.fen(),
        history: gameRef.current.history(),
        status: 'over',
        result: { winner: null, reason: 'The engine is unavailable.' },
      });
      return;
    }
    if (myRun !== runIdRef.current) return; // a reset/takeback/resign happened while thinking
    const game = gameRef.current;
    let lastMove = null;
    if (uci) {
      try {
        const m = applyMove(game, uci);
        lastMove = { from: m.from, to: m.to };
      } catch {
        // engine returned something unplayable here; fall through and let the player continue
      }
    }
    const result = gameResult(game);
    dispatch({
      type: 'sync',
      fen: game.fen(),
      history: game.history(),
      lastMove,
      status: result ? 'over' : 'player-turn',
      result,
    });
  }, [requestMove, movetime]);

  // (Re)start the game whenever the position, side, or a New-game click changes. Bumping runId here
  // discards any engine reply still in flight from the previous game.
  useEffect(() => {
    runIdRef.current += 1;
    interrupt(); // drop a thinking engine from the previous game so the new one starts clean
    const game = new Chess(startFen);
    gameRef.current = game;
    setOrientation(playerSide);
    const engineToMove = game.turn() !== playerChar && !game.isGameOver();
    dispatch({
      type: 'sync',
      fen: game.fen(),
      history: game.history(),
      status: engineToMove ? 'engine-thinking' : 'player-turn',
      result: gameResult(game),
    });
    if (engineToMove) scheduleEngineMove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startFen, playerSide, resetNonce]);

  // Apply a legal player move (free play: any legal move is accepted), then hand off to the engine.
  const applyPlayerMove = useCallback(
    (move) => {
      if (state.status !== 'player-turn') return false;
      const game = gameRef.current;
      let m;
      try {
        m = applyMove(game, move);
      } catch {
        return false; // illegal — react-chessboard snaps the piece back
      }
      const result = gameResult(game);
      dispatch({
        type: 'sync',
        fen: game.fen(),
        history: game.history(),
        lastMove: { from: m.from, to: m.to },
        status: result ? 'over' : 'engine-thinking',
        result,
      });
      if (!result) scheduleEngineMove();
      return true;
    },
    [state.status, scheduleEngineMove],
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

  // Tap-to-move: first tap selects + highlights legal targets, second tap moves.
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
    runIdRef.current += 1; // drop any in-flight reply before the reset effect runs
    setResetNonce((n) => n + 1);
  }, []);

  const resign = useCallback(() => {
    runIdRef.current += 1;
    interrupt(); // stop the engine from searching a position the game has abandoned
    const game = gameRef.current;
    dispatch({
      type: 'sync',
      fen: game.fen(),
      history: game.history(),
      status: 'over',
      result: { winner: opposite(playerSide), reason: 'You resigned' },
    });
  }, [playerSide, interrupt]);

  // Undo back to the player's turn: discard any in-flight reply, then take back the engine's reply
  // (if it's already on the board) and the player's own move.
  const takeBack = useCallback(() => {
    runIdRef.current += 1;
    interrupt(); // a reply may be in flight; drop it before we rewind and possibly re-ask
    const game = gameRef.current;
    if (game.turn() === playerChar) game.undo(); // remove the engine's last move
    game.undo(); // remove the player's last move
    const engineToMove = game.turn() !== playerChar && !game.isGameOver();
    dispatch({
      type: 'sync',
      fen: game.fen(),
      history: game.history(),
      lastMove: null,
      status: engineToMove ? 'engine-thinking' : 'player-turn',
      result: null,
    });
    if (engineToMove) scheduleEngineMove();
  }, [playerChar, scheduleEngineMove, interrupt]);

  const flipBoard = useCallback(() => {
    setOrientation(opposite);
  }, []);

  // Re-apply strength to the engine when the dial changes; takes effect on the engine's next move.
  useEffect(() => {
    setStrength(skillLevel);
  }, [skillLevel, setStrength]);

  const arePiecesDraggable = state.status === 'player-turn';

  return {
    fen: state.fen,
    orientation,
    playerSide,
    status: state.status,
    result: state.result,
    history: state.history,
    lastMove: state.lastMove,
    selectedSquare: state.selectedSquare,
    legalTargets: state.legalTargets,
    arePiecesDraggable,
    engineReady: ready,
    engineError: error,
    onPieceDrop,
    onPromotionPieceSelect,
    onSquareClick,
    newGame,
    resign,
    takeBack,
    flipBoard,
  };
}
