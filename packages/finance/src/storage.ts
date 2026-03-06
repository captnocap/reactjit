/**
 * Encrypted portfolio storage — persists holdings to SQLite, encrypted at rest.
 *
 * Uses @reactjit/core's useLocalStore for persistence and
 * @reactjit/crypto's encrypt/decrypt for at-rest encryption.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalStore } from '@reactjit/core';
import type { Holding, PortfolioSnapshot } from './types';
import { portfolioSnapshot } from './portfolio';

// ── Encryption helpers (inline to avoid hard dep on crypto bridge) ────

function simpleEncrypt(data: string, password: string): string {
  // XOR-based obfuscation for local storage. NOT cryptographically secure
  // on its own — use with @reactjit/crypto for real security.
  // This is a fallback when the crypto bridge isn't available.
  const key = password.split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
  const encoded = data.split('').map((c, i) => {
    const k = ((key >>> (i % 4) * 8) & 0xff) ^ (i * 7 + 13);
    return String.fromCharCode(c.charCodeAt(0) ^ (k & 0xff));
  }).join('');
  return btoa(encoded);
}

function simpleDecrypt(data: string, password: string): string {
  const key = password.split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
  const decoded = atob(data);
  return decoded.split('').map((c, i) => {
    const k = ((key >>> (i % 4) * 8) & 0xff) ^ (i * 7 + 13);
    return String.fromCharCode(c.charCodeAt(0) ^ (k & 0xff));
  }).join('');
}

// ── Types ────────────────────────────────────────────────

export interface EncryptedPortfolioStore {
  id: string;
  /** Encrypted JSON string of Holding[] */
  data: string;
  updatedAt: number;
}

export interface UseSecurePortfolioOptions {
  /** Storage key namespace. Default "finance_portfolio" */
  namespace?: string;
  /** Portfolio ID for multi-portfolio support. Default "default" */
  portfolioId?: string;
  /** Encryption password. Required for encryption. If omitted, stores plaintext. */
  password?: string;
  /** Optional external encrypt function (from @reactjit/crypto) */
  encrypt?: (plaintext: string, password: string) => Promise<string> | string;
  /** Optional external decrypt function (from @reactjit/crypto) */
  decrypt?: (ciphertext: string, password: string) => Promise<string> | string;
}

export interface SecurePortfolioResult {
  holdings: Holding[];
  snapshot: PortfolioSnapshot;
  loading: boolean;
  locked: boolean;
  /** Add or update a holding (merges by symbol) */
  upsertHolding: (h: Holding) => void;
  /** Remove a holding by symbol */
  removeHolding: (symbol: string) => void;
  /** Update the current price for a symbol */
  updatePrice: (symbol: string, price: number) => void;
  /** Replace all holdings at once */
  setHoldings: (holdings: Holding[]) => void;
  /** Lock the portfolio (clears in-memory state, requires password to unlock) */
  lock: () => void;
  /** Unlock with password */
  unlock: (password: string) => boolean;
}

// ── Hook ─────────────────────────────────────────────────

export function useSecurePortfolio(opts?: UseSecurePortfolioOptions): SecurePortfolioResult {
  const namespace = opts?.namespace ?? 'finance_portfolio';
  const portfolioId = opts?.portfolioId ?? 'default';
  const storeKey = `${namespace}:${portfolioId}`;

  const [stored, setStored] = useLocalStore<EncryptedPortfolioStore | null>(storeKey, null);
  const [holdings, setHoldingsState] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(!!opts?.password);
  const passwordRef = useRef(opts?.password ?? '');
  const encryptFn = opts?.encrypt ?? simpleEncrypt;
  const decryptFn = opts?.decrypt ?? simpleDecrypt;

  // Load and decrypt on mount or when stored changes
  useEffect(() => {
    if (!stored) {
      setHoldingsState([]);
      setLoading(false);
      setLocked(false);
      return;
    }

    const pw = passwordRef.current;
    if (!pw) {
      // No password — stored as plaintext JSON
      try {
        const parsed = JSON.parse(stored.data);
        setHoldingsState(Array.isArray(parsed) ? parsed : []);
      } catch {
        setHoldingsState([]);
      }
      setLoading(false);
      setLocked(false);
      return;
    }

    // Decrypt
    try {
      const result = decryptFn(stored.data, pw);
      const resolved = result instanceof Promise ? undefined : result;
      if (resolved !== undefined) {
        const parsed = JSON.parse(resolved);
        setHoldingsState(Array.isArray(parsed) ? parsed : []);
        setLocked(false);
      } else {
        // Handle async
        (result as Promise<string>).then(decrypted => {
          const parsed = JSON.parse(decrypted);
          setHoldingsState(Array.isArray(parsed) ? parsed : []);
          setLocked(false);
        }).catch(() => {
          setLocked(true);
        });
      }
    } catch {
      setLocked(true);
    }
    setLoading(false);
  }, [stored]);

  // Persist helper
  const persist = useCallback((newHoldings: Holding[]) => {
    const json = JSON.stringify(newHoldings);
    const pw = passwordRef.current;
    const data = pw ? encryptFn(json, pw) : json;
    if (data instanceof Promise) {
      data.then(encrypted => {
        setStored({ id: portfolioId, data: encrypted, updatedAt: Date.now() });
      });
    } else {
      setStored({ id: portfolioId, data: data as string, updatedAt: Date.now() });
    }
  }, [portfolioId, encryptFn, setStored]);

  const setHoldings = useCallback((h: Holding[]) => {
    setHoldingsState(h);
    persist(h);
  }, [persist]);

  const upsertHolding = useCallback((h: Holding) => {
    setHoldingsState(prev => {
      const existing = prev.find(x => x.symbol === h.symbol);
      let next: Holding[];
      if (existing) {
        const totalQty = existing.quantity + h.quantity;
        const totalCost = existing.quantity * existing.avgCost + h.quantity * h.avgCost;
        next = prev.map(x => x.symbol === h.symbol ? {
          ...x,
          quantity: totalQty,
          avgCost: totalQty === 0 ? 0 : totalCost / totalQty,
          currentPrice: h.currentPrice,
        } : x);
      } else {
        next = [...prev, h];
      }
      persist(next);
      return next;
    });
  }, [persist]);

  const removeHolding = useCallback((symbol: string) => {
    setHoldingsState(prev => {
      const next = prev.filter(h => h.symbol !== symbol);
      persist(next);
      return next;
    });
  }, [persist]);

  const updatePrice = useCallback((symbol: string, price: number) => {
    setHoldingsState(prev => {
      const next = prev.map(h =>
        h.symbol === symbol ? { ...h, currentPrice: price } : h
      );
      // Don't persist on every price tick — only on structural changes
      return next;
    });
  }, []);

  const lock = useCallback(() => {
    setHoldingsState([]);
    setLocked(true);
  }, []);

  const unlock = useCallback((password: string) => {
    if (!stored) return true;
    passwordRef.current = password;
    try {
      const result = decryptFn(stored.data, password);
      if (result instanceof Promise) {
        result.then(decrypted => {
          const parsed = JSON.parse(decrypted);
          setHoldingsState(Array.isArray(parsed) ? parsed : []);
          setLocked(false);
        }).catch(() => {});
        return true; // optimistic
      }
      const parsed = JSON.parse(result as string);
      setHoldingsState(Array.isArray(parsed) ? parsed : []);
      setLocked(false);
      return true;
    } catch {
      return false;
    }
  }, [stored, decryptFn]);

  const snapshot = portfolioSnapshot(holdings);

  return {
    holdings,
    snapshot,
    loading,
    locked,
    upsertHolding,
    removeHolding,
    updatePrice,
    setHoldings,
    lock,
    unlock,
  };
}
