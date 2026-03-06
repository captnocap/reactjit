/**
 * useDailySummary — compiles a per-day snapshot of session activity.
 *
 * Tracks: files changed, turns taken, tokens used, errors hit, hearts lost.
 * Keyed by YYYY-MM-DD in localstore. Auto-accumulates as you work.
 */
import { useRef, useCallback } from 'react';
import { useLocalStore, useLuaInterval } from '@reactjit/core';

export interface DaySummary {
  date:         string;
  turnsTotal:   number;
  tokensTotal:  number;
  filesChanged: number;
  linesAdded:   number;
  linesRemoved: number;
  errorsHit:    number;
  heartsLost:   number;
  sessionCount: number;
  firstSeen:    number;
  lastSeen:     number;
}

interface SummaryStore {
  days: Record<string, DaySummary>;
}

const DEFAULT: SummaryStore = { days: {} };

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function emptyDay(date: string): DaySummary {
  return {
    date,
    turnsTotal: 0,
    tokensTotal: 0,
    filesChanged: 0,
    linesAdded: 0,
    linesRemoved: 0,
    errorsHit: 0,
    heartsLost: 0,
    sessionCount: 0,
    firstSeen: Date.now(),
    lastSeen: Date.now(),
  };
}

interface Snapshot {
  turns:    number;
  tokens:   number;
  files:    number;
  added:    number;
  removed:  number;
  errors:   number;
  deaths:   number;
}

export function useDailySummary() {
  const [store, setStore] = useLocalStore<SummaryStore>('daily_summary', DEFAULT);
  const markedSessionRef = useRef(false);

  const update = useCallback((snapshot: Snapshot) => {
    const key = todayKey();
    setStore(prev => {
      const cur = prev ?? DEFAULT;
      const existing = cur.days[key] ?? emptyDay(key);
      const updated: DaySummary = {
        ...existing,
        turnsTotal:   Math.max(existing.turnsTotal, snapshot.turns),
        tokensTotal:  Math.max(existing.tokensTotal, snapshot.tokens),
        filesChanged: Math.max(existing.filesChanged, snapshot.files),
        linesAdded:   Math.max(existing.linesAdded, snapshot.added),
        linesRemoved: Math.max(existing.linesRemoved, snapshot.removed),
        errorsHit:    Math.max(existing.errorsHit, snapshot.errors),
        heartsLost:   Math.max(existing.heartsLost, snapshot.deaths),
        sessionCount: markedSessionRef.current ? existing.sessionCount : existing.sessionCount + 1,
        lastSeen:     Date.now(),
      };
      markedSessionRef.current = true;
      return { days: { ...cur.days, [key]: updated } };
    });
  }, [setStore]);

  const days = store?.days ?? {};
  const today = days[todayKey()] ?? emptyDay(todayKey());
  const history = Object.values(days).sort((a, b) => b.date.localeCompare(a.date));

  return { update, today, history, todayKey: todayKey() };
}
