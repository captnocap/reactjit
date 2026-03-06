/**
 * Finance display components — all one-liners wiring data to layout.
 */

import React, { useMemo } from 'react';
import { Box, Text, Sparkline, CandlestickChart, LineChart, BarChart, OrderBook } from '@reactjit/core';
import type { Style } from '@reactjit/core';
import { useThemeColors } from '@reactjit/theme';
import type { OHLCV, Holding, PortfolioSnapshot, BookLevel, IndicatorPoint, BollingerBand, MACDPoint } from './types';
import { formatCurrency, formatPercent, formatPrice } from './format';
import { holdingPnL } from './portfolio';

// ── Ticker Symbol ───────────────────────────────────────

export interface TickerItem {
  symbol: string;
  price: number;
  change: number; // percentage
  sparkline?: number[];
}

export interface TickerSymbolProps {
  item: TickerItem;
  /** Show sparkline if item has data. Default true. */
  showSparkline?: boolean;
  /** Font size for symbol label. Default 11. */
  symbolSize?: number;
  /** Font size for price. Default 11. */
  priceSize?: number;
  /** Font size for change %. Default 10. */
  changeSize?: number;
  style?: Style;
}

/**
 * A single ticker symbol — symbol name, price, and change %.
 *
 * Rigid unit: every child has flexShrink:0 so nothing compresses.
 * Extensible: pass sparkline data, override font sizes, or wrap
 * in your own container for custom layouts.
 *
 * ```tsx
 * <TickerSymbol item={{ symbol: 'BTC', price: 68420, change: 2.4 }} />
 * ```
 */
export function TickerSymbol({
  item,
  showSparkline = true,
  symbolSize = 11,
  priceSize = 11,
  changeSize = 10,
  style,
}: TickerSymbolProps) {
  const c = useThemeColors();
  const up = item.change >= 0;
  const color = up ? '#22c55e' : '#ef4444';
  return (
    <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexShrink: 0, ...style }}>
      <Text style={{ color: c.text, fontSize: symbolSize, fontWeight: 'bold', flexShrink: 0 }}>{item.symbol}</Text>
      {showSparkline && item.sparkline && item.sparkline.length > 1 && (
        <Sparkline data={item.sparkline} width={32} height={12} color={color} />
      )}
      <Text style={{ color, fontSize: priceSize, flexShrink: 0 }}>{formatPrice(item.price, '$')}</Text>
      <Text style={{ color, fontSize: changeSize, flexShrink: 0 }}>{formatPercent(item.change)}</Text>
    </Box>
  );
}

// ── Ticker Tape ─────────────────────────────────────────

export interface TickerTapeProps {
  items: TickerItem[];
  /** Gap between ticker items. Default 20. */
  gap?: number;
  /** Height of the tape row. Default 24. */
  height?: number;
  /** Optional callback for symbol clicks in the Lua-owned tape. */
  onItemPress?: (event: TickerTapeSelectEvent) => void;
  style?: Style;
}

export interface TickerTapeSelectEvent {
  symbol: string;
  price: number;
  change: number;
  index: number;
}

/**
 * Horizontal scrolling ticker row.
 *
 * Renders through a Lua-owned host widget for low-latency scrolling.
 * Drag horizontally to scrub through symbols when content overflows.
 *
 * ```tsx
 * <TickerTape items={[
 *   { symbol: 'BTC', price: 68420, change: 2.4 },
 *   { symbol: 'ETH', price: 3891, change: -1.2 },
 * ]} />
 * ```
 */
export function TickerTape({ items, gap = 20, height = 24, onItemPress, style }: TickerTapeProps) {
  const c = useThemeColors();
  return React.createElement('TickerTape', {
    items,
    gap,
    height,
    textColor: c.text,
    bgColor: c.bg,
    borderColor: c.border,
    upColor: '#22c55e',
    downColor: '#ef4444',
    onItemPress: onItemPress
      ? (e: any) => onItemPress(e?.value as TickerTapeSelectEvent)
      : undefined,
    style: {
      width: '100%',
      height,
      ...style,
    },
  });
}

// ── Holding Row ──────────────────────────────────────────

export interface HoldingRowProps {
  holding: Holding;
  currency?: string;
  style?: Style;
}

/** Single portfolio holding row with P&L */
export function HoldingRow({ holding, currency = '$', style }: HoldingRowProps) {
  const c = useThemeColors();
  const { pnl, pnlPercent, marketValue } = holdingPnL(holding);
  const up = pnl >= 0;
  const pnlColor = up ? '#22c55e' : '#ef4444';

  return (
    <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', paddingTop: 6, paddingBottom: 6, ...style }}>
      <Box style={{ width: 50 }}>
        <Text style={{ color: c.text, fontSize: 12, fontWeight: 'bold' }}>{holding.symbol}</Text>
      </Box>
      <Box style={{ flexGrow: 1, gap: 1 }}>
        <Text style={{ color: c.muted, fontSize: 10 }}>{`${holding.quantity} @ ${formatCurrency(holding.avgCost, { currency })}`}</Text>
      </Box>
      <Box style={{ alignItems: 'flex-end', gap: 1 }}>
        <Text style={{ color: c.text, fontSize: 12 }}>{formatCurrency(marketValue, { currency })}</Text>
        <Box style={{ flexDirection: 'row', gap: 4 }}>
          <Text style={{ color: pnlColor, fontSize: 10 }}>{formatCurrency(pnl, { currency })}</Text>
          <Text style={{ color: pnlColor, fontSize: 10 }}>{`(${formatPercent(pnlPercent)})`}</Text>
        </Box>
      </Box>
    </Box>
  );
}

// ── Portfolio Card ───────────────────────────────────────

export interface PortfolioCardProps {
  snapshot: PortfolioSnapshot;
  currency?: string;
  style?: Style;
}

/** Portfolio summary card with total value, P&L, and allocation */
export function PortfolioCard({ snapshot, currency = '$', style }: PortfolioCardProps) {
  const c = useThemeColors();
  const up = snapshot.pnl >= 0;
  const pnlColor = up ? '#22c55e' : '#ef4444';

  return (
    <Box style={{ gap: 10, padding: 12, backgroundColor: c.surface, borderRadius: 8, borderWidth: 1, borderColor: c.border, ...style }}>
      <Box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: c.muted, fontSize: 11 }}>Portfolio Value</Text>
        <Text style={{ color: c.text, fontSize: 18, fontWeight: 'bold' }}>{formatCurrency(snapshot.totalValue, { currency })}</Text>
      </Box>
      <Box style={{ flexDirection: 'row', gap: 12 }}>
        <Box style={{ gap: 1 }}>
          <Text style={{ color: c.muted, fontSize: 10 }}>P&L</Text>
          <Text style={{ color: pnlColor, fontSize: 13, fontWeight: 'bold' }}>{formatCurrency(snapshot.pnl, { currency })}</Text>
        </Box>
        <Box style={{ gap: 1 }}>
          <Text style={{ color: c.muted, fontSize: 10 }}>Return</Text>
          <Text style={{ color: pnlColor, fontSize: 13, fontWeight: 'bold' }}>{formatPercent(snapshot.pnlPercent)}</Text>
        </Box>
        <Box style={{ gap: 1 }}>
          <Text style={{ color: c.muted, fontSize: 10 }}>Cost Basis</Text>
          <Text style={{ color: c.text, fontSize: 13 }}>{formatCurrency(snapshot.totalCost, { currency })}</Text>
        </Box>
      </Box>
      {snapshot.holdings.length > 0 && (
        <Box style={{ gap: 0 }}>
          {snapshot.holdings.map((h, i) => (
            <HoldingRow
              key={h.symbol}
              holding={h}
              currency={currency}
              style={{ borderTopWidth: i > 0 ? 1 : 0, borderColor: c.border }}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

// ── Order Book Panel ─────────────────────────────────────

export interface OrderBookPanelProps {
  bids: BookLevel[];
  asks: BookLevel[];
  depth?: number;
  style?: Style;
}

/** Visual order book with bid/ask depth bars */
export function OrderBookPanel({ bids, asks, depth = 10, style }: OrderBookPanelProps) {
  const c = useThemeColors();
  return (
    <OrderBook
      bids={bids}
      asks={asks}
      depth={depth}
      textColor={c.text}
      mutedColor={c.muted}
      bidColor="#22c55e"
      askColor="#ef4444"
      bidTextColor="#86efac"
      askTextColor="#fca5a5"
      bidBarColor="#22c55e"
      askBarColor="#ef4444"
      style={style}
    />
  );
}

// ── RSI Gauge ────────────────────────────────────────────

export interface RSIGaugeProps {
  value: number;
  style?: Style;
}

/** Compact RSI indicator with overbought/oversold zones */
export function RSIGauge({ value, style }: RSIGaugeProps) {
  const c = useThemeColors();
  return React.createElement('RSIGauge', {
    value,
    textColor: c.text,
    mutedColor: c.muted,
    barBgColor: c.border,
    overboughtColor: '#ef4444',
    oversoldColor: '#22c55e',
    style: {
      width: '100%',
      height: 42,
      ...style,
    },
  });
}

// ── MACD Panel ───────────────────────────────────────────

export interface MACDPanelProps {
  points: MACDPoint[];
  height?: number;
  style?: Style;
}

/** MACD histogram + signal line visualization */
export function MACDPanel({ points, height = 80, style }: MACDPanelProps) {
  // Filter to valid points only
  const valid = useMemo(() => points.filter(p => !isNaN(p.histogram)), [points]);
  const histData = useMemo(() =>
    valid.map((p, i) => ({
      label: i % 10 === 0 ? String(i) : '',
      value: Math.abs(p.histogram) + 0.01,
      color: p.histogram >= 0 ? '#22c55e' : '#ef4444',
    })),
  [valid]);

  return (
    <Box style={{ gap: 4, ...style }}>
      <Text style={{ color: '#94a3b8', fontSize: 10 }}>MACD</Text>
      <BarChart data={histData} height={height} gap={1} showLabels={false} interactive={false} />
    </Box>
  );
}

// ── Indicator Legend ──────────────────────────────────────

export interface IndicatorLegendItem {
  label: string;
  color: string;
  value?: number;
}

export interface IndicatorLegendProps {
  items: IndicatorLegendItem[];
  style?: Style;
}

/** Compact legend for chart overlays */
export function IndicatorLegend({ items, style }: IndicatorLegendProps) {
  const c = useThemeColors();
  return (
    <Box style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', ...style }}>
      {items.map(item => (
        <Box key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color }} />
          <Text style={{ color: c.muted, fontSize: 10 }}>{item.label}</Text>
          {item.value !== undefined && (
            <Text style={{ color: item.color, fontSize: 10, fontWeight: 'bold' }}>{item.value.toFixed(2)}</Text>
          )}
        </Box>
      ))}
    </Box>
  );
}
