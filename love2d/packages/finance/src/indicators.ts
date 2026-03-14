/**
 * Technical analysis indicators — pure functions, no React dependency.
 *
 * All functions accept a number[] of close prices (oldest first)
 * and return number[] aligned to the same index (NaN for warmup period).
 */

import type { OHLCV, IndicatorPoint, BollingerBand, MACDPoint, StochPoint } from './types';

// ── Moving Averages ──────────────────────────────────────

/** Simple Moving Average */
export function sma(data: number[], period: number): number[] {
  const out: number[] = new Array(data.length);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
    if (i >= period) sum -= data[i - period];
    out[i] = i >= period - 1 ? sum / period : NaN;
  }
  return out;
}

/** Exponential Moving Average */
export function ema(data: number[], period: number): number[] {
  const out: number[] = new Array(data.length);
  const k = 2 / (period + 1);
  let prev = NaN;
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      out[i] = NaN;
    } else if (i === period - 1) {
      // seed with SMA
      let sum = 0;
      for (let j = 0; j < period; j++) sum += data[j];
      prev = sum / period;
      out[i] = prev;
    } else {
      prev = data[i] * k + prev * (1 - k);
      out[i] = prev;
    }
  }
  return out;
}

/** Weighted Moving Average */
export function wma(data: number[], period: number): number[] {
  const out: number[] = new Array(data.length);
  const denom = (period * (period + 1)) / 2;
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { out[i] = NaN; continue; }
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - period + 1 + j] * (j + 1);
    }
    out[i] = sum / denom;
  }
  return out;
}

// ── Oscillators ──────────────────────────────────────────

/** Relative Strength Index */
export function rsi(data: number[], period: number = 14): number[] {
  const out: number[] = new Array(data.length);
  out[0] = NaN;

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i < data.length; i++) {
    const delta = data[i] - data[i - 1];
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? -delta : 0;

    if (i <= period) {
      avgGain += gain;
      avgLoss += loss;
      if (i === period) {
        avgGain /= period;
        avgLoss /= period;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        out[i] = 100 - 100 / (1 + rs);
      } else {
        out[i] = NaN;
      }
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      out[i] = 100 - 100 / (1 + rs);
    }
  }
  return out;
}

/** MACD (Moving Average Convergence Divergence) */
export function macd(
  data: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9,
): MACDPoint[] {
  const fastEma = ema(data, fastPeriod);
  const slowEma = ema(data, slowPeriod);

  const macdLine: number[] = new Array(data.length);
  for (let i = 0; i < data.length; i++) {
    macdLine[i] = isNaN(fastEma[i]) || isNaN(slowEma[i]) ? NaN : fastEma[i] - slowEma[i];
  }

  // Signal line = EMA of MACD line (skip NaN warmup)
  const validMacd: number[] = [];
  const validIndices: number[] = [];
  for (let i = 0; i < macdLine.length; i++) {
    if (!isNaN(macdLine[i])) {
      validMacd.push(macdLine[i]);
      validIndices.push(i);
    }
  }

  const signalEma = ema(validMacd, signalPeriod);
  const signalLine: number[] = new Array(data.length).fill(NaN);
  for (let i = 0; i < validIndices.length; i++) {
    signalLine[validIndices[i]] = signalEma[i];
  }

  const out: MACDPoint[] = [];
  for (let i = 0; i < data.length; i++) {
    const m = macdLine[i];
    const s = signalLine[i];
    out.push({
      time: i,
      macd: m,
      signal: s,
      histogram: isNaN(m) || isNaN(s) ? NaN : m - s,
    });
  }
  return out;
}

/** Stochastic Oscillator */
export function stochastic(
  candles: OHLCV[],
  kPeriod: number = 14,
  dPeriod: number = 3,
): StochPoint[] {
  const kValues: number[] = new Array(candles.length);

  for (let i = 0; i < candles.length; i++) {
    if (i < kPeriod - 1) { kValues[i] = NaN; continue; }
    let highMax = -Infinity;
    let lowMin = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (candles[j].high > highMax) highMax = candles[j].high;
      if (candles[j].low < lowMin) lowMin = candles[j].low;
    }
    const range = highMax - lowMin;
    kValues[i] = range === 0 ? 50 : ((candles[i].close - lowMin) / range) * 100;
  }

  const dValues = sma(kValues.map(v => isNaN(v) ? 0 : v), dPeriod);

  return candles.map((c, i) => ({
    time: c.time,
    k: kValues[i],
    d: isNaN(kValues[i]) ? NaN : dValues[i],
  }));
}

// ── Bands ────────────────────────────────────────────────

/** Bollinger Bands */
export function bollingerBands(
  data: number[],
  period: number = 20,
  multiplier: number = 2,
): BollingerBand[] {
  const middle = sma(data, period);
  const out: BollingerBand[] = [];

  for (let i = 0; i < data.length; i++) {
    if (isNaN(middle[i])) {
      out.push({ time: i, upper: NaN, middle: NaN, lower: NaN });
      continue;
    }
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = data[j] - middle[i];
      variance += diff * diff;
    }
    const stdDev = Math.sqrt(variance / period);
    out.push({
      time: i,
      upper: middle[i] + multiplier * stdDev,
      middle: middle[i],
      lower: middle[i] - multiplier * stdDev,
    });
  }
  return out;
}

// ── Volume Indicators ────────────────────────────────────

/** Volume Weighted Average Price */
export function vwap(candles: OHLCV[]): IndicatorPoint[] {
  let cumVolPrice = 0;
  let cumVol = 0;
  return candles.map(c => {
    const typical = (c.high + c.low + c.close) / 3;
    cumVolPrice += typical * c.volume;
    cumVol += c.volume;
    return { time: c.time, value: cumVol === 0 ? typical : cumVolPrice / cumVol };
  });
}

/** On-Balance Volume */
export function obv(candles: OHLCV[]): IndicatorPoint[] {
  let vol = 0;
  return candles.map((c, i) => {
    if (i > 0) {
      if (c.close > candles[i - 1].close) vol += c.volume;
      else if (c.close < candles[i - 1].close) vol -= c.volume;
    }
    return { time: c.time, value: vol };
  });
}

// ── Trend / Momentum ─────────────────────────────────────

/** Average True Range */
export function atr(candles: OHLCV[], period: number = 14): IndicatorPoint[] {
  const tr: number[] = candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const prevClose = candles[i - 1].close;
    return Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose));
  });

  const atrValues = ema(tr, period);
  return candles.map((c, i) => ({ time: c.time, value: atrValues[i] }));
}

/** Rate of Change (%) */
export function roc(data: number[], period: number = 12): number[] {
  return data.map((v, i) => {
    if (i < period) return NaN;
    const prev = data[i - period];
    return prev === 0 ? 0 : ((v - prev) / prev) * 100;
  });
}

// ── Support / Resistance ─────────────────────────────────

/** Simple pivot-based support/resistance levels */
export function pivotPoints(candles: OHLCV[]): {
  pivot: number;
  r1: number; r2: number; r3: number;
  s1: number; s2: number; s3: number;
} | null {
  if (candles.length === 0) return null;
  const last = candles[candles.length - 1];
  const { high, low, close } = last;
  const pivot = (high + low + close) / 3;
  return {
    pivot,
    r1: 2 * pivot - low,
    r2: pivot + (high - low),
    r3: high + 2 * (pivot - low),
    s1: 2 * pivot - high,
    s2: pivot - (high - low),
    s3: low - 2 * (high - pivot),
  };
}

// ── Pattern Detection ────────────────────────────────────

export type PatternType =
  | 'double_top'
  | 'double_bottom'
  | 'higher_high'
  | 'lower_low'
  | 'bullish_engulfing'
  | 'bearish_engulfing'
  | 'doji'
  | 'hammer'
  | 'shooting_star';

export interface PatternSignal {
  type: PatternType;
  index: number;
  confidence: number; // 0-1
}

/** Detect candlestick patterns in OHLCV data */
export function detectPatterns(candles: OHLCV[]): PatternSignal[] {
  const signals: PatternSignal[] = [];
  const len = candles.length;

  for (let i = 1; i < len; i++) {
    const curr = candles[i];
    const prev = candles[i - 1];
    const bodySize = Math.abs(curr.close - curr.open);
    const range = curr.high - curr.low;
    const prevBody = Math.abs(prev.close - prev.open);

    // Doji — body < 10% of range
    if (range > 0 && bodySize / range < 0.1) {
      signals.push({ type: 'doji', index: i, confidence: 1 - bodySize / range });
    }

    // Hammer — small body at top, long lower shadow
    const lowerShadow = Math.min(curr.open, curr.close) - curr.low;
    const upperShadow = curr.high - Math.max(curr.open, curr.close);
    if (range > 0 && lowerShadow > bodySize * 2 && upperShadow < bodySize * 0.5) {
      signals.push({ type: 'hammer', index: i, confidence: Math.min(1, lowerShadow / range) });
    }

    // Shooting star — small body at bottom, long upper shadow
    if (range > 0 && upperShadow > bodySize * 2 && lowerShadow < bodySize * 0.5) {
      signals.push({ type: 'shooting_star', index: i, confidence: Math.min(1, upperShadow / range) });
    }

    // Bullish engulfing
    if (prev.close < prev.open && curr.close > curr.open &&
        curr.open <= prev.close && curr.close >= prev.open) {
      signals.push({ type: 'bullish_engulfing', index: i, confidence: Math.min(1, bodySize / (prevBody || 1)) });
    }

    // Bearish engulfing
    if (prev.close > prev.open && curr.close < curr.open &&
        curr.open >= prev.close && curr.close <= prev.open) {
      signals.push({ type: 'bearish_engulfing', index: i, confidence: Math.min(1, bodySize / (prevBody || 1)) });
    }
  }

  // Double top / bottom (scan swing points)
  const highs: number[] = [];
  const lows: number[] = [];
  for (let i = 2; i < len - 2; i++) {
    if (candles[i].high > candles[i - 1].high && candles[i].high > candles[i - 2].high &&
        candles[i].high > candles[i + 1].high && candles[i].high > candles[i + 2].high) {
      highs.push(i);
    }
    if (candles[i].low < candles[i - 1].low && candles[i].low < candles[i - 2].low &&
        candles[i].low < candles[i + 1].low && candles[i].low < candles[i + 2].low) {
      lows.push(i);
    }
  }

  // Double top: two peaks within 1.5% of each other
  for (let i = 1; i < highs.length; i++) {
    const a = candles[highs[i - 1]].high;
    const b = candles[highs[i]].high;
    const diff = Math.abs(a - b) / Math.max(a, b);
    if (diff < 0.015) {
      signals.push({ type: 'double_top', index: highs[i], confidence: 1 - diff / 0.015 });
    }
  }

  // Double bottom: two troughs within 1.5%
  for (let i = 1; i < lows.length; i++) {
    const a = candles[lows[i - 1]].low;
    const b = candles[lows[i]].low;
    const diff = Math.abs(a - b) / Math.max(a, b);
    if (diff < 0.015) {
      signals.push({ type: 'double_bottom', index: lows[i], confidence: 1 - diff / 0.015 });
    }
  }

  return signals;
}
