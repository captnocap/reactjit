/**
 * useMemory — persistent key-value insight store for Claude.
 *
 * Uses useLocalStore with namespace 'claude_memory'. Survives restarts.
 * Entries have a category, text, and timestamp.
 */
import { useCallback } from 'react';
import { useLocalStore } from '@reactjit/core';

export type MemoryCategory = 'insight' | 'pattern' | 'decision' | 'bug' | 'user-pref';

export interface MemoryEntry {
  id: string;
  category: MemoryCategory;
  text: string;
  createdAt: number;
}

interface MemoryStore {
  entries: MemoryEntry[];
}

const DEFAULT: MemoryStore = { entries: [] };

let _idCounter = 0;
function makeId(): string {
  return `mem-${Date.now()}-${_idCounter++}`;
}

export function useMemory() {
  const [store, setStore] = useLocalStore<MemoryStore>('claude_memory', DEFAULT);

  const entries = store?.entries ?? [];

  const add = useCallback((text: string, category: MemoryCategory = 'insight') => {
    if (!text.trim()) return;
    const entry: MemoryEntry = {
      id: makeId(),
      category,
      text: text.trim(),
      createdAt: Date.now(),
    };
    setStore(prev => ({
      entries: [...(prev?.entries ?? []), entry],
    }));
  }, [setStore]);

  const remove = useCallback((id: string) => {
    setStore(prev => ({
      entries: (prev?.entries ?? []).filter(e => e.id !== id),
    }));
  }, [setStore]);

  const clear = useCallback(() => {
    setStore({ entries: [] });
  }, [setStore]);

  return { entries, add, remove, clear };
}
