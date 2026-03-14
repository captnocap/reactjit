// ── OHLCV ────────────────────────────────────────────────

export interface OHLCV {
  time: number;       // unix timestamp (seconds)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Tick {
  time: number;
  price: number;
  size: number;
  side: 'buy' | 'sell';
}

export interface BookLevel {
  price: number;
  size: number;
}

export interface OrderBook {
  bids: BookLevel[];
  asks: BookLevel[];
  timestamp: number;
}

// ── Indicators ───────────────────────────────────────────

export interface IndicatorPoint {
  time: number;
  value: number;
}

export interface BollingerBand {
  time: number;
  upper: number;
  middle: number;
  lower: number;
}

export interface MACDPoint {
  time: number;
  macd: number;
  signal: number;
  histogram: number;
}

export interface StochPoint {
  time: number;
  k: number;
  d: number;
}

// ── Portfolio ────────────────────────────────────────────

export interface Holding {
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
}

export interface PortfolioSnapshot {
  holdings: Holding[];
  totalValue: number;
  totalCost: number;
  pnl: number;
  pnlPercent: number;
  allocation: Array<{ symbol: string; weight: number }>;
}

// ── Timeframe ────────────────────────────────────────────

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w' | '1M';

export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
  '1w': 604800,
  '1M': 2592000,
};
