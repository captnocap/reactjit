
import { Box, Pressable, Row, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { HoverPressable } from '../shared';
import { Icon } from '../icons';
import { TabContextMenu } from './TabContextMenu';
import { TerminalTab } from './TerminalTab';
import type { TerminalLabelFormat, TerminalTabRecord } from './useTerminalTabs';

export function TabStrip(props: {
  tabs: Array<TerminalTabRecord & { label: string; active: boolean; index: number }>;
  activeIndex: number;
  labelFormat: TerminalLabelFormat;
  maxTabs: number;
  onActivate: (index: number) => void;
  onCreateTab: () => void;
  onCloseTab: (tabId: string) => void;
  onCloseOthers: (tabId: string) => void;
  onDuplicateTab: (tabId: string) => void;
  onRenameTab: (tabId: string) => void;
  onMoveTab: (fromId: string, toId: string) => void;
  onMoveToNewWindow: (tabId: string) => void;
  onSetLabelFormat: (format: TerminalLabelFormat) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ tabId: string; x: number; y: number } | null>(null);

  useEffect(() => {
    const target: any = typeof window !== 'undefined' ? window : globalThis;
    if (!target || typeof target.addEventListener !== 'function') return;
    const onUp = () => setDraggingId(null);
    target.addEventListener('mouseup', onUp, true);
    target.addEventListener('blur', onUp, true);
    return () => {
      try { target.removeEventListener('mouseup', onUp, true); } catch {}
      try { target.removeEventListener('blur', onUp, true); } catch {}
    };
  }, []);

  const activeTab = props.tabs[props.activeIndex] || null;

  const overflow = props.tabs.length >= props.maxTabs;

  const menuTab = useMemo(() => {
    if (!menu) return null;
    return props.tabs.find((tab) => tab.id === menu.tabId) || null;
  }, [menu, props.tabs]);

  return (
    <Box style={{ position: 'relative' }}>
      <Row style={{
        alignItems: 'center',
        gap: 6,
        paddingLeft: 8,
        paddingRight: 8,
        paddingTop: 6,
        paddingBottom: 6,
        borderBottomWidth: 1,
        borderColor: COLORS.borderSoft,
        backgroundColor: COLORS.panelBg,
        flexWrap: 'nowrap',
        overflow: 'hidden',
      }}>
        <Row style={{ gap: 6, alignItems: 'center', flexGrow: 1, flexBasis: 0, minWidth: 0, overflow: 'hidden' }}>
          {props.tabs.map((tab) => (
            <Box key={tab.id} style={{ flexShrink: 0 }}>
              <TerminalTab
                tab={tab}
                dragging={draggingId === tab.id}
                onActivate={() => props.onActivate(tab.index)}
                onClose={() => props.onCloseTab(tab.id)}
                onContextMenu={(event: any) => {
                  const x = typeof event?.x === 'number' ? event.x : typeof event?.clientX === 'number' ? event.clientX : 16;
                  const y = typeof event?.y === 'number' ? event.y : typeof event?.clientY === 'number' ? event.clientY : 16;
                  setMenu({ tabId: tab.id, x, y });
                }}
                onMouseDown={() => setDraggingId(tab.id)}
                onMouseEnter={() => {
                  if (draggingId && draggingId !== tab.id) props.onMoveTab(draggingId, tab.id);
                }}
              />
            </Box>
          ))}
        </Row>
        <HoverPressable
          onPress={props.onCreateTab}
          style={{
            width: 28,
            height: 28,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: TOKENS.radiusMd,
            borderWidth: 1,
            borderColor: overflow ? COLORS.borderSoft : COLORS.border,
            backgroundColor: overflow ? COLORS.panelBg : COLORS.panelAlt,
            opacity: overflow ? 0.75 : 1,
          }}
          hoverScale={1.05}
        >
          <Icon name="plus" size={13} color={overflow ? COLORS.textDim : COLORS.textBright} />
        </HoverPressable>
      </Row>

      <TabContextMenu
        visible={!!menu}
        x={menu?.x || 16}
        y={menu?.y || 16}
        tab={menuTab}
        labelFormat={props.labelFormat}
        onDismiss={() => setMenu(null)}
        onRename={props.onRenameTab}
        onClose={props.onCloseTab}
        onCloseOthers={props.onCloseOthers}
        onDuplicate={props.onDuplicateTab}
        onMoveToNewWindow={props.onMoveToNewWindow}
        onSetLabelFormat={props.onSetLabelFormat}
      />
    </Box>
  );
}
