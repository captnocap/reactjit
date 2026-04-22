const React: any = require('react');
import { Box, Col, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { Glyph } from '../shared';
import { usePulse } from '../../anim';
import { ToolCallBadge } from './ToolCallBadge';

export function GeneratingIndicator(props: { toolExecutions: any[] }) {
  const toolExecutions = Array.isArray(props.toolExecutions) ? props.toolExecutions : [];
  const pulse = usePulse(0.5, 1, 1200);
  return (
    <Col style={{ gap: 8 }}>
      {toolExecutions.length > 0 ? (
        <Box style={{ gap: 8 }}>
          <Text fontSize={10} color={COLORS.textDim}>Live tool calls</Text>
          {toolExecutions.map((execItem: any) => (
            <ToolCallBadge key={execItem.id} exec={execItem} />
          ))}
        </Box>
      ) : null}
      <Row style={{ gap: 8, alignItems: 'center' }}>
        <Box style={{ opacity: pulse }}>
          <Glyph icon="bot" tone={COLORS.green} backgroundColor="#143120" tiny={true} />
        </Box>
        <Box style={{ padding: 10, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
          <Text fontSize={10} color={COLORS.textDim}>
            {toolExecutions.some((item: any) => item.status === 'running') ? 'running tool chain' : 'thinking'}
          </Text>
        </Box>
        <Row style={{ gap: 2 }}>
          {[0, 1, 2].map(i => (
            <Box key={i} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.green, opacity: (Date.now() / 400 + i) % 3 > 1.5 ? 1 : 0.3 }} />
          ))}
        </Row>
      </Row>
    </Col>
  );
}
