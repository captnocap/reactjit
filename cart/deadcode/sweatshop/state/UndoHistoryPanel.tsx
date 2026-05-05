
import { Box, Col, Pressable, Row, ScrollView, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../theme';
import { getUndoStack, getRedoStack, jumpTo, clear, subscribe, getMaxDepth, setMaxDepth } from './undoStack';
import type { UndoableAction } from './UndoableAction';

function groupLabel(action: UndoableAction): string {
  return action.source || action.category || 'other';
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => n < 10 ? '0' + n : '' + n;
  return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}

export function UndoHistoryPanel(props: { onClose?: () => void }) {
  const [, tick] = useState(0);
  useEffect(() => subscribe(() => tick((x: number) => (x + 1) | 0)), []);

  const undoItems = getUndoStack();
  const redoItems = getRedoStack();
  const cap = getMaxDepth();

  // Group both buckets under their source/category for the rendered list.
  // Undo items flow top→bottom newest-first; redo items follow, dimmer.
  const groups = new Map<string, { label: string; items: Array<{ action: UndoableAction; where: 'undo' | 'redo' }> }>();
  for (let i = undoItems.length - 1; i >= 0; i--) {
    const a = undoItems[i];
    const key = groupLabel(a);
    if (!groups.has(key)) groups.set(key, { label: key, items: [] });
    groups.get(key)!.items.push({ action: a, where: 'undo' });
  }
  for (let i = redoItems.length - 1; i >= 0; i--) {
    const a = redoItems[i];
    const key = groupLabel(a);
    if (!groups.has(key)) groups.set(key, { label: key, items: [] });
    groups.get(key)!.items.push({ action: a, where: 'redo' });
  }

  return (
    <Col style={{
      gap: 8, padding: 10,
      borderRadius: TOKENS.radiusMd, borderWidth: 1,
      borderColor: COLORS.border, backgroundColor: COLORS.panelRaised,
    }}>
      <Row style={{ alignItems: 'center', gap: 8 }}>
        <Text fontSize={10} color={COLORS.blue} style={{ letterSpacing: 0.8, fontWeight: 'bold' }}>UNDO HISTORY</Text>
        <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold', flexGrow: 1, flexBasis: 0 }}>
          {undoItems.length} undoable · {redoItems.length} redoable
        </Text>
        <Pressable onPress={() => setMaxDepth(Math.max(10, cap - 50))}>
          <Box style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3, borderRadius: TOKENS.radiusXs, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
            <Text fontSize={9} color={COLORS.textDim}>cap − 50</Text>
          </Box>
        </Pressable>
        <Text fontSize={10} color={COLORS.textDim} style={{ fontFamily: TOKENS.fontMono }}>cap {cap}</Text>
        <Pressable onPress={() => setMaxDepth(cap + 50)}>
          <Box style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3, borderRadius: TOKENS.radiusXs, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
            <Text fontSize={9} color={COLORS.textDim}>cap + 50</Text>
          </Box>
        </Pressable>
        <Pressable onPress={clear}>
          <Box style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3, borderRadius: TOKENS.radiusXs, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
            <Text fontSize={9} color={COLORS.red}>clear</Text>
          </Box>
        </Pressable>
        {props.onClose ? (
          <Pressable onPress={props.onClose}>
            <Box style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 3, paddingBottom: 3, borderRadius: TOKENS.radiusXs, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: 'transparent' }}>
              <Text fontSize={9} color={COLORS.textDim}>close</Text>
            </Box>
          </Pressable>
        ) : null}
      </Row>

      {groups.size === 0 ? (
        <Text fontSize={10} color={COLORS.textDim}>No actions yet. Panels using useUndoable will show up here.</Text>
      ) : (
        <ScrollView style={{ maxHeight: 320, borderWidth: 1, borderColor: COLORS.borderSoft, borderRadius: TOKENS.radiusSm, backgroundColor: COLORS.panelBg }}>
          <Col style={{ padding: 6, gap: 8 }}>
            {Array.from(groups.values()).map((grp) => (
              <Col key={grp.label} style={{ gap: 3 }}>
                <Text fontSize={9} color={COLORS.textMuted} style={{ letterSpacing: 0.6, fontWeight: 'bold' }}>{grp.label.toUpperCase()}</Text>
                {grp.items.map(({ action, where }) => {
                  const dim = where === 'redo';
                  return (
                    <Pressable key={action.id} onPress={() => jumpTo(action.id)}>
                      <Row style={{ alignItems: 'center', gap: 6, padding: 4, borderRadius: TOKENS.radiusXs, backgroundColor: dim ? 'transparent' : COLORS.panelAlt, opacity: dim ? 0.55 : 1 }}>
                        <Text fontSize={9} color={COLORS.textDim} style={{ width: 52, fontFamily: TOKENS.fontMono }}>{formatTime(action.at)}</Text>
                        <Text fontSize={10} color={COLORS.text} style={{ flexGrow: 1, flexBasis: 0, fontFamily: TOKENS.fontUI }}>{action.name}</Text>
                        <Text fontSize={9} color={dim ? COLORS.purple : COLORS.blue} style={{ fontFamily: TOKENS.fontMono }}>{where === 'undo' ? 'jump↶' : 'jump↷'}</Text>
                      </Row>
                    </Pressable>
                  );
                })}
              </Col>
            ))}
          </Col>
        </ScrollView>
      )}
    </Col>
  );
}
