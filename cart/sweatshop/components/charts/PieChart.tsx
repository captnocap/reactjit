const React: any = require('react');
const { useMemo, useState } = React;

import { Box, Graph, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { ChartLegend, type ChartLegendPosition } from './ChartLegend';
import { ChartTooltip } from './ChartTooltip';
import { normalizeChartData, type ChartInput } from './useChartData';
import { formatTick } from './useChartScale';

type Slice = { label: string; value: number; color: string; start: number; end: number };

function polar(cx: number, cy: number, radius: number, angleDeg: number): [number, number] {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)];
}

function arcPath(cx: number, cy: number, radius: number, start: number, end: number): string {
  const [sx, sy] = polar(cx, cy, radius, start);
  const [ex, ey] = polar(cx, cy, radius, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${sx} ${sy} A ${radius} ${radius} 0 ${large} 1 ${ex} ${ey}`;
}

export function PieChart(props: {
  data: ChartInput;
  width?: number;
  height?: number;
  legendPosition?: ChartLegendPosition;
  showTooltip?: boolean;
  showAxisLabels?: boolean;
  valueFormat?: (value: number) => string;
  innerRadius?: number;
  /** Accepted for API parity with Line/Area/Bar. PieChart's geometry is
   *  angular, not Cartesian — zoom/pan/brush don't map. The built-in
   *  per-slice hover tooltip already covers the crosshair role, so this
   *  prop is a no-op here but kept so callers can pass the same
   *  interactions={} object to every chart unconditionally. */
  interactions?: Record<string, any>;
}) {
  const width = props.width ?? 520;
  const height = props.height ?? 240;
  const normalized = useMemo(() => normalizeChartData(props.data), [JSON.stringify(props.data)]);
  const formatValue = props.valueFormat || formatTick;
  const [hovered, setHovered] = useState<number | null>(null);
  const cx = width / 2;
  const cy = height / 2;
  const outer = Math.max(48, Math.min(width, height) / 2 - 10);
  const inner = Math.max(0, Math.min(props.innerRadius ?? 0, outer - 8));
  const mid = (outer + inner) / 2;
  const strokeWidth = outer - inner;
  const series = normalized.series.flatMap((s) => s.points.map((p) => ({ series: s, point: p })));
  const total = series.reduce((sum, item) => sum + Math.max(0, item.point.y ?? 0), 0) || 1;
  let cursor = 0;
  const slices: Slice[] = series
    .filter((item) => (item.point.y ?? 0) > 0)
    .map((item) => {
      const value = Math.max(0, item.point.y ?? 0);
      const start = cursor;
      const end = cursor + (value / total) * 360;
      cursor = end;
      return {
        label: item.series.label === 'Series' ? item.point.label : item.series.label + ' · ' + item.point.label,
        value,
        color: item.point.color || item.series.color || COLORS.blue,
        start,
        end,
      };
    });

  const legendItems = slices.map((slice) => ({ label: slice.label, color: slice.color, value: formatValue(slice.value) }));

  const body = (
    <Box style={{ position: 'relative', width, height, overflow: 'visible' }}>
      <Graph style={{ width, height }}>
        {slices.map((slice, index) => {
          const path = arcPath(cx, cy, mid, slice.start - 90, slice.end - 90);
          const midAngle = (slice.start + slice.end) / 2;
          const [hx, hy] = polar(cx, cy, mid, midAngle - 90);
          return (
            <React.Fragment key={slice.label + index}>
              <Graph.Path d={path} stroke={slice.color} strokeWidth={strokeWidth} fill="none" />
              <Graph.Node gx={hx - 18} gy={hy - 18} gw={36} gh={36}>
                <Pressable
                  onMouseEnter={() => setHovered(index)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ width: '100%', height: '100%' }}
                />
              </Graph.Node>
            </React.Fragment>
          );
        })}
      </Graph>
      {props.showAxisLabels !== false ? (
        <Box style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
          <Box style={{ position: 'absolute', left: cx - 28, top: cy - 10, width: 56, alignItems: 'center' }}>
            <Text fontSize={10} color={COLORS.textDim}>Total</Text>
            <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{formatValue(total)}</Text>
          </Box>
        </Box>
      ) : null}
      {hovered != null && props.showTooltip !== false ? (
        <ChartTooltip
          visible={true}
          x={cx + 20}
          y={16}
          title={slices[hovered]?.label}
          rows={[{ label: 'Value', value: formatValue(slices[hovered]?.value || 0), color: slices[hovered]?.color }, { label: 'Share', value: Math.round(((slices[hovered]?.value || 0) / total) * 100) + '%' }]}
        />
      ) : null}
    </Box>
  );

  if (props.legendPosition === 'right') {
    return <Row style={{ gap: 12, alignItems: 'center' }}>{body}<ChartLegend items={legendItems} position="right" /></Row>;
  }
  if (props.legendPosition === 'top') {
    return <Box style={{ gap: 8 }}><ChartLegend items={legendItems} position="top" />{body}</Box>;
  }
  if (props.legendPosition === 'none') return body;
  return <Box style={{ gap: 8 }}>{body}<ChartLegend items={legendItems} position="bottom" /></Box>;
}
