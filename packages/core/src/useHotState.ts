/**
 * useHotState — useState that survives HMR.
 *
 * Drop-in replacement for useState. State lives in a Lua memory table that
 * persists across hot reloads (Lua process is never killed during HMR —
 * only the QuickJS JS context is destroyed and recreated).
 *
 * On HMR, the reload path injects all atoms into globalThis.__hotstateCache
 * before the new bundle evaluates. This hook reads from that cache
 * synchronously on first render — zero flash, zero async delay.
 *
 * Unlike useLocalStore (SQLite-backed, survives app restarts), useHotState
 * lives purely in memory. It survives HMR but NOT app restarts. Use it for
 * ephemeral UI state (sidebar open, scroll position, selected tab) that
 * you don't want to lose on every code change.
 *
 * @example
 * const [sidebar, setSidebar] = useHotState('sidebar', true);
 * const [tab, setTab] = useHotState('settings.tab', 'general');
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useBridgeOptional } from './context';

type SetStateAction<T> = T | ((prev: T) => T);

// Cache injected by Lua reload path before bundle eval.
// Read once synchronously, then cleared.
declare global {
  var __hotstateCache: Record<string, any> | undefined;
}

/** Read from the injection cache (synchronous, first-render only). */
function readCache<T>(key: string): T | undefined {
  if (globalThis.__hotstateCache && key in globalThis.__hotstateCache) {
    return globalThis.__hotstateCache[key] as T;
  }
  return undefined;
}

export function useHotState<T>(
  key: string,
  defaultValue: T,
): [T, (value: SetStateAction<T>) => void] {
  const bridge = useBridgeOptional();

  // On first render: check injection cache (synchronous — zero flash)
  const [value, setValueState] = useState<T>(() => {
    const cached = readCache<T>(key);
    return cached !== undefined ? cached : defaultValue;
  });

  const valueRef = useRef<T>(value);
  valueRef.current = value;

  // On mount: write initial value to Lua so it's tracked for next HMR.
  // If we restored from cache, this re-persists the cached value.
  // If fresh start, this seeds the atom with the default.
  useEffect(() => {
    if (!bridge) return;
    bridge.rpc('hotstate:set', { key, value: valueRef.current }).catch(() => {});
  }, [bridge, key]);

  const setValue = useCallback(
    (action: SetStateAction<T>) => {
      const next =
        typeof action === 'function'
          ? (action as (prev: T) => T)(valueRef.current)
          : action;
      valueRef.current = next;
      setValueState(next);
      // Write to Lua immediately — no debounce, it's just a memory table
      if (bridge) {
        bridge.rpc('hotstate:set', { key, value: next }).catch(() => {});
      }
    },
    [bridge, key],
  );

  return [value, setValue];
}
