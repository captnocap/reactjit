import { Box, Text } from '../../../runtime/primitives';
import { COLORS } from '../constants';

export default function Badge({ text, color = COLORS.blue }: { text: string; color?: string }) {
  return (
    <Box
      style={{
        backgroundColor: `${color}18`,
        borderRadius: 4,
        paddingLeft: 6,
        paddingRight: 6,
        paddingTop: 2,
        paddingBottom: 2,
        borderWidth: 1,
        borderColor: `${color}30`,
      }}
    >
      <Text fontSize={9} color={color} style={{ fontWeight: 'bold' }}>
        {text}
      </Text>
    </Box>
  );
}
