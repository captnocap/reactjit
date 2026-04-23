
import { Box, Graph, Pressable, Row } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { ChartAxis } from './ChartAxis';
import { ChartLegend, type ChartLegendPosition } from './ChartLegend';
import { ChartTooltip, ChartTooltipFromCrosshair } from './ChartTooltip';
import { normalizeChartData, type ChartInput } from './useChartData';
import { formatTick, useChartScale, type ChartScaleMode } from './useChartScale';
import { ChartInteractions, type ChartInteractionsConfig } from './ChartInteractions';
import type { CrosshairInputPoint, CrosshairState } from './useChartCrosshair';
import type { DataViewport } from './useChartZoom';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function chartLayout(width: number, height: number) {
  return { width, height, plot: { x: 46, y: 12, w: Math.max(120, width - 62), h: Math.max(80, height - 46) } };
}

export function BarChart(props: {
  data: ChartInput;
  width?: number;
  height?: number;
  legendPosition?: ChartLegendPosition;
  showTooltip?: boolean;
  showAxisLabels?: boolean;
  valueFormat?: (value: number) => string;
  scaleMode?: ChartScaleMode;
  color?: string;
  interactions?: ChartInteractionsConfig;
}) {
  const width = props.width ?? 560;
  const height = props.height ?? 240;
  const { plot } = chartLayout(width, height);
  const normalized = useMemo(() => normalizeChartData(props.data), [JSON.stringify(props.data)]);
  const domainMin = Math.min(0, normalized.min);
  const domainMax = Math.max(0, normalized.max);
  const scale = useChartScale(props.scaleMode ?? 'linear', [domainMin, domainMax], [plot.y + plot.h, plot.y]);
  const formatValue = props.valueFormat || formatTick;
  const [hovered, setHovered] = useState<{ index: number; x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState<DataViewport>({ x0: 0, x1: Math.max(1, normalized.pointCount - 1), y0: domainMin, y1: domainMax });
  const [crosshair, setCrosshair] = useState<CrosshairState | null>(null);
  const interactionsOn = !!props.interactions;
  const crosshairPoints: CrosshairInputPoint[] = [];
  const seriesCount = Math.max(1, normalized.seriesCount);
  const groupCount = Math.max(1, normalized.pointCount);
  const groupW = plot.w / groupCount;
  const barW = clamp(Math.min(26, (groupW - 14) / seriesCount), 8, 30);
  const gap = clamp((groupW - barW * seriesCount) / Math.max(1, seriesCount - 1), 3, 8);
  const baseline = scale.scale(0);
  const legendItems = normalized.series.map((series) => ({
    label: series.label,
    color: series.color || props.color || COLORS.blue,
    value: formatValue(series.sum),
  }));
  const yTicks = scale.ticks.map((tick) => ({ value: scale.scale(tick), label: formatValue(tick) }));
  const xLabels = normalized.labels;

  const bars = normalized.series.flatMap((series, seriesIndex) => {
    const color = series.color || props.color || COLORS.blue;
    return series.points.map((point) => {
      if (point.y == null) return null;
      const heightPx = Math.max(1, Math.abs(scale.scale(point.y) - baseline));
      const top = Math.min(scale.scale(point.y), baseline);
      const groupLeft = plot.x + point.index * groupW;
      const total = seriesCount * barW + (seriesCount - 1) * gap;
      const left = groupLeft + (groupW - total) / 2 + seriesIndex * (barW + gap);
      if (interactionsOn) {
        crosshairPoints.push({
          seriesId:   series.id,
          seriesName: series.label,
          color:      series.color || props.color || COLORS.blue,
          x:  point.index,
          y:  point.y,
          px: left + barW / 2,
          py: top,
        });
      }
      return (
        <Graph.Node key={series.id + '-' + point.index} gx={left} gy={top} gw={barW} gh={heightPx}>
          <Pressable
            onMouseEnter={() => setHovered({ index: point.index, x: left + barW / 2, y: top - 42 })}
            onMouseLeave={() => setHovered(null)}
            style={{ width: '100%', height: '100%', justifyContent: 'flex-end', alignItems: 'stretch' }}
          >
            <Box style={{ width: '100%', height: '100%', borderRadius: 4, backgroundColor: color, opacity: hovered && hovered.index !== point.index ? 0.72 : 1 }} />
          </Pressable>
        </Graph.Node>
      );
    });
  });

  const tooltip = hovered && props.showTooltip !== false ? (
    <ChartTooltip
      visible={true}
      x={hovered.x + 8}
      y={hovered.y}
      title={xLabels[hovered.index] || 'Value'}
      rows={normalized.series
        .map((series) => {
          const point = series.points[hovered.index];
          if (!point || point.y == null) return null;
          return { label: series.label, value: formatValue(point.y), color: series.color || COLORS.blue };
        })
        .filter(Boolean) as any}
    />
  ) : null;

  const body = (
    <Box style={{ position: 'relative', width, height, overflow: 'visible' }}>
      <Graph style={{ width, height }}>
        {scale.ticks.map((tick) => (
          <Graph.Path key={'grid-' + tick} d={`M ${plot.x} ${scale.scale(tick)} L ${plot.x + plot.w} ${scale.scale(tick)}`} stroke={COLORS.borderSoft} strokeWidth={1} />
        ))}
        {bars}
      </Graph>
      <ChartAxis plot={plot} xLabels={xLabels} yTicks={yTicks} showLabels={props.showAxisLabels !== false} />
      {tooltip}
      {interactionsOn ? (
        <ChartInteractions
          plot={plot}
          natural={{ xMin: 0, xMax: Math.max(1, normalized.pointCount - 1), yMin: domainMin, yMax: domainMax }}
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

  if (props.legendPosition === 'right') {
    return <Row style={{ gap: 12, alignItems: 'flex-start' }}>{body}<ChartLegend items={legendItems} position="right" /></Row>;
  }
  if (props.legendPosition === 'top') {
    return <Box style={{ gap: 8 }}><ChartLegend items={legendItems} position="top" />{body}</Box>;
  }
  if (props.legendPosition === 'none') return body;
  return <Box style={{ gap: 8 }}>{body}<ChartLegend items={legendItems} position="bottom" /></Box>;
}
