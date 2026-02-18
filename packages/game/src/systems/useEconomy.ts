import { useState, useRef, useCallback } from 'react';
import type { Currency } from '../types';

export interface EconomyConfig {
  currencies: { id: string; name: string; initial?: number }[];
}

export interface EconomyState {
  /** Get current amount of a currency */
  getBalance: (currencyId: string) => number;
  /** Add currency */
  earn: (currencyId: string, amount: number) => void;
  /** Remove currency (returns false if insufficient) */
  spend: (currencyId: string, amount: number) => boolean;
  /** Check if player can afford a cost */
  canAfford: (currencyId: string, amount: number) => boolean;
  /** Buy: check affordability and deduct */
  buy: (currencyId: string, price: number) => boolean;
  /** Sell: add currency */
  sell: (currencyId: string, price: number) => void;
  /** All currencies with current amounts */
  currencies: Currency[];
}

export function useEconomy(config: EconomyConfig): EconomyState {
  const [, forceRender] = useState(0);
  const balancesRef = useRef<Map<string, Currency>>(new Map());

  // Initialize
  if (balancesRef.current.size === 0) {
    for (const c of config.currencies) {
      balancesRef.current.set(c.id, {
        id: c.id,
        name: c.name,
        amount: c.initial ?? 0,
      });
    }
  }

  const getBalance = useCallback((currencyId: string): number => {
    return balancesRef.current.get(currencyId)?.amount ?? 0;
  }, []);

  const earn = useCallback((currencyId: string, amount: number) => {
    const currency = balancesRef.current.get(currencyId);
    if (currency) {
      currency.amount += amount;
      forceRender(n => n + 1);
    }
  }, []);

  const spend = useCallback((currencyId: string, amount: number): boolean => {
    const currency = balancesRef.current.get(currencyId);
    if (!currency || currency.amount < amount) return false;
    currency.amount -= amount;
    forceRender(n => n + 1);
    return true;
  }, []);

  const canAfford = useCallback((currencyId: string, amount: number): boolean => {
    return (balancesRef.current.get(currencyId)?.amount ?? 0) >= amount;
  }, []);

  const buy = useCallback((currencyId: string, price: number): boolean => {
    return spend(currencyId, price);
  }, [spend]);

  const sell = useCallback((currencyId: string, price: number) => {
    earn(currencyId, price);
  }, [earn]);

  return {
    getBalance,
    earn,
    spend,
    canAfford,
    buy,
    sell,
    currencies: Array.from(balancesRef.current.values()),
  };
}
