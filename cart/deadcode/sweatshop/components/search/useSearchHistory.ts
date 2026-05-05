// Recent-queries store. Persisted via __store_* with localStorage fallback so
// history survives reloads. Capped to 40 entries; most-recent first.


const STORE_KEY = 'sweatshop.search.history.v1';
const MAX_ENTRIES = 40;

export interface HistoryEntry {
  q: string;
  t: number;
  hits?: number;
}

function read(): HistoryEntry[] {
  try {
    const g: any = globalThis as any;
    const raw = typeof g.__store_get === 'function'
      ? g.__store_get(STORE_KEY)
      : (typeof g.localStorage !== 'undefined' ? g.localStorage.getItem(STORE_KEY) : null);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) { return []; }
}

function write(entries: HistoryEntry[]) {
  try {
    const g: any = globalThis as any;
    const raw = JSON.stringify(entries);
    if (typeof g.__store_set === 'function') g.__store_set(STORE_KEY, raw);
    else if (typeof g.localStorage !== 'undefined') g.localStorage.setItem(STORE_KEY, raw);
  } catch (_) {}
}

export interface SearchHistoryApi {
  entries: HistoryEntry[];
  push: (q: string, hits?: number) => void;
  remove: (q: string) => void;
  clear: () => void;
}

export function useSearchHistory(): SearchHistoryApi {
  const [entries, setEntries] = useState<HistoryEntry[]>(() => read());

  useEffect(() => { write(entries); }, [entries]);

  const push = useCallback((q: string, hits?: number) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setEntries((prev: HistoryEntry[]) => {
      const filtered = prev.filter((e) => e.q !== trimmed);
      const next = [{ q: trimmed, t: Date.now(), hits }, ...filtered];
      if (next.length > MAX_ENTRIES) next.length = MAX_ENTRIES;
      return next;
    });
  }, []);

  const remove = useCallback((q: string) => {
    setEntries((prev: HistoryEntry[]) => prev.filter((e) => e.q !== q));
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  return { entries, push, remove, clear };
}
