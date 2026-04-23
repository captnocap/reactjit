/**
 * runtime/hooks — per-domain FFI wrappers for framework capabilities.
 *
 * Usage:
 *   import { fs, sqlite, http } from '../../runtime/hooks';
 *   const text = fs.readFile('/etc/hostname');
 *   const db = sqlite.Db.open('app.db');
 *   const r = await http.getAsync('https://example.com');
 */

export * as fs from './fs';
export { math, listZigCallable } from './math';
export type { Vec2, Vec3, BBox2, BBox3, SmoothDampResult } from './math';
export * as sqlite from './sqlite';
export * as http from './http';
export * as crypto from './crypto';
export * as process from './process';
export * as localstore from './localstore';
export * as clipboard from './clipboard';
export * as websocket from './websocket';
export * as browserPage from './browser_page';
export { useHotState, removeHotState, clearHotState, hotStateKeys } from './useHotState';

export * from '../ffi';

/**
 * Install ALL browser-shim globals so copy-pasted React code works:
 *   globalThis.fetch   → http
 *   globalThis.localStorage → localstore
 *   globalThis.WebSocket → websocket
 *
 * Call once at the top of your cart entry (before <App /> mounts). Leaving
 * the shims OFF by default keeps things explicit — opt in per cart.
 */
export function installBrowserShims(): void {
  (require('./http') as typeof import('./http')).installFetchShim();
  (require('./localstore') as typeof import('./localstore')).installLocalStorageShim();
  (require('./websocket') as typeof import('./websocket')).installWebSocketShim();
}
