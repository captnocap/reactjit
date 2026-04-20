/**
 * localstore — persistent key/value store backed by framework/localstore.zig.
 *
 * A drop-in replacement for browser `localStorage` for carts that copy-paste
 * React code assuming it exists. The underlying store persists to disk
 * (~/.cache/<app>/store.db by default).
 *
 * Registration (Zig side):
 *
 *   qjs_runtime.registerHostFn("__store_get", @ptrCast(&store_get), 1);
 *   qjs_runtime.registerHostFn("__store_set", @ptrCast(&store_set), 2);
 *   qjs_runtime.registerHostFn("__store_remove", @ptrCast(&store_remove), 1);
 *   qjs_runtime.registerHostFn("__store_clear", @ptrCast(&store_clear), 0);
 *   qjs_runtime.registerHostFn("__store_keys_json", @ptrCast(&store_keys_json), 0);
 */

import { callHost, callHostJson } from '../ffi';

/** Get a value by key. Returns null if missing. */
export function get(key: string): string | null {
  return callHost<string | null>('__store_get', null, key);
}

/** Set a key to a string value. */
export function set(key: string, value: string): void {
  callHost<void>('__store_set', undefined as any, key, value);
}

/** Remove a key. No-op if missing. */
export function remove(key: string): void {
  callHost<void>('__store_remove', undefined as any, key);
}

/** Wipe everything. */
export function clear(): void {
  callHost<void>('__store_clear', undefined as any);
}

/** List all keys. */
export function keys(): string[] {
  return callHostJson<string[]>('__store_keys_json', []);
}

// ── Typed helpers ──────────────────────────────────────────────────

/** Get a value as JSON-decoded T. Returns fallback on miss or parse failure. */
export function getJson<T>(key: string, fallback: T): T {
  const raw = get(key);
  if (raw == null) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

/** Set a value by JSON-encoding it. */
export function setJson(key: string, value: any): void {
  set(key, JSON.stringify(value));
}

// ── localStorage shim ──────────────────────────────────────────────
// Install as globalThis.localStorage so copy-pasted browser code just works.

export function installLocalStorageShim(): void {
  (globalThis as any).localStorage = {
    getItem: (k: string) => get(k),
    setItem: (k: string, v: string) => set(k, v),
    removeItem: (k: string) => remove(k),
    clear: () => clear(),
    key: (i: number) => keys()[i] ?? null,
    get length() { return keys().length; },
  };
}
