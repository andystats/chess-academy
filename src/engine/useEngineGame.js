import { useReducer, useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { Chess } from 'chess.js';
import { applyMove, opposite, acceptableLans, compileToLan, moveToLan, SIDE_CHAR, START_FEN } from '../lesson/moves.js';
import { capturedPieces, gameResult } from './gameState.js';
import { useStockfish } from './useStockfish.js';
import { levelConfig } from './levels.js';

import { useBoardInput } from '../components/useBoardInput.js';

const DEFAULT_WRONG = 'Not quite — look for the move the lesson points to and try again.';

// React wrapper for free play / scenario play / two-sided coaching board. Mirrors useChessLesson:
// the live chess.js game lives in a ref (gameRef), the reducer holds only derived, renderable state.
//
// `playerSide` may be 'white', 'black', or 'both' (sandbox/analysis mode where the user plays both sides).

const initialState = {
  fen: START_FEN,
  status: 'player-turn', // 'player-turn' | 'engine-thinking' | 'over'
  result: null,
  history: [],
  lastMove: null,
  lastMoveDetail: null,
  takenBackDetail: null,
  captured: { white: [], black: [] },
  evaluation: null,
  phase: 'free', // 'guided' | 'free'
  solved: false,
  feedback: null, // { kind: 'correct' | 'wrong', text }
};

function reducer(state, action) {
  switch (action.type) {
    case 'reset':
      return {
        ...state,
        fen: action.fen,
        history: action.history,
        lastMove: null,
        lastMoveDetail: null,
        takenBackDetail: null,
        captured: action.captured,
        evaluation: null,
        status: action.status,
        result: action.result ?? null,
        phase: action.phase,
        solved: false,
        feedback: null,
      };
    case 'sync':
      return {
        ...state,
        fen: action.fen,
        history: action.history,
        lastMove: action.lastMove ?? null,
        lastMoveDetail:
          'lastMoveDetail' in action ? action.lastMoveDetail : state.lastMoveDetail,
        takenBackDetail:
          'takenBackDetail' in action ? action.takenBackDetail : state.takenBackDetail,
        captured: action.captured,
        evaluation: action.evaluation ?? state.evaluation,
        status: action.status,
        result: action.result ?? null,
      };
    case 'guided-correct':
      return {
        ...state,
        fen: action.fen,
        history: action.history,
        lastMove: action.lastMove ?? null,
        lastMoveDetail: action.lastMoveDetail ?? state.lastMoveDetail,
        captured: action.captured,
        evaluation: action.evaluation ?? state.evaluation,
        status: action.status,
        result: action.result ?? null,
        phase: 'free',
        solved: true,
        feedback: { kind: 'correct', text: action.text },
      };
    case 'guided-wrong':
      return { ...state, feedback: { kind: 'wrong', text: action.text } };
    case 'thinking':
      return { ...state, status: 'engine-thinking' };
    default:
      return state;
  }
}

function readEngineReply(reply) {
  if (typeof reply === 'string' || reply == null) return { uci: reply, evaluation: null };
  return { uci: reply.move ?? null, evaluation: reply.evaluation ?? null };
}

export function useEngineGame({ fen, playerSide = 'white', skillLevel = 10, guided = null }) {
  const { ready, error, requestMove, setStrength, interrupt } = useStockfish(skillLevel);
  const gameRef = useRef(null);
  const runIdRef = useRef(0);
  const [state, dispatch] = useReducer(reducer, initialState);
  const [orientation, setOrientation] = useState(playerSide === 'black' ? 'black' : 'white');
  const [resetNonce, setResetNonce] = useState(0);

  const isBothSides = playerSide === 'both';
  const playerChar = SIDE_CHAR[playerSide] ?? 'w';
  const config = useMemo(() => levelConfig(skillLevel), [skillLevel]);
  const startFen = fen || START_FEN;

  const scheduleEngineMove = useCallback(async () => {
    const myRun = runIdRef.current;
    dispatch({ type: 'thinking' });
    let reply;
    try {
      reply = await requestMove(gameRef.current.fen(), config.search);
    } catch {
      if (myRun !== runIdRef.current) return;
      dispatch({
        type: 'sync',
        fen: gameRef.current.fen(),
        history: gameRef.current.history(),
        captured: capturedPieces(gameRef.current),
        status: 'over',
        result: { winner: null, reason: 'The engine is unavailable.' },
      });
      return;
    }
    if (myRun !== runIdRef.current) return;
    const { uci, evaluation } = readEngineReply(reply);
    const game = gameRef.current;
    const prevFen = game.fen();
    let lastMove = null;
    let lastMoveDetail = null;
    if (uci) {
      try {
        const m = applyMove(game, uci);
        lastMove = { from: m.from, to: m.to };
        lastMoveDetail = {
          san: m.san,
          uci: moveToLan(m),
          from: m.from,
          to: m.to,
          color: m.color === 'b' ? 'black' : 'white',
          prevFen,
          byEngine: true,
        };
      } catch {
        // engine returned something unplayable here; fall through and let the player continue
      }
    }
    const result = gameResult(game);
    dispatch({
      type: 'sync',
      fen: game.fen(),
      history: game.history(),
      captured: capturedPieces(game),
      lastMove,
      lastMoveDetail,
      status: result ? 'over' : 'player-turn',
      result,
      evaluation,
    });
  }, [requestMove, config]);

  useEffect(() => {
    runIdRef.current += 1;
    interrupt();
    const game = new Chess(startFen);
    gameRef.current = game;
    setOrientation(playerSide === 'black' ? 'black' : 'white');
    const engineToMove = !isBothSides && game.turn() !== playerChar && !game.isGameOver();
    dispatch({
      type: 'reset',
      fen: game.fen(),
      history: game.history(),
      captured: capturedPieces(game),
      status: engineToMove ? 'engine-thinking' : 'player-turn',
      result: gameResult(game),
      phase: guided ? 'guided' : 'free',
    });
    if (engineToMove) scheduleEngineMove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startFen, playerSide, resetNonce]);

  const attemptGuidedMove = useCallback(
    (move) => {
      const game = gameRef.current;
      const fenBefore = game.fen();
      let playerLan;
      try {
        playerLan = moveToLan(applyMove(new Chess(fenBefore), move));
      } catch {
        return false;
      }
      if (acceptableLans(fenBefore, guided.solution).has(playerLan)) {
        const m = applyMove(game, move);
        const result = gameResult(game);
        const shouldScheduleEngine = !isBothSides && !result;
        dispatch({
          type: 'guided-correct',
          fen: game.fen(),
          history: game.history(),
          captured: capturedPieces(game),
          lastMove: { from: m.from, to: m.to },
          lastMoveDetail: {
            san: m.san,
            uci: moveToLan(m),
            from: m.from,
            to: m.to,
            color: m.color === 'b' ? 'black' : 'white',
            prevFen: fenBefore,
            byEngine: false,
          },
          status: result ? 'over' : shouldScheduleEngine ? 'engine-thinking' : 'player-turn',
          result,
          text: guided.explain || 'Correct!',
          evaluation: null,
        });
        if (shouldScheduleEngine) scheduleEngineMove();
        return true;
      }
      const misplay = (guided.misplays ?? []).find((mp) => {
        try {
          return compileToLan(fenBefore, mp.san) === playerLan;
        } catch {
          return false;
        }
      });
      dispatch({ type: 'guided-wrong', text: misplay ? misplay.explain : guided.wrong || DEFAULT_WRONG });
      return false;
    },
    [guided, isBothSides, scheduleEngineMove],
  );

  const applyPlayerMove = useCallback(
    (move) => {
      if (state.status !== 'player-turn') return false;
      if (state.phase === 'guided' && guided) return attemptGuidedMove(move);
      const game = gameRef.current;
      const fenBefore = game.fen();
      let m;
      try {
        m = applyMove(game, move);
      } catch {
        return false;
      }
      const result = gameResult(game);
      const shouldScheduleEngine = !isBothSides && !result;
      dispatch({
        type: 'sync',
        fen: game.fen(),
        history: game.history(),
        captured: capturedPieces(game),
        lastMove: { from: m.from, to: m.to },
        lastMoveDetail: {
          san: m.san,
          uci: moveToLan(m),
          from: m.from,
          to: m.to,
          color: m.color === 'b' ? 'black' : 'white',
          prevFen: fenBefore,
          byEngine: false,
        },
        takenBackDetail: null,
        status: result ? 'over' : shouldScheduleEngine ? 'engine-thinking' : 'player-turn',
        result,
        evaluation: null,
      });
      if (shouldScheduleEngine) scheduleEngineMove();
      return true;
    },
    [state.status, state.phase, guided, isBothSides, attemptGuidedMove, scheduleEngineMove],
  );

  const arePiecesDraggable = state.status === 'player-turn';

  const {
    selectedSquare,
    legalTargets,
    promotionTarget,
    onPieceDrop,
    onPromotionPieceSelect,
    onSquareClick,
  } = useBoardInput({
    fen: state.fen,
    canMove: arePiecesDraggable,
    attemptMove: applyPlayerMove,
    listTargets: (square) => legalTargets(gameRef.current, square),
  });

  const newGame = useCallback(() => {
    runIdRef.current += 1;
    setResetNonce((n) => n + 1);
  }, []);

  const resign = useCallback(() => {
    runIdRef.current += 1;
    interrupt();
    const game = gameRef.current;
    const resigningSide = isBothSides ? (game.turn() === 'b' ? 'black' : 'white') : playerSide;
    dispatch({
      type: 'sync',
      fen: game.fen(),
      history: game.history(),
      captured: capturedPieces(game),
      status: 'over',
      result: { winner: opposite(resigningSide), reason: 'You resigned' },
      evaluation: null,
    });
  }, [playerSide, isBothSides, interrupt]);

  const takeBack = useCallback(() => {
    runIdRef.current += 1;
    interrupt();
    const game = gameRef.current;
    let undoneEngineReply = null;
    let undonePlayerMove = null;
    let fenAfterPlayerMove = null;

    if (isBothSides) {
      undonePlayerMove = game.undo();
    } else {
      if (game.turn() === playerChar) {
        undoneEngineReply = game.undo();
      }
      fenAfterPlayerMove = game.fen();
      undonePlayerMove = game.undo();
    }

    const takenBackDetail = undonePlayerMove
      ? {
          san: undonePlayerMove.san,
          uci: moveToLan(undonePlayerMove),
          color: undonePlayerMove.color === 'b' ? 'black' : 'white',
          prevFen: game.fen(),
          afterFen: fenAfterPlayerMove,
          engineReplySan: undoneEngineReply?.san ?? null,
          engineReplyUci: undoneEngineReply ? moveToLan(undoneEngineReply) : null,
        }
      : null;

    const engineToMove = !isBothSides && game.turn() !== playerChar && !game.isGameOver();
    dispatch({
      type: 'sync',
      fen: game.fen(),
      history: game.history(),
      captured: capturedPieces(game),
      lastMove: null,
      lastMoveDetail: null,
      takenBackDetail,
      status: engineToMove ? 'engine-thinking' : 'player-turn',
      result: null,
      evaluation: null,
    });
    if (engineToMove) scheduleEngineMove();
  }, [isBothSides, playerChar, scheduleEngineMove, interrupt]);

  const flipBoard = useCallback(() => {
    setOrientation(opposite);
  }, []);

  useEffect(() => {
    setStrength(skillLevel);
  }, [skillLevel, setStrength]);

  return {
    fen: state.fen,
    orientation,
    playerSide,
    status: state.status,
    result: state.result,
    phase: state.phase,
    solved: state.solved,
    feedback: state.feedback,
    history: state.history,
    lastMove: state.lastMove,
    lastMoveDetail: state.lastMoveDetail,
    takenBackDetail: state.takenBackDetail,
    captured: state.captured,
    evaluation: state.evaluation,
    selectedSquare,
    legalTargets,
    promotionTarget,
    arePiecesDraggable,
    engineReady: ready,
    engineError: error,
    onPieceDrop,
    onPromotionPieceSelect,
    onSquareClick,
    playMove: applyPlayerMove,
    newGame,
    resign,
    takeBack,
    flipBoard,
  };
}
