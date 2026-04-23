import { Box, Text } from '../../../../runtime/primitives';
import { CHAT_CARD } from './tokens';

function ThermometerBadge() {
  return (
    <Box
      style={{
        position: 'absolute',
        right: -4,
        bottom: -4,
        width: 13,
        height: 13,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: CHAT_CARD.panel,
        borderWidth: 1,
        borderColor: CHAT_CARD.orange,
        borderRadius: 99,
      }}
    >
      <Text style={{ fontFamily: 'monospace', fontSize: 8, color: CHAT_CARD.orange }}>t</Text>
    </Box>
  );
}

export function TrustThermometerAvatar({ value }: { value: string }) {
  return (
    <Box
      style={{
        position: 'relative',
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#3d2a26',
        borderWidth: 2,
        borderColor: CHAT_CARD.orange,
        borderRadius: 4,
      }}
    >
      <Text style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 'bold', color: CHAT_CARD.orange }}>{value}</Text>
      <ThermometerBadge />
    </Box>
  );
}

