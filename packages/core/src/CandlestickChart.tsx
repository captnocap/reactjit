import React from 'react';
import type { Style, Color } from './types';

export interface CandlestickDataPoint {
    time?: string | number; // label
    open: number;
    high: number;
    low: number;
    close: number;
}

export interface CandlestickChartProps {
    data: CandlestickDataPoint[];
    width?: number;
    height?: number;
    bullColor?: Color; // Color for up candles
    bearColor?: Color; // Color for down candles
    wickColor?: Color; // Color for the wicks
    interactive?: boolean;
    style?: Style;
}

export function CandlestickChart(props: CandlestickChartProps) {
    return React.createElement('Chart2D', {
        chartType: 'candlestick',
        ...props
    });
}
