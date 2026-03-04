/**
 * useEvents — Lightweight event bus as a hook.
 *
 * Create named channels that components can emit to and listen on.
 * Events are local to React (no bridge, no Lua) — pure in-memory pub/sub.
 * For bridge events that cross into Lua, use useLoveEvent/useLoveSend.
 *
 * ── Create a bus (once, at the top of your app or feature) ──
 *
 *   const bus = useEventBus();
 *
 * ── Emit events from anywhere that has the bus ──────────────
 *
 *   bus.emit('cart:add', { id: 42, qty: 1 });
 *   bus.emit('theme:change', 'dark');
 *   bus.emit('reset');
 *
 * ── Listen for events ───────────────────────────────────────
 *
 *   useEvent(bus, 'cart:add', (item) => addToCart(item));
 *   useEvent(bus, 'reset', () => clearState());
 *
 * ── Wildcard / multi-channel ────────────────────────────────
 *
 *   useEvent(bus, '*', (event, channel) => console.log(channel, event));
 *   useEvent(bus, ['cart:add', 'cart:remove'], (item) => syncCart(item));
 *
 * ── With useIFTTT ───────────────────────────────────────────
 *
 *   // Emit on key press
 *   useIFTTT('key:space', () => bus.emit('player:jump'));
 *
 *   // Listen and react
 *   useEvent(bus, 'player:jump', () => playSound());
 *
 * ── Extracting last event (stateful) ────────────────────────
 *
 *   const last = useEventState(bus, 'cart:add');
 *   // last = { id: 42, qty: 1 } — re-renders on each event
 *
 * ── Why not just use bridge events? ─────────────────────────
 *
 *   Bridge events cross the JS↔Lua boundary every frame via the command
 *   buffer. useEvents is pure JS — zero serialization, zero bridge traffic,
 *   zero frame-boundary latency. Use it for React-to-React communication
 *   (sibling components, feature modules, state coordination). Use bridge
 *   events when Lua needs to know.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ── Types ───────────────────────────────────────────────────

type EventHandler<T = any> = (payload: T, channel: string) => void;

export interface EventBus {
  /** Emit an event on a channel. All listeners for that channel fire synchronously. */
  emit: (channel: string, payload?: any) => void;
  /** Subscribe to a channel. Returns an unsubscribe function. */
  on: (channel: string, handler: EventHandler) => () => void;
  /** Subscribe to a channel for one event only. */
  once: (channel: string, handler: EventHandler) => () => void;
  /** Remove all listeners for a channel, or all listeners if no channel given. */
  clear: (channel?: string) => void;
  /** Number of active listeners (useful for debugging). */
  readonly listenerCount: number;
}

// ── EventBus implementation ─────────────────────────────────

class EventBusImpl implements EventBus {
  private listeners = new Map<string, Set<EventHandler>>();
  private wildcardListeners = new Set<EventHandler>();

  get listenerCount(): number {
    let count = this.wildcardListeners.size;
    for (const set of this.listeners.values()) count += set.size;
    return count;
  }

  emit = (channel: string, payload?: any): void => {
    // Channel-specific listeners
    const set = this.listeners.get(channel);
    if (set) {
      for (const fn of set) fn(payload, channel);
    }
    // Wildcard listeners
    for (const fn of this.wildcardListeners) fn(payload, channel);
  };

  on = (channel: string, handler: EventHandler): (() => void) => {
    if (channel === '*') {
      this.wildcardListeners.add(handler);
      return () => { this.wildcardListeners.delete(handler); };
    }
    let set = this.listeners.get(channel);
    if (!set) {
      set = new Set();
      this.listeners.set(channel, set);
    }
    set.add(handler);
    return () => {
      set!.delete(handler);
      if (set!.size === 0) this.listeners.delete(channel);
    };
  };

  once = (channel: string, handler: EventHandler): (() => void) => {
    const wrapper: EventHandler = (payload, ch) => {
      unsub();
      handler(payload, ch);
    };
    const unsub = this.on(channel, wrapper);
    return unsub;
  };

  clear = (channel?: string): void => {
    if (channel === '*') {
      this.wildcardListeners.clear();
    } else if (channel) {
      this.listeners.delete(channel);
    } else {
      this.listeners.clear();
      this.wildcardListeners.clear();
    }
  };
}

// ── Hooks ───────────────────────────────────────────────────

/**
 * Create an event bus. Stable across re-renders — same instance for the
 * lifetime of the component. Share it via props, context, or a module-level
 * variable.
 *
 * @example
 * const bus = useEventBus();
 * <ChildA bus={bus} />
 * <ChildB bus={bus} />
 */
export function useEventBus(): EventBus {
  // Single instance for the component's lifetime
  const ref = useRef<EventBus | null>(null);
  if (!ref.current) ref.current = new EventBusImpl();
  return ref.current;
}

/**
 * Listen for events on a bus. Handler stays fresh (no stale closure).
 * Automatically unsubscribes on unmount.
 *
 * @example
 * useEvent(bus, 'cart:add', (item) => addToCart(item));
 * useEvent(bus, ['save', 'autosave'], () => persist());
 * useEvent(bus, '*', (payload, channel) => log(channel, payload));
 */
export function useEvent<T = any>(
  bus: EventBus,
  channel: string | string[],
  handler: EventHandler<T>,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const channels = useMemo(
    () => Array.isArray(channel) ? channel : [channel],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [Array.isArray(channel) ? channel.join('\0') : channel],
  );

  useEffect(() => {
    const unsubs = channels.map(ch =>
      bus.on(ch, (payload, c) => handlerRef.current(payload, c)),
    );
    return () => { for (const u of unsubs) u(); };
  }, [bus, channels]);
}

/**
 * Stateful event listener — returns the most recent payload.
 * Re-renders on each event. Good for "latest value" patterns.
 *
 * @example
 * const lastItem = useEventState(bus, 'cart:add');
 * // lastItem = { id: 42, qty: 1 } after the event fires
 */
export function useEventState<T = any>(
  bus: EventBus,
  channel: string,
  initialValue?: T,
): T | undefined {
  const [value, setValue] = useState<T | undefined>(initialValue);

  useEvent(bus, channel, useCallback((payload: T) => {
    setValue(payload);
  }, []));

  return value;
}

/**
 * Create an emitter function bound to a specific channel.
 * Convenience for components that only need to send, not listen.
 *
 * @example
 * const addToCart = useEmit(bus, 'cart:add');
 * <Pressable onPress={() => addToCart({ id: 42 })} />
 */
export function useEmit(bus: EventBus, channel: string): (payload?: any) => void {
  return useCallback(
    (payload?: any) => bus.emit(channel, payload),
    [bus, channel],
  );
}

/**
 * Create a bus + automatically expose it. Convenience for the common
 * pattern of "one bus per feature module."
 *
 * Returns [bus, emit, useOn] where:
 * - bus: the EventBus instance
 * - emit: shorthand for bus.emit
 * - useOn: hook to subscribe (just wraps useEvent with the bus pre-bound)
 *
 * @example
 * const [bus, emit] = useEventChannel();
 * emit('ping', { ts: Date.now() });
 */
export function useEventChannel(): [
  EventBus,
  (channel: string, payload?: any) => void,
] {
  const bus = useEventBus();
  const emit = useCallback(
    (channel: string, payload?: any) => bus.emit(channel, payload),
    [bus],
  );
  return [bus, emit];
}
