import { StaticSurface } from '@reactjit/runtime/primitives';
import { ChartAnimationProvider } from '../../lib/useSpring';
import { AreaChart, type AreaChartDatum } from '../area-chart/AreaChart';
import { BarChart, type BarChartDatum } from '../bar-chart/BarChart';
import { Boxplot, type BoxplotDatum } from '../boxplot/Boxplot';
import { BrailleGraph, type BrailleGraphData } from '../braille-graph/BrailleGraph';
import { BubbleCorrelation, type CorrelationDatum } from '../bubble-correlation/BubbleCorrelation';
import { BubbleScatterplot, type BubbleDatum } from '../bubble-scatterplot/BubbleScatterplot';
import { Candlestick, type CandlestickDatum } from '../candlestick/Candlestick';
import { CircularBarChart } from '../circular-bar-chart/CircularBarChart';
import { CircularProgress, type CircularProgressData } from '../circular-progress/CircularProgress';
import { CombinationChart, type CombinationChartDatum } from '../combination-chart/CombinationChart';
import { ContourMap, type ContourDatum } from '../contour-map/ContourMap';
import { DivergingChart } from '../diverging-chart/DivergingChart';
import { DonutBarChart, type DonutDatum } from '../donut-bar-chart/DonutBarChart';
import { FanChart, type FanDatum } from '../fan-chart/FanChart';
import { FlowMap, type FlowEdge, type FlowNode } from '../flow-map/FlowMap';
import { FractionChart, type FractionRow } from '../fraction-chart/FractionChart';
import { GroupedBarChart } from '../grouped-bar-chart/GroupedBarChart';
import { Heatmap } from '../heatmap/Heatmap';
import { LayeredPyramid, type LayeredPyramidDatum } from '../layered-pyramid/LayeredPyramid';
import { NetworkScheme, type NetworkEdge, type NetworkNode } from '../network-scheme/NetworkScheme';
import { PictorialFractionChart, type PictorialFractionData } from '../pictorial-fraction-chart/PictorialFractionChart';
import { PolarChart, type PolarDatum } from '../polar-chart/PolarChart';
import { PopulationPyramid } from '../population-pyramid/PopulationPyramid';
import { ProcessCircle, type ProcessCircleData } from '../process-circle/ProcessCircle';
import { Progress, type ProgressDatum } from '../progress/Progress';
import { ProportionFilters, type ProportionDatum } from '../proportion-filters/ProportionFilters';
import { PyramidChart, type PyramidDatum } from '../pyramid-chart/PyramidChart';
import { Radar, type RadarDatum } from '../radar/Radar';
import { RingsInPieChart, type RingsDatum } from '../rings-in-pie-chart/RingsInPieChart';
import { Scatterplot, type ScatterplotDatum } from '../scatterplot/Scatterplot';
import { SplineGraph, type SplineGraphDatum } from '../spline-graph/SplineGraph';
import { Surplus } from '../surplus/Surplus';
import { Timeline, type TimelineEvent } from '../timeline/Timeline';
import { Tracking, type TrackingDatum } from '../tracking/Tracking';
import { Venn, type VennDatum } from '../venn/Venn';
import { WaterfallChart, type WaterfallChartDatum } from '../waterfall-chart/WaterfallChart';

type ChartFrameProps = {
  width?: number;
  height?: number;
  staticPreview?: boolean;
};

export type SeriesPairData = {
  labels: string[];
  series1: number[];
  series2: number[];
};

export type LabeledSeriesData = {
  labels?: string[];
  values: number[];
};

export type NetworkSchemeData = {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
};

export type FlowMapData = {
  nodes: FlowNode[];
  edges: FlowEdge[];
};

export type PopulationPyramidData = {
  labels: string[];
  left: number[];
  right: number[];
};

export type DivergingChartData = {
  labels?: string[];
  values: number[];
};

export type ChartProps =
  | ({ method: 'area'; data?: AreaChartDatum[] } & ChartFrameProps)
  | ({ method: 'bar'; data?: BarChartDatum[] } & ChartFrameProps)
  | ({ method: 'boxplot'; data?: BoxplotDatum[] } & ChartFrameProps)
  | ({ method: 'braille-graph'; data?: BrailleGraphData } & ChartFrameProps)
  | ({ method: 'bubble-correlation'; data?: CorrelationDatum[] } & ChartFrameProps)
  | ({ method: 'bubble-scatterplot'; data?: BubbleDatum[] } & ChartFrameProps)
  | ({ method: 'candlestick'; data?: CandlestickDatum[] } & ChartFrameProps)
  | ({ method: 'circular-bar'; data?: LabeledSeriesData } & ChartFrameProps)
  | ({ method: 'circular-progress'; data?: CircularProgressData } & ChartFrameProps)
  | ({ method: 'combination'; data?: CombinationChartDatum[] } & ChartFrameProps)
  | ({ method: 'contour'; data?: ContourDatum[] } & ChartFrameProps)
  | ({ method: 'diverging'; data?: DivergingChartData } & ChartFrameProps)
  | ({ method: 'donut'; data?: DonutDatum[] } & ChartFrameProps)
  | ({ method: 'fan'; data?: FanDatum[] } & ChartFrameProps)
  | ({ method: 'flow'; data?: FlowMapData } & ChartFrameProps)
  | ({ method: 'fraction'; data?: FractionRow[] } & ChartFrameProps)
  | ({ method: 'grouped-bar'; data?: SeriesPairData } & ChartFrameProps)
  | ({ method: 'heatmap'; data?: number[][] } & ChartFrameProps)
  | ({ method: 'layered-pyramid'; data?: LayeredPyramidDatum[] } & ChartFrameProps)
  | ({ method: 'network'; data?: NetworkSchemeData } & ChartFrameProps)
  | ({ method: 'pictorial-fraction'; data?: PictorialFractionData } & ChartFrameProps)
  | ({ method: 'polar'; data?: PolarDatum[] } & ChartFrameProps)
  | ({ method: 'population-pyramid'; data?: PopulationPyramidData } & ChartFrameProps)
  | ({ method: 'process-circle'; data?: ProcessCircleData } & ChartFrameProps)
  | ({ method: 'progress'; data?: ProgressDatum[] } & ChartFrameProps)
  | ({ method: 'proportion-bubbles'; data?: ProportionDatum[] } & ChartFrameProps)
  | ({ method: 'pyramid'; data?: PyramidDatum[] } & ChartFrameProps)
  | ({ method: 'radar'; data?: RadarDatum[] } & ChartFrameProps)
  | ({ method: 'rings'; data?: RingsDatum[] } & ChartFrameProps)
  | ({ method: 'scatterplot'; data?: ScatterplotDatum[] } & ChartFrameProps)
  | ({ method: 'spline'; data?: SplineGraphDatum[] } & ChartFrameProps)
  | ({ method: 'surplus'; data?: LabeledSeriesData } & ChartFrameProps)
  | ({ method: 'timeline'; data?: TimelineEvent[] } & ChartFrameProps)
  | ({ method: 'tracking'; data?: TrackingDatum[] } & ChartFrameProps)
  | ({ method: 'venn'; data?: VennDatum[] } & ChartFrameProps)
  | ({ method: 'waterfall'; data?: WaterfallChartDatum[] } & ChartFrameProps);

export type ChartMethod = ChartProps['method'];

function staticData(props: ChartProps): any {
  return 'data' in props ? props.data : undefined;
}

function chartSurfaceKey(props: ChartProps, width: number, height: number): string {
  return `chart:v9:${props.method}:${width}x${height}:${JSON.stringify(staticData(props) ?? null)}`;
}

function renderChartBody(props: ChartProps, width?: number, height?: number) {
  switch (props.method) {
    case 'area':
      return <AreaChart data={props.data} width={width} height={height} />;
    case 'bar':
      return <BarChart data={props.data} width={width} height={height} />;
    case 'boxplot':
      return <Boxplot data={props.data} width={width} height={height} />;
    case 'braille-graph':
      return <BrailleGraph data={props.data} width={width} height={height} />;
    case 'bubble-correlation':
      return <BubbleCorrelation data={props.data} width={width} height={height} />;
    case 'bubble-scatterplot':
      return <BubbleScatterplot data={props.data} width={width} height={height} />;
    case 'candlestick':
      return <Candlestick data={props.data} width={width} height={height} />;
    case 'circular-bar':
      return <CircularBarChart labels={props.data?.labels} data={props.data?.values} width={width} height={height} />;
    case 'circular-progress':
      return <CircularProgress data={props.data} width={width} height={height} />;
    case 'combination':
      return <CombinationChart data={props.data} width={width} height={height} />;
    case 'contour':
      return <ContourMap data={props.data} width={width} height={height} />;
    case 'diverging':
      return <DivergingChart data={props.data?.values} labels={props.data?.labels} width={width} height={height} />;
    case 'donut':
      return <DonutBarChart data={props.data} width={width} height={height} />;
    case 'fan':
      return <FanChart data={props.data} width={width} height={height} />;
    case 'flow':
      return <FlowMap nodes={props.data?.nodes} edges={props.data?.edges} width={width} height={height} />;
    case 'fraction':
      return <FractionChart rows={props.data} width={width} height={height} />;
    case 'grouped-bar':
      return (
        <GroupedBarChart
          labels={props.data?.labels}
          series1={props.data?.series1}
          series2={props.data?.series2}
          width={width}
          height={height}
        />
      );
    case 'heatmap':
      return <Heatmap data={props.data} width={width} height={height} />;
    case 'layered-pyramid':
      return <LayeredPyramid data={props.data} width={width} height={height} />;
    case 'network':
      return <NetworkScheme nodes={props.data?.nodes} edges={props.data?.edges} width={width} height={height} />;
    case 'pictorial-fraction':
      return <PictorialFractionChart data={props.data} width={width} height={height} />;
    case 'polar':
      return <PolarChart data={props.data} width={width} height={height} />;
    case 'population-pyramid':
      return (
        <PopulationPyramid
          labels={props.data?.labels}
          left={props.data?.left}
          right={props.data?.right}
          width={width}
          height={height}
        />
      );
    case 'process-circle':
      return <ProcessCircle data={props.data} width={width} height={height} />;
    case 'progress':
      return <Progress data={props.data} width={width} height={height} />;
    case 'proportion-bubbles':
      return <ProportionFilters data={props.data} width={width} height={height} />;
    case 'pyramid':
      return <PyramidChart data={props.data} width={width} height={height} />;
    case 'radar':
      return <Radar data={props.data} width={width} height={height} />;
    case 'rings':
      return <RingsInPieChart rings={props.data} width={width} height={height} />;
    case 'scatterplot':
      return <Scatterplot data={props.data} width={width} height={height} />;
    case 'spline':
      return <SplineGraph data={props.data} width={width} height={height} />;
    case 'surplus':
      return <Surplus data={props.data?.values} labels={props.data?.labels} width={width} height={height} />;
    case 'timeline':
      return <Timeline events={props.data} width={width} height={height} />;
    case 'tracking':
      return <Tracking data={props.data} width={width} height={height} />;
    case 'venn':
      return <Venn data={props.data} width={width} height={height} />;
    case 'waterfall':
      return <WaterfallChart data={props.data} width={width} height={height} />;
  }
}

export function Chart(props: ChartProps) {
  const { width, height } = props;
  const displayWidth = width ?? 320;
  const displayHeight = height ?? 220;

  if (props.staticPreview) {
    if (props.method === 'braille-graph') return renderChartBody(props, width, height);

    return (
      <StaticSurface
        staticKey={chartSurfaceKey(props, displayWidth, displayHeight)}
        introFrames={30}
        style={{ width: displayWidth, height: displayHeight }}
      >
        <ChartAnimationProvider disabled>
          {renderChartBody(props, width, height)}
        </ChartAnimationProvider>
      </StaticSurface>
    );
  }

  return renderChartBody(props, width, height);
}
