/**
 * useAppSearch — live search over the rendered node tree.
 *
 * Queries Lua's search.lua via bridge RPC. The Lua side holds direct node
 * references — no ID lookup, no registration, no stale-ID problem. You get
 * back serialized views that carry the structural path, layout coordinates,
 * and ancestor context for every match.
 *
 * The structural path ("2.0.1") uses the same 0-based child-index addressing
 * the reconciler uses during diffing. Passing it back to `search:navigate`
 * lets Lua resolve directly to the live node: zero indirection.
 *
 * @example
 * const { results, search, navigateTo } = useAppSearch();
 * search('settings');
 * // → results: [{ text: 'Settings', path: '1.2.0', x, y, w, h, context, ... }]
 * navigateTo(results[0]); // Lua scrolls to + highlights the node
 */

import { useState, useCallback, useRef } from 'react';
import { useBridge } from './context';

/** A match from the live node tree returned by `search:query`. */
export interface HotSearchResult {
  /**
   * Structural path: "2.0.1" — dot-separated 0-based child indices from the
   * tree root. Mirrors the reconciler's fiber path. Resolves directly to a
   * live node in Lua via Search.resolvePath() with no lookup table.
   */
  path: string;
  text: string;
  /** Breadcrumb of ancestor component types, innermost first. */
  context: string[];
  /** Set when the match is from a prop (placeholder, label, etc.) rather than a text node. */
  propKey?: string;
  /** 1-based inclusive range of the match within `text`. */
  matchStart: number;
  matchEnd: number;
  /** Layout coordinates of the matching node (absolute, post-layout). */
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * A compile-time entry from `rjit search-index`.
 * Covers stories/screens that haven't been rendered yet (cold search).
 */
export interface ColdSearchEntry {
  /** "file:line:col" — stable across text edits, changes on structural moves. */
  id: string;
  text: string;
  file: string;
  line: number;
  col: number;
  component: string;
  context?: string[];
  /** Story/screen identifier for navigation. */
  storyId?: string;
}

export interface UseAppSearchOptions {
  /** Debounce before firing the bridge RPC. Default: 150ms. */
  debounce?: number;
}

export function useAppSearch(opts: UseAppSearchOptions = {}) {
  const { debounce = 150 } = opts;
  const bridge = useBridge();
  const [results, setResults] = useState<HotSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Fire a debounced search over the live tree. */
  const search = useCallback((q: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!q.trim()) { setResults([]); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await bridge.rpc<HotSearchResult[]>('search:query', { query: q });
        setResults(Array.isArray(res) ? res : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, debounce);
  }, [bridge, debounce]);

  /**
   * Navigate to a hot result: Lua resolves the structural path to a live node,
   * scrolls to make it visible, and flash-highlights it.
   */
  const navigateTo = useCallback((result: HotSearchResult) => {
    bridge.rpc('search:navigate', { path: result.path });
  }, [bridge]);

  /**
   * Navigate by text content — for cold-tier results.
   * After the target story/screen mounts, Lua walks the hot index and
   * navigates to the first node whose text matches exactly.
   */
  const navigateByText = useCallback((text: string) => {
    bridge.rpc('search:navigate', { text });
  }, [bridge]);

  const clear = useCallback(() => {
    setResults([]);
    bridge.rpc('search:clear', {});
  }, [bridge]);

  return { results, loading, search, navigateTo, navigateByText, clear };
}
