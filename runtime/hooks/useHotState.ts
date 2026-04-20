/**
 * useHotState — React state that survives dev-mode hot reloads.
 *
 * In dev mode (`./scripts/dev <cart>`), saving a .tsx file tears down the
 * QuickJS context and re-evals a fresh bundle, which normally wipes all
 * React state. Atoms stored via `useHotState` survive because they're
 * persisted in Zig-owned memory (`framework/hotstate.zig`), outside the
 * JS world that gets torn down.
 *
 * Usage:
 *   const [count, setCount] = useHotState('counter', 0);
 *   setCount((c) => c + 1); // survives the next hot reload
 *
 * Key contract:
 *   - Pick a stable, globally-unique string per atom. Keys live for the whole
 *     process — two components with the same key SHARE state.
 *   - Values must be JSON-serializable. Functions, class instances, DOM refs
 *     will lose their identity on reload.
 *
 * Outside dev mode (`./scripts/ship`), the host functions aren't registered
 * (they still work — this file doesn't gate behavior on dev mode — but the
 * persistence is per-process either way). Functionally behaves as useState.
 */

const React: any = require('react');

type Updater<T> = T | ((prev: T) => T);

export function useHotState<T>(key: string, initial: T): [T, (v: Updater<T>) => void] {
  const [value, setValue] = React.useState<T>(() => {
    const raw = (globalThis as any).__hot_get?.(key);
    if (raw != null) {
      try { return JSON.parse(raw) as T; } catch { /* fall through */ }
    }
    // First time seeing this key — seed the store with the initial value so a
    // hot reload before the first setState still recovers it.
    try { (globalThis as any).__hot_set?.(key, JSON.stringify(initial)); } catch {}
    return initial;
  });

  const set = React.useCallback((updater: Updater<T>) => {
    setValue((prev: T) => {
      const next = typeof updater === 'function' ? (updater as (p: T) => T)(prev) : updater;
      try { (globalThis as any).__hot_set?.(key, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [key]);

  return [value, set];
}

/** Remove a single atom. Equivalent to "forget this key across reloads." */
export function removeHotState(key: string): void {
  (globalThis as any).__hot_remove?.(key);
}

/** Wipe every atom. Useful from a dev-tools "reset state" button. */
export function clearHotState(): void {
  (globalThis as any).__hot_clear?.();
}

/** List all atom keys currently stored. */
export function hotStateKeys(): string[] {
  const raw = (globalThis as any).__hot_keys_json?.();
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}
