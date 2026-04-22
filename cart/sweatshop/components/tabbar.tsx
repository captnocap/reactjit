const React: any = require('react');
const { useState } = React;

import { Box, Pressable, Row, ScrollView, Text } from '../../../runtime/primitives';
import { COLORS, fileGlyph, fileTone } from '../theme';
import { Glyph, Pill } from './shared';
import { Tooltip } from './tooltip';

interface TabBarProps {
  tabs: any[];
  activeId: string;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onReorder?: (tabs: any[]) => void;
  compact?: boolean;
  maxVisible?: number;
}

export function TabBar(props: TabBarProps) {
  const { tabs, activeId, onActivate, onClose, onReorder, compact, maxVisible = 0 } = props;
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [dragTabId, setDragTabId] = useState<string | null>(null);

  const limit = maxVisible > 0 ? maxVisible : compact ? 6 : 12;
  const visible = limit > 0 && tabs.length > limit ? tabs.slice(0, limit) : tabs;
  const overflow = limit > 0 && tabs.length > limit ? tabs.slice(limit) : [];
  const isDragging = dragTabId !== null;

  const moveTabToIndex = (id: string, targetIdx: number) => {
    if (!onReorder) return;
    const fromIdx = tabs.findIndex((t: any) => t.id === id);
    if (fromIdx < 0 || targetIdx < 0 || targetIdx > tabs.length) return;
    const next = [...tabs];
    const [moved] = next.splice(fromIdx, 1);
    const insertIdx = targetIdx > fromIdx ? targetIdx - 1 : targetIdx;
    next.splice(insertIdx, 0, moved);
    onReorder(next);
  };

  const renderDropZone = (beforeIdx: number, key: string) => (
    <Pressable
      key={key}
      onPress={() => { if (dragTabId) { moveTabToIndex(dragTabId, beforeIdx); setDragTabId(null); } }}
      style={{
        width: 6,
        alignSelf: 'stretch',
        backgroundColor: dragTabId ? COLORS.blue : 'transparent',
        borderRadius: 3,
        marginLeft: 2,
        marginRight: 2,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {dragTabId ? <Text fontSize={8} color={COLORS.panelBg}>▸</Text> : null}
    </Pressable>
  );

  return (
    <Row style={{ backgroundColor: COLORS.panelBg, borderBottomWidth: 1, borderColor: COLORS.borderSoft, alignItems: 'center' }}>
      {isDragging && onReorder ? renderDropZone(0, 'drop-start') : null}

      {visible.map((tab: any, idx: number) => {
        const active = tab.id === activeId;
        const draggingThis = dragTabId === tab.id;
        return (
          <Row key={tab.id} style={{ alignItems: 'center' }}>
            <Tooltip label={'Activate ' + tab.name} side="bottom">
              <Pressable
                onPress={() => {
                  if (dragTabId) {
                    if (dragTabId === tab.id) { setDragTabId(null); return; }
                    moveTabToIndex(dragTabId, idx + 1);
                    setDragTabId(null);
                  } else {
                    onActivate(tab.id);
                  }
                }}
                onMiddleClick={() => onClose(tab.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: compact ? 5 : 7,
                  paddingLeft: compact ? 10 : 12,
                  paddingRight: compact ? 6 : 8,
                  paddingTop: compact ? 7 : 8,
                  paddingBottom: compact ? 7 : 8,
                  borderRightWidth: isDragging ? 0 : 1,
                  borderColor: COLORS.borderSoft,
                  borderTopWidth: 2,
                  borderTopColor: active ? COLORS.blue : 'transparent',
                  backgroundColor: draggingThis ? COLORS.blueDeep : active ? COLORS.panelAlt : COLORS.panelBg,
                  opacity: draggingThis ? 0.6 : 1,
                }}
              >
                {onReorder && !compact ? (
                  <Tooltip label={'Drag ' + tab.name} side="bottom">
                    <Pressable
                      onPress={() => setDragTabId(draggingThis ? null : tab.id)}
                      style={{
                        paddingLeft: 2,
                        paddingRight: 2,
                        paddingTop: 1,
                        paddingBottom: 1,
                        borderRadius: 3,
                        backgroundColor: draggingThis ? COLORS.blue : 'transparent',
                      }}
                    >
                      <Text fontSize={9} color={draggingThis ? COLORS.textBright : COLORS.textDim}>≡</Text>
                    </Pressable>
                  </Tooltip>
                ) : null}
                <Glyph icon={fileGlyph(tab.type)} tone={fileTone(tab.type)} backgroundColor={COLORS.grayChip} tiny={true} />
                <Text fontSize={11} color={active ? COLORS.textBright : COLORS.text}>{tab.name}</Text>
                {tab.modified ? (
                  <Text fontSize={9} color={COLORS.yellow} style={{ marginLeft: 1 }}>●</Text>
                ) : null}
                {!compact && tab.git ? <Pill label={tab.git} color={COLORS.blue} tiny={true} /> : null}
                {!compact && !tab.pinned ? (
                  <Tooltip label={'Close ' + tab.name} side="bottom">
                    <Pressable onPress={() => onClose(tab.id)} style={{ paddingLeft: 3, paddingRight: 3, paddingTop: 2, paddingBottom: 2, borderRadius: 4 }}>
                      <Text fontSize={10} color={COLORS.textDim}>×</Text>
                    </Pressable>
                  </Tooltip>
                ) : null}
              </Pressable>
            </Tooltip>
            {isDragging && onReorder ? renderDropZone(idx + 1, 'drop-' + tab.id) : null}
          </Row>
        );
      })}

      {overflow.length > 0 ? (
        <Box style={{ position: 'relative' }}>
          <Tooltip label="Show hidden tabs" side="bottom">
            <Pressable
              onPress={() => setOverflowOpen(!overflowOpen)}
              style={{
                paddingLeft: 10,
                paddingRight: 10,
                paddingTop: 8,
                paddingBottom: 8,
                borderLeftWidth: 1,
                borderColor: COLORS.borderSoft,
              }}
            >
              <Text fontSize={11} color={COLORS.textDim}>{'>>'}{overflow.length > 9 ? '9+' : overflow.length}</Text>
            </Pressable>
          </Tooltip>
          {overflowOpen ? (
            <Box style={{
              position: 'absolute',
              top: 32,
              right: 0,
              backgroundColor: COLORS.panelRaised,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: COLORS.border,
              minWidth: 160,
              maxHeight: 320,
            }}>
              <ScrollView>
                {overflow.map((tab: any) => (
                  <Tooltip key={tab.id} label={'Activate ' + tab.name} side="left">
                    <Pressable
                      onPress={() => { onActivate(tab.id); setOverflowOpen(false); }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        paddingLeft: 12,
                        paddingRight: 12,
                        paddingTop: 8,
                        paddingBottom: 8,
                      }}
                    >
                      <Glyph icon={fileGlyph(tab.type)} tone={fileTone(tab.type)} backgroundColor={COLORS.grayChip} tiny={true} />
                      <Text fontSize={11} color={tab.id === activeId ? COLORS.textBright : COLORS.text}>{tab.name}</Text>
                      {tab.modified ? <Text fontSize={9} color={COLORS.yellow}>●</Text> : null}
                    </Pressable>
                  </Tooltip>
                ))}
              </ScrollView>
            </Box>
          ) : null}
        </Box>
      ) : null}

      {isDragging && onReorder ? (
        <Tooltip label="Cancel tab drag" side="bottom">
          <Pressable onPress={() => setDragTabId(null)} style={{ paddingLeft: 10, paddingRight: 10 }}>
            <Text fontSize={10} color={COLORS.textDim}>Cancel</Text>
          </Pressable>
        </Tooltip>
      ) : null}
    </Row>
  );
}
