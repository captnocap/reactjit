
import { Box, Graph, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { ChartAxis } from './ChartAxis';
import { ChartLegend, type ChartLegendPosition } from './ChartLegend';
import { ChartTooltip, ChartTooltipFromCrosshair } from './ChartTooltip';
import { normalizeChartData, type ChartInput } from './useChartData';
import { formatTick, useChartScale, type ChartScaleMode } from './useChartScale';
import { ChartInteractions, type ChartInteractionsConfig } from './ChartInteractions';
import type { CrosshairState, CrosshairInputPoint } from './useChartCrosshair';
import type { DataViewport } from './useChartZoom';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function smoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
  }
  return path;
}

function segmentPaths(points: Array<{ x: number; y: number | null }>): Array<Array<{ x: number; y: number }>> {
  const out: Array<Array<{ x: number; y: number }>> = [];
  let seg: Array<{ x: number; y: number }> = [];
  for (const point of points) {
    if (point.y == null) {
      if (seg.length > 0) out.push(seg);
      seg = [];
      continue;
    }
    seg.push({ x: point.x, y: point.y });
  }
  if (seg.length > 0) out.push(seg);
  return out;
}

function pointAt(index: number, count: number, plot: { x: number; y: number; w: number; h: number }): number {
  if (count <= 1) return plot.x + plot.w / 2;
  return plot.x + (plot.w * index) / (count - 1);
}

function chartLayout(width: number, height: number) {
  return { width, height, plot: { x: 46, y: 12, w: Math.max(120, width - 62), h: Math.max(80, height - 46) } };
}

export function LineChart(props: {
  data: ChartInput;
  width?: number;
  height?: number;
  legendPosition?: ChartLegendPosition;
  showTooltip?: boolean;
  showAxisLabels?: boolean;
  valueFormat?: (value: number) => string;
  scaleMode?: ChartScaleMode;
  color?: string;
  showArea?: boolean;
  areaOpacity?: number;
  interactions?: ChartInteractionsConfig;
}) {
  const width = props.width ?? 560;
  const height = props.height ?? 240;
  const { plot } = chartLayout(width, height);
  const normalized = useMemo(() => normalizeChartData(props.data), [JSON.stringify(props.data)]);
  const scale = useChartScale(props.scaleMode ?? 'linear', [normalized.min, normalized.max], [plot.y + plot.h, plot.y]);
  const [hovered, setHovered] = useState<{ index: number; x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState<DataViewport>({ x0: 0, x1: Math.max(1, normalized.pointCount - 1), y0: normalized.min, y1: normalized.max });
  const [crosshair, setCrosshair] = useState<CrosshairState | null>(null);
  const interactionsOn = !!props.interactions;
  const crosshairPoints: CrosshairInputPoint[] = [];
  const formatValue = props.valueFormat || formatTick;
  const legendItems = normalized.series.map((series, index) => ({
    label: series.label,
    color: series.color || COLORS.blue,
    value: series.points.some((p) => p.y != null) ? formatValue(series.points.filter((p) => p.y != null).slice(-1)[0]?.y ?? 0) : '',
  }));
  const yTicks = scale.ticks.map((tick) => ({ value: scale.scale(tick), label: formatValue(tick) }));
  const xLabels = normalized.labels;
  const xCount = Math.max(1, normalized.pointCount);
  const showLegend = props.legendPosition !== 'none';

  const plotNodes = normalized.series.flatMap((series, seriesIndex) => {
    const color = series.color || props.color || COLORS.blue;
    const points = series.points.map((point) => ({
      x: pointAt(point.index, xCount, plot),
      y: point.y == null ? null : scale.scale(point.y),
      label: point.label,
      value: point.y,
      index: point.index,
    }));
    const segments = segmentPaths(points);
    const shapes: any[] = [];

    segments.forEach((segment, segIndex) => {
      if (segment.length < 1) return;
      const line = smoothPath(segment);
      if (props.showArea) {
        const area = `${line} L ${segment[segment.length - 1].x} ${plot.y + plot.h} L ${segment[0].x} ${plot.y + plot.h} Z`;
        shapes.push(<Graph.Path key={series.id + '-area-' + segIndex} d={area} stroke={color} strokeWidth={1} fill={color} fillOpacity={props.areaOpacity ?? 0.16} />);
      }
      shapes.push(<Graph.Path key={series.id + '-line-' + segIndex} d={line} stroke={color} strokeWidth={2.2} fill="none" />);
    });

    points.forEach((point) => {
      if (point.y == null) return;
      // Feed ChartInteractions (when enabled) so hover snaps to real points.
      if (interactionsOn) {
        crosshairPoints.push({
          seriesId:   series.id,
          seriesName: series.label,
          color,
          x:  point.index,
          y:  point.value ?? 0,
          px: point.x,
          py: point.y,
        });
      }
      shapes.push(
        <Graph.Node key={series.id + '-point-' + point.index} gx={point.x - 8} gy={point.y - 8} gw={16} gh={16}>
          <Pressable
            onMouseEnter={() => setHovered({ index: point.index, x: point.x + 12, y: point.y - 44 })}
            onMouseLeave={() => setHovered(null)}
            style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
          >
            <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, borderWidth: 1, borderColor: COLORS.panelBg }} />
          </Pressable>
        </Graph.Node>
      );
    });

    return shapes;
  });

  const tooltip = hovered && props.showTooltip !== false ? (() => {
    const rows = normalized.series
      .map((series) => {
        const point = series.points[hovered.index];
        if (!point || point.y == null) return null;
        return { label: series.label, value: formatValue(point.y), color: series.color || COLORS.blue };
      })
      .filter(Boolean) as Array<{ label: string; value: string; color?: string }>;
    return <ChartTooltip visible={rows.length > 0} x={hovered.x} y={hovered.y} title={xLabels[hovered.index] || 'Point'} rows={rows} />;
  })() : null;

  const body = (
    <Box style={{ position: 'relative', width, height, overflow: 'visible' }}>
      <Graph style={{ width, height }}>
        {scale.ticks.map((tick) => (
          <Graph.Path key={'grid-' + tick} d={`M ${plot.x} ${scale.scale(tick)} L ${plot.x + plot.w} ${scale.scale(tick)}`} stroke={COLORS.borderSoft} strokeWidth={1} />
        ))}
        {plotNodes}
      </Graph>
      <ChartAxis plot={plot} xLabels={xLabels} yTicks={yTicks} showLabels={props.showAxisLabels !== false} />
      {tooltip}
      {interactionsOn ? (
        <ChartInteractions
          plot={plot}
          natural={{ xMin: 0, xMax: Math.max(1, normalized.pointCount - 1), yMin: normalized.min, yMax: normalized.max }}
          viewport={viewport}
          setViewport={setViewport}
          config={props.interactions as ChartInteractionsConfig}
          points={crosshairPoints}
          onCrosshair={setCrosshair}
        />
      ) : null}
      {interactionsOn && crosshair ? (
        <ChartTooltipFromCrosshair
          crosshair={crosshair}
          plotW={plot.w}
          plotH={plot.h}
          xLabel={(x) => xLabels[Math.round(x)] || String(Math.round(x))}
          yLabel={formatValue}
        />
      ) : null}
    </Box>
  );

  if (!showLegend) return body;
  if (props.legendPosition === 'right') {
    return <Row style={{ gap: 12, alignItems: 'flex-start' }}>{body}<ChartLegend items={legendItems} position="right" /></Row>;
  }
  if (props.legendPosition === 'top') {
    return <Box style={{ gap: 8 }}>{<ChartLegend items={legendItems} position="top" />}{body}</Box>;
  }
  return <Box style={{ gap: 8 }}>{body}<ChartLegend items={legendItems} position="bottom" /></Box>;
}
