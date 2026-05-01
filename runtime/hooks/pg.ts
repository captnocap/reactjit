/**
 * pg — Postgres client backed by framework/pg.zig (pg.zig client + embedded
 * postgres spawned on first connect). Sync API; pg.zig is fast enough that
 * blocking the JS turn for ~ms-scale queries is fine.
 *
 * The framework spawns its own postgres on first connect (initdb at
 * `~/.cache/reactjit-embed/embed-pg/`, listens on a unix socket at
 * `~/.cache/reactjit-embed/embed-pg-sock/.s.PGSQL.5432`, trust auth, role
 * `embed`, db `embed_bench`). No system postgres install required, no sudo.
 *
 * To talk to a remote / system postgres instead, pass an explicit URI to
 * `connect()`. Connection pooling is per-URI; the same URI returns the same
 * pool handle.
 *
 * Registration (Zig side, see framework/v8_bindings_pg.zig):
 *
 *   __pg_connect(uri)                → handle | 0
 *   __pg_close(handle)               → void
 *   __pg_exec(handle, sql, paramsJson) → bool   DDL or write
 *   __pg_query_json(handle, sql, paramsJson) → object[]   rows by column name
 *   __pg_changes(handle)             → integer   rowcount of last write
 *
 * Param binding: pass an array of primitives. Booleans / numbers / strings /
 * null map to typed pg binds; objects / arrays serialize to JSONB on the way
 * down. For pgvector, pass the JS array as a JSON string and let postgres
 * cast — `'[0.1,0.2,…]'::vector` — or use a literal in the SQL.
 */

import { callHost, callHostJson, hasHost } from '../ffi';

export type PgHandle = number;

/** True when framework/v8_bindings_pg.zig is wired into this build. */
export function isAvailable(): boolean {
  return hasHost('__pg_connect');
}

/**
 * Open a connection (or pool) to a Postgres instance. Pass an empty string
 * to connect to the framework's own embedded postgres at the default
 * unix-socket path. Returns 0 on failure.
 */
export function connect(uri: string = ''): PgHandle {
  return callHost<number>('__pg_connect', 0, uri);
}

export function close(handle: PgHandle): void {
  callHost<void>('__pg_close', undefined as any, handle);
}

/** Execute DDL or a write. Returns true if the statement succeeded. */
export function exec(handle: PgHandle, sql: string, params: any[] = []): boolean {
  return callHost<boolean>('__pg_exec', false, handle, sql, JSON.stringify(params));
}

/**
 * Run a SELECT and return all rows. Each row is an object keyed by column
 * name. For million-row results, paginate with LIMIT/OFFSET — every row is
 * serialized through JSON on the Zig side.
 */
export function query<T = Record<string, any>>(
  handle: PgHandle,
  sql: string,
  params: any[] = [],
): T[] {
  return callHostJson<T[]>('__pg_query_json', [], handle, sql, JSON.stringify(params));
}

/** Rowcount of the last INSERT / UPDATE / DELETE on this handle. */
export function changes(handle: PgHandle): number {
  return callHost<number>('__pg_changes', 0, handle);
}

// ── Convenience wrapper ────────────────────────────────────────────

/** Thin OO wrapper. Open once, share the handle. */
export class Pg {
  constructor(private handle: PgHandle) {}

  static open(uri: string = ''): Pg | null {
    const h = connect(uri);
    return h === 0 ? null : new Pg(h);
  }

  exec(sql: string, params: any[] = []): boolean {
    return exec(this.handle, sql, params);
  }

  query<T = Record<string, any>>(sql: string, params: any[] = []): T[] {
    return query<T>(this.handle, sql, params);
  }

  changes(): number {
    return changes(this.handle);
  }

  close(): void {
    close(this.handle);
  }
}
