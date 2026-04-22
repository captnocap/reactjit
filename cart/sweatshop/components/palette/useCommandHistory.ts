import { useRef } from 'react';
import { PaletteCommand } from './types';

const host: any = globalThis;
const storeGet = typeof host.__store_get === 'function' ? host.__store_get : (_: string) => null;
const storeSet = typeof host.__store_set === 'function' ? host.__store_set : (_: string, __: string) => {};

const RECENT_KEY = 'sweatshop.palette.recent';
const HISTORY_KEY = 'sweatshop.palette.history';
const MAX_RECENT = 10;
const MAX_HISTORY = 20;

function loadRecent(): string[] {
  try {
    const raw = storeGet(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.slice(0, MAX_RECENT);
  } catch {}
  return [];
}

function saveRecent(ids: string[]) {
  try { storeSet(RECENT_KEY, JSON.stringify(ids.slice(0, MAX_RECENT))); } catch {}
}

function pushRecent(ids: string[], id: string): string[] {
  return [id, ...ids.filter((x) => x !== id)].slice(0, MAX_RECENT);
}

type HistoryEntry = { id: string; label: string; category?: string };

function loadHistory(): HistoryEntry[] {
  try {
    const raw = storeGet(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.slice(0, MAX_HISTORY);
  } catch {}
  return [];
}

function saveHistory(history: HistoryEntry[]) {
  try { storeSet(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY))); } catch {}
}

function pushHistory(history: HistoryEntry[], cmd: PaletteCommand): HistoryEntry[] {
  const entry: HistoryEntry = { id: cmd.id, label: cmd.label, category: cmd.category };
  return [entry, ...history.filter((h) => h.id !== cmd.id)].slice(0, MAX_HISTORY);
}

export function useCommandHistory() {
  const recentRef = useRef<string[]>(loadRecent());
  const historyRef = useRef<HistoryEntry[]>(loadHistory());

  const record = (cmd: PaletteCommand) => {
    recentRef.current = pushRecent(recentRef.current, cmd.id);
    saveRecent(recentRef.current);
    historyRef.current = pushHistory(historyRef.current, cmd);
    saveHistory(historyRef.current);
  };

  const buildRecentCommands = (all: PaletteCommand[]): PaletteCommand[] => {
    const set = new Set(recentRef.current);
    const recent = all.filter((c) => set.has(c.id));
    const orderMap = new Map(recentRef.current.map((id, i) => [id, i]));
    recent.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
    return recent.map((cmd) => ({ ...cmd, category: 'Recent' }));
  };

  const buildHistoryCommands = (all: PaletteCommand[]): PaletteCommand[] => {
    const recentIds = new Set(recentRef.current);
    const out: PaletteCommand[] = [];
    for (const entry of historyRef.current) {
      if (recentIds.has(entry.id)) continue;
      const live = all.find((c) => c.id === entry.id);
      if (live) {
        out.push({ ...live, category: 'History' });
      } else {
        out.push({
          id: 'history.' + entry.id,
          label: entry.label,
          category: 'History',
          action: () => console.log('[palette] History command unavailable: ' + entry.label),
        });
      }
    }
    return out;
  };

  return { record, buildRecentCommands, buildHistoryCommands };
}
