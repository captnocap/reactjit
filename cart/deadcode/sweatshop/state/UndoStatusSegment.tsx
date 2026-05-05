
import { Box, Pressable, Row, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../theme';
import { useUndoStats } from './useUndoable';

// Compact statusbar segment: "↶ 12  ↷ 3". Clickable — host app routes
// the click to open UndoHistoryPanel. Dims counts when at zero so the
// segment fades into the bar during a fresh session.
export function UndoStatusSegment(props: { onOpenHistory?: () => void }) {
  const { undoDepth, redoDepth, undo, redo } = useUndoStats();

  const pill = (content: any, onPress: () => void, tone: string, active: boolean) => (
    <Pressable onPress={onPress}>
      <Box style={{
        paddingLeft: 6, paddingRight: 6,
        paddingTop: 2, paddingBottom: 2,
        borderRadius: TOKENS.radiusXs,
        borderWidth: 1,
        borderColor: active ? COLORS.border : COLORS.borderSoft,
        backgroundColor: active ? COLORS.panelAlt : 'transparent',
      }}>
        <Text fontSize={9} color={active ? tone : COLORS.textDim} style={{ fontFamily: TOKENS.fontMono }}>{content}</Text>
      </Box>
    </Pressable>
  );

  return (
    <Row style={{ alignItems: 'center', gap: 4 }}>
      {pill('↶ ' + undoDepth, undo, COLORS.blue, undoDepth > 0)}
      {pill('↷ ' + redoDepth, redo, COLORS.purple, redoDepth > 0)}
      {props.onOpenHistory ? (
        <Pressable onPress={props.onOpenHistory}>
          <Box style={{
            paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
            borderRadius: TOKENS.radiusXs, borderWidth: 1,
            borderColor: COLORS.borderSoft, backgroundColor: 'transparent',
          }}>
            <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: TOKENS.fontMono }}>history</Text>
          </Box>
        </Pressable>
      ) : null}
    </Row>
  );
}
