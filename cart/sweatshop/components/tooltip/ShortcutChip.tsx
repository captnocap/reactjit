const React: any = require('react');

import { Box, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';

export function ShortcutChip(props: { chord: string }) {
  return (
    <Box style={{
      paddingLeft: 6,
      paddingRight: 6,
      paddingTop: 2,
      paddingBottom: 2,
      borderRadius: TOKENS.radiusSm,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.panelAlt,
      flexShrink: 0,
    }}>
      <Text fontSize={8} color={COLORS.textDim} style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
        {props.chord}
      </Text>
    </Box>
  );
}
