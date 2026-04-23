import { Box, Pressable, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';

export function MaskChip(props: { label: string; active?: boolean; muted?: boolean; onPress?: () => void; disabled?: boolean }) {
  const active = !!props.active;
  const muted = !!props.muted;
  const tone = active ? COLORS.blue : muted ? COLORS.textDim : COLORS.text;
  return (
    <Pressable onPress={props.onPress} disabled={props.disabled} style={{ opacity: props.disabled ? 0.55 : 1 }}>
      <Box style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: TOKENS.radiusPill, borderWidth: 1, borderColor: active ? COLORS.blue : COLORS.border, backgroundColor: active ? COLORS.blueDeep : COLORS.panelAlt }}>
        <Text fontSize={10} color={tone}>{props.label}</Text>
      </Box>
    </Pressable>
  );
}
