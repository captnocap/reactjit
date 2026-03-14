/**
 * useUtils.ts — One-liner hook wrappers for lua/utils.lua RPCs.
 *
 * Every export is a hook that calls a Lua RPC via the bridge.
 * No string manipulation, no math, no date parsing, no comparison logic
 * happens in this file. TS declares layout and diffs the tree. Lua does
 * everything else.
 */

import { useState, useRef, useCallback } from 'react';
import { useLoveRPC, useLuaInterval } from './hooks';
import { useLuaQuery } from './useLuaEffect';

// ── Types ──────────────────────────────────────────────────

export type Duration = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
};

// ── ID Generation ──────────────────────────────────────────

/** Generate a URL-safe alphanumeric ID. One-shot, cached. */
export function useId(length?: number): string | null {
  const { data } = useLuaQuery<string>('utils:nanoid', { length }, []);
  return data;
}

/** Generate a v4 UUID. One-shot, cached. */
export function useUUID(): string | null {
  const { data } = useLuaQuery<string>('utils:uuid', {}, []);
  return data;
}

// ── Deep Equality ──────────────────────────────────────────

/** Deep-compare two values via Lua. Re-runs when serialized inputs change. */
export function useDeepEqual(a: any, b: any): boolean | null {
  const serialized = JSON.stringify([a, b]);
  const { data } = useLuaQuery<boolean>('utils:deep_equal', { a, b }, [serialized]);
  return data;
}

// ── String Utilities ───────────────────────────────────────

/** Truncate a string to max characters with ellipsis. */
export function useTruncate(str: string, max: number, ellipsis?: string): string | null {
  const { data } = useLuaQuery<string>('utils:truncate', { str, max, ellipsis }, [str, max, ellipsis]);
  return data;
}

/** Convert a string to a URL-safe slug. */
export function useSlugify(str: string): string | null {
  const { data } = useLuaQuery<string>('utils:slugify', { str }, [str]);
  return data;
}

/** Convert a string to camelCase. */
export function useCamelCase(str: string): string | null {
  const { data } = useLuaQuery<string>('utils:camel_case', { str }, [str]);
  return data;
}

/** Convert a string to snake_case. */
export function useSnakeCase(str: string): string | null {
  const { data } = useLuaQuery<string>('utils:snake_case', { str }, [str]);
  return data;
}

/** Convert a string to kebab-case. */
export function useKebabCase(str: string): string | null {
  const { data } = useLuaQuery<string>('utils:kebab_case', { str }, [str]);
  return data;
}

/** Convert a string to PascalCase. */
export function usePascalCase(str: string): string | null {
  const { data } = useLuaQuery<string>('utils:pascal_case', { str }, [str]);
  return data;
}

/** Count-aware singular/plural string. */
export function usePluralize(count: number, singular: string, plural?: string): string | null {
  const { data } = useLuaQuery<string>('utils:pluralize', { count, singular, plural }, [count, singular, plural]);
  return data;
}

// ── Date / Time ────────────────────────────────────────────

/** Relative time string ("2 hours ago"). Polls every 15 seconds. */
export function useTimeAgo(timestamp: number): string | null {
  const { data, refetch } = useLuaQuery<string>('utils:time_ago', { timestamp }, [timestamp]);
  useLuaInterval(15000, refetch);
  return data;
}

/** Format a unix timestamp with a strftime pattern. */
export function useFormatDate(timestamp: number, pattern?: string): string | null {
  const { data } = useLuaQuery<string>('utils:format_date', { timestamp, pattern }, [timestamp, pattern]);
  return data;
}

/** Parse a human duration string ("2d", "1h30m") to milliseconds. */
export function useMsParse(str: string): number | null {
  const { data } = useLuaQuery<number>('utils:ms_parse', { str }, [str]);
  return data;
}

/** Format milliseconds to a human duration string ("1h30m"). */
export function useMsFormat(ms: number): string | null {
  const { data } = useLuaQuery<string>('utils:ms_format', { ms }, [ms]);
  return data;
}

/** Decompose milliseconds into a structured Duration. */
export function useDuration(ms: number): Duration | null {
  const { data } = useLuaQuery<Duration>('utils:duration', { ms }, [ms]);
  return data;
}

// ── Safe JSON ──────────────────────────────────────────────

/** JSON encode with graceful handling of cycles, functions, userdata. */
export function useSafeStringify(value: any): string | null {
  // Increment version on every render so the query always re-fires.
  // We cannot use JSON.stringify as a dep key here — if value has circular
  // refs, that throws before Lua is ever called, defeating the whole purpose.
  const versionRef = useRef(0);
  const version = ++versionRef.current;
  const { data } = useLuaQuery<string>('utils:safe_encode', { value }, [version]);
  return data;
}

// ── Batch Dispatch ─────────────────────────────────────────

interface UtilsPoolEntry {
  op: string;
  args: Record<string, any>;
}

interface UtilsPool {
  enqueue: (op: string, args: Record<string, any>) => number;
  result: (id: number) => any;
  results: Record<number, any>;
  flush: () => void;
}

/** Batch multiple utils RPCs into a single bridge call. */
export function useUtilsBatch(): UtilsPool {
  const rpc = useLoveRPC<Record<string, any>[]>('utils:batch');
  const queueRef = useRef<UtilsPoolEntry[]>([]);
  const idCounterRef = useRef(0);
  const [results, setResults] = useState<Record<number, any>>({});

  const enqueue = useCallback((op: string, args: Record<string, any>) => {
    const id = idCounterRef.current++;
    queueRef.current.push({ op, args });
    return id;
  }, []);

  const flush = useCallback(() => {
    const queue = queueRef.current;
    if (queue.length === 0) return;
    const ops = [...queue];
    const startId = idCounterRef.current - queue.length;
    queueRef.current = [];

    rpc({ ops }).then(res => {
      if (!res) return;
      const next: Record<number, any> = {};
      for (let i = 0; i < res.length; i++) {
        next[startId + i] = res[i];
      }
      setResults(next);
    });
  }, [rpc]);

  const result = useCallback((id: number) => results[id], [results]);

  return { enqueue, result, results, flush };
}
