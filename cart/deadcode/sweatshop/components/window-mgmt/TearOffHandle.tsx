
import { Box, Pressable, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { useMultiWindow } from './useMultiWindow';

// Grab affordance for a panel header — click to pop the panel into its
// own OS window. Compact; blends into header strips. Dims itself when
// the host hasn't exposed __openWindow (e.g. older framework builds).
export function TearOffHandle(props: {
  panelId: string;
  title?: string;
  width?: number;
  height?: number;
}) {
  const { openPanel, hostSupported } = useMultiWindow();
  const disabled = !hostSupported;

  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        openPanel(props.panelId, { title: props.title, width: props.width, height: props.height });
      }}
    >
      <Box style={{
        paddingLeft: 5, paddingRight: 5,
        paddingTop: 2, paddingBottom: 2,
        borderRadius: TOKENS.radiusXs,
        borderWidth: 1,
        borderColor: disabled ? COLORS.borderSoft : COLORS.border,
        backgroundColor: COLORS.panelAlt,
        opacity: disabled ? 0.4 : 1,
      }}>
        <Text fontSize={9} color={disabled ? COLORS.textDim : COLORS.textMuted} style={{ fontFamily: TOKENS.fontMono, fontWeight: 'bold' }}>
          ⇱
        </Text>
      </Box>
    </Pressable>
  );
}
