/**
 * React hooks for finance — all one-liners that wire indicators to state.
 */

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useWebSocket, useLoveRPC } from '@reactjit/core';
import type { OHLCV, Holding, PortfolioSnapshot, BollingerBand, MACDPoint, StochPoint, IndicatorPoint, PatternSignal } from './types';
import { pivotPoints } from './indicators';
import { holdingPnL, sharpeRatio, maxDrawdown, equityToReturns } from './portfolio';

// ── Technical Analysis ───────────────────────────────────

export interface TechnicalAnalysis {
  sma20: number[];
  sma50: number[];
  ema12: number[];
  ema26: number[];
  rsi14: number[];
  macd: MACDPoint[];
  bollinger: BollingerBand[];
  vwap: IndicatorPoint[];
  atr14: IndicatorPoint[];
  obv: IndicatorPoint[];
  stochastic: StochPoint[];
  pivots: ReturnType<typeof pivotPoints>;
  patterns: PatternSignal[];
}

type NullableNumber = number | null | undefined;

interface TechnicalAnalysisRPC {
  sma20?: NullableNumber[];
  sma50?: NullableNumber[];
  ema12?: NullableNumber[];
  ema26?: NullableNumber[];
  rsi14?: NullableNumber[];
  macd?: Array<{
    time?: NullableNumber;
    macd?: NullableNumber;
    signal?: NullableNumber;
    histogram?: NullableNumber;
  }>;
  bollinger?: Array<{
    time?: NullableNumber;
    upper?: NullableNumber;
    middle?: NullableNumber;
    lower?: NullableNumber;
  }>;
  vwap?: Array<{ time?: NullableNumber; value?: NullableNumber }>;
  atr14?: Array<{ time?: NullableNumber; value?: NullableNumber }>;
  obv?: Array<{ time?: NullableNumber; value?: NullableNumber }>;
  stochastic?: Array<{ time?: NullableNumber; k?: NullableNumber; d?: NullableNumber }>;
  pivots?: {
    pivot?: NullableNumber;
    r1?: NullableNumber;
    r2?: NullableNumber;
    r3?: NullableNumber;
    s1?: NullableNumber;
    s2?: NullableNumber;
    s3?: NullableNumber;
  } | null;
  patterns?: PatternSignal[];
}

function asNumberOrNaN(value: NullableNumber): number {
  return typeof value === 'number' ? value : NaN;
}

function asNumberOrZero(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

function normalizeTechnicalAnalysis(raw: TechnicalAnalysisRPC | null | undefined, candles: OHLCV[]): TechnicalAnalysis {
  const len = candles.length;
  const numberSeries = (values?: NullableNumber[]): number[] => {
    const out = new Array<number>(len);
    for (let i = 0; i < len; i++) out[i] = asNumberOrNaN(values?.[i]);
    return out;
  };

  const macdSeries: MACDPoint[] = new Array(len);
  for (let i = 0; i < len; i++) {
    const p = raw?.macd?.[i];
    macdSeries[i] = {
      time: typeof p?.time === 'number' ? p.time : i,
      macd: asNumberOrNaN(p?.macd),
      signal: asNumberOrNaN(p?.signal),
      histogram: asNumberOrNaN(p?.histogram),
    };
  }

  const bollingerSeries: BollingerBand[] = new Array(len);
  for (let i = 0; i < len; i++) {
    const p = raw?.bollinger?.[i];
    bollingerSeries[i] = {
      time: typeof p?.time === 'number' ? p.time : i,
      upper: asNumberOrNaN(p?.upper),
      middle: asNumberOrNaN(p?.middle),
      lower: asNumberOrNaN(p?.lower),
    };
  }

  const toIndicatorSeries = (values?: Array<{ time?: NullableNumber; value?: NullableNumber }>): IndicatorPoint[] => {
    const out: IndicatorPoint[] = new Array(len);
    for (let i = 0; i < len; i++) {
      const p = values?.[i];
      out[i] = {
        time: typeof p?.time === 'number' ? p.time : (candles[i]?.time ?? i),
        value: asNumberOrNaN(p?.value),
      };
    }
    return out;
  };

  const stochasticSeries: StochPoint[] = new Array(len);
  for (let i = 0; i < len; i++) {
    const p = raw?.stochastic?.[i];
    stochasticSeries[i] = {
      time: typeof p?.time === 'number' ? p.time : (candles[i]?.time ?? i),
      k: asNumberOrNaN(p?.k),
      d: asNumberOrNaN(p?.d),
    };
  }

  const pivots = raw?.pivots
    ? {
        pivot: asNumberOrNaN(raw.pivots.pivot),
        r1: asNumberOrNaN(raw.pivots.r1),
        r2: asNumberOrNaN(raw.pivots.r2),
        r3: asNumberOrNaN(raw.pivots.r3),
        s1: asNumberOrNaN(raw.pivots.s1),
        s2: asNumberOrNaN(raw.pivots.s2),
        s3: asNumberOrNaN(raw.pivots.s3),
      }
    : null;

  return {
    sma20: numberSeries(raw?.sma20),
    sma50: numberSeries(raw?.sma50),
    ema12: numberSeries(raw?.ema12),
    ema26: numberSeries(raw?.ema26),
    rsi14: numberSeries(raw?.rsi14),
    macd: macdSeries,
    bollinger: bollingerSeries,
    vwap: toIndicatorSeries(raw?.vwap),
    atr14: toIndicatorSeries(raw?.atr14),
    obv: toIndicatorSeries(raw?.obv),
    stochastic: stochasticSeries,
    pivots,
    patterns: Array.isArray(raw?.patterns) ? (raw.patterns as PatternSignal[]) : [],
  };
}

function normalizeHolding(value: unknown): Holding {
  const h = value as Partial<Holding> | null | undefined;
  return {
    symbol: typeof h?.symbol === 'string' ? h.symbol : '',
    quantity: asNumberOrZero(h?.quantity),
    avgCost: asNumberOrZero(h?.avgCost),
    currentPrice: asNumberOrZero(h?.currentPrice),
  };
}

function normalizeHoldings(values: unknown): Holding[] {
  if (!Array.isArray(values)) return [];
  return values.map(normalizeHolding);
}

function emptyPortfolioSnapshot(holdings: Holding[]): PortfolioSnapshot {
  return {
    holdings,
    totalValue: 0,
    totalCost: 0,
    pnl: 0,
    pnlPercent: 0,
    allocation: [],
  };
}

function normalizePortfolioSnapshot(snapshot: unknown, fallbackHoldings: Holding[]): PortfolioSnapshot {
  const s = snapshot as {
    holdings?: unknown;
    totalValue?: unknown;
    totalCost?: unknown;
    pnl?: unknown;
    pnlPercent?: unknown;
    allocation?: Array<{ symbol?: unknown; weight?: unknown }>;
  } | null;
  const holdings = normalizeHoldings(s?.holdings ?? fallbackHoldings);
  return {
    holdings,
    totalValue: asNumberOrZero(s?.totalValue),
    totalCost: asNumberOrZero(s?.totalCost),
    pnl: asNumberOrZero(s?.pnl),
    pnlPercent: asNumberOrZero(s?.pnlPercent),
    allocation: Array.isArray(s?.allocation)
      ? s.allocation.map(a => ({
          symbol: typeof a?.symbol === 'string' ? a.symbol : '',
          weight: asNumberOrZero(a?.weight),
        }))
      : [],
  };
}

/** Compute all standard indicators for a candle series in Lua. */
export function useTechnicalAnalysis(candles: OHLCV[]): TechnicalAnalysis {
  const rpc = useLoveRPC<TechnicalAnalysisRPC>('finance:technical_analysis');
  const requestIdRef = useRef(0);
  const [value, setValue] = useState<TechnicalAnalysis>(() => normalizeTechnicalAnalysis(undefined, candles));

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    rpc({ candles })
      .then(result => {
        if (requestIdRef.current !== requestId) return;
        setValue(normalizeTechnicalAnalysis(result, candles));
      })
      .catch(() => {
        if (requestIdRef.current !== requestId) return;
        setValue(normalizeTechnicalAnalysis(undefined, candles));
      });
  }, [rpc, candles]);

  return value;
}

// ── Portfolio ────────────────────────────────────────────

/** Manage a list of holdings and compute portfolio metrics */
export function usePortfolio(initialHoldings: Holding[] = []): {
  snapshot: PortfolioSnapshot;
  holdings: Holding[];
  updatePrice: (symbol: string, price: number) => void;
  addHolding: (h: Holding) => void;
  removeHolding: (symbol: string) => void;
} {
  const snapshotRpc = useLoveRPC<PortfolioSnapshot>('finance:portfolio_snapshot');
  const updatePriceRpc = useLoveRPC<Holding[]>('finance:portfolio_update_price');
  const addHoldingRpc = useLoveRPC<Holding[]>('finance:portfolio_add_holding');
  const removeHoldingRpc = useLoveRPC<Holding[]>('finance:portfolio_remove_holding');

  const [holdings, setHoldings] = useState<Holding[]>(() => normalizeHoldings(initialHoldings));
  const holdingsRef = useRef(holdings);
  holdingsRef.current = holdings;

  const [snapshot, setSnapshot] = useState<PortfolioSnapshot>(() => emptyPortfolioSnapshot(holdings));
  const updateSeqRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    snapshotRpc({ holdings })
      .then(next => {
        if (cancelled) return;
        setSnapshot(normalizePortfolioSnapshot(next, holdings));
      })
      .catch(() => {
        if (cancelled) return;
        setSnapshot(emptyPortfolioSnapshot(holdings));
      });
    return () => { cancelled = true; };
  }, [snapshotRpc, holdings]);

  const updatePrice = useCallback((symbol: string, price: number) => {
    const requestId = ++updateSeqRef.current;
    updatePriceRpc({ holdings: holdingsRef.current, symbol, price })
      .then(next => {
        if (updateSeqRef.current !== requestId) return;
        setHoldings(normalizeHoldings(next));
      })
      .catch(() => {});
  }, [updatePriceRpc]);

  const addHolding = useCallback((h: Holding) => {
    const requestId = ++updateSeqRef.current;
    addHoldingRpc({ holdings: holdingsRef.current, holding: h })
      .then(next => {
        if (updateSeqRef.current !== requestId) return;
        setHoldings(normalizeHoldings(next));
      })
      .catch(() => {});
  }, [addHoldingRpc]);

  const removeHolding = useCallback((symbol: string) => {
    const requestId = ++updateSeqRef.current;
    removeHoldingRpc({ holdings: holdingsRef.current, symbol })
      .then(next => {
        if (updateSeqRef.current !== requestId) return;
        setHoldings(normalizeHoldings(next));
      })
      .catch(() => {});
  }, [removeHoldingRpc]);

  return { snapshot, holdings, updatePrice, addHolding, removeHolding };
}

// ── Synthetic Data (for demos) ───────────────────────────

/** Generate synthetic OHLCV candles for demo/testing */
export function useSyntheticCandles(opts?: {
  count?: number;
  startPrice?: number;
  volatility?: number;
  seed?: number;
}): { candles: OHLCV[]; append: () => void; reset: () => void } {
  const count = opts?.count ?? 60;
  const startPrice = opts?.startPrice ?? 100;
  const volatility = opts?.volatility ?? 2;
  const seed = opts?.seed ?? 42;

  const generate = useCallback((n: number) => {
    const candles: OHLCV[] = [];
    let price = startPrice;
    let s = seed;
    const rand = () => {
      s = (s * 16807 + 0) % 2147483647;
      return (s & 0x7fffffff) / 2147483647;
    };

    const now = Math.floor(Date.now() / 1000);
    for (let i = 0; i < n; i++) {
      const open = price;
      const drift = (rand() - 0.5) * volatility * 2;
      const close = Math.max(1, open + drift);
      const high = Math.max(open, close) + rand() * volatility;
      const low = Math.min(open, close) - rand() * volatility;
      const volume = 1000 + Math.floor(rand() * 9000);
      candles.push({
        time: now - (n - i) * 3600,
        open: +open.toFixed(2),
        high: +high.toFixed(2),
        low: +Math.max(0.01, low).toFixed(2),
        close: +close.toFixed(2),
        volume,
      });
      price = close;
    }
    return candles;
  }, [startPrice, volatility, seed]);

  const [candles, setCandles] = useState<OHLCV[]>(() => generate(count));

  const append = useCallback(() => {
    setCandles(prev => {
      const last = prev[prev.length - 1];
      const open = last.close;
      const drift = (Math.random() - 0.5) * volatility * 2;
      const close = Math.max(1, open + drift);
      const high = Math.max(open, close) + Math.random() * volatility;
      const low = Math.min(open, close) - Math.random() * volatility;
      const volume = 1000 + Math.floor(Math.random() * 9000);
      const next: OHLCV = {
        time: last.time + 3600,
        open: +open.toFixed(2),
        high: +high.toFixed(2),
        low: +Math.max(0.01, low).toFixed(2),
        close: +close.toFixed(2),
        volume,
      };
      const out = [...prev, next];
      if (out.length > 200) out.shift();
      return out;
    });
  }, [volatility]);

  const reset = useCallback(() => setCandles(generate(count)), [generate, count]);

  return { candles, append, reset };
}

// ── WalletConnect v2 Relay ──────────────────────────────

/**
 * Build a WalletConnect v2 relay URL.
 * This opens the relay transport only; pairing/session encryption
 * remains the responsibility of the WalletConnect protocol layer.
 */
export function walletConnectV2RelayUrl(
  projectId: string,
  auth?: string | null,
  relayUrl: string = 'wss://relay.walletconnect.com',
): string {
  const params = new URLSearchParams({ projectId });
  if (auth) params.set('auth', auth);
  return `${relayUrl}?${params.toString()}`;
}

/**
 * One-liner WebSocket connection to WalletConnect v2 relay.
 *
 * @example
 * const wc = useWalletConnectV2(process.env.WALLETCONNECT_PROJECT_ID ?? null);
 */
export function useWalletConnectV2(
  projectId: string | null,
  auth?: string | null,
  relayUrl: string = 'wss://relay.walletconnect.com',
): ReturnType<typeof useWebSocket> {
  const url = useMemo(() => {
    if (!projectId) return null;
    return walletConnectV2RelayUrl(projectId, auth, relayUrl);
  }, [projectId, auth, relayUrl]);

  return useWebSocket(url);
}

// ── Re-exports for convenience ───────────────────────────

export { holdingPnL, sharpeRatio, maxDrawdown, equityToReturns };
