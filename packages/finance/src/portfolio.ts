/**
 * Portfolio calculations — pure functions.
 */

import type { Holding, PortfolioSnapshot } from './types';

/** Calculate a full portfolio snapshot from holdings */
export function portfolioSnapshot(holdings: Holding[]): PortfolioSnapshot {
  let totalValue = 0;
  let totalCost = 0;

  for (const h of holdings) {
    totalValue += h.quantity * h.currentPrice;
    totalCost += h.quantity * h.avgCost;
  }

  const pnl = totalValue - totalCost;
  const pnlPercent = totalCost === 0 ? 0 : (pnl / totalCost) * 100;

  const allocation = holdings.map(h => ({
    symbol: h.symbol,
    weight: totalValue === 0 ? 0 : (h.quantity * h.currentPrice) / totalValue,
  }));

  return { holdings, totalValue, totalCost, pnl, pnlPercent, allocation };
}

/** Calculate P&L for a single holding */
export function holdingPnL(h: Holding): { pnl: number; pnlPercent: number; marketValue: number } {
  const marketValue = h.quantity * h.currentPrice;
  const cost = h.quantity * h.avgCost;
  const pnl = marketValue - cost;
  const pnlPercent = cost === 0 ? 0 : (pnl / cost) * 100;
  return { pnl, pnlPercent, marketValue };
}

/** Sharpe ratio from a series of returns (daily or per-period) */
export function sharpeRatio(returns: number[], riskFreeRate: number = 0): number {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  const stdDev = Math.sqrt(variance);
  return stdDev === 0 ? 0 : (mean - riskFreeRate) / stdDev;
}

/** Max drawdown from an equity curve */
export function maxDrawdown(equityCurve: number[]): { drawdown: number; peak: number; trough: number } {
  let peak = equityCurve[0] ?? 0;
  let maxDd = 0;
  let ddPeak = peak;
  let ddTrough = peak;

  for (const v of equityCurve) {
    if (v > peak) peak = v;
    const dd = peak === 0 ? 0 : (peak - v) / peak;
    if (dd > maxDd) {
      maxDd = dd;
      ddPeak = peak;
      ddTrough = v;
    }
  }

  return { drawdown: maxDd, peak: ddPeak, trough: ddTrough };
}

/** Convert an equity curve to period returns */
export function equityToReturns(equityCurve: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = equityCurve[i - 1];
    out.push(prev === 0 ? 0 : (equityCurve[i] - prev) / prev);
  }
  return out;
}
