
import { Box, Col, Row, Text } from '../../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../../theme';

export function StatsTile(props: { openFiles?: number; sessionMinutes?: number }) {
  const mins = props.sessionMinutes || 0;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;

  return (
    <Col style={{ width: '100%', height: '100%', padding: TOKENS.spaceSm, gap: TOKENS.spaceXs }}>
      <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>AMBIENT</Text>
      <Row style={{ gap: TOKENS.spaceSm }}>
        <Box style={{ flexGrow: 1, padding: TOKENS.spaceXs, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelAlt }}>
          <Text fontSize={16} color={COLORS.blue} style={{ fontWeight: 'bold' }}>{props.openFiles ?? 0}</Text>
          <Text fontSize={9} color={COLORS.textDim}>open</Text>
        </Box>
        <Box style={{ flexGrow: 1, padding: TOKENS.spaceXs, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelAlt }}>
          <Text fontSize={16} color={COLORS.green} style={{ fontWeight: 'bold' }}>{hrs}h {rem}m</Text>
          <Text fontSize={9} color={COLORS.textDim}>session</Text>
        </Box>
      </Row>
      <Text fontSize={9} color={COLORS.textDim}>Uptime: {Math.floor(performance.now() / 1000)}s</Text>
    </Col>
  );
}
