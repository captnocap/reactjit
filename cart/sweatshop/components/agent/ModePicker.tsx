const React: any = require('react');
import { Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { HoverPressable } from '../shared';

const MODES = ['ask', 'plan', 'task', 'agent'] as const;

export function ModePicker(props: { agentMode: string; onSetMode: (mode: string) => void }) {
  return (
    <Row style={{ gap: 6, flexWrap: 'wrap' }}>
      {MODES.map((mode) => (
        <HoverPressable
          key={mode}
          onPress={() => props.onSetMode(mode)}
          style={{
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: props.agentMode === mode ? (mode === 'task' ? COLORS.green : mode === 'agent' ? COLORS.orange : COLORS.blue) : COLORS.border,
            backgroundColor: props.agentMode === mode ? (mode === 'task' ? '#182510' : mode === 'agent' ? '#26180f' : COLORS.blueDeep) : COLORS.panelAlt,
          }}
        >
          <Text fontSize={10} color={props.agentMode === mode ? (mode === 'task' ? COLORS.green : mode === 'agent' ? COLORS.orange : COLORS.blue) : COLORS.text}>
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </Text>
        </HoverPressable>
      ))}
    </Row>
  );
}
