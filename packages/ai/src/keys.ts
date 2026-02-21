/**
 * API key management built on @reactjit/storage.
 *
 * Stores API keys in the 'ai_keys' collection with the active storage adapter.
 * Keys persist across sessions via Love2D filesystem, SQLite, or localStorage.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AIProviderType, APIKeyRecord, APIKeysResult } from './types';

// Schema for API key records — defined inline to avoid hard dep on storage's z
// at import time (storage may not be in the bundle if user didn't select it).
const AI_KEYS_COLLECTION = 'ai_keys';

/**
 * Manage stored API keys. Requires a <StorageProvider> ancestor from @reactjit/storage.
 *
 * @example
 * const { keys, setKey, deleteKey, getKey } = useAPIKeys();
 * await setKey({ provider: 'openai', apiKey: 'sk-...' });
 * const key = getKey('openai');
 */
export function useAPIKeys(): APIKeysResult {
  const [keys, setKeys] = useState<APIKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const keysRef = useRef(keys);
  keysRef.current = keys;

  // Try to use storage via dynamic import pattern
  // Works when @reactjit/storage is in the bundle
  const storageRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    // Attempt to load keys from storage
    async function load() {
      try {
        // Use globalThis.__storageAdapter if set by StorageProvider,
        // or fall back to in-memory only
        const adapter = (globalThis as any).__storageAdapter;
        if (adapter) {
          storageRef.current = adapter;
          const items = await adapter.list(AI_KEYS_COLLECTION);
          if (!cancelled) {
            setKeys(items || []);
          }
        }
      } catch {
        // Storage not available — keys are in-memory only
      }
      if (!cancelled) setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const setKey = useCallback(async (
    record: Omit<APIKeyRecord, 'id'> & { id?: string },
  ): Promise<string> => {
    const id = record.id || `${record.provider}_${Date.now().toString(36)}`;
    const full: APIKeyRecord = { ...record, id } as APIKeyRecord;

    // Update local state
    setKeys(prev => {
      const filtered = prev.filter(k => k.id !== id);
      return [...filtered, full];
    });

    // Persist to storage
    if (storageRef.current) {
      try {
        await storageRef.current.set(AI_KEYS_COLLECTION, id, full);
      } catch {
        // Storage write failed — keys remain in memory
      }
    }

    return id;
  }, []);

  const deleteKey = useCallback(async (id: string): Promise<void> => {
    setKeys(prev => prev.filter(k => k.id !== id));

    if (storageRef.current) {
      try {
        await storageRef.current.delete(AI_KEYS_COLLECTION, id);
      } catch {
        // Storage delete failed
      }
    }
  }, []);

  const getKey = useCallback((provider: AIProviderType): APIKeyRecord | undefined => {
    return keysRef.current.find(k => k.provider === provider);
  }, []);

  return { keys, setKey, deleteKey, getKey, loading };
}
