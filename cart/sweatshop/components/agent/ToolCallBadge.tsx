const React: any = require('react');
import { Box, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { Pill } from '../shared';
import type { ToolExecution } from '../../types';

export function ToolCallBadge(props: { exec: ToolExecution }) {
  const execItem = props.exec;
  const statusColor =
    execItem.status === 'completed' ? COLORS.green : execItem.status === 'error' ? COLORS.red : COLORS.blue;
  return (
    <Box style={{ padding: 10, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, gap: 6 }}>
      <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
          {execItem.name}
        </Text>
        <Text fontSize={10} color={COLORS.textDim}>
          {execItem.input}
        </Text>
        <Pill label={execItem.status} color={statusColor} borderColor={statusColor} backgroundColor={COLORS.panelRaised} tiny={true} />
      </Row>
      <Text fontSize={10} color={COLORS.text}>
        {execItem.result}
      </Text>
    </Box>
  );
}
