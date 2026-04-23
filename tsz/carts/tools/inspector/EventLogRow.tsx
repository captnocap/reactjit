// =============================================================================
// EventLogRow — one row in the EventLog
// =============================================================================
// Renders timestamp, hook type (colour-coded by hook family), node id,
// delta description. Click pins the TimeTravel cursor to this event's
// index and — if the event references a node — selects it in the Tree.
// =============================================================================

const React: any = require('react');

import { Box, Col, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../../../cart/sweatshop/theme';
import type { InspectorEvent } from './useInspectorStore';

interface EventLogRowProps {
  event: InspectorEvent;
  index: number;
  selected: boolean;
  onSelect: (idx: number, nodeId: number | null) => void;
}

function hookTone(hook: string): string {
  if (hook === 'useState')   return COLORS.blue;
  if (hook === 'useEffect')  return COLORS.green;
  if (hook === 'propEdit')   return COLORS.orange;
  if (hook === 'useMemo')    return COLORS.purple;
  if (hook === 'useCallback')return COLORS.purple;
  if (hook === 'useRef')     return COLORS.textDim;
  return COLORS.textMuted;
}

function formatTs(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms3 = String(d.getMilliseconds()).padStart(3, '0');
  return hh + ':' + mm + ':' + ss + '.' + ms3;
}

export function EventLogRow(props: EventLogRowProps) {
  const { event } = props;
  const tone = hookTone(event.hook);
  return (
    <Pressable onPress={() => props.onSelect(props.index, event.nodeId)} style={{
      padding: 4, gap: 6,
      borderRadius: TOKENS.radiusSm,
      borderWidth: 1,
      borderColor: props.selected ? COLORS.blue : COLORS.borderSoft,
      backgroundColor: props.selected ? COLORS.panelHover : COLORS.panelBg,
    }}>
      <Row style={{ alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>
          {formatTs(event.ts)}
        </Text>
        <Box style={{
          paddingLeft: 6, paddingRight: 6, paddingTop: 1, paddingBottom: 1,
          borderRadius: TOKENS.radiusPill, borderWidth: 1, borderColor: tone, backgroundColor: COLORS.panelAlt,
        }}>
          <Text fontSize={9} color={tone} style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
            {event.hook}
          </Text>
        </Box>
        {event.nodeId !== null ? (
          <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>
            #{event.nodeId}
          </Text>
        ) : null}
        <Col style={{ flexGrow: 1, flexBasis: 0, minWidth: 0 }}>
          <Text fontSize={10} color={COLORS.text} style={{ fontFamily: 'monospace' }}>
            {event.delta}
          </Text>
        </Col>
        <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>
          ·{event.id}
        </Text>
      </Row>
    </Pressable>
  );
}
