
import { Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS } from '../../theme';

import type { ToastAction } from './useToast';

export function ToastActions(props: { actions: ToastAction[]; compact?: boolean }) {
  if (!props.actions || props.actions.length === 0) return null;

  return (
    <Row style={{ gap: 6, flexWrap: 'wrap' }}>
      {props.actions.slice(0, 4).map((action) => (
        <Pressable
          key={action.label}
          onPress={action.onPress}
          style={{
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 5,
            paddingBottom: 5,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: action.tone || COLORS.border,
            backgroundColor: COLORS.panelAlt,
          }}
        >
          <Text fontSize={9} color={action.tone || COLORS.textBright} style={{ fontWeight: 'bold' }}>
            {action.label}
          </Text>
        </Pressable>
      ))}
    </Row>
  );
}
