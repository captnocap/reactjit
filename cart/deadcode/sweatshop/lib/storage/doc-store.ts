/**
 * Document store — put / get / delete / list on top of SQLite.
 *
 * Each collection gets its own table. Documents are JSON-serialized
 * into a single TEXT column. Queries are filtered in JS (safe from
 * injection) after fetching all rows.
 */

import type { StorageAdapter, Query } from './types';
import { SQLiteDB } from './sqlite';
import { applyQuery } from './query';

export interface DocStoreOptions {
  /** Database path. Default: 'sweatshop.db' */
  dbPath?: string;
}

export class DocStore implements StorageAdapter {
  private db: SQLiteDB;

  constructor(options?: DocStoreOptions) {
    this.db = new SQLiteDB({ dbPath: options?.dbPath ?? 'sweatshop.db' });
  }

  private ensureTable(collection: string): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS "${collection}" (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
  }

  async get(collection: string, id: string): Promise<any | null> {
    this.ensureTable(collection);
    const rows = await this.db.query<{ data: string }>(
      `SELECT data FROM "${collection}" WHERE id = ?`,
      [id]
    );
    if (rows.length === 0) return null;
    try { return JSON.parse(rows[0].data); } catch { return null; }
  }

  async set(collection: string, id: string, data: any): Promise<void> {
    this.ensureTable(collection);
    const json = JSON.stringify({ ...data, id });
    await this.db.exec(
      `INSERT INTO "${collection}" (id, data, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET data = ?, updated_at = datetime('now')`,
      [id, json, json]
    );
  }

  async delete(collection: string, id: string): Promise<boolean> {
    this.ensureTable(collection);
    await this.db.exec(`DELETE FROM "${collection}" WHERE id = ?`, [id]);
    const affected = await this.db.changes();
    return affected > 0;
  }

  async list(collection: string, query?: Query): Promise<any[]> {
    this.ensureTable(collection);
    const rows = await this.db.query<{ data: string }>(
      `SELECT data FROM "${collection}" ORDER BY created_at`
    );
    let items = rows.map(r => {
      try { return JSON.parse(r.data); } catch { return null; }
    }).filter(Boolean);
    if (query) {
      items = applyQuery(items, query);
    }
    return items;
  }

  /** Close the underlying database. */
  close(): void {
    this.db.close();
  }
}
