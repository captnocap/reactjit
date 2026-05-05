import { defineGallerySection, defineGalleryStory } from '../types';
import { Chart, type ChartProps } from '../components/chart/Chart';
import { chartDemoData, PALETTE } from '../lib/chart-utils';
import { Box, Col, Row, Text } from '@reactjit/runtime/primitives';

const barData = chartDemoData.months.slice(0, 8).map((label, i) => ({
  label,
  value: chartDemoData.revenue[i],
  color: i % 2 === 0 ? PALETTE.pink : PALETTE.cyan,
}));

const areaData = chartDemoData.months.slice(0, 8).map((label, i) => ({
  label,
  series1: chartDemoData.revenue[i],
  series2: chartDemoData.profitMargin[i],
}));

const scatterplotData = chartDemoData.campaignData.map((point, i) => ({
  label: `Campaign ${i + 1}`,
  x: point.x,
  y: point.y,
}));

const combinationData = chartDemoData.months.slice(0, 8).map((label, i) => ({
  label,
  bar: chartDemoData.revenue[i],
  line: chartDemoData.profitMargin[i] * 3,
}));

const splineData = chartDemoData.months.map((label, i) => ({
  label,
  value: chartDemoData.temperature[i],
}));

const groupedBarData = {
  labels: chartDemoData.quarters,
  series1: chartDemoData.revenue.slice(0, 4),
  series2: chartDemoData.profitMargin.slice(0, 4).map((value) => value * 2),
};

const divergingData = {
  labels: chartDemoData.sentiment.map((point) => point.label),
  values: chartDemoData.sentiment.map((point) => point.value),
};

const circularBarData = {
  labels: chartDemoData.days,
  values: chartDemoData.responseTime,
};

const populationData = {
  labels: chartDemoData.popLabels,
  left: chartDemoData.popLeft,
  right: chartDemoData.popRight,
};

const surplusData = {
  labels: chartDemoData.months,
  values: chartDemoData.surplus,
};

const progressData = [
  { label: 'Ingest', value: 72, color: PALETTE.pink },
  { label: 'Transform', value: 54, color: PALETTE.cyan },
  { label: 'Publish', value: 88, color: PALETTE.blue },
];

const polarData = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].map((label, i) => ({
  label,
  value: [0.6, 0.4, 0.8, 0.5, 0.7, 0.3, 0.9, 0.5][i],
}));

const fractionRows = [
  { total: 10, filled: 7, color: PALETTE.pink, label: 'Satisfied' },
  { total: 10, filled: 4, color: PALETTE.cyan, label: 'Neutral' },
  { total: 10, filled: 9, color: PALETTE.blue, label: 'Recommend' },
];

const layeredPyramidData = [
  { label: 'Signal', h: 35, color: PALETTE.pink },
  { label: 'Context', h: 40, color: PALETTE.cyan },
  { label: 'Output', h: 45, color: PALETTE.blue },
  { label: 'Review', h: 30, color: PALETTE.purple },
];

const trackingData = chartDemoData.trackingSteps.map((step, i) => ({
  label: step.label,
  value: step.done ? 45 + i * 4 : 36,
}));

const PLOT_WIDTH = 252;
const PLOT_HEIGHT = 176;
const TILE_WIDTH = 280;
const TILE_HEIGHT = 216;
const TILE_GAP = 12;

type ChartCatalogItem = {
  id: string;
  name: string;
  wide?: boolean;
  render: (width: number, height: number) => any;
};

function ChartPreview(props: ChartProps) {
  return <Chart {...props} staticPreview />;
}

const chartCatalogItems: ChartCatalogItem[] = [
  { id: 'bar', name: 'Bar', render: (width, height) => <ChartPreview method="bar" data={barData} width={width} height={height} /> },
  { id: 'grouped-bar', name: 'Grouped Bar', render: (width, height) => <ChartPreview method="grouped-bar" data={groupedBarData} width={width} height={height} /> },
  { id: 'area', name: 'Area', render: (width, height) => <ChartPreview method="area" data={areaData} width={width} height={height} /> },
  { id: 'surplus', name: 'Surplus', render: (width, height) => <ChartPreview method="surplus" data={surplusData} width={width} height={height} /> },
  { id: 'diverging', name: 'Diverging', render: (width, height) => <ChartPreview method="diverging" data={divergingData} width={width} height={height} /> },
  { id: 'heatmap', name: 'Heatmap', render: (width, height) => <ChartPreview method="heatmap" data={chartDemoData.heatmap} width={width} height={height} /> },
  { id: 'boxplot', name: 'Boxplot', render: (width, height) => <ChartPreview method="boxplot" data={chartDemoData.boxplot} width={width} height={height} /> },
  { id: 'scatterplot', name: 'Scatterplot', render: (width, height) => <ChartPreview method="scatterplot" data={scatterplotData} width={width} height={height} /> },
  { id: 'bubble-scatterplot', name: 'Bubble Scatter', render: (width, height) => <ChartPreview method="bubble-scatterplot" data={chartDemoData.campaignData} width={width} height={height} /> },
  { id: 'bubble-correlation', name: 'Bubble Correlation', render: (width, height) => <ChartPreview method="bubble-correlation" data={chartDemoData.correlationData} width={width} height={height} /> },
  { id: 'radar', name: 'Radar', render: (width, height) => <ChartPreview method="radar" data={chartDemoData.radar} width={width} height={height} /> },
  { id: 'polar', name: 'Polar', render: (width, height) => <ChartPreview method="polar" data={polarData} width={width} height={height} /> },
  { id: 'candlestick', name: 'Candlestick', render: (width, height) => <ChartPreview method="candlestick" data={chartDemoData.ohlc} width={width} height={height} /> },
  { id: 'circular-bar', name: 'Circular Bar', render: (width, height) => <ChartPreview method="circular-bar" data={circularBarData} width={width} height={height} /> },
  { id: 'combination', name: 'Combination', render: (width, height) => <ChartPreview method="combination" data={combinationData} width={width} height={height} /> },
  { id: 'spline', name: 'Spline', render: (width, height) => <ChartPreview method="spline" data={splineData} width={width} height={height} /> },
  { id: 'fan', name: 'Fan', render: (width, height) => <ChartPreview method="fan" data={chartDemoData.forecastBand} width={width} height={height} /> },
  { id: 'waterfall', name: 'Waterfall', render: (width, height) => <ChartPreview method="waterfall" data={chartDemoData.waterfall} width={width} height={height} /> },
  { id: 'population-pyramid', name: 'Population Pyramid', render: (width, height) => <ChartPreview method="population-pyramid" data={populationData} width={width} height={height} /> },
  { id: 'pyramid', name: 'Pyramid', render: (width, height) => <ChartPreview method="pyramid" data={chartDemoData.pyramidSegments} width={width} height={height} /> },
  { id: 'layered-pyramid', name: 'Layered Pyramid', render: (width, height) => <ChartPreview method="layered-pyramid" data={layeredPyramidData} width={width} height={height} /> },
  { id: 'fraction', name: 'Fraction', render: (width, height) => <ChartPreview method="fraction" data={fractionRows} width={width} height={height} /> },
  {
    id: 'pictorial-fraction',
    name: 'Pictorial Fraction',
    render: (width, height) => <ChartPreview method="pictorial-fraction" data={{ total: 10, filled: 7, rows: 2, cols: 5, color: PALETTE.pink }} width={width} height={height} />,
  },
  { id: 'donut', name: 'Donut', render: (width, height) => <ChartPreview method="donut" data={chartDemoData.budget} width={width} height={height} /> },
  { id: 'rings', name: 'Rings', render: (width, height) => <ChartPreview method="rings" data={chartDemoData.rings} width={width} height={height} /> },
  { id: 'timeline', name: 'Timeline', render: (width, height) => <ChartPreview method="timeline" data={chartDemoData.timelineEvents} width={width} height={height} /> },
  { id: 'tracking', name: 'Tracking', render: (width, height) => <ChartPreview method="tracking" data={trackingData} width={width} height={height} /> },
  { id: 'progress', name: 'Progress', render: (width, height) => <ChartPreview method="progress" data={progressData} width={width} height={height} /> },
  { id: 'circular-progress', name: 'Circular Progress', render: (width, height) => <ChartPreview method="circular-progress" data={{ label: 'Quality Gate', value: 0.65 }} width={width} height={height} /> },
  { id: 'process-circle', name: 'Process Circle', render: (width, height) => <ChartPreview method="process-circle" data={{ label: 'Completion', value: 0.72 }} width={width} height={height} /> },
  { id: 'network', name: 'Network', render: (width, height) => <ChartPreview method="network" data={{ nodes: chartDemoData.networkNodes, edges: chartDemoData.networkEdges }} width={width} height={height} /> },
  { id: 'flow', name: 'Flow', render: (width, height) => <ChartPreview method="flow" data={{ nodes: chartDemoData.flowNodes, edges: chartDemoData.flowEdges }} width={width} height={height} /> },
  { id: 'venn', name: 'Venn', render: (width, height) => <ChartPreview method="venn" data={chartDemoData.venn} width={width} height={height} /> },
  { id: 'contour', name: 'Contour', render: (width, height) => <ChartPreview method="contour" data={chartDemoData.contours} width={width} height={height} /> },
  { id: 'proportion-bubbles', name: 'Proportions', render: (width, height) => <ChartPreview method="proportion-bubbles" data={chartDemoData.proportions} width={width} height={height} /> },
  { id: 'braille-graph', name: 'Braille Graph', render: (width, height) => <ChartPreview method="braille-graph" width={width} height={height} /> },
];

function rowsOf(items: ChartCatalogItem[], count: number): ChartCatalogItem[][] {
  const rows: ChartCatalogItem[][] = [];
  for (let index = 0; index < items.length; index += count) {
    rows.push(items.slice(index, index + count));
  }
  return rows;
}

function ChartCatalogTile({ item }: { item: ChartCatalogItem }) {
  const width = item.wide ? 880 : PLOT_WIDTH;
  const height = item.wide ? 548 : PLOT_HEIGHT;

  return (
    <Col
      style={{
        width: item.wide ? '100%' : TILE_WIDTH,
        minHeight: item.wide ? 612 : TILE_HEIGHT,
        gap: 8,
        padding: 8,
        borderRadius: 8,
        backgroundColor: 'theme:paperAlt', // theme: paper.paperAlt
        borderWidth: 1,
        borderColor: 'theme:accent',     // tinted paper border (no token yet)
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: 'bold', color: 'theme:paperInk' }}>{item.name}</Text>
      <Box
        style={{
          width: '100%',
          height,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {item.render(width, height)}
      </Box>
    </Col>
  );
}

function ChartCatalog() {
  const regularItems = chartCatalogItems.filter((item) => !item.wide);
  const wideItems = chartCatalogItems.filter((item) => item.wide);

  return (
    <Col style={{ width: '100%', gap: 12, alignItems: 'center' }}>
      {rowsOf(regularItems, 3).map((row, index) => (
        <Row
          key={`row-${index}`}
          style={{
            width: '100%',
            gap: TILE_GAP,
            alignItems: 'stretch',
            justifyContent: 'center',
          }}
        >
          {row.map((item) => (
            <ChartCatalogTile key={item.id} item={item} />
          ))}
        </Row>
      ))}
      {wideItems.map((item) => (
        <ChartCatalogTile key={item.id} item={item} />
      ))}
    </Col>
  );
}

export const chartSection = defineGallerySection({
  id: 'chart',
  title: 'Chart',
  stories: [
    defineGalleryStory({
      id: 'chart/all-methods',
      title: 'Chart',
      source: 'cart/app/gallery/components/chart/Chart.tsx',
      status: 'draft',
      summary: 'Unified chart component with method-specific data props for the gallery chart renderers.',
      tags: ['chart', 'graph', 'data'],
      variants: [
        {
          id: 'catalog',
          name: 'Catalog',
          render: () => <ChartCatalog />,
        },
      ],
    }),
  ],
});
