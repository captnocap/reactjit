/**
 * useMessages — bidirectional message store between Vesper and the human.
 *
 * Messages persist in localstore. Both sides can post:
 *   - Human: curl -X POST http://localhost:9100/message -d "hey"
 *   - Vesper: via the send() function from this hook
 *
 * Each message has a sender ('human' | 'vesper'), text, timestamp, and read flag.
 */
import { useCallback } from 'react';
import { useLocalStore } from '@reactjit/core';

export type Sender = 'human' | 'vesper';

export interface Message {
  id: string;
  sender: Sender;
  text: string;
  ts: number;
  read: boolean;
}

interface MessageStore {
  messages: Message[];
}

const DEFAULT: MessageStore = { messages: [] };

let _idCounter = 0;
function makeId(): string {
  return `msg-${Date.now()}-${_idCounter++}`;
}

export function useMessages() {
  const [store, setStore] = useLocalStore<MessageStore>('vesper_messages', DEFAULT);

  const messages = store?.messages ?? [];
  const unreadCount = messages.filter(m => !m.read && m.sender === 'human').length;

  const receive = useCallback((text: string) => {
    if (!text.trim()) return;
    setStore(prev => ({
      messages: [...(prev?.messages ?? []), {
        id: makeId(),
        sender: 'human' as Sender,
        text: text.trim(),
        ts: Date.now(),
        read: false,
      }],
    }));
  }, [setStore]);

  const send = useCallback((text: string) => {
    if (!text.trim()) return;
    setStore(prev => ({
      messages: [...(prev?.messages ?? []), {
        id: makeId(),
        sender: 'vesper' as Sender,
        text: text.trim(),
        ts: Date.now(),
        read: true,
      }],
    }));
  }, [setStore]);

  const markAllRead = useCallback(() => {
    setStore(prev => ({
      messages: (prev?.messages ?? []).map(m =>
        m.read ? m : { ...m, read: true }
      ),
    }));
  }, [setStore]);

  const clear = useCallback(() => {
    setStore({ messages: [] });
  }, [setStore]);

  return { messages, unreadCount, receive, send, markAllRead, clear };
}
