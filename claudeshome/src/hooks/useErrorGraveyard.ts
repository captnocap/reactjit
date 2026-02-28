/**
 * useErrorGraveyard — persistent log of every shell crash ever caused.
 *
 * Deduplicates by normalised message so the same mistake doesn't
 * flood the list — it just increments the count and updates the timestamp.
 */
import { useCallback } from 'react';
import { useLocalStore } from '@reactjit/core';

export interface GraveyardEntry {
  id:        string;
  message:   string;
  firstSeen: number;
  lastSeen:  number;
  count:     number;
}

interface GraveyardStore {
  entries:      GraveyardEntry[];
  totalCrashes: number;
}

const DEFAULT: GraveyardStore = { entries: [], totalCrashes: 0 };
const MAX_ENTRIES = 100;

function normalise(msg: string): string {
  // strip memory addresses / line numbers so the same logical bug dedupes
  return msg.replace(/0x[0-9a-f]+/gi, '0x…').replace(/:\d+:\d+/g, ':L:C').slice(0, 120);
}

export function useErrorGraveyard() {
  const [store, setStore] = useLocalStore<GraveyardStore>('error_graveyard', DEFAULT);

  const logError = useCallback((message: string) => {
    const key  = normalise(message);
    const now  = Date.now();

    setStore(prev => {
      const cur = prev ?? DEFAULT;
      const idx = cur.entries.findIndex(e => normalise(e.message) === key);

      let entries: GraveyardEntry[];
      if (idx >= 0) {
        entries = cur.entries.map((e, i) =>
          i === idx ? { ...e, count: e.count + 1, lastSeen: now } : e,
        );
      } else {
        const fresh: GraveyardEntry = {
          id:        `${now}-${Math.random().toString(36).slice(2, 7)}`,
          message:   message.slice(0, 300),
          firstSeen: now,
          lastSeen:  now,
          count:     1,
        };
        entries = [fresh, ...cur.entries].slice(0, MAX_ENTRIES);
      }

      return { entries, totalCrashes: cur.totalCrashes + 1 };
    });
  }, [setStore]);

  const clearAll = useCallback(() => {
    setStore(DEFAULT);
  }, [setStore]);

  const entries      = store?.entries      ?? [];
  const totalCrashes = store?.totalCrashes ?? 0;

  return { entries, totalCrashes, uniqueErrors: entries.length, logError, clearAll };
}
