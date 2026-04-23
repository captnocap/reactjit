import { Pressable, Text } from '../../../../runtime/primitives';
import { useTheme } from '../../theme';
import { VESPER_PALETTE, VESPER_TOKENS, type VesperTone, vesperToneColor } from '../../lib/vesper';

function currentTheme() {
  const theme = useTheme();
  return theme.name === 'vesper' ? theme : { colors: VESPER_PALETTE, tokens: VESPER_TOKENS };
}

export function VesperButton(props: {
  children?: any;
  label?: string;
  tone?: VesperTone;
  variant?: 'solid' | 'soft' | 'ghost';
  size?: 'sm' | 'md';
  disabled?: boolean;
  loading?: boolean;
  onPress?: () => void;
}) {
  const theme = currentTheme();
  const colors = theme.colors as typeof VESPER_PALETTE;
  const tokens = theme.tokens as typeof VESPER_TOKENS;
  const tone = vesperToneColor(props.tone || 'accent', colors);
  const label = props.loading ? 'Loading…' : (props.children ?? props.label ?? 'Button');
  const padY = props.size === 'sm' ? 4 : 6;
  const padX = props.size === 'sm' ? 10 : 14;
  return (
    <Pressable
      disabled={props.disabled}
      onPress={props.onPress}
      style={(state) => ({
        paddingLeft: padX,
        paddingRight: padX,
        paddingTop: padY,
        paddingBottom: padY,
        borderRadius: tokens.radiusSm,
        alignSelf: 'flex-start',
        opacity: props.disabled ? 0.45 : 1,
        borderWidth: 1,
        borderColor: props.variant === 'ghost' ? 'transparent' : tone,
        backgroundColor: props.variant === 'solid'
          ? tone
          : props.variant === 'soft'
            ? state.hovered ? colors.panelHover : colors.blueDeep
            : state.hovered ? colors.panelHover : 'transparent',
      })}
    >
      <Text fontSize={props.size === 'sm' ? tokens.typeXs : tokens.typeSm} color={props.variant === 'solid' ? colors.textBright : tone} style={{ fontWeight: 'bold' }}>
        {label}
      </Text>
    </Pressable>
  );
}
