import { Box, Pressable, Text } from '../../../../runtime/primitives';
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
        backgroundColor: '#1a2135',
        borderWidth: 1,
        borderColor: '#415070',
        borderRadius: 4,
      }}
    >
      <Box style={{ width: 7, height: 7, backgroundColor: CHAT_CARD.faint, borderRadius: 2 }} />
    </Pressable>
  );
}

