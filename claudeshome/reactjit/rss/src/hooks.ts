/**
 * RSS React hooks — one-liner subscription to any RSS/Atom feed.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLuaInterval } from '@reactjit/core';
import { parseFeed } from './parser';
import type { Feed, FeedItem, RSSFeedOptions, RSSFeedResult, RSSAggregateOptions, RSSAggregateResult } from './types';

// ── Core: useRSSFeed ────────────────────────────────────

/**
 * Subscribe to an RSS/Atom feed. One-liner.
 *
 * @example
 * const { items, feed, loading } = useRSSFeed('https://hnrss.org/frontpage');
 *
 * @example
 * // With polling every 60 seconds
 * const { items } = useRSSFeed('https://blog.example.com/feed.xml', { interval: 60000 });
 *
 * @example
 * // With CORS proxy for web target
 * const { items } = useRSSFeed(url, { corsProxy: 'https://corsproxy.io/?' });
 */
export function useRSSFeed(
  url: string | null,
  options?: RSSFeedOptions,
): RSSFeedResult {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(url != null);
  const [tick, setTick] = useState(0);
  const seenIds = useRef(new Set<string>());
  const optsRef = useRef(options);
  optsRef.current = options;

  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    if (!url) {
      setFeed(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const opts = optsRef.current;
    const fetchUrl = opts?.corsProxy ? opts.corsProxy + encodeURIComponent(url) : url;

    fetch(fetchUrl)
      .then((res: any) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((xml: string) => {
        if (cancelled) return;

        const parsed = parseFeed(xml);
        const dedupe = opts?.dedupe !== false;

        let items = parsed.items;

        // Deduplicate
        if (dedupe) {
          const newItems: FeedItem[] = [];
          for (const item of items) {
            if (!seenIds.current.has(item.id)) {
              seenIds.current.add(item.id);
              newItems.push(item);
            }
          }
          // On first load, keep all items; on subsequent, only new ones merge in
          if (feed) {
            items = [...newItems, ...feed.items];
          } else {
            items = parsed.items; // First load: keep all
            for (const item of items) seenIds.current.add(item.id);
          }
        }

        // Limit
        if (opts?.limit && items.length > opts.limit) {
          items = items.slice(0, opts.limit);
        }

        setFeed({ ...parsed, items });
        setLoading(false);
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [url, tick]);

  // Polling driven by Lua-side timer
  useLuaInterval(url ? options?.interval : null, refetch);

  return {
    feed,
    items: feed?.items ?? [],
    loading,
    error,
    refetch,
  };
}

// ── Aggregate: useRSSAggregate ──────────────────────────

/**
 * Subscribe to multiple feeds and get a merged, sorted item list.
 *
 * @example
 * const { items, feeds } = useRSSAggregate([
 *   'https://hnrss.org/frontpage',
 *   'https://lobste.rs/rss',
 *   'https://www.reddit.com/r/programming/.rss',
 * ], { interval: 120000, limit: 50 });
 */
export function useRSSAggregate(
  urls: string[],
  options?: RSSAggregateOptions,
): RSSAggregateResult {
  const [feedResults, setFeedResults] = useState<Map<string, { feed: Feed | null; error: Error | null }>>(new Map());
  const [loading, setLoading] = useState(urls.length > 0);
  const [tick, setTick] = useState(0);
  const optsRef = useRef(options);
  optsRef.current = options;

  const refetch = useCallback(() => setTick(t => t + 1), []);

  // Serialize urls for dependency
  const urlsKey = urls.join('\n');

  useEffect(() => {
    if (urls.length === 0) {
      setFeedResults(new Map());
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const opts = optsRef.current;

    Promise.allSettled(
      urls.map(async (url) => {
        const fetchUrl = opts?.corsProxy ? opts.corsProxy + encodeURIComponent(url) : url;
        const res: any = await fetch(fetchUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const xml = await res.text();
        return { url, feed: parseFeed(xml) };
      }),
    ).then((results) => {
      if (cancelled) return;

      const newMap = new Map<string, { feed: Feed | null; error: Error | null }>();
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const url = urls[i];
        if (result.status === 'fulfilled') {
          newMap.set(url, { feed: result.value.feed, error: null });
        } else {
          newMap.set(url, { feed: null, error: result.reason instanceof Error ? result.reason : new Error(String(result.reason)) });
        }
      }
      setFeedResults(newMap);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [urlsKey, tick]);

  // Polling driven by Lua-side timer
  useLuaInterval(urls.length > 0 ? options?.interval : null, refetch);

  // Merge and sort items from all feeds
  const allItems: Array<FeedItem & { feedTitle: string; feedUrl: string }> = [];
  const feeds: Array<{ url: string; feed: Feed | null; error: Error | null }> = [];

  for (const [url, result] of feedResults) {
    feeds.push({ url, ...result });
    if (result.feed) {
      for (const item of result.feed.items) {
        allItems.push({ ...item, feedTitle: result.feed.title, feedUrl: url });
      }
    }
  }

  // Sort by pubDate descending (newest first)
  allItems.sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return db - da;
  });

  // Limit
  const limit = options?.limit;
  const items = limit ? allItems.slice(0, limit) : allItems;

  return { items, feeds, loading, refetch };
}

// ── Imperative: fetchFeed ───────────────────────────────

/**
 * Fetch and parse a feed outside of React (imperative).
 *
 * @example
 * const feed = await fetchFeed('https://hnrss.org/frontpage');
 * console.log(feed.items[0].title);
 */
export async function fetchFeed(url: string, corsProxy?: string): Promise<Feed> {
  const fetchUrl = corsProxy ? corsProxy + encodeURIComponent(url) : url;
  const res: any = await fetch(fetchUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  return parseFeed(xml);
}
