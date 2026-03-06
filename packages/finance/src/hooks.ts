/**
 * React hooks for finance — all one-liners that wire indicators to state.
 */

import { useMemo, useState, useRef, useCallback } from 'react';
import type { OHLCV, Holding, PortfolioSnapshot, Timeframe, BollingerBand, MACDPoint, StochPoint, IndicatorPoint, PatternSignal } from './types';
import { sma, ema, rsi, macd, bollingerBands, vwap, atr, detectPatterns, pivotPoints, stochastic, obv } from './indicators';
import { portfolioSnapshot, holdingPnL, sharpeRatio, maxDrawdown, equityToReturns } from './portfolio';

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

/** Compute all standard indicators for a candle series. Memoized. */
export function useTechnicalAnalysis(candles: OHLCV[]): TechnicalAnalysis {
  return useMemo(() => {
    const closes = candles.map(c => c.close);
    return {
      sma20: sma(closes, 20),
      sma50: sma(closes, 50),
      ema12: ema(closes, 12),
      ema26: ema(closes, 26),
      rsi14: rsi(closes, 14),
      macd: macd(closes),
      bollinger: bollingerBands(closes),
      vwap: vwap(candles),
      atr14: atr(candles),
      obv: obv(candles),
      stochastic: stochastic(candles),
      pivots: pivotPoints(candles),
      patterns: detectPatterns(candles),
    };
  }, [candles]);
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
  const [holdings, setHoldings] = useState<Holding[]>(initialHoldings);

  const snapshot = useMemo(() => portfolioSnapshot(holdings), [holdings]);

  const updatePrice = useCallback((symbol: string, price: number) => {
    setHoldings(prev => prev.map(h =>
      h.symbol === symbol ? { ...h, currentPrice: price } : h
    ));
  }, []);

  const addHolding = useCallback((h: Holding) => {
    setHoldings(prev => {
      const existing = prev.find(x => x.symbol === h.symbol);
      if (existing) {
        const totalQty = existing.quantity + h.quantity;
        const totalCost = existing.quantity * existing.avgCost + h.quantity * h.avgCost;
        return prev.map(x => x.symbol === h.symbol ? {
          ...x,
          quantity: totalQty,
          avgCost: totalQty === 0 ? 0 : totalCost / totalQty,
          currentPrice: h.currentPrice,
        } : x);
      }
      return [...prev, h];
    });
  }, []);

  const removeHolding = useCallback((symbol: string) => {
    setHoldings(prev => prev.filter(h => h.symbol !== symbol));
  }, []);

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

// ── Re-exports for convenience ───────────────────────────

export { holdingPnL, sharpeRatio, maxDrawdown, equityToReturns };
