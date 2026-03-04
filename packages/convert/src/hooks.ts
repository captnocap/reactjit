import { useState, useEffect, useCallback, useMemo } from 'react';
import { convert } from './convert';
import { fetchRates } from './currency';
import { listCategories, listUnits, canConvert } from './registry';

/**
 * Core conversion hook. Returns the convert function and registry introspection.
 *
 * @example
 * const c = useConvert();
 * const km = c.convert(5, 'mi').to('km');
 * const cats = c.categories();
 */
export function useConvert() {
  return useMemo(() => ({
    convert,
    categories: listCategories,
    unitsFor: listUnits,
    canConvert,
  }), []);
}

/**
 * Live currency rate hook. Fetches and caches exchange rates.
 *
 * @example
 * const { rate, loading, error, convert } = useCurrencyRate('usd', 'eur');
 */
export function useCurrencyRate(from: string, to: string) {
  const [rate, setRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchRates(from)
      .then(rates => {
        setRate(rates.rates[to.toLowerCase()] ?? null);
        setLoading(false);
      })
      .catch(err => {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      });
  }, [from, to]);

  const convertAmount = useCallback(
    (amount: number) => rate !== null ? amount * rate : null,
    [rate],
  );

  return { rate, loading, error, convert: convertAmount };
}

/**
 * Reactive unit conversion. Recomputes when inputs change.
 *
 * @example
 * const celsius = useUnitConvert(tempF, 'f', 'c');
 */
export function useUnitConvert(value: number, from: string, to: string): number | null {
  return useMemo(() => {
    if (!canConvert(from, to)) return null;
    const result = convert(value, from).to(to);
    return typeof result === 'number' ? result : null;
  }, [value, from, to]);
}
