import { register } from './registry';
import { rpc } from './rpc';
import type { CurrencyRates } from './types';

let _rates: CurrencyRates | null = null;
let _fetchPromise: Promise<CurrencyRates> | null = null;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/** Fetch or return cached exchange rates. */
export async function fetchRates(base: string = 'usd'): Promise<CurrencyRates> {
  if (_rates && _rates.base === base && Date.now() - _rates.timestamp < CACHE_TTL) {
    return _rates;
  }
  if (!_fetchPromise) {
    _fetchPromise = rpc<CurrencyRates>('convert:fetch_rates', { base })
      .then(rates => { _rates = rates; _fetchPromise = null; return rates; })
      .catch(err => { _fetchPromise = null; throw err; });
  }
  return _fetchPromise;
}

/** Convert between currencies. Always async. */
export async function convertCurrency(
  amount: number,
  from: string,
  to: string,
): Promise<number> {
  const rates = await fetchRates(from.toLowerCase());
  const rate = rates.rates[to.toLowerCase()];
  if (rate === undefined) throw new Error(`Unknown currency: ${to}`);
  return amount * rate;
}

/**
 * Register a currency pair into the conversion registry.
 * The converter is async — returns a Promise<number>.
 */
export function registerCurrencyPair(from: string, to: string): void {
  register(from, to, (v: number) => convertCurrency(v, from, to), 'currency');
}

// Register common pairs
const COMMON_CURRENCIES = ['usd', 'eur', 'gbp', 'jpy', 'cad', 'aud', 'chf', 'cny', 'krw', 'inr', 'brl', 'mxn'];
for (const from of COMMON_CURRENCIES) {
  for (const to of COMMON_CURRENCIES) {
    if (from !== to) registerCurrencyPair(from, to);
  }
}
