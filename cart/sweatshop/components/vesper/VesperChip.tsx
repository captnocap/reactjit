import { Pressable, Text } from '../../../../runtime/primitives';
import { useTheme } from '../../theme';
import { VESPER_PALETTE, VESPER_TOKENS, type VesperTone, vesperToneColor } from '../../lib/vesper';

function currentTheme() {
  const theme = useTheme();
  return theme.name === 'vesper' ? theme : { colors: VESPER_PALETTE, tokens: VESPER_TOKENS };
}

export function VesperChip(props: {
  label: string;
  tone?: VesperTone;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  const theme = currentTheme();
  const colors = theme.colors as typeof VESPER_PALETTE;
  const tokens = theme.tokens as typeof VESPER_TOKENS;
  const tone = vesperToneColor(props.tone || 'muted', colors);
  return (
    <Pressable
      disabled={props.disabled}
      onPress={props.onPress}
      style={(state) => ({
        paddingLeft: 8,
        paddingRight: 8,
        paddingTop: 4,
        paddingBottom: 4,
        borderRadius: tokens.radiusPill,
        borderWidth: 1,
        borderColor: props.selected ? tone : colors.borderSoft,
        backgroundColor: props.selected ? colors.panelHover : state.hovered ? colors.panelAlt : 'transparent',
        opacity: props.disabled ? 0.45 : 1,
      })}
    >
      <Text fontSize={tokens.typeXs} color={props.selected ? tone : colors.textDim} style={{ fontWeight: 'bold' }}>
        {props.label}
      </Text>
    </Pressable>
  );
}
