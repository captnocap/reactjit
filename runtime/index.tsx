// Entry for reactjit-QuickJS host. The host (qjs_app.zig) registers
// globalThis.__hostFlush(json) before evaling this bundle. It also calls
// globalThis.__dispatchEvent(id, type) when the user presses a Node.

// ── Browser API shims ────────────────────────────────────────────────
// Copy-pasted React code routinely reaches for window/document/addEventListener.
// Without these, any useEffect that wires keyboard/resize/visibility listeners
// throws synchronously — and since React uses setTimeout-scheduled commits, that
// throw kills the scheduler's pulse and freezes all subsequent re-renders.
// These shims are no-op collectors today; future work wires them to framework
// input/window events so the handlers actually fire.

type Listener = (ev: any) => void;
const _globalListeners: Record<string, Listener[]> = {};

function addEventListenerShim(type: string, fn: Listener): void {
  (_globalListeners[type] ||= []).push(fn);
}
function removeEventListenerShim(type: string, fn: Listener): void {
  const list = _globalListeners[type];
  if (!list) return;
  const i = list.indexOf(fn);
  if (i >= 0) list.splice(i, 1);
}

// Don't self-assign globalThis — some engines throw on it.
(globalThis as any).window = globalThis;
(globalThis as any).self = globalThis;
(globalThis as any).addEventListener = addEventListenerShim;
(globalThis as any).removeEventListener = removeEventListenerShim;

// Minimal document shim — enough to not throw on document.* access.
(globalThis as any).document = {
  addEventListener: addEventListenerShim,
  removeEventListener: removeEventListenerShim,
  createElement: (_tag: string) => ({ style: {}, addEventListener: addEventListenerShim, removeEventListener: removeEventListenerShim }),
  querySelector: (_sel: string) => null,
  querySelectorAll: (_sel: string) => [],
  getElementById: (_id: string) => null,
  body: null,
  documentElement: null,
  hidden: false,
  visibilityState: 'visible',
};

// Expose a way for the runtime (or future bridges) to fire DOM-style events.
(globalThis as any).__fireDomEvent = (type: string, payload: any): void => {
  const list = _globalListeners[type];
  if (!list || list.length === 0) return;
  for (const fn of list.slice()) {
    try { fn(payload); } catch (e: any) {
      console.error(`[dom-event] ${type} listener error:`, e?.message || e, e?.stack || '');
    }
  }
};

// ── console polyfill ─────────────────────────────────────────────────
// Routes console.log/warn/error/info to the Zig host's __hostLog global
// (registered in framework/qjs_runtime.zig). Without this, React's error
// reporting swallows the actual exception message and only prints the
// component-stack wrapper — which turns any render crash into "The above
// error occurred in <Foo>" with no cause visible.

(function installConsole() {
  const host: any = globalThis as any;
  const log: any = typeof host.__hostLog === 'function' ? host.__hostLog : null;

  function stringify(args: any[]): string {
    const parts: string[] = [];
    for (const a of args) {
      if (a === null) { parts.push('null'); continue; }
      if (a === undefined) { parts.push('undefined'); continue; }
      if (typeof a === 'string') { parts.push(a); continue; }
      if (a instanceof Error) {
        parts.push(a.stack || `${a.name}: ${a.message}`);
        continue;
      }
      try { parts.push(JSON.stringify(a)); }
      catch { parts.push(String(a)); }
    }
    return parts.join(' ');
  }

  const emit = (level: string, args: any[]) => {
    const msg = stringify(args);
    if (log) { try { log(level, msg); } catch {} }
  };

  (globalThis as any).console = {
    log:   (...a: any[]) => emit('log',   a),
    info:  (...a: any[]) => emit('info',  a),
    warn:  (...a: any[]) => emit('warn',  a),
    error: (...a: any[]) => emit('error', a),
    debug: (...a: any[]) => emit('debug', a),
    trace: (...a: any[]) => emit('trace', a),
  };
})();

// ── Timer subsystem ──────────────────────────────────────────────────
// QuickJS has no event loop of its own. The Zig host calls globalThis.__jsTick(now)
// every frame (from qjs_app.zig:appTick). __jsTick walks this array and fires
// any timers whose due time has arrived. Intervals re-enqueue themselves.

type TimerRecord = {
  id: number;
  due: number;       // absolute ms (performance.now() units)
  fn: () => void;
  interval: number;  // 0 = one-shot, >0 = setInterval period
  cleared: boolean;
};

const _timers: TimerRecord[] = [];
let _timerSeq = 1;
let _nowMs = 0;

(globalThis as any).performance = (globalThis as any).performance || { now: () => _nowMs };

(globalThis as any).setTimeout = (fn: () => void, ms?: number): number => {
  const id = _timerSeq++;
  _timers.push({ id, due: _nowMs + (ms ?? 0), fn, interval: 0, cleared: false });
  return id;
};

(globalThis as any).setInterval = (fn: () => void, ms?: number): number => {
  const id = _timerSeq++;
  const period = Math.max(1, ms ?? 0);
  _timers.push({ id, due: _nowMs + period, fn, interval: period, cleared: false });
  return id;
};

(globalThis as any).clearTimeout = (id: number): void => {
  for (const t of _timers) if (t.id === id) { t.cleared = true; return; }
};
(globalThis as any).clearInterval = (globalThis as any).clearTimeout;

// Called each frame by the Zig host. `now` is in ms (engine tick time).
let _tickCount = 0;
let _lastDbgPrint = 0;
(globalThis as any).__jsTick = (now: number): void => {
  _nowMs = now;
  _tickCount++;
  // Print diag every ~1s: tick count, pending timers, next due.
  if (now - _lastDbgPrint > 1000) {
    _lastDbgPrint = now;
    const nextDue = _timers.length > 0
      ? Math.min(...(_timers.filter((t) => !t.cleared).map((t) => t.due - now)))
      : -1;
    console.log(`[tick] count=${_tickCount} now=${now} timers=${_timers.length} nextDue=${nextDue}ms`);
  }
  // Two-phase: collect due timers, fire them, then cull/requeue.
  // Prevents infinite loops when interval callbacks schedule new timers.
  const due: TimerRecord[] = [];
  for (const t of _timers) {
    if (!t.cleared && t.due <= now) due.push(t);
  }
  for (const t of due) {
    if (t.cleared) continue;
    try { t.fn(); } catch (e: any) {
      // Try every reasonable way to get a message out of the thrown value.
      let desc = '(no details)';
      try {
        if (e == null) desc = `threw ${e === null ? 'null' : 'undefined'}`;
        else if (typeof e === 'string') desc = e;
        else if (e.stack) desc = String(e.stack);
        else if (e.message) desc = String(e.message);
        else { try { desc = JSON.stringify(e); } catch { desc = String(e); } }
      } catch {}
      console.error(`[timer] error id=${t.id} interval=${t.interval}ms: ${desc}`);
    }
    if (t.interval > 0 && !t.cleared) {
      t.due = now + t.interval;
    } else {
      t.cleared = true;
    }
  }
  // Compact: drop cleared/fired one-shots.
  for (let i = _timers.length - 1; i >= 0; i--) {
    if (_timers[i].cleared) _timers.splice(i, 1);
  }
};

// CJS default interop (QuickJS CJS wrappers from esbuild behave like Node's).
const React: any = require('react');
const Reconciler: any = require('react-reconciler');

import { hostConfig, setTransportFlush, handlerRegistry } from '../renderer/hostConfig';
import { prepareContext, releaseContext } from './effectContext';
import App from './current_app';

// Flush path: host's __hostFlush receives the JSON string.
setTransportFlush((cmds: any) => {
  const payload = typeof cmds === 'string' ? cmds : JSON.stringify(cmds);
  const host: any = globalThis as any;
  const hf: any = host.__hostFlush;
  if (typeof hf === 'function') {
    hf(payload);
    return;
  }

  // Hermes CLI fallback: emit the same line protocol the Zig hosts parse.
  const printer: any = host.print;
  if (typeof printer === 'function') {
    printer(`CMD ${payload}`);
  }
});

function getInputTextForNode(id: number): string {
  const host: any = globalThis as any;
  const getter: any = host.__getInputTextForNode;
  if (typeof getter !== 'function') return '';
  const value = getter(id);
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function getPreparedRightClickPayload() {
  const host: any = globalThis as any;
  const getter: any = host.__getPreparedRightClick;
  if (typeof getter !== 'function') return {};
  const payload = getter();
  return payload && typeof payload === 'object' ? payload : {};
}

function getPreparedScrollPayload() {
  const host: any = globalThis as any;
  const getter: any = host.__getPreparedScroll;
  if (typeof getter !== 'function') return {};
  const payload = getter();
  return payload && typeof payload === 'object' ? payload : {};
}

function dispatchAliases(id: number, aliases: string[], ...args: any[]) {
  const h = handlerRegistry.get(id);
  if (!h) return;
  for (const name of aliases) {
    const fn = h[name];
    if (typeof fn === 'function') {
      fn(...args);
      break;
    }
  }
}

function eventAliases(type: string): string[] {
  if (type === 'onClick') return ['onClick', 'onPress'];
  if (type === 'onPress') return ['onPress', 'onClick'];
  if (type === 'onHoverEnter') return ['onHoverEnter', 'onMouseEnter'];
  if (type === 'onHoverExit') return ['onHoverExit', 'onMouseLeave'];
  return [type];
}

(globalThis as any).__beginJsEvent = () => {};
(globalThis as any).__endJsEvent = () => {};

// Event dispatch entry from Zig — host calls this inside js_on_press eval.
(globalThis as any).__dispatchEvent = (id: number, type: string) => {
  // Route diagnostic through __hostLog directly — bypass the console polyfill
  // so we see dispatch logs even if something later overwrites globalThis.console.
  const host: any = globalThis as any;
  const hl: any = host.__hostLog;
  const h = handlerRegistry.get(id);
  const keys = h ? Object.keys(h).join(',') : '(no-entry)';
  if (typeof hl === 'function') { try { hl(0, `[dispatch] id=${id} type=${type} handlers=${keys}`); } catch {} }
  try {
    const payload = { targetId: id };
    dispatchAliases(id, eventAliases(type), payload);
  } catch (e: any) {
    if (typeof hl === 'function') {
      try { hl(2, `[dispatch] error id=${id} type=${type}: ${e?.message || e} ${e?.stack || ''}`); } catch {}
    }
  }
};

(globalThis as any).__dispatchInputChange = (id: number) => {
  try {
    const text = getInputTextForNode(id);
    const payload = { targetId: id, text };
    dispatchAliases(id, ['onChangeText', 'onChange', 'onInput'], text, payload);
  } catch (e) {
    // swallow — host prints nothing for eval exceptions except via QJS itself
  }
};

(globalThis as any).__dispatchInputSubmit = (id: number) => {
  try {
    const text = getInputTextForNode(id);
    const payload = { targetId: id, text };
    dispatchAliases(id, ['onSubmit', 'onSubmitEditing'], text, payload);
  } catch (e) {
    // swallow — host prints nothing for eval exceptions except via QJS itself
  }
};

(globalThis as any).__dispatchInputFocus = (id: number) => {
  try {
    dispatchAliases(id, ['onFocus'], { targetId: id });
  } catch (e) {
    // swallow — host prints nothing for eval exceptions except via QJS itself
  }
};

(globalThis as any).__dispatchInputBlur = (id: number) => {
  try {
    dispatchAliases(id, ['onBlur'], { targetId: id });
  } catch (e) {
    // swallow — host prints nothing for eval exceptions except via QJS itself
  }
};

(globalThis as any).__dispatchInputKey = (id: number, keyCode: number, mods: number) => {
  try {
    dispatchAliases(id, ['onKeyDown'], { targetId: id, keyCode, mods });
  } catch (e) {
    // swallow — host prints nothing for eval exceptions except via QJS itself
  }
};

(globalThis as any).__dispatchRightClick = (id: number) => {
  try {
    const payload = { targetId: id, ...getPreparedRightClickPayload() };
    dispatchAliases(id, ['onRightClick', 'onContextMenu'], payload);
  } catch (e) {
    // swallow — host prints nothing for eval exceptions except via QJS itself
  }
};

(globalThis as any).__dispatchScroll = (id: number) => {
  try {
    const payload = { targetId: id, ...getPreparedScrollPayload() };
    dispatchAliases(id, ['onScroll'], payload);
  } catch (e) {
    // swallow — host prints nothing for eval exceptions except via QJS itself
  }
};

(globalThis as any).__dispatchCanvasMove = (id: number, gx: number, gy: number) => {
  try {
    dispatchAliases(id, ['onMove'], { targetId: id, gx, gy });
  } catch (e) {
    // swallow — host prints nothing for eval exceptions except via QJS itself
  }
};

// Effect render dispatch. Host calls this once per frame per Effect node with
// a zero-copy ArrayBuffer view of the pixel buffer. We build (or reuse) a
// context object and invoke the user's onRender handler with it. The handler
// must finish all drawing before returning — host detaches the ArrayBuffer
// immediately after the call completes.
(globalThis as any).__dispatchEffectRender = (
  id: number,
  buffer: ArrayBuffer,
  width: number,
  height: number,
  stride: number,
  time: number,
  dt: number,
  mouse_x: number,
  mouse_y: number,
  mouse_inside: boolean,
  frame: number,
) => {
  const h = handlerRegistry.get(id);
  const fn = h?.onRender;
  if (typeof fn !== 'function') return;
  try {
    const ctx = prepareContext(id, buffer, width, height, stride, time, dt, mouse_x, mouse_y, mouse_inside, frame);
    fn(ctx);
  } catch (e: any) {
    const host: any = globalThis as any;
    const hl: any = host.__hostLog;
    if (typeof hl === 'function') {
      try { hl(2, `[effect] id=${id} error: ${e?.message || e} ${e?.stack || ''}`); } catch {}
    }
  }
};

(globalThis as any).__releaseEffectContext = (id: number) => {
  try { releaseContext(id); } catch {}
};

const reconciler = Reconciler(hostConfig);
const container = reconciler.createContainer({ id: 0 }, 0, null, false, null, '', (_e: any) => {}, null);
reconciler.updateContainer(React.createElement(App, {}), container, null, null);
