/**
 * SQLite wrapper — open / exec / query / close.
 *
 * Thin veneer over runtime/hooks/sqlite.ts (host FFI bindings).
 * Sync under the hood; exposed as async for adapter compatibility.
 */

import { open, close, exec, query, lastRowId, changes, type DbHandle } from '../../../runtime/hooks/sqlite';

export { DbHandle };

export interface SQLiteOptions {
  /** Path to the SQLite database file. Default: ':memory:' for in-memory,
   *  or 'sweatshop.db' for persistent. */
  dbPath?: string;
}

export class SQLiteDB {
  private handle: DbHandle;
  private closed = false;

  constructor(options?: SQLiteOptions) {
    const dbPath = options?.dbPath ?? 'sweatshop.db';
    this.handle = open(dbPath);
    if (!this.handle) {
      throw new Error(`SQLite failed to open: ${dbPath}`);
    }
  }

  /** Execute DDL or DML with no result set (CREATE, INSERT, UPDATE, DELETE). */
  async exec(sql: string, params: any[] = []): Promise<boolean> {
    if (this.closed) throw new Error('SQLiteDB is closed');
    return exec(this.handle, sql, params);
  }

  /** Run a SELECT and return rows as objects. */
  async query<T = Record<string, any>>(sql: string, params: any[] = []): Promise<T[]> {
    if (this.closed) throw new Error('SQLiteDB is closed');
    return query<T>(this.handle, sql, params);
  }

  /** Last inserted rowid. */
  async lastRowId(): Promise<number> {
    if (this.closed) throw new Error('SQLiteDB is closed');
    return lastRowId(this.handle);
  }

  /** Rows affected by last write. */
  async changes(): Promise<number> {
    if (this.closed) throw new Error('SQLiteDB is closed');
    return changes(this.handle);
  }

  /** Close the database. */
  close(): void {
    if (!this.closed) {
      close(this.handle);
      this.closed = true;
    }
  }

  /** Raw handle for advanced use. */
  getHandle(): DbHandle {
    return this.handle;
  }
}

/** Open a database file (or create it). */
export function openDB(options?: SQLiteOptions): SQLiteDB {
  return new SQLiteDB(options);
}
