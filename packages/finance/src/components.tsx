/**
 * Finance display components — all one-liners wiring data to layout.
 */

import React, { useMemo } from 'react';
import { Box, Text, ScrollView, Sparkline, CandlestickChart, LineChart, BarChart, OrderBook } from '@reactjit/core';
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
  style?: Style;
}

/**
 * Horizontal scrolling ticker row.
 *
 * Uses a horizontal ScrollView so items never clip or compress.
 * Each item is a TickerSymbol at its natural width.
 *
 * ```tsx
 * <TickerTape items={[
 *   { symbol: 'BTC', price: 68420, change: 2.4 },
 *   { symbol: 'ETH', price: 3891, change: -1.2 },
 * ]} />
 * ```
 */
export function TickerTape({ items, gap = 20, height = 24, style }: TickerTapeProps) {
  const c = useThemeColors();
  return (
    <ScrollView
      horizontal
      showScrollIndicator={false}
      style={{
        height,
        backgroundColor: c.bg,
        borderBottomWidth: 1,
        borderColor: c.border,
        ...style,
      }}
      contentContainerStyle={{
        flexDirection: 'row',
        gap,
        paddingLeft: 8,
        paddingRight: 8,
        alignItems: 'center',
        height,
      }}
    >
      {items.map(item => (
        <TickerSymbol key={item.symbol} item={item} />
      ))}
    </ScrollView>
  );
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
  const zone = value >= 70 ? 'Overbought' : value <= 30 ? 'Oversold' : 'Neutral';
  const color = value >= 70 ? '#ef4444' : value <= 30 ? '#22c55e' : c.text;
  const pct = Math.max(0, Math.min(100, value));

  return (
    <Box style={{ gap: 4, ...style }}>
      <Box style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: c.muted, fontSize: 10 }}>RSI(14)</Text>
        <Text style={{ color, fontSize: 11, fontWeight: 'bold' }}>{value.toFixed(1)}</Text>
      </Box>
      <Box style={{ height: 6, backgroundColor: c.border, borderRadius: 3, overflow: 'hidden' }}>
        <Box style={{ width: `${pct}%`, height: 6, backgroundColor: color, borderRadius: 3 }} />
      </Box>
      <Text style={{ color, fontSize: 9 }}>{zone}</Text>
    </Box>
  );
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
