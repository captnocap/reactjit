/**
 * useLuaEffect — Lua-managed effect lifecycle (replaces useEffect)
 *
 * React's useEffect runs in the commit phase — async, batched, not frame-synced.
 * In ReactJIT, ALL side effects run in Lua's love.update(dt) loop for
 * frame-perfect timing and zero JS event loop jitter.
 *
 * This module provides:
 *   useLuaEffect()  — register a Lua-managed effect with lifecycle
 *   useMount()      — run code on mount, cleanup on unmount
 *   useLuaQuery()   — fetch data via RPC with loading/error state
 *
 * IMPORTANT: Raw useEffect is BANNED in user code (enforced by rjit lint).
 * Use these hooks or purpose-built hooks like useLoveEvent, useLuaInterval,
 * useHotkey, useHotState, useLocalStore instead.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useBridge } from './context';

// ── ID generation ──────────────────────────────────────────────

let _effectCounter = 0;

function useStableId(): string {
  const ref = useRef<string | null>(null);
  if (ref.current === null) {
    ref.current = `eff_${++_effectCounter}_${Date.now().toString(36)}`;
  }
  return ref.current;
}

// ── useLuaEffect ───────────────────────────────────────────────

/**
 * Effect types supported by the Lua managed effects system.
 *
 * - timer: accumulate dt, fire callback at interval (replaces setInterval)
 * - poll:  signal to re-fetch at interval (replaces polling patterns)
 * - tick:  per-frame event with dt (replaces requestAnimationFrame)
 * - mount: fire once on register (replaces useEffect(() => {...}, []))
 */
export type LuaEffectType = 'timer' | 'poll' | 'tick' | 'mount';

export interface LuaEffectConfig {
  /** Effect type — determines lifecycle behavior */
  type: LuaEffectType;
  /** Interval in ms (for timer and poll types) */
  interval?: number;
  /** Fire every N frames (for tick type, default 1) */
  every?: number;
}

/**
 * Register a Lua-managed effect. The effect lifecycle (setup, tick, cleanup)
 * runs in Lua's love.update(dt) loop — frame-perfect, zero JS jitter.
 *
 * @param config  Effect descriptor (type + type-specific options)
 * @param handler Called when the effect fires (timer tick, poll signal, frame tick)
 * @param deps    Dependency array — effect re-registers when deps change
 *
 * @example
 * // Timer (replaces setInterval)
 * useLuaEffect({ type: 'timer', interval: 1000 }, () => {
 *   setCount(c => c + 1);
 * }, []);
 *
 * @example
 * // Per-frame tick (replaces requestAnimationFrame)
 * useLuaEffect({ type: 'tick' }, (payload) => {
 *   setElapsed(e => e + payload.dt);
 * }, []);
 *
 * @example
 * // Poll (replaces setInterval + fetch)
 * useLuaEffect({ type: 'poll', interval: 5000 }, () => {
 *   bridge.rpc('system:info').then(setInfo);
 * }, []);
 */
export function useLuaEffect(
  config: LuaEffectConfig,
  handler: (payload?: any) => void,
  deps: readonly any[],
): void {
  const bridge = useBridge();
  const id = useStableId();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  // Serialize config for dep comparison
  const configKey = JSON.stringify(config);

  // This is the ONE internal useEffect — framework code only.
  // User code uses this hook, not raw useEffect.
  useEffect(() => {
    const eventName = `effect:${id}`;

    // Subscribe to events from Lua
    const unsub = bridge.subscribe(eventName, (payload: any) => {
      handlerRef.current(payload);
    });

    // Register effect in Lua
    bridge.rpc('effect:register', {
      id,
      type: config.type,
      config: {
        interval: config.interval,
        every: config.every,
      },
    });

    return () => {
      unsub();
      bridge.rpc('effect:cleanup', { id });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge, id, configKey, ...deps]);
}

// ── useMount ───────────────────────────────────────────────────

/**
 * Run a function on mount, optional cleanup on unmount.
 * Replaces useEffect(() => { ... return cleanup }, []).
 *
 * The setup function runs immediately (in JS) and the optional
 * cleanup runs on unmount. For Lua-side mount effects, use
 * useLuaEffect({ type: 'mount' }, handler, []) instead.
 *
 * @example
 * useMount(() => {
 *   const unsub = bridge.subscribe('viewport', handler);
 *   return () => unsub();
 * });
 */
export function useMount(setup: () => void | (() => void)): void {
  const setupRef = useRef(setup);
  setupRef.current = setup;

  // Single internal useEffect — runs once on mount
  useEffect(() => {
    return setupRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// ── useLuaQuery ────────────────────────────────────────────────

export interface LuaQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetch data via Lua RPC with loading/error state.
 * Replaces useEffect(() => { bridge.rpc(...).then(set) }, [deps]).
 *
 * @param method  RPC method name
 * @param args    RPC arguments (serializable)
 * @param deps    Dependency array — refetches when deps change
 *
 * @example
 * const { data, loading, error } = useLuaQuery('system:info', {}, []);
 *
 * @example
 * const { data: ports } = useLuaQuery('ports:list', { filter }, [filter]);
 */
export function useLuaQuery<T = any>(
  method: string,
  args?: any,
  deps: readonly any[] = [],
): LuaQueryResult<T> {
  const bridge = useBridge();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const refetch = useCallback(() => setFetchKey(k => k + 1), []);

  // Single internal useEffect for the RPC call
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    bridge.rpc<T>(method, args)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge, method, fetchKey, ...deps]);

  return { data, loading, error, refetch };
}
