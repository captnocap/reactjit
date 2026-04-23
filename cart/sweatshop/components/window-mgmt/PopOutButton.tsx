
import { Box, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { useMultiWindow } from './useMultiWindow';

// Button variant of TearOffHandle for panel header toolbars — glyph plus
// label. Use TearOffHandle for compact drag-strip spots, this for fuller
// header toolbars (command palette, settings, inspector, etc.).
export function PopOutButton(props: {
  panelId: string;
  label?: string;
  title?: string;
  width?: number;
  height?: number;
  compact?: boolean;
}) {
  const { openPanel, hostSupported } = useMultiWindow();
  const disabled = !hostSupported;
  const label = props.label || 'Pop out';

  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        openPanel(props.panelId, { title: props.title, width: props.width, height: props.height });
      }}
    >
      <Row style={{
        alignItems: 'center',
        gap: props.compact ? 3 : 5,
        paddingLeft: props.compact ? 6 : 8,
        paddingRight: props.compact ? 6 : 8,
        paddingTop: props.compact ? 3 : 4,
        paddingBottom: props.compact ? 3 : 4,
        borderRadius: TOKENS.radiusXs,
        borderWidth: 1,
        borderColor: disabled ? COLORS.borderSoft : COLORS.border,
        backgroundColor: COLORS.panelAlt,
        opacity: disabled ? 0.45 : 1,
      }}>
        <Text fontSize={props.compact ? 9 : 10} color={disabled ? COLORS.textDim : COLORS.textMuted} style={{ fontFamily: TOKENS.fontMono, fontWeight: 'bold' }}>
          ⇱
        </Text>
        {props.compact ? null : (
          <Text fontSize={10} color={disabled ? COLORS.textDim : COLORS.text}>{label}</Text>
        )}
      </Row>
    </Pressable>
  );
}
