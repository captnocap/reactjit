/**
 * useSessionRecap — saves the last N things Vesper said,
 * then re-reads them on fresh session startup.
 *
 * Save strategy: every 5s, extract assistant_text rows from
 * claude:classified, group consecutive lines into semantic blocks,
 * persist the last MAX_RECAP blocks to localstore.
 *
 * Replay strategy: on mount, wait SETTLE_DELAY ms, then poll
 * claude:classified. If there are zero user_prompt rows (fresh
 * session, not HMR reload), send the saved blocks back to Claude
 * via claude:send so she remembers what she was doing.
 */
import { useEffect, useRef } from 'react';
import { useLoveRPC, useLocalStore, useLuaInterval } from '@reactjit/core';

const MAX_RECAP = 5;
const SETTLE_DELAY = 5000;

interface RecapEntry {
  text: string;
  at: number;
}

interface RecapStore {
  entries: RecapEntry[];
  savedAt: number;
}

const DEFAULT: RecapStore = { entries: [], savedAt: 0 };

export function useSessionRecap() {
  const rpcClassified = useLoveRPC('claude:classified');
  const rpcSend       = useLoveRPC('claude:send');
  const rpcRef        = useRef(rpcClassified);
  const sendRef       = useRef(rpcSend);
  rpcRef.current      = rpcClassified;
  sendRef.current     = rpcSend;

  const [store, setStore] = useLocalStore<RecapStore>('vesper_recap', DEFAULT);
  const storeRef = useRef(store);
  storeRef.current = store;

  // Guard so we only fire the replay once per process lifetime
  const firedRef = useRef(false);

  // On mount: wait for session to settle, then check freshness and inject recap
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (firedRef.current) return;
      const cur = storeRef.current ?? DEFAULT;
      if (!cur.entries.length) return;

      try {
        const res = await rpcRef.current({ session: 'default' }) as any;
        const rows = (res?.rows ?? []) as Array<{ kind: string; text: string }>;

        // If user_prompt rows exist, session is already in progress (HMR reload
        // or resumed shell) — do not inject, that would be intrusive.
        const hasUserPrompts = rows.some(r => r.kind === 'user_prompt');
        if (hasUserPrompts) return;

        firedRef.current = true;

        const lines = cur.entries
          .map((e, i) => `${i + 1}. ${e.text.slice(0, 200).trim()}`)
          .join('\n');

        await sendRef.current({
          message: `[VESPER RECAP] Fresh session. Here's what I said at the end of last session:\n\n${lines}\n\nPicking up from here.`,
        });
      } catch {
        // Session not ready yet — silently skip
      }
    }, SETTLE_DELAY);

    return () => clearTimeout(timer);
  }, []); // fire once on mount

  // Save: extract assistant_text blocks from current session every 5s
  useLuaInterval(5000, async () => {
    try {
      const res = await rpcRef.current({ session: 'default' }) as any;
      if (!res?.rows) return;

      const rows = (res.rows as any[]).map(r => ({
        kind: String(r.kind ?? ''),
        text: String(r.text ?? '').trim(),
      }));

      // Group consecutive assistant_text lines into semantic blocks
      const blocks: string[] = [];
      let current: string[] = [];

      for (const row of rows) {
        if (row.kind === 'assistant_text' && row.text) {
          current.push(row.text);
        } else if (current.length > 0) {
          blocks.push(current.join(' '));
          current = [];
        }
      }
      if (current.length > 0) {
        blocks.push(current.join(' '));
      }

      const entries: RecapEntry[] = blocks
        .filter(b => b.length > 10)
        .slice(-MAX_RECAP)
        .map(text => ({ text, at: Date.now() }));

      if (entries.length === 0) return;

      setStore({ entries, savedAt: Date.now() });
    } catch {}
  });
}
