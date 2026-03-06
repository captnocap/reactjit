// ── Types ────────────────────────────────────────────────
export type {
  OHLCV,
  Tick,
  BookLevel,
  OrderBook,
  IndicatorPoint,
  BollingerBand,
  MACDPoint,
  StochPoint,
  Holding,
  PortfolioSnapshot,
  Timeframe,
  PatternType,
  PatternSignal,
} from './types';

export { TIMEFRAME_SECONDS } from './types';

// ── Indicators (pure functions) ──────────────────────────
export {
  sma, ema, wma,
  rsi,
  macd,
  stochastic,
  bollingerBands,
  vwap, obv,
  atr, roc,
  pivotPoints,
  detectPatterns,
} from './indicators';

// ── Portfolio (pure functions) ───────────────────────────
export {
  portfolioSnapshot,
  holdingPnL,
  sharpeRatio,
  maxDrawdown,
  equityToReturns,
} from './portfolio';

// ── Formatting ───────────────────────────────────────────
export {
  formatCurrency,
  formatCompact,
  formatPercent,
  formatVolume,
  formatPrice,
  formatBps,
  spreadBps,
} from './format';

// ── React Hooks ──────────────────────────────────────────
export {
  useTechnicalAnalysis,
  usePortfolio,
  useSyntheticCandles,
} from './hooks';

// ── Components ───────────────────────────────────────────
export {
  TickerSymbol,
  TickerTape,
  HoldingRow,
  PortfolioCard,
  OrderBookPanel,
  RSIGauge,
  MACDPanel,
  IndicatorLegend,
} from './components';

export type {
  TickerItem,
  TickerSymbolProps,
  TickerTapeProps,
  HoldingRowProps,
  PortfolioCardProps,
  OrderBookPanelProps,
  RSIGaugeProps,
  MACDPanelProps,
  IndicatorLegendItem,
  IndicatorLegendProps,
} from './components';
