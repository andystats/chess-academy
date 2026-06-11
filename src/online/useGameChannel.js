// Thin transport over a Supabase Realtime Broadcast + Presence channel — one public channel per game
// id. It only relays message types and reports connection/presence; ALL game logic (validating moves,
// locking player slots, picking the authoritative snapshot) lives in the controller hook
// (useOnlineGame.js). Keeping this dumb makes the protocol easy to test with a fake channel.
//
// Protocol (host = game creator, the sole authority):
//   - move-intent      {turnId, by, pieceMove:{from,to,promotion}, duckSquare?}  either player → host
//   - snapshot         {epoch, seq, variant, hostColor, players:{white,black}, state}  host → everyone
//   - request-snapshot {by, epoch, seq, stuck?}  (requester's position; stuck = needs a heal)  joiner/Resync → host
//   - chat             {id, by, text}                                             either player → both
// Chat is peer-to-peer and ephemeral (not part of the authoritative game snapshot).
//
// Robustness: the WebSocket can drop (sleep/wake, network blips, backgrounded tabs). We auto-reconnect
// with backoff and fire `onSubscribed` on every (re)connect so the controller can re-sync (the joiner
// re-requests a snapshot; the host re-broadcasts). After MAX_RECONNECT_ATTEMPTS consecutive failures
// the status becomes a terminal 'error' until `reconnect()` restarts it (the panel's Resync button).
// Presence is NOT reset on a transient drop — the indicator holds its last-known value until the next
// presence sync, so a blip can't flap "opponent present"; a terminal error clears it.
//
// Suspended tabs (phone screen off, closed lid, mobile browsers freezing background pages) wake with
// a dead socket that may not error until the next heartbeat. We reconnect proactively on wake:
// immediately when we already know we're down, with a fresh channel after a long suspension even if
// we look healthy (a socket rarely survives one), and via a cheap state re-sync after a short hide.
//
// We never set `private: true` (that would require Realtime Authorization/RLS); the channel is public,
// authorized by the anon key alone. `broadcast.self:false` means a sender never hears its own events.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { isRealtimeConfigured, supabase } from '../lib/supabase.js';

const MAX_BACKOFF_MS = 10000;
const MAX_RECONNECT_ATTEMPTS = 6; // then status 'error' until reconnect() restarts the machine
const WAKE_RECONNECT_AFTER_MS = 30000; // hidden longer than this → assume the socket died

export function useGameChannel({ gameId, selfId, isHost, handlers }) {
  // Keep the latest handlers in a ref (updated after render, not during it) so changing them doesn't
  // tear down and re-subscribe the channel; the broadcast/presence callbacks read the ref at fire time.
  const handlersRef = useRef(handlers);
  useLayoutEffect(() => {
    handlersRef.current = handlers;
  });
  const channelRef = useRef(null);
  const reconnectRef = useRef(null);
  const [status, setStatus] = useState(isRealtimeConfigured ? 'connecting' : 'unconfigured');
  const [peerIds, setPeerIds] = useState([]); // non-self presence keys, for seat re-binding
  const [hostPresent, setHostPresent] = useState(false);

  useEffect(() => {
    if (!isRealtimeConfigured || !gameId || !selfId) return undefined;

    let cancelled = false;
    let attempt = 0;
    let reconnectTimer = null;
    let liveStatus = 'connecting'; // mirrors the status state for non-render callbacks (wake/online)
    const fire = (name, payload) => handlersRef.current?.[name]?.(payload);
    const setLiveStatus = (next) => {
      liveStatus = next;
      setStatus(next);
    };

    // Tear down the current channel and build a fresh one. channelRef is nulled FIRST so the late
    // CLOSED the torn-down channel fires is ignored by the subscribe guard below.
    const teardownAndConnect = () => {
      const old = channelRef.current;
      channelRef.current = null;
      try {
        supabase.removeChannel(old);
      } catch {
        /* already gone */
      }
      connect();
    };

    const scheduleReconnect = () => {
      if (cancelled || reconnectTimer) return;
      const delay = Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS);
      attempt += 1;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (cancelled) return;
        teardownAndConnect();
      }, delay);
    };

    function connect() {
      const channel = supabase.channel(`game:${gameId}`, {
        config: { broadcast: { self: false }, presence: { key: selfId } },
      });
      channelRef.current = channel;

      channel
        .on('broadcast', { event: 'snapshot' }, ({ payload }) => fire('onSnapshot', payload))
        .on('broadcast', { event: 'move-intent' }, ({ payload }) => fire('onMoveIntent', payload))
        .on('broadcast', { event: 'request-snapshot' }, ({ payload }) => fire('onRequestSnapshot', payload))
        .on('broadcast', { event: 'chat' }, ({ payload }) => fire('onChat', payload))
        .on('presence', { event: 'sync' }, () => {
          const entries = Object.entries(channel.presenceState());
          setPeerIds(entries.map(([key]) => key).filter((key) => key !== selfId));
          // Any OTHER presence tracking isHost: a joiner reads it as "the host is here"; a host
          // reads it as "this game is already hosted from another tab".
          setHostPresent(entries.some(([key, metas]) => key !== selfId && metas.some((meta) => meta.isHost)));
        })
        .on('presence', { event: 'join' }, ({ key }) => {
          if (key !== selfId) fire('onPeerJoin', { id: key });
        })
        .subscribe((state) => {
          // Ignore unmount stragglers and late events from a channel this hook already replaced.
          if (cancelled || channelRef.current !== channel) return;
          if (state === 'SUBSCRIBED') {
            attempt = 0;
            if (reconnectTimer) {
              clearTimeout(reconnectTimer); // a failure event mid-connect may have queued one
              reconnectTimer = null;
            }
            setLiveStatus('connected');
            channel.track({ id: selfId, isHost: Boolean(isHost) });
            fire('onSubscribed'); // (re)connected → controller re-syncs
          } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
            // Presence is deliberately left as-is on a transient drop (see header); the next
            // presence sync after resubscribing corrects it either way.
            if (attempt >= MAX_RECONNECT_ATTEMPTS) {
              setLiveStatus('error'); // terminal — surfaced as "Connection lost, try Resync"
              setPeerIds([]);
              setHostPresent(false);
              return;
            }
            setLiveStatus('reconnecting');
            scheduleReconnect();
          }
        });
    }

    // Manual restart out of the terminal 'error' state (the panel's Resync button) and the
    // wake-up handlers below.
    reconnectRef.current = () => {
      if (cancelled) return;
      attempt = 0;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      setLiveStatus('connecting');
      teardownAndConnect();
    };

    // Wake-up recovery (see header): a suspended tab's socket is usually dead but errors late.
    let hiddenAt = null;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        return;
      }
      if (cancelled) return;
      const hiddenFor = hiddenAt ? Date.now() - hiddenAt : 0;
      hiddenAt = null;
      if (liveStatus !== 'connected') reconnectRef.current?.(); // skip the backoff / terminal error
      else if (hiddenFor > WAKE_RECONNECT_AFTER_MS) reconnectRef.current?.(); // assume a dead socket
      else fire('onSubscribed'); // short blip: cheap state re-sync through the normal path
    };
    const onOnline = () => {
      if (!cancelled && liveStatus !== 'connected') reconnectRef.current?.();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);

    connect();

    return () => {
      cancelled = true;
      reconnectRef.current = null;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try {
        supabase.removeChannel(channelRef.current);
      } catch {
        /* already gone */
      }
      channelRef.current = null;
    };
  }, [gameId, selfId, isHost]);

  const send = (event, payload) => {
    channelRef.current?.send({ type: 'broadcast', event, payload });
  };

  return {
    status,
    peerPresent: peerIds.length > 0,
    peerIds,
    hostPresent,
    reconnect: () => reconnectRef.current?.(),
    broadcastSnapshot: (snapshot) => send('snapshot', snapshot),
    sendMoveIntent: (intent) => send('move-intent', intent),
    // `position` is the requester's {epoch, seq} so the host can tell a routine poll from a peer
    // whose state ran ahead of it (which needs an epoch-bumped answer to be adoptable).
    requestSnapshot: (position) => send('request-snapshot', { by: selfId, ...position }),
    sendChat: (message) => send('chat', message),
  };
}
