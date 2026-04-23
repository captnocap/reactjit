const React: any = require('react');

import { Box, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';

export function AudioDeviceList(props: { available: boolean; devices?: string[] }) {
  const { available, devices = [] } = props;

  if (!available) {
    return (
      <Box style={{ padding: 12, backgroundColor: '#1a0f00', borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.orange, gap: 4 }}>
        <Text fontSize={11} color={COLORS.orange} style={{ fontWeight: 'bold' }}>Audio capture host bindings pending</Text>
        <Text fontSize={9} color={COLORS.textDim}>
          Mic input requires __audio_capture_start / __audio_capture_stop / __audio_capture_read host functions.
          The panel will activate automatically once the Zig runtime wires them.
        </Text>
      </Box>
    );
  }

  if (devices.length === 0) {
    return (
      <Box style={{ padding: 10 }}>
        <Text fontSize={10} color={COLORS.textDim}>No input devices detected</Text>
      </Box>
    );
  }

  return (
    <Box style={{ gap: 4, padding: 8 }}>
      {devices.map((d, i) => (
        <Text key={i} fontSize={10} color={COLORS.text}>{d}</Text>
      ))}
    </Box>
  );
}
