/**
 * Finance — Package documentation page (Layout2 zigzag narrative).
 *
 * Technical analysis, portfolio management, candlestick charts, order books,
 * pattern detection, and formatting utilities. Lua-owned runtime compute with
 * React hook wrappers and ready-made display components.
 *
 * Static hoist ALL code strings and style objects outside the component.
 */

import React, { useState } from 'react';
import { Box, Text, Image, ScrollView, CodeBlock, Pressable, CandlestickChart, DepthChart, BarChart, Switch, classifiers as S} from '../../../packages/core/src';
import type { ChartOverlay } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import {
  useTechnicalAnalysis,
  usePortfolio,
  useSyntheticCandles,
  useSecurePortfolio,
  formatCurrency,
  formatPercent,
  formatCompact,
  formatPrice,
  formatBps,
  spreadBps,
} from '../../../packages/finance/src';
import type { OHLCV, Holding } from '../../../packages/finance/src';
import {
  TickerTape,
  PortfolioCard,
  OrderBookPanel,
  RSIGauge,
  MACDPanel,
  IndicatorLegend,
  HoldingRow,
} from '../../../packages/finance/src/components';
import type { BookLevel, TickerItem } from '../../../packages/finance/src';
import {Band, Half, Divider, SectionLabel, PageColumn} from './_shared/StoryScaffold';
import { useLuaInterval } from '../../../packages/core/src';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#3b82f6',
  accentDim: 'rgba(59, 130, 246, 0.12)',
  callout: 'rgba(34, 197, 94, 0.06)',
  calloutBorder: 'rgba(34, 197, 94, 0.35)',
  green: '#22c55e',
  red: '#ef4444',
  blue: '#3b82f6',
  yellow: '#f59e0b',
  purple: '#a78bfa',
  teal: '#14b8a6',
  pink: '#ec4899',
  orange: '#f97316',
};

// ── Static code blocks (hoisted — never recreated) ──────

const INSTALL_CODE = `import {
  useTechnicalAnalysis,
  usePortfolio,
  useSyntheticCandles,
  sma, ema, wma, rsi, macd,
  stochastic, bollingerBands,
  vwap, obv, atr, roc,
  detectPatterns, pivotPoints,
  formatCurrency, formatPercent,
  formatCompact, formatPrice,
  TickerTape, PortfolioCard,
  OrderBookPanel, RSIGauge,
  MACDPanel, IndicatorLegend,
} from '@reactjit/finance'`;

const TA_CODE = `// One hook computes ALL standard indicators
const ta = useTechnicalAnalysis(candles)
// ta.sma20, ta.sma50, ta.ema12, ta.ema26
// ta.rsi14, ta.macd, ta.bollinger
// ta.vwap, ta.atr14, ta.obv
// ta.stochastic, ta.pivots, ta.patterns`;

const PORTFOLIO_CODE = `const { snapshot, holdings, updatePrice,
  addHolding, removeHolding } = usePortfolio([
  { symbol: 'BTC', quantity: 0.5,
    avgCost: 42000, currentPrice: 68000 },
])

// snapshot.totalValue, snapshot.pnl,
// snapshot.pnlPercent, snapshot.allocation`;

const INDICATORS_CODE = `// Pure functions — no React dependency
const closes = candles.map(c => c.close)
const ma20   = sma(closes, 20)
const ma50   = sma(closes, 50)
const rsi14  = rsi(closes, 14)
const bb     = bollingerBands(closes, 20, 2)
const mac    = macd(closes, 12, 26, 9)
const stoch  = stochastic(candles, 14, 3)
const vw     = vwap(candles)
const vol    = obv(candles)
const tr     = atr(candles, 14)`;

const PATTERN_CODE = `const signals = detectPatterns(candles)
// [{ type: 'doji', index: 42, confidence: 0.95 },
//  { type: 'bullish_engulfing', index: 58, ... }]
//
// Patterns: doji, hammer, shooting_star,
// bullish_engulfing, bearish_engulfing,
// double_top, double_bottom,
// higher_high, lower_low`;

const COMPONENTS_CODE = `<TickerTape items={[
  { symbol: 'BTC', price: 68420, change: 2.4 },
]} />
<PortfolioCard snapshot={snapshot} />
<OrderBookPanel bids={bids} asks={asks} />
<RSIGauge value={65.3} />
<MACDPanel points={ta.macd} />
<IndicatorLegend items={legendItems} />
<HoldingRow holding={holding} />`;

const FORMAT_CODE = `formatCurrency(1234.56)  // "$1,234.56"
formatPercent(2.4)       // "+2.40%"
formatCompact(1200000)   // "1.2M"
formatPrice(0.00123)     // "$0.0012"
formatVolume(24100000)   // "24.1M"
formatBps(12.5)          // "12.5 bps"
spreadBps(100.5, 101.2)  // 6.95`;

const PORTFOLIO_MATH_CODE = `import {
  portfolioSnapshot,
  holdingPnL,
  sharpeRatio,
  maxDrawdown,
  equityToReturns,
} from '@reactjit/finance'

const snap = portfolioSnapshot(holdings)
const { pnl, pnlPercent } = holdingPnL(h)
const sr = sharpeRatio(returns, 0.02)
const dd = maxDrawdown(equityCurve)`;

const OVERLAY_CODE = `// Chart overlays — draw MA/EMA/Bollinger on candles
<CandlestickChart
  data={candles}
  height={280}
  overlays={[
    { values: ta.sma20, color: '#3b82f6', lineWidth: 1.5 },
    { values: ta.sma50, color: '#f59e0b', lineWidth: 1.5 },
    { // Bollinger Band (fill between upper/lower)
      values: ta.bollinger.map(b => b.middle),
      upper: ta.bollinger.map(b => b.upper),
      lower: ta.bollinger.map(b => b.lower),
      color: '#a78bfa',
      fillColor: 'rgba(167,139,250,0.08)',
    },
  ]}
/>`;

const DEPTH_CODE = `import { DepthChart } from '@reactjit/core'

<DepthChart
  bids={orderBook.bids}
  asks={orderBook.asks}
  height={160}
  bidColor="#22c55e"
  askColor="#ef4444"
  bidFillColor="rgba(34,197,94,0.15)"
  askFillColor="rgba(239,68,68,0.15)"
/>`;

const SECURE_CODE = `import { useSecurePortfolio } from '@reactjit/finance'

const {
  holdings, snapshot, locked,
  upsertHolding, removeHolding,
  updatePrice, lock, unlock,
} = useSecurePortfolio({
  password: 'my-secret',
  // Optional: plug in @reactjit/crypto
  // encrypt: crypto.encrypt,
  // decrypt: crypto.decrypt,
})`;

const FEED_CODE = `import { usePriceFeed, useOHLCVHistory } from '@reactjit/finance'

const { quotes, all, getQuote, pushPrice } = usePriceFeed({
  symbols: ['BTC', 'ETH', 'SOL'],
  pollInterval: 30000, // CoinGecko polling
  wsEnabled: true,     // Binance WebSocket
})

// OHLCV history from CoinGecko
const { candles } = useOHLCVHistory({
  symbol: 'BTC', days: 30,
})`;

// ── Synthetic order book ─────────────────────────────────

function makeBook(lastPrice: number, seed: number): { bids: BookLevel[]; asks: BookLevel[] } {
  const bids: BookLevel[] = [];
  const asks: BookLevel[] = [];
  let s = seed;
  const rand = () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s & 0x7fffffff) / 2147483647;
  };
  for (let i = 0; i < 10; i++) {
    bids.push({ price: +(lastPrice - 0.05 - i * 0.03 - rand() * 0.02).toFixed(2), size: 20 + Math.floor(rand() * 300) });
    asks.push({ price: +(lastPrice + 0.05 + i * 0.03 + rand() * 0.02).toFixed(2), size: 20 + Math.floor(rand() * 300) });
  }
  return { bids, asks };
}

// ── Ticker data ──────────────────────────────────────────

function makeTicker(candles: OHLCV[]): TickerItem[] {
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2] ?? last;
  const change = prev.close === 0 ? 0 : ((last.close - prev.close) / prev.close) * 100;
  return [
    { symbol: 'SYN/USD', price: last.close, change },
    { symbol: 'BTC', price: 68420, change: 2.4 },
    { symbol: 'ETH', price: 3891, change: -1.2 },
    { symbol: 'SOL', price: 178, change: 5.7 },
    { symbol: 'AAPL', price: 227, change: 0.8 },
  ];
}

// ── Pattern helpers ──────────────────────────────────────

function patternColor(type: string): string {
  if (type.includes('bull') || type === 'hammer' || type === 'double_bottom') return C.green;
  if (type.includes('bear') || type === 'shooting_star' || type === 'double_top') return C.red;
  return C.accent;
}

function patternLabel(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── Demo holdings ────────────────────────────────────────

const DEMO_HOLDINGS: Holding[] = [
  { symbol: 'BTC', quantity: 0.5, avgCost: 42000, currentPrice: 68420 },
  { symbol: 'ETH', quantity: 4.2, avgCost: 2800, currentPrice: 3891 },
  { symbol: 'SOL', quantity: 25, avgCost: 95, currentPrice: 178 },
  { symbol: 'AAPL', quantity: 10, avgCost: 180, currentPrice: 227 },
  { symbol: 'NVDA', quantity: 8, avgCost: 85, currentPrice: 132 },
];

// ── Indicator catalog ────────────────────────────────────

const INDICATORS = [
  { label: 'SMA', desc: 'Simple Moving Average', color: C.blue },
  { label: 'EMA', desc: 'Exponential Moving Average', color: C.teal },
  { label: 'WMA', desc: 'Weighted Moving Average', color: C.purple },
  { label: 'RSI', desc: 'Relative Strength Index (0-100)', color: C.yellow },
  { label: 'MACD', desc: 'Moving Average Convergence Divergence', color: C.pink },
  { label: 'Stochastic', desc: '%K/%D oscillator (14,3)', color: C.orange },
  { label: 'Bollinger', desc: 'Bands with configurable std dev', color: C.purple },
  { label: 'VWAP', desc: 'Volume Weighted Average Price', color: C.blue },
  { label: 'OBV', desc: 'On-Balance Volume', color: C.teal },
  { label: 'ATR', desc: 'Average True Range (volatility)', color: C.red },
  { label: 'ROC', desc: 'Rate of Change (%)', color: C.yellow },
  { label: 'Pivot Points', desc: 'S1-S3 / R1-R3 support/resistance', color: C.green },
  { label: 'Patterns', desc: 'Doji, hammer, engulfing, double top/bottom', color: C.pink },
];

// ── Live Demo: Candlestick Chart with Overlays ──────────

function CandlestickDemo() {
  const c = useThemeColors();
  const { candles, append } = useSyntheticCandles({ count: 60, volatility: 2.5, startPrice: 150 });
  const ta = useTechnicalAnalysis(candles);
  const [showBB, setShowBB] = useState(true);

  useLuaInterval(1100, () => { append(); });

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2] ?? last;
  const delta = last.close - prev.close;
  const up = delta >= 0;

  const candleData = candles.map(c => ({
    time: c.time, open: c.open, high: c.high, low: c.low, close: c.close,
  }));

  const ticker = makeTicker(candles);

  const overlays: ChartOverlay[] = (() => {
    const ov: ChartOverlay[] = [
      { values: ta.sma20, color: '#3b82f6', lineWidth: 1.5 },
      { values: ta.sma50, color: '#f59e0b', lineWidth: 1.5, style: 'dashed' },
    ];
    if (showBB) {
      ov.push({
        values: ta.bollinger.map(b => b.middle),
        upper: ta.bollinger.map(b => b.upper),
        lower: ta.bollinger.map(b => b.lower),
        color: '#a78bfa',
        fillColor: 'rgba(167,139,250,0.08)',
        lineWidth: 1,
        opacity: 0.7,
      });
    }
    return ov;
  })();

  const legendItems = (() => {
    const sma20 = ta.sma20.filter(v => !isNaN(v));
    const sma50 = ta.sma50.filter(v => !isNaN(v));
    const items: Array<{ label: string; color: string; value?: number }> = [];
    if (sma20.length > 0) items.push({ label: 'SMA 20', color: '#3b82f6', value: sma20[sma20.length - 1] });
    if (sma50.length > 0) items.push({ label: 'SMA 50', color: '#f59e0b', value: sma50[sma50.length - 1] });
    if (showBB) {
      const bb = ta.bollinger.filter(b => !isNaN(b.upper));
      if (bb.length > 0) items.push({ label: 'BB', color: '#a78bfa', value: bb[bb.length - 1].upper - bb[bb.length - 1].lower });
    }
    return items;
  })();

  return (
    <S.StackG6W100>
      <TickerTape items={ticker} style={{ borderRadius: 4 }} />
      <S.RowCenterG8>
        <S.BoldText style={{ fontSize: 14 }}>{formatPrice(last.close)}</S.BoldText>
        <Text style={{ fontSize: 11, color: up ? C.green : C.red }}>{formatPercent((delta / (prev.close || 1)) * 100)}</Text>
        <S.RowCenterG4>
          <S.StoryCap>BB</S.StoryCap>
          <Switch value={showBB} onValueChange={setShowBB} />
        </S.RowCenterG4>
      </S.RowCenterG8>
      <IndicatorLegend items={legendItems} />
      <CandlestickChart data={candleData} overlays={overlays} height={200} bullColor="#22c55e" bearColor="#ef4444" />
    </S.StackG6W100>
  );
}

// ── Live Demo: Depth Chart ───────────────────────────────

function DepthChartDemo() {
  const c = useThemeColors();
  const { candles, append } = useSyntheticCandles({ count: 30, volatility: 1.5, startPrice: 100, seed: 55 });

  useLuaInterval(1700, () => { append(); });

  const last = candles[candles.length - 1];
  const book = makeBook(last.close, Math.floor(last.time * 7));

  return (
    <S.StackG6W100>
      <S.RowCenterG8>
        <S.BoldText style={{ fontSize: 11 }}>{formatPrice(last.close)}</S.BoldText>
        <S.StoryCap>Cumulative depth visualization</S.StoryCap>
      </S.RowCenterG8>
      <DepthChart bids={book.bids} asks={book.asks} height={140} />
    </S.StackG6W100>
  );
}

// ── Live Demo: Secure Portfolio ──────────────────────────

function SecurePortfolioDemo() {
  const c = useThemeColors();
  const { holdings, snapshot, locked, upsertHolding, lock, unlock } = useSecurePortfolio({
    namespace: 'finance_story_demo',
    password: 'demo123',
  });

  // Seed demo data if empty
  useLuaInterval(locked ? null : 3100, () => {
    if (holdings.length === 0) {
      for (const h of DEMO_HOLDINGS) upsertHolding(h);
    }
  });

  if (locked) {
    return (
      <S.CenterW100 style={{ gap: 8, paddingTop: 10 }}>
        <Text style={{ color: C.red, fontSize: 12 }}>Portfolio Locked</Text>
        <Pressable onPress={() => unlock('demo123')}>
          {({ pressed }) => (
            <Box style={{ backgroundColor: pressed ? C.accent : C.accentDim, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 4 }}>
              <Text style={{ color: pressed ? '#fff' : C.accent, fontSize: 10 }}>Unlock (demo123)</Text>
            </Box>
          )}
        </Pressable>
      </S.CenterW100>
    );
  }

  return (
    <S.StackG6W100>
      <S.RowCenter style={{ justifyContent: 'space-between' }}>
        <S.BoldText style={{ fontSize: 11 }}>{formatCurrency(snapshot.totalValue)}</S.BoldText>
        <Pressable onPress={lock}>
          {({ pressed }) => (
            <Box style={{ backgroundColor: pressed ? C.red : 'rgba(239,68,68,0.12)', paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3, borderRadius: 3 }}>
              <Text style={{ color: C.red, fontSize: 9 }}>Lock</Text>
            </Box>
          )}
        </Pressable>
      </S.RowCenter>
      <Text style={{ color: snapshot.pnl >= 0 ? C.green : C.red, fontSize: 10 }}>
        {`P&L: ${formatCurrency(snapshot.pnl)} (${formatPercent(snapshot.pnlPercent)})`}
      </Text>
      <S.StoryCap>{`${holdings.length} holdings, encrypted at rest`}</S.StoryCap>
    </S.StackG6W100>
  );
}

// ── Live Demo: RSI + MACD ────────────────────────────────

function RSIMACDDemo() {
  const c = useThemeColors();
  const { candles, append } = useSyntheticCandles({ count: 80, volatility: 2, startPrice: 100, seed: 77 });
  const ta = useTechnicalAnalysis(candles);

  useLuaInterval(1300, () => { append(); });

  const rsiLast = ta.rsi14.filter(v => !isNaN(v));
  const rsiValue = rsiLast.length > 0 ? rsiLast[rsiLast.length - 1] : 50;

  const stochValid = ta.stochastic.filter(s => !isNaN(s.k));
  const stochLast = stochValid[stochValid.length - 1];

  const bbValid = ta.bollinger.filter(b => !isNaN(b.upper));
  const bbLast = bbValid[bbValid.length - 1];

  return (
    <S.StackG8W100>
      <RSIGauge value={rsiValue} />

      <Box style={{ borderTopWidth: 1, borderColor: c.border, paddingTop: 6, gap: 4 }}>
        <S.StoryMuted>MACD (12, 26, 9)</S.StoryMuted>
        <MACDPanel points={ta.macd} height={60} />
      </Box>

      {stochLast && (
        <Box style={{ borderTopWidth: 1, borderColor: c.border, paddingTop: 6, gap: 2 }}>
          <S.StoryMuted>Stochastic (14, 3)</S.StoryMuted>
          <S.RowG12>
            <S.RowG4>
              <S.StoryMuted>%K</S.StoryMuted>
              <Text style={{ color: stochLast.k >= 80 ? C.red : stochLast.k <= 20 ? C.green : c.text, fontSize: 10, fontWeight: 'bold' }}>{stochLast.k.toFixed(1)}</Text>
            </S.RowG4>
            <S.RowG4>
              <S.StoryMuted>%D</S.StoryMuted>
              <S.StoryMuted>{stochLast.d.toFixed(1)}</S.StoryMuted>
            </S.RowG4>
          </S.RowG12>
        </Box>
      )}

      {bbLast && (
        <Box style={{ borderTopWidth: 1, borderColor: c.border, paddingTop: 6, gap: 2 }}>
          <S.StoryMuted>Bollinger Bands (20, 2)</S.StoryMuted>
          <S.RowWrap style={{ gap: 12 }}>
            <S.RowG4>
              <Text style={{ color: C.purple, fontSize: 10 }}>Upper</Text>
              <S.StoryBody>{bbLast.upper.toFixed(2)}</S.StoryBody>
            </S.RowG4>
            <S.RowG4>
              <Text style={{ color: C.accent, fontSize: 10 }}>Mid</Text>
              <S.StoryBody>{bbLast.middle.toFixed(2)}</S.StoryBody>
            </S.RowG4>
            <S.RowG4>
              <Text style={{ color: C.purple, fontSize: 10 }}>Lower</Text>
              <S.StoryBody>{bbLast.lower.toFixed(2)}</S.StoryBody>
            </S.RowG4>
          </S.RowWrap>
        </Box>
      )}
    </S.StackG8W100>
  );
}

// ── Live Demo: Portfolio ─────────────────────────────────

function PortfolioDemo() {
  const c = useThemeColors();
  const { snapshot, holdings, updatePrice } = usePortfolio(DEMO_HOLDINGS);

  useLuaInterval(2300, () => {
    for (const h of holdings) {
      const jitter = h.currentPrice * (Math.random() - 0.49) * 0.003;
      updatePrice(h.symbol, +(h.currentPrice + jitter).toFixed(2));
    }
  });

  const allocationBars = snapshot.allocation.map(a => ({
    label: a.symbol,
    value: a.weight * 100,
    color: a.weight > 0.3 ? C.blue : a.weight > 0.15 ? C.green : C.yellow,
  }));

  return (
    <S.StackG8W100>
      <PortfolioCard snapshot={snapshot} />
      <Box style={{ gap: 2 }}>
        <S.StoryMuted>Allocation</S.StoryMuted>
        <BarChart data={allocationBars} height={50} gap={4} showLabels interactive={false} />
      </Box>
    </S.StackG8W100>
  );
}

// ── Live Demo: Order Book ────────────────────────────────

function OrderBookDemo() {
  const c = useThemeColors();
  const { candles, append } = useSyntheticCandles({ count: 30, volatility: 1.5, startPrice: 100, seed: 99 });

  useLuaInterval(1500, () => { append(); });

  const last = candles[candles.length - 1];
  const book = makeBook(last.close, Math.floor(last.time));
  const spread = book.asks[0] ? spreadBps(book.bids[0]?.price ?? 0, book.asks[0].price) : 0;

  return (
    <S.StackG6W100>
      <S.RowCenterG8>
        <S.BoldText style={{ fontSize: 11 }}>{formatPrice(last.close)}</S.BoldText>
        <S.StoryCap>{`Spread: ${formatBps(spread)}`}</S.StoryCap>
      </S.RowCenterG8>
      <OrderBookPanel bids={book.bids} asks={book.asks} depth={8} />
    </S.StackG6W100>
  );
}

// ── Live Demo: Pattern Detection ─────────────────────────

function PatternDemo() {
  const c = useThemeColors();
  const { candles, append } = useSyntheticCandles({ count: 80, volatility: 3, startPrice: 120, seed: 13 });
  const ta = useTechnicalAnalysis(candles);

  useLuaInterval(2700, () => { append(); });

  const patterns = ta.patterns.slice(-8);

  return (
    <S.StackG6W100>
      <S.StoryCap>{`Scanning ${candles.length} candles...`}</S.StoryCap>

      {patterns.length === 0 ? (
        <S.StoryMuted>No patterns in current window</S.StoryMuted>
      ) : (
        <Box style={{ gap: 3 }}>
          {patterns.map((p, i) => (
            <S.RowCenterG6 key={`${p.type}-${p.index}-${i}`}>
              <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: patternColor(p.type), flexShrink: 0 }} />
              <S.StoryBody style={{ width: 120 }}>{patternLabel(p.type)}</S.StoryBody>
              <S.StoryCap>{`@${p.index}`}</S.StoryCap>
              <Text style={{ color: C.yellow, fontSize: 9 }}>{`${Math.round(p.confidence * 100)}%`}</Text>
            </S.RowCenterG6>
          ))}
        </Box>
      )}

      {ta.pivots && (
        <Box style={{ borderTopWidth: 1, borderColor: c.border, paddingTop: 6, gap: 2 }}>
          <S.StoryMuted>Pivot Points</S.StoryMuted>
          <S.RowWrap style={{ gap: 12 }}>
            <S.RowG4>
              <Text style={{ color: C.red, fontSize: 9 }}>R1</Text>
              <S.StoryBreadcrumbActive>{ta.pivots.r1.toFixed(2)}</S.StoryBreadcrumbActive>
            </S.RowG4>
            <S.RowG4>
              <Text style={{ color: C.accent, fontSize: 9, fontWeight: 'bold' }}>P</Text>
              <S.StoryBreadcrumbActive>{ta.pivots.pivot.toFixed(2)}</S.StoryBreadcrumbActive>
            </S.RowG4>
            <S.RowG4>
              <Text style={{ color: C.green, fontSize: 9 }}>S1</Text>
              <S.StoryBreadcrumbActive>{ta.pivots.s1.toFixed(2)}</S.StoryBreadcrumbActive>
            </S.RowG4>
          </S.RowWrap>
        </Box>
      )}
    </S.StackG6W100>
  );
}

// ── Live Demo: Formatting ────────────────────────────────

function FormatDemo() {
  const c = useThemeColors();
  const examples = [
    { label: 'formatCurrency(1234.56)', result: formatCurrency(1234.56), color: C.green },
    { label: 'formatCurrency(-500)', result: formatCurrency(-500), color: C.red },
    { label: 'formatPercent(2.4)', result: formatPercent(2.4), color: C.green },
    { label: 'formatPercent(-1.37)', result: formatPercent(-1.37), color: C.red },
    { label: 'formatCompact(1200000)', result: formatCompact(1200000), color: C.yellow },
    { label: 'formatCompact(45600)', result: formatCompact(45600), color: C.yellow },
    { label: 'formatPrice(68420)', result: formatPrice(68420), color: C.blue },
    { label: 'formatPrice(0.00123)', result: formatPrice(0.00123), color: C.blue },
    { label: 'formatBps(12.5)', result: formatBps(12.5), color: C.purple },
    { label: 'spreadBps(100.5, 101.2)', result: spreadBps(100.5, 101.2).toFixed(2), color: C.purple },
  ];

  return (
    <S.StackG3W100>
      {examples.map(e => (
        <S.RowCenterG8 key={e.label}>
          <S.StoryCap style={{ width: 180 }}>{e.label}</S.StoryCap>
          <Text style={{ fontSize: 10, color: e.color, fontWeight: 'bold' }}>{e.result}</Text>
        </S.RowCenterG8>
      ))}
    </S.StackG3W100>
  );
}

// ── Indicator Catalog ────────────────────────────────────

function IndicatorCatalog() {
  const c = useThemeColors();
  return (
    <S.StackG3W100>
      {INDICATORS.map(ind => (
        <S.RowCenterG8 key={ind.label}>
          <Box style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: ind.color, flexShrink: 0 }} />
          <S.StoryBreadcrumbActive style={{ width: 80, flexShrink: 0 }}>{ind.label}</S.StoryBreadcrumbActive>
          <S.StoryCap>{ind.desc}</S.StoryCap>
        </S.RowCenterG8>
      ))}
    </S.StackG3W100>
  );
}

// ── FinanceStory ─────────────────────────────────────────

export function FinanceStory() {
  const c = useThemeColors();

  return (
    <S.StoryRoot>

      {/* ── Header ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, gap: 14 }}>
        <S.StoryHeaderIcon src="trending-up" tintColor={C.accent} />
        <S.StoryTitle>
          {'Finance'}
        </S.StoryTitle>
        <Box style={{
          backgroundColor: C.accentDim,
          borderRadius: 4,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
        }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'@reactjit/finance'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryMuted>
          {'Technical analysis + portfolio management'}
        </S.StoryMuted>
      </S.RowCenterBorder>

      {/* ── Content ── */}
      <ScrollView style={{ flexGrow: 1 }}>

        <PageColumn>
        {/* ── Hero band ── */}
        <Box style={{
          borderLeftWidth: 3,
          borderColor: C.accent,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 24,
          paddingBottom: 24,
          gap: 8,
        }}>
          <S.StoryHeadline>
            {'Wall Street in one import.'}
          </S.StoryHeadline>
          <S.StoryMuted>
            {'13 technical indicators, candlestick pattern detection, portfolio P&L, order book visualization, and price formatting. Runtime computation paths are Lua-owned for low-latency updates. useTechnicalAnalysis() computes from OHLCV candles and usePortfolio() tracks holdings with live price updates.'}
          </S.StoryMuted>
        </Box>

        <Divider />

        {/* ── Band 1: text | code — INSTALL ── */}
        <Band>
          <Half>
            <SectionLabel icon="download" accentColor={C.accent}>{'INSTALL'}</SectionLabel>
            <S.StoryBody>
              {'Three hooks, 13 indicator functions, 7 display components, 7 formatters. Everything re-exports from a single entry point.'}
            </S.StoryBody>
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={9} code={INSTALL_CODE} style={{ width: '100%' }} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 2: demo | text + code — CANDLESTICK CHART ── */}
        <Band>
          <Half>
            <CandlestickDemo />
          </Half>
          <Half>
            <SectionLabel icon="bar-chart-2" accentColor={C.accent}>{'CANDLESTICK CHART'}</SectionLabel>
            <S.StoryBody>
              {'Live synthetic OHLCV data streaming at 1.1s intervals. useSyntheticCandles() generates realistic price action with configurable volatility. useTechnicalAnalysis() recomputes all indicators in the Lua runtime on every new candle.'}
            </S.StoryBody>
            <S.StoryCap>
              {'TickerTape scrolls market data. CandlestickChart renders bull/bear candles with configurable colors. IndicatorLegend shows overlay values.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} code={TA_CODE} style={{ width: '100%' }} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 3: text + code | demo — RSI + MACD ── */}
        <Band>
          <Half>
            <SectionLabel icon="activity" accentColor={C.accent}>{'OSCILLATORS & BANDS'}</SectionLabel>
            <S.StoryBody>
              {'RSI gauge with overbought/oversold zones. MACD histogram with signal crossovers. Stochastic %K/%D oscillator. Bollinger Bands with upper/middle/lower channels. All update live as new candles arrive.'}
            </S.StoryBody>
            <S.StoryCap>
              {'RSIGauge and MACDPanel are ready-made components — pass the indicator values and they handle the visualization. Or use the raw indicator arrays for custom rendering.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} code={INDICATORS_CODE} style={{ width: '100%' }} />
          </Half>
          <Half>
            <RSIMACDDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── Callout: pure functions ── */}
        <Box style={{
          backgroundColor: C.callout,
          borderLeftWidth: 3,
          borderColor: C.calloutBorder,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 14,
          paddingBottom: 14,
          flexDirection: 'row',
          gap: 8,
          alignItems: 'center',
        }}>
          <S.StoryInfoIcon src="info" tintColor={C.calloutBorder} />
          <S.StoryBody>
            {'All indicator functions are pure — no state, no side effects, no network calls. Pass in numbers, get numbers back. NaN for warmup periods. The React hooks are thin Lua-RPC wrappers.'}
          </S.StoryBody>
        </Box>

        <Divider />

        {/* ── Band 4: demo | text + code — PORTFOLIO ── */}
        <Band>
          <Half>
            <PortfolioDemo />
          </Half>
          <Half>
            <SectionLabel icon="briefcase" accentColor={C.accent}>{'PORTFOLIO TRACKING'}</SectionLabel>
            <S.StoryBody>
              {'usePortfolio() manages holdings with live P&L through Lua-owned mutation logic. Prices jitter every 2.3s in this demo. PortfolioCard shows total value, P&L, and per-holding breakdown. BarChart renders allocation weights.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Pure functions available: portfolioSnapshot, holdingPnL, sharpeRatio, maxDrawdown, equityToReturns. Use them outside React if you prefer.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} code={PORTFOLIO_CODE} style={{ width: '100%' }} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 5: text + code | demo — ORDER BOOK ── */}
        <Band>
          <Half>
            <SectionLabel icon="layers" accentColor={C.accent}>{'ORDER BOOK'}</SectionLabel>
            <S.StoryBody>
              {'OrderBookPanel renders bid/ask depth with horizontal size bars. Bids sorted descending, asks ascending. Spread displayed in basis points. Pass depth prop to control visible levels.'}
            </S.StoryBody>
            <S.StoryCap>
              {'The spread calculation uses spreadBps() — a pure function that returns basis points from bid and ask prices.'}
            </S.StoryCap>
          </Half>
          <Half>
            <OrderBookDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 6: demo | text + code — PATTERN DETECTION ── */}
        <Band>
          <Half>
            <PatternDemo />
          </Half>
          <Half>
            <SectionLabel icon="search" accentColor={C.accent}>{'PATTERN DETECTION'}</SectionLabel>
            <S.StoryBody>
              {'detectPatterns() scans OHLCV candles for 9 candlestick patterns: doji, hammer, shooting star, bullish/bearish engulfing, double top/bottom, higher high, lower low. Each signal includes an index and confidence score (0-1).'}
            </S.StoryBody>
            <S.StoryCap>
              {'pivotPoints() computes classic S1-S3 / R1-R3 support and resistance levels from the last candle.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} code={PATTERN_CODE} style={{ width: '100%' }} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 7: text + code | demo — FORMATTING ── */}
        <Band>
          <Half>
            <SectionLabel icon="type" accentColor={C.accent}>{'FORMATTING'}</SectionLabel>
            <S.StoryBody>
              {'Seven formatting functions for currencies, percentages, compact numbers, adaptive price decimals, volume, and basis points. All pure, all synchronous.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} code={FORMAT_CODE} style={{ width: '100%' }} />
          </Half>
          <Half>
            <FormatDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── Band: text | catalog — INDICATOR CATALOG ── */}
        <Band>
          <Half>
            <SectionLabel icon="list" accentColor={C.accent}>{'INDICATOR CATALOG'}</SectionLabel>
            <S.StoryBody>
              {'13 indicators computed in a single useTechnicalAnalysis() call. All functions are also available standalone — import sma, ema, rsi, etc. directly for use outside React.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Every indicator returns arrays aligned to the input index. NaN values mark the warmup period before enough data points exist.'}
            </S.StoryCap>
          </Half>
          <Half>
            <IndicatorCatalog />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 8: text | code — COMPONENTS ── */}
        <Band>
          <Half>
            <SectionLabel icon="layout" accentColor={C.accent}>{'DISPLAY COMPONENTS'}</SectionLabel>
            <S.StoryBody>
              {'Seven ready-made components for financial data. TickerTape for market scrollers. PortfolioCard + HoldingRow for portfolio views. OrderBookPanel for depth. RSIGauge + MACDPanel for oscillators. IndicatorLegend for chart overlays.'}
            </S.StoryBody>
            <S.StoryCap>
              {'All components use useThemeColors() — they adapt to your theme automatically.'}
            </S.StoryCap>
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={9} code={COMPONENTS_CODE} style={{ width: '100%' }} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band 9: code | text — PORTFOLIO MATH ── */}
        <Band>
          <Half>
            <CodeBlock language="tsx" fontSize={9} code={PORTFOLIO_MATH_CODE} style={{ width: '100%' }} />
          </Half>
          <Half>
            <SectionLabel icon="calculator" accentColor={C.accent}>{'PORTFOLIO MATH'}</SectionLabel>
            <S.StoryBody>
              {'Pure functions for portfolio analytics. portfolioSnapshot computes total value, P&L, and allocation weights. holdingPnL for per-position P&L. sharpeRatio and maxDrawdown for risk metrics. equityToReturns converts an equity curve to period returns.'}
            </S.StoryBody>
            <S.StoryCap>
              {'These are standalone functions — use them with or without React. The usePortfolio hook now routes state mutations and snapshot computation through Lua RPC handlers.'}
            </S.StoryCap>
          </Half>
        </Band>

        <Divider />

        {/* ── Band: text | code — CHART OVERLAYS ── */}
        <Band>
          <Half>
            <SectionLabel icon="layers" accentColor={C.purple}>{'CHART OVERLAYS'}</SectionLabel>
            <S.StoryBody>
              {'Indicator lines rendered natively in Lua on top of candlestick charts. SMA, EMA as solid/dashed lines. Bollinger Bands as a filled region between upper and lower channels. All overlays share the candlestick price axis — no separate chart needed.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Toggle the BB switch above to see Bollinger Bands appear as a translucent band overlay. Each overlay supports: color, lineWidth, opacity, style (solid/dashed), and band mode (upper/lower/fillColor).'}
            </S.StoryCap>
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={9} code={OVERLAY_CODE} style={{ width: '100%' }} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band: text + code | demo — DEPTH CHART ── */}
        <Band>
          <Half>
            <SectionLabel icon="bar-chart-2" accentColor={C.teal}>{'DEPTH CHART'}</SectionLabel>
            <S.StoryBody>
              {'Cumulative bid/ask depth chart rendered natively in Lua. Bids accumulate right-to-left (green), asks left-to-right (red). The midpoint line marks the current spread. Fully GPU-accelerated area fills.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Pass the same bid/ask arrays you use for OrderBookPanel. The chart auto-ranges to fit all price levels and normalizes cumulative volume.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} code={DEPTH_CODE} style={{ width: '100%' }} />
          </Half>
          <Half>
            <DepthChartDemo />
          </Half>
        </Band>

        <Divider />

        {/* ── Band: demo | text + code — ENCRYPTED STORAGE ── */}
        <Band>
          <Half>
            <SecurePortfolioDemo />
          </Half>
          <Half>
            <SectionLabel icon="lock" accentColor={C.orange}>{'ENCRYPTED STORAGE'}</SectionLabel>
            <S.StoryBody>
              {'useSecurePortfolio() persists holdings to SQLite, encrypted at rest. Lock/unlock with a password. Plug in @reactjit/crypto\'s encrypt/decrypt for real cryptographic security, or use the built-in obfuscation for local dev.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Holdings are encrypted before write and decrypted on read. Price updates stay in memory (no disk I/O per tick). Only structural changes (add/remove holdings) trigger persistence.'}
            </S.StoryCap>
            <CodeBlock language="tsx" fontSize={9} code={SECURE_CODE} style={{ width: '100%' }} />
          </Half>
        </Band>

        <Divider />

        {/* ── Band: text + code | — LIVE PRICE FEEDS ── */}
        <Band>
          <Half>
            <SectionLabel icon="wifi" accentColor={C.green}>{'LIVE PRICE FEEDS'}</SectionLabel>
            <S.StoryBody>
              {'usePriceFeed() aggregates CoinGecko REST polling with Binance WebSocket streams into a unified reactive price map. 50+ crypto symbols mapped automatically. useOHLCVHistory() fetches candlestick history from CoinGecko.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Polling runs on Lua-side timers (useLuaInterval). WebSocket reconnects automatically. Manual pushPrice() for custom data sources. All quotes include: price, 24h change, volume, high, low, timestamp, and source tag.'}
            </S.StoryCap>
          </Half>
          <Half>
            <CodeBlock language="tsx" fontSize={9} code={FEED_CODE} style={{ width: '100%' }} />
          </Half>
        </Band>

        <Divider />

        {/* ── Callout: full stack ── */}
        <Box style={{
          backgroundColor: C.callout,
          borderLeftWidth: 3,
          borderColor: C.calloutBorder,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 14,
          paddingBottom: 14,
          flexDirection: 'row',
          gap: 8,
          alignItems: 'center',
        }}>
          <S.StoryInfoIcon src="info" tintColor={C.calloutBorder} />
          <S.StoryBody>
            {'Full stack: live feeds (CoinGecko + Binance WS) → OHLCV candles → 13 technical indicators → native chart overlays + depth chart → portfolio tracking with encrypted storage. One import, zero configuration.'}
          </S.StoryBody>
        </Box>

        </PageColumn>
      </ScrollView>

      {/* ── Footer ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderTopWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 6, paddingBottom: 6, gap: 12 }}>
        <S.DimIcon12 src="folder" />
        <S.StoryCap>{'Packages'}</S.StoryCap>
        <S.StoryCap>{'/'}</S.StoryCap>
        <S.TextIcon12 src="trending-up" />
        <S.StoryBreadcrumbActive>{'Finance'}</S.StoryBreadcrumbActive>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryCap>{'v0.1.0'}</S.StoryCap>
      </S.RowCenterBorder>

    </S.StoryRoot>
  );
}
