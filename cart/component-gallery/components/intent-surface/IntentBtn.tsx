import { Box, Pressable, Text } from '../../../../runtime/primitives';
import type { OnAction } from './types';

interface Props {
  /** What gets sent back as the next user message when clicked. */
  reply: string;
  /** Visual label. Defaults to the reply text. */
  label?: string;
  onAction: OnAction;
}

export function IntentBtn({ reply, label, onAction }: Props) {
  return (
    <Pressable onPress={() => onAction(reply)}>
      <Box style={{
        padding: 8,
        paddingLeft: 14,
        paddingRight: 14,
        backgroundColor: '#1d4ed8',
        borderRadius: 6,
        alignSelf: 'flex-start',
      }}>
        <Text style={{ fontSize: 14, color: '#ffffff' }}>{label ?? reply}</Text>
      </Box>
    </Pressable>
  );
}
