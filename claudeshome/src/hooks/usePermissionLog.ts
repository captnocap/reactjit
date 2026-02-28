/**
 * usePermissionLog — records every permission request + response to localstore.
 *
 * Usage:
 *   const permLog = usePermissionLog();
 *   // When a permission fires:
 *   permLog.record({ action, target, question });
 *   // When the human responds:
 *   permLog.resolve(choice);  // 1=approve, 2=allow_all, 3=deny
 */
import { useCallback, useRef } from 'react';
import { useLocalStore } from '@reactjit/core';

export type PermChoice = 1 | 2 | 3;

export interface PermLogEntry {
  id:       number;
  ts:       number;
  action:   string;   // "Bash", "Read", "Write", etc.
  target:   string;
  question: string;
  choice:   PermChoice | null;  // null if pending / unresolved
}

export interface PermLogStore {
  entries: PermLogEntry[];
  nextId:  number;
}

const DEFAULT_STORE: PermLogStore = { entries: [], nextId: 1 };
const MAX_ENTRIES = 200;

const CHOICE_LABEL: Record<number, string> = {
  1: 'approve',
  2: 'allow_all',
  3: 'deny',
};

export function choiceLabel(c: PermChoice | null): string {
  return c == null ? 'pending' : (CHOICE_LABEL[c] ?? 'unknown');
}

// ── Stats derived from entries ──────────────────────────────────────────────

export interface PermStats {
  total:     number;
  approved:  number;   // choice 1 + 2
  denied:    number;   // choice 3
  pending:   number;   // unresolved
  // per-tool: action → { approved, denied }
  byTool:    Record<string, { approved: number; denied: number }>;
  // top denied tools sorted by deny count desc
  topDenied: Array<{ tool: string; count: number }>;
}

export function computeStats(entries: PermLogEntry[]): PermStats {
  const byTool: Record<string, { approved: number; denied: number }> = {};
  let approved = 0;
  let denied   = 0;
  let pending  = 0;

  for (const e of entries) {
    if (!byTool[e.action]) byTool[e.action] = { approved: 0, denied: 0 };
    if (e.choice === 3) {
      denied++;
      byTool[e.action].denied++;
    } else if (e.choice === 1 || e.choice === 2) {
      approved++;
      byTool[e.action].approved++;
    } else {
      pending++;
    }
  }

  const topDenied = Object.entries(byTool)
    .filter(([, v]) => v.denied > 0)
    .sort(([, a], [, b]) => b.denied - a.denied)
    .slice(0, 5)
    .map(([tool, v]) => ({ tool, count: v.denied }));

  return { total: entries.length, approved, denied, pending, byTool, topDenied };
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function usePermissionLog() {
  const [store, setStore] = useLocalStore<PermLogStore>('perm_log', DEFAULT_STORE);
  const setRef = useRef(setStore);
  setRef.current = setStore;

  // Pending entry ID waiting for resolution
  const pendingIdRef = useRef<number | null>(null);

  const record = useCallback((info: { action: string; target: string; question: string }) => {
    let newId = -1;
    setRef.current(prev => {
      const p = prev ?? DEFAULT_STORE;
      const entry: PermLogEntry = {
        id:       p.nextId,
        ts:       Date.now(),
        action:   info.action,
        target:   info.target,
        question: info.question,
        choice:   null,
      };
      newId = p.nextId;
      return {
        entries: [entry, ...p.entries].slice(0, MAX_ENTRIES),
        nextId:  p.nextId + 1,
      };
    });
    pendingIdRef.current = newId;
  }, []);

  const resolve = useCallback((choice: PermChoice) => {
    const id = pendingIdRef.current;
    if (id == null) return;
    pendingIdRef.current = null;
    setRef.current(prev => {
      const p = prev ?? DEFAULT_STORE;
      return {
        ...p,
        entries: p.entries.map(e => e.id === id ? { ...e, choice } : e),
      };
    });
  }, []);

  const clearAll = useCallback(() => {
    setRef.current({ entries: [], nextId: 1 });
  }, []);

  const entries = store?.entries ?? [];
  const stats   = computeStats(entries);

  return { record, resolve, clearAll, entries, stats };
}
