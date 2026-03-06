import { rpc } from './rpc';
import type { EncryptedStoreOptions, EncryptedStore } from './types';

export async function createEncryptedStore<T = any>(opts: EncryptedStoreOptions): Promise<EncryptedStore<T>> {
  const store = new Map<string, any>();

  return {
    async get(key: string): Promise<T | null> {
      const envelope = store.get(key);
      if (envelope === undefined) return null;
      const r = await rpc<{ plaintext: string }>('crypto:decrypt', { data: envelope, password: opts.password });
      return JSON.parse(r.plaintext) as T;
    },

    async set(key: string, value: T): Promise<void> {
      const plaintext = JSON.stringify(value);
      const envelope = await rpc<any>('crypto:encrypt', { plaintext, password: opts.password });
      store.set(key, envelope);
    },

    async delete(key: string): Promise<void> {
      store.delete(key);
    },

    async list(): Promise<string[]> {
      return Array.from(store.keys());
    },

    async close(): Promise<void> {
      store.clear();
    },
  };
}
