import React from 'react';
import type { Style, Color } from './types';

export interface CandlestickDataPoint {
    time?: string | number; // label
    open: number;
    high: number;
    low: number;
    close: number;
}

/** Line overlay drawn on top of candlestick chart (MA, EMA, etc.) */
export interface ChartOverlay {
    /** Y-values aligned to candle indices. NaN values are skipped. */
    values: number[];
    color?: Color;
    lineWidth?: number;
    opacity?: number;
    /** "solid" (default) or "dashed" */
    style?: 'solid' | 'dashed';
    /** For band overlays (Bollinger): upper band values */
    upper?: number[];
    /** For band overlays (Bollinger): lower band values */
    lower?: number[];
    /** Fill color between upper/lower bands */
    fillColor?: Color;
}

export interface CandlestickChartProps {
    data: CandlestickDataPoint[];
    /** Indicator line overlays (MA, EMA, Bollinger, etc.) */
    overlays?: ChartOverlay[];
    width?: number;
    height?: number;
    bullColor?: Color; // Color for up candles
    bearColor?: Color; // Color for down candles
    wickColor?: Color; // Color for the wicks
    interactive?: boolean;
    style?: Style;
}

export function CandlestickChart({ style, width, height, ...rest }: CandlestickChartProps) {
    return React.createElement('Chart2D', {
        chartType: 'candlestick',
        ...rest,
        width,
        height,
        style: {
            ...(width == null ? { width: '100%' } : {}),
            ...style,
            ...(width != null ? { width } : {}),
            ...(height != null ? { height } : {}),
        },
    });
}
