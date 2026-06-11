// Thin transport over a Supabase Realtime Broadcast + Presence channel — one public channel per game
// id. It only relays message types and reports connection/presence; ALL game logic (validating moves,
// locking player slots, picking the authoritative snapshot) lives in the controller hook
// (useOnlineGame.js). Keeping this dumb makes the protocol easy to test with a fake channel.
//
// Protocol (host = game creator, the sole authority):
//   - move-intent      {turnId, by, pieceMove:{from,to,promotion}, duckSquare?}  either player → host
//   - snapshot         {epoch, seq, variant, hostColor, players:{white,black}, state}  host → everyone
//   - request-snapshot {by, epoch, seq}   (requester's current position)          joiner/Resync → host
//   - chat             {id, by, text}                                             either player → both
// Chat is peer-to-peer and ephemeral (not part of the authoritative game snapshot).
//
// Robustness: the WebSocket can drop (sleep/wake, network blips, backgrounded tabs). We auto-reconnect
// with backoff and fire `onSubscribed` on every (re)connect so the controller can re-sync (the joiner
// re-requests a snapshot; the host re-broadcasts). Status is 'reconnecting' while down, never a dead end.
//
// We never set `private: true` (that would require Realtime Authorization/RLS); the channel is public,
// authorized by the anon key alone. `broadcast.self:false` means a sender never hears its own events.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { isRealtimeConfigured, supabase } from '../lib/supabase.js';

const MAX_BACKOFF_MS = 10000;

export function useGameChannel({ gameId, selfId, isHost, handlers }) {
  // Keep the latest handlers in a ref (updated after render, not during it) so changing them doesn't
  // tear down and re-subscribe the channel; the broadcast/presence callbacks read the ref at fire time.
  const handlersRef = useRef(handlers);
  useLayoutEffect(() => {
    handlersRef.current = handlers;
  });
  const channelRef = useRef(null);
  const [status, setStatus] = useState(isRealtimeConfigured ? 'connecting' : 'unconfigured');
  const [peerPresent, setPeerPresent] = useState(false);

  useEffect(() => {
    if (!isRealtimeConfigured || !gameId || !selfId) return undefined;

    let cancelled = false;
    let attempt = 0;
    let reconnectTimer = null;
    const fire = (name, payload) => handlersRef.current?.[name]?.(payload);

    const scheduleReconnect = () => {
      if (cancelled || reconnectTimer) return;
      const delay = Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS);
      attempt += 1;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (cancelled) return;
        try {
          supabase.removeChannel(channelRef.current);
        } catch {
          /* already gone */
        }
        connect();
      }, delay);
    };

    function connect() {
      const channel = supabase.channel(`game:${gameId}`, {
        config: { broadcast: { self: false, ack: true }, presence: { key: selfId } },
      });
      channelRef.current = channel;

      channel
        .on('broadcast', { event: 'snapshot' }, ({ payload }) => fire('onSnapshot', payload))
        .on('broadcast', { event: 'move-intent' }, ({ payload }) => fire('onMoveIntent', payload))
        .on('broadcast', { event: 'request-snapshot' }, ({ payload }) => fire('onRequestSnapshot', payload))
        .on('broadcast', { event: 'chat' }, ({ payload }) => fire('onChat', payload))
        .on('presence', { event: 'sync' }, () => {
          const ids = Object.keys(channel.presenceState());
          setPeerPresent(ids.some((id) => id !== selfId));
        })
        .on('presence', { event: 'join' }, ({ key }) => {
          if (key !== selfId) fire('onPeerJoin', { id: key });
        })
        .subscribe((state) => {
          if (cancelled) return;
          if (state === 'SUBSCRIBED') {
            attempt = 0;
            setStatus('connected');
            channel.track({ id: selfId, isHost: Boolean(isHost) });
            fire('onSubscribed'); // (re)connected → controller re-syncs
          } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
            setStatus('reconnecting');
            setPeerPresent(false);
            scheduleReconnect();
          }
        });
    }

    connect();

    return () => {
      cancelled = true;
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
    peerPresent,
    broadcastSnapshot: (snapshot) => send('snapshot', snapshot),
    sendMoveIntent: (intent) => send('move-intent', intent),
    // `position` is the requester's {epoch, seq} so the host can tell a routine poll from a peer
    // whose state ran ahead of it (which needs an epoch-bumped answer to be adoptable).
    requestSnapshot: (position) => send('request-snapshot', { by: selfId, ...position }),
    sendChat: (message) => send('chat', message),
  };
}
