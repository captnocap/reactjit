/**
 * WASM app factory — entry point for love.js web builds.
 *
 * JS runs natively in the browser (not in QuickJS). The Lua side runs
 * in love.js WASM and communicates via Module.FS file polling (bridge_fs.lua).
 * The browser-side bridge (bridge.js) exposes window.ReactJITBridge.
 *
 * Usage:
 *   import { createWasmApp } from '@reactjit/native';
 *   const app = createWasmApp();
 *   app.render(<App />);
 */

import React from 'react';
import type { ReactNode } from 'react';
import type { IBridge, Listener, Unsubscribe } from '@reactjit/core';
import { BridgeProvider, RendererProvider } from '@reactjit/core';
import { createRoot } from './NativeRenderer';
import { initEventDispatching } from './eventDispatcher';
import { setTransportFlush } from './hostConfig';

// The global bridge object injected by bridge.js
declare global {
  interface Window {
    ReactJITBridge: {
      subscribe(type: string, fn: (payload: any) => void): () => void;
      send(type: string, payload?: any): void;
      flush(): void;
      rpc<T = any>(method: string, args?: any, timeoutMs?: number): Promise<T>;
      isReady(): boolean;
      setNamespace(ns: string): void;
      getSaveDir(): string | null;
    };
  }
  // Emscripten Module global
  var Module: {
    FS: {
      writeFile(path: string, data: string | Uint8Array): void;
      readFile(path: string, opts?: { encoding?: string }): any;
      stat(path: string): any;
      unlink(path: string): void;
    };
  };
}

/**
 * Adapter that wraps window.ReactJITBridge as an IBridge for React.
 */
class WasmBridge implements IBridge {
  private ext = window.ReactJITBridge;

  subscribe(type: string, fn: Listener): Unsubscribe {
    return this.ext.subscribe(type, fn);
  }

  send(type: string, payload?: any): void {
    this.ext.send(type, payload);
  }

  flush(): void {
    this.ext.flush();
  }

  rpc<T = any>(method: string, args?: any, timeoutMs?: number): Promise<T> {
    return this.ext.rpc<T>(method, args, timeoutMs);
  }

  setState(key: string, value: any): void {
    this.ext.send('state:update', { key, value });
  }

  isReady(): boolean {
    return this.ext.isReady();
  }

  onReady(callback: () => void): void {
    if (this.ext.isReady()) {
      callback();
    } else {
      this.ext.subscribe('bridge:ready', () => callback());
    }
  }

  destroy(): void {
    // Nothing to clean up — bridge.js lifecycle is tied to the page
  }
}

export interface WasmAppHandle {
  render(element: ReactNode): void;
  stop(): void;
  bridge: WasmBridge;
}

/** Get the Emscripten FS object from Module (patched into love.js at build time). */
function getFS(): any {
  const M = (window as any).Module;
  return (M && M.FS) || null;
}

// Find the love.filesystem save directory in Module.FS
function findSaveDir(): string | null {
  const fs = getFS();
  if (!fs) return null;

  const candidates = [
    '/home/web_user/love/reactjit-web/',
    '/home/web_user/love/',
    '/home/web_user/.local/share/love/reactjit-web/',
    '/home/web_user/.local/share/love/reactjit/',
    '/home/web_user/.local/share/love/',
  ];
  for (const dir of candidates) {
    try {
      fs.stat(dir);
      return dir;
    } catch { /* not found */ }
  }

  return null;
}

export function createWasmApp(): WasmAppHandle {
  const bridge = new WasmBridge();

  // Wire reconciler flush to write __reconciler_in.json via Module.FS.
  // The Lua side (init.lua) reads this file each frame in love.update.
  let saveDir: string | null = null;
  let pendingData: string | null = null; // buffered commands waiting for Module.FS

  setTransportFlush((commands) => {
    const data = typeof commands === 'string' ? commands : JSON.stringify(commands);

    if (!saveDir) saveDir = findSaveDir();
    if (!saveDir) {
      // Module.FS not ready yet — buffer and retry via polling
      pendingData = data;
      return;
    }

    try {
      const fs = getFS();
      const path = saveDir + '__reconciler_in.json';
      // Append to existing commands if Lua hasn't consumed them yet.
      // Multiple React commits can happen between Lua frames — merging
      // prevents earlier commands from being overwritten and lost.
      let merged = JSON.parse(data);
      try {
        fs.stat(path);
        const existing = fs.readFile(path, { encoding: 'utf8' });
        if (existing) {
          const prev = JSON.parse(existing);
          if (Array.isArray(prev)) {
            merged = prev.concat(merged);
          }
        }
      } catch { /* file doesn't exist yet — use data as-is */ }
      fs.writeFile(path, JSON.stringify(merged));
    } catch (e) {
      console.error('[WasmApp] Failed to write reconciler commands:', e);
    }
  });

  // Poll until Module.FS is available, then flush any buffered commands
  let pollCount = 0;
  const waitForFS = setInterval(() => {
    pollCount++;
    const M = (window as any).Module;
    if (pollCount <= 5 || pollCount % 30 === 0) {
      console.log(`[WasmApp] poll #${pollCount} FS=${!!(M && M.FS)} saveDir=${saveDir}`);
    }
    if (!saveDir) saveDir = findSaveDir();
    if (saveDir) {
      clearInterval(waitForFS);
      console.log('[WasmApp] Module.FS ready, saveDir=' + saveDir);
      if (pendingData) {
        try {
          (window as any).Module.FS.writeFile(saveDir + '__reconciler_in.json', pendingData);
          console.log('[WasmApp] Flushed buffered commands (' + pendingData.length + ' chars)');
        } catch (e) {
          console.error('[WasmApp] Failed to flush buffered commands:', e);
        }
        pendingData = null;
      }
    }
  }, 100);

  // Connect event dispatching (bridge events -> handlerRegistry)
  initEventDispatching(bridge);

  const root = createRoot();

  function doRender(element: ReactNode) {
    root.render(
      React.createElement(BridgeProvider, { bridge },
        React.createElement(RendererProvider, { mode: 'native' }, element)
      )
    );
  }

  return {
    bridge,
    render(element: ReactNode) {
      // Render immediately — the reconciler buffers commands.
      // The transport flush retries until Module.FS save dir is available.
      doRender(element);
    },
    stop() {
      root.unmount();
    },
  };
}
