import { Text } from '@reactjit/runtime/primitives';
import { COLORS } from '../../theme';

export function MessageTimestamp(props: { time: string; visible: boolean }) {
  if (!props.visible) return null;
  return (
    <Text fontSize={9} color={COLORS.textDim}>
      {props.time}
    </Text>
  );
}
