/**
 * CoinGecko API hooks.
 * Auth: None required for free tier. Optional API key for pro.
 * https://www.coingecko.com/en/api
 */

import { useAPI, qs, type APIResult } from './base';

const BASE = 'https://api.coingecko.com/api/v3';

// ── Types ───────────────────────────────────────────────

export interface CoinPrice {
  [coinId: string]: {
    [currency: string]: number;
    [currencyChange: `${string}_24h_change`]: number;
  };
}

export interface CoinMarket {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number | null;
  ath: number;
  ath_date: string;
  atl: number;
  atl_date: string;
  sparkline_in_7d?: { price: number[] };
}

export interface CoinDetail {
  id: string;
  symbol: string;
  name: string;
  description: { en: string };
  image: { thumb: string; small: string; large: string };
  market_data: {
    current_price: Record<string, number>;
    market_cap: Record<string, number>;
    total_volume: Record<string, number>;
    high_24h: Record<string, number>;
    low_24h: Record<string, number>;
    price_change_percentage_24h: number;
    price_change_percentage_7d: number;
    price_change_percentage_30d: number;
  };
  links: { homepage: string[]; blockchain_site: string[] };
  categories: string[];
}

export interface CoinHistory {
  prices: Array<[number, number]>;
  market_caps: Array<[number, number]>;
  total_volumes: Array<[number, number]>;
}

export interface CoinTrending {
  coins: Array<{
    item: { id: string; coin_id: number; name: string; symbol: string; thumb: string; score: number; price_btc: number };
  }>;
}

export interface CoinGlobal {
  data: {
    active_cryptocurrencies: number;
    markets: number;
    total_market_cap: Record<string, number>;
    total_volume: Record<string, number>;
    market_cap_percentage: Record<string, number>;
    market_cap_change_percentage_24h_usd: number;
  };
}

// ── Hooks ───────────────────────────────────────────────

function cgHeaders(apiKey?: string | null): Record<string, string> | undefined {
  return apiKey ? { 'x-cg-demo-api-key': apiKey } : undefined;
}

export function useCoinPrice(
  coinIds: string | string[] | null,
  opts?: { vs?: string; include24hChange?: boolean; apiKey?: string | null },
): APIResult<CoinPrice> {
  const ids = Array.isArray(coinIds) ? coinIds.join(',') : coinIds;
  const vs = opts?.vs ?? 'usd';
  return useAPI(
    ids
      ? `${BASE}/simple/price${qs({
          ids,
          vs_currencies: vs,
          include_24hr_change: opts?.include24hChange ?? true,
        })}`
      : null,
    { headers: cgHeaders(opts?.apiKey) },
  );
}

export function useCoinMarkets(
  opts?: { vs?: string; perPage?: number; page?: number; sparkline?: boolean; apiKey?: string | null },
): APIResult<CoinMarket[]> {
  return useAPI(
    `${BASE}/coins/markets${qs({
      vs_currency: opts?.vs ?? 'usd',
      order: 'market_cap_desc',
      per_page: opts?.perPage ?? 20,
      page: opts?.page ?? 1,
      sparkline: opts?.sparkline ?? false,
    })}`,
    { headers: cgHeaders(opts?.apiKey) },
  );
}

export function useCoinDetail(
  coinId: string | null,
  opts?: { apiKey?: string | null },
): APIResult<CoinDetail> {
  return useAPI(
    coinId ? `${BASE}/coins/${coinId}${qs({ localization: false, tickers: false, community_data: false, developer_data: false })}` : null,
    { headers: cgHeaders(opts?.apiKey) },
  );
}

export function useCoinHistory(
  coinId: string | null,
  opts?: { vs?: string; days?: number | 'max'; apiKey?: string | null },
): APIResult<CoinHistory> {
  return useAPI(
    coinId
      ? `${BASE}/coins/${coinId}/market_chart${qs({ vs_currency: opts?.vs ?? 'usd', days: opts?.days ?? 7 })}`
      : null,
    { headers: cgHeaders(opts?.apiKey) },
  );
}

export function useCoinTrending(
  opts?: { apiKey?: string | null },
): APIResult<CoinTrending> {
  return useAPI(`${BASE}/search/trending`, { headers: cgHeaders(opts?.apiKey) });
}

export function useCoinGlobal(
  opts?: { apiKey?: string | null },
): APIResult<CoinGlobal> {
  return useAPI(`${BASE}/global`, { headers: cgHeaders(opts?.apiKey) });
}
