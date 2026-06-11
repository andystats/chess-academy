// The online game controller: composes a rules instance (src/online/rules.js) with the realtime
// transport (useGameChannel.js) and exposes the game-object contract the arena view consumes
// (EngineGameView + BoardPanel), plus a few online extras (duckSquare, duckTargets, phase,
// connection, selfColor, resync, and chat: messages + sendChat).
//
// Authority model — the HOST (game creator) is the sole source of truth:
//   - Both players apply their own completed turn to a local rules instance immediately (optimistic),
//     so the board feels responsive.
//   - The host then broadcasts a full authoritative snapshot. The joiner instead sends a
//     `move-intent`; the host validates + applies it and broadcasts the resulting snapshot.
//   - Snapshots are ordered by (epoch, seq). `seq` is the monotonic version within one game
//     instance; `epoch` identifies the instance itself and outranks `seq`, so "New game" (and a
//     host starting over without its persisted state) ships a higher epoch that joiners adopt even
//     though their seq may be far ahead. Within an epoch, a client rebuilds its rules instance from
//     any snapshot with a higher seq. Because snapshots are full state, a missed message self-heals
//     on the next one — there is no move-log replay and no per-message gap math.
// A full turn is bundled as {pieceMove, duckSquare} so duck placement and the piece move sync together.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { opposite } from '../lesson/moves.js';
import { createVariantGame, lastMoveOf } from './rules.js';
import { useGameChannel } from './useGameChannel.js';
import { loadSnapshot, saveSnapshot } from './localSnapshot.js';

const RESYNC_INTERVAL_MS = 900; // joiner polls this fast until first synced (handshake)
const IDLE_RESYNC_MS = 6000; // once synced, joiner pulls this slowly while waiting on the opponent
const MOVE_RETRY_MS = 2500; // joiner resends an unconfirmed move-intent this often

// A fresh epoch marks a new game instance under the same game id (New game, or a host with no
// persisted state for the id). Timestamp-based so a host that lost its storage still mints an epoch
// above whatever a joiner holds; the max() keeps repeated mints monotonic within one millisecond.
const mintEpoch = (current) => Math.max(Date.now(), (current || 0) + 1);

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
  const epochRef = useRef(0); // joiner stays at 0 until its first adopted snapshot
  const playersRef = useRef({ white: null, black: null });
  const pendingPieceMoveRef = useRef(null);
  // The joiner's last move-intent that the host hasn't confirmed yet (cleared when a newer snapshot
  // arrives). Resent on an interval so a single lost message can't deadlock the game.
  const pendingIntentRef = useRef(null);

  // Lazily build the starting rules instance: host resumes from its persisted snapshot on reload;
  // the joiner starts from any persisted snapshot and otherwise waits for the host's first snapshot.
  if (gameRef.current === null) {
    const persisted = loadSnapshot(gameId);
    if (persisted && persisted.state) {
      gameRef.current = createVariantGame(persisted.variant || variant, persisted.state);
      seqRef.current = persisted.seq || 0;
      // A host resuming a pre-epoch snapshot starts a fresh instance so joiners follow it.
      epochRef.current = persisted.epoch || (isHost ? mintEpoch(0) : 0);
      if (persisted.players) playersRef.current = persisted.players;
    } else {
      gameRef.current = createVariantGame(variant);
      if (isHost) {
        seqRef.current = 1;
        epochRef.current = mintEpoch(0);
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
      epoch: epochRef.current,
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
      if (intent.by !== playersRef.current[color]) {
        // Not whose turn it is. If it's the other known player resending a move we already applied
        // (their snapshot was lost), re-publish current state so they catch up; never re-apply. A
        // stray third party is ignored outright.
        const knownPlayer = intent.by === playersRef.current.white || intent.by === playersRef.current.black;
        if (knownPlayer) broadcastAuthoritative(false);
        return;
      }

      // Validate the full turn on a throwaway clone first (the lesson engine's classify-on-a-clone
      // pattern): a turn is atomic, and the authoritative game must never commit a piece move whose
      // duck placement then fails — that would strand every client in a half-turn that no follow-up
      // intent can complete. Once the probe passes, the same ops cannot fail on the real instance.
      const probe = createVariantGame(variant, game.serialize());
      if (!probe.movePiece(intent.pieceMove).ok) return broadcastAuthoritative(true); // illegal → resync
      if (probe.phase() === 'duck' && !probe.result()) {
        if (!intent.duckSquare || !probe.placeDuck(intent.duckSquare).ok) return broadcastAuthoritative(true);
      }
      game.movePiece(intent.pieceMove);
      if (game.phase() === 'duck' && !game.result()) game.placeDuck(intent.duckSquare);
      return broadcastAuthoritative(true);
    },
    [isHost, variant, broadcastAuthoritative],
  );

  // Host: answer a resync request. A requester strictly ahead of our (epoch, seq) would drop a
  // plain re-publish (the adopt guard ignores non-newer snapshots) — that was how a joiner got
  // stuck for good after the host lost its storage. Minting a fresh epoch makes the answer
  // unconditionally adoptable; a routine poll is answered without bumping so it can never clear
  // the requester's in-flight move-intent.
  const answerSnapshotRequest = useCallback(
    (request) => {
      const reqEpoch = request?.epoch || 0;
      const reqSeq = request?.seq || 0;
      const stuckAhead =
        reqEpoch > epochRef.current || (reqEpoch === epochRef.current && reqSeq > seqRef.current);
      if (stuckAhead) epochRef.current = mintEpoch(epochRef.current);
      broadcastAuthoritative(stuckAhead);
    },
    [broadcastAuthoritative],
  );

  // Joiner: adopt any snapshot newer than ours — a higher epoch (new game instance) outranks seq;
  // within the same epoch, a higher seq wins. Snapshots from peers without an epoch (older build)
  // compare as epoch 0, degrading to the original seq-only rule.
  const adoptSnapshot = useCallback(
    (snapshot) => {
      if (!snapshot) return;
      const epoch = snapshot.epoch || 0;
      const newer =
        epoch > epochRef.current || (epoch === epochRef.current && snapshot.seq > seqRef.current);
      if (!newer) return;
      epochRef.current = epoch;
      seqRef.current = snapshot.seq;
      pendingIntentRef.current = null; // a newer authoritative state means our move was applied or rolled back
      pendingPieceMoveRef.current = null; // and any half-entered local turn is superseded with it
      if (snapshot.players) playersRef.current = snapshot.players;
      gameRef.current = createVariantGame(snapshot.variant || variant, snapshot.state);
      saveSnapshot(gameId, snapshot);
      setSynced(true);
      sync();
    },
    [variant, gameId, sync],
  );

  // Joiner: pull the authoritative snapshot, telling the host where we are so it can detect (and
  // epoch-heal) a requester whose state ran ahead of it. Counterpart of broadcastAuthoritative.
  const requestAuthoritative = useCallback(() => {
    channelRef.current?.requestSnapshot({ epoch: epochRef.current, seq: seqRef.current });
  }, []);

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
      // Fired on every (re)connect: the host re-publishes current state; the joiner pulls it.
      onSubscribed: isHost ? () => broadcastAuthoritative(false) : requestAuthoritative,
      ...(isHost
        ? {
            onMoveIntent: applyIntent,
            onRequestSnapshot: answerSnapshotRequest,
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

  // Joiner pulls the authoritative snapshot: fast until first synced (handshake races / late host),
  // then slowly while waiting on the opponent as a safety net for a missed snapshot. No polling on
  // your own turn — you already hold the latest state. The host is authoritative and never pulls.
  const waitingForState = view.currentTurn !== selfColor || !synced;
  useEffect(() => {
    if (isHost || channel.status !== 'connected') return undefined;
    requestAuthoritative();
    if (!waitingForState) return undefined;
    const interval = synced ? IDLE_RESYNC_MS : RESYNC_INTERVAL_MS;
    const id = setInterval(requestAuthoritative, interval);
    return () => clearInterval(id);
  }, [isHost, synced, waitingForState, channel.status, requestAuthoritative]);

  // Joiner: resend an unconfirmed move-intent until a newer snapshot clears it, so one dropped message
  // can't leave both players waiting on each other forever.
  useEffect(() => {
    if (isHost) return undefined;
    const id = setInterval(() => {
      if (pendingIntentRef.current) channelRef.current?.sendMoveIntent(pendingIntentRef.current);
    }, MOVE_RETRY_MS);
    return () => clearInterval(id);
  }, [isHost]);

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
        const intent = { by: selfId, pieceMove, duckSquare };
        pendingIntentRef.current = intent; // retransmit until a newer snapshot confirms/rolls back
        channelRef.current?.sendMoveIntent(intent);
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
    // New instance: a fresh epoch outranks any seq the joiner reached, so the reset board is
    // adopted; seq restarts within the new epoch.
    epochRef.current = mintEpoch(epochRef.current);
    seqRef.current = 0;
    setOrientation(selfColor);
    broadcastAuthoritative(true);
  }, [isHost, variant, selfColor, broadcastAuthoritative]);

  const flipBoard = useCallback(() => setOrientation(opposite), []);

  const resync = useCallback(() => {
    if (isHost) broadcastAuthoritative(false);
    else requestAuthoritative();
  }, [isHost, broadcastAuthoritative, requestAuthoritative]);

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
