// Thin transport over a Supabase Realtime Broadcast + Presence channel — one public channel per game
// id. It only relays three message types and reports connection/presence; ALL game logic (validating
// moves, locking player slots, picking the authoritative snapshot) lives in the controller hook
// (useOnlineGame.js). Keeping this dumb makes the protocol easy to test with a fake channel.
//
// Protocol (host = game creator, the sole authority):
//   - move-intent      {turnId, by, pieceMove:{from,to,promotion}, duckSquare?}  either player → host
//   - snapshot         {seq, variant, hostColor, players:{white,black}, state}    host → everyone
//   - request-snapshot {by}                                                       joiner/Resync → host
//   - chat             {id, by, text}                                             either player → both
// Chat is peer-to-peer and ephemeral (not part of the authoritative game snapshot).
//
// We never set `private: true` (that would require Realtime Authorization/RLS); the channel is public,
// authorized by the anon key alone. `broadcast.self:false` means a sender never hears its own events.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { isRealtimeConfigured, supabase } from '../lib/supabase.js';

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

    const channel = supabase.channel(`game:${gameId}`, {
      config: { broadcast: { self: false, ack: true }, presence: { key: selfId } },
    });
    channelRef.current = channel;

    const fire = (name, payload) => handlersRef.current?.[name]?.(payload);

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
        if (state === 'SUBSCRIBED') {
          setStatus('connected');
          channel.track({ id: selfId, isHost: Boolean(isHost) });
        } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
          setStatus('error');
        }
      });

    return () => {
      supabase.removeChannel(channel);
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
    requestSnapshot: () => send('request-snapshot', { by: selfId }),
    sendChat: (message) => send('chat', message),
  };
}
