/**
 * useUtils.ts — One-liner hook wrappers for lua/utils.lua RPCs.
 *
 * Every export is a hook that calls a Lua RPC via the bridge.
 * No string manipulation, no math, no date parsing, no comparison logic
 * happens in this file. TS declares layout and diffs the tree. Lua does
 * everything else.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLoveRPC } from './hooks';

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
  const rpc = useLoveRPC<string>('utils:nanoid');
  const [value, setValue] = useState<string | null>(null);
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;
    let cancelled = false;
    rpc({ length }).then(v => { if (!cancelled) setValue(v); });
    return () => { cancelled = true; };
  }, [rpc, length]);

  return value;
}

/** Generate a v4 UUID. One-shot, cached. */
export function useUUID(): string | null {
  const rpc = useLoveRPC<string>('utils:uuid');
  const [value, setValue] = useState<string | null>(null);
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;
    let cancelled = false;
    rpc().then(v => { if (!cancelled) setValue(v); });
    return () => { cancelled = true; };
  }, [rpc]);

  return value;
}

// ── Deep Equality ──────────────────────────────────────────

/** Deep-compare two values via Lua. Re-runs when serialized inputs change. */
export function useDeepEqual(a: any, b: any): boolean | null {
  const rpc = useLoveRPC<boolean>('utils:deep_equal');
  const [value, setValue] = useState<boolean | null>(null);
  const argsRef = useRef({ a, b });
  argsRef.current = { a, b };

  const serialized = JSON.stringify([a, b]);

  useEffect(() => {
    let cancelled = false;
    rpc(argsRef.current).then(v => { if (!cancelled) setValue(v); });
    return () => { cancelled = true; };
  }, [rpc, serialized]);

  return value;
}

// ── String Utilities ───────────────────────────────────────

/** Truncate a string to max characters with ellipsis. */
export function useTruncate(str: string, max: number, ellipsis?: string): string | null {
  const rpc = useLoveRPC<string>('utils:truncate');
  const [value, setValue] = useState<string | null>(null);
  const argsRef = useRef({ str, max, ellipsis });
  argsRef.current = { str, max, ellipsis };

  useEffect(() => {
    let cancelled = false;
    rpc(argsRef.current).then(v => { if (!cancelled) setValue(v); });
    return () => { cancelled = true; };
  }, [rpc, str, max, ellipsis]);

  return value;
}

/** Convert a string to a URL-safe slug. */
export function useSlugify(str: string): string | null {
  const rpc = useLoveRPC<string>('utils:slugify');
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    rpc({ str }).then(v => { if (!cancelled) setValue(v); });
    return () => { cancelled = true; };
  }, [rpc, str]);

  return value;
}

/** Convert a string to camelCase. */
export function useCamelCase(str: string): string | null {
  const rpc = useLoveRPC<string>('utils:camel_case');
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    rpc({ str }).then(v => { if (!cancelled) setValue(v); });
    return () => { cancelled = true; };
  }, [rpc, str]);

  return value;
}

/** Convert a string to snake_case. */
export function useSnakeCase(str: string): string | null {
  const rpc = useLoveRPC<string>('utils:snake_case');
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    rpc({ str }).then(v => { if (!cancelled) setValue(v); });
    return () => { cancelled = true; };
  }, [rpc, str]);

  return value;
}

/** Convert a string to kebab-case. */
export function useKebabCase(str: string): string | null {
  const rpc = useLoveRPC<string>('utils:kebab_case');
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    rpc({ str }).then(v => { if (!cancelled) setValue(v); });
    return () => { cancelled = true; };
  }, [rpc, str]);

  return value;
}

/** Convert a string to PascalCase. */
export function usePascalCase(str: string): string | null {
  const rpc = useLoveRPC<string>('utils:pascal_case');
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    rpc({ str }).then(v => { if (!cancelled) setValue(v); });
    return () => { cancelled = true; };
  }, [rpc, str]);

  return value;
}

/** Count-aware singular/plural string. */
export function usePluralize(count: number, singular: string, plural?: string): string | null {
  const rpc = useLoveRPC<string>('utils:pluralize');
  const [value, setValue] = useState<string | null>(null);
  const argsRef = useRef({ count, singular, plural });
  argsRef.current = { count, singular, plural };

  useEffect(() => {
    let cancelled = false;
    rpc(argsRef.current).then(v => { if (!cancelled) setValue(v); });
    return () => { cancelled = true; };
  }, [rpc, count, singular, plural]);

  return value;
}

// ── Date / Time ────────────────────────────────────────────

/** Relative time string ("2 hours ago"). Polls every 15 seconds. */
export function useTimeAgo(timestamp: number): string | null {
  const rpc = useLoveRPC<string>('utils:time_ago');
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      rpc({ timestamp }).then(v => { if (!cancelled) setValue(v); });
    };
    poll();
    const id = setInterval(poll, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, [rpc, timestamp]);

  return value;
}

/** Format a unix timestamp with a strftime pattern. */
export function useFormatDate(timestamp: number, pattern?: string): string | null {
  const rpc = useLoveRPC<string>('utils:format_date');
  const [value, setValue] = useState<string | null>(null);
  const argsRef = useRef({ timestamp, pattern });
  argsRef.current = { timestamp, pattern };

  useEffect(() => {
    let cancelled = false;
    rpc(argsRef.current).then(v => { if (!cancelled) setValue(v); });
    return () => { cancelled = true; };
  }, [rpc, timestamp, pattern]);

  return value;
}

/** Parse a human duration string ("2d", "1h30m") to milliseconds. */
export function useMsParse(str: string): number | null {
  const rpc = useLoveRPC<number>('utils:ms_parse');
  const [value, setValue] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    rpc({ str }).then(v => { if (!cancelled) setValue(v); });
    return () => { cancelled = true; };
  }, [rpc, str]);

  return value;
}

/** Format milliseconds to a human duration string ("1h30m"). */
export function useMsFormat(ms: number): string | null {
  const rpc = useLoveRPC<string>('utils:ms_format');
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    rpc({ ms }).then(v => { if (!cancelled) setValue(v); });
    return () => { cancelled = true; };
  }, [rpc, ms]);

  return value;
}

/** Decompose milliseconds into a structured Duration. */
export function useDuration(ms: number): Duration | null {
  const rpc = useLoveRPC<Duration>('utils:duration');
  const [value, setValue] = useState<Duration | null>(null);

  useEffect(() => {
    let cancelled = false;
    rpc({ ms }).then(v => { if (!cancelled) setValue(v); });
    return () => { cancelled = true; };
  }, [rpc, ms]);

  return value;
}

// ── Safe JSON ──────────────────────────────────────────────

/** JSON encode with graceful handling of cycles, functions, userdata. */
export function useSafeStringify(value: any): string | null {
  const rpc = useLoveRPC<string>('utils:safe_encode');
  const [result, setResult] = useState<string | null>(null);
  const argsRef = useRef({ value });
  argsRef.current = { value };

  // Increment version on every render so the effect always re-fires.
  // We cannot use JSON.stringify as a dep key here — if value has circular
  // refs, that throws before Lua is ever called, defeating the whole purpose.
  const versionRef = useRef(0);
  const version = ++versionRef.current;

  useEffect(() => {
    let cancelled = false;
    rpc(argsRef.current).then(v => { if (!cancelled) setResult(v); });
    return () => { cancelled = true; };
  }, [rpc, version]);

  return result;
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
