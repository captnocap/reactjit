import { Box } from '@reactjit/runtime/primitives';
import { useTheme } from '../../theme';
import { VESPER_PALETTE, VESPER_TOKENS, type VesperTone, vesperToneColor } from '../../lib/vesper';

function currentTheme() {
  const theme = useTheme();
  return theme.name === 'vesper' ? theme : { colors: VESPER_PALETTE, tokens: VESPER_TOKENS };
}

export function VesperSurface(props: {
  tone?: VesperTone;
  elevated?: boolean;
  inset?: boolean;
  bordered?: boolean;
  padding?: number;
  radius?: number;
  style?: any;
  children: any;
}) {
  const theme = currentTheme();
  const colors = theme.colors as typeof VESPER_PALETTE;
  const tokens = theme.tokens as typeof VESPER_TOKENS;
  const tone = vesperToneColor(props.tone || 'muted', colors);
  const backgroundColor = props.inset ? colors.grayDeep : props.elevated ? colors.panelRaised : colors.panelBg;
  return (
    <Box
      style={{
        backgroundColor,
        borderRadius: props.radius ?? tokens.radiusLg,
        borderWidth: props.bordered === false ? 0 : 1,
        borderColor: props.tone ? tone : colors.borderSoft,
        boxShadow: props.elevated ? tokens.shadow3 : props.inset ? tokens.shadow1 : tokens.shadow2,
        padding: props.padding ?? tokens.padNormal,
        gap: tokens.spaceSm,
        ...(props.style || {}),
      }}
    >
      {props.children}
    </Box>
  );
}
