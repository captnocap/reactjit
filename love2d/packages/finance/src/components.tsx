/**
 * Finance display components — all one-liners wiring data to layout.
 */

import React from 'react';
import { OrderBook } from '@reactjit/core';
import type { Style } from '@reactjit/core';
import { useThemeColors } from '@reactjit/theme';
import type { Holding, PortfolioSnapshot, BookLevel, MACDPoint } from './types';
import { formatPercent, formatPrice } from './format';

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
  const priceText = formatPrice(item.price, '$');
  const changeText = formatPercent(item.change);
  const sparkW = showSparkline && item.sparkline && item.sparkline.length > 1 ? 38 : 0;
  const estWidth = item.symbol.length * 8 + sparkW + priceText.length * 8 + changeText.length * 7 + 18;
  return React.createElement('TickerSymbol', {
    item,
    showSparkline,
    symbolSize,
    priceSize,
    changeSize,
    textColor: c.text,
    upColor: '#22c55e',
    downColor: '#ef4444',
    style: {
      width: estWidth,
      height: Math.max(symbolSize, Math.max(priceSize, changeSize)) + 6,
      ...style,
    },
  });
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
  return React.createElement('HoldingRow', {
    holding,
    currency,
    textColor: c.text,
    mutedColor: c.muted,
    gainColor: '#22c55e',
    lossColor: '#ef4444',
    style: {
      width: '100%',
      height: 28,
      ...style,
    },
  });
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
  const holdingsCount = snapshot.holdings.length;
  const estHeight = 58 + holdingsCount * 28 + (holdingsCount > 0 ? 8 : 0);
  return React.createElement('PortfolioCard', {
    snapshot,
    currency,
    textColor: c.text,
    mutedColor: c.muted,
    surfaceColor: c.surface,
    borderColor: c.border,
    gainColor: '#22c55e',
    lossColor: '#ef4444',
    style: {
      width: '100%',
      height: estHeight,
      ...style,
    },
  });
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
  return React.createElement('MACDPanel', {
    points,
    chartHeight: height,
    textColor: '#94a3b8',
    positiveColor: '#22c55e',
    negativeColor: '#ef4444',
    style: {
      width: '100%',
      height: height + 16,
      ...style,
    },
  });
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
  const rows = Math.max(1, Math.ceil(items.length / 3));
  return React.createElement('IndicatorLegend', {
    items,
    textColor: c.muted,
    style: {
      width: '100%',
      height: rows * 14,
      ...style,
    },
  });
}
