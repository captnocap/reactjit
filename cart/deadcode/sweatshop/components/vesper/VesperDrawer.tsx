import { Box, Pressable, Row, Text } from '@reactjit/runtime/primitives';
import { useTheme } from '../../theme';
import { VESPER_PALETTE, VESPER_TOKENS, type VesperTone, vesperToneColor } from '../../lib/vesper';

function currentTheme() {
  const theme = useTheme();
  return theme.name === 'vesper' ? theme : { colors: VESPER_PALETTE, tokens: VESPER_TOKENS };
}

export function VesperDrawer(props: {
  open: boolean;
  side?: 'right' | 'left' | 'bottom';
  title?: string;
  subtitle?: string;
  tone?: VesperTone;
  width?: number;
  onClose?: () => void;
  children: any;
}) {
  if (!props.open) return null;
  const theme = currentTheme();
  const colors = theme.colors as typeof VESPER_PALETTE;
  const tokens = theme.tokens as typeof VESPER_TOKENS;
  const tone = vesperToneColor(props.tone || 'accent', colors);
  const isBottom = props.side === 'bottom';
  const dockStyle = props.side === 'left'
    ? { left: 0, top: 0, bottom: 0, width: props.width || 340 }
    : props.side === 'bottom'
      ? { left: 0, right: 0, bottom: 0, height: 280 }
      : { right: 0, top: 0, bottom: 0, width: props.width || 340 };
  return (
    <Box style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: tokens.zModal }}>
      <Pressable onPress={props.onClose} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)' }} />
      <Box style={{
        position: 'absolute',
        ...dockStyle,
        backgroundColor: colors.panelRaised,
        borderLeftWidth: props.side === 'left' ? 0 : 1,
        borderRightWidth: props.side === 'left' ? 1 : 0,
        borderTopWidth: isBottom ? 1 : 0,
        borderColor: colors.borderSoft,
        boxShadow: tokens.shadow4,
      }}>
        <Row style={{ alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10, borderBottomWidth: isBottom ? 0 : 1, borderTopWidth: isBottom ? 1 : 0, borderColor: colors.borderSoft }}>
          <Box style={{ gap: 1, flexGrow: 1, flexBasis: 0 }}>
            <Text fontSize={tokens.typeSm} color={colors.textBright} style={{ fontWeight: 'bold' }}>{props.title || 'Drawer'}</Text>
            {props.subtitle ? <Text fontSize={tokens.typeXs} color={colors.textDim}>{props.subtitle}</Text> : null}
          </Box>
          <Text fontSize={tokens.typeXs} color={tone} style={{ fontWeight: 'bold' }}>{props.side || 'right'}</Text>
        </Row>
        <Box style={{ padding: 12, gap: 10 }}>{props.children}</Box>
      </Box>
    </Box>
  );
}
