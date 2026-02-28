/**
 * useToast — wraps toast:show RPC + logs every toast to localstore.
 *
 * Provides showToast(text, duration?) which:
 *   1. Appends to the persistent history (newest first, capped at 100)
 *   2. Fires the Lua toast:show RPC
 *
 * Pass showToast to useNotifications and any other callers so the log
 * is complete. Read history and clearHistory for the ToastHistoryOverlay.
 */
import { useCallback, useRef } from 'react';
import { useLoveRPC, useLocalStore } from '@reactjit/core';

export interface ToastEntry {
  id:   number;
  text: string;
  ts:   number;   // Date.now()
}

interface ToastStore {
  entries: ToastEntry[];
  nextId:  number;
}

const DEFAULT_STORE: ToastStore = { entries: [], nextId: 1 };
const MAX_ENTRIES = 100;

export function useToast() {
  const rpc    = useLoveRPC('toast:show');
  const rpcRef = useRef(rpc);
  rpcRef.current = rpc;

  const [store, setStore] = useLocalStore<ToastStore>('toast_history', DEFAULT_STORE);
  const setStoreRef = useRef(setStore);
  setStoreRef.current = setStore;

  const showToast = useCallback(async (text: string, duration?: number) => {
    // Log before firing — if RPC fails, log still records it
    setStoreRef.current(prev => {
      const p = prev ?? DEFAULT_STORE;
      const entry: ToastEntry = { id: p.nextId, text, ts: Date.now() };
      return {
        entries: [entry, ...p.entries].slice(0, MAX_ENTRIES),
        nextId:  p.nextId + 1,
      };
    });
    try {
      await rpcRef.current({ text, ...(duration != null ? { duration } : {}) });
    } catch { /* RPC failed — log still recorded */ }
  }, []);

  const clearHistory = useCallback(() => {
    setStoreRef.current({ entries: [], nextId: 1 });
  }, []);

  return {
    showToast,
    history:      store?.entries ?? [],
    clearHistory,
  };
}
