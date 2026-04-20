/**
 * sqlite — SQLite bindings backed by framework/sqlite.zig (libsqlite3 linked).
 *
 * Sync API. SQLite is in-process and fast; network latency isn't a factor.
 * Open a database once, reuse the handle across queries.
 *
 * Registration (Zig side):
 *
 *   qjs_runtime.registerHostFn("__sql_open", @ptrCast(&sql_open), 1);
 *   qjs_runtime.registerHostFn("__sql_close", @ptrCast(&sql_close), 1);
 *   qjs_runtime.registerHostFn("__sql_exec", @ptrCast(&sql_exec), 2);
 *   qjs_runtime.registerHostFn("__sql_query_json", @ptrCast(&sql_query_json), 3);
 *   qjs_runtime.registerHostFn("__sql_last_rowid", @ptrCast(&sql_last_rowid), 1);
 *   qjs_runtime.registerHostFn("__sql_changes", @ptrCast(&sql_changes), 1);
 *
 * Param binding: pass params as an array argument. The Zig side serializes
 * them as JSON and the binding layer uses typed sqlite3_bind_* per element.
 */

import { callHost, callHostJson } from '../ffi';

export type DbHandle = number;

/** Open (or create) a database file. Returns a handle or 0 on failure. */
export function open(path: string): DbHandle {
  return callHost<number>('__sql_open', 0, path);
}

/** Close a database handle. */
export function close(handle: DbHandle): void {
  callHost<void>('__sql_close', undefined as any, handle);
}

/** Exec DDL or a single statement with no result set (CREATE, INSERT, UPDATE, DELETE). */
export function exec(handle: DbHandle, sql: string, params: any[] = []): boolean {
  return callHost<boolean>('__sql_exec', false, handle, JSON.stringify({ sql, params }));
}

/**
 * Run a SELECT and return all rows. Each row is an object keyed by column name.
 * For 1M-row results this serializes to JSON on the Zig side — use LIMIT in
 * the query for UI-visible listings.
 */
export function query<T = Record<string, any>>(handle: DbHandle, sql: string, params: any[] = []): T[] {
  return callHostJson<T[]>('__sql_query_json', [], handle, JSON.stringify({ sql, params }));
}

/** Last inserted rowid on this connection. */
export function lastRowId(handle: DbHandle): number {
  return callHost<number>('__sql_last_rowid', 0, handle);
}

/** Rows affected by the last write statement on this connection. */
export function changes(handle: DbHandle): number {
  return callHost<number>('__sql_changes', 0, handle);
}

// ── Convenience wrapper ─────────────────────────────────────────────

export class Db {
  constructor(public readonly handle: DbHandle) {}
  static open(path: string): Db { return new Db(open(path)); }
  close(): void { close(this.handle); }
  exec(sql: string, params: any[] = []): boolean { return exec(this.handle, sql, params); }
  query<T = Record<string, any>>(sql: string, params: any[] = []): T[] { return query<T>(this.handle, sql, params); }
  lastRowId(): number { return lastRowId(this.handle); }
  changes(): number { return changes(this.handle); }
}
