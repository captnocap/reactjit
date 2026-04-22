
import { Box, Text } from '../../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../../theme';

const ART = `
  .  .  *  .  .
    *  .  ○  .  *
  .  .  *  .  .
    *  .  .  *  .
`;

export function WeatherlessTile() {
  return (
    <Box style={{ width: '100%', height: '100%', padding: TOKENS.spaceSm, justifyContent: 'center', alignItems: 'center', gap: TOKENS.spaceXs }}>
      <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>VOID</Text>
      <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', textAlign: 'center' }}>
        {ART}
      </Text>
      <Text fontSize={9} color={COLORS.textDim}>Nothing to report.</Text>
    </Box>
  );
}
