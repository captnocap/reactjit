// Entry for reactjit-QuickJS host. The host (qjs_app.zig) registers
// globalThis.__hostFlush(json) before evaling this bundle. It also calls
// globalThis.__dispatchEvent(id, type) when the user presses a Node.

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
(globalThis as any).__jsTick = (now: number): void => {
  _nowMs = now;
  // Two-phase: collect due timers, fire them, then cull/requeue.
  // Prevents infinite loops when interval callbacks schedule new timers.
  const due: TimerRecord[] = [];
  for (const t of _timers) {
    if (!t.cleared && t.due <= now) due.push(t);
  }
  for (const t of due) {
    if (t.cleared) continue;
    try { t.fn(); } catch (_e) {}
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
  try {
    const payload = { targetId: id };
    dispatchAliases(id, eventAliases(type), payload);
  } catch (e) {
    // swallow — host prints nothing for eval exceptions except via QJS itself
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

const reconciler = Reconciler(hostConfig);
const container = reconciler.createContainer({ id: 0 }, 0, null, false, null, '', (_e: any) => {}, null);
reconciler.updateContainer(React.createElement(App, {}), container, null, null);
