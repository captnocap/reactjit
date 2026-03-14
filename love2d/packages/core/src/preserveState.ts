/**
 * preserveState — auto-intercept React.useState to survive HMR.
 *
 * When enabled, patches React.useState so every call automatically
 * syncs its value to Lua hotstate atoms. On HMR, the Lua atoms persist
 * and values are restored from globalThis.__hotstateCache.
 *
 * CRITICAL CONSTRAINT: preservedUseState must call EXACTLY ONE hook
 * (the original useState). Adding useRef/useEffect/useCallback would
 * change the hook count and break React's rules of hooks when the
 * patch enables mid-lifecycle.
 *
 * Keys are auto-generated from component name + hook call index.
 *
 * Opt out per-call:
 *   const [x, setX] = useState.volatile(0);
 */

import React from 'react';

// ── State ─────────────────────────────────────────────────

let _enabled = false;
let _original: typeof React.useState | null = null;
let _bridge: any = null;

// Per-render hook index tracking
let _hookIndex = 0;
let _lastFiber: any = null;

// ── Key generation ────────────────────────────────────────

function autoKey(): string {
  const internals = (React as any)
    .__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
  const fiber = internals?.ReactCurrentOwner?.current;

  // Reset counter when we enter a new component's render
  if (fiber !== _lastFiber) {
    _lastFiber = fiber;
    _hookIndex = 0;
  }

  const name =
    fiber?.type?.name ||
    fiber?.type?.displayName ||
    'Anon';
  const idx = _hookIndex++;
  return `__auto__${name}__${idx}`;
}

// ── Cache read (synchronous, from Lua injection) ──────────

function readCache<T>(key: string): T | undefined {
  if (globalThis.__hotstateCache && key in globalThis.__hotstateCache) {
    return globalThis.__hotstateCache[key] as T;
  }
  return undefined;
}

// ── Patched useState ──────────────────────────────────────
// EXACTLY ONE hook call (original useState). Nothing else.
// Lua sync happens via microtask — no useEffect needed.

function preservedUseState<T>(initialState: T | (() => T)): [T, React.Dispatch<React.SetStateAction<T>>] {
  const key = autoKey();
  const original = _original!;

  // Resolve initial value (support lazy initializer)
  const resolvedDefault = typeof initialState === 'function'
    ? (initialState as () => T)()
    : initialState;

  // On first render after HMR: read from Lua injection cache
  const cached = readCache<T>(key);
  const [value, setValueRaw] = original(cached !== undefined ? cached : resolvedDefault);

  // Sync current value to Lua via microtask (no useEffect — can't add hooks).
  // This fires on every render, but the RPC is cheap (Lua memory write).
  if (_bridge) {
    Promise.resolve().then(() => {
      _bridge.rpc('hotstate:set', { key, value }).catch(() => {});
    });
  }

  // Wrapped setter: update React state + sync to Lua.
  // Uses functional updater so we always get the latest value
  // without needing useRef.
  // Not memoized (can't use useCallback — that's a hook), but
  // React's own setter is stable, and ours wraps it consistently.
  const setValue = (action: React.SetStateAction<T>) => {
    setValueRaw((prev: T) => {
      const next = typeof action === 'function'
        ? (action as (prev: T) => T)(prev)
        : action;
      if (_bridge) {
        Promise.resolve().then(() => {
          _bridge.rpc('hotstate:set', { key, value: next }).catch(() => {});
        });
      }
      return next;
    });
  };

  return [value, setValue];
}

// Volatile escape hatch — calls original useState, no preservation
preservedUseState.volatile = function<T>(initialState: T | (() => T)): [T, React.Dispatch<React.SetStateAction<T>>] {
  // Still advance the hook index to keep keys stable for subsequent calls
  _hookIndex++;
  return _original!(initialState);
};

// ── Public API ────────────────────────────────────────────

/**
 * Enable automatic state preservation for all useState calls.
 * Call this BEFORE any React component renders (e.g., in createLove2DApp).
 */
export function enableStatePreservation(bridge: any): void {
  if (_enabled) return;
  _enabled = true;
  _bridge = bridge;
  _original = React.useState;
  (React as any).useState = preservedUseState;
}

/**
 * Disable automatic state preservation. Restores original useState.
 */
export function disableStatePreservation(): void {
  if (!_enabled || !_original) return;
  _enabled = false;
  (React as any).useState = _original;
  _original = null;
  _bridge = null;
}

/**
 * Check if state preservation is currently enabled.
 */
export function isStatePreservationEnabled(): boolean {
  return _enabled;
}

/**
 * Update the bridge reference (needed after HMR recreates the bridge).
 */
export function setPreservationBridge(bridge: any): void {
  _bridge = bridge;
}

/**
 * Get the original (unpatched) useState.
 * Framework hooks (useHotState, useLocalStore) should use this
 * to avoid double-preservation.
 */
export function getOriginalUseState(): typeof React.useState {
  return _original || React.useState;
}
