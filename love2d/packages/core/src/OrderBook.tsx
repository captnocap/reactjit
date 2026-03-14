import React from 'react';
import type { Style, Color } from './types';

export interface OrderBookLevel {
  price: number;
  size: number;
}

export interface OrderBookSelectEvent {
  side: 'bid' | 'ask';
  price: number;
  size: number;
  index: number;
}

export interface OrderBookProps {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  depth?: number;
  style?: Style;
  showHeader?: boolean;
  title?: string;
  textColor?: Color;
  mutedColor?: Color;
  bidColor?: Color;
  askColor?: Color;
  bidTextColor?: Color;
  askTextColor?: Color;
  bidBarColor?: Color;
  askBarColor?: Color;
  rowHeight?: number;
  fontSize?: number;
  onLevelPress?: (event: OrderBookSelectEvent) => void;
}

export function OrderBook({
  bids,
  asks,
  depth = 10,
  style,
  showHeader = true,
  title = 'Order Book',
  textColor = '#e2e8f0',
  mutedColor = '#94a3b8',
  bidColor = '#22c55e',
  askColor = '#ef4444',
  bidTextColor = '#86efac',
  askTextColor = '#fca5a5',
  bidBarColor = '#22c55e',
  askBarColor = '#ef4444',
  rowHeight = 18,
  fontSize = 10,
  onLevelPress,
}: OrderBookProps) {
  const safeDepth = Math.max(1, Math.floor(depth));
  const safeRowHeight = Math.max(12, Math.floor(rowHeight));
  const safeFontSize = Math.max(8, Math.floor(fontSize));
  const defaultHeight = (showHeader ? 34 : 16) + safeDepth * safeRowHeight;

  return React.createElement('OrderBook', {
    bids,
    asks,
    depth: safeDepth,
    showHeader,
    title,
    textColor,
    mutedColor,
    bidColor,
    askColor,
    bidTextColor,
    askTextColor,
    bidBarColor,
    askBarColor,
    rowHeight: safeRowHeight,
    fontSize: safeFontSize,
    onLevelPress: onLevelPress
      ? (e: any) => onLevelPress(e?.value as OrderBookSelectEvent)
      : undefined,
    style: {
      width: '100%',
      height: defaultHeight,
      ...style,
    },
  });
}
