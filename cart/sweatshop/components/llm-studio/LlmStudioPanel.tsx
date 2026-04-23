// =============================================================================
// LlmStudioPanel — multi-column model comparison surface
// =============================================================================
// Scroll body: PromptComposer at top, a horizontal row of ModelColumns, then
// the last-response ComparisonView. Add-column button lives in the header.
// All state + streams flow through useLlmStudioSession + useFanOut — this
// file is pure orchestration.
// =============================================================================

import { Box, Col, Pressable, Row, ScrollView, Text } from '../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { addColumn, useLlmStudioSession } from './hooks/useLlmStudioSession';
import { PromptComposer } from './PromptComposer';
import { ModelColumn } from './ModelColumn';
import { ComparisonView } from './ComparisonView';

export function LlmStudioPanel() {
  const s = useLlmStudioSession();
  const streamingCount = s.columns.filter((c) => c.streaming).length;
  const totalCost = s.columns.reduce((acc, c) => acc + c.stats.costEstUsd, 0);

  return (
    <ScrollView style={{ width: '100%', height: '100%', backgroundColor: COLORS.panelBg }}>
      <Col style={{ padding: 10, gap: 10 }}>
        <Row style={{
          alignItems: 'center', gap: 8, flexWrap: 'wrap',
          padding: 10, borderRadius: TOKENS.radiusMd, borderWidth: 1,
          borderColor: COLORS.blue, backgroundColor: COLORS.panelRaised,
        }}>
          <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>LLM Studio</Text>
          <Text fontSize={10} color={COLORS.textDim}>
            {s.columns.length} column{s.columns.length === 1 ? '' : 's'} ·
            {streamingCount > 0 ? ' ' + streamingCount + ' streaming' : ' idle'} ·
            session cost est ${totalCost.toFixed(6)}
          </Text>
          <Box style={{ flexGrow: 1 }} />
          <Pressable onPress={() => addColumn()} style={{
            paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4,
            borderRadius: TOKENS.radiusSm, borderWidth: 1,
            borderColor: COLORS.blue, backgroundColor: COLORS.blueDeep,
          }}>
            <Text fontSize={10} color={COLORS.blue} style={{ fontWeight: 'bold' }}>+ add column</Text>
          </Pressable>
        </Row>

        <PromptComposer />

        <Row style={{ gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {s.columns.length === 0 ? (
            <Box style={{
              padding: 14, borderRadius: TOKENS.radiusMd, borderWidth: 1,
              borderColor: COLORS.border, backgroundColor: COLORS.panelRaised,
            }}>
              <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>No columns</Text>
              <Text fontSize={10} color={COLORS.textDim}>Click “+ add column” to configure a model, then use Fan-out to send the same prompt everywhere.</Text>
            </Box>
          ) : null}
          {s.columns.map((c) => (
            <ModelColumn key={c.id} column={c} />
          ))}
        </Row>

        <ComparisonView session={s} />
      </Col>
    </ScrollView>
  );
}
