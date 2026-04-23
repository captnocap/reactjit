
import { Box, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { CrosshairState } from './useChartCrosshair';

export type ChartTooltipRow = { label: string; value: string; color?: string };

/** Nudge the tooltip inside a plot rect so the box never extends past the
 *  right/bottom edge when the pointer is near them. */
function clampedAnchor(x: number, y: number, plotW: number, plotH: number, boxW: number = 180, boxH: number = 90) {
  let tx = x + 12;
  let ty = y + 12;
  if (tx + boxW > plotW) tx = Math.max(0, x - boxW - 12);
  if (ty + boxH > plotH) ty = Math.max(0, y - boxH - 12);
  return { tx, ty };
}

/** Build tooltip rows from a CrosshairState (nearest-within-threshold hits).
 *  Renders the existing ChartTooltip when there is at least one hit; hidden
 *  when the pointer is outside the plot or no series is within snapRadius. */
export function ChartTooltipFromCrosshair(props: {
  crosshair: CrosshairState;
  /** Optional xFormatter/yFormatter so callers control unit rendering. */
  xLabel?: (x: number) => string;
  yLabel?: (y: number) => string;
  /** Plot rect so the tooltip can nudge away from edges. */
  plotW?: number;
  plotH?: number;
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
  const anchor = clampedAnchor(cs.px, cs.py, props.plotW ?? 800, props.plotH ?? 400);
  return <ChartTooltip visible={true} x={anchor.tx} y={anchor.ty} title={title} rows={rows} />;
}

export function ChartTooltip(props: {
  visible: boolean;
  x: number;
  y: number;
  title?: string;
  rows: ChartTooltipRow[];
}) {
  if (!props.visible) return null;
  return (
    <Box
      style={{
        position: 'absolute',
        left: props.x,
        top: props.y,
        minWidth: 140,
        maxWidth: 260,
        padding: 10,
        gap: 6,
        borderRadius: TOKENS.radiusLg,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.panelRaised,
        zIndex: 30,
        pointerEvents: 'none',
        boxShadow: TOKENS.shadow3,
      }}
    >
      {props.title ? <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.title}</Text> : null}
      {props.rows.map((row) => (
        <Row key={row.label} style={{ gap: 6, alignItems: 'center', justifyContent: 'space-between' }}>
          <Row style={{ gap: 6, alignItems: 'center' }}>
            {row.color ? <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: row.color }} /> : null}
            <Text fontSize={9} color={COLORS.textDim}>{row.label}</Text>
          </Row>
          <Text fontSize={9} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{row.value}</Text>
        </Row>
      ))}
    </Box>
  );
}
