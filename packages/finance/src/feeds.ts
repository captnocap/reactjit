/**
 * Live price feed hooks — aggregate multiple data sources into
 * a unified reactive price stream.
 *
 * Sources:
 * - CoinGecko REST API (polling)
 * - WebSocket streams (Binance, Coinbase, custom)
 * - Manual push (for scraped/custom data)
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useFetch, useWebSocket, useLuaInterval, useLoveRPC } from '@reactjit/core';
import type { OHLCV, Tick, OrderBook, BookLevel, Timeframe, TIMEFRAME_SECONDS } from './types';

// ── Types ────────────────────────────────────────────────

export interface PriceQuote {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  timestamp: number;
  source: string;
}

export interface PriceFeedOptions {
  /** Symbols to track. Format: "BTC", "ETH", etc. */
  symbols: string[];
  /** CoinGecko polling interval in ms. Default 30000. */
  pollInterval?: number;
  /** CoinGecko API key (optional, for higher rate limits) */
  apiKey?: string;
  /** Currency for price quotes. Default "usd" */
  currency?: string;
  /** Enable WebSocket stream for real-time updates */
  wsEnabled?: boolean;
  /** Custom WebSocket URL. Default: Binance public stream */
  wsUrl?: string;
}

export interface PriceFeedResult {
  /** Latest quotes keyed by symbol */
  quotes: Record<string, PriceQuote>;
  /** Whether the initial fetch is loading */
  loading: boolean;
  /** Connection status for WebSocket */
  wsStatus: string;
  /** Get a specific symbol's quote */
  getQuote: (symbol: string) => PriceQuote | null;
  /** Manually push a price update */
  pushPrice: (symbol: string, price: number, source?: string) => void;
  /** All quotes as an array sorted by symbol */
  all: PriceQuote[];
}

// ── CoinGecko symbol mapping ─────────────────────────────

const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  ADA: 'cardano',
  DOT: 'polkadot',
  AVAX: 'avalanche-2',
  MATIC: 'matic-network',
  LINK: 'chainlink',
  UNI: 'uniswap',
  ATOM: 'cosmos',
  NEAR: 'near',
  APT: 'aptos',
  ARB: 'arbitrum',
  OP: 'optimism',
  DOGE: 'dogecoin',
  SHIB: 'shiba-inu',
  XRP: 'ripple',
  LTC: 'litecoin',
  BCH: 'bitcoin-cash',
  FIL: 'filecoin',
  ICP: 'internet-computer',
  HBAR: 'hedera-hashgraph',
  VET: 'vechain',
  ALGO: 'algorand',
  AAVE: 'aave',
  MKR: 'maker',
  SNX: 'havven',
  COMP: 'compound-governance-token',
  CRV: 'curve-dao-token',
  SUSHI: 'sushi',
  XLM: 'stellar',
  EOS: 'eos',
  TRX: 'tron',
  FTM: 'fantom',
  SAND: 'the-sandbox',
  MANA: 'decentraland',
  AXS: 'axie-infinity',
  GALA: 'gala',
  ENJ: 'enjincoin',
  LRC: 'loopring',
  IMX: 'immutable-x',
  SUI: 'sui',
  SEI: 'sei-network',
  TIA: 'celestia',
  JUP: 'jupiter-exchange-solana',
  WIF: 'dogwifcoin',
  PEPE: 'pepe',
  BONK: 'bonk',
  RENDER: 'render-token',
  INJ: 'injective-protocol',
  TRB: 'tellor',
  FET: 'fetch-ai',
};

function symbolToCoingeckoId(symbol: string): string {
  return COINGECKO_IDS[symbol.toUpperCase()] ?? symbol.toLowerCase();
}

// ── Binance WS message parsing ───────────────────────────

interface BinanceTickerMsg {
  e: string; // event type
  s: string; // symbol e.g. "BTCUSDT"
  c: string; // last price
  P: string; // 24h change %
  v: string; // 24h volume
  h: string; // 24h high
  l: string; // 24h low
}

function asNumberOrZero(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

function normalizePriceQuote(value: unknown, fallbackSymbol: string): PriceQuote {
  const q = value as Partial<PriceQuote> | null | undefined;
  return {
    symbol: typeof q?.symbol === 'string' ? q.symbol : fallbackSymbol,
    price: asNumberOrZero(q?.price),
    change24h: asNumberOrZero(q?.change24h),
    volume24h: asNumberOrZero(q?.volume24h),
    high24h: asNumberOrZero(q?.high24h),
    low24h: asNumberOrZero(q?.low24h),
    timestamp: asNumberOrZero(q?.timestamp),
    source: typeof q?.source === 'string' ? q.source : 'manual',
  };
}

function normalizePriceQuotes(values: unknown): Record<string, PriceQuote> {
  if (!values || typeof values !== 'object' || Array.isArray(values)) return {};
  const out: Record<string, PriceQuote> = {};
  for (const [k, v] of Object.entries(values as Record<string, unknown>)) {
    const key = k.toUpperCase();
    out[key] = normalizePriceQuote(v, key);
  }
  return out;
}

function parseBinanceSymbol(s: string): string | null {
  // "BTCUSDT" → "BTC"
  if (s.endsWith('USDT')) return s.slice(0, -4);
  if (s.endsWith('USD')) return s.slice(0, -3);
  return null;
}

// ── Main hook ────────────────────────────────────────────

export function usePriceFeed(opts: PriceFeedOptions): PriceFeedResult {
  const {
    symbols,
    pollInterval = 30000,
    apiKey,
    currency = 'usd',
    wsEnabled = false,
    wsUrl,
  } = opts;

  const [quotes, setQuotes] = useState<Record<string, PriceQuote>>({});
  const quotesRef = useRef(quotes);
  quotesRef.current = quotes;
  const [loading, setLoading] = useState(true);
  const pushPriceRpc = useLoveRPC<Record<string, PriceQuote>>('finance:quotes_push_price');
  const pushSeqRef = useRef(0);
  const symbolsKey = symbols.join(',');

  // CoinGecko REST polling
  const cgIds = useMemo(() =>
    symbols.map(s => symbolToCoingeckoId(s)).join(','),
  [symbolsKey]);

  const cgUrl = useMemo(() => {
    if (!cgIds) return null;
    const params = new URLSearchParams({
      ids: cgIds,
      vs_currencies: currency,
      include_24hr_change: 'true',
      include_24hr_vol: 'true',
      include_high_24hr: 'true',
      include_low_24hr: 'true',
    });
    return `https://api.coingecko.com/api/v3/simple/price?${params}`;
  }, [cgIds, currency]);

  const headersRef = useRef<Record<string, string> | undefined>(
    apiKey ? { 'x-cg-demo-api-key': apiKey } : undefined
  );

  // Poll CoinGecko
  const fetchRef = useRef<() => void>();
  const doFetch = useCallback(() => {
    if (!cgUrl) return;
    const init: RequestInit = {};
    if (headersRef.current) init.headers = headersRef.current;
    fetch(cgUrl, init)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((data: any) => {
        setQuotes(prev => {
          const next = { ...prev };
          for (const sym of symbols) {
            const cgId = symbolToCoingeckoId(sym);
            const entry = data[cgId];
            if (!entry) continue;
            next[sym.toUpperCase()] = {
              symbol: sym.toUpperCase(),
              price: entry[currency] ?? 0,
              change24h: entry[`${currency}_24h_change`] ?? 0,
              volume24h: entry[`${currency}_24h_vol`] ?? 0,
              high24h: entry[`${currency}_24h_high`] ?? 0,
              low24h: entry[`${currency}_24h_low`] ?? 0,
              timestamp: Date.now(),
              source: 'coingecko',
            };
          }
          return next;
        });
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [cgUrl, symbolsKey, currency]);

  fetchRef.current = doFetch;

  useEffect(() => {
    doFetch();
  }, [doFetch]);

  useLuaInterval(pollInterval, () => {
    if (fetchRef.current) fetchRef.current();
  });

  // WebSocket stream (Binance by default)
  const wsStreamUrl = useMemo(() => {
    if (!wsEnabled) return null;
    if (wsUrl) return wsUrl;
    // Binance combined stream for all symbols
    const streams = symbols.map(s => `${s.toLowerCase()}usdt@ticker`).join('/');
    return `wss://stream.binance.com:9443/stream?streams=${streams}`;
  }, [wsEnabled, wsUrl, symbolsKey]);

  const { lastMessage } = useWebSocket(wsStreamUrl);

  useEffect(() => {
    if (!lastMessage) return;
    try {
      const msg = JSON.parse(lastMessage);
      // Binance combined stream wraps in { stream, data }
      const ticker: BinanceTickerMsg = msg.data ?? msg;
      if (ticker.e !== '24hrTicker' || !ticker.s) return;
      const sym = parseBinanceSymbol(ticker.s);
      if (!sym || !symbols.some(s => s.toUpperCase() === sym)) return;

      setQuotes(prev => ({
        ...prev,
        [sym]: {
          symbol: sym,
          price: parseFloat(ticker.c),
          change24h: parseFloat(ticker.P),
          volume24h: parseFloat(ticker.v),
          high24h: parseFloat(ticker.h),
          low24h: parseFloat(ticker.l),
          timestamp: Date.now(),
          source: 'binance-ws',
        },
      }));
    } catch {
      // Ignore malformed messages
    }
  }, [lastMessage, symbolsKey]);

  // Manual push
  const pushPrice = useCallback((symbol: string, price: number, source: string = 'manual') => {
    const key = symbol.toUpperCase();
    const requestId = ++pushSeqRef.current;
    const timestamp = Date.now();
    const current = quotesRef.current[key];
    pushPriceRpc({
      quotes: current ? { [key]: current } : {},
      symbol: key,
      price,
      source,
      timestamp,
    })
      .then(next => {
        if (pushSeqRef.current !== requestId) return;
        const normalized = normalizePriceQuotes(next);
        const quote = normalized[key];
        if (!quote) return;
        setQuotes(prev => {
          const prevQuote = prev[key];
          if (prevQuote && prevQuote.timestamp > quote.timestamp) return prev;
          return { ...prev, [key]: quote };
        });
      })
      .catch(() => {});
  }, [pushPriceRpc]);

  const getQuote = useCallback((symbol: string) => {
    return quotes[symbol.toUpperCase()] ?? null;
  }, [quotes]);

  const all = useMemo(() =>
    Object.values(quotes).sort((a, b) => a.symbol.localeCompare(b.symbol)),
  [quotes]);

  return {
    quotes,
    loading,
    wsStatus: wsStreamUrl ? 'enabled' : 'polling-only',
    getQuote,
    pushPrice,
    all,
  };
}

// ── OHLCV history from CoinGecko ─────────────────────────

export interface OHLCVHistoryOptions {
  symbol: string;
  /** Number of days to fetch. Default 7. */
  days?: number | 'max';
  currency?: string;
  apiKey?: string;
}

export interface OHLCVHistoryResult {
  candles: OHLCV[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useOHLCVHistory(opts: OHLCVHistoryOptions | null): OHLCVHistoryResult {
  const [candles, setCandles] = useState<OHLCV[]>([]);
  const [loading, setLoading] = useState(!!opts);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    if (!opts) {
      setCandles([]);
      setLoading(false);
      return;
    }

    const cgId = symbolToCoingeckoId(opts.symbol);
    const vs = opts.currency ?? 'usd';
    const days = opts.days ?? 7;
    const url = `https://api.coingecko.com/api/v3/coins/${cgId}/ohlc?vs_currency=${vs}&days=${days}`;

    setLoading(true);
    setError(null);

    const init: RequestInit = {};
    if (opts.apiKey) init.headers = { 'x-cg-demo-api-key': opts.apiKey };

    fetch(url, init)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((data: number[][]) => {
        // CoinGecko OHLC: [[timestamp, open, high, low, close], ...]
        const ohlcv: OHLCV[] = data.map(row => ({
          time: Math.floor(row[0] / 1000),
          open: row[1],
          high: row[2],
          low: row[3],
          close: row[4],
          volume: 0, // CoinGecko OHLC doesn't include volume
        }));
        setCandles(ohlcv);
        setLoading(false);
      })
      .catch(err => {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      });
  }, [opts?.symbol, opts?.days, opts?.currency, opts?.apiKey, tick]);

  return { candles, loading, error, refetch };
}
