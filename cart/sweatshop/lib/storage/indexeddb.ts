/**
 * Browser-style adapter backed by __localstore (host SQLite KV).
 *
 * Not true IndexedDB — we are a native desktop runtime — but implements
 * the StorageAdapter interface using the same host localstore that
 * useLocalStore uses. Good for testing, small data, and web-target builds.
 */

import type { StorageAdapter, Query } from './types';
import { applyQuery } from './query';

export class LocalStoreAdapter implements StorageAdapter {
  private prefix: string;

  constructor(namespace = 'docstore') {
    this.prefix = namespace + ':';
  }

  private key(collection: string, id: string): string {
    return this.prefix + collection + ':' + id;
  }

  async get(collection: string, id: string): Promise<any | null> {
    const raw = (globalThis as any).__localstore_get?.(this.key(collection, id));
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  async set(collection: string, id: string, data: any): Promise<void> {
    (globalThis as any).__localstore_set?.(
      this.key(collection, id),
      JSON.stringify({ ...data, id })
    );
  }

  async delete(collection: string, id: string): Promise<boolean> {
    const had = await this.get(collection, id);
    if (!had) return false;
    (globalThis as any).__localstore_set?.(this.key(collection, id), '');
    return true;
  }

  async list(collection: string, query?: Query): Promise<any[]> {
    const items: any[] = [];
    // We don't have a way to enumerate localstore keys, so this is limited.
    // In practice use DocStore (SQLite-backed) for listing.
    return applyQuery(items, query);
  }
}
