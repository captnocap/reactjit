
import { Box, Col, Pressable, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { TerminalLabelFormat, TerminalTabRecord } from './useTerminalTabs';

type Action = {
  id: string;
  label: string;
  tone?: string;
  onPress: () => void;
};

export function TabContextMenu(props: {
  visible: boolean;
  x: number;
  y: number;
  tab: TerminalTabRecord | null;
  labelFormat: TerminalLabelFormat;
  onDismiss: () => void;
  onRename: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onCloseOthers: (tabId: string) => void;
  onDuplicate: (tabId: string) => void;
  onMoveToNewWindow: (tabId: string) => void;
  onSetLabelFormat: (format: TerminalLabelFormat) => void;
}) {
  if (!props.visible || !props.tab) return null;

  const tab = props.tab;
  const items: Action[] = [
    { id: 'rename', label: 'Rename', onPress: () => { props.onRename(tab.id); props.onDismiss(); } },
    { id: 'duplicate', label: 'Duplicate tab', onPress: () => { props.onDuplicate(tab.id); props.onDismiss(); } },
    { id: 'move', label: 'Move to new window', onPress: () => { props.onMoveToNewWindow(tab.id); props.onDismiss(); } },
    { id: 'sep1', label: '', onPress: () => {} },
    { id: 'close', label: 'Close tab', tone: COLORS.red, onPress: () => { props.onClose(tab.id); props.onDismiss(); } },
    { id: 'close-others', label: 'Close others', onPress: () => { props.onCloseOthers(tab.id); props.onDismiss(); } },
  ];

  const formatItems: Array<{ id: TerminalLabelFormat; label: string }> = [
    { id: 'basename', label: 'Label: basename' },
    { id: 'full', label: 'Label: full path' },
    { id: 'custom', label: 'Label: custom' },
  ];

  return (
    <Box style={{
      position: 'absolute',
      left: props.x,
      top: props.y,
      zIndex: 400,
      minWidth: 220,
      padding: 6,
      borderRadius: TOKENS.radiusMd,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.panelRaised,
    }}>
      <Col style={{ gap: 4 }}>
        <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>{tab.cwd}</Text>
        {items.map((item) => item.id.startsWith('sep') ? (
          <Box key={item.id} style={{ height: 1, backgroundColor: COLORS.border, marginTop: 4, marginBottom: 4 }} />
        ) : (
          <Pressable
            key={item.id}
            onPress={item.onPress}
            style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7, borderRadius: TOKENS.radiusSm }}
          >
            <Text fontSize={10} color={item.tone || COLORS.textBright}>{item.label}</Text>
          </Pressable>
        ))}
        <Box style={{ height: 1, backgroundColor: COLORS.border, marginTop: 4, marginBottom: 4 }} />
        {formatItems.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => { props.onSetLabelFormat(item.id); props.onDismiss(); }}
            style={{
              paddingLeft: 10,
              paddingRight: 10,
              paddingTop: 7,
              paddingBottom: 7,
              borderRadius: TOKENS.radiusSm,
              backgroundColor: props.labelFormat === item.id ? COLORS.blueDeep : 'transparent',
            }}
          >
            <Text fontSize={10} color={props.labelFormat === item.id ? COLORS.blue : COLORS.textBright}>{item.label}</Text>
          </Pressable>
        ))}
      </Col>
    </Box>
  );
}
