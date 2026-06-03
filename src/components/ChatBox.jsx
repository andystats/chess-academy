import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Send } from 'lucide-react';

// Chat with your opponent during an online game. Messages are {id, by (a colour), text}; `selfColor`
// decides which side a bubble sits on (yours right, theirs left). Ephemeral — no history beyond the
// session (see src/online/useOnlineGame.js).
export default function ChatBox({ messages, onSend, selfColor }) {
  const [text, setText] = useState('');
  const endRef = useRef(null);

  // Keep the latest message in view as the conversation grows.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const submit = (event) => {
    event.preventDefault();
    onSend(text);
    setText('');
  };

  return (
    <div className="flex flex-col border-3 border-foreground bg-white">
      <div className="h-48 space-y-1.5 overflow-y-auto p-3 text-sm">
        {messages.length === 0 ? (
          <p className="text-gray-400">Say hi to your opponent 👋</p>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={clsx('flex', message.by === selfColor ? 'justify-end' : 'justify-start')}>
              <span
                className={clsx(
                  'inline-block max-w-[85%] break-words px-2 py-1',
                  message.by === selfColor ? 'bg-brand-600 text-white' : 'bg-brand-50 text-foreground',
                )}
              >
                {message.text}
              </span>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t-3 border-foreground p-2">
        <input
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Message…"
          maxLength={500}
          className="min-h-touch flex-1 px-2 text-sm focus:outline-none"
        />
        <button type="submit" className="tao-btn-primary px-3" aria-label="Send message">
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
