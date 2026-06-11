import { useCallback, useState } from 'react';
import { randomId } from '../lib/ids.js';

const CHAT_MAX_MESSAGES = 200; // a hostile sender can bypass the input's maxLength — cap on receive
const CHAT_MAX_LENGTH = 2000;

// Chat for an online game: peer-to-peer and ephemeral, fully independent of the host-authoritative
// game sync (messages are never part of snapshots). The controller wires `receiveChat` to the
// channel's onChat and shares its channel ref for sends; everything else lives here, so planned
// chat features (unread counts, typing, system messages, persistence) grow in one place.
export function useGameChat({ channelRef, selfColor }) {
  const [messages, setMessages] = useState([]);

  const receiveChat = useCallback((message) => {
    if (typeof message?.text !== 'string' || !message.text) return; // wire input — shape-guarded
    const entry = { ...message, text: message.text.slice(0, CHAT_MAX_LENGTH) };
    setMessages((prev) => [...prev.slice(-(CHAT_MAX_MESSAGES - 1)), entry]);
  }, []);

  const sendChat = useCallback(
    (text) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const message = { id: randomId(), by: selfColor, text: trimmed };
      // Show our own message at once (broadcast self:false), under the same cap as received ones.
      setMessages((prev) => [...prev.slice(-(CHAT_MAX_MESSAGES - 1)), message]);
      channelRef.current?.sendChat(message);
    },
    [channelRef, selfColor],
  );

  return { messages, receiveChat, sendChat };
}
