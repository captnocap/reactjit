/**
 * useLatch — read a Lua-owned animated value directly into style.
 *
 * Latches are numeric values written by Lua capabilities in their tick()
 * function and pushed to JS once per frame as a batched latches:frame event.
 * The value flows straight into a style prop — no JS math in between.
 *
 * Contract: latch → style. Nothing else between them.
 *
 * @example
 * // Lua (capability tick):
 * //   Latches.set("my-cap:42:x", 120.5)
 *
 * // React:
 * const x = useLatch("my-cap:42:x");
 * <Box style={{ left: x }} />
 */

import { useState, useEffect } from 'react';

// Global store: key -> current value
const store = new Map<string, number>();

// Per-key subscriber sets: key -> Set of setValue callbacks
const subscribers = new Map<string, Set<(value: number) => void>>();

/**
 * Apply a batch of latch updates from a latches:frame bridge event.
 * Called by NativeBridge — not for direct use.
 */
export function applyLatchFrame(updates: Record<string, number>): void {
  for (const key of Object.keys(updates)) {
    const value = updates[key];
    store.set(key, value);
    subscribers.get(key)?.forEach(fn => fn(value));
  }
}

/**
 * Read a Lua latch value. Re-renders only when Lua updates this specific key.
 * @param key      The latch key written by the Lua capability
 * @param defaultValue  Returned before Lua has written the first value
 */
export function useLatch(key: string, defaultValue = 0): number {
  const [value, setValue] = useState<number>(() => store.get(key) ?? defaultValue);

  // rjit-ignore-next-line — Framework primitive: useLatch subscribes to latch value updates by key
  useEffect(() => {
    // Sync with any value already in the store from before mount
    const current = store.get(key);
    if (current !== undefined) setValue(current);

    // Subscribe to future updates for this key
    if (!subscribers.has(key)) subscribers.set(key, new Set());
    subscribers.get(key)!.add(setValue);

    return () => {
      subscribers.get(key)?.delete(setValue);
    };
  }, [key]);

  return value;
}
