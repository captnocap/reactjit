// =============================================================================
// useGamepadEvents — diff-based subscriptions to button/axis changes
// =============================================================================
// Takes a GamepadState and fires callbacks whenever a button transitions or
// an axis crosses an epsilon band. No host-side event stream needed — the
// diff runs on whatever cadence useGamepad polls at, so events track polling
// granularity.
//
// deadzone: axis-change events only fire when the new value differs from the
// last reported value by more than deadzone (default 0.01). Keeps the stream
// signal-dominant when a stick is idle-wiggling near zero.
// =============================================================================

import type { AxisId, ButtonId, GamepadEvent, GamepadState } from './types';

export interface UseGamepadEventsOptions {
  onEvent?:       (e: GamepadEvent) => void;
  onButtonDown?:  (button: ButtonId, e: GamepadEvent) => void;
  onButtonUp?:    (button: ButtonId, e: GamepadEvent) => void;
  onAxisChange?:  (axis: AxisId,     value: number, e: GamepadEvent) => void;
  /** 0..1, minimum delta to emit an axis-change. */
  deadzone?: number;
}

export function useGamepadEvents(state: GamepadState, opts: UseGamepadEventsOptions = {}): void {
  const deadzone = opts.deadzone ?? 0.01;
  const prevButtonsRef = useRef<Partial<Record<ButtonId, boolean>>>({});
  const prevAxesRef    = useRef<Partial<Record<AxisId,   number>>>({});
  const frameRef       = useRef<number>(-1);

  useEffect(() => {
    if (state.frame === frameRef.current) return;
    frameRef.current = state.frame;
    const now = typeof performance !== 'undefined' && performance && performance.now
      ? performance.now()
      : Date.now();

    // Button transitions.
    const prevBtn = prevButtonsRef.current;
    const curBtn = state.buttons;
    for (const k of Object.keys(curBtn) as ButtonId[]) {
      const was = !!prevBtn[k];
      const now_ = !!curBtn[k];
      if (was !== now_) {
        const ev: GamepadEvent = { type: now_ ? 'button-down' : 'button-up', id: state.id, button: k, ts: now };
        if (opts.onEvent)     opts.onEvent(ev);
        if (now_ && opts.onButtonDown) opts.onButtonDown(k, ev);
        if (!now_ && opts.onButtonUp)  opts.onButtonUp(k, ev);
      }
    }
    // Detect release of buttons that were in prev but dropped from cur.
    for (const k of Object.keys(prevBtn) as ButtonId[]) {
      if (prevBtn[k] && !curBtn[k]) {
        const ev: GamepadEvent = { type: 'button-up', id: state.id, button: k, ts: now };
        if (opts.onEvent)    opts.onEvent(ev);
        if (opts.onButtonUp) opts.onButtonUp(k, ev);
      }
    }
    prevButtonsRef.current = { ...curBtn };

    // Axis deltas.
    const prevAx = prevAxesRef.current;
    const curAx = state.axes;
    for (const a of Object.keys(curAx) as AxisId[]) {
      const prev = prevAx[a] ?? 0;
      const next = curAx[a]  ?? 0;
      if (Math.abs(prev - next) > deadzone) {
        const ev: GamepadEvent = { type: 'axis-change', id: state.id, axis: a, value: next, ts: now };
        if (opts.onEvent)       opts.onEvent(ev);
        if (opts.onAxisChange)  opts.onAxisChange(a, next, ev);
      }
    }
    prevAxesRef.current = { ...curAx };
  }, [state.frame]);
}
