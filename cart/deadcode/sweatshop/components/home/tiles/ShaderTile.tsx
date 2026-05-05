
import { Box, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../../theme';

export function ShaderTile() {
  return (
    <Box style={{ width: '100%', height: '100%', padding: TOKENS.spaceSm }}>
      <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>SHADER</Text>
      <Box
        style={{
          flexGrow: 1,
          marginTop: TOKENS.spaceXs,
          borderRadius: TOKENS.radiusSm,
          backgroundColor: COLORS.appBg,
          overflow: 'hidden',
        }}
      >
        <Text fontSize={9} color={COLORS.textDim} style={{ padding: TOKENS.spaceSm }}>
          Live fragment shader surface — wire Effect primitive here
        </Text>
      </Box>
    </Box>
  );
}
