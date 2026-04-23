
import { Box, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { HoverPressable } from '../shared';
import type { TerminalTabRecord } from './useTerminalTabs';

export function TerminalTab(props: {
  tab: TerminalTabRecord & { label: string; active: boolean; index: number };
  onActivate: () => void;
  onClose: () => void;
  onContextMenu?: () => void;
  onMouseDown?: () => void;
  onMouseEnter?: () => void;
  dragging?: boolean;
}) {
  const active = props.tab.active;
  const tone = active ? COLORS.blue : props.tab.dirty ? COLORS.orange : COLORS.textBright;
  return (
    <Row
      onRightClick={props.onContextMenu}
      onMouseDown={props.onMouseDown}
      onMouseEnter={props.onMouseEnter}
      style={{
        alignItems: 'center',
        gap: 8,
        minWidth: 0,
        paddingLeft: 10,
        paddingRight: 8,
        paddingTop: 7,
        paddingBottom: 7,
        borderRadius: TOKENS.radiusLg,
        borderWidth: 1,
        borderColor: active ? COLORS.blue : props.dragging ? COLORS.orange : COLORS.border,
        backgroundColor: active ? COLORS.blueDeep : COLORS.panelAlt,
        opacity: props.dragging ? 0.78 : 1,
      }}
    >
      <HoverPressable onPress={props.onActivate} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0, flexGrow: 1, flexBasis: 0, backgroundColor: 'transparent' }} hoverScale={1.01}>
        <Box style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: props.tab.dirty ? COLORS.orange : active ? COLORS.blue : COLORS.borderSoft, flexShrink: 0 }} />
        <Text fontSize={10} color={tone} style={{ fontWeight: 'bold', flexShrink: 1 }}>
          {props.tab.label}
        </Text>
        <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace', flexShrink: 1 }}>
          {props.tab.cwd}
        </Text>
      </HoverPressable>
      <Pressable onPress={props.onClose} style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: TOKENS.radiusSm, backgroundColor: 'transparent' }}>
        <Text fontSize={10} color={COLORS.textDim}>x</Text>
      </Pressable>
    </Row>
  );
}
