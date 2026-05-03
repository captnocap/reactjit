import { Box, Pressable, Text } from '@reactjit/runtime/primitives';
import { CHAT_CARD } from './tokens';

export function KillSwitch() {
  return (
    <Pressable
      onPress={() => {}}
      style={{
        width: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#14100d',
        borderWidth: 1,
        borderColor: '#4a4238',
        borderRadius: 4,
      }}
    >
      <Box style={{ width: 7, height: 7, backgroundColor: CHAT_CARD.faint, borderRadius: 2 }} />
    </Pressable>
  );
}

