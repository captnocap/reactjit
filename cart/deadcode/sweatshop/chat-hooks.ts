// =============================================================================
// CHAT HOOKS — composer history, message search, export state, conversations
// =============================================================================

import { useState, useRef, useCallback } from 'react';
// ── Composer History ─────────────────────────────────────────────────────────

export function useComposerHistory() {
  const [history, setHistory] = useState<string[]>([]);
  const indexRef = useRef(-1);

  const push = useCallback((text: string) => {
    if (!text.trim()) return;
    setHistory(prev => {
      // Don't duplicate consecutive entries
      if (prev.length > 0 && prev[prev.length - 1] === text.trim()) return prev;
      return [...prev.slice(-49), text.trim()]; // Keep last 50
    });
    indexRef.current = -1;
  }, []);

  const navigate = useCallback((direction: 'up' | 'down', current: string): { text: string; moved: boolean } => {
    if (history.length === 0) return { text: current, moved: false };

    if (direction === 'up') {
      const nextIndex = indexRef.current === -1 ? history.length - 1 : Math.max(0, indexRef.current - 1);
      indexRef.current = nextIndex;
      return { text: history[nextIndex], moved: true };
    } else {
      if (indexRef.current === -1) return { text: current, moved: false };
      const nextIndex = indexRef.current + 1;
      if (nextIndex >= history.length) {
        indexRef.current = -1;
        return { text: '', moved: true };
      }
      indexRef.current = nextIndex;
      return { text: history[nextIndex], moved: true };
    }
  }, [history]);

  const reset = useCallback(() => {
    indexRef.current = -1;
  }, []);

  return { push, navigate, reset, history };
}

// ── Message Search ───────────────────────────────────────────────────────────

export interface SearchResult {
  messageIndex: number;
  message: any;
  matches: Array<{ start: number; end: number }>;
}

export function useMessageSearch(messages: any[]) {
  const [query, setQuery] = useState('');

  const results: SearchResult[] = React.useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const out: SearchResult[] = [];

    messages.forEach((msg, idx) => {
      const text = (msg.text || '').toLowerCase();
      const matches: Array<{ start: number; end: number }> = [];
      let pos = 0;
      while (true) {
        const found = text.indexOf(q, pos);
        if (found < 0) break;
        matches.push({ start: found, end: found + q.length });
        pos = found + q.length;
      }
      if (matches.length > 0) {
        out.push({ messageIndex: idx, message: msg, matches });
      }
    });

    return out;
  }, [messages, query]);

  return { query, setQuery, results, active: query.trim().length > 0 };
}

// ── Typing Indicator ─────────────────────────────────────────────────────────

export function useTypingDots(speedMs: number = 400): number {
  const [dot, setDot] = useState(0);

  React.useEffect(() => {
    const id = setInterval(() => {
      setDot(d => (d + 1) % 4);
    }, speedMs);
    return () => clearInterval(id);
  }, [speedMs]);

  return dot;
}

// ── Conversation List ────────────────────────────────────────────────────────

export interface ConversationMeta {
  id: string;
  title: string;
  timestamp: number;
  messageCount: number;
  preview: string;
}

const CONV_STORAGE_KEY = 'sweatshop:conversations';

function loadConversations(): ConversationMeta[] {
  try {
    const raw = (globalThis as any).__localstore_get?.(CONV_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(CONV_STORAGE_KEY) : null;
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveConversations(list: ConversationMeta[]) {
  const json = JSON.stringify(list);
  try {
    (globalThis as any).__localstore_set?.(CONV_STORAGE_KEY, json);
  } catch {}
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(CONV_STORAGE_KEY, json);
  } catch {}
}

export function useConversationList() {
  const [conversations, setConversations] = useState<ConversationMeta[]>(loadConversations);

  const addConversation = useCallback((messages: any[]) => {
    if (!messages || messages.length === 0) return;
    const firstUser = messages.find((m: any) => m.role === 'user');
    const title = firstUser?.text?.slice(0, 40) || 'New conversation';
    const preview = messages[messages.length - 1]?.text?.slice(0, 60) || '';
    const meta: ConversationMeta = {
      id: String(Date.now()),
      title,
      timestamp: Date.now(),
      messageCount: messages.length,
      preview,
    };
    setConversations(prev => {
      const next = [meta, ...prev].slice(0, 30);
      saveConversations(next);
      return next;
    });
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setConversations(prev => {
      const next = prev.filter(c => c.id !== id);
      saveConversations(next);
      return next;
    });
  }, []);

  return { conversations, addConversation, deleteConversation };
}

// ── Scroll-to-bottom stub ────────────────────────────────────────────────────
// Host does not expose scroll position / scrollTo API yet, so this is UI-only.

export function useScrollBottomStub(messages: any[], isGenerating: boolean) {
  const [dismissed, setDismissed] = useState(false);

  React.useEffect(() => {
    setDismissed(false);
  }, [messages.length]);

  const show = messages.length > 5 && isGenerating && !dismissed;

  return {
    showScrollButton: show,
    dismissScrollButton: () => setDismissed(true),
    scrollToBottom: () => {
      // TODO: wire to host ScrollView scrollToEnd when available
      setDismissed(true);
    },
  };
}
