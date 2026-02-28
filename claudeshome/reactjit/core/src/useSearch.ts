/**
 * Search hooks for ReactJIT.
 *
 * All hooks are stateless and pure React — they deal with data, not input.
 * Input lifecycle (debouncing, keystrokes) lives in the Lua-owned SearchBar.
 *
 * @example
 * // In-memory fuzzy search
 * const results = useSearch(items, query, { key: 'name' });
 *
 * @example
 * // Async search with local loading state
 * const { results, loading, error } = useAsyncSearch(fetchUsers, query);
 *
 * @example
 * // Command palette
 * const results = useCommandSearch(commands, query);
 *
 * @example
 * // Highlight matching text
 * const parts = useSearchHighlight('Hello world', 'wor');
 * // → [{ text: 'Hello ', match: false }, { text: 'wor', match: true }, { text: 'ld', match: false }]
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocalStore } from './useLocalStore';

// ─── Field auto-detection ─────────────────────────────────────────────────────

/** Keys that are never useful for text search, even if they are strings. */
const SKIP_KEYS = new Set(['id', 'key', 'uuid', 'type', 'kind', 'index', 'href', 'url', 'src', 'path', 'color', 'icon']);

/**
 * Inspect the first item and return all keys whose values are short strings
 * (i.e. likely human-readable text, not IDs or URLs).
 *
 * This is used internally when no `key` is specified, so the search isn't
 * a blind JSON.stringify but targets only the meaningful text fields.
 *
 * @example
 * detectSearchableFields([{ id: 1, name: 'Alice', role: 'Admin', avatar: '…long url…' }])
 * // → ['name', 'role']
 */
export function detectSearchableFields<T>(items: T[]): (keyof T)[] {
  const sample = items[0];
  if (!sample || typeof sample !== 'object') return [];

  const fields: (keyof T)[] = [];
  for (const key of Object.keys(sample as object) as (keyof T)[]) {
    if (SKIP_KEYS.has(String(key))) continue;
    const val = (sample as any)[key];
    // Only string values, not too long (long strings are likely blobs not labels)
    if (typeof val === 'string' && val.length <= 200) {
      fields.push(key);
    }
    // Short numbers are ok (e.g. year, count) but skip big ones
    if (typeof val === 'number' && Math.abs(val) < 1_000_000) {
      fields.push(key);
    }
  }
  return fields;
}

// ─── useSearchSchema ──────────────────────────────────────────────────────────

export interface SearchSchema {
  /** All string/number fields detected on the items. */
  allFields: string[];
  /** The fields currently being searched (from key option, or auto-detected). */
  activeFields: string[];
  /** Human-readable summary, e.g. "Searching: name, description". */
  description: string;
  /** True when fields were auto-detected (no key specified). */
  isAutoDetected: boolean;
}

/**
 * Inspect a data set and return a schema describing what's searchable.
 * Use this to show users what the search is actually matching against.
 *
 * @example
 * const schema = useSearchSchema(users, { key: 'name' });
 * // schema.description → "Searching: name"
 *
 * @example
 * const schema = useSearchSchema(products);
 * // schema.description → "Searching: title, brand, category (auto)"
 * // schema.allFields   → ['title', 'brand', 'category', 'sku', 'description']
 */
export function useSearchSchema<T>(
  items: T[],
  options: Pick<UseSearchOptions<T>, 'key'> = {},
): SearchSchema {
  return useMemo(() => {
    const sample = items[0];
    const allFields = sample
      ? (Object.keys(sample as object) as (keyof T)[])
          .filter((k) => {
            const v = (sample as any)[k];
            return typeof v === 'string' || typeof v === 'number';
          })
          .map(String)
      : [];

    const { key } = options;
    let activeFields: string[];
    let isAutoDetected = false;

    if (key) {
      activeFields = (Array.isArray(key) ? key : [key]).map(String);
    } else {
      activeFields = detectSearchableFields(items).map(String);
      isAutoDetected = true;
    }

    const suffix = isAutoDetected ? ' (auto)' : '';
    const description =
      activeFields.length > 0
        ? `Searching: ${activeFields.join(', ')}${suffix}`
        : 'Nothing searchable detected';

    return { allFields, activeFields, description, isAutoDetected };
  }, [items, options.key]);
}

// ─── Fuzzy scoring ────────────────────────────────────────────────────────────

/**
 * Simple fuzzy score: consecutive character bonus + prefix bonus.
 * Returns 0 if no match, positive number otherwise.
 */
function fuzzyScore(text: string, query: string): number {
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (!q) return 1;
  if (t.includes(q)) return 100 + (t.startsWith(q) ? 50 : 0) - t.length;

  let score = 0;
  let qi = 0;
  let lastMatch = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += 10;
      if (lastMatch === ti - 1) score += 5; // consecutive bonus
      if (ti === 0) score += 20; // start bonus
      lastMatch = ti;
      qi++;
    }
  }
  return qi === q.length ? score : 0;
}

// ─── useSearch ────────────────────────────────────────────────────────────────

export interface UseSearchOptions<T> {
  /** Key(s) of T to search. Provide array to search multiple fields. */
  key?: keyof T | (keyof T)[];
  /** Custom match function. Receives item and lowercase query. */
  matcher?: (item: T, query: string) => boolean;
  /** Max results to return. Default: unlimited. */
  limit?: number;
  /** Minimum query length before results appear. Default: 0. */
  minLength?: number;
  /** Return all items when query is empty. Default: true. */
  showAllOnEmpty?: boolean;
}

/**
 * Synchronous in-memory search.
 * Returns filtered items on every query change. No debounce — use SearchBar's
 * built-in Lua debounce, or call this from an onSearch handler.
 *
 * @example
 * const results = useSearch(users, query, { key: 'name', limit: 10 });
 */
export function useSearch<T>(
  items: T[],
  query: string,
  options: UseSearchOptions<T> = {},
): T[] {
  const { key, matcher, limit, minLength = 0, showAllOnEmpty = true } = options;

  return useMemo(() => {
    const q = query.trim();
    if (q.length < minLength) return showAllOnEmpty ? (limit ? items.slice(0, limit) : items) : [];
    if (!q) return showAllOnEmpty ? (limit ? items.slice(0, limit) : items) : [];

    const lower = q.toLowerCase();

    let filtered: T[];
    if (matcher) {
      filtered = items.filter((item) => matcher(item, lower));
    } else {
      // Resolve which keys to search. If none specified, auto-detect string/number fields.
      const resolvedKeys: (keyof T)[] = key
        ? (Array.isArray(key) ? key : [key])
        : detectSearchableFields(items);
      if (resolvedKeys.length > 0) {
        filtered = items.filter((item) =>
          resolvedKeys.some((k) => String(item[k] ?? '').toLowerCase().includes(lower)),
        );
      } else {
        // Absolute fallback when no fields detected (e.g. primitives array)
        filtered = items.filter((item) =>
          String(item).toLowerCase().includes(lower),
        );
      }
    }

    return limit ? filtered.slice(0, limit) : filtered;
  }, [items, query, key, matcher, limit, minLength, showAllOnEmpty]);
}

// ─── useFuzzySearch ───────────────────────────────────────────────────────────

export interface FuzzySearchResult<T> {
  item: T;
  score: number;
  index: number;
}

export interface UseFuzzySearchOptions<T> extends UseSearchOptions<T> {
  /** Sort by score descending (highest match first). Default: true. */
  sortByScore?: boolean;
  /** Minimum score to include. Default: 1. */
  minScore?: number;
}

/**
 * Fuzzy search with scoring. Results are sorted by match quality.
 *
 * @example
 * const { results } = useFuzzySearch(commands, query, { key: 'label' });
 * results.forEach(({ item, score }) => console.log(item.label, score));
 */
export function useFuzzySearch<T>(
  items: T[],
  query: string,
  options: UseFuzzySearchOptions<T> = {},
): { results: FuzzySearchResult<T>[]; items: T[] } {
  const { key, limit, minLength = 1, showAllOnEmpty = true, sortByScore = true, minScore = 1 } = options;

  return useMemo(() => {
    const q = query.trim();

    if (q.length < minLength) {
      if (!showAllOnEmpty) return { results: [], items: [] };
      const all = limit ? items.slice(0, limit) : items;
      const r: FuzzySearchResult<T>[] = all.map((item, index) => ({ item, score: 0, index }));
      return { results: r, items: all };
    }

    const resolvedKeys: (keyof T)[] = key
      ? (Array.isArray(key) ? key : [key])
      : detectSearchableFields(items);

    const scored: FuzzySearchResult<T>[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let score = 0;
      if (resolvedKeys.length > 0) {
        score = Math.max(...resolvedKeys.map((k) => fuzzyScore(String(item[k] ?? ''), q)));
      } else {
        score = fuzzyScore(String(item), q);
      }
      if (score >= minScore) scored.push({ item, score, index: i });
    }

    if (sortByScore) scored.sort((a, b) => b.score - a.score);
    const limited = limit ? scored.slice(0, limit) : scored;
    return { results: limited, items: limited.map((r) => r.item) };
  }, [items, query, key, limit, minLength, showAllOnEmpty, sortByScore, minScore]);
}

// ─── useAsyncSearch ───────────────────────────────────────────────────────────

export interface UseAsyncSearchOptions {
  /** Debounce in ms (React-side, for cases where Lua debounce isn't used). Default: 0. */
  debounce?: number;
  /** Minimum query length. Default: 1. */
  minLength?: number;
}

/**
 * Async search with loading + error state. Cancels stale requests.
 *
 * Normally you don't need this — SearchBar's Lua debounce handles the
 * per-keystroke case. Use this when the query comes from outside
 * SearchBar (e.g. URL params, programmatic changes).
 *
 * @example
 * const { results, loading, error } = useAsyncSearch(
 *   (q) => fetch(`/api/search?q=${q}`).then(r => r.json()),
 *   query
 * );
 */
export function useAsyncSearch<T>(
  fetcher: (query: string) => Promise<T[]>,
  query: string,
  options: UseAsyncSearchOptions = {},
): { results: T[]; loading: boolean; error: Error | null } {
  const { debounce: debounceMs = 0, minLength = 1 } = options;
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const cancelRef = useRef<() => void>(() => {});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    const q = query.trim();
    if (q.length < minLength) {
      cancelRef.current();
      if (timerRef.current) clearTimeout(timerRef.current);
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    const run = () => {
      let cancelled = false;
      cancelRef.current = () => { cancelled = true; };
      setLoading(true);
      setError(null);

      fetcherRef.current(q)
        .then((res) => {
          if (!cancelled) { setResults(res); setLoading(false); }
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setLoading(false);
          }
        });
    };

    if (debounceMs > 0) {
      timerRef.current = setTimeout(run, debounceMs);
    } else {
      run();
    }

    return () => {
      cancelRef.current();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, minLength, debounceMs]);

  return { results, loading, error };
}

// ─── useSearchHistory ─────────────────────────────────────────────────────────

export interface UseSearchHistoryOptions {
  /** Max entries to persist. Default: 20. */
  maxEntries?: number;
  /** SQLite store key. Default: 'searchHistory'. */
  storeKey?: string;
}

/**
 * Persistent search history backed by SQLite via useLocalStore.
 *
 * @example
 * const { history, push, remove, clear } = useSearchHistory();
 * // After a successful search: push(query)
 * // Render: <SearchResults items={history.map(h => ({ id: h, label: h }))} />
 */
export function useSearchHistory(options: UseSearchHistoryOptions = {}): {
  history: string[];
  push: (query: string) => void;
  remove: (query: string) => void;
  clear: () => void;
} {
  const { maxEntries = 20, storeKey = 'searchHistory' } = options;
  const [history, setHistory] = useLocalStore<string[]>(storeKey, []);

  const push = useCallback(
    (query: string) => {
      const q = query.trim();
      if (!q) return;
      setHistory((prev: string[]) => {
        const without = prev.filter((h) => h !== q);
        return [q, ...without].slice(0, maxEntries);
      });
    },
    [setHistory, maxEntries],
  );

  const remove = useCallback(
    (query: string) => {
      setHistory((prev: string[]) => prev.filter((h) => h !== query));
    },
    [setHistory],
  );

  const clear = useCallback(() => setHistory([]), [setHistory]);

  return { history, push, remove, clear };
}

// ─── useSearchHighlight ───────────────────────────────────────────────────────

export interface HighlightPart {
  text: string;
  match: boolean;
}

/**
 * Split text into highlighted + plain parts for a query.
 * Use with Text components to render matches in a different color.
 *
 * @example
 * const parts = useSearchHighlight('Hello world', 'wor');
 * // renders: "Hello " + <match>"wor"</match> + "ld"
 */
export function useSearchHighlight(text: string, query: string): HighlightPart[] {
  return useMemo(() => {
    const q = query.trim();
    if (!q || !text) return [{ text, match: false }];

    const lower = text.toLowerCase();
    const lq = q.toLowerCase();
    const parts: HighlightPart[] = [];
    let pos = 0;

    while (pos < text.length) {
      const idx = lower.indexOf(lq, pos);
      if (idx === -1) {
        parts.push({ text: text.slice(pos), match: false });
        break;
      }
      if (idx > pos) parts.push({ text: text.slice(pos, idx), match: false });
      parts.push({ text: text.slice(idx, idx + q.length), match: true });
      pos = idx + q.length;
    }

    return parts;
  }, [text, query]);
}

// ─── useCommandSearch ─────────────────────────────────────────────────────────

import type { CommandDef } from './search/CommandPalette';

export interface UseCommandSearchOptions {
  /** Max results. Default: unlimited. */
  limit?: number;
}

/**
 * Filter and fuzzy-rank commands for a CommandPalette.
 *
 * @example
 * const filtered = useCommandSearch(commands, query);
 * // Pass filtered directly to CommandPalette items or SearchResults
 */
export function useCommandSearch(
  commands: CommandDef[],
  query: string,
  options: UseCommandSearchOptions = {},
): CommandDef[] {
  const { limit } = options;

  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return limit ? commands.slice(0, limit) : commands;

    const scored = commands
      .map((cmd) => {
        const labelScore = fuzzyScore(cmd.label, q);
        const groupScore = cmd.group ? fuzzyScore(cmd.group, q) * 0.5 : 0;
        const kwScore = (cmd.keywords ?? []).reduce(
          (best, k) => Math.max(best, fuzzyScore(k, q) * 0.8),
          0,
        );
        return { cmd, score: Math.max(labelScore, groupScore, kwScore) };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((s) => s.cmd);

    return limit ? scored.slice(0, limit) : scored;
  }, [commands, query, limit]);
}
