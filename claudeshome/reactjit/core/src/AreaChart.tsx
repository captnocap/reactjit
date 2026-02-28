import React from 'react';
import { LineChart } from './LineChart';
import type { LineChartProps } from './LineChart';

export type AreaChartProps = LineChartProps;

export function AreaChart(props: AreaChartProps) {
  return (
    <LineChart
      showArea
      showDots={false}
      areaOpacity={0.4}
      {...props}
    />
  );
}
