import { Box, Text } from '../../../../runtime/primitives';
import { useTheme } from '../../theme';
import { VESPER_PALETTE, VESPER_TOKENS, type VesperTone, vesperToneColor } from '../../lib/vesper';

function currentTheme() {
  const theme = useTheme();
  return theme.name === 'vesper' ? theme : { colors: VESPER_PALETTE, tokens: VESPER_TOKENS };
}

export function VesperBadge(props: {
  label: string;
  tone?: VesperTone;
  subtle?: boolean;
  dot?: boolean;
}) {
  const theme = currentTheme();
  const colors = theme.colors as typeof VESPER_PALETTE;
  const tokens = theme.tokens as typeof VESPER_TOKENS;
  const tone = vesperToneColor(props.tone || 'muted', colors);
  return (
    <Box style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingLeft: 8,
      paddingRight: 8,
      paddingTop: 3,
      paddingBottom: 3,
      borderRadius: tokens.radiusPill,
      borderWidth: 1,
      borderColor: props.subtle ? colors.borderSoft : tone,
      backgroundColor: props.subtle ? colors.panelAlt : colors.grayChip,
    }}>
      {props.dot ? <Box style={{ width: 6, height: 6, borderRadius: 9999, backgroundColor: tone }} /> : null}
      <Text fontSize={tokens.typeXs} color={tone} style={{ fontWeight: 'bold' }}>{props.label}</Text>
    </Box>
  );
}
