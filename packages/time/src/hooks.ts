/**
 * @reactjit/time — React hooks.
 *
 * All time-sensitive operations (stopwatch, countdown, precision scheduling)
 * run on the Lua side inside the Love2D update loop, making them frame-accurate
 * and immune to JavaScript event-loop jitter. This matters for audio production:
 * a note scheduled with useOnTime fires in the exact Love2D frame it should.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useBridge, useLoveRPC, useLoveEvent } from '@reactjit/core';
import type {
  StopwatchOptions, StopwatchResult,
  CountdownOptions, CountdownResult,
  LuaTimeState,
} from './types';

// ── Counter for unique timer/schedule IDs ─────────────────────────────────────
let _scheduleCounter = 0;

// ── Managed timer helper ──────────────────────────────────────────────────────
// Handles the race between RPC resolution and cleanup/first-fire.
// If cleanup runs before the timer ID arrives, we set a disposed flag
// so the resolve callback cancels immediately. Prevents leaked Lua timers.

interface IBridgeLike {
  rpc<T = any>(method: string, args?: any, timeoutMs?: number): Promise<T>;
  subscribe(type: string, fn: (payload: any) => void): () => void;
}

function createManagedTimer(
  bridge: IBridgeLike,
  intervalMs: number,
  eventName: string,
  onTick: () => void,
  opts?: { once?: boolean },
): () => void {
  let timerId: number | null = null;
  let disposed = false;
  let pendingCancel = false;

  const cancelTimer = () => {
    if (timerId != null) {
      bridge.rpc('timer:cancel', { id: timerId });
      timerId = null;
    }
  };

  bridge.rpc<{ id: number }>('timer:create', {
    interval: intervalMs,
    event: eventName,
  }).then(res => {
    if (disposed || pendingCancel) {
      bridge.rpc('timer:cancel', { id: res.id });
    } else {
      timerId = res.id;
    }
  });

  const unsub = bridge.subscribe(eventName, () => {
    if (disposed) return;
    if (opts?.once) {
      pendingCancel = true;
      cancelTimer();
    }
    onTick();
  });

  return () => {
    disposed = true;
    unsub();
    cancelTimer();
  };
}

// ── useTime — simple JS wall clock ────────────────────────────────────────────

/**
 * Returns `Date.now()` updated at the given rate. Good for clocks and displays.
 * Runs entirely in JS — use `useLuaTime()` if you need the monotonic clock.
 *
 * @example
 * const now = useTime();
 * <Text>{new Date(now).toLocaleTimeString()}</Text>
 */
export function useTime(rateMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), rateMs);
    return () => clearInterval(id);
  }, [rateMs]);
  return now;
}

// ── useLuaTime — wall clock + monotonic from Love2D ───────────────────────────

/**
 * Polls Lua's `time:now` RPC at the given rate. Returns both the wall clock
 * and the monotonic `love.timer.getTime()` clock (float seconds).
 *
 * The monotonic clock is useful for precise interval math that doesn't drift
 * even when the system clock jumps (NTP, DST, etc.).
 *
 * @example
 * const t = useLuaTime();
 * t?.mono   // seconds since Love2D started
 * t?.epoch  // Unix ms
 * t?.localStr  // "2026-03-03T14:22:05"
 */
export function useLuaTime(rateMs = 1000): LuaTimeState | null {
  const [state, setState] = useState<LuaTimeState | null>(null);
  const getNow = useLoveRPC<LuaTimeState>('time:now');
  useEffect(() => {
    const tick = () => getNow({}).then(t => setState(t)).catch(() => {});
    tick();
    const id = setInterval(tick, rateMs);
    return () => clearInterval(id);
  }, [getNow, rateMs]);
  return state;
}

// ── useStopwatch — Lua-driven elapsed timer ────────────────────────────────────

/**
 * A stopwatch driven by Lua's `love.update(dt)` loop. Sub-millisecond
 * accumulation in Lua; React receives elapsed updates at `tickRate` ms.
 *
 * @example
 * const sw = useStopwatch({ autoStart: true });
 * <Text>{formatDuration(sw.elapsed)}</Text>
 * <Pressable onPress={sw.stop}><Text>Stop</Text></Pressable>
 */
export function useStopwatch(opts: StopwatchOptions = {}): StopwatchResult {
  const { tickRate = 100, autoStart = false } = opts;
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);

  const bridge    = useBridge();
  const createRpc = useLoveRPC<{ id: number; event: string }>('time:stopwatch:create');
  const ctrlRpc   = useLoveRPC('time:stopwatch:control');

  const idRef    = useRef<number | null>(null);
  const eventRef = useRef<string | null>(null);

  // Create the Lua stopwatch on mount
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    createRpc({ tickRate, running: autoStart }).then(res => {
      idRef.current    = res.id;
      eventRef.current = res.event;
      if (autoStart) setRunning(true);
      unsubscribe = bridge.subscribe(res.event, (payload: { elapsed: number; running: boolean }) => {
        setElapsed(payload.elapsed);
        setRunning(payload.running);
      });
    });
    return () => {
      unsubscribe?.();
      if (idRef.current != null) {
        bridge.rpc('time:stopwatch:destroy', { id: idRef.current });
        idRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const control = useCallback((action: string) => {
    if (idRef.current == null) return;
    ctrlRpc({ id: idRef.current, action }).then((res: any) => {
      if (res) {
        if (typeof res.elapsed  === 'number') setElapsed(res.elapsed);
        if (typeof res.running  === 'boolean') setRunning(res.running);
      }
    });
  }, [ctrlRpc]);

  const start   = useCallback(() => { setRunning(true);  control('start');   }, [control]);
  const stop    = useCallback(() => { setRunning(false); control('stop');    }, [control]);
  const reset   = useCallback(() => { setElapsed(0);     control('reset');   }, [control]);
  const restart = useCallback(() => { setElapsed(0); setRunning(true); control('restart'); }, [control]);

  return { elapsed, running, start, stop, reset, restart };
}

// ── useCountdown — Lua-driven countdown timer ─────────────────────────────────

/**
 * A countdown driven by Lua's `love.update(dt)` loop. React receives
 * `remaining` updates at `tickRate` ms and fires `onComplete` when done.
 *
 * @example
 * const cd = useCountdown(30_000, { autoStart: true, onComplete: () => alert('Done!') });
 * <Text>{formatDuration(cd.remaining)}</Text>
 * <Box style={{ width: `${cd.progress * 100}%`, height: 4, background: '#3b82f6' }} />
 */
export function useCountdown(durationMs: number, opts: CountdownOptions = {}): CountdownResult {
  const { tickRate = 100, autoStart = false, onComplete } = opts;

  const [remaining, setRemaining] = useState(durationMs);
  const [running,   setRunning]   = useState(false);
  const [complete,  setComplete]  = useState(false);

  const bridge      = useBridge();
  const createRpc   = useLoveRPC<{ id: number; event: string }>('time:countdown:create');
  const ctrlRpc     = useLoveRPC('time:countdown:control');
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const idRef    = useRef<number | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    createRpc({ duration: durationMs, tickRate, running: autoStart }).then(res => {
      idRef.current = res.id;
      if (autoStart) setRunning(true);
      unsubscribe = bridge.subscribe(res.event, (payload: { remaining: number; complete: boolean }) => {
        setRemaining(payload.remaining);
        if (payload.complete) {
          setRunning(false);
          setComplete(true);
          onCompleteRef.current?.();
        }
      });
    });
    return () => {
      unsubscribe?.();
      if (idRef.current != null) {
        bridge.rpc('time:countdown:destroy', { id: idRef.current });
        idRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationMs]);

  const control = useCallback((action: string) => {
    if (idRef.current == null) return;
    ctrlRpc({ id: idRef.current, action }).then((res: any) => {
      if (res) {
        if (typeof res.remaining === 'number') setRemaining(res.remaining);
        if (typeof res.running   === 'boolean') setRunning(res.running);
      }
    });
  }, [ctrlRpc]);

  const start   = useCallback(() => { setRunning(true);  setComplete(false); control('start');   }, [control]);
  const stop    = useCallback(() => { setRunning(false); control('stop');    }, [control]);
  const reset   = useCallback(() => {
    setRemaining(durationMs); setRunning(false); setComplete(false); control('reset');
  }, [control, durationMs]);
  const restart = useCallback(() => {
    setRemaining(durationMs); setRunning(true); setComplete(false); control('restart');
  }, [control, durationMs]);

  const progress = 1 - remaining / durationMs;

  return { remaining, running, complete, progress, start, stop, reset, restart };
}

// ── useOnTime — frame-precise delayed callback ────────────────────────────────

/**
 * Schedule a function to fire after `delayMs` milliseconds, using Lua's
 * `love.update(dt)` accumulator rather than the JS event loop.
 *
 * The callback fires in the exact Love2D frame that crosses the delay threshold —
 * no JS event-loop jitter, no GC pauses. This is the right tool when the timing
 * of a side effect (playing a note, switching a state, triggering a visual) needs
 * to be precisely aligned with the audio or game clock.
 *
 * Re-schedules whenever `deps` change (same rules as `useEffect`).
 *
 * @example
 * // Play a note exactly 500ms after the component mounts
 * useOnTime(() => playNote(60, 127), 500);
 *
 * // Re-schedule when bpm changes
 * useOnTime(() => snap(), nextBeatMs, [nextBeatMs]);
 */
export function useOnTime(fn: () => void, delayMs: number, deps: any[] = []): void {
  const bridge = useBridge();
  const fnRef  = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (delayMs <= 0) {
      fnRef.current();
      return;
    }

    let hasFired = false;
    return createManagedTimer(
      bridge,
      delayMs,
      `time:once:${++_scheduleCounter}`,
      () => {
        if (hasFired) return;
        hasFired = true;
        fnRef.current();
      },
      { once: true },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge, delayMs, ...deps]);
}

// ── useInterval — Lua-driven repeating callback ───────────────────────────────

/**
 * Call `fn` every `intervalMs` milliseconds via the Lua timer service.
 * More precise than `setInterval` in JS — fires within the same Love2D
 * frame as the scheduled tick.
 *
 * @example
 * useInterval(() => setCount(c => c + 1), 1000);
 */
export function useInterval(fn: () => void, intervalMs: number): void {
  const bridge = useBridge();
  const fnRef  = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (intervalMs <= 0) return;
    return createManagedTimer(
      bridge,
      intervalMs,
      `time:interval:${++_scheduleCounter}`,
      () => fnRef.current(),
    );
  }, [bridge, intervalMs]);
}

// ── useFrameInterval — fire every N frames ─────────────────────────────────────

/**
 * Call `fn` every `frames` Love2D frames. Unlike `useInterval` which uses
 * wall-clock time, this counts actual rendered frames — perfect for
 * animation steps, physics ticks, or any logic that should be tied to
 * the render loop rather than real time.
 *
 * At 60fps, `useFrameInterval(fn, 60)` fires roughly once per second,
 * but stays in sync with the frame cadence even when the framerate drops.
 *
 * @example
 * // Fire every frame (every 1 frame)
 * useFrameInterval(() => stepPhysics(), 1);
 *
 * // Fire every 100 frames
 * useFrameInterval(() => setCount(c => c + 1), 100);
 *
 * // Animate at half framerate
 * useFrameInterval(() => nextSprite(), 2);
 */
export function useFrameInterval(fn: () => void, frames: number): void {
  const bridge = useBridge();
  const fnRef  = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (frames <= 0) return;

    const every = Math.max(1, Math.floor(frames));
    const eventName = `time:frame:${++_scheduleCounter}`;

    let timerId: number | null = null;
    let disposed = false;

    bridge.rpc<{ id: number }>('timer:frame:create', {
      every,
      event: eventName,
    }).then(res => {
      if (disposed) {
        bridge.rpc('timer:frame:cancel', { id: res.id });
      } else {
        timerId = res.id;
      }
    });

    const unsub = bridge.subscribe(eventName, () => {
      if (!disposed) fnRef.current();
    });

    return () => {
      disposed = true;
      unsub();
      if (timerId != null) {
        bridge.rpc('timer:frame:cancel', { id: timerId });
      }
    };
  }, [bridge, frames]);
}
