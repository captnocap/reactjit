const React: any = require('react');
const { useState } = React;
import { Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';
import { HoverPressable } from '../shared';

export function MessageReactions() {
  const [reaction, setReaction] = useState<'up' | 'down' | null>(null);
  return (
    <Row style={{ gap: 6, alignItems: 'center', paddingLeft: 4 }}>
      <HoverPressable
        onPress={() => setReaction(reaction === 'up' ? null : 'up')}
        style={{ padding: 2, borderRadius: 4, backgroundColor: reaction === 'up' ? COLORS.blueDeep : 'transparent' }}
      >
        <Text fontSize={10} color={reaction === 'up' ? COLORS.blue : COLORS.textDim}>👍</Text>
      </HoverPressable>
      <HoverPressable
        onPress={() => setReaction(reaction === 'down' ? null : 'down')}
        style={{ padding: 2, borderRadius: 4, backgroundColor: reaction === 'down' ? '#341316' : 'transparent' }}
      >
        <Text fontSize={10} color={reaction === 'down' ? COLORS.red : COLORS.textDim}>👎</Text>
      </HoverPressable>
    </Row>
  );
}
