const React: any = require('react');

import { Box, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../../theme';
import { StatusSegment } from '../StatusSegment';
import { registerSegment } from '../useStatusRegistry';

function Dot(props: { color: string }) {
  return <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: props.color }} />;
}

export function AgentStatusSegment(props: any) {
  const agentActive = props.agentStatusText && props.agentStatusText !== 'idle';
  const agentColor = agentActive ? COLORS.yellow : COLORS.textDim;
  return (
    <StatusSegment onPress={props.onOpenChat} tooltip="Agent status — click to open chat">
      <Dot color={agentColor} />
      <Text fontSize={10} color={agentColor}>
        {props.agentStatusText || 'idle'}
      </Text>
    </StatusSegment>
  );
}

registerSegment({
  id: 'agent-status',
  label: 'Agent Status',
  defaultPosition: 'right',
  defaultVisible: true,
  priority: 170,
  component: AgentStatusSegment,
});
