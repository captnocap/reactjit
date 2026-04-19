// Entry for reactjit-QuickJS host. The host (qjs_app.zig) registers
// globalThis.__hostFlush(json) before evaling this bundle. It also calls
// globalThis.__dispatchEvent(id, type) when the user presses a Node.

// Minimal polyfills — QuickJS has setTimeout but let's not assume.
const _timerQueue: Array<() => void> = [];
if (typeof (globalThis as any).setTimeout !== 'function') {
  (globalThis as any).setTimeout = (fn: () => void, _ms?: number) => { _timerQueue.push(fn); return 0; };
  (globalThis as any).clearTimeout = (_id: number) => {};
}
(globalThis as any).performance = (globalThis as any).performance || { now: () => Date.now() };

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

function drainTimerQueue() {
  while (_timerQueue.length) {
    const t = _timerQueue.shift()!;
    try { t(); } catch (_e) {}
  }
}

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
(globalThis as any).__endJsEvent = () => {
  drainTimerQueue();
};

// Event dispatch entry from Zig — host calls this inside js_on_press eval.
(globalThis as any).__dispatchEvent = (id: number, type: string) => {
  try {
    const payload = { targetId: id };
    dispatchAliases(id, eventAliases(type), payload);
    drainTimerQueue();
  } catch (e) {
    // swallow — host prints nothing for eval exceptions except via QJS itself
  }
};

(globalThis as any).__dispatchInputChange = (id: number) => {
  try {
    const text = getInputTextForNode(id);
    const payload = { targetId: id, text };
    dispatchAliases(id, ['onChangeText', 'onChange', 'onInput'], text, payload);
    drainTimerQueue();
  } catch (e) {
    // swallow — host prints nothing for eval exceptions except via QJS itself
  }
};

(globalThis as any).__dispatchInputSubmit = (id: number) => {
  try {
    const text = getInputTextForNode(id);
    const payload = { targetId: id, text };
    dispatchAliases(id, ['onSubmit', 'onSubmitEditing'], text, payload);
    drainTimerQueue();
  } catch (e) {
    // swallow — host prints nothing for eval exceptions except via QJS itself
  }
};

(globalThis as any).__dispatchInputFocus = (id: number) => {
  try {
    dispatchAliases(id, ['onFocus'], { targetId: id });
    drainTimerQueue();
  } catch (e) {
    // swallow — host prints nothing for eval exceptions except via QJS itself
  }
};

(globalThis as any).__dispatchInputBlur = (id: number) => {
  try {
    dispatchAliases(id, ['onBlur'], { targetId: id });
    drainTimerQueue();
  } catch (e) {
    // swallow — host prints nothing for eval exceptions except via QJS itself
  }
};

(globalThis as any).__dispatchInputKey = (id: number, keyCode: number, mods: number) => {
  try {
    dispatchAliases(id, ['onKeyDown'], { targetId: id, keyCode, mods });
    drainTimerQueue();
  } catch (e) {
    // swallow — host prints nothing for eval exceptions except via QJS itself
  }
};

(globalThis as any).__dispatchRightClick = (id: number) => {
  try {
    const payload = { targetId: id, ...getPreparedRightClickPayload() };
    dispatchAliases(id, ['onRightClick', 'onContextMenu'], payload);
    drainTimerQueue();
  } catch (e) {
    // swallow — host prints nothing for eval exceptions except via QJS itself
  }
};

(globalThis as any).__dispatchScroll = (id: number) => {
  try {
    const payload = { targetId: id, ...getPreparedScrollPayload() };
    dispatchAliases(id, ['onScroll'], payload);
    drainTimerQueue();
  } catch (e) {
    // swallow — host prints nothing for eval exceptions except via QJS itself
  }
};

const reconciler = Reconciler(hostConfig);
const container = reconciler.createContainer({ id: 0 }, 0, null, false, null, '', (_e: any) => {}, null);
reconciler.updateContainer(React.createElement(App, {}), container, null, null);
drainTimerQueue();
