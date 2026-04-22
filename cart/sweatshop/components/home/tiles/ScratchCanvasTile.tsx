
import { Box, Text } from '../../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../../theme';

export function ScratchCanvasTile() {
  return (
    <Box style={{ width: '100%', height: '100%', padding: TOKENS.spaceSm }}>
      <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>SCRATCH</Text>
      <Box style={{ flexGrow: 1, marginTop: TOKENS.spaceXs, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelAlt }}>
        {/* Canvas placeholder — user can draw here once pointer events are wired */}
        <Text fontSize={9} color={COLORS.textDim} style={{ padding: TOKENS.spaceSm }}>
          Draw / doodle surface
        </Text>
      </Box>
    </Box>
  );
}
