/**
 * useIFTTT — If This Then That, as a one-liner.
 *
 * Wire any trigger to any action. Both sides accept either a string DSL
 * or a function. Mix and match freely.
 *
 * ── String triggers (subscribe to bridge events) ────────────
 *   'key:<key>'              keydown (e.g. 'key:space', 'key:escape')
 *   'key:up:<key>'           keyup
 *   'key:ctrl+<k>'           key combo (e.g. 'key:ctrl+s', 'key:ctrl+shift+z')
 *   'click'                  any mouse click
 *   'timer:every:<ms>'       repeating Lua timer (e.g. 'timer:every:5000')
 *   'timer:once:<ms>'        single-shot delay
 *   'gamepad:<button>'       gamepad button press
 *   'midi:note:<n>'          MIDI note on
 *   'midi:cc:<n>'            MIDI CC message
 *   'filedrop'               file dropped on window
 *   'mount'                  fires once on component mount
 *   'state:<key>:<value>'    fires when Lua state matches value
 *   '<event>'                any raw bridge event name
 *
 * ── String actions (fire bridge commands) ───────────────────
 *   'state:set:<key>:<val>'  set Lua state
 *   'state:toggle:<key>'     toggle boolean Lua state
 *   'notification:<msg>'     push a notification
 *   'clipboard:<text>'       copy text to clipboard
 *   'send:<type>'            fire a bridge event (payload = trigger event)
 *   'rpc:<method>'           call a Lua RPC (args = trigger event)
 *   'log:<message>'          console.log (debugging)
 *
 * ── Function triggers ───────────────────────────────────────
 *   () => boolean            reactive condition — fires on false→true edge
 *                            Keep trigger functions pure and stable.
 *                            Avoid reading `fired`/`lastEvent` inside the
 *                            trigger to prevent feedback loops.
 *
 * ── Function actions ────────────────────────────────────────
 *   (event?) => void         imperative callback, receives trigger payload
 *
 * @example
 * // Keyboard → state
 * useIFTTT('key:space',         'state:toggle:paused')
 *
 * // Timer → log
 * useIFTTT('timer:every:5000',  'log:tick!')
 *
 * // Gamepad → callback
 * useIFTTT('gamepad:a',         () => jump())
 *
 * // Reactive condition → notification
 * useIFTTT(() => score > 100,   'notification:You win!')
 *
 * // Key combo → callback
 * useIFTTT('key:ctrl+s',        () => save())
 *
 * // File drop → handler
 * useIFTTT('filedrop',          (e) => loadFile(e.path))
 *
 * // MIDI → state
 * useIFTTT('midi:note:60',      'state:set:lastNote:C4')
 *
 * // Chain multiple rules
 * useIFTTT('key:1', 'state:set:tool:brush')
 * useIFTTT('key:2', 'state:set:tool:eraser')
 * useIFTTT('key:3', 'state:set:tool:fill')
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useBridge } from './context';
import type { IBridge } from './bridge';

type Trigger = string | (() => boolean);
type Action = string | ((event?: any) => void);

interface IFTTTResult {
  /** Number of times the rule has fired */
  fired: number;
  /** Payload from the most recent trigger event */
  lastEvent: any;
  /** Manually fire the action */
  fire: (event?: any) => void;
}

// ── Trigger parser ──────────────────────────────────────────

interface ParsedTrigger {
  type: 'event' | 'key' | 'key-combo' | 'timer' | 'timer-once' | 'gamepad' | 'state-match' | 'mount' | 'invalid';
  event?: string;
  key?: string;
  combo?: { ctrl: boolean; shift: boolean; alt: boolean; meta: boolean; key: string };
  intervalMs?: number;
  stateKey?: string;
  stateValue?: string;
  error?: string;
}

function parseTrigger(trigger: string): ParsedTrigger {
  if (trigger === 'mount') return { type: 'mount' };
  if (trigger === 'click') return { type: 'event', event: 'click' };
  if (trigger === 'filedrop') return { type: 'event', event: 'filedrop' };

  // key:ctrl+shift+s (combo) — must check before plain key:
  if (trigger.startsWith('key:') && trigger.includes('+')) {
    const combo = parseKeyCombo(trigger.slice(4));
    if (!combo.key) {
      return { type: 'invalid', error: `key combo missing final key: "${trigger}"` };
    }
    return { type: 'key-combo', combo };
  }

  // key:up:<key>
  if (trigger.startsWith('key:up:')) {
    return { type: 'event', event: 'keyup', key: trigger.slice(7) };
  }

  // key:<key>
  if (trigger.startsWith('key:')) {
    return { type: 'key', key: trigger.slice(4) };
  }

  // timer:every:<ms>
  if (trigger.startsWith('timer:every:')) {
    const ms = parseInt(trigger.slice(12), 10);
    if (isNaN(ms) || ms <= 0) {
      return { type: 'invalid', error: `invalid timer interval: "${trigger}"` };
    }
    return { type: 'timer', intervalMs: ms };
  }

  // timer:once:<ms>
  if (trigger.startsWith('timer:once:')) {
    const ms = parseInt(trigger.slice(11), 10);
    if (isNaN(ms) || ms <= 0) {
      return { type: 'invalid', error: `invalid timer delay: "${trigger}"` };
    }
    return { type: 'timer-once', intervalMs: ms };
  }

  // gamepad:<button>
  if (trigger.startsWith('gamepad:')) {
    return { type: 'gamepad', key: trigger.slice(8) };
  }

  // midi:note:<n>
  if (trigger.startsWith('midi:note:')) {
    return { type: 'event', event: 'midi:note', key: trigger.slice(10) };
  }

  // midi:cc:<n>
  if (trigger.startsWith('midi:cc:')) {
    return { type: 'event', event: 'midi:cc', key: trigger.slice(8) };
  }

  // state:<key>:<value> or state:<key> (any change)
  if (trigger.startsWith('state:')) {
    const rest = trigger.slice(6);
    const colonIdx = rest.indexOf(':');
    if (colonIdx !== -1) {
      return { type: 'state-match', stateKey: rest.slice(0, colonIdx), stateValue: rest.slice(colonIdx + 1) };
    }
    return { type: 'event', event: `state:${rest}` };
  }

  // Fallback: raw event name
  return { type: 'event', event: trigger };
}

function parseKeyCombo(combo: string) {
  const parts = combo.toLowerCase().split('+').map(s => s.trim()).filter(Boolean);
  const result = { ctrl: false, shift: false, alt: false, meta: false, key: '' };
  for (const part of parts) {
    if (part === 'ctrl' || part === 'control') result.ctrl = true;
    else if (part === 'shift') result.shift = true;
    else if (part === 'alt') result.alt = true;
    else if (part === 'meta' || part === 'cmd' || part === 'gui') result.meta = true;
    else result.key = part;
  }
  return result;
}

// ── Action parser ───────────────────────────────────────────

function executeAction(action: string, bridge: IBridge, event?: any): void {
  // state:set:<key>:<value>
  if (action.startsWith('state:set:')) {
    const rest = action.slice(10);
    const colonIdx = rest.indexOf(':');
    if (colonIdx !== -1) {
      const key = rest.slice(0, colonIdx);
      const rawValue = rest.slice(colonIdx + 1);
      bridge.setState(key, coerce(rawValue));
    }
    return;
  }

  // state:toggle:<key>
  if (action.startsWith('state:toggle:')) {
    bridge.rpc('state:toggle', { key: action.slice(13) });
    return;
  }

  // notification:<msg>
  if (action.startsWith('notification:')) {
    bridge.rpc('notification:send', { message: action.slice(13) });
    return;
  }

  // clipboard:<text>
  if (action.startsWith('clipboard:')) {
    bridge.rpc('clipboard:write', { text: action.slice(10) });
    return;
  }

  // send:<type> (fire-and-forget)
  if (action.startsWith('send:')) {
    bridge.send(action.slice(5), event);
    return;
  }

  // rpc:<method>
  if (action.startsWith('rpc:')) {
    bridge.rpc(action.slice(4), event);
    return;
  }

  // log:<message>
  if (action.startsWith('log:')) {
    console.log(`[IFTTT]`, action.slice(4), event ?? '');
    return;
  }
}

/** Coerce string values to primitive types */
function coerce(raw: string): string | number | boolean {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const n = Number(raw);
  if (!isNaN(n) && raw !== '') return n;
  return raw;
}

// ── Timer ID counter ────────────────────────────────────────

let _iftttTimerCounter = 0;

// ── Timer lifecycle helper ──────────────────────────────────
// Handles the race between RPC resolution, cleanup, and first-fire.
// If cleanup runs before the timer ID arrives, we set a disposed flag
// so the resolve callback cancels immediately.

function createManagedTimer(
  bridge: IBridge,
  intervalMs: number,
  eventName: string,
  onTick: () => void,
  once: boolean,
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
      // Cleanup already ran, or once-timer already fired — cancel immediately
      bridge.rpc('timer:cancel', { id: res.id });
    } else {
      timerId = res.id;
    }
  });

  const unsub = bridge.subscribe(eventName, () => {
    if (disposed) return;

    if (once) {
      // Only fire once. Cancel the Lua timer to stop wasting work.
      pendingCancel = true;
      cancelTimer();
    }

    onTick();
  });

  // Cleanup function
  return () => {
    disposed = true;
    unsub();
    cancelTimer();
  };
}

// ── State value matching ────────────────────────────────────
// Bridge state events send the raw value as payload (unwrapped).
// We coerce both sides to compare: "true" matches true, "42" matches 42.

function stateMatches(payload: any, expected: string): boolean {
  // Exact string match (covers string values)
  if (String(payload) === expected) return true;

  // Coerced match (covers "true" vs true, "42" vs 42)
  const coerced = coerce(expected);
  if (payload === coerced) return true;

  // Explicit null/undefined check
  if ((payload == null) && (expected === 'null' || expected === 'undefined')) return true;

  return false;
}

// ── The hook ────────────────────────────────────────────────

export function useIFTTT(trigger: Trigger, action: Action): IFTTTResult {
  const bridge = useBridge();
  const [fired, setFired] = useState(0);
  const [lastEvent, setLastEvent] = useState<any>(null);

  const actionRef = useRef(action);
  actionRef.current = action;

  const fire = useCallback((event?: any) => {
    setFired(c => c + 1);
    setLastEvent(event ?? null);
    const act = actionRef.current;
    if (typeof act === 'function') {
      act(event);
    } else {
      executeAction(act, bridge, event);
    }
  }, [bridge]);

  const fireRef = useRef(fire);
  fireRef.current = fire;

  // ── String trigger: subscribe to bridge events ──
  const parsed = useMemo(
    () => typeof trigger === 'string' ? parseTrigger(trigger) : null,
    [trigger],
  );

  useEffect(() => {
    if (typeof trigger !== 'string' || !parsed) return;

    // Log invalid triggers in dev
    if (parsed.type === 'invalid') {
      console.warn(`[useIFTTT] ${parsed.error}`);
      return;
    }

    switch (parsed.type) {
      case 'mount': {
        fireRef.current();
        return;
      }

      case 'event': {
        return bridge.subscribe(parsed.event!, (payload: any) => {
          if (parsed.key) {
            const eventKey = payload?.key ?? payload?.note ?? payload?.cc;
            if (String(eventKey).toLowerCase() !== parsed.key.toLowerCase()) return;
          }
          fireRef.current(payload);
        });
      }

      case 'key': {
        return bridge.subscribe('keydown', (payload: any) => {
          if ((payload.key ?? '').toLowerCase() === parsed.key!.toLowerCase()) {
            fireRef.current(payload);
          }
        });
      }

      case 'key-combo': {
        const c = parsed.combo!;
        return bridge.subscribe('keydown', (payload: any) => {
          if (!!payload.ctrl !== c.ctrl) return;
          if (!!payload.shift !== c.shift) return;
          if (!!payload.alt !== c.alt) return;
          if (!!payload.meta !== c.meta) return;
          if ((payload.key ?? '').toLowerCase() !== c.key) return;
          fireRef.current(payload);
        });
      }

      case 'gamepad': {
        return bridge.subscribe('gamepadpressed', (payload: any) => {
          if (String(payload.button ?? payload.key).toLowerCase() === parsed.key!.toLowerCase()) {
            fireRef.current(payload);
          }
        });
      }

      case 'timer': {
        return createManagedTimer(
          bridge,
          parsed.intervalMs!,
          `ifttt:timer:${++_iftttTimerCounter}`,
          () => fireRef.current(),
          false,
        );
      }

      case 'timer-once': {
        let hasFired = false;
        return createManagedTimer(
          bridge,
          parsed.intervalMs!,
          `ifttt:once:${++_iftttTimerCounter}`,
          () => {
            if (hasFired) return;
            hasFired = true;
            fireRef.current();
          },
          true,
        );
      }

      case 'state-match': {
        return bridge.subscribe(`state:${parsed.stateKey}`, (payload: any) => {
          if (stateMatches(payload, parsed.stateValue!)) {
            fireRef.current(payload);
          }
        });
      }
    }
  }, [bridge, parsed, trigger]);

  // ── Function trigger: edge-detect false→true ──
  // Runs after every render to poll the condition. Best-effort: function
  // triggers should be pure and should not read `fired`/`lastEvent`
  // to avoid feedback loops. Strict Mode may cause an extra edge in dev.
  const prevCondition = useRef(false);
  const isMounted = useRef(false);

  useEffect(() => {
    if (typeof trigger !== 'function') return;

    // Skip the initial mount-phase evaluation in Strict Mode's double-invoke.
    // On first real mount we just record the initial condition without firing.
    if (!isMounted.current) {
      isMounted.current = true;
      prevCondition.current = trigger();
      return;
    }

    const result = trigger();
    if (result && !prevCondition.current) {
      fireRef.current();
    }
    prevCondition.current = result;
  });

  return { fired, lastEvent, fire };
}
