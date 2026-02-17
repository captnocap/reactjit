/**
 * Base utilities for all API hooks.
 * Provides useAPI (reactive fetching with polling) and useAPIMutation (imperative calls).
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ── Result types ────────────────────────────────────────

export interface APIResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export interface APIOptions {
  headers?: Record<string, string>;
  interval?: number;
}

// ── Reactive data hook ──────────────────────────────────

export function useAPI<T = any>(
  url: string | null,
  options?: APIOptions,
): APIResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(url != null);
  const [tick, setTick] = useState(0);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    if (url == null) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const init: RequestInit = {};
    if (optionsRef.current?.headers) init.headers = optionsRef.current.headers;

    fetch(url, init)
      .then((res: any) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const ct = res.headers?.get?.('content-type') || '';
        if (ct.includes('application/json')) return res.json();
        return res.text().then((t: string) => {
          try { return JSON.parse(t); } catch { return t; }
        });
      })
      .then((result: any) => {
        if (!cancelled) { setData(result); setLoading(false); }
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [url, tick]);

  useEffect(() => {
    const interval = options?.interval;
    if (!interval || !url) return;
    const id = setInterval(() => setTick(t => t + 1), interval);
    return () => clearInterval(id);
  }, [url, options?.interval]);

  return { data, error, loading, refetch };
}

// ── Mutation hook ───────────────────────────────────────

export function useAPIMutation<TResponse = any>(
  headers?: Record<string, string>,
): {
  execute: (url: string, options?: { method?: string; body?: any; headers?: Record<string, string> }) => Promise<TResponse>;
  loading: boolean;
  error: Error | null;
  data: TResponse | null;
} {
  const [data, setData] = useState<TResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  const headersRef = useRef(headers);
  headersRef.current = headers;

  const execute = useCallback(async (
    url: string,
    options?: { method?: string; body?: any; headers?: Record<string, string> },
  ): Promise<TResponse> => {
    setLoading(true);
    setError(null);
    try {
      const init: RequestInit = {
        method: options?.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headersRef.current,
          ...options?.headers,
        },
      };
      if (options?.body !== undefined) {
        init.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      }
      const res: any = await fetch(url, init);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setLoading(false);
      return json;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      setLoading(false);
      throw e;
    }
  }, []);

  return { execute, loading, error, data };
}

// ── Helpers ─────────────────────────────────────────────

export function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const entries = Object.entries(params)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return entries.length ? '?' + entries.join('&') : '';
}
