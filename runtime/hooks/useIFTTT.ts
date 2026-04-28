/**
 * useIFTTT — If This Then That, as a one-liner.
 *
 * Wire any trigger to any action. Both sides accept either a string DSL
 * or a function. Mix and match freely.
 *
 * ── String triggers ─────────────────────────────────────────
 *   'key:<key>'              keydown (e.g. 'key:space', 'key:escape')
 *   'key:up:<key>'           keyup
 *   'key:ctrl+<k>'           key combo (e.g. 'key:ctrl+s', 'key:ctrl+shift+z')
 *   'click'                  any mouse click anywhere
 *   'timer:every:<ms>'       repeating interval
 *   'timer:once:<ms>'        single-shot delay
 *   'mount'                  fires once on component mount
 *   'state:<key>:<value>'    fires when shared state matches value
 *   '<event>'                any custom bus event (paired with 'send:<event>')
 *
 * ── String actions ──────────────────────────────────────────
 *   'state:set:<key>:<val>'  set shared state
 *   'state:toggle:<key>'     toggle boolean shared state
 *   'send:<type>'            emit a bus event (payload = trigger payload)
 *   'log:<message>'          console.log (debugging)
 *   'clipboard:<text>'       copy text to system clipboard
 *
 * ── Function triggers ──────────────────────────────────────
 *   () => boolean            reactive condition — fires on false→true edge.
 *                            Keep pure & cheap; runs after every render.
 *
 * ── Function actions ───────────────────────────────────────
 *   (event?) => void         imperative callback, receives trigger payload
 *
 * @example
 *   useIFTTT('key:space',         'state:toggle:paused')
 *   useIFTTT('timer:every:5000',  'log:tick!')
 *   useIFTTT('key:ctrl+s',        () => save())
 *   useIFTTT(() => score > 100,   'send:victory')
 *   useIFTTT('victory',           (e) => showWin(e))
 *
 * No bridge, no Zig. Pure TS over the existing key/timer primitives plus an
 * in-process event bus and key/value store.
 */
import { useEffect, useRef, useState } from 'react';
import * as clipboard from './clipboard';

// ── Bus + state store (module singletons) ─────────────────────────────────

type Handler = (payload?: any) => void;

const bus = new Map<string, Set<Handler>>();
const state = new Map<string, any>();
const stateWatchers = new Map<string, Set<Handler>>();

export function busOn(event: string, fn: Handler): () => void {
  let set = bus.get(event);
  if (!set) { set = new Set(); bus.set(event, set); }
  set.add(fn);
  return () => { set!.delete(fn); };
}

export function busEmit(event: string, payload?: any): void {
  const set = bus.get(event);
  if (!set || set.size === 0) return;
  for (const fn of Array.from(set)) {
    try { fn(payload); } catch (e: any) {
      console.error(`[ifttt] handler error on '${event}':`, e?.message || e);
    }
  }
}

export function getSharedState(key: string): any {
  return state.get(key);
}

export function setSharedState(key: string, value: any): void {
  const prev = state.get(key);
  if (prev === value) return;
  state.set(key, value);
  const watchers = stateWatchers.get(key);
  if (watchers) for (const fn of Array.from(watchers)) {
    try { fn(value); } catch (e: any) {
      console.error(`[ifttt] state watcher error for '${key}':`, e?.message || e);
    }
  }
}

function watchSharedState(key: string, fn: Handler): () => void {
  let set = stateWatchers.get(key);
  if (!set) { set = new Set(); stateWatchers.set(key, set); }
  set.add(fn);
  return () => { set!.delete(fn); };
}

// ── Global key listening ──────────────────────────────────────────────────
//
// The framework's engine.zig already invokes __ifttt_onKeyDown(packed) and
// __ifttt_onKeyUp(packed) on every SDL key event (regardless of focus). We
// install handlers here that decode the packed payload (mod<<16 | sym),
// translate the SDL keycode + modifier mask to friendly names, and fire on
// our internal bus. Trigger subscriptions just listen on the bus.
//
// Packed format from Zig: i64 = (mod << 16) | (sym & 0xFFFF)
//   sym  — SDL3 keycode (SDLK_*). ASCII for printable chars; specific
//          high values for non-printable keys (Enter, Escape, …).
//   mod  — SDL_Keymod bitmask: 1=LSHIFT 2=RSHIFT 64=LCTRL 128=RCTRL 256=LALT
//          512=RALT 1024=LGUI 2048=RGUI etc.

const SDL_KMOD_SHIFT = 0x0003;
const SDL_KMOD_CTRL = 0x00C0;
const SDL_KMOD_ALT = 0x0300;
const SDL_KMOD_GUI = 0x0C00;

// SDL3 keycode → friendly name. Printable ASCII falls through to
// String.fromCharCode(sym).toLowerCase().
const SDL_KEY_NAMES: Record<number, string> = {
  8: 'backspace', 9: 'tab', 13: 'enter', 27: 'escape', 32: 'space', 127: 'delete',
  // Arrow keys (SDL3 scancode | 0x40000000)
  0x40000050: 'left', 0x40000052: 'up', 0x4000004f: 'right', 0x40000051: 'down',
  // Function keys
  0x4000003a: 'f1', 0x4000003b: 'f2', 0x4000003c: 'f3', 0x4000003d: 'f4',
  0x4000003e: 'f5', 0x4000003f: 'f6', 0x40000040: 'f7', 0x40000041: 'f8',
  0x40000042: 'f9', 0x40000043: 'f10', 0x40000044: 'f11', 0x40000045: 'f12',
  // Editing / navigation
  0x40000049: 'insert', 0x4000004a: 'home', 0x4000004d: 'end',
  0x4000004b: 'pageup', 0x4000004e: 'pagedown',
};

function decodeKey(packed: number): { key: string; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean } {
  const sym = packed & 0xffff;
  const mod = (packed >> 16) & 0xffff;
  let key = SDL_KEY_NAMES[sym];
  if (!key) {
    if (sym >= 0x20 && sym < 0x7f) key = String.fromCharCode(sym).toLowerCase();
    else key = `sdl:${sym}`;
  }
  return {
    key,
    ctrlKey: (mod & SDL_KMOD_CTRL) !== 0,
    shiftKey: (mod & SDL_KMOD_SHIFT) !== 0,
    altKey: (mod & SDL_KMOD_ALT) !== 0,
    metaKey: (mod & SDL_KMOD_GUI) !== 0,
  };
}

// Install once. Idempotent — repeated imports won't double-fire.
const G = globalThis as any;
if (!G.__ifttt_handlers_installed) {
  G.__ifttt_handlers_installed = true;
  G.__ifttt_onKeyDown = (packed: number) => {
    const ev = decodeKey(packed);
    busEmit('__keydown', ev);
  };
  G.__ifttt_onKeyUp = (packed: number) => {
    const ev = decodeKey(packed);
    busEmit('__keyup', ev);
  };
  // System clipboard watcher fires this when SDL_GetClipboardText changes.
  // We pull the live text via the clipboard binding and emit on the bus.
  G.__ifttt_onClipboardChange = () => {
    let text = '';
    try { text = clipboard.get(); } catch { /* ignore */ }
    busEmit('system:clipboard', text);
  };
  G.__ifttt_onSystemFocus = (gained: number) => {
    busEmit(gained ? 'system:focus' : 'system:blur', { at: Date.now() });
  };
  G.__ifttt_onSystemDrop = () => {
    let path = '';
    try { path = String((G.__sys_drop_path?.() ?? '')); } catch { /* ignore */ }
    busEmit('system:fileDropped', path);
  };
  G.__ifttt_onSystemCursor = (x: number, y: number, dx: number, dy: number) => {
    busEmit('system:cursor:move', { x, y, dx, dy });
  };
  G.__ifttt_onSystemSlowFrame = (ms: number) => {
    busEmit('system:slowFrame', { ms });
  };
  G.__ifttt_onSystemHang = (count: number) => {
    busEmit('system:hang', { count });
  };
  G.__ifttt_onSystemRam = (used: number, total: number) => {
    const percent = total > 0 ? (used / total) * 100 : 0;
    busEmit('system:ram', { used, total, percent });
  };
  G.__ifttt_onSystemVram = (used: number, total: number) => {
    const percent = total > 0 ? (used / total) * 100 : 0;
    busEmit('system:vram', { used, total, percent });
  };
}

// Cart-side entry point for Claude Code hook events. Cart hosts an HTTP
// listener (e.g. via useHost) and pipes each POST body through here.
// Accepts either a parsed object or a raw JSON string.
export function dispatchClaudeEvent(input: string | object): void {
  let entry: any = null;
  if (typeof input === 'string') {
    try { entry = JSON.parse(input); } catch { return; }
  } else {
    entry = input;
  }
  if (!entry || typeof entry !== 'object') return;
  const tool = String(entry.tool ?? '').toLowerCase();
  const phase = String(entry.phase ?? '').toLowerCase();
  busEmit('system:claude', entry);
  if (tool) busEmit(`system:claude:${tool}`, entry);
  if (phase) busEmit(`system:claude:${phase}`, entry);
}

type KeySpec = { key: string; ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean };

function parseKey(spec: string): KeySpec {
  const parts = spec.toLowerCase().split('+');
  const key = parts.pop() ?? '';
  const out: KeySpec = { key };
  for (const m of parts) {
    if (m === 'ctrl' || m === 'control') out.ctrl = true;
    else if (m === 'shift') out.shift = true;
    else if (m === 'alt' || m === 'option') out.alt = true;
    else if (m === 'meta' || m === 'cmd' || m === 'command') out.meta = true;
  }
  return out;
}

function keyMatches(ev: any, spec: KeySpec): boolean {
  const ek = String(ev?.key ?? '').toLowerCase();
  if (ek !== spec.key) return false;
  if (!!spec.ctrl !== !!ev?.ctrlKey) return false;
  if (!!spec.shift !== !!ev?.shiftKey) return false;
  if (!!spec.alt !== !!ev?.altKey) return false;
  if (!!spec.meta !== !!ev?.metaKey) return false;
  return true;
}

// ── Action dispatch ───────────────────────────────────────────────────────

function runStringAction(action: string, payload: any): void {
  // state:set:<key>:<value>
  if (action.startsWith('state:set:')) {
    const rest = action.slice('state:set:'.length);
    const colon = rest.indexOf(':');
    const key = colon < 0 ? rest : rest.slice(0, colon);
    const raw = colon < 0 ? '' : rest.slice(colon + 1);
    setSharedState(key, coerce(raw));
    return;
  }
  // state:toggle:<key>
  if (action.startsWith('state:toggle:')) {
    const key = action.slice('state:toggle:'.length);
    setSharedState(key, !getSharedState(key));
    return;
  }
  // send:<event>
  if (action.startsWith('send:')) {
    busEmit(action.slice('send:'.length), payload);
    return;
  }
  // log:<msg>
  if (action.startsWith('log:')) {
    console.log('[ifttt]', action.slice('log:'.length), payload ?? '');
    return;
  }
  // clipboard:<text>
  if (action.startsWith('clipboard:')) {
    clipboard.set(action.slice('clipboard:'.length));
    return;
  }
  console.warn(`[ifttt] unknown action '${action}'`);
}

function coerce(raw: string): any {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;
  if (raw === '') return '';
  const n = Number(raw);
  if (!Number.isNaN(n) && /^[+-]?\d+(\.\d+)?$/.test(raw)) return n;
  return raw;
}

// ── Public types ──────────────────────────────────────────────────────────

export type IFTTTTrigger = string | (() => boolean);
export type IFTTTAction = string | ((event?: any) => void);

export type IFTTTResult = {
  fired: number;
  lastEvent: any;
  lastFiredAt: number; // Date.now() of the most recent fire (0 if never)
  fire: (event?: any) => void;
};

// ── The hook ──────────────────────────────────────────────────────────────

export function useIFTTT(trigger: IFTTTTrigger, action: IFTTTAction): IFTTTResult {
  const [, forceTick] = useState(0);
  const counterRef = useRef(0);
  const lastRef = useRef<any>(undefined);
  const lastAtRef = useRef(0);
  const actionRef = useRef(action);
  actionRef.current = action;

  const fire = (event?: any) => {
    counterRef.current += 1;
    lastRef.current = event;
    lastAtRef.current = Date.now();
    const a = actionRef.current;
    if (typeof a === 'function') a(event);
    else runStringAction(a, event);
    forceTick((n) => (n + 1) & 0xffff);
  };
  const fireRef = useRef(fire);
  fireRef.current = fire;

  // ── Function trigger: edge-detect false → true ────────────────────────
  const isFnTrigger = typeof trigger === 'function';
  const prevCondRef = useRef(false);
  useEffect(() => {
    if (!isFnTrigger) { prevCondRef.current = false; return; }
    let cur = false;
    try { cur = !!(trigger as () => boolean)(); } catch { cur = false; }
    if (cur && !prevCondRef.current) fireRef.current(undefined);
    prevCondRef.current = cur;
  });

  // ── String trigger subscriptions ──────────────────────────────────────
  useEffect(() => {
    if (typeof trigger !== 'string') return;
    const t = trigger;
    const f = (ev?: any) => fireRef.current(ev);

    if (t === 'mount') { f({ at: Date.now() }); return; }

    if (t === 'click') {
      return busOn('__click', f);
    }

    if (t.startsWith('key:up:')) {
      const spec = parseKey(t.slice('key:up:'.length));
      return busOn('__keyup', (ev) => { if (keyMatches(ev, spec)) f(ev); });
    }

    if (t.startsWith('key:')) {
      const spec = parseKey(t.slice('key:'.length));
      return busOn('__keydown', (ev) => { if (keyMatches(ev, spec)) f(ev); });
    }

    if (t.startsWith('timer:every:')) {
      const ms = Math.max(1, Number(t.slice('timer:every:'.length)) || 0);
      const id = setInterval(() => f({ at: Date.now(), interval: ms }), ms);
      return () => clearInterval(id);
    }

    if (t.startsWith('timer:once:')) {
      const ms = Math.max(0, Number(t.slice('timer:once:'.length)) || 0);
      const id = setTimeout(() => f({ at: Date.now(), delay: ms }), ms);
      return () => clearTimeout(id);
    }

    if (t.startsWith('state:')) {
      // state:<key>:<expected> — fires when shared state matches.
      const rest = t.slice('state:'.length);
      const colon = rest.indexOf(':');
      const key = colon < 0 ? rest : rest.slice(0, colon);
      const expectedRaw = colon < 0 ? '' : rest.slice(colon + 1);
      const expected = coerce(expectedRaw);
      // Fire once now if it already matches.
      if (getSharedState(key) === expected) f(getSharedState(key));
      return watchSharedState(key, (v) => { if (v === expected) f(v); });
    }

    // Fallthrough — treat as a raw bus event name.
    return busOn(t, f);
  }, [typeof trigger === 'string' ? trigger : null]);

  return {
    fired: counterRef.current,
    lastEvent: lastRef.current,
    lastFiredAt: lastAtRef.current,
    fire,
  };
}
