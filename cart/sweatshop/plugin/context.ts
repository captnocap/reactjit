// ── PluginContext Implementation ─────────────────────────────────────

const host: any = globalThis;

function fsRead(path: string): string {
  try {
    if (typeof host.__fs_read !== 'function') return '';
    const out = host.__fs_read(path);
    return typeof out === 'string' ? out : '';
  } catch { return ''; }
}

function fsWrite(path: string, content: string): boolean {
  try {
    if (typeof host.__fs_write !== 'function') return false;
    return host.__fs_write(path, content) === true;
  } catch { return false; }
}

function fsExists(path: string): boolean {
  try {
    if (typeof host.__fs_exists !== 'function') return false;
    return host.__fs_exists(path) === true;
  } catch { return false; }
}

function fsList(path: string): string[] {
  try {
    if (typeof host.__fs_list_json !== 'function') return [];
    const json = host.__fs_list_json(path);
    return JSON.parse(typeof json === 'string' ? json : '[]');
  } catch { return []; }
}

function storeGet(key: string): string | null {
  try {
    if (typeof host.__store_get !== 'function') return null;
    const out = host.__store_get(key);
    return typeof out === 'string' ? out : null;
  } catch { return null; }
}

function storeSet(key: string, value: string): void {
  try {
    if (typeof host.__store_set !== 'function') return;
    host.__store_set(key, value);
  } catch {}
}

function execCmd(cmd: string): string {
  try {
    if (typeof host.__exec !== 'function') return '';
    const out = host.__exec(cmd);
    return typeof out === 'string' ? out : String(out ?? '');
  } catch { return ''; }
}

import type { PluginContext, PluginCommand, PluginPanel, PluginEventHandler, PluginNotification } from './types';

let _notificationId = 0;
let _globalNotificationHandler: ((n: PluginNotification) => void) | null = null;

export function setGlobalNotificationHandler(fn: (n: PluginNotification) => void) {
  _globalNotificationHandler = fn;
}

export function createPluginContext(
  pluginId: string,
  pluginName: string,
  react: any,
  primitives: any,
): PluginContext {
  const commands = new Map<string, PluginCommand>();
  const panels = new Map<string, PluginPanel>();
  const listeners = new Map<string, Set<PluginEventHandler>>();

  const ctx: PluginContext = {
    pluginId,
    pluginName,
    React: react,
    primitives,

    registerCommand(id: string, label: string, callback: () => void) {
      commands.set(id, { id, label, callback });
    },

    unregisterCommand(id: string) {
      commands.delete(id);
    },

    registerPanel(id: string, label: string, component: any) {
      panels.set(id, { id, label, component });
    },

    unregisterPanel(id: string) {
      panels.delete(id);
    },

    on(event: string, handler: PluginEventHandler) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(handler);
      return () => { listeners.get(event)?.delete(handler); };
    },

    emit(event: string, ...args: any[]) {
      listeners.get(event)?.forEach((h) => {
        try { h(...args); } catch (e) { /* swallow plugin errors */ }
      });
    },

    readSetting<T>(key: string, fallback?: T): T {
      const fullKey = `plugin:${pluginId}:${key}`;
      const raw = storeGet(fullKey);
      if (raw === null) return fallback as T;
      try { return JSON.parse(raw); } catch { return fallback as T; }
    },

    writeSetting<T>(key: string, value: T) {
      const fullKey = `plugin:${pluginId}:${key}`;
      storeSet(fullKey, JSON.stringify(value));
    },

    showNotification(message: string, type: PluginNotification['type'] = 'info') {
      _notificationId++;
      const n: PluginNotification = { id: `plugin-${_notificationId}`, message, type, time: Date.now() };
      _globalNotificationHandler?.(n);
    },

    exec: execCmd,
    readFile: fsRead,
    writeFile: fsWrite,
    pathExists: fsExists,
    listDir: fsList,
  };

  // Attach internal registries so the IDE can query them
  (ctx as any).__commands = commands;
  (ctx as any).__panels = panels;

  return ctx;
}
