
import { Box, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';

export type ChartTooltipRow = { label: string; value: string; color?: string };

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
