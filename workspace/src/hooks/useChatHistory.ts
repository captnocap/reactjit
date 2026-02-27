/**
 * useChatHistory — accumulates classified screen rows into persistent turns.
 *
 * Strategy: poll claude:classified every 2s, detect user_prompt tokens as
 * turn-start boundaries, group rows into turns, persist via useLocalStore.
 *
 * No Lua changes needed — builds entirely on claude:classified RPC.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLoveRPC, useLocalStore, useLuaInterval } from '@reactjit/core';

export interface ChatRow {
  kind: string;
  text: string;
}

export interface ChatTurn {
  id: string;
  startedAt: number;
  rows: ChatRow[];
  summary: string; // first user_prompt text
  bookmarked?: boolean;
}

interface ChatStore {
  turns: ChatTurn[];
  lastSeenFingerprint: string;
  bookmarks: Record<string, boolean>;
}

const DEFAULT_STORE: ChatStore = { turns: [], lastSeenFingerprint: '', bookmarks: {} };
const MAX_TURNS = 200;

function makeTurnId(startedAt: number, idx: number): string {
  return `${startedAt}-${idx}`;
}

function fingerprint(rows: ChatRow[]): string {
  // cheaply detect if screen content has changed
  const last8 = rows.slice(-8);
  return last8.map(r => r.kind[0] + r.text.slice(0, 20)).join('|');
}

function splitIntoTurns(rows: ChatRow[], baseTime: number): ChatTurn[] {
  const turns: ChatTurn[] = [];
  let current: ChatRow[] = [];
  let turnIdx = 0;

  for (const row of rows) {
    if (row.kind === 'user_prompt' && current.length > 0) {
      // Seal previous turn
      const summary = current.find(r => r.kind === 'user_prompt')?.text ?? '(no prompt)';
      turns.push({
        id: makeTurnId(baseTime, turnIdx++),
        startedAt: baseTime,
        rows: current,
        summary,
      });
      current = [];
    }
    current.push(row);
  }

  // Seal final partial turn if it has a user_prompt
  if (current.some(r => r.kind === 'user_prompt')) {
    const summary = current.find(r => r.kind === 'user_prompt')?.text ?? '(no prompt)';
    turns.push({
      id: makeTurnId(baseTime, turnIdx++),
      startedAt: baseTime,
      rows: current,
      summary,
    });
  }

  return turns;
}

export function useChatHistory() {
  const rpcClassified = useLoveRPC('claude:classified');
  const rpcRef = useRef(rpcClassified);
  rpcRef.current = rpcClassified;

  const [store, setStore] = useLocalStore<ChatStore>('claude_chat_history', DEFAULT_STORE);
  const [query, setQuery] = useState('');
  const mountTimeRef = useRef(Date.now());

  useEffect(() => {
    let alive = true;

    const poll = async () => {
      if (!alive) return;
      try {
        const res = await rpcRef.current({ session: 'default' }) as any;
        if (!res?.rows) return;

        const rows: ChatRow[] = (res.rows as any[]).map(r => ({
          kind: String(r.kind ?? 'unknown'),
          text: String(r.text ?? ''),
        }));

        const fp = fingerprint(rows);

        setStore(prev => {
          const cur = prev ?? DEFAULT_STORE;
          if (cur.lastSeenFingerprint === fp) return cur;

          const newTurns = splitIntoTurns(rows, mountTimeRef.current);
          if (newTurns.length === 0) return { ...cur, lastSeenFingerprint: fp };

          // Merge: replace turns from this session (same mountTime prefix)
          const mountPrefix = String(mountTimeRef.current);
          const kept = (cur.turns ?? []).filter(t => !t.id.startsWith(mountPrefix));
          const merged = [...kept, ...newTurns].slice(-MAX_TURNS);

          return { turns: merged, lastSeenFingerprint: fp, bookmarks: cur.bookmarks ?? {} };
        });
      } catch {
        // RPC not ready yet — silent
      }
    };

    poll(); // immediate first poll
    return () => {
      alive = false;
    };
  }, [setStore]);

  useLuaInterval(2000, async () => {
    try {
      const res = await rpcRef.current({ session: 'default' }) as any;
      if (!res?.rows) return;

      const rows: ChatRow[] = (res.rows as any[]).map(r => ({
        kind: String(r.kind ?? 'unknown'),
        text: String(r.text ?? ''),
      }));

      const fp = fingerprint(rows);

      setStore(prev => {
        const cur = prev ?? DEFAULT_STORE;
        if (cur.lastSeenFingerprint === fp) return cur;

        const newTurns = splitIntoTurns(rows, mountTimeRef.current);
        if (newTurns.length === 0) return { ...cur, lastSeenFingerprint: fp };

        // Merge: replace turns from this session (same mountTime prefix)
        const mountPrefix = String(mountTimeRef.current);
        const kept = (cur.turns ?? []).filter(t => !t.id.startsWith(mountPrefix));
        const merged = [...kept, ...newTurns].slice(-MAX_TURNS);

        return { turns: merged, lastSeenFingerprint: fp, bookmarks: cur.bookmarks ?? {} };
      });
    } catch {
      // RPC not ready yet — silent
    }
  });

  const turns = store?.turns ?? [];
  const bookmarks = store?.bookmarks ?? {};

  const filtered = query.trim()
    ? turns.filter(t =>
        t.summary.toLowerCase().includes(query.toLowerCase()) ||
        t.rows.some(r => r.text.toLowerCase().includes(query.toLowerCase()))
      )
    : turns;

  const withBookmarks = filtered.map(t => ({ ...t, bookmarked: !!bookmarks[t.id] }));

  const toggleBookmark = useCallback((id: string) => {
    setStore(prev => {
      const cur = prev ?? DEFAULT_STORE;
      const bm = { ...(cur.bookmarks ?? {}) };
      if (bm[id]) delete bm[id];
      else bm[id] = true;
      return { ...cur, bookmarks: bm };
    });
  }, [setStore]);

  return {
    turns: withBookmarks.slice().reverse(), // newest first
    totalTurns: turns.length,
    bookmarkCount: Object.keys(bookmarks).length,
    query,
    setQuery,
    toggleBookmark,
    clearHistory: useCallback(() => setStore({ turns: [], lastSeenFingerprint: '', bookmarks: {} }), [setStore]),
  };
}
