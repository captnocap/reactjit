// =============================================================================
// ModelColumn — one column: header + ModelPicker + ResponseStream + StatsRow
// =============================================================================
// Pure composition. No state of its own; all live data flows through the
// session store from useLlmStudioSession.
// =============================================================================

import { Box, Col, Row, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { LlmColumn } from './hooks/useLlmStudioSession';
import { ModelPicker } from './ModelPicker';
import { ResponseStream } from './ResponseStream';
import { StatsRow } from './StatsRow';

export interface ModelColumnProps {
  column: LlmColumn;
}

export function ModelColumn(props: ModelColumnProps) {
  const col = props.column;
  return (
    <Col style={{
      gap: 6, padding: 8,
      flexGrow: 1, flexBasis: 320, minWidth: 280,
      borderRadius: TOKENS.radiusMd, borderWidth: 1,
      borderColor: col.streaming ? COLORS.blue : COLORS.border,
      backgroundColor: COLORS.panelRaised,
    }}>
      <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text fontSize={10} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>
          {col.config.provider}
        </Text>
        <Text fontSize={11} color={COLORS.textBright} style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
          {col.config.model || '(no model)'}
        </Text>
        <Box style={{ flexGrow: 1 }} />
        <Text fontSize={9} color={COLORS.textDim} style={{ fontFamily: 'monospace' }}>
          T={((col.config.temperature ?? 0.7)).toFixed(2)} · max={col.config.maxTokens ?? 1024}
        </Text>
      </Row>
      <ModelPicker columnId={col.id} config={col.config} />
      <ResponseStream column={col} />
      <StatsRow stats={col.stats} streaming={col.streaming} />
    </Col>
  );
}
