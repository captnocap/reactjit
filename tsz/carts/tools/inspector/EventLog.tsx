// =============================================================================
// EventLog — scrollback of recorded inspector events, filterable
// =============================================================================
// Shows every InspectorEvent the store has captured, newest last. Text filter
// matches against hook name, node id, and delta. A row of hook pills at the
// top scopes the log to one hook family (click to toggle).
//
// Controls in the header: record on/off toggle, clear button, current buffer
// size stepper (persisted via setEventBuffer). Clicking a row pins the
// TimeTravel cursor — TimeTravel then shows the corresponding state.
// =============================================================================

const React: any = require('react');
const { useMemo } = React;

import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../../../cart/sweatshop/theme';
import { EventLogRow } from './EventLogRow';
import {
  useInspectorStore,
  setRecordEnabled,
  setEventFilter,
  setEventBuffer,
  setTimeCursor,
  setSelectedNodeId,
  clearEvents,
} from './useInspectorStore';

const HOOK_FAMILIES = ['useState', 'useEffect', 'propEdit', 'useMemo', 'useCallback', 'useRef', 'custom'];

export function EventLog() {
  const store = useInspectorStore();
  // React is typed `any` per jsrt_shim convention, so the type arg goes on
  // the tuple destructure rather than the call site to keep tsc quiet.
  const familyState: [string | null, (v: string | null) => void] = React.useState(null);
  const familyFilter = familyState[0];
  const setFamilyFilter = familyState[1];

  const filtered = useMemo(() => {
    const q = (store.eventFilter || '').toLowerCase();
    return store.events.filter((e) => {
      if (familyFilter && e.hook !== familyFilter) return false;
      if (!q) return true;
      const hay = (e.hook + ' #' + (e.nodeId ?? '') + ' ' + e.delta).toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }, [store.events, store.eventFilter, familyFilter]);

  const total = store.events.length;

  function onRowSelect(index: number, nodeId: number | null) {
    // Translate the filtered-index back to absolute index since TimeTravel
    // operates on the full unfiltered event list.
    const absolute = store.events.indexOf(filtered[index]);
    if (absolute >= 0) setTimeCursor(absolute);
    if (nodeId !== null) setSelectedNodeId(nodeId);
  }

  return (
    <Col style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, gap: 8 }}>
      <Row style={{
        alignItems: 'center', gap: 8, flexWrap: 'wrap',
        padding: 8, borderRadius: TOKENS.radiusSm, borderWidth: 1,
        borderColor: COLORS.border, backgroundColor: COLORS.panelRaised,
      }}>
        <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Events</Text>
        <Text fontSize={10} color={COLORS.textDim}>
          {total} recorded · {filtered.length} shown · cap {store.eventBuffer}
        </Text>

        <Box style={{ flexGrow: 1 }} />

        <Pressable onPress={() => setRecordEnabled(!store.recordEnabled)} style={{
          paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4,
          borderRadius: TOKENS.radiusPill, borderWidth: 1,
          borderColor: store.recordEnabled ? COLORS.red : COLORS.border,
          backgroundColor: store.recordEnabled ? COLORS.redDeep : COLORS.panelAlt,
        }}>
          <Text fontSize={10} color={store.recordEnabled ? COLORS.red : COLORS.textDim} style={{ fontWeight: 'bold' }}>
            {store.recordEnabled ? '● REC' : '○ IDLE'}
          </Text>
        </Pressable>

        <Row style={{ alignItems: 'center', gap: 4 }}>
          <Pressable onPress={() => setEventBuffer(store.eventBuffer - 100)} style={{ width: 22, height: 22, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, justifyContent: 'center', alignItems: 'center' }}>
            <Text fontSize={10} color={COLORS.blue} style={{ fontWeight: 'bold' }}>−</Text>
          </Pressable>
          <Text fontSize={10} color={COLORS.textDim} style={{ fontFamily: 'monospace', minWidth: 40, textAlign: 'center' as any }}>
            {store.eventBuffer}
          </Text>
          <Pressable onPress={() => setEventBuffer(store.eventBuffer + 100)} style={{ width: 22, height: 22, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, justifyContent: 'center', alignItems: 'center' }}>
            <Text fontSize={10} color={COLORS.blue} style={{ fontWeight: 'bold' }}>+</Text>
          </Pressable>
        </Row>

        <Pressable onPress={clearEvents} style={{
          paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4,
          borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt,
        }}>
          <Text fontSize={10} color={COLORS.textDim}>clear</Text>
        </Pressable>
      </Row>

      <Row style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextInput
          value={store.eventFilter}
          onChangeText={setEventFilter}
          placeholder="Filter events (hook / id / delta)…"
          style={{
            flexBasis: 200, flexShrink: 1, flexGrow: 1, minWidth: 140, height: 26,
            borderWidth: 1, borderColor: COLORS.border, borderRadius: TOKENS.radiusSm,
            paddingLeft: 8, backgroundColor: COLORS.panelBg, fontFamily: 'monospace',
          }}
        />
        {HOOK_FAMILIES.map((h) => {
          const active = familyFilter === h;
          return (
            <Pressable key={h} onPress={() => setFamilyFilter(active ? null : h)} style={{
              paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3,
              borderRadius: TOKENS.radiusPill, borderWidth: 1,
              borderColor: active ? COLORS.blue : COLORS.border,
              backgroundColor: active ? COLORS.panelHover : COLORS.panelAlt,
            }}>
              <Text fontSize={9} color={active ? COLORS.blue : COLORS.textDim} style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                {h}
              </Text>
            </Pressable>
          );
        })}
      </Row>

      <ScrollView style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, backgroundColor: COLORS.panelBg }}>
        <Col style={{ gap: 2, padding: 4 }}>
          {filtered.length === 0 ? (
            <Box style={{ padding: 14, alignItems: 'center' }}>
              <Text fontSize={10} color={COLORS.textDim}>
                {total === 0 ? (store.recordEnabled ? 'Waiting for events…' : 'Recording paused.') : 'No events match the current filter.'}
              </Text>
            </Box>
          ) : null}
          {filtered.map((e, idx) => (
            <EventLogRow key={e.id} event={e} index={idx}
              selected={store.timeCursor !== -1 && store.events[store.timeCursor] && store.events[store.timeCursor].id === e.id}
              onSelect={onRowSelect} />
          ))}
        </Col>
      </ScrollView>
    </Col>
  );
}
