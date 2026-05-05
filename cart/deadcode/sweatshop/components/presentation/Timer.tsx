import { Box, Col, Row, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';

function formatMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function Timer(props: {
  elapsedMs: number;
  durationMinutes: number;
  warningMinutes: number;
}) {
  const totalMs = Math.max(1, props.durationMinutes) * 60 * 1000;
  const remainingMs = totalMs - props.elapsedMs;
  const warningMs = Math.max(0, props.warningMinutes) * 60 * 1000;
  const critical = remainingMs <= warningMs;
  const over = remainingMs < 0;

  return (
    <Box style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 8, paddingBottom: 8, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: critical ? COLORS.yellow : COLORS.border, backgroundColor: critical ? COLORS.yellowDeep : COLORS.panelAlt }}>
      <Col style={{ gap: 2, minWidth: 132 }}>
        <Text fontSize={10} color={critical ? COLORS.yellow : COLORS.textDim} style={{ fontWeight: 'bold' }}>TIMER</Text>
        <Row style={{ gap: 10, alignItems: 'center' }}>
          <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>elapsed {formatMs(props.elapsedMs)}</Text>
          <Text fontSize={12} color={critical ? COLORS.yellow : COLORS.textBright} style={{ fontWeight: 'bold' }}>
            {over ? `over ${formatMs(Math.abs(remainingMs))}` : `remaining ${formatMs(remainingMs)}`}
          </Text>
        </Row>
        <Text fontSize={9} color={COLORS.textDim}>warns at {formatMs(warningMs)}</Text>
      </Col>
    </Box>
  );
}
