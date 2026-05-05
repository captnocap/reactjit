// ── Plugin Loader ────────────────────────────────────────────────────

import type { LoadedPlugin, PluginContext } from './types';
import { createPluginContext, setGlobalNotificationHandler } from './context';

const PLUGIN_DIR = `${(globalThis as any).__env_home || '/home/siah'}/.sweatshop/plugins`;

const host: any = globalThis;

function fsExists(path: string): boolean {
  try {
    if (typeof host.__fs_exists !== 'function') return false;
    return host.__fs_exists(path) === true;
  } catch { return false; }
}

function fsMkdir(path: string): boolean {
  try {
    if (typeof host.__fs_mkdir !== 'function') return false;
    host.__fs_mkdir(path);
    return true;
  } catch { return false; }
}

function fsList(path: string): string[] {
  try {
    if (typeof host.__fs_list_json !== 'function') return [];
    const json = host.__fs_list_json(path);
    return JSON.parse(typeof json === 'string' ? json : '[]');
  } catch { return []; }
}

function fsRead(path: string): string {
  try {
    if (typeof host.__fs_read !== 'function') return '';
    const out = host.__fs_read(path);
    return typeof out === 'string' ? out : '';
  } catch { return ''; }
}

function ensurePluginDir(): boolean {
  if (fsExists(PLUGIN_DIR)) return true;
  return fsMkdir(PLUGIN_DIR);
}

/** Parse a simple plugin manifest from the top of a JS file */
function parseManifest(code: string): { name: string; version: string } {
  const nameMatch = code.match(/@plugin\s+name\s+(.+)/);
  const versionMatch = code.match(/@plugin\s+version\s+(.+)/);
  return {
    name: nameMatch ? nameMatch[1].trim() : 'unnamed',
    version: versionMatch ? versionMatch[1].trim() : '0.0.1',
  };
}

export type PluginRegistry = {
  plugins: LoadedPlugin[];
  commands: Map<string, { pluginId: string; label: string; callback: () => void }>;
  panels: Map<string, { pluginId: string; label: string; component: any }>;
  notifications: any[];
  reload: () => void;
  onNotification: (fn: (n: any) => void) => () => void;
};

export function loadPlugins(react: any, primitives: any): PluginRegistry {
  const plugins: LoadedPlugin[] = [];
  const allCommands = new Map<string, { pluginId: string; label: string; callback: () => void }>();
  const allPanels = new Map<string, { pluginId: string; label: string; component: any }>();
  const notifications: any[] = [];
  const notifHandlers = new Set<(n: any) => void>();

  setGlobalNotificationHandler((n) => {
    notifications.push(n);
    notifHandlers.forEach((h) => h(n));
  });

  function scanAndLoad() {
    plugins.length = 0;
    allCommands.clear();
    allPanels.clear();

    if (!ensurePluginDir()) return;

    const files = fsList(PLUGIN_DIR).filter((f: string) => f.endsWith('.js'));

    for (const filename of files) {
      const filepath = `${PLUGIN_DIR}/${filename}`;
      const code = fsRead(filepath);
      if (!code.trim()) continue;

      const manifest = parseManifest(code);
      const pluginId = filename.replace(/\.js$/, '');

      const ctx = createPluginContext(pluginId, manifest.name, react, primitives);
      const loaded: LoadedPlugin = {
        id: pluginId,
        name: manifest.name,
        version: manifest.version,
        context: ctx,
      };

      try {
        // Wrap plugin code so it can use `ctx` directly, plus return an exports object
        const wrapped = `(function(ctx, React, exports) {\n${code}\n; return exports; })`;
        const fn = eval(wrapped);
        const exports = fn(ctx, react, {});

        if (typeof exports.activate === 'function') {
          exports.activate(ctx);
          loaded.activate = exports.activate;
        }
        if (typeof exports.deactivate === 'function') {
          loaded.deactivate = exports.deactivate;
        }
      } catch (e: any) {
        console.error(`[plugin] failed to load ${filename}:`, e?.message || String(e));
        continue;
      }

      // Harvest commands and panels from context
      const ctxCommands = (ctx as any).__commands as Map<string, any>;
      const ctxPanels = (ctx as any).__panels as Map<string, any>;

      if (ctxCommands) {
        ctxCommands.forEach((cmd, id) => {
          allCommands.set(id, { pluginId, label: cmd.label, callback: cmd.callback });
        });
      }
      if (ctxPanels) {
        ctxPanels.forEach((panel, id) => {
          allPanels.set(id, { pluginId, label: panel.label, component: panel.component });
        });
      }

      plugins.push(loaded);
    }
  }

  scanAndLoad();

  return {
    plugins,
    commands: allCommands,
    panels: allPanels,
    notifications,
    reload: scanAndLoad,
    onNotification: (fn) => {
      notifHandlers.add(fn);
      return () => notifHandlers.delete(fn);
    },
  };
}
