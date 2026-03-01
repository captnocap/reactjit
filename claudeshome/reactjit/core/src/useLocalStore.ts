/**
 * useLocalStore — persistent useState backed by SQLite local storage.
 *
 * Works like useState but survives app restarts. Values are stored in a
 * namespaced SQLite database on the Lua side (localstore.db).
 *
 * @example
 * const [count, setCount] = useLocalStore('counter', 0);
 * const [theme, setTheme] = useLocalStore('selected', 'catppuccin', { namespace: 'theme' });
 */

import { useEffect, useCallback, useRef } from 'react';
import { useBridgeOptional } from './context';
import type { IBridge } from './bridge';
import { getOriginalUseState } from './preserveState';

export interface UseLocalStoreOptions {
  /** Storage namespace. Defaults to 'app'. */
  namespace?: string;
}

type SetStateAction<T> = T | ((prev: T) => T);

export function useLocalStore<T>(
  key: string,
  defaultValue: T,
  options?: UseLocalStoreOptions,
): [T, (value: SetStateAction<T>) => void] {
  const bridge = useBridgeOptional();
  const namespace = options?.namespace ?? 'app';
  const useState = getOriginalUseState();
  const [value, setValueState] = useState<T>(defaultValue);
  const valueRef = useRef<T>(defaultValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bridgeRef = useRef<IBridge | null>(bridge);
  bridgeRef.current = bridge;

  // Load stored value on mount
  useEffect(() => {
    if (!bridge) return;

    bridge
      .rpc<T | null>('localstore:get', { namespace, key })
      .then((stored) => {
        if (stored != null) {
          valueRef.current = stored;
          setValueState(stored);
        }
      })
      .catch(() => {}); // silent fail — use default
  }, [bridge, namespace, key]);

  // Persist to SQLite (debounced)
  const persist = useCallback(
    (val: T) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (bridgeRef.current) {
          bridgeRef.current
            .rpc('localstore:set', { namespace, key, value: val })
            .catch(() => {});
        }
      }, 300);
    },
    [namespace, key],
  );

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const setValue = useCallback(
    (action: SetStateAction<T>) => {
      const next =
        typeof action === 'function'
          ? (action as (prev: T) => T)(valueRef.current)
          : action;
      valueRef.current = next;
      setValueState(next);
      persist(next);
    },
    [persist],
  );

  return [value, setValue];
}
