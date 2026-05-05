import { Tooltip, type TooltipRow } from '../tooltip';
import type { CrosshairState } from './useChartCrosshair';

export type ChartTooltipRow = TooltipRow;

/** Build shared Tooltip props from a CrosshairState (nearest-within-threshold
 *  hits) and anchor it to the live cursor. */
export function TooltipFromCrosshair(props: {
  crosshair: CrosshairState;
  /** Optional xFormatter/yFormatter so callers control unit rendering. */
  xLabel?: (x: number) => string;
  yLabel?: (y: number) => string;
}) {
  const cs = props.crosshair;
  if (!cs.visible || cs.hits.length === 0) return null;
  const xFmt = props.xLabel || ((x: number) => String(Math.round(x)));
  const yFmt = props.yLabel || ((y: number) => y.toFixed(2));
  const title = xFmt(cs.hits[0].x);
  const rows: ChartTooltipRow[] = cs.hits.map((h) => ({
    label: h.seriesName,
    value: yFmt(h.y),
    color: h.color,
  }));
  return <Tooltip visible={true} anchor={{ kind: 'cursor' }} title={title} rows={rows} variant="sweatshop-chart" />;
}

export function ChartTooltip(props: {
  visible: boolean;
  x: number;
  y: number;
  title?: string;
  rows: ChartTooltipRow[];
}) {
  return <Tooltip visible={props.visible} anchor={{ kind: 'cursor' }} title={props.title} rows={props.rows} variant="sweatshop-chart" />;
}

export const ChartTooltipFromCrosshair = TooltipFromCrosshair;
