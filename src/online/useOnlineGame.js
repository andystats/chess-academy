// The online game controller: composes a rules instance (src/online/rules.js) with the realtime
// transport (useGameChannel.js) and exposes the game-object contract the arena view consumes
// (EngineGameView + BoardPanel), plus a few online extras (duckSquare, duckTargets, phase,
// connection, selfColor, resync, and chat: messages + sendChat).
//
// Authority model — the HOST (game creator) is the sole source of truth:
//   - Both players apply their own completed turn to a local rules instance immediately (optimistic),
//     so the board feels responsive.
//   - The host then broadcasts a full authoritative snapshot (monotonic `seq`). The joiner instead
//     sends a `move-intent`; the host validates + applies it and broadcasts the resulting snapshot.
//   - Every client rebuilds its rules instance from any snapshot whose `seq` is higher than its own.
//     Because snapshots are full state, a missed message self-heals on the next one — there is no
//     move-log replay and no per-message gap math.
// A full turn is bundled as {pieceMove, duckSquare} so duck placement and the piece move sync together.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { opposite } from '../lesson/moves.js';
import { createVariantGame, lastMoveOf } from './rules.js';
import { useGameChannel } from './useGameChannel.js';
import { loadSnapshot, saveSnapshot } from './localSnapshot.js';

const RESYNC_INTERVAL_MS = 900;

function snapshotView(game) {
  const phase = game.phase();
  return {
    fen: game.boardFen(),
    currentTurn: game.turnColor(),
    phase,
    duckSquare: game.duckSquare(),
    history: game.history(),
    captured: game.captured(),
    result: game.result(),
    lastMove: lastMoveOf(game),
  };
}

export function useOnlineGame({ gameId, variant, selfColor, isHost, hostColor, selfId }) {
  const gameRef = useRef(null);
  const seqRef = useRef(0);
  const playersRef = useRef({ white: null, black: null });
  const pendingPieceMoveRef = useRef(null);

  // Lazily build the starting rules instance: host resumes from its persisted snapshot on reload;
  // the joiner starts from any persisted snapshot and otherwise waits for the host's first snapshot.
  if (gameRef.current === null) {
    const persisted = loadSnapshot(gameId);
    if (persisted && persisted.state) {
      gameRef.current = createVariantGame(persisted.variant || variant, persisted.state);
      seqRef.current = persisted.seq || 0;
      if (persisted.players) playersRef.current = persisted.players;
    } else {
      gameRef.current = createVariantGame(variant);
      if (isHost) {
        seqRef.current = 1;
        playersRef.current = { [hostColor]: selfId, [opposite(hostColor)]: null };
      }
    }
  }

  const [view, setView] = useState(() => snapshotView(gameRef.current));
  const [selection, setSelection] = useState({ selectedSquare: null, legalTargets: [] });
  const [orientation, setOrientation] = useState(selfColor);
  const [synced, setSynced] = useState(isHost || Boolean(loadSnapshot(gameId)));
  const [messages, setMessages] = useState([]); // chat — peer-to-peer, ephemeral

  const sync = useCallback(() => {
    setView(snapshotView(gameRef.current));
    setSelection({ selectedSquare: null, legalTargets: [] });
  }, []);

  const buildSnapshot = useCallback(
    () => ({
      seq: seqRef.current,
      variant,
      hostColor,
      players: { ...playersRef.current },
      state: gameRef.current.serialize(),
    }),
    [variant, hostColor],
  );

  // --- Transport handlers (defined before the channel; passed fresh each render) ---

  const channelRef = useRef(null);

  const broadcastAuthoritative = useCallback(
    (bump) => {
      if (bump) seqRef.current += 1;
      const snapshot = buildSnapshot();
      saveSnapshot(gameId, snapshot);
      channelRef.current?.broadcastSnapshot(snapshot);
      sync();
    },
    [buildSnapshot, gameId, sync],
  );

  // Host: apply a remote move-intent to the authoritative game, then broadcast the new snapshot.
  const applyIntent = useCallback(
    (intent) => {
      if (!isHost || !intent?.pieceMove) return;
      const game = gameRef.current;
      const color = game.turnColor();
      // The first id to move on an unclaimed color claims that seat for the game; afterwards, intents
      // from any other id are ignored. With a public channel this is trust-on-first-move, which is
      // fine for a private invite link shared between two friends (the link is the access control).
      if (playersRef.current[color] == null) playersRef.current[color] = intent.by;
      if (intent.by !== playersRef.current[color]) return; // not the player whose turn it is

      if (!game.movePiece(intent.pieceMove).ok) return broadcastAuthoritative(true); // illegal → resync
      if (game.phase() === 'duck' && !game.result()) {
        if (!intent.duckSquare || !game.placeDuck(intent.duckSquare).ok) return broadcastAuthoritative(true);
      }
      return broadcastAuthoritative(true);
    },
    [isHost, broadcastAuthoritative],
  );

  // Joiner: adopt any snapshot newer than ours as the authoritative state.
  const adoptSnapshot = useCallback(
    (snapshot) => {
      if (!snapshot || snapshot.seq <= seqRef.current) return;
      seqRef.current = snapshot.seq;
      if (snapshot.players) playersRef.current = snapshot.players;
      gameRef.current = createVariantGame(snapshot.variant || variant, snapshot.state);
      saveSnapshot(gameId, snapshot);
      setSynced(true);
      sync();
    },
    [variant, gameId, sync],
  );

  // Chat is peer-to-peer (both sides send and receive), independent of the host-authoritative game
  // sync, so its handler is wired for both roles.
  const handleChat = useCallback((message) => {
    if (message?.text) setMessages((prev) => [...prev, message]);
  }, []);

  const channel = useGameChannel({
    gameId,
    selfId,
    isHost,
    handlers: {
      onChat: handleChat,
      ...(isHost
        ? {
            onMoveIntent: applyIntent,
            onRequestSnapshot: () => broadcastAuthoritative(false),
            onPeerJoin: () => broadcastAuthoritative(false),
          }
        : { onSnapshot: adoptSnapshot }),
    },
  });
  // Track the channel in a ref (updated after render) so the memoized callbacks above can reach it
  // without depending on its identity, which breaks the define-before-useGameChannel ordering.
  useLayoutEffect(() => {
    channelRef.current = channel;
  });

  // Joiner: keep asking for a snapshot until we have one (covers "joiner subscribed before host").
  useEffect(() => {
    if (isHost || synced || channel.status !== 'connected') return undefined;
    channel.requestSnapshot();
    const id = setInterval(() => channel.requestSnapshot(), RESYNC_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isHost, synced, channel.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Local interaction ---

  const isMyTurn = view.currentTurn === selfColor;
  const canMovePiece =
    channel.status === 'connected' && synced && isMyTurn && view.phase === 'piece' && !view.result;

  // Commit a completed turn: the host broadcasts authoritatively; the joiner sends an intent.
  const commitTurn = useCallback(
    (duckSquare) => {
      const pieceMove = pendingPieceMoveRef.current;
      pendingPieceMoveRef.current = null;
      if (isHost) {
        broadcastAuthoritative(true);
      } else {
        channelRef.current?.sendMoveIntent({ by: selfId, pieceMove, duckSquare });
        sync();
      }
    },
    [isHost, broadcastAuthoritative, selfId, sync],
  );

  // Play a piece move locally (optimistic). Returns true if it was legal. For duck, the turn isn't
  // committed until the duck is placed; for standard (and on king capture) it commits immediately.
  const playPieceMove = useCallback(
    (move) => {
      if (!canMovePiece) return false;
      const game = gameRef.current;
      const result = game.movePiece(move);
      if (!result.ok) return false;
      pendingPieceMoveRef.current = move;
      if (game.phase() === 'duck' && !game.result()) {
        sync(); // surface duck-placement targets; await onSquareClick
        return true;
      }
      commitTurn(null);
      return true;
    },
    [canMovePiece, sync, commitTurn],
  );

  const onPieceDrop = useCallback(
    (from, to) => playPieceMove({ from, to, promotion: 'q' }),
    [playPieceMove],
  );

  const onPromotionPieceSelect = useCallback(
    (piece, from, to) => {
      if (!from || !to) return false;
      return playPieceMove({ from, to, promotion: piece ? piece[1].toLowerCase() : 'q' });
    },
    [playPieceMove],
  );

  const onSquareClick = useCallback(
    (square) => {
      const game = gameRef.current;
      // Duck phase: a click on a legal empty square places the duck and completes the turn.
      if (view.phase === 'duck' && isMyTurn && !view.result) {
        if (game.legalDuckTargets().includes(square) && game.placeDuck(square).ok) commitTurn(square);
        return;
      }
      if (!canMovePiece) return;
      // Piece phase: tap-to-move selection (select a piece, then tap a destination).
      if (selection.selectedSquare) {
        if (square === selection.selectedSquare) {
          setSelection({ selectedSquare: null, legalTargets: [] });
          return;
        }
        if (playPieceMove({ from: selection.selectedSquare, to: square, promotion: 'q' })) return;
        const targets = game.legalPieceTargets(square);
        setSelection(targets.length ? { selectedSquare: square, legalTargets: targets } : { selectedSquare: null, legalTargets: [] });
        return;
      }
      const targets = game.legalPieceTargets(square);
      if (targets.length) setSelection({ selectedSquare: square, legalTargets: targets });
    },
    [view.phase, view.result, isMyTurn, canMovePiece, selection.selectedSquare, playPieceMove, commitTurn],
  );

  const newGame = useCallback(() => {
    if (!isHost) return;
    gameRef.current = createVariantGame(variant);
    pendingPieceMoveRef.current = null;
    setOrientation(selfColor);
    broadcastAuthoritative(true);
  }, [isHost, variant, selfColor, broadcastAuthoritative]);

  const flipBoard = useCallback(() => setOrientation(opposite), []);

  const resync = useCallback(() => {
    if (isHost) broadcastAuthoritative(false);
    else channelRef.current?.requestSnapshot();
  }, [isHost, broadcastAuthoritative]);

  const sendChat = useCallback(
    (text) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const message = { id: `${selfId}-${Date.now()}`, by: selfColor, text: trimmed };
      setMessages((prev) => [...prev, message]); // show our own message at once (broadcast self:false)
      channelRef.current?.sendChat(message);
    },
    [selfId, selfColor],
  );

  // Only computed during your own duck phase (a narrow window), so the per-render scan is negligible.
  const duckTargets =
    view.phase === 'duck' && isMyTurn && !view.result ? gameRef.current.legalDuckTargets() : [];

  return {
    fen: view.fen,
    orientation,
    playerSide: selfColor,
    currentTurn: view.currentTurn,
    status: view.result ? 'over' : 'player-turn',
    result: view.result,
    history: view.history,
    lastMove: view.lastMove,
    captured: view.captured,
    selectedSquare: selection.selectedSquare,
    legalTargets: selection.legalTargets,
    arePiecesDraggable: canMovePiece,
    onPieceDrop,
    onPromotionPieceSelect,
    onSquareClick,
    newGame,
    takeBack: () => {}, // disabled online (cross-peer undo needs agreement) — see plan scope cuts
    flipBoard,
    // Online extras consumed by BoardPanel (duck overlay) and OnlineGamePanel.
    variant,
    isHost,
    phase: view.phase,
    duckSquare: view.duckSquare,
    duckTargets,
    selfColor,
    resync,
    messages,
    sendChat,
    connection: { status: channel.status, peerPresent: channel.peerPresent, synced },
  };
}
