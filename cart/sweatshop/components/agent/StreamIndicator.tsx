const React: any = require('react');
import { Box, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { usePulse } from '../../anim';

function PulsingDot() {
  const pulse = usePulse(0.3, 1, 1200);
  return (
    <Box
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.blue,
        opacity: pulse,
      }}
    />
  );
}

export function StreamIndicator() {
  return (
    <Row style={{ alignItems: 'center', gap: 6 }}>
      <PulsingDot />
      <Text fontSize={10} color={COLORS.textDim}>responding...</Text>
    </Row>
  );
}
